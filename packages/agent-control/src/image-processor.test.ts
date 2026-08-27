import { deflateSync, inflateSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { generateResponsiveVariants } from "./image-processor";

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, data: Uint8Array): Uint8Array {
  const typeBytes = new TextEncoder().encode(type);
  const crcInput = new Uint8Array(typeBytes.length + data.length);
  crcInput.set(typeBytes);
  crcInput.set(data, typeBytes.length);
  const output = new Uint8Array(12 + data.length);
  new DataView(output.buffer).setUint32(0, data.length);
  output.set(typeBytes, 4);
  output.set(data, 8);
  new DataView(output.buffer).setUint32(8 + data.length, crc32(crcInput));
  return output;
}

function filteredPng(): Uint8Array {
  const width = 321;
  const height = 1;
  const row = new Uint8Array(width * 3 + 1);
  row[0] = 1;
  row[1] = 10;
  row[2] = 20;
  row[3] = 30;
  row[4] = 1;
  row[5] = 1;
  row[6] = 1;
  const ihdr = new Uint8Array(13);
  const ihdrView = new DataView(ihdr.buffer);
  ihdrView.setUint32(0, width);
  ihdrView.setUint32(4, height);
  ihdr[8] = 8;
  ihdr[9] = 2;
  const signature = Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const idat = pngChunk("IDAT", deflateSync(row));
  return Uint8Array.from([
    ...signature,
    ...pngChunk("IHDR", ihdr),
    ...idat,
    ...pngChunk("IEND", new Uint8Array()),
  ]);
}

function decodeUnfilteredPng(bytes: Uint8Array): Uint8Array {
  let offset = 8;
  let idat = new Uint8Array();
  while (offset < bytes.length) {
    const length = new DataView(bytes.buffer, bytes.byteOffset + offset).getUint32(0);
    const type = String.fromCharCode(...bytes.subarray(offset + 4, offset + 8));
    if (type === "IDAT")
      idat = Uint8Array.from([...idat, ...bytes.subarray(offset + 8, offset + 8 + length)]);
    offset += length + 12;
  }
  return inflateSync(idat).subarray(1);
}

describe("image-processor", () => {
  it("deshace los filtros PNG antes de generar variantes responsive", () => {
    const variants = generateResponsiveVariants(filteredPng());
    expect(variants).toHaveLength(1);
    const pixels = decodeUnfilteredPng(variants[0]?.data ?? new Uint8Array());
    expect([...pixels.subarray(0, 3)]).toEqual([10, 20, 30]);
    expect([...pixels.subarray(pixels.length - 3)]).toEqual([11, 21, 31]);
  });
});
