import { describe, expect, it } from "vitest";
import { buildCatalogModernProject } from "./catalog-modern-template";
import { applyCatalogModernUpgrade, planCatalogModernUpgrade } from "./catalog-modern-upgrade";

describe("actualización revisable de Catalog Modern", () => {
  it("propone actualizar la versión sin sobrescribir settings", () => {
    const project = buildCatalogModernProject({ seed: "clean" });
    if (!project.origin) throw new Error("El fixture debe tener origen de plantilla.");
    const v1 = {
      ...project,
      origin: { ...project.origin, templateVersion: 1 },
      sections: project.sections.map((section) =>
        section.id === "modo-section-hero"
          ? { ...section, settings: { ...section.settings, title: "Título propio" } }
          : section,
      ),
    };
    const plan = planCatalogModernUpgrade(v1);
    expect(plan.safeChanges.some((change) => change.id === "template.version")).toBe(true);
    expect(plan.preservedUserChanges).toContain("sections.modo-section-hero.settings");
    const upgraded = applyCatalogModernUpgrade(v1, ["template.version"]);
    expect(upgraded.origin?.templateVersion).toBe(2);
    expect(
      upgraded.sections.find((section) => section.id === "modo-section-hero")?.settings.title,
    ).toBe("Título propio");
  });

  it("diagnostica contenido standalone antiguo sin eliminarlo", () => {
    const project = buildCatalogModernProject({ seed: "clean" });
    const firstSection = project.sections[0];
    if (!firstSection) throw new Error("Fixture sin secciones");
    const legacyPage = {
      id: "page-about-legacy",
      kind: "about" as const,
      slug: "nosotros",
      title: "Nosotros antiguo",
      seoTitle: "Nosotros antiguo",
      seoDescription: "Contenido antiguo",
      sections: [{ ...firstSection, id: "archived-about-section" }],
    };
    const withArchivedContent = {
      ...project,
      pages: [...project.pages, legacyPage],
    };
    const plan = planCatalogModernUpgrade(withArchivedContent);
    expect(plan.conflicts).toContainEqual(
      expect.objectContaining({
        id: "page.archived.about",
        path: "pages.page-about-legacy",
      }),
    );
    expect(applyCatalogModernUpgrade(withArchivedContent, []).pages).toContainEqual(legacyPage);
  });
});
