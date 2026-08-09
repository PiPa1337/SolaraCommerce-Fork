/**
 * Historial de exportaciones por slug en localStorage del navegador.
 * Funciones puras y sin dependencias de React, compartidas por el panel de
 * exportación y la barra de estado del editor.
 */
export interface ExportHistoryEntry {
  at: string;
  mode: "draft" | "production";
  score: number;
  critical: number;
}

export const EXPORT_HISTORY_KEY_PREFIX = "solara-export-history:";

const EXPORT_HISTORY_MAX_ENTRIES = 8;

function storage(): Storage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

export function readExportHistory(slug: string): ExportHistoryEntry[] {
  const store = storage();
  if (!store) return [];
  try {
    const raw = store.getItem(`${EXPORT_HISTORY_KEY_PREFIX}${slug}`);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as ExportHistoryEntry[]) : [];
  } catch {
    return [];
  }
}

export function recordExport(
  slug: string,
  mode: ExportHistoryEntry["mode"],
  details: Pick<ExportHistoryEntry, "score" | "critical"> = { score: 0, critical: 0 },
): ExportHistoryEntry[] {
  const next: ExportHistoryEntry[] = [
    { at: new Date().toISOString(), mode, ...details },
    ...readExportHistory(slug),
  ].slice(0, EXPORT_HISTORY_MAX_ENTRIES);
  const store = storage();
  if (store) {
    try {
      store.setItem(`${EXPORT_HISTORY_KEY_PREFIX}${slug}`, JSON.stringify(next));
    } catch {
      // Almacenamiento bloqueado: el historial vive sólo en memoria.
    }
  }
  return next;
}

export function clearExportHistory(slug: string): void {
  const store = storage();
  if (!store) return;
  try {
    store.removeItem(`${EXPORT_HISTORY_KEY_PREFIX}${slug}`);
  } catch {
    // Almacenamiento bloqueado: nada que limpiar.
  }
}
