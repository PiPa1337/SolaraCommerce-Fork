import type { ExportHistoryEntry } from "./exportHistory";

export function formatLastExportLabel(
  entries: ReadonlyArray<Pick<ExportHistoryEntry, "at" | "mode">>,
  receiptAt: string | null | undefined,
  nowIso: string,
): string {
  if (receiptAt) return formatTime(receiptAt);
  const latest = entries.reduce<{ at: string; ts: number } | null>((current, entry) => {
    const ts = Date.parse(entry.at);
    if (Number.isNaN(ts)) return current;
    if (!current || ts > current.ts) return { at: entry.at, ts };
    return current;
  }, null);
  if (!latest) return "—";
  const ageMs = Date.parse(nowIso) - latest.ts;
  if (Number.isNaN(ageMs) || ageMs < 0 || ageMs > 30 * 24 * 60 * 60 * 1000) return "—";
  return formatTime(latest.at);
}

function formatTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleTimeString("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
}
