import { referenceStore } from "@solara/project-schema/fixture";
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

  it("incluye estilos de las secciones editoriales en preview y ZIP", () => {
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

  it("publica headers de seguridad compatibles con variables de movimiento", () => {
    const headers = String(
      exportProject(referenceStore, { mode: "production" }).files.get("_headers"),
    );
    expect(headers).toContain("Content-Security-Policy");
    expect(headers).toContain("style-src-attr 'unsafe-inline'");
    expect(headers).toContain("script-src 'self'");
    expect(headers).toContain("connect-src 'self'");
  });

  it("recupera un archivo de proyecto sin cambios", () => {
    expect(readProjectArchive(createProjectArchive(referenceStore))).toEqual(referenceStore);
  });

  it("produce un ZIP reproducible para el mismo snapshot", () => {
    const first = exportProject(referenceStore, { mode: "production" }).zip;
    const second = exportProject(referenceStore, { mode: "production" }).zip;
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
