/**
 * Decisión de modo de composición del shell portable.
 *
 * Por defecto la app usa la aceleración de hardware (el monitor puede correr a
 * 144 Hz). Si el proceso GPU de Chromium muere al arrancar (máquinas sin DLLs
 * o controladores), el proceso principal escribe un marcador y se relanza en
 * modo software — el mismo comportamiento robusto de antes, pero solo en las
 * máquinas que realmente lo necesitan.
 */
import { join } from "node:path";

export const GPU_MODE_MARKER = "gpu-software-mode.json";

/** El modo software se aplica cuando el marcador de fallback existe. */
export function shouldUseSoftwareMode(markerExists) {
  return markerExists;
}

/** Ruta del marcador dentro del perfil de la instalación (persiste entre ejecuciones). */
export function gpuMarkerPath(profileRoot) {
  return join(profileRoot, GPU_MODE_MARKER);
}

/** Ventana de tiempo (ms) en la que un crash del proceso GPU activa el fallback. */
export const GPU_CRASH_WINDOW_MS = 15_000;
