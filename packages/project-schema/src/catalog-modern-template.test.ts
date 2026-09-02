import { describe, expect, it } from "vitest";
import { contactDefaultHelpItems, contactDefaultQuickLinks } from "./catalog-modern-contact";
import { catalogModernStore } from "./catalog-modern-fixture";
import {
  buildCatalogModernProject,
  CATALOG_MODERN_TEMPLATE_VERSION,
  catalogModernCleanStore,
  ensureAboutV2Sections,
  ensureCatalogModernV2Sections,
  ensureContactV2Sections,
} from "./catalog-modern-template";
import { catalogModernV2Store } from "./catalog-modern-v2-fixture";

describe("plantilla Catalog Modern", () => {
  it("crea una tienda limpia guiada sin copiar el catálogo demo", () => {
    expect(catalogModernCleanStore.origin).toEqual({
      templateId: "catalog-modern",
      templateVersion: CATALOG_MODERN_TEMPLATE_VERSION,
      seed: "clean",
      role: "store",
      updatePolicy: "managed",
    });
    expect(catalogModernCleanStore.products).toHaveLength(0);
    expect(catalogModernCleanStore.categories).toHaveLength(0);
    expect(catalogModernCleanStore.collections).toHaveLength(0);
    expect(catalogModernCleanStore.pages.map((page) => page.kind)).toEqual(["home"]);
    expect(
      catalogModernCleanStore.assets.every((asset) => !/^asset-(about|contact)-/i.test(asset.id)),
    ).toBe(true);
    expect(catalogModernCleanStore.navigation.mode).toBe("automatic");
    expect(catalogModernCleanStore.sections.some((section) => section.enabled)).toBe(true);
    expect(JSON.stringify(catalogModernCleanStore)).not.toContain("Modo Sur");
    expect(JSON.stringify(catalogModernCleanStore)).not.toContain("tienda-referencia");
    expect(catalogModernCleanStore.identity.email).toBe("");
    expect(catalogModernCleanStore.identity.phone).toBe("");
    expect(catalogModernCleanStore.identity.address).toBe("");
    expect(
      catalogModernCleanStore.assets
        .filter((asset) => asset.kind === "image")
        .every((asset) => asset.source.startsWith("data:image/svg+xml")),
    ).toBe(true);
    expect(catalogModernCleanStore.whatsapp.phone).toBe("");
  });

  it("desactiva el appear del CTA de novedades desde motion declarativo", () => {
    const newsletter = catalogModernStore.sections.find(
      (section) => section.moduleId === "catalog-newsletter-cta",
    );
    if (!newsletter) throw new Error("Fixture sin CTA de novedades");
    expect(newsletter.motion.preset).toBe("none");

    const legacy = structuredClone(catalogModernV2Store);
    const legacyNewsletter = legacy.sections.find(
      (section) => section.moduleId === "catalog-newsletter-cta",
    );
    if (!legacyNewsletter) throw new Error("Fixture V2 sin CTA de novedades");
    legacyNewsletter.motion = { ...legacyNewsletter.motion, preset: "fade-up" };

    const normalized = ensureCatalogModernV2Sections(legacy);
    expect(
      normalized.sections.find((section) => section.moduleId === "catalog-newsletter-cta")?.motion
        .preset,
    ).toBe("none");
  });

  it("mantiene la demo de 50 productos y 14 categorías desde la misma plantilla", () => {
    const demo = buildCatalogModernProject({ seed: "demo" });
    expect(demo.origin?.seed).toBe("demo");
    expect(demo.products).toHaveLength(50);
    expect(demo.categories).toHaveLength(14);
    expect(demo.products.flatMap((product) => product.variants)).toHaveLength(60);
    expect(demo.products.slice(0, 6).every((product) => product.reviews?.length === 6)).toBe(true);
    expect(demo.products.slice(6).every((product) => !product.reviews)).toBe(true);
  });

  it("permite personalizar la identidad sin cambiar el contrato", () => {
    const project = buildCatalogModernProject({
      seed: "clean",
      id: "store-ejemplo",
      name: "Tienda ejemplo",
      brandName: "Marca ejemplo",
      slug: "tienda-ejemplo",
    });
    expect(project.id).toBe("store-ejemplo");
    expect(project.identity.brandName).toBe("Marca ejemplo");
    expect(project.baseUrl).toBe("https://tienda-ejemplo.example");
  });

  it("mantiene aisladas dos tiendas limpias con copy global distinto", () => {
    const first = buildCatalogModernProject({
      seed: "clean",
      id: "store-first",
      name: "Primera tienda",
      brandName: "Marca primera",
      slug: "primera-tienda",
    });
    const second = buildCatalogModernProject({
      seed: "clean",
      id: "store-second",
      name: "Segunda tienda",
      brandName: "Marca segunda",
      slug: "segunda-tienda",
    });

    first.publicCopy.navigation.cart = "Bolsa";

    expect(second.identity.brandName).toBe("Marca segunda");
    expect(second.publicCopy.navigation.cart).toBe("Carrito");
    expect(JSON.stringify(second)).not.toContain("Marca primera");
    expect(JSON.stringify(second)).not.toContain("Bolsa");
  });

  it("seedear Contacto V2 y normaliza una página vacía sin tocar V1", () => {
    const v2Contact = catalogModernV2Store.pages.find((page) => page.kind === "contact");
    expect(v2Contact?.sections.map((section) => section.moduleId)).toEqual([
      "contact-hero",
      "contact-form",
      "contact-channels",
      "contact-whatsapp-cta",
      "contact-purchase-info",
      "contact-faq",
      "contact-location",
    ]);
    const empty = structuredClone(catalogModernV2Store);
    empty.pages = empty.pages.map((page) =>
      page.kind === "contact" ? { ...page, sections: [] } : page,
    );
    const normalized = ensureContactV2Sections(empty);
    const normalizedContact = normalized.pages.find((page) => page.kind === "contact");
    expect(normalizedContact?.sections).toHaveLength(7);
    expect(normalizedContact?.sections[0]?.settings.quickLinks).toEqual([]);
    expect(ensureContactV2Sections(normalized)).toEqual(normalized);
    const v1 = structuredClone(catalogModernCleanStore);
    expect(ensureContactV2Sections(v1)).toEqual(v1);
  });

  it("retira los bloques de ayuda antiguos sin tocar un Contacto personalizado", () => {
    const stale = structuredClone(catalogModernV2Store);
    const contact = stale.pages.find((page) => page.kind === "contact");
    if (!contact) throw new Error("Fixture sin página Contacto");
    const hero = contact.sections.find((section) => section.moduleId === "contact-hero");
    if (!hero) throw new Error("Contacto sin hero");
    hero.settings.quickLinks = structuredClone(contactDefaultQuickLinks);
    contact.sections.splice(3, 0, {
      ...hero,
      id: "contact-section-help" as typeof hero.id,
      moduleId: "contact-help-grid",
      settings: {
        title: "¿En qué podemos ayudarte?",
        body: "Elegí el tema para que podamos asistirte de la mejor manera.",
        items: structuredClone(contactDefaultHelpItems),
      },
    });

    const normalized = ensureContactV2Sections(stale);
    const normalizedContact = normalized.pages.find((page) => page.kind === "contact");
    expect(
      normalizedContact?.sections.some((section) => section.id === "contact-section-help"),
    ).toBe(false);
    expect(
      normalizedContact?.sections.find((section) => section.moduleId === "contact-hero")?.settings
        .quickLinks,
    ).toEqual([]);

    const custom = structuredClone(catalogModernV2Store);
    const customContact = custom.pages.find((page) => page.kind === "contact");
    if (!customContact) throw new Error("Fixture sin página Contacto");
    const customHero = customContact.sections[0];
    if (!customHero) throw new Error("Contacto sin hero");
    customContact.sections[0] = {
      ...customHero,
      settings: {
        ...customHero.settings,
        quickLinks: [
          {
            ...contactDefaultQuickLinks[0],
            title: "Asistencia personalizada",
          },
        ],
      },
    };
    expect(ensureContactV2Sections(custom)).toEqual(custom);
  });

  it("seedear Nosotros V2 con diez módulos y de forma idempotente", () => {
    const empty = structuredClone(catalogModernV2Store);
    empty.pages = empty.pages.map((page) =>
      page.kind === "about" ? { ...page, sections: [] } : page,
    );

    const normalized = ensureAboutV2Sections(empty);
    expect(
      normalized.pages
        .find((page) => page.kind === "about")
        ?.sections.map((section) => section.moduleId),
    ).toEqual([
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
    ]);
    expect(normalized.pages.find((page) => page.kind === "about")?.sections).toHaveLength(10);
    const hero = normalized.pages.find((page) => page.kind === "about")?.sections[0];
    expect(hero?.settings.imageAssetId).toBe("asset-about-hero");
    const team = normalized.pages.find((page) => page.kind === "about")?.sections[7];
    expect(team?.enabled).toBe(true);
    expect(team?.settings.enabled).toBe(true);
    expect(team?.settings.items).toHaveLength(2);
    expect(ensureAboutV2Sections(normalized)).toEqual(normalized);
  });

  it("normaliza Contacto y Nosotros juntas sin tocar V1", () => {
    const empty = structuredClone(catalogModernV2Store);
    empty.pages = empty.pages.map((page) =>
      page.kind === "about" || page.kind === "contact" ? { ...page, sections: [] } : page,
    );
    const normalized = ensureCatalogModernV2Sections(empty);
    expect(normalized.pages.find((page) => page.kind === "about")?.sections).toHaveLength(10);
    expect(normalized.pages.find((page) => page.kind === "contact")?.sections).toHaveLength(7);

    const v1 = structuredClone(catalogModernCleanStore);
    expect(ensureAboutV2Sections(v1)).toEqual(v1);
    expect(ensureCatalogModernV2Sections(v1)).toEqual(v1);
  });

  it("agrega Contacto al final de Home V2 sin duplicar módulos ni tocar V1", () => {
    const legacy = structuredClone(catalogModernV2Store);
    legacy.navigation.showContact = true;
    legacy.navigation.showAbout = true;
    const legacyHero = legacy.sections.find((section) => section.moduleId === "catalog-hero");
    const legacyNewsletter = legacy.sections.find(
      (section) => section.moduleId === "catalog-newsletter-cta",
    );
    if (!legacyHero || !legacyNewsletter) throw new Error("Fixture V2 sin CTA de contacto");
    legacyHero.settings.secondaryActionHref = "/nosotros/";
    legacyNewsletter.settings.actionHref = "/contacto/";
    legacy.sections = legacy.sections.filter(
      (section) => !["contact-form", "contact-channels"].includes(section.moduleId),
    );
    const normalized = ensureCatalogModernV2Sections(legacy);
    const moduleIds = normalized.sections.map((section) => section.moduleId);
    const formIndex = moduleIds.indexOf("contact-form");
    const channelsIndex = moduleIds.indexOf("contact-channels");
    const cartIndex = moduleIds.indexOf("catalog-cart-drawer");

    expect(formIndex).toBeGreaterThan(-1);
    expect(channelsIndex).toBe(formIndex + 1);
    expect(cartIndex).toBeGreaterThan(channelsIndex);
    expect(normalized.navigation.showContact).toBe(false);
    expect(normalized.navigation.showAbout).toBe(false);
    expect(
      normalized.sections.find((section) => section.moduleId === "catalog-hero")?.settings
        .secondaryActionHref,
    ).toBe("#contact-form");
    expect(
      normalized.sections.find((section) => section.moduleId === "catalog-newsletter-cta")?.settings
        .actionHref,
    ).toBe("#contact-form");
    expect(ensureCatalogModernV2Sections(normalized)).toEqual(normalized);

    const v1 = structuredClone(catalogModernStore);
    expect(v1.sections.some((section) => section.moduleId === "contact-form")).toBe(false);
    expect(ensureCatalogModernV2Sections(v1)).toEqual(v1);
  });

  it("mantiene el contenido explícito de una página about V2", () => {
    const project = structuredClone(catalogModernV2Store);
    const about = project.pages.find((page) => page.kind === "about");
    if (!about) throw new Error("Fixture sin página about");
    const hero = about.sections[0];
    if (!hero) throw new Error("Página about sin hero");
    about.sections[0] = {
      ...hero,
      settings: { ...hero.settings, title: "Título escrito por la tienda" },
    };
    expect(ensureAboutV2Sections(project)).toEqual(project);
  });

  it("completa settings visuales faltantes de un seed V2 anterior", () => {
    const legacy = structuredClone(catalogModernV2Store);
    const about = legacy.pages.find((page) => page.kind === "about");
    if (!about) throw new Error("Fixture sin página about");
    const hero = about.sections.find((section) => section.moduleId === "about-hero");
    const team = about.sections.find((section) => section.moduleId === "about-team");
    if (!hero || !team) throw new Error("Fixture about incompleta");
    delete hero.settings.actionLabel;
    delete hero.settings.actionHref;
    hero.settings.imageAssetId = "";
    team.enabled = false;
    team.settings.enabled = false;
    team.settings.items = [];

    const normalized = ensureCatalogModernV2Sections(legacy);
    const normalizedHero = normalized.pages
      .find((page) => page.kind === "about")
      ?.sections.find((section) => section.moduleId === "about-hero");
    const normalizedTeam = normalized.pages
      .find((page) => page.kind === "about")
      ?.sections.find((section) => section.moduleId === "about-team");
    expect(normalizedHero?.settings.actionLabel).toBe("Explorar selección");
    expect(normalizedHero?.settings.actionHref).toBe("/buscar/");
    expect(normalizedHero?.settings.imageAssetId).toBe("asset-about-hero");
    expect(normalizedTeam?.enabled).toBe(true);
    expect(normalizedTeam?.settings.enabled).toBe(true);
    expect(normalizedTeam?.settings.items).toHaveLength(2);
  });

  it("la tienda limpia sólo conserva Home como página editorial", () => {
    const clean = buildCatalogModernProject({ seed: "clean", name: "Probe", slug: "probe" });
    expect(clean.pages.map((page) => page.kind)).toEqual(["home"]);
    expect(clean.sections.some((section) => section.moduleId === "contact-form")).toBe(true);
    expect(clean.sections.some((section) => section.moduleId === "contact-channels")).toBe(true);
  });
});
