import {
  escapeAttribute,
  escapeHtml,
  formatMoney,
  type ModuleDefinition,
  moduleRoot,
  renderImage,
  renderVideo,
  safeAssetUrl,
  safeHtml,
  safeUrl,
  sanitizeRichText,
} from "@solara/module-sdk";
import type { AssetId, Product, ProductReview } from "@solara/project-schema";
import { z } from "zod";
import { lowestPrice, renderBrand, scopedAssetId } from "./helpers";

const modernRevealZone = [
  {
    id: "content",
    label: "Contenido",
    selector: '[data-motion-zone="content"]',
    allowedPresets: ["none", "fade", "fade-up", "slide", "scale"] as const,
  },
] as const;

const modernItemsZone = [
  {
    id: "items",
    label: "Elementos",
    selector: '[data-motion-zone="items"]',
    allowedPresets: ["none", "fade", "fade-up", "stagger"] as const,
  },
] as const;

const modernManifest = (input: {
  id: string;
  name: string;
  description: string;
  slots: readonly (
    | "announcement"
    | "header"
    | "hero"
    | "catalog"
    | "product"
    | "content"
    | "trust"
    | "cart"
    | "footer"
  )[];
  compatibleSettings: readonly string[];
}) => ({
  ...input,
  version: 1 as const,
  family: "catalog-modern-v1" as const,
  availability: "default" as const,
});

const announcementSettings = z.object({
  text: z.string().default("Envíos a todo el país"),
  linkLabel: z.string().default(""),
  linkHref: z.string().default(""),
});

export const catalogAnnouncement: ModuleDefinition<z.infer<typeof announcementSettings>> = {
  manifest: modernManifest({
    id: "catalog-announcement",
    name: "Barra informativa moderna",
    description: "Mensaje breve de la tienda con enlace opcional.",
    slots: ["announcement"],
    compatibleSettings: ["text", "linkLabel", "linkHref"],
  }),
  settingsSchema: announcementSettings,
  settingsFields: [
    { key: "text", type: "text", label: "Mensaje" },
    { key: "linkLabel", type: "text", label: "Texto del enlace" },
    { key: "linkHref", type: "url", label: "Destino del enlace" },
  ],
  motionZones: modernRevealZone,
  styleAsset: scopedAssetId("catalog-modern"),
  render(context) {
    const link =
      context.settings.linkLabel && context.settings.linkHref
        ? `<a href="${escapeAttribute(safeUrl(context.settings.linkHref))}">${escapeHtml(context.settings.linkLabel)}</a>`
        : "";
    return moduleRoot(
      "catalog-announcement",
      context.section,
      safeHtml(
        `<div class="catalog-announcement-inner" data-motion-zone="content"><span>${escapeHtml(context.settings.text)}</span>${link}<button type="button" data-catalog-announcement-close aria-label="Cerrar anuncio">×</button></div>`,
      ),
      { tag: "header" },
    );
  },
};

const headerSettings = z.object({
  cartLabel: z.string().default("Carrito"),
  searchLabel: z.string().default("Buscar productos"),
});

export const catalogHeader: ModuleDefinition<z.infer<typeof headerSettings>> = {
  manifest: modernManifest({
    id: "catalog-header",
    name: "Navbar de catálogo",
    description: "Header compacto con menú de dos niveles, búsqueda y carrito.",
    slots: ["header"],
    compatibleSettings: ["cartLabel", "searchLabel"],
  }),
  settingsSchema: headerSettings,
  settingsFields: [
    { key: "cartLabel", type: "text", label: "Texto del carrito" },
    { key: "searchLabel", type: "text", label: "Texto de búsqueda" },
  ],
  motionZones: modernRevealZone,
  clientAsset: "storefront-cart" as AssetId,
  styleAsset: scopedAssetId("catalog-modern"),
  render(context) {
    const navigation = context.project.navigation;
    const automaticItems = context.project.categories
      .filter((category) => !category.parentId)
      .map((category) => ({
        id: `automatic-nav-${category.id}`,
        label: category.title,
        href: `/categorias/${category.slug}/`,
        children: context.project.categories
          .filter((child) => child.parentId === category.id)
          .map((child) => ({
            id: `automatic-nav-${child.id}`,
            label: child.title,
            href: `/categorias/${child.slug}/`,
          })),
      }));
    const navigationItems = navigation.mode === "automatic" ? automaticItems : navigation.items;
    const menuItems = navigationItems
      .map((item) => {
        const children = item.children?.length
          ? `<ul>${item.children
              .map(
                (child) =>
                  `<li><a href="${escapeAttribute(safeUrl(child.href ?? "#"))}">${escapeHtml(child.label)}</a></li>`,
              )
              .join("")}</ul>`
          : "";
        return `<li${children ? ' class="has-children"' : ""}><a href="${escapeAttribute(safeUrl(item.href ?? "#"))}">${escapeHtml(item.label)}</a>${children}</li>`;
      })
      .join("");
    const current = (types: string[]) =>
      types.includes(context.pageType ?? "") ? ' aria-current="page"' : "";
    const catalog = navigationItems.length
      ? `<details class="catalog-nav-menu"><summary${current(["category", "collection"])}>${escapeHtml(navigation.catalogLabel || "Tienda")}</summary><div class="catalog-mega-menu"><ul>${menuItems}</ul></div></details>`
      : "";
    const nav = `${navigation.showHome ? `<a href="/"${current(["home"])}>Inicio</a>` : ""}${catalog}${navigation.showContact ? `<a href="/contacto/"${current(["contact"])}>Contacto</a>` : ""}${navigation.showAbout ? `<a href="/nosotros/"${current(["about"])}>Nosotros</a>` : ""}`;
    const mobileNav = nav.replace(
      '<details class="catalog-nav-menu">',
      '<details class="catalog-nav-menu" open>',
    );
    const search =
      navigation.showSearch && context.project.commerceTemplates.search.enabled
        ? `<a class="catalog-search-link" href="/buscar/" aria-label="${escapeAttribute(context.settings.searchLabel)}"${current(["search"])}><svg aria-hidden="true" viewBox="0 0 24 24" focusable="false"><circle cx="10.8" cy="10.8" r="6.8"></circle><path d="m16 16 5 5"></path></svg><span>${escapeHtml(context.settings.searchLabel)}</span></a>`
        : "";
    const cart =
      navigation.showCart && context.project.siteShell.cart
        ? `<button class="catalog-cart-link" type="button" data-solara-cart-open data-open-cart data-cart-label="${escapeAttribute(context.settings.cartLabel)}" aria-controls="solara-cart"><span>${escapeHtml(context.settings.cartLabel)}</span><strong data-solara-cart-count data-cart-count aria-live="polite">0</strong></button>`
        : "";
    return moduleRoot(
      "catalog-header",
      context.section,
      safeHtml(`<div class="catalog-header-inner" data-motion-zone="content">
        <button class="catalog-mobile-menu-button" type="button" data-catalog-menu-open aria-controls="catalog-mobile-menu" aria-expanded="false"><span class="sr-only">Abrir menú</span><svg aria-hidden="true" viewBox="0 0 24 24" focusable="false"><path d="M4 6h16M4 12h16M4 18h16"></path></svg></button>
        <a class="catalog-brand" href="/" aria-label="Inicio de ${escapeAttribute(context.project.identity.brandName)}">${renderBrand(context.project)}</a>
        <nav class="catalog-desktop-nav" aria-label="Navegación principal">${nav}</nav>
        <div class="catalog-header-actions">${search}${cart}</div>
        <aside id="catalog-mobile-menu" class="catalog-mobile-menu" data-catalog-menu hidden aria-label="Navegación móvil"><button type="button" data-catalog-menu-close aria-label="Cerrar menú">Cerrar</button><nav>${mobileNav}</nav></aside>
      </div>`),
      { tag: "header" },
    );
  },
};

const heroSlideSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  body: z.string().default(""),
  actionLabel: z.string().default("Ver colección"),
  actionHref: z.string().default("/"),
  imageId: z.string().default(""),
});

const heroSettings = z.object({
  mode: z.enum(["image", "carousel", "video"]).default("image"),
  eyebrow: z.string().default("Nueva temporada"),
  title: z.string().default("Vestite con lo que te representa."),
  body: z.string().default("Prendas elegidas para acompañarte todos los días."),
  actionLabel: z.string().default("Ver novedades"),
  actionHref: z.string().default("/categorias/novedades/"),
  secondaryActionLabel: z.string().default("Explorar tienda"),
  secondaryActionHref: z.string().default("/categorias/remeras/"),
  posterAssetId: z.string().default(""),
  videoAssetId: z.string().default(""),
  slides: z.array(heroSlideSchema).default([]),
  autoplay: z.boolean().default(false),
  intervalMs: z.number().int().min(3000).max(15000).default(6000),
  showCatalogStats: z.boolean().default(true),
});

function modernFallbackAsset(
  context: { project: import("@solara/project-schema").StoreProjectV1 },
  requested?: string,
): string {
  return (
    requested || context.project.seo.socialImageId || context.project.products[0]?.imageIds[0] || ""
  );
}

function renderCatalogHeroMedia(
  context: Parameters<NonNullable<(typeof catalogHero)["render"]>>[0],
  settings: z.infer<typeof heroSettings>,
  title: string,
): string {
  const fallback = modernFallbackAsset(context, settings.posterAssetId);
  if (settings.mode === "video" && settings.videoAssetId) {
    const video = renderVideo(context.project, settings.videoAssetId, {
      className: "catalog-hero-video",
      posterAssetId: settings.posterAssetId,
      preload: "none",
      autoplay: settings.autoplay,
      fallbackAlt: title,
    });
    if (video) return video;
  }
  return renderImage(context.project, fallback, {
    className: "catalog-hero-image",
    loading: "eager",
    fetchPriority: "high",
    sizes: "(max-width: 767px) 100vw, 52vw",
    fallbackAlt: title,
  });
}

export const catalogHero: ModuleDefinition<z.infer<typeof heroSettings>> = {
  manifest: modernManifest({
    id: "catalog-hero",
    name: "Hero de catálogo",
    description: "Hero dividido con imagen, carrusel o video local.",
    slots: ["hero"],
    compatibleSettings: [
      "mode",
      "eyebrow",
      "title",
      "body",
      "actionLabel",
      "actionHref",
      "secondaryActionLabel",
      "secondaryActionHref",
      "posterAssetId",
      "videoAssetId",
      "slides",
      "autoplay",
      "intervalMs",
      "showCatalogStats",
    ],
  }),
  settingsSchema: heroSettings,
  settingsFields: [
    {
      key: "mode",
      type: "select",
      label: "Modo",
      options: [
        { value: "image", label: "Imagen" },
        { value: "carousel", label: "Carrusel" },
        { value: "video", label: "Video" },
      ],
    },
    { key: "eyebrow", type: "text", label: "Antetítulo" },
    { key: "title", type: "text", label: "Título" },
    { key: "body", type: "text", label: "Descripción" },
    { key: "actionLabel", type: "text", label: "Botón principal" },
    { key: "actionHref", type: "url", label: "Destino principal" },
    { key: "secondaryActionLabel", type: "text", label: "Botón secundario" },
    { key: "secondaryActionHref", type: "url", label: "Destino secundario" },
    { key: "posterAssetId", type: "asset", label: "Imagen de portada" },
    { key: "videoAssetId", type: "asset", label: "Video local" },
    {
      key: "slides",
      type: "repeater",
      label: "Slides",
      maxItems: 8,
      itemLabelKey: "title",
      fields: [
        { key: "title", label: "Título", type: "text" },
        { key: "body", label: "Descripción", type: "text" },
        { key: "actionLabel", label: "Botón", type: "text" },
        { key: "actionHref", label: "Destino", type: "url" },
        { key: "imageId", label: "Imagen", type: "asset" },
      ],
    },
    { key: "autoplay", type: "boolean", label: "Reproducción automática" },
    { key: "intervalMs", type: "number", label: "Intervalo", min: 3000, max: 15000, step: 500 },
    { key: "showCatalogStats", type: "boolean", label: "Mostrar estadísticas del catálogo" },
  ],
  motionZones: [
    ...modernRevealZone,
    {
      id: "media",
      label: "Media",
      selector: '[data-motion-zone="media"]',
      allowedPresets: ["none", "fade", "scale", "parallax"] as const,
    },
  ],
  clientAsset: "storefront-hero" as AssetId,
  styleAsset: scopedAssetId("catalog-modern"),
  render(context) {
    const settings = context.settings;
    const activeSlide = settings.mode === "carousel" ? settings.slides[0] : undefined;
    const title = activeSlide?.title ?? settings.title;
    const body = activeSlide?.body ?? settings.body;
    const actionLabel = activeSlide?.actionLabel ?? settings.actionLabel;
    const actionHref = activeSlide?.actionHref ?? settings.actionHref;
    const media = renderCatalogHeroMedia(context, settings, title);
    const slidePanels =
      settings.mode === "carousel"
        ? settings.slides
            .map((slide, index) => {
              const slideImage = renderImage(
                context.project,
                slide.imageId || modernFallbackAsset(context, settings.posterAssetId),
                {
                  className: "catalog-hero-image",
                  loading: index === 0 ? "eager" : "lazy",
                  fetchPriority: index === 0 ? "high" : "auto",
                  sizes: "(max-width: 767px) 100vw, 52vw",
                  fallbackAlt: slide.title,
                },
              );
              return `<figure data-catalog-hero-slide-panel data-title="${escapeAttribute(slide.title)}" data-body="${escapeAttribute(slide.body)}" data-action-label="${escapeAttribute(slide.actionLabel)}" data-action-href="${escapeAttribute(safeUrl(slide.actionHref))}"${index === 0 ? "" : " hidden"}>${slideImage}</figure>`;
            })
            .join("")
        : "";
    const heroMedia = slidePanels
      ? `<div class="catalog-hero-slide-stage">${slidePanels}</div>`
      : String(media);
    const stats = settings.showCatalogStats
      ? `<dl class="catalog-hero-stats"><div><dt>${context.project.products.filter((product) => product.status === "active").length}</dt><dd>productos activos</dd></div><div><dt>${context.project.categories.filter((category) => !category.parentId).length}</dt><dd>categorías</dd></div><div><dt>WhatsApp</dt><dd>pedido directo</dd></div></dl>`
      : "";
    const slides =
      settings.mode === "carousel"
        ? settings.slides
            .map(
              (slide, index) =>
                `<button type="button" data-catalog-hero-slide="${index}" aria-label="Mostrar ${escapeAttribute(slide.title)}" aria-selected="${String(index === 0)}"></button>`,
            )
            .join("")
        : "";
    return moduleRoot(
      "catalog-hero",
      context.section,
      safeHtml(
        `<div class="catalog-hero-inner" data-motion-zone="content" data-autoplay="${String(settings.autoplay)}" data-interval="${settings.intervalMs}"><div class="catalog-hero-copy"><p class="catalog-eyebrow">${escapeHtml(settings.eyebrow)}</p><h1>${escapeHtml(title)}</h1><p class="catalog-hero-body">${escapeHtml(body)}</p><div class="catalog-hero-actions"><a class="catalog-primary-action" href="${escapeAttribute(safeUrl(actionHref))}">${escapeHtml(actionLabel)}</a>${settings.secondaryActionLabel ? `<a class="catalog-secondary-action" href="${escapeAttribute(safeUrl(settings.secondaryActionHref))}">${escapeHtml(settings.secondaryActionLabel)}</a>` : ""}</div>${stats}</div><figure class="catalog-hero-media" data-motion-zone="media">${heroMedia}</figure>${slides ? `<div class="catalog-hero-controls" aria-label="Controles del carrusel">${slides}</div>` : ""}</div>`,
      ),
    );
  },
};

const brandStripSettings = z.object({
  title: z.string().default("Marcas que nos acompañan"),
  limit: z.number().int().min(1).max(12).default(5),
});

export const catalogBrandStrip: ModuleDefinition<z.infer<typeof brandStripSettings>> = {
  manifest: modernManifest({
    id: "catalog-brand-strip",
    name: "Franja de marcas",
    description: "Marcas presentes en el catálogo de la tienda.",
    slots: ["content"],
    compatibleSettings: ["title", "limit"],
  }),
  settingsSchema: brandStripSettings,
  settingsFields: [
    { key: "title", type: "text", label: "Título" },
    { key: "limit", type: "number", label: "Cantidad", min: 1, max: 12, step: 1 },
  ],
  motionZones: modernItemsZone,
  styleAsset: scopedAssetId("catalog-modern"),
  render(context) {
    const brands = [
      ...new Set(
        context.project.products
          .filter((product) => product.status === "active")
          .map((product) => product.brand)
          .filter(Boolean),
      ),
    ].slice(0, context.settings.limit);
    if (!brands.length) return moduleRoot("catalog-brand-strip", context.section, safeHtml(""));
    return moduleRoot(
      "catalog-brand-strip",
      context.section,
      safeHtml(
        `<div class="catalog-brand-strip-inner"><h2>${escapeHtml(context.settings.title)}</h2><ul data-motion-zone="items">${brands.map((brand) => `<li>${escapeHtml(brand)}</li>`).join("")}</ul></div>`,
      ),
    );
  },
};

const productGridSettings = z.object({
  title: z.string().default("Productos destacados"),
  source: z.enum(["all", "collection", "category"]).default("all"),
  sourceId: z.string().default(""),
  limit: z.number().int().min(1).max(48).default(12),
  showRating: z.boolean().default(true),
  showViewAll: z.boolean().default(true),
  viewAllHref: z.string().default("/categorias/novedades/"),
});

function modernProducts(
  context: Parameters<NonNullable<(typeof catalogProductGrid)["render"]>>[0],
  settings: z.infer<typeof productGridSettings>,
): Product[] {
  let products = context.products
    ? [...context.products]
    : context.project.products.filter((product) => product.status === "active");
  if (settings.source === "collection" && settings.sourceId) {
    const collection = context.project.collections.find((item) => item.id === settings.sourceId);
    const ids = new Set(collection?.productIds ?? []);
    products = context.project.products.filter(
      (product) => ids.has(product.id) && product.status === "active",
    );
  }
  if (settings.source === "category" && settings.sourceId) {
    const category = context.project.categories.find((item) => item.id === settings.sourceId);
    const ids = new Set(category?.productIds ?? []);
    products = context.project.products.filter(
      (product) => ids.has(product.id) && product.status === "active",
    );
  }
  return products.slice(0, settings.limit);
}

function reviewAverage(product: Product): number | undefined {
  const reviews = product.reviews?.filter((review) => review.visible) ?? [];
  return reviews.length
    ? reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length
    : undefined;
}

function modernProductCard(
  context: Parameters<NonNullable<(typeof catalogProductGrid)["render"]>>[0],
  product: Product,
  index: number,
  showRating: boolean,
): string {
  const variant = product.variants.find((item) => item.available) ?? product.variants[0];
  const price = lowestPrice(product);
  const compare = variant?.compareAtPrice;
  const average = reviewAverage(product);
  const imageId = variant?.imageId ?? product.imageIds[0];
  const image = renderImage(context.project, imageId, {
    className: "catalog-product-card-image",
    loading: index < 4 ? "eager" : "lazy",
    fetchPriority: index < 4 ? "high" : "auto",
    sizes: "(max-width: 640px) 44vw, (max-width: 1024px) 30vw, 280px",
    fallbackAlt: product.title,
  });
  return `<article class="catalog-product-card" data-product-card data-product-id="${escapeAttribute(product.id)}" data-product-title="${escapeAttribute(product.title)}"><a class="catalog-product-media" href="/productos/${escapeAttribute(product.slug)}/" aria-label="Ver ${escapeAttribute(product.title)}">${image}</a><div class="catalog-product-card-copy"><p class="catalog-product-brand">${escapeHtml(product.brand)}</p><h3><a href="/productos/${escapeAttribute(product.slug)}/">${escapeHtml(product.title)}</a></h3>${showRating && average ? `<p class="catalog-product-rating" aria-label="${average.toFixed(1)} de 5">${"★".repeat(Math.round(average))}<span>${average.toFixed(1)}/5</span></p>` : ""}<p class="catalog-product-price"><strong>${escapeHtml(formatMoney(price))}</strong>${compare && compare > price ? ` <del>${escapeHtml(formatMoney(compare))}</del><span class="catalog-discount">-${Math.round((1 - price / compare) * 100)}%</span>` : ""}</p><p class="catalog-product-availability">${variant?.available ? "Disponible" : "Agotado"}</p></div></article>`;
}

export const catalogProductGrid: ModuleDefinition<z.infer<typeof productGridSettings>> = {
  manifest: modernManifest({
    id: "catalog-product-grid",
    name: "Grilla moderna de productos",
    description: "Grilla densa para home, colecciones y categorías.",
    slots: ["catalog"],
    compatibleSettings: [
      "title",
      "source",
      "sourceId",
      "limit",
      "showRating",
      "showViewAll",
      "viewAllHref",
    ],
  }),
  settingsSchema: productGridSettings,
  settingsFields: [
    { key: "title", type: "text", label: "Título" },
    {
      key: "source",
      type: "select",
      label: "Origen",
      options: [
        { value: "all", label: "Todos" },
        { value: "collection", label: "Colección" },
        { value: "category", label: "Categoría" },
      ],
    },
    { key: "sourceId", type: "text", label: "Origen (ID)" },
    { key: "limit", type: "number", label: "Cantidad", min: 1, max: 48, step: 1 },
    { key: "showRating", type: "boolean", label: "Mostrar valoración" },
    { key: "showViewAll", type: "boolean", label: "Mostrar enlace" },
    { key: "viewAllHref", type: "url", label: "Destino del enlace" },
  ],
  motionZones: modernItemsZone,
  styleAsset: scopedAssetId("catalog-modern"),
  render(context) {
    const products = modernProducts(context, context.settings);
    const categoryGrid = context.pageType === "category" ? " data-category-grid" : "";
    const cards = products
      .map((product, index) => {
        const card = modernProductCard(context, product, index, context.settings.showRating);
        // El runtime reutiliza estos datos para filtros y ordenamiento sin duplicar el catálogo.
        const optionValues = [
          ...new Set(
            product.variants.flatMap((variant) =>
              Object.entries(variant.optionValues).map(([key, value]) => `${key}=${value}`),
            ),
          ),
        ];
        const attributes = ` data-product-price="${lowestPrice(product)}" data-product-tags="${escapeAttribute(product.tags.join(" "))}" data-product-variants="${escapeAttribute(product.variants.map((variant) => variant.title).join(" "))}" data-product-options="${escapeAttribute(optionValues.join("|"))}" data-product-available="${String(product.variants.some((variant) => variant.available))}"`;
        return card.replace(
          `data-product-title="${escapeAttribute(product.title)}"`,
          `data-product-title="${escapeAttribute(product.title)}"${attributes}`,
        );
      })
      .join("");
    return moduleRoot(
      "catalog-product-grid",
      context.section,
      safeHtml(
        `<div class="catalog-product-grid-section"><header><h2>${escapeHtml(context.settings.title)}</h2>${context.settings.showViewAll ? `<a class="catalog-view-all" href="${escapeAttribute(safeUrl(context.settings.viewAllHref))}">Ver todos</a>` : ""}</header><div class="catalog-product-grid" data-motion-zone="items"${categoryGrid}>${cards || '<p class="catalog-empty">No hay productos para mostrar.</p>'}</div></div>`,
      ),
    );
  },
};

const productDetailSettings = z.object({
  actionLabel: z.string().default("Agregar al carrito"),
  showDescription: z.boolean().default(true),
  showCompareAtPrice: z.boolean().default(true),
  deliveryNote: z.string().default("Coordinamos entrega y pago por WhatsApp."),
});

export const catalogProductDetail: ModuleDefinition<z.infer<typeof productDetailSettings>> = {
  manifest: modernManifest({
    id: "catalog-product-detail",
    name: "Detalle moderno de producto",
    description: "Galería, variantes, precio, reseñas y acción de compra.",
    slots: ["product"],
    compatibleSettings: ["actionLabel", "showDescription", "showCompareAtPrice", "deliveryNote"],
  }),
  settingsSchema: productDetailSettings,
  settingsFields: [
    { key: "actionLabel", type: "text", label: "Texto de la acción" },
    { key: "showDescription", type: "boolean", label: "Mostrar descripción" },
    { key: "showCompareAtPrice", type: "boolean", label: "Mostrar precio anterior" },
    { key: "deliveryNote", type: "text", label: "Nota de entrega" },
  ],
  motionZones: [...modernRevealZone, ...modernItemsZone],
  clientAsset: "storefront-cart" as AssetId,
  styleAsset: scopedAssetId("catalog-modern"),
  render(context) {
    const product = context.product;
    if (!product) {
      return moduleRoot(
        "catalog-product-detail",
        context.section,
        safeHtml('<p class="catalog-empty">Este producto no está disponible.</p>'),
      );
    }
    const firstVariant =
      product.variants.find((variant) => variant.available) ?? product.variants[0];
    const galleryAssetIds = [
      ...product.variants.map((variant) => variant.imageId),
      ...product.imageIds,
    ].filter(
      (assetId, index, all): assetId is AssetId =>
        Boolean(assetId) && all.indexOf(assetId) === index,
    );
    const galleryFigures = galleryAssetIds
      .map((assetId, index) => {
        const image = renderImage(context.project, assetId, {
          className: "catalog-product-gallery-image",
          loading: index === 0 ? "eager" : "lazy",
          fetchPriority: index === 0 ? "high" : "auto",
          sizes: "(max-width: 767px) 92vw, 54vw",
          fallbackAlt: product.title,
        });
        return `<figure data-gallery-image-id="${escapeAttribute(assetId)}" data-gallery-active="${String(index === 0)}">${image}</figure>`;
      })
      .join("");
    const galleryThumbs = galleryAssetIds
      .map((assetId, index) => {
        const image = renderImage(context.project, assetId, {
          className: "catalog-product-gallery-thumb",
          loading: "lazy",
          sizes: "5rem",
          fallbackAlt: `${product.title}, imagen ${index + 1}`,
        });
        return `<button type="button" data-gallery-thumb="${escapeAttribute(assetId)}" aria-label="Ver imagen ${index + 1}" aria-current="${String(index === 0)}">${image}</button>`;
      })
      .join("");
    const gallery = galleryAssetIds.length
      ? `<div class="catalog-product-gallery" data-product-gallery><div class="catalog-product-gallery-main">${galleryFigures}</div><div class="catalog-product-gallery-thumbs" role="list" aria-label="Imágenes del producto">${galleryThumbs}</div></div>`
      : '<p class="catalog-empty">Este producto todavía no tiene imágenes.</p>';
    const variants = product.variants
      .map((variant) => {
        const variantImage = context.project.assets.find(
          (asset) => asset.id === (variant.imageId ?? product.imageIds[0]),
        );
        const imageUrl = variantImage ? safeAssetUrl(variantImage.source, "") : "";
        return `<option value="${escapeAttribute(variant.id)}" data-variant-data="${escapeAttribute(variant.id)}" data-variant-id="${escapeAttribute(variant.id)}" data-variant-title="${escapeAttribute(variant.title)}" data-sku="${escapeAttribute(variant.sku)}" data-image-id="${escapeAttribute(variant.imageId ?? product.imageIds[0] ?? "")}"${imageUrl ? ` data-image-url="${escapeAttribute(imageUrl)}" data-image-width="${variantImage?.width ?? ""}" data-image-height="${variantImage?.height ?? ""}"` : ""} data-price="${variant.price}" data-compare-at="${variant.compareAtPrice ?? ""}" data-available="${String(variant.available)}"${variant.available ? "" : " disabled"}>${escapeHtml(variant.title)} · ${escapeHtml(formatMoney(variant.price))}${variant.available ? "" : " · Agotado"}</option>`;
      })
      .join("");
    const optionNames = [
      ...new Set(product.variants.flatMap((variant) => Object.keys(variant.optionValues))),
    ];
    const optionControls = optionNames
      .map((optionName) => {
        const values = [
          ...new Set(
            product.variants
              .map((variant) => variant.optionValues[optionName])
              .filter((value): value is string => Boolean(value)),
          ),
        ];
        const controls = values
          .map((value) => {
            const matching = product.variants.filter(
              (variant) => variant.optionValues[optionName] === value,
            );
            const selected = matching[0];
            const available = matching.some((variant) => variant.available);
            return `<button type="button" class="catalog-option-pill" data-variant-option data-option-key="${escapeAttribute(optionName)}" data-option-value="${escapeAttribute(value)}" data-variant-id="${escapeAttribute(selected?.id ?? "")}" aria-pressed="${String(selected?.id === firstVariant?.id)}"${available ? "" : " disabled"}>${escapeHtml(value)}</button>`;
          })
          .join("");
        return `<fieldset class="catalog-option-group"><legend>${escapeHtml(optionName)}</legend><div>${controls}</div></fieldset>`;
      })
      .join("");
    const variantLinks = product.variants
      .map(
        (variant) =>
          `<a href="/productos/${escapeAttribute(product.slug)}/?variant=${escapeAttribute(variant.id)}">${escapeHtml(variant.title)}</a>`,
      )
      .join("");
    const compareAt =
      context.settings.showCompareAtPrice && firstVariant?.compareAtPrice
        ? formatMoney(firstVariant.compareAtPrice)
        : "";
    const description = context.settings.showDescription
      ? `<div class="catalog-rich-text" data-product-tab-panel="details">${product.richDescription ? sanitizeRichText(product.richDescription) : `<p>${escapeHtml(product.description)}</p>`}</div>`
      : "";
    const reviewSummary = catalogReviewSummary(product);
    const reviews = (product.reviews ?? []).filter((review) => review.visible).slice(0, 6);
    const detailsPanelId = `catalog-product-details-${context.section.id}`;
    const policiesPanelId = `catalog-product-policies-${context.section.id}`;
    const reviewsPanelId = `catalog-product-reviews-${context.section.id}`;
    const reviewSection = reviews.length
      ? `<section id="${escapeAttribute(reviewsPanelId)}" class="catalog-product-reviews" data-product-tab-panel="reviews" data-motion-zone="items"><header><div><p class="catalog-eyebrow">Experiencias reales</p><h2>Lo que dicen quienes compraron</h2></div>${reviewSummary ? `<p class="catalog-review-average"><strong>${reviewSummary.average.toFixed(1)}</strong> / 5 · ${reviewSummary.count} reseñas</p>` : ""}</header><div class="catalog-review-grid">${reviews.map((review) => `<article class="catalog-review"><p class="catalog-product-rating" aria-label="${review.rating} de 5">${"★".repeat(review.rating)}</p><h3>${escapeHtml(review.authorName)}</h3>${review.title ? `<strong>${escapeHtml(review.title)}</strong>` : ""}<blockquote>${escapeHtml(review.body)}</blockquote><small>${review.verifiedPurchase ? "Compra verificada · " : ""}${escapeHtml(new Intl.DateTimeFormat("es-AR", { dateStyle: "medium" }).format(new Date(review.publishedAt)))}</small></article>`).join("")}</div></section>`
      : "";
    const productTabs = `<nav class="catalog-product-tabs" role="tablist" aria-label="Información del producto"><button type="button" role="tab" data-product-tab="details" aria-controls="${escapeAttribute(detailsPanelId)}" aria-selected="true">Detalles</button><button type="button" role="tab" data-product-tab="policies" aria-controls="${escapeAttribute(policiesPanelId)}" aria-selected="false">Envíos y cambios</button>${reviews.length ? `<button type="button" role="tab" data-product-tab="reviews" aria-controls="${escapeAttribute(reviewsPanelId)}" aria-selected="false">Reseñas</button>` : ""}</nav>`;
    return moduleRoot(
      "catalog-product-detail",
      context.section,
      safeHtml(`<div class="catalog-product-detail-shell" data-product-tabs><div class="catalog-product-detail-inner" data-motion-zone="content" data-product data-product-id="${escapeAttribute(product.id)}" data-product-title="${escapeAttribute(product.title)}" data-default-variant="${escapeAttribute(firstVariant?.id ?? "")}" >
        ${gallery}
        <div class="catalog-product-info">
          <p class="catalog-product-brand">${escapeHtml(product.brand)}</p>
          <h1>${escapeHtml(product.title)}</h1>
          ${reviewSummary ? `<p class="catalog-product-rating" aria-label="${reviewSummary.average.toFixed(1)} de 5">${"★".repeat(Math.round(reviewSummary.average))}<span>${reviewSummary.average.toFixed(1)} / 5 · ${reviewSummary.count} reseñas</span></p>` : ""}
          <p class="catalog-detail-price"><span data-product-price>${escapeHtml(formatMoney(lowestPrice(product)))}</span><del data-product-compare${compareAt ? "" : " hidden"}>${escapeHtml(compareAt)}</del></p>
          ${description}
          <form class="catalog-add-form" action="/carrito/" method="get" data-solara-add-form>
            <input type="hidden" name="product" value="${escapeAttribute(product.id)}">
            <label for="catalog-variant-${escapeAttribute(context.section.id)}">Elegí talle y color</label>
            <select id="catalog-variant-${escapeAttribute(context.section.id)}" name="variant" data-variant-select required>${variants}</select>
            ${optionControls ? `<div class="catalog-variant-options" aria-label="Opciones del producto">${optionControls}</div>` : ""}
            <div class="catalog-quantity-row"><label for="catalog-quantity-${escapeAttribute(context.section.id)}">Cantidad</label><input id="catalog-quantity-${escapeAttribute(context.section.id)}" name="quantity" type="number" min="1" max="99" value="1" inputmode="numeric"></div>
            <button class="catalog-product-add" type="submit" data-add-to-cart>${escapeHtml(context.settings.actionLabel)}</button>
          </form>
          <nav class="catalog-variant-links" aria-label="Enlaces directos a variantes">${variantLinks}</nav>
          <p class="catalog-delivery-note">${escapeHtml(context.settings.deliveryNote)}</p>
          <dl id="${escapeAttribute(detailsPanelId)}" class="catalog-product-specs" data-product-tab-panel="details"><div><dt>SKU</dt><dd data-product-sku>${escapeHtml(firstVariant?.sku ?? "")}</dd></div><div><dt>Disponibilidad</dt><dd data-product-availability>${firstVariant?.available ? "Disponible" : "Agotado"}</dd></div></dl>
          <div id="${escapeAttribute(policiesPanelId)}" class="catalog-product-policies" data-product-tab-panel="policies"><details><summary>Envíos</summary><p>${escapeHtml(context.project.policies.shipping.details)}</p></details><details><summary>Cambios y devoluciones</summary><p>${escapeHtml(context.project.policies.returns.details)}</p></details></div>
        </div>
      </div>${productTabs}${reviewSection}</div>`),
    );
  },
};

const categoryBentoSettings = z.object({
  title: z.string().default("Explorá por categoría"),
  items: z
    .array(
      z.object({
        id: z.string().min(1),
        categoryId: z.string().min(1),
        imageId: z.string().default(""),
        size: z.enum(["wide", "compact"]).default("wide"),
      }),
    )
    .max(8)
    .default([]),
});

export const catalogCategoryBento: ModuleDefinition<z.infer<typeof categoryBentoSettings>> = {
  manifest: modernManifest({
    id: "catalog-category-bento",
    name: "Mosaico de categorías",
    description: "Categorías visuales en una composición responsive.",
    slots: ["catalog", "content"],
    compatibleSettings: ["title", "items"],
  }),
  settingsSchema: categoryBentoSettings,
  settingsFields: [
    { key: "title", type: "text", label: "Título" },
    {
      key: "items",
      type: "repeater",
      label: "Categorías",
      maxItems: 8,
      itemLabelKey: "categoryId",
      fields: [
        { key: "categoryId", label: "ID de categoría", type: "text" },
        { key: "imageId", label: "Imagen", type: "asset" },
        {
          key: "size",
          label: "Tamaño",
          type: "select",
          options: [
            { value: "wide", label: "Ancha" },
            { value: "compact", label: "Compacta" },
          ],
        },
      ],
    },
  ],
  motionZones: modernItemsZone,
  styleAsset: scopedAssetId("catalog-modern"),
  render(context) {
    const items = context.settings.items
      .map((item) => {
        const category = context.project.categories.find(
          (candidate) => candidate.id === item.categoryId,
        );
        if (!category) return "";
        const image = renderImage(context.project, item.imageId || category.imageId, {
          className: "catalog-category-bento-image",
          loading: "lazy",
          sizes: "(max-width: 767px) 92vw, 45vw",
          fallbackAlt: category.title,
        });
        return `<a class="catalog-category-bento-item catalog-category-bento-item--${item.size}" href="/categorias/${escapeAttribute(category.slug)}/"><span>${escapeHtml(category.title)}</span>${image}</a>`;
      })
      .filter(Boolean)
      .join("");
    return moduleRoot(
      "catalog-category-bento",
      context.section,
      safeHtml(
        `<div class="catalog-category-bento-section"><h2>${escapeHtml(context.settings.title)}</h2><div class="catalog-category-bento-grid" data-motion-zone="items">${items || '<p class="catalog-empty">No hay categorías configuradas.</p>'}</div></div>`,
      ),
    );
  },
};

const testimonialSchema = z.object({
  id: z.string().min(1),
  author: z.string().min(1),
  context: z.string().default(""),
  body: z.string().min(1),
  rating: z.number().int().min(1).max(5).default(5),
  example: z.boolean().default(true),
});
const testimonialSettings = z.object({
  title: z.string().default("Lo que dicen quienes nos eligen"),
  items: z.array(testimonialSchema).max(8).default([]),
});

export const catalogTestimonials: ModuleDefinition<z.infer<typeof testimonialSettings>> = {
  manifest: modernManifest({
    id: "catalog-testimonials",
    name: "Testimonios",
    description: "Testimonios editables en una fila controlada.",
    slots: ["trust", "content"],
    compatibleSettings: ["title", "items"],
  }),
  settingsSchema: testimonialSettings,
  settingsFields: [
    { key: "title", type: "text", label: "Título" },
    {
      key: "items",
      type: "repeater",
      label: "Testimonios",
      maxItems: 8,
      itemLabelKey: "author",
      fields: [
        { key: "author", label: "Nombre", type: "text" },
        { key: "context", label: "Contexto", type: "text" },
        { key: "body", label: "Texto", type: "text" },
        { key: "rating", label: "Valoración", type: "number", min: 1, max: 5, step: 1 },
        { key: "example", label: "Contenido de ejemplo", type: "boolean" },
      ],
    },
  ],
  motionZones: modernItemsZone,
  styleAsset: scopedAssetId("catalog-modern"),
  render(context) {
    const items = context.settings.items;
    if (!items.length) return moduleRoot("catalog-testimonials", context.section, safeHtml(""));
    return moduleRoot(
      "catalog-testimonials",
      context.section,
      safeHtml(
        `<div class="catalog-testimonials-section"><header><h2>${escapeHtml(context.settings.title)}</h2><div class="catalog-testimonials-controls"><button type="button" data-testimonials-prev aria-label="Testimonio anterior">←</button><button type="button" data-testimonials-next aria-label="Testimonio siguiente">→</button></div></header><div class="catalog-testimonials-track" data-motion-zone="items">${items.map((item) => `<article class="catalog-testimonial"><p class="catalog-testimonial-rating" aria-label="${item.rating} de 5">${"★".repeat(item.rating)}</p><h3>${escapeHtml(item.author)}</h3>${item.context ? `<p class="catalog-testimonial-context">${escapeHtml(item.context)}</p>` : ""}<blockquote>“${escapeHtml(item.body)}”</blockquote></article>`).join("")}</div></div>`,
      ),
    );
  },
};

const newsletterSettings = z.object({
  title: z.string().default("Recibí las próximas novedades"),
  body: z.string().default("Escribinos y te avisamos cuando llegue una nueva selección."),
  actionLabel: z.string().default("Escribir por WhatsApp"),
  actionHref: z.string().default("/contacto/"),
});

export const catalogNewsletterCta: ModuleDefinition<z.infer<typeof newsletterSettings>> = {
  manifest: modernManifest({
    id: "catalog-newsletter-cta",
    name: "CTA de novedades",
    description: "Bloque final de contacto sin formulario falso.",
    slots: ["content", "trust", "footer"],
    compatibleSettings: ["title", "body", "actionLabel", "actionHref"],
  }),
  settingsSchema: newsletterSettings,
  settingsFields: [
    { key: "title", type: "text", label: "Título" },
    { key: "body", type: "text", label: "Texto" },
    { key: "actionLabel", type: "text", label: "Botón" },
    { key: "actionHref", type: "url", label: "Destino" },
  ],
  motionZones: modernRevealZone,
  styleAsset: scopedAssetId("catalog-modern"),
  render(context) {
    return moduleRoot(
      "catalog-newsletter-cta",
      context.section,
      safeHtml(
        `<div class="catalog-newsletter-inner" data-motion-zone="content"><div><h2>${escapeHtml(context.settings.title)}</h2><p>${escapeHtml(context.settings.body)}</p></div><a class="catalog-newsletter-action" href="${escapeAttribute(safeUrl(context.settings.actionHref))}">${escapeHtml(context.settings.actionLabel)}</a></div>`,
      ),
    );
  },
};

const modernFooterSettings = z.object({
  note: z.string().default(""),
  showPolicies: z.boolean().default(true),
});

export const catalogFooter: ModuleDefinition<z.infer<typeof modernFooterSettings>> = {
  manifest: modernManifest({
    id: "catalog-footer",
    name: "Footer de catálogo",
    description: "Footer comercial con marca, enlaces y contacto.",
    slots: ["footer"],
    compatibleSettings: ["note", "showPolicies"],
  }),
  settingsSchema: modernFooterSettings,
  settingsFields: [
    { key: "note", type: "text", label: "Descripción" },
    { key: "showPolicies", type: "boolean", label: "Mostrar políticas" },
  ],
  motionZones: modernRevealZone,
  styleAsset: scopedAssetId("catalog-modern"),
  render(context) {
    const policyLinks = context.settings.showPolicies
      ? `<a href="/envios/">Envíos</a><a href="/devoluciones/">Cambios</a><a href="/privacidad/">Privacidad</a><a href="/terminos/">Términos</a>`
      : "";
    const note = context.settings.note || context.project.identity.description;
    const contact = [
      context.project.identity.email
        ? `<a href="mailto:${escapeAttribute(context.project.identity.email)}">${escapeHtml(context.project.identity.email)}</a>`
        : "",
      context.project.identity.phone
        ? `<a href="tel:${escapeAttribute(context.project.identity.phone)}">${escapeHtml(context.project.identity.phone)}</a>`
        : "",
    ]
      .filter(Boolean)
      .join("");
    return moduleRoot(
      "catalog-footer",
      context.section,
      safeHtml(
        `<div class="catalog-footer-inner" data-motion-zone="content"><div class="catalog-footer-brand"><a class="catalog-brand" href="/">${renderBrand(context.project)}</a><p>${escapeHtml(note)}</p></div><nav aria-label="Catálogo"><a href="/">Inicio</a><a href="/categorias/novedades/">Novedades</a><a href="/buscar/">Buscar</a></nav><nav aria-label="Ayuda"><a href="/contacto/">Contacto</a><a href="/nosotros/">Nosotros</a>${policyLinks}</nav><address>${contact}</address><small>© ${new Date(context.project.updatedAt).getUTCFullYear()} ${escapeHtml(context.project.identity.brandName)}</small></div>`,
      ),
      { tag: "footer" },
    );
  },
};

const modernCartSettings = z.object({
  title: z.string().default("Tu carrito"),
  emptyText: z.string().default("Todavía no agregaste productos."),
  checkoutLabel: z.string().default("Continuar por WhatsApp"),
});

export const catalogCartDrawer: ModuleDefinition<z.infer<typeof modernCartSettings>> = {
  manifest: modernManifest({
    id: "catalog-cart-drawer",
    name: "Carrito moderno",
    description: "Drawer accesible para revisar el pedido y continuar por WhatsApp.",
    slots: ["cart"],
    compatibleSettings: ["title", "emptyText", "checkoutLabel"],
  }),
  settingsSchema: modernCartSettings,
  settingsFields: [
    { key: "title", type: "text", label: "Título" },
    { key: "emptyText", type: "text", label: "Mensaje de carrito vacío" },
    { key: "checkoutLabel", type: "text", label: "Texto de checkout" },
  ],
  motionZones: modernRevealZone,
  clientAsset: "storefront-cart" as AssetId,
  styleAsset: scopedAssetId("catalog-modern"),
  render(context) {
    return moduleRoot(
      "catalog-cart-drawer",
      context.section,
      safeHtml(
        `<div class="solara-cart-backdrop catalog-cart-backdrop" data-solara-cart-close data-close-cart hidden></div><aside id="solara-cart" class="catalog-cart-drawer" data-cart-drawer aria-label="${escapeAttribute(context.settings.title)}" aria-hidden="true" inert tabindex="-1"><header><h2>${escapeHtml(context.settings.title)}</h2><button type="button" data-solara-cart-close data-close-cart aria-label="Cerrar carrito">Cerrar</button></header><div class="catalog-cart-items" data-solara-cart-items data-cart-lines><p class="catalog-empty">${escapeHtml(context.settings.emptyText)}</p></div><div class="catalog-cart-summary"><p><span>Subtotal</span><strong data-cart-subtotal>${escapeHtml(formatMoney(0))}</strong></p><p><span>Entrega</span><strong> A coordinar</strong></p><p class="catalog-cart-total"><span>Total estimado</span><strong data-solara-cart-total data-cart-total>${escapeHtml(formatMoney(0))}</strong></p></div><form class="catalog-checkout-form" data-solara-checkout data-checkout-form><label for="catalog-drawer-name">Nombre</label><input id="catalog-drawer-name" name="name" autocomplete="name" required><label for="catalog-drawer-phone">Teléfono</label><input id="catalog-drawer-phone" name="phone" autocomplete="tel" inputmode="tel" pattern="[0-9+ ()-]{8,}" title="Ingresá un teléfono válido" required><label for="catalog-drawer-address">Dirección o punto de entrega</label><textarea id="catalog-drawer-address" name="address" autocomplete="street-address" required></textarea><label for="catalog-drawer-notes">Notas opcionales</label><textarea id="catalog-drawer-notes" name="notes"></textarea><button class="catalog-primary-action" type="submit">${escapeHtml(context.settings.checkoutLabel)}</button><pre data-order-preview aria-live="polite"></pre><a data-whatsapp-link href="#" target="_blank" rel="noopener noreferrer" hidden>Enviar pedido en WhatsApp</a></form></aside>`,
      ),
    );
  },
};

export const catalogModernModules = [
  catalogAnnouncement,
  catalogHeader,
  catalogHero,
  catalogBrandStrip,
  catalogProductGrid,
  catalogProductDetail,
  catalogCategoryBento,
  catalogTestimonials,
  catalogNewsletterCta,
  catalogCartDrawer,
  catalogFooter,
] as const;

export function catalogReviewSummary(
  product: Product,
): { average: number; count: number } | undefined {
  const reviews = product.reviews?.filter((review: ProductReview) => review.visible) ?? [];
  if (!reviews.length) return undefined;
  return {
    average: reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length,
    count: reviews.length,
  };
}
