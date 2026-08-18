import { catalogModernV2Store } from "@solara/project-schema/catalog-modern-v2-fixture";
import { describe, expect, it } from "vitest";
import { normalizeLoadedProject } from "./localProjectRepository";

describe("carga de proyectos administrados", () => {
  it("restaura las secciones V2 de Nosotros y Contacto al abrir un respaldo antiguo", () => {
    const stored = structuredClone(catalogModernV2Store);
    stored.pages = stored.pages.map((page) =>
      page.kind === "about" || page.kind === "contact" ? { ...page, sections: [] } : page,
    );
    stored.sections = stored.sections.filter(
      (section) => !["contact-form", "contact-channels"].includes(section.moduleId),
    );

    const loaded = normalizeLoadedProject(stored);

    expect(loaded.pages.find((page) => page.kind === "about")?.sections).toHaveLength(10);
    expect(loaded.pages.find((page) => page.kind === "contact")?.sections).toHaveLength(7);
    expect(loaded.sections.map((section) => section.moduleId)).toContain("contact-form");
    expect(loaded.sections.map((section) => section.moduleId)).toContain("contact-channels");
    expect(loaded.sections).toHaveLength(stored.sections.length + 2);
  });
});
