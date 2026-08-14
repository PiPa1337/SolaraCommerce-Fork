/**
 * Repositorio local Dexie y recovery. Es cache regenerable cuando el servidor
 * gestionado está activo y fallback de desarrollo cuando Studio corre sólo con
 * Vite; el código de UI no debe asumir que IndexedDB es siempre autoridad.
 */
import type { NavigationItem, StoreProjectV1 } from "@solara/project-schema";
import { getCategoryProductIds, StoreProjectV1Schema } from "@solara/project-schema";
import { catalogModernStore } from "@solara/project-schema/catalog-modern-fixture";
import {
  buildCatalogModernProject,
  catalogModernCleanStore,
} from "@solara/project-schema/catalog-modern-template";
import { catalogModernV2Store } from "@solara/project-schema/catalog-modern-v2-fixture";
import Dexie, { type EntityTable } from "dexie";

export interface StoredProject {
  id: string;
  name: string;
  status: StoreProjectV1["status"];
  updatedAt: string;
  project: StoreProjectV1;
  diskVersion?: number;
  diskSiteStatus?: "synced" | "site-outdated";
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

export interface RecoveryDraft {
  projectId: string;
  baseDiskVersion: number;
  updatedAt: string;
  project: StoreProjectV1;
}

export interface ProjectMigrationRecord {
  projectId: string;
  status: "pending" | "done";
  updatedAt: string;
}

export const ASSET_CACHE_RECIPE_VERSION = 2;

export function createAssetCacheKey(
  hash: string,
  recipeVersion = ASSET_CACHE_RECIPE_VERSION,
): string {
  return `${hash}:recipe-${recipeVersion}`;
}

class SolaraDatabase extends Dexie {
  projects!: EntityTable<StoredProject, "id">;
  assetCache!: EntityTable<CachedAsset, "hash">;
  recoveryDrafts!: EntityTable<RecoveryDraft, "projectId">;
  migrations!: EntityTable<ProjectMigrationRecord, "projectId">;

  constructor() {
    super("solara-commerce-studio");
    this.version(1).stores({
      projects: "id, status, updatedAt, name",
      assetCache: "hash, createdAt",
    });
    this.version(2)
      .stores({
        projects: "id, status, updatedAt, name",
        // IndexedDB no permite cambiar la clave primaria durante una migración.
        // `hash` se conserva como clave desde la versión 1 y la caché se regenera.
        assetCache: "hash, cacheKey, recipeVersion, createdAt, lastUsedAt",
      })
      .upgrade(async (transaction) => {
        // La caché es regenerable; descartarla evita reutilizar resultados de una receta anterior.
        await transaction.table("assetCache").clear();
      });
    this.version(3).stores({
      projects: "id, status, updatedAt, name",
      assetCache: "hash, cacheKey, recipeVersion, createdAt, lastUsedAt",
      recoveryDrafts: "projectId, updatedAt",
    });
    this.version(4).stores({
      projects: "id, status, updatedAt, name",
      assetCache: "hash, cacheKey, recipeVersion, createdAt, lastUsedAt",
      recoveryDrafts: "projectId, updatedAt",
      migrations: "projectId, status, updatedAt",
    });
  }
}

export const database = new SolaraDatabase();

export const PROJECT_STORAGE_VERSION = "2";
export const SCALE_DEMO_PROJECT_ID = "store-modo-sur-demo";
export const SCALE_DEMO_PROJECT_NAME = "Predeterminado";
/** Referencia V1 (Modo Sur): convive con Predeterminado V2 en el dashboard. */
export const V1_DEMO_PROJECT_ID = "store-modo-sur";
/** Predeterminado V1: la misma demo antes de su upgrade a la familia V2. */
export const PREDETERMINADO_V1_PROJECT_ID = "store-modo-sur-demo-v1";
export const PREDETERMINADO_V1_PROJECT_NAME = "Predeterminado V1";
/** Purga única de tiendas: conserva sólo las referencias para comparar. */
export const DEMO_ONLY_PURGE_SENTINEL = "solara-demo-only-purge";
const DEMO_ONLY_PURGE_VERSION = "1";
const DEMO_KEEP_PROJECT_IDS = new Set([
  SCALE_DEMO_PROJECT_ID,
  V1_DEMO_PROJECT_ID,
  PREDETERMINADO_V1_PROJECT_ID,
]);
const LEGACY_SCALE_DEMO_PROJECT_NAME = "Demo Modo Sur, catálogo moderno";
const LEGACY_CLEAN_PROJECT_ID = "store-catalog-modern-clean-default";
const LEGACY_CLEAN_PROJECT_NAME = "Mi primera tienda";

export function buildScaleDemoProject(): StoreProjectV1 {
  const demo = buildCatalogModernProject({
    seed: "demo",
    id: SCALE_DEMO_PROJECT_ID,
    name: SCALE_DEMO_PROJECT_NAME,
    slug: "demo-catalogo-jerarquico",
    baseUrl: "https://demo-catalogo-jerarquico.example",
  });
  return StoreProjectV1Schema.parse({
    ...demo,
    theme: structuredClone(catalogModernV2Store.theme),
    commerceTemplates: {
      ...demo.commerceTemplates,
      designFamily: "catalog-modern-v2",
    },
  });
}

/** Amplía sólo el seed demo existente; nunca reescribe galerías personalizadas. */
export function expandCatalogModernDemoGalleries(project: StoreProjectV1): StoreProjectV1 {
  if (project.id !== SCALE_DEMO_PROJECT_ID || project.origin?.seed !== "demo") return project;
  const reference = buildCatalogModernProject({ seed: "demo" });
  const availableAssetIds = new Set(project.assets.map((asset) => asset.id));
  let changed = false;
  const products = project.products.map((product) => {
    const desired = reference.products.find((candidate) => candidate.id === product.id);
    if (!desired || product.imageIds.length >= 3 || product.imageIds[0] !== desired.imageIds[0]) {
      return product;
    }
    const imageIds = [...product.imageIds];
    for (const imageId of desired.imageIds) {
      if (availableAssetIds.has(imageId) && !imageIds.includes(imageId)) imageIds.push(imageId);
    }
    if (imageIds.length === product.imageIds.length) return product;
    changed = true;
    return { ...product, imageIds };
  });
  return changed
    ? StoreProjectV1Schema.parse({ ...project, products, updatedAt: new Date().toISOString() })
    : project;
}

const STORAGE_SENTINEL = "solara-studio-storage-version";
export const DEPRECATED_CATEGORY_CLEANUP_SENTINEL = "solara-deprecated-category-cleanup";
const DEPRECATED_CATEGORY_CLEANUP_VERSION = "1";
let storageReady: Promise<void> | undefined;
let storageReset = false;

async function ensureStorageVersion(): Promise<void> {
  if (typeof localStorage === "undefined") return;
  if (localStorage.getItem(STORAGE_SENTINEL) === PROJECT_STORAGE_VERSION) return;
  try {
    database.close();
    await Dexie.delete("solara-commerce-studio");
    await database.open();
    localStorage.setItem(STORAGE_SENTINEL, PROJECT_STORAGE_VERSION);
    storageReset = true;
  } catch {
    throw new Error(
      "No se pudo reiniciar la base local. Cerrá otras pestañas de SolaraCommerce y volvé a abrir la app.",
    );
  }
}

async function ready(): Promise<void> {
  storageReady ??= ensureStorageVersion();
  await storageReady;
}

export function consumeStorageResetNotice(): boolean {
  const wasReset = storageReset;
  storageReset = false;
  return wasReset;
}

function toRecord(project: StoreProjectV1): StoredProject {
  return {
    id: project.id,
    name: project.name,
    status: project.status,
    updatedAt: project.updatedAt,
    project,
  };
}

function repairModernGreeting(project: StoreProjectV1): StoreProjectV1 {
  if (
    project.commerceTemplates.designFamily !== "catalog-modern-v1" ||
    project.whatsapp.greeting !== "Hola Casa Luma, quiero hacer este pedido:"
  ) {
    return project;
  }

  return StoreProjectV1Schema.parse({
    ...project,
    whatsapp: {
      ...project.whatsapp,
      greeting: `Hola ${project.identity.brandName}, quiero hacer este pedido:`,
    },
  });
}

function repairScaleDemoPresentation(project: StoreProjectV1): StoreProjectV1 {
  if (project.id !== SCALE_DEMO_PROJECT_ID || project.origin?.seed !== "demo") return project;
  const desired = buildScaleDemoProject();
  if (
    project.commerceTemplates.designFamily === desired.commerceTemplates.designFamily &&
    project.theme.container === desired.theme.container &&
    project.theme.colors.background === desired.theme.colors.background
  ) {
    return project;
  }
  return StoreProjectV1Schema.parse({
    ...project,
    theme: structuredClone(desired.theme),
    commerceTemplates: {
      ...project.commerceTemplates,
      designFamily: desired.commerceTemplates.designFamily,
    },
    updatedAt: new Date().toISOString(),
  });
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

function isDeprecatedCategoryPath(value: string): boolean {
  const pathname = value.split(/[?#]/, 1)[0] ?? value;
  return /^\/categorias\/(?:sale|novedades)(?:\/pagina\/\d+)?\/?$/.test(pathname);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function replaceDeprecatedRoutes(value: unknown, fallbackHref: string): unknown {
  if (typeof value === "string") {
    return isDeprecatedCategoryPath(value) ? fallbackHref : value;
  }
  if (Array.isArray(value)) {
    return value.map((item) => replaceDeprecatedRoutes(item, fallbackHref));
  }
  if (!isRecord(value)) return value;
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [key, replaceDeprecatedRoutes(item, fallbackHref)]),
  );
}

function cleanNavigationItems(items: NavigationItem[], fallbackHref: string): NavigationItem[] {
  return items.flatMap((item) => {
    const children = (item.children ?? []).filter(
      (child) => !child.href || !isDeprecatedCategoryPath(child.href),
    );
    const next = { ...item };
    if (next.href && isDeprecatedCategoryPath(next.href)) {
      next.href = children.length > 0 ? fallbackHref : undefined;
    }
    if (children.length > 0) next.children = children;
    else delete next.children;
    return next.href || next.children ? [next] : [];
  });
}

function fallbackCatalogHref(project: StoreProjectV1): string {
  const activeProductIds = new Set(
    project.products.filter((product) => product.status === "active").map((product) => product.id),
  );
  const collection = project.collections.find((candidate) =>
    candidate.productIds.some((productId) => activeProductIds.has(productId)),
  );
  if (collection) return `/colecciones/${collection.slug}/`;
  const category = project.categories.find(
    (candidate) =>
      !candidate.parentId && candidate.productIds.some((id) => activeProductIds.has(id)),
  );
  return category ? `/categorias/${category.slug}/` : "/buscar/";
}

/** Removes the retired demo categories while preserving products and discoverability. */
export function removeDeprecatedCatalogCategories(project: StoreProjectV1): StoreProjectV1 {
  const deprecatedIds = new Set(
    project.categories
      .filter((category) => category.slug === "sale" || category.slug === "novedades")
      .map((category) => category.id),
  );
  const categories = project.categories
    .filter((category) => !deprecatedIds.has(category.id))
    .map((category): StoreProjectV1["categories"][number] => {
      if (!category.parentId || !deprecatedIds.has(category.parentId)) return category;
      return { ...category, parentId: undefined };
    });
  const fallbackHref = fallbackCatalogHref({ ...project, categories });
  const fallbackCategory = categories.find((category) => !category.parentId)?.id;
  const products = project.products.map((product) => {
    const categoryIds = product.categoryIds.filter((categoryId) => !deprecatedIds.has(categoryId));
    return {
      ...product,
      categoryIds: categoryIds.length || !fallbackCategory ? categoryIds : [fallbackCategory],
      tags: product.tags.filter((tag) => tag !== "sale" && tag !== "novedades"),
    };
  });
  const workingProject = {
    ...project,
    products,
    categories: categories.map((category) => ({ ...category, productIds: [] })),
    navigation: {
      ...project.navigation,
      items: cleanNavigationItems(project.navigation.items, fallbackHref),
    },
    sections: project.sections.map((section) => ({
      ...section,
      settings: replaceDeprecatedRoutes(section.settings, fallbackHref) as typeof section.settings,
    })),
    pages: project.pages.map((page) => ({
      ...page,
      sections: page.sections.map((section) => ({
        ...section,
        settings: replaceDeprecatedRoutes(
          section.settings,
          fallbackHref,
        ) as typeof section.settings,
      })),
    })),
  };
  const finalizedCategories = workingProject.categories.map((category) => ({
    ...category,
    productIds: getCategoryProductIds(workingProject, category.id),
  }));
  return StoreProjectV1Schema.parse({ ...workingProject, categories: finalizedCategories });
}

export async function ensureDeprecatedCategoriesRemoved(): Promise<boolean> {
  await ready();
  if (
    typeof localStorage !== "undefined" &&
    localStorage.getItem(DEPRECATED_CATEGORY_CLEANUP_SENTINEL) ===
      DEPRECATED_CATEGORY_CLEANUP_VERSION
  ) {
    return false;
  }

  const records = await database.projects.toArray();
  const updates: StoredProject[] = [];
  let hasInvalidRecord = false;
  for (const record of records) {
    const parsed = StoreProjectV1Schema.safeParse(record.project);
    if (!parsed.success) {
      hasInvalidRecord = true;
      continue;
    }
    const cleaned = removeDeprecatedCatalogCategories(parsed.data);
    if (JSON.stringify(cleaned) !== JSON.stringify(parsed.data)) updates.push(toRecord(cleaned));
  }
  if (updates.length > 0) {
    await database.transaction("rw", database.projects, async () => {
      for (const record of updates) await database.projects.put(record);
    });
  }
  if (typeof localStorage !== "undefined" && !hasInvalidRecord) {
    localStorage.setItem(DEPRECATED_CATEGORY_CLEANUP_SENTINEL, DEPRECATED_CATEGORY_CLEANUP_VERSION);
  }
  return updates.length > 0;
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
  await ready();
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
  await ready();
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
  await ready();
  const validProject = StoreProjectV1Schema.parse(project);
  await database.transaction("rw", database.projects, async () => {
    await database.projects.put(toRecord(validProject));
  });
}

export async function saveRecoveryDraft(
  project: StoreProjectV1,
  baseDiskVersion = 0,
): Promise<void> {
  await ready();
  const validProject = StoreProjectV1Schema.parse(project);
  await database.recoveryDrafts.put({
    projectId: validProject.id,
    baseDiskVersion,
    updatedAt: new Date().toISOString(),
    project: validProject,
  });
}

export async function getRecoveryDraft(projectId: string): Promise<RecoveryDraft | undefined> {
  await ready();
  const draft = await database.recoveryDrafts.get(projectId);
  if (!draft) return undefined;
  const parsed = StoreProjectV1Schema.safeParse(draft.project);
  return parsed.success ? { ...draft, project: parsed.data } : undefined;
}

export async function clearRecoveryDraft(projectId: string): Promise<void> {
  await ready();
  await database.recoveryDrafts.delete(projectId);
}

export async function markProjectMigration(
  projectId: string,
  status: ProjectMigrationRecord["status"],
): Promise<void> {
  await ready();
  await database.migrations.put({ projectId, status, updatedAt: new Date().toISOString() });
}

export async function getProjectMigration(
  projectId: string,
): Promise<ProjectMigrationRecord | undefined> {
  await ready();
  return database.migrations.get(projectId);
}

export interface CreateProjectOptions {
  name: string;
  brandName?: string;
  email?: string;
  phone?: string;
}

export async function createProject(input: string | CreateProjectOptions): Promise<StoreProjectV1> {
  const timestamp = new Date().toISOString();
  const suffix = crypto.randomUUID();
  const options = typeof input === "string" ? { name: input } : input;
  const normalizedName = options.name.trim() || "Nueva tienda";
  const slug = slugify(normalizedName, suffix.slice(0, 6));
  const phone = (options.phone ?? "").replace(/\D/g, "");
  const template = buildCatalogModernProject({
    seed: "clean",
    id: `store-${suffix}`,
    name: normalizedName,
    brandName: options.brandName?.trim() || normalizedName,
    slug,
    baseUrl: `https://${slug}.example`,
  });
  const project = await embedFixtureAssets(
    StoreProjectV1Schema.parse({
      ...template,
      identity: {
        ...template.identity,
        email: options.email?.trim() || "",
        phone,
      },
      whatsapp: {
        ...template.whatsapp,
        phone: phone.length >= 8 && phone.length <= 15 ? phone : "5491100000000",
      },
      status: "active",
      createdAt: timestamp,
      updatedAt: timestamp,
    }),
  );
  await saveProject(project);
  return project;
}

export async function ensureFirstProject(): Promise<StoreProjectV1> {
  await ready();
  const first = await database.projects.orderBy("updatedAt").reverse().first();
  if (first) {
    const parsed = StoreProjectV1Schema.parse(first.project);
    const project = repairModernGreeting(parsed);
    if (project.whatsapp.greeting !== parsed.whatsapp.greeting) await saveProject(project);
    return project;
  }
  const initial = await embedFixtureAssets(buildScaleDemoProject());
  await saveProject(initial);
  return initial;
}

export async function ensureModernBaseProject(): Promise<boolean> {
  await ready();
  const existing = await database.projects.get(catalogModernCleanStore.id);
  if (existing) {
    const parsed = StoreProjectV1Schema.parse(existing.project);
    const project = repairModernGreeting(parsed);
    if (project.whatsapp.greeting !== parsed.whatsapp.greeting) await saveProject(project);
    return false;
  }

  await saveProject(
    await embedFixtureAssets(StoreProjectV1Schema.parse(structuredClone(catalogModernCleanStore))),
  );
  return true;
}

/**
 * Purga el registro de la tienda candidata del revamp de movimiento
 * (store-modo-sur-revamp), retirada por rollback el 2026-08-08. El registro
 * quedó en IndexedDB tras la sesión del revamp y, si persistiera, el bucle de
 * migración a disco lo volvería a materializar en proyectos/. Idempotente.
 */
export async function purgeRolledBackDemoRecords(): Promise<void> {
  await ready();
  await database.projects.delete("store-modo-sur-revamp");
  await database.recoveryDrafts.delete("store-modo-sur-revamp");
}

/**
 * Purga única (sentinel) de tiendas del perfil local: conserva únicamente las
 * dos referencias (Modo Sur V1 y Predeterminado V2) para comparar ambas
 * familias lado a lado, y elimina el resto con sus borradores de recuperación
 * y registros de migración. Corre una sola vez por perfil; cualquier tienda
 * que el usuario cree después queda intacta.
 */
export async function purgeNonDemoStores(): Promise<boolean> {
  await ready();
  if (
    typeof localStorage !== "undefined" &&
    localStorage.getItem(DEMO_ONLY_PURGE_SENTINEL) === DEMO_ONLY_PURGE_VERSION
  ) {
    return false;
  }
  let changed = false;
  for (const record of await database.projects.toArray()) {
    if (DEMO_KEEP_PROJECT_IDS.has(record.id)) continue;
    await database.projects.delete(record.id);
    await database.recoveryDrafts.delete(record.id);
    await database.migrations.delete(record.id);
    changed = true;
  }
  if (typeof localStorage !== "undefined") {
    localStorage.setItem(DEMO_ONLY_PURGE_SENTINEL, DEMO_ONLY_PURGE_VERSION);
  }
  return changed;
}

export async function ensureScaleDemoProject(): Promise<boolean> {
  await ready();
  const legacyCleanRecord = await database.projects.get(LEGACY_CLEAN_PROJECT_ID);
  if (legacyCleanRecord) {
    const legacyClean = StoreProjectV1Schema.safeParse(legacyCleanRecord.project);
    if (
      legacyClean.success &&
      legacyClean.data.name === LEGACY_CLEAN_PROJECT_NAME &&
      legacyClean.data.slug === "mi-primera-tienda" &&
      legacyClean.data.origin?.seed === "clean" &&
      legacyClean.data.products.length === 0 &&
      legacyClean.data.categories.length === 0 &&
      legacyClean.data.collections.length === 0 &&
      legacyClean.data.updatedAt === legacyClean.data.createdAt
    ) {
      const archivedAt = new Date().toISOString();
      await saveProject({
        ...legacyClean.data,
        name: "Base limpia anterior",
        status: "archived",
        updatedAt: archivedAt,
      });
    }
  }
  const existing = await database.projects.get(SCALE_DEMO_PROJECT_ID);
  if (existing) {
    const parsed = StoreProjectV1Schema.parse(existing.project);
    const project = repairScaleDemoPresentation(
      repairModernGreeting(
        parsed.name === LEGACY_SCALE_DEMO_PROJECT_NAME
          ? { ...parsed, name: SCALE_DEMO_PROJECT_NAME }
          : parsed,
      ),
    );
    if (JSON.stringify(project) !== JSON.stringify(parsed)) {
      await saveProject(project);
    }
    return false;
  }

  const demo = buildScaleDemoProject();
  await saveProject(await embedFixtureAssets(demo));
  return true;
}

/**
 * Registra `Predeterminado V1`: la misma demo de referencia antes de su
 * upgrade a la familia V2 (buildScaleDemoProject). Conserva el catálogo del
 * fixture demo con la familia y el tema V1, con identidad propia para convivir
 * como tercera tienda. Idempotente: no sobrescribe ediciones del usuario.
 */
export async function ensurePredeterminadoV1Project(): Promise<boolean> {
  await ready();
  const existing = await database.projects.get(PREDETERMINADO_V1_PROJECT_ID);
  if (existing) return false;

  const demo = StoreProjectV1Schema.parse(
    structuredClone({
      ...catalogModernStore,
      id: PREDETERMINADO_V1_PROJECT_ID,
      name: PREDETERMINADO_V1_PROJECT_NAME,
      slug: "predeterminado-v1",
      baseUrl: "https://predeterminado-v1.example",
    }),
  );
  await saveProject(await embedFixtureAssets(demo));
  return true;
}

export async function ensureCatalogModernDemoReviews(): Promise<boolean> {
  await ready();
  const record = await database.projects.get(SCALE_DEMO_PROJECT_ID);
  if (!record) return false;
  const parsed = StoreProjectV1Schema.parse(record.project);
  if (parsed.id !== SCALE_DEMO_PROJECT_ID) return false;

  const reference = buildCatalogModernProject({ seed: "demo" });
  const referenceReviews = new Map(
    reference.products.map((product) => [product.id, product.reviews ?? []]),
  );
  let changed = false;
  const products = parsed.products.map((product) => {
    const desired = referenceReviews.get(product.id);
    if (!desired?.length || (product.reviews?.length ?? 0) >= desired.length) return product;
    const existing = product.reviews ?? [];
    const existingIds = new Set(existing.map((review) => review.id));
    const additions = desired.filter((review) => !existingIds.has(review.id));
    const reviews = [...existing, ...additions].slice(0, desired.length);
    changed = true;
    return { ...product, reviews };
  });
  if (!changed) return false;
  await saveProject(StoreProjectV1Schema.parse({ ...parsed, products }));
  return true;
}

export async function ensureCatalogModernDemoGallery(): Promise<boolean> {
  await ready();
  const record = await database.projects.get(SCALE_DEMO_PROJECT_ID);
  if (!record) return false;
  const parsed = StoreProjectV1Schema.parse(record.project);
  const expanded = expandCatalogModernDemoGalleries(parsed);
  if (expanded === parsed) return false;
  await saveProject(expanded);
  return true;
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
  await ready();
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
  await ready();
  const cached = await database.assetCache.get(hash);
  if (!cached || cached.recipeVersion !== recipeVersion) return undefined;
  const lastUsedAt = new Date().toISOString();
  await database.assetCache.update(hash, { lastUsedAt });
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
  await ready();
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
