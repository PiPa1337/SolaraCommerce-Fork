import { createHash } from "node:crypto";
import { lstatSync, readdirSync, readFileSync, statSync } from "node:fs";
import { basename, join, relative, resolve, sep } from "node:path";
import { type StoreProjectV1, StoreProjectV2Schema } from "../packages/project-schema/src/index";

export const RM_PROJECTS_ROOT =
  process.env.SOLARA_RM_PROJECTS_ROOT ?? ".release/portable/SolaraCommerce-Portable/proyectos";
export const RM_STORE_FOLDER = process.env.SOLARA_RM_STORE_FOLDER ?? "rm-descartables--704e2877";
export const RM_EXPECTED_VERSION = Number(process.env.SOLARA_RM_EXPECTED_VERSION ?? 31);
export const RM_STORE_ID = "store-rm-descartables";

export interface RmManifest {
  format: string;
  manifestVersion: number;
  projectId: string;
  storeName: string;
  slug: string;
  schemaVersion: number;
  status: string;
  current: {
    version: number;
    key: string;
    projectPath: string;
    sha256: string;
    savedAt: string;
    projectUpdatedAt: string;
  };
  lastValidSite?: {
    files: number;
    bytes: number;
    version: number;
    key: string;
    directoryPath: string;
    sha256: string;
    savedAt: string;
    rendererFingerprint: string | null;
  };
}

export interface RmFileInventory {
  fileCount: number;
  totalBytes: number;
  fingerprint: string;
}

export interface RmIntegrity {
  manifestBytes: number;
  manifestSha256: string;
  manifestVersion: number;
  currentVersion: number;
  currentProjectPath: string;
  currentSavedAt: string;
  projectUpdatedAt: string;
  snapshotBytes: number;
  snapshotSha256: string;
  fileCount: number;
  folderBytes: number;
  fileInventorySha256: string;
}

export interface RmSourceSnapshot {
  projectDir: string;
  manifestPath: string;
  snapshotPath: string;
  manifest: RmManifest;
  snapshotBytes: Uint8Array;
  snapshotText: string;
  project: StoreProjectV1;
  integrity: RmIntegrity;
  fileInventory: RmFileInventory;
}

function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function isInside(root: string, target: string): boolean {
  const rootPath = resolve(root);
  const targetPath = resolve(target);
  const normalizedRoot = process.platform === "win32" ? rootPath.toLowerCase() : rootPath;
  const normalizedTarget = process.platform === "win32" ? targetPath.toLowerCase() : targetPath;
  return (
    normalizedTarget === normalizedRoot || normalizedTarget.startsWith(`${normalizedRoot}${sep}`)
  );
}

function readManifest(manifestPath: string): RmManifest {
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as RmManifest;
  if (!manifest.current || typeof manifest.current.projectPath !== "string") {
    throw new Error("El manifest de RM no tiene current.projectPath.");
  }
  if (manifest.projectId !== RM_STORE_ID) {
    throw new Error(`El proyecto leído no es RM Descartables (${manifest.projectId}).`);
  }
  if (manifest.current.version !== RM_EXPECTED_VERSION) {
    throw new Error(
      `RM Descartables cambió de versión: se esperaba v${RM_EXPECTED_VERSION}, se encontró v${manifest.current.version}.`,
    );
  }
  return manifest;
}

function captureInventory(root: string): RmFileInventory {
  const rows: string[] = [];
  let totalBytes = 0;

  const visit = (directory: string): void => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) {
        visit(path);
        continue;
      }
      const info = lstatSync(path);
      const relativePath = relative(root, path).replaceAll("\\", "/");
      const kind = info.isSymbolicLink() ? "symlink" : "file";
      rows.push(`${relativePath}\t${kind}\t${info.size}\t${info.mtimeMs}`);
      totalBytes += info.size;
    }
  };

  visit(root);
  rows.sort();
  return {
    fileCount: rows.length,
    totalBytes,
    fingerprint: sha256(new TextEncoder().encode(rows.join("\n"))),
  };
}

export function loadRmSnapshot(projectsRoot = RM_PROJECTS_ROOT): RmSourceSnapshot {
  const projectDir = resolve(projectsRoot, RM_STORE_FOLDER);
  const manifestPath = join(projectDir, "manifest.json");
  const manifest = readManifest(manifestPath);
  const snapshotPath = resolve(projectDir, manifest.current.projectPath);
  if (
    !isInside(projectDir, snapshotPath) ||
    basename(snapshotPath) !== basename(manifest.current.projectPath)
  ) {
    throw new Error("El current.projectPath de RM sale de su carpeta administrada.");
  }

  // El loader sólo lee el manifest y el current.solara.json. El inventario de
  // abajo usa únicamente metadatos del filesystem para poder probar que no se
  // tocó ningún backup ni sitio histórico; no abre sus contenidos.
  const snapshotBytes = new Uint8Array(readFileSync(snapshotPath));
  const snapshotSha256 = sha256(snapshotBytes);
  if (snapshotSha256 !== manifest.current.sha256) {
    throw new Error("El hash SHA-256 del snapshot actual no coincide con el manifest.");
  }
  const snapshotText = new TextDecoder().decode(snapshotBytes);
  const envelope = JSON.parse(snapshotText) as { project?: unknown } | unknown;
  const project = StoreProjectV2Schema.parse(
    typeof envelope === "object" && envelope !== null && "project" in envelope
      ? envelope.project
      : envelope,
  );
  if (project.id !== manifest.projectId) {
    throw new Error(`El snapshot tiene un projectId inesperado (${project.id}).`);
  }

  const fileInventory = captureInventory(projectDir);
  const integrity: RmIntegrity = {
    manifestBytes: statSync(manifestPath).size,
    manifestSha256: sha256(new Uint8Array(readFileSync(manifestPath))),
    manifestVersion: manifest.manifestVersion,
    currentVersion: manifest.current.version,
    currentProjectPath: manifest.current.projectPath,
    currentSavedAt: manifest.current.savedAt,
    projectUpdatedAt: manifest.current.projectUpdatedAt,
    snapshotBytes: snapshotBytes.byteLength,
    snapshotSha256,
    fileCount: fileInventory.fileCount,
    folderBytes: fileInventory.totalBytes,
    fileInventorySha256: fileInventory.fingerprint,
  };
  return {
    projectDir,
    manifestPath,
    snapshotPath,
    manifest,
    snapshotBytes,
    snapshotText,
    project,
    integrity,
    fileInventory,
  };
}

export function captureRmIntegrity(snapshot: RmSourceSnapshot): RmIntegrity {
  const manifestBytes = new Uint8Array(readFileSync(snapshot.manifestPath));
  const manifest = JSON.parse(new TextDecoder().decode(manifestBytes)) as RmManifest;
  const snapshotBytes = new Uint8Array(readFileSync(snapshot.snapshotPath));
  const fileInventory = captureInventory(snapshot.projectDir);
  return {
    manifestBytes: manifestBytes.byteLength,
    manifestSha256: sha256(manifestBytes),
    manifestVersion: manifest.manifestVersion,
    currentVersion: manifest.current.version,
    currentProjectPath: manifest.current.projectPath,
    currentSavedAt: manifest.current.savedAt,
    projectUpdatedAt: manifest.current.projectUpdatedAt,
    snapshotBytes: snapshotBytes.byteLength,
    snapshotSha256: sha256(snapshotBytes),
    fileCount: fileInventory.fileCount,
    folderBytes: fileInventory.totalBytes,
    fileInventorySha256: fileInventory.fingerprint,
  };
}

export function assertRmIntegrityUnchanged(before: RmIntegrity, after: RmIntegrity): void {
  const keys: Array<keyof RmIntegrity> = [
    "manifestBytes",
    "manifestSha256",
    "manifestVersion",
    "currentVersion",
    "currentProjectPath",
    "currentSavedAt",
    "projectUpdatedAt",
    "snapshotBytes",
    "snapshotSha256",
    "fileCount",
    "folderBytes",
    "fileInventorySha256",
  ];
  const changed = keys.filter((key) => before[key] !== after[key]);
  if (changed.length > 0) {
    throw new Error(`La integridad de RM cambió durante el audit: ${changed.join(", ")}.`);
  }
}

export function encodedDataUrlBytes(source: string): number {
  if (!source.startsWith("data:")) return 0;
  const comma = source.indexOf(",");
  if (comma < 0) return 0;
  const payload = source.slice(comma + 1);
  if (/;base64/i.test(source.slice(0, comma))) {
    const padding = payload.endsWith("==") ? 2 : payload.endsWith("=") ? 1 : 0;
    return Math.max(0, Math.floor((payload.length * 3) / 4) - padding);
  }
  try {
    return new TextEncoder().encode(decodeURIComponent(payload)).byteLength;
  } catch {
    return new TextEncoder().encode(payload).byteLength;
  }
}

export function summarizeProject(project: StoreProjectV1): Record<string, number | string> {
  let dataUrlAssets = 0;
  let dataUrlBytes = 0;
  for (const asset of project.assets) {
    if (!asset.source.startsWith("data:")) continue;
    dataUrlAssets += 1;
    dataUrlBytes += encodedDataUrlBytes(asset.source);
  }
  return {
    products: project.products.length,
    activeProducts: project.products.filter((product) => product.status === "active").length,
    hiddenProducts: project.products.filter((product) => product.status !== "active").length,
    variants: project.products.reduce((total, product) => total + product.variants.length, 0),
    categories: project.categories.length,
    collections: project.collections.length,
    assets: project.assets.length,
    dataUrlAssets,
    dataUrlBytes,
    videos: project.videos.length,
    pages: project.pages.length,
    sections: project.sections.length,
    schemaVersion: project.schemaVersion,
    designFamily: project.commerceTemplates.designFamily,
  };
}
