import "fake-indexeddb/auto";
import { referenceStore } from "@solara/project-schema/fixture";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import {
  database,
  duplicateProject,
  getProject,
  listProjects,
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
});
