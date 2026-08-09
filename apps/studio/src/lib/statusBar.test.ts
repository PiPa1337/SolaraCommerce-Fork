import { describe, expect, it } from "vitest";
import { formatLastExportLabel } from "./statusBar";

function expectedTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
}

describe("formatLastExportLabel", () => {
  const NOW = "2026-08-09T15:00:00.000Z";

  it("prioriza el recibo de disco", () => {
    const entries = [{ at: "2026-08-09T12:00:00.000Z", mode: "production" as const }];
    expect(formatLastExportLabel(entries, "2026-08-09T14:00:00.000Z", NOW)).toBe(
      expectedTime("2026-08-09T14:00:00.000Z"),
    );
  });

  it("cae al historial del navegador cuando no hay recibo", () => {
    const entries = [{ at: "2026-08-09T12:00:00.000Z", mode: "draft" as const }];
    expect(formatLastExportLabel(entries, null, NOW)).toBe(
      expectedTime("2026-08-09T12:00:00.000Z"),
    );
  });

  it("devuelve — sin historial", () => {
    expect(formatLastExportLabel([], null, NOW)).toBe("—");
  });

  it("muestra la entrada más reciente aunque el historial esté en orden nuevo→viejo", () => {
    const entries = [
      { at: "2026-08-08T10:00:00.000Z", mode: "draft" as const },
      { at: "2026-08-01T08:00:00.000Z", mode: "draft" as const },
    ];
    expect(formatLastExportLabel(entries, null, NOW)).toBe(
      expectedTime("2026-08-08T10:00:00.000Z"),
    );
  });

  it("salta entradas con at inválido y usa la más reciente válida", () => {
    const entries = [
      { at: "2026-08-08T10:00:00.000Z", mode: "draft" as const },
      { at: "no-es-una-fecha", mode: "draft" as const },
      { at: "2026-08-01T08:00:00.000Z", mode: "draft" as const },
    ];
    expect(formatLastExportLabel(entries, null, NOW)).toBe(
      expectedTime("2026-08-08T10:00:00.000Z"),
    );
  });

  it("devuelve — cuando todas las fechas son inválidas", () => {
    const entries = [{ at: "no-es-una-fecha", mode: "draft" as const }];
    expect(formatLastExportLabel(entries, null, NOW)).toBe("—");
  });
});
