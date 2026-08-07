/**
 * Servicio de filesystem para el modo launcher. Sólo opera dentro de
 * `proyectos/`, recibe streams, verifica hashes y publica staging con un
 * manifest atómico; no es una API remota ni debe exponerse fuera de loopback.
 */
import { createHash, randomBytes } from "node:crypto";
import {
  copyFile,
  lstat,
  mkdir,
  open,
  readdir,
  readFile,
  rename,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { dirname, join, relative, resolve, sep } from "node:path";
import {
  assertNoReparsePoints,
  resolvePortableLayout,
  resolvePortablePath,
} from "./portable-layout.mjs";

const MANIFEST_FORMAT = "solara-local-project";
const MANIFEST_VERSION = 2;
const DEFAULT_MAX_UPLOAD_BYTES = 1024 * 1024 * 1024;
const DEFAULT_MAX_EXTRACTED_BYTES = 4 * 1024 * 1024 * 1024;
const DEFAULT_MAX_FILES = 25_000;

function isSafeSegment(value) {
  return typeof value === "string" && /^[a-z0-9][a-z0-9_-]{0,95}$/i.test(value);
}

function safeSlug(value) {
  const normalized = String(value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
  return normalized || "tienda";
}

function shortProjectKey(projectId) {
  return createHash("sha256").update(projectId).digest("hex").slice(0, 8);
}

function timestampKey(date = new Date()) {
  return date.toISOString().replace(/[:.]/g, "-");
}

function versionKey(slug, date, version) {
  return `${safeSlug(slug)}-${timestampKey(date)}-v${String(version).padStart(6, "0")}`;
}

function assertProjectId(projectId) {
  if (!isSafeSegment(projectId)) throw new Error("ID de tienda inválido.");
}

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

function assertInside(root, target) {
  const resolvedRoot = resolve(root);
  const resolvedTarget = resolve(target);
  if (resolvedTarget !== resolvedRoot && !resolvedTarget.startsWith(`${resolvedRoot}${sep}`)) {
    throw new Error("La ruta queda fuera del almacenamiento local.");
  }
  return resolvedTarget;
}

function manifestPath(root, pathname) {
  return assertInside(root, join(root, assertRelativeArchivePath(pathname)));
}

async function readJson(pathname) {
  return JSON.parse(await readFile(pathname, "utf8"));
}

async function writeJsonAtomic(pathname, value) {
  const temporary = `${pathname}.tmp-${randomBytes(8).toString("hex")}`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  await rename(temporary, pathname);
}

async function streamToFile(request, pathname, maxBytes) {
  const temporary = `${pathname}.upload-${randomBytes(8).toString("hex")}`;
  await mkdir(dirname(pathname), { recursive: true });
  const handle = await open(temporary, "w");
  const hash = createHash("sha256");
  let bytes = 0;
  try {
    for await (const chunk of request) {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      bytes += buffer.byteLength;
      if (bytes > maxBytes) throw new Error("El archivo supera el límite permitido.");
      hash.update(buffer);
      await handle.write(buffer);
    }
    await handle.sync();
  } finally {
    await handle.close();
  }
  await rename(temporary, pathname);
  return { bytes, sha256: hash.digest("hex") };
}

function parseProjectJson(bytes, expectedProjectId) {
  let envelope;
  try {
    envelope = JSON.parse(bytes.toString("utf8"));
  } catch {
    throw new Error("El respaldo de la tienda está corrupto o no es JSON válido.");
  }
  const project = envelope?.project;
  if (envelope?.format !== "solara-project" || envelope?.version !== 2 || !project) {
    throw new Error("El respaldo no pertenece al formato de proyecto actual.");
  }
  if (project.schemaVersion !== 2 || project.id !== expectedProjectId) {
    throw new Error("El respaldo no coincide con la tienda que se está guardando.");
  }
  return project;
}

async function writeSiteFiles(siteMapPath, destination, limits) {
  let entries;
  try {
    entries = JSON.parse(await readFile(siteMapPath, "utf8"));
  } catch {
    throw new Error("El mapa del sitio está corrupto o no es JSON válido.");
  }
  if (!Array.isArray(entries)) throw new Error("El mapa del sitio debe ser una lista.");
  if (entries.length > limits.maxFiles) throw new Error("El sitio contiene demasiados archivos.");
  let totalBytes = 0;
  let hasIndex = false;
  const prepared = [];
  for (const entry of entries) {
    if (
      typeof entry?.path !== "string" ||
      (entry.encoding !== "utf8" && entry.encoding !== "base64")
    ) {
      throw new Error("El mapa del sitio contiene entradas inválidas.");
    }
    const pathname = assertRelativeArchivePath(entry.path);
    const output = assertInside(destination, join(destination, pathname));
    const payload = Buffer.from(entry.data ?? "", entry.encoding);
    if (payload.byteLength > limits.maxFileBytes) {
      throw new Error("El contenido descomprimido supera el límite permitido.");
    }
    totalBytes += payload.byteLength;
    if (totalBytes > limits.maxExtractedBytes) {
      throw new Error("El contenido descomprimido supera el límite permitido.");
    }
    if (pathname === "index.html") hasIndex = true;
    prepared.push({ output, payload });
  }
  await mkdir(destination, { recursive: true });
  for (const { output, payload } of prepared) {
    await mkdir(dirname(output), { recursive: true });
    await writeFile(output, payload);
  }
  if (!hasIndex) throw new Error("La exportación del sitio no contiene index.html.");
  return { files: prepared.length, bytes: totalBytes };
}

async function directoryExists(pathname) {
  try {
    return (await lstat(pathname)).isDirectory();
  } catch {
    return false;
  }
}

async function fileExists(pathname) {
  try {
    return (await lstat(pathname)).isFile();
  } catch {
    return false;
  }
}

export function createLocalProjectStorage(options = {}) {
  const defaultLayout = resolvePortableLayout({
    mode: "development",
    cwd: options.applicationRoot ?? process.cwd(),
  });
  const applicationRoot = resolve(options.applicationRoot ?? defaultLayout.portableRoot);
  const projectsRoot = resolve(options.projectsRoot ?? defaultLayout.projectsRoot);
  const stagingRoot = resolve(options.stagingRoot ?? defaultLayout.transactionRoot);
  const maxUploadBytes = options.maxUploadBytes ?? DEFAULT_MAX_UPLOAD_BYTES;
  const maxExtractedBytes = options.maxExtractedBytes ?? DEFAULT_MAX_EXTRACTED_BYTES;
  const maxFileBytes = options.maxFileBytes ?? DEFAULT_MAX_EXTRACTED_BYTES;
  const maxFiles = options.maxFiles ?? DEFAULT_MAX_FILES;
  // Sólo los tests inyectan fallos deterministas. Mantener el hook fuera del
  // handler HTTP permite comprobar que una interrupción no reemplaza el
  // manifest anterior sin agregar una ruta de producción ni una dependencia.
  const faultInjector =
    typeof options.faultInjector === "function" ? options.faultInjector : undefined;
  const checkpoint = async (stage) => {
    await faultInjector?.(stage);
  };
  const transactions = new Map();
  const projectLocks = new Set();

  async function ensureRoots() {
    await mkdir(projectsRoot, { recursive: true });
    await mkdir(stagingRoot, { recursive: true });
    const { runLegacyZipMigration } = await import("./legacy-zip-migration.mjs");
    await runLegacyZipMigration({
      applicationRoot,
      projectsRoot,
      migrationStatePath: join(stagingRoot, "..", "migration.json"),
    });
    await assertNoReparsePoints(applicationRoot, projectsRoot);
    await assertNoReparsePoints(applicationRoot, stagingRoot);
  }

  async function findManifest(projectId) {
    assertProjectId(projectId);
    await ensureRoots();
    const entries = await readdir(projectsRoot, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const manifestPath = join(projectsRoot, entry.name, "manifest.json");
      try {
        await assertNoReparsePoints(projectsRoot, join(projectsRoot, entry.name));
        const manifest = await readJson(manifestPath);
        if (manifest.format === MANIFEST_FORMAT && manifest.projectId === projectId) {
          return {
            manifest,
            folder: entry.name,
            root: join(projectsRoot, entry.name),
            manifestPath,
          };
        }
      } catch {
        // Unreadable folders are reported separately by list().
      }
    }
    return undefined;
  }

  async function list() {
    await ensureRoots();
    const entries = await readdir(projectsRoot, { withFileTypes: true });
    const projects = [];
    const recovery = [];
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const root = join(projectsRoot, entry.name);
      try {
        await assertNoReparsePoints(projectsRoot, root);
        const manifest = await readJson(join(root, "manifest.json"));
        if (manifest.format !== MANIFEST_FORMAT || manifest.manifestVersion !== MANIFEST_VERSION) {
          throw new Error("Manifest local incompatible.");
        }
        const currentPath = manifestPath(root, manifest.current.projectPath);
        if (!(await fileExists(currentPath))) throw new Error("No existe la versión actual.");
        if (manifest.lastValidSite?.directoryPath) {
          // Los manifests se pueden copiar entre equipos, por eso sólo se
          // aceptan rutas relativas a la raíz de la instalación portable.
          resolvePortablePath(applicationRoot, manifest.lastValidSite.directoryPath);
        }
        projects.push({
          projectId: manifest.projectId,
          name: manifest.storeName,
          slug: manifest.slug,
          status: manifest.status,
          updatedAt: manifest.current.projectUpdatedAt,
          savedAt: manifest.current.savedAt,
          version: manifest.current.version,
          folder: entry.name,
          siteVersion: manifest.lastValidSite?.version ?? null,
          siteOutdated: manifest.status === "site-outdated",
        });
      } catch (error) {
        recovery.push({
          folder: entry.name,
          message: error instanceof Error ? error.message : "No se pudo leer el manifest local.",
        });
      }
    }
    projects.sort((left, right) => right.savedAt.localeCompare(left.savedAt));
    return { projects, recovery };
  }

  async function status() {
    await ensureRoots();
    let writable = true;
    try {
      const probe = join(projectsRoot, `.write-probe-${process.pid}`);
      await writeFile(probe, "ok", "utf8");
      await rm(probe, { force: true });
    } catch {
      writable = false;
    }
    return {
      managed: true,
      writable,
      projectsRoot,
      transactionRoot: stagingRoot,
    };
  }

  async function beginSave(meta) {
    await ensureRoots();
    assertProjectId(meta.projectId);
    if (projectLocks.has(meta.projectId)) {
      const error = new Error("Ya hay un guardado en curso para esta tienda.");
      error.code = "VERSION_CONFLICT";
      throw error;
    }
    if (typeof meta.slug !== "string" || meta.slug !== safeSlug(meta.slug)) {
      throw new Error("Slug de tienda inválido.");
    }
    if (!Number.isInteger(meta.expectedVersion) && meta.expectedVersion !== null) {
      throw new Error("Versión esperada inválida.");
    }
    const existing = await findManifest(meta.projectId);
    const currentVersion = existing?.manifest.current?.version ?? 0;
    if (existing && meta.expectedVersion !== currentVersion) {
      const error = new Error("La tienda cambió en otra pestaña.");
      error.code = "VERSION_CONFLICT";
      throw error;
    }
    if (!existing && meta.expectedVersion !== null && meta.expectedVersion !== 0) {
      const error = new Error("La tienda ya no existe en disco.");
      error.code = "VERSION_CONFLICT";
      throw error;
    }
    const transactionId = randomBytes(18).toString("hex");
    const transactionRoot = join(stagingRoot, transactionId);
    await mkdir(transactionRoot, { recursive: true });
    const transaction = {
      id: transactionId,
      createdAt: new Date().toISOString(),
      metadata: {
        ...meta,
        version: currentVersion + 1,
        folder: existing?.folder ?? `${safeSlug(meta.slug)}--${shortProjectKey(meta.projectId)}`,
        previous: existing?.manifest ?? null,
      },
      root: transactionRoot,
      project: undefined,
      site: undefined,
    };
    projectLocks.add(meta.projectId);
    transactions.set(transactionId, transaction);
    await writeJsonAtomic(join(transactionRoot, "transaction.json"), transaction.metadata);
    return {
      transactionId,
      version: transaction.metadata.version,
      folder: transaction.metadata.folder,
    };
  }

  async function getTransaction(transactionId) {
    const transaction = transactions.get(transactionId);
    if (!transaction) throw new Error("La transacción de guardado no existe o expiró.");
    return transaction;
  }

  async function upload(transactionId, kind, request) {
    const transaction = await getTransaction(transactionId);
    if (kind !== "project" && kind !== "site") throw new Error("Tipo de archivo inválido.");
    const filename = kind === "project" ? "project.json" : "site-map.json";
    const pathname = join(transaction.root, filename);
    const result = await streamToFile(request, pathname, maxUploadBytes);
    const expectedHash = request.headers?.["x-solara-sha256"];
    if (typeof expectedHash === "string" && expectedHash !== result.sha256) {
      await rm(pathname, { force: true });
      throw new Error("El hash recibido no coincide con el archivo subido.");
    }
    transaction[kind] = result;
    return result;
  }

  async function commit(transactionId) {
    const transaction = await getTransaction(transactionId);
    if (!transaction.project) throw new Error("Falta el respaldo editable de la tienda.");
    const { metadata } = transaction;
    const project = parseProjectJson(
      await readFile(join(transaction.root, "project.json")),
      metadata.projectId,
    );
    const storeRoot = join(projectsRoot, metadata.folder);
    const actualRoot = join(storeRoot, "actual");
    const backupsRoot = join(storeRoot, "respaldos");
    const manualBackupsRoot = join(storeRoot, "respaldos-manuales");
    const sitesRoot = join(storeRoot, "sitios");
    await checkpoint("before-publish-preparation");
    await Promise.all([
      mkdir(actualRoot, { recursive: true }),
      mkdir(backupsRoot, { recursive: true }),
      mkdir(manualBackupsRoot, { recursive: true }),
      mkdir(sitesRoot, { recursive: true }),
    ]);
    await assertNoReparsePoints(projectsRoot, storeRoot);
    const savedAt = new Date();
    const key = versionKey(metadata.slug, savedAt, metadata.version);
    const archiveName = `${key}.solara.json`;
    const archivePath = join(actualRoot, archiveName);
    const temporaryArchivePath = join(actualRoot, `.${archiveName}.${transaction.id}.tmp`);

    let siteInfo;
    if (transaction.site) {
      const temporarySite = join(sitesRoot, `.${key}.${transaction.id}.tmp`);
      const finalSite = join(sitesRoot, key);
      await rm(temporarySite, { recursive: true, force: true });
      try {
        await checkpoint("before-site-extract");
        siteInfo = await writeSiteFiles(join(transaction.root, "site-map.json"), temporarySite, {
          maxFiles,
          maxExtractedBytes,
          maxFileBytes,
        });
        await checkpoint("before-site-rename");
        await rename(temporarySite, finalSite);
      } catch (error) {
        await rm(temporarySite, { recursive: true, force: true });
        throw error;
      }
      siteInfo = {
        ...siteInfo,
        version: metadata.version,
        key,
        directoryPath: relative(applicationRoot, finalSite).replaceAll("\\", "/"),
        sha256: transaction.site.sha256,
        savedAt: savedAt.toISOString(),
      };
    }

    // Se publica el respaldo editable sólo después de validar el sitio opcional.
    // Así un mapa inválido no deja archivos huérfanos en `actual/`.
    await checkpoint("before-project-archive");
    await copyFile(join(transaction.root, "project.json"), temporaryArchivePath);
    await rename(temporaryArchivePath, archivePath);

    const previous = metadata.previous;
    if (previous?.current?.projectPath) {
      const oldCurrent = manifestPath(storeRoot, previous.current.projectPath);
      if ((await fileExists(oldCurrent)) && oldCurrent !== archivePath) {
        const oldBackup = join(backupsRoot, oldCurrent.split(sep).at(-1));
        if (!(await fileExists(oldBackup))) await copyFile(oldCurrent, oldBackup);
      }
    }

    const lastValidSite = siteInfo ?? previous?.lastValidSite;
    const manifest = {
      format: MANIFEST_FORMAT,
      manifestVersion: MANIFEST_VERSION,
      projectId: metadata.projectId,
      storeName: project.name,
      slug: project.slug,
      schemaVersion: project.schemaVersion,
      status: siteInfo ? "synced" : "site-outdated",
      current: {
        version: metadata.version,
        key,
        projectPath: join("actual", archiveName).replaceAll("\\", "/"),
        sha256: transaction.project.sha256,
        savedAt: savedAt.toISOString(),
        projectUpdatedAt: project.updatedAt,
      },
      ...(lastValidSite ? { lastValidSite } : {}),
    };
    await checkpoint("before-manifest");
    await writeJsonAtomic(join(storeRoot, "manifest.json"), manifest);
    if (previous?.current?.projectPath) {
      const oldCurrent = manifestPath(storeRoot, previous.current.projectPath);
      if ((await fileExists(oldCurrent)) && oldCurrent !== archivePath) {
        await rm(oldCurrent, { force: true });
      }
    }
    await transactions.delete(transactionId);
    projectLocks.delete(metadata.projectId);
    await rm(transaction.root, { recursive: true, force: true });
    return {
      projectId: manifest.projectId,
      version: manifest.current.version,
      key: manifest.current.key,
      status: manifest.status,
      folder: metadata.folder,
      projectPath: manifest.current.projectPath,
      site: manifest.lastValidSite ?? null,
    };
  }

  async function readCurrent(projectId) {
    const found = await findManifest(projectId);
    if (!found) return undefined;
    const path = manifestPath(found.root, found.manifest.current.projectPath);
    const bytes = await readFile(path);
    const actualHash = createHash("sha256").update(bytes).digest("hex");
    if (actualHash !== found.manifest.current.sha256) {
      throw new Error("El respaldo actual no coincide con su hash. Recuperá una versión anterior.");
    }
    return { manifest: found.manifest, bytes };
  }

  async function getLastValidSiteDirectory(projectId) {
    const found = await findManifest(projectId);
    if (!found || !found.manifest.lastValidSite?.directoryPath) return undefined;
    const directory = assertInside(
      applicationRoot,
      resolvePortablePath(applicationRoot, found.manifest.lastValidSite.directoryPath),
    );
    if (!(await directoryExists(directory))) return undefined;
    await assertNoReparsePoints(applicationRoot, directory);
    return directory;
  }

  async function manualBackup(projectId) {
    const found = await findManifest(projectId);
    if (!found) throw new Error("La tienda no existe en disco.");
    const source = manifestPath(found.root, found.manifest.current.projectPath);
    const target = join(
      found.root,
      "respaldos-manuales",
      `${found.manifest.current.key}-manual-${timestampKey()}-${randomBytes(4).toString("hex")}.solara.json`,
    );
    await mkdir(join(found.root, "respaldos-manuales"), { recursive: true });
    await copyFile(source, target);
    return { path: relative(applicationRoot, target), version: found.manifest.current.version };
  }

  async function abort(transactionId) {
    const transaction = transactions.get(transactionId);
    if (!transaction) return;
    transactions.delete(transactionId);
    projectLocks.delete(transaction.metadata.projectId);
    await rm(transaction.root, { recursive: true, force: true });
  }

  async function cleanupStaging(maxAgeMs = 24 * 60 * 60 * 1000) {
    await ensureRoots();
    const entries = await readdir(stagingRoot, { withFileTypes: true });
    const threshold = Date.now() - maxAgeMs;
    await Promise.all(
      entries
        .filter((entry) => entry.isDirectory())
        .map(async (entry) => {
          const pathname = join(stagingRoot, entry.name);
          try {
            if ((await stat(pathname)).mtimeMs < threshold)
              await rm(pathname, { recursive: true, force: true });
          } catch {
            // Otro proceso puede estar finalizando la transacción.
          }
        }),
    );
  }

  return {
    applicationRoot,
    projectsRoot,
    ensureRoots,
    status,
    list,
    beginSave,
    upload,
    commit,
    readCurrent,
    getLastValidSiteDirectory,
    manualBackup,
    abort,
    cleanupStaging,
  };
}
