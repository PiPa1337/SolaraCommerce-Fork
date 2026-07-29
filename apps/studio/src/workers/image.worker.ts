interface ImageRequest {
  id: string;
  buffer: ArrayBuffer;
  name: string;
  type: string;
  maxWidth: number;
}

async function canvasToDataUrl(
  bitmap: ImageBitmap,
  width: number,
  mimeType: "image/webp" | "image/jpeg",
): Promise<string> {
  const height = Math.max(1, Math.round((bitmap.height / bitmap.width) * width));
  const canvas = new OffscreenCanvas(width, height);
  const context = canvas.getContext("2d", { alpha: false });
  if (!context) throw new Error("El navegador no pudo procesar la imagen.");
  context.drawImage(bitmap, 0, 0, width, height);
  const blob = await canvas.convertToBlob({
    type: mimeType,
    quality: mimeType === "image/webp" ? 0.84 : 0.88,
  });
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = "";
  const block = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += block) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + block));
  }
  return `data:${mimeType};base64,${btoa(binary)}`;
}

self.onmessage = async (event: MessageEvent<ImageRequest>) => {
  try {
    const { id, buffer, maxWidth } = event.data;
    const source = new Blob([buffer], { type: event.data.type });
    const bitmap = await createImageBitmap(source, { imageOrientation: "from-image" });
    const outputWidth = Math.min(bitmap.width, maxWidth);
    const widths = [
      ...new Set([480, 960, outputWidth].filter((width) => width <= outputWidth)),
    ].sort((left, right) => left - right);
    const responsive = await Promise.all(
      widths.map(async (width) => ({
        width,
        source: await canvasToDataUrl(bitmap, width, "image/webp"),
      })),
    );
    const primary =
      responsive.find((item) => item.width === outputWidth)?.source ??
      (await canvasToDataUrl(bitmap, outputWidth, "image/webp"));
    const fallback = await canvasToDataUrl(bitmap, outputWidth, "image/jpeg");
    const height = Math.max(1, Math.round((bitmap.height / bitmap.width) * outputWidth));
    bitmap.close();
    self.postMessage({
      id,
      ok: true,
      result: { width: outputWidth, height, primary, fallback, responsive },
    });
  } catch (error) {
    self.postMessage({
      id: event.data.id,
      ok: false,
      error: error instanceof Error ? error.message : "No se pudo procesar la imagen.",
    });
  }
};

export {};
