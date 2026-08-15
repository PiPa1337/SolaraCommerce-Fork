/**
 * Persistencia de preferencias del dashboard en localStorage. Funciones puras
 * con Storage inyectable para testearlas sin navegador (mismo patrón que
 * catalogTableModel). Cada clave se escribe y se lee con la misma forma; una
 * selección que el usuario descarta se limpia (clearStoredSelectedId) para que
 * el round-trip no devuelva una selección vieja al reabrir el dashboard.
 */
import type { DashboardSort, DashboardStatusFilter } from "./dashboardModel";

export const DASHBOARD_PINNED_STORAGE_KEY = "solara-dashboard-pinned";
export const DASHBOARD_SELECTED_STORAGE_KEY = "solara-dashboard-selected";
export const DASHBOARD_SORT_STORAGE_KEY = "solara-dashboard-sort";
export const DASHBOARD_VIEW_STORAGE_KEY = "solara-dashboard-view";
export const DASHBOARD_STATUS_FILTER_STORAGE_KEY = "solara-dashboard-status-filter";

export type DashboardView = "grid" | "list";

type ReadStorage = Pick<Storage, "getItem">;
type WriteStorage = Pick<Storage, "setItem" | "removeItem">;

const noopStorage: ReadStorage & WriteStorage = {
  getItem: () => null,
  setItem: () => undefined,
  removeItem: () => undefined,
};

const defaultStorage: ReadStorage & WriteStorage =
  typeof window === "undefined" ? noopStorage : window.localStorage;

export function readPinnedIds(storage: ReadStorage = defaultStorage): string[] {
  try {
    const raw = storage.getItem(DASHBOARD_PINNED_STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is string => typeof item === "string");
  } catch {
    return [];
  }
}

export function writePinnedIds(ids: string[], storage: WriteStorage = defaultStorage): void {
  try {
    storage.setItem(DASHBOARD_PINNED_STORAGE_KEY, JSON.stringify(ids));
  } catch {
    // Almacenamiento bloqueado: el estado vive sólo en memoria.
  }
}

export function readStoredSelectedId(storage: ReadStorage = defaultStorage): string | undefined {
  try {
    return storage.getItem(DASHBOARD_SELECTED_STORAGE_KEY) ?? undefined;
  } catch {
    return undefined;
  }
}

export function writeStoredSelectedId(id: string, storage: WriteStorage = defaultStorage): void {
  try {
    storage.setItem(DASHBOARD_SELECTED_STORAGE_KEY, id);
  } catch {
    // Almacenamiento bloqueado: la selección vive sólo en memoria.
  }
}

export function clearStoredSelectedId(storage: WriteStorage = defaultStorage): void {
  try {
    storage.removeItem(DASHBOARD_SELECTED_STORAGE_KEY);
  } catch {
    // Almacenamiento bloqueado: nada que limpiar.
  }
}

export function readStoredSort(storage: ReadStorage = defaultStorage): DashboardSort {
  try {
    const value = storage.getItem(DASHBOARD_SORT_STORAGE_KEY);
    return value === "name" || value === "updated" || value === "products" ? value : "updated";
  } catch {
    return "updated";
  }
}

export function writeStoredSort(
  value: DashboardSort,
  storage: WriteStorage = defaultStorage,
): void {
  try {
    storage.setItem(DASHBOARD_SORT_STORAGE_KEY, value);
  } catch {
    // Almacenamiento bloqueado: el orden vive sólo en memoria.
  }
}

export function readStoredView(storage: ReadStorage = defaultStorage): DashboardView {
  try {
    const value = storage.getItem(DASHBOARD_VIEW_STORAGE_KEY);
    return value === "list" || value === "grid" ? value : "grid";
  } catch {
    return "grid";
  }
}

export function writeStoredView(
  value: DashboardView,
  storage: WriteStorage = defaultStorage,
): void {
  try {
    storage.setItem(DASHBOARD_VIEW_STORAGE_KEY, value);
  } catch {
    // Almacenamiento bloqueado: la vista vive sólo en memoria.
  }
}

export function readStoredStatusFilter(
  storage: ReadStorage = defaultStorage,
): DashboardStatusFilter {
  try {
    const value = storage.getItem(DASHBOARD_STATUS_FILTER_STORAGE_KEY);
    return value === "all" || value === "active" || value === "archived" ? value : "active";
  } catch {
    return "active";
  }
}

export function writeStoredStatusFilter(
  value: DashboardStatusFilter,
  storage: WriteStorage = defaultStorage,
): void {
  try {
    storage.setItem(DASHBOARD_STATUS_FILTER_STORAGE_KEY, value);
  } catch {
    // Almacenamiento bloqueado: el filtro vive sólo en memoria.
  }
}
