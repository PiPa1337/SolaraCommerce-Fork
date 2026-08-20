import { catalogModernV2Store } from "@solara/project-schema/catalog-modern-v2-fixture";
import { describe, expect, it } from "vitest";
import {
  aboutEditorialImageSettings,
  aboutHero,
  aboutHeroSettings,
  aboutHistorySettings,
  aboutTeamSettings,
  aboutV2ModuleIds,
  aboutV2Modules,
} from "./about-v2";
import {
  getModuleDefinition,
  isCatalogModernModule,
  isModuleAvailableOnPage,
  MODULE_STYLE_BLOCKS,
} from "./index";

describe("Nosotros V2 module contracts", () => {
  it("registra los diez módulos con ids estables", () => {
    expect(aboutV2Modules).toHaveLength(10);
    expect(aboutV2ModuleIds).toEqual(
      new Set([
        "about-hero",
        "about-history",
        "about-principles",
        "about-editorial-image",
        "about-process",
        "about-manifesto",
        "about-experience",
        "about-team",
        "about-stats",
        "about-products-cta",
      ]),
    );
  });

  it("limita los módulos a Nosotros V2 y conserva el newsletter compartido", () => {
    const hero = getModuleDefinition("about-hero");
    const newsletter = getModuleDefinition("catalog-newsletter-cta");
    if (!hero || !newsletter) throw new Error("Faltan módulos registrados");
    expect(isCatalogModernModule(hero)).toBe(true);
    expect(isModuleAvailableOnPage(hero, "about", "catalog-modern-v2")).toBe(true);
    expect(isModuleAvailableOnPage(hero, "contact", "catalog-modern-v2")).toBe(false);
    expect(isModuleAvailableOnPage(hero, "about", "catalog-modern-v1")).toBe(false);
    expect(isModuleAvailableOnPage(newsletter, "about", "catalog-modern-v2")).toBe(true);
  });

  it("aplica defaults y límites de repeaters", () => {
    expect(aboutHeroSettings.parse({}).title).toBe("Una selección pensada para moverte.");
    expect(aboutHeroSettings.parse({}).imageAssetId).toBe("asset-about-hero");
    expect(aboutHistorySettings.parse({}).paragraphs).toHaveLength(3);
    expect(aboutEditorialImageSettings.parse({}).enabled).toBe(true);
    expect(aboutTeamSettings.parse({}).enabled).toBe(true);
    expect(aboutTeamSettings.parse({}).items).toHaveLength(2);
    expect(
      aboutTeamSettings.safeParse({ items: Array.from({ length: 5 }, () => ({})) }).success,
    ).toBe(false);
  });

  it("renderiza un hero seguro y semántico", () => {
    const section = catalogModernV2Store.pages.find((page) => page.kind === "about")?.sections[0];
    if (!section) throw new Error("Fixture sin hero de Nosotros");
    const html = String(
      aboutHero.render?.({
        project: catalogModernV2Store,
        section,
        settings: aboutHeroSettings.parse({ title: "<Título>" }),
        pageType: "about",
      }),
    );
    expect(html).toContain('data-solara-module="about-hero"');
    expect(html).toContain("&lt;Título&gt;");
    expect(html).toContain('<h1 class="catalog-hero-title"');
    expect(html).toContain('data-motion-zone="content"');
    expect(html).toContain('class="catalog-hero-inner about-hero"');
    expect(html).toContain('class="catalog-hero-media about-hero-media"');
    expect(html).toContain('class="catalog-hero-background"');
    expect(html).not.toContain("catalog-hero-benefits--copy");
    expect(html).not.toContain("catalog-hero-benefits--band");
    expect(html).not.toContain("<video");
    expect(html).toContain("images.unsplash.com");
  });

  it("no deja markup cuando los módulos opcionales están desactivados", () => {
    const section = catalogModernV2Store.pages.find((page) => page.kind === "about")?.sections[0];
    if (!section) throw new Error("Fixture sin sección");
    const editorial = getModuleDefinition("about-editorial-image");
    const team = getModuleDefinition("about-team");
    if (!editorial || !team) throw new Error("Faltan módulos opcionales");
    expect(
      String(
        editorial.render({
          project: catalogModernV2Store,
          section,
          settings: { ...editorial.settingsSchema.parse({}), enabled: false },
          pageType: "about",
        }),
      ),
    ).toBe("");
    expect(
      String(
        team.render({
          project: catalogModernV2Store,
          section,
          settings: team.settingsSchema.parse({ enabled: false }),
          pageType: "about",
        }),
      ),
    ).toBe("");
  });

  it("incluye estilos V2 para la página y reduced motion", () => {
    const styles = MODULE_STYLE_BLOCKS["catalog-modern-v2"];
    expect(styles).toContain(".cm.v2 .solara-about-page");
    expect(styles).toContain(".cm.v2 .about-hero");
    expect(styles).toContain("aspect-ratio: 9 / 16");
    expect(styles).toContain(".cm.v2 .catalog-hero-page .catalog-hero-inner");
    expect(styles).toContain(".cm.v2 .solara-about-sections > [data-solara-module]");
    expect(styles).toContain("@media (prefers-reduced-motion: reduce)");
    expect(styles).toContain('[data-solara-module^="about-"]');
  });
});
