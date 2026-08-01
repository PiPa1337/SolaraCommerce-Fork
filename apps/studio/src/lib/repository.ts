import type { StoreProjectV1 } from "@solara/project-schema";
import { StoreProjectV1Schema } from "@solara/project-schema";
import { referenceStore } from "@solara/project-schema/fixture";
import Dexie, { type EntityTable } from "dexie";

export interface StoredProject {
  id: string;
  name: string;
  status: StoreProjectV1["status"];
  updatedAt: string;
  project: StoreProjectV1;
}

export interface ProjectRecoveryIssue {
  id: string;
  name: string;
  updatedAt: string;
  message: string;
}

export interface ProjectListResult {
  projects: StoredProject[];
  recovery: ProjectRecoveryIssue[];
}

export interface CachedAsset {
  cacheKey: string;
  hash: string;
  recipeVersion: number;
  originalName: string;
  mimeType: string;
  width: number;
  height: number;
  primary: string;
  fallback: string;
  responsive: Array<{ width: number; source: string }>;
  createdAt: string;
  lastUsedAt: string;
}

export const ASSET_CACHE_RECIPE_VERSION = 1;

export function createAssetCacheKey(
  hash: string,
  recipeVersion = ASSET_CACHE_RECIPE_VERSION,
): string {
  return `${hash}:recipe-${recipeVersion}`;
}

class SolaraDatabase extends Dexie {
  projects!: EntityTable<StoredProject, "id">;
  assetCache!: EntityTable<CachedAsset, "cacheKey">;

  constructor() {
    super("solara-commerce-studio");
    this.version(1).stores({
      projects: "id, status, updatedAt, name",
      assetCache: "hash, createdAt",
    });
    this.version(2)
      .stores({
        projects: "id, status, updatedAt, name",
        assetCache: "cacheKey, hash, recipeVersion, createdAt, lastUsedAt",
      })
      .upgrade(async (transaction) => {
        // La caché es regenerable; descartarla evita reutilizar resultados de una receta anterior.
        await transaction.table("assetCache").clear();
      });
  }
}

export const database = new SolaraDatabase();

function toRecord(project: StoreProjectV1): StoredProject {
  return {
    id: project.id,
    name: project.name,
    status: project.status,
    updatedAt: project.updatedAt,
    project,
  };
}

async function sourceAsDataUrl(source: string): Promise<string> {
  const response = await fetch(source);
  if (!response.ok) throw new Error(`No se pudo cargar el recurso inicial ${source}.`);
  const blob = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => resolve(String(reader.result)));
    reader.addEventListener("error", () => reject(new Error(`No se pudo leer ${source}.`)));
    reader.readAsDataURL(blob);
  });
}

async function embedFixtureAssets(project: StoreProjectV1): Promise<StoreProjectV1> {
  const assets = await Promise.all(
    project.assets.map(async (asset) =>
      asset.source.startsWith("/fixtures/")
        ? { ...asset, source: await sourceAsDataUrl(asset.source) }
        : asset,
    ),
  );
  return StoreProjectV1Schema.parse({ ...project, assets });
}

export async function listProjects(): Promise<StoredProject[]> {
  return (await listProjectsWithRecovery()).projects;
}

function schemaErrorMessage(error: {
  issues?: Array<{ path: PropertyKey[]; message: string }>;
}): string {
  const first = error.issues?.[0];
  if (!first) return "El proyecto no supera la validación actual.";
  const path = first.path.map(String).join(".") || "project";
  return `${path}: ${first.message}`;
}

export async function listProjectsWithRecovery(): Promise<ProjectListResult> {
  const records = await database.projects.orderBy("updatedAt").reverse().toArray();
  const projects: StoredProject[] = [];
  const recovery: ProjectRecoveryIssue[] = [];
  for (const record of records) {
    const parsed = StoreProjectV1Schema.safeParse(record.project);
    if (parsed.success) {
      projects.push({ ...record, project: parsed.data });
    } else {
      recovery.push({
        id: record.id,
        name: record.name,
        updatedAt: record.updatedAt,
        message: schemaErrorMessage(parsed.error),
      });
    }
  }
  return { projects, recovery };
}

export async function getProject(id: string): Promise<StoreProjectV1 | undefined> {
  const record = await database.projects.get(id);
  if (!record) return undefined;
  const parsed = StoreProjectV1Schema.safeParse(record.project);
  if (!parsed.success) {
    throw new Error(
      `La tienda "${record.name}" no se puede abrir. Exportá un respaldo anterior y recuperala desde Importar respaldo. ${schemaErrorMessage(parsed.error)}`,
    );
  }
  return parsed.data;
}

export async function saveProject(project: StoreProjectV1): Promise<void> {
  const validProject = StoreProjectV1Schema.parse(project);
  await database.transaction("rw", database.projects, async () => {
    await database.projects.put(toRecord(validProject));
  });
}

export async function createProject(name: string): Promise<StoreProjectV1> {
  const timestamp = new Date().toISOString();
  const suffix = crypto.randomUUID();
  const normalizedName = name.trim() || "Nueva tienda";
  const project = await embedFixtureAssets(
    StoreProjectV1Schema.parse({
      ...structuredClone(referenceStore),
      id: `store-${suffix}`,
      name: normalizedName,
      slug: slugify(normalizedName, suffix.slice(0, 6)),
      status: "active",
      baseUrl: `https://${slugify(normalizedName, suffix.slice(0, 6))}.example`,
      createdAt: timestamp,
      updatedAt: timestamp,
      identity: {
        ...structuredClone(referenceStore.identity),
        legalName: normalizedName,
        brandName: normalizedName,
      },
    }),
  );
  await saveProject(project);
  return project;
}

export async function ensureFirstProject(): Promise<StoreProjectV1> {
  const first = await database.projects.orderBy("updatedAt").reverse().first();
  if (first) return StoreProjectV1Schema.parse(first.project);
  const initial = await embedFixtureAssets(
    StoreProjectV1Schema.parse(structuredClone(referenceStore)),
  );
  await saveProject(initial);
  return initial;
}

export async function duplicateProject(id: string): Promise<StoreProjectV1> {
  const source = await getProject(id);
  if (!source) throw new Error("No se encontró la tienda para duplicar.");
  const timestamp = new Date().toISOString();
  const suffix = crypto.randomUUID();
  const project = StoreProjectV1Schema.parse({
    ...structuredClone(source),
    id: `store-${suffix}`,
    name: `${source.name} copia`,
    slug: slugify(`${source.slug}-copia`, suffix.slice(0, 6)),
    status: "active",
    createdAt: timestamp,
    updatedAt: timestamp,
  });
  await saveProject(project);
  return project;
}

export async function setProjectArchived(id: string, archived: boolean): Promise<void> {
  const project = await getProject(id);
  if (!project) throw new Error("No se encontró la tienda.");
  await saveProject(
    StoreProjectV1Schema.parse({
      ...project,
      status: archived ? "archived" : "active",
      updatedAt: new Date().toISOString(),
    }),
  );
}

export async function putCachedAsset(
  asset: Omit<CachedAsset, "cacheKey" | "recipeVersion" | "lastUsedAt"> &
    Partial<Pick<CachedAsset, "recipeVersion" | "lastUsedAt">>,
): Promise<void> {
  const recipeVersion = asset.recipeVersion ?? ASSET_CACHE_RECIPE_VERSION;
  const timestamp = asset.lastUsedAt ?? new Date().toISOString();
  await database.assetCache.put({
    ...asset,
    cacheKey: createAssetCacheKey(asset.hash, recipeVersion),
    recipeVersion,
    lastUsedAt: timestamp,
  });
}

export async function getCachedAsset(
  hash: string,
  recipeVersion = ASSET_CACHE_RECIPE_VERSION,
): Promise<CachedAsset | undefined> {
  const cacheKey = createAssetCacheKey(hash, recipeVersion);
  const cached = await database.assetCache.get(cacheKey);
  if (!cached) return undefined;
  const lastUsedAt = new Date().toISOString();
  await database.assetCache.update(cacheKey, { lastUsedAt });
  return { ...cached, lastUsedAt };
}

export interface StorageEstimate {
  usage: number;
  quota: number;
  ratio: number;
}

export async function getStorageEstimate(): Promise<StorageEstimate | undefined> {
  if (typeof navigator === "undefined" || !navigator.storage?.estimate) return undefined;
  const estimate = await navigator.storage.estimate();
  const usage = estimate.usage ?? 0;
  const quota = estimate.quota ?? 0;
  return {
    usage,
    quota,
    ratio: quota > 0 ? usage / quota : 0,
  };
}

export async function requestPersistentStorage(): Promise<boolean> {
  if (typeof navigator === "undefined" || !navigator.storage?.persist) return false;
  return navigator.storage.persist();
}

export async function clearAssetCache(): Promise<void> {
  await database.assetCache.clear();
}

export function slugify(value: string, fallback = "tienda"): string {
  const slug = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 110);
  return slug || fallback;
}
