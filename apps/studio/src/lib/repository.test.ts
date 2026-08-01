import "fake-indexeddb/auto";
import { referenceStore } from "@solara/project-schema/fixture";
import Dexie from "dexie";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import {
  ASSET_CACHE_RECIPE_VERSION,
  clearAssetCache,
  createAssetCacheKey,
  database,
  duplicateProject,
  getCachedAsset,
  getProject,
  listProjects,
  listProjectsWithRecovery,
  putCachedAsset,
  saveProject,
  setProjectArchived,
} from "./repository";

describe("repositorio local", () => {
  beforeEach(async () => {
    await database.projects.clear();
    await database.assetCache.clear();
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
});
