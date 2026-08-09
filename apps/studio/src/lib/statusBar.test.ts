import { describe, expect, it } from "vitest";
import { formatLastExportLabel } from "./statusBar";

describe("formatLastExportLabel", () => {
  const NOW = "2026-08-09T15:00:00.000Z";

  it("prioriza el recibo de disco", () => {
    const entries = [{ at: "2026-08-09T12:00:00.000Z", mode: "production" as const }];
    expect(formatLastExportLabel(entries, "2026-08-09T14:00:00.000Z", NOW)).toContain("14:00");
  });

  it("cae al historial del navegador cuando no hay recibo", () => {
    const entries = [{ at: "2026-08-09T12:00:00.000Z", mode: "draft" as const }];
    expect(formatLastExportLabel(entries, null, NOW)).toContain("12:00");
  });

  it("devuelve — sin historial", () => {
    expect(formatLastExportLabel([], null, NOW)).toBe("—");
  });
});
