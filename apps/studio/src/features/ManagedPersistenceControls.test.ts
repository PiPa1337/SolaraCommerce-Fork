/**
 * Contrato del indicador de guardado administrado: después de «Recargar desde
 * disco» el editor queda alineado con disco y no debe exigir re-guardar
 * contenido idéntico para volver a `saved`.
 */
import "fake-indexeddb/auto";
import { buildCatalogModernProject } from "@solara/project-schema/catalog-modern-template";
import { describe, expect, it } from "vitest";
import { resolveDiskRebase } from "./ManagedPersistenceControls";

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
