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
import { type StoredProject, saveProject } from "./repository";
import {
  createProjectArchiveInWorker,
  exportSiteInWorker,
  readProjectArchiveBytesInWorker,
} from "./workers";

export interface DiskProject extends StoredProject {
  diskVersion: number;
  diskStatus: "synced" | "site-outdated";
}

/**
 * El respaldo en disco puede provenir de una versión que todavía guardaba las
 * páginas secundarias V2 sin secciones. La UI necesita abrir el mismo contrato
 * normalizado que usa el repositorio IndexedDB y el exporter.
 */
export function normalizeLoadedProject(project: StoreProjectV1): StoreProjectV1 {
  return ensureCatalogModernV2Sections(project);
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
  const project = normalizeLoadedProject(await readProjectArchiveBytesInWorker(archive));
  return {
    id: project.id,
    name: project.name,
    status: project.status,
    updatedAt: project.updatedAt,
    project,
    diskVersion: summary.version,
    diskSiteStatus: summary.siteOutdated ? "site-outdated" : "synced",
    diskStatus: summary.siteOutdated ? "site-outdated" : "synced",
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
  for (const summary of listing.projects) {
    try {
      const loaded = await loadDiskProject(summary);
      // IndexedDB queda como caché para operaciones que aún no necesitan disco;
      // el archivo y su manifest siguen siendo la autoridad al abrir la tienda.
      // La carga desde disco actualiza la caché de lectura de IndexedDB; no
      // es una edición de la plantilla. El permiso explícito mantiene la
      // protección para cualquier otro caller de saveProject.
      await saveProject(loaded.project, {
        allowProtectedWrite: isBaseTemplate(loaded.project),
      });
      projects.push(loaded);
    } catch (error) {
      recovery.push({
        id: `disk:${summary.projectId}`,
        name: summary.name,
        updatedAt: summary.updatedAt,
        message:
          error instanceof Error ? error.message : "No se pudo validar el respaldo en disco.",
      });
    }
  }
  projects.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  return { projects, recovery };
}

/** Crea artefactos y delega el commit versionado al API loopback. */
export async function persistProjectToDisk(
  project: StoreProjectV1,
  expectedVersion: number | null,
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
    },
    projectArchive,
    siteMap,
  );
  return { receipt, ...(siteError ? { siteError } : {}) };
}
