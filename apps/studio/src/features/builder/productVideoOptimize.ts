import {
  isProductVideoLightEnough,
  productVideoTarget,
} from "@solara/project-schema/product-video";

export const PRODUCT_VIDEO_TARGET_FPS = 30;
export const PRODUCT_VIDEO_TARGET_AUDIO_BITS_PER_SECOND = 64_000;

export interface OptimizedVideoSource {
  blob: Blob;
  mimeType: "video/mp4" | "video/webm";
  width: number;
  height: number;
}

export interface ProductVideoOptimizeDeps {
  mediaRecorderAvailable?: boolean;
  pickMimeType?: (candidates: string[]) => string | undefined;
}

/**
 * Recompresión liviana sin ffmpeg.wasm ni WebCodecs directos.
 * Contrato fallback-first anti-rotura:
 * - original liviano → `undefined` (conservar original, no reencodear);
 * - sin MediaRecorder / sin window → `undefined`;
 * - cualquier error o resultado más pesado → `undefined`.
 * La grabación realtime completa (canvas downscale + captureStream + MediaRecorder)
 * se implementa sobre este contrato; esta versión deja el esqueleto seguro que
 * nunca rompe la subida (el llamador usa el original cuando recibe `undefined`).
 */
export async function optimizeProductVideoSource(
  file: File,
  metadata: { width: number; height: number; duration: number },
  deps: ProductVideoOptimizeDeps = {},
): Promise<OptimizedVideoSource | undefined> {
  if (
    isProductVideoLightEnough({ size: file.size, width: metadata.width, height: metadata.height })
  ) {
    return undefined;
  }
  if (deps.mediaRecorderAvailable === false) return undefined;
  if (typeof window === "undefined" || typeof MediaRecorder === "undefined") return undefined;
  const target = productVideoTarget({ duration: metadata.duration });
  void target;
  void PRODUCT_VIDEO_TARGET_FPS;
  void PRODUCT_VIDEO_TARGET_AUDIO_BITS_PER_SECOND;
  // TODO implementado como fallback seguro en v1: conservar original.
  // La recompresión realtime (≤10-15 s de grabación) queda como mejora
  // incremental sobre este mismo contrato sin cambiar llamadores.
  return undefined;
}
