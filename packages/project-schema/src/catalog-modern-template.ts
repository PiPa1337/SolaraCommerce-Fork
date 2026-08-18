import {
  aboutDefaultTeam,
  catalogModernV2EditorialAssets,
  defaultAboutV2Sections,
} from "./catalog-modern-about";
import {
  contactDefaultHelpItems,
  contactDefaultQuickLinks,
  defaultContactV2Sections,
  defaultHomeContactSections,
} from "./catalog-modern-contact";
import { catalogModernStore } from "./catalog-modern-fixture";
import { CATALOG_MODERN_GUIDANCE_VERSION } from "./catalog-modern-guidance";
import { type StoreProjectV1, type StoreProjectV2, StoreProjectV2Schema } from "./index";

/** Version of the guided Catalog Modern template. Increase only when its persisted shape changes. */
export const CATALOG_MODERN_TEMPLATE_VERSION = CATALOG_MODERN_GUIDANCE_VERSION;

function ensureCatalogModernV2Assets(project: StoreProjectV1): StoreProjectV1 {
  if (project.commerceTemplates.designFamily !== "catalog-modern-v2") return project;
  const existing = new Set(project.assets.map((asset) => asset.id));
  const missing = catalogModernV2EditorialAssets.filter((asset) => !existing.has(asset.id));
  if (missing.length === 0) return project;
  return {
    ...project,
    assets: [...project.assets, ...structuredClone(missing)],
  };
}

function ensureHomeContactV2Sections(project: StoreProjectV1): StoreProjectV1 {
  if (project.commerceTemplates.designFamily !== "catalog-modern-v2") return project;

  const defaults = defaultHomeContactSections();
  const existingModuleIds = new Set(project.sections.map((section) => section.moduleId));
  const missing = defaults.filter((section) => !existingModuleIds.has(section.moduleId));
  if (missing.length === 0) return project;

  const insertAt = project.sections.findIndex(
    (section) => section.slot === "cart" || section.slot === "footer",
  );
  const sections = [...project.sections];
  sections.splice(insertAt < 0 ? sections.length : insertAt, 0, ...missing);
  return { ...project, sections };
}

function hasDefaultContactItems(value: unknown, defaults: readonly unknown[]): boolean {
  if (!Array.isArray(value) || value.length !== defaults.length) return false;
  return value.every((item, index) => JSON.stringify(item) === JSON.stringify(defaults[index]));
}

function isDefaultContactHelpSection(
  section: StoreProjectV1["pages"][number]["sections"][number],
): boolean {
  return (
    section.id === "contact-section-help" &&
    section.moduleId === "contact-help-grid" &&
    section.settings.title === "¿En qué podemos ayudarte?" &&
    section.settings.body === "Elegí el tema para que podamos asistirte de la mejor manera." &&
    hasDefaultContactItems(section.settings.items, contactDefaultHelpItems)
  );
}

export function ensureContactV2Sections(project: StoreProjectV1): StoreProjectV1 {
  if (project.commerceTemplates.designFamily !== "catalog-modern-v2") return project;
  const withAssets = ensureCatalogModernV2Assets(project);
  const page = withAssets.pages.find((candidate) => candidate.kind === "contact");
  if (!page) return withAssets;
  if (page.sections.length > 0) {
    let changed = false;
    const sections = page.sections.flatMap((section) => {
      if (isDefaultContactHelpSection(section)) {
        changed = true;
        return [];
      }
      if (section.id !== "contact-section-hero" || section.moduleId !== "contact-hero") {
        return [section];
      }
      const settings = { ...section.settings };
      let sectionChanged = false;
      if (typeof settings.actionLabel !== "string") {
        settings.actionLabel = "Escribinos";
        sectionChanged = true;
      }
      if (typeof settings.actionHref !== "string") {
        settings.actionHref = "#contact-form";
        sectionChanged = true;
      }
      if (!settings.imageAssetId) {
        settings.imageAssetId = "asset-contact-hero";
        sectionChanged = true;
      }
      if (hasDefaultContactItems(settings.quickLinks, contactDefaultQuickLinks)) {
        settings.quickLinks = [];
        sectionChanged = true;
      }
      if (sectionChanged) changed = true;
      return [sectionChanged ? { ...section, settings } : section];
    });
    if (!changed) return withAssets;
    return {
      ...withAssets,
      pages: withAssets.pages.map((candidate) =>
        candidate.kind === "contact" ? { ...candidate, sections } : candidate,
      ),
    };
  }
  return {
    ...withAssets,
    pages: withAssets.pages.map((candidate) =>
      candidate.kind === "contact"
        ? { ...candidate, sections: defaultContactV2Sections() }
        : candidate,
    ),
  };
}

export function ensureAboutV2Sections(project: StoreProjectV1): StoreProjectV1 {
  if (project.commerceTemplates.designFamily !== "catalog-modern-v2") return project;
  const withAssets = ensureCatalogModernV2Assets(project);
  const page = withAssets.pages.find((candidate) => candidate.kind === "about");
  if (!page) return withAssets;
  if (page.sections.length > 0) {
    let changed = false;
    const sections = page.sections.map((section) => {
      if (section.moduleId === "about-hero" && section.id === "about-section-hero") {
        const settings = { ...section.settings };
        if (typeof settings.actionLabel !== "string") {
          settings.actionLabel = "Explorar selección";
          changed = true;
        }
        if (typeof settings.actionHref !== "string") {
          settings.actionHref = "/buscar/";
          changed = true;
        }
        if (!settings.imageAssetId) {
          settings.imageAssetId = "asset-about-hero";
          changed = true;
        }
        return changed ? { ...section, settings } : section;
      }
      if (
        section.moduleId === "about-editorial-image" &&
        section.id === "about-section-editorial-image" &&
        !section.settings.imageAssetId
      ) {
        changed = true;
        return {
          ...section,
          settings: { ...section.settings, imageAssetId: "asset-about-editorial" },
        };
      }
      if (
        section.moduleId === "about-team" &&
        section.id === "about-section-team" &&
        section.enabled === false &&
        section.settings.enabled === false &&
        Array.isArray(section.settings.items) &&
        section.settings.items.length === 0
      ) {
        changed = true;
        return {
          ...section,
          enabled: true,
          settings: {
            ...section.settings,
            enabled: true,
            items: structuredClone(aboutDefaultTeam),
          },
        };
      }
      return section;
    });
    if (!changed) return withAssets;
    return {
      ...withAssets,
      pages: withAssets.pages.map((candidate) =>
        candidate.kind === "about" ? { ...candidate, sections } : candidate,
      ),
    };
  }
  return {
    ...withAssets,
    pages: withAssets.pages.map((candidate) =>
      candidate.kind === "about" ? { ...candidate, sections: defaultAboutV2Sections() } : candidate,
    ),
  };
}

export function ensureCatalogModernV2Sections(project: StoreProjectV1): StoreProjectV1 {
  return ensureHomeContactV2Sections(ensureAboutV2Sections(ensureContactV2Sections(project)));
}

export type CatalogModernSeed = "clean" | "demo";

export interface BuildCatalogModernProjectOptions {
  seed: CatalogModernSeed;
  id?: string;
  name?: string;
  slug?: string;
  baseUrl?: string;
  brandName?: string;
}

function cleanProject(options: BuildCatalogModernProjectOptions): StoreProjectV2 {
  const name = options.name?.trim() || "Nueva tienda";
  const brandName = options.brandName?.trim() || name;
  const slug = options.slug || "nueva-tienda";
  // Base V2 construida localmente (sin importar el v2-fixture, que depende de
  // esta plantilla): trae designFamily v2, los assets de plantilla y las
  // páginas Nosotros/Contacto pobladas con los módulos V2 (editables en el
  // constructor) — mismo patrón que catalog-modern-v2-fixture.
  const project = ensureCatalogModernV2Sections({
    ...structuredClone(catalogModernStore),
    commerceTemplates: {
      ...catalogModernStore.commerceTemplates,
      designFamily: "catalog-modern-v2",
    },
  });
  const sections = project.sections.map((section) => {
    if (section.moduleId === "catalog-product-grid" && section.id.endsWith("-new")) {
      return {
        ...section,
        settings: {
          ...section.settings,
          title: "Productos",
          source: "all",
          sourceId: "",
          limit: 12,
          viewAllHref: "/buscar/",
        },
      };
    }
    if (
      section.moduleId === "catalog-product-grid" ||
      section.moduleId === "catalog-category-bento" ||
      section.moduleId === "catalog-testimonials"
    ) {
      return { ...section, enabled: false };
    }
    if (section.moduleId === "catalog-hero") {
      return {
        ...section,
        settings: {
          ...section.settings,
          eyebrow: "Tu nueva colección",
          title: "Una tienda lista para contar tu historia.",
          body: "Cargá tus productos, imágenes y textos para empezar a vender.",
          actionLabel: "Abrir búsqueda",
          actionHref: "/buscar/",
          secondaryActionLabel: "Conocé la marca",
          secondaryActionHref: "/nosotros/",
        },
      };
    }
    if (section.moduleId === "catalog-announcement") {
      return {
        ...section,
        settings: { ...section.settings, text: "Tu tienda online, lista para empezar." },
      };
    }
    if (section.moduleId === "catalog-newsletter-cta") {
      return {
        ...section,
        settings: {
          ...section.settings,
          title: "Hacé crecer tu catálogo",
          body: "Cuando estés listo, compartí tu tienda y recibí pedidos por WhatsApp.",
          actionLabel: "Configurar contacto",
          actionHref: "/contacto/",
        },
      };
    }
    if (section.moduleId === "catalog-footer") {
      return {
        ...section,
        settings: {
          ...section.settings,
          note: "Una tienda clara para que tus productos encuentren a su gente.",
        },
      };
    }
    return section;
  });

  const clean = StoreProjectV2Schema.parse({
    ...project,
    id: options.id || "store-catalog-modern-clean",
    name,
    slug,
    baseUrl: options.baseUrl || `https://${slug}.example`,
    origin: {
      templateId: "catalog-modern",
      templateVersion: CATALOG_MODERN_TEMPLATE_VERSION,
      seed: "clean",
    },
    identity: {
      ...project.identity,
      legalName: brandName,
      brandName,
      description: "Una tienda online preparada para mostrar tus productos.",
      email: "",
      phone: "",
      address: "",
    },
    whatsapp: {
      ...project.whatsapp,
      phone: "5491100000000",
      greeting: `Hola ${brandName}, quiero hacer este pedido:`,
    },
    seo: {
      ...project.seo,
      title: brandName,
      description: "Descubrí nuestra selección de productos y escribinos para coordinar tu pedido.",
      searchConsoleVerification: "",
      merchantVerification: "",
    },
    assets: project.assets.map((asset) => ({
      ...asset,
      name: "Imagen de plantilla",
      alt: "Imagen de ejemplo para reemplazar",
    })),
    navigation: {
      ...project.navigation,
      mode: "automatic",
      catalogLabel: "Categorías",
      items: [],
    },
    pages: project.pages.map((page) => ({
      ...page,
      title:
        page.kind === "about"
          ? "Conocé nuestra historia."
          : page.kind === "contact"
            ? "Estamos para ayudarte."
            : "Una tienda hecha para tu marca.",
      seoTitle: `${page.kind === "home" ? brandName : `${page.kind === "about" ? "Nosotros" : "Contacto"} | ${brandName}`}`,
      seoDescription:
        page.kind === "about"
          ? "Conocé la historia y los valores detrás de nuestra marca."
          : page.kind === "contact"
            ? "Encontrá nuestros canales de contacto y escribinos por WhatsApp."
            : "Descubrí nuestros productos y novedades.",
    })),
    products: [],
    categories: [],
    collections: [],
    sections,
  });
  return clean;
}

export function buildCatalogModernProject(
  options: BuildCatalogModernProjectOptions,
): StoreProjectV2 {
  if (options.seed === "clean") return cleanProject(options);
  const project = structuredClone(catalogModernStore);
  return StoreProjectV2Schema.parse({
    ...project,
    ...(options.id ? { id: options.id } : {}),
    ...(options.name ? { name: options.name } : {}),
    ...(options.slug ? { slug: options.slug } : {}),
    ...(options.baseUrl ? { baseUrl: options.baseUrl } : {}),
    origin: {
      templateId: "catalog-modern",
      templateVersion: CATALOG_MODERN_TEMPLATE_VERSION,
      seed: "demo",
    },
  });
}

export const catalogModernCleanStore = buildCatalogModernProject({ seed: "clean" });
