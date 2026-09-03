/**
 * Formato de transporte `.solara.json`: envelope de proyecto sin compresión.
 * La lectura trata el archivo como entrada no confiable y valida schema antes
 * de incorporarlo al estado del editor.
 *
 * La serialización usa el códec acotado de `@solara/exporter/json-stream`:
 * con proyectos cuyos recursos embebidos superan el límite de cadena de V8
 * (~536 MB de caracteres), `JSON.stringify`/`JSON.parse` del documento entero
 * lanza `RangeError: Invalid string length`. El códec trabaja por trozos y
 * produce exactamente el mismo texto que `JSON.stringify(x, null, 2)`.
 */

import {
  parseJsonBytesChunked,
  stringifyJsonToBytes,
  writeJsonChunks,
} from "@solara/exporter/json-stream";
import type { StoreProjectV2 } from "@solara/project-schema";
import { StoreProjectV2Schema } from "@solara/project-schema";

interface ArchiveEnvelope {
  format: "solara-project";
  version: 2;
  projectId: string;
  exportedAt: string;
  project: StoreProjectV2;
}

function buildEnvelope(project: StoreProjectV2): ArchiveEnvelope {
  const parsed = StoreProjectV2Schema.parse(project);
  return {
    format: "solara-project",
    version: 2,
    projectId: parsed.id,
    exportedAt: new Date().toISOString(),
    project: parsed,
  };
}

export function createProjectArchive(project: StoreProjectV2): string {
  const chunks: string[] = [];
  writeJsonChunks(buildEnvelope(project), (chunk) => chunks.push(chunk));
  return `${chunks.join("")}\n`;
}

/** Igual que `createProjectArchive`, pero en bytes UTF-8 sin cadena gigante. */
export function createProjectArchiveBytes(project: StoreProjectV2): Uint8Array {
  const body = stringifyJsonToBytes(buildEnvelope(project));
  const output = new Uint8Array(body.byteLength + 1);
  output.set(body);
  output[body.byteLength] = 0x0a;
  return output;
}

export function readProjectArchive(input: string | Uint8Array): StoreProjectV2 {
  let envelope: Partial<ArchiveEnvelope>;
  try {
    const raw = typeof input === "string" ? JSON.parse(input) : parseJsonBytesChunked(input);
    envelope = raw as Partial<ArchiveEnvelope>;
  } catch {
    throw new Error("El respaldo está corrupto o no es JSON válido.");
  }
  if (envelope.format !== "solara-project" || envelope.version !== 2) {
    throw new Error(
      "Este respaldo pertenece a una version anterior y no es compatible. Conserva el archivo original y crea una nueva tienda con el sistema actual.",
    );
  }
  const parsed = StoreProjectV2Schema.safeParse(envelope.project);
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
