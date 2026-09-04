import { describe, expect, test } from "vitest";
import {
  getCatalogModernExport,
  getCatalogModernV2Export,
  getPerf2000Export,
  getPerf2000Project,
  getReferenceDraftExport,
} from "./export-shared-fixture";

describe("export-shared-fixture", () => {
  test("el proyecto 2000 se genera una sola vez (misma referencia)", () => {
    expect(getPerf2000Project()).toBe(getPerf2000Project());
  });

  test("el export 2000 se calcula una sola vez (misma referencia)", () => {
    const a = getPerf2000Export();
    const b = getPerf2000Export();
    expect(a).toBe(b);
    expect(a.files.size).toBeGreaterThan(1000);
  });

  test("el proyecto compartido no se puede mutar por accidente", () => {
    expect(Object.isFrozen(getPerf2000Project())).toBe(true);
  });

  test("el export chico modern se comparte (misma referencia)", () => {
    expect(getCatalogModernExport()).toBe(getCatalogModernExport());
  });

  test("el export draft de referencia se comparte (misma referencia)", () => {
    const draft = getReferenceDraftExport();
    expect(draft).toBe(getReferenceDraftExport());
    expect(String(draft.files.get("robots.txt"))).toContain("Disallow: /");
  });

  test("el export chico modern-v2 se comparte (misma referencia)", () => {
    expect(getCatalogModernV2Export()).toBe(getCatalogModernV2Export());
  });
});
