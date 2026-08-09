import type { StoreSection } from "@solara/project-schema";
import { catalogModernStore } from "@solara/project-schema/catalog-modern-fixture";
import { referenceStore } from "@solara/project-schema/fixture";
import { catalogScaleStore } from "@solara/project-schema/scale-fixture";
import { describe, expect, expectTypeOf, it } from "vitest";
import {
  catalogModernModules,
  createModuleSection,
  getModuleDefinition,
  getTypedModule,
  MODULE_STYLE_BLOCKS,
  moduleRegistry,
  officialModules,
  renderSections,
  replaceModuleInSection,
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
            moduleId === "catalog-modern"
              ? trimmed.startsWith("[data-solara-store].catalog-modern")
              : trimmed.startsWith(`[data-solara-module="${moduleId}"]`);
          expect(scoped).toBe(true);
        }
      }
    }
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

  it("deriva el bento desde las categorías reales del proyecto", () => {
    const html = renderSections(catalogModernStore, catalogModernStore.sections, {
      pageType: "home",
    });
    const bento = html.slice(html.indexOf('data-solara-module="catalog-category-bento"'));
    expect(bento.match(/class="catalog-category-bento-item /g) ?? []).toHaveLength(
      catalogModernStore.categories.length,
    );
    expect(bento).toContain(catalogModernStore.categories[0]?.title);
    expect(bento).toContain(catalogModernStore.categories.at(-1)?.title);
    expect(bento).toContain("Ver todo el catálogo");
    expect(bento).toContain('href="/categorias/');
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
    const ids = [...officialModules, ...catalogModernModules].map(
      (definition) => definition.manifest.id,
    );
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
});
