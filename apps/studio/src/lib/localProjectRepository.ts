import type { StoreProjectV1 } from "@solara/project-schema";
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

export async function loadDiskProject(summary: LocalProjectSummary): Promise<DiskProject> {
  const archive = await readLocalProject(summary.projectId);
  const project = await readProjectArchiveBytesInWorker(archive);
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
  recovery: Array<{ id: string; name: string; updatedAt: string; message: string }>;
}> {
  const listing = await listLocalProjects();
  const projects: DiskProject[] = [];
  const recovery = listing.recovery.map((item) => ({
    id: `disk:${item.folder}`,
    name: item.folder,
    updatedAt: "",
    message: item.message,
  }));
  for (const summary of listing.projects) {
    try {
      const loaded = await loadDiskProject(summary);
      // IndexedDB queda como caché para operaciones que aún no necesitan disco;
      // el archivo y su manifest siguen siendo la autoridad al abrir la tienda.
      await saveProject(loaded.project);
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

export async function persistProjectToDisk(
  project: StoreProjectV1,
  expectedVersion: number | null,
): Promise<{ receipt: LocalSaveReceipt; siteError?: string }> {
  const projectArchive = await createProjectArchiveInWorker(project);
  const verifiedProject = await readProjectArchiveBytesInWorker(projectArchive);
  if (verifiedProject.id !== project.id) {
    throw new Error("El respaldo generado no coincide con la tienda actual.");
  }
  let siteArchive: Uint8Array | undefined;
  let siteError: string | undefined;
  try {
    siteArchive = (await exportSiteInWorker(project, "production")).zip;
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
    siteArchive,
  );
  return { receipt, ...(siteError ? { siteError } : {}) };
}
