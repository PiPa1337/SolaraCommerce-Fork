import { CATALOG_MODERN_GUIDANCE_VERSION } from "./catalog-modern-guidance";
import { StoreProjectV2Schema } from "./index";
import { OPTIMIZED_FIXTURE_DATA_URLS } from "./optimized-fixture-urls.js";
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
    description: `${title} de la tienda de referencia para combinar sin esfuerzo.`,
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
const brands = ["Tienda Referencia", "Línea Base", "Taller Norte", "Estudio Liso", "Bruma"];
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

const productImagePools: Record<string, readonly string[]> = {
  remeras: ["asset-product-01", "asset-product-02", "asset-product-03"],
  camisas: ["asset-product-04", "asset-product-05"],
  pantalones: ["asset-product-06", "asset-product-07", "asset-product-08"],
  abrigos: ["asset-product-09"],
  vestidos: ["asset-product-11"],
  tejidos: ["asset-product-10"],
  calzado: ["asset-product-12"],
  accesorios: ["asset-product-12"],
};
const allProductImageIds = [...new Set(Object.values(productImagePools).flat())];

function productImageIds(rootSlug: string, index: number): string[] {
  const pool = productImagePools[rootSlug] ?? productImagePools.remeras ?? [];
  const selected = [
    pool[index % pool.length] ?? allProductImageIds[index % allProductImageIds.length],
  ];
  for (let offset = 0; selected.length < 3 && offset < allProductImageIds.length; offset += 1) {
    const candidate = allProductImageIds[(index + offset) % allProductImageIds.length];
    if (candidate && !selected.includes(candidate)) selected.push(candidate);
  }
  return selected.filter((id): id is string => Boolean(id));
}

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
  const imageIds = productImageIds(rootSlug, index);
  const imageId = imageIds[0] ?? "asset-product-01";
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
    imageIds,
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

// La asignación de assets de categoría es explícita y sólo usa categorías
// madre; los hijos conservan sus imágenes de producto para el detalle.
const rootCategoryImageIds: Partial<Record<string, string>> = {
  "category-remeras": "asset-product-01",
  "category-camisas": "asset-product-04",
  "category-pantalones": "asset-product-06",
  "category-abrigos": "asset-product-09",
  "category-vestidos": "asset-product-11",
  "category-tejidos": "asset-product-10",
  "category-calzado": "asset-product-12",
  "category-accesorios": "asset-product-12",
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

const productAssetDefinitions = [
  ["01", "Remera esencial negra", "Remera negra de algodón sobre fondo gris claro"],
  ["02", "Remera gráfica negra", "Remera negra gráfica sobre fondo gris claro"],
  ["03", "Remera manga larga negra", "Remera negra de manga larga sobre fondo gris claro"],
  ["04", "Camisa Oxford blanca", "Camisa Oxford blanca sobre fondo gris claro"],
  ["05", "Camisa a rayas finas", "Camisa blanca a rayas finas sobre fondo gris claro"],
  ["06", "Jean recto azul", "Jean recto azul sobre fondo gris claro"],
  ["07", "Pantalón sastrero carbón", "Pantalón sastrero gris carbón sobre fondo gris claro"],
  ["08", "Short de verano arena", "Short de verano color arena sobre fondo gris claro"],
  ["09", "Campera liviana negra", "Campera liviana negra sobre fondo gris claro"],
  ["10", "Tejido de algodón crudo", "Tejido de algodón color crudo sobre fondo gris claro"],
  ["11", "Vestido midi negro", "Vestido midi negro sobre fondo gris claro"],
  ["12", "Zapatilla urbana blanca", "Zapatilla blanca y accesorio de cuero sobre fondo gris claro"],
] as const;

const catalogModernProductAssets = productAssetDefinitions.map(([number, name, alt]) => ({
  kind: "image" as const,
  id: `asset-product-${number}`,
  name,
  alt,
  mimeType: "image/webp",
  source: `/fixtures/modo-sur-product-${number}.webp`,
  width: 356,
  height: 356,
  hash: `fixture-modo-sur-product-${number}`,
}));

const catalogModernAssets = [
  {
    kind: "image" as const,
    id: "asset-hero",
    name: "Campaña de temporada",
    alt: "Dos personas con prendas frente a una pared clara",
    mimeType: "image/webp",
    source: OPTIMIZED_FIXTURE_DATA_URLS.modo_sur_hero_1536,
    responsiveSources: [
      { width: 320, source: OPTIMIZED_FIXTURE_DATA_URLS.modo_sur_hero_320 },
      { width: 640, source: OPTIMIZED_FIXTURE_DATA_URLS.modo_sur_hero_640 },
      { width: 1024, source: OPTIMIZED_FIXTURE_DATA_URLS.modo_sur_hero_1024 },
      { width: 1536, source: OPTIMIZED_FIXTURE_DATA_URLS.modo_sur_hero_1536 },
    ],
    width: 1536,
    height: 1024,
    hash: "fixture-modo-sur-hero",
  },
  {
    kind: "image" as const,
    id: "asset-manta",
    name: "Remera esencial negra",
    alt: "Remera negra de algodón sobre fondo gris claro",
    mimeType: "image/webp",
    source: OPTIMIZED_FIXTURE_DATA_URLS.modo_sur_remera_1024,
    responsiveSources: [
      { width: 320, source: OPTIMIZED_FIXTURE_DATA_URLS.modo_sur_remera_320 },
      { width: 640, source: OPTIMIZED_FIXTURE_DATA_URLS.modo_sur_remera_640 },
      { width: 1024, source: OPTIMIZED_FIXTURE_DATA_URLS.modo_sur_remera_1024 },
    ],
    width: 1254,
    height: 1254,
    hash: "fixture-modo-sur-remera",
  },
  {
    kind: "image" as const,
    id: "asset-jarra",
    name: "Jean recto azul",
    alt: "Jean recto azul sobre fondo gris claro",
    mimeType: "image/webp",
    source: OPTIMIZED_FIXTURE_DATA_URLS.modo_sur_jean_1024,
    responsiveSources: [
      { width: 320, source: OPTIMIZED_FIXTURE_DATA_URLS.modo_sur_jean_320 },
      { width: 640, source: OPTIMIZED_FIXTURE_DATA_URLS.modo_sur_jean_640 },
      { width: 1024, source: OPTIMIZED_FIXTURE_DATA_URLS.modo_sur_jean_1024 },
    ],
    width: 1254,
    height: 1254,
    hash: "fixture-modo-sur-jean",
  },
  {
    kind: "image" as const,
    id: "asset-modo-camisa",
    name: "Camisa a cuadros",
    alt: "Camisa a cuadros roja y azul sobre fondo gris claro",
    mimeType: "image/webp",
    source: OPTIMIZED_FIXTURE_DATA_URLS.modo_sur_camisa_1024,
    responsiveSources: [
      { width: 320, source: OPTIMIZED_FIXTURE_DATA_URLS.modo_sur_camisa_320 },
      { width: 640, source: OPTIMIZED_FIXTURE_DATA_URLS.modo_sur_camisa_640 },
      { width: 1024, source: OPTIMIZED_FIXTURE_DATA_URLS.modo_sur_camisa_1024 },
    ],
    width: 1254,
    height: 1254,
    hash: "fixture-modo-sur-camisa",
  },
  ...catalogModernProductAssets,
] as const;

export const catalogModernStore = StoreProjectV2Schema.parse({
  ...structuredClone(catalogScaleStore),
  id: "store-modo-sur",
  name: "Tienda Referencia",
  slug: "tienda-referencia-modern",
  baseUrl: "https://tienda-referencia-modern.example",
  createdAt: fixedDate,
  updatedAt: fixedDate,
  origin: {
    templateId: "catalog-modern",
    templateVersion: CATALOG_MODERN_GUIDANCE_VERSION,
    seed: "demo",
  },
  identity: {
    legalName: "Tienda Referencia SRL",
    brandName: "Tienda Referencia",
    description: "Indumentaria y accesorios elegidos para acompañar tu forma de moverte.",
    email: "hola@tienda-referencia-modern.example",
    phone: "5491123456789",
    address: "Buenos Aires, Argentina",
  },
  whatsapp: {
    ...catalogScaleStore.whatsapp,
    phone: "5491123456789",
    greeting: "Hola Tienda Referencia, quiero hacer este pedido:",
    includeSku: true,
  },
  seo: {
    ...catalogScaleStore.seo,
    title: "Tienda Referencia | Vestite con lo que te representa",
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
      seoTitle: "Tienda Referencia | Vestite con lo que te representa",
      seoDescription: "Indumentaria y accesorios para todos los días, elegidos para acompañarte.",
      sections: [],
    },
    {
      id: "page-about",
      kind: "about",
      slug: "nosotros",
      title: "Una selección pensada para moverte.",
      seoTitle: "Nosotros | Tienda Referencia",
      seoDescription:
        "Conocé la mirada detrás de la tienda de referencia y las prendas que elegimos.",
      sections: [],
    },
    {
      id: "page-contact",
      kind: "contact",
      slug: "contacto",
      title: "Estamos para ayudarte.",
      seoTitle: "Contacto | Tienda Referencia",
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
      description: "Lo nuevo de la tienda de referencia.",
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
          {
            id: "modo-testimonial-4",
            author: "Valentina G.",
            context: "Compra verificada en demo",
            body: "La tela se siente muy bien y el pedido llegó tal como lo coordinamos.",
            rating: 5,
            example: true,
          },
          {
            id: "modo-testimonial-5",
            author: "Tomás L.",
            context: "Compra verificada en demo",
            body: "La guía de talles me ayudó a elegir y la prenda quedó perfecta.",
            rating: 5,
            example: true,
          },
          {
            id: "modo-testimonial-6",
            author: "Camila D.",
            context: "Compra verificada en demo",
            body: "Todo el proceso fue simple, desde la consulta hasta la entrega.",
            rating: 5,
            example: true,
          },
          {
            id: "modo-testimonial-7",
            author: "Franco S.",
            context: "Compra verificada en demo",
            body: "Encontré básicos que combinan con todo y tienen una terminación cuidada.",
            rating: 4,
            example: true,
          },
          {
            id: "modo-testimonial-8",
            author: "Abril C.",
            context: "Compra verificada en demo",
            body: "La atención respondió rápido y me orientó con todas mis dudas.",
            rating: 5,
            example: true,
          },
          {
            id: "modo-testimonial-9",
            author: "Nicolás V.",
            context: "Compra verificada en demo",
            body: "La calidad de las prendas superó lo que esperaba por las fotos.",
            rating: 5,
            example: true,
          },
          {
            id: "modo-testimonial-10",
            author: "Paula F.",
            context: "Compra verificada en demo",
            body: "Volví a comprar porque el calce y los materiales se mantienen impecables.",
            rating: 5,
            example: true,
          },
          {
            id: "modo-testimonial-11",
            author: "Martina B.",
            context: "Compra verificada en demo",
            body: "Me gustó poder consultar stock y coordinar el envío en pocos mensajes.",
            rating: 4,
            example: true,
          },
          {
            id: "modo-testimonial-12",
            author: "Lucas A.",
            context: "Compra verificada en demo",
            body: "Una selección clara, prendas cómodas y una experiencia de compra muy fluida.",
            rating: 5,
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
      motion: motion("none"),
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
