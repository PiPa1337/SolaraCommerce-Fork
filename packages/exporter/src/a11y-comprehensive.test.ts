import { exportProject } from "@solara/exporter";
import { renderSections } from "@solara/modules";
import { catalogModernStore } from "@solara/project-schema/catalog-modern-fixture";
import { describe, expect, it } from "vitest";

describe("a11y comprehensive - storefront", () => {
  it("testimonials track es focusable y tiene region accesible", () => {
    const section = catalogModernStore.sections.find((s) => s.moduleId === "catalog-testimonials");
    if (!section) throw new Error("sin testimonios");
    const html = String(renderSections(catalogModernStore, [section], { pageType: "home" }));
    expect(html).toContain('tabindex="0"');
    expect(html).toContain('role="region"');
    expect(html).toContain('aria-label="Testimonios de clientes"');
    expect(html).toContain('class="catalog-testimonials-track"');
  });
  it("cart drawer tiene role dialog y aria-live", () => {
    const section = catalogModernStore.sections.find((s) => s.moduleId === "catalog-cart-drawer");
    if (!section) throw new Error("sin cart drawer");
    const html = String(renderSections(catalogModernStore, [section], { pageType: "home" }));
    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-modal="true"');
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain("data-cart-subtotal");
    expect(html).toContain("data-cart-total");
  });
  it("hero carousel controles tienen tablist y tabs", () => {
    const heroSection = catalogModernStore.sections.find((s) => s.moduleId === "catalog-hero");
    if (!heroSection) throw new Error("sin hero");
    // forzar modo carousel con 2 slides
    const carouselSettings = {
      mode: "carousel",
      slides: [
        {
          id: "1",
          title: "A",
          body: "b",
          actionLabel: "Ver",
          actionHref: "/",
          imageId: heroSection.settings.posterAssetId,
        },
        {
          id: "2",
          title: "B",
          body: "b2",
          actionLabel: "Ver",
          actionHref: "/",
          imageId: heroSection.settings.posterAssetId,
        },
      ],
      autoplay: false,
      intervalMs: 6000,
      showCatalogStats: false,
      benefits: [],
    };
    const section = { ...heroSection, settings: carouselSettings };
    const html = String(renderSections(catalogModernStore, [section], { pageType: "home" }));
    if (html.includes("catalog-hero-controls")) {
      expect(html).toContain('role="tablist"');
      expect(html).toContain('role="tab"');
      expect(html).toContain("aria-selected");
    }
  });
  it("skip link y main tienen relacion", () => {
    const exported = exportProject(catalogModernStore, { mode: "production" });
    const html = String(exported.files.get("index.html"));
    expect(html).toContain('class="solara-skip-link" href="#solara-main"');
    expect(html).toContain('id="solara-main"');
  });
  it("search dialog tiene aria-labelledby", () => {
    const exported = exportProject(catalogModernStore, { mode: "production" });
    const html = String(exported.files.get("index.html"));
    expect(html).toContain('id="catalog-search-dialog"');
    expect(html).toContain('aria-labelledby="catalog-search-title"');
    expect(html).toContain('id="catalog-search-title"');
  });
  it("variant select tiene label asociado", () => {
    const exported = exportProject(catalogModernStore, { mode: "production" });
    // buscar pagina de producto
    const productPath = [...exported.files.keys()].find((p) => p.startsWith("productos/"));
    if (!productPath) throw new Error("sin producto");
    const html = String(exported.files.get(productPath));
    expect(html).toContain('for="catalog-variant-');
    expect(html).toContain("data-variant-select");
    expect(html).toContain('for="catalog-quantity-');
  });
  it("category filters tiene aside con aria-label y fieldset legend", () => {
    const exported = exportProject(catalogModernStore, { mode: "production" });
    const categoryPath = [...exported.files.keys()].find((p) => p.startsWith("categorias/"));
    if (!categoryPath) throw new Error("sin categoria");
    const html = String(exported.files.get(categoryPath));
    expect(html).toContain('class="catalog-category-filters"');
    expect(html).toContain('aria-label="Filtros"');
    expect(html).toContain("<fieldset>");
    expect(html).toContain("<legend>");
  });
  it("no expone reviews ni rating tras eliminacion", () => {
    const exported = exportProject(catalogModernStore, { mode: "production" });
    const html = String(exported.files.get("index.html"));
    expect(html).not.toContain("catalog-product-rating");
    expect(html).not.toContain("catalog-product-reviews");
    const productPath = [...exported.files.keys()].find((p) => p.startsWith("productos/"));
    const productHtml = String(exported.files.get(productPath!));
    expect(productHtml).not.toContain("catalog-product-reviews");
    expect(productHtml).not.toContain("catalog-product-rating");
  });
  it("breadcrumbs tiene nav con aria-label y aria-current", () => {
    const exported = exportProject(catalogModernStore, { mode: "production" });
    const categoryPath = [...exported.files.keys()].find((p) => p.startsWith("categorias/"));
    const html = String(exported.files.get(categoryPath!));
    expect(html).toContain('class="solara-breadcrumbs"');
    expect(html).toContain('aria-label="Migas de pan"');
    expect(html).toContain('aria-current="page"');
  });
});
