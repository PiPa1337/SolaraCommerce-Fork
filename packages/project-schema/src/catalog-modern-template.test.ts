import { describe, expect, it } from "vitest";
import {
  buildCatalogModernProject,
  CATALOG_MODERN_TEMPLATE_VERSION,
  catalogModernCleanStore,
  ensureContactV2Sections,
} from "./catalog-modern-template";
import { catalogModernV2Store } from "./catalog-modern-v2-fixture";

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

  it("seedear Contacto V2 y normaliza una página vacía sin tocar V1", () => {
    const v2Contact = catalogModernV2Store.pages.find((page) => page.kind === "contact");
    expect(v2Contact?.sections.map((section) => section.moduleId)).toEqual([
      "contact-hero",
      "contact-form",
      "contact-channels",
      "contact-help-grid",
      "contact-whatsapp-cta",
      "contact-purchase-info",
      "contact-faq",
      "contact-location",
    ]);
    const empty = structuredClone(catalogModernV2Store);
    empty.pages = empty.pages.map((page) =>
      page.kind === "contact" ? { ...page, sections: [] } : page,
    );
    const normalized = ensureContactV2Sections(empty);
    expect(normalized.pages.find((page) => page.kind === "contact")?.sections).toHaveLength(8);
    expect(ensureContactV2Sections(normalized)).toEqual(normalized);
    const v1 = structuredClone(catalogModernCleanStore);
    expect(ensureContactV2Sections(v1)).toEqual(v1);
  });
});
