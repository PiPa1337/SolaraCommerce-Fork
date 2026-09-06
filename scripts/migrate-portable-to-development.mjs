#!/usr/bin/env node

import { createHash } from "node:crypto";
import {
  access,
  cp,
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rename,
  rm,
  stat,
  statfs,
  writeFile,
} from "node:fs/promises";
import { createReadStream } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, isAbsolute, join, parse, relative, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseJsonBytesChunked } from "../packages/exporter/src/json-stream.mjs";

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const REPO_ROOT = resolve(dirname(SCRIPT_PATH), "..");
const PORTABLE_ROOT = join(REPO_ROOT, ".release", "portable", "SolaraCommerce-Portable");
const PORTABLE_PROJECTS = join(PORTABLE_ROOT, "proyectos");
const PORTABLE_RUNTIME = join(PORTABLE_ROOT, ".solara-runtime");
const NORMAL_PROJECTS = join(REPO_ROOT, "proyectos");
const NORMAL_RUNTIME = join(REPO_ROOT, ".solara-runtime");
const TEMPORAL_STYLO = join(REPO_ROOT, "temporalstylolashes");
const TEMPORAL_STYLO_ARCHIVE = join(TEMPORAL_STYLO, "stylo-lashes.solara.json");

const MANIFEST_FORMAT = "solara-local-project";
const MANIFEST_VERSION = 2;
const PROJECT_FORMAT = "solara-project";
const PROJECT_VERSION = 2;
const GIB = 1024 ** 3;
const DEFAULT_COMPRESSION_RATIO = 0.75;
const DEFAULT_MIN_MARGIN_BYTES = 2 * GIB;

let schemaModulePromise;

function formatBytes(bytes) {
  if (!Number.isFinite(bytes)) return "n/a";
  const units = ["B", "KiB", "MiB", "GiB", "TiB"];
  let value = bytes;
  let index = 0;
  while (value >= 1024 && index < units.length - 1) {
    value /= 1024;
    index += 1;
  }
  return `${value.toFixed(index === 0 ? 0 : 2)} ${units[index]}`;
}

function issue(severity, code, message, details = {}) {
  return { severity, code, message, ...details };
}

export function parseJsonTextAllowBom(text) {
  return JSON.parse(text.replace(/^\uFEFF/, ""));
}

function normalizeTranspiledRelativeImports(source) {
  const appendJs = (specifier) => {
    if (!specifier.startsWith("./") && !specifier.startsWith("../")) return specifier;
    if (/\.(?:[cm]?js|json|node|wasm)$/i.test(specifier)) return specifier;
    return `${specifier}.js`;
  };
  return source
    .replace(/(from\s+["'])(\.\.?\/[^"']+)(["'])/g, (_, prefix, specifier, suffix) => `${prefix}${appendJs(specifier)}${suffix}`)
    .replace(/(import\s+["'])(\.\.?\/[^"']+)(["'])/g, (_, prefix, specifier, suffix) => `${prefix}${appendJs(specifier)}${suffix}`)
    .replace(/(import\(\s*["'])(\.\.?\/[^"']+)(["']\s*\))/g, (_, prefix, specifier, suffix) => `${prefix}${appendJs(specifier)}${suffix}`);
}

function normalizeRelativePath(pathname) {
  if (typeof pathname !== "string" || pathname.length === 0 || pathname.length > 240) {
    throw new Error("Ruta relativa inválida.");
  }
  const normalized = pathname.replaceAll("\\", "/");
  if (
    normalized.startsWith("/") ||
    /^[a-z]:\//i.test(normalized) ||
    normalized.split("/").some((segment) => segment === "..") ||
    normalized.includes("\0")
  ) {
    throw new Error(`Ruta insegura: ${pathname}`);
  }
  return normalized;
}

function assertInside(root, target) {
  const resolvedRoot = resolve(root);
  const resolvedTarget = resolve(target);
  const caseFold = process.platform === "win32";
  const comparableRoot = caseFold ? resolvedRoot.toLowerCase() : resolvedRoot;
  const comparableTarget = caseFold ? resolvedTarget.toLowerCase() : resolvedTarget;
  const boundary = `${comparableRoot}${sep}`;
  if (comparableTarget !== comparableRoot && !comparableTarget.startsWith(boundary)) {
    throw new Error(`La ruta queda fuera de ${resolvedRoot}: ${resolvedTarget}`);
  }
  return resolvedTarget;
}

async function exists(pathname) {
  try {
    await access(pathname);
    return true;
  } catch {
    return false;
  }
}

export async function sha256File(pathname) {
  return await new Promise((resolveHash, rejectHash) => {
    const hash = createHash("sha256");
    const stream = createReadStream(pathname);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("error", rejectHash);
    stream.on("end", () => resolveHash(hash.digest("hex")));
  });
}

export async function inventoryTree(root, options = {}) {
  const hashFiles = options.hashFiles === true;
  const rejectLinks = options.rejectLinks !== false;
  const rootExists = await exists(root);
  if (!rootExists) {
    return { root, exists: false, files: [], fileCount: 0, bytes: 0, issues: [] };
  }

  const files = [];
  const issues = [];
  let bytes = 0;

  async function visit(directory) {
    const entries = await readdir(directory, { withFileTypes: true });
    entries.sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of entries) {
      const pathname = join(directory, entry.name);
      const rel = relative(root, pathname).replaceAll("\\", "/");
      if (entry.isSymbolicLink()) {
        const linkIssue = issue(
          "error",
          "reparse-point",
          "Se detectó un symlink/junction; no se acepta como fuente de migración.",
          { path: rel },
        );
        issues.push(linkIssue);
        if (rejectLinks) continue;
      }
      if (entry.isDirectory()) {
        await visit(pathname);
        continue;
      }
      if (!entry.isFile()) {
        issues.push(issue("error", "unsupported-entry", "Entrada de filesystem no soportada.", { path: rel }));
        continue;
      }
      const info = await stat(pathname);
      const record = {
        path: rel,
        bytes: info.size,
        mtimeMs: Math.trunc(info.mtimeMs),
        ...(hashFiles ? { sha256: await sha256File(pathname) } : {}),
      };
      files.push(record);
      bytes += info.size;
    }
  }

  const rootStat = await lstat(root);
  if (rootStat.isSymbolicLink()) {
    issues.push(issue("error", "root-reparse-point", "La raíz es un symlink/junction.", { path: root }));
  } else if (!rootStat.isDirectory()) {
    issues.push(issue("error", "root-not-directory", "La raíz no es un directorio.", { path: root }));
  } else {
    await visit(root);
  }

  return { root, exists: true, files, fileCount: files.length, bytes, issues };
}

export function compareExactInventories(sourceInventory, destinationInventory) {
  if (!sourceInventory?.exists || !destinationInventory?.exists) {
    return { ok: false, failures: [{ reason: "inventory-missing" }], extras: [] };
  }
  const failures = [];
  const destinationByPath = new Map(destinationInventory.files.map((entry) => [entry.path, entry]));
  const sourcePaths = new Set();
  for (const source of sourceInventory.files) {
    sourcePaths.add(source.path);
    if (typeof source.sha256 !== "string") {
      failures.push({ path: source.path, reason: "source-hash-missing" });
      continue;
    }
    const destination = destinationByPath.get(source.path);
    if (!destination) {
      failures.push({ path: source.path, reason: "missing" });
      continue;
    }
    if (source.bytes !== destination.bytes) {
      failures.push({
        path: source.path,
        reason: "size-mismatch",
        expected: source.bytes,
        actual: destination.bytes,
      });
      continue;
    }
    if (typeof destination.sha256 !== "string" || source.sha256 !== destination.sha256) {
      failures.push({
        path: source.path,
        reason: "hash-mismatch",
        expected: source.sha256,
        actual: destination.sha256 ?? null,
      });
    }
  }
  const extras = destinationInventory.files
    .filter((entry) => !sourcePaths.has(entry.path))
    .map((entry) => ({ path: entry.path, reason: "extra" }));
  return {
    ok: failures.length === 0 && extras.length === 0,
    failures,
    extras,
  };
}

export async function createVerifiedSnapshot(options) {
  const destinationRoot = resolve(options.destinationRoot);
  if (await exists(destinationRoot)) {
    throw new Error(`El destino del snapshot ya existe; no se sobrescribe: ${destinationRoot}`);
  }
  const entries = Array.isArray(options.entries) ? options.entries : [];
  if (entries.length === 0) throw new Error("El snapshot requiere al menos una fuente.");
  await mkdir(dirname(destinationRoot), { recursive: true });
  const partialRoot = `${destinationRoot}.partial-${process.pid}-${Date.now()}`;
  if (await exists(partialRoot)) throw new Error(`El staging temporal del snapshot ya existe: ${partialRoot}`);
  await mkdir(partialRoot, { recursive: false });
  try {
    const copied = [];
    for (const entry of entries) {
      if (typeof entry?.key !== "string" || entry.key.length === 0) {
        throw new Error("Cada fuente del snapshot requiere key.");
      }
      const source = resolve(entry.source);
      const destinationRelative = normalizeRelativePath(entry.destinationRelative);
      const destination = assertInside(partialRoot, join(partialRoot, ...destinationRelative.split("/")));
      if (!(await exists(source))) throw new Error(`No existe la fuente ${entry.key}: ${source}`);
      const sourceInventory = await inventoryTree(source, { hashFiles: true });
      if (sourceInventory.issues.some((item) => item.severity === "error")) {
        throw new Error(`La fuente ${entry.key} contiene entradas no seguras.`);
      }
      await mkdir(dirname(destination), { recursive: true });
      await cp(source, destination, {
        recursive: true,
        force: false,
        errorOnExist: true,
        preserveTimestamps: true,
      });
      const destinationInventory = await inventoryTree(destination, { hashFiles: true });
      const comparison = compareExactInventories(sourceInventory, destinationInventory);
      if (!comparison.ok) {
        throw new Error(`El snapshot de ${entry.key} no coincide byte a byte con la fuente.`);
      }
      const finalDestination = join(destinationRoot, ...destinationRelative.split("/"));
      copied.push({
        key: entry.key,
        source,
        destinationRelative,
        destination: finalDestination,
        ok: true,
        sourceFileCount: sourceInventory.fileCount,
        destinationFileCount: destinationInventory.fileCount,
        bytes: sourceInventory.bytes,
        sourceInventory,
        destinationInventory: { ...destinationInventory, root: finalDestination },
        comparison,
      });
    }
    const result = {
      format: "solara-portable-migration-snapshot",
      version: 1,
      createdAt: new Date().toISOString(),
      destinationRoot,
      metadata: options.metadata ?? null,
      ok: copied.every((entry) => entry.ok),
      entries: copied,
    };
    await writeFile(join(partialRoot, "snapshot-manifest.json"), `${JSON.stringify(result, null, 2)}\n`, "utf8");
    await renameWithRetry(partialRoot, destinationRoot);
    return result;
  } catch (error) {
    await rm(partialRoot, { recursive: true, force: true }).catch(() => undefined);
    throw error;
  }
}

async function loadProjectSchema() {
  if (!schemaModulePromise) {
    schemaModulePromise = (async () => {
      const ts = await import("typescript");
      const packageRoot = join(REPO_ROOT, "packages", "project-schema");
      const sourceRoot = join(packageRoot, "src");
      const tempParent = join(packageRoot, ".tmp");
      await mkdir(tempParent, { recursive: true });
      const tempRoot = await mkdtemp(join(tempParent, "migration-schema-"));
      try {
        const entries = await readdir(sourceRoot, { withFileTypes: true });
        for (const entry of entries) {
          if (!entry.isFile() || !entry.name.endsWith(".ts") || entry.name.endsWith(".test.ts")) continue;
          const source = await readFile(join(sourceRoot, entry.name), "utf8");
          const transpiled = ts.transpileModule(source, {
            fileName: entry.name,
            compilerOptions: {
              module: ts.ModuleKind.ESNext,
              target: ts.ScriptTarget.ES2022,
              moduleResolution: ts.ModuleResolutionKind.Bundler,
              verbatimModuleSyntax: true,
            },
          });
          await writeFile(
            join(tempRoot, entry.name.replace(/\.ts$/, ".js")),
            normalizeTranspiledRelativeImports(transpiled.outputText),
            "utf8",
          );
        }
        await writeFile(join(tempRoot, "package.json"), '{"type":"module"}\n', "utf8");
        return await import(`${pathToFileURL(join(tempRoot, "index.js")).href}?v=${Date.now()}`);
      } finally {
        await rm(tempRoot, { recursive: true, force: true });
      }
    })();
  }
  return await schemaModulePromise;
}

export async function validateProjectArchive(pathname, expectedProjectId, options = {}) {
  const bytes = await readFile(pathname);
  let envelope;
  try {
    envelope = parseJsonBytesChunked(bytes);
  } catch (error) {
    throw new Error(`JSON de proyecto inválido en ${pathname}: ${error instanceof Error ? error.message : String(error)}`);
  }
  if (envelope?.format !== PROJECT_FORMAT || envelope?.version !== PROJECT_VERSION || !envelope?.project) {
    throw new Error(`El respaldo no tiene formato ${PROJECT_FORMAT} v${PROJECT_VERSION}: ${pathname}`);
  }
  const project = envelope.project;
  if (project.schemaVersion !== 2) throw new Error(`schemaVersion inválido en ${pathname}.`);
  if (expectedProjectId && project.id !== expectedProjectId) {
    throw new Error(`projectId ${project.id ?? "(ausente)"} no coincide con ${expectedProjectId}.`);
  }
  if (envelope.projectId && envelope.projectId !== project.id) {
    throw new Error(`El projectId del envelope no coincide con project.id en ${pathname}.`);
  }

  if (options.semantic !== false) {
    const { StoreProjectV2Schema } = await loadProjectSchema();
    const parsed = StoreProjectV2Schema.safeParse(project);
    if (!parsed.success) {
      const summary = parsed.error.issues
        .slice(0, 8)
        .map((entry) => `${entry.path.join(".") || "project"}: ${entry.message}`)
        .join(" | ");
      throw new Error(`StoreProjectV2Schema rechazó ${pathname}: ${summary}`);
    }
  }

  return {
    format: envelope.format,
    version: envelope.version,
    projectId: project.id,
    name: project.name,
    slug: project.slug,
    schemaVersion: project.schemaVersion,
    updatedAt: project.updatedAt ?? null,
  };
}

function validateManifestShape(manifest, manifestPath) {
  if (manifest?.format !== MANIFEST_FORMAT || manifest?.manifestVersion !== MANIFEST_VERSION) {
    throw new Error(`Manifest incompatible en ${manifestPath}.`);
  }
  if (manifest.schemaVersion !== 2) throw new Error(`schemaVersion del manifest inválido en ${manifestPath}.`);
  if (typeof manifest.projectId !== "string" || manifest.projectId.length === 0) {
    throw new Error(`projectId ausente en ${manifestPath}.`);
  }
  if (!manifest.current || !Number.isInteger(manifest.current.version) || manifest.current.version < 0) {
    throw new Error(`current.version inválido en ${manifestPath}.`);
  }
  if (!/^[a-f0-9]{64}$/i.test(manifest.current.sha256 ?? "")) {
    throw new Error(`current.sha256 inválido en ${manifestPath}.`);
  }
  normalizeRelativePath(manifest.current.projectPath);
}

export async function validateManagedStore(storeRoot, applicationRoot, options = {}) {
  const manifestPath = join(storeRoot, "manifest.json");
  const issues = [];
  let manifest;
  try {
    manifest = parseJsonTextAllowBom(await readFile(manifestPath, "utf8"));
    validateManifestShape(manifest, manifestPath);
  } catch (error) {
    return {
      storeRoot,
      folder: basename(storeRoot),
      healthy: false,
      projectId: null,
      issues: [issue("error", "manifest-invalid", error instanceof Error ? error.message : String(error))],
    };
  }

  const currentRelative = normalizeRelativePath(manifest.current.projectPath);
  const currentPath = assertInside(storeRoot, join(storeRoot, currentRelative));
  if (!(await exists(currentPath))) {
    issues.push(issue("error", "current-missing", "No existe la versión actual declarada por el manifest.", { path: currentRelative }));
  } else {
    const actualHash = await sha256File(currentPath);
    if (actualHash !== manifest.current.sha256) {
      issues.push(
        issue("error", "current-hash-mismatch", "El SHA-256 actual no coincide con el manifest.", {
          expected: manifest.current.sha256,
          actual: actualHash,
          path: currentRelative,
        }),
      );
    }
    try {
      const archive = await validateProjectArchive(currentPath, manifest.projectId, { semantic: options.semantic !== false });
      if (archive.slug !== manifest.slug) {
        issues.push(issue("error", "slug-mismatch", "El slug del proyecto actual no coincide con el manifest.", { projectSlug: archive.slug, manifestSlug: manifest.slug }));
      }
      if (archive.name !== manifest.storeName) {
        issues.push(issue("warning", "name-mismatch", "El nombre del proyecto actual no coincide exactamente con el manifest.", { projectName: archive.name, manifestName: manifest.storeName }));
      }
    } catch (error) {
      issues.push(issue("error", "project-invalid", error instanceof Error ? error.message : String(error)));
    }
  }

  let site = null;
  if (manifest.lastValidSite?.directoryPath) {
    try {
      const normalizedSite = normalizeRelativePath(manifest.lastValidSite.directoryPath);
      const sitePath = assertInside(applicationRoot, join(applicationRoot, normalizedSite));
      const siteInventory = await inventoryTree(sitePath, { hashFiles: false });
      site = {
        path: normalizedSite,
        exists: siteInventory.exists,
        files: siteInventory.fileCount,
        bytes: siteInventory.bytes,
        declaredFiles: manifest.lastValidSite.files,
        declaredBytes: manifest.lastValidSite.bytes,
        storedPayloadSha256: manifest.lastValidSite.sha256 ?? null,
      };
      issues.push(...siteInventory.issues);
      if (!siteInventory.exists) {
        issues.push(issue("error", "site-missing", "lastValidSite apunta a una carpeta inexistente.", { path: normalizedSite }));
      } else {
        if (Number.isInteger(manifest.lastValidSite.files) && manifest.lastValidSite.files !== siteInventory.fileCount) {
          issues.push(issue("warning", "site-file-count-mismatch", "La carpeta física de lastValidSite contiene una cantidad distinta a la registrada originalmente; se debe preservar tal cual y registrar la deriva.", { expected: manifest.lastValidSite.files, actual: siteInventory.fileCount }));
        }
        if (Number.isInteger(manifest.lastValidSite.bytes) && manifest.lastValidSite.bytes !== siteInventory.bytes) {
          issues.push(issue("warning", "site-byte-count-mismatch", "La carpeta física de lastValidSite tiene un tamaño distinto al registrado originalmente; se debe preservar tal cual y registrar la deriva.", { expected: manifest.lastValidSite.bytes, actual: siteInventory.bytes }));
        }
      }
    } catch (error) {
      issues.push(issue("error", "site-invalid", error instanceof Error ? error.message : String(error)));
    }
  }

  const inventory = await inventoryTree(storeRoot, { hashFiles: options.hashAll === true });
  issues.push(...inventory.issues);

  return {
    storeRoot,
    folder: basename(storeRoot),
    projectId: manifest.projectId,
    name: manifest.storeName,
    slug: manifest.slug,
    status: manifest.status ?? null,
    version: manifest.current.version,
    savedAt: manifest.current.savedAt ?? null,
    currentPath: currentRelative,
    currentSha256: manifest.current.sha256,
    lastValidSite: site,
    inventory,
    healthy: !issues.some((entry) => entry.severity === "error"),
    issues,
  };
}

function classifyStore(store) {
  const id = (store.projectId ?? "").toLowerCase();
  const name = (store.name ?? "").toLowerCase();
  if (id.startsWith("store-qa-") || name.startsWith("qa ") || name.includes(" qa")) return "qa";
  if (id === "store-modo-sur-demo") return "protected-demo";
  return "candidate-active";
}

export async function auditManagedRoot(root, applicationRoot, sourceKind, options) {
  if (!(await exists(root))) return { root, sourceKind, exists: false, stores: [], unrecognized: [], inventory: await inventoryTree(root, { hashFiles: options.hashAll }) };
  const entries = await readdir(root, { withFileTypes: true });
  entries.sort((a, b) => a.name.localeCompare(b.name));
  const stores = [];
  const unrecognized = [];
  for (const entry of entries) {
    const pathname = join(root, entry.name);
    if (entry.isSymbolicLink()) {
      unrecognized.push({ folder: entry.name, issue: "symlink-or-junction", severity: "error" });
      continue;
    }
    if (!entry.isDirectory()) {
      unrecognized.push({ folder: entry.name, issue: "not-directory", severity: "warning" });
      continue;
    }
    if (!(await exists(join(pathname, "manifest.json")))) {
      unrecognized.push({ folder: entry.name, issue: "missing-manifest", severity: "error" });
      continue;
    }
    const store = await validateManagedStore(pathname, applicationRoot, options);
    stores.push({ ...store, sourceKind, sourceKey: `${sourceKind}:${entry.name}`, classification: classifyStore(store) });
  }
  const inventory = await inventoryTree(root, { hashFiles: options.hashAll });
  return { root, sourceKind, exists: true, stores, unrecognized, inventory };
}

async function auditLooseStylo(options) {
  const inventory = await inventoryTree(TEMPORAL_STYLO, { hashFiles: options.hashAll });
  const issues = [...inventory.issues];
  let archive = null;
  if (inventory.exists && (await exists(TEMPORAL_STYLO_ARCHIVE))) {
    try {
      archive = await validateProjectArchive(TEMPORAL_STYLO_ARCHIVE, "store-stylo-lashes", { semantic: options.semantic !== false });
    } catch (error) {
      issues.push(issue("error", "loose-project-invalid", error instanceof Error ? error.message : String(error)));
    }
  } else if (inventory.exists) {
    issues.push(issue("error", "loose-project-missing", "temporalstylolashes existe pero no contiene stylo-lashes.solara.json."));
  }
  return {
    sourceKind: "temporal-stylo",
    sourceKey: "temporal-stylo:temporalstylolashes",
    root: TEMPORAL_STYLO,
    exists: inventory.exists,
    projectId: archive?.projectId ?? null,
    name: archive?.name ?? null,
    classification: "evidence",
    archive,
    inventory,
    healthy: !issues.some((entry) => entry.severity === "error"),
    issues,
  };
}

async function getFreeBytes(pathname) {
  const info = await statfs(pathname);
  return Number(info.bavail) * Number(info.bsize);
}

export function estimateRequiredSpace(input) {
  const compressionRatio = input.compressionRatio ?? DEFAULT_COMPRESSION_RATIO;
  if (!(compressionRatio > 0 && compressionRatio <= 1)) throw new Error("compressionRatio debe estar entre 0 y 1.");
  const sourceSnapshotBytes = input.sourceSnapshotBytes;
  const stagingBytes = input.stagingBytes;
  const rollbackBytes = input.rollbackBytes;
  const archiveBytes = input.archiveBytes ?? 0;
  const snapshotBytes = Math.ceil(sourceSnapshotBytes * compressionRatio);
  const twoSnapshotsBytes = snapshotBytes * 2;
  const subtotal = twoSnapshotsBytes + stagingBytes + rollbackBytes + archiveBytes;
  const marginBytes = Math.max(input.minMarginBytes ?? DEFAULT_MIN_MARGIN_BYTES, Math.ceil(subtotal * 0.1));
  const requiredAdditionalBytes = subtotal + marginBytes;
  return {
    compressionRatio,
    sourceSnapshotBytes,
    estimatedBytesPerCompressedSnapshot: snapshotBytes,
    estimatedTwoSnapshotsBytes: twoSnapshotsBytes,
    stagingBytes,
    rollbackBytes,
    archiveBytes,
    marginBytes,
    requiredAdditionalBytes,
    freeBytes: input.freeBytes,
    sufficient: input.freeBytes >= requiredAdditionalBytes,
  };
}

export function estimateStoragePlacement(input) {
  const archiveBytes = input.archiveBytes ?? 0;
  if (!Number.isFinite(input.snapshotFreeBytes)) {
    return {
      mode: "single-volume",
      ...estimateRequiredSpace({
        sourceSnapshotBytes: input.sourceSnapshotBytes,
        stagingBytes: input.stagingBytes,
        rollbackBytes: input.rollbackBytes,
        archiveBytes,
        freeBytes: input.localFreeBytes,
        compressionRatio: input.compressionRatio,
        minMarginBytes: input.minMarginBytes,
      }),
    };
  }

  const compressionRatio = input.compressionRatio ?? DEFAULT_COMPRESSION_RATIO;
  if (!(compressionRatio > 0 && compressionRatio <= 1)) throw new Error("compressionRatio debe estar entre 0 y 1.");
  const minMarginBytes = input.minMarginBytes ?? DEFAULT_MIN_MARGIN_BYTES;
  const estimatedBytesPerCompressedSnapshot = Math.ceil(input.sourceSnapshotBytes * compressionRatio);
  const estimatedTwoSnapshotsBytes = estimatedBytesPerCompressedSnapshot * 2;
  const localSubtotal = input.stagingBytes + input.rollbackBytes;
  const localMarginBytes = Math.max(minMarginBytes, Math.ceil(localSubtotal * 0.1));
  const snapshotSubtotal = estimatedTwoSnapshotsBytes + archiveBytes;
  const snapshotMarginBytes = Math.max(minMarginBytes, Math.ceil(snapshotSubtotal * 0.1));
  const localRequiredBytes = localSubtotal + localMarginBytes;
  const snapshotRequiredBytes = snapshotSubtotal + snapshotMarginBytes;

  return {
    mode: "split-volume",
    compressionRatio,
    sourceSnapshotBytes: input.sourceSnapshotBytes,
    estimatedBytesPerCompressedSnapshot,
    estimatedTwoSnapshotsBytes,
    stagingBytes: input.stagingBytes,
    rollbackBytes: input.rollbackBytes,
    archiveBytes,
    marginBytes: localMarginBytes + snapshotMarginBytes,
    requiredAdditionalBytes: localRequiredBytes + snapshotRequiredBytes,
    freeBytes: input.localFreeBytes,
    snapshotFreeBytes: input.snapshotFreeBytes,
    local: {
      freeBytes: input.localFreeBytes,
      requiredBytes: localRequiredBytes,
      marginBytes: localMarginBytes,
      sufficient: input.localFreeBytes >= localRequiredBytes,
    },
    snapshots: {
      freeBytes: input.snapshotFreeBytes,
      requiredBytes: snapshotRequiredBytes,
      marginBytes: snapshotMarginBytes,
      sufficient: input.snapshotFreeBytes >= snapshotRequiredBytes,
    },
    sufficient: input.localFreeBytes >= localRequiredBytes && input.snapshotFreeBytes >= snapshotRequiredBytes,
  };
}

async function checkNormalManagedServer() {
  const serverPath = join(NORMAL_RUNTIME, "server.json");
  if (!(await exists(serverPath))) return { state: "absent", active: false, path: serverPath };
  let server;
  try {
    server = parseJsonTextAllowBom(await readFile(serverPath, "utf8"));
  } catch (error) {
    return { state: "invalid-record", active: false, path: serverPath, error: error instanceof Error ? error.message : String(error) };
  }
  const pid = Number(server.processId);
  let processExists = false;
  if (Number.isInteger(pid) && pid > 0) {
    try {
      process.kill(pid, 0);
      processExists = true;
    } catch {
      processExists = false;
    }
  }
  if (!processExists) return { state: "stale-record", active: false, path: serverPath, processId: pid, port: server.port ?? null };

  let managedEndpoint = false;
  if (Number.isInteger(Number(server.port))) {
    try {
      const response = await fetch(`http://127.0.0.1:${Number(server.port)}/__solara/session`, { signal: AbortSignal.timeout(1500) });
      if (response.ok) {
        const body = await response.json();
        managedEndpoint = body?.managed === true;
      }
    } catch {
      managedEndpoint = false;
    }
  }
  return {
    state: managedEndpoint ? "active-managed" : "process-active-endpoint-unverified",
    active: true,
    managedEndpoint,
    path: serverPath,
    processId: pid,
    port: server.port ?? null,
  };
}

function findDuplicateProjectIds(groups, looseEvidence) {
  const byId = new Map();
  for (const group of groups) {
    for (const store of group.stores) {
      if (!store.projectId) continue;
      const entries = byId.get(store.projectId) ?? [];
      entries.push(store.sourceKey);
      byId.set(store.projectId, entries);
    }
  }
  if (looseEvidence?.projectId) {
    const entries = byId.get(looseEvidence.projectId) ?? [];
    entries.push(looseEvidence.sourceKey);
    byId.set(looseEvidence.projectId, entries);
  }
  return [...byId.entries()]
    .filter(([, sources]) => sources.length > 1)
    .map(([projectId, sources]) => ({ projectId, sources }));
}

function buildLedger(groups, looseEvidence, duplicates, portableRuntime) {
  const duplicateIds = new Set(duplicates.map((entry) => entry.projectId));
  const ledger = [];
  for (const group of groups) {
    for (const store of group.stores) {
      const conflict = duplicateIds.has(store.projectId);
      const classification = conflict ? "conflict" : store.classification;
      let proposedAction = "review";
      if (!conflict && classification === "qa") proposedAction = "archive";
      if (!conflict && classification === "protected-demo") proposedAction = "archive-or-activate";
      if (!conflict && classification === "candidate-active" && group.sourceKind === "portable") proposedAction = "migrate-active";
      ledger.push({
        sourceKey: store.sourceKey,
        sourceKind: group.sourceKind,
        sourcePath: store.storeRoot,
        projectId: store.projectId,
        name: store.name,
        classification,
        healthy: store.healthy,
        proposedAction,
        decisionRequired: conflict || proposedAction === "review" || proposedAction === "archive-or-activate",
        destination: null,
      });
    }
  }
  if (looseEvidence?.exists) {
    ledger.push({
      sourceKey: looseEvidence.sourceKey,
      sourceKind: looseEvidence.sourceKind,
      sourcePath: looseEvidence.root,
      projectId: looseEvidence.projectId,
      name: looseEvidence.name,
      classification: duplicateIds.has(looseEvidence.projectId) ? "conflict-evidence" : "evidence",
      healthy: looseEvidence.healthy,
      proposedAction: "archive",
      decisionRequired: false,
      destination: null,
    });
  }
  if (portableRuntime?.exists) {
    ledger.push({
      sourceKey: "portable-runtime:.solara-runtime",
      sourceKind: "portable-runtime",
      sourcePath: portableRuntime.root,
      projectId: null,
      name: ".solara-runtime portable",
      classification: "runtime-evidence",
      healthy: !portableRuntime.issues.some((entry) => entry.severity === "error"),
      proposedAction: "archive",
      decisionRequired: false,
      destination: null,
    });
  }
  return ledger;
}

export function applyLedgerDecisions(ledger, duplicates, decisions = null) {
  const bySource = new Map();
  for (const entry of decisions?.entries ?? []) {
    if (typeof entry?.sourceKey !== "string") continue;
    if (!new Set(["migrate-active", "archive"]).has(entry.action)) continue;
    bySource.set(entry.sourceKey, entry);
  }

  const resolvedLedger = ledger.map((entry) => {
    const decision = bySource.get(entry.sourceKey);
    if (!decision) return entry;
    return {
      ...entry,
      proposedAction: decision.action,
      decisionRequired: false,
      destination:
        typeof decision.destination === "string" && decision.destination.length > 0
          ? decision.destination
          : entry.destination,
      decision: {
        action: decision.action,
        destination:
          typeof decision.destination === "string" && decision.destination.length > 0
            ? decision.destination
            : null,
        note: typeof decision.note === "string" ? decision.note : null,
      },
    };
  });

  const ledgerBySource = new Map(resolvedLedger.map((entry) => [entry.sourceKey, entry]));
  const unresolvedDuplicateProjectIds = duplicates.filter((duplicate) => {
    const members = duplicate.sources.map((sourceKey) => ledgerBySource.get(sourceKey)).filter(Boolean);
    const activeCount = members.filter((entry) => entry.proposedAction === "migrate-active").length;
    return activeCount !== 1 || members.some((entry) => entry.decisionRequired || !["migrate-active", "archive"].includes(entry.proposedAction));
  });

  return { ledger: resolvedLedger, unresolvedDuplicateProjectIds };
}

export async function auditMigrationSources(options = {}) {
  const snapshotRoot = options.snapshotRoot ? (isAbsolute(options.snapshotRoot) ? resolve(options.snapshotRoot) : resolve(REPO_ROOT, options.snapshotRoot)) : null;
  const normalizedOptions = {
    hashAll: options.hashAll === true,
    semantic: options.semantic !== false,
    compressionRatio: options.compressionRatio ?? DEFAULT_COMPRESSION_RATIO,
    snapshotRoot,
  };
  const startedAt = new Date().toISOString();

  const portable = await auditManagedRoot(PORTABLE_PROJECTS, PORTABLE_ROOT, "portable", normalizedOptions);
  const normal = await auditManagedRoot(NORMAL_PROJECTS, REPO_ROOT, "normal", normalizedOptions);
  const looseEvidence = await auditLooseStylo(normalizedOptions);
  const portableRuntime = await inventoryTree(PORTABLE_RUNTIME, { hashFiles: normalizedOptions.hashAll });
  const normalRuntime = await inventoryTree(NORMAL_RUNTIME, { hashFiles: normalizedOptions.hashAll });
  const groups = [portable, normal];
  const duplicates = findDuplicateProjectIds(groups, looseEvidence);
  const decisionState = applyLedgerDecisions(
    buildLedger(groups, looseEvidence, duplicates, portableRuntime),
    duplicates,
    options.decisions,
  );
  const ledger = decisionState.ledger;
  const normalServer = await checkNormalManagedServer();
  const freeBytes = await getFreeBytes(REPO_ROOT);
  const snapshotFreeBytes =
    snapshotRoot && parse(snapshotRoot).root.toLowerCase() !== parse(REPO_ROOT).root.toLowerCase()
      ? await getFreeBytes(snapshotRoot)
      : null;

  const sourceSnapshotBytes =
    portable.inventory.bytes +
    normal.inventory.bytes +
    portableRuntime.bytes +
    normalRuntime.bytes +
    looseEvidence.inventory.bytes;
  const inventoryBySource = new Map();
  for (const group of groups) {
    for (const store of group.stores) inventoryBySource.set(store.sourceKey, store.inventory);
  }
  if (looseEvidence?.exists) inventoryBySource.set(looseEvidence.sourceKey, looseEvidence.inventory);
  if (portableRuntime?.exists) inventoryBySource.set("portable-runtime:.solara-runtime", portableRuntime);
  let stagingBytes = 0;
  let archiveBytes = 0;
  for (const entry of ledger) {
    const bytes = inventoryBySource.get(entry.sourceKey)?.bytes ?? 0;
    if (entry.proposedAction === "archive") archiveBytes += bytes;
    else stagingBytes += bytes;
  }
  const rollbackBytes = normal.inventory.bytes;
  const space = estimateStoragePlacement({
    sourceSnapshotBytes,
    stagingBytes,
    rollbackBytes,
    archiveBytes,
    localFreeBytes: freeBytes,
    snapshotFreeBytes,
    compressionRatio: normalizedOptions.compressionRatio,
  });
  if (snapshotRoot) space.snapshotRoot = snapshotRoot;

  const errors = [];
  for (const group of groups) {
    for (const store of group.stores) {
      for (const storeIssue of store.issues) {
        if (storeIssue.severity === "error") errors.push({ sourceKey: store.sourceKey, ...storeIssue });
      }
    }
    for (const unknown of group.unrecognized) {
      if (unknown.severity === "error") {
        errors.push({ sourceKey: group.sourceKind, severity: "error", code: "unrecognized-source", message: `Entrada no administrada: ${unknown.folder} (${unknown.issue}).` });
      }
    }
    for (const treeIssue of group.inventory.issues) if (treeIssue.severity === "error") errors.push({ sourceKey: group.sourceKind, ...treeIssue });
  }
  for (const looseIssue of looseEvidence.issues) if (looseIssue.severity === "error") errors.push({ sourceKey: looseEvidence.sourceKey, ...looseIssue });
  for (const runtimeIssue of portableRuntime.issues) if (runtimeIssue.severity === "error") errors.push({ sourceKey: "portable-runtime", ...runtimeIssue });
  for (const runtimeIssue of normalRuntime.issues) if (runtimeIssue.severity === "error") errors.push({ sourceKey: "normal-runtime", ...runtimeIssue });

  const unresolvedLedger = ledger.filter((entry) => entry.decisionRequired);
  const blockers = [];
  if (normalServer.active) blockers.push("normal-managed-server-active");
  if (errors.length > 0) blockers.push("source-errors");
  if (decisionState.unresolvedDuplicateProjectIds.length > 0) blockers.push("duplicate-project-ids");
  if (unresolvedLedger.length > 0) blockers.push("ledger-decisions-pending");
  if (!space.sufficient) blockers.push("insufficient-free-space");
  if (options.decisions?.recoveryDraftsReviewed !== true) blockers.push("recovery-drafts-require-studio-review");

  return {
    format: "solara-portable-migration-audit",
    version: 1,
    startedAt,
    finishedAt: new Date().toISOString(),
    repoRoot: REPO_ROOT,
    options: normalizedOptions,
    sources: {
      portable,
      normal,
      looseEvidence,
      portableRuntime,
      normalRuntime,
    },
    duplicateProjectIds: duplicates,
    unresolvedDuplicateProjectIds: decisionState.unresolvedDuplicateProjectIds,
    ledger,
    normalServer,
    space,
    errors,
    blockers: [...new Set(blockers)],
    readyForDefinitiveSnapshot: blockers.length === 0,
    readyForCutover: false,
    manualChecks: [
      "Cerrar y verificar manualmente que la portable no esté abierta.",
      ...(options.decisions?.recoveryDraftsReviewed === true ? [] : ["Resolver RecoveryDrafts de portable y app normal desde Studio antes de 01-FUENTE-DEFINITIVA."]),
      ...(unresolvedLedger.length === 0 ? [] : ["Resolver cada entrada decisionRequired del ledger."]),
    ],
  };
}

function flattenSources(report) {
  const result = new Map();
  for (const store of report?.sources?.portable?.stores ?? []) result.set(store.sourceKey, store);
  for (const store of report?.sources?.normal?.stores ?? []) result.set(store.sourceKey, store);
  const loose = report?.sources?.looseEvidence;
  if (loose?.sourceKey) result.set(loose.sourceKey, loose);
  const portableRuntime = report?.sources?.portableRuntime;
  if (portableRuntime?.exists) {
    result.set("portable-runtime:.solara-runtime", {
      sourceKey: "portable-runtime:.solara-runtime",
      projectId: null,
      inventory: portableRuntime,
    });
  }
  return result;
}

export async function verifyInheritedFiles(baselineInventory, destinationRoot) {
  if (!baselineInventory?.exists) throw new Error("El inventario base no existe.");
  const missingHashes = baselineInventory.files.filter((entry) => typeof entry.sha256 !== "string");
  if (missingHashes.length > 0) throw new Error("El baseline fue creado sin --hash-all; no sirve para verificación final.");
  const failures = [];
  let verified = 0;
  for (const entry of baselineInventory.files) {
    const rel = normalizeRelativePath(entry.path);
    const destination = assertInside(destinationRoot, join(destinationRoot, rel));
    if (!(await exists(destination))) {
      failures.push({ path: rel, reason: "missing" });
      continue;
    }
    const info = await lstat(destination);
    if (!info.isFile() || info.isSymbolicLink()) {
      failures.push({ path: rel, reason: "not-regular-file" });
      continue;
    }
    const actual = await sha256File(destination);
    if (actual !== entry.sha256) {
      failures.push({ path: rel, reason: "hash-mismatch", expected: entry.sha256, actual });
      continue;
    }
    verified += 1;
  }
  return { ok: failures.length === 0, inheritedFiles: baselineInventory.files.length, verified, failures };
}

export async function verifyMigrationFromBaseline(baseline, decisions) {
  const sources = flattenSources(baseline);
  const results = [];
  const decisionBySource = new Map();
  for (const entry of decisions?.entries ?? []) {
    if (typeof entry?.sourceKey === "string") decisionBySource.set(entry.sourceKey, entry);
  }
  const ledger = Array.isArray(baseline?.ledger) ? baseline.ledger : [];
  for (const ledgerEntry of ledger) {
    const decision = decisionBySource.get(ledgerEntry.sourceKey);
    const action = decision?.action ?? ledgerEntry.proposedAction;
    const destination = decision?.destination ?? ledgerEntry.destination;
    const source = sources.get(ledgerEntry.sourceKey);
    if (!source) {
      results.push({ sourceKey: ledgerEntry.sourceKey, ok: false, error: "sourceKey no existe en el baseline." });
      continue;
    }
    if (!["migrate-active", "archive"].includes(action)) {
      results.push({ sourceKey: ledgerEntry.sourceKey, ok: false, error: "acción del ledger sin resolver." });
      continue;
    }
    if (typeof destination !== "string" || destination.length === 0) {
      results.push({ sourceKey: ledgerEntry.sourceKey, ok: false, error: "destination ausente." });
      continue;
    }
    const resolvedDestination = isAbsolute(destination) ? resolve(destination) : resolve(REPO_ROOT, destination);
    try {
      const inherited = await verifyInheritedFiles(source.inventory, resolvedDestination);
      let semantic = null;
      if (action === "migrate-active" && source.projectId) {
        semantic = await validateManagedStore(resolvedDestination, REPO_ROOT, { hashAll: false, semantic: true });
      }
      results.push({
        sourceKey: ledgerEntry.sourceKey,
        action,
        destination: resolvedDestination,
        ok: inherited.ok && (semantic?.healthy ?? true),
        inherited,
        semantic,
      });
    } catch (error) {
      results.push({
        sourceKey: ledgerEntry.sourceKey,
        action,
        destination: resolvedDestination,
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
  const ledgerKeys = new Set(ledger.map((entry) => entry.sourceKey));
  for (const sourceKey of decisionBySource.keys()) {
    if (!ledgerKeys.has(sourceKey)) {
      results.push({ sourceKey, ok: false, error: "sourceKey no existe en el baseline ledger." });
    }
  }
  return {
    format: "solara-portable-migration-verification",
    version: 1,
    verifiedAt: new Date().toISOString(),
    ok: ledger.length > 0 && results.length === ledger.length && results.every((entry) => entry.ok),
    results,
  };
}

export async function discoverBrowserIndexedDbEvidence(localAppData = process.env.LOCALAPPDATA) {
  if (!localAppData) return [];
  const providers = [
    { name: "chrome", userData: join(localAppData, "Google", "Chrome", "User Data") },
    { name: "edge", userData: join(localAppData, "Microsoft", "Edge", "User Data") },
  ];
  const evidence = [];
  for (const provider of providers) {
    if (!(await exists(provider.userData))) continue;
    const profiles = await readdir(provider.userData, { withFileTypes: true });
    for (const profile of profiles) {
      if (!profile.isDirectory() || profile.isSymbolicLink()) continue;
      const indexedDbRoot = join(provider.userData, profile.name, "IndexedDB");
      if (!(await exists(indexedDbRoot))) continue;
      const databases = await readdir(indexedDbRoot, { withFileTypes: true });
      for (const database of databases) {
        if (!database.isDirectory() || database.isSymbolicLink()) continue;
        if (!/^http_(?:127\.0\.0\.1|localhost)_4173\.indexeddb\.(?:blob|leveldb)$/i.test(database.name)) continue;
        evidence.push({
          provider: provider.name,
          profile: profile.name,
          database: database.name,
          source: join(indexedDbRoot, database.name),
        });
      }
    }
  }
  evidence.sort((a, b) => `${a.provider}/${a.profile}/${a.database}`.localeCompare(`${b.provider}/${b.profile}/${b.database}`));
  return evidence;
}

function snapshotLedgerSourceMap(audit) {
  const result = {};
  for (const entry of audit.ledger ?? []) {
    let destinationRelative = null;
    if (entry.sourceKind === "portable") {
      destinationRelative = `portable/proyectos/${basename(entry.sourcePath)}`;
    } else if (entry.sourceKind === "normal") {
      destinationRelative = `normal/proyectos/${basename(entry.sourcePath)}`;
    } else if (entry.sourceKind === "temporal-stylo") {
      destinationRelative = "evidencia/temporalstylolashes";
    } else if (entry.sourceKind === "portable-runtime") {
      destinationRelative = "portable/.solara-runtime";
    }
    if (destinationRelative) result[entry.sourceKey] = destinationRelative;
  }
  return result;
}

export async function createOriginalMigrationSnapshot(options) {
  if (!options?.decisions) throw new Error("El snapshot original requiere el archivo de decisiones cargado.");
  const audit = await auditMigrationSources({
    hashAll: false,
    semantic: options.semantic !== false,
    compressionRatio: options.compressionRatio ?? DEFAULT_COMPRESSION_RATIO,
    decisions: options.decisions,
    snapshotRoot: options.snapshotSpaceRoot ?? dirname(resolve(options.destinationRoot)),
  });
  if (audit.errors.length > 0) {
    throw new Error(`La auditoría tiene ${audit.errors.length} errores de fuente; no se crea el snapshot.`);
  }
  const phase = options.phase ?? "00-ORIGINAL-INMUTABLE";
  const allowedBlockers = new Set(phase === "00-ORIGINAL-INMUTABLE" ? ["recovery-drafts-require-studio-review"] : []);
  const blocking = audit.blockers.filter((entry) => !allowedBlockers.has(entry));
  if (blocking.length > 0) {
    throw new Error(`El snapshot original está bloqueado por: ${blocking.join(", ")}`);
  }
  const browserEvidence = await discoverBrowserIndexedDbEvidence(options.localAppData);
  if (browserEvidence.length === 0) {
    throw new Error("No se encontró evidencia IndexedDB de SolaraCommerce para 127.0.0.1/localhost:4173; no se abre Studio antes de resolverlo.");
  }
  const entries = [
    { key: "portable-projects", source: PORTABLE_PROJECTS, destinationRelative: "portable/proyectos" },
    { key: "portable-runtime", source: PORTABLE_RUNTIME, destinationRelative: "portable/.solara-runtime" },
    { key: "normal-projects", source: NORMAL_PROJECTS, destinationRelative: "normal/proyectos" },
    { key: "temporal-stylo", source: TEMPORAL_STYLO, destinationRelative: "evidencia/temporalstylolashes" },
  ];
  if (await exists(NORMAL_RUNTIME)) {
    entries.push({ key: "normal-runtime", source: NORMAL_RUNTIME, destinationRelative: "normal/.solara-runtime" });
  }
  for (const evidence of browserEvidence) {
    entries.push({
      key: `browser:${evidence.provider}:${evidence.profile}:${evidence.database}`,
      source: evidence.source,
      destinationRelative: `browser-indexeddb/${evidence.provider}/${evidence.profile}/${evidence.database}`,
    });
  }
  return await createVerifiedSnapshot({
    destinationRoot: options.destinationRoot,
    entries,
    metadata: {
      ...(options.additionalMetadata ?? {}),
      phase,
      blockersAtCapture: audit.blockers,
      auditSummary: {
        portableStores: audit.sources.portable.stores.length,
        normalStores: audit.sources.normal.stores.length,
        portableBytes: audit.sources.portable.inventory.bytes,
        normalBytes: audit.sources.normal.inventory.bytes,
        portableRuntimeBytes: audit.sources.portableRuntime.bytes,
        looseEvidenceBytes: audit.sources.looseEvidence.inventory.bytes,
      },
      ledgerSources: snapshotLedgerSourceMap(audit),
      browserEvidence: browserEvidence.map(({ provider, profile, database }) => ({ provider, profile, database })),
    },
  });
}

export async function createDefinitiveMigrationSnapshot(options) {
  if (options?.decisions?.recoveryDraftsReviewed !== true) {
    throw new Error("El snapshot definitivo requiere recoveryDraftsReviewed=true.");
  }
  const auditSources = options.auditSources ?? auditMigrationSources;
  const snapshotFactory = options.snapshotFactory ?? createOriginalMigrationSnapshot;
  const baseline = await auditSources({
    hashAll: true,
    semantic: options.semantic !== false,
    compressionRatio: options.compressionRatio ?? DEFAULT_COMPRESSION_RATIO,
    decisions: options.decisions,
    snapshotRoot: options.snapshotSpaceRoot ?? dirname(resolve(options.destinationRoot)),
  });
  if (baseline.errors.length > 0 || baseline.blockers.length > 0 || !baseline.readyForDefinitiveSnapshot) {
    throw new Error(
      `La fuente definitiva no está lista: errores=${baseline.errors.length}, bloqueos=${baseline.blockers.join(", ") || "ninguno"}.`,
    );
  }
  const baselineSha256 = migrationBaselineFingerprint(baseline);
  const snapshot = await snapshotFactory({
    ...options,
    phase: "01-FUENTE-DEFINITIVA",
    additionalMetadata: {
      ...(options.additionalMetadata ?? {}),
      baselineSha256,
    },
  });
  const baselineBinding = await verifySnapshotAgainstBaseline(snapshot, baseline);
  return { snapshot, baseline, baselineSha256, baselineBinding };
}

function decisionForLedgerEntry(entry, decisions) {
  const decision = (decisions?.entries ?? []).find((item) => item?.sourceKey === entry.sourceKey);
  return {
    action: decision?.action ?? entry.proposedAction,
    destination: decision?.destination ?? entry.destination,
  };
}

function snapshotSourceForKey(snapshot, sourceKey) {
  const relativeSource = snapshot?.metadata?.ledgerSources?.[sourceKey];
  if (typeof relativeSource !== "string" || relativeSource.length === 0) {
    throw new Error(`El snapshot no registra una fuente para ${sourceKey}.`);
  }
  const normalized = normalizeRelativePath(relativeSource);
  return assertInside(snapshot.destinationRoot, join(snapshot.destinationRoot, ...normalized.split("/")));
}

function migrationBaselineFingerprint(baseline) {
  return createHash("sha256").update(JSON.stringify(baseline)).digest("hex");
}

function assertDefinitiveSnapshotMatchesBaseline(snapshot, baseline) {
  if (snapshot?.metadata?.phase !== "01-FUENTE-DEFINITIVA") {
    throw new Error("La operación requiere el snapshot 01-FUENTE-DEFINITIVA.");
  }
  const expected = snapshot?.metadata?.baselineSha256;
  const actual = migrationBaselineFingerprint(baseline);
  if (typeof expected !== "string" || expected.length === 0) {
    throw new Error("El snapshot definitivo no registra baselineSha256.");
  }
  if (expected !== actual) {
    throw new Error("El baseline no coincide con el snapshot definitivo seleccionado.");
  }
  return actual;
}

export async function verifySnapshotAgainstBaseline(snapshot, baseline) {
  const baselineSha256 = assertDefinitiveSnapshotMatchesBaseline(snapshot, baseline);
  const sources = flattenSources(baseline);
  const results = [];
  for (const entry of baseline?.ledger ?? []) {
    const source = sources.get(entry.sourceKey);
    if (!source?.inventory) throw new Error(`El baseline no contiene ${entry.sourceKey}.`);
    const snapshotSource = snapshotSourceForKey(snapshot, entry.sourceKey);
    const inventory = await inventoryTree(snapshotSource, { hashFiles: true });
    const comparison = compareExactInventories(source.inventory, inventory);
    if (!comparison.ok) {
      throw new Error(`El snapshot definitivo no coincide con el baseline para ${entry.sourceKey}.`);
    }
    results.push({ sourceKey: entry.sourceKey, ok: true, comparison });
  }
  if (results.length === 0) throw new Error("El baseline definitivo no contiene entradas de ledger.");
  return { ok: results.every((entry) => entry.ok), baselineSha256, entries: results };
}

async function copyVerifiedTreeAtomic(source, destination, baselineInventory) {
  const target = resolve(destination);
  if (await exists(target)) {
    const current = await inventoryTree(target, { hashFiles: true });
    const comparison = compareExactInventories(baselineInventory, current);
    if (!comparison.ok) {
      throw new Error(`El destino ya existe y no coincide con el baseline: ${target}`);
    }
    return { status: "already-verified", destination: target, inventory: current, comparison };
  }
  await mkdir(dirname(target), { recursive: true });
  const partial = `${target}.partial-${process.pid}-${Date.now()}`;
  if (await exists(partial)) throw new Error(`El destino temporal ya existe: ${partial}`);
  try {
    await cp(source, partial, {
      recursive: true,
      force: false,
      errorOnExist: true,
      preserveTimestamps: true,
    });
    const inventory = await inventoryTree(partial, { hashFiles: true });
    const comparison = compareExactInventories(baselineInventory, inventory);
    if (!comparison.ok) throw new Error(`La copia temporal no coincide con el baseline: ${target}`);
    await renameWithRetry(partial, target);
    return {
      status: "copied",
      destination: target,
      inventory: { ...inventory, root: target },
      comparison,
    };
  } catch (error) {
    await rm(partial, { recursive: true, force: true }).catch(() => undefined);
    throw error;
  }
}

export async function prepareStagingFromSnapshot(options) {
  if (options?.decisions?.recoveryDraftsReviewed !== true) {
    throw new Error("No se prepara staging antes de cerrar la revisión de RecoveryDrafts.");
  }
  const baselineSha256 = assertDefinitiveSnapshotMatchesBaseline(options.snapshot, options.baseline);
  const repoRoot = resolve(options.repoRoot ?? REPO_ROOT);
  const projectsRoot = join(repoRoot, "proyectos");
  const stageRoot = resolve(options.stageRoot ?? join(repoRoot, ".migration-staging"));
  if (await exists(stageRoot)) throw new Error(`El staging ya existe; no se sobrescribe: ${stageRoot}`);
  const partialRoot = `${stageRoot}.partial-${process.pid}-${Date.now()}`;
  const partialProjects = join(partialRoot, "proyectos");
  const sources = flattenSources(options.baseline);
  const active = (options.baseline?.ledger ?? [])
    .map((entry) => ({ entry, ...decisionForLedgerEntry(entry, options.decisions) }))
    .filter((item) => item.action === "migrate-active");
  if (active.length === 0) throw new Error("El ledger no contiene tiendas activas para staging.");
  await mkdir(partialProjects, { recursive: true });
  try {
    const storageMarker = join(projectsRoot, "LEEME.md");
    if (await exists(storageMarker)) {
      await cp(storageMarker, join(partialProjects, "LEEME.md"), { force: false, errorOnExist: true });
    }
    const results = [];
    const activeIds = new Set();
    for (const item of active) {
      const source = sources.get(item.entry.sourceKey);
      if (!source?.inventory) throw new Error(`El baseline no contiene ${item.entry.sourceKey}.`);
      if (typeof item.destination !== "string" || item.destination.length === 0) {
        throw new Error(`Destino activo ausente para ${item.entry.sourceKey}.`);
      }
      const finalDestination = isAbsolute(item.destination)
        ? resolve(item.destination)
        : resolve(repoRoot, item.destination);
      assertInside(projectsRoot, finalDestination);
      if (dirname(finalDestination).toLowerCase() !== projectsRoot.toLowerCase()) {
        throw new Error(`El destino activo debe ser una carpeta directa de proyectos/: ${item.destination}`);
      }
      if (source.projectId && activeIds.has(source.projectId)) {
        throw new Error(`projectId activo duplicado en staging: ${source.projectId}`);
      }
      if (source.projectId) activeIds.add(source.projectId);
      const snapshotSource = snapshotSourceForKey(options.snapshot, item.entry.sourceKey);
      const stageDestination = join(partialProjects, basename(finalDestination));
      await cp(snapshotSource, stageDestination, {
        recursive: true,
        force: false,
        errorOnExist: true,
        preserveTimestamps: true,
      });
      const destinationInventory = await inventoryTree(stageDestination, { hashFiles: true });
      const comparison = compareExactInventories(source.inventory, destinationInventory);
      if (!comparison.ok) throw new Error(`Staging no coincide con ${item.entry.sourceKey}.`);
      const semantic = await validateManagedStore(stageDestination, partialRoot, { semantic: true, hashAll: false });
      if (!semantic.healthy) throw new Error(`Staging semánticamente inválido para ${item.entry.sourceKey}.`);
      results.push({
        sourceKey: item.entry.sourceKey,
        projectId: source.projectId ?? null,
        destination: join(stageRoot, "proyectos", basename(finalDestination)),
        comparison,
        semantic,
        ok: true,
      });
    }
    const result = {
      format: "solara-portable-migration-staging",
      version: 1,
      createdAt: new Date().toISOString(),
      stageRoot,
      snapshotRoot: options.snapshot.destinationRoot,
      baselineSha256,
      ok: results.every((entry) => entry.ok),
      entries: results,
    };
    await writeFile(join(partialRoot, "migration-staging-manifest.json"), `${JSON.stringify(result, null, 2)}\n`, "utf8");
    await renameWithRetry(partialRoot, stageRoot);
    return result;
  } catch (error) {
    await rm(partialRoot, { recursive: true, force: true }).catch(() => undefined);
    throw error;
  }
}

export async function archiveMigrationFromSnapshot(options) {
  assertDefinitiveSnapshotMatchesBaseline(options.snapshot, options.baseline);
  const repoRoot = resolve(options.repoRoot ?? REPO_ROOT);
  const sources = flattenSources(options.baseline);
  const archived = [];
  for (const entry of options.baseline?.ledger ?? []) {
    const resolvedDecision = decisionForLedgerEntry(entry, options.decisions);
    if (resolvedDecision.action !== "archive") continue;
    if (typeof resolvedDecision.destination !== "string" || resolvedDecision.destination.length === 0) {
      throw new Error(`Destino de archivo ausente para ${entry.sourceKey}.`);
    }
    const source = sources.get(entry.sourceKey);
    if (!source?.inventory) throw new Error(`El baseline no contiene ${entry.sourceKey}.`);
    const snapshotSource = snapshotSourceForKey(options.snapshot, entry.sourceKey);
    const destination = isAbsolute(resolvedDecision.destination)
      ? resolve(resolvedDecision.destination)
      : resolve(repoRoot, resolvedDecision.destination);
    const copied = await copyVerifiedTreeAtomic(snapshotSource, destination, source.inventory);
    archived.push({ sourceKey: entry.sourceKey, ok: true, ...copied });
  }
  return {
    format: "solara-portable-migration-archive",
    version: 1,
    createdAt: new Date().toISOString(),
    ok: archived.length > 0 && archived.every((entry) => entry.ok),
    entries: archived,
  };
}

async function validateFinalMigrationState(baseline, decisions) {
  const verification = await verifyMigrationFromBaseline(baseline, decisions);
  if (!verification.ok) {
    const failed = verification.results.filter((entry) => !entry.ok).map((entry) => entry.sourceKey);
    throw new Error(`La validación posterior al cutover falló para: ${failed.join(", ")}`);
  }
  return verification;
}

export async function performMigrationCutover(options) {
  if (options?.decisions?.recoveryDraftsReviewed !== true) {
    throw new Error("El cutover requiere recoveryDraftsReviewed=true.");
  }
  if (typeof options?.rollback !== "string" || options.rollback.length === 0) {
    throw new Error("El cutover requiere un destino de rollback explícito.");
  }
  const serverCheck = options.checkNormalManagedServer ?? checkNormalManagedServer;
  const server = await serverCheck();
  if (server.active) throw new Error(`El servidor normal sigue activo (${server.state}); no se hace cutover.`);
  const repoRoot = resolve(options.repoRoot ?? REPO_ROOT);
  const stageRoot = resolve(options.stageRoot ?? join(repoRoot, ".migration-staging"));
  const stagingProjects = join(stageRoot, "proyectos");
  const target = resolve(options.target ?? join(repoRoot, "proyectos"));
  const rollback = resolve(options.rollback);
  const volumeKey = options.volumeKey ?? ((pathname) => parse(pathname).root.toLowerCase());
  if (!(await exists(stagingProjects))) throw new Error(`No existe el staging de proyectos: ${stagingProjects}`);
  if (volumeKey(stagingProjects) !== volumeKey(target)) {
    throw new Error("Staging y proyectos/ deben estar en el mismo volumen para el cutover transaccional.");
  }
  if (volumeKey(rollback) !== volumeKey(target)) {
    throw new Error("Rollback y proyectos/ deben estar en el mismo volumen para el cutover transaccional.");
  }
  const rollbackFromTarget = relative(target, rollback);
  if (rollbackFromTarget === "" || (!rollbackFromTarget.startsWith("..") && !isAbsolute(rollbackFromTarget))) {
    throw new Error("El rollback debe quedar fuera de proyectos/.");
  }
  const stageManifestPath = join(stageRoot, "migration-staging-manifest.json");
  if (!(await exists(stageManifestPath))) throw new Error(`Falta el manifiesto de staging: ${stageManifestPath}`);
  const stageManifest = parseJsonTextAllowBom(await readFile(stageManifestPath, "utf8"));
  const baselineSha256 = migrationBaselineFingerprint(options.baseline);
  if (stageManifest?.baselineSha256 !== baselineSha256) {
    throw new Error("El staging no fue creado con el baseline indicado para el cutover.");
  }
  const validateMigration = options.validateMigration ?? validateFinalMigrationState;
  await mkdir(dirname(rollback), { recursive: true });
  const result = await transactionalCutoverForTest({
    staging: stagingProjects,
    target,
    rollback,
    validate: async () => await validateMigration(options.baseline, options.decisions),
  });
  return {
    format: "solara-portable-migration-cutover",
    version: 1,
    cutoverAt: new Date().toISOString(),
    target,
    rollback,
    ...result,
    verification: result.validation,
  };
}

async function renameWithRetry(source, destination, renameFile = rename) {
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    try {
      await renameFile(source, destination);
      return;
    } catch (error) {
      const transient = ["EPERM", "EBUSY", "EACCES"].includes(error?.code);
      if (!transient || attempt === 4) throw error;
      await new Promise((resolveDelay) => setTimeout(resolveDelay, attempt * 200));
    }
  }
}

export async function transactionalCutoverForTest(options) {
  const staging = resolve(options.staging);
  const target = resolve(options.target);
  const rollback = resolve(options.rollback);
  if (await exists(rollback)) throw new Error("El destino de rollback ya existe; no se sobrescribe.");
  if (!(await exists(staging))) throw new Error("No existe staging.");
  const targetExists = await exists(target);
  if (targetExists) await renameWithRetry(target, rollback, options.renameFile);
  try {
    await renameWithRetry(staging, target, options.renameFile);
    const validation = await options.validate(target);
    return { ok: true, rollbackCreated: targetExists, validation };
  } catch (error) {
    if (await exists(target)) {
      await renameWithRetry(target, staging, options.renameFile);
    }
    if (targetExists && (await exists(rollback))) {
      await renameWithRetry(rollback, target, options.renameFile);
    }
    throw error;
  }
}

function parseCli(argv) {
  const parsed = { command: null, output: null, baseline: null, baselineOutput: null, decisions: null, snapshotRoot: null, snapshotManifest: null, destination: null, stageRoot: null, rollback: null, hashAll: false, json: false, semantic: true, compressionRatio: DEFAULT_COMPRESSION_RATIO };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (["--audit", "--verify", "--snapshot-original", "--snapshot-definitive", "--stage", "--archive", "--cutover"].includes(token)) parsed.command = token.slice(2);
    else if (token === "--hash-all") parsed.hashAll = true;
    else if (token === "--json") parsed.json = true;
    else if (token === "--no-semantic") parsed.semantic = false;
    else if (token === "--output") parsed.output = argv[++index];
    else if (token === "--baseline") parsed.baseline = argv[++index];
    else if (token === "--baseline-output") parsed.baselineOutput = argv[++index];
    else if (token === "--decisions") parsed.decisions = argv[++index];
    else if (token === "--snapshot-root") parsed.snapshotRoot = argv[++index];
    else if (token === "--snapshot-manifest") parsed.snapshotManifest = argv[++index];
    else if (token === "--destination") parsed.destination = argv[++index];
    else if (token === "--stage-root") parsed.stageRoot = argv[++index];
    else if (token === "--rollback") parsed.rollback = argv[++index];
    else if (token === "--compression-ratio") parsed.compressionRatio = Number(argv[++index]);
    else if (token === "--help" || token === "-h") parsed.command = "help";
    else throw new Error(`Argumento desconocido: ${token}`);
  }
  return parsed;
}

function printHelp() {
  console.log(`Uso:\n  node scripts/migrate-portable-to-development.mjs --audit [--decisions decisiones.json] [--snapshot-root A:\\] [--hash-all] [--output archivo.json] [--compression-ratio 0.75]\n  node scripts/migrate-portable-to-development.mjs --snapshot-original --decisions decisiones.json --destination A:\\SolaraCommerce-Migration\\00-ORIGINAL-INMUTABLE [--output reporte.json]\n  node scripts/migrate-portable-to-development.mjs --snapshot-definitive --decisions decisiones.json --destination A:\\SolaraCommerce-Migration\\01-FUENTE-DEFINITIVA --baseline-output auditoria-definitiva.json [--output reporte.json]\n  node scripts/migrate-portable-to-development.mjs --stage --snapshot-manifest A:\\...\\snapshot-manifest.json --baseline auditoria-definitiva.json --decisions decisiones.json [--stage-root .migration-staging] [--output reporte.json]\n  node scripts/migrate-portable-to-development.mjs --archive --snapshot-manifest A:\\...\\snapshot-manifest.json --baseline auditoria-definitiva.json --decisions decisiones.json [--output reporte.json]\n  node scripts/migrate-portable-to-development.mjs --cutover --baseline auditoria-definitiva.json --decisions decisiones.json --stage-root .migration-staging --rollback .migration-rollback\\proyectos-before-cutover [--output reporte.json]\n  node scripts/migrate-portable-to-development.mjs --verify --baseline audit.json --decisions decisiones.json [--output verificacion.json]\n\nLos comandos de copia fallan si encuentran un destino divergente. El cutover conserva rollback y no elimina la portable.`);
}

function printAuditSummary(report) {
  console.log(`Portable: ${report.sources.portable.stores.length} tiendas, ${formatBytes(report.sources.portable.inventory.bytes)}`);
  console.log(`Normal: ${report.sources.normal.stores.length} tiendas, ${formatBytes(report.sources.normal.inventory.bytes)}`);
  console.log(`Temporal Stylo: ${report.sources.looseEvidence.exists ? "presente" : "ausente"}, ${formatBytes(report.sources.looseEvidence.inventory.bytes)}`);
  console.log(`Runtime portable: ${formatBytes(report.sources.portableRuntime.bytes)}`);
  if (report.space.mode === "split-volume") {
    console.log(`Espacio local: ${formatBytes(report.space.local.freeBytes)} libres / ${formatBytes(report.space.local.requiredBytes)} requeridos`);
    console.log(`Espacio snapshots (${report.space.snapshotRoot}): ${formatBytes(report.space.snapshots.freeBytes)} libres / ${formatBytes(report.space.snapshots.requiredBytes)} requeridos`);
  } else {
    console.log(`Espacio libre: ${formatBytes(report.space.freeBytes)}`);
    console.log(`Espacio adicional estimado: ${formatBytes(report.space.requiredAdditionalBytes)} (ratio ${report.space.compressionRatio})`);
  }
  console.log(`Errores de fuente: ${report.errors.length}`);
  console.log(`IDs duplicados observados: ${report.duplicateProjectIds.length}`);
  console.log(`IDs duplicados sin resolver: ${report.unresolvedDuplicateProjectIds.length}`);
  console.log(`Bloqueos: ${report.blockers.join(", ") || "ninguno"}`);
  console.log(`Ready snapshot definitivo: ${report.readyForDefinitiveSnapshot ? "SI" : "NO"}`);
}

async function writeJsonReport(pathname, value) {
  const target = isAbsolute(pathname) ? pathname : resolve(REPO_ROOT, pathname);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  return target;
}

async function main() {
  const cli = parseCli(process.argv.slice(2));
  if (!cli.command || cli.command === "help") {
    printHelp();
    return;
  }
  if (cli.command === "audit") {
    const decisions = cli.decisions ? parseJsonTextAllowBom(await readFile(resolve(REPO_ROOT, cli.decisions), "utf8")) : null;
    const report = await auditMigrationSources({ hashAll: cli.hashAll, semantic: cli.semantic, compressionRatio: cli.compressionRatio, decisions, snapshotRoot: cli.snapshotRoot });
    printAuditSummary(report);
    if (cli.output) console.log(`Reporte: ${await writeJsonReport(cli.output, report)}`);
    if (cli.json) console.log(JSON.stringify(report, null, 2));
    process.exitCode = report.errors.length > 0 ? 2 : report.blockers.length > 0 ? 3 : 0;
    return;
  }
  if (cli.command === "verify") {
    if (!cli.baseline || !cli.decisions) throw new Error("--verify requiere --baseline y --decisions.");
    const baseline = parseJsonTextAllowBom(await readFile(resolve(REPO_ROOT, cli.baseline), "utf8"));
    const decisions = parseJsonTextAllowBom(await readFile(resolve(REPO_ROOT, cli.decisions), "utf8"));
    const result = await verifyMigrationFromBaseline(baseline, decisions);
    if (cli.output) console.log(`Reporte: ${await writeJsonReport(cli.output, result)}`);
    if (cli.json || !cli.output) console.log(JSON.stringify(result, null, 2));
    process.exitCode = result.ok ? 0 : 4;
    return;
  }
  if (cli.command === "snapshot-original") {
    if (!cli.decisions || !cli.destination) {
      throw new Error("--snapshot-original requiere --decisions y --destination.");
    }
    const decisions = parseJsonTextAllowBom(await readFile(resolve(REPO_ROOT, cli.decisions), "utf8"));
    const result = await createOriginalMigrationSnapshot({
      decisions,
      destinationRoot: isAbsolute(cli.destination) ? cli.destination : resolve(REPO_ROOT, cli.destination),
      snapshotSpaceRoot: cli.snapshotRoot,
      semantic: cli.semantic,
      compressionRatio: cli.compressionRatio,
    });
    console.log(`Snapshot original verificado: ${result.destinationRoot}`);
    console.log(`Fuentes copiadas: ${result.entries.length}`);
    console.log(`Bytes verificados: ${result.entries.reduce((sum, entry) => sum + entry.bytes, 0)}`);
    if (cli.output) console.log(`Reporte: ${await writeJsonReport(cli.output, result)}`);
    if (cli.json) console.log(JSON.stringify(result, null, 2));
    return;
  }
  if (cli.command === "snapshot-definitive") {
    if (!cli.decisions || !cli.destination || !cli.baselineOutput) {
      throw new Error("--snapshot-definitive requiere --decisions, --destination y --baseline-output.");
    }
    const decisions = parseJsonTextAllowBom(await readFile(resolve(REPO_ROOT, cli.decisions), "utf8"));
    const result = await createDefinitiveMigrationSnapshot({
      decisions,
      destinationRoot: isAbsolute(cli.destination) ? cli.destination : resolve(REPO_ROOT, cli.destination),
      snapshotSpaceRoot: cli.snapshotRoot,
      semantic: cli.semantic,
      compressionRatio: cli.compressionRatio,
    });
    const baselinePath = await writeJsonReport(cli.baselineOutput, result.baseline);
    console.log(`Snapshot definitivo verificado: ${result.snapshot.destinationRoot}`);
    console.log(`Baseline definitivo: ${baselinePath}`);
    console.log(`SHA-256 lógico del baseline: ${result.baselineSha256}`);
    if (cli.output) console.log(`Reporte: ${await writeJsonReport(cli.output, result)}`);
    if (cli.json) console.log(JSON.stringify(result, null, 2));
    return;
  }
  if (cli.command === "stage") {
    if (!cli.snapshotManifest || !cli.baseline || !cli.decisions) {
      throw new Error("--stage requiere --snapshot-manifest, --baseline y --decisions.");
    }
    const snapshot = parseJsonTextAllowBom(await readFile(resolve(REPO_ROOT, cli.snapshotManifest), "utf8"));
    const baseline = parseJsonTextAllowBom(await readFile(resolve(REPO_ROOT, cli.baseline), "utf8"));
    const decisions = parseJsonTextAllowBom(await readFile(resolve(REPO_ROOT, cli.decisions), "utf8"));
    const result = await prepareStagingFromSnapshot({
      snapshot,
      baseline,
      decisions,
      stageRoot: cli.stageRoot ? resolve(REPO_ROOT, cli.stageRoot) : undefined,
    });
    console.log(`Staging verificado: ${result.stageRoot}`);
    console.log(`Tiendas activas preparadas: ${result.entries.length}`);
    if (cli.output) console.log(`Reporte: ${await writeJsonReport(cli.output, result)}`);
    if (cli.json) console.log(JSON.stringify(result, null, 2));
    return;
  }
  if (cli.command === "archive") {
    if (!cli.snapshotManifest || !cli.baseline || !cli.decisions) {
      throw new Error("--archive requiere --snapshot-manifest, --baseline y --decisions.");
    }
    const snapshot = parseJsonTextAllowBom(await readFile(resolve(REPO_ROOT, cli.snapshotManifest), "utf8"));
    const baseline = parseJsonTextAllowBom(await readFile(resolve(REPO_ROOT, cli.baseline), "utf8"));
    const decisions = parseJsonTextAllowBom(await readFile(resolve(REPO_ROOT, cli.decisions), "utf8"));
    const result = await archiveMigrationFromSnapshot({ snapshot, baseline, decisions });
    console.log(`Entradas archivadas y verificadas: ${result.entries.length}`);
    if (cli.output) console.log(`Reporte: ${await writeJsonReport(cli.output, result)}`);
    if (cli.json) console.log(JSON.stringify(result, null, 2));
    process.exitCode = result.ok ? 0 : 5;
    return;
  }
  if (cli.command === "cutover") {
    if (!cli.baseline || !cli.decisions || !cli.stageRoot || !cli.rollback) {
      throw new Error("--cutover requiere --baseline, --decisions, --stage-root y --rollback.");
    }
    const baseline = parseJsonTextAllowBom(await readFile(resolve(REPO_ROOT, cli.baseline), "utf8"));
    const decisions = parseJsonTextAllowBom(await readFile(resolve(REPO_ROOT, cli.decisions), "utf8"));
    const result = await performMigrationCutover({
      baseline,
      decisions,
      stageRoot: resolve(REPO_ROOT, cli.stageRoot),
      rollback: resolve(REPO_ROOT, cli.rollback),
    });
    console.log(`Cutover verificado: ${result.target}`);
    console.log(`Rollback preservado: ${result.rollback}`);
    if (cli.output) console.log(`Reporte: ${await writeJsonReport(cli.output, result)}`);
    if (cli.json) console.log(JSON.stringify(result, null, 2));
    return;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === SCRIPT_PATH) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.stack ?? error.message : String(error));
    process.exitCode = 1;
  });
}

export const MIGRATION_DEFAULTS = {
  repoRoot: REPO_ROOT,
  portableRoot: PORTABLE_ROOT,
  portableProjects: PORTABLE_PROJECTS,
  portableRuntime: PORTABLE_RUNTIME,
  normalProjects: NORMAL_PROJECTS,
  normalRuntime: NORMAL_RUNTIME,
  temporalStylo: TEMPORAL_STYLO,
  defaultCompressionRatio: DEFAULT_COMPRESSION_RATIO,
  tempDirectory: tmpdir(),
};
