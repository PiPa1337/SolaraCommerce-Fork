import type { AuditIssue, ExportMode } from "@solara/exporter";
import type { Product, StoreProjectV1 } from "@solara/project-schema";

interface WorkerSuccess<Result> {
  id: string;
  ok: true;
  result: Result;
}

interface WorkerFailure {
  id: string;
  ok: false;
  error: string;
}

type WorkerResponse<Result> = WorkerSuccess<Result> | WorkerFailure;

export interface ProcessedImage {
  width: number;
  height: number;
  primary: string;
  fallback: string;
  responsive: Array<{ width: number; source: string }>;
}

function requestWorker<Request extends object, Result>(
  worker: Worker,
  request: Request,
  transfer: Transferable[] = [],
): Promise<Result> {
  const id = crypto.randomUUID();
  return new Promise((resolve, reject) => {
    const handleMessage = (event: MessageEvent<WorkerResponse<Result>>) => {
      if (event.data.id !== id) return;
      worker.removeEventListener("message", handleMessage);
      if (event.data.ok) resolve(event.data.result);
      else reject(new Error(event.data.error));
    };
    worker.addEventListener("message", handleMessage);
    worker.postMessage({ ...request, id }, transfer);
  });
}

let csvWorker: Worker | undefined;
let imageWorker: Worker | undefined;
let exportWorker: Worker | undefined;

function getCsvWorker(): Worker {
  csvWorker ??= new Worker(new URL("../workers/csv.worker.ts", import.meta.url), {
    type: "module",
  });
  return csvWorker;
}

function getImageWorker(): Worker {
  imageWorker ??= new Worker(new URL("../workers/image.worker.ts", import.meta.url), {
    type: "module",
  });
  return imageWorker;
}

function getExportWorker(): Worker {
  exportWorker ??= new Worker(new URL("../workers/export.worker.ts", import.meta.url), {
    type: "module",
  });
  return exportWorker;
}

export function importCsvInWorker(csv: string): Promise<Product[]> {
  return requestWorker(getCsvWorker(), { type: "import", csv });
}

export function exportCsvInWorker(products: Product[]): Promise<string> {
  return requestWorker(getCsvWorker(), { type: "export", products });
}

export async function hashFile(file: File): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function processImageInWorker(file: File): Promise<ProcessedImage> {
  const buffer = await file.arrayBuffer();
  return requestWorker(
    getImageWorker(),
    {
      buffer,
      name: file.name,
      type: file.type || "image/jpeg",
      maxWidth: 1800,
    },
    [buffer],
  );
}

export function exportSiteInWorker(
  project: StoreProjectV1,
  mode: ExportMode,
): Promise<{ zip: Uint8Array; audit: AuditIssue[] }> {
  return requestWorker(getExportWorker(), { type: "site", project, mode });
}

export function createProjectArchiveInWorker(project: StoreProjectV1): Promise<Uint8Array> {
  return requestWorker(getExportWorker(), { type: "project-write", project });
}

export async function readProjectArchiveInWorker(file: File): Promise<StoreProjectV1> {
  const buffer = await file.arrayBuffer();
  return requestWorker(getExportWorker(), { type: "project-read", buffer }, [buffer]);
}
