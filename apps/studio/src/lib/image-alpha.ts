type AlphaSource = { data: Uint8ClampedArray | Uint8Array } | Uint8ClampedArray | Uint8Array;

const MAX_ALPHA_SAMPLES = 65_536;

export function hasVisibleAlpha(source: AlphaSource): boolean {
  const data = "data" in source ? source.data : source;
  const total = Math.floor(data.length / 4);
  const stride = Math.max(1, Math.ceil(total / MAX_ALPHA_SAMPLES));
  for (let pixel = 0; pixel < total; pixel += stride) {
    if ((data[pixel * 4 + 3] ?? 0) < 255) return true;
  }
  return false;
}
