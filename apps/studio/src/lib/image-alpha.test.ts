import { describe, expect, it } from "vitest";
import { hasVisibleAlpha } from "./image-alpha";

function rgbaData(pixels: number, alpha: (index: number) => number): Uint8ClampedArray {
  const data = new Uint8ClampedArray(pixels * 4);
  for (let index = 0; index < pixels; index += 1) data[index * 4 + 3] = alpha(index);
  return data;
}

describe("detección de alfa visible", () => {
  it("devuelve false cuando todos los píxeles son opacos", () => {
    expect(hasVisibleAlpha(rgbaData(256, () => 255))).toBe(false);
  });

  it("devuelve true con un único píxel parcialmente transparente", () => {
    const data = rgbaData(256, () => 255);
    data[128 * 4 + 3] = 128;
    expect(hasVisibleAlpha(data)).toBe(true);
  });

  it("devuelve true con un único píxel totalmente transparente", () => {
    const data = rgbaData(256, () => 255);
    data[3 * 4 + 3] = 0;
    expect(hasVisibleAlpha(data)).toBe(true);
  });

  it("escanea con stride determinista en imágenes grandes", () => {
    const data = rgbaData(20_000, () => 255);
    expect(hasVisibleAlpha(data)).toBe(false);
    data[17_323 * 4 + 3] = 128;
    expect(hasVisibleAlpha(data)).toBe(true);
    expect(hasVisibleAlpha(data)).toBe(true);
  });

  it("acepta ImageData y arrays crudos", () => {
    const data = rgbaData(16, () => 255);
    data[7 * 4 + 3] = 64;
    expect(hasVisibleAlpha({ data })).toBe(true);
    expect(hasVisibleAlpha(new Uint8Array(data))).toBe(true);
  });
});
