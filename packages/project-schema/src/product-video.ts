import type { Product, StoreProjectV1, VideoAsset } from "./index.js";

/** Máximo de videos por producto en v1. Protege LCP, budgets y UX táctil. */
export const PRODUCT_VIDEO_MAX_COUNT = 3;
/** Hard ultra-light por video de producto (el global hero sigue en 30 MB). */
export const PRODUCT_VIDEO_MAX_BYTES = 2 * 1024 * 1024;
/** Ideal: ~1 MB. 1 MB ≈ 8 s a 1 Mbps; 10 s exige ~800 kbps y/o 540p. */
export const PRODUCT_VIDEO_TARGET_BYTES = 1 * 1024 * 1024;
/** Lado mayor máximo: 720p; si dura >8 s, bajar a 540p para sostener 1 MB. */
export const PRODUCT_VIDEO_MAX_DIMENSION = 720;
export const PRODUCT_VIDEO_LONG_DIMENSION = 540;
/** Duración recomendada para producto (60 s sigue siendo el hard global). */
export const PRODUCT_VIDEO_RECOMMENDED_SECONDS = 10;
export const PRODUCT_VIDEO_SOFT_MAX_SECONDS = 15;

/**
 * IDs de video válidos de un producto: existen en project.videos,
 * sin duplicados, capados a PRODUCT_VIDEO_MAX_COUNT, en orden de videoIds.
 */
export function productVideoIds(
  product: Pick<Product, "videoIds">,
  project: Pick<StoreProjectV1, "videos">,
): string[] {
  const known = new Set<string>(project.videos.map((video) => video.id as string));
  const seen = new Set<string>();
  const result: string[] = [];
  for (const id of (product.videoIds ?? []) as string[]) {
    if (!known.has(id) || seen.has(id)) continue;
    seen.add(id);
    result.push(id);
    if (result.length >= PRODUCT_VIDEO_MAX_COUNT) break;
  }
  return result;
}

/** Videos resueltos en orden de galería. */
export function productVideos(
  product: Pick<Product, "videoIds">,
  project: Pick<StoreProjectV1, "videos">,
): VideoAsset[] {
  const byId = new Map<string, VideoAsset>(
    project.videos.map((video) => [video.id as string, video]),
  );
  return productVideoIds(product, project)
    .map((id) => byId.get(id))
    .filter((video): video is VideoAsset => Boolean(video));
}

/** True si el archivo ya cumple el presupuesto ultra-light y no debe reencodearse. */
export function isProductVideoLightEnough(input: {
  size: number;
  width: number;
  height: number;
}): boolean {
  return (
    input.size <= PRODUCT_VIDEO_MAX_BYTES &&
    Math.max(input.width, input.height) <= 1280 &&
    Math.min(input.width, input.height) <= PRODUCT_VIDEO_MAX_DIMENSION
  );
}

/** Target adaptativo: >8 s baja a 540p/600kbps para sostener ~1 MB. */
export function productVideoTarget(input: { duration: number }): {
  maxSide: number;
  bitsPerSecond: number;
} {
  if (input.duration > 8) return { maxSide: PRODUCT_VIDEO_LONG_DIMENSION, bitsPerSecond: 600_000 };
  return { maxSide: PRODUCT_VIDEO_MAX_DIMENSION, bitsPerSecond: 800_000 };
}
