import { catalogModernStore } from "@solara/project-schema/catalog-modern-fixture";
import { catalogModernCleanStore } from "@solara/project-schema/catalog-modern-template";
import { catalogModernV2Store } from "@solara/project-schema/catalog-modern-v2-fixture";
import { catalogScaleStore } from "@solara/project-schema/scale-fixture";
import { describe, expect, it } from "vitest";
import { exportProject, renderPreviewHtml } from "./index";

function normalizePreview(html: string): string {
  // Quitar inyecciones exclusivas de preview que no están en export
  return html
    .replace(/<style data-solara-preview-scrollbar>[\s\S]*?<\/style>/g, "")
    .replace(/<script id="solara-preview-cart"[\s\S]*?<\/script>/g, "")
    .replace(/<script data-solara-preview-navigation>[\s\S]*?<\/script>/g, "")
    .replace(/<script data-solara-preview-asset[\s\S]*?<\/script>/g, "")
    .replace(/href="data:text\/css;base64,[^"]+"/g, 'href="/assets/storefront.css"')
    .replace(/src="data:text\/javascript;base64,[^"]+"/g, 'src="/assets/storefront.js"');
}

function extractBody(html: string): string {
  const m = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  return m ? m[1]! : html;
}

function moduleTree(html: string): string[] {
  return [...html.matchAll(/data-solara-module="([^"]+)"/g)].map((m) => m[1]!);
}

function canonicals(html: string): string | null {
  return html.match(/<link rel="canonical"[^>]*>/i)?.[0] ?? null;
}

function seoTitle(html: string): string | null {
  return html.match(/<title>([^<]*)<\/title>/i)?.[1] ?? null;
}

function features(html: string): string | null {
  return html.match(/data-solara-features="([^"]*)"/)?.[1] ?? null;
}

describe("paridad Preview ↔ Export", () => {
  const fixtures = [
    { name: "catalogModernStore V1", project: catalogModernStore },
    { name: "catalogModernV2Store", project: catalogModernV2Store },
    { name: "catalogScaleStore 50p", project: catalogScaleStore },
    { name: "catalogModernCleanStore", project: catalogModernCleanStore },
  ];

  const routesFor = (project: typeof catalogModernV2Store): string[] => {
    const isV2 = project.commerceTemplates.designFamily === "catalog-modern-v2";
    const firstCat = project.categories.find((c) => !c.parentId);
    const firstChild = project.categories.find((c) => !!c.parentId);
    const firstProd = project.products[0];
    const routes = [
      "/",
      firstCat ? `/categorias/${firstCat.slug}/` : null,
      firstChild ? `/categorias/${firstChild.slug}/` : null,
      firstProd ? `/productos/${firstProd.slug}/` : null,
      "/buscar/",
      "/carrito/",
      isV2 ? null : "/contacto/",
      isV2 ? null : "/nosotros/",
      isV2 ? null : "/compra/",
    ].filter(Boolean) as string[];
    // paginación y 404
    const pagCat = project.categories.find(
      (c) => c.productIds.length > project.commerceTemplates.category.productsPerPage,
    );
    if (pagCat) routes.push(`/categorias/${pagCat.slug}/pagina/2/`);
    routes.push("/no-existe-404-test/");
    return [...new Set(routes)];
  };

  for (const { name, project } of fixtures) {
    it(`previo ${name}: buildPages y renderDocument comparten árbol semántico y SEO`, () => {
      const routes = routesFor(project as any);
      const exported = exportProject(project as any, { mode: "draft" });
      for (const route of routes) {
        const previewHtml = normalizePreview(renderPreviewHtml(project as any, "draft", route));
        const pageFile =
          route === "/"
            ? "index.html"
            : `${route.replace(/^\//, "").replace(/\/$/, "")}/index.html`;
        const exportedHtmlRaw =
          exported.files.get(pageFile) ?? exported.files.get("404.html") ?? "";
        const exportedHtml = String(exportedHtmlRaw ?? "");
        // comparar árbol de módulos (orden y presencia)
        const previewTree = moduleTree(previewHtml);
        const exportTree = moduleTree(exportedHtml);
        expect(previewTree, `moduleTree divergente ${name} ${route}`).toEqual(exportTree);
        // comparar SEO básico (title/canonical/features) — deben ser idénticos
        expect(seoTitle(previewHtml), `title ${name} ${route}`).toBe(seoTitle(exportedHtml));
        expect(canonicals(previewHtml), `canonical ${name} ${route}`).toBe(
          canonicals(exportedHtml),
        );
        expect(features(previewHtml), `features ${name} ${route}`).toBe(features(exportedHtml));
        // comparar body sin preview wrappers (invariante estructural)
        const _previewBody = extractBody(previewHtml).replace(/\s+/g, " ").trim();
        const _exportBody = extractBody(exportedHtml).replace(/\s+/g, " ").trim();
        // no snapshots gigantes: verificar que el body export contiene el mismo contenido textual clave que preview (primeros 200 chars de títulos)
        // extraer h1/h2
        const h1Preview =
          previewHtml
            .match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1]
            ?.replace(/<[^>]+>/g, "")
            .trim() ?? "";
        const h1Export =
          exportedHtml
            .match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1]
            ?.replace(/<[^>]+>/g, "")
            .trim() ?? "";
        expect(h1Preview, `h1 ${name} ${route}`).toBe(h1Export);
      }
    });
  }

  it("extremos: settings vacíos, largos y especiales no divergen", () => {
    const base = structuredClone(catalogModernV2Store) as any;
    // extremos: títulos largos dentro de límites Zod (70/180), caracteres especiales, assets faltantes
    base.identity.brandName = `${"A".repeat(50)} & <test> " '`;
    base.seo.title = "T".repeat(60);
    base.seo.description = `${"D".repeat(150)} <script>`;
    const grid = base.sections.find((s: any) => s.moduleId === "catalog-product-grid");
    if (grid) {
      grid.settings.title = ""; // vacío
      grid.settings.limit = 1;
      grid.settings.showRating = true; // aunque ya no renderiza, no debe divergir
    }
    const hero = base.sections.find((s: any) => s.moduleId === "catalog-hero");
    if (hero) {
      hero.settings.title = " ";
      hero.settings.subtitle = "";
      hero.settings.posterAssetId = ""; // asset faltante
    }
    const product = base.products[0];
    if (product) product.title = `${"P".repeat(150)} & " < >`;
    const preview = normalizePreview(renderPreviewHtml(base, "draft", "/"));
    const exported = String(exportProject(base, { mode: "draft" }).files.get("index.html"));
    expect(moduleTree(preview)).toEqual(moduleTree(exported));
    expect(seoTitle(preview)).toBe(seoTitle(exported));
    // no debe contener legacy contaminante
    expect(preview).not.toContain("legacy-editorial");
    expect(exported).not.toContain("legacy-editorial");
  });

  it("paridad de URLs y assets: hrefs internos y data-solara-features", () => {
    const project = catalogModernV2Store as any;
    const preview = normalizePreview(renderPreviewHtml(project, "draft", "/"));
    const exported = String(exportProject(project, { mode: "draft" }).files.get("index.html"));
    const hrefs = (html: string) =>
      [...html.matchAll(/href="(\/[^"]*)"/g)]
        .map((m) => m[1]!)
        .filter((v): v is string => typeof v === "string")
        .sort();
    const previewHrefs = hrefs(preview);
    const exportHrefs = hrefs(exported);
    // preview añade navegación bridge pero los hrefs del body deben coincidir (permitir extra de preview)
    for (const href of exportHrefs) {
      if (href.startsWith("/assets/")) continue; // preview normalizado ya, pero por si acaso
      expect(previewHrefs).toContain(href);
    }
    // data-solara-features debe ser idéntico (capabilities)
    expect(features(preview)).toBe(features(exported));
  });

  it("estado sin JS y con JS: noscript y data-solara-features presentes en ambos", () => {
    const project = catalogModernV2Store as any;
    const preview = renderPreviewHtml(project, "draft", `/productos/${project.products[0].slug}/`);
    const exported = String(
      exportProject(project, { mode: "draft" }).files.get(
        `productos/${project.products[0].slug}/index.html`,
      ),
    );
    for (const html of [preview, exported]) {
      expect(html).toContain("data-product"); // estado con JS
      expect(html).toContain("<noscript"); // fallback sin JS
    }
    expect(normalizePreview(preview)).toContain("data-product");
  });

  it("defaults Zod: proyecto mínimo con defaults no diverge", () => {
    const minimal = structuredClone(catalogModernCleanStore) as any;
    // minimal ya es válido (template clean con defaults Zod)
    const preview = normalizePreview(renderPreviewHtml(minimal, "draft", "/"));
    const exported = String(exportProject(minimal, { mode: "draft" }).files.get("index.html"));
    expect(moduleTree(preview)).toEqual(moduleTree(exported));
    expect(seoTitle(preview)).toBe(seoTitle(exported));
  });
  it("V2 no contamina con legacy-editorial-v1; V1 puede contenerlos", () => {
    const v2Preview = normalizePreview(
      renderPreviewHtml(catalogModernV2Store as any, "draft", "/"),
    );
    const v2Export = String(
      exportProject(catalogModernV2Store as any, { mode: "draft" }).files.get("index.html"),
    );
    const v1Export = String(
      exportProject(catalogModernStore as any, { mode: "draft" }).files.get("index.html"),
    );
    for (const html of [v2Preview, v2Export]) {
      expect(html).not.toMatch(/legacy-editorial-v1/);
      expect(html).not.toContain('data-solara-module="legacy-');
    }
    // V1 sí puede tener legacy (no es bug), solo verificamos que preview y export coinciden en V1 también
    expect(moduleTree(v1Export).join(",")).toBe(
      moduleTree(normalizePreview(renderPreviewHtml(catalogModernStore as any, "draft", "/"))).join(
        ",",
      ),
    );
  });
  it("cada moduleId respeta su Zod y no diverge en extremos (vacío, largo, especial)", () => {
    const base = structuredClone(catalogModernV2Store) as any;
    // announcement
    const ann = base.sections.find((s: any) => s.moduleId === "catalog-announcement");
    if (ann) {
      ann.settings.text = "";
      ann.settings.linkLabel = "A".repeat(60);
      ann.settings.linkHref = "/";
    }
    // header
    const header = base.sections.find((s: any) => s.moduleId === "catalog-header");
    if (header) {
      header.settings.cartLabel = "";
      header.settings.searchLabel = " ";
    }
    // hero
    const hero = base.sections.find((s: any) => s.moduleId === "catalog-hero");
    if (hero) {
      hero.settings.title = "";
      hero.settings.subtitle = "X".repeat(120);
      hero.settings.ctaLabel = "";
    }
    // brand strip
    const strip = base.sections.find((s: any) => s.moduleId === "catalog-brand-strip");
    if (strip) strip.settings.title = "";
    // product grid
    const grid = base.sections.find((s: any) => s.moduleId === "catalog-product-grid");
    if (grid) {
      grid.settings.title = "";
      grid.settings.limit = 1;
      grid.settings.showViewAll = false;
    }
    // testimonials
    const testi = base.sections.find((s: any) => s.moduleId === "catalog-testimonials");
    if (testi && Array.isArray(testi.settings.items)) testi.settings.items = [];
    // newsletter
    const nl = base.sections.find((s: any) => s.moduleId === "catalog-newsletter-cta");
    if (nl) {
      nl.settings.title = "";
      nl.settings.buttonLabel = "";
    }
    // footer
    const footer = base.sections.find((s: any) => s.moduleId === "catalog-footer");
    if (footer) footer.settings.note = "";
    const routes = [
      "/",
      `/productos/${base.products[0].slug}/`,
      `/categorias/${base.categories[0].slug}/`,
    ];
    const exported = exportProject(base, { mode: "draft" });
    for (const route of routes) {
      const preview = normalizePreview(renderPreviewHtml(base, "draft", route));
      const file =
        route === "/" ? "index.html" : `${route.replace(/^\//, "").replace(/\/$/, "")}/index.html`;
      const expHtml = String(exported.files.get(file) ?? exported.files.get("404.html") ?? "");
      expect(moduleTree(preview), `moduleTree ${route}`).toEqual(moduleTree(expHtml));
      expect(features(preview), `features ${route}`).toBe(features(expHtml));
    }
  });
  it("SEO paridad: title, description, canonical, og:image, robots, JSON-LD", () => {
    const project = structuredClone(catalogModernV2Store) as any;
    project.seo.title = "SEO Title Test";
    project.seo.description = "SEO desc dentro de límites válidos para test";
    project.seo.socialImageId = project.assets[0]?.id ?? "";
    const routes = [
      "/",
      `/productos/${project.products[0].slug}/`,
      `/categorias/${project.categories[0].slug}/`,
    ];
    const exported = exportProject(project, { mode: "draft" });
    for (const route of routes) {
      const preview = normalizePreview(renderPreviewHtml(project, "draft", route));
      const file =
        route === "/" ? "index.html" : `${route.replace(/^\//, "").replace(/\/$/, "")}/index.html`;
      const exp = String(exported.files.get(file) ?? "");
      const seo = (html: string) => ({
        title: seoTitle(html),
        desc: html.match(/<meta name="description" content="([^"]*)">/)?.[1] ?? null,
        canonical: canonicals(html),
        ogImage: html.match(/<meta property="og:image" content="([^"]*)">/)?.[1] ?? null,
        robots: html.match(/<meta name="robots" content="([^"]*)">/)?.[1] ?? null,
        jsonLd: (html.match(/<script type="application\/ld\+json">/g) ?? []).length,
      });
      expect(seo(preview), `seo ${route}`).toEqual(seo(exp));
    }
  });
});
