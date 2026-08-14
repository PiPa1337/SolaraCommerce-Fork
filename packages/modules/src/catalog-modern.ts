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
  CATALOG_MODERN_PLACEHOLDER_PHONE,
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
    // Los ítems editados en el Resumen tienen prioridad sobre la navegación
    // derivada de categorías aunque el modo sea "automatic"; con items vacíos
    // se conserva el comportamiento previo (categorías en automatic).
    const navigationItems =
      navigation.mode === "automatic" && navigation.items.length === 0
        ? automaticItems
        : navigation.items;
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
    const searchEnabled = navigation.showSearch && context.project.commerceTemplates.search.enabled;
    const desktopMenu = navigationItems.length
      ? `<div id="catalog-category-menu" class="catalog-mega-menu" role="group" aria-label="Categorías"><ul class="catalog-mega-menu__groups">${desktopMenuItems}</ul>${searchEnabled ? `<a class="catalog-mega-menu__all" href="/buscar/">Ver todos los productos <span aria-hidden="true">→</span></a>` : ""}</div>`
      : "";
    const catalog = navigationItems.length
      ? `<details class="catalog-nav-menu"><summary class="catalog-nav-trigger" aria-controls="catalog-category-menu" aria-haspopup="true" aria-expanded="false"${current(["category", "collection"])}>${escapeHtml(catalogLabel)}${chevron}</summary>${desktopMenu}</details>`
      : searchEnabled
        ? `<a class="catalog-nav-empty" href="/buscar/"${current(["category", "collection"])}>${escapeHtml(catalogLabel)}</a>`
        : "";
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
      ? `<details class="catalog-mobile-categories"><summary aria-controls="catalog-mobile-categories-panel" aria-expanded="false"${current(["category", "collection"])}><span class="catalog-mobile-nav-icon" aria-hidden="true">${icon("categories")}</span><span>${escapeHtml(catalogLabel)}</span>${chevron}</summary><div id="catalog-mobile-categories-panel" class="catalog-mobile-categories__panel">${mobileCategoryItems}</div></details>`
      : searchEnabled
        ? `<a class="catalog-mobile-nav-link" href="/buscar/"><span class="catalog-mobile-nav-icon" aria-hidden="true">${icon("categories")}</span><span>${escapeHtml(catalogLabel)}</span>${forwardChevron}</a>`
        : "";
    const nav = `${navigation.showHome ? `<a href="/"${current(["home"])}>Inicio</a>` : ""}${catalog}${navigation.showContact ? `<a href="/contacto/"${current(["contact"])}>Contacto</a>` : ""}${navigation.showAbout ? `<a href="/nosotros/"${current(["about"])}>Nosotros</a>` : ""}`;
    const mobileNav = `${navigation.showHome ? `<a class="catalog-mobile-nav-link" href="/"${current(["home"])}><span class="catalog-mobile-nav-icon" aria-hidden="true">${icon("home")}</span><span>Inicio</span>${forwardChevron}</a>` : ""}${mobileCategories}${navigation.showContact ? `<a class="catalog-mobile-nav-link" href="/contacto/"${current(["contact"])}><span class="catalog-mobile-nav-icon" aria-hidden="true">${icon("contact")}</span><span>Contacto</span>${forwardChevron}</a>` : ""}${navigation.showAbout ? `<a class="catalog-mobile-nav-link" href="/nosotros/"${current(["about"])}><span class="catalog-mobile-nav-icon" aria-hidden="true">${icon("about")}</span><span>Nosotros</span>${forwardChevron}</a>` : ""}`;
    const search = searchEnabled
      ? `<button class="catalog-search-link" type="button" data-catalog-search-open aria-controls="catalog-search-dialog" aria-expanded="false" aria-label="${escapeAttribute(context.settings.searchLabel)}"><svg aria-hidden="true" viewBox="0 0 24 24" focusable="false"><circle cx="10.8" cy="10.8" r="6.8"></circle><path d="m16 16 5 5"></path></svg><span>${escapeHtml(context.settings.searchLabel)}</span></button><noscript><a class="catalog-search-noscript" href="/buscar/">${escapeHtml(context.settings.searchLabel)}</a></noscript>`
      : "";
    const cart =
      navigation.showCart &&
      context.project.siteShell.cart &&
      (context.project.commerceTemplates.cart.enabled ||
        context.project.commerceTemplates.checkout.enabled)
        ? `<button class="catalog-cart-link" type="button" data-solara-cart-open data-open-cart data-cart-label="${escapeAttribute(context.settings.cartLabel)}" aria-controls="solara-cart" aria-expanded="false"><span>${escapeHtml(context.settings.cartLabel)}</span><strong data-solara-cart-count data-cart-count aria-live="polite">0</strong></button>`
        : "";
    return moduleRoot(
      "catalog-header",
      context.section,
      safeHtml(`<div class="catalog-header-inner" data-motion-zone="content">
        <button class="catalog-mobile-menu-button" type="button" data-catalog-menu-open aria-controls="catalog-mobile-menu" aria-expanded="false"><span class="sr-only">Abrir menú</span><svg aria-hidden="true" viewBox="0 0 24 24" focusable="false"><path d="M4 6h16M4 12h16M4 18h16"></path></svg></button>
        <a class="catalog-brand" href="/" aria-label="Inicio de ${escapeAttribute(context.project.identity.brandName)}">${renderBrand(context.project)}</a>
        <nav class="catalog-desktop-nav" aria-label="Navegación principal">${nav}</nav>
        <div class="catalog-header-actions">${search}${cart}</div>
        <noscript><style>[data-solara-store].catalog-modern .catalog-search-link{display:none}[data-solara-store].catalog-modern .catalog-search-noscript{display:inline-flex;align-items:center;min-height:44px;padding:.55rem 1rem;border:1px solid var(--catalog-border);border-radius:999px;background:var(--catalog-surface);color:var(--catalog-muted);text-decoration:none;font-size:.82rem}@media (max-width:767px){[data-solara-store].catalog-modern .catalog-mobile-menu[hidden]{display:block}}@media print{[data-solara-store].catalog-modern .catalog-mobile-menu{display:none!important}}</style></noscript>
        <aside id="catalog-mobile-menu" class="catalog-mobile-menu" data-catalog-menu hidden role="dialog" aria-modal="true" aria-hidden="true" aria-label="Navegación móvil"><div class="catalog-mobile-menu__header"><a class="catalog-mobile-brand" href="/" aria-label="Inicio de ${escapeAttribute(context.project.identity.brandName)}">${renderBrand(context.project)}</a><button type="button" class="catalog-mobile-menu__close" data-catalog-menu-close aria-label="Cerrar menú"><span class="sr-only">Cerrar menú</span><svg aria-hidden="true" viewBox="0 0 24 24" focusable="false"><path d="m6 6 12 12M18 6 6 18"></path></svg></button></div>${searchEnabled ? `<form class="catalog-mobile-search" action="/buscar/" method="get" role="search"><label class="sr-only" for="catalog-mobile-search-input">Buscar productos</label><div class="catalog-mobile-search__field"><svg aria-hidden="true" viewBox="0 0 24 24" focusable="false"><circle cx="10.8" cy="10.8" r="6.8"></circle><path d="m16 16 5 5"></path></svg><input id="catalog-mobile-search-input" name="q" type="search" placeholder="Buscar productos..." autocomplete="off"><button type="submit" aria-label="Buscar"><span aria-hidden="true">→</span></button></div></form>` : ""}<nav aria-label="Navegación móvil">${mobileNav}</nav></aside>
        ${
          searchEnabled
            ? `<dialog id="catalog-search-dialog" class="catalog-search-dialog" data-catalog-search-dialog aria-labelledby="catalog-search-title">
          <form class="catalog-search-dialog-form" action="/buscar/" method="get" role="search">
            <div class="catalog-search-dialog-heading"><div><p class="catalog-eyebrow">${escapeHtml(catalogLabel)}</p><h2 id="catalog-search-title">Buscar productos</h2></div><button type="button" data-catalog-search-close aria-label="Cerrar búsqueda">Cerrar</button></div>
            <label for="catalog-search-input">Buscar por nombre, marca, categoría o etiqueta</label>
            <div class="catalog-search-dialog-controls"><input id="catalog-search-input" name="q" type="search" autocomplete="off" enterkeyhint="search"><button class="catalog-primary-action" type="submit">Buscar</button></div>
          </form>
        </dialog>`
            : ""
        }
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

const catalogHeroBenefitSchema = z.object({
  id: z.string().min(1),
  icon: z.string().default("truck"),
  title: z.string().min(1),
  text: z.string().default(""),
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
  benefits: z
    .array(catalogHeroBenefitSchema)
    .max(3)
    .default([
      {
        id: "hero-benefit-envios",
        icon: "truck",
        title: "Envíos a todo el país",
        text: "Coordinamos la entrega por WhatsApp",
      },
      {
        id: "hero-benefit-pedido",
        icon: "chat",
        title: "Pedido directo",
        text: "Comprá conversando con la marca",
      },
      {
        id: "hero-benefit-compra",
        icon: "shield",
        title: "Compra cuidada",
        text: "Confirmamos todo antes de enviar",
      },
    ]),
});

export const catalogHeroBenefitIcons: Record<string, string> = {
  truck:
    '<path d="M2 6.5h10.5V15H2z"></path><path d="M12.5 9.5H17l3.5 3.5v2h-8"></path><circle cx="6.5" cy="15.5" r="1.7"></circle><circle cx="16.5" cy="15.5" r="1.7"></circle>',
  chat: '<path d="M4 5h16v11H9.5L4 19.5z"></path>',
  shield: '<path d="M12 3l7 2.5v5.5c0 4.2-2.9 7.2-7 8.5-4.1-1.3-7-4.3-7-8.5V5.5z"></path>',
  tag: '<path d="M3 11.5V4h7.5L20 13.5 13.5 20z"></path><circle cx="7.8" cy="7.8" r="1.1"></circle>',
  gift: '<path d="M3.5 8.5h17v4h-17z"></path><path d="M5 12.5v7.5h14v-7.5"></path><path d="M12 8.5v11.5"></path><path d="M12 8.5C12 8.5 11 4.5 8.6 4.5S5.8 7 8.2 8.3z"></path><path d="M12 8.5c0-4 .9-4 2.6-4s2.9 2.5 1.2 3.8z"></path>',
  clock: '<circle cx="12" cy="12" r="8.2"></circle><path d="M12 7.2V12l3.4 2"></path>',
  card: '<rect x="2.5" y="5" width="19" height="14" rx="1.5"></rect><path d="M2.5 9.5h19"></path>',
  check: '<path d="m4.5 12.5 5 5 10-11"></path>',
};

/**
 * Divide el título en líneas balanceadas (~12 caracteres por línea) para el
 * reveal con máscara. Cada línea debe caber sin partir palabras internamente
 * dentro del ancho del h1 (max-width 11ch en V2); el texto se conserva íntegro.
 */
function heroTitleLines(title: string): string[] {
  const words = title.trim().split(/\s+/).filter(Boolean);
  if (words.length <= 1) return [words.join(" ")];
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (current && candidate.length > 12) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function renderHeroBenefits(benefits: z.infer<typeof heroSettings>["benefits"]): string {
  return `<ul class="catalog-hero-benefits" data-hero-benefits aria-label="Beneficios">${benefits
    .map((benefit) => {
      const icon = catalogHeroBenefitIcons[benefit.icon] ?? catalogHeroBenefitIcons.check ?? "";
      return `<li class="catalog-hero-benefit" data-hero-benefit><svg class="catalog-hero-benefit-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">${icon}</svg><span class="catalog-hero-benefit-copy"><strong>${escapeHtml(benefit.title)}</strong>${benefit.text ? `<small>${escapeHtml(benefit.text)}</small>` : ""}</span></li>`;
    })
    .join("")}</ul>`;
}

function modernFallbackAsset(
  context: { project: import("@solara/project-schema").StoreProjectV1 },
  requested?: string,
): string {
  return (
    requested || context.project.seo.socialImageId || context.project.products[0]?.imageIds[0] || ""
  );
}

function catalogSearchHref(searchEnabled: boolean, href: string): string {
  return !searchEnabled && href.startsWith("/buscar") ? "/categorias/" : href;
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
      "benefits",
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
    {
      key: "benefits",
      type: "repeater",
      label: "Beneficios",
      maxItems: 3,
      itemLabelKey: "title",
      fields: [
        {
          key: "icon",
          type: "select",
          label: "Ícono",
          options: [
            { value: "truck", label: "Envío" },
            { value: "chat", label: "WhatsApp" },
            { value: "shield", label: "Protección" },
            { value: "tag", label: "Etiqueta" },
            { value: "gift", label: "Regalo" },
            { value: "clock", label: "Reloj" },
            { value: "card", label: "Tarjeta" },
            { value: "check", label: "Check" },
          ],
        },
        { key: "title", type: "text", label: "Título" },
        { key: "text", type: "text", label: "Descripción" },
      ],
    },
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
    const searchEnabled =
      context.project.navigation.showSearch && context.project.commerceTemplates.search.enabled;
    const activeSlide = settings.mode === "carousel" ? settings.slides[0] : undefined;
    const title = activeSlide?.title ?? settings.title;
    const body = activeSlide?.body ?? settings.body;
    const actionLabel = activeSlide?.actionLabel ?? settings.actionLabel;
    const actionHref = catalogSearchHref(
      searchEnabled,
      activeSlide?.actionHref ?? settings.actionHref,
    );
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
              return `<figure data-catalog-hero-slide-panel data-title="${escapeAttribute(slide.title)}" data-body="${escapeAttribute(slide.body)}" data-action-label="${escapeAttribute(slide.actionLabel)}" data-action-href="${escapeAttribute(safeUrl(catalogSearchHref(searchEnabled, slide.actionHref)))}"${index === 0 ? "" : " hidden"}>${slideImage}</figure>`;
            })
            .join("")
        : "";
    const heroMedia = slidePanels
      ? `<div class="catalog-hero-slide-stage">${slidePanels}</div>`
      : String(media);
    const stats = settings.showCatalogStats
      ? `<dl class="catalog-hero-stats" aria-label="Resumen del catálogo"><div data-stat="products"><dt>${context.project.products.filter((product) => product.status === "active").length}</dt><dd>productos activos</dd></div><div data-stat="categories"><dt>${context.project.categories.filter((category) => !category.parentId).length}</dt><dd>categorías</dd></div><div data-stat="whatsapp"><dt>${context.project.whatsapp.phone ? "WhatsApp" : "Contacto"}</dt><dd>${context.project.whatsapp.phone ? "pedido directo" : "consultas"}</dd></div></dl>`
      : "";
    // La familia V2 (fuera del modo carousel) expone el contrato de markup que
    // la tarea de motion usa para entrada cinematográfica, máscaras y parallax:
    // reveal zones, líneas del título y beneficios configurables. El modo
    // carousel y la familia V1 conservan exactamente la estructura previa.
    const isV2Hero =
      context.project.commerceTemplates.designFamily === "catalog-modern-v2" &&
      settings.mode !== "carousel";
    const benefitsMarkup = isV2Hero
      ? settings.benefits.length > 0
        ? renderHeroBenefits(settings.benefits)
        : stats
      : "";
    const titleLinesMarkup = isV2Hero
      ? heroTitleLines(title)
          .map(
            (line) =>
              `<span class="catalog-hero-line" data-hero-line><span class="catalog-hero-line-inner" data-hero-line-inner>${escapeHtml(line)}</span></span>`,
          )
          .join(" ")
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
    // La familia V2 reemplaza las acciones del hero por un único enlace directo
    // a WhatsApp (sin mensaje precargado) cuando la tienda tiene teléfono público.
    const whatsappPhone =
      context.project.commerceTemplates.designFamily === "catalog-modern-v2" &&
      hasPublicWhatsApp(context.project.whatsapp)
        ? context.project.whatsapp.phone.replace(/\D/g, "")
        : "";
    const actions = whatsappPhone
      ? `<a class="catalog-primary-action solara-primary-action" href="https://wa.me/${escapeAttribute(whatsappPhone)}" target="_blank" rel="noopener noreferrer"><span class="catalog-hero-cta-label">Escribir por WhatsApp</span><svg class="catalog-hero-cta-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">${catalogHeroBenefitIcons.chat}</svg></a>`
      : `<a class="catalog-primary-action" href="${escapeAttribute(safeUrl(actionHref))}">${escapeHtml(actionLabel)}</a>${settings.secondaryActionLabel ? `<a class="catalog-secondary-action" href="${escapeAttribute(safeUrl(settings.secondaryActionHref))}">${escapeHtml(settings.secondaryActionLabel)}</a>` : ""}`;
    const heroInner = isV2Hero
      ? `<div class="catalog-hero-inner" data-motion-zone="content" data-autoplay="${String(settings.autoplay)}" data-interval="${settings.intervalMs}"><div class="catalog-hero-copy"><div class="catalog-hero-reveal catalog-hero-reveal--eyebrow"><p class="catalog-eyebrow">${escapeHtml(settings.eyebrow)}</p></div><h1 class="catalog-hero-title" data-hero-title>${titleLinesMarkup}</h1><div class="catalog-hero-rule" data-hero-rule aria-hidden="true"></div><div class="catalog-hero-reveal catalog-hero-reveal--body"><p class="catalog-hero-body">${escapeHtml(body)}</p></div><div class="catalog-hero-reveal catalog-hero-reveal--actions"><div class="catalog-hero-actions">${actions}</div></div>${benefitsMarkup}</div><figure class="catalog-hero-media" data-motion-zone="media" data-hero-media>${heroMedia}</figure>${slides ? `<div class="catalog-hero-controls" aria-label="Controles del carrusel">${slides}</div>` : ""}</div>`
      : `<div class="catalog-hero-inner" data-motion-zone="content" data-autoplay="${String(settings.autoplay)}" data-interval="${settings.intervalMs}"><div class="catalog-hero-copy"><p class="catalog-eyebrow">${escapeHtml(settings.eyebrow)}</p><h1>${escapeHtml(title)}</h1><p class="catalog-hero-body">${escapeHtml(body)}</p><div class="catalog-hero-actions">${actions}</div>${stats}</div><figure class="catalog-hero-media" data-motion-zone="media">${heroMedia}</figure>${slides ? `<div class="catalog-hero-controls" aria-label="Controles del carrusel">${slides}</div>` : ""}</div>`;
    return moduleRoot("catalog-hero", context.section, safeHtml(heroInner));
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

function modernProductCardImageSizes(
  context: Parameters<NonNullable<(typeof catalogProductGrid)["render"]>>[0],
): string {
  if (context.project.commerceTemplates.designFamily !== "catalog-modern-v2") {
    return "(max-width: 640px) 44vw, (max-width: 1024px) 30vw, 23vw";
  }
  return "(max-width: 767px) calc((100vw - 2.2rem) / 2), (max-width: 1199px) min(22vw, 11.5rem), min(20vw, 13rem)";
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
  const category = productCategory(context, product);
  const reviewSummary = showRating ? catalogReviewSummary(product) : undefined;
  const imageId = variant?.imageId ?? product.imageIds[0];
  const image = renderImage(context.project, imageId, {
    className: "catalog-product-card-image",
    loading: index < 6 ? "eager" : "lazy",
    fetchPriority: index < 6 ? "high" : "auto",
    sizes: modernProductCardImageSizes(context),
    fallbackAlt: product.title,
  });
  return `<article class="catalog-product-card" data-product-card data-product-id="${escapeAttribute(product.id)}" data-product-title="${escapeAttribute(product.title)}"${category ? ` data-product-category="${escapeAttribute(category.id)}"` : ""}><a class="catalog-product-media" href="/productos/${escapeAttribute(product.slug)}/" aria-label="Ver ${escapeAttribute(product.title)}">${image}</a><div class="catalog-product-card-copy">${category ? `<p class="catalog-product-category">${escapeHtml(category.title)}</p>` : ""}<h3><a href="/productos/${escapeAttribute(product.slug)}/">${escapeHtml(product.title)}</a></h3>${reviewSummary ? `<p class="catalog-product-rating" aria-label="${reviewSummary.average.toFixed(1)} de 5">${"★".repeat(Math.round(reviewSummary.average))}<span>${reviewSummary.average.toFixed(1)} / 5 · ${reviewSummary.count} reseñas</span></p>` : ""}<p class="catalog-product-price"><strong>${escapeHtml(formatMoney(price))}</strong>${compare && compare > price ? ` <del>${escapeHtml(formatMoney(compare))}</del><span class="catalog-discount">-${Math.round((1 - price / compare) * 100)}%</span>` : ""}</p></div></article>`;
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
    const searchEnabled =
      context.project.navigation.showSearch && context.project.commerceTemplates.search.enabled;
    const viewAllHref = catalogSearchHref(searchEnabled, context.settings.viewAllHref);
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
        `<div class="catalog-product-grid-section"><header><h2>${escapeHtml(context.settings.title)}</h2>${context.settings.showViewAll ? `<a class="catalog-view-all" href="${escapeAttribute(safeUrl(viewAllHref))}">Ver todos</a>` : ""}</header><div class="catalog-product-grid" data-motion-zone="items"${categoryGrid}>${cards || '<p class="catalog-empty">No hay productos para mostrar.</p>'}</div></div>`,
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

function hasPublicWhatsApp(whatsapp: { phone: string }): boolean {
  const rawPhone = whatsapp.phone;
  return rawPhone !== CATALOG_MODERN_PLACEHOLDER_PHONE && rawPhone.replace(/\D/g, "").length > 0;
}

function buildWhatsAppInquiryLink(
  context: Parameters<NonNullable<(typeof catalogProductDetail)["render"]>>[0],
  product: Product,
): string {
  const rawPhone = context.project.whatsapp.phone;
  const phone = rawPhone.replace(/\D/g, "");
  if (!phone || rawPhone === CATALOG_MODERN_PLACEHOLDER_PHONE) return "";
  const firstVariant = product.variants.find((variant) => variant.available) ?? product.variants[0];
  const message = [
    context.project.whatsapp.greeting,
    `Producto: ${product.title}`,
    firstVariant ? `Variante: ${firstVariant.title}` : "",
    `Precio: ${formatMoney(firstVariant?.price ?? lowestPrice(product))}`,
  ]
    .filter(Boolean)
    .join("\n");
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}

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
        { className: "catalog-product-detail" },
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
          sizes:
            context.project.commerceTemplates.designFamily === "catalog-modern-v2"
              ? "(max-width: 767px) 92vw, (max-width: 1199px) 94vw, 60vw"
              : "(max-width: 767px) 92vw, 54vw",
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
          sizes:
            context.project.commerceTemplates.designFamily === "catalog-modern-v2"
              ? "5.5rem"
              : "5rem",
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
        return `<option value="${escapeAttribute(variant.id)}" data-variant-data="${escapeAttribute(variant.id)}" data-variant-id="${escapeAttribute(variant.id)}" data-variant-title="${escapeAttribute(variant.title)}" data-sku="${escapeAttribute(variant.sku)}" data-image-id="${escapeAttribute(variant.imageId ?? product.imageIds[0] ?? "")}"${imageUrl ? ` data-image-url="${escapeAttribute(imageUrl)}" data-image-width="${variantImage?.width ?? ""}" data-image-height="${variantImage?.height ?? ""}"` : ""} data-price="${variant.price}" data-compare-at="${variant.compareAtPrice ?? ""}" data-available="${String(variant.available)}"${variant.available ? "" : " disabled"}${variant.id === firstVariant?.id ? " selected" : ""}>${escapeHtml(variant.title)} · ${escapeHtml(formatMoney(variant.price))}${variant.available ? "" : " · Agotado"}</option>`;
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
            return `<button type="button" class="catalog-option-pill" data-variant-option data-option-key="${escapeAttribute(optionName)}" data-option-value="${escapeAttribute(value)}" data-variant-id="${escapeAttribute(selected?.id ?? "")}" aria-pressed="${String(firstVariant?.optionValues[optionName] === value)}"${available ? "" : " disabled"}>${escapeHtml(value)}</button>`;
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
    const whatsappFallback = buildWhatsAppInquiryLink(context, product);
    const compareAt =
      context.settings.showCompareAtPrice && firstVariant?.compareAtPrice
        ? formatMoney(firstVariant.compareAtPrice)
        : "";
    const detailsPanelId = `catalog-product-details-${context.section.id}`;
    const descriptionPanelId = `catalog-product-description-${context.section.id}`;
    const description = context.settings.showDescription
      ? `<div id="${escapeAttribute(descriptionPanelId)}" class="catalog-rich-text" data-product-tab-panel="details">${product.richDescription ? sanitizeRichText(product.richDescription) : `<p>${escapeHtml(product.description)}</p>`}</div>`
      : "";
    const reviewSummary = catalogReviewSummary(product);
    const reviews = (product.reviews ?? []).filter((review) => review.visible).slice(0, 6);
    const policiesPanelId = `catalog-product-policies-${context.section.id}`;
    const reviewsPanelId = `catalog-product-reviews-${context.section.id}`;
    const reviewSection = reviews.length
      ? `<section id="${escapeAttribute(reviewsPanelId)}" class="catalog-product-reviews" data-product-tab-panel="reviews" data-motion-zone="items"><header><div><p class="catalog-eyebrow">Experiencias reales</p><h2>Lo que dicen quienes compraron</h2></div>${reviewSummary ? `<p class="catalog-review-average"><strong>${reviewSummary.average.toFixed(1)}</strong> / 5 · ${reviewSummary.count} reseñas</p>` : ""}</header><div class="catalog-review-grid">${reviews.map((review) => `<article class="catalog-review"><p class="catalog-product-rating" aria-label="${review.rating} de 5">${"★".repeat(review.rating)}</p><h3>${escapeHtml(review.authorName)}</h3>${review.title ? `<strong>${escapeHtml(review.title)}</strong>` : ""}<blockquote>${escapeHtml(review.body)}</blockquote><small>${review.verifiedPurchase ? "Compra verificada · " : ""}${escapeHtml(new Intl.DateTimeFormat("es-AR", { dateStyle: "medium" }).format(new Date(review.publishedAt)))}</small></article>`).join("")}</div></section>`
      : "";
    const productTabs = `<nav class="catalog-product-tabs" role="tablist" aria-label="Información del producto"><button type="button" role="tab" data-product-tab="details" aria-controls="${escapeAttribute(description ? `${descriptionPanelId} ${detailsPanelId}` : detailsPanelId)}" aria-selected="true">Detalles</button><button type="button" role="tab" data-product-tab="policies" aria-controls="${escapeAttribute(policiesPanelId)}" aria-selected="false">Envíos y cambios</button>${reviews.length ? `<button type="button" role="tab" data-product-tab="reviews" aria-controls="${escapeAttribute(reviewsPanelId)}" aria-selected="false">Reseñas</button>` : ""}</nav>`;
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
            ${whatsappFallback ? `<noscript><style>[data-solara-store].catalog-modern .catalog-add-form .catalog-add-fallback{display:inline-flex}[data-solara-store].catalog-modern .catalog-add-form .catalog-product-add{display:none}</style><a class="catalog-add-fallback" href="${escapeAttribute(whatsappFallback)}" target="_blank" rel="noopener noreferrer">Consultar por WhatsApp</a></noscript>` : ""}
          </form>
          <nav class="catalog-variant-links" aria-label="Enlaces directos a variantes">${variantLinks}</nav>
          <p class="catalog-delivery-note">${escapeHtml(context.settings.deliveryNote)}</p>
          <dl id="${escapeAttribute(detailsPanelId)}" class="catalog-product-specs" data-product-tab-panel="details"><div><dt>SKU</dt><dd data-product-sku>${escapeHtml(firstVariant?.sku ?? "")}</dd></div><div><dt>Disponibilidad</dt><dd data-product-availability>${firstVariant?.available ? "Disponible" : "Agotado"}</dd></div></dl>
          <div id="${escapeAttribute(policiesPanelId)}" class="catalog-product-policies" data-product-tab-panel="policies"><details><summary>Envíos</summary><p>${escapeHtml(context.project.policies.shipping.details)}</p></details><details><summary>Cambios y devoluciones</summary><p>${escapeHtml(context.project.policies.returns.details)}</p></details></div>
        </div>
      </div>${productTabs}${reviewSection}</div>`),
      { className: "catalog-product-detail" },
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
        size: z.enum(["wide", "tall", "compact"]).default("wide"),
      }),
    )
    .default([]),
});

type CategoryBentoLayout = z.infer<typeof categoryBentoSettings>["items"][number]["size"];

function automaticCategoryBentoLayout(count: number): CategoryBentoLayout[] {
  if (count <= 0) return [];
  if (count === 1) return ["wide"];
  if (count === 2) return ["wide", "wide"];
  if (count === 3) return ["wide", "compact", "compact"];

  if (count === 4) return ["wide", "tall", "compact", "compact"];
  if (count === 5) return ["wide", "tall", "tall", "compact", "compact"];
  if (count === 6) return ["wide", "wide", "compact", "compact", "compact", "compact"];
  if (count === 7) return ["wide", "wide", "compact", "compact", "compact", "compact", "compact"];

  const repeatedLayouts: CategoryBentoLayout[] = [];
  let remaining = count;
  while (remaining >= 8) {
    repeatedLayouts.push(
      "wide",
      "tall",
      "tall",
      "wide",
      "compact",
      "compact",
      "compact",
      "compact",
    );
    remaining -= 8;
  }
  return [...repeatedLayouts, ...automaticCategoryBentoLayout(remaining)];
}

function categoryBentoImageSizes(layout: CategoryBentoLayout, count: number): string {
  if (count === 1) {
    return "(max-width: 767px) calc(100vw - 3.5rem), (max-width: 1199px) calc(100vw - 3rem), min(88vw, 100rem)";
  }
  if (layout === "wide") {
    return "(max-width: 767px) calc(100vw - 3.5rem), (max-width: 1199px) calc(100vw - 3rem - 10vw), min(43vw, 50rem)";
  }
  return "(max-width: 767px) calc((100vw - 4.25rem) / 2), (max-width: 1199px) calc((100vw - 3.75rem - 10vw) / 2), min(21vw, 25rem)";
}

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
            { value: "tall", label: "Alta" },
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
    const rootCategories = context.project.categories.filter((category) => !category.parentId);
    const automaticLayout = automaticCategoryBentoLayout(rootCategories.length);
    const automaticItems = rootCategories.map((category, index) => ({
      categoryId: category.id,
      imageId: "",
      size: automaticLayout[index] ?? "compact",
    }));
    const configuredItems = context.settings.items
      .filter((item) => rootCategories.some((category) => category.id === item.categoryId))
      .filter(
        (item, index, items) =>
          items.findIndex((candidate) => candidate.categoryId === item.categoryId) === index,
      );
    const sourceItems = configuredItems.length ? configuredItems : automaticItems;
    const items = sourceItems
      .map((item) => {
        const category = context.project.categories.find(
          (candidate) => candidate.id === item.categoryId,
        );
        if (!category) return "";
        const categoryProduct = context.project.products.find(
          (product) =>
            product.status === "active" &&
            getCategoryProductIds(context.project, category.id as CategoryId).includes(product.id),
        );
        const productImageId =
          categoryProduct?.variants.find((variant) => variant.available)?.imageId ??
          categoryProduct?.imageIds[0];
        const imageId = item.imageId || category.imageId || productImageId;
        const image = imageId
          ? renderImage(context.project, imageId, {
              className: "catalog-category-bento-image",
              loading: "lazy",
              sizes: categoryBentoImageSizes(item.size, sourceItems.length),
              fallbackAlt: category.title,
            })
          : `<span class="catalog-category-bento-fallback" aria-hidden="true">${escapeHtml(category.title.charAt(0))}</span>`;
        const layout = item.size;
        const productCount = getCategoryProductIds(
          context.project,
          category.id as CategoryId,
        ).filter((id) => activeProducts.has(id)).length;
        return `<a class="catalog-category-bento-item catalog-category-bento-item--${layout}" href="/categorias/${escapeAttribute(category.slug)}/" aria-label="Explorar ${escapeAttribute(category.title)}"><span class="catalog-category-bento-label"><span class="catalog-category-bento-title">${escapeHtml(category.title)}</span></span>${productCount ? `<small>${productCount} productos</small>` : ""}<div class="catalog-category-bento-media">${image}</div></a>`;
      })
      .filter(Boolean)
      .join("");
    const searchEnabled =
      context.project.navigation.showSearch && context.project.commerceTemplates.search.enabled;
    return moduleRoot(
      "catalog-category-bento",
      context.section,
      safeHtml(
        `<div class="catalog-category-bento-section"><header><h2 class="catalog-category-bento-heading"><span class="catalog-category-bento-heading-inner">${escapeHtml(context.settings.title)}</span></h2>${items && searchEnabled ? '<a class="catalog-category-bento-all" href="/buscar/">Ver todo el catálogo</a>' : ""}</header><div class="catalog-category-bento-grid" data-category-count="${sourceItems.length}" data-motion-zone="items">${items || '<p class="catalog-empty">Todavía no hay categorías para mostrar.</p>'}</div></div>`,
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
      ],
    },
  ],
  motionZones: modernItemsZone,
  styleAsset: scopedAssetId("catalog-modern"),
  render(context) {
    const items = context.settings.items;
    if (!items.length) return moduleRoot("catalog-testimonials", context.section, safeHtml(""));
    const trackId = `catalog-testimonials-track-${context.section.id}`;
    return moduleRoot(
      "catalog-testimonials",
      context.section,
      safeHtml(
        `<div class="catalog-testimonials-section"><header><h2>${escapeHtml(context.settings.title)}</h2><div class="catalog-testimonials-controls" role="group" aria-label="Controles de testimonios"><button type="button" data-testimonials-prev aria-controls="${escapeAttribute(trackId)}" aria-label="Testimonio anterior">←</button><button type="button" data-testimonials-next aria-controls="${escapeAttribute(trackId)}" aria-label="Testimonio siguiente">→</button></div></header><div id="${escapeAttribute(trackId)}" class="catalog-testimonials-track" data-motion-zone="items" aria-label="Testimonios de clientes" role="region">${items.map((item) => `<article class="catalog-testimonial"><p class="catalog-testimonial-rating" aria-label="${item.rating} de 5">${"★".repeat(item.rating)}</p><h3>${escapeHtml(item.author)}</h3>${item.context ? `<p class="catalog-testimonial-context">${escapeHtml(item.context)}</p>` : ""}<blockquote>“${escapeHtml(item.body)}”</blockquote></article>`).join("")}</div></div>`,
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
        `<div class="catalog-newsletter-inner" data-motion-zone="content"><div><h2>${escapeHtml(context.settings.title)}</h2><p>${escapeHtml(context.settings.body)}</p></div><a class="catalog-newsletter-action" href="${escapeAttribute(safeUrl(context.settings.actionHref))}">${escapeHtml(context.settings.actionLabel)}</a></div>`,
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
      context.project.identity.address
        ? `<span>${escapeHtml(context.project.identity.address)}</span>`
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
    const searchEnabled =
      context.project.navigation.showSearch && context.project.commerceTemplates.search.enabled;
    const catalogLink = firstCollection
      ? { label: firstCollection.title, href: `/colecciones/${firstCollection.slug}/` }
      : firstCategory
        ? { label: firstCategory.title, href: `/categorias/${firstCategory.slug}/` }
        : searchEnabled
          ? { label: context.project.navigation.catalogLabel, href: "/buscar/" }
          : undefined;
    const catalogLinkMarkup = catalogLink
      ? `<a href="${escapeAttribute(catalogLink.href)}">${escapeHtml(catalogLink.label)}</a>`
      : "";
    const searchLink = searchEnabled ? `<a href="/buscar/">Buscar</a>` : "";
    return moduleRoot(
      "catalog-footer",
      context.section,
      safeHtml(
        `<div class="catalog-footer-inner" data-motion-zone="content"><div class="catalog-footer-brand"><a class="catalog-brand" href="/">${renderBrand(context.project)}</a><p>${escapeHtml(note)}</p></div><nav aria-label="Catálogo"><strong>Explorar</strong><a href="/">Inicio</a>${catalogLinkMarkup}${searchLink}</nav><nav aria-label="Ayuda"><strong>Ayuda</strong><a href="/contacto/">Contacto</a><a href="/nosotros/">Nosotros</a>${policyLinks}</nav><address><strong>Contacto</strong>${contact}</address><small>© ${new Date(context.project.updatedAt).getUTCFullYear()} ${escapeHtml(context.project.identity.brandName)}</small></div>`,
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
    const checkoutLinkMarkup = hasPublicWhatsApp(context.project.whatsapp)
      ? `<a data-whatsapp-link href="#" target="_blank" rel="noopener noreferrer" hidden>Enviar pedido en WhatsApp</a>`
      : "";
    return moduleRoot(
      "catalog-cart-drawer",
      context.section,
      safeHtml(
        `<div class="solara-cart-backdrop catalog-cart-backdrop" data-solara-cart-close data-close-cart hidden></div><aside id="solara-cart" class="catalog-cart-drawer" data-cart-drawer aria-label="${escapeAttribute(context.settings.title)}" aria-modal="true" aria-hidden="true" inert tabindex="-1"><header><h2>${escapeHtml(context.settings.title)}</h2><button type="button" data-solara-cart-close data-close-cart aria-label="Cerrar carrito">Cerrar</button></header><div class="catalog-cart-items" data-solara-cart-items data-cart-lines><p class="catalog-empty">${escapeHtml(context.settings.emptyText)}</p></div><button class="catalog-secondary-action" type="button" data-solara-cart-close data-close-cart>Seguir comprando</button><div class="catalog-cart-summary"><p><span>Subtotal</span><strong data-cart-subtotal>${escapeHtml(formatMoney(0))}</strong></p><p><span>Entrega</span><strong> A coordinar</strong></p><p class="catalog-cart-total"><span>Total estimado</span><strong data-solara-cart-total data-cart-total>${escapeHtml(formatMoney(0))}</strong></p></div><form class="catalog-checkout-form" data-solara-checkout data-checkout-form><label for="catalog-drawer-name">Nombre</label><input id="catalog-drawer-name" name="name" autocomplete="name" required><label for="catalog-drawer-phone">Teléfono</label><input id="catalog-drawer-phone" name="phone" autocomplete="tel" inputmode="tel" pattern="[0-9+ ()-]{8,}" title="Ingresá un teléfono válido" required><label for="catalog-drawer-address">Dirección o punto de entrega</label><textarea id="catalog-drawer-address" name="address" autocomplete="street-address" required></textarea><label for="catalog-drawer-notes">Notas opcionales</label><textarea id="catalog-drawer-notes" name="notes"></textarea><button class="catalog-primary-action" type="submit">${escapeHtml(context.settings.checkoutLabel)}</button><pre data-order-preview aria-live="polite"></pre>${checkoutLinkMarkup}</form></aside>`,
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
