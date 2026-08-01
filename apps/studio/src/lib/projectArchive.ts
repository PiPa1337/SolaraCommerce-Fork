import type { StoreProjectV1 } from "@solara/project-schema";
import { StoreProjectV1Schema } from "@solara/project-schema";
import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";

interface ArchiveManifest {
  format: "solara-project";
  version: 1;
  projectId: string;
  exportedAt: string;
}

export function createProjectArchive(project: StoreProjectV1): Uint8Array {
  const parsed = StoreProjectV1Schema.parse(project);
  const manifest: ArchiveManifest = {
    format: "solara-project",
    version: 1,
    projectId: parsed.id,
    exportedAt: new Date().toISOString(),
  };
  return zipSync(
    {
      "manifest.json": strToU8(JSON.stringify(manifest, null, 2)),
      "project.json": strToU8(JSON.stringify(parsed, null, 2)),
    },
    { level: 6 },
  );
}

export function readProjectArchive(input: Uint8Array): StoreProjectV1 {
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(input);
  } catch {
    throw new Error("El respaldo está corrupto o no es un ZIP válido.");
  }
  const manifestFile = files["manifest.json"];
  const projectFile = files["project.json"];
  if (!manifestFile || !projectFile) {
    throw new Error("El respaldo no contiene manifest.json y project.json.");
  }

  let manifest: Partial<ArchiveManifest>;
  try {
    manifest = JSON.parse(strFromU8(manifestFile)) as Partial<ArchiveManifest>;
  } catch {
    throw new Error("El manifest del respaldo está corrupto.");
  }
  if (manifest.format !== "solara-project" || manifest.version !== 1) {
    throw new Error("La versión del archivo Solara no es compatible con esta versión de Studio.");
  }

  let project: unknown;
  try {
    project = JSON.parse(strFromU8(projectFile));
  } catch {
    throw new Error("El proyecto dentro del respaldo está corrupto.");
  }
  const parsed = StoreProjectV1Schema.safeParse(project);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const path = issue?.path.join(".") || "project";
    throw new Error(
      "El proyecto no es compatible: " +
        path +
        ": " +
        (issue?.message ?? "validación fallida") +
        ". Conservá el archivo original.",
    );
  }
  return parsed.data;
}

export type DownloadData = string | Blob | Uint8Array;

function blobPart(data: DownloadData): BlobPart {
  if (!(data instanceof Uint8Array)) return data;
  const copy = new Uint8Array(data.byteLength);
  copy.set(data);
  return copy.buffer;
}

export function downloadBlob(data: DownloadData, filename: string, mimeType: string): void {
  const url = URL.createObjectURL(new Blob([blobPart(data)], { type: mimeType }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

export function normalizePublicExport(result: unknown): DownloadData {
  if (result instanceof Blob || result instanceof Uint8Array || typeof result === "string") {
    return result;
  }
  if (typeof result === "object" && result !== null) {
    const record = result as Record<string, unknown>;
    const candidate = record.zip ?? record.bytes ?? record.data;
    if (
      candidate instanceof Blob ||
      candidate instanceof Uint8Array ||
      typeof candidate === "string"
    ) {
      return candidate;
    }
  }
  throw new Error("El exportador no devolvió un ZIP válido.");
}
