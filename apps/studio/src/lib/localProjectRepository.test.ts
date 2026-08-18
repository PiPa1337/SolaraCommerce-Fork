import { catalogModernV2Store } from "@solara/project-schema/catalog-modern-v2-fixture";
import { describe, expect, it } from "vitest";
import { normalizeLoadedProject } from "./localProjectRepository";

describe("carga de proyectos administrados", () => {
  it("restaura las secciones V2 de Nosotros y Contacto al abrir un respaldo antiguo", () => {
    const stored = structuredClone(catalogModernV2Store);
    stored.pages = stored.pages.map((page) =>
      page.kind === "about" || page.kind === "contact" ? { ...page, sections: [] } : page,
    );

    const loaded = normalizeLoadedProject(stored);

    expect(loaded.pages.find((page) => page.kind === "about")?.sections).toHaveLength(10);
    expect(loaded.pages.find((page) => page.kind === "contact")?.sections).toHaveLength(8);
    expect(loaded.sections).toEqual(stored.sections);
  });
});
