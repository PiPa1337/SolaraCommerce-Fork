/**
 * Formato de transporte `.solara.json`: envelope de proyecto sin compresión.
 * La lectura trata el archivo como entrada no confiable y valida schema antes
 * de incorporarlo al estado del editor.
 */
import type { StoreProjectV2 } from "@solara/project-schema";
import { StoreProjectV2Schema } from "@solara/project-schema";

interface ArchiveEnvelope {
  format: "solara-project";
  version: 2;
  projectId: string;
  exportedAt: string;
  project: StoreProjectV2;
}

export function createProjectArchive(project: StoreProjectV2): string {
  const parsed = StoreProjectV2Schema.parse(project);
  const envelope: ArchiveEnvelope = {
    format: "solara-project",
    version: 2,
    projectId: parsed.id,
    exportedAt: new Date().toISOString(),
    project: parsed,
  };
  return `${JSON.stringify(envelope, null, 2)}\n`;
}

export function readProjectArchive(input: string | Uint8Array): StoreProjectV2 {
  let text: string;
  if (typeof input === "string") {
    text = input;
  } else {
    text = new TextDecoder().decode(input);
  }
  let envelope: Partial<ArchiveEnvelope>;
  try {
    envelope = JSON.parse(text) as Partial<ArchiveEnvelope>;
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
