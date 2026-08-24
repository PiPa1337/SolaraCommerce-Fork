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

const CLEAN_TEMPLATE_IMAGE_SOURCE =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1200' height='900' viewBox='0 0 1200 900'%3E%3Crect width='1200' height='900' fill='%23e8e8e3'/%3E%3Cpath d='M0 700 280 470l170 130 210-250 540 350v200H0z' fill='%23d2d2cb'/%3E%3C/svg%3E";

/** Version of the guided Catalog Modern template. Increase only when its persisted shape changes. */
export const CATALOG_MODERN_TEMPLATE_VERSION = CATALOG_MODERN_GUIDANCE_VERSION;

/** Reemplaza textos heredados de una fixture sin tocar claves ni la forma del proyecto. */
export function replaceCatalogBrandText<T>(value: T, source: string, target: string): T {
  if (!source || source === target) return value;
  if (typeof value === "string") return value.split(source).join(target) as T;
  if (Array.isArray(value)) {
    return value.map((item) => replaceCatalogBrandText(item, source, target)) as T;
  }
  if (typeof value !== "object" || value === null) return value;
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [
      key,
      replaceCatalogBrandText(item, source, target),
    ]),
  ) as T;
}

function ensureCatalogModernV2Assets(project: StoreProjectV1): StoreProjectV1 {
  if (project.commerceTemplates.designFamily !== "catalog-modern-v2") return project;
  if (!project.pages.some((page) => page.kind === "about" || page.kind === "contact")) {
    return project;
  }
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

function ensureHomeV2ContactLinks(project: StoreProjectV1): StoreProjectV1 {
  if (project.commerceTemplates.designFamily !== "catalog-modern-v2") return project;

  let changed = false;
  const sections = project.sections.map((section) => {
    const settings = { ...section.settings };
    let sectionChanged = false;
    if (
      section.moduleId === "catalog-hero" &&
      typeof settings.secondaryActionHref === "string" &&
      /^\/nosotros\/?$/i.test(settings.secondaryActionHref)
    ) {
      settings.secondaryActionHref = "#contact-form";
      sectionChanged = true;
    }
    if (
      section.moduleId === "catalog-newsletter-cta" &&
      typeof settings.actionHref === "string" &&
      /^\/contacto\/?$/i.test(settings.actionHref)
    ) {
      settings.actionHref = "#contact-form";
      sectionChanged = true;
    }
    if (sectionChanged) changed = true;
    return sectionChanged ? { ...section, settings } : section;
  });
  return changed ? { ...project, sections } : project;
}

function ensureHomeV2Navigation(project: StoreProjectV1): StoreProjectV1 {
  if (
    project.commerceTemplates.designFamily !== "catalog-modern-v2" ||
    (!project.navigation.showContact && !project.navigation.showAbout)
  ) {
    return project;
  }
  return {
    ...project,
    navigation: { ...project.navigation, showContact: false, showAbout: false },
  };
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
  return ensureHomeV2Navigation(
    ensureHomeV2ContactLinks(
      ensureHomeContactV2Sections(ensureAboutV2Sections(ensureContactV2Sections(project))),
    ),
  );
}

export type CatalogModernSeed = "clean" | "demo" | "placeholder";

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
  // esta plantilla): trae designFamily v2 y la estructura de Home. Las páginas
  // editoriales y sus imágenes sólo viven en los fixtures de desarrollo.
  const project = replaceCatalogBrandText(
    ensureCatalogModernV2Sections({
      ...structuredClone(catalogModernStore),
      commerceTemplates: {
        ...catalogModernStore.commerceTemplates,
        designFamily: "catalog-modern-v2",
      },
    }),
    catalogModernStore.identity.brandName,
    brandName,
  );
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
          secondaryActionHref: "#contact-form",
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
          actionHref: "#contact-form",
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
      role: "store",
      updatePolicy: "managed",
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
      // Una tienda limpia no tiene un número configurado. El sentinel
      // histórico se conserva sólo para migrar respaldos antiguos; no debe
      // volver a persistirse porque puede confundirse con un número real.
      phone: "",
      greeting: `Hola ${brandName}, quiero hacer este pedido:`,
    },
    seo: {
      ...project.seo,
      title: brandName,
      description: "Descubrí nuestra selección de productos y escribinos para coordinar tu pedido.",
      searchConsoleVerification: "",
      merchantVerification: "",
    },
    assets: project.assets
      .filter((asset) => !/^asset-(?:about|contact)-/i.test(asset.id))
      .map((asset) => ({
        ...asset,
        name: "Imagen de plantilla",
        alt: "Imagen de ejemplo para reemplazar",
        source: CLEAN_TEMPLATE_IMAGE_SOURCE,
        fallbackSource: undefined,
        responsiveSources: undefined,
        hash: `template-${asset.id}`,
      })),
    navigation: {
      ...project.navigation,
      mode: "automatic",
      catalogLabel: "Categorías",
      items: [],
      showContact: false,
      showAbout: false,
    },
    pages: project.pages
      .filter((page) => page.kind === "home")
      .map((page) => ({
        ...page,
        title: "Una tienda hecha para tu marca.",
        seoTitle: brandName,
        seoDescription: "Descubrí nuestros productos y novedades.",
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
  /**
   * Plantilla placeholder: tienda base V2 con 5 productos genericos, 2
   * categorias y textos instructivos. Es la base para generar tiendas nuevas:
   * el usuario reemplaza los placeholders sin tener que borrar contenido demo.
   */
  function placeholderProject(options: BuildCatalogModernProjectOptions): StoreProjectV2 {
    const name = options.name?.trim() || "Predeterminado";
    const brandName = options.brandName?.trim() || "Mi tienda";
    const slug = options.slug || "predeterminado";
    // Base clean ya trae designFamily v2, secciones V2 y imagen placeholder SVG.
    const project = replaceCatalogBrandText(
      ensureCatalogModernV2Sections({
        ...structuredClone(catalogModernStore),
        commerceTemplates: {
          ...catalogModernStore.commerceTemplates,
          designFamily: "catalog-modern-v2",
        },
      }),
      catalogModernStore.identity.brandName,
      brandName,
    );

    // Assets placeholder compartido (SVG gris del template, cero peso).
    const placeholderAsset = { ...project.assets[0] };
    const assets = [placeholderAsset];

    const products = Array.from({ length: 5 }, (_, index) => ({
      id: `product-placeholder-${index + 1}`,
      slug: `producto-${index + 1}`,
      title: `Producto ${index + 1}`,
      description: `Descripcion del producto ${index + 1}.`,
      status: "active" as const,
      brand: brandName,
      categoryIds: [`category-placeholder-${(index % 2) + 1}`],
      collectionIds: ["collection-placeholder-1"],
      tags: [],
      imageIds: [placeholderAsset.id],
      variants: [
        {
          id: `variant-placeholder-${index + 1}`,
          title: "Unica",
          price: 1000,
          available: true,
          optionValues: {},
          sku: `P${index + 1}`,
          stockStatus: "in_stock" as const,
        },
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }));
    const categories = Array.from({ length: 2 }, (_, index) => ({
      id: `category-placeholder-${index + 1}`,
      slug: `categoria-${index + 1}`,
      title: `Categoria ${index + 1}`,
      description: `Descripcion de la categoria ${index + 1}.`,
      parentId: undefined,
      productIds: products
        .filter((p) => p.categoryIds.includes(`category-placeholder-${index + 1}`))
        .map((p) => p.id),
      imageId: placeholderAsset.id,
    }));
    const collections = [
      {
        id: "collection-placeholder-1",
        slug: "coleccion-1",
        title: "Coleccion 1",
        description: "Descripcion de la coleccion 1.",
        productIds: products.map((p) => p.id),
        imageId: placeholderAsset.id,
      },
    ];

    const sections = project.sections.map((section) => {
      if (section.moduleId === "catalog-hero") {
        return {
          ...section,
          settings: {
            ...section.settings,
            eyebrow: "Nueva tienda",
            title: "Titulo del hero",
            body: "Subtitulo del hero: contá qué vendés.",
            actionLabel: "Ver productos",
            actionHref: "/buscar/",
            secondaryActionLabel: "Contacto",
            secondaryActionHref: "#contact-form",
          },
        };
      }
      if (section.moduleId === "catalog-announcement")
        return {
          ...section,
          settings: {
            ...section.settings,
            text: "Texto de anuncio editable",
            linkLabel: "",
            linkHref: "",
          },
        };
      if (section.moduleId === "catalog-product-grid" && section.id.endsWith("-new")) {
        return {
          ...section,
          settings: {
            ...section.settings,
            title: "Productos",
            source: "collection",
            sourceId: "collection-placeholder-1",
            limit: 5,
            viewAllHref: "/buscar/",
          },
        };
      }
      if (section.moduleId === "catalog-category-bento")
        return {
          ...section,
          enabled: true,
          settings: { ...section.settings, title: "Categorias", items: [] },
        };
      if (section.moduleId === "catalog-brand-strip") return { ...section, enabled: false };
      if (section.moduleId === "catalog-product-grid" && section.id.endsWith("-top"))
        return { ...section, enabled: false };
      if (section.moduleId === "catalog-testimonials")
        return { ...section, enabled: false, settings: { ...section.settings, items: [] } };
      if (section.moduleId === "catalog-newsletter-cta")
        return {
          ...section,
          settings: {
            ...section.settings,
            title: "Novedades",
            body: "Seccion de novedades editable.",
            actionLabel: "Contacto",
            actionHref: "#contact-form",
          },
        };
      if (section.moduleId === "catalog-footer")
        return { ...section, settings: { ...section.settings, note: "Nota del pie editable." } };
      return section;
    });

    const pages = project.pages
      .filter((page) => page.kind === "home")
      .map((page) => ({ ...page, title: "Titulo del hero" }));

    return StoreProjectV2Schema.parse({
      ...project,
      id: options.id || "store-predeterminado-base",
      name,
      slug,
      baseUrl: options.baseUrl || `https://${slug}.example`,
      origin: {
        templateId: "catalog-modern",
        templateVersion: CATALOG_MODERN_TEMPLATE_VERSION,
        seed: "placeholder",
        role: "base-template",
        updatePolicy: "pinned",
      },
      identity: {
        ...project.identity,
        legalName: brandName,
        brandName,
        description: "Descripcion corta de tu tienda.",
        email: "",
        phone: "",
        address: "",
      },
      whatsapp: {
        ...project.whatsapp,
        phone: "5491100000000",
        greeting: `Hola ${brandName}, quiero hacer este pedido:`,
      },
      seo: { ...project.seo, title: brandName, description: "Descripcion SEO de tu tienda." },
      navigation: { ...project.navigation, mode: "automatic" as const, items: [] },
      assets,
      products,
      categories,
      collections,
      pages,
      sections,
    });
  }
  if (options.seed === "clean") return cleanProject(options);
  if (options.seed === "placeholder") return placeholderProject(options);
  const project = options.brandName?.trim()
    ? replaceCatalogBrandText(
        structuredClone(catalogModernStore),
        catalogModernStore.identity.brandName,
        options.brandName.trim(),
      )
    : structuredClone(catalogModernStore);
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
      role: "base-template",
      updatePolicy: "pinned",
    },
  });
}

export const catalogModernCleanStore = buildCatalogModernProject({ seed: "clean" });
