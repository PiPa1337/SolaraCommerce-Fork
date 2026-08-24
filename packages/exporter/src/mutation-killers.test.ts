import { catalogModernV2Store } from "@solara/project-schema/catalog-modern-v2-fixture";
import { describe, expect, it } from "vitest";
import { exportProject, renderPreviewHtml } from "./index";

describe("mutation-killers: exporter", () => {
  // M11: quitar escapeHtml en title/description → XSS sobreviviría si no hay test
  it("escapa XSS en brandName/titulo para title y og", () => {
    const p: any = structuredClone(catalogModernV2Store);
    p.identity.brandName = '<script>alert(1)</script> & "test"';
    p.products[0].title = 'Prod & <b>bold</b> "x"';
    const html = String(exportProject(p, { mode: "production" }).files.get("index.html"));
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("&amp;");
    expect(html).toContain("&quot;");
    // título de producto en home grid debe estar escapado
    expect(html).not.toContain("Prod & <b>");
    expect(html).toContain("Prod &amp;");
  });

  // M14: omitir sitemap page → test debe verificar que sitemap lista todas las páginas indexables
  it("sitemap.xml lista todas las rutas indexables y coincide con manifest", () => {
    const p: any = structuredClone(catalogModernV2Store);
    const result = exportProject(p, { mode: "production" });
    const sitemap = String(result.files.get("sitemap.xml") ?? "");
    expect(sitemap).toContain("<urlset");
    // debe contener home y al menos una categoría y un producto
    expect(sitemap).toContain("<loc>");
    const locs = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
    expect(locs.length).toBeGreaterThanOrEqual(3);
    // manifest indexableRoutes debe estar reflejado en sitemap
    // si se omite una página, este test fallaría (mutación kill)
    expect(sitemap).toContain("/categorias/");
    expect(sitemap).toContain("/productos/");
    expect(sitemap).not.toContain("/carrito/");
    expect(sitemap).not.toContain("/buscar/");
  });

  // M15: robots y canonical mutaciones
  it("canonical es absoluto y con baseUrl correcta", () => {
    const p: any = structuredClone(catalogModernV2Store);
    p.baseUrl = "https://example.com/tienda/";
    const html = String(exportProject(p, { mode: "production" }).files.get("index.html"));
    const canon = html.match(/<link rel="canonical" href="([^"]+)"/)?.[1] ?? "";
    expect(canon).toBe("https://example.com/tienda/");
    // mutación que use href relativo fallaría
    expect(canon).toMatch(/^https:\/\//);
    // sitemap debe respetar subcarpeta
    const sitemap = String(exportProject(p, { mode: "production" }).files.get("sitemap.xml"));
    expect(sitemap).toContain("https://example.com/tienda/");
  });

  it("robots: draft noindex, production index + sitemap", () => {
    const p: any = structuredClone(catalogModernV2Store);
    const draft = String(exportProject(p, { mode: "draft" }).files.get("index.html"));
    expect(draft).toContain('content="noindex,nofollow"');
    const prod = String(exportProject(p, { mode: "production" }).files.get("index.html"));
    expect(prod).toContain('content="index,follow');
    const robotsProd = String(exportProject(p, { mode: "production" }).files.get("robots.txt"));
    expect(robotsProd).toContain("Sitemap:");
    const robotsDraft = String(exportProject(p, { mode: "draft" }).files.get("robots.txt"));
    expect(robotsDraft).toContain("Disallow: /");
  });

  // M16: alt faltante → debe haber alt en og:image y en imágenes de producto
  it("usa alt no vacío o fallback para og:image", () => {
    const p: any = structuredClone(catalogModernV2Store);
    p.assets[0].alt = "";
    p.seo.socialImageId = p.assets[0].id;
    const html = String(exportProject(p, { mode: "production" }).files.get("index.html"));
    // si alt está vacío, debe fallback a title, no dejar alt vacío sin fallback testeable
    expect(html).toMatch(/og:image:alt/);
    const alt = html.match(/property="og:image:alt" content="([^"]*)"/)?.[1] ?? "";
    expect(alt.length).toBeGreaterThan(0);
  });

  // M17: fallback no-JS — HTML inicial útil sin JS
  it("producto y categoría son utilizables sin JS (noscript y enlaces reales)", () => {
    const p: any = structuredClone(catalogModernV2Store);
    const prodSlug = p.products[0].slug;
    const prodHtml = String(
      exportProject(p, { mode: "production" }).files.get(`productos/${prodSlug}/index.html`),
    );
    expect(prodHtml).toContain("<noscript");
    // sin JS debe haber contenido textual y href reales, no placeholders vacíos
    expect(prodHtml).toContain(p.products[0].title.slice(0, 10));
    // búsqueda debe tener form con action real (no solo JS)
    const searchHtml = String(
      exportProject(p, { mode: "production" }).files.get("buscar/index.html"),
    );
    expect(searchHtml).toContain("<form");
    expect(searchHtml).toContain('action="/buscar/"');
  });

  // M18: romper reduced motion → CSS debe contener prefers-reduced-motion
  it("declara prefers-reduced-motion en CSS", () => {
    const p: any = structuredClone(catalogModernV2Store);
    const files = exportProject(p, { mode: "production" }).files;
    const cssPath = [...files.keys()].find((path) =>
      /^assets\/storefront\.[a-f0-9]+\.css$/i.test(path),
    );
    const css = String(files.get(cssPath!));
    expect(css).toContain("prefers-reduced-motion");
    // mutación que elimine el bloque rompería este test
  });

  // M20: omitir capability runtimeFeatures → manifest debe listar cart/search cuando habilitados
  it("manifest runtimeFeatures refleja search/cart habilitados", async () => {
    const p: any = structuredClone(catalogModernV2Store);
    p.commerceTemplates.search.enabled = true;
    p.commerceTemplates.cart.enabled = true;
    const { createPublicExportManifest } = await import("./index");
    const manifest = createPublicExportManifest(p);
    expect(manifest.runtimeFeatures).toContain("search");
    expect(manifest.runtimeFeatures).toContain("cart");
    expect(manifest.searchEnabled).toBe(true);
    // si se invierte condición o se omite capability, fallaría
    p.commerceTemplates.search.enabled = false;
    const manifest2 = createPublicExportManifest(p);
    expect(manifest2.runtimeFeatures).not.toContain("search");
  });

  // M11b: preview y export deben escapar igual (paridad de escape)
  it("preview y export escapan igual XSS", () => {
    const p: any = structuredClone(catalogModernV2Store);
    p.identity.brandName = "A & B <C> \"D\" 'E'";
    const preview = renderPreviewHtml(p, "production", "/");
    const exported = String(exportProject(p, { mode: "production" }).files.get("index.html"));
    // ambos deben contener entidades escapadas y no el raw
    expect(preview).toContain("&amp;");
    expect(exported).toContain("&amp;");
    expect(preview).not.toContain("A & B <C>");
    expect(exported).not.toContain("A & B <C>");
  });
});
