import { catalogModernV2Store } from "@solara/project-schema/catalog-modern-v2-fixture";
import { describe, expect, it } from "vitest";
import {
  contactChannels,
  contactChannelsSettings,
  contactForm,
  contactFormSettings,
  contactV2ModuleIds,
  contactV2Modules,
} from "./contact-v2";
import { getModuleDefinition, isModuleAvailableOnPage } from "./index";

const baseSection = catalogModernV2Store.sections[0];
if (!baseSection) throw new Error("Fixture sin sección para probar contacto en Home");

describe("Contacto en Home", () => {
  it("registra únicamente formulario y canales", () => {
    expect(contactV2Modules).toHaveLength(2);
    expect(contactV2ModuleIds).toEqual(new Set(["contact-form", "contact-channels"]));
  });

  it("expone ambos módulos sólo como secciones de Home", () => {
    const form = getModuleDefinition("contact-form");
    const channels = getModuleDefinition("contact-channels");
    if (!form || !channels) throw new Error("Faltan módulos de contacto en Home");
    expect(isModuleAvailableOnPage(form, "home", "catalog-modern-v2")).toBe(true);
    expect(isModuleAvailableOnPage(channels, "home", "catalog-modern-v2")).toBe(true);
  });

  it("mantiene los defaults comerciales del formulario", () => {
    const defaults = contactFormSettings.parse({});
    expect(defaults.showPhone).toBe(true);
    expect(defaults.reasonOptions.length).toBeGreaterThan(0);
    expect(defaults.emailActionLabel).toBe("Enviar por Email");
    expect(defaults.whatsappActionLabel).toBe("Enviar por WhatsApp");
    expect(contactFormSettings.safeParse({ reasonOptions: [] }).success).toBe(false);
    expect(contactChannelsSettings.parse({}).showWhatsapp).toBe(true);
  });

  it("renderiza el formulario accesible con email y WhatsApp", () => {
    const section = { ...baseSection, moduleId: "contact-form" as const };
    const html = String(
      contactForm.render?.({
        project: catalogModernV2Store,
        section,
        settings: contactFormSettings.parse({
          reasonOptions: [{ id: "catalog", label: "Catálogo" }],
        }),
        pageType: "home",
      }),
    );

    expect(html).toContain("data-solara-contact-form");
    expect(html).toContain(`data-contact-email="${catalogModernV2Store.identity.email}"`);
    expect(html).toContain('<option value="catalog"');
    expect(html).toContain('data-contact-channel="email"');
    expect(html).toContain('data-contact-channel="whatsapp"');
    expect(html).toContain("data-contact-status");
  });

  it("los canales enlazan al formulario de la página actual", () => {
    const section = { ...baseSection, moduleId: "contact-channels" as const };
    const html = String(
      contactChannels.render?.({
        project: catalogModernV2Store,
        section,
        settings: contactChannelsSettings.parse({}),
        pageType: "home",
      }),
    );
    expect(html).toContain('href="#contact-form"');
    expect(html).not.toContain("/contacto/");
  });
});
