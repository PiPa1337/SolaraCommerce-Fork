import type { SocialCropRequest, SocialImageCrop } from "@solara/exporter";

export const SOCIAL_CROP_RECIPE = {
  width: 1200,
  height: 630,
  jpegQuality: 0.82,
} as const;

export interface SocialCropPlan {
  width: number;
  height: number;
  sourceX: number;
  sourceY: number;
  sourceWidth: number;
  sourceHeight: number;
}

export function createSocialPlan(
  sourceWidth: number,
  sourceHeight: number,
  targetWidth = SOCIAL_CROP_RECIPE.width,
  targetHeight = SOCIAL_CROP_RECIPE.height,
): SocialCropPlan | undefined {
  if (!Number.isInteger(sourceWidth) || !Number.isInteger(sourceHeight)) return undefined;
  if (sourceWidth < 1 || sourceHeight < 1) return undefined;
  if (sourceWidth < targetWidth || sourceHeight < targetHeight) return undefined;
  const widthScale = targetWidth / sourceWidth;
  const heightScale = targetHeight / sourceHeight;
  return widthScale >= heightScale
    ? {
        width: targetWidth,
        height: targetHeight,
        sourceX: 0,
        sourceY: (sourceHeight - (sourceWidth * targetHeight) / targetWidth) / 2,
        sourceWidth,
        sourceHeight: (sourceWidth * targetHeight) / targetWidth,
      }
    : {
        width: targetWidth,
        height: targetHeight,
        sourceX: (sourceWidth - (sourceHeight * targetWidth) / targetHeight) / 2,
        sourceY: 0,
        sourceWidth: (sourceHeight * targetWidth) / targetHeight,
        sourceHeight,
      };
}

function dataUrlToBytes(dataUrl: string): Uint8Array<ArrayBuffer> | undefined {
  const match = /^data:[^;,]*(?:;[^;,]*)*;base64,(.*)$/s.exec(dataUrl);
  const base64 = match?.[1];
  if (!base64) return undefined;
  const binary = atob(base64);
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

function bytesToDataUrl(bytes: Uint8Array, mimeType: string): string {
  let binary = "";
  const block = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += block) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + block));
  }
  return `data:${mimeType};base64,${btoa(binary)}`;
}

async function generateSocialCrop(
  request: SocialCropRequest,
): Promise<SocialImageCrop | undefined> {
  const bytes = dataUrlToBytes(request.source);
  if (!bytes || bytes.length === 0) return undefined;
  const sourceMimeType = /^data:([^;,]+)/i.exec(request.source)?.[1] ?? "";
  const bitmap = await createImageBitmap(
    new Blob([bytes], sourceMimeType ? { type: sourceMimeType } : {}),
    { imageOrientation: "from-image" },
  );
  try {
    const plan = createSocialPlan(bitmap.width, bitmap.height);
    if (!plan) return undefined;
    const canvas = new OffscreenCanvas(plan.width, plan.height);
    const context = canvas.getContext("2d", { alpha: false });
    if (!context) return undefined;
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, plan.width, plan.height);
    context.drawImage(
      bitmap,
      plan.sourceX,
      plan.sourceY,
      plan.sourceWidth,
      plan.sourceHeight,
      0,
      0,
      plan.width,
      plan.height,
    );
    const blob = await canvas.convertToBlob({
      type: "image/jpeg",
      quality: SOCIAL_CROP_RECIPE.jpegQuality,
    });
    if (!blob.type.startsWith("image/jpeg")) return undefined;
    const encoded = new Uint8Array(await blob.arrayBuffer());
    return {
      dataUrl: bytesToDataUrl(encoded, "image/jpeg"),
      width: plan.width,
      height: plan.height,
    };
  } finally {
    bitmap.close();
  }
}

export async function generateSocialCrops(
  requests: readonly SocialCropRequest[],
): Promise<Map<string, SocialImageCrop>> {
  const crops = new Map<string, SocialImageCrop>();
  if (typeof createImageBitmap !== "function" || typeof OffscreenCanvas === "undefined") {
    return crops;
  }
  for (const request of requests) {
    try {
      const crop = await generateSocialCrop(request);
      if (crop) crops.set(request.assetId, crop);
    } catch {}
  }
  return crops;
}
