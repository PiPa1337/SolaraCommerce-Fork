/**
 * Contrato del indicador de guardado administrado: después de «Recargar desde
 * disco» el editor queda alineado con disco y no debe exigir re-guardar
 * contenido idéntico para volver a `saved`.
 */
import "fake-indexeddb/auto";
import { buildCatalogModernProject } from "@solara/project-schema/catalog-modern-template";
import { describe, expect, it } from "vitest";
import { resolveDiskRebase, saveIndicatorLabel } from "./ManagedPersistenceControls";

describe("resolveDiskRebase", () => {
  it("queda alineado con disco cuando project y diskBaseProject son el mismo objeto", () => {
    const diskBase = buildCatalogModernProject({ seed: "demo", slug: "tienda-ejemplo" });
    const rebase = resolveDiskRebase(diskBase, diskBase);
    expect(rebase.synced).toBe(true);
    expect(rebase.base).toBe(diskBase);
  });

  it("no rebasea cuando no hay base de disco (tienda recién creada)", () => {
    const project = buildCatalogModernProject({ seed: "demo", slug: "tienda-ejemplo" });
    const rebase = resolveDiskRebase(project, undefined);
    expect(rebase.synced).toBe(false);
    expect(rebase.base).toBe(project);
  });

  it("no rebasea cuando el proyecto fue editado respecto de la base", () => {
    const diskBase = buildCatalogModernProject({ seed: "demo", slug: "tienda-ejemplo" });
    const edited = { ...diskBase, name: "Editada" };
    const rebase = resolveDiskRebase(edited, diskBase);
    expect(rebase.synced).toBe(false);
    expect(rebase.base).toBe(edited);
  });
});

describe("saveIndicatorLabel", () => {
  it("anuncia «Cambios pendientes» mientras hay borrador sucio aunque el estado sea saved", () => {
    expect(saveIndicatorLabel("saved", true, null)).toBe("Cambios pendientes");
    expect(saveIndicatorLabel("saved", true, 1_700_000_000_000)).toBe("Cambios pendientes");
  });

  it("muestra «Guardando…» durante el guardado aunque haya borrador sucio", () => {
    expect(saveIndicatorLabel("saving", true, null)).toBe("Guardando…");
  });

  it("muestra «Guardado» sin hora antes del primer guardado y con hora después", () => {
    expect(saveIndicatorLabel("saved", false, null)).toBe("Guardado");
    expect(saveIndicatorLabel("saved", false, 1_700_000_000_000)).toMatch(/^Guardado \d{2}:\d{2}$/);
  });

  it("conserva «Sitio anterior conservado» cuando el sitio quedó atrasado", () => {
    expect(saveIndicatorLabel("site-outdated", true, null)).toBe("Sitio anterior conservado");
    expect(saveIndicatorLabel("site-outdated", false, null)).toBe("Sitio anterior conservado");
  });

  it("anuncia el error en el indicador: «Error al guardar» (el bloque no debe desbordar el topbar)", () => {
    expect(saveIndicatorLabel("error", true, null)).toBe("Error al guardar");
    expect(saveIndicatorLabel("error", false, null)).toBe("Error al guardar");
  });
});
