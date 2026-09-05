import {
  isProductVideoLightEnough,
  PRODUCT_VIDEO_MAX_BYTES,
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
  transcode?: (
    file: File,
    metadata: { width: number; height: number; duration: number },
    target: { maxSide: number; bitsPerSecond: number },
    mimeType: "video/mp4" | "video/webm",
  ) => Promise<Blob>;
}

const VIDEO_MIME_CANDIDATES = [
  "video/mp4;codecs=avc1.4d401f,mp4a.40.2",
  "video/webm;codecs=vp9,opus",
  "video/webm;codecs=vp8,opus",
  "video/webm",
];

function outputMimeType(value: string | undefined): "video/mp4" | "video/webm" | undefined {
  if (value?.startsWith("video/mp4")) return "video/mp4";
  if (value?.startsWith("video/webm")) return "video/webm";
  return undefined;
}

function scaledDimensions(
  width: number,
  height: number,
  maxSide: number,
): { width: number; height: number } {
  const scale = Math.min(1, maxSide / Math.max(width, height));
  return {
    width: Math.max(2, Math.round((width * scale) / 2) * 2),
    height: Math.max(2, Math.round((height * scale) / 2) * 2),
  };
}

async function transcodeInBrowser(
  file: File,
  metadata: { width: number; height: number; duration: number },
  target: { maxSide: number; bitsPerSecond: number },
  mimeType: string,
): Promise<Blob> {
  const dimensions = scaledDimensions(metadata.width, metadata.height, target.maxSide);
  const video = document.createElement("video");
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  if (!context || typeof canvas.captureStream !== "function") {
    throw new Error("El navegador no puede preparar la recompresión del video.");
  }
  canvas.width = dimensions.width;
  canvas.height = dimensions.height;
  const objectUrl = URL.createObjectURL(file);
  const output = canvas.captureStream(PRODUCT_VIDEO_TARGET_FPS);
  const videoWithCaptureStream = video as HTMLVideoElement & {
    captureStream?: () => MediaStream;
  };
  const source = videoWithCaptureStream.captureStream?.();
  source?.getAudioTracks().forEach((track: MediaStreamTrack) => output.addTrack(track));
  const recorder = new MediaRecorder(output, {
    mimeType,
    videoBitsPerSecond: target.bitsPerSecond,
    audioBitsPerSecond: PRODUCT_VIDEO_TARGET_AUDIO_BITS_PER_SECOND,
  });
  const chunks: Blob[] = [];

  try {
    return await new Promise<Blob>((resolve, reject) => {
      let settled = false;
      let frame: number | undefined;
      let deadline: number | undefined;
      const clearDeadline = () => {
        if (deadline !== undefined) window.clearTimeout(deadline);
      };
      const stopRecording = () => {
        if (settled) return;
        clearDeadline();
        if (frame !== undefined) window.cancelAnimationFrame(frame);
        if (recorder.state !== "inactive") recorder.stop();
      };
      const fail = (error: Error) => {
        if (settled) return;
        settled = true;
        clearDeadline();
        if (frame !== undefined) window.cancelAnimationFrame(frame);
        if (recorder.state !== "inactive") recorder.stop();
        reject(error);
      };
      const draw = () => {
        if (settled) return;
        context.drawImage(video, 0, 0, dimensions.width, dimensions.height);
        frame = window.requestAnimationFrame(draw);
      };
      recorder.addEventListener("dataavailable", (event) => {
        if (event.data.size > 0) chunks.push(event.data);
      });
      recorder.addEventListener("stop", () => {
        if (!settled) {
          settled = true;
          clearDeadline();
          resolve(new Blob(chunks, { type: mimeType }));
        }
      });
      recorder.addEventListener("error", () => fail(new Error("No se pudo recomprimir el video.")));
      video.onerror = () => fail(new Error("No se pudo decodificar el video."));
      video.onended = stopRecording;
      video.onloadedmetadata = () => {
        try {
          recorder.start();
          draw();
          void video.play().catch(() => fail(new Error("No se pudo reproducir el video.")));
        } catch (error) {
          fail(error instanceof Error ? error : new Error("No se pudo recomprimir el video."));
        }
      };
      video.muted = true;
      video.playsInline = true;
      video.preload = "auto";
      video.src = objectUrl;
      deadline = window.setTimeout(
        () => fail(new Error("La recompresión del video excedió el tiempo permitido.")),
        Math.max(15_000, (metadata.duration + 5) * 1_000),
      );
    });
  } finally {
    URL.revokeObjectURL(objectUrl);
    output.getTracks().forEach((track: MediaStreamTrack) => track.stop());
    source?.getTracks().forEach((track: MediaStreamTrack) => track.stop());
  }
}

/**
 * Recompresión liviana sin ffmpeg.wasm ni WebCodecs directos.
 * Contrato fallback-first anti-rotura:
 * - original liviano → `undefined` (conservar original, no reencodear);
 * - sin MediaRecorder / sin window → `undefined`;
 * - cualquier error o resultado más pesado → `undefined`.
 * La grabación realtime usa canvas downscale + captureStream + MediaRecorder.
 * Si el navegador no puede hacerlo o el resultado supera el hard limit, se
 * conserva el original devolviendo `undefined`.
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
  if (!deps.transcode && (typeof window === "undefined" || typeof MediaRecorder === "undefined")) {
    return undefined;
  }
  const target = productVideoTarget({ duration: metadata.duration });
  const selectedMime = deps.pickMimeType
    ? deps.pickMimeType(VIDEO_MIME_CANDIDATES)
    : VIDEO_MIME_CANDIDATES.find((candidate) => MediaRecorder.isTypeSupported(candidate));
  const mimeType = outputMimeType(selectedMime);
  if (!mimeType) return undefined;
  try {
    const blob = await (deps.transcode ?? transcodeInBrowser)(
      file,
      metadata,
      target,
      mimeType,
    );
    if (blob.size === 0 || blob.size > PRODUCT_VIDEO_MAX_BYTES) return undefined;
    const dimensions = scaledDimensions(metadata.width, metadata.height, target.maxSide);
    return { blob, mimeType, ...dimensions };
  } catch {
    return undefined;
  }
}
