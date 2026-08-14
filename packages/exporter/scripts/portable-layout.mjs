/**
 * Resolución única de las carpetas que pertenecen a una instalación Solara.
 *
 * El renderer nunca entrega rutas a este módulo: el proceso local determina la
 * raíz a partir del checkout (desarrollo) o del ejecutable (portable). Mantener
 * esta decisión en un único lugar evita que una copia de la aplicación termine
 * leyendo el perfil, proyectos o staging de otra copia.
 */

import { randomBytes } from "node:crypto";
import { lstat, mkdir, rename, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";

export const PORTABLE_INSTANCE_FORMAT = "solara-portable-instance";
export const PORTABLE_LAYOUT_VERSION = 1;

function inside(root, target) {
  const rootPath = resolve(root);
  const targetPath = resolve(target);
  if (targetPath !== rootPath && !targetPath.startsWith(`${rootPath}${sep}`)) {
    throw new Error("La ruta queda fuera de la instalación portable.");
  }
  return targetPath;
}

/**
 * Devuelve la estructura estable de una instalación, sin crear archivos.
 * `cwd` sólo se utiliza en desarrollo; una distribución empaquetada siempre
 * queda anclada al directorio que contiene el ejecutable.
 */
export function resolvePortableLayout({
  mode = "development",
  cwd = process.cwd(),
  executablePath = process.execPath,
} = {}) {
  const portableRoot = resolve(mode === "packaged" ? dirname(executablePath) : cwd);
  const runtimeRoot = join(portableRoot, ".solara-runtime");
  return Object.freeze({
    portableRoot,
    projectsRoot: join(portableRoot, "proyectos"),
    runtimeRoot,
    profileRoot: join(runtimeRoot, "electron-user-data"),
    logsRoot: join(runtimeRoot, "logs"),
    transactionRoot: join(runtimeRoot, "transactions"),
    resourcesRoot: join(portableRoot, "resources"),
  });
}

/** Rechaza una ruta absoluta o una ruta relativa que escape de `root`. */
export function resolvePortablePath(root, pathname) {
  if (typeof pathname !== "string" || pathname.length === 0 || isAbsolute(pathname)) {
    throw new Error("La ruta portable debe ser relativa.");
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
    throw new Error("La ruta portable contiene segmentos inseguros.");
  }
  return inside(root, join(root, normalized));
}

/** Devuelve una ruta relativa portable y verifica que el destino esté dentro de root. */
export function relativePortablePath(root, pathname) {
  const target = inside(root, pathname);
  const result = relative(resolve(root), target).replaceAll("\\", "/");
  if (!result || result.startsWith("../") || result === "..") {
    throw new Error("La ruta no pertenece a la instalación portable.");
  }
  return result;
}

async function writeJsonAtomic(pathname, value) {
  const temporary = `${pathname}.tmp-${randomBytes(8).toString("hex")}`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  await rename(temporary, pathname);
}

/**
 * Detecta si la raíz portable es nueva para esta instalación: si
 * `instance.json` no existe todavía, la aplicación arranca por primera vez en
 * esta carpeta. Útil para avisar cuando el ejecutable se movió de lugar y sus
 * tiendas quedaron en la ubicación anterior.
 */
export async function detectPortableFirstRun(portableRoot, instancePath) {
  let instanceExists = false;
  try {
    const info = await lstat(instancePath);
    instanceExists = info.isFile();
  } catch {
    instanceExists = false;
  }
  return { firstRun: !instanceExists, instanceExists };
}

/**
 * Crea las carpetas regenerables y escribe `instance.json` de forma atómica.
 * El archivo no contiene rutas ni identificadores de la máquina.
 */
export async function ensurePortableLayout(layout, { appVersion = "0.1.0" } = {}) {
  await Promise.all([
    mkdir(layout.projectsRoot, { recursive: true }),
    mkdir(layout.profileRoot, { recursive: true }),
    mkdir(layout.logsRoot, { recursive: true }),
    mkdir(layout.transactionRoot, { recursive: true }),
    mkdir(layout.resourcesRoot, { recursive: true }),
  ]);
  await assertNoReparsePoints(layout.portableRoot, layout.projectsRoot);
  await assertNoReparsePoints(layout.portableRoot, layout.runtimeRoot);
  const instancePath = join(layout.runtimeRoot, "instance.json");
  const instance = {
    format: PORTABLE_INSTANCE_FORMAT,
    version: 1,
    appVersion,
    layoutVersion: PORTABLE_LAYOUT_VERSION,
  };
  await writeJsonAtomic(instancePath, instance);
  return { ...layout, instancePath };
}

/**
 * Revisa los componentes de una ruta existente. Los enlaces simbólicos y
 * reparse points no son aceptados en una distribución portable porque podrían
 * redirigir una escritura fuera de la carpeta copiada.
 */
export async function assertNoReparsePoints(root, target = root) {
  const rootPath = resolve(root);
  const targetPath = inside(rootPath, target);
  const relativePath = relative(rootPath, targetPath);
  let current = rootPath;
  for (const segment of relativePath ? relativePath.split(sep) : []) {
    current = join(current, segment);
    const info = await lstat(current);
    if (info.isSymbolicLink())
      throw new Error("La instalación contiene un enlace simbólico no permitido.");
  }
  return targetPath;
}
