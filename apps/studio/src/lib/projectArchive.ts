/**
 * Formato de transporte `.solara.zip`: manifest de proyecto, JSON validado y
 * assets. La lectura trata el archivo como entrada no confiable y valida schema
 * y rutas antes de incorporarlo al estado del editor.
 */
import type { StoreProjectV2 } from "@solara/project-schema";
import { StoreProjectV2Schema } from "@solara/project-schema";
import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";

interface ArchiveManifest {
  format: "solara-project";
  version: 2;
  projectId: string;
  exportedAt: string;
}

function dataUrlBytes(source: string): Uint8Array | undefined {
  const match = /^data:([^;,]+)?(;base64)?,(.*)$/s.exec(source);
  if (!match) return undefined;
  if (match[2]) {
    const binary = atob(match[3] ?? "");
    return Uint8Array.from(binary, (character) => character.charCodeAt(0));
  }
  return new TextEncoder().encode(decodeURIComponent(match[3] ?? ""));
}

function extension(mimeType: string): string {
  const subtype = mimeType.split("/")[1]?.split(";")[0] ?? "bin";
  return subtype === "jpeg" ? "jpg" : subtype;
}

export function createProjectArchive(project: StoreProjectV2): Uint8Array {
  const parsed = StoreProjectV2Schema.parse(project);
  const manifest: ArchiveManifest = {
    format: "solara-project",
    version: 2,
    projectId: parsed.id,
    exportedAt: new Date().toISOString(),
  };
  const files: Record<string, Uint8Array> = {
    "manifest.json": strToU8(JSON.stringify(manifest, null, 2)),
    "project.json": strToU8(JSON.stringify(parsed, null, 2)),
  };
  parsed.assets.forEach((asset) => {
    const bytes = dataUrlBytes(asset.source);
    if (bytes) files[`assets/${asset.hash}.${extension(asset.mimeType)}`] = bytes;
  });
  parsed.videos.forEach((video) => {
    const bytes = dataUrlBytes(video.source);
    if (bytes) files[`assets/${video.hash}.${extension(video.mimeType)}`] = bytes;
  });
  return zipSync(files, { level: 6 });
}

export function readProjectArchive(input: Uint8Array): StoreProjectV2 {
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
  if (manifest.format !== "solara-project" || manifest.version !== 2) {
    throw new Error(
      "Este respaldo pertenece a una version anterior y no es compatible. Conserva el ZIP original y crea una nueva tienda con el sistema actual.",
    );
  }

  let project: unknown;
  try {
    project = JSON.parse(strFromU8(projectFile));
  } catch {
    throw new Error("El proyecto dentro del respaldo está corrupto.");
  }
  const parsed = StoreProjectV2Schema.safeParse(project);
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
