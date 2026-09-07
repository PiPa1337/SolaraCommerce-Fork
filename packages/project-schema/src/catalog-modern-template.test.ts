import { describe, expect, it } from "vitest";
import { catalogModernStore } from "./catalog-modern-fixture";
import {
  buildCatalogModernProject,
  CATALOG_MODERN_TEMPLATE_VERSION,
  catalogModernCleanStore,
  ensureCatalogModernV2Sections,
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
    expect(catalogModernCleanStore.navigation.mode).toBe("automatic");
    expect(catalogModernCleanStore.sections.some((section) => section.enabled)).toBe(true);
    expect(catalogModernCleanStore.identity.email).toBe("");
    expect(catalogModernCleanStore.identity.phone).toBe("");
    expect(catalogModernCleanStore.identity.address).toBe("");
    expect(catalogModernCleanStore.whatsapp.phone).toBe("");
  });

  it("desactiva el appear del CTA de novedades desde motion declarativo", () => {
    const legacy = structuredClone(catalogModernV2Store);
    const newsletter = legacy.sections.find(
      (section) => section.moduleId === "catalog-newsletter-cta",
    );
    if (!newsletter) throw new Error("Fixture V2 sin CTA de novedades");
    newsletter.motion = { ...newsletter.motion, preset: "fade-up" };

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
  });

  it("mantiene Contacto sólo como dos secciones de Home", () => {
    const project = structuredClone(catalogModernV2Store);
    project.sections = project.sections.filter(
      (section) => !["contact-form", "contact-channels"].includes(section.moduleId),
    );

    const normalized = ensureCatalogModernV2Sections(project);
    const moduleIds = normalized.sections.map((section) => section.moduleId);
    const formIndex = moduleIds.indexOf("contact-form");
    const channelsIndex = moduleIds.indexOf("contact-channels");
    const cartIndex = moduleIds.indexOf("catalog-cart-drawer");

    expect(normalized.pages.map((page) => page.kind)).toEqual(["home"]);
    expect(formIndex).toBeGreaterThan(-1);
    expect(channelsIndex).toBe(formIndex + 1);
    expect(cartIndex).toBeGreaterThan(channelsIndex);
    expect(ensureCatalogModernV2Sections(normalized)).toEqual(normalized);
  });

  it("normaliza enlaces heredados hacia la sección de contacto de Home", () => {
    const legacy = structuredClone(catalogModernV2Store);
    const hero = legacy.sections.find((section) => section.moduleId === "catalog-hero");
    const newsletter = legacy.sections.find(
      (section) => section.moduleId === "catalog-newsletter-cta",
    );
    if (!hero || !newsletter) throw new Error("Fixture V2 sin CTAs esperados");
    hero.settings.secondaryActionHref = "/nosotros/";
    newsletter.settings.actionHref = "/contacto/";

    const normalized = ensureCatalogModernV2Sections(legacy);
    expect(
      normalized.sections.find((section) => section.moduleId === "catalog-hero")?.settings
        .secondaryActionHref,
    ).toBe("#contact-form");
    expect(
      normalized.sections.find((section) => section.moduleId === "catalog-newsletter-cta")?.settings
        .actionHref,
    ).toBe("#contact-form");
  });

  it("no modifica la familia V1", () => {
    const v1 = structuredClone(catalogModernStore);
    expect(ensureCatalogModernV2Sections(v1)).toEqual(v1);
  });
});
