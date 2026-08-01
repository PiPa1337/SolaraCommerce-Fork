import {
  escapeAttribute,
  escapeHtml,
  findVideo,
  formatMoney,
  type ModuleDefinition,
  moduleRoot,
  renderImage,
  renderVideo,
  safeHtml,
  safeUrl,
  sanitizeRichText,
} from "@solara/module-sdk";
import type { AssetId } from "@solara/project-schema";
import { z } from "zod";
import {
  lowestPrice,
  productImage,
  renderBrand,
  renderProductCards,
  scopedAssetId,
  visibleProducts,
} from "./helpers";

const revealZone = [
  {
    id: "content",
    label: "Contenido",
    selector: '[data-motion-zone="content"]',
    allowedPresets: ["none", "fade", "fade-up", "slide", "scale"] as const,
  },
] as const;

const staggerZone = [
  {
    id: "items",
    label: "Elementos",
    selector: '[data-motion-zone="items"]',
    allowedPresets: ["none", "fade", "fade-up", "stagger"] as const,
  },
] as const;

const announcementSettings = z.object({
  text: z.string().default("Envíos a todo el país"),
  linkLabel: z.string().default(""),
  linkHref: z.string().default(""),
});

export const announcementBar: ModuleDefinition<z.infer<typeof announcementSettings>> = {
  manifest: {
    id: "announcement-bar",
    name: "Barra informativa",
    description: "Mensaje comercial breve con enlace opcional.",
    version: 1,
    slots: ["announcement"],
    compatibleSettings: ["text", "linkLabel", "linkHref"],
  },
  settingsSchema: announcementSettings,
  settingsFields: [
    { key: "text", type: "text", label: "Mensaje" },
    { key: "linkLabel", type: "text", label: "Texto del enlace" },
    { key: "linkHref", type: "url", label: "Destino del enlace" },
  ],
  motionZones: revealZone,
  styleAsset: scopedAssetId("announcement-bar"),
  render(context) {
    const link =
      context.settings.linkLabel && context.settings.linkHref
        ? `<a href="${escapeAttribute(safeUrl(context.settings.linkHref))}">${escapeHtml(context.settings.linkLabel)}</a>`
        : "";
    return moduleRoot(
      "announcement-bar",
      context.section,
      safeHtml(
        `<div class="solara-announcement" data-motion-zone="content"><p>${escapeHtml(context.settings.text)}</p>${link}</div>`,
      ),
    );
  },
};

const headerSettings = z.object({
  catalogLabel: z.string().default("Tienda"),
  catalogHref: z.string().default("/#productos"),
  showCategories: z.boolean().default(true),
  cartLabel: z.string().default("Carrito"),
});

export const editorialHeader: ModuleDefinition<z.infer<typeof headerSettings>> = {
  manifest: {
    id: "editorial-header",
    name: "Header editorial",
    description: "Navegación compacta de una sola línea con menú móvil nativo.",
    version: 1,
    slots: ["header"],
    compatibleSettings: ["catalogLabel", "catalogHref", "showCategories", "cartLabel"],
  },
  settingsSchema: headerSettings,
  settingsFields: [
    { key: "catalogLabel", type: "text", label: "Texto del catálogo" },
    { key: "catalogHref", type: "url", label: "Destino del catálogo" },
    { key: "showCategories", type: "boolean", label: "Mostrar categorías" },
    { key: "cartLabel", type: "text", label: "Texto del carrito" },
  ],
  motionZones: revealZone,
  clientAsset: "storefront-cart" as AssetId,
  styleAsset: scopedAssetId("editorial-header"),
  render(context) {
    const navigation = context.project.navigation;
    const nestedItems = navigation.items
      .map(
        (item) =>
          `<li><a href="${escapeAttribute(safeUrl(item.href ?? "#"))}">${escapeHtml(item.label)}</a>${
            item.children?.length
              ? `<ul>${item.children
                  .map(
                    (child) =>
                      `<li><a href="${escapeAttribute(safeUrl(child.href ?? "#"))}">${escapeHtml(child.label)}</a></li>`,
                  )
                  .join("")}</ul>`
              : ""
          }</li>`,
      )
      .join("");
    const homeCurrent = context.pageType === "home" ? ' aria-current="page"' : "";
    const catalogCurrent = ["category", "collection"].includes(context.pageType)
      ? ' aria-current="page"'
      : "";
    const contactCurrent = context.pageType === "contact" ? ' aria-current="page"' : "";
    const aboutCurrent = context.pageType === "about" ? ' aria-current="page"' : "";
    const searchCurrent = context.pageType === "search" ? ' aria-current="page"' : "";
    const cartCurrent = ["cart", "checkout"].includes(context.pageType)
      ? ' aria-current="page"'
      : "";
    const catalog = `<details class="solara-nav-dropdown"><summary${catalogCurrent}>${escapeHtml(navigation.catalogLabel || context.settings.catalogLabel)}</summary><ul>${nestedItems || `<li><a href="${escapeAttribute(safeUrl(context.settings.catalogHref))}">${escapeHtml(context.settings.catalogLabel)}</a></li>`}</ul></details>`;
    const nav = `${navigation.showHome ? `<a href="/"${homeCurrent}>Inicio</a>` : ""}${catalog}${navigation.showContact ? `<a href="/contacto/"${contactCurrent}>Contacto</a>` : ""}${navigation.showAbout ? `<a href="/nosotros/"${aboutCurrent}>Nosotros</a>` : ""}`;
    const actions = `${navigation.showSearch ? `<a class="solara-search-trigger" href="/buscar/" aria-label="Buscar productos"${searchCurrent}>Buscar</a>` : ""}${navigation.showCart ? `<button class="solara-cart-trigger" type="button" data-solara-cart-open data-open-cart aria-controls="solara-cart"${cartCurrent}>${escapeHtml(context.settings.cartLabel)} <span data-solara-cart-count data-cart-count aria-live="polite">0</span></button>` : ""}`;
    return moduleRoot(
      "editorial-header",
      context.section,
      safeHtml(`<div class="solara-header" data-motion-zone="content">
        <a class="solara-brand" href="/" aria-label="${escapeAttribute(`Inicio de ${context.project.identity.brandName}`)}">${renderBrand(context.project)}</a>
        <nav class="solara-desktop-nav" aria-label="Navegación principal">${nav}</nav>
        <div class="solara-header-actions">${actions}</div>
        <details class="solara-mobile-nav">
          <summary>Menú</summary>
          <nav aria-label="Navegación móvil">${nav}</nav>
        </details>
      </div>`),
      { tag: "header" },
    );
  },
};

const heroSettings = z.object({
  eyebrow: z.string().default(""),
  title: z.string().default("Objetos hechos para acompañarte"),
  body: z.string().default("Una selección precisa para el uso cotidiano."),
  actionLabel: z.string().default("Ver colección"),
  actionHref: z.string().default("/#productos"),
  imageId: z.string().default(""),
  imagePosition: z.enum(["left", "right"]).default("right"),
});

const heroSlideSchema = z.object({
  id: z.string().min(1),
  eyebrow: z.string().default(""),
  title: z.string().min(1),
  body: z.string().default(""),
  actionLabel: z.string().default("Ver colección"),
  actionHref: z.string().default("/categorias/mesa/"),
  imageId: z.string().default(""),
});

const heroMediaSettings = z.object({
  mode: z.enum(["image", "carousel", "video"]).default("image"),
  eyebrow: z.string().default(""),
  title: z.string().default("Objetos hechos para acompañarte"),
  body: z.string().default("Una selección precisa para el uso cotidiano."),
  actionLabel: z.string().default("Ver colección"),
  actionHref: z.string().default("/categorias/mesa/"),
  posterAssetId: z.string().default(""),
  videoAssetId: z.string().default(""),
  slides: z.array(heroSlideSchema).default([]),
  autoplay: z.boolean().default(true),
  intervalMs: z.number().int().min(3000).max(15000).default(6000),
  overlay: z.enum(["light", "dark", "none"]).default("dark"),
  alignment: z.enum(["left", "center"]).default("left"),
});

export const heroMedia: ModuleDefinition<z.infer<typeof heroMediaSettings>> = {
  manifest: {
    id: "hero-media",
    name: "Hero audiovisual",
    description: "Hero editorial con imagen, carrusel o video local autocontenido.",
    version: 1,
    slots: ["hero"],
    compatibleSettings: [
      "mode",
      "eyebrow",
      "title",
      "body",
      "actionLabel",
      "actionHref",
      "posterAssetId",
      "videoAssetId",
      "slides",
      "autoplay",
      "intervalMs",
      "overlay",
      "alignment",
    ],
  },
  settingsSchema: heroMediaSettings,
  settingsFields: [
    {
      key: "mode",
      type: "select",
      label: "Modo del hero",
      options: [
        { value: "image", label: "Imagen" },
        { value: "carousel", label: "Carrusel" },
        { value: "video", label: "Video local" },
      ],
    },
    { key: "eyebrow", type: "text", label: "Antetítulo" },
    { key: "title", type: "text", label: "Título" },
    { key: "body", type: "text", label: "Descripción" },
    { key: "actionLabel", type: "text", label: "Texto de la acción" },
    { key: "actionHref", type: "url", label: "Destino de la acción" },
    { key: "posterAssetId", type: "asset", label: "Poster / imagen" },
    { key: "videoAssetId", type: "asset", label: "Video local" },
    { key: "slides", type: "array", label: "Slides del carrusel" },
    { key: "autoplay", type: "boolean", label: "Reproducción automática" },
    {
      key: "intervalMs",
      type: "number",
      label: "Intervalo (ms)",
      min: 3000,
      max: 15000,
      step: 500,
    },
    {
      key: "overlay",
      type: "select",
      label: "Overlay",
      options: [
        { value: "light", label: "Claro" },
        { value: "dark", label: "Oscuro" },
        { value: "none", label: "Sin overlay" },
      ],
    },
    {
      key: "alignment",
      type: "select",
      label: "Alineación",
      options: [
        { value: "left", label: "Izquierda" },
        { value: "center", label: "Centro" },
      ],
    },
  ],
  motionZones: [
    ...revealZone,
    {
      id: "media",
      label: "Media",
      selector: '[data-motion-zone="media"]',
      allowedPresets: ["none", "fade", "scale", "parallax"] as const,
    },
  ],
  clientAsset: "storefront-hero" as AssetId,
  styleAsset: scopedAssetId("hero-media"),
  render(context) {
    const settings = context.settings;
    const fallbackImageId =
      settings.posterAssetId ||
      context.project.seo.socialImageId ||
      context.project.collections[0]?.imageId ||
      context.project.products[0]?.imageIds[0];
    const slide = settings.slides[0];
    const title = slide?.title || settings.title;
    const body = slide?.body || settings.body;
    const eyebrow = slide?.eyebrow || settings.eyebrow;
    const actionLabel = slide?.actionLabel || settings.actionLabel;
    const actionHref = slide?.actionHref || settings.actionHref;
    const imageId = slide?.imageId || fallbackImageId;
    const image = renderImage(context.project, imageId, {
      className: "solara-hero-media-image",
      loading: "eager",
      fetchPriority: "high",
      sizes: "100vw",
      fallbackAlt: title,
    });
    const video =
      settings.mode === "video"
        ? renderVideo(context.project, settings.videoAssetId, {
            className: "solara-hero-media-video",
            posterAssetId: settings.posterAssetId,
            preload: "metadata",
            fallbackAlt: title,
          })
        : "";
    const videoAsset = findVideo(context.project, settings.videoAssetId);
    const posterImage =
      settings.mode === "video"
        ? renderImage(context.project, settings.posterAssetId || videoAsset?.posterAssetId, {
            className: "solara-hero-media-poster",
            loading: "eager",
            fetchPriority: "high",
            sizes: "100vw",
            fallbackAlt: title,
          })
        : "";
    const media = settings.mode === "video" && video ? safeHtml(`${posterImage}${video}`) : image;
    const slides = settings.mode === "carousel" ? settings.slides : [];
    const slidePanels = slides
      .map((item, index) => {
        const slideImage = renderImage(context.project, item.imageId || fallbackImageId, {
          className: "solara-hero-media-image",
          loading: index === 0 ? "eager" : "lazy",
          sizes: "100vw",
          fallbackAlt: item.title,
        });
        return `<div class="solara-hero-slide-panel" data-hero-slide-panel="${index}" data-hero-active="${String(index === 0)}" data-hero-title="${escapeAttribute(item.title)}" data-hero-body="${escapeAttribute(item.body)}" data-hero-eyebrow="${escapeAttribute(item.eyebrow)}" data-hero-action-label="${escapeAttribute(item.actionLabel)}" data-hero-action-href="${escapeAttribute(safeUrl(item.actionHref))}">${slideImage}</div>`;
      })
      .join("");
    const indicators = slides.length
      ? `<div class="solara-hero-indicators" role="tablist" aria-label="Slides del hero">${slides
          .map(
            (_item, index) =>
              `<button type="button" data-hero-slide="${index}" role="tab" aria-label="Ir al slide ${index + 1}" aria-selected="${index === 0 ? "true" : "false"}"></button>`,
          )
          .join("")}</div>`
      : "";
    const controls =
      slides.length > 1
        ? `<div class="solara-hero-controls"><button type="button" data-hero-prev aria-label="Slide anterior">Anterior</button><button type="button" data-hero-next aria-label="Slide siguiente">Siguiente</button>${indicators}</div>`
        : "";
    return moduleRoot(
      "hero-media",
      context.section,
      safeHtml(`<div class="solara-hero-media-shell solara-hero-media-shell--${settings.alignment} solara-hero-media-shell--overlay-${settings.overlay}" data-hero-mode="${settings.mode}" data-hero-autoplay="${String(settings.autoplay)}" data-hero-interval="${settings.intervalMs}" data-motion-zone="media"${slides.length > 1 ? ' role="region" aria-roledescription="carousel" aria-label="Carrusel principal"' : ""}>
        <div class="solara-hero-media-backdrop">${settings.mode === "carousel" && slidePanels ? slidePanels : media}</div>
        <div class="solara-hero-media-copy" data-motion-zone="content">
          ${eyebrow ? `<p class="solara-eyebrow">${escapeHtml(eyebrow)}</p>` : ""}
          <h1>${escapeHtml(title)}</h1>
          <p class="solara-hero-body">${escapeHtml(body)}</p>
          <a class="solara-primary-action" href="${escapeAttribute(safeUrl(actionHref))}">${escapeHtml(actionLabel)}</a>
        </div>
        ${settings.mode === "video" && video ? '<button type="button" class="solara-hero-video-toggle" data-hero-video-toggle aria-pressed="false">Pausar video</button>' : ""}
        ${controls}
      </div>`),
    );
  },
};

export const splitHero: ModuleDefinition<z.infer<typeof heroSettings>> = {
  manifest: {
    id: "split-hero",
    name: "Hero dividido",
    description: "Composición asimétrica de contenido y fotografía.",
    version: 1,
    slots: ["hero"],
    compatibleSettings: [
      "eyebrow",
      "title",
      "body",
      "actionLabel",
      "actionHref",
      "imageId",
      "imagePosition",
    ],
  },
  settingsSchema: heroSettings,
  settingsFields: [
    { key: "eyebrow", type: "text", label: "Antetítulo" },
    { key: "title", type: "text", label: "Título" },
    { key: "body", type: "text", label: "Descripción" },
    { key: "actionLabel", type: "text", label: "Texto de la acción" },
    { key: "actionHref", type: "url", label: "Destino de la acción" },
    { key: "imageId", type: "asset", label: "Imagen" },
    {
      key: "imagePosition",
      type: "select",
      label: "Posición de la imagen",
      options: [
        { value: "left", label: "Izquierda" },
        { value: "right", label: "Derecha" },
      ],
    },
  ],
  motionZones: [
    ...revealZone,
    {
      id: "media",
      label: "Imagen",
      selector: '[data-motion-zone="media"]',
      allowedPresets: ["none", "fade", "scale", "parallax"] as const,
    },
  ],
  styleAsset: scopedAssetId("split-hero"),
  render(context) {
    const heroSettings = heroMedia.settingsSchema.parse({
      ...context.settings,
      posterAssetId: context.settings.imageId,
      alignment: context.settings.imagePosition === "left" ? "left" : "left",
    });
    return moduleRoot(
      "split-hero",
      context.section,
      safeHtml(String(heroMedia.render({ ...context, settings: heroSettings }))),
    );
  },
};

export const editorialHero: ModuleDefinition<z.infer<typeof heroSettings>> = {
  manifest: {
    id: "editorial-hero",
    name: "Hero editorial",
    description: "Titular manifiesto con la imagen integrada al ritmo de lectura.",
    version: 1,
    slots: ["hero"],
    compatibleSettings: [
      "eyebrow",
      "title",
      "body",
      "actionLabel",
      "actionHref",
      "imageId",
      "imagePosition",
    ],
  },
  settingsSchema: heroSettings,
  settingsFields: [
    { key: "eyebrow", type: "text", label: "Antetítulo" },
    { key: "title", type: "text", label: "Título" },
    { key: "body", type: "text", label: "Descripción" },
    { key: "actionLabel", type: "text", label: "Texto de la acción" },
    { key: "actionHref", type: "url", label: "Destino de la acción" },
    { key: "imageId", type: "asset", label: "Imagen" },
    {
      key: "imagePosition",
      type: "select",
      label: "Posición de la imagen",
      options: [
        { value: "left", label: "Izquierda" },
        { value: "right", label: "Derecha" },
      ],
    },
  ],
  motionZones: [
    ...revealZone,
    {
      id: "media",
      label: "Imagen",
      selector: '[data-motion-zone="media"]',
      allowedPresets: ["none", "fade", "scale", "parallax"] as const,
    },
  ],
  styleAsset: scopedAssetId("editorial-hero"),
  render(context) {
    const imageId =
      context.settings.imageId ||
      context.project.seo.socialImageId ||
      context.project.collections[0]?.imageId ||
      context.project.products[0]?.imageIds[0];
    const image = renderImage(context.project, imageId, {
      className: "solara-hero-image",
      loading: "eager",
      fetchPriority: "high",
      sizes: "(max-width: 767px) 100vw, 64vw",
      fallbackAlt: context.settings.title,
    });
    return moduleRoot(
      "editorial-hero",
      context.section,
      safeHtml(`<div class="solara-editorial-hero">
        <div class="solara-editorial-head" data-motion-zone="content">
          ${context.settings.eyebrow ? `<p class="solara-eyebrow">${escapeHtml(context.settings.eyebrow)}</p>` : ""}
          <h1>${escapeHtml(context.settings.title)}</h1>
          <p>${escapeHtml(context.settings.body)}</p>
          <a class="solara-primary-action" href="${escapeAttribute(safeUrl(context.settings.actionHref))}">${escapeHtml(context.settings.actionLabel)}</a>
        </div>
        <figure data-motion-zone="media">${image}</figure>
      </div>`),
    );
  },
};

const collectionSettings = z.object({
  title: z.string().default("Colecciones"),
  limit: z.number().int().min(1).max(12).default(6),
});

export const collectionGrid: ModuleDefinition<z.infer<typeof collectionSettings>> = {
  manifest: {
    id: "collection-grid",
    name: "Grilla de colecciones",
    description: "Colecciones visuales con jerarquía asimétrica.",
    version: 1,
    slots: ["catalog"],
    compatibleSettings: ["title", "limit"],
  },
  settingsSchema: collectionSettings,
  settingsFields: [
    { key: "title", type: "text", label: "Título" },
    { key: "limit", type: "number", label: "Cantidad", min: 1, max: 12, step: 1 },
  ],
  motionZones: staggerZone,
  styleAsset: scopedAssetId("collection-grid"),
  render(context) {
    const items = context.project.collections.slice(0, context.settings.limit).map((collection) => {
      const image = renderImage(context.project, collection.imageId, {
        className: "solara-collection-image",
        sizes: "(max-width: 767px) 92vw, 48vw",
        fallbackAlt: collection.title,
      });
      return `<article class="solara-collection-card">
        <a href="/colecciones/${escapeAttribute(collection.slug)}/">
          <figure>${image}</figure>
          <div><h3>${escapeHtml(collection.title)}</h3><p>${escapeHtml(collection.description)}</p></div>
        </a>
      </article>`;
    });
    return moduleRoot(
      "collection-grid",
      context.section,
      safeHtml(`<div class="solara-section-shell">
        <h2>${escapeHtml(context.settings.title)}</h2>
        <div class="solara-collection-grid" data-motion-zone="items">${items.join("")}</div>
      </div>`),
    );
  },
};

const productGridSettings = z.object({
  title: z.string().default("Productos"),
  limit: z.number().int().min(1).max(48).default(12),
});

export const editorialProductGrid: ModuleDefinition<z.infer<typeof productGridSettings>> = {
  manifest: {
    id: "editorial-product-grid",
    name: "Grilla editorial de productos",
    description: "Catálogo espacioso orientado a fotografía y relato.",
    version: 1,
    slots: ["catalog"],
    compatibleSettings: ["title", "limit"],
  },
  settingsSchema: productGridSettings,
  settingsFields: [
    { key: "title", type: "text", label: "Título" },
    { key: "limit", type: "number", label: "Cantidad", min: 1, max: 48, step: 1 },
  ],
  motionZones: staggerZone,
  styleAsset: scopedAssetId("editorial-product-grid"),
  render(context) {
    const products = visibleProducts(context).slice(0, context.settings.limit);
    return moduleRoot(
      "editorial-product-grid",
      context.section,
      safeHtml(`<div class="solara-section-shell" id="productos">
        <h2>${escapeHtml(context.settings.title)}</h2>
        <div class="solara-editorial-products" data-motion-zone="items"${context.pageType === "category" ? " data-category-grid" : ""}>${renderProductCards(context.project, products, "editorial")}</div>
      </div>`),
    );
  },
};

export const compactProductGrid: ModuleDefinition<z.infer<typeof productGridSettings>> = {
  manifest: {
    id: "compact-product-grid",
    name: "Grilla compacta de productos",
    description: "Vista de mayor densidad para catálogos extensos.",
    version: 1,
    slots: ["catalog"],
    compatibleSettings: ["title", "limit"],
  },
  settingsSchema: productGridSettings,
  settingsFields: [
    { key: "title", type: "text", label: "Título" },
    { key: "limit", type: "number", label: "Cantidad", min: 1, max: 48, step: 1 },
  ],
  motionZones: staggerZone,
  styleAsset: scopedAssetId("compact-product-grid"),
  render(context) {
    const products = visibleProducts(context).slice(0, context.settings.limit);
    return moduleRoot(
      "compact-product-grid",
      context.section,
      safeHtml(`<div class="solara-section-shell" id="productos">
        <h2>${escapeHtml(context.settings.title)}</h2>
        <div class="solara-compact-products" data-motion-zone="items"${context.pageType === "category" ? " data-category-grid" : ""}>${renderProductCards(context.project, products, "compact")}</div>
      </div>`),
    );
  },
};

const productDetailSettings = z.object({
  actionLabel: z.string().default("Agregar al carrito"),
  showDescription: z.boolean().default(true),
  showCompareAtPrice: z.boolean().default(true),
  deliveryNote: z.string().default("Coordinamos entrega y pago por WhatsApp."),
});

export const productDetail: ModuleDefinition<z.infer<typeof productDetailSettings>> = {
  manifest: {
    id: "product-detail",
    name: "Detalle de producto",
    description: "Galería, variantes, precio y acción de compra semánticos.",
    version: 1,
    slots: ["product"],
    compatibleSettings: ["actionLabel", "showDescription", "showCompareAtPrice", "deliveryNote"],
  },
  settingsSchema: productDetailSettings,
  settingsFields: [
    { key: "actionLabel", type: "text", label: "Texto de la acción" },
    { key: "showDescription", type: "boolean", label: "Mostrar descripción" },
    { key: "showCompareAtPrice", type: "boolean", label: "Mostrar precio anterior" },
    { key: "deliveryNote", type: "text", label: "Nota de entrega" },
  ],
  motionZones: revealZone,
  clientAsset: "storefront-cart" as AssetId,
  styleAsset: scopedAssetId("product-detail"),
  render(context) {
    const product = context.product ?? visibleProducts(context)[0];
    if (!product) {
      return moduleRoot(
        "product-detail",
        context.section,
        safeHtml('<p class="solara-empty-state">Este producto no está disponible.</p>'),
      );
    }
    const firstVariant = product.variants[0];
    const variants = product.variants
      .map(
        (variant) =>
          `<option value="${escapeAttribute(variant.id)}" data-variant-data="${escapeAttribute(variant.id)}" data-variant-id="${escapeAttribute(variant.id)}" data-variant-title="${escapeAttribute(variant.title)}" data-sku="${escapeAttribute(variant.sku)}" data-price="${variant.price}" data-available="${String(variant.available)}" ${variant.available ? "" : "disabled"}>${escapeHtml(variant.title)} - ${escapeHtml(formatMoney(variant.price))}${variant.available ? "" : " - Agotado"}</option>`,
      )
      .join("");
    const variantLinks = product.variants
      .map(
        (variant) =>
          `<a href="/productos/${escapeAttribute(product.slug)}/?variant=${escapeAttribute(variant.id)}">${escapeHtml(variant.title)}</a>`,
      )
      .join("");
    const compareAt =
      context.settings.showCompareAtPrice && firstVariant?.compareAtPrice
        ? `<del>${escapeHtml(formatMoney(firstVariant.compareAtPrice))}</del>`
        : "";
    const description = context.settings.showDescription
      ? `<div class="solara-rich-text">${product.richDescription ? sanitizeRichText(product.richDescription) : `<p>${escapeHtml(product.description)}</p>`}</div>`
      : "";

    return moduleRoot(
      "product-detail",
      context.section,
      safeHtml(`<div class="solara-product-detail" data-motion-zone="content" data-product data-product-id="${escapeAttribute(product.id)}" data-product-title="${escapeAttribute(product.title)}" data-default-variant="${escapeAttribute(firstVariant?.id ?? "")}">
        <figure>${productImage(context.project, product, true)}</figure>
        <div class="solara-product-info">
          <p class="solara-product-brand">${escapeHtml(product.brand)}</p>
          <h1>${escapeHtml(product.title)}</h1>
          <p class="solara-detail-price" data-solara-product-price data-product-price>${escapeHtml(formatMoney(lowestPrice(product)))} ${compareAt}</p>
          ${description}
          <form action="/carrito/" method="get" data-solara-add-form>
            <input type="hidden" name="product" value="${escapeAttribute(product.id)}">
            <label for="variant-${escapeAttribute(context.section.id)}">Variante</label>
            <select id="variant-${escapeAttribute(context.section.id)}" name="variant" data-variant-select required>${variants}</select>
            <label for="quantity-${escapeAttribute(context.section.id)}">Cantidad</label>
            <input id="quantity-${escapeAttribute(context.section.id)}" name="quantity" type="number" min="1" max="99" value="1" inputmode="numeric">
            <button type="submit" data-add-to-cart>${escapeHtml(context.settings.actionLabel)}</button>
          </form>
          <nav class="solara-variant-links" aria-label="Enlaces directos a variantes">${variantLinks}</nav>
          <p class="solara-delivery-note">${escapeHtml(context.settings.deliveryNote)}</p>
        </div>
      </div>`),
    );
  },
};

const imageTextSettings = z.object({
  title: z.string().default("Materiales que se sienten"),
  body: z.string().default("<p>Elegimos piezas útiles, honestas y duraderas.</p>"),
  imageId: z.string().default(""),
  imageSide: z.enum(["left", "right"]).default("left"),
  actionLabel: z.string().default(""),
  actionHref: z.string().default(""),
});

export const imageTextContent: ModuleDefinition<z.infer<typeof imageTextSettings>> = {
  manifest: {
    id: "image-text-content",
    name: "Contenido imagen y texto",
    description: "Bloque narrativo con texto enriquecido sanitizado.",
    version: 1,
    slots: ["content"],
    compatibleSettings: ["title", "body", "imageId", "imageSide", "actionLabel", "actionHref"],
  },
  settingsSchema: imageTextSettings,
  settingsFields: [
    { key: "title", type: "text", label: "Título" },
    { key: "body", type: "rich-text", label: "Contenido" },
    { key: "imageId", type: "asset", label: "Imagen" },
    {
      key: "imageSide",
      type: "select",
      label: "Posición de la imagen",
      options: [
        { value: "left", label: "Izquierda" },
        { value: "right", label: "Derecha" },
      ],
    },
    { key: "actionLabel", type: "text", label: "Texto de la acción" },
    { key: "actionHref", type: "url", label: "Destino de la acción" },
  ],
  motionZones: [
    ...revealZone,
    {
      id: "media",
      label: "Imagen",
      selector: '[data-motion-zone="media"]',
      allowedPresets: ["none", "fade", "scale", "parallax"] as const,
    },
  ],
  styleAsset: scopedAssetId("image-text-content"),
  render(context) {
    const action =
      context.settings.actionLabel && context.settings.actionHref
        ? `<a class="solara-secondary-action" href="${escapeAttribute(safeUrl(context.settings.actionHref))}">${escapeHtml(context.settings.actionLabel)}</a>`
        : "";
    const imageId =
      context.settings.imageId ||
      context.project.seo.socialImageId ||
      context.project.collections[0]?.imageId ||
      context.project.products[0]?.imageIds[0];
    const image = renderImage(context.project, imageId, {
      className: "solara-content-image",
      sizes: "(max-width: 767px) 92vw, 50vw",
      fallbackAlt: context.settings.title,
    });
    return moduleRoot(
      "image-text-content",
      context.section,
      safeHtml(`<div class="solara-image-text solara-image-text--${context.settings.imageSide}">
        <figure data-motion-zone="media">${image}</figure>
        <div data-motion-zone="content">
          <h2>${escapeHtml(context.settings.title)}</h2>
          <div class="solara-rich-text">${sanitizeRichText(context.settings.body)}</div>
          ${action}
        </div>
      </div>`),
    );
  },
};

const trustSettings = z.object({
  title: z.string().default("Comprar con claridad"),
  deliveryTitle: z.string().default("Entrega coordinada"),
  returnsTitle: z.string().default("Cambios simples"),
  contactTitle: z.string().default("Atención directa"),
});

export const trustStrip: ModuleDefinition<z.infer<typeof trustSettings>> = {
  manifest: {
    id: "trust-strip",
    name: "Beneficios y confianza",
    description: "Información operativa de entrega, cambios y contacto.",
    version: 1,
    slots: ["trust"],
    compatibleSettings: ["title", "deliveryTitle", "returnsTitle", "contactTitle"],
  },
  settingsSchema: trustSettings,
  settingsFields: [
    { key: "title", type: "text", label: "Título" },
    { key: "deliveryTitle", type: "text", label: "Título de entrega" },
    { key: "returnsTitle", type: "text", label: "Título de cambios" },
    { key: "contactTitle", type: "text", label: "Título de contacto" },
  ],
  motionZones: staggerZone,
  styleAsset: scopedAssetId("trust-strip"),
  render(context) {
    return moduleRoot(
      "trust-strip",
      context.section,
      safeHtml(`<div class="solara-trust">
        <h2>${escapeHtml(context.settings.title)}</h2>
        <div class="solara-trust-grid" data-motion-zone="items">
          <article><h3>${escapeHtml(context.settings.deliveryTitle)}</h3><p>${escapeHtml(context.project.policies.shipping.summary)}</p></article>
          <article><h3>${escapeHtml(context.settings.returnsTitle)}</h3><p>${escapeHtml(context.project.policies.returns.summary)}</p></article>
          <article><h3>${escapeHtml(context.settings.contactTitle)}</h3><p>Confirmamos disponibilidad y detalles antes del pago.</p></article>
        </div>
      </div>`),
    );
  },
};

const cartSettings = z.object({
  title: z.string().default("Tu carrito"),
  emptyText: z.string().default("Todavía no agregaste productos."),
  checkoutLabel: z.string().default("Continuar por WhatsApp"),
});

export const cartDrawer: ModuleDefinition<z.infer<typeof cartSettings>> = {
  manifest: {
    id: "cart-drawer",
    name: "Carrito lateral",
    description: "Shell accesible para carrito y checkout por WhatsApp.",
    version: 1,
    slots: ["cart"],
    compatibleSettings: ["title", "emptyText", "checkoutLabel"],
  },
  settingsSchema: cartSettings,
  settingsFields: [
    { key: "title", type: "text", label: "Título" },
    { key: "emptyText", type: "text", label: "Mensaje de carrito vacío" },
    { key: "checkoutLabel", type: "text", label: "Texto de checkout" },
  ],
  motionZones: revealZone,
  clientAsset: "storefront-cart" as AssetId,
  styleAsset: scopedAssetId("cart-drawer"),
  render(context) {
    return moduleRoot(
      "cart-drawer",
      context.section,
      safeHtml(`<div class="solara-cart-backdrop" data-solara-cart-close data-close-cart hidden></div>
        <aside id="solara-cart" class="solara-cart-drawer" data-cart-drawer aria-label="${escapeAttribute(context.settings.title)}" aria-hidden="true" inert>
          <header><h2>${escapeHtml(context.settings.title)}</h2><button type="button" data-solara-cart-close data-close-cart aria-label="Cerrar carrito">Cerrar</button></header>
          <div data-solara-cart-items data-cart-lines><p class="solara-empty-state">${escapeHtml(context.settings.emptyText)}</p></div>
          <div class="solara-cart-total"><span>Total</span><strong data-solara-cart-total data-cart-total>${escapeHtml(formatMoney(0))}</strong></div>
          <form data-solara-checkout data-checkout-form>
            <label for="solara-drawer-customer-name">Nombre</label>
            <input id="solara-drawer-customer-name" name="name" autocomplete="name" required>
            <label for="solara-drawer-customer-phone">Teléfono</label>
            <input id="solara-drawer-customer-phone" name="phone" autocomplete="tel" inputmode="tel" pattern="[0-9+ ()-]{8,}" title="Ingresá un teléfono válido" required>
            <label for="solara-drawer-customer-address">Dirección o punto de entrega</label>
            <textarea id="solara-drawer-customer-address" name="address" autocomplete="street-address" required></textarea>
            <label for="solara-drawer-customer-notes">Notas opcionales</label>
            <textarea id="solara-drawer-customer-notes" name="notes"></textarea>
            <button type="submit">${escapeHtml(context.settings.checkoutLabel)}</button>
            <pre data-order-preview aria-live="polite"></pre>
            <a data-whatsapp-link href="#" target="_blank" rel="noopener noreferrer" hidden>Enviar pedido en WhatsApp</a>
          </form>
        </aside>`),
    );
  },
};

const footerSettings = z.object({
  note: z.string().default(""),
  showPolicies: z.boolean().default(true),
});

export const editorialFooter: ModuleDefinition<z.infer<typeof footerSettings>> = {
  manifest: {
    id: "editorial-footer",
    name: "Footer editorial",
    description: "Cierre de marca, contacto y políticas comerciales.",
    version: 1,
    slots: ["footer"],
    compatibleSettings: ["note", "showPolicies"],
  },
  settingsSchema: footerSettings,
  settingsFields: [
    { key: "note", type: "text", label: "Nota" },
    { key: "showPolicies", type: "boolean", label: "Mostrar políticas" },
  ],
  motionZones: revealZone,
  styleAsset: scopedAssetId("editorial-footer"),
  render(context) {
    const policies = context.settings.showPolicies
      ? '<nav aria-label="Políticas"><a href="/envios/">Envíos</a><a href="/devoluciones/">Devoluciones</a><a href="/privacidad/">Privacidad</a><a href="/terminos/">Términos</a></nav>'
      : "";
    const note = context.settings.note || context.project.identity.description;
    return moduleRoot(
      "editorial-footer",
      context.section,
      safeHtml(`<div class="solara-footer" data-motion-zone="content">
        <div><a class="solara-brand" href="/">${renderBrand(context.project)}</a><p>${escapeHtml(note)}</p></div>
        ${policies}
        <address><a href="mailto:${escapeAttribute(context.project.identity.email)}">${escapeHtml(context.project.identity.email)}</a><a href="tel:${escapeAttribute(context.project.identity.phone)}">${escapeHtml(context.project.identity.phone)}</a><span>${escapeHtml(context.project.identity.address)}</span></address>
        <small>© ${new Date(context.project.updatedAt).getUTCFullYear()} ${escapeHtml(context.project.identity.brandName)}</small>
      </div>`),
      { tag: "footer" },
    );
  },
};

export const officialModules = [
  announcementBar,
  editorialHeader,
  heroMedia,
  splitHero,
  editorialHero,
  collectionGrid,
  editorialProductGrid,
  compactProductGrid,
  productDetail,
  imageTextContent,
  trustStrip,
  cartDrawer,
  editorialFooter,
] as const;
