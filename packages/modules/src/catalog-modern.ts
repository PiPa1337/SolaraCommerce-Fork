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
import {
  type AssetId,
  type CategoryId,
  getCategoryBreadcrumb,
  getCategoryProductIds,
  type Product,
  type ProductReview,
} from "@solara/project-schema";
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

const modernManifest = <Id extends string>(input: {
  id: Id;
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

export const catalogAnnouncement: ModuleDefinition<
  "catalog-announcement",
  z.infer<typeof announcementSettings>
> = {
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
        ? `<a href="${escapeAttribute(safeUrl(context.settings.linkHref))}" data-magnetic>${escapeHtml(context.settings.linkLabel)}</a>`
        : "";
    return moduleRoot(
      "catalog-announcement",
      context.section,
      safeHtml(
        `<div class="catalog-announcement-inner solara-announcement" data-motion-zone="content"><span>${escapeHtml(context.settings.text)}</span>${link}<button type="button" data-catalog-announcement-close aria-label="Cerrar anuncio">×</button></div>`,
      ),
      { tag: "header" },
    );
  },
};

const headerSettings = z.object({
  cartLabel: z.string().default("Carrito"),
  searchLabel: z.string().default("Buscar productos"),
});

export const catalogHeader: ModuleDefinition<"catalog-header", z.infer<typeof headerSettings>> = {
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
    const current = (types: string[]) =>
      types.includes(context.pageType ?? "") ? ' aria-current="page"' : "";
    const configuredCatalogLabel = navigation.catalogLabel.trim();
    // "Tienda" was the previous default; keep it readable while preserving other custom labels.
    const catalogLabel =
      configuredCatalogLabel && configuredCatalogLabel.toLowerCase() !== "tienda"
        ? configuredCatalogLabel
        : "Categorías";
    const icon = (name: "home" | "categories" | "contact" | "about"): string => {
      const paths = {
        home: '<path d="m3.5 10.5 8.5-7 8.5 7v9a1 1 0 0 1-1 1h-5v-6h-5v6h-5a1 1 0 0 1-1-1z"></path>',
        categories:
          '<path d="m4 7 8-4 8 4-8 4z"></path><path d="m4 12 8 4 8-4"></path><path d="m4 17 8 4 8-4"></path>',
        contact:
          '<rect x="3" y="5" width="18" height="14" rx="2"></rect><path d="m4 7 8 6 8-6"></path>',
        about:
          '<circle cx="8" cy="8" r="3"></circle><circle cx="17" cy="9" r="2.5"></circle><path d="M2.5 19a5.5 5.5 0 0 1 11 0"></path><path d="M13 18a4.5 4.5 0 0 1 8.5 1"></path>',
      } as const;
      return `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">${paths[name]}</svg>`;
    };
    const chevron =
      '<span class="catalog-nav-chevron" aria-hidden="true"><svg viewBox="0 0 24 24" focusable="false"><path d="m6 9 6 6 6-6"></path></svg></span>';
    const forwardChevron =
      '<span class="catalog-nav-chevron catalog-nav-chevron--forward" aria-hidden="true"><svg viewBox="0 0 24 24" focusable="false"><path d="m9 6 6 6-6 6"></path></svg></span>';
    const desktopMenuItems = navigationItems
      .map((item) => {
        const hasChildren = Boolean(item.children?.length);
        const children = hasChildren
          ? `<ul class="catalog-mega-group__children" aria-label="${escapeAttribute(`Subcategorías de ${item.label}`)}">${item.children
              ?.map(
                (child) =>
                  `<li><a href="${escapeAttribute(safeUrl(child.href ?? "#"))}">${escapeHtml(child.label)}</a></li>`,
              )
              .join("")}</ul>`
          : "";
        return `<li class="catalog-mega-group${hasChildren ? " catalog-mega-group--has-children" : ""}"><a class="catalog-mega-group__link" href="${escapeAttribute(safeUrl(item.href ?? "#"))}"><span>${escapeHtml(item.label)}</span></a>${children}</li>`;
      })
      .join("");
    const desktopMenu = navigationItems.length
      ? `<div id="catalog-category-menu" class="catalog-mega-menu" role="group" aria-label="Categorías"><ul class="catalog-mega-menu__groups">${desktopMenuItems}</ul><a class="catalog-mega-menu__all" href="/buscar/">Ver todos los productos <span aria-hidden="true">→</span></a></div>`
      : "";
    const catalog = navigationItems.length
      ? `<details class="catalog-nav-menu"><summary class="catalog-nav-trigger" aria-controls="catalog-category-menu" aria-haspopup="true" aria-expanded="false"${current(["category", "collection"])}>${escapeHtml(catalogLabel)}${chevron}</summary>${desktopMenu}</details>`
      : `<a class="catalog-nav-empty" href="/buscar/"${current(["category", "collection"])}>${escapeHtml(catalogLabel)}</a>`;
    const mobileCategoryItems = navigationItems
      .map((item, index) => {
        const children = item.children ?? [];
        if (children.length === 0) {
          return `<a class="catalog-mobile-category-link" href="${escapeAttribute(safeUrl(item.href ?? "#"))}"><span class="catalog-mobile-nav-icon" aria-hidden="true">${icon("categories")}</span><span>${escapeHtml(item.label)}</span>${forwardChevron}</a>`;
        }
        const panelId = `catalog-mobile-category-${index}-panel`;
        return `<details class="catalog-mobile-category"><summary aria-controls="${panelId}" aria-expanded="false"><span class="catalog-mobile-nav-icon" aria-hidden="true">${icon("categories")}</span><span>${escapeHtml(item.label)}</span>${chevron}</summary><ul id="${panelId}" class="catalog-mobile-category__children"><li><a class="catalog-mobile-category__parent" href="${escapeAttribute(safeUrl(item.href ?? "#"))}">Ver ${escapeHtml(item.label)}</a></li>${children
          .map(
            (child) =>
              `<li><a href="${escapeAttribute(safeUrl(child.href ?? "#"))}">${escapeHtml(child.label)}</a></li>`,
          )
          .join("")}</ul></details>`;
      })
      .join("");
    const mobileCategories = navigationItems.length
      ? `<details class="catalog-mobile-categories"><summary aria-controls="catalog-mobile-categories-panel" aria-expanded="false"><span class="catalog-mobile-nav-icon" aria-hidden="true">${icon("categories")}</span><span>${escapeHtml(catalogLabel)}</span>${chevron}</summary><div id="catalog-mobile-categories-panel" class="catalog-mobile-categories__panel">${mobileCategoryItems}</div></details>`
      : `<a class="catalog-mobile-nav-link" href="/buscar/"><span class="catalog-mobile-nav-icon" aria-hidden="true">${icon("categories")}</span><span>${escapeHtml(catalogLabel)}</span>${forwardChevron}</a>`;
    const nav = `${navigation.showHome ? `<a href="/"${current(["home"])}>Inicio</a>` : ""}${catalog}${navigation.showContact ? `<a href="/contacto/"${current(["contact"])}>Contacto</a>` : ""}${navigation.showAbout ? `<a href="/nosotros/"${current(["about"])}>Nosotros</a>` : ""}`;
    const mobileNav = `${navigation.showHome ? `<a class="catalog-mobile-nav-link" href="/"${current(["home"])}><span class="catalog-mobile-nav-icon" aria-hidden="true">${icon("home")}</span><span>Inicio</span>${forwardChevron}</a>` : ""}${mobileCategories}${navigation.showContact ? `<a class="catalog-mobile-nav-link" href="/contacto/"${current(["contact"])}><span class="catalog-mobile-nav-icon" aria-hidden="true">${icon("contact")}</span><span>Contacto</span>${forwardChevron}</a>` : ""}${navigation.showAbout ? `<a class="catalog-mobile-nav-link" href="/nosotros/"${current(["about"])}><span class="catalog-mobile-nav-icon" aria-hidden="true">${icon("about")}</span><span>Nosotros</span>${forwardChevron}</a>` : ""}`;
    const search =
      navigation.showSearch && context.project.commerceTemplates.search.enabled
        ? `<button class="catalog-search-link" type="button" data-catalog-search-open aria-controls="catalog-search-dialog" aria-expanded="false" aria-label="${escapeAttribute(context.settings.searchLabel)}"><svg aria-hidden="true" viewBox="0 0 24 24" focusable="false"><circle cx="10.8" cy="10.8" r="6.8"></circle><path d="m16 16 5 5"></path></svg><span>${escapeHtml(context.settings.searchLabel)}</span></button><noscript><a class="catalog-search-noscript" href="/buscar/">${escapeHtml(context.settings.searchLabel)}</a></noscript>`
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
        <aside id="catalog-mobile-menu" class="catalog-mobile-menu" data-catalog-menu hidden role="dialog" aria-modal="true" aria-label="Navegación móvil"><div class="catalog-mobile-menu__header"><a class="catalog-mobile-brand" href="/" aria-label="Inicio de ${escapeAttribute(context.project.identity.brandName)}">${renderBrand(context.project)}</a><button type="button" class="catalog-mobile-menu__close" data-catalog-menu-close aria-label="Cerrar menú"><span class="sr-only">Cerrar menú</span><svg aria-hidden="true" viewBox="0 0 24 24" focusable="false"><path d="m6 6 12 12M18 6 6 18"></path></svg></button></div><form class="catalog-mobile-search" action="/buscar/" method="get" role="search"><label class="sr-only" for="catalog-mobile-search-input">Buscar productos</label><div class="catalog-mobile-search__field"><svg aria-hidden="true" viewBox="0 0 24 24" focusable="false"><circle cx="10.8" cy="10.8" r="6.8"></circle><path d="m16 16 5 5"></path></svg><input id="catalog-mobile-search-input" name="q" type="search" placeholder="Buscar productos..." autocomplete="off"><button type="submit" aria-label="Buscar"><span aria-hidden="true">→</span></button></div></form><nav aria-label="Navegación móvil">${mobileNav}</nav></aside>
        <dialog id="catalog-search-dialog" class="catalog-search-dialog" data-catalog-search-dialog aria-labelledby="catalog-search-title">
          <form class="catalog-search-dialog-form" action="/buscar/" method="get" role="search">
            <div class="catalog-search-dialog-heading"><div><p class="catalog-eyebrow">Catálogo</p><h2 id="catalog-search-title">Buscar productos</h2></div><button type="button" data-catalog-search-close aria-label="Cerrar búsqueda">Cerrar</button></div>
            <label for="catalog-search-input">Buscar por nombre, marca, categoría o etiqueta</label>
            <div class="catalog-search-dialog-controls"><input id="catalog-search-input" name="q" type="search" autocomplete="off" enterkeyhint="search"><button class="catalog-primary-action" type="submit">Buscar</button></div>
          </form>
        </dialog>
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
  actionLabel: z.string().default("Explorar cat\u00e1logo"),
  actionHref: z.string().default("/buscar/"),
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
      className: "catalog-hero-video solara-clip-reveal",
      posterAssetId: settings.posterAssetId,
      preload: "none",
      autoplay: settings.autoplay,
      fallbackAlt: title,
    });
    if (video) return video;
  }
  return renderImage(context.project, fallback, {
    className: "catalog-hero-image solara-clip-reveal",
    loading: "eager",
    fetchPriority: "high",
    sizes: "(max-width: 767px) 100vw, 52vw",
    fallbackAlt: title,
  });
}

export const catalogHero: ModuleDefinition<"catalog-hero", z.infer<typeof heroSettings>> = {
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
                  className: "catalog-hero-image solara-clip-reveal",
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
      ? `<dl class="catalog-hero-stats" aria-label="Resumen del catálogo"><div data-stat="products"><dt>${context.project.products.filter((product) => product.status === "active").length}</dt><dd>productos activos</dd></div><div data-stat="categories"><dt>${context.project.categories.filter((category) => !category.parentId).length}</dt><dd>categorías</dd></div><div data-stat="whatsapp"><dt>${context.project.whatsapp.phone ? "WhatsApp" : "Contacto"}</dt><dd>${context.project.whatsapp.phone ? "pedido directo" : "consultas"}</dd></div></dl>`
      : "";
    const slides =
      settings.mode === "carousel"
        ? settings.slides
            .map(
              (slide, index) =>
                `<button type="button" class="solara-dot" style="--i:${index}" data-catalog-hero-slide="${index}" aria-label="Mostrar ${escapeAttribute(slide.title)}" aria-selected="${String(index === 0)}"></button>`,
            )
            .join("")
        : "";
    const kineticTitle =
      context.section.motion?.preset && context.section.motion.preset !== "none"
        ? " data-kinetic-title"
        : "";
    return moduleRoot(
      "catalog-hero",
      context.section,
      safeHtml(
        `<div class="catalog-hero-inner" data-hero-parallax data-motion-zone="content" data-autoplay="${String(settings.autoplay)}" data-interval="${settings.intervalMs}"><div class="catalog-hero-copy"><p class="catalog-eyebrow solara-gradient-text" data-parallax-layer="3" data-parallax-depth="6">${escapeHtml(settings.eyebrow)}</p><h1 class="solara-kinetic-title"${kineticTitle} data-parallax-layer="2" data-parallax-depth="8">${escapeHtml(title)}</h1><p class="catalog-hero-body">${escapeHtml(body)}</p><div class="catalog-hero-actions"><a class="catalog-primary-action solara-btn-shine" data-magnetic href="${escapeAttribute(safeUrl(actionHref))}">${escapeHtml(actionLabel)}</a>${settings.secondaryActionLabel ? `<a class="catalog-secondary-action solara-pulse-ring" data-magnetic href="${escapeAttribute(safeUrl(settings.secondaryActionHref))}"><span class="solara-pulse-ring-dot" aria-hidden="true"></span>${escapeHtml(settings.secondaryActionLabel)}</a>` : ""}</div>${stats}</div><figure class="catalog-hero-media solara-shimmer" data-motion-zone="media" data-parallax-layer="1" data-parallax-depth="12">${heroMedia}</figure>${slides ? `<div class="catalog-hero-controls" aria-label="Controles del carrusel">${slides}</div>` : ""}</div>`,
      ),
    );
  },
};

const brandStripSettings = z.object({
  title: z.string().default("Marcas que nos acompañan"),
  limit: z.number().int().min(1).max(12).default(5),
});

export const catalogBrandStrip: ModuleDefinition<
  "catalog-brand-strip",
  z.infer<typeof brandStripSettings>
> = {
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
    const brandItems = (ariaHidden: boolean) =>
      `<ul${ariaHidden ? ' aria-hidden="true"' : ' data-motion-zone="items"'}>${brands.map((brand) => `<li>${escapeHtml(brand)}</li>`).join("")}</ul>`;
    return moduleRoot(
      "catalog-brand-strip",
      context.section,
      safeHtml(
        `<div class="catalog-brand-strip-inner"><h2>${escapeHtml(context.settings.title)}</h2><div class="solara-marquee-track">${brandItems(false)}${brandItems(true)}</div></div>`,
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
  viewAllHref: z.string().default("/buscar/"),
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

function productCategory(
  context: Parameters<NonNullable<(typeof catalogProductGrid)["render"]>>[0],
  product: Product,
): { id: string; title: string } | undefined {
  const categories = product.categoryIds
    .map((categoryId) => context.project.categories.find((category) => category.id === categoryId))
    .filter((category): category is (typeof context.project.categories)[number] =>
      Boolean(category),
    );
  return [...categories].sort((left, right) => {
    const depthDifference =
      getCategoryBreadcrumb(context.project, right.id).length -
      getCategoryBreadcrumb(context.project, left.id).length;
    if (depthDifference !== 0) return depthDifference;
    return context.project.categories.indexOf(left) - context.project.categories.indexOf(right);
  })[0];
}

function modernProductCard(
  context: Parameters<NonNullable<(typeof catalogProductGrid)["render"]>>[0],
  product: Product,
  index: number,
): string {
  const variant = product.variants.find((item) => item.available) ?? product.variants[0];
  const price = lowestPrice(product);
  const compare = variant?.compareAtPrice;
  const category = productCategory(context, product);
  const imageId = variant?.imageId ?? product.imageIds[0];
  const image = renderImage(context.project, imageId, {
    className: "catalog-product-card-image",
    loading: index < 4 ? "eager" : "lazy",
    fetchPriority: index < 4 ? "high" : "auto",
    sizes: "(max-width: 640px) 44vw, (max-width: 1024px) 30vw, 280px",
    fallbackAlt: product.title,
  });
  return `<article class="catalog-product-card solara-card-lift solara-spotlight" data-product-card data-product-id="${escapeAttribute(product.id)}" data-product-title="${escapeAttribute(product.title)}"${category ? ` data-product-category="${escapeAttribute(category.id)}"` : ""}><a class="catalog-product-media solara-image-pan solara-shimmer--hover solara-card-glow" href="/productos/${escapeAttribute(product.slug)}/" aria-label="Ver ${escapeAttribute(product.title)}">${image}</a><div class="catalog-product-card-copy">${category ? `<p class="catalog-product-category">${escapeHtml(category.title)}</p>` : ""}<h3><a href="/productos/${escapeAttribute(product.slug)}/">${escapeHtml(product.title)}</a></h3><p class="catalog-product-price"><strong>${escapeHtml(formatMoney(price))}</strong>${compare && compare > price ? ` <del>${escapeHtml(formatMoney(compare))}</del><span class="catalog-discount">-${Math.round((1 - price / compare) * 100)}%</span>` : ""}</p></div></article>`;
}

export const catalogProductGrid: ModuleDefinition<
  "catalog-product-grid",
  z.infer<typeof productGridSettings>
> = {
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
        const card = modernProductCard(context, product, index);
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
        `<div class="catalog-product-grid-section"><header><h2 class="solara-scroll-title">${escapeHtml(context.settings.title)}</h2>${context.settings.showViewAll ? `<a class="catalog-view-all" href="${escapeAttribute(safeUrl(context.settings.viewAllHref))}">Ver todos</a>` : ""}</header><div class="catalog-product-grid" data-motion-zone="items"${categoryGrid}>${cards || '<p class="catalog-empty">No hay productos para mostrar.</p>'}</div></div>`,
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

export const catalogProductDetail: ModuleDefinition<
  "catalog-product-detail",
  z.infer<typeof productDetailSettings>
> = {
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
    .default([]),
});

export const catalogCategoryBento: ModuleDefinition<
  "catalog-category-bento",
  z.infer<typeof categoryBentoSettings>
> = {
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
    const activeProducts = new Set(
      context.project.products
        .filter((product) => product.status === "active")
        .map((product) => product.id),
    );
    const automaticItems = context.project.categories.map((category, index) => ({
      categoryId: category.id,
      imageId: "",
      size: (index === 1 || index % 4 === 0 ? "wide" : "compact") as "wide" | "compact",
    }));
    const configuredItems = context.settings.items
      .filter((item) =>
        context.project.categories.some((category) => category.id === item.categoryId),
      )
      .filter(
        (item, index, items) =>
          items.findIndex((candidate) => candidate.categoryId === item.categoryId) === index,
      );
    const sourceItems = configuredItems.length ? configuredItems : automaticItems;
    const items = sourceItems
      .map((item, index) => {
        const category = context.project.categories.find(
          (candidate) => candidate.id === item.categoryId,
        );
        if (!category) return "";
        const categoryProduct = context.project.products.find(
          (product) =>
            product.status === "active" &&
            getCategoryProductIds(context.project, category.id as CategoryId).includes(product.id),
        );
        const fallbackImageId =
          categoryProduct?.variants.find((variant) => variant.available)?.imageId ??
          categoryProduct?.imageIds[0] ??
          modernFallbackAsset(context, "");
        const image = renderImage(
          context.project,
          item.imageId || category.imageId || fallbackImageId,
          {
            className: "catalog-category-bento-image",
            loading: "lazy",
            sizes: "(max-width: 767px) 92vw, (max-width: 1199px) 45vw, 30vw",
            fallbackAlt: category.title,
          },
        );
        const layout = index === 0 ? "feature" : index === 1 ? "wide" : item.size;
        const productCount = getCategoryProductIds(
          context.project,
          category.id as CategoryId,
        ).filter((id) => activeProducts.has(id)).length;
        return `<a class="catalog-category-bento-item catalog-category-bento-item--${layout} solara-image-pan" href="/categorias/${escapeAttribute(category.slug)}/" aria-label="Explorar ${escapeAttribute(category.title)}"><span>${escapeHtml(category.title)}</span>${productCount ? `<small>${productCount} productos</small>` : ""}${image}</a>`;
      })
      .filter(Boolean)
      .join("");
    return moduleRoot(
      "catalog-category-bento",
      context.section,
      safeHtml(
        `<div class="catalog-category-bento-section"><header><h2 class="solara-scroll-title">${escapeHtml(context.settings.title)}</h2>${items ? '<a class="catalog-category-bento-all" href="/buscar/">Ver todo el catálogo</a>' : ""}</header><div class="catalog-category-bento-grid" data-motion-zone="items">${items || '<p class="catalog-empty">Todavía no hay categorías para mostrar.</p>'}</div></div>`,
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

export const catalogTestimonials: ModuleDefinition<
  "catalog-testimonials",
  z.infer<typeof testimonialSettings>
> = {
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
        `<div class="catalog-testimonials-section"><header><h2 class="solara-scroll-title">${escapeHtml(context.settings.title)}</h2><div class="catalog-testimonials-controls"><button type="button" data-testimonials-prev aria-label="Testimonio anterior">←</button><button type="button" data-testimonials-next aria-label="Testimonio siguiente">→</button></div></header><div class="catalog-testimonials-track" data-motion-zone="items">${items.map((item) => `<article class="catalog-testimonial"><p class="catalog-testimonial-rating" aria-label="${item.rating} de 5">${"★".repeat(item.rating)}</p><h3>${escapeHtml(item.author)}</h3>${item.context ? `<p class="catalog-testimonial-context">${escapeHtml(item.context)}</p>` : ""}<blockquote>“${escapeHtml(item.body)}”</blockquote></article>`).join("")}</div></div>`,
      ),
    );
  },
};

const faqSettings = z.object({
  title: z.string().default("Preguntas frecuentes"),
  items: z
    .array(
      z.object({
        question: z.string().min(1),
        answer: z.string().min(1),
      }),
    )
    .max(8)
    .default([
      {
        question: "¿Hacen envíos a todo el país?",
        answer: "Sí, coordinamos el envío y su costo antes de confirmar el pedido por WhatsApp.",
      },
      {
        question: "¿Cómo hago un pedido?",
        answer:
          "Elegí tus productos, completá el carrito y escribinos por WhatsApp para coordinar entrega y pago.",
      },
      {
        question: "¿Puedo cambiar o devolver un producto?",
        answer:
          "Sí, dentro de los 10 días de recibido si conserva su estado original y no presenta señales de uso.",
      },
      {
        question: "¿Cuáles son los medios de pago?",
        answer: "Aceptamos transferencia, efectivo y Mercado Pago; lo acordamos por WhatsApp.",
      },
    ]),
});

export const catalogFaq: ModuleDefinition<"catalog-faq", z.infer<typeof faqSettings>> = {
  manifest: modernManifest({
    id: "catalog-faq",
    name: "Preguntas frecuentes",
    description: "Accordion de preguntas y respuestas con una sola abierta a la vez.",
    slots: ["content", "trust"],
    compatibleSettings: ["title", "items"],
  }),
  settingsSchema: faqSettings,
  settingsFields: [
    { key: "title", type: "text", label: "Título" },
    {
      key: "items",
      type: "repeater",
      label: "Preguntas",
      maxItems: 8,
      itemLabelKey: "question",
      fields: [
        { key: "question", label: "Pregunta", type: "text" },
        { key: "answer", label: "Respuesta", type: "text" },
      ],
    },
  ],
  motionZones: modernRevealZone,
  styleAsset: scopedAssetId("catalog-modern"),
  render(context) {
    const items = context.settings.items;
    if (!items.length) return moduleRoot("catalog-faq", context.section, safeHtml(""));
    return moduleRoot(
      "catalog-faq",
      context.section,
      safeHtml(
        `<div class="catalog-faq-section" data-faq-root data-motion-zone="content"><header><h2 class="solara-scroll-title">${escapeHtml(context.settings.title)}</h2></header><div class="catalog-faq-list">${items
          .map(
            (item) =>
              `<details class="solara-faq-item"><summary>${escapeHtml(item.question)}</summary><div class="solara-faq-answer"><p>${escapeHtml(item.answer)}</p></div></details>`,
          )
          .join("")}</div></div>`,
      ),
    );
  },
};

const statsItemSchema = z.object({
  value: z.number().int().min(0),
  suffix: z.string(),
  label: z.string(),
});

const statsSettings = z.object({
  title: z.string().default("Nuestra tienda en números"),
  items: z
    .array(statsItemSchema)
    .max(6)
    .default([
      { value: 50, suffix: "", label: "productos activos" },
      { value: 14, suffix: "", label: "categorías" },
      { value: 60, suffix: "", label: "variantes" },
      { value: 1, suffix: "", label: "tienda lista" },
    ]),
});

export const catalogStats: ModuleDefinition<"catalog-stats", z.infer<typeof statsSettings>> = {
  manifest: modernManifest({
    id: "catalog-stats",
    name: "Estadísticas",
    description: "Contadores del negocio con valores estáticos accesibles.",
    slots: ["content", "trust"],
    compatibleSettings: ["title", "items"],
  }),
  settingsSchema: statsSettings,
  settingsFields: [
    { key: "title", type: "text", label: "Título" },
    {
      key: "items",
      type: "repeater",
      label: "Valores",
      maxItems: 6,
      itemLabelKey: "label",
      fields: [
        { key: "value", label: "Valor", type: "number", min: 0, step: 1 },
        { key: "suffix", label: "Sufijo", type: "text" },
        { key: "label", label: "Etiqueta", type: "text" },
      ],
    },
  ],
  motionZones: modernRevealZone,
  styleAsset: scopedAssetId("catalog-modern"),
  render(context) {
    const items = context.settings.items;
    if (!items.length) return moduleRoot("catalog-stats", context.section, safeHtml(""));
    return moduleRoot(
      "catalog-stats",
      context.section,
      safeHtml(
        `<div class="catalog-stats-section" data-motion-zone="content"><header><h2 class="solara-scroll-title">${escapeHtml(context.settings.title)}</h2></header><div class="catalog-stats-grid" data-stats-root>${items
          .map(
            (item) =>
              `<div class="catalog-stat" data-stat-target="${item.value}"><strong data-stat-value="${item.value}">${escapeHtml(item.value.toLocaleString("es-AR"))}</strong>${item.suffix ? `<span class="catalog-stat-suffix">${escapeHtml(item.suffix)}</span>` : ""}<p>${escapeHtml(item.label)}</p></div>`,
          )
          .join("")}</div></div>`,
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

export const catalogNewsletterCta: ModuleDefinition<
  "catalog-newsletter-cta",
  z.infer<typeof newsletterSettings>
> = {
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
        `<div class="catalog-newsletter-inner" data-motion-zone="content"><div><h2 class="solara-scroll-title">${escapeHtml(context.settings.title)}</h2><p>${escapeHtml(context.settings.body)}</p></div><a class="catalog-newsletter-action solara-btn-shine" data-magnetic href="${escapeAttribute(safeUrl(context.settings.actionHref))}">${escapeHtml(context.settings.actionLabel)}</a></div>`,
      ),
    );
  },
};

const modernFooterSettings = z.object({
  note: z.string().default(""),
  showPolicies: z.boolean().default(true),
});

export const catalogFooter: ModuleDefinition<
  "catalog-footer",
  z.infer<typeof modernFooterSettings>
> = {
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
    const activeProductIds = new Set(
      context.project.products
        .filter((product) => product.status === "active")
        .map((product) => product.id),
    );
    const firstCollection = context.project.collections.find((collection) =>
      collection.productIds.some((productId) => activeProductIds.has(productId)),
    );
    const firstCategory = context.project.categories.find((category) => !category.parentId);
    const catalogLink = firstCollection
      ? { label: firstCollection.title, href: `/colecciones/${firstCollection.slug}/` }
      : firstCategory
        ? { label: firstCategory.title, href: `/categorias/${firstCategory.slug}/` }
        : { label: context.project.navigation.catalogLabel, href: "/buscar/" };
    const catalogLinkMarkup = `<a href="${escapeAttribute(catalogLink.href)}">${escapeHtml(catalogLink.label)}</a>`;
    return moduleRoot(
      "catalog-footer",
      context.section,
      safeHtml(
        `<div class="catalog-footer-inner" data-motion-zone="content"><div class="catalog-footer-brand"><a class="catalog-brand" href="/">${renderBrand(context.project)}</a><p>${escapeHtml(note)}</p></div><nav aria-label="Catálogo"><a href="/">Inicio</a>${catalogLinkMarkup}<a href="/buscar/">Buscar</a></nav><nav aria-label="Ayuda"><a href="/contacto/">Contacto</a><a href="/nosotros/">Nosotros</a>${policyLinks}</nav><address>${contact}</address><small>© ${new Date(context.project.updatedAt).getUTCFullYear()} ${escapeHtml(context.project.identity.brandName)}</small></div><button type="button" class="solara-back-to-top" data-back-to-top hidden aria-label="Volver arriba"><svg viewBox="0 0 48 48" width="48" height="48" aria-hidden="true" focusable="false"><circle cx="24" cy="24" r="21" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-dasharray="132" stroke-dashoffset="132" data-back-to-top-ring></circle><path d="M24 31V17m-7 7 7-7 7 7" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"></path></svg><span class="sr-only">Volver arriba</span></button>`,
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

export const catalogCartDrawer: ModuleDefinition<
  "catalog-cart-drawer",
  z.infer<typeof modernCartSettings>
> = {
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
  catalogFaq,
  catalogStats,
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
