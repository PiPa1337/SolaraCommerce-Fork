import { mkdir, readdir, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve } from "node:path";

function safeFolderPart(value, fallback) {
  const normalized = String(value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase()
    .slice(0, 64);
  return normalized || fallback;
}

function exportDate(value = new Date()) {
  const pad = (part) => String(part).padStart(2, "0");
  return `${value.getFullYear()}${pad(value.getMonth() + 1)}${pad(value.getDate())}-${pad(value.getHours())}${pad(value.getMinutes())}${pad(value.getSeconds())}`;
}

/** Crea una carpeta hija nueva; nunca reutiliza ni mezcla una exportación previa. */
export async function createExportDestination(parent, { storeSlug, mode, now } = {}) {
  if (typeof parent !== "string" || !parent.trim() || !isAbsolute(parent)) {
    throw new Error("La carpeta padre de exportación no es válida.");
  }
  const suffix = mode === "production" ? "production" : "borrador";
  const baseName = `${safeFolderPart(storeSlug, "tienda")}-${suffix}-${exportDate(now)}`;
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const name = attempt === 0 ? baseName : `${baseName}-${attempt + 1}`;
    const destination = resolve(parent, name);
    try {
      await mkdir(destination);
      return destination;
    } catch (error) {
      if (error?.code !== "EEXIST") throw error;
    }
  }
  throw new Error("No se pudo crear una carpeta de exportación nueva.");
}

function normalizedExportPath(value) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error("La exportación contiene una ruta vacía.");
  }
  const normalized = value.replaceAll("\\", "/");
  const segments = normalized.split("/");
  if (
    normalized.startsWith("/") ||
    /^[A-Za-z]:\//.test(normalized) ||
    segments.some((segment) => !segment || segment === "." || segment === "..")
  ) {
    throw new Error(`La exportación contiene una ruta insegura: ${value}.`);
  }
  return segments;
}

function exportTarget(root, path) {
  const target = resolve(root, ...normalizedExportPath(path));
  const relativeTarget = relative(root, target);
  if (!relativeTarget || relativeTarget.startsWith("..") || isAbsolute(relativeTarget)) {
    throw new Error(`La exportación intenta salir de la carpeta elegida: ${path}.`);
  }
  return target;
}

function fileContents(data) {
  if (typeof data === "string") return data;
  if (data instanceof Uint8Array) return Buffer.from(data);
  if (data instanceof ArrayBuffer) return Buffer.from(new Uint8Array(data));
  throw new Error("La exportación contiene un archivo con datos inválidos.");
}

/** Escribe el resultado del exporter dentro de una carpeta elegida por el usuario. */
export async function writeExportFiles(root, files) {
  if (typeof root !== "string" || !root.trim()) {
    throw new Error("La carpeta de exportación no es válida.");
  }
  if (!Array.isArray(files) || files.length === 0) {
    throw new Error("La exportación no contiene archivos.");
  }
  const existing = await readdir(root).catch((error) => {
    if (error?.code === "ENOENT") return [];
    throw error;
  });
  if (existing.length > 0) {
    throw new Error(
      "La carpeta de exportación no está vacía; elegí la carpeta padre para crear una hija dedicada.",
    );
  }

  const targets = files.map((file) => {
    if (!file || typeof file !== "object") {
      throw new Error("La exportación contiene una entrada inválida.");
    }
    const target = exportTarget(root, file.path);
    return { target, content: fileContents(file.data) };
  });
  const targetKeys = new Set();
  for (const { target } of targets) {
    const key = target.toLowerCase();
    if (targetKeys.has(key)) throw new Error(`La exportación repite la ruta ${target}.`);
    targetKeys.add(key);
  }

  for (const { target, content } of targets) {
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, content);
  }
  return { filesWritten: targets.length };
}
