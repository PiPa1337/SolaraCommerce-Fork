/** Procesa el paquete comercial fuera de UI y devuelve una importación revisable. */
import { strFromU8, unzipSync } from "fflate";

interface CatalogPackageRequest {
  id: string;
  type: "catalog-package";
  buffer: ArrayBuffer;
}

function mimeType(path: string): string {
  const extension = path.split(".").pop()?.toLocaleLowerCase("en-US");
  if (extension === "jpg" || extension === "jpeg") return "image/jpeg";
  if (extension === "png") return "image/png";
  if (extension === "webp") return "image/webp";
  return "";
}

function normalizePath(path: string): string {
  return path.replaceAll("\\", "/").replace(/^\.\//, "");
}

self.onmessage = (event: MessageEvent<CatalogPackageRequest>) => {
  try {
    if (event.data.buffer.byteLength > 250 * 1024 * 1024) {
      throw new Error("El ZIP supera el máximo de 250 MB.");
    }
    const files = unzipSync(new Uint8Array(event.data.buffer));
    const csvEntry = files["productos.csv"] ?? files["catalogo.csv"];
    if (!csvEntry) throw new Error("El ZIP debe contener productos.csv.");

    const imageEntries = Object.entries(files).filter(([rawPath]) =>
      normalizePath(rawPath).startsWith("imagenes/"),
    );
    const unsupported = imageEntries.filter(([rawPath]) => mimeType(rawPath) === "");
    const images = imageEntries
      .map(([rawPath, bytes]) => ({ path: normalizePath(rawPath), bytes, type: mimeType(rawPath) }))
      .filter((entry) => entry.path.startsWith("imagenes/") && entry.type !== "");

    if (unsupported.length > 0) {
      throw new Error("El ZIP contiene archivos no compatibles dentro de imagenes/.");
    }

    const invalidEntries = Object.keys(files).filter((rawPath) => {
      const path = normalizePath(rawPath);
      return path.includes("../") || path.startsWith("/") || path.includes(":");
    });
    if (invalidEntries.length > 0) throw new Error("El ZIP contiene una ruta de archivo insegura.");

    if (images.length > 500) throw new Error("El ZIP supera el máximo de 500 imágenes.");
    if (images.some((image) => image.bytes.byteLength > 20 * 1024 * 1024)) {
      throw new Error("Una imagen del ZIP supera el límite de 20 MB.");
    }
    const totalBytes = images.reduce((sum, image) => sum + image.bytes.byteLength, 0);
    if (totalBytes > 500 * 1024 * 1024) {
      throw new Error("El contenido de imágenes del ZIP supera los 500 MB.");
    }

    const transferableImages = images.map((image) => ({
      path: image.path,
      type: image.type,
      buffer: image.bytes.buffer,
    }));
    const result = { csv: strFromU8(csvEntry), images: transferableImages };
    self.postMessage({ id: event.data.id, ok: true, result }, [
      ...transferableImages.map((image) => image.buffer),
    ]);
  } catch (error) {
    self.postMessage({
      id: event.data.id,
      ok: false,
      error: error instanceof Error ? error.message : "No se pudo leer el ZIP del catálogo.",
    });
  }
};
