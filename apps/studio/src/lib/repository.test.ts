import "fake-indexeddb/auto";
import { getCategoryProductIds, StoreProjectV1Schema } from "@solara/project-schema";
import { catalogModernStore } from "@solara/project-schema/catalog-modern-fixture";
import { catalogModernCleanStore } from "@solara/project-schema/catalog-modern-template";
import { referenceStore } from "@solara/project-schema/fixture";
import Dexie from "dexie";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

// El entorno de vitest no define localStorage; el stub permite probar el
// sentinel de la purga única con el mismo contrato del navegador.
const memoryStorage = new Map<string, string>();
if (typeof globalThis.localStorage === "undefined") {
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: (key: string) => memoryStorage.get(key) ?? null,
      setItem: (key: string, value: string) => {
        memoryStorage.set(key, value);
      },
      removeItem: (key: string) => {
        memoryStorage.delete(key);
      },
    },
  });
}

import {
  ASSET_CACHE_RECIPE_VERSION,
  buildScaleDemoProject,
  clearAssetCache,
  clearRecoveryDraft,
  createAssetCacheKey,
  DEMO_ONLY_PURGE_SENTINEL,
  DEPRECATED_CATEGORY_CLEANUP_SENTINEL,
  database,
  duplicateProject,
  ensureCatalogModernDemoGallery,
  ensureCatalogModernDemoReviews,
  ensureDeprecatedCategoriesRemoved,
  ensurePredeterminadoV1Project,
  ensureScaleDemoProject,
  getCachedAsset,
  getProject,
  getProjectMigration,
  getRecoveryDraft,
  listProjects,
  listProjectsWithRecovery,
  markProjectMigration,
  PREDETERMINADO_V1_PROJECT_ID,
  PREDETERMINADO_V1_PROJECT_NAME,
  purgeNonDemoStores,
  putCachedAsset,
  SCALE_DEMO_PROJECT_ID,
  saveProject,
  saveRecoveryDraft,
  setProjectArchived,
  V1_DEMO_PROJECT_ID,
} from "./repository";

describe("repositorio local", () => {
  beforeEach(async () => {
    await database.projects.clear();
    await database.assetCache.clear();
    await database.recoveryDrafts.clear();
    if (typeof localStorage !== "undefined") {
      localStorage.removeItem(DEPRECATED_CATEGORY_CLEANUP_SENTINEL);
      localStorage.removeItem(DEMO_ONLY_PURGE_SENTINEL);
    }
  });

  afterAll(async () => {
    database.close();
    await database.delete();
  });

  it("guarda, obtiene y lista un proyecto validado", async () => {
    await saveProject(referenceStore);

    expect(await getProject(referenceStore.id)).toEqual(referenceStore);
    const records = await listProjects();
    expect(records).toHaveLength(1);
    expect(records[0]?.name).toBe(referenceStore.name);
  });

  it("mantiene un borrador de recuperación separado del proyecto confirmado", async () => {
    const edited = StoreProjectV1Schema.parse({
      ...referenceStore,
      name: "Borrador local",
      updatedAt: "2026-08-06T12:00:00.000Z",
    });
    await saveProject(referenceStore);
    await saveRecoveryDraft(edited, 4);

    expect(await getProject(referenceStore.id)).toEqual(referenceStore);
    expect(await getRecoveryDraft(referenceStore.id)).toMatchObject({
      baseDiskVersion: 4,
      project: edited,
    });
    await clearRecoveryDraft(referenceStore.id);
    expect(await getRecoveryDraft(referenceStore.id)).toBeUndefined();
  });

  it("rechaza proyectos inválidos antes de escribir en IndexedDB", async () => {
    await expect(saveProject({ ...referenceStore, baseUrl: "url-inválida" })).rejects.toThrow();
    expect(await listProjects()).toHaveLength(0);
  });

  it("separa registros corruptos y deja una ruta de recuperacion accionable", async () => {
    await database.projects.put({
      id: referenceStore.id,
      name: referenceStore.name,
      status: referenceStore.status,
      updatedAt: referenceStore.updatedAt,
      project: { ...referenceStore, baseUrl: "invalid" },
    } as never);

    const result = await listProjectsWithRecovery();
    expect(result.projects).toHaveLength(0);
    expect(result.recovery).toEqual([
      expect.objectContaining({
        id: referenceStore.id,
        message: expect.stringContaining("baseUrl"),
      }),
    ]);
    await expect(getProject(referenceStore.id)).rejects.toThrow(/Importar respaldo/);
  });

  it("duplica, archiva y restaura tiendas sin alterar el original", async () => {
    await saveProject(referenceStore);
    const duplicate = await duplicateProject(referenceStore.id);

    expect(duplicate.id).not.toBe(referenceStore.id);
    expect(duplicate.products).toEqual(referenceStore.products);
    expect(await getProject(referenceStore.id)).toEqual(referenceStore);

    await setProjectArchived(duplicate.id, true);
    expect((await getProject(duplicate.id))?.status).toBe("archived");
    await setProjectArchived(duplicate.id, false);
    expect((await getProject(duplicate.id))?.status).toBe("active");
  });

  it("conserva datos después de cerrar y reabrir Dexie", async () => {
    await saveProject(referenceStore);
    database.close();
    await database.open();

    expect(await getProject(referenceStore.id)).toEqual(referenceStore);
  });

  it("migra la caché v1 sin cambiar su clave primaria", async () => {
    const databaseName = `solara-commerce-migration-${crypto.randomUUID()}`;
    const legacy = new Dexie(databaseName);
    legacy.version(1).stores({ assetCache: "hash, createdAt" });
    await legacy.open();
    await legacy.table("assetCache").put({
      hash: "legacy-hash",
      createdAt: "2026-08-01T00:00:00.000Z",
    });
    legacy.close();

    const upgraded = new Dexie(databaseName);
    upgraded.version(1).stores({ assetCache: "hash, createdAt" });
    upgraded
      .version(2)
      .stores({ assetCache: "hash, cacheKey, recipeVersion, createdAt, lastUsedAt" })
      .upgrade(async (transaction) => {
        await transaction.table("assetCache").clear();
      });
    await upgraded.open();

    expect(await upgraded.table("assetCache").get("legacy-hash")).toBeUndefined();
    upgraded.close();
    await Dexie.delete(databaseName);
  });

  it("identifica la caché por hash y versión de receta", () => {
    expect(createAssetCacheKey("abc")).toBe(`abc:recipe-${ASSET_CACHE_RECIPE_VERSION}`);
    expect(createAssetCacheKey("abc", 2)).not.toBe(createAssetCacheKey("abc", 1));
  });

  it("guarda y recupera assets compatibles sin reutilizar otras recetas", async () => {
    await putCachedAsset({
      hash: "hash-asset",
      originalName: "producto.jpg",
      mimeType: "image/webp",
      width: 960,
      height: 640,
      primary: "data:image/webp;base64,cHJpbWFyeQ==",
      fallback: "data:image/jpeg;base64,ZmFsbGJhY2s=",
      responsive: [{ width: 480, source: "data:image/webp;base64,cmVzcG9uc2l2ZQ==" }],
      createdAt: "2026-08-01T00:00:00.000Z",
    });

    const cached = await getCachedAsset("hash-asset");
    expect(cached?.cacheKey).toBe(createAssetCacheKey("hash-asset"));
    expect(cached?.recipeVersion).toBe(ASSET_CACHE_RECIPE_VERSION);
    expect(cached?.lastUsedAt).toBeTruthy();
    expect(await getCachedAsset("hash-asset", ASSET_CACHE_RECIPE_VERSION + 1)).toBeUndefined();
  });

  it("puede limpiar la caché regenerable sin tocar proyectos", async () => {
    await saveProject(referenceStore);
    await putCachedAsset({
      hash: "hash-cache",
      originalName: "producto.webp",
      mimeType: "image/webp",
      width: 480,
      height: 320,
      primary: "data:image/webp;base64,cA==",
      fallback: "data:image/jpeg;base64,Zg==",
      responsive: [],
      createdAt: "2026-08-01T00:00:00.000Z",
    });

    await clearAssetCache();

    expect(await getCachedAsset("hash-cache")).toBeUndefined();
    expect(await getProject(referenceStore.id)).toEqual(referenceStore);
  });

  it("regenera Predeterminado sin sobrescribir una base limpia anterior", async () => {
    const legacyClean = {
      ...structuredClone(catalogModernCleanStore),
      id: "store-catalog-modern-clean-default" as typeof catalogModernCleanStore.id,
      name: "Mi primera tienda",
      slug: "mi-primera-tienda" as typeof catalogModernCleanStore.slug,
      baseUrl: "https://mi-primera-tienda.example",
    };
    const legacyDemo = {
      ...structuredClone(catalogModernStore),
      id: "store-modo-sur-demo" as typeof catalogModernStore.id,
      name: "Demo Modo Sur, catálogo moderno",
    };
    await saveProject(legacyClean);
    await saveProject(legacyDemo);

    expect(await ensureScaleDemoProject()).toBe(false);
    expect((await getProject(legacyDemo.id))?.name).toBe("Predeterminado");
    expect((await getProject(legacyClean.id))?.status).toBe("archived");
    expect((await getProject(legacyClean.id))?.name).toBe("Base limpia anterior");
  });

  it("actualiza la presentacion V2 de Predeterminado sin tocar su catalogo", async () => {
    const staleDemo = StoreProjectV1Schema.parse({
      ...structuredClone(catalogModernStore),
      id: SCALE_DEMO_PROJECT_ID,
      name: "Predeterminado",
      origin: { ...catalogModernStore.origin, seed: "demo" },
      products: catalogModernStore.products.map((product, index) =>
        index === 0 ? { ...product, title: "Nombre personalizado" } : product,
      ),
    });
    await saveProject(staleDemo);

    expect(await ensureScaleDemoProject()).toBe(false);
    const repaired = await getProject(SCALE_DEMO_PROJECT_ID);
    expect(repaired?.commerceTemplates.designFamily).toBe("catalog-modern-v2");
    expect(repaired?.theme.container).toBe(1760);
    expect(repaired?.products[0]?.title).toBe("Nombre personalizado");
  });

  it("construye Predeterminado directamente con Editorial V2", () => {
    const demo = buildScaleDemoProject();
    expect(demo.name).toBe("Predeterminado");
    expect(demo.commerceTemplates.designFamily).toBe("catalog-modern-v2");
    expect(demo.theme.container).toBe(1760);
    expect(demo.products).toHaveLength(50);
  });

  it("retira Sale y Novedades de todos los proyectos sin perder productos", async () => {
    const firstProduct = catalogModernStore.products[0];
    if (!firstProduct) throw new Error("Fixture moderno incompleto");
    const stale = StoreProjectV1Schema.parse({
      ...structuredClone(catalogModernStore),
      id: "store-stale-categories",
      categories: [
        ...structuredClone(catalogModernStore.categories),
        {
          id: "category-sale",
          slug: "sale",
          title: "Sale",
          description: "Categoria temporal",
          imageId: "asset-hero",
          productIds: [firstProduct.id],
        },
        {
          id: "category-novedades",
          slug: "novedades",
          title: "Novedades",
          description: "Categoria temporal",
          imageId: "asset-hero",
          productIds: [firstProduct.id],
        },
      ],
      products: catalogModernStore.products.map((product, index) =>
        index === 0
          ? {
              ...product,
              categoryIds: [...product.categoryIds, "category-sale", "category-novedades"],
              tags: [...product.tags, "sale", "novedades"],
            }
          : product,
      ),
      navigation: {
        ...catalogModernStore.navigation,
        items: [
          ...catalogModernStore.navigation.items,
          { id: "nav-sale", label: "Sale", href: "/categorias/sale/" },
          { id: "nav-novedades", label: "Novedades", href: "/categorias/novedades/" },
        ],
      },
      sections: catalogModernStore.sections.map((section) =>
        section.moduleId === "catalog-hero"
          ? { ...section, settings: { ...section.settings, actionHref: "/categorias/novedades/" } }
          : section,
      ),
    });
    await saveProject(stale);

    expect(await ensureDeprecatedCategoriesRemoved()).toBe(true);
    const cleaned = await getProject(stale.id);
    if (!cleaned) throw new Error("Proyecto migrado inexistente");
    expect(
      cleaned.categories.some((category) => ["sale", "novedades"].includes(category.slug)),
    ).toBe(false);
    expect(cleaned.products.every((product) => product.categoryIds.length > 0)).toBe(true);
    expect(
      cleaned.products.every(
        (product) => !product.tags.some((tag) => ["sale", "novedades"].includes(tag)),
      ),
    ).toBe(true);
    expect(JSON.stringify(cleaned.navigation)).not.toContain("categorias/sale");
    expect(JSON.stringify(cleaned.navigation)).not.toContain("categorias/novedades");
    expect(JSON.stringify(cleaned.sections)).not.toContain("categorias/novedades");
    const firstCategory = cleaned.categories[0];
    if (!firstCategory) throw new Error("Proyecto sin categorias");
    expect(firstCategory.productIds).toEqual(getCategoryProductIds(cleaned, firstCategory.id));
    expect(await ensureDeprecatedCategoriesRemoved()).toBe(false);
  });

  it("amplía las reseñas del demo sin tocar otras tiendas", async () => {
    const staleDemo = StoreProjectV1Schema.parse({
      ...structuredClone(catalogModernStore),
      id: SCALE_DEMO_PROJECT_ID,
      products: catalogModernStore.products.map((product, index) =>
        index === 0 ? { ...product, reviews: product.reviews?.slice(0, 2) } : product,
      ),
    });
    await saveProject(staleDemo);
    await saveProject(referenceStore);

    expect(await ensureCatalogModernDemoReviews()).toBe(true);
    expect((await getProject(staleDemo.id))?.products[0]?.reviews).toHaveLength(6);
    expect(await getProject(referenceStore.id)).toEqual(referenceStore);
    expect(await ensureCatalogModernDemoReviews()).toBe(false);
  });

  it("amplía la galería del demo sin reescribir imágenes personalizadas", async () => {
    const staleDemo = StoreProjectV1Schema.parse({
      ...structuredClone(catalogModernStore),
      id: SCALE_DEMO_PROJECT_ID,
      products: catalogModernStore.products.map((product, index) =>
        index === 0 ? { ...product, imageIds: product.imageIds.slice(0, 1) } : product,
      ),
    });
    await saveProject(staleDemo);
    await saveProject(referenceStore);

    expect(await ensureCatalogModernDemoGallery()).toBe(true);
    const expanded = await getProject(staleDemo.id);
    expect(expanded?.products[0]?.imageIds).toHaveLength(3);
    expect(expanded?.products[0]?.imageIds[0]).toBe(staleDemo.products[0]?.imageIds[0]);
    expect(await getProject(referenceStore.id)).toEqual(referenceStore);
    expect(await ensureCatalogModernDemoGallery()).toBe(false);
  });

  it("purga una sola vez las tiendas que no son referencias V1/V2", async () => {
    const v1Reference = StoreProjectV1Schema.parse({
      ...structuredClone(catalogModernStore),
      id: V1_DEMO_PROJECT_ID,
    });
    const v2Reference = buildScaleDemoProject();
    const v1Demo = StoreProjectV1Schema.parse({
      ...structuredClone(catalogModernStore),
      id: PREDETERMINADO_V1_PROJECT_ID,
    });
    const extraStore = StoreProjectV1Schema.parse({
      ...structuredClone(catalogModernStore),
      id: "store-extra",
    });
    await saveProject(v1Reference);
    await saveProject(v2Reference);
    await saveProject(v1Demo);
    await saveProject(extraStore);
    await saveRecoveryDraft(extraStore, 0);
    await markProjectMigration(extraStore.id, "done");

    expect(await purgeNonDemoStores()).toBe(true);
    expect(await getProject(V1_DEMO_PROJECT_ID)).toEqual(v1Reference);
    expect(await getProject(SCALE_DEMO_PROJECT_ID)).toEqual(v2Reference);
    expect(await getProject(PREDETERMINADO_V1_PROJECT_ID)).toEqual(v1Demo);
    expect(await getProject("store-extra")).toBeUndefined();
    expect(await getRecoveryDraft("store-extra")).toBeUndefined();
    expect(await getProjectMigration("store-extra")).toBeUndefined();
    expect(localStorage.getItem(DEMO_ONLY_PURGE_SENTINEL)).toBeTruthy();

    expect(await purgeNonDemoStores()).toBe(false);
    await saveProject(StoreProjectV1Schema.parse({ ...extraStore, id: "store-nueva" }));
    expect(await purgeNonDemoStores()).toBe(false);
    expect(await getProject("store-nueva")).toBeDefined();
  });

  it("registra Predeterminado V1 con familia V1 e identidad propia", async () => {
    const originalFetch = globalThis.fetch;
    const originalFileReader = globalThis.FileReader;
    globalThis.fetch = ((input: unknown) => {
      if (String(input).startsWith("/fixtures/")) {
        const pixel = new Uint8Array([
          137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82, 0, 0, 0, 1, 0, 0, 0, 1, 8,
          6, 0, 0, 0, 31, 21, 196, 137, 0, 0, 0, 13, 73, 68, 65, 84, 120, 156, 99, 248, 255, 255,
          255, 127, 0, 5, 0, 1, 255, 255, 80, 24, 42, 190, 0, 0, 0, 0, 73, 69, 78, 68, 174, 66, 96,
          130,
        ]);
        return Promise.resolve(
          new Response(pixel, { status: 200, headers: { "Content-Type": "image/png" } }),
        );
      }
      return originalFetch(input as RequestInfo);
    }) as typeof fetch;
    globalThis.FileReader = class {
      result: string | ArrayBuffer | null = null;
      private loadHandlers: Array<() => void> = [];
      addEventListener(type: string, handler: () => void) {
        if (type === "load") this.loadHandlers.push(handler);
      }
      async readAsDataURL(blob: Blob) {
        const buffer = Buffer.from(await blob.arrayBuffer());
        this.result = `data:${blob.type};base64,${buffer.toString("base64")}`;
        for (const handler of this.loadHandlers) handler();
      }
    } as unknown as typeof FileReader;
    try {
      expect(await ensurePredeterminadoV1Project()).toBe(true);
      const created = await getProject(PREDETERMINADO_V1_PROJECT_ID);
      expect(created?.name).toBe(PREDETERMINADO_V1_PROJECT_NAME);
      expect(created?.commerceTemplates.designFamily).toBe("catalog-modern-v1");
      expect(created?.assets.every((asset) => asset.source.startsWith("data:image"))).toBe(true);
      expect(await ensurePredeterminadoV1Project()).toBe(false);

      if (!created) throw new Error("Predeterminado V1 no quedó registrado.");
      await saveProject(
        StoreProjectV1Schema.parse({ ...structuredClone(created), name: "V1 editada" }),
      );
      expect(await ensurePredeterminadoV1Project()).toBe(false);
      expect((await getProject(PREDETERMINADO_V1_PROJECT_ID))?.name).toBe("V1 editada");
    } finally {
      globalThis.fetch = originalFetch;
      globalThis.FileReader = originalFileReader;
    }
  });
});

describe("sentinel de migración a disco", () => {
  beforeEach(async () => {
    // El afterAll del primer describe cierra y elimina la base compartida;
    // Dexie no la reabre solo, así que se recrea con el esquema vigente aquí.
    await database.open();
    await database.migrations.clear();
  });

  it("registra el estado pending y done por proyecto", async () => {
    await markProjectMigration("store-sentinel", "pending");
    expect((await getProjectMigration("store-sentinel"))?.status).toBe("pending");
    await markProjectMigration("store-sentinel", "done");
    expect((await getProjectMigration("store-sentinel"))?.status).toBe("done");
  });

  it("no mezcla registros de proyectos distintos", async () => {
    await markProjectMigration("store-a", "done");
    await markProjectMigration("store-b", "pending");
    expect((await getProjectMigration("store-a"))?.status).toBe("done");
    expect((await getProjectMigration("store-b"))?.status).toBe("pending");
  });
});
