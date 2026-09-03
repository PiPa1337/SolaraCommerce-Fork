import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createImagePlan,
  IMAGE_RECIPE,
  processImage,
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
    expect(() => validateImageInput("image/gif", jpeg)).toThrow("JPEG, PNG, WebP o AVIF");
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

  it("acepta la firma AVIF y rechaza un falso AVIF", () => {
    const avif = new Uint8Array(24);
    avif.set([0x66, 0x74, 0x79, 0x70], 4);
    avif.set([0x61, 0x76, 0x69, 0x66], 8);
    expect(validateImageInput("image/avif", avif.buffer)).toBe("image/avif");
    expect(() => validateImageInput("image/png", avif.buffer)).toThrow("no coincide");
  });
});

let probeAlpha = 255;

function rgbaWithAlpha(pixels: number, alpha: number): Uint8ClampedArray {
  const data = new Uint8ClampedArray(pixels * 4);
  for (let index = 0; index < pixels; index += 1) data[index * 4 + 3] = alpha;
  return data;
}

class FakeOffscreenCanvas {
  constructor(
    public width: number,
    public height: number,
  ) {}
  getContext() {
    return {
      fillStyle: "",
      fillRect: () => {},
      drawImage: () => {},
      getImageData: (_x: number, _y: number, width: number, height: number) => ({
        data: rgbaWithAlpha(width * height, probeAlpha),
        width,
        height,
        colorSpace: "srgb",
      }),
    };
  }
  convertToBlob(options?: { type?: string }) {
    return Promise.resolve(
      new Blob([new Uint8Array([0, 1, 2])], { type: options?.type ?? "image/png" }),
    );
  }
}

function pngBufferWithColorType(colorType: number): ArrayBuffer {
  const bytes = new Uint8Array(32);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  bytes[25] = colorType;
  return bytes.buffer;
}

function avifBuffer(): ArrayBuffer {
  const bytes = new Uint8Array(24);
  bytes.set([0x66, 0x74, 0x79, 0x70], 4);
  bytes.set([0x61, 0x76, 0x69, 0x66], 8);
  return bytes.buffer;
}

describe("procesamiento con alfa real", () => {
  beforeEach(() => {
    probeAlpha = 255;
    vi.stubGlobal(
      "createImageBitmap",
      vi.fn(async () => ({ width: 64, height: 64, close: () => {} })),
    );
    vi.stubGlobal("OffscreenCanvas", FakeOffscreenCanvas);
  });

  it("genera fallback jpeg para un PNG RGBA visualmente opaco", async () => {
    const result = await processImage({
      id: "png-opaco",
      buffer: pngBufferWithColorType(6),
      name: "foto.png",
      type: "image/png",
      maxWidth: 1800,
    });
    expect(result.fallback.startsWith("data:image/jpeg;")).toBe(true);
  });

  it("conserva fallback png cuando el PNG tiene alfa visible", async () => {
    probeAlpha = 0;
    const result = await processImage({
      id: "png-alfa",
      buffer: pngBufferWithColorType(6),
      name: "logo.png",
      type: "image/png",
      maxWidth: 1800,
    });
    expect(result.fallback.startsWith("data:image/png;")).toBe(true);
  });

  it("reprocesa una fuente AVIF optimizada con alfa real", async () => {
    const result = await processImage({
      id: "avif-opaco",
      buffer: avifBuffer(),
      name: "foto.avif",
      type: "image/avif",
      maxWidth: 1800,
    });
    expect(result.primary.startsWith("data:image/avif;")).toBe(true);
    expect(result.fallback.startsWith("data:image/jpeg;")).toBe(true);
  });
});
