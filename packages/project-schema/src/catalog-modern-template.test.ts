import { describe, expect, it } from "vitest";
import {
  buildCatalogModernProject,
  CATALOG_MODERN_TEMPLATE_VERSION,
  catalogModernCleanStore,
} from "./catalog-modern-template";

describe("plantilla Catalog Modern", () => {
  it("crea una tienda limpia guiada sin copiar el catálogo demo", () => {
    expect(catalogModernCleanStore.origin).toEqual({
      templateId: "catalog-modern",
      templateVersion: CATALOG_MODERN_TEMPLATE_VERSION,
      seed: "clean",
    });
    expect(catalogModernCleanStore.products).toHaveLength(0);
    expect(catalogModernCleanStore.categories).toHaveLength(0);
    expect(catalogModernCleanStore.collections).toHaveLength(0);
    expect(catalogModernCleanStore.navigation.mode).toBe("automatic");
    expect(catalogModernCleanStore.sections.some((section) => section.enabled)).toBe(true);
    expect(JSON.stringify(catalogModernCleanStore)).not.toContain("Modo Sur");
  });

  it("mantiene la demo de 50 productos y 14 categorías desde la misma plantilla", () => {
    const demo = buildCatalogModernProject({ seed: "demo" });
    expect(demo.origin?.seed).toBe("demo");
    expect(demo.products).toHaveLength(50);
    expect(demo.categories).toHaveLength(14);
    expect(demo.products.flatMap((product) => product.variants)).toHaveLength(60);
  });

  it("permite personalizar la identidad sin cambiar el contrato", () => {
    const project = buildCatalogModernProject({
      seed: "clean",
      id: "store-ejemplo",
      name: "Tienda ejemplo",
      brandName: "Marca ejemplo",
      slug: "tienda-ejemplo",
    });
    expect(project.id).toBe("store-ejemplo");
    expect(project.identity.brandName).toBe("Marca ejemplo");
    expect(project.baseUrl).toBe("https://tienda-ejemplo.example");
  });
});
