import { unzlibSync, zlibSync } from "fflate";

const PNG_SIGNATURE = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const CRC_TABLE = new Uint32Array(256);
for (let n = 0; n < 256; n += 1) {
  let c = n;
  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  CRC_TABLE[n] = c;
}

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    const entry = CRC_TABLE[(crc ^ byte) & 0xff];
    if (entry !== undefined) crc = entry ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Uint8Array): Uint8Array {
  const typeBytes = new TextEncoder().encode(type);
  const payload = new Uint8Array(typeBytes.length + data.length);
  payload.set(typeBytes);
  payload.set(data, typeBytes.length);
  const result = new Uint8Array(payload.length + 8);
  new DataView(result.buffer).setUint32(0, data.length, false);
  result.set(typeBytes, 4);
  result.set(data, 8);
  new DataView(result.buffer).setUint32(payload.length + 4, crc32(payload), false);
  return result;
}

function ihdrChunk(width: number, height: number, colorType: number): Uint8Array {
  const ihdr = new Uint8Array(13);
  const view = new DataView(ihdr.buffer);
  view.setUint32(0, width, false);
  view.setUint32(4, height, false);
  ihdr[8] = 8;
  ihdr[9] = colorType;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  return ihdr;
}

function concatBytes(...parts: readonly Uint8Array[]): Uint8Array {
  const result = new Uint8Array(parts.reduce((total, part) => total + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.length;
  }
  return result;
}

export function encodePngRgba(rgba: Uint8Array, width: number, height: number): Uint8Array {
  if (rgba.length < width * height * 4) {
    throw new Error("encodePngRgba: los bytes no cubren la imagen completa");
  }
  const stride = width * 4;
  const raw = new Uint8Array(height * (1 + stride));
  for (let row = 0; row < height; row += 1) {
    const lineStart = row * (1 + stride);
    raw[lineStart] = 0;
    for (let column = 0; column < width; column += 1) {
      const source = (row * width + column) * 4;
      const target = lineStart + 1 + column * 4;
      raw[target] = rgba[source] ?? 0;
      raw[target + 1] = rgba[source + 1] ?? 0;
      raw[target + 2] = rgba[source + 2] ?? 0;
      raw[target + 3] = rgba[source + 3] ?? 0;
    }
  }
  return concatBytes(
    PNG_SIGNATURE,
    chunk("IHDR", ihdrChunk(width, height, 6)),
    chunk("IDAT", zlibSync(raw)),
    chunk("IEND", new Uint8Array()),
  );
}

export function encodePngPalette(
  indices: Uint8Array,
  palette: Uint8Array,
  width: number,
  height: number,
): Uint8Array {
  const colorCount = palette.length / 3;
  if (!Number.isInteger(colorCount) || colorCount < 1 || colorCount > 256) {
    throw new Error("encodePngPalette: la paleta debe tener entre 1 y 256 colores RGB");
  }
  if (indices.length < width * height) {
    throw new Error("encodePngPalette: los índices no cubren la imagen completa");
  }
  for (const index of indices) {
    if (index >= colorCount) {
      throw new Error("encodePngPalette: índice de pixel fuera de la paleta");
    }
  }
  const stride = width;
  const raw = new Uint8Array(height * (1 + stride));
  for (let row = 0; row < height; row += 1) {
    const lineStart = row * (1 + stride);
    raw[lineStart] = 0;
    for (let column = 0; column < width; column += 1) {
      raw[lineStart + 1 + column] = indices[row * width + column] ?? 0;
    }
  }
  return concatBytes(
    PNG_SIGNATURE,
    chunk("IHDR", ihdrChunk(width, height, 3)),
    chunk("PLTE", palette),
    chunk("IDAT", zlibSync(raw)),
    chunk("IEND", new Uint8Array()),
  );
}

export interface DecodedPng {
  width: number;
  height: number;
  rgba: Uint8Array;
}

const MAX_DECODED_DIMENSION = 4096;

function paethPredictor(a: number, b: number, c: number): number {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  if (pb <= pc) return b;
  return c;
}

export function decodePngRgba(bytes: Uint8Array): DecodedPng | undefined {
  if (bytes.length < 57) return undefined;
  for (let index = 0; index < 8; index += 1) {
    if (bytes[index] !== PNG_SIGNATURE[index]) return undefined;
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  let sawHeader = false;
  const idat: Uint8Array[] = [];
  let ended = false;
  while (offset + 12 <= bytes.length && !ended) {
    const length = view.getUint32(offset, false);
    const type = String.fromCharCode(
      bytes[offset + 4] ?? 0,
      bytes[offset + 5] ?? 0,
      bytes[offset + 6] ?? 0,
      bytes[offset + 7] ?? 0,
    );
    if (offset + 8 + length + 4 > bytes.length) return undefined;
    if (type === "IHDR") {
      if (sawHeader || length !== 13) return undefined;
      sawHeader = true;
      width = view.getUint32(offset + 8, false);
      height = view.getUint32(offset + 12, false);
      bitDepth = bytes[offset + 16] ?? 0;
      colorType = bytes[offset + 17] ?? 0;
      if ((bytes[offset + 18] ?? 0) !== 0) return undefined;
      if ((bytes[offset + 19] ?? 0) !== 0) return undefined;
      if ((bytes[offset + 20] ?? 0) !== 0) return undefined;
    } else if (type === "IDAT") {
      idat.push(bytes.slice(offset + 8, offset + 8 + length));
    } else if (type === "IEND") {
      ended = true;
    }
    offset += 12 + length;
  }
  if (!sawHeader || !ended || idat.length === 0) return undefined;
  if (width < 1 || height < 1) return undefined;
  if (width > MAX_DECODED_DIMENSION || height > MAX_DECODED_DIMENSION) return undefined;
  if (bitDepth !== 8) return undefined;
  if (colorType !== 2 && colorType !== 6) return undefined;
  const compressedLength = idat.reduce((total, part) => total + part.length, 0);
  const compressed = new Uint8Array(compressedLength);
  let cursor = 0;
  for (const part of idat) {
    compressed.set(part, cursor);
    cursor += part.length;
  }
  let raw: Uint8Array;
  try {
    raw = unzlibSync(compressed);
  } catch {
    return undefined;
  }
  const bpp = colorType === 6 ? 4 : 3;
  const stride = width * bpp;
  const expected = height * (1 + stride);
  if (raw.length < expected) return undefined;
  const reconstructed = new Uint8Array(height * stride);
  let previous: Uint8Array | undefined;
  for (let row = 0; row < height; row += 1) {
    const lineStart = row * (1 + stride);
    const filterType = raw[lineStart] ?? 0;
    const line = raw.subarray(lineStart + 1, lineStart + 1 + stride);
    const current = reconstructed.subarray(row * stride, row * stride + stride);
    for (let index = 0; index < stride; index += 1) {
      const x = line[index] ?? 0;
      const left = index >= bpp ? (current[index - bpp] ?? 0) : 0;
      const up = previous ? (previous[index] ?? 0) : 0;
      const upLeft = previous && index >= bpp ? (previous[index - bpp] ?? 0) : 0;
      let value = x;
      if (filterType === 1) value = x + left;
      else if (filterType === 2) value = x + up;
      else if (filterType === 3) value = x + Math.floor((left + up) / 2);
      else if (filterType === 4) value = x + paethPredictor(left, up, upLeft);
      current[index] = value & 0xff;
    }
    previous = current;
  }
  if (colorType === 6) {
    return { width, height, rgba: reconstructed };
  }
  const rgba = new Uint8Array(width * height * 4);
  for (let pixel = 0; pixel < width * height; pixel += 1) {
    rgba[pixel * 4] = reconstructed[pixel * 3] ?? 0;
    rgba[pixel * 4 + 1] = reconstructed[pixel * 3 + 1] ?? 0;
    rgba[pixel * 4 + 2] = reconstructed[pixel * 3 + 2] ?? 0;
    rgba[pixel * 4 + 3] = 255;
  }
  return { width, height, rgba };
}

export function scaleRgbaBilinear(
  source: Uint8Array,
  sourceWidth: number,
  sourceHeight: number,
  targetWidth: number,
  targetHeight: number,
): Uint8Array {
  if (source.length < sourceWidth * sourceHeight * 4) {
    throw new Error("scaleRgbaBilinear: los bytes no cubren la imagen de origen");
  }
  const output = new Uint8Array(targetWidth * targetHeight * 4);
  for (let y = 0; y < targetHeight; y += 1) {
    const gy = Math.min(
      Math.max((y + 0.5) * (sourceHeight / targetHeight) - 0.5, 0),
      sourceHeight - 1,
    );
    const y0 = Math.floor(gy);
    const y1 = Math.min(y0 + 1, sourceHeight - 1);
    const fy = gy - y0;
    for (let x = 0; x < targetWidth; x += 1) {
      const gx = Math.min(
        Math.max((x + 0.5) * (sourceWidth / targetWidth) - 0.5, 0),
        sourceWidth - 1,
      );
      const x0 = Math.floor(gx);
      const x1 = Math.min(x0 + 1, sourceWidth - 1);
      const fx = gx - x0;
      const target = (y * targetWidth + x) * 4;
      for (let channel = 0; channel < 4; channel += 1) {
        const p00 = source[(y0 * sourceWidth + x0) * 4 + channel] ?? 0;
        const p10 = source[(y0 * sourceWidth + x1) * 4 + channel] ?? 0;
        const p01 = source[(y1 * sourceWidth + x0) * 4 + channel] ?? 0;
        const p11 = source[(y1 * sourceWidth + x1) * 4 + channel] ?? 0;
        const top = p00 + (p10 - p00) * fx;
        const bottom = p01 + (p11 - p01) * fx;
        output[target + channel] = Math.round(top + (bottom - top) * fy);
      }
    }
  }
  return output;
}

export interface QuantizedImage {
  indices: Uint8Array;
  palette: Uint8Array;
}

const QUANTIZE_BITS = 5;

export function quantizeRgba(rgba: Uint8Array, maxColors = 256): QuantizedImage {
  const pixelCount = Math.floor(rgba.length / 4);
  const limit = Math.max(1, Math.min(256, Math.floor(maxColors)));
  const exact = new Map<number, number>();
  for (let pixel = 0; pixel < pixelCount; pixel += 1) {
    const key =
      ((rgba[pixel * 4] ?? 0) << 16) |
      ((rgba[pixel * 4 + 1] ?? 0) << 8) |
      (rgba[pixel * 4 + 2] ?? 0);
    exact.set(key, (exact.get(key) ?? 0) + 1);
  }
  const byFrequency = (left: [number, number], right: [number, number]): number =>
    right[1] - left[1] || left[0] - right[0];
  if (exact.size <= limit) {
    const entries = [...exact.entries()].sort(byFrequency);
    const palette = new Uint8Array(entries.length * 3);
    const indexOf = new Map<number, number>();
    entries.forEach(([key], index) => {
      indexOf.set(key, index);
      palette[index * 3] = (key >> 16) & 0xff;
      palette[index * 3 + 1] = (key >> 8) & 0xff;
      palette[index * 3 + 2] = key & 0xff;
    });
    const indices = new Uint8Array(pixelCount);
    for (let pixel = 0; pixel < pixelCount; pixel += 1) {
      const key =
        ((rgba[pixel * 4] ?? 0) << 16) |
        ((rgba[pixel * 4 + 1] ?? 0) << 8) |
        (rgba[pixel * 4 + 2] ?? 0);
      indices[pixel] = indexOf.get(key) ?? 0;
    }
    return { indices, palette };
  }
  const shift = 8 - QUANTIZE_BITS;
  const buckets = new Map<number, number>();
  const bucketOf = (pixel: number): number =>
    (((rgba[pixel * 4] ?? 0) >> shift) << (QUANTIZE_BITS * 2)) |
    (((rgba[pixel * 4 + 1] ?? 0) >> shift) << QUANTIZE_BITS) |
    ((rgba[pixel * 4 + 2] ?? 0) >> shift);
  for (let pixel = 0; pixel < pixelCount; pixel += 1) {
    const key = bucketOf(pixel);
    buckets.set(key, (buckets.get(key) ?? 0) + 1);
  }
  const kept = [...buckets.entries()].sort(byFrequency).slice(0, limit);
  const palette = new Uint8Array(kept.length * 3);
  const keptKeys = new Map<number, number>();
  kept.forEach(([key], index) => {
    keptKeys.set(key, index);
    palette[index * 3] = (((key >> (QUANTIZE_BITS * 2)) & 0x1f) << shift) | (1 << (shift - 1));
    palette[index * 3 + 1] = (((key >> QUANTIZE_BITS) & 0x1f) << shift) | (1 << (shift - 1));
    palette[index * 3 + 2] = ((key & 0x1f) << shift) | (1 << (shift - 1));
  });
  const nearestCache = new Map<number, number>();
  const nearest = (key: number): number => {
    const cached = nearestCache.get(key);
    if (cached !== undefined) return cached;
    const r = (key >> (QUANTIZE_BITS * 2)) & 0x1f;
    const g = (key >> QUANTIZE_BITS) & 0x1f;
    const b = key & 0x1f;
    let bestIndex = 0;
    let bestDistance = Number.POSITIVE_INFINITY;
    for (const [candidate, index] of keptKeys) {
      const distance =
        Math.abs(((candidate >> (QUANTIZE_BITS * 2)) & 0x1f) - r) +
        Math.abs(((candidate >> QUANTIZE_BITS) & 0x1f) - g) +
        Math.abs((candidate & 0x1f) - b);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestIndex = index;
      }
    }
    nearestCache.set(key, bestIndex);
    return bestIndex;
  };
  const indices = new Uint8Array(pixelCount);
  for (let pixel = 0; pixel < pixelCount; pixel += 1) {
    const key = bucketOf(pixel);
    indices[pixel] = keptKeys.get(key) ?? nearest(key);
  }
  return { indices, palette };
}
