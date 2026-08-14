import { CATALOG_MODERN_PLACEHOLDER_PHONE } from "@solara/project-schema";
import { catalogModernStore } from "@solara/project-schema/catalog-modern-fixture";
import { catalogModernV2Store } from "@solara/project-schema/catalog-modern-v2-fixture";
import { referenceStore } from "@solara/project-schema/fixture";
import { catalogScaleStore } from "@solara/project-schema/scale-fixture";
import { describe, expect, it } from "vitest";
import {
  auditProject,
  buildCommerceSnapshot,
  createProjectArchive,
  createPublicExportManifest,
  exportProject,
  readProjectArchive,
  renderPreviewHtml,
} from "./index";

function onlineStoreJsonLd(homeHtml: string): Record<string, unknown> {
  for (const script of homeHtml.matchAll(
    /<script type="application\/ld\+json">([\s\S]*?)<\/script>/g,
  )) {
    const data = JSON.parse(script[1] ?? "{}") as Record<string, unknown>;
    if (data["@type"] === "OnlineStore") return data;
  }
  throw new Error("Falta el bloque JSON-LD OnlineStore.");
}

function homeMetaDescription(homeHtml: string): string {
  return /<meta name="description" content="([^"]*)"/.exec(homeHtml)?.[1] ?? "";
}

describe("exporter", () => {
  it("crea páginas estáticas y un feed consistente", () => {
    const result = exportProject(referenceStore, { mode: "production" });
    const productHtml = String(result.files.get("productos/manta-bruma/index.html"));
    const feed = String(result.files.get("google-merchant.xml"));

    expect(productHtml).toContain("Manta Bruma");
    expect(productHtml).toContain("78500.00");
    expect(productHtml).toContain('"@type":"ProductGroup"');
    expect(feed.match(/<item>/g)).toHaveLength(3);
    expect(feed).toContain("<g:price>78500.00 ARS</g:price>");
    expect(result.files.has("ai-context.json")).toBe(true);
    expect(result.files.has("llms.txt")).toBe(true);
    expect(result.optimization.aiReadiness.structuredDataSource).toBe("shared-snapshot");
    expect(productHtml).toContain('href="/ai-context.json"');
  });

  it("usa un snapshot comercial para HTML, variantes, sitemap y feed", () => {
    const snapshot = buildCommerceSnapshot(referenceStore);
    const result = exportProject(referenceStore, { mode: "production" });
    const productHtml = String(result.files.get("productos/manta-bruma/index.html"));
    const collectionHtml = String(result.files.get("colecciones/casa-serena/index.html"));
    const sitemap = String(result.files.get("sitemap.xml"));
    const imageSitemap = String(result.files.get("image-sitemap.xml"));
    const feed = String(result.files.get("google-merchant.xml"));

    expect(snapshot.offers).toHaveLength(3);
    expect(new Set(snapshot.offers.map((offer) => offer.variantId)).size).toBe(3);
    expect(snapshot.offers[0]?.variantPath).toBe(
      "/productos/manta-bruma/?variant=variant-manta-musgo",
    );
    expect(productHtml).toContain("https://casa-luma.example/fixtures/manta-bruma.png");
    expect(productHtml).toContain("https://schema.org/color");
    expect(collectionHtml).toContain("Casa serena");
    expect(sitemap).toContain("https://casa-luma.example/colecciones/casa-serena/");
    expect(sitemap).toContain("https://casa-luma.example/envios/");
    expect(imageSitemap).toContain("https://casa-luma.example/fixtures/manta-bruma.png");
    expect(feed).toContain(
      "<g:image_link>https://casa-luma.example/fixtures/manta-bruma.png</g:image_link>",
    );
    expect(feed).toContain("<g:mpn>JD-12-CRU</g:mpn>");
    const noIdentifierProject = {
      ...referenceStore,
      products: referenceStore.products.map((product) => ({
        ...product,
        variants: product.variants.map((variant) => ({
          ...variant,
          gtin: undefined,
          mpn: undefined,
        })),
      })),
    };
    const noIdentifierFeed = String(
      exportProject(noIdentifierProject, { mode: "production" }).files.get("google-merchant.xml"),
    );
    expect(noIdentifierFeed).toContain("<g:identifier_exists>no</g:identifier_exists>");
  });

  it("mantiene contenido y SEO en el HTML inicial", () => {
    const preview = renderPreviewHtml(referenceStore);
    const css = String(
      exportProject(referenceStore, { mode: "draft" }).files.get("assets/storefront.css"),
    );
    expect(preview).toContain("Una casa con materia y calma.");
    expect(preview).toContain('<meta name="description"');
    expect(preview).toContain('<script type="application/ld+json">');
    expect(css).not.toContain("color-scheme: light dark");
    expect(css).toContain('.solara-page[data-color-mode="auto"]{color-scheme:dark}');
  });

  it("consume data-theme del html con color-scheme en el CSS exportado", () => {
    const darkProject = {
      ...referenceStore,
      theme: { ...referenceStore.theme, colorMode: "dark" },
    } as typeof referenceStore;
    const darkCss = String(
      exportProject(darkProject, { mode: "draft" }).files.get("assets/storefront.css"),
    );
    const darkHtml = String(exportProject(darkProject, { mode: "draft" }).files.get("index.html"));
    expect(darkHtml).toContain('data-theme="dark"');
    expect(darkCss).toContain('html[data-theme="dark"]{color-scheme:dark}');

    const lightCss = String(
      exportProject(referenceStore, { mode: "draft" }).files.get("assets/storefront.css"),
    );
    expect(lightCss).toContain('html[data-theme="light"]{color-scheme:light}');
  });

  it("usa el mismo árbol semántico de módulos en preview y home exportado", () => {
    const preview = renderPreviewHtml(referenceStore);
    const exported = String(
      exportProject(referenceStore, { mode: "draft" }).files.get("index.html"),
    );
    const moduleTree = (html: string) =>
      [...html.matchAll(/data-solara-module="([^"]+)"/g)].map((match) => match[1]);

    expect(moduleTree(preview)).toEqual(moduleTree(exported));
  });

  it("incluye estilos una sola vez y excluye assets de módulos deshabilitados", () => {
    const source = referenceStore.sections.find((section) => section.moduleId === "trust-strip");
    if (!source) throw new Error("Fixture incompleto");
    const project = {
      ...referenceStore,
      sections: [
        ...referenceStore.sections,
        { ...source, id: "section-trust-copy", enabled: true },
        {
          ...source,
          id: "section-disabled-content",
          slot: "content",
          moduleId: "editorial-hero",
          enabled: false,
        },
      ],
    };
    const result = exportProject(project as typeof referenceStore, { mode: "draft" });
    const baseline = exportProject(referenceStore, { mode: "draft" });
    const css = String(result.files.get("assets/storefront.css"));
    const html = String(result.files.get("index.html"));

    expect(css).toBe(baseline.files.get("assets/storefront.css"));
    expect(css).not.toContain('[data-solara-module="editorial-hero"]');
    expect(html).not.toContain('data-solara-module="editorial-hero"');
    expect([...result.files.keys()].filter((path) => path === "assets/storefront.js")).toHaveLength(
      1,
    );
  });

  it("deduplica el bloque catalog-modern por style key en la exportación", () => {
    const css = String(
      exportProject(catalogModernStore, { mode: "production" }).files.get("assets/storefront.css"),
    );
    const distinctive = "catalog-modern .catalog-product-card h3 a:hover";

    expect(css.split(distinctive).length - 1).toBe(1);
    expect(new Blob([css]).size).toBeLessThan(300_000);
  });

  it("incluye la foundation V2 sólo en proyectos catalog-modern-v2", () => {
    const v1Result = exportProject(catalogModernStore, { mode: "production" });
    const v2Result = exportProject(catalogModernV2Store, { mode: "production" });
    const v1Css = String(v1Result.files.get("assets/storefront.css"));
    const v2Css = String(v2Result.files.get("assets/storefront.css"));
    const v1Home = String(v1Result.files.get("index.html"));
    const v2Home = String(v2Result.files.get("index.html"));

    expect(v2Css).toContain(".cm.v2 .catalog-hero-inner");
    expect(v2Css).toContain("--catalog-v2-motion-editorial");
    expect(v2Css).toContain("prefers-reduced-motion:reduce");
    expect(v2Home).toContain("catalog-modern-v2 cm v2");
    expect(v1Css).not.toContain("--catalog-v2-motion-editorial");
    expect(v1Home).not.toContain("catalog-modern-v2 cm v2");
  });

  it("compone políticas y recuperación 404 V2 sin inventar condiciones", () => {
    const result = exportProject(catalogModernV2Store, { mode: "production" });
    const shipping = String(result.files.get("envios/index.html"));
    const returns = String(result.files.get("devoluciones/index.html"));
    const privacy = String(result.files.get("privacidad/index.html"));
    const notFound = String(result.files.get("404.html"));

    expect(shipping).toContain('class="solara-editorial-page solara-policy-page');
    expect(shipping).toContain("Preparación del pedido");
    expect(shipping).toContain("1 a 3 días");
    expect(shipping).toContain("2 a 7 días");
    expect(shipping).toContain("Argentina");
    expect(returns).toContain("Plazo informado");
    expect(returns).toContain("10 días");
    expect(privacy).toContain(catalogModernV2Store.policies.privacy);
    expect(notFound).toContain('class="solara-error-code" aria-hidden="true">404');
    expect(notFound).toContain("Volver al inicio");
    expect(shipping).not.toMatch(/envío gratis|seguimiento|transportista/i);
  });

  it("rechaza proyectos inválidos con una ruta accionable en cada límite público", () => {
    const invalid = { ...referenceStore, baseUrl: "no-es-una-url" };

    expect(() => exportProject(invalid as typeof referenceStore, { mode: "draft" })).toThrow(
      /exportar.*baseUrl/i,
    );
    expect(() => renderPreviewHtml(invalid as typeof referenceStore)).toThrow(
      /vista previa.*baseUrl/i,
    );
    expect(() => createProjectArchive(invalid as typeof referenceStore)).toThrow(
      /archivo del proyecto.*baseUrl/i,
    );
  });

  it("envuelve errores internos de generación con contexto de fase accionable", () => {
    const broken = structuredClone(referenceStore);
    const section = broken.sections.find((candidate) => candidate.moduleId === "hero-media");
    if (!section) throw new Error("Fixture incompleto");
    section.moduleId = "modulo-inexistente";

    expect(() => exportProject(broken as typeof referenceStore, { mode: "draft" })).toThrow(
      /generación del sitio falló.*Módulo desconocido: modulo-inexistente/s,
    );
    expect(() => renderPreviewHtml(broken as typeof referenceStore)).toThrow(
      /generación del sitio falló.*Módulo desconocido: modulo-inexistente/s,
    );
  });

  it("excluye feed y agrega noindex en borrador", () => {
    const result = exportProject(referenceStore, { mode: "draft" });
    expect(result.files.has("google-merchant.xml")).toBe(false);
    expect(result.files.has("sitemap.xml")).toBe(false);
    expect(result.files.get("robots.txt")).toContain("Disallow: /");
    expect(result.files.get("index.html")).toContain("noindex,nofollow");
  });

  it("declara capacidades públicas y noindexa rutas transaccionales", () => {
    const result = exportProject(referenceStore, { mode: "production" });
    const manifest = createPublicExportManifest(referenceStore);
    const search = String(result.files.get("buscar/index.html"));
    const cart = String(result.files.get("carrito/index.html"));
    const checkout = String(result.files.get("compra/index.html"));
    const home = String(result.files.get("index.html"));

    expect(manifest.searchEnabled).toBe(true);
    expect(manifest.cartEnabled).toBe(true);
    expect(manifest.runtimeFeatures).toContain("cart");
    expect(manifest.runtimeFeatures).toContain("motion");
    expect(home).toContain('data-solara-runtime-features="');
    expect(search).toContain('<meta name="robots" content="noindex,follow">');
    expect(cart).toContain('<meta name="robots" content="noindex,follow">');
    expect(checkout).toContain('<meta name="robots" content="noindex,follow">');
  });

  it("precarga sólo la imagen crítica de cada ruta y conserva headers de cache", () => {
    const result = exportProject(referenceStore, { mode: "production" });
    const home = String(result.files.get("index.html"));
    const product = String(result.files.get("productos/manta-bruma/index.html"));
    const headers = String(result.files.get("_headers"));

    expect(home.match(/<link rel="preload" as="image"/g)).toHaveLength(1);
    expect(product.match(/<link rel="preload" as="image"/g)).toHaveLength(1);
    expect(headers).toContain("/assets/*");
    expect(headers).toContain("max-age=31536000, immutable");
    expect(headers).toContain("/ai-context.json");
  });

  it("publica rutas editoriales, catálogo reconciliable y sitemaps sin checkout", () => {
    const result = exportProject(referenceStore, { mode: "production" });
    const sitemap = String(result.files.get("sitemap.xml"));
    expect(result.files.has("nosotros/index.html")).toBe(true);
    expect(result.files.has("contacto/index.html")).toBe(true);
    expect(result.files.has("buscar/index.html")).toBe(true);
    expect(result.files.has("carrito/index.html")).toBe(true);
    expect(result.files.has("compra/index.html")).toBe(true);
    expect(result.files.has("404.html")).toBe(true);
    expect(result.files.has("catalog-index.json")).toBe(true);
    expect(sitemap).not.toContain("/buscar/");
    expect(sitemap).not.toContain("/carrito/");
    expect(sitemap).not.toContain("/compra/");
    expect(sitemap).not.toContain("/404.html");
  });

  it("respeta el shell desactivado y no incluye sus estilos", () => {
    const project = {
      ...referenceStore,
      siteShell: {
        ...referenceStore.siteShell,
        announcement: false,
        header: false,
        footer: false,
        cart: false,
      },
    };
    const result = exportProject(project, { mode: "draft" });
    const html = String(result.files.get("index.html"));
    const css = String(result.files.get("assets/storefront.css"));

    expect(html).not.toContain('data-solara-module="announcement-bar"');
    expect(html).not.toContain('data-solara-module="editorial-header"');
    expect(html).not.toContain('data-solara-module="cart-drawer"');
    expect(html).not.toContain('data-solara-module="editorial-footer"');
    expect(css).not.toContain('[data-solara-module="editorial-header"]');
    expect(css).not.toContain('[data-solara-module="cart-drawer"]');
  });

  it("omite media que solo pertenece a una seccion deshabilitada", () => {
    const baseAsset = referenceStore.assets[0];
    if (!baseAsset) throw new Error("Fixture incompleto");
    const unusedAsset = {
      ...baseAsset,
      id: "asset-disabled-hero" as typeof baseAsset.id,
      name: "Poster deshabilitado",
      source: "data:image/png;base64,AA==",
      width: 1,
      height: 1,
      hash: "disabled-hero",
    };
    const project = {
      ...referenceStore,
      assets: [...referenceStore.assets, unusedAsset],
      sections: referenceStore.sections.map((section) =>
        section.slot === "hero"
          ? {
              ...section,
              enabled: false,
              settings: { ...section.settings, posterAssetId: unusedAsset.id },
            }
          : section,
      ),
    };
    const result = exportProject(project, { mode: "draft" });

    expect(result.files.has("assets/disabled-hero.png")).toBe(false);
  });

  it("renderiza rutas comerciales en el preview compartido", () => {
    const category = renderPreviewHtml(referenceStore, "draft", "/categorias/textiles/");
    const product = renderPreviewHtml(referenceStore, "draft", "/productos/manta-bruma/");

    expect(category).toContain("Textiles");
    expect(product).toContain("Manta Bruma");
  });

  it("incluye estilos de las secciones editoriales en preview y exportación", () => {
    const source = referenceStore.sections.find((section) => section.slot === "content");
    if (!source) throw new Error("Fixture incompleto");
    const project = {
      ...referenceStore,
      pages: referenceStore.pages.map((page) =>
        page.kind === "about"
          ? { ...page, sections: [{ ...structuredClone(source), id: "about-story" }] }
          : page,
      ),
    } as typeof referenceStore;
    const preview = renderPreviewHtml(project, "draft", "/nosotros/");
    const exported = String(
      exportProject(project, { mode: "draft" }).files.get("nosotros/index.html"),
    );

    expect(preview).toContain('data-solara-module="image-text-content"');
    expect(exported).toContain('data-solara-module="image-text-content"');
  });

  it("mantiene el poster y el video audiovisual autocontenidos", () => {
    const project = {
      ...referenceStore,
      videos: [
        {
          kind: "video" as const,
          id: "video-fixture",
          name: "Hero Casa Luma",
          alt: "Mesa Casa Luma en movimiento",
          mimeType: "video/mp4" as const,
          source: "data:video/mp4;base64,AA==",
          posterAssetId: referenceStore.assets[0]?.id,
          width: 1280,
          height: 720,
          durationSeconds: 5,
          hash: "fixture-video",
        },
      ],
      sections: referenceStore.sections.map((section) =>
        section.slot === "hero"
          ? {
              ...section,
              moduleId: "hero-media",
              settings: {
                mode: "video",
                title: "Una casa con materia y calma.",
                body: "Piezas honestas para usar todos los días.",
                actionLabel: "Ver colección",
                actionHref: "/categorias/textiles/",
                posterAssetId: referenceStore.assets[0]?.id,
                videoAssetId: "video-fixture",
                slides: [],
                autoplay: true,
                intervalMs: 6000,
                overlay: "dark",
                alignment: "left",
              },
            }
          : section,
      ),
    } as typeof referenceStore;
    const result = exportProject(project, { mode: "production" });
    const home = String(result.files.get("index.html"));
    expect(home).toContain('data-hero-mode="video"');
    expect(home).toContain('class="solara-hero-media-poster"');
    expect(result.files.has("assets/fixture-video.mp4")).toBe(true);
    expect(String(result.files.get("video-sitemap.xml"))).toContain("fixture-video.mp4");
  });

  it("omite el thumbnail cuando el poster del hero no resuelve", () => {
    const validPoster = referenceStore.assets[0]?.id;
    const heroBase = referenceStore.sections.find((section) => section.slot === "hero");
    if (!validPoster || !heroBase) throw new Error("Fixture incompleto");
    const project = {
      ...referenceStore,
      videos: [
        {
          kind: "video" as const,
          id: "video-fixture",
          name: "Hero Casa Luma",
          alt: "Mesa Casa Luma en movimiento",
          mimeType: "video/mp4" as const,
          source: "data:video/mp4;base64,AA==",
          width: 1280,
          height: 720,
          durationSeconds: 5,
          hash: "fixture-video",
        },
      ],
      sections: [
        ...referenceStore.sections.filter((section) => section.slot !== "hero"),
        {
          ...heroBase,
          id: "section-hero-sin-poster",
          settings: {
            ...heroBase.settings,
            mode: "video",
            posterAssetId: "",
            videoAssetId: "video-fixture",
            slides: [],
          },
        },
        {
          ...heroBase,
          id: "section-hero-poster-valido",
          settings: {
            ...heroBase.settings,
            mode: "video",
            posterAssetId: validPoster,
            videoAssetId: "video-fixture",
            slides: [],
          },
        },
      ],
    } as typeof referenceStore;
    const result = exportProject(project, { mode: "production" });
    const home = String(result.files.get("index.html"));
    const videoSitemap = String(result.files.get("video-sitemap.xml"));

    expect(home).not.toContain('"thumbnailUrl":"https://casa-luma.example/"');
    expect(home).not.toContain('"thumbnailUrl":"https://casa-luma.example"');
    expect(videoSitemap).not.toContain("<video:thumbnail_loc>");
    expect(videoSitemap).toContain("fixture-video.mp4");
  });

  it("publica headers de seguridad compatibles con variables de movimiento", () => {
    const headers = String(
      exportProject(referenceStore, { mode: "production" }).files.get("_headers"),
    );
    expect(headers).toContain("Content-Security-Policy");
    expect(headers).toContain("style-src-attr 'unsafe-inline'");
    expect(headers).toContain("script-src 'self'");
    expect(headers).toContain("connect-src 'self'");
  });

  it("permite media remota en la CSP del sitio público", () => {
    const headers = String(
      exportProject(referenceStore, { mode: "production" }).files.get("_headers"),
    );
    expect(headers).toContain("media-src 'self' https: http:");
    expect(headers).toContain("img-src 'self' data: https: http:");
  });

  it("recupera un archivo de proyecto sin cambios", () => {
    expect(readProjectArchive(createProjectArchive(referenceStore))).toEqual(referenceStore);
  });

  it("produce archivos reproducibles para el mismo snapshot", () => {
    const first = exportProject(referenceStore, { mode: "production" }).files;
    const second = exportProject(referenceStore, { mode: "production" }).files;
    expect(second).toEqual(first);
  });

  it("deduplica y publica variantes responsive procesadas", () => {
    const firstAsset = referenceStore.assets[0];
    if (!firstAsset) throw new Error("Fixture incompleto");
    const project = {
      ...referenceStore,
      assets: [
        {
          ...firstAsset,
          mimeType: "image/webp",
          source: "data:image/webp;base64,AA==",
          fallbackSource: "data:image/jpeg;base64,AQ==",
          responsiveSources: [
            { width: 480, source: "data:image/webp;base64,Ag==" },
            { width: 960, source: "data:image/webp;base64,Aw==" },
          ],
        },
        ...referenceStore.assets.slice(1),
      ],
    };
    const result = exportProject(project, { mode: "draft" });
    const html = String(result.files.get("index.html"));

    expect(result.files.has("assets/fixture-manta.webp")).toBe(true);
    expect(result.files.has("assets/fixture-manta-fallback.jpg")).toBe(true);
    expect(result.files.has("assets/fixture-manta-480.webp")).toBe(true);
    expect(result.files.has("assets/fixture-manta-960.webp")).toBe(true);
    expect(html).toContain("/assets/fixture-manta-480.webp 480w");
  });

  it("usa la extensión del MIME real para fallback y variantes responsive", () => {
    const firstAsset = referenceStore.assets[0];
    if (!firstAsset) throw new Error("Fixture incompleto");
    const project = {
      ...referenceStore,
      assets: [
        {
          ...firstAsset,
          mimeType: "image/webp",
          source: "data:image/webp;base64,AA==",
          fallbackSource: "data:image/png;base64,AQ==",
          responsiveSources: [{ width: 480, source: "data:image/jpeg;base64,Ag==" }],
        },
        ...referenceStore.assets.slice(1),
      ],
    };

    const result = exportProject(project, { mode: "draft" });
    const html = String(result.files.get("index.html"));

    expect(result.files.has("assets/fixture-manta-fallback.png")).toBe(true);
    expect(result.files.has("assets/fixture-manta-480.jpg")).toBe(true);
    expect(result.files.has("assets/fixture-manta-fallback.jpg")).toBe(false);
    expect(html).toContain("/assets/fixture-manta-fallback.png");
    expect(html).toContain("/assets/fixture-manta-480.jpg 480w");
  });

  it("deduplica rutas y binarios de assets con el mismo hash", () => {
    const firstAsset = referenceStore.assets[0];
    if (!firstAsset) throw new Error("Fixture incompleto");
    const duplicate = {
      ...firstAsset,
      id: "asset-duplicate",
      source: "data:image/webp;base64,AA==",
      mimeType: "image/webp",
      hash: "shared-content-hash",
    };
    const project = {
      ...referenceStore,
      assets: [{ ...duplicate, id: firstAsset.id }, duplicate, ...referenceStore.assets.slice(1)],
    };

    const result = exportProject(project as typeof referenceStore, { mode: "draft" });

    expect(
      [...result.files.keys()].filter((path) => path === "assets/shared-content-hash.webp"),
    ).toHaveLength(1);
  });

  it("advierte una baseUrl con subcarpeta para assets root-relativos", () => {
    const project = {
      ...referenceStore,
      baseUrl: "https://casa-luma.example/tienda/",
    };

    expect(auditProject(project)).toContainEqual(
      expect.objectContaining({
        code: "domain.baseurl-path",
        severity: "warning",
        path: "baseUrl",
      }),
    );
  });

  it("respeta la subcarpeta de baseUrl en canonical, recursos y sitemap", () => {
    const project = {
      ...referenceStore,
      baseUrl: "https://casa-luma.example/tienda/",
    };

    const result = exportProject(project, { mode: "production" });
    const home = String(result.files.get("index.html"));
    expect(home).toContain('<link rel="canonical" href="https://casa-luma.example/tienda/">');
    expect(home).toContain('<meta property="og:url" content="https://casa-luma.example/tienda/">');
    expect(home).toContain('href="/tienda/assets/storefront.css"');
    expect(home).toContain('src="/tienda/assets/storefront.js"');
    expect(home).toContain('href="/tienda/ai-context.json"');
    expect(home).toContain('href="/tienda/llms.txt"');

    const sitemap = String(result.files.get("sitemap.xml"));
    expect(sitemap).toContain("https://casa-luma.example/tienda/productos/manta-bruma/");

    const product = String(result.files.get("productos/manta-bruma/index.html"));
    expect(product).toContain('"url":"https://casa-luma.example/tienda/productos/manta-bruma/"');

    const preview = renderPreviewHtml(project, "production", "/");
    expect(preview).toContain("data:text/css;base64,");
    expect(preview).not.toContain('href="/tienda/assets/storefront.css"');
  });

  it("publica catalog-index.json cuando el drawer de carrito está activo sin templates", () => {
    const project = {
      ...referenceStore,
      commerceTemplates: {
        ...referenceStore.commerceTemplates,
        cart: { enabled: false },
        checkout: { enabled: false },
      },
    };

    const result = exportProject(project, { mode: "production" });

    expect(result.files.has("catalog-index.json")).toBe(true);
  });

  it("incluye rutas paginadas en el image-sitemap", () => {
    const legacy = exportProject(catalogScaleStore, { mode: "production" });
    const legacyImageSitemap = String(legacy.files.get("image-sitemap.xml"));
    const modern = exportProject(catalogModernStore, { mode: "production" });
    const modernImageSitemap = String(modern.files.get("image-sitemap.xml"));

    expect(legacyImageSitemap).toContain(
      "<loc>https://casa-luma-scale.example/categorias/casa/pagina/2/</loc>",
    );
    expect(legacyImageSitemap).not.toContain(
      "<loc>https://casa-luma-scale.example/categorias/casa/pagina/3/</loc>",
    );
    expect(modernImageSitemap).toContain(
      "<loc>https://modo-sur.example/colecciones/esenciales/pagina/2/</loc>",
    );
  });

  it("mantiene la política CSP exacta en _headers", () => {
    const headers = String(
      exportProject(referenceStore, { mode: "production" }).files.get("_headers"),
    );

    expect(headers).toBe(`/*
  Cache-Control: public, max-age=0, must-revalidate
  Content-Security-Policy: default-src 'self'; img-src 'self' data: https: http:; script-src 'self'; style-src 'self'; style-src-attr 'unsafe-inline'; connect-src 'self'; media-src 'self' https: http:; object-src 'none'; base-uri 'self'; frame-ancestors 'none'
  Referrer-Policy: strict-origin-when-cross-origin
  X-Content-Type-Options: nosniff
  X-Frame-Options: DENY
  Permissions-Policy: camera=(), microphone=(), geolocation=()

/assets/*
  Cache-Control: public, max-age=31536000, immutable

/sitemap.xml
  Cache-Control: public, max-age=3600, must-revalidate

/image-sitemap.xml
  Cache-Control: public, max-age=3600, must-revalidate

/video-sitemap.xml
  Cache-Control: public, max-age=3600, must-revalidate

/google-merchant.xml
  Cache-Control: public, max-age=900, must-revalidate

/ai-context.json
  Cache-Control: public, max-age=900, must-revalidate

/llms.txt
  Cache-Control: public, max-age=900, must-revalidate

/search-index.json
  Cache-Control: public, max-age=900, must-revalidate

/catalog-index.json
  Cache-Control: public, max-age=900, must-revalidate
`);
  });

  it("advierte el riesgo Merchant del checkout por WhatsApp", () => {
    expect(auditProject(referenceStore)).toContainEqual(
      expect.objectContaining({ code: "merchant.whatsapp-checkout", severity: "warning" }),
    );
  });

  it("permite exportar sin contexto publico para agentes", () => {
    const result = exportProject(referenceStore, {
      mode: "production",
      publicAiContext: false,
    });
    expect(result.files.has("ai-context.json")).toBe(false);
    expect(result.files.has("llms.txt")).toBe(false);
    expect(result.optimization.aiReadiness.publicContextAvailable).toBe(false);
    expect(String(result.files.get("index.html"))).not.toContain('href="/ai-context.json"');
  });

  it("las páginas editables mandan sobre el seo global en su ruta", () => {
    const project = {
      ...referenceStore,
      seo: {
        ...referenceStore.seo,
        title: "Título global de la tienda",
        description: "Descripción global de la tienda.",
      },
      pages: referenceStore.pages.map((page) => {
        if (page.kind === "home")
          return {
            ...page,
            seoTitle: "Título exclusivo del Home",
            seoDescription: "Descripción exclusiva del Home.",
          };
        if (page.kind === "about")
          return {
            ...page,
            seoTitle: "Título exclusivo de Nosotros",
            seoDescription: "Descripción exclusiva de Nosotros.",
          };
        if (page.kind === "contact")
          return {
            ...page,
            seoTitle: "Título exclusivo de Contacto",
            seoDescription: "Descripción exclusiva de Contacto.",
          };
        return page;
      }),
    };
    const result = exportProject(project as typeof referenceStore, { mode: "production" });

    expect(String(result.files.get("index.html"))).toContain(
      "<title>Título exclusivo del Home</title>",
    );
    expect(String(result.files.get("index.html"))).toContain(
      '<meta name="description" content="Descripción exclusiva del Home.">',
    );
    expect(String(result.files.get("nosotros/index.html"))).toContain(
      "<title>Título exclusivo de Nosotros</title>",
    );
    expect(String(result.files.get("contacto/index.html"))).toContain(
      "<title>Título exclusivo de Contacto</title>",
    );
    expect(String(result.files.get("index.html"))).not.toContain("Título global de la tienda");
  });

  it("el JSON-LD del negocio prefiere whatsapp.phone sobre identity.phone", () => {
    const project = {
      ...referenceStore,
      whatsapp: { ...referenceStore.whatsapp, phone: "5492212345678" },
    };
    const homeHtml = String(
      exportProject(project as typeof referenceStore, { mode: "draft" }).files.get("index.html"),
    );
    const store = onlineStoreJsonLd(homeHtml);
    expect(store.telephone).toBe("5492212345678");
  });

  it("el JSON-LD del negocio omite telephone y address cuando están vacíos", () => {
    const project = {
      ...referenceStore,
      identity: { ...referenceStore.identity, phone: "", address: "" },
    };
    const homeHtml = String(
      exportProject(project as typeof referenceStore, { mode: "draft" }).files.get("index.html"),
    );
    const store = onlineStoreJsonLd(homeHtml);
    expect(store.telephone).toBe(referenceStore.whatsapp.phone);
    expect(store).not.toHaveProperty("address");
    expect(JSON.stringify(store)).not.toContain("address");
  });

  it("no publica el teléfono de plantilla (sentinel) en ningún archivo del sitio", () => {
    const project = {
      ...referenceStore,
      whatsapp: { ...referenceStore.whatsapp, phone: CATALOG_MODERN_PLACEHOLDER_PHONE },
    };
    for (const mode of ["draft", "production"] as const) {
      const result = exportProject(project as typeof referenceStore, { mode });
      for (const [path, content] of result.files) {
        expect(String(content), `archivo ${path} (${mode})`).not.toContain(
          CATALOG_MODERN_PLACEHOLDER_PHONE,
        );
      }
      const homeHtml = String(result.files.get("index.html"));
      expect(homeHtml, `home ${mode}`).not.toContain("data-whatsapp=");
      expect(homeHtml, `home ${mode}`).not.toContain("data-whatsapp-greeting=");
      expect(homeHtml, `home ${mode}`).not.toContain("data-whatsapp-include-sku=");
      const store = onlineStoreJsonLd(homeHtml);
      expect(store.telephone).toBe(referenceStore.identity.phone);
      const contactHtml = String(result.files.get("contacto/index.html"));
      expect(contactHtml, `contacto ${mode}`).not.toContain("wa.me");
      expect(contactHtml, `contacto ${mode}`).not.toContain("Escribir por WhatsApp");
      const checkoutHtml = String(result.files.get("compra/index.html"));
      expect(checkoutHtml, `compra ${mode}`).not.toContain("data-whatsapp-link");
      const cartHtml = String(result.files.get("carrito/index.html"));
      expect(cartHtml, `carrito ${mode}`).not.toContain("wa.me");
      const productHtml = String(result.files.get("productos/manta-bruma/index.html"));
      expect(productHtml, `producto ${mode}`).not.toContain("wa.me");
      expect(productHtml, `producto ${mode}`).not.toContain("catalog-add-fallback");
    }
  });

  it("con teléfono válido el sitio expone data-whatsapp y los enlaces de contacto", () => {
    const result = exportProject(referenceStore, { mode: "draft" });
    const homeHtml = String(result.files.get("index.html"));
    expect(homeHtml).toContain(`data-whatsapp="${referenceStore.whatsapp.phone}"`);
    expect(homeHtml).toContain(`data-whatsapp-greeting="${referenceStore.whatsapp.greeting}"`);
    const contactHtml = String(result.files.get("contacto/index.html"));
    expect(contactHtml).toContain(`wa.me/${referenceStore.whatsapp.phone}`);
    expect(contactHtml).toContain("Escribir por WhatsApp");
  });

  it("la meta description de Home prefiere la página y el seo global antes que la identidad", () => {
    const project = {
      ...referenceStore,
      pages: referenceStore.pages.map((page) =>
        page.kind === "home" ? { ...page, seoDescription: "Descripción de la página Home." } : page,
      ),
      seo: { ...referenceStore.seo, description: "Descripción del seo global." },
      identity: { ...referenceStore.identity, description: "Descripción de la identidad." },
    };
    const homeHtml = String(
      exportProject(project as typeof referenceStore, { mode: "draft" }).files.get("index.html"),
    );
    expect(homeMetaDescription(homeHtml)).toBe("Descripción de la página Home.");
    expect(homeHtml).toContain(
      '<meta property="og:description" content="Descripción de la página Home.">',
    );
  });

  it("la meta de Home respeta la página y las rutas sin página editable caen a la identidad", () => {
    // Contrato del schema: la Home siempre existe y define su seoDescription, así
    // que la cadena seoDescription ?? seo.description ?? identity.description
    // protege a proyectos sin página editable (el tramo identity.description es
    // alcanzable en las rutas about/contact que no son obligatorias).
    const project = {
      ...referenceStore,
      pages: referenceStore.pages.filter((page) => page.kind === "home"),
    };
    const result = exportProject(project as typeof referenceStore, { mode: "draft" });
    const homeHtml = String(result.files.get("index.html"));
    expect(homeMetaDescription(homeHtml)).toBe(referenceStore.pages[0]?.seoDescription);
    const aboutHtml = String(result.files.get("nosotros/index.html"));
    expect(aboutHtml).toContain(
      `<meta name="description" content="${referenceStore.identity.description}">`,
    );
    expect(aboutHtml).not.toContain(
      `<meta name="description" content="${referenceStore.pages[1]?.seoDescription}">`,
    );
  });

  it("el título de Home prefiere la página y el seo global antes que la identidad", () => {
    const project = {
      ...referenceStore,
      pages: referenceStore.pages.map((page) =>
        page.kind === "home" ? { ...page, seoTitle: "Título de la página Home" } : page,
      ),
      seo: { ...referenceStore.seo, title: "Título del seo global" },
      name: "Nombre del proyecto",
    };
    const homeHtml = String(
      exportProject(project as typeof referenceStore, { mode: "draft" }).files.get("index.html"),
    );
    expect(/<title>([\s\S]*?)<\/title>/.exec(homeHtml)?.[1]).toBe("Título de la página Home");
  });

  it("usa el seo global como fallback en rutas sin página editable", () => {
    const project = {
      ...referenceStore,
      seo: {
        ...referenceStore.seo,
        title: "Título global de la tienda",
        description: "Descripción global de la tienda.",
      },
      categories: referenceStore.categories.map((category, index) =>
        index === 0 ? { ...category, description: "" } : category,
      ),
    };
    const categoryHtml = String(
      exportProject(project as typeof referenceStore, { mode: "production" }).files.get(
        "categorias/textiles/index.html",
      ),
    );
    expect(categoryHtml).toContain(
      '<meta name="description" content="Descripción global de la tienda.">',
    );
  });

  it("og:image sale de project.seo.socialImageId", () => {
    const project = {
      ...referenceStore,
      seo: { ...referenceStore.seo, socialImageId: "asset-jarra" as const },
    };
    const homeHtml = String(
      exportProject(project as typeof referenceStore, { mode: "draft" }).files.get("index.html"),
    );
    expect(homeHtml).toContain(
      '<meta property="og:image" content="https://casa-luma.example/fixtures/jarra-delta.png">',
    );
  });

  it("emite la verificación de Search Console y de Merchant Center", () => {
    const project = {
      ...referenceStore,
      seo: {
        ...referenceStore.seo,
        searchConsoleVerification: "search-console-code",
        merchantVerification: "merchant-code",
      },
    };
    const homeHtml = String(
      exportProject(project as typeof referenceStore, { mode: "draft" }).files.get("index.html"),
    );
    expect(homeHtml).toContain(
      '<meta name="google-site-verification" content="search-console-code">',
    );
    expect(homeHtml).toContain('<meta name="google-site-verification" content="merchant-code">');
  });

  it("detecta rutas reservadas y preorder sin fecha", () => {
    const project = {
      ...referenceStore,
      products: referenceStore.products.map((product, index) =>
        index === 0
          ? {
              ...product,
              slug: "envios" as typeof product.slug,
              variants: product.variants.map((variant) => ({
                ...variant,
                stockStatus: "preorder" as const,
                availabilityDate: undefined,
              })),
            }
          : product,
      ),
    };
    const issues = auditProject(project as typeof referenceStore);

    expect(issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "slug.reserved", severity: "critical" }),
        expect.objectContaining({ code: "variant.availability-date", severity: "critical" }),
      ]),
    );
  });
});

describe("renderPreviewHtml sin preload absoluto", () => {
  it("no emite preload de imagen cuando el modo es draft", () => {
    const html = renderPreviewHtml(catalogModernStore, "draft", "/", {
      assetTransport: "parent",
    });
    expect(html).not.toMatch(/rel="preload" as="image"/);
    expect(html).not.toMatch(/https?:\/\/[^"']+\/assets\//);
  });

  it("conserva el preload absoluto en producción", () => {
    const html = renderPreviewHtml(catalogModernStore, "production", "/", {});
    expect(html).toMatch(/rel="preload" as="image"/);
  });
});

describe("tema: carga real de fuentes y vars sin duplicados", () => {
  const decodePreviewCss = (preview: string): string => {
    const match = /data:text\/css;base64,([^"]+)/.exec(preview);
    if (!match) throw new Error("CSS del preview no encontrado");
    const encoded = match[1];
    if (!encoded) throw new Error("CSS del preview no encontrado");
    return Buffer.from(encoded, "base64").toString("utf8");
  };

  it("emite @font-face self-host cuando la familia es Google Fonts y agrega el woff2", () => {
    const result = exportProject(catalogModernStore, { mode: "draft" });
    const css = String(result.files.get("assets/storefront.css"));
    const font = result.files.get("assets/fonts/archivo.woff2");

    expect(css).toContain('@font-face{font-family:"Archivo"');
    expect(css).toContain('url("/assets/fonts/archivo.woff2") format("woff2")');
    expect(css).toContain("font-weight:400 900");
    expect(css).not.toContain('local("Arial")');
    expect(css.split("@font-face").length - 1).toBe(1);
    expect(font).toBeInstanceOf(Uint8Array);
    expect((font as Uint8Array).length).toBeGreaterThan(30_000);
    expect(result.files.has("assets/fonts/inter.woff2")).toBe(false);
  });

  it("no emite fuentes para familias del sistema ni archivos woff2", () => {
    const result = exportProject(referenceStore, { mode: "draft" });
    const css = String(result.files.get("assets/storefront.css"));

    expect(css).not.toContain("@font-face");
    expect([...result.files.keys()].some((path) => path.startsWith("assets/fonts/"))).toBe(false);
  });

  it("el preview transporta la fuente inline en base64 sin URLs relativas", () => {
    const preview = renderPreviewHtml(catalogModernStore, "draft", "/");
    const css = decodePreviewCss(preview);

    expect(css).toContain('@font-face{font-family:"Archivo"');
    expect(css).toContain("data:font/woff2;base64,");
    expect(css).not.toContain('url("/assets/fonts/');
    expect(css).not.toContain("local(");
  });

  it("emite una sola var por campo y el body usa el token canónico", () => {
    const css = String(
      exportProject(catalogModernStore, { mode: "draft" }).files.get("assets/storefront.css"),
    );

    expect(css).toContain("--solara-font-display:");
    expect(css).toContain("--solara-font-body:");
    expect(css).toContain("--solara-space-scale:");
    expect(css).not.toMatch(/--solara-display:/);
    expect(css).not.toMatch(/--solara-body:/);
    expect(css).not.toMatch(/--solara-space:/);
    expect(css).toContain("font-family:var(--solara-font-body)");
  });
});
