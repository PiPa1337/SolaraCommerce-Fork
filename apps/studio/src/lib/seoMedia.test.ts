import { describe, expect, it } from "vitest";
import { encodeIco, FAVICON_SIZES } from "./seoMedia";

describe("medios SEO", () => {
  it("genera un ICO multirresolución válido con entradas PNG", () => {
    const images = FAVICON_SIZES.map((width) => ({
      width,
      data: new Uint8Array([0x89, 0x50, 0x4e, 0x47, width]),
    }));
    const ico = encodeIco(images);
    const view = new DataView(ico.buffer);

    expect(view.getUint16(0, true)).toBe(0);
    expect(view.getUint16(2, true)).toBe(1);
    expect(view.getUint16(4, true)).toBe(FAVICON_SIZES.length);
    expect(view.getUint8(6)).toBe(16);
    expect(view.getUint8(6 + 5 * 16)).toBe(0);
    expect(view.getUint16(6 + 4, true)).toBe(1);
    expect(view.getUint16(6 + 6, true)).toBe(32);
    expect(view.getUint32(6 + 12, true)).toBe(6 + FAVICON_SIZES.length * 16);
  });
});
