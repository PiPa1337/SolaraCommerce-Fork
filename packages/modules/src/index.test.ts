import {
  CATALOG_MODERN_PLACEHOLDER_PHONE,
  type ImageAsset,
  type StoreSection,
  type VideoAsset,
} from "@solara/project-schema";
import { catalogModernStore } from "@solara/project-schema/catalog-modern-fixture";
import { catalogModernCleanStore } from "@solara/project-schema/catalog-modern-template";
import { catalogModernV2Store } from "@solara/project-schema/catalog-modern-v2-fixture";
import { referenceStore } from "@solara/project-schema/fixture";
import { catalogScaleStore } from "@solara/project-schema/scale-fixture";
import { describe, expect, expectTypeOf, it } from "vitest";
import {
  aboutV2Modules,
  catalogModernModules,
  contactV2Modules,
  createModuleSection,
  getModuleDefinition,
  getTypedModule,
  MODULE_STYLE_BLOCKS,
  moduleRegistry,
  officialModules,
  renderSections,
  replaceModuleInSection,
  STORE_BASE_STYLES,
  STORE_THEME_TOKEN_STYLES,
} from "./index";

describe("official module system", () => {
  it("registers every official module under a stable id", () => {
    expect(Object.keys(moduleRegistry)).toEqual(
      expect.arrayContaining([
        "announcement-bar",
        "editorial-header",
        "hero-media",
        "split-hero",
        "editorial-hero",
        "collection-grid",
        "editorial-product-grid",
        "compact-product-grid",
        "product-detail",
        "image-text-content",
        "trust-strip",
        "cart-drawer",
        "editorial-footer",
      ]),
    );
    expect(getModuleDefinition("split-hero")?.manifest.slots).toContain("hero");
  });

  it("crea secciones válidas y rechaza módulos incompatibles con el slot", () => {
    const section = createModuleSection({
      id: "section-created" as StoreSection["id"],
      slot: "hero",
      moduleId: "hero-media",
    });

    expect(section.settings).toEqual(getModuleDefinition("hero-media")?.settingsSchema.parse({}));
    expect(section.enabled).toBe(true);
    expect(() =>
      createModuleSection({
        id: "section-invalid" as StoreSection["id"],
        slot: "footer",
        moduleId: "hero-media",
      }),
    ).toThrow(/no es compatible/i);
  });

  it("describes every schema setting exactly once and provides valid defaults", () => {
    for (const definition of officialModules) {
      const defaults = definition.settingsSchema.parse({});
      const schemaKeys = Object.keys(defaults).sort();
      const fieldKeys = definition.settingsFields.map((field) => field.key);

      expect(fieldKeys, definition.manifest.id).toHaveLength(new Set(fieldKeys).size);
      expect([...fieldKeys].sort(), definition.manifest.id).toEqual(schemaKeys);
      expect([...definition.manifest.compatibleSettings].sort(), definition.manifest.id).toEqual(
        schemaKeys,
      );
      expect(definition.settingsSchema.safeParse(defaults).success, definition.manifest.id).toBe(
        true,
      );
    }
  });

  it("los ítems de repeater requieren id propio y aceptan los defaults del editor", () => {
    for (const definition of [...officialModules, ...catalogModernModules]) {
      for (const field of definition.settingsFields) {
        if (field.type !== "repeater") continue;
        const defaults = definition.settingsSchema.parse({});
        const editorItem = {
          id: `item-${crypto.randomUUID()}`,
          ...Object.fromEntries(
            field.fields.map((itemField) => [
              itemField.key,
              itemField.type === "boolean"
                ? false
                : itemField.type === "number"
                  ? (itemField.min ?? 0)
                  : itemField.type === "select"
                    ? (itemField.options?.[0]?.value ?? "")
                    : itemField.key === "id"
                      ? `item-${crypto.randomUUID()}`
                      : itemField.key === field.itemLabelKey || itemField.key === "title"
                        ? "Nuevo elemento"
                        : itemField.key === "author"
                          ? "Nueva persona"
                          : itemField.key === "body"
                            ? "Texto editable"
                            : itemField.key === "categoryId"
                              ? (catalogModernStore.categories[0]?.id ?? "")
                              : itemField.key === "actionLabel"
                                ? "Ver más"
                                : itemField.key === "actionHref"
                                  ? "/"
                                  : "",
            ]),
          ),
        };
        const withItem = definition.settingsSchema.safeParse({
          ...defaults,
          [field.key]: [editorItem],
        });
        expect(withItem.success, definition.manifest.id).toBe(true);
        const withoutId = definition.settingsSchema.safeParse({
          ...defaults,
          [field.key]: [{ ...editorItem, id: "" }],
        });
        expect(withoutId.success, `${definition.manifest.id} exige id en el ítem`).toBe(false);
      }
    }
  });

  it("isolates every module style selector under its module root", () => {
    for (const [moduleId, styles] of Object.entries(MODULE_STYLE_BLOCKS)) {
      const selectors = styles
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line.endsWith("{") && !line.startsWith("@"))
        .map((line) => line.slice(0, -1).trim());

      expect(selectors.length).toBeGreaterThan(0);
      for (const selectorGroup of selectors) {
        for (const selector of selectorGroup.split(",")) {
          const trimmed = selector.trim();
          const scoped =
            trimmed.startsWith(":root") ||
            trimmed.startsWith("html") ||
            trimmed.startsWith("body") ||
            trimmed.startsWith("*") ||
            trimmed.startsWith(":where") ||
            (moduleId === "catalog-modern-v2"
              ? trimmed.startsWith(".cm.v2")
              : moduleId.startsWith("catalog-modern")
                ? trimmed.startsWith(`[data-solara-store].${moduleId}`)
                : trimmed.startsWith(`[data-solara-module="${moduleId}"]`));
          expect(scoped).toBe(true);
        }
      }
    }
  });

  it("hereda los estados visuales de la paleta activa en Catalog Modern", () => {
    const v2Styles = MODULE_STYLE_BLOCKS["catalog-modern-v2"];

    expect(v2Styles).toContain("--catalog-sale: var(--solara-sale");
    expect(v2Styles).toContain("--catalog-rating: var(--solara-rating");
    expect(v2Styles).toContain("color: var(--catalog-paper)");
    expect(v2Styles).toContain("color-mix(in srgb, var(--catalog-ink)");
    expect(v2Styles).not.toContain("--catalog-sale: #a63d2f;");
    expect(v2Styles).not.toContain("rgb(11 11 12");
    expect(v2Styles).toContain("--catalog-v2-wide: var(--solara-container");
    expect(v2Styles).toContain("--catalog-v2-motion-component: var(--solara-motion-normal");
    expect(v2Styles).toContain("calc(var(--solara-card-gap");
    expect(v2Styles).toContain("var(--solara-border-width");
    expect(v2Styles).toMatch(/\.cm\.v2 \.catalog-eyebrow\s*\{[^}]*color: var\(--solara-accent\)/);
    expect(v2Styles).toContain(".cm.v2 .contact-channel-row:hover > span:last-child");
    expect(v2Styles).toContain("color: var(--solara-accent);");

    expect(STORE_BASE_STYLES).toContain("var(--solara-dark-background");
    expect(STORE_BASE_STYLES).not.toContain("--solara-background: #1d1e19");
    expect(STORE_BASE_STYLES).toContain(".solara-consumer-rights {");
    expect(STORE_BASE_STYLES).toContain("grid-column: 1 / -1;");
    expect(STORE_BASE_STYLES).not.toMatch(/\.solara-consumer-rights\s*\{[^}]*position:\s*fixed/);
    expect(STORE_THEME_TOKEN_STYLES).toContain("var(--solara-line-height-tight");
  });

  it("preserves compatible hero settings when replacing its visual treatment", () => {
    const hero = referenceStore.sections.find((section) => section.moduleId === "hero-media");
    expect(hero).toBeDefined();
    const source = {
      ...hero,
      settings: { ...hero?.settings, editorOnlyValue: "remove-me" },
    } as StoreSection;

    const replacement = replaceModuleInSection(source, "editorial-hero");

    expect(replacement.moduleId).toBe("editorial-hero");
    expect(replacement.settings.title).toBe(source.settings.title);
    expect(replacement.settings.imageId).toBe(source.settings.posterAssetId);
    expect(replacement.settings).not.toHaveProperty("editorOnlyValue");
  });

  it("preserves compatible grid settings in both replacement directions", () => {
    const catalog = referenceStore.sections.find((section) => section.slot === "catalog");
    expect(catalog).toBeDefined();
    const source = {
      ...catalog,
      moduleId: "editorial-product-grid",
      settings: { title: "Selección", limit: 7, editorOnlyValue: "remove-me" },
    } as StoreSection;

    const compact = replaceModuleInSection(source, "compact-product-grid");
    const editorial = replaceModuleInSection(compact, "editorial-product-grid");

    expect(compact.settings).toEqual({ title: "Selección", limit: 7 });
    expect(editorial.settings).toEqual({ title: "Selección", limit: 7 });
  });

  it("drops incompatible settings and applies target defaults", () => {
    const content = referenceStore.sections[0];
    expect(content).toBeDefined();
    const source = {
      ...content,
      slot: "content",
      moduleId: "unknown-content",
      settings: { title: "Historia", body: "<p>Texto</p>", editorOnlyValue: true },
    } as StoreSection;

    const replacement = replaceModuleInSection(source, "image-text-content");

    expect(replacement.settings).toEqual({
      title: "Historia",
      body: "<p>Texto</p>",
      imageId: "",
      imageSide: "left",
      actionLabel: "",
      actionHref: "",
    });
  });

  it("renders semantic content and escapes project data", () => {
    const project = {
      ...referenceStore,
      identity: { ...referenceStore.identity, brandName: "<Casa segura>" },
    };
    const html = renderSections(project);

    expect(html).toContain("&lt;Casa segura&gt;");
    expect(html).not.toContain("<Casa segura>");
    expect(html).toContain('data-solara-module="hero-media"');
    expect(html).toContain(referenceStore.products[0]?.title);
  });

  it("mantiene el hero dividido y editorial con media y clases propias", () => {
    const source = referenceStore.sections.find((section) => section.moduleId === "hero-media");
    if (!source) throw new Error("Fixture sin hero");
    const split = replaceModuleInSection(
      { ...source, settings: { ...source.settings, imagePosition: "left" } },
      "split-hero",
    );
    const editorial = replaceModuleInSection(
      { ...source, settings: { ...source.settings, imagePosition: "right" } },
      "editorial-hero",
    );
    const splitHtml = renderSections(referenceStore, [split]);
    const editorialHtml = renderSections(referenceStore, [editorial]);

    expect(splitHtml).toContain('data-solara-module="split-hero"');
    expect(splitHtml).toContain("solara-split-hero--left");
    expect(splitHtml).toContain("solara-hero-copy");
    expect(splitHtml).toContain("solara-hero-media");
    expect(editorialHtml).toContain('data-solara-module="editorial-hero"');
    expect(editorialHtml).toContain("solara-editorial-hero--right");
    expect(editorialHtml).toContain("solara-editorial-head");
  });

  it("muestra doce productos en la grilla principal de la home de escala", () => {
    const html = renderSections(catalogScaleStore, catalogScaleStore.sections, {
      pageType: "home",
    });
    const productCards = html.match(/data-product-card/g) ?? [];
    expect(productCards).toHaveLength(12);
    expect(html.indexOf('data-solara-module="compact-product-grid"')).toBeLessThan(
      html.indexOf('data-solara-module="collection-grid"'),
    );
  });

  it("renderiza cards Catalog Modern con categoría y sin reseñas ni disponibilidad", () => {
    const html = renderSections(catalogModernStore, catalogModernStore.sections, {
      pageType: "home",
    });
    const firstGrid = html.slice(
      html.indexOf('data-solara-module="catalog-product-grid"'),
      html.indexOf(
        'data-solara-module="catalog-product-grid"',
        html.indexOf('data-solara-module="catalog-product-grid"') + 1,
      ),
    );

    expect(firstGrid).toContain('class="catalog-product-category"');
    expect(firstGrid).not.toContain("catalog-product-rating");
    expect(firstGrid).not.toContain("catalog-product-availability");
  });

  it("renderiza el hero en modo video con loop mudo y sin imagen de portada", () => {
    const project = structuredClone(catalogModernStore);
    const section = project.sections.find(
      (candidate) => candidate.moduleId === "catalog-hero" && candidate.enabled !== false,
    );
    if (!section) throw new Error("Fixture sin hero");
    const video: VideoAsset = {
      kind: "video",
      id: "video-render-test" as VideoAsset["id"],
      name: "Look de temporada",
      alt: "Video de la campaña",
      mimeType: "video/mp4",
      source: "data:video/mp4;base64,AAAA",
      width: 1080,
      height: 1920,
      durationSeconds: 8,
      hash: "video-render-hash",
    };
    project.videos = [video];
    section.settings = {
      ...section.settings,
      mode: "video",
      videoAssetId: video.id,
      posterAssetId: "",
    };
    const html = renderSections(project, [section], { pageType: "home" });
    const hero = html.slice(html.indexOf('data-solara-module="catalog-hero"'));
    const videoTag = hero.slice(hero.indexOf("<video"), hero.indexOf("</video>") + 8);
    expect(videoTag).toContain("<video");
    expect(videoTag).toContain("muted");
    expect(videoTag).toContain("loop");
    expect(videoTag).toContain("playsinline");
    expect(videoTag).toMatch(/\sautoplay\b/);
    expect(videoTag).toContain('src="data:video/mp4;base64,AAAA"');
    expect(hero).not.toContain('class="catalog-hero-image"');
  });

  it("V2 conserva sólo la media frontal y omite el fondo ancho del hero", () => {
    const project = structuredClone(catalogModernV2Store);
    const section = project.sections.find((candidate) => candidate.moduleId === "catalog-hero");
    if (!section) throw new Error("Fixture V2 sin hero");
    section.settings = { ...section.settings, backgroundImageId: "asset-hero" };
    const hero = renderSections(project, [section], { pageType: "home" });

    expect(hero).toContain('class="catalog-hero-media"');
    expect(hero).not.toContain('class="catalog-hero-background"');
  });

  it("en modo video autoplay es obligatorio aunque el setting diga false", () => {
    const project = structuredClone(catalogModernStore);
    const section = project.sections.find(
      (candidate) => candidate.moduleId === "catalog-hero" && candidate.enabled !== false,
    );
    if (!section) throw new Error("Fixture sin hero");
    const video: VideoAsset = {
      kind: "video",
      id: "video-autoplay-test" as VideoAsset["id"],
      name: "look",
      alt: "",
      mimeType: "video/mp4",
      source: "data:video/mp4;base64,AAAA",
      width: 1080,
      height: 1920,
      durationSeconds: 8,
      hash: "video-autoplay-hash",
    };
    project.videos = [video];
    section.settings = {
      ...section.settings,
      mode: "video",
      videoAssetId: video.id,
      autoplay: false,
    };
    const html = renderSections(project, [section], { pageType: "home" });
    const hero = html.slice(html.indexOf('data-solara-module="catalog-hero"'));
    const videoTag = hero.slice(hero.indexOf("<video"), hero.indexOf("</video>") + 8);
    expect(videoTag).toMatch(/\sautoplay\b/);
  });

  it("usa el poster automático del video como preload", () => {
    const project = structuredClone(catalogModernStore);
    const section = project.sections.find(
      (candidate) => candidate.moduleId === "catalog-hero" && candidate.enabled !== false,
    );
    if (!section) throw new Error("Fixture sin hero");
    const poster: ImageAsset = {
      kind: "image",
      id: "asset-poster-test" as ImageAsset["id"],
      name: "look (preload)",
      alt: "Preload de look",
      mimeType: "image/webp",
      source: "data:image/webp;base64,UE9TVEVS",
      width: 360,
      height: 640,
      hash: "poster-hash",
    };
    const video: VideoAsset = {
      kind: "video",
      id: "video-poster-test" as VideoAsset["id"],
      name: "look",
      alt: "",
      mimeType: "video/mp4",
      source: "data:video/mp4;base64,AAAA",
      width: 1080,
      height: 1920,
      durationSeconds: 8,
      hash: "video-hash",
      posterAssetId: poster.id,
    };
    project.assets = [...project.assets, poster];
    project.videos = [video];
    section.settings = {
      ...section.settings,
      mode: "video",
      videoAssetId: video.id,
      posterAssetId: "",
    };
    const html = renderSections(project, [section], { pageType: "home" });
    expect(html).toContain('poster="data:image/webp;base64,UE9TVEVS"');
  });

  it("deriva el bento sólo desde categorías madre y alterna proporciones", () => {
    const html = renderSections(catalogModernStore, catalogModernStore.sections, {
      pageType: "home",
    });
    const bento = html.slice(html.indexOf('data-solara-module="catalog-category-bento"'));
    const rootCategories = catalogModernStore.categories.filter((category) => !category.parentId);
    const childCategories = catalogModernStore.categories.filter((category) => category.parentId);
    expect(bento.match(/class="catalog-category-bento-item /g) ?? []).toHaveLength(
      rootCategories.length,
    );
    expect(bento).toContain(rootCategories[0]?.title);
    expect(bento).toContain(rootCategories.at(-1)?.title);
    childCategories.forEach((category) => {
      expect(bento).not.toContain(`href="/categorias/${category.slug}/"`);
    });
    expect(bento).toContain("catalog-category-bento-item--wide");
    expect(bento).toContain("catalog-category-bento-item--tall");
    expect(bento).toContain("catalog-category-bento-item--compact");
    expect(
      [...bento.matchAll(/catalog-category-bento-item--(wide|tall|compact)/g)].map(
        (match) => match[1],
      ),
    ).toEqual(["wide", "tall", "tall", "wide", "compact", "compact", "compact", "compact"]);
    expect(bento).toContain('sizes="(max-width: 767px) calc(100vw - 3.5rem)');
    expect(bento).toContain('sizes="(max-width: 767px) calc((100vw - 4.25rem) / 2)');
    expect(bento).toContain("Ver todo el catálogo");
    expect(bento).toContain('href="/categorias/');
  });

  it("recalcula el mosaico automático al cambiar las categorías madre", () => {
    const section = catalogModernStore.sections.find(
      (candidate) => candidate.moduleId === "catalog-category-bento",
    );
    if (!section) throw new Error("Fixture sin bento de categorías");
    const roots = catalogModernStore.categories.filter((category) => !category.parentId);
    const project = structuredClone(catalogModernStore);

    for (const count of [1, 4, 5]) {
      project.categories = roots.slice(0, count);
      const html = renderSections(project, [section], { pageType: "home" });
      const layouts = [...html.matchAll(/catalog-category-bento-item--(wide|tall|compact)/g)].map(
        (match) => match[1],
      );
      expect(layouts).toEqual(
        count === 1
          ? ["wide"]
          : count === 4
            ? ["wide", "tall", "compact", "compact"]
            : ["wide", "tall", "tall", "compact", "compact"],
      );
    }
  });

  it("usa un placeholder neutral cuando la categoría no tiene imagen posible", () => {
    const section = catalogModernStore.sections.find(
      (candidate) => candidate.moduleId === "catalog-category-bento",
    );
    if (!section) throw new Error("Fixture sin bento de categorías");
    const project = structuredClone(catalogModernStore);
    const root = project.categories.find((category) => !category.parentId);
    if (!root) throw new Error("Fixture sin categorías madre");
    root.imageId = undefined;
    project.categories = [root];
    project.products = project.products.filter((product) => !root.productIds.includes(product.id));
    const html = renderSections(project, [section], { pageType: "home" });
    expect(html).toContain(
      `<span class="catalog-category-bento-fallback" aria-hidden="true">${root.title.charAt(0)}</span>`,
    );
    expect(html).not.toContain("catalog-category-bento-image");
  });

  it("respeta showRating en las cards y expone el resumen de reseñas visible", () => {
    const sections = catalogModernStore.sections.map((section) =>
      section.id === "modo-section-new"
        ? { ...section, settings: { ...section.settings, showRating: true } }
        : section,
    );
    const html = renderSections(catalogModernStore, sections, { pageType: "home" });
    const firstGrid = html.slice(
      html.indexOf('data-solara-module="catalog-product-grid"'),
      html.indexOf(
        'data-solara-module="catalog-product-grid"',
        html.indexOf('data-solara-module="catalog-product-grid"') + 1,
      ),
    );

    expect(firstGrid.match(/class="catalog-product-rating"/g) ?? []).toHaveLength(0);
    expect(firstGrid).not.toContain('aria-label="4.7 de 5"');
    expect(firstGrid).not.toContain("4.7 / 5 · 6 reseñas");
  });

  it("mantiene la marca interna de testimonios fuera del inspector", () => {
    const testimonials = catalogModernModules.find(
      (definition) => definition.manifest.id === "catalog-testimonials",
    );
    if (!testimonials) throw new Error("Falta el módulo catalog-testimonials");
    const repeater = testimonials.settingsFields.find((field) => field.type === "repeater");
    if (!repeater || repeater.type !== "repeater") {
      throw new Error("Falta el repeater de testimonios");
    }

    expect(repeater.fields.map((field) => field.key)).not.toContain("example");
    expect(testimonials.settingsSchema.parse({})).toEqual(expect.objectContaining({ items: [] }));
  });

  it("expone el rail de testimonios y sus controles con una relación accesible", () => {
    const section = catalogModernStore.sections.find(
      (item) => item.moduleId === "catalog-testimonials",
    );
    if (!section) throw new Error("Fixture sin testimonios");
    const html = renderSections(catalogModernStore, [section], { pageType: "home" });
    expect(html).toContain('role="group" aria-label="Controles de testimonios"');
    expect(html).toContain('class="catalog-testimonials-track"');
    expect(html).toContain('tabindex="0"');
    expect(html).toContain('aria-label="Testimonios de clientes"');
    expect(html).toMatch(/aria-controls="catalog-testimonials-track-[^"]+"/);
    expect(html).toContain('aria-label="Testimonios de clientes" role="region"');
  });

  it("omite beneficios de confianza sin datos configurados", () => {
    const project = {
      ...referenceStore,
      identity: { ...referenceStore.identity, email: "", phone: "" },
      policies: {
        ...referenceStore.policies,
        shipping: { ...referenceStore.policies.shipping, summary: "" },
        returns: { ...referenceStore.policies.returns, summary: "" },
      },
    };
    const trust = referenceStore.sections.find((section) => section.moduleId === "trust-strip");
    if (!trust) throw new Error("Fixture sin trust strip");
    const html = renderSections(project, [trust]);

    expect(html).not.toContain("solara-trust-grid");
    expect(html).not.toContain("Confirmamos disponibilidad");
  });
});

describe("registro de módulos tipado", () => {
  it("resuelve el módulo exacto por id", () => {
    const hero = getTypedModule("catalog-hero");
    expect(hero?.manifest.id).toBe("catalog-hero");
    expect(getTypedModule("no-existe")).toBeUndefined();
  });

  it("afina el tipo por id del módulo", () => {
    const hero = getTypedModule("catalog-hero");
    expectTypeOf(hero).toMatchTypeOf<{ manifest: { id: "catalog-hero" } } | undefined>();
    expectTypeOf(hero).not.toMatchTypeOf<{ manifest: { id: "split-hero" } }>();
    expectTypeOf(getTypedModule("split-hero")).toMatchTypeOf<
      { manifest: { id: "split-hero" } } | undefined
    >();
  });

  it("mantiene ids únicos en el registro", () => {
    const ids = [
      ...officialModules,
      ...catalogModernModules,
      ...contactV2Modules,
      ...aboutV2Modules,
    ].map((definition) => definition.manifest.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toContain("catalog-hero");
  });
});

describe("catalog-modern sin JavaScript y gating de búsqueda", () => {
  const modernDetailSection = createModuleSection({
    id: "section-modern-detail-test" as StoreSection["id"],
    slot: "product",
    moduleId: "catalog-product-detail",
  });
  const legacyDetailSection = createModuleSection({
    id: "section-legacy-detail-test" as StoreSection["id"],
    slot: "product",
    moduleId: "product-detail",
  });

  it("ofrece consulta por WhatsApp sin JavaScript en el detalle moderno", () => {
    const product = catalogModernStore.products.find(
      (candidate) => candidate.slug === "remera-esencial-de-algodon",
    );
    if (!product) throw new Error("Fixture sin remera esencial");
    const html = renderSections(catalogModernStore, [modernDetailSection], {
      pageType: "product",
      product,
    });

    expect(html).toContain("<noscript>");
    expect(html).toContain('class="catalog-add-fallback"');
    expect(html).toContain(".catalog-add-fallback{display:");
    expect(html).toContain('href="https://wa.me/5491123456789?text=');
    expect(html).toContain("Remera esencial de algodón");
  });

  it("no ofrece consulta por WhatsApp cuando el teléfono es el sentinel de plantilla", () => {
    const project = structuredClone(catalogModernStore);
    project.whatsapp = { ...project.whatsapp, phone: CATALOG_MODERN_PLACEHOLDER_PHONE };
    const product = project.products.find(
      (candidate) => candidate.slug === "remera-esencial-de-algodon",
    );
    if (!product) throw new Error("Fixture sin remera esencial");
    const html = renderSections(project, [modernDetailSection], {
      pageType: "product",
      product,
    });

    expect(html).not.toContain("wa.me");
    expect(html).not.toContain("catalog-add-fallback");
    expect(html).not.toContain(CATALOG_MODERN_PLACEHOLDER_PHONE);
  });

  it("ofrece consulta por WhatsApp sin JavaScript en el detalle legacy", () => {
    const product = referenceStore.products[0];
    if (!product) throw new Error("Fixture sin producto");
    const html = renderSections(referenceStore, [legacyDetailSection], {
      pageType: "product",
      product,
    });

    expect(html).toContain("<noscript>");
    expect(html).toContain('class="solara-add-fallback"');
    expect(html).toContain(".solara-add-fallback{display:");
    expect(html).toContain("https://wa.me/");
  });

  it("inicializa el detalle moderno en la variante disponible aunque la primera esté agotada", () => {
    const project = structuredClone(catalogModernStore);
    const product = project.products.find(
      (candidate) => candidate.slug === "remera-esencial-de-algodon",
    );
    if (!product) throw new Error("Fixture sin remera esencial");
    const soldOut = product.variants.find((variant) => !variant.available);
    if (!soldOut) throw new Error("Fixture sin variante agotada");
    product.variants = [soldOut, ...product.variants.filter((variant) => variant !== soldOut)];
    const available = product.variants.find((variant) => variant.available);
    if (!available) throw new Error("Fixture sin variante disponible");

    const html = renderSections(project, [modernDetailSection], {
      pageType: "product",
      product,
    });
    const selectHtml = html.slice(html.indexOf("data-variant-select"), html.indexOf("</select>"));
    const optionTags = selectHtml.match(/<option[^>]*>/g) ?? [];
    expect(optionTags[0]).toContain("disabled");
    expect(optionTags[0]).not.toContain("selected");
    const availableTag = optionTags.find((tag) => tag.includes(`value="${available.id}"`));
    expect(availableTag).toContain("selected");
  });

  it("inicializa el detalle legacy en la variante disponible aunque la primera esté agotada", () => {
    const project = structuredClone(referenceStore);
    const product = project.products[0];
    if (!product || product.variants.length < 2) throw new Error("Fixture sin variantes");
    const [first, second] = product.variants;
    if (!first || !second) throw new Error("Fixture sin variantes");
    product.variants = [{ ...second, available: false }, first];
    const available = product.variants.find((variant) => variant.available);
    if (!available) throw new Error("Fixture sin variante disponible");

    const html = renderSections(project, [legacyDetailSection], {
      pageType: "product",
      product,
    });
    const selectHtml = html.slice(html.indexOf("data-variant-select"), html.indexOf("</select>"));
    const optionTags = selectHtml.match(/<option[^>]*>/g) ?? [];
    expect(optionTags[0]).toContain("disabled");
    expect(optionTags[0]).not.toContain("selected");
    const availableTag = optionTags.find((tag) => tag.includes(`value="${available.id}"`));
    expect(availableTag).toContain("selected");
  });

  it("mantiene la navegación móvil accesible sin JavaScript", () => {
    const headerSection = createModuleSection({
      id: "section-modern-header-test" as StoreSection["id"],
      slot: "header",
      moduleId: "catalog-header",
    });
    const html = renderSections(catalogModernStore, [headerSection], { pageType: "home" });
    const noscripts = [...html.matchAll(/<noscript>([\s\S]*?)<\/noscript>/g)].map(
      (match) => match[1],
    );

    expect(noscripts.some((block) => block?.includes(".catalog-mobile-menu[hidden]"))).toBe(true);
    expect(html).toContain(
      '<div id="catalog-mobile-menu" class="catalog-mobile-menu" data-catalog-menu hidden role="dialog"',
    );
    expect(html).not.toContain('<aside id="catalog-mobile-menu"');
    const homeHtml = renderSections(catalogModernStore, catalogModernStore.sections, {
      pageType: "home",
    });
    expect(homeHtml).toContain("Ver opciones de contacto");
  });

  it("no emite rutas a /buscar/ cuando la búsqueda está deshabilitada", () => {
    const project = structuredClone(catalogModernStore);
    project.commerceTemplates.search.enabled = false;

    const html = renderSections(project, project.sections, { pageType: "home" });
    expect(html).not.toContain("/buscar/");
    expect(html).not.toContain("catalog-search-dialog");
    expect(html).not.toContain("catalog-mobile-search");

    const enabledHtml = renderSections(catalogModernStore, catalogModernStore.sections, {
      pageType: "home",
    });
    expect(enabledHtml).toContain("/buscar/");
    expect(enabledHtml).toContain("catalog-search-dialog");
  });

  it("no emite /buscar/ en la plantilla limpia cuando la búsqueda está apagada", () => {
    const project = structuredClone(catalogModernCleanStore);
    project.commerceTemplates.search.enabled = false;

    const html = renderSections(project, project.sections, { pageType: "home" });
    expect(html).not.toContain("/buscar/");
    expect(html).toContain('href="/categorias/"');

    const enabledHtml = renderSections(catalogModernCleanStore, catalogModernCleanStore.sections, {
      pageType: "home",
    });
    expect(enabledHtml).toContain('href="/buscar/"');
  });

  it("gates el botón de carrito moderno con los templates de carrito o checkout", () => {
    const headerSection = createModuleSection({
      id: "section-modern-header-cart-test" as StoreSection["id"],
      slot: "header",
      moduleId: "catalog-header",
    });
    const project = structuredClone(catalogModernStore);
    project.commerceTemplates.cart.enabled = false;
    project.commerceTemplates.checkout.enabled = false;

    const disabledHtml = renderSections(project, [headerSection], { pageType: "home" });
    expect(disabledHtml).not.toContain("data-solara-cart-open");

    project.commerceTemplates.checkout.enabled = true;
    const checkoutHtml = renderSections(project, [headerSection], { pageType: "home" });
    expect(checkoutHtml).toContain("data-solara-cart-open");
  });

  it("marca la pill del valor del primer variante disponible aunque otro variante del mismo valor esté agotado", () => {
    const project = structuredClone(catalogModernStore);
    const product = project.products.find(
      (candidate) => candidate.slug === "remera-esencial-de-algodon",
    );
    if (!product) throw new Error("Fixture sin remera esencial");
    const [first, second, third] = product.variants;
    if (!first || !second || !third) throw new Error("Fixture sin variantes");
    product.variants = [
      {
        ...first,
        title: "Negro / S",
        optionValues: { Color: "Negro", Talle: "S" },
        available: false,
        stockStatus: "out_of_stock" as const,
      },
      {
        ...second,
        title: "Blanco / S",
        optionValues: { Color: "Blanco", Talle: "S" },
        available: true,
        stockStatus: "in_stock" as const,
      },
      {
        ...third,
        title: "Negro / M",
        optionValues: { Color: "Negro", Talle: "M" },
        available: true,
        stockStatus: "in_stock" as const,
      },
    ];

    const html = renderSections(project, [modernDetailSection], {
      pageType: "product",
      product,
    });
    const optionsMarkup = html.slice(html.indexOf('class="catalog-variant-options"'));
    const tallePills = optionsMarkup.match(/<button[^>]*data-option-key="Talle"[^>]*>/g) ?? [];
    const sPill = tallePills.find((pill) => pill.includes('data-option-value="S"'));
    const mPill = tallePills.find((pill) => pill.includes('data-option-value="M"'));

    expect(sPill).toContain('aria-pressed="true"');
    expect(sPill).toContain(`data-variant-id="${first.id}"`);
    expect(mPill).toContain('aria-pressed="false"');
  });

  it("incluye reglas de impresión para drawer, backdrops y menú móvil", () => {
    const modernStyles = MODULE_STYLE_BLOCKS["catalog-modern"];
    if (!modernStyles) throw new Error("Falta el bloque de estilos catalog-modern");
    const printBlock = modernStyles.slice(modernStyles.indexOf("@media print"));
    expect(printBlock).toContain("[data-cart-drawer]");
    expect(printBlock).toContain(".catalog-mobile-menu");
    expect(printBlock).toContain("!important");
    expect(printBlock).toContain("transform: none");

    const legacyDrawerStyles = MODULE_STYLE_BLOCKS["cart-drawer"];
    if (!legacyDrawerStyles) throw new Error("Falta el bloque de estilos cart-drawer");
    const legacyPrintBlock = legacyDrawerStyles.slice(legacyDrawerStyles.indexOf("@media print"));
    expect(legacyPrintBlock).toContain("[data-cart-drawer]");

    const headerSection = createModuleSection({
      id: "section-modern-header-print-test" as StoreSection["id"],
      slot: "header",
      moduleId: "catalog-header",
    });
    const headerHtml = renderSections(catalogModernStore, [headerSection], { pageType: "home" });
    expect(headerHtml).toMatch(/<noscript>[\s\S]*@media print/);
  });

  it("mantiene centrada la imagen responsive dentro de la media de cada card", () => {
    expect(STORE_BASE_STYLES).toContain("[data-solara-store] .solara-product-media > picture,");
    expect(STORE_BASE_STYLES).toContain("[data-solara-store] .catalog-product-media > picture {");
    expect(STORE_BASE_STYLES).toContain("width: 100%;\n  height: 100%;");
    expect(STORE_BASE_STYLES).toContain(
      "[data-solara-store] .solara-product-media > picture > img,",
    );
    expect(STORE_BASE_STYLES).toContain("object-position: center;");
  });

  it("mantiene cuadrados los controles de paginación de Catalog Modern", () => {
    const styles = MODULE_STYLE_BLOCKS["catalog-modern"];
    if (!styles) throw new Error("Falta el bloque de estilos catalog-modern");

    expect(styles).toMatch(
      /\.solara-pagination a \{[^}]*border-radius: var\(--solara-radius\)[^}]*\}/,
    );
    expect(styles).not.toMatch(/\.solara-pagination a \{[^}]*border-radius: 999px/);
  });

  it("aplica el radio del tema al input del diálogo de búsqueda", () => {
    const styles = MODULE_STYLE_BLOCKS["catalog-modern"];
    if (!styles) throw new Error("Falta el bloque de estilos catalog-modern");

    expect(styles).toMatch(
      /\.catalog-search-dialog-controls input \{[^}]*border-radius: var\(--solara-radius\)[^}]*\}/,
    );
    expect(styles).not.toMatch(/\.catalog-search-dialog-controls input \{[^}]*border-radius: 999px/);
  });

  it("evita que el email del footer se parta a mitad de palabra", () => {
    const styles = MODULE_STYLE_BLOCKS["catalog-modern"];
    if (!styles) throw new Error("Falta el bloque de estilos catalog-modern");

    expect(styles).toMatch(
      /\.catalog-footer-inner a\[href\^="mailto:"\] \{[^}]*word-break: keep-all;[^}]*overflow-wrap: normal;[^}]*\}/,
    );
  });

  it("colapsa las grillas de producto a una columna hasta 360px en V2", () => {
    const styles = MODULE_STYLE_BLOCKS["catalog-modern-v2"];
    if (!styles) throw new Error("Falta el bloque de estilos catalog-modern-v2");

    expect(styles).toMatch(
      /@media \(max-width: 360px\)[\s\S]*?\.cm\.v2 \.catalog-product-grid,[\s\S]*?grid-template-columns: minmax\(0, 1fr\);/,
    );
    expect(styles).toMatch(
      /@media \(max-width: 360px\)[\s\S]*?\.cm\.v2 \.catalog-category-results \.catalog-product-grid,[\s\S]*?\.cm\.v2 \.catalog-search-results-grid \{[\s\S]*?grid-template-columns: minmax\(0, 1fr\);/,
    );
  });

  it("muestra hasta cuatro relacionados por fila en desktop", () => {
    const styles = MODULE_STYLE_BLOCKS["catalog-modern-v2"];
    if (!styles) throw new Error("Falta el bloque de estilos catalog-modern-v2");

    expect(styles).toMatch(
      /\.cm\.v2 \[data-solara-section\$="-related"\] \.catalog-product-grid \{[^}]*repeat\(4, ?minmax\(0, 1fr\)\)/,
    );
  });

  it("mantiene el alto del navbar V2 con nombres de tienda largos", () => {
    const styles = MODULE_STYLE_BLOCKS["catalog-modern-v2"];
    if (!styles) throw new Error("Falta el bloque de estilos catalog-modern-v2");

    const project = structuredClone(catalogModernV2Store);
    project.identity.brandName =
      "Marca de tienda extremadamente larga que no debe deformar el navbar";
    const headerSection = createModuleSection({
      id: "section-modern-header-long-brand-test" as StoreSection["id"],
      slot: "header",
      moduleId: "catalog-header",
    });
    const headerHtml = renderSections(project, [headerSection], { pageType: "home" });

    expect(headerHtml).toContain(project.identity.brandName);
    expect(styles).toMatch(
      /\.cm\.v2 \.catalog-brand \{[\s\S]*width: fit-content;[\s\S]*max-width: 100%;[\s\S]*justify-self: start;[\s\S]*overflow: hidden;[\s\S]*text-overflow: ellipsis;[\s\S]*white-space: nowrap;/,
    );
    expect(styles).toMatch(
      /\.cm\.v2 \.catalog-brand \.solara-wordmark \{[\s\S]*overflow: hidden;[\s\S]*text-overflow: ellipsis;[\s\S]*white-space: nowrap;/,
    );
    expect(styles).toMatch(
      /\.cm\.v2 \.catalog-brand \.solara-logo,[\s\S]*height: 100%;[\s\S]*object-fit: contain;/,
    );

    const narrowStart = styles.indexOf("@media (max-width: 450px)");
    const narrowEnd = styles.indexOf("@media (max-width: 900px)", narrowStart);
    const narrowStyles = styles.slice(narrowStart, narrowEnd);
    expect(narrowStyles).toMatch(
      /\.cm\.v2 \.catalog-brand \{[\s\S]*width: fit-content;[\s\S]*max-width: 100%;[\s\S]*justify-self: start;[\s\S]*overflow: hidden;[\s\S]*white-space: nowrap;/,
    );
    expect(narrowStyles).toContain(".cm.v2 .catalog-brand .solara-wordmark {");
    expect(narrowStyles).toContain("white-space: nowrap;");
    expect(narrowStyles).toContain("overflow: hidden;");
  });

  it("usa una única imagen de identidad en navbar y footer", () => {
    const project = structuredClone(catalogModernStore);
    const logo = project.assets[0];
    if (!logo) throw new Error("Fixture sin asset para el logo");
    project.identity.logoAssetId = logo.id;
    const header = createModuleSection({
      id: "section-modern-header-brand-mode-test" as StoreSection["id"],
      slot: "header",
      moduleId: "catalog-header",
    });
    const footer = createModuleSection({
      id: "section-modern-footer-brand-mode-test" as StoreSection["id"],
      slot: "footer",
      moduleId: "catalog-footer",
    });

    header.settings = { ...header.settings, brandMode: "text", brandAssetId: "" };
    const headerHtml = renderSections(project, [header], { pageType: "home" });
    const footerHtml = renderSections(project, [footer], { pageType: "home" });
    expect(headerHtml).toContain('class="solara-logo"');
    expect(footerHtml).toContain('class="solara-logo"');
    expect(headerHtml).not.toContain(
      `<span class="solara-wordmark">${project.identity.brandName}</span>`,
    );
    expect(footerHtml).not.toContain(
      `<span class="solara-wordmark">${project.identity.brandName}</span>`,
    );

    const headerDefinition = getModuleDefinition("catalog-header");
    expect(headerDefinition?.manifest.compatibleSettings).toEqual(["cartLabel", "searchLabel"]);
    expect(headerDefinition?.settingsFields.map((field) => field.key)).toEqual([
      "cartLabel",
      "searchLabel",
    ]);
  });

  it("mantiene visible la media LCP y usa zoom compositado sin clip-path", () => {
    const modernStyles = MODULE_STYLE_BLOCKS["catalog-modern-v2"];
    if (!modernStyles) throw new Error("Falta el bloque de estilos catalog-modern-v2");

    expect(modernStyles).toContain(
      "[data-hero-media]{animation:none!important;opacity:1!important}",
    );
    expect(modernStyles).toContain("@keyframes solara-hero-media-zoom");
    expect(modernStyles).toContain(".catalog-hero-line-inner");
    expect(modernStyles).toContain("line-height: 1.1;");
    expect(modernStyles).toContain("text-shadow: none;");
    expect(modernStyles).toContain("@media (min-width: 768px) and (max-width: 899px)");
    expect(modernStyles).toContain(".catalog-hero-benefits--band");
    expect(modernStyles).not.toContain("clip-path");
  });
});

describe("catalog-product-grid: nombres accesibles únicos", () => {
  it("distingue los enlaces de cada sección por su título", () => {
    const html = renderSections(catalogModernV2Store, catalogModernV2Store.sections, {
      pageType: "home",
    });

    expect(html).toContain('aria-label="Ver todos los productos de Recién llegados"');
    expect(html).toContain('aria-label="Ver todos los productos de Más elegidos"');
  });
});

describe("catalog-hero V2 con CTA único de WhatsApp", () => {
  it("reemplaza las acciones del hero V2 por un único enlace wa.me sin mensaje", () => {
    const section = catalogModernV2Store.sections.find(
      (candidate) => candidate.moduleId === "catalog-hero",
    );
    if (!section) throw new Error("Fixture V2 sin hero");
    const html = renderSections(catalogModernV2Store, [section], { pageType: "home" });
    const actions = html.slice(html.indexOf('class="catalog-hero-actions"'));
    const actionsMarkup = actions.slice(0, actions.indexOf("</div>"));

    expect(actionsMarkup).toContain('class="catalog-primary-action solara-primary-action"');
    expect(actionsMarkup).toContain('href="https://wa.me/5491123456789"');
    expect(actionsMarkup).not.toContain("?text=");
    expect(actionsMarkup).toContain('target="_blank" rel="noopener noreferrer"');
    expect(actionsMarkup).toContain(
      '<span class="catalog-hero-cta-label">Escribir por WhatsApp</span>',
    );
    expect(actionsMarkup).toContain('class="catalog-hero-cta-icon"');
    expect(actionsMarkup).not.toContain("catalog-secondary-action");
    expect(actionsMarkup).not.toContain("Ver reci\u00e9n llegados");
    expect(actionsMarkup.match(/<a\b/g)).toHaveLength(1);
  });

  it("conserva las acciones del hero V2 cuando no hay WhatsApp configurado", () => {
    const project = structuredClone(catalogModernV2Store);
    project.whatsapp = { ...project.whatsapp, phone: "" };
    const section = project.sections.find((candidate) => candidate.moduleId === "catalog-hero");
    if (!section) throw new Error("Fixture V2 sin hero");
    const html = renderSections(project, [section], { pageType: "home" });

    expect(html).not.toContain("wa.me");
    expect(html).not.toContain("Escribir por WhatsApp");
    expect(html).toContain("Ver reci\u00e9n llegados");
    expect(html).toContain("Explorar tienda");
  });

  it("trata el teléfono sentinel de plantilla como no configurado en V2", () => {
    const project = structuredClone(catalogModernV2Store);
    project.whatsapp = { ...project.whatsapp, phone: CATALOG_MODERN_PLACEHOLDER_PHONE };
    const section = project.sections.find((candidate) => candidate.moduleId === "catalog-hero");
    if (!section) throw new Error("Fixture V2 sin hero");
    const html = renderSections(project, [section], { pageType: "home" });

    expect(html).not.toContain("wa.me");
    expect(html).not.toContain("Escribir por WhatsApp");
    expect(html).toContain("Ver reci\u00e9n llegados");
  });

  it("no altera las acciones del hero V1", () => {
    const section = catalogModernStore.sections.find(
      (candidate) => candidate.moduleId === "catalog-hero",
    );
    if (!section) throw new Error("Fixture V1 sin hero");
    const html = renderSections(catalogModernStore, [section], { pageType: "home" });

    expect(html).not.toContain("wa.me");
    expect(html).not.toContain("Escribir por WhatsApp");
    expect(html).toContain('class="catalog-primary-action" href="/colecciones/recien-llegados/"');
    expect(html).toContain("Explorar tienda");
  });
});

describe("catalog-hero V2: contrato de markup para motion (beneficios y líneas)", () => {
  const heroSection = (store: typeof catalogModernV2Store) => {
    const section = store.sections.find((candidate) => candidate.moduleId === "catalog-hero");
    if (!section) throw new Error("Fixture sin hero");
    return section;
  };

  it("V2 renderiza tres beneficios por defecto con svg, aria-label y textos comerciales", () => {
    const html = renderSections(catalogModernV2Store, [heroSection(catalogModernV2Store)], {
      pageType: "home",
    });

    expect(html).toContain('data-hero-benefits aria-label="Beneficios"');
    // La familia V2 renderiza los beneficios dos veces: la copia interna
    // (desktop) y la banda posterior (mobile), con los mismos 3 items.
    expect(html.match(/class="catalog-hero-benefit" data-hero-benefit/g) ?? []).toHaveLength(6);
    expect(html).toContain('class="catalog-hero-benefits catalog-hero-benefits--copy"');
    expect(html).toContain('class="catalog-hero-benefits catalog-hero-benefits--band"');
    expect(html.match(/class="catalog-hero-benefit-icon"/g) ?? []).toHaveLength(6);
    expect(html).toContain(
      'viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"',
    );
    expect(html).toContain("<strong>Envíos a todo el país</strong>");
    expect(html).toContain("<strong>Pedido directo</strong>");
    expect(html).toContain("<strong>Compra cuidada</strong>");
    expect(html).toContain("Coordinamos la entrega por WhatsApp");
    expect(html).toContain("Comprá conversando con la marca");
    expect(html).toContain("Confirmamos todo antes de enviar");
    expect(html).not.toContain("catalog-hero-stats");
  });

  it("con benefits vacío cae al markup de stats respetando showCatalogStats", () => {
    const base = heroSection(catalogModernV2Store);
    const html = renderSections(
      catalogModernV2Store,
      [{ ...base, settings: { ...base.settings, benefits: [] } }],
      { pageType: "home" },
    );

    expect(html).toContain('class="catalog-hero-stats"');
    expect(html).not.toContain("data-hero-benefits");

    const hidden = renderSections(
      catalogModernV2Store,
      [{ ...base, settings: { ...base.settings, benefits: [], showCatalogStats: false } }],
      { pageType: "home" },
    );

    expect(hidden).not.toContain("catalog-hero-stats");
    expect(hidden).not.toContain("data-hero-benefits");
  });

  it("V1 conserva el hero actual sin contrato de motion ni beneficios", () => {
    const html = renderSections(catalogModernStore, [heroSection(catalogModernStore)], {
      pageType: "home",
    });

    expect(html).toContain("<h1>Vestite con lo que te representa.</h1>");
    expect(html).toContain("catalog-hero-stats");
    expect(html).not.toContain("data-hero-title");
    expect(html).not.toContain("data-hero-line");
    expect(html).not.toContain("data-hero-rule");
    expect(html).not.toContain("catalog-hero-reveal");
    expect(html).not.toContain("data-hero-benefits");
  });

  it("el modo carousel conserva la estructura actual sin contrato de motion", () => {
    const base = heroSection(catalogModernV2Store);
    const section = {
      ...base,
      settings: {
        ...base.settings,
        mode: "carousel",
        slides: [
          {
            id: "slide-hero-1",
            title: "Primer slide",
            body: "Cuerpo del primero",
            actionLabel: "Ver",
            actionHref: "/",
            imageId: "",
          },
          {
            id: "slide-hero-2",
            title: "Segundo slide",
            body: "Cuerpo del segundo",
            actionLabel: "Ver",
            actionHref: "/",
            imageId: "",
          },
        ],
      },
    };
    const html = renderSections(catalogModernV2Store, [section], { pageType: "home" });

    expect(html).toContain("catalog-hero-slide-stage");
    expect(html).toContain("data-catalog-hero-slide-panel");
    expect(html).toContain("catalog-hero-controls");
    expect(html).toContain("<h1>Primer slide</h1>");
    expect(html).toContain("catalog-hero-stats");
    expect(html).not.toContain("data-hero-title");
    expect(html).not.toContain("data-hero-line");
    expect(html).not.toContain("data-hero-rule");
    expect(html).not.toContain("catalog-hero-reveal");
    expect(html).not.toContain("data-hero-benefits");
  });

  it("conserva saltos explícitos y deja el wrapping responsive al navegador", () => {
    const base = heroSection(catalogModernV2Store);
    const section = {
      ...base,
      settings: { ...base.settings, title: "Vestite con\nlo que te\nrepresenta." },
    };
    const html = renderSections(catalogModernV2Store, [section], { pageType: "home" });

    expect(html.match(/data-hero-line-inner/g) ?? []).toHaveLength(3);
    expect(html).toContain(
      '<span class="catalog-hero-line" data-hero-line><span class="catalog-hero-line-inner" data-hero-line-inner>Vestite con</span></span> <span class="catalog-hero-line" data-hero-line><span class="catalog-hero-line-inner" data-hero-line-inner>lo que te</span></span> <span class="catalog-hero-line" data-hero-line><span class="catalog-hero-line-inner" data-hero-line-inner>representa.</span></span>',
    );
    const titleMarkup = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/)?.[1] ?? "";
    expect(
      titleMarkup
        .replace(/<[^>]+>/g, "")
        .replace(/\s+/g, " ")
        .trim(),
    ).toBe("Vestite con lo que te representa.");

    const short = renderSections(
      catalogModernV2Store,
      [{ ...base, settings: { ...base.settings, title: "Solo dos" } }],
      { pageType: "home" },
    );
    expect(short.match(/data-hero-line-inner/g) ?? []).toHaveLength(1);
    expect(short).toContain(">Solo dos</span></span>");

    const odd = renderSections(
      catalogModernV2Store,
      [{ ...base, settings: { ...base.settings, title: "Una bici verde" } }],
      { pageType: "home" },
    );
    expect(odd.match(/data-hero-line-inner/g) ?? []).toHaveLength(1);
    expect(odd).toContain(">Una bici verde</span></span>");
  });

  it("usa check como ícono de respaldo cuando el ícono no existe", () => {
    const base = heroSection(catalogModernV2Store);
    const section = {
      ...base,
      settings: {
        ...base.settings,
        benefits: [
          { id: "benefit-truck", icon: "truck", title: "Envíos", text: "" },
          { id: "benefit-unknown", icon: "icono-inexistente", title: "Raro", text: "" },
          { id: "benefit-check", icon: "check", title: "Check", text: "" },
        ],
      },
    };
    const html = renderSections(catalogModernV2Store, [section], { pageType: "home" });
    const icons = [
      ...html.matchAll(/<li class="catalog-hero-benefit" data-hero-benefit><svg[\s\S]*?<\/svg>/g),
    ].map((match) => match[0] ?? "");

    expect(icons).toHaveLength(6);
    expect(icons[1]).toBe(icons[2]);
    expect(icons[1]).not.toBe(icons[0]);
  });

  it("valida en el schema id obligatorio, tope de 3 ítems y defaults comerciales", () => {
    const schema = getTypedModule("catalog-hero")?.settingsSchema;
    if (!schema) throw new Error("Falta el módulo catalog-hero");

    const defaults = schema.parse({});
    expect(defaults.benefits).toHaveLength(3);
    expect(defaults.benefits[0]?.icon).toBe("truck");
    expect(defaults.benefits[0]?.title).toBe("Envíos a todo el país");
    expect(schema.safeParse({ benefits: [{ icon: "truck", title: "Sin id" }] }).success).toBe(
      false,
    );
    expect(
      schema.safeParse({
        benefits: [
          { id: "a", title: "A" },
          { id: "b", title: "B" },
          { id: "c", title: "C" },
          { id: "d", title: "D" },
        ],
      }).success,
    ).toBe(false);
    expect(schema.safeParse({ benefits: [{ id: "a", title: "A" }] }).success).toBe(true);
  });
});

describe("auditoría Resumen — fixes Ola 3 (navegación y footer moderno)", () => {
  const headerSection = createModuleSection({
    id: "section-modern-header-resumen-test" as StoreSection["id"],
    slot: "header",
    moduleId: "catalog-header",
  });
  const footerSection = createModuleSection({
    id: "section-modern-footer-resumen-test" as StoreSection["id"],
    slot: "footer",
    moduleId: "catalog-footer",
  });

  it("en mode automatic los ítems del editor tienen prioridad sobre las categorías", () => {
    const project = structuredClone(catalogModernStore);
    project.navigation = { ...project.navigation, mode: "automatic", items: [] };

    // Sin items editados: la navegación deriva de las categorías raíz.
    const automaticHtml = renderSections(project, [headerSection], { pageType: "home" });
    expect(automaticHtml).toContain('class="catalog-mega-group__link" href="/categorias/remeras/"');

    // Con items editados: el renderer los usa aunque el modo siga automatic.
    project.navigation.items = [
      { id: "nav-manual", label: "Enlace manual", href: "/contacto/" },
      { id: "nav-manual-2", label: "Segundo enlace", href: "/envios/" },
    ];
    const editorHtml = renderSections(project, [headerSection], { pageType: "home" });
    expect(editorHtml).toContain('class="catalog-mega-group__link" href="/contacto/"');
    expect(editorHtml).toContain('class="catalog-mega-group__link" href="/envios/"');
    expect(editorHtml).toContain("Enlace manual");
    expect(editorHtml).not.toContain('href="/categorias/remeras/"');
  });

  it("V2 redirige Contacto al bloque de Home y omite Nosotros archivado", () => {
    const project = structuredClone(catalogModernV2Store);
    project.navigation = {
      ...project.navigation,
      mode: "curated",
      items: [
        { id: "nav-contact-v2", label: "Contacto", href: "/contacto/" },
        { id: "nav-about-v2", label: "Nosotros", href: "/nosotros/" },
        {
          id: "nav-help-v2",
          label: "Ayuda",
          href: "/envios/",
          children: [
            { id: "nav-child-contact-v2", label: "Contacto", href: "/contacto/" },
            { id: "nav-child-about-v2", label: "Nosotros", href: "/nosotros/" },
          ],
        },
      ],
    };

    const headerSection = createModuleSection({
      id: "section-modern-header-v2-archived-pages" as StoreSection["id"],
      slot: "header",
      moduleId: "catalog-header",
    });
    const html = renderSections(project, [headerSection], { pageType: "home" });

    expect(html).toContain('href="/#contact-form"');
    expect(html).not.toContain('href="/envios/"');
    expect(html).not.toContain('href="/contacto/"');
    expect(html).not.toContain('href="/nosotros/"');
    expect(html).not.toContain(">Nosotros</a>");
  });

  it("la plantilla limpia (automatic, sin items ni categorías) conserva el fallback a /buscar/", () => {
    const html = renderSections(catalogModernCleanStore, [headerSection], { pageType: "home" });
    expect(html).toContain('class="catalog-nav-empty" href="/buscar/"');
    expect(html).not.toContain("catalog-mega-group__link");
  });

  it("incluye la dirección de identidad en el footer moderno (paridad con legacy)", () => {
    const project = structuredClone(catalogModernStore);
    project.identity.address = "Av. Siempre Viva 123";
    const html = renderSections(project, [footerSection], { pageType: "home" });

    expect(html).toContain("<span>Av. Siempre Viva 123</span>");
    expect(html).toContain("mailto:");
    expect(html).toContain("tel:");
  });

  it("conecta el footer con la identidad y la paleta activa", () => {
    const styles = MODULE_STYLE_BLOCKS["catalog-modern"];
    if (!styles) throw new Error("Falta el bloque de estilos catalog-modern");

    expect(styles).toContain("border-top: 2px solid var(--solara-accent);");
    expect(styles).toContain("border-inline-start: 2px solid var(--solara-accent);");
    expect(styles).toContain(".catalog-footer-whatsapp");
    expect(styles).toContain("var(--solara-accent-text)");
  });

  it("deja sólo el subrayado animado en el acceso a todos los productos", () => {
    const styles = MODULE_STYLE_BLOCKS["catalog-modern"];
    const v2Styles = MODULE_STYLE_BLOCKS["catalog-modern-v2"];
    if (!styles) throw new Error("Falta el bloque de estilos catalog-modern");
    if (!v2Styles) throw new Error("Falta el bloque de estilos catalog-modern-v2");

    const baseRule = styles.match(
      /\.catalog-mega-menu__all \{[^}]*text-decoration: none;[^}]*\}/,
    )?.[0];
    expect(baseRule).toBeDefined();
    expect(baseRule).not.toContain("border-top");
    expect(v2Styles).toContain(".cm.v2 .catalog-mega-menu__all::after");
    expect(v2Styles).toContain(".cm.v2 .catalog-mega-menu__all:hover::after");
  });

  it("ofrece un acceso de WhatsApp desde el bloque de identidad del footer", () => {
    const project = structuredClone(catalogModernStore);
    project.whatsapp.phone = "5492804558845";
    const html = renderSections(project, [footerSection], { pageType: "home" });

    expect(html).toContain('class="catalog-footer-whatsapp"');
    expect(html).toContain('href="https://wa.me/5492804558845"');
    expect(html).toContain(project.publicCopy.contact.whatsappAction);
  });

  it("usa navigation.catalogLabel como eyebrow del diálogo de búsqueda", () => {
    const project = structuredClone(catalogModernStore);
    project.navigation.catalogLabel = "Explorar";
    const html = renderSections(project, [headerSection], { pageType: "home" });

    expect(html).toContain('<p class="catalog-eyebrow">Explorar</p>');
    expect(html).not.toContain('<p class="catalog-eyebrow">Catálogo</p>');

    const cleanHtml = renderSections(catalogModernCleanStore, [headerSection], {
      pageType: "home",
    });
    expect(cleanHtml).toContain('<p class="catalog-eyebrow">Categorías</p>');
  });
});
