import { type ImageAsset, RESPONSIVE_IMAGE_INTERMEDIATE_WIDTH } from "@solara/project-schema";
import { hashFile, processImageInWorker } from "./workers";

export const SEO_IMAGE_ACCEPT = "image/jpeg,image/png,image/webp";
export const SITE_COVER_WIDTH = 1200;
export const SITE_COVER_HEIGHT = 630;
export const FAVICON_SIZES = [16, 32, 48, 64, 128, 256] as const;

export interface IcoImage {
  width: number;
  data: Uint8Array;
}

/** Construye un ICO válido con entradas PNG y directorio little-endian. */
export function encodeIco(images: readonly IcoImage[]): Uint8Array {
  if (images.length === 0 || images.length > 255) {
    throw new Error("El favicon debe tener al menos una resolución.");
  }
  for (const image of images) {
    if (!Number.isInteger(image.width) || image.width < 1 || image.width > 256) {
      throw new Error("La resolución del favicon no es válida.");
    }
    if (image.data.length === 0) throw new Error("El favicon contiene una imagen vacía.");
  }

  const directorySize = 6 + images.length * 16;
  const totalSize = directorySize + images.reduce((sum, image) => sum + image.data.length, 0);
  const output = new Uint8Array(totalSize);
  const view = new DataView(output.buffer);
  view.setUint16(0, 0, true);
  view.setUint16(2, 1, true);
  view.setUint16(4, images.length, true);

  let imageOffset = directorySize;
  images.forEach((image, index) => {
    const entryOffset = 6 + index * 16;
    const encodedSize = image.width === 256 ? 0 : image.width;
    view.setUint8(entryOffset, encodedSize);
    view.setUint8(entryOffset + 1, encodedSize);
    view.setUint8(entryOffset + 2, 0);
    view.setUint8(entryOffset + 3, 0);
    view.setUint16(entryOffset + 4, 1, true);
    view.setUint16(entryOffset + 6, 32, true);
    view.setUint32(entryOffset + 8, image.data.length, true);
    view.setUint32(entryOffset + 12, imageOffset, true);
    output.set(image.data, imageOffset);
    imageOffset += image.data.length;
  });

  return output;
}

function dataUrlBytes(dataUrl: string): Uint8Array {
  const match = /^data:[^;,]+;base64,(.*)$/s.exec(dataUrl);
  if (!match) throw new Error("El navegador no generó una imagen válida.");
  const binary = atob(match[1] ?? "");
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function bytesToDataUrl(mimeType: string, bytes: Uint8Array): string {
  let binary = "";
  const block = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += block) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + block));
  }
  return `data:${mimeType};base64,${btoa(binary)}`;
}

function loadImage(source: string): Promise<HTMLImageElement> {
  if (typeof Image === "undefined") throw new Error("El navegador no pudo cargar la imagen.");
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.decoding = "async";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("La imagen no se pudo decodificar."));
    image.src = source;
  });
}

function renderCrop(
  image: HTMLImageElement,
  width: number,
  height: number,
  mimeType: "image/png" | "image/webp" | "image/jpeg",
  transparent: boolean,
): string {
  if (typeof document === "undefined") throw new Error("El navegador no pudo procesar la imagen.");
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { alpha: transparent });
  if (!context) throw new Error("El navegador no pudo procesar la imagen.");
  if (!transparent) {
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, width, height);
  }
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  const scale = Math.max(width / image.naturalWidth, height / image.naturalHeight);
  const sourceWidth = width / scale;
  const sourceHeight = height / scale;
  const sourceX = Math.max(0, (image.naturalWidth - sourceWidth) / 2);
  const sourceY = Math.max(0, (image.naturalHeight - sourceHeight) / 2);
  context.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, width, height);
  const quality = mimeType === "image/png" ? undefined : mimeType === "image/webp" ? 0.86 : 0.9;
  return quality === undefined ? canvas.toDataURL(mimeType) : canvas.toDataURL(mimeType, quality);
}

async function prepareSource(file: File): Promise<{ source: string; hash: string }> {
  const processed = await processImageInWorker(file);
  return { source: processed.fallback, hash: await hashFile(file) };
}

export async function createFaviconAsset(file: File): Promise<ImageAsset> {
  const prepared = await prepareSource(file);
  const image = await loadImage(prepared.source);
  const pngImages = FAVICON_SIZES.map((width) => {
    const source = renderCrop(image, width, width, "image/png", true);
    return { width, data: dataUrlBytes(source) };
  });
  const fallbackSource = renderCrop(image, 180, 180, "image/png", true);
  return {
    kind: "image",
    id: `asset-favicon-${crypto.randomUUID()}` as ImageAsset["id"],
    name: "Favicon del sitio",
    alt: "Favicon del sitio",
    mimeType: "image/x-icon",
    source: bytesToDataUrl("image/x-icon", encodeIco(pngImages)),
    fallbackSource,
    responsiveSources: pngImages.map(({ width, data }) => ({
      width,
      source: bytesToDataUrl("image/png", data),
    })),
    width: 256,
    height: 256,
    hash: `${prepared.hash}-favicon-v1`,
  };
}

export async function createSiteCoverAsset(file: File): Promise<ImageAsset> {
  const prepared = await prepareSource(file);
  const image = await loadImage(prepared.source);
  const responsiveWidths = [RESPONSIVE_IMAGE_INTERMEDIATE_WIDTH, SITE_COVER_WIDTH] as const;
  return {
    kind: "image",
    id: `asset-site-cover-${crypto.randomUUID()}` as ImageAsset["id"],
    name: "Portada del sitio",
    alt: "Portada del sitio",
    mimeType: "image/webp",
    source: renderCrop(image, SITE_COVER_WIDTH, SITE_COVER_HEIGHT, "image/webp", false),
    fallbackSource: renderCrop(image, SITE_COVER_WIDTH, SITE_COVER_HEIGHT, "image/jpeg", false),
    responsiveSources: responsiveWidths.map((width) => ({
      width,
      source: renderCrop(
        image,
        width,
        Math.round((width / SITE_COVER_WIDTH) * SITE_COVER_HEIGHT),
        "image/webp",
        false,
      ),
    })),
    width: SITE_COVER_WIDTH,
    height: SITE_COVER_HEIGHT,
    hash: `${prepared.hash}-site-cover-v1`,
  };
}
