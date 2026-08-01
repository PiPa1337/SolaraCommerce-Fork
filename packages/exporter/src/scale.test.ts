import { catalogScaleStore } from "@solara/project-schema/scale-fixture";
import { describe, expect, it } from "vitest";
import { exportProject, renderPreviewHtml } from "./index";

describe("exporter con catálogo jerárquico de escala", () => {
  const exported = exportProject(catalogScaleStore, { mode: "production" });

  it("genera productos, categorías y paginación esperados", () => {
    const productPages = [...exported.files.keys()].filter((path) =>
      /^productos\/[^/]+\/index\.html$/.test(path),
    );
    const categoryPages = [...exported.files.keys()].filter((path) =>
      /^categorias\/[^/]+\//.test(path),
    );

    expect(productPages).toHaveLength(50);
    expect(categoryPages).toHaveLength(17);
    expect(exported.files.has("categorias/novedades/index.html")).toBe(true);
    expect(exported.files.has("categorias/novedades/pagina/2/index.html")).toBe(true);
    expect(String(exported.files.get("categorias/novedades/pagina/2/index.html"))).toContain(
      'rel="prev"',
    );
    expect(String(exported.files.get("categorias/novedades/index.html"))).toContain('rel="next"');

    const sitemap = String(exported.files.get("sitemap.xml"));
    const locations = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)]
      .map((match) => match[1])
      .filter((location): location is string => Boolean(location));
    expect(new Set(locations).size).toBe(locations.length);
    expect(locations.filter((location) => location.includes("/categorias/")).length).toBe(17);
    expect(locations.filter((location) => location.includes("/productos/")).length).toBe(50);
  });

  it("agrega descendientes en padres y conserva hojas aisladas", () => {
    const casa = String(exported.files.get("categorias/casa/index.html"));
    const textiles = String(exported.files.get("categorias/textiles/index.html"));
    const decoracionProduct = catalogScaleStore.products.find((product) =>
      product.categoryIds.includes("category-decoracion" as (typeof product.categoryIds)[number]),
    );
    const textilesProduct = catalogScaleStore.products.find((product) =>
      product.categoryIds.includes("category-textiles" as (typeof product.categoryIds)[number]),
    );
    if (!decoracionProduct || !textilesProduct) throw new Error("Fixture incompleto");

    expect(casa).toContain("Explorar Casa");
    expect(casa).toContain(`/productos/${decoracionProduct.slug}/`);
    expect(textiles).toContain(`/categorias/casa/`);
    expect(textiles).toContain('aria-current="page">Textiles</span>');
    expect(textiles).toContain(`/productos/${textilesProduct.slug}/`);
    expect(textiles).not.toContain(`/productos/${decoracionProduct.slug}/`);
  });

  it("indexa ancestros, variantes y assets reutilizados", () => {
    const search = JSON.parse(String(exported.files.get("search-index.json"))) as Array<{
      categoryNames: string[];
      title: string;
    }>;
    const feed = String(exported.files.get("google-merchant.xml"));
    const home = String(exported.files.get("index.html"));

    expect(search).toHaveLength(50);
    expect(search.find((entry) => entry.title === "Pieza de escala 01")?.categoryNames).toContain(
      "Casa",
    );
    expect(feed.match(/<item>/g)).toHaveLength(60);
    expect(new Set([...home.matchAll(/\/fixtures\/[^"']+/g)].map((match) => match[0])).size).toBe(
      3,
    );
  });

  it("mantiene paridad entre preview y exportación en categoría hija y página 2", () => {
    const moduleTree = (html: string) =>
      [...html.matchAll(/data-solara-module="([^"]+)"/g)].map((match) => match[1]);
    const childPreview = renderPreviewHtml(catalogScaleStore, "draft", "/categorias/textiles/");
    const childExport = String(exported.files.get("categorias/textiles/index.html"));
    const pageTwoPreview = renderPreviewHtml(
      catalogScaleStore,
      "draft",
      "/categorias/novedades/pagina/2/",
    );
    const pageTwoExport = String(exported.files.get("categorias/novedades/pagina/2/index.html"));

    expect(moduleTree(childPreview)).toEqual(moduleTree(childExport));
    expect(moduleTree(pageTwoPreview)).toEqual(moduleTree(pageTwoExport));
    expect(childPreview).toContain("Casa");
    expect(pageTwoPreview).toContain("Novedades");
    expect(exportProject(catalogScaleStore, { mode: "production" }).zip).toEqual(exported.zip);
  });
});
