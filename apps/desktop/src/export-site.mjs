import { mkdir, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve } from "node:path";

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
