import type { StoreProjectV1, VideoAsset } from "@solara/project-schema";
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

export interface VideoUploadDeps {
  hash?: string;
  readMetadata?: typeof readVideoMetadata;
  readDataUrl?: typeof readFileAsDataUrl;
  computeHash?: typeof hashFile;
}

/**
 * Valida un archivo de video (MP4/WebM, hasta 30 MB, 0-60 s) y devuelve el
 * VideoAsset listo para sumar al proyecto. Los helpers se inyectan en `deps`
 * para poder testear la validación sin un navegador.
 */
export async function buildVideoAsset(file: File, deps: VideoUploadDeps = {}): Promise<VideoAsset> {
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
  const source = await readDataUrl(file);
  const hash = deps.hash ?? (await computeHash(file));
  return {
    kind: "video",
    id: `video-${crypto.randomUUID()}` as VideoAsset["id"],
    name: file.name.replace(/\.[^.]+$/, ""),
    alt: "",
    mimeType: file.type as "video/mp4" | "video/webm",
    source,
    width: metadata.width,
    height: metadata.height,
    durationSeconds: metadata.duration,
    hash,
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
  return next;
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
): StoreProjectV1 {
  return {
    ...project,
    sections: project.sections.map((section) =>
      section.id === sectionId
        ? { ...section, settings: { ...settings, [settingsKey]: video.id } }
        : section,
    ),
    videos: [...project.videos, video],
    updatedAt: new Date().toISOString(),
  };
}
