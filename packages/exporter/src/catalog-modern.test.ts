import { StoreProjectV2Schema } from "@solara/project-schema";
import { catalogModernStore } from "@solara/project-schema/catalog-modern-fixture";
import { catalogModernCleanStore } from "@solara/project-schema/catalog-modern-template";
import { describe, expect, it } from "vitest";
import { exportProject, renderPreviewHtml } from "./index";

describe("tienda base catalog-modern de 50 productos", () => {
  const exported = exportProject(catalogModernStore, { mode: "production" });

  it("genera el catálogo completo y conserva la familia visual moderna", () => {
    const productPages = [...exported.files.keys()].filter((path) =>
      /^productos\/[^/]+\/index\.html$/.test(path),
    );
    const categoryPages = [...exported.files.keys()].filter((path) =>
      /^categorias\/[^/]+\//.test(path),
    );
    const home = String(exported.files.get("index.html"));
    const product = String(exported.files.get("productos/remera-esencial-de-algodon/index.html"));

    expect(productPages).toHaveLength(50);
    expect(categoryPages).toHaveLength(14);
    expect(home).toContain('data-design-family="catalog-modern-v1"');
    expect(home).toMatch(/>Categorías<span class="catalog-nav-chevron"/);
    expect(home).toContain('class="catalog-mega-menu__groups"');
    expect(home).toContain('class="catalog-mega-group catalog-mega-group--has-children"');
    expect(home).not.toContain(">Tienda</summary>");
    expect(home).not.toMatch(/[\u00C3\u00C2\uFFFD]/);
    expect(home).toContain('data-solara-module="catalog-product-grid"');
    expect(home).toContain("data-catalog-search-dialog");
    expect(home).toContain("data-catalog-search-open");
    expect(home).toContain("/fixtures/modo-sur-hero.png");
    expect(home).toContain("/fixtures/modo-sur-remera.png");
    expect(home.match(/data-product-card/g) ?? []).toHaveLength(20);
    expect(home).not.toContain("catalog-product-rating");
    expect(home).not.toContain("catalog-product-availability");
    expect(home).toContain("Remeras");
    expect(home).toContain("Camisas");
    expect(product).toContain('data-solara-module="catalog-product-detail"');
    expect(product).toContain("catalog-option-pill");
    expect(product).toContain('role="tablist"');
    expect(product).toContain("Lo que dicen quienes compraron");
  });

  it("bloquea production en la plantilla limpia hasta reemplazar placeholders", () => {
    const draft = exportProject(catalogModernCleanStore, { mode: "draft" });
    expect(draft.audit.some((issue) => issue.code === "template.placeholder")).toBe(true);
    expect(() => exportProject(catalogModernCleanStore, { mode: "production" })).toThrow(
      "imágenes de plantilla",
    );
  });

  it("mantiene la paridad entre preview y exportación y el índice de búsqueda", () => {
    const preview = renderPreviewHtml(catalogModernStore, "draft", "/");
    const exportedHome = String(exported.files.get("index.html"));
    const moduleTree = (html: string) =>
      [...html.matchAll(/data-solara-module="([^"]+)"/g)].map((match) => match[1]);
    const search = JSON.parse(String(exported.files.get("search-index.json"))) as unknown[];

    expect(moduleTree(preview)).toEqual(moduleTree(exportedHome));
    expect(search).toHaveLength(50);
    expect(exported.files.has("categorias/novedades/index.html")).toBe(false);
    expect(exported.files.has("categorias/sale/index.html")).toBe(false);
    expect(String(exported.files.get("sitemap.xml"))).toContain(
      "/productos/remera-esencial-de-algodon/",
    );
    expect(catalogModernStore.whatsapp.greeting).toBe("Hola Modo Sur, quiero hacer este pedido:");
  });

  it("construye la categoría moderna con filtros y pie comercial", () => {
    const category = String(exported.files.get("categorias/remeras/index.html"));

    expect(category).toContain('class="solara-container catalog-category-page"');
    expect(category).toContain('class="catalog-category-filters"');
    expect(category).toContain('class="catalog-category-layout"');
    expect(category).toContain('data-solara-module="catalog-product-grid"');
    expect(category).toContain("data-category-grid");
    expect(category).toContain("data-category-option");
    expect(category).toContain("data-product-price=");
    expect(category).not.toContain("catalog-product-rating");
    expect(category).not.toContain("catalog-product-availability");
    expect(category).toContain('data-solara-module="catalog-newsletter-cta"');
    expect(category).not.toContain('data-solara-module="catalog-testimonials"');
    const cart = String(exported.files.get("carrito/index.html"));
    expect(cart).toContain("data-cart-subtotal");
    expect(cart).toContain("Entrega");
  });

  it("mantiene la página de búsqueda compacta y los resultados fuera del diálogo", () => {
    const search = String(exported.files.get("buscar/index.html"));

    expect(search).toContain("data-catalog-search-dialog");
    expect(search).toContain("data-catalog-search-open");
    expect(search).toContain('class="solara-search-results" data-search-results');
    expect(search).toContain("Nueva búsqueda");
    expect(search).not.toContain('id="solara-search-input"');
  });

  it("deduplica fuentes de assets embebidos en el preview", () => {
    const payload = "A".repeat(100_000);
    const embedded = {
      ...catalogModernStore,
      assets: catalogModernStore.assets.map((asset) => ({
        ...asset,
        source: `data:image/png;base64,${payload}`,
      })),
    };
    const preview = renderPreviewHtml(embedded, "draft", "/");

    expect(preview).toContain('id="solara-preview-assets"');
    expect(preview).toContain("__solara-preview-assets");
    expect(preview.length).toBeLessThan(2_000_000);

    const transported = renderPreviewHtml(embedded, "draft", "/", {
      assetTransport: "parent",
    });
    expect(transported).toContain("solara-preview-assets-request");
    expect(transported).toContain("data-solara-preview-src");
    expect(transported).not.toMatch(/\ssrc="\/__solara-preview-assets\//);
    expect(transported).not.toContain(payload);
    expect(transported.length).toBeLessThan(2_000_000);
  });

  it("calcula el navbar moderno para cantidades de categorías variables", () => {
    const custom = StoreProjectV2Schema.parse({
      ...structuredClone(catalogModernStore),
      navigation: {
        ...catalogModernStore.navigation,
        catalogLabel: "Explorar",
        items: [
          { id: "nav-one", label: "Una categoría", href: "/categorias/remeras/" },
          {
            id: "nav-two",
            label: "Otra categoría",
            href: "/categorias/pantalones/",
            children: [{ id: "nav-child", label: "Subcategoría", href: "/categorias/jeans/" }],
          },
        ],
      },
    });
    const html = renderPreviewHtml(custom, "draft", "/");

    expect(html).toContain('>Explorar<span class="catalog-nav-chevron"');
    expect(html).toContain("Una categoría");
    expect(html).toContain("Subcategoría");
    expect(html).toContain('class="catalog-mobile-categories"');
    expect(html).not.toContain(">Tienda</summary>");
  });
});
