import { describe, expect, it } from "vitest";
import {
  createImagePlan,
  IMAGE_RECIPE,
  sourceCanContainAlpha,
  validateImageInput,
} from "./image.worker";

function buffer(...bytes: number[]): ArrayBuffer {
  return Uint8Array.from(bytes).buffer;
}

describe("receta de imágenes", () => {
  it("mantiene anchos estables y nunca amplía la imagen", () => {
    expect(IMAGE_RECIPE.widths).toEqual([480, 768, 1800]);
    expect(createImagePlan(320, 200)).toEqual({
      width: 320,
      height: 200,
      responsiveWidths: [320],
    });
    expect(createImagePlan(700, 400).responsiveWidths).toEqual([480, 700]);
    expect(createImagePlan(1000, 500).responsiveWidths).toEqual([480, 768, 1000]);
    expect(createImagePlan(2400, 1200).responsiveWidths).toEqual([480, 768, 1800]);
  });

  it("conserva la relación de aspecto al limitar el ancho", () => {
    expect(createImagePlan(2400, 1600)).toMatchObject({ width: 1800, height: 1200 });
    expect(createImagePlan(1000, 333, 768)).toMatchObject({ width: 768, height: 256 });
  });

  it("rechaza dimensiones inválidas y más de 50 megapíxeles", () => {
    expect(() => createImagePlan(0, 100)).toThrow("dimensiones válidas");
    expect(() => createImagePlan(10_000, 5_001)).toThrow("50 megapíxeles");
  });
});

describe("validación de archivos de imagen", () => {
  const jpeg = buffer(0xff, 0xd8, 0xff);
  const png = buffer(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a);
  const webp = buffer(0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50);

  it("acepta firmas compatibles", () => {
    expect(validateImageInput("image/jpeg", jpeg)).toBe("image/jpeg");
    expect(validateImageInput("image/png", png)).toBe("image/png");
    expect(validateImageInput("image/webp", webp)).toBe("image/webp");
  });

  it("rechaza tipo, vacío, firma falsa y tamaño excesivo", () => {
    expect(() => validateImageInput("image/gif", jpeg)).toThrow("JPEG, PNG o WebP");
    expect(() => validateImageInput("image/png", new ArrayBuffer(0))).toThrow("vacía");
    expect(() => validateImageInput("image/png", jpeg)).toThrow("no coincide");
    expect(() =>
      validateImageInput("image/jpeg", new ArrayBuffer(IMAGE_RECIPE.maxBytes + 1)),
    ).toThrow("25 MB");
  });

  it("preserva alpha para PNG y WebP que lo declaran", () => {
    const alphaPng = new Uint8Array(26);
    alphaPng.set(new Uint8Array(png));
    alphaPng[25] = 6;
    expect(sourceCanContainAlpha("image/png", alphaPng.buffer)).toBe(true);
    expect(sourceCanContainAlpha("image/jpeg", jpeg)).toBe(false);

    const alphaWebp = new Uint8Array(24);
    alphaWebp.set(new Uint8Array(webp));
    alphaWebp.set([0x56, 0x50, 0x38, 0x58], 12);
    alphaWebp[20] = 0x10;
    expect(sourceCanContainAlpha("image/webp", alphaWebp.buffer)).toBe(true);
  });
});
