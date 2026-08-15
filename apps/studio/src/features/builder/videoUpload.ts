import type { ImageAsset, StoreProjectV1, VideoAsset } from "@solara/project-schema";
import { hashFile } from "../../lib/workers";

export const VIDEO_MAX_BYTES = 30 * 1024 * 1024;
export const VIDEO_MAX_DURATION_SECONDS = 60;

export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => resolve(String(reader.result)));
    reader.addEventListener("error", () => reject(new Error("No se pudo leer el video.")));
    reader.readAsDataURL(file);
  });
}

export function readVideoMetadata(
  file: File,
): Promise<{ width: number; height: number; duration: number }> {
  return new Promise((resolve, reject) => {
    const element = document.createElement("video");
    const objectUrl = URL.createObjectURL(file);
    let settled = false;
    let deadline: number | undefined;
    const cleanup = () => {
      if (deadline !== undefined) window.clearTimeout(deadline);
      URL.revokeObjectURL(objectUrl);
    };
    const fail = (message: string) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(new Error(message));
    };
    const finish = () => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve({
        width: element.videoWidth,
        height: element.videoHeight,
        duration: element.duration,
      });
    };
    deadline = window.setTimeout(() => fail("No se pudo leer la metadata del video."), 5_000);
    element.preload = "metadata";
    element.onerror = () => fail("No se pudo leer la metadata del video.");
    element.onloadedmetadata = () => {
      if (Number.isFinite(element.duration) && element.duration > 0) {
        finish();
        return;
      }
      // WebM grabados (p. ej. MediaRecorder) reportan duration=Infinity en
      // el metadata: forzar el cálculo buscando el final del archivo.
      const onDurationChange = () => {
        if (Number.isFinite(element.duration) && element.duration > 0) {
          element.removeEventListener("durationchange", onDurationChange);
          finish();
        }
      };
      element.addEventListener("durationchange", onDurationChange);
      element.currentTime = 1e12;
    };
    element.src = objectUrl;
  });
}

/**
 * Dimensiones del poster con aspect exacto del video: se redondea una sola
 * dimensión y la otra se deriva (sin desviación xy por redondeos
 * independientes).
 */
export function posterDimensions(
  videoWidth: number,
  videoHeight: number,
  maxDimension: number,
): { width: number; height: number } {
  const scale = Math.min(1, maxDimension / Math.max(videoWidth, videoHeight));
  if (videoWidth >= videoHeight) {
    const width = Math.max(1, Math.round(videoWidth * scale));
    return { width, height: Math.max(1, Math.round(width * (videoHeight / videoWidth))) };
  }
  const height = Math.max(1, Math.round(videoHeight * scale));
  return { width: Math.max(1, Math.round(height * (videoWidth / videoHeight))), height };
}

/**
 * Extrae un fotograma del video a baja resolución (máx. 640px) como imagen
 * de preload/poster. Captura el primer frame PRESENTADO por el reproductor
 * usando el metadata de requestVideoFrameCallback:
 * - dimensiones de PRESENTACIÓN (rotación/SAR ya aplicados) para que el
 *   poster tenga el aspect real que muestra el video (sin líneas ni
 *   estirados);
 * - si el primer frame presentado cae después de t=0 (H.264 con B-frames o
 *   keyframe desfasado), rebusca hacia atrás hasta 3 veces.
 * Si el navegador no puede decodificar o dibujar el fotograma, devuelve
 * undefined (la subida no debe fallar por el poster).
 */
export async function extractVideoPoster(
  file: File,
  options: { maxDimension?: number; atSeconds?: number } = {},
): Promise<{ source: string; width: number; height: number } | undefined> {
  if (typeof document === "undefined") return undefined;
  const video = document.createElement("video");
  const objectUrl = URL.createObjectURL(file);
  try {
    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";
    video.src = objectUrl;
    await new Promise<void>((resolve, reject) => {
      video.onloadeddata = () => resolve();
      video.onerror = () => reject(new Error("No se pudo decodificar el video."));
    });
    const videoWithCallback = video as HTMLVideoElement & {
      requestVideoFrameCallback?: (
        callback: (
          now: number,
          metadata: {
            mediaTime?: number;
            width?: number;
            height?: number;
          },
        ) => void,
      ) => number;
    };

    interface PresentedFrame {
      mediaTime: number;
      width: number;
      height: number;
    }
    // Espera el próximo frame presentado; resuelve con su metadata.
    const nextPresentedFrame = (timeoutMs: number): Promise<PresentedFrame | undefined> =>
      new Promise((resolve) => {
        if (typeof videoWithCallback.requestVideoFrameCallback === "function") {
          const timer = window.setTimeout(() => resolve(undefined), timeoutMs);
          videoWithCallback.requestVideoFrameCallback((_now, metadata) => {
            window.clearTimeout(timer);
            resolve({
              mediaTime: metadata.mediaTime ?? 0,
              width: metadata.width ?? video.videoWidth,
              height: metadata.height ?? video.videoHeight,
            });
          });
        } else {
          window.setTimeout(() => resolve(undefined), 150);
        }
      });
    const seekTo = async (target: number): Promise<void> => {
      if (Math.abs(video.currentTime - target) > 0.001) {
        video.currentTime = target;
        await new Promise<void>((resolve) => {
          video.onseeked = () => resolve();
          video.onerror = () => resolve();
          window.setTimeout(() => resolve(), 4_000);
        });
      }
    };

    // Busca el primer frame: presenta en t=0 y, si el frame cae después
    // (keyframe desfasado), rebusca hacia atrás hasta 3 veces.
    let presented = await nextPresentedFrame(3_000);
    await seekTo(options.atSeconds ?? 0);
    const afterSeek = await nextPresentedFrame(3_000);
    if (afterSeek) presented = afterSeek;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const earliest = presented;
      if (!earliest || earliest.mediaTime <= 0.05) break;
      const target = Math.max(0, earliest.mediaTime - 0.1);
      await seekTo(target);
      const earlier = await nextPresentedFrame(2_000);
      if (!earlier) break;
      presented = earlier;
      if (earlier.mediaTime >= earliest.mediaTime) break;
    }
    if (video.readyState < 2) {
      await new Promise<void>((resolve) => window.setTimeout(resolve, 100));
    }
    if (video.videoWidth < 1 || video.videoHeight < 1) return undefined;
    const maxDimension = options.maxDimension ?? 640;
    // Dimensiones de presentación (rotación/SAR aplicados) con fallback a las
    // codificadas.
    const displayWidth =
      presented?.width && presented.width > 0 ? presented.width : video.videoWidth;
    const displayHeight =
      presented?.height && presented.height > 0 ? presented.height : video.videoHeight;
    const { width, height } = posterDimensions(displayWidth, displayHeight, maxDimension);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) return undefined;
    context.drawImage(video, 0, 0, width, height);
    const webp = canvas.toDataURL("image/webp", 0.85);
    if (webp.startsWith("data:image/")) return { source: webp, width, height };
    const jpeg = canvas.toDataURL("image/jpeg", 0.85);
    if (jpeg.startsWith("data:image/")) return { source: jpeg, width, height };
    return undefined;
  } catch {
    return undefined;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export interface VideoUploadDeps {
  hash?: string;
  readMetadata?: typeof readVideoMetadata;
  readDataUrl?: typeof readFileAsDataUrl;
  computeHash?: typeof hashFile;
  extractPoster?: typeof extractVideoPoster;
}

export interface BuiltVideo {
  video: VideoAsset;
  posterImage: ImageAsset | undefined;
}

/**
 * Valida un archivo de video (MP4/WebM, hasta 30 MB, 0-60 s) y devuelve el
 * VideoAsset listo para sumar al proyecto. Los helpers se inyectan en `deps`
 * para poder testear la validación sin un navegador.
 */
export async function buildVideoAsset(file: File, deps: VideoUploadDeps = {}): Promise<BuiltVideo> {
  if (file.type !== "video/mp4" && file.type !== "video/webm") {
    throw new Error("Sólo se aceptan videos MP4 o WebM.");
  }
  if (file.size > VIDEO_MAX_BYTES) {
    throw new Error("El video supera los 30 MB.");
  }
  const readMetadata = deps.readMetadata ?? readVideoMetadata;
  const readDataUrl = deps.readDataUrl ?? readFileAsDataUrl;
  const computeHash = deps.computeHash ?? hashFile;
  const metadata = await readMetadata(file);
  if (
    !Number.isFinite(metadata.width) ||
    !Number.isFinite(metadata.height) ||
    !Number.isFinite(metadata.duration) ||
    metadata.width < 1 ||
    metadata.height < 1 ||
    metadata.duration <= 0 ||
    metadata.duration > VIDEO_MAX_DURATION_SECONDS
  ) {
    throw new Error("El video debe durar entre 0 y 60 segundos.");
  }
  const name = file.name.replace(/\.[^.]+$/, "");
  const source = await readDataUrl(file);
  const hash = deps.hash ?? (await computeHash(file));

  // Poster automático del video a baja resolución: si falla, no bloquea.
  let posterImage: ImageAsset | undefined;
  try {
    const extractPoster = deps.extractPoster ?? extractVideoPoster;
    const poster = await extractPoster(file);
    if (poster) {
      const raw = poster.source.split(",")[1] ?? "";
      const bytes = Uint8Array.from(atob(raw), (char) => char.charCodeAt(0));
      const digest = await crypto.subtle.digest("SHA-256", bytes);
      const posterHash = [...new Uint8Array(digest)]
        .map((byte) => byte.toString(16).padStart(2, "0"))
        .join("");
      posterImage = {
        kind: "image",
        id: `asset-${crypto.randomUUID()}` as ImageAsset["id"],
        name: `${name} (preload)`,
        alt: `Preload de ${name}`,
        mimeType: poster.source.startsWith("data:image/webp") ? "image/webp" : "image/jpeg",
        source: poster.source,
        width: poster.width,
        height: poster.height,
        hash: posterHash,
      };
    }
  } catch {
    posterImage = undefined;
  }

  return {
    video: {
      kind: "video",
      id: `video-${crypto.randomUUID()}` as VideoAsset["id"],
      name,
      alt: "",
      mimeType: file.type as "video/mp4" | "video/webm",
      source,
      ...(posterImage ? { posterAssetId: posterImage.id } : {}),
      width: metadata.width,
      height: metadata.height,
      durationSeconds: metadata.duration,
      hash,
    },
    posterImage,
  };
}

/**
 * Settings de la sección tras subir un video: apunta el campo y, si la
 * sección expone un setting `mode` (p. ej. el hero), lo pasa a "video" para
 * que el render use el video y no la imagen de portada.
 */
export function sectionSettingsWithVideo(
  draft: Record<string, unknown>,
  fieldKey: string,
  videoId: string,
): Record<string, unknown> {
  const next: Record<string, unknown> = { ...draft, [fieldKey]: videoId };
  if (typeof next.mode === "string") next.mode = "video";
  // La media 9:16 en modo video es loop mudo de fondo: arranca sola.
  if ("autoplay" in next) next.autoplay = true;
  // El poster del hero lo genera el video (fotograma a baja resolución): se
  // limpia el poster manual para que el render use el automático.
  if (fieldKey === "videoAssetId" && "posterAssetId" in next) next.posterAssetId = "";
  return next;
}

/**
 * Actualiza el poster de un video existente (re-upload del mismo archivo):
 * reemplaza el poster viejo por el nuevo en `assets` y apunta el video al
 * nuevo `posterAssetId`. Devuelve el proyecto con UNA sola actualización.
 */
export function applyVideoPoster(
  project: StoreProjectV1,
  videoId: string,
  posterImage: ImageAsset | undefined,
): StoreProjectV1 {
  const oldPosterId = project.videos.find((video) => video.id === videoId)?.posterAssetId;
  const assetsWithoutOld = oldPosterId
    ? project.assets.filter((asset) => asset.id !== oldPosterId)
    : project.assets;
  return {
    ...project,
    videos: project.videos.map((video) =>
      video.id === videoId
        ? {
            ...video,
            ...(posterImage ? { posterAssetId: posterImage.id } : {}),
          }
        : video,
    ),
    assets: posterImage ? [...assetsWithoutOld, posterImage] : assetsWithoutOld,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Agrega el video al proyecto y apunta el setting de la sección en UNA sola
 * actualización: evita la carrera en la que la sección referencia un video
 * que el proyecto todavía no contiene (el parse de StoreProjectV2 rechaza el
 * estado intermedio y bloquea la edición).
 */
export function applyVideoToSection(
  project: StoreProjectV1,
  sectionId: string,
  settings: Record<string, unknown>,
  settingsKey: string,
  video: VideoAsset,
  posterImage?: ImageAsset,
): StoreProjectV1 {
  return {
    ...project,
    sections: project.sections.map((section) =>
      section.id === sectionId
        ? { ...section, settings: { ...settings, [settingsKey]: video.id } }
        : section,
    ),
    videos: [...project.videos, video],
    ...(posterImage ? { assets: [...project.assets, posterImage] } : {}),
    updatedAt: new Date().toISOString(),
  };
}
