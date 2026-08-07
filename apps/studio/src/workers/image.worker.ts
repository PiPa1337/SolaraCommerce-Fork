/** Transformaciones de imagen deterministas compartidas por caché y exportación. */
export const IMAGE_RECIPE = {
  widths: [480, 768, 1200, 1800] as const,
  maxBytes: 25 * 1024 * 1024,
  maxPixels: 50_000_000,
  webpQuality: 0.82,
  jpegQuality: 0.88,
} as const;

const SUPPORTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
type SupportedImageType = (typeof SUPPORTED_IMAGE_TYPES)[number];

interface ImageRequest {
  id: string;
  buffer: ArrayBuffer;
  name: string;
  type: string;
  maxWidth: number;
}

export interface ImagePlan {
  width: number;
  height: number;
  responsiveWidths: number[];
}

export function createImagePlan(
  sourceWidth: number,
  sourceHeight: number,
  maxWidth = 1800,
): ImagePlan {
  if (!Number.isInteger(sourceWidth) || !Number.isInteger(sourceHeight)) {
    throw new Error("La imagen no tiene dimensiones válidas.");
  }
  if (sourceWidth < 1 || sourceHeight < 1) {
    throw new Error("La imagen no tiene dimensiones válidas.");
  }
  if (sourceWidth * sourceHeight > IMAGE_RECIPE.maxPixels) {
    throw new Error("La imagen supera el límite de 50 megapíxeles.");
  }

  const safeMaxWidth = Math.max(1, Math.min(Math.floor(maxWidth), 1800));
  const width = Math.min(sourceWidth, safeMaxWidth);
  const responsiveWidths = [
    ...new Set([...IMAGE_RECIPE.widths.filter((candidate) => candidate < width), width]),
  ].sort((left, right) => left - right);

  return {
    width,
    height: Math.max(1, Math.round((sourceHeight / sourceWidth) * width)),
    responsiveWidths,
  };
}

export function validateImageInput(type: string, buffer: ArrayBuffer): SupportedImageType {
  if (!SUPPORTED_IMAGE_TYPES.includes(type as SupportedImageType)) {
    throw new Error("Formato no compatible. Usá una imagen JPEG, PNG o WebP.");
  }
  if (buffer.byteLength === 0) throw new Error("La imagen está vacía.");
  if (buffer.byteLength > IMAGE_RECIPE.maxBytes) {
    throw new Error("La imagen supera el límite de 25 MB.");
  }

  const bytes = new Uint8Array(buffer);
  const isJpeg = bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  const isPng =
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a;
  const isWebp =
    bytes.length >= 12 &&
    String.fromCharCode(...bytes.subarray(0, 4)) === "RIFF" &&
    String.fromCharCode(...bytes.subarray(8, 12)) === "WEBP";
  const matchesSignature =
    (type === "image/jpeg" && isJpeg) ||
    (type === "image/png" && isPng) ||
    (type === "image/webp" && isWebp);

  if (!matchesSignature) {
    throw new Error("El contenido del archivo no coincide con su formato de imagen.");
  }
  return type as SupportedImageType;
}

export function sourceCanContainAlpha(type: SupportedImageType, buffer: ArrayBuffer): boolean {
  if (type === "image/jpeg") return false;
  const bytes = new Uint8Array(buffer);
  if (type === "image/png") {
    const colorType = bytes[25];
    if (colorType === 4 || colorType === 6) return true;
    for (let index = 8; index <= bytes.length - 4; index += 1) {
      if (
        bytes[index] === 0x74 &&
        bytes[index + 1] === 0x52 &&
        bytes[index + 2] === 0x4e &&
        bytes[index + 3] === 0x53
      ) {
        return true;
      }
    }
    return false;
  }
  for (let index = 12; index <= bytes.length - 4; index += 1) {
    if (
      bytes[index] === 0x41 &&
      bytes[index + 1] === 0x4c &&
      bytes[index + 2] === 0x50 &&
      bytes[index + 3] === 0x48
    ) {
      return true;
    }
  }
  return bytes.length > 20 && bytes[12] === 0x56 && bytes[20] !== undefined
    ? (bytes[20] & 0x10) !== 0
    : false;
}

async function canvasToDataUrl(
  bitmap: ImageBitmap,
  width: number,
  mimeType: "image/webp" | "image/jpeg" | "image/png",
  preserveAlpha: boolean,
): Promise<string> {
  const height = Math.max(1, Math.round((bitmap.height / bitmap.width) * width));
  const canvas = new OffscreenCanvas(width, height);
  const context = canvas.getContext("2d", { alpha: preserveAlpha });
  if (!context) throw new Error("El navegador no pudo procesar la imagen.");
  if (!preserveAlpha) {
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, width, height);
  }
  context.drawImage(bitmap, 0, 0, width, height);
  const quality =
    mimeType === "image/webp"
      ? IMAGE_RECIPE.webpQuality
      : mimeType === "image/jpeg"
        ? IMAGE_RECIPE.jpegQuality
        : undefined;
  const blob = await canvas.convertToBlob(
    quality === undefined ? { type: mimeType } : { type: mimeType, quality },
  );
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = "";
  const block = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += block) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + block));
  }
  return `data:${mimeType};base64,${btoa(binary)}`;
}

async function processImage(request: ImageRequest) {
  const type = validateImageInput(request.type, request.buffer);
  const preserveAlpha = sourceCanContainAlpha(type, request.buffer);
  const source = new Blob([request.buffer], { type });
  const bitmap = await createImageBitmap(source, { imageOrientation: "from-image" });
  try {
    const plan = createImagePlan(bitmap.width, bitmap.height, request.maxWidth);
    const responsive = await Promise.all(
      plan.responsiveWidths.map(async (width) => ({
        width,
        source: await canvasToDataUrl(bitmap, width, "image/webp", preserveAlpha),
      })),
    );
    const primary = responsive.at(-1)?.source;
    if (!primary) throw new Error("No se pudo generar la imagen principal.");
    const fallbackType = preserveAlpha ? "image/png" : "image/jpeg";
    const fallback = await canvasToDataUrl(bitmap, plan.width, fallbackType, preserveAlpha);
    return { ...plan, primary, fallback, responsive };
  } finally {
    bitmap.close();
  }
}

if (typeof self !== "undefined") {
  self.onmessage = async (event: MessageEvent<ImageRequest>) => {
    try {
      const result = await processImage(event.data);
      self.postMessage({ id: event.data.id, ok: true, result });
    } catch (error) {
      self.postMessage({
        id: event.data.id,
        ok: false,
        error: error instanceof Error ? error.message : "No se pudo procesar la imagen.",
      });
    }
  };
}
