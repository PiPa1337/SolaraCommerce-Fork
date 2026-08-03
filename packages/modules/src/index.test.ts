import type { StoreSection } from "@solara/project-schema";
import { referenceStore } from "@solara/project-schema/fixture";
import { catalogScaleStore } from "@solara/project-schema/scale-fixture";
import { describe, expect, it } from "vitest";
import {
  createModuleSection,
  getModuleDefinition,
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
