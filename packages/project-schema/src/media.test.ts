import { describe, expect, it } from "vitest";
import { compactResponsiveSources, RESPONSIVE_IMAGE_WIDTHS, responsiveImageWidths } from "./media";

describe("receta de imágenes responsive", () => {
  it("define sólo la variante intermedia y la máxima sin ampliar imágenes", () => {
    expect(RESPONSIVE_IMAGE_WIDTHS).toEqual([768, 1800]);
    expect(responsiveImageWidths(2400)).toEqual([768, 1800]);
    expect(responsiveImageWidths(1000)).toEqual([768, 1000]);
    expect(responsiveImageWidths(700)).toEqual([700]);
  });

  it("compacta recetas antiguas conservando la mejor y el punto intermedio", () => {
    const sources = [320, 480, 640, 768, 1024, 1280, 1600, 1800].map((width) => ({
      width,
      source: `/assets/foto-${width}.webp`,
    }));

    expect(
      compactResponsiveSources(sources, 1800, {
        width: 1800,
        source: "/assets/foto.webp",
      }),
    ).toEqual([
      { width: 768, source: "/assets/foto-768.webp" },
      { width: 1800, source: "/assets/foto.webp" },
    ]);
  });
});
