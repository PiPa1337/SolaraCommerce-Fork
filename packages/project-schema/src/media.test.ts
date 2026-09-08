import { describe, expect, it } from "vitest";
import { isValidIco } from "./media.js";

describe("media contracts", () => {
  it("acepta un ICO estructuralmente completo", () => {
    const bytes = new Uint8Array(6 + 16 + 8);
    const view = new DataView(bytes.buffer);
    view.setUint16(2, 1, true);
    view.setUint16(4, 1, true);
    bytes[6] = 16;
    bytes[7] = 16;
    view.setUint32(6 + 8, 8, true);
    view.setUint32(6 + 12, 22, true);
    bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 22);
    expect(isValidIco(bytes)).toBe(true);
  });

  it("rechaza una firma ICO truncada o un directorio fuera de rango", () => {
    expect(isValidIco(Uint8Array.from([0, 0, 1, 0]))).toBe(false);

    const bytes = new Uint8Array(22);
    const view = new DataView(bytes.buffer);
    view.setUint16(2, 1, true);
    view.setUint16(4, 1, true);
    bytes[6] = 16;
    bytes[7] = 16;
    view.setUint32(6 + 8, 4, true);
    view.setUint32(6 + 12, 22, true);
    expect(isValidIco(bytes)).toBe(false);
  });
});
