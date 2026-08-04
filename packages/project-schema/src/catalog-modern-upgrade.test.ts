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
});
