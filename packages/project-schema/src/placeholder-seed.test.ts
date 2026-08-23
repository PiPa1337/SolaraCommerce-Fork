import { describe, expect, it } from "vitest";
import { buildCatalogModernProject, catalogModernCleanStore } from "./catalog-modern-template";

const placeholder = buildCatalogModernProject({ seed: "placeholder" });

describe("seed placeholder", () => {
  it("crea 5 productos genericos con placeholders numerados", () => {
    expect(placeholder.products).toHaveLength(5);
    expect(placeholder.products.map((p) => p.title)).toEqual([
      "Producto 1",
      "Producto 2",
      "Producto 3",
      "Producto 4",
      "Producto 5",
    ]);
    for (const product of placeholder.products) {
      expect(product.variants[0]?.price).toBeGreaterThan(0);
      expect(product.variants.length).toBeGreaterThanOrEqual(1);
    }
  });

  it("crea 2 categorias y 1 coleccion placeholder", () => {
    expect(placeholder.categories.map((c) => c.title)).toEqual(["Categoria 1", "Categoria 2"]);
    expect(placeholder.collections).toHaveLength(1);
    expect(placeholder.collections[0]?.title).toBe("Coleccion 1");
    expect(placeholder.collections[0]?.productIds).toHaveLength(5);
  });

  it("hero y announcement usan textos instructivos", () => {
    const hero = placeholder.sections.find((s) => s.moduleId === "catalog-hero");
    const heroSettings = hero?.settings as { title?: string; body?: string };
    expect(heroSettings.title).toBe("Titulo del hero");
    expect(heroSettings.body).toContain("Subtitulo");
    const announcement = placeholder.sections.find((s) => s.moduleId === "catalog-announcement");
    expect((announcement?.settings as { text?: string }).text).toContain("anuncio");
  });

  it("marcas y testimonios desactivados", () => {
    const brands = placeholder.sections.find((s) => s.moduleId === "catalog-brand-strip");
    const testimonials = placeholder.sections.find((s) => s.moduleId === "catalog-testimonials");
    expect(brands?.enabled).toBe(false);
    expect(testimonials?.enabled).toBe(false);
  });

  it("grilla de productos activa apuntando a la coleccion placeholder", () => {
    const grid = placeholder.sections.find(
      (s) => s.moduleId === "catalog-product-grid" && s.enabled,
    );
    const settings = grid?.settings as { source?: string; sourceId?: string; limit?: number };
    expect(settings.source).toBe("collection");
    expect(settings.sourceId).toBe("collection-placeholder-1");
    expect(settings.limit).toBe(5);
  });

  it("es distinto de clean y demo pero mantiene el contrato V2", () => {
    expect(placeholder.products.length).not.toBe(catalogModernCleanStore.products.length);
    expect(placeholder.commerceTemplates.designFamily).toBe("catalog-modern-v2");
    expect(placeholder.origin?.seed).toBe("placeholder");
    expect(placeholder.pages.map((page) => page.kind)).toEqual(["home"]);
  });
});
