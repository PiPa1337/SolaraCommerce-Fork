/** Resolución y validación de las carpetas locales que pertenecen a SolaraCommerce. */

import { randomBytes } from "node:crypto";
import { lstat, mkdir, realpath, rename, writeFile } from "node:fs/promises";
import { isAbsolute, join, relative, resolve, sep } from "node:path";

export const LOCAL_INSTANCE_FORMAT = "solara-local-instance";
export const LOCAL_LAYOUT_VERSION = 1;

function inside(root, target) {
  const rootPath = resolve(root);
  const targetPath = resolve(target);
  const isWin = process.platform === "win32";
  const cmpRoot = isWin ? rootPath.toLowerCase() : rootPath;
  const cmpTarget = isWin ? targetPath.toLowerCase() : targetPath;
  if (cmpTarget !== cmpRoot && !cmpTarget.startsWith(`${cmpRoot}${sep.toLowerCase()}`)) {
    throw new Error("La ruta queda fuera de la instalación local.");
  }
  return targetPath;
}

/** Devuelve la estructura estable del checkout local, sin crear archivos. */
export function resolveLocalLayout({ applicationRoot = process.cwd() } = {}) {
  const resolvedApplicationRoot = resolve(applicationRoot);
  const runtimeRoot = join(resolvedApplicationRoot, ".solara-runtime");
  return Object.freeze({
    applicationRoot: resolvedApplicationRoot,
    projectsRoot: join(resolvedApplicationRoot, "proyectos"),
    runtimeRoot,
    logsRoot: join(runtimeRoot, "logs"),
    transactionRoot: join(runtimeRoot, "transactions"),
  });
}

/** Rechaza una ruta absoluta o una ruta relativa que escape de `root`. */
const WINDOWS_RESERVED_NAMES = new Set([
  "CON",
  "PRN",
  "AUX",
  "NUL",
  "COM1",
  "COM2",
  "COM3",
  "COM4",
  "COM5",
  "COM6",
  "COM7",
  "COM8",
  "COM9",
  "LPT1",
  "LPT2",
  "LPT3",
  "LPT4",
  "LPT5",
  "LPT6",
  "LPT7",
  "LPT8",
  "LPT9",
]);
function isReservedWindowsSegment(segment) {
  const base = segment.split(".")[0] ?? "";
  // NTFS ignora mayúsculas y recorta espacios/puntos finales: "CON ", "CON.", "CON.txt" son reservados
  const cleaned = base
    .trim()
    .replace(/[. ]+$/, "")
    .toUpperCase();
  return WINDOWS_RESERVED_NAMES.has(cleaned);
}
function assertNoReservedSegments(pathname) {
  const normalized = pathname.replaceAll("\\", "/");
  for (const segment of normalized.split("/")) {
    if (!segment) continue;
    if (isReservedWindowsSegment(segment)) {
      throw new Error("La ruta contiene un nombre reservado de Windows.");
    }
  }
}
export function resolveLocalPath(root, pathname) {
  if (typeof pathname !== "string" || pathname.length === 0 || isAbsolute(pathname)) {
    throw new Error("La ruta local debe ser relativa.");
  }
  const normalized = pathname.replaceAll("\\", "/");
  if (
    normalized.startsWith("/") ||
    /^[a-z]:\//i.test(normalized) ||
    normalized === ".." ||
    normalized.startsWith("../") ||
    normalized.includes("/../") ||
    normalized.endsWith("/..") ||
    normalized.includes("\0")
  ) {
    throw new Error("La ruta local contiene segmentos inseguros.");
  }
  assertNoReservedSegments(pathname);
  return inside(root, join(root, normalized));
}

/** Devuelve una ruta relativa y verifica que el destino esté dentro de root. */
export function relativeLocalPath(root, pathname) {
  const target = inside(root, pathname);
  const result = relative(resolve(root), target).replaceAll("\\", "/");
  if (!result || result.startsWith("../") || result === "..") {
    throw new Error("La ruta no pertenece a la instalación local.");
  }
  return result;
}

async function writeJsonAtomic(pathname, value) {
  const temporary = `${pathname}.tmp-${randomBytes(8).toString("hex")}`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  // Windows puede rechazar el rename con EPERM/EBUSY transitorio cuando dos
  // procesos locales escriben instance.json a la vez.
  const attempts = 4;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      await rename(temporary, pathname);
      return;
    } catch (error) {
      const transient = ["EPERM", "EBUSY", "EACCES"].includes(error?.code);
      if (attempt === attempts || !transient) throw error;
      await new Promise((resolveDelay) => setTimeout(resolveDelay, 200 * attempt));
    }
  }
}

/** Crea las carpetas regenerables y escribe `instance.json` de forma atómica. */
export async function ensureLocalLayout(layout, { appVersion = "0.1.0" } = {}) {
  await Promise.all([
    mkdir(layout.projectsRoot, { recursive: true }),
    mkdir(layout.runtimeRoot, { recursive: true }),
    mkdir(layout.logsRoot, { recursive: true }),
    mkdir(layout.transactionRoot, { recursive: true }),
  ]);
  await assertNoReparsePoints(layout.applicationRoot, layout.projectsRoot);
  await assertNoReparsePoints(layout.applicationRoot, layout.runtimeRoot);
  const instancePath = join(layout.runtimeRoot, "instance.json");
  const instance = {
    format: LOCAL_INSTANCE_FORMAT,
    version: 1,
    appVersion,
    layoutVersion: LOCAL_LAYOUT_VERSION,
  };
  await writeJsonAtomic(instancePath, instance);
  return { ...layout, instancePath };
}

/**
 * Revisa los componentes de una ruta existente. Los enlaces simbólicos y
 * reparse points no son aceptados porque podrían redirigir una escritura fuera
 * del checkout local.
 */
export async function assertNoReparsePoints(root, target = root) {
  const rootPath = resolve(root);
  const targetPath = inside(rootPath, target);
  const relativePath = relative(rootPath, targetPath);
  let canonicalRoot = rootPath;
  try {
    canonicalRoot = await realpath(rootPath);
  } catch {
    // El caller suele crear la raíz antes de auditarla; conservar la ruta
    // textual permite que el helper siga siendo útil durante una creación.
  }
  const normalizeFsPath = (pathname) => {
    const normalized = resolve(pathname).replace(/^\\\\\?\\/, "");
    return process.platform === "win32" ? normalized.toLowerCase() : normalized;
  };
  let current = rootPath;
  let expected = canonicalRoot;
  for (const segment of relativePath ? relativePath.split(sep) : []) {
    current = join(current, segment);
    expected = join(expected, segment);
    let info;
    try {
      info = await lstat(current);
    } catch {
      continue;
    }
    if (info.isSymbolicLink()) {
      throw new Error("La instalación local contiene un enlace simbólico no permitido.");
    }
    // Junctions en Windows no son symlinks pero son reparse points: detectar via realpath
    try {
      const real = await realpath(current);
      if (normalizeFsPath(real) !== normalizeFsPath(expected)) {
        throw new Error("La instalación local contiene un enlace simbólico no permitido.");
      }
    } catch (e) {
      if (e.message.includes("enlace simbólico")) throw e;
    }
  }
  return targetPath;
}
