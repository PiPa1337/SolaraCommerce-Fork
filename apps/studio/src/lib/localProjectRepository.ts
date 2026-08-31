/**
 * Orquestador de Guardar: valida y archiva el snapshot en Worker, intenta
 * exportar production y envía proyecto/sitio a una transacción local. Un fallo
 * del sitio no debe descartar el respaldo editable ni el último sitio válido.
 */
import type { StoreProjectV1 } from "@solara/project-schema";
import { ensureCatalogModernV2Sections } from "@solara/project-schema/catalog-modern-template";
import { isBaseTemplate } from "@solara/project-schema/project-policy";
import {
  type LocalProjectSummary,
  type LocalSaveReceipt,
  listLocalProjects,
  readLocalProject,
  saveLocalProject,
} from "./localStorage";
import {
  optimizeProjectAssets,
  repairProjectMediaMetadata,
  type StoredProject,
  saveProject,
} from "./repository";
import {
  createProjectArchiveInWorker,
  exportSiteInWorker,
  readProjectArchiveBytesInWorker,
} from "./workers";

export interface DiskProject extends StoredProject {
  diskVersion: number;
  diskStatus: "synced" | "site-outdated";
  mediaRepairPending: boolean;
}

/**
 * El respaldo en disco puede provenir de una versión que todavía guardaba las
 * páginas secundarias V2 sin secciones. La UI necesita abrir el mismo contrato
 * normalizado que usa el repositorio IndexedDB y el exporter.
 */
export function normalizeLoadedProject(project: StoreProjectV1): StoreProjectV1 {
  return repairProjectMediaMetadata(ensureCatalogModernV2Sections(project));
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.byteLength; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }
  return btoa(binary);
}

export function serializeSiteFiles(files: ReadonlyMap<string, string | Uint8Array>): string {
  return JSON.stringify(
    [...files.entries()].map(([path, value]) =>
      typeof value === "string"
        ? { path, encoding: "utf8", data: value }
        : { path, encoding: "base64", data: bytesToBase64(value) },
    ),
  );
}

export async function loadDiskProject(summary: LocalProjectSummary): Promise<DiskProject> {
  const archive = await readLocalProject(summary.projectId);
  const storedProject = await readProjectArchiveBytesInWorker(archive);
  const normalized = normalizeLoadedProject(storedProject);
  const project = await optimizeProjectAssets(normalized);
  return {
    id: project.id,
    name: project.name,
    status: project.status,
    updatedAt: project.updatedAt,
    project,
    diskVersion: summary.version,
    diskSiteStatus: summary.siteOutdated ? "site-outdated" : "synced",
    diskStatus: summary.siteOutdated ? "site-outdated" : "synced",
    // Los normalizadores pueden devolver un objeto nuevo aunque el snapshot
    // no haya cambiado. Persistir por referencia creaba versiones espurias y
    // dejaba stale la expectedVersion del editor tras crear una tienda.
    mediaRepairPending: JSON.stringify(project) !== JSON.stringify(storedProject),
  };
}

export async function loadAllDiskProjects(): Promise<{
  projects: DiskProject[];
  recovery: Array<{
    id: string;
    name: string;
    updatedAt: string;
    message: string;
    projectId?: string;
    diskVersion?: number;
  }>;
}> {
  const listing = await listLocalProjects();
  const projects: DiskProject[] = [];
  const recovery = listing.recovery.map((item) => ({
    id: `disk:${item.folder}`,
    name: item.folder,
    updatedAt: "",
    message: item.message,
    ...(item.projectId ? { projectId: item.projectId } : {}),
    ...(Number.isInteger(item.version) ? { diskVersion: item.version } : {}),
  }));
  const loadedResults = await Promise.all(
    listing.projects.map(async (summary) => {
      try {
        const loaded = await loadDiskProject(summary);
        await saveProject(loaded.project, {
          allowProtectedWrite: isBaseTemplate(loaded.project),
        });
        return { ok: true as const, loaded };
      } catch (error) {
        return {
          ok: false as const,
          summary,
          message:
            error instanceof Error ? error.message : "No se pudo validar el respaldo en disco.",
        };
      }
    }),
  );
  for (const result of loadedResults) {
    if (result.ok) projects.push(result.loaded);
    else
      recovery.push({
        id: `disk:${result.summary.projectId}`,
        name: result.summary.name,
        updatedAt: result.summary.updatedAt,
        message: result.message,
      });
  }
  projects.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  return { projects, recovery };
}

/** Crea artefactos y delega el commit versionado al API loopback. */
export async function persistProjectToDisk(
  project: StoreProjectV1,
  expectedVersion: number | null,
  options: { allowProtectedWrite?: boolean } = {},
): Promise<{ receipt: LocalSaveReceipt; siteError?: string }> {
  const projectArchive = await createProjectArchiveInWorker(project);
  const verifiedProject = await readProjectArchiveBytesInWorker(
    new TextEncoder().encode(projectArchive),
  );
  if (verifiedProject.id !== project.id) {
    throw new Error("El respaldo generado no coincide con la tienda actual.");
  }
  let siteMap: string | undefined;
  let siteError: string | undefined;
  try {
    const site = await exportSiteInWorker(project, "production");
    siteMap = serializeSiteFiles(site.files);
  } catch (error) {
    siteError =
      error instanceof Error ? error.message : "La exportación de producción no pudo completarse.";
  }
  const receipt = await saveLocalProject(
    {
      projectId: project.id,
      name: project.name,
      slug: project.slug,
      projectUpdatedAt: project.updatedAt,
      expectedVersion,
      // El servidor exige el canal de upgrade explícito para tocar la plantilla
      // protegida; sin esta marca, beginSave rechaza con PROTECTED_STORE.
      ...(options.allowProtectedWrite
        ? { actor: { kind: "template-upgrade" as const }, allowProtectedWrite: true }
        : {}),
    },
    projectArchive,
    siteMap,
  );
  return { receipt, ...(siteError ? { siteError } : {}) };
}
