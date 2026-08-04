import { describe, expect, it } from "vitest";
import {
  catalogModernTemplateManifest,
  evaluateCatalogModernReadiness,
  getCatalogModernContentRequirements,
} from "./catalog-modern-guidance";
import { buildCatalogModernProject } from "./catalog-modern-template";

describe("Catalog Modern guidance", () => {
  it("expone la base protegida con versión estable", () => {
    expect(catalogModernTemplateManifest.id).toBe("catalog-modern");
    expect(catalogModernTemplateManifest.version).toBe(2);
    expect(catalogModernTemplateManifest.protectedSectionIds).toContain("modo-section-hero");
  });

  it("detecta placeholders y campos críticos en una tienda limpia", () => {
    const project = buildCatalogModernProject({ seed: "clean" });
    const readiness = evaluateCatalogModernReadiness(project);
    expect(readiness.criticalPending).toBeGreaterThan(0);
    expect(readiness.requirements.some((item) => item.id === "home.hero.title")).toBe(true);
    expect(readiness.requirements.find((item) => item.id === "home.hero.title")?.status).toBe(
      "placeholder",
    );
  });

  it("incluye requisitos dinámicos de productos y categorías", () => {
    const project = buildCatalogModernProject({ seed: "demo" });
    const requirements = getCatalogModernContentRequirements(project);
    expect(requirements.some((item) => item.id === "product.modo-product-01.title")).toBe(true);
    expect(requirements.some((item) => item.scope === "category")).toBe(true);
    expect(evaluateCatalogModernReadiness(project).criticalPending).toBe(0);
  });
});
