/**
 * Resolución única de las carpetas que pertenecen a una instalación Solara.
 *
 * El renderer nunca entrega rutas a este módulo: el proceso local determina la
 * raíz a partir del checkout (desarrollo) o del ejecutable (portable). Mantener
 * esta decisión en un único lugar evita que una copia de la aplicación termine
 * leyendo el perfil, proyectos o staging de otra copia.
 */

import { randomBytes } from "node:crypto";
import { lstat, mkdir, realpath, rename, stat, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";

export const PORTABLE_INSTANCE_FORMAT = "solara-portable-instance";
export const PORTABLE_LAYOUT_VERSION = 1;

function inside(root, target) {
  const rootPath = resolve(root);
  const targetPath = resolve(target);
  const isWin = process.platform === "win32";
  const cmpRoot = isWin ? rootPath.toLowerCase() : rootPath;
  const cmpTarget = isWin ? targetPath.toLowerCase() : targetPath;
  if (cmpTarget !== cmpRoot && !cmpTarget.startsWith(`${cmpRoot}${sep.toLowerCase()}`)) {
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
  assertNoReservedSegments(pathname);
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
  // Windows puede rechazar el rename con EPERM/EBUSY transitorio cuando dos
  // launches concurrentes escriben instance.json (test adversarial 13). El
  // reintento con backoff absorbe el lock; mismo patrón que local-project-storage.
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

/**
 * Detecta si la raíz portable es nueva para esta instalación: si
 * `instance.json` no existe todavía, la aplicación arranca por primera vez en
 * esta carpeta. Útil para avisar cuando el ejecutable se movió de lugar y sus
 * tiendas quedaron en la ubicación anterior.
 */
export async function detectPortableFirstRun(_portableRoot, instancePath) {
  let instanceExists = false;
  let previousRoot = null;
  try {
    const info = await lstat(instancePath);
    instanceExists = info.isFile();
    if (instanceExists) {
      try {
        const raw = JSON.parse(
          await import("node:fs/promises").then((m) => m.readFile(instancePath, "utf8")),
        );
        if (raw && typeof raw.portableRoot === "string") previousRoot = raw.portableRoot;
      } catch {
        // Un archivo existente pero corrupto no es un primer arranque; ensurePortableLayout lo regenera.
      }
    }
  } catch {
    instanceExists = false;
  }
  return { firstRun: !instanceExists, instanceExists, previousRoot };
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
    portableRoot: layout.portableRoot,
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
    let info;
    try {
      info = await lstat(current);
    } catch {
      continue;
    }
    if (info.isSymbolicLink()) {
      throw new Error("La instalación contiene un enlace simbólico no permitido.");
    }
    // Junctions en Windows no son symlinks pero son reparse points: detectar via realpath
    try {
      const real = await realpath(current);
      if (resolve(real) !== resolve(current)) {
        throw new Error("La instalación contiene un enlace simbólico no permitido.");
      }
      // También comparar stat vs lstat para detectar reparse (ino diferente)
      const st = await stat(current);
      if (info.ino !== st.ino || info.dev !== st.dev) {
        throw new Error("La instalación contiene un enlace simbólico no permitido.");
      }
    } catch (e) {
      if (e.message.includes("enlace simbólico")) throw e;
    }
  }
  return targetPath;
}
