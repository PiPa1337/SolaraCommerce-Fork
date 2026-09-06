import { describe, expect, it } from "vitest";
import {
  GPU_CRASH_WINDOW_MS,
  gpuMarkerPath,
} from "../apps/desktop/src/gpu-mode.mjs";

describe("gpu-mode del shell portable", () => {
  it("el marcador vive dentro del perfil de la instalacion", () => {
    const path = gpuMarkerPath("C:\\perfil");
    expect(path).toContain("gpu-software-mode.json");
    expect(path.startsWith("C:\\perfil")).toBe(true);
  });

  it("la ventana de crash del proceso GPU es de 15 segundos", () => {
    expect(GPU_CRASH_WINDOW_MS).toBe(15_000);
  });
});
