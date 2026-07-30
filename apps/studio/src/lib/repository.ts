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

export interface CachedAsset {
  hash: string;
  originalName: string;
  mimeType: string;
  width: number;
  height: number;
  primary: string;
  fallback: string;
  responsive: Array<{ width: number; source: string }>;
  createdAt: string;
}

class SolaraDatabase extends Dexie {
  projects!: EntityTable<StoredProject, "id">;
  assetCache!: EntityTable<CachedAsset, "hash">;

  constructor() {
    super("solara-commerce-studio");
    this.version(1).stores({
      projects: "id, status, updatedAt, name",
      assetCache: "hash, createdAt",
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
  return database.projects.orderBy("updatedAt").reverse().toArray();
}

export async function getProject(id: string): Promise<StoreProjectV1 | undefined> {
  const record = await database.projects.get(id);
  return record ? StoreProjectV1Schema.parse(record.project) : undefined;
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

export async function putCachedAsset(asset: CachedAsset): Promise<void> {
  await database.assetCache.put(asset);
}

export async function getCachedAsset(hash: string): Promise<CachedAsset | undefined> {
  return database.assetCache.get(hash);
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
