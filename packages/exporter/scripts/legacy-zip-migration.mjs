/**
 * Conversión única de tiendas guardadas como .solara.zip (manifest V1) al
 * formato JSON .solara.json (manifest V2). Único módulo del repositorio que
 * lee ZIP: tras un release se elimina junto con fflate.
 */
import { randomBytes } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { strFromU8, unzipSync } from "fflate";

const STATE_FORMAT = "solara-migration";
const STATE_VERSION = 1;

function assertRelativeArchivePath(pathname) {
  if (typeof pathname !== "string" || pathname.length === 0 || pathname.length > 240) {
    throw new Error("Ruta de archivo inválida.");
  }
  const normalized = pathname.replaceAll("\\", "/");
  if (
    normalized.startsWith("/") ||
    /^[a-z]:\//i.test(normalized) ||
    normalized.includes("../") ||
    normalized.includes("/..")
  ) {
    throw new Error("El archivo contiene una ruta insegura.");
  }
  if (normalized.includes("\0")) throw new Error("El archivo contiene un byte inválido.");
  return normalized;
}

async function readJson(pathname, fallback) {
  try {
    return JSON.parse(await readFile(pathname, "utf8"));
  } catch {
    return fallback;
  }
}

async function writeJsonAtomic(pathname, value) {
  const temporary = `${pathname}.tmp-${randomBytes(8).toString("hex")}`;
  await mkdir(dirname(pathname), { recursive: true });
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  await rename(temporary, pathname);
}

export async function runLegacyZipMigration({
  applicationRoot: _applicationRoot,
  projectsRoot,
  migrationStatePath,
}) {
  const state = await readJson(migrationStatePath, {});
  if (state.format === STATE_FORMAT && state.version === STATE_VERSION) {
    return { converted: [], failed: [] };
  }
  const converted = [];
  const failed = [];
  const { readdir } = await import("node:fs/promises");
  let entries = [];
  let scanFailed = false;
  try {
    entries = await readdir(projectsRoot, { withFileTypes: true });
  } catch {
    scanFailed = true;
    entries = [];
  }
  if (scanFailed) return { converted, failed };
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const storeRoot = join(projectsRoot, entry.name);
    try {
      const manifest = await readJson(join(storeRoot, "manifest.json"), undefined);
      if (!manifest || manifest.manifestVersion !== 1) continue;
      const archivePath = manifest.current?.archivePath;
      if (typeof archivePath !== "string" || !archivePath.endsWith(".solara.zip")) continue;
      const normalizedArchivePath = assertRelativeArchivePath(archivePath);
      const sourcePath = join(storeRoot, ...normalizedArchivePath.split("/"));
      const zip = unzipSync(await readFile(sourcePath));
      const projectBytes = zip["project.json"];
      const manifestBytes = zip["manifest.json"];
      if (!projectBytes || !manifestBytes) throw new Error("Faltan manifest.json o project.json.");
      const inner = JSON.parse(strFromU8(manifestBytes));
      const project = JSON.parse(strFromU8(projectBytes));
      if (inner.format !== "solara-project" || inner.version !== 2 || project.schemaVersion !== 2) {
        throw new Error("El respaldo no es un proyecto solara v2.");
      }
      if (project.id !== manifest.projectId)
        throw new Error("El proyecto no coincide con la tienda.");
      const key = manifest.current.key;
      if (typeof key !== "string" || !/^[a-z0-9][a-z0-9_-]{0,95}$/i.test(key)) {
        throw new Error("Clave de versión inválida.");
      }
      const jsonName = `${key}.solara.json`;
      const jsonText = `${JSON.stringify(
        {
          format: "solara-project",
          version: 2,
          projectId: manifest.projectId,
          exportedAt: manifest.current.savedAt,
          project,
        },
        null,
        2,
      )}\n`;
      const { createHash } = await import("node:crypto");
      const sha256 = createHash("sha256").update(jsonText).digest("hex");
      await mkdir(join(storeRoot, "actual"), { recursive: true });
      await writeFile(join(storeRoot, "actual", jsonName), jsonText, "utf8");
      await mkdir(join(storeRoot, "respaldos"), { recursive: true });
      const backupPath = join(storeRoot, "respaldos", normalizedArchivePath.split("/").pop());
      const { copyFile } = await import("node:fs/promises");
      try {
        await copyFile(sourcePath, backupPath);
      } catch {
        // El respaldo ya existe; se conserva el original en su lugar.
      }
      await writeJsonAtomic(join(storeRoot, "manifest.json"), {
        ...manifest,
        manifestVersion: 2,
        current: {
          ...manifest.current,
          projectPath: join("actual", jsonName).replaceAll("\\", "/"),
          sha256,
        },
      });
      converted.push(manifest.projectId);
    } catch {
      failed.push(entry.name);
    }
  }
  await writeJsonAtomic(migrationStatePath, {
    format: STATE_FORMAT,
    version: STATE_VERSION,
    convertedAt: new Date().toISOString(),
    projectIds: converted,
    failed,
  });
  return { converted, failed };
}
