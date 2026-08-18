import { catalogModernV2Store } from "@solara/project-schema/catalog-modern-v2-fixture";
import { describe, expect, it } from "vitest";
import {
  contactChannelsSettings,
  contactFaqSettings,
  contactFormSettings,
  contactHelpGridSettings,
  contactHero,
  contactHeroSettings,
  contactLocation,
  contactLocationSettings,
  contactPurchaseInfoSettings,
  contactV2ModuleIds,
  contactV2Modules,
  contactWhatsappCtaSettings,
} from "./contact-v2";
import { getModuleDefinition, isModuleAvailableOnPage } from "./index";

const renderSection = catalogModernV2Store.sections[0];
if (!renderSection) throw new Error("Fixture sin sección para renderizar Contacto V2");

describe("Contacto V2 module contracts", () => {
  it("registra los ocho módulos independientes", () => {
    expect(contactV2Modules).toHaveLength(8);
    expect(contactV2ModuleIds).toEqual(
      new Set([
        "contact-hero",
        "contact-form",
        "contact-channels",
        "contact-help-grid",
        "contact-whatsapp-cta",
        "contact-purchase-info",
        "contact-faq",
        "contact-location",
      ]),
    );
  });

  it("restringe los módulos a Contacto V2 y conserva el newsletter compartido", () => {
    const hero = getModuleDefinition("contact-hero");
    const form = getModuleDefinition("contact-form");
    const channels = getModuleDefinition("contact-channels");
    const newsletter = getModuleDefinition("catalog-newsletter-cta");
    if (!hero || !form || !channels || !newsletter) throw new Error("Faltan módulos registrados");
    expect(isModuleAvailableOnPage(hero, "contact", "catalog-modern-v2")).toBe(true);
    expect(isModuleAvailableOnPage(hero, "home", "catalog-modern-v2")).toBe(false);
    expect(isModuleAvailableOnPage(form, "home", "catalog-modern-v2")).toBe(true);
    expect(isModuleAvailableOnPage(channels, "home", "catalog-modern-v2")).toBe(true);
    expect(isModuleAvailableOnPage(hero, "contact", "catalog-modern-v1")).toBe(false);
    expect(isModuleAvailableOnPage(newsletter, "contact", "catalog-modern-v2")).toBe(true);
  });

  it("aplica los defaults comerciales y los límites de repeaters", () => {
    expect(contactHeroSettings.parse({}).title).toBe("Estamos para ayudarte.");
    expect(contactHeroSettings.parse({}).imageAssetId).toBe("asset-contact-hero");
    expect(contactHeroSettings.parse({}).quickLinks).toHaveLength(0);
    expect(contactHelpGridSettings.parse({}).items).toHaveLength(4);
    expect(contactPurchaseInfoSettings.parse({}).items).toHaveLength(3);
    expect(contactFaqSettings.parse({}).items).toHaveLength(6);
    expect(contactChannelsSettings.parse({}).showWhatsapp).toBe(true);
    expect(contactFormSettings.parse({}).showOrderNumber).toBe(true);
    expect(contactWhatsappCtaSettings.parse({}).actionLabel).toBe("Iniciar conversación");
    expect(contactLocationSettings.parse({}).enabled).toBe(false);
    expect(
      contactHelpGridSettings.safeParse({ items: Array.from({ length: 5 }, () => ({})) }).success,
    ).toBe(false);
    expect(
      contactPurchaseInfoSettings.safeParse({ items: Array.from({ length: 4 }, () => ({})) })
        .success,
    ).toBe(false);
    expect(
      contactFaqSettings.safeParse({ items: Array.from({ length: 9 }, () => ({})) }).success,
    ).toBe(false);
  });

  it("renderiza el hero con accesos rápidos semánticos", () => {
    const settings = contactHeroSettings.parse({
      quickLinks: [
        {
          id: "quick-test",
          icon: "chat",
          title: "Acceso de prueba",
          body: "Texto de prueba",
          href: "#contact-form",
          actionLabel: "Consultar",
        },
      ],
    });
    const html = String(
      contactHero.render?.({
        project: catalogModernV2Store,
        section: renderSection,
        settings,
        pageType: "contact",
      }),
    );
    expect(html).toContain('data-solara-module="contact-hero"');
    expect(html).toContain("Estamos para");
    expect(html).toContain("ayudarte.");
    expect(html).toContain("Acceso de prueba");
    expect(html).toContain('data-motion-zone="items"');
    expect(html).toContain('class="catalog-hero-inner contact-hero"');
    expect(html).toContain('class="catalog-hero-media contact-hero-media"');
    expect(html).toContain('class="catalog-hero-background"');
    expect(html).toContain("catalog-hero-benefits--copy");
    expect(html).toContain("catalog-hero-benefits--band");
    expect(html).not.toContain("<video");
    expect(html).toContain("images.unsplash.com");
  });

  it("omite el contenedor de accesos rápidos cuando el hero no tiene enlaces", () => {
    const html = String(
      contactHero.render?.({
        project: catalogModernV2Store,
        section: renderSection,
        settings: contactHeroSettings.parse({}),
        pageType: "contact",
      }),
    );
    expect(html).not.toContain("contact-quick-links");
  });

  it("no renderiza ubicación desactivada ni deja markup vacío", () => {
    const settings = contactLocationSettings.parse({});
    const html = String(
      contactLocation.render?.({
        project: catalogModernV2Store,
        section: renderSection,
        settings,
        pageType: "contact",
      }),
    );
    expect(html).toBe("");
  });
});
