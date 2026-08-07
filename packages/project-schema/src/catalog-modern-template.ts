import { catalogModernStore } from "./catalog-modern-fixture";
import { CATALOG_MODERN_GUIDANCE_VERSION } from "./catalog-modern-guidance";
import { type StoreProjectV2, StoreProjectV2Schema, type StoreSection } from "./index";

/** Version of the guided Catalog Modern template. Increase only when its persisted shape changes. */
export const CATALOG_MODERN_TEMPLATE_VERSION = CATALOG_MODERN_GUIDANCE_VERSION;

export type CatalogModernSeed = "clean" | "demo" | "revamp";

export interface BuildCatalogModernProjectOptions {
  seed: CatalogModernSeed;
  id?: string;
  name?: string;
  slug?: string;
  baseUrl?: string;
  brandName?: string;
}

const REVAMP_OVERSHOOT_EASING = "cubic-bezier(.34,1.56,.64,1)";

const revampBaseMotion: StoreSection["motion"] = {
  preset: "fade-up",
  intensity: 4,
  direction: "up",
  distance: 16,
  duration: 0.45,
  delay: 0,
  stagger: 0,
  easing: "cubic-bezier(.16,1,.3,1)",
  entryPoint: 0.2,
  once: true,
};

type RevampMotion = StoreSection["motion"];

const REVAMP_MOTION_OVERRIDES: Record<string, RevampMotion> = {
  "catalog-hero": {
    ...revampBaseMotion,
    preset: "layer-stack",
    distance: 24,
    duration: 0.6,
    easing: REVAMP_OVERSHOOT_EASING,
  },
  "catalog-product-grid": {
    ...revampBaseMotion,
    preset: "stagger",
    distance: 20,
    stagger: 0.07,
  },
  "catalog-category-bento": {
    ...revampBaseMotion,
    preset: "scale",
    distance: 0,
    duration: 0.5,
  },
  "catalog-testimonials": {
    ...revampBaseMotion,
    preset: "fade-up",
    distance: 22,
  },
  "catalog-brand-strip": {
    ...revampBaseMotion,
    preset: "fade",
    duration: 0.4,
  },
};

function cleanProject(options: BuildCatalogModernProjectOptions): StoreProjectV2 {
  const name = options.name?.trim() || "Nueva tienda";
  const brandName = options.brandName?.trim() || name;
  const slug = options.slug || "nueva-tienda";
  const project = structuredClone(catalogModernStore);
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

  return StoreProjectV2Schema.parse({
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
}

export function buildCatalogModernProject(
  options: BuildCatalogModernProjectOptions,
): StoreProjectV2 {
  if (options.seed === "clean") return cleanProject(options);
  const project = structuredClone(catalogModernStore);
  const sections =
    options.seed === "revamp"
      ? project.sections.map((section) => ({
          ...section,
          motion: { ...(REVAMP_MOTION_OVERRIDES[section.moduleId] ?? revampBaseMotion) },
        }))
      : project.sections;
  return StoreProjectV2Schema.parse({
    ...project,
    ...(options.id ? { id: options.id } : {}),
    ...(options.name ? { name: options.name } : {}),
    ...(options.slug ? { slug: options.slug } : {}),
    ...(options.baseUrl ? { baseUrl: options.baseUrl } : {}),
    origin: {
      templateId: "catalog-modern",
      templateVersion: CATALOG_MODERN_TEMPLATE_VERSION,
      seed: options.seed,
    },
    sections,
  });
}

export const catalogModernCleanStore = buildCatalogModernProject({ seed: "clean" });
