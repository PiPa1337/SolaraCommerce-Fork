/**
 * Procesador de imagenes pure-JS para el canal de agentes.
 */
import { deflateSync, inflateSync } from "node:zlib";

export interface ResponsiveVariant {
  width: number;
  data: Uint8Array;
}

interface DecodedPng {
  width: number;
  height: number;
  pixels: Uint8Array;
}

const CRC_TABLE = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  CRC_TABLE[n] = c;
}

function crc32(buf: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of buf) crc = (CRC_TABLE[(crc ^ byte) & 0xff] ?? 0) ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function decodePng(buffer: Uint8Array): DecodedPng {
  for (let i = 0; i < 4; i++)
    if ((buffer[i] ?? 0) !== [0x89, 0x50, 0x4e, 0x47][i]) throw new Error("Not a PNG");
  let offset = 8;
  let width = 0,
    height = 0,
    bitDepth = 0,
    colorType = 0,
    interlace = 0;
  const idatChunks: Uint8Array[] = [];
  while (offset < buffer.length) {
    const view = new DataView(buffer.buffer, buffer.byteOffset + offset);
    const chunkLen = view.getUint32(0);
    const ct = String.fromCharCode(
      buffer[offset + 4] ?? 0,
      buffer[offset + 5] ?? 0,
      buffer[offset + 6] ?? 0,
      buffer[offset + 7] ?? 0,
    );
    if (ct === "IHDR") {
      width = view.getUint32(8);
      height = view.getUint32(12);
      bitDepth = buffer[offset + 16] ?? 0;
      colorType = buffer[offset + 17] ?? 0;
      interlace = buffer[offset + 20] ?? 0;
    } else if (ct === "IDAT") idatChunks.push(buffer.subarray(offset + 8, offset + 8 + chunkLen));
    else if (ct === "IEND") break;
    offset += 12 + chunkLen;
  }
  if (bitDepth !== 8 || colorType !== 2 || interlace !== 0) {
    throw new Error("PNG no compatible con el procesador responsive.");
  }
  const combined = new Uint8Array(idatChunks.reduce((s, c) => s + c.length, 0));
  let pos = 0;
  for (const c of idatChunks) {
    combined.set(c, pos);
    pos += c.length;
  }
  const inflated = inflateSync(combined);
  const bytesPerPixel = 3;
  const stride = width * bytesPerPixel + 1;
  const pixels = new Uint8Array(width * height * 3);
  for (let y = 0; y < height; y++) {
    const rowOffset = y * stride;
    const filter = inflated[rowOffset] ?? 0;
    if (filter > 4) throw new Error("PNG usa un filtro de fila inválido.");
    for (let x = 0; x < width * bytesPerPixel; x++) {
      const raw = inflated[rowOffset + 1 + x] ?? 0;
      const left = x >= bytesPerPixel ? (pixels[y * width * 3 + x - bytesPerPixel] ?? 0) : 0;
      const up = y > 0 ? (pixels[(y - 1) * width * 3 + x] ?? 0) : 0;
      const upperLeft =
        y > 0 && x >= bytesPerPixel ? (pixels[(y - 1) * width * 3 + x - bytesPerPixel] ?? 0) : 0;
      let reconstructed = raw;
      if (filter === 1) reconstructed = raw + left;
      else if (filter === 2) reconstructed = raw + up;
      else if (filter === 3) reconstructed = raw + Math.floor((left + up) / 2);
      else if (filter === 4) {
        const predictor = left + up - upperLeft;
        const leftDistance = Math.abs(predictor - left);
        const upDistance = Math.abs(predictor - up);
        const upperLeftDistance = Math.abs(predictor - upperLeft);
        reconstructed =
          raw +
          (leftDistance <= upDistance && leftDistance <= upperLeftDistance
            ? left
            : upDistance <= upperLeftDistance
              ? up
              : upperLeft);
      }
      pixels[y * width * 3 + x] = reconstructed & 0xff;
    }
  }
  return { width, height, pixels };
}

function resizeNearest(
  pixels: Uint8Array,
  srcW: number,
  srcH: number,
  dstW: number,
): { data: Uint8Array; height: number } {
  const dstH = Math.max(1, Math.round((srcH / srcW) * dstW));
  const result = new Uint8Array(dstW * dstH * 3);
  for (let y = 0; y < dstH; y++) {
    const sy = Math.min(srcH - 1, Math.floor((y / dstH) * srcH));
    for (let x = 0; x < dstW; x++) {
      const sx = Math.min(srcW - 1, Math.floor((x / dstW) * srcW));
      const si = (sy * srcW + sx) * 3,
        di = (y * dstW + x) * 3;
      result[di] = pixels[si] ?? 0;
      result[di + 1] = pixels[si + 1] ?? 0;
      result[di + 2] = pixels[si + 2] ?? 0;
    }
  }
  return { data: result, height: dstH };
}

function encodePng(px: Uint8Array, w: number, h: number): Uint8Array {
  const sig = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdrD = new Uint8Array(13);
  const iv = new DataView(ihdrD.buffer);
  iv.setUint32(0, w);
  iv.setUint32(4, h);
  ihdrD[8] = 8;
  ihdrD[9] = 2;
  const stride = w * 3 + 1;
  const raw = new Uint8Array(stride * h);
  for (let y = 0; y < h; y++) {
    raw[y * stride] = 0;
    for (let x = 0; x < w * 3; x++) raw[y * stride + 1 + x] = px[y * w * 3 + x] ?? 0;
  }
  const compressed = deflateSync(raw);
  function chunk(type: string, data: Uint8Array): Uint8Array {
    const len = new Uint8Array(4);
    new DataView(len.buffer).setUint32(0, data.length);
    const tb = new TextEncoder().encode(type);
    const ci = new Uint8Array(tb.length + data.length);
    ci.set(tb);
    ci.set(data, tb.length);
    const cv = new Uint8Array(4);
    new DataView(cv.buffer).setUint32(0, crc32(ci));
    const result = new Uint8Array(12 + data.length);
    result.set(len);
    result.set(tb, 4);
    result.set(data, 8);
    result.set(cv, 8 + data.length);
    return result;
  }
  return concatU8([
    sig,
    chunk("IHDR", ihdrD),
    chunk("IDAT", compressed),
    chunk("IEND", new Uint8Array(0)),
  ]);
}

function concatU8(arrays: Uint8Array[]): Uint8Array {
  const total = arrays.reduce((sum, a) => sum + a.length, 0);
  const result = new Uint8Array(total);
  let offset = 0;
  for (const a of arrays) {
    result.set(a, offset);
    offset += a.length;
  }
  return result;
}

export function generateResponsiveVariants(buffer: Uint8Array): ResponsiveVariant[] {
  const decoded = decodePng(buffer);
  const widths = [320, 480, 768, 1024].filter((w) => w < decoded.width);
  if (widths.length === 0) return [];
  return widths.map((width) => {
    const resized = resizeNearest(decoded.pixels, decoded.width, decoded.height, width);
    return { width, data: encodePng(resized.data, width, resized.height) };
  });
}
