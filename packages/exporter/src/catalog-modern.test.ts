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
    expect(categoryPages).toHaveLength(17);
    expect(home).toContain('data-design-family="catalog-modern-v1"');
    expect(home).not.toMatch(/[ÃÂ�]/);
    expect(home).toContain('data-solara-module="catalog-product-grid"');
    expect(home).toContain("/fixtures/modo-sur-hero.png");
    expect(home).toContain("/fixtures/modo-sur-remera.png");
    expect(home.match(/data-product-card/g) ?? []).toHaveLength(20);
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

  it("mantiene la paridad entre preview y ZIP y el índice de búsqueda", () => {
    const preview = renderPreviewHtml(catalogModernStore, "draft", "/");
    const exportedHome = String(exported.files.get("index.html"));
    const moduleTree = (html: string) =>
      [...html.matchAll(/data-solara-module="([^"]+)"/g)].map((match) => match[1]);
    const search = JSON.parse(String(exported.files.get("search-index.json"))) as unknown[];

    expect(moduleTree(preview)).toEqual(moduleTree(exportedHome));
    expect(search).toHaveLength(50);
    expect(String(exported.files.get("categorias/novedades/pagina/2/index.html"))).toContain(
      'rel="prev"',
    );
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
    expect(category).toContain('data-solara-module="catalog-newsletter-cta"');
    expect(category).not.toContain('data-solara-module="catalog-testimonials"');
    const cart = String(exported.files.get("carrito/index.html"));
    expect(cart).toContain("data-cart-subtotal");
    expect(cart).toContain("Entrega");
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
});
