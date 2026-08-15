import { CATALOG_MODERN_GUIDANCE_VERSION } from "./catalog-modern-guidance";
import { StoreProjectV2Schema } from "./index";
import { catalogScaleStore } from "./scale-fixture";

const fixedDate = "2026-07-29T12:00:00.000Z";

const rootDefinitions = [
  ["remeras", "Remeras", "Prendas esenciales y gráficas para todos los días."],
  ["camisas", "Camisas", "Cortes livianos para vestir con facilidad."],
  ["pantalones", "Pantalones", "Jeans, sastrería y siluetas cómodas."],
  ["abrigos", "Abrigos", "Capas para acompañar cada temporada."],
  ["vestidos", "Vestidos", "Una pieza, muchas formas de llevarla."],
  ["tejidos", "Tejidos", "Texturas suaves para días tranquilos."],
  ["calzado", "Calzado", "Piezas cómodas para moverte."],
  ["accesorios", "Accesorios", "Detalles que completan tu manera de vestir."],
] as const;

const childDefinitions = [
  [
    "remeras",
    [
      ["basicas", "Básicas"],
      ["graficas", "Gráficas"],
      ["manga-larga", "Manga larga"],
    ],
  ],
  [
    "pantalones",
    [
      ["jeans", "Jeans"],
      ["sastreros", "Sastreros"],
      ["shorts", "Shorts"],
    ],
  ],
] as const;

const roots = rootDefinitions.map(([slug, title, description]) => ({
  id: `category-${slug}`,
  slug,
  title,
  description,
  productIds: [] as string[],
}));

const children = childDefinitions.flatMap(([parentSlug, definitions]) =>
  definitions.map(([slug, title]) => ({
    id: `category-${slug}`,
    slug,
    title,
    description: `${title} de Modo Sur para combinar sin esfuerzo.`,
    parentId: `category-${parentSlug}`,
    imageId: "asset-manta",
    productIds: [] as string[],
  })),
);

const categories = [...roots, ...children];
const primaryRoots = [
  "remeras",
  "camisas",
  "pantalones",
  "abrigos",
  "vestidos",
  "tejidos",
  "calzado",
  "accesorios",
];
const imageIds = ["asset-manta", "asset-jarra", "asset-modo-camisa"] as const;
const brands = ["Modo Sur", "Línea Norte", "Taller del Río", "Estudio Liso", "Bruma"];
const productNames = [
  "Remera esencial de algodón",
  "Remera gráfica Horizonte",
  "Remera manga larga Base",
  "Camisa Oxford liviana",
  "Camisa Rayas Finas",
  "Pantalón jean Recto",
  "Pantalón sastrero Nube",
  "Short de verano Sal",
  "Campera liviana Sendero",
  "Abrigo corto Umbral",
  "Vestido midi Alba",
  "Vestido cruzado Línea",
  "Tejido cuello redondo Sur",
  "Cardigan Punto",
  "Buzo amplio Parque",
  "Zapatilla Urbana",
  "Botín bajo Tierra",
  "Mocasín Trama",
  "Gorra Visera",
  "Cinturón Cuero",
  "Cartera pequeña Río",
  "Bolso diario Norte",
  "Pañuelo Bruma",
  "Medias Rib",
  "Remera básica Crudo",
  "Remera gráfica Ruta",
  "Camisa lino Claro",
  "Camisa manga corta Costa",
  "Jean wide leg Azul",
  "Pantalón cargo Piedra",
  "Campera denim Oeste",
  "Tapado liviano Gris",
  "Vestido largo Calma",
  "Tejido rayado Cauce",
  "Chaleco punto Arena",
  "Zapatilla lona Blanca",
  "Sandalia plana Sal",
  "Riñonera compacta",
  "Gorro tejido Invierno",
  "Bufanda suave",
  "Remera esencial Negra",
  "Camisa clásica Blanca",
  "Jean recto Negro",
  "Pantalón corto Arena",
  "Campera quilted",
  "Vestido punto Noche",
  "Sweater cuello alto",
  "Bolso pequeño Liso",
  "Cinturón hebilla",
  "Pañuelo gráfico",
] as const;

function optionVariants(productNumber: number, imageId: string) {
  const basePrice = 2800000 + productNumber * 85000;
  if (productNumber === 1) {
    return [
      ["Negro", "S"],
      ["Negro", "M"],
      ["Negro", "L"],
      ["Negro", "XL"],
      ["Arena", "S"],
      ["Arena", "M"],
      ["Arena", "L"],
      ["Arena", "XL"],
    ].map(([colorValue, sizeValue], index) => {
      const color = colorValue ?? "Negro";
      const size = sizeValue ?? "M";
      return {
        id: `modo-variant-${String(productNumber).padStart(2, "0")}-${String(index + 1).padStart(2, "0")}`,
        sku: `MS-${String(productNumber).padStart(3, "0")}-${color.slice(0, 2).toUpperCase()}-${size}`,
        title: `${color} / ${size}`,
        optionValues: { Color: color, Talle: size },
        price: basePrice,
        compareAtPrice: basePrice + 650000,
        available: !(color === "Arena" && size === "XL"),
        stockStatus:
          color === "Arena" && size === "XL" ? ("out_of_stock" as const) : ("in_stock" as const),
        imageId,
      };
    });
  }
  if (productNumber <= 4) {
    return ["Negro", "Arena"].map((color, index) => ({
      id: `modo-variant-${String(productNumber).padStart(2, "0")}-${index + 1}`,
      sku: `MS-${String(productNumber).padStart(3, "0")}-${color.slice(0, 2).toUpperCase()}`,
      title: color,
      optionValues: { Color: color },
      price: basePrice + index * 120000,
      compareAtPrice: productNumber % 2 === 0 ? basePrice + 450000 : undefined,
      available: true,
      stockStatus: "in_stock" as const,
      imageId,
    }));
  }
  return [
    {
      id: `modo-variant-${String(productNumber).padStart(2, "0")}-1`,
      sku: `MS-${String(productNumber).padStart(3, "0")}`,
      title: "Único",
      optionValues: { Talle: "Único" },
      price: basePrice,
      compareAtPrice: productNumber % 4 === 0 ? basePrice + 400000 : undefined,
      available: productNumber !== 47,
      stockStatus: productNumber === 47 ? ("out_of_stock" as const) : ("in_stock" as const),
      imageId,
    },
  ];
}

const reviewSeeds = [
  {
    authorName: "Sof\u00eda M.",
    body: "La prenda lleg\u00f3 r\u00e1pido y el calce es tal como se ve\u00eda. La uso much\u00edsimo.",
    rating: 5,
  },
  {
    authorName: "Juli\u00e1n R.",
    body: "Buen material, colores f\u00e1ciles de combinar y una atenci\u00f3n muy clara.",
    rating: 4,
  },
  {
    authorName: "Clara P.",
    body: "La textura se siente muy bien y el tama\u00f1o coincide con la gu\u00eda.",
    rating: 5,
  },
  {
    authorName: "Mart\u00edn L.",
    body: "Una pieza vers\u00e1til para todos los d\u00edas. Volver\u00eda a elegirla.",
    rating: 4,
  },
  {
    authorName: "Valentina C.",
    body: "Lleg\u00f3 muy bien presentada y el color es igual al de las fotos.",
    rating: 5,
  },
  {
    authorName: "Nicol\u00e1s G.",
    body: "C\u00f3moda, liviana y f\u00e1cil de combinar. La recomiendo.",
    rating: 5,
  },
] as const;

const products = productNames.map((title, index) => {
  const productNumber = index + 1;
  const rootSlug = primaryRoots[index % primaryRoots.length] ?? primaryRoots[0] ?? "remeras";
  const childCategory =
    rootSlug === "remeras"
      ? ["basicas", "graficas", "manga-larga"][index % 3]
      : rootSlug === "pantalones"
        ? ["jeans", "sastreros", "shorts"][index % 3]
        : undefined;
  const categoryIds = [`category-${childCategory ?? rootSlug}`];
  const imageId = imageIds[index % imageIds.length] ?? imageIds[0];
  const reviews =
    productNumber <= 6
      ? reviewSeeds.map((review, reviewIndex) => ({
          ...review,
          id: `modo-review-${productNumber}-${reviewIndex + 1}`,
          publishedAt: fixedDate,
          verifiedPurchase: reviewIndex % 2 === 0,
          origin: "example" as const,
          visible: true,
        }))
      : undefined;
  return {
    id: `modo-product-${String(productNumber).padStart(2, "0")}`,
    slug: title
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, ""),
    title,
    description: `Una prenda de ${brands[index % brands.length]} pensada para usar y volver a elegir.`,
    status: "active" as const,
    brand: brands[index % brands.length],
    categoryIds,
    collectionIds: [
      index < 12
        ? "collection-recien-llegados"
        : index < 20
          ? "collection-mas-elegidos"
          : "collection-esenciales",
      ...(productNumber % 7 === 0 ? ["collection-fin-de-temporada"] : []),
    ],
    tags: [rootSlug, index % 2 === 0 ? "urbano" : "esencial", index % 3 === 0 ? "nuevo" : "diario"],
    imageIds: [
      imageId,
      imageIds[(index + 1) % imageIds.length] ?? imageId,
      imageIds[(index + 2) % imageIds.length] ?? imageId,
    ],
    variants: optionVariants(productNumber, imageId),
    ...(reviews ? { reviews } : {}),
    createdAt: fixedDate,
    updatedAt: fixedDate,
  };
});

function categoryProductIds(categoryId: string): string[] {
  const scope = new Set([
    categoryId,
    ...categories
      .filter((item) => "parentId" in item && item.parentId === categoryId)
      .map((item) => item.id),
  ]);
  return products
    .filter((product) => product.categoryIds.some((id) => scope.has(id)))
    .map((product) => product.id);
}

// El pool de imágenes del store moderno tiene 4 assets para 8 categorías
// raíz: la asignación es explícita y curada, nunca automática. Las tres con
// asset claro usan la imagen de su producto representativo (remera, camisa,
// jean); el resto resuelve de forma determinista la primera imagen de su
// primer producto en el momento de construir las categorías finales.
const rootCategoryImageIds: Partial<Record<string, string>> = {
  "category-remeras": "asset-manta",
  "category-camisas": "asset-modo-camisa",
  "category-pantalones": "asset-jarra",
};

function firstCategoryProductImage(categoryId: string): string {
  const firstProductId = categoryProductIds(categoryId)[0];
  return products.find((product) => product.id === firstProductId)?.imageIds[0] ?? "";
}

const finalizedCategories = categories.map((category) => ({
  ...category,
  ...("parentId" in category
    ? {}
    : { imageId: rootCategoryImageIds[category.id] ?? firstCategoryProductImage(category.id) }),
  productIds: categoryProductIds(category.id),
}));
const navigationItems = roots.map(({ slug, title }) => ({
  id: `modo-nav-${slug}`,
  label: title,
  href: `/categorias/${slug}/`,
  ...(slug === "remeras" || slug === "pantalones"
    ? {
        children: children
          .filter((child) => child.parentId === `category-${slug}`)
          .map((child) => ({
            id: `modo-nav-${child.slug}`,
            label: child.title,
            href: `/categorias/${child.slug}/`,
          })),
      }
    : {}),
}));

const motion = (preset: "none" | "fade-up" | "stagger") => ({
  preset,
  intensity: preset === "none" ? 0 : 4,
  direction: "up" as const,
  distance: preset === "none" ? 0 : 18,
  duration: preset === "none" ? 0 : 0.45,
  delay: 0,
  stagger: preset === "stagger" ? 0.05 : 0,
  easing: "cubic-bezier(.16,1,.3,1)",
  entryPoint: 0.2,
  once: true,
});

const catalogModernAssets = [
  {
    kind: "image" as const,
    id: "asset-hero",
    name: "Campaña Modo Sur",
    alt: "Dos personas con prendas negras de Modo Sur frente a una pared clara",
    mimeType: "image/png",
    source: "/fixtures/modo-sur-hero.png",
    width: 1536,
    height: 1024,
    hash: "fixture-modo-sur-hero",
  },
  {
    kind: "image" as const,
    id: "asset-manta",
    name: "Remera esencial negra",
    alt: "Remera negra de algodón sobre fondo gris claro",
    mimeType: "image/png",
    source: "/fixtures/modo-sur-remera.png",
    width: 1254,
    height: 1254,
    hash: "fixture-modo-sur-remera",
  },
  {
    kind: "image" as const,
    id: "asset-jarra",
    name: "Jean recto azul",
    alt: "Jean recto azul sobre fondo gris claro",
    mimeType: "image/png",
    source: "/fixtures/modo-sur-jean.png",
    width: 1254,
    height: 1254,
    hash: "fixture-modo-sur-jean",
  },
  {
    kind: "image" as const,
    id: "asset-modo-camisa",
    name: "Camisa a cuadros",
    alt: "Camisa a cuadros roja y azul sobre fondo gris claro",
    mimeType: "image/png",
    source: "/fixtures/modo-sur-camisa.png",
    width: 1254,
    height: 1254,
    hash: "fixture-modo-sur-camisa",
  },
] as const;

export const catalogModernStore = StoreProjectV2Schema.parse({
  ...structuredClone(catalogScaleStore),
  id: "store-modo-sur",
  name: "Modo Sur",
  slug: "modo-sur",
  baseUrl: "https://modo-sur.example",
  createdAt: fixedDate,
  updatedAt: fixedDate,
  origin: {
    templateId: "catalog-modern",
    templateVersion: CATALOG_MODERN_GUIDANCE_VERSION,
    seed: "demo",
  },
  identity: {
    legalName: "Modo Sur Estudio SRL",
    brandName: "Modo Sur",
    description: "Indumentaria y accesorios elegidos para acompañar tu forma de moverte.",
    email: "hola@modo-sur.example",
    phone: "5491123456789",
    address: "Buenos Aires, Argentina",
  },
  whatsapp: {
    ...catalogScaleStore.whatsapp,
    phone: "5491123456789",
    greeting: "Hola Modo Sur, quiero hacer este pedido:",
    includeSku: true,
  },
  seo: {
    ...catalogScaleStore.seo,
    title: "Modo Sur | Vestite con lo que te representa",
    description: "Indumentaria y accesorios para todos los días, con compra directa por WhatsApp.",
  },
  theme: {
    colorMode: "light",
    colors: {
      background: "#fcfcfb",
      surface: "#f0f0ee",
      text: "#0b0b0c",
      muted: "#696966",
      accent: "#0b0b0c",
      accentText: "#ffffff",
      border: "#dededa",
    },
    typography: {
      display: "Archivo, Arial Narrow, Helvetica Neue, Arial, sans-serif",
      body: "Archivo, Arial Narrow, Helvetica Neue, Arial, sans-serif",
      scale: 1,
    },
    spacingScale: 1,
    radius: 16,
    container: 1240,
  },
  assets: catalogModernAssets,
  navigation: {
    ...catalogScaleStore.navigation,
    catalogLabel: "Categorías",
    items: navigationItems,
  },
  commerceTemplates: {
    ...catalogScaleStore.commerceTemplates,
    designFamily: "catalog-modern-v1",
    category: { productsPerPage: 24 },
  },
  pages: [
    {
      id: "page-home",
      kind: "home",
      slug: "inicio",
      title: "Vestite con lo que te representa.",
      seoTitle: "Modo Sur | Vestite con lo que te representa",
      seoDescription: "Indumentaria y accesorios para todos los días, elegidos para acompañarte.",
      sections: [],
    },
    {
      id: "page-about",
      kind: "about",
      slug: "nosotros",
      title: "Una selección pensada para moverte.",
      seoTitle: "Nosotros | Modo Sur",
      seoDescription: "Conocé la mirada detrás de Modo Sur y las prendas que elegimos.",
      sections: [],
    },
    {
      id: "page-contact",
      kind: "contact",
      slug: "contacto",
      title: "Estamos para ayudarte.",
      seoTitle: "Contacto | Modo Sur",
      seoDescription: "Escribinos por WhatsApp, email o teléfono para coordinar tu pedido.",
      sections: [],
    },
  ],
  policies: {
    ...catalogScaleStore.policies,
    shipping: {
      ...catalogScaleStore.policies.shipping,
      summary: "Envíos a todo el país.",
      details: "Coordinamos el envío y su costo antes de confirmar el pedido.",
    },
    returns: {
      ...catalogScaleStore.policies.returns,
      summary: "Cambios dentro de los 10 días.",
      details: "La prenda debe conservar su estado original y no presentar señales de uso.",
    },
  },
  products,
  categories: finalizedCategories,
  collections: [
    {
      id: "collection-recien-llegados",
      slug: "recien-llegados",
      title: "Recién llegados",
      description: "Lo nuevo de Modo Sur.",
      imageId: "asset-hero",
      productIds: products
        .filter((product) => product.collectionIds.includes("collection-recien-llegados"))
        .map((product) => product.id),
    },
    {
      id: "collection-mas-elegidos",
      slug: "mas-elegidos",
      title: "Más elegidos",
      description: "Las prendas que vuelven a aparecer.",
      imageId: "asset-manta",
      productIds: products
        .filter((product) => product.collectionIds.includes("collection-mas-elegidos"))
        .map((product) => product.id),
    },
    {
      id: "collection-esenciales",
      slug: "esenciales",
      title: "Esenciales",
      description: "Piezas para construir tu día.",
      imageId: "asset-jarra",
      productIds: products
        .filter((product) => product.collectionIds.includes("collection-esenciales"))
        .map((product) => product.id),
    },
    {
      id: "collection-fin-de-temporada",
      slug: "fin-de-temporada",
      title: "Fin de temporada",
      description: "Últimas unidades disponibles.",
      imageId: "asset-hero",
      productIds: products
        .filter((product) => product.collectionIds.includes("collection-fin-de-temporada"))
        .map((product) => product.id),
    },
  ],
  sections: [
    {
      id: "modo-section-announcement",
      slot: "announcement",
      moduleId: "catalog-announcement",
      enabled: true,
      settings: {
        text: "Envíos a todo el país",
        linkLabel: "Consultar condiciones",
        linkHref: "/envios/",
      },
      motion: motion("none"),
    },
    {
      id: "modo-section-header",
      slot: "header",
      moduleId: "catalog-header",
      enabled: true,
      settings: { cartLabel: "Carrito", searchLabel: "Buscar productos" },
      motion: motion("none"),
    },
    {
      id: "modo-section-hero",
      slot: "hero",
      moduleId: "catalog-hero",
      enabled: true,
      settings: {
        mode: "image",
        eyebrow: "Nueva temporada",
        title: "Vestite con lo que te representa.",
        body: "Prendas elegidas para acompañarte todos los días.",
        actionLabel: "Ver reci\u00e9n llegados",
        actionHref: "/colecciones/recien-llegados/",
        secondaryActionLabel: "Explorar tienda",
        secondaryActionHref: "/categorias/remeras/",
        posterAssetId: "asset-hero",
        videoAssetId: "",
        backgroundImageId: "asset-hero",
        backgroundDarkness: 60,
        slides: [],
        autoplay: false,
        intervalMs: 6000,
        showCatalogStats: true,
      },
      motion: motion("fade-up"),
    },
    {
      id: "modo-section-brands",
      slot: "content",
      moduleId: "catalog-brand-strip",
      enabled: true,
      settings: { title: "Marcas que nos acompañan", limit: 5 },
      motion: motion("fade-up"),
    },
    {
      id: "modo-section-new",
      slot: "catalog",
      moduleId: "catalog-product-grid",
      enabled: true,
      settings: {
        title: "Recién llegados",
        source: "collection",
        sourceId: "collection-recien-llegados",
        limit: 12,
        showRating: false,
        showViewAll: true,
        viewAllHref: "/colecciones/recien-llegados/",
      },
      motion: motion("stagger"),
    },
    {
      id: "modo-section-top",
      slot: "catalog",
      moduleId: "catalog-product-grid",
      enabled: true,
      settings: {
        title: "Más elegidos",
        source: "collection",
        sourceId: "collection-mas-elegidos",
        limit: 8,
        showRating: false,
        showViewAll: true,
        viewAllHref: "/colecciones/mas-elegidos/",
      },
      motion: motion("stagger"),
    },
    {
      id: "modo-section-categories",
      slot: "catalog",
      moduleId: "catalog-category-bento",
      enabled: true,
      settings: {
        title: "Explorá por categoría",
        items: [],
      },
      motion: motion("stagger"),
    },
    {
      id: "modo-section-testimonials",
      slot: "trust",
      moduleId: "catalog-testimonials",
      enabled: true,
      settings: {
        title: "Lo que dicen quienes nos eligen",
        items: [
          {
            id: "modo-testimonial-1",
            author: "Sofía M.",
            context: "Compra verificada en demo",
            body: "El calce es tal como se veía y la atención fue muy clara.",
            rating: 5,
            example: true,
          },
          {
            id: "modo-testimonial-2",
            author: "Julián R.",
            context: "Compra verificada en demo",
            body: "Encontré prendas fáciles de combinar y con buena terminación.",
            rating: 5,
            example: true,
          },
          {
            id: "modo-testimonial-3",
            author: "Micaela P.",
            context: "Compra verificada en demo",
            body: "Volvería a elegirlos por la calidad y la forma de coordinar el envío.",
            rating: 4,
            example: true,
          },
        ],
      },
      motion: motion("stagger"),
    },
    {
      id: "modo-section-newsletter",
      slot: "content",
      moduleId: "catalog-newsletter-cta",
      enabled: true,
      settings: {
        title: "Recibí las próximas novedades",
        body: "Escribinos y te avisamos cuando llegue una nueva selección.",
        actionLabel: "Escribir por WhatsApp",
        actionHref: "/contacto/",
      },
      motion: motion("fade-up"),
    },
    {
      id: "modo-section-cart",
      slot: "cart",
      moduleId: "catalog-cart-drawer",
      enabled: true,
      settings: {},
      motion: motion("none"),
    },
    {
      id: "modo-section-footer",
      slot: "footer",
      moduleId: "catalog-footer",
      enabled: true,
      settings: {
        note: "Indumentaria y accesorios elegidos para acompañar tu forma de moverte.",
        showPolicies: true,
      },
      motion: motion("none"),
    },
  ],
});
