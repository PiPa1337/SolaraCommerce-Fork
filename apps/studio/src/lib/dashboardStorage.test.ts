import { describe, expect, it } from "vitest";
import {
  clearStoredSelectedId,
  DASHBOARD_PINNED_STORAGE_KEY,
  DASHBOARD_SELECTED_STORAGE_KEY,
  DASHBOARD_SORT_STORAGE_KEY,
  DASHBOARD_VIEW_STORAGE_KEY,
  readPinnedIds,
  readStoredSelectedId,
  readStoredSort,
  readStoredView,
  writePinnedIds,
  writeStoredSelectedId,
  writeStoredSort,
  writeStoredView,
} from "./dashboardStorage";

type MockStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

function createStorage(): MockStorage {
  const map = new Map<string, string>();
  return {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => {
      map.set(key, value);
    },
    removeItem: (key) => {
      map.delete(key);
    },
  };
}

describe("persistencia del dashboard", () => {
  it("las claves literales coinciden con el contrato persistido", () => {
    expect(DASHBOARD_PINNED_STORAGE_KEY).toBe("solara-dashboard-pinned");
    expect(DASHBOARD_SELECTED_STORAGE_KEY).toBe("solara-dashboard-selected");
    expect(DASHBOARD_SORT_STORAGE_KEY).toBe("solara-dashboard-sort");
    expect(DASHBOARD_VIEW_STORAGE_KEY).toBe("solara-dashboard-view");
  });

  it("las fijadas hacen round-trip y rechazan JSON corrupto", () => {
    const storage = createStorage();
    expect(readPinnedIds(storage)).toEqual([]);
    writePinnedIds(["store-a", "store-b"], storage);
    expect(readPinnedIds(storage)).toEqual(["store-a", "store-b"]);
    storage.setItem(DASHBOARD_PINNED_STORAGE_KEY, "{no es json");
    expect(readPinnedIds(storage)).toEqual([]);
  });

  it("la selección hace round-trip y el descarte la limpia", () => {
    const storage = createStorage();
    expect(readStoredSelectedId(storage)).toBeUndefined();
    writeStoredSelectedId("store-a", storage);
    expect(readStoredSelectedId(storage)).toBe("store-a");
    clearStoredSelectedId(storage);
    expect(storage.getItem(DASHBOARD_SELECTED_STORAGE_KEY)).toBeNull();
    expect(readStoredSelectedId(storage)).toBeUndefined();
  });

  it("el orden y la vista hacen round-trip con valores conocidos", () => {
    const storage = createStorage();
    expect(readStoredSort(storage)).toBe("updated");
    expect(readStoredView(storage)).toBe("grid");
    writeStoredSort("products", storage);
    writeStoredView("list", storage);
    expect(readStoredSort(storage)).toBe("products");
    expect(readStoredView(storage)).toBe("list");
  });

  it("valores desconocidos vuelven a los defaults", () => {
    const storage = createStorage();
    storage.setItem(DASHBOARD_SORT_STORAGE_KEY, "aleatorio");
    storage.setItem(DASHBOARD_VIEW_STORAGE_KEY, "carrousel");
    expect(readStoredSort(storage)).toBe("updated");
    expect(readStoredView(storage)).toBe("grid");
  });
});
