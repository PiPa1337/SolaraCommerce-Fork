/** Procesa la carpeta comercial fuera de UI y devuelve una importación revisable. */
interface CatalogPackageRequest {
  id: string;
  type: "catalog-package";
  files: Array<{ path: string; type: string; buffer: ArrayBuffer }>;
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

function entryBytes(entry: { buffer: ArrayBuffer }): Uint8Array {
  const view = new Uint8Array(entry.buffer.byteLength);
  view.set(new Uint8Array(entry.buffer));
  return view;
}

self.onmessage = (event: MessageEvent<CatalogPackageRequest>) => {
  try {
    const files = event.data.files;
    if (!Array.isArray(files)) throw new Error("La carpeta no contiene archivos.");
    const totalInputBytes = files.reduce((sum, file) => sum + file.buffer.byteLength, 0);
    if (totalInputBytes > 250 * 1024 * 1024) {
      throw new Error("La carpeta supera el máximo de 250 MB.");
    }
    const csvEntry = files.find(
      (file) =>
        normalizePath(file.path) === "productos.csv" || normalizePath(file.path) === "catalogo.csv",
    );
    if (!csvEntry) throw new Error("La carpeta debe contener productos.csv.");

    const imageEntries = files.filter((file) => normalizePath(file.path).startsWith("imagenes/"));
    const unsupported = imageEntries.filter((file) => mimeType(file.path) === "");
    const images = imageEntries
      .map((file) => ({
        path: normalizePath(file.path),
        bytes: entryBytes(file),
        type: mimeType(file.path),
      }))
      .filter((entry) => entry.path.startsWith("imagenes/") && entry.type !== "");

    if (unsupported.length > 0) {
      throw new Error("La carpeta contiene archivos no compatibles dentro de imagenes/.");
    }

    const invalidEntries = files
      .map((file) => normalizePath(file.path))
      .filter((path) => path.includes("../") || path.startsWith("/") || path.includes(":"));
    if (invalidEntries.length > 0)
      throw new Error("La carpeta contiene una ruta de archivo insegura.");

    if (images.length > 500) throw new Error("La carpeta supera el máximo de 500 imágenes.");
    if (images.some((image) => image.bytes.byteLength > 20 * 1024 * 1024)) {
      throw new Error("Una imagen de la carpeta supera el límite de 20 MB.");
    }
    const totalBytes = images.reduce((sum, image) => sum + image.bytes.byteLength, 0);
    if (totalBytes > 500 * 1024 * 1024) {
      throw new Error("El contenido de imágenes de la carpeta supera los 500 MB.");
    }

    const transferableImages = images.map((image) => ({
      path: image.path,
      type: image.type,
      buffer: image.bytes.buffer,
    }));
    const result = {
      csv: new TextDecoder().decode(entryBytes(csvEntry)),
      images: transferableImages,
    };
    self.postMessage({ id: event.data.id, ok: true, result }, [
      ...transferableImages.map((image) => image.buffer),
    ]);
  } catch (error) {
    self.postMessage({
      id: event.data.id,
      ok: false,
      error: error instanceof Error ? error.message : "No se pudo leer la carpeta del catálogo.",
    });
  }
};
