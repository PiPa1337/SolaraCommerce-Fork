import type { ImageAsset } from "@solara/project-schema";
import { ASSET_CACHE_RECIPE_VERSION, getCachedAsset, putCachedAsset } from "./repository";
import { hashFile, processImageInWorker } from "./workers";

export const IMAGE_UPLOAD_ACCEPT = "image/jpeg,image/png,image/webp";

/** Procesa una imagen con el mismo pipeline de Recursos y reutiliza su caché. */
export async function processImageFile(
  file: File,
): Promise<{ asset: ImageAsset; reused: boolean }> {
  if (!IMAGE_UPLOAD_ACCEPT.split(",").includes(file.type)) {
    throw new Error("Sólo se aceptan imágenes JPEG, PNG o WebP.");
  }
  const hash = await hashFile(file);
  const cached = await getCachedAsset(hash, ASSET_CACHE_RECIPE_VERSION);
  const processed = cached ?? (await processImageInWorker(file));
  if (!cached) {
    await putCachedAsset({
      hash,
      recipeVersion: ASSET_CACHE_RECIPE_VERSION,
      originalName: file.name,
      mimeType: "image/webp",
      width: processed.width,
      height: processed.height,
      primary: processed.primary,
      fallback: processed.fallback,
      responsive: processed.responsive,
      createdAt: new Date().toISOString(),
    });
  }
  return {
    reused: Boolean(cached),
    asset: {
      kind: "image",
      id: `asset-${crypto.randomUUID()}` as ImageAsset["id"],
      name: file.name.replace(/\.[^.]+$/, ""),
      alt: "",
      mimeType: "image/webp",
      source: processed.primary,
      fallbackSource: processed.fallback,
      responsiveSources: processed.responsive,
      width: processed.width,
      height: processed.height,
      hash,
    },
  };
}
