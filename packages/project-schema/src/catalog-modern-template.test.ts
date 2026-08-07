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
    expect(demo.products.slice(0, 6).every((product) => product.reviews?.length === 6)).toBe(true);
    expect(demo.products.slice(6).every((product) => !product.reviews)).toBe(true);
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

  it("reconfigura el motion de cada sección para la candidata revamp", () => {
    const revamp = buildCatalogModernProject({
      seed: "revamp",
      id: "store-revamp-test",
      name: "Predeterminado Revamp",
      slug: "predeterminado-revamp",
    });
    expect(revamp.origin?.seed).toBe("revamp");
    expect(revamp.products).toHaveLength(50);

    const motionByModule = new Map(
      revamp.sections.map((section) => [section.moduleId, section.motion]),
    );

    expect(motionByModule.get("catalog-hero")).toMatchObject({
      preset: "layer-stack",
      distance: 24,
      duration: 0.6,
      easing: "cubic-bezier(.34,1.56,.64,1)",
    });
    expect(motionByModule.get("catalog-product-grid")).toMatchObject({
      preset: "stagger",
      stagger: 0.07,
      distance: 20,
    });
    expect(motionByModule.get("catalog-category-bento")).toMatchObject({
      preset: "scale",
      distance: 0,
      duration: 0.5,
    });
    expect(motionByModule.get("catalog-testimonials")).toMatchObject({
      preset: "fade-up",
      distance: 22,
    });
    expect(motionByModule.get("catalog-brand-strip")).toMatchObject({
      preset: "fade",
      duration: 0.4,
    });
    for (const moduleId of [
      "catalog-announcement",
      "catalog-header",
      "catalog-newsletter-cta",
      "catalog-cart-drawer",
      "catalog-footer",
    ]) {
      expect(motionByModule.get(moduleId)).toMatchObject({
        preset: "fade-up",
        distance: 16,
      });
    }
  });

  it("es determinista: el mismo seed produce el mismo proyecto", () => {
    const first = buildCatalogModernProject({ seed: "revamp", id: "store-revamp-test" });
    const second = buildCatalogModernProject({ seed: "revamp", id: "store-revamp-test" });
    expect(JSON.stringify(first.sections)).toBe(JSON.stringify(second.sections));
  });
});
