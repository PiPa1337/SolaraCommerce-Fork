/**
 * Fachada tipada para los Web Workers de CSV, imágenes y exportación. Su
 * responsabilidad es serializar mensajes y errores; la lógica de negocio vive
 * en paquetes compartidos para que tests y preview no diverjan.
 */
import type { CatalogCsvContext } from "@solara/core";
import type { AuditIssue, ExportMode, OptimizationReport } from "@solara/exporter";
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

const IMAGE_WIDTHS = [480, 768, 1200, 1800] as const;

function fallbackImagePlan(sourceWidth: number, sourceHeight: number, maxWidth = 1800) {
  const width = Math.min(sourceWidth, Math.max(1, Math.min(Math.floor(maxWidth), 1800)));
  const responsiveWidths = [
    ...new Set([...IMAGE_WIDTHS.filter((candidate) => candidate < width), width]),
  ].sort((left, right) => left - right);
  return {
    width,
    height: Math.max(1, Math.round((sourceHeight / sourceWidth) * width)),
    responsiveWidths,
  };
}

function canvasDataUrl(
  image: HTMLImageElement,
  width: number,
  mimeType: "image/webp" | "image/jpeg" | "image/png",
  preserveAlpha: boolean,
): string {
  const height = Math.max(1, Math.round((image.naturalHeight / image.naturalWidth) * width));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { alpha: preserveAlpha });
  if (!context) throw new Error("El navegador no pudo procesar la imagen.");
  if (!preserveAlpha) {
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, width, height);
  }
  context.drawImage(image, 0, 0, width, height);
  const quality = mimeType === "image/webp" ? 0.82 : mimeType === "image/jpeg" ? 0.88 : undefined;
  return quality === undefined ? canvas.toDataURL(mimeType) : canvas.toDataURL(mimeType, quality);
}

async function processImageOnMainThread(file: File, buffer: ArrayBuffer): Promise<ProcessedImage> {
  if (typeof document === "undefined") {
    throw new Error("El navegador no pudo procesar la imagen.");
  }
  const objectUrl = URL.createObjectURL(new Blob([buffer], { type: file.type }));
  const image = new Image();
  image.decoding = "async";
  try {
    image.src = objectUrl;
    await image.decode();
    if (image.naturalWidth < 1 || image.naturalHeight < 1) {
      throw new Error("La imagen no tiene dimensiones válidas.");
    }
    const plan = fallbackImagePlan(image.naturalWidth, image.naturalHeight);
    const preserveAlpha = file.type !== "image/jpeg";
    const responsive = plan.responsiveWidths.map((width) => ({
      width,
      source: canvasDataUrl(image, width, "image/webp", preserveAlpha),
    }));
    const primary = responsive.at(-1)?.source;
    if (!primary) throw new Error("No se pudo generar la imagen principal.");
    const fallbackType = preserveAlpha ? "image/png" : "image/jpeg";
    return {
      ...plan,
      primary,
      fallback: canvasDataUrl(image, plan.width, fallbackType, preserveAlpha),
      responsive,
    };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export interface CatalogPackageImage {
  path: string;
  type: string;
  buffer: ArrayBuffer;
}

export interface CatalogPackageContents {
  csv: string;
  images: CatalogPackageImage[];
}

function requestWorker<Request extends object, Result>(
  worker: Worker,
  request: Request,
  transfer: Transferable[] = [],
): Promise<Result> {
  const id = crypto.randomUUID();
  return new Promise((resolve, reject) => {
    const detach = () => {
      worker.removeEventListener("message", handleMessage);
      worker.removeEventListener("error", handleError);
    };
    const handleMessage = (event: MessageEvent<WorkerResponse<Result>>) => {
      if (event.data.id !== id) return;
      detach();
      if (event.data.ok) resolve(event.data.result);
      else reject(new Error(event.data.error));
    };
    const handleError = () => {
      // Un worker caído no responderá: rechazar la petición y soltar ambos
      // listeners evita promesas colgadas y acumulación de handlers.
      detach();
      reject(new Error("El worker no respondió."));
    };
    worker.addEventListener("message", handleMessage);
    worker.addEventListener("error", handleError);
    worker.postMessage({ ...request, id }, transfer);
  });
}

let csvWorker: Worker | undefined;
let imageWorker: Worker | undefined;
let exportWorker: Worker | undefined;
let catalogPackageWorker: Worker | undefined;

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

function getCatalogPackageWorker(): Worker {
  catalogPackageWorker ??= new Worker(
    new URL("../workers/catalog-package.worker.ts", import.meta.url),
    {
      type: "module",
    },
  );
  return catalogPackageWorker;
}

export function importCsvInWorker(csv: string, context?: CatalogCsvContext): Promise<Product[]> {
  return requestWorker(
    getCsvWorker(),
    context ? { type: "import", csv, context } : { type: "import", csv },
  );
}

export interface CsvRowError {
  row: number;
  message: string;
}

/** Diagnostica un CSV fallido y reporta el error de cada fila inválida. */
export function diagnoseCsvInWorker(
  csv: string,
  context?: CatalogCsvContext,
): Promise<CsvRowError[]> {
  return requestWorker(
    getCsvWorker(),
    context ? { type: "diagnose", csv, context } : { type: "diagnose", csv },
  );
}

export function readCatalogPackageInFolder(files: File[]): Promise<CatalogPackageContents> {
  const root = files[0]?.webkitRelativePath?.split("/")[0];
  const payload = files.map((file) => {
    const rawPath = file.webkitRelativePath || file.name;
    const path = root && rawPath.startsWith(`${root}/`) ? rawPath.slice(root.length + 1) : rawPath;
    return { path, type: file.type, buffer: file.arrayBuffer() };
  });
  return Promise.all(payload.map(async (entry) => ({ ...entry, buffer: await entry.buffer }))).then(
    (entries) =>
      requestWorker(getCatalogPackageWorker(), { type: "catalog-package", files: entries }),
  );
}

export function exportCsvInWorker(products: Product[]): Promise<string> {
  return requestWorker(getCsvWorker(), { type: "export", products });
}

export function exportCommercialCsvInWorker(
  project: Pick<StoreProjectV1, "products" | "categories" | "collections">,
): Promise<string> {
  return requestWorker(getCsvWorker(), { type: "export-commercial", project });
}

export async function hashFile(file: File): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function processImageInWorker(file: File): Promise<ProcessedImage> {
  const supportedTypes = ["image/jpeg", "image/png", "image/webp"];
  if (!supportedTypes.includes(file.type)) {
    throw new Error("Formato no compatible. Usá una imagen JPEG, PNG o WebP.");
  }
  if (file.size === 0) throw new Error("La imagen está vacía.");
  if (file.size > 25 * 1024 * 1024) throw new Error("La imagen supera el límite de 25 MB.");
  const buffer = await file.arrayBuffer();
  const workerBuffer = buffer.slice(0);
  try {
    return await requestWorker(
      getImageWorker(),
      {
        buffer: workerBuffer,
        name: file.name,
        type: file.type,
        maxWidth: 1800,
      },
      [workerBuffer],
    );
  } catch (reason) {
    const message = reason instanceof Error ? reason.message : String(reason);
    if (!/OffscreenCanvas|createImageBitmap/i.test(message)) throw reason;
    return processImageOnMainThread(file, buffer);
  }
}

export function exportSiteInWorker(
  project: StoreProjectV1,
  mode: ExportMode,
  options: { publicAiContext?: boolean; optimizationProfile?: "safe" | "strict" } = {},
  onStage?: (stage: ExportStageId) => void,
): Promise<{
  files: ReadonlyMap<string, string | Uint8Array>;
  audit: AuditIssue[];
  optimization: OptimizationReport;
  criticalCount: number;
}> {
  return requestWorkerWithStages(
    getExportWorker(),
    { type: "site", project, mode, options },
    onStage,
  );
}

export type ExportStageId = "validate" | "render" | "package";

export interface ExportStageMessage {
  id: string;
  kind: "export-stage";
  stage: ExportStageId;
}

function requestWorkerWithStages<Request extends object, Result>(
  worker: Worker,
  request: Request,
  onStage?: (stage: ExportStageId) => void,
): Promise<Result> {
  const id = crypto.randomUUID();
  return new Promise((resolve, reject) => {
    const detach = () => {
      worker.removeEventListener("message", handleMessage);
      worker.removeEventListener("error", handleError);
    };
    const handleMessage = (event: MessageEvent<WorkerResponse<Result> | ExportStageMessage>) => {
      if (event.data.id !== id) return;
      if ("kind" in event.data) {
        onStage?.(event.data.stage);
        return;
      }
      detach();
      if (event.data.ok) resolve(event.data.result);
      else reject(new Error(event.data.error));
    };
    const handleError = () => {
      detach();
      reject(new Error("El worker no respondió."));
    };
    worker.addEventListener("message", handleMessage);
    worker.addEventListener("error", handleError);
    worker.postMessage({ ...request, id });
  });
}

export function createProjectArchiveInWorker(project: StoreProjectV1): Promise<string> {
  return requestWorker(getExportWorker(), { type: "project-write", project });
}

export async function readProjectArchiveInWorker(file: File): Promise<StoreProjectV1> {
  const buffer = await file.arrayBuffer();
  return requestWorker(getExportWorker(), { type: "project-read", buffer }, [buffer]);
}

export function readProjectArchiveBytesInWorker(bytes: Uint8Array): Promise<StoreProjectV1> {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return requestWorker(getExportWorker(), { type: "project-read", buffer: copy.buffer }, [
    copy.buffer,
  ]);
}

export interface AuditResult {
  criticalCount: number;
  optimization: OptimizationReport;
}

/**
 * Ejecuta la auditoría de exportación en el worker del exportador: el worker
 * tiene su propio mapa de módulos, así que si la carga del chunk falla se
 * puede reintentar recreándolo (el mapa de módulos de la página no lo
 * permite). Si el worker muere, se termina y se olvida para la próxima
 * llamada.
 */
export function auditProjectInWorker(
  project: StoreProjectV1,
  publicAiContext: boolean,
): Promise<AuditResult> {
  const worker = getExportWorker();
  return new Promise((resolve, reject) => {
    const handleError = () => {
      exportWorker?.terminate();
      exportWorker = undefined;
      reject(new Error("el worker del exportador no respondió"));
    };
    worker.addEventListener("error", handleError);
    requestWorker<
      { type: "audit"; project: StoreProjectV1; publicAiContext: boolean },
      AuditResult
    >(worker, { type: "audit", project, publicAiContext })
      .then((result) => {
        worker.removeEventListener("error", handleError);
        resolve(result);
      })
      .catch((reason) => {
        worker.removeEventListener("error", handleError);
        reject(reason);
      });
  });
}
