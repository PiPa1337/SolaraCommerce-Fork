/** Editor de identidad, contacto, navegación y copy que completa la plantilla base. */

import type { Icon } from "@phosphor-icons/react";
import {
  ArrowDown,
  ArrowUp,
  Article,
  CaretDown,
  CheckCircle,
  CurrencyDollar,
  FloppyDisk,
  Globe,
  List,
  Storefront,
  Trash,
  WhatsappLogo,
} from "@phosphor-icons/react";
import type { ImageAsset, StoreProjectV1 } from "@solara/project-schema";
import {
  ARGENTINA_LEGAL_PROFILE,
  catalogModernPhoneValue,
  SlugSchema,
} from "@solara/project-schema";
import { type ReactNode, useCallback, useEffect, useId, useRef, useState } from "react";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { ImageAssetPicker } from "../components/ImageAssetPicker";
import { StatusBadge, Toggle } from "../components/primitives";
import { ResponsiveAssetImage } from "../components/ResponsiveAssetImage";
import { useToast } from "../components/Toast";
import { Button, Field, IconButton, SectionHeader } from "../components/Ui";
import { createFaviconAsset, createSiteCoverAsset } from "../lib/seoMedia";

const PHONE_PATTERN = /^\d{8,15}$/;
const CATALOG_LABEL_MAX_LENGTH = 40;
const NAVIGATION_LABEL_MAX_LENGTH = 80;
const NAVIGATION_ITEMS_MAX = 20;
const NAVIGATION_CHILDREN_MAX = 12;

/** Campos de publicCopy con restricción de edición por diseño. */
const RESTRICTED_COPY_FIELDS = new Set([
  "whatsapp.confirmation",
  "checkout.disclaimer",
  "checkout.verificationWarning",
  "contact.emailSubject",
  "whatsapp.orderGreeting",
  "export.skipToContent",
  "whatsapp.ask",
  "whatsapp.purchase",
  "hero.pauseVideo",
  "hero.resumeVideo",
  "hero.slidePrev",
  "hero.slideNext",
  "cart.phoneInvalid",
  "navigation.openMenu",
  "navigation.closeMenu",
  "product.noStock",
  "cart.unavailable",
  "accessibility.benefits",
  "accessibility.productInfo",
  "accessibility.catalogSummary",
  "accessibility.mobileNavigation",
  "accessibility.mainNavigation",
  "accessibility.announcements",
  "accessibility.heroSlides",
  "accessibility.goToSlide",
  "search.submit",
  "search.close",
  "search.loading",
  "search.queryTooShort",
  "navigation.close",
  "filters.resultCount",
  "hero.activeProducts",
  "search.queryLabel",
  "product.availability",
  "product.details",
  "product.policies",
  "hero.benefits",
  "search.loading",
  "search.empty",
  "navigation.viewAll",
  "export.categoryChildren",
  "export.breadcrumbs",
  "export.pagination",
  "export.previous",
  "export.next",
  "export.variantLinks",
  "export.viewCollection",
  "export.viewImage",
  "export.categoryProducts",
  "errors.catalogLoad",
  "errors.searchIndexLoad",
  "empty.cart",
  "empty.collections",
  "empty.filteredProducts",
  "empty.products",
  "filters.title",
  "filters.availability",
  "filters.availableOnly",
  "filters.tag",
  "filters.filterByTag",
  "filters.all",
  "filters.price",
  "filters.minimum",
  "filters.maximum",
  "filters.sort",
  "filters.recommended",
  "filters.priceAsc",
  "filters.priceDesc",
  "filters.name",
  "product.available",
  "product.outOfStock",
  "product.from",
  "product.options",
  "product.quantity",
  "product.sku",
]);

/** Campos que contienen placeholders técnicos ({storeName}) que no deben eliminarse. */
const PLACEHOLDER_COPY_FIELDS = new Set([
  "contact.emailSubject",
  "whatsapp.orderGreeting",
  "search.suggestion",
  "export.pageOf",
  "export.exploreCategory",
  "export.viewImage",
]);

/** Campos con longitud mínima de validación. */
const MIN_LENGTH_COPY_FIELDS: Record<string, number> = {
  "whatsapp.ask": 10,
  "whatsapp.purchase": 10,
  "cart.phoneInvalid": 10,
  "navigation.openMenu": 5,
  "navigation.closeMenu": 5,
  "product.noStock": 3,
  "cart.unavailable": 3,
  "filters.resultCount": 3,
  "hero.activeProducts": 3,
};

const PUBLIC_COPY_FIELDS = [
  { group: "navigation", key: "home", label: "Inicio" },
  { group: "navigation", key: "catalog", label: "Catálogo" },
  { group: "navigation", key: "contact", label: "Contacto" },
  { group: "navigation", key: "about", label: "Nosotros" },
  { group: "navigation", key: "search", label: "Búsqueda" },
  { group: "navigation", key: "cart", label: "Carrito" },
  { group: "navigation", key: "viewAll", label: "Ver todo" },
  { group: "navigation", key: "openMenu", label: "Abrir menú" },
  { group: "navigation", key: "closeMenu", label: "Cerrar menú" },
  { group: "navigation", key: "close", label: "Cerrar" },
  { group: "search", key: "title", label: "Título de búsqueda" },
  { group: "search", key: "placeholder", label: "Placeholder de búsqueda" },
  { group: "search", key: "queryLabel", label: "Ayuda de búsqueda" },
  { group: "search", key: "submit", label: "Enviar búsqueda" },
  { group: "search", key: "close", label: "Cerrar búsqueda" },
  { group: "search", key: "empty", label: "Búsqueda sin consulta" },
  { group: "search", key: "queryTooShort", label: "Búsqueda demasiado corta" },
  { group: "search", key: "loading", label: "Búsqueda en progreso" },
  { group: "search", key: "noResults", label: "Sin resultados" },
  { group: "search", key: "suggestion", label: "Sugerencia de búsqueda" },
  { group: "search", key: "error", label: "Error de búsqueda" },
  { group: "filters", key: "title", label: "Título de filtros" },
  { group: "filters", key: "availability", label: "Disponibilidad" },
  { group: "filters", key: "availableOnly", label: "Sólo disponibles" },
  { group: "filters", key: "tag", label: "Etiqueta" },
  { group: "filters", key: "filterByTag", label: "Ayuda de etiqueta" },
  { group: "filters", key: "all", label: "Todas las opciones" },
  { group: "filters", key: "price", label: "Precio" },
  { group: "filters", key: "minimum", label: "Precio mínimo" },
  { group: "filters", key: "maximum", label: "Precio máximo" },
  { group: "filters", key: "sort", label: "Ordenar" },
  { group: "filters", key: "recommended", label: "Orden recomendado" },
  { group: "filters", key: "priceAsc", label: "Orden precio menor" },
  { group: "filters", key: "priceDesc", label: "Orden precio mayor" },
  { group: "filters", key: "name", label: "Orden nombre" },
  { group: "filters", key: "resultCount", label: "Contador de resultados" },
  { group: "product", key: "available", label: "Producto disponible" },
  { group: "product", key: "outOfStock", label: "Producto agotado" },
  { group: "product", key: "from", label: "Prefijo de precio" },
  { group: "product", key: "variant", label: "Variante" },
  { group: "product", key: "quantity", label: "Cantidad" },
  { group: "product", key: "sku", label: "SKU" },
  { group: "product", key: "availability", label: "Disponibilidad" },
  { group: "product", key: "details", label: "Detalles" },
  { group: "product", key: "policies", label: "Políticas del producto" },
  { group: "product", key: "shipping", label: "Envíos del producto" },
  { group: "product", key: "returns", label: "Cambios del producto" },
  { group: "product", key: "askWhatsApp", label: "Consultar por WhatsApp" },
  { group: "product", key: "addToCart", label: "Agregar al carrito" },
  { group: "product", key: "noStock", label: "Sin stock" },
  { group: "product", key: "related", label: "Productos relacionados" },
  { group: "product", key: "options", label: "Opciones del producto" },
  { group: "product", key: "reviews", label: "Reseñas" },
  { group: "product", key: "reviewEyebrow", label: "Introducción de reseñas" },
  { group: "product", key: "reviewTitle", label: "Título de reseñas" },
  { group: "product", key: "verifiedPurchase", label: "Compra verificada" },
  { group: "hero", key: "benefits", label: "Beneficios del hero" },
  { group: "hero", key: "activeProducts", label: "Productos activos del hero" },
  { group: "hero", key: "categories", label: "Categorías del hero" },
  { group: "hero", key: "contact", label: "Contacto del hero" },
  { group: "hero", key: "whatsapp", label: "WhatsApp del hero" },
  { group: "hero", key: "directOrder", label: "Pedido directo del hero" },
  { group: "hero", key: "inquiries", label: "Consultas del hero" },
  { group: "hero", key: "whatsappAction", label: "Acción WhatsApp del hero" },
  { group: "hero", key: "pauseVideo", label: "Pausar video del hero" },
  { group: "hero", key: "resumeVideo", label: "Reanudar video del hero" },
  { group: "hero", key: "slidePrev", label: "Slide anterior del hero" },
  { group: "hero", key: "slideNext", label: "Slide siguiente del hero" },
  { group: "contact", key: "whatsappFallback", label: "Fallback sin WhatsApp" },
  { group: "contact", key: "emailFallback", label: "Fallback sin email" },
  { group: "contact", key: "emailAction", label: "Acción de email" },
  { group: "contact", key: "success", label: "Confirmación de contacto" },
  { group: "contact", key: "reasonLabel", label: "Etiqueta del motivo" },
  { group: "contact", key: "optionsAction", label: "Acción de opciones de contacto" },
  { group: "contact", key: "email", label: "Campo email" },
  { group: "contact", key: "phone", label: "Campo teléfono" },
  { group: "contact", key: "whatsapp", label: "Canal WhatsApp" },
  { group: "contact", key: "address", label: "Campo dirección" },
  { group: "contact", key: "hours", label: "Etiqueta de horarios" },
  { group: "contact", key: "directions", label: "Acción de ubicación" },
  { group: "contact", key: "javascriptFallback", label: "Fallback sin JavaScript" },
  { group: "contact", key: "whatsappAction", label: "Acción WhatsApp" },
  { group: "contact", key: "reason", label: "Campo motivo" },
  { group: "contact", key: "orderNumber", label: "Campo número de pedido" },
  { group: "contact", key: "message", label: "Campo mensaje" },
  { group: "contact", key: "emailSubject", label: "Asunto del email de contacto" },
  { group: "cart", key: "close", label: "Cerrar carrito" },
  { group: "cart", key: "continueShopping", label: "Seguir comprando" },
  { group: "cart", key: "subtotal", label: "Subtotal" },
  { group: "cart", key: "delivery", label: "Entrega" },
  { group: "cart", key: "deliveryToCoordinate", label: "Entrega a coordinar" },
  { group: "cart", key: "estimatedTotal", label: "Total estimado" },
  { group: "cart", key: "name", label: "Nombre del comprador" },
  { group: "cart", key: "phone", label: "Teléfono del comprador" },
  { group: "cart", key: "address", label: "Dirección de entrega" },
  { group: "cart", key: "locality", label: "Localidad / provincia" },
  { group: "cart", key: "postalCode", label: "Código postal" },
  { group: "cart", key: "notes", label: "Notas del pedido" },
  { group: "cart", key: "remove", label: "Eliminar del carrito" },
  { group: "cart", key: "unavailable", label: "Producto no disponible" },
  { group: "cart", key: "exploreCategories", label: "Explorar categorías" },
  { group: "cart", key: "phoneInvalid", label: "Error de teléfono inválido" },
  { group: "checkout", key: "submit", label: "Preparar pedido" },
  { group: "checkout", key: "sendWhatsApp", label: "Enviar pedido por WhatsApp" },
  { group: "checkout", key: "coordinate", label: "Coordinar pedido" },
  { group: "checkout", key: "continue", label: "Continuar compra" },
  { group: "checkout", key: "summary", label: "Resumen del pedido" },
  { group: "checkout", key: "selection", label: "Selección del pedido" },
  { group: "checkout", key: "prepare", label: "Ayuda del pedido" },
  { group: "checkout", key: "invalidItems", label: "Error de disponibilidad" },
  { group: "checkout", key: "total", label: "Total del pedido" },
  { group: "checkout", key: "disclaimer", label: "Aviso de confirmación" },
  { group: "checkout", key: "verificationWarning", label: "Advertencia de verificación" },
  { group: "checkout", key: "delivery", label: "Entrega del checkout" },
  { group: "checkout", key: "emptyCart", label: "Carrito vacío al comprar" },
  { group: "footer", key: "explore", label: "Footer: explorar" },
  { group: "footer", key: "help", label: "Footer: ayuda" },
  { group: "footer", key: "contact", label: "Footer: contacto" },
  { group: "footer", key: "privacy", label: "Footer: privacidad" },
  { group: "footer", key: "terms", label: "Footer: términos" },
  { group: "footer", key: "policies", label: "Footer: políticas" },
  { group: "footer", key: "copyright", label: "Footer: copyright" },
  { group: "footer", key: "madeWith", label: "Footer: atribución" },
  { group: "footer", key: "shipping", label: "Footer: envíos" },
  { group: "footer", key: "returns", label: "Footer: cambios" },
  { group: "empty", key: "products", label: "Estado vacío: productos" },
  { group: "empty", key: "collections", label: "Estado vacío: colecciones" },
  { group: "empty", key: "cart", label: "Estado vacío: carrito" },
  { group: "empty", key: "categories", label: "Estado vacío: categorías" },
  { group: "empty", key: "page", label: "Estado vacío: página" },
  { group: "empty", key: "filteredProducts", label: "Estado vacío: filtros" },
  { group: "errors", key: "catalogLoad", label: "Error al cargar catálogo" },
  { group: "errors", key: "searchIndexLoad", label: "Error al cargar búsqueda" },
  { group: "pages", key: "home", label: "Página de inicio" },
  { group: "pages", key: "catalog", label: "Página de catálogo" },
  { group: "pages", key: "products", label: "Página de productos" },
  { group: "pages", key: "categories", label: "Página de categorías" },
  { group: "pages", key: "search", label: "Página de búsqueda" },
  { group: "pages", key: "cart", label: "Página de carrito" },
  { group: "pages", key: "checkout", label: "Página de compra" },
  { group: "pages", key: "about", label: "Página nosotros" },
  { group: "pages", key: "contact", label: "Página de contacto" },
  { group: "pages", key: "shipping", label: "Página de envíos" },
  { group: "pages", key: "returns", label: "Página de cambios" },
  { group: "pages", key: "privacy", label: "Página de privacidad" },
  { group: "pages", key: "terms", label: "Página de términos" },
  { group: "pages", key: "aboutEyebrow", label: "Nosotros: introducción" },
  { group: "pages", key: "aboutFallbackTitle", label: "Nosotros: título" },
  { group: "pages", key: "aboutGuidanceTitle", label: "Nosotros: guía" },
  { group: "pages", key: "aboutInformationTitle", label: "Nosotros: información" },
  { group: "pages", key: "aboutContactAction", label: "Nosotros: contacto" },
  { group: "pages", key: "aboutSelectionTitle", label: "Nosotros: selección" },
  { group: "pages", key: "aboutSelectionFallback", label: "Nosotros: colección vacía" },
  { group: "pages", key: "aboutDeliveryTitle", label: "Nosotros: entrega" },
  { group: "pages", key: "aboutDirectTitle", label: "Nosotros: atención" },
  { group: "pages", key: "aboutDirectFallback", label: "Nosotros: contacto vacío" },
  { group: "pages", key: "contactEyebrow", label: "Contacto: introducción" },
  { group: "pages", key: "contactFallbackTitle", label: "Contacto: título" },
  { group: "pages", key: "contactDescription", label: "Contacto: descripción" },
  { group: "pages", key: "contactPurchaseTitle", label: "Contacto: CTA" },
  { group: "pages", key: "contactPurchaseDescription", label: "Contacto: ayuda" },
  { group: "pages", key: "notFoundEyebrow", label: "404: introducción" },
  { group: "pages", key: "notFound", label: "404: título de página" },
  { group: "pages", key: "notFoundTitle", label: "404: título" },
  { group: "pages", key: "notFoundDescription", label: "404: descripción" },
  { group: "pages", key: "returnHome", label: "404: volver al inicio" },
  { group: "pages", key: "viewCategories", label: "404: ver categorías" },
  { group: "pages", key: "shippingDeliveryInfo", label: "Envíos: información de entrega" },
  { group: "pages", key: "shippingPreparation", label: "Envíos: preparación del pedido" },
  { group: "pages", key: "shippingTransit", label: "Envíos: tiempo estimado de tránsito" },
  { group: "pages", key: "policyCoverage", label: "Políticas: cobertura" },
  { group: "pages", key: "returnsConditions", label: "Devoluciones: condiciones de cambio" },
  { group: "pages", key: "returnsInformedPeriod", label: "Devoluciones: plazo informado" },
  { group: "pages", key: "privacyDataUsage", label: "Privacidad: uso de tus datos" },
  { group: "pages", key: "privacyDescription", label: "Privacidad: descripción" },
  { group: "pages", key: "termsSubtitle", label: "Términos: subtítulo" },
  { group: "pages", key: "termsDescription", label: "Términos: descripción" },
  { group: "export", key: "policyDetailsTitle", label: "Políticas: detalles" },
  { group: "export", key: "policyQuestionsTitle", label: "Políticas: preguntas" },
  { group: "export", key: "policyQuestionsBody", label: "Políticas: ayuda" },
  { group: "export", key: "skipToContent", label: "Ir al contenido" },
  { group: "export", key: "breadcrumbs", label: "Migas de pan" },
  { group: "export", key: "pagination", label: "Paginación" },
  { group: "export", key: "previous", label: "Anterior (paginación)" },
  { group: "export", key: "next", label: "Siguiente (paginación)" },
  { group: "export", key: "pageOf", label: "Página actual de total" },
  { group: "export", key: "categoryChildren", label: "Subcategorías de categoría" },
  { group: "export", key: "exploreCategory", label: "Explorar categoría" },
  { group: "export", key: "categoryProducts", label: "Productos de categoría" },
  { group: "export", key: "viewCollection", label: "Ver colección" },
  { group: "export", key: "viewImage", label: "Ver imagen" },
  { group: "export", key: "variantLinks", label: "Enlaces directos a variantes" },
  { group: "whatsapp", key: "ask", label: "Consulta de WhatsApp" },
  { group: "whatsapp", key: "purchase", label: "Compra de WhatsApp" },
  { group: "whatsapp", key: "orderGreeting", label: "Saludo del pedido" },
  { group: "whatsapp", key: "product", label: "Producto en WhatsApp" },
  { group: "whatsapp", key: "variant", label: "Variante en WhatsApp" },
  { group: "whatsapp", key: "price", label: "Precio en WhatsApp" },
  { group: "whatsapp", key: "total", label: "Total en WhatsApp" },
  { group: "whatsapp", key: "customerName", label: "Nombre en WhatsApp" },
  { group: "whatsapp", key: "customerPhone", label: "Teléfono en WhatsApp" },
  { group: "whatsapp", key: "delivery", label: "Entrega en WhatsApp" },
  { group: "whatsapp", key: "notes", label: "Notas en WhatsApp" },
  { group: "whatsapp", key: "confirmation", label: "Confirmación en WhatsApp" },
  { group: "accessibility", key: "benefits", label: "Accesibilidad: beneficios" },
  { group: "accessibility", key: "productInfo", label: "Accesibilidad: producto" },
  { group: "accessibility", key: "catalogSummary", label: "Accesibilidad: catálogo" },
  { group: "accessibility", key: "mobileNavigation", label: "Accesibilidad: navegación móvil" },
  { group: "accessibility", key: "mainNavigation", label: "Accesibilidad: navegación principal" },
  { group: "accessibility", key: "announcements", label: "Accesibilidad: avisos" },
  { group: "accessibility", key: "testimonials", label: "Accesibilidad: testimonios" },
  {
    group: "accessibility",
    key: "testimonialsControls",
    label: "Accesibilidad: controles de testimonios",
  },
  {
    group: "accessibility",
    key: "previousTestimonial",
    label: "Accesibilidad: testimonio anterior",
  },
  { group: "accessibility", key: "nextTestimonial", label: "Accesibilidad: testimonio siguiente" },
  { group: "accessibility", key: "heroSlides", label: "Accesibilidad: slides del hero" },
  { group: "accessibility", key: "goToSlide", label: "Accesibilidad: ir al slide" },
  { group: "accessibility", key: "heroSlides", label: "Accesibilidad: slides del hero" },
  { group: "accessibility", key: "goToSlide", label: "Accesibilidad: ir al slide (usa {index})" },
] as const;

type PendingNavigationDelete =
  | {
      kind: "item";
      itemId: string;
      label: string;
      childCount: number;
    }
  | {
      kind: "child";
      itemId: string;
      childId: string;
      label: string;
      parentLabel: string;
    };

/** Clave de localStorage del estado plegado del Resumen (R8-B1): por tienda,
 *  con el mismo patrón que el pane del editor en Studio.tsx. */
const COLLAPSED_SECTIONS_KEY = "solara-resumen-collapsed";
const DEFAULT_COLLAPSED_SECTIONS = [
  "whatsapp",
  "domain",
  "price-format",
  "navigation",
  "pages",
  "public-copy",
] as const;

function defaultCollapsedSections(): ReadonlySet<string> {
  return new Set(DEFAULT_COLLAPSED_SECTIONS);
}

function readCollapsedSections(
  projectId: string,
  preferCompactStart: boolean,
): ReadonlySet<string> {
  try {
    const raw = window.localStorage.getItem(`${COLLAPSED_SECTIONS_KEY}:${projectId}`);
    if (!raw) return preferCompactStart ? defaultCollapsedSections() : new Set();
    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return new Set(parsed.filter((value): value is string => typeof value === "string"));
    }
  } catch {
    // Almacenamiento no disponible o contenido inválido: aplicar el inicio según la escala.
  }
  return preferCompactStart ? defaultCollapsedSections() : new Set();
}

function writeCollapsedSections(projectId: string, sections: ReadonlySet<string>): void {
  try {
    window.localStorage.setItem(
      `${COLLAPSED_SECTIONS_KEY}:${projectId}`,
      JSON.stringify([...sections]),
    );
  } catch {
    // Almacenamiento no disponible: el pliegue queda sólo para la sesión.
  }
}

function isValidUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

/** Destino de navegación: ruta interna (ej. /contacto/, nunca //) o URL http(s), mailto o tel.
 *  Espeja la validación del schema (`validateHref`): mailto:/tel: sólo si el commit lo acepta. */
function isValidDestination(value: string): boolean {
  const trimmed = value.trim();
  if (trimmed.startsWith("/") && !trimmed.startsWith("//")) return true;
  try {
    return ["http:", "https:", "mailto:", "tel:"].includes(new URL(trimmed).protocol);
  } catch {
    return false;
  }
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function slugValidationError(value: string): string | undefined {
  const trimmed = value.trim();
  if (trimmed === "") return "Completá el slug de la tienda.";
  if (trimmed.length > 120) return "Usá hasta 120 caracteres.";
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(trimmed)) {
    return "Usá sólo minúsculas, números y guiones; sin espacios ni acentos.";
  }
  const result = SlugSchema.safeParse(trimmed);
  return result.success
    ? undefined
    : (result.error.issues[0]?.message ?? "El slug no es válido para una ruta.");
}

function destinationError(href: string): string | undefined {
  return href.trim() !== "" && !isValidDestination(href)
    ? "Usá http(s) o una ruta interna (ej. /contacto/)."
    : undefined;
}

/** Sección plegable del formulario (T4.2): encabezado botón + panel con animación. */
function AccordionSection({
  sectionKey,
  label,
  icon: IconComponent,
  badge,
  collapsed,
  onToggle,
  children,
}: {
  sectionKey: string;
  label: string;
  icon: Icon;
  badge?: ReactNode;
  collapsed: boolean;
  onToggle(): void;
  children: ReactNode;
}) {
  const toggleId = useId();
  const panelId = useId();
  return (
    <section
      className="overview-accordion"
      data-testid="ui-accordion"
      data-accordion-id={sectionKey}
    >
      <h3 className="overview-accordion__heading">
        <button
          type="button"
          id={toggleId}
          className="overview-accordion__toggle"
          aria-expanded={!collapsed}
          aria-controls={panelId}
          onClick={onToggle}
        >
          <IconComponent aria-hidden size={19} />
          <span>{label}</span>
          {badge}
          <CaretDown aria-hidden size={16} className="overview-accordion__caret" />
        </button>
      </h3>
      <section
        className="overview-accordion__panel"
        id={panelId}
        aria-labelledby={toggleId}
        hidden={collapsed}
      >
        {children}
      </section>
    </section>
  );
}

export function Overview({
  project,
  onChange,
}: {
  project: StoreProjectV1;
  onChange(project: StoreProjectV1): void;
}) {
  const [pendingNavDelete, setPendingNavDelete] = useState<PendingNavigationDelete | null>(null);
  const [collapsedSections, setCollapsedSections] = useState<ReadonlySet<string>>(() =>
    readCollapsedSections(project.id, project.products.length > 100 || project.assets.length > 100),
  );
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [fieldDrafts, setFieldDrafts] = useState<Record<string, string>>({});
  const [unsaved, setUnsaved] = useState(false);
  const navigationItemsLimitId = useId();
  const unsavedTimer = useRef<number | undefined>(undefined);
  /**
   * Mantiene la base más reciente entre eventos de controles distintos. La
   * vista recibe el proyecto por props y React puede agrupar varios commits;
   * usar sólo `project` dentro de callbacks consecutivos podía hacer que el
   * último campo pisara el anterior.
   */
  const latestProjectRef = useRef(project);
  latestProjectRef.current = project;
  /** Último campo que SÍ commiteó (no el último editado): sólo su borrador se
   *  limpia cuando el proyecto cambia. Un borrador inválido sin commitear no
   *  debe ser destruido por un commit de otro campo. */
  const lastCommittedFieldRef = useRef<string | null>(null);
  const { success } = useToast();

  /** Valor visible de un campo validado: el borrador local prima sobre el proyecto. */
  const fieldValue = (key: string, projectValue: string) => fieldDrafts[key] ?? projectValue;
  /** Guarda el borrador local y commitea sólo cuando es válido para el schema. */
  const updateField = (
    key: string,
    next: string,
    isValid: (value: string) => boolean,
    onCommit: (value: string) => void,
  ) => {
    markUnsaved();
    setFieldDrafts((current) => ({ ...current, [key]: next }));
    if (isValid(next)) {
      lastCommittedFieldRef.current = key;
      onCommit(next);
    }
  };

  const phoneDisplay = fieldValue("phone", catalogModernPhoneValue(project.whatsapp.phone));
  const phoneMissing = phoneDisplay === "";
  const phoneInvalid = phoneDisplay !== "" && !PHONE_PATTERN.test(phoneDisplay);
  const phoneError = phoneMissing
    ? "Falta completar el número de WhatsApp."
    : phoneInvalid
      ? "Usá entre 8 y 15 dígitos con código de país y área."
      : undefined;
  const legalNameDisplay = fieldValue("legalName", project.identity.legalName);
  const legalNameError = legalNameDisplay.trim() === "" ? "Completá la razón social." : undefined;
  const urlDisplay = fieldValue("baseUrl", project.baseUrl);
  const urlError =
    urlDisplay.trim() === ""
      ? "Completá la URL pública."
      : !isValidUrl(urlDisplay)
        ? "Ingresá una URL válida con http(s)."
        : undefined;
  const slugDisplay = fieldValue("slug", project.slug);
  const slugError = slugValidationError(slugDisplay);
  const nameDisplay = fieldValue("name", project.name);
  const nameError = nameDisplay.trim() === "" ? "Completá el nombre de la tienda." : undefined;
  const descriptionDisplay = fieldValue("description", project.identity.description);
  const descriptionError =
    descriptionDisplay.trim() === "" ? "Completá la descripción de la marca." : undefined;
  const catalogLabelDisplay = fieldValue("catalogLabel", project.navigation.catalogLabel);
  const catalogLabelError =
    catalogLabelDisplay.trim() === ""
      ? "Completá el nombre del catálogo."
      : catalogLabelDisplay.length > CATALOG_LABEL_MAX_LENGTH
        ? `Usá hasta ${CATALOG_LABEL_MAX_LENGTH} caracteres.`
        : undefined;
  const emailDisplay = fieldValue("email", project.identity.email);
  const emailError =
    emailDisplay.trim() !== "" && !isValidEmail(emailDisplay)
      ? "Ingresá un email válido."
      : undefined;

  const markUnsaved = useCallback(() => {
    setUnsaved(true);
    window.clearTimeout(unsavedTimer.current);
    unsavedTimer.current = window.setTimeout(() => setUnsaved(false), 1200);
  }, []);

  useEffect(() => () => window.clearTimeout(unsavedTimer.current), []);

  /* biome-ignore lint/correctness/useExhaustiveDependencies: al cambiar el proyecto (commit o undo) limpiar sólo el borrador del campo que commiteó, no todos ni el último editado. */
  useEffect(() => {
    const key = lastCommittedFieldRef.current;
    lastCommittedFieldRef.current = null;
    if (!key) return;
    const withoutKey = (current: Record<string, string>) =>
      key in current
        ? Object.fromEntries(Object.entries(current).filter(([draftKey]) => draftKey !== key))
        : current;
    setDrafts(withoutKey);
    setFieldDrafts(withoutKey);
  }, [project.updatedAt]);

  const toggleSection = (sectionId: string) =>
    setCollapsedSections((current) => {
      const next = new Set(current);
      if (next.has(sectionId)) next.delete(sectionId);
      else next.add(sectionId);
      writeCollapsedSections(project.id, next);
      return next;
    });

  const deleteNavItem = (itemId: string) => {
    updateNavigation({
      items: latestProjectRef.current.navigation.items.filter((current) => current.id !== itemId),
    });
    success("Enlace de navegación eliminado");
  };
  const commit = (patch: Partial<StoreProjectV1>) => {
    markUnsaved();
    const nextProject = {
      ...latestProjectRef.current,
      ...patch,
      updatedAt: new Date().toISOString(),
    };
    latestProjectRef.current = nextProject;
    onChange(nextProject);
  };
  const setIdentityImage = (target: "logo" | "cover" | "favicon", assetId: string) => {
    const currentProject = latestProjectRef.current;
    const selectedAssetId = currentProject.assets.find((asset) => asset.id === assetId)?.id;
    if (target === "logo") {
      commit({
        identity: {
          ...currentProject.identity,
          logoAssetId: selectedAssetId,
        },
      });
      return;
    }
    if (target === "favicon") {
      commit({
        seo: {
          ...currentProject.seo,
          faviconAssetId: selectedAssetId,
        },
      });
      return;
    }
    commit({
      seo: {
        ...currentProject.seo,
        socialImageId: selectedAssetId,
      },
    });
  };
  const uploadIdentityImage = (target: "logo" | "cover" | "favicon", asset: ImageAsset) => {
    const currentProject = latestProjectRef.current;
    const assets = currentProject.assets.some((current) => current.id === asset.id)
      ? currentProject.assets
      : [...currentProject.assets, asset];
    if (target === "logo") {
      commit({
        assets,
        identity: { ...currentProject.identity, logoAssetId: asset.id },
      });
      return;
    }
    if (target === "favicon") {
      commit({
        assets,
        seo: { ...currentProject.seo, faviconAssetId: asset.id },
      });
      return;
    }
    commit({
      assets,
      seo: { ...currentProject.seo, socialImageId: asset.id },
    });
  };
  const identityImagePreview = (assetId: string | undefined, label: string) => {
    const asset = project.assets.find((current) => current.id === assetId);
    return (
      <div className="identity-media-preview">
        {asset ? (
          <ResponsiveAssetImage asset={asset} alt={asset.alt || label} sizes="180px" />
        ) : (
          <span>No hay una imagen configurada.</span>
        )}
      </div>
    );
  };
  const updateNavigation = (patch: Partial<StoreProjectV1["navigation"]>) =>
    commit({ navigation: { ...latestProjectRef.current.navigation, ...patch } });
  const updatePublicCopy = (group: string, key: string, value: string) => {
    const currentProject = latestProjectRef.current;
    const currentGroup = currentProject.publicCopy[
      group as keyof StoreProjectV1["publicCopy"]
    ] as Record<string, string>;
    commit({
      publicCopy: {
        ...currentProject.publicCopy,
        [group]: { ...currentGroup, [key]: value },
      },
    });
  };
  const updateLegalProfile = (patch: Partial<StoreProjectV1["legalProfile"]>) => {
    const currentProject = latestProjectRef.current;
    commit({ legalProfile: { ...currentProject.legalProfile, ...patch } });
  };
  const updateNavigationItem = (
    itemId: string,
    patch: Partial<StoreProjectV1["navigation"]["items"][number]>,
  ) =>
    updateNavigation({
      items: latestProjectRef.current.navigation.items.map((item) =>
        item.id === itemId ? { ...item, ...patch } : item,
      ),
    });
  const confirmNavigationDelete = () => {
    if (!pendingNavDelete) return;
    if (pendingNavDelete.kind === "item") {
      deleteNavItem(pendingNavDelete.itemId);
    } else {
      const parent = latestProjectRef.current.navigation.items.find(
        (item) => item.id === pendingNavDelete.itemId,
      );
      if (parent) {
        updateNavigationItem(parent.id, {
          children: (parent.children ?? []).filter(
            (child) => child.id !== pendingNavDelete.childId,
          ),
        });
        success("Subenlace de navegación eliminado");
      }
    }
    setPendingNavDelete(null);
  };
  const moveNavigationItem = (itemId: string, delta: -1 | 1) => {
    const currentItems = latestProjectRef.current.navigation.items;
    const index = currentItems.findIndex((item) => item.id === itemId);
    const target = index + delta;
    if (index < 0 || target < 0 || target >= currentItems.length) return;
    const items = [...currentItems];
    const current = items[index];
    const next = items[target];
    if (!current || !next) return;
    items[index] = next;
    items[target] = current;
    updateNavigation({ items });
  };
  const moveNavigationChild = (itemId: string, childId: string, delta: -1 | 1) => {
    const parent = latestProjectRef.current.navigation.items.find((item) => item.id === itemId);
    if (!parent?.children) return;
    const index = parent.children.findIndex((child) => child.id === childId);
    const target = index + delta;
    if (index < 0 || target < 0 || target >= parent.children.length) return;
    const children = [...parent.children];
    const current = children[index];
    const next = children[target];
    if (!current || !next) return;
    children[index] = next;
    children[target] = current;
    updateNavigationItem(itemId, { children });
  };
  const updatePage = (pageId: string, patch: Partial<StoreProjectV1["pages"][number]>) =>
    commit({
      pages: latestProjectRef.current.pages.map((page) =>
        page.id === pageId ? { ...page, ...patch } : page,
      ),
    });

  /** Input con borrador local: edita sin commitear y confirma al salir sólo si el destino es válido. */
  const destinationInput = (key: string, value: string, onCommit: (next: string) => void) => (
    <input
      type="url"
      aria-label="Destino"
      value={drafts[key] ?? value}
      onChange={(event) => {
        setDrafts((current) => ({ ...current, [key]: event.target.value }));
      }}
      onBlur={() => {
        const next = drafts[key] ?? value;
        if (next !== value && destinationError(next) === undefined) {
          lastCommittedFieldRef.current = key;
          onCommit(next);
        }
      }}
    />
  );

  const saveIndicator = (extraClass = "", testId: string | null = null) => (
    <output
      className={`overview-save-indicator${unsaved ? " overview-save-indicator--unsaved" : ""} ${extraClass}`}
      aria-live="polite"
      {...(testId ? { "data-testid": testId } : {})}
    >
      {unsaved ? <FloppyDisk aria-hidden size={15} /> : <CheckCircle aria-hidden size={15} />}
      <span>{unsaved ? "Sin guardar" : "Cambios guardados"}</span>
    </output>
  );

  return (
    <section className="workspace-section">
      <SectionHeader
        title="Resumen"
        description="Datos comerciales compartidos por la tienda, el pedido y la exportación."
        actions={saveIndicator("", "ui-save-indicator")}
      />
      <div className="form-clusters">
        <AccordionSection
          sectionKey="identity"
          label="Identidad"
          icon={Storefront}
          collapsed={collapsedSections.has("identity")}
          onToggle={() => toggleSection("identity")}
        >
          <div className="form-grid">
            <Field label="Nombre de la tienda" {...(nameError ? { error: nameError } : {})}>
              <input
                aria-label="Nombre de la tienda"
                value={nameDisplay}
                onChange={(event) =>
                  updateField(
                    "name",
                    event.target.value,
                    (next) => next.trim() !== "",
                    (next) =>
                      commit({
                        name: next,
                        identity: { ...latestProjectRef.current.identity, brandName: next },
                      }),
                  )
                }
              />
            </Field>
            <Field label="Razón social" {...(legalNameError ? { error: legalNameError } : {})}>
              <input
                aria-label="Razón social"
                value={legalNameDisplay}
                onChange={(event) =>
                  updateField(
                    "legalName",
                    event.target.value,
                    (next) => next.trim() !== "",
                    (next) =>
                      commit({
                        identity: { ...latestProjectRef.current.identity, legalName: next },
                      }),
                  )
                }
              />
            </Field>
            <Field
              label="Descripción"
              className="field--wide"
              {...(descriptionError ? { error: descriptionError } : {})}
            >
              <textarea
                rows={4}
                aria-label="Descripción"
                value={descriptionDisplay}
                onChange={(event) =>
                  updateField(
                    "description",
                    event.target.value,
                    (next) => next.trim() !== "",
                    (next) =>
                      commit({
                        identity: { ...latestProjectRef.current.identity, description: next },
                      }),
                  )
                }
              />
            </Field>
            <Field
              label="Logo de la tienda"
              hint="Se usa la misma imagen en el navbar y en el footer."
              className="field--wide"
            >
              <div className="identity-media-control">
                <ImageAssetPicker
                  value={project.identity.logoAssetId ?? ""}
                  assets={project.assets}
                  ariaLabel="Logo de la tienda"
                  onChange={(next) => setIdentityImage("logo", next)}
                  onUpload={(asset) => uploadIdentityImage("logo", asset)}
                />
                {identityImagePreview(project.identity.logoAssetId, "Logo de la tienda")}
              </div>
            </Field>
            <Field
              label="Favicon del sitio"
              hint="La imagen se convierte automáticamente en ICO multirresolución y fallback para iPhone."
              className="field--wide"
            >
              <div className="identity-media-control">
                <ImageAssetPicker
                  value={project.seo.faviconAssetId ?? ""}
                  assets={project.assets}
                  ariaLabel="Favicon del sitio"
                  onChange={(next) => setIdentityImage("favicon", next)}
                  onUpload={(asset) => uploadIdentityImage("favicon", asset)}
                  processFile={createFaviconAsset}
                />
                {identityImagePreview(project.seo.faviconAssetId, "Favicon del sitio")}
              </div>
            </Field>
            <Field
              label="Imagen de portada para SEO"
              hint="Se usa como imagen social al compartir la portada del sitio."
              className="field--wide"
            >
              <div className="identity-media-control">
                <ImageAssetPicker
                  value={project.seo.socialImageId ?? ""}
                  assets={project.assets}
                  ariaLabel="Imagen de portada para SEO"
                  onChange={(next) => setIdentityImage("cover", next)}
                  onUpload={(asset) => uploadIdentityImage("cover", asset)}
                  processFile={createSiteCoverAsset}
                />
                {identityImagePreview(project.seo.socialImageId, "Imagen de portada para SEO")}
              </div>
            </Field>
            <Field label="Email" {...(emailError ? { error: emailError } : {})}>
              <input
                type="email"
                aria-label="Email"
                value={emailDisplay}
                onChange={(event) =>
                  updateField(
                    "email",
                    event.target.value,
                    (next) => next === "" || isValidEmail(next),
                    (next) =>
                      commit({
                        identity: { ...latestProjectRef.current.identity, email: next },
                      }),
                  )
                }
              />
            </Field>
            <Field label="Teléfono">
              <input
                aria-label="Teléfono"
                value={project.identity.phone}
                onChange={(event) =>
                  commit({
                    identity: { ...latestProjectRef.current.identity, phone: event.target.value },
                  })
                }
              />
            </Field>
            <Field label="Dirección" className="field--wide">
              <input
                aria-label="Dirección"
                value={project.identity.address}
                onChange={(event) =>
                  commit({
                    identity: {
                      ...latestProjectRef.current.identity,
                      address: event.target.value,
                    },
                  })
                }
              />
            </Field>
            <Field label="Instagram" hint="URL completa del perfil.">
              <input
                type="url"
                aria-label="Instagram"
                value={project.identity.instagramUrl ?? ""}
                onChange={(event) =>
                  commit({
                    identity: {
                      ...latestProjectRef.current.identity,
                      instagramUrl: event.target.value,
                    },
                  })
                }
              />
            </Field>
            <Field label="Facebook" hint="URL completa de la página.">
              <input
                type="url"
                aria-label="Facebook"
                value={project.identity.facebookUrl ?? ""}
                onChange={(event) =>
                  commit({
                    identity: {
                      ...latestProjectRef.current.identity,
                      facebookUrl: event.target.value,
                    },
                  })
                }
              />
            </Field>
            <Field label="TikTok" hint="URL completa del perfil.">
              <input
                type="url"
                aria-label="TikTok"
                value={project.identity.tiktokUrl ?? ""}
                onChange={(event) =>
                  commit({
                    identity: {
                      ...latestProjectRef.current.identity,
                      tiktokUrl: event.target.value,
                    },
                  })
                }
              />
            </Field>
            <Field label="Usuario de X / Twitter" hint="Sólo el usuario, con o sin @.">
              <input
                aria-label="Usuario de X Twitter"
                value={project.identity.twitterHandle ?? ""}
                onChange={(event) =>
                  commit({
                    identity: {
                      ...latestProjectRef.current.identity,
                      twitterHandle: event.target.value,
                    },
                  })
                }
              />
            </Field>
          </div>
        </AccordionSection>

        <AccordionSection
          sectionKey="whatsapp"
          label="Pedido por WhatsApp"
          icon={WhatsappLogo}
          badge={
            <StatusBadge
              status={phoneInvalid ? "warning" : phoneMissing ? "idle" : "ok"}
              label={
                phoneInvalid ? "Revisar formato" : phoneMissing ? "Pendiente" : "Formato correcto"
              }
            />
          }
          collapsed={collapsedSections.has("whatsapp")}
          onToggle={() => toggleSection("whatsapp")}
        >
          <div className="form-grid">
            <Field
              label="Número internacional"
              hint="Sólo números, con código de país y área."
              {...(phoneError ? { error: phoneError } : {})}
            >
              <input
                inputMode="tel"
                aria-label="Número internacional"
                value={phoneDisplay}
                onChange={(event) =>
                  updateField(
                    "phone",
                    event.target.value.replace(/\D/g, ""),
                    (next) => next !== "" && PHONE_PATTERN.test(next),
                    (next) =>
                      commit({
                        whatsapp: { ...latestProjectRef.current.whatsapp, phone: next },
                      }),
                  )
                }
              />
            </Field>
            <Field label="Saludo del pedido" className="field--wide">
              <input
                aria-label="Saludo del pedido"
                value={project.whatsapp.greeting}
                onChange={(event) =>
                  commit({
                    whatsapp: {
                      ...latestProjectRef.current.whatsapp,
                      greeting: event.target.value,
                    },
                  })
                }
              />
            </Field>
            <Toggle
              checked={project.whatsapp.includeSku}
              onChange={(checked) =>
                commit({
                  whatsapp: { ...latestProjectRef.current.whatsapp, includeSku: checked },
                })
              }
              label="Incluir SKU en el mensaje"
            />
          </div>
        </AccordionSection>

        <AccordionSection
          sectionKey="domain"
          label="Dominio"
          icon={Globe}
          collapsed={collapsedSections.has("domain")}
          onToggle={() => toggleSection("domain")}
        >
          <div className="form-grid">
            <Field
              label="URL pública"
              hint="La exportación de producción usa esta URL para canonical y feeds."
              {...(urlError ? { error: urlError } : {})}
            >
              <input
                type="url"
                aria-label="URL pública"
                value={urlDisplay}
                onChange={(event) =>
                  updateField(
                    "baseUrl",
                    event.target.value,
                    (next) => next.trim() !== "" && isValidUrl(next),
                    (next) => commit({ baseUrl: next }),
                  )
                }
              />
            </Field>
            <Field
              label="Slug interno"
              hint="Minúsculas, números y guiones. Cambia las rutas futuras del sitio."
              {...(slugError ? { error: slugError } : {})}
            >
              <input
                aria-label="Slug interno"
                maxLength={120}
                autoCapitalize="none"
                autoComplete="off"
                spellCheck={false}
                value={slugDisplay}
                onChange={(event) =>
                  updateField(
                    "slug",
                    event.target.value,
                    (next) => SlugSchema.safeParse(next.trim()).success,
                    (next) => {
                      const result = SlugSchema.safeParse(next.trim());
                      if (result.success) commit({ slug: result.data });
                    },
                  )
                }
              />
            </Field>
          </div>
        </AccordionSection>

        <AccordionSection
          sectionKey="legal-profile"
          label="Perfil legal"
          icon={Article}
          collapsed={collapsedSections.has("legal-profile")}
          onToggle={() => toggleSection("legal-profile")}
        >
          <p className="form-help">
            El perfil determina la jurisdicción y las referencias legales del sitio. Los datos
            fiscales y comerciales deben ser los de tu tienda.
          </p>
          <div className="form-grid">
            <Field
              label="País legal"
              hint={`Perfil disponible actualmente para ${ARGENTINA_LEGAL_PROFILE.countryName}.`}
            >
              <input
                aria-label="País legal"
                value={`${ARGENTINA_LEGAL_PROFILE.countryName} (${project.legalProfile.countryCode})`}
                readOnly
              />
            </Field>
            <Field
              label="Última revisión"
              hint={`Fecha registrada: ${project.legalProfile.revisionAt?.slice(0, 10) ?? project.createdAt.slice(0, 10)}`}
            >
              <Button
                variant="secondary"
                data-testid="ui-legal-profile-review"
                onClick={() => updateLegalProfile({ revisionAt: new Date().toISOString() })}
              >
                Registrar revisión de políticas
              </Button>
            </Field>
            <Field label="CUIT / identificación fiscal">
              <input
                aria-label="CUIT identificación fiscal"
                value={project.legalProfile.taxId}
                onChange={(event) => updateLegalProfile({ taxId: event.target.value })}
              />
            </Field>
            <Field label="Jurisdicción declarada">
              <input
                aria-label="Jurisdicción declarada"
                value={project.legalProfile.jurisdiction}
                onChange={(event) => updateLegalProfile({ jurisdiction: event.target.value })}
              />
            </Field>
            <Field
              label="Medios de pago"
              hint="Separalos con comas; se muestran como información declarada por la tienda."
            >
              <input
                aria-label="Medios de pago"
                value={project.legalProfile.paymentMethods.join(", ")}
                onChange={(event) =>
                  updateLegalProfile({
                    paymentMethods: event.target.value
                      .split(",")
                      .map((value) => value.trim())
                      .filter(Boolean),
                  })
                }
              />
            </Field>
            <Field
              label="Canales de venta"
              hint="Separalos con comas; no agregues canales que la tienda no use."
            >
              <input
                aria-label="Canales de venta"
                value={project.legalProfile.salesChannels.join(", ")}
                onChange={(event) =>
                  updateLegalProfile({
                    salesChannels: event.target.value
                      .split(",")
                      .map((value) => value.trim())
                      .filter(Boolean),
                  })
                }
              />
            </Field>
            <Toggle
              checked={project.legalProfile.consumerRights.enabled}
              onChange={(checked) => updateLegalProfile({ consumerRights: { enabled: checked } })}
              label="Habilitar botón de arrepentimiento"
            />
            <p className="form-help">
              Se deriva del perfil protegido: {ARGENTINA_LEGAL_PROFILE.withdrawal.label} de{" "}
              {ARGENTINA_LEGAL_PROFILE.withdrawal.defaultDays} días y su autoridad oficial.
            </p>
            <Field label="Texto legal avanzado de privacidad" className="field--wide">
              <textarea
                aria-label="Texto legal avanzado de privacidad"
                rows={4}
                value={project.legalProfile.privacyOverride}
                onChange={(event) => updateLegalProfile({ privacyOverride: event.target.value })}
              />
            </Field>
            <Field label="Texto legal avanzado de términos" className="field--wide">
              <textarea
                aria-label="Texto legal avanzado de términos"
                rows={4}
                value={project.legalProfile.termsOverride}
                onChange={(event) => updateLegalProfile({ termsOverride: event.target.value })}
              />
            </Field>
          </div>
        </AccordionSection>

        <AccordionSection
          sectionKey="price-format"
          label="Formato de precios"
          icon={CurrencyDollar}
          collapsed={collapsedSections.has("price-format")}
          onToggle={() => toggleSection("price-format")}
        >
          <div className="form-grid">
            <Toggle
              checked={project.priceFractionDisplay === "auto"}
              onChange={(checked) => commit({ priceFractionDisplay: checked ? "auto" : "always" })}
              label="Ocultar centavos cuando sean cero"
            />
            <p className="form-help">
              Ejemplo: $1.500,00 se muestra como $1.500. Los precios con centavos, como $1.500,50,
              se mantienen completos.
            </p>
          </div>
        </AccordionSection>

        <AccordionSection
          sectionKey="navigation"
          label="Navegación pública"
          icon={List}
          collapsed={collapsedSections.has("navigation")}
          onToggle={() => toggleSection("navigation")}
        >
          <div className="form-grid">
            <Field
              label="Nombre del catálogo"
              hint={`${catalogLabelDisplay.length}/${CATALOG_LABEL_MAX_LENGTH} caracteres`}
              {...(catalogLabelError ? { error: catalogLabelError } : {})}
            >
              <input
                aria-label="Nombre del catálogo"
                maxLength={CATALOG_LABEL_MAX_LENGTH}
                value={catalogLabelDisplay}
                onChange={(event) =>
                  updateField(
                    "catalogLabel",
                    event.target.value,
                    (next) => next.trim() !== "" && next.length <= CATALOG_LABEL_MAX_LENGTH,
                    (next) => updateNavigation({ catalogLabel: next }),
                  )
                }
              />
            </Field>
            <div className="navigation-switches">
              {(
                [
                  ["showHome", "Mostrar Inicio"],
                  ["showSearch", "Mostrar búsqueda"],
                  ["showCart", "Mostrar carrito"],
                ] as const
              ).map(([key, label]) => (
                <Toggle
                  key={key}
                  checked={project.navigation[key]}
                  onChange={(checked) => updateNavigation({ [key]: checked })}
                  label={label}
                />
              ))}
            </div>
            <div className="navigation-switches field--wide">
              {(
                [
                  ["announcement", "Mostrar barra informativa"],
                  ["header", "Mostrar encabezado"],
                  ["footer", "Mostrar pie"],
                  ["cart", "Mostrar carrito lateral"],
                ] as const
              ).map(([key, label]) => (
                <Toggle
                  key={key}
                  checked={project.siteShell[key]}
                  onChange={(checked) =>
                    commit({
                      siteShell: { ...latestProjectRef.current.siteShell, [key]: checked },
                    })
                  }
                  label={label}
                />
              ))}
            </div>
            <div className="navigation-editor field--wide">
              {project.navigation.items.map((item, index) => {
                const itemHrefDraft = drafts[`nav-${item.id}`] ?? item.href ?? "";
                const itemHrefError = destinationError(itemHrefDraft);
                const itemLabelKey = `nav-label-${item.id}`;
                const itemLabelDisplay = fieldValue(itemLabelKey, item.label);
                const itemLabelError =
                  itemLabelDisplay.trim() === ""
                    ? "Completá el nombre del enlace."
                    : itemLabelDisplay.length > NAVIGATION_LABEL_MAX_LENGTH
                      ? `Usá hasta ${NAVIGATION_LABEL_MAX_LENGTH} caracteres.`
                      : undefined;
                const children = item.children ?? [];
                const childrenLimitReached = children.length >= NAVIGATION_CHILDREN_MAX;
                const childrenContextId = `nav-children-context-${item.id}`;
                const childrenLimitId = `nav-children-limit-${item.id}`;
                return (
                  <div className="navigation-editor-item" key={item.id}>
                    <div className="form-grid">
                      <Field
                        label={`Enlace ${index + 1}`}
                        hint={`${itemLabelDisplay.length}/${NAVIGATION_LABEL_MAX_LENGTH} caracteres`}
                        {...(itemLabelError ? { error: itemLabelError } : {})}
                      >
                        <input
                          aria-label={`Enlace ${index + 1}`}
                          maxLength={NAVIGATION_LABEL_MAX_LENGTH}
                          value={itemLabelDisplay}
                          onChange={(event) =>
                            updateField(
                              itemLabelKey,
                              event.target.value,
                              (next) =>
                                next.trim() !== "" && next.length <= NAVIGATION_LABEL_MAX_LENGTH,
                              (next) =>
                                updateNavigation({
                                  items: project.navigation.items.map((current) =>
                                    current.id === item.id ? { ...current, label: next } : current,
                                  ),
                                }),
                            )
                          }
                        />
                      </Field>
                      <Field
                        label="Destino"
                        description={`Destino del enlace ${item.label}`}
                        {...(itemHrefError ? { error: itemHrefError } : {})}
                      >
                        {destinationInput(`nav-${item.id}`, item.href ?? "", (next) =>
                          updateNavigationItem(item.id, { href: next }),
                        )}
                      </Field>
                    </div>
                    <div className="navigation-reorder">
                      <IconButton
                        icon={ArrowUp}
                        label={`Mover ${item.label} arriba`}
                        disabled={index === 0}
                        onClick={() => moveNavigationItem(item.id, -1)}
                      />
                      <IconButton
                        icon={ArrowDown}
                        label={`Mover ${item.label} abajo`}
                        disabled={index === project.navigation.items.length - 1}
                        onClick={() => moveNavigationItem(item.id, 1)}
                      />
                    </div>
                    <div className="navigation-children">
                      <span className="navigation-children-title">Subenlaces</span>
                      <span id={childrenContextId} className="visually-hidden">
                        Subenlaces de {item.label}
                      </span>
                      {children.map((child, childIndex) => {
                        const childHrefDraft =
                          drafts[`nav-${item.id}-${child.id}`] ?? child.href ?? "";
                        const childHrefError = destinationError(childHrefDraft);
                        const childLabelKey = `nav-child-label-${child.id}`;
                        const childLabelDisplay = fieldValue(childLabelKey, child.label);
                        const childLabelError =
                          childLabelDisplay.trim() === ""
                            ? "Completá el nombre del subenlace."
                            : childLabelDisplay.length > NAVIGATION_LABEL_MAX_LENGTH
                              ? `Usá hasta ${NAVIGATION_LABEL_MAX_LENGTH} caracteres.`
                              : undefined;
                        return (
                          <div className="navigation-child-editor" key={child.id}>
                            <Field
                              label={`Subenlace ${childIndex + 1}`}
                              description={`Subenlace ${child.label} de ${item.label}`}
                              hint={`${childLabelDisplay.length}/${NAVIGATION_LABEL_MAX_LENGTH} caracteres`}
                              {...(childLabelError ? { error: childLabelError } : {})}
                            >
                              <input
                                aria-label={`Subenlace ${childIndex + 1}`}
                                maxLength={NAVIGATION_LABEL_MAX_LENGTH}
                                value={childLabelDisplay}
                                onChange={(event) =>
                                  updateField(
                                    childLabelKey,
                                    event.target.value,
                                    (next) =>
                                      next.trim() !== "" &&
                                      next.length <= NAVIGATION_LABEL_MAX_LENGTH,
                                    (next) =>
                                      updateNavigationItem(item.id, {
                                        children: (item.children ?? []).map((current) =>
                                          current.id === child.id
                                            ? { ...current, label: next }
                                            : current,
                                        ),
                                      }),
                                  )
                                }
                              />
                            </Field>
                            <Field
                              label="Destino"
                              description={`Destino del subenlace ${child.label} de ${item.label}`}
                              {...(childHrefError ? { error: childHrefError } : {})}
                            >
                              {destinationInput(
                                `nav-${item.id}-${child.id}`,
                                child.href ?? "",
                                (next) =>
                                  updateNavigationItem(item.id, {
                                    children: (item.children ?? []).map((current) =>
                                      current.id === child.id
                                        ? { ...current, href: next }
                                        : current,
                                    ),
                                  }),
                              )}
                            </Field>
                            <div className="navigation-reorder">
                              <IconButton
                                icon={ArrowUp}
                                label={`Mover ${child.label} arriba`}
                                disabled={childIndex === 0}
                                onClick={() => moveNavigationChild(item.id, child.id, -1)}
                              />
                              <IconButton
                                icon={ArrowDown}
                                label={`Mover ${child.label} abajo`}
                                disabled={childIndex === (item.children?.length ?? 0) - 1}
                                onClick={() => moveNavigationChild(item.id, child.id, 1)}
                              />
                            </div>
                            <IconButton
                              icon={Trash}
                              label={`Eliminar subenlace ${child.label}`}
                              tooltip="Eliminar subenlace"
                              onClick={() =>
                                setPendingNavDelete({
                                  kind: "child",
                                  itemId: item.id,
                                  childId: child.id,
                                  label: child.label,
                                  parentLabel: item.label,
                                })
                              }
                            />
                          </div>
                        );
                      })}
                      <Button
                        variant="secondary"
                        aria-describedby={`${childrenContextId}${childrenLimitReached ? ` ${childrenLimitId}` : ""}`}
                        disabled={childrenLimitReached}
                        onClick={() =>
                          updateNavigationItem(item.id, {
                            children: [
                              ...children,
                              {
                                id: `nav-${crypto.randomUUID()}`,
                                label: "Nuevo subenlace",
                                href: project.categories[0]
                                  ? `/categorias/${project.categories[0].slug}/`
                                  : "/",
                              },
                            ],
                          })
                        }
                      >
                        Añadir subenlace
                      </Button>
                      {childrenLimitReached ? (
                        <small id={childrenLimitId} className="navigation-limit-hint">
                          Llegaste al máximo de {NAVIGATION_CHILDREN_MAX} subenlaces.
                        </small>
                      ) : null}
                    </div>
                    <IconButton
                      icon={Trash}
                      label={`Eliminar enlace ${item.label}`}
                      tooltip="Eliminar enlace"
                      onClick={() =>
                        setPendingNavDelete({
                          kind: "item",
                          itemId: item.id,
                          label: item.label,
                          childCount: item.children?.length ?? 0,
                        })
                      }
                    />
                  </div>
                );
              })}
              <Button
                variant="secondary"
                aria-describedby={
                  project.navigation.items.length >= NAVIGATION_ITEMS_MAX
                    ? navigationItemsLimitId
                    : undefined
                }
                disabled={project.navigation.items.length >= NAVIGATION_ITEMS_MAX}
                onClick={() =>
                  updateNavigation({
                    items: [
                      ...project.navigation.items,
                      {
                        id: `nav-${crypto.randomUUID()}`,
                        label: "Nueva categoría",
                        href: project.categories[0]
                          ? `/categorias/${project.categories[0].slug}/`
                          : "/",
                      },
                    ],
                  })
                }
              >
                Añadir enlace de catálogo
              </Button>
              {project.navigation.items.length >= NAVIGATION_ITEMS_MAX ? (
                <small
                  id={navigationItemsLimitId}
                  className="navigation-limit-hint"
                  data-testid="ui-navigation-items-limit"
                >
                  Llegaste al máximo de {NAVIGATION_ITEMS_MAX} enlaces de navegación.
                </small>
              ) : null}
            </div>
          </div>
        </AccordionSection>

        <AccordionSection
          sectionKey="pages"
          label="Páginas editoriales"
          icon={Article}
          collapsed={collapsedSections.has("pages")}
          onToggle={() => toggleSection("pages")}
        >
          <div className="form-grid">
            {project.pages.map((page) => {
              if (page.kind !== "home") return null;
              const pageLabel = "Home";
              const pageTitleDisplay = fieldValue(`page-title-${page.id}`, page.title);
              const pageTitleError =
                pageTitleDisplay.trim() === "" ? "Completá el título visible." : undefined;
              const seoTitleKey = `page-seo-title-${page.id}`;
              const seoTitleDisplay = fieldValue(seoTitleKey, page.seoTitle);
              const seoTitleError =
                seoTitleDisplay.trim() === "" ? "Completá el título SEO." : undefined;
              const seoDescriptionKey = `page-seo-desc-${page.id}`;
              const seoDescriptionDisplay = fieldValue(seoDescriptionKey, page.seoDescription);
              const seoDescriptionError =
                seoDescriptionDisplay.trim() === "" ? "Completá la descripción SEO." : undefined;
              return (
                <div className="page-editor" key={page.id}>
                  <strong>{pageLabel}</strong>
                  <Field
                    label="Título visible"
                    description={`Página ${pageLabel}`}
                    {...(pageTitleError ? { error: pageTitleError } : {})}
                  >
                    <input
                      aria-label="Título visible"
                      value={pageTitleDisplay}
                      onChange={(event) =>
                        updateField(
                          `page-title-${page.id}`,
                          event.target.value,
                          (next) => next.trim() !== "",
                          (next) => updatePage(page.id, { title: next }),
                        )
                      }
                    />
                  </Field>
                  <Field
                    label="Título SEO"
                    description={`Página ${pageLabel}`}
                    hint={`${seoTitleDisplay.length}/70 caracteres`}
                    {...(seoTitleError ? { error: seoTitleError } : {})}
                  >
                    <input
                      aria-label="Título SEO"
                      maxLength={70}
                      value={seoTitleDisplay}
                      onChange={(event) =>
                        updateField(
                          seoTitleKey,
                          event.target.value,
                          (next) => next.trim() !== "",
                          (next) => updatePage(page.id, { seoTitle: next }),
                        )
                      }
                    />
                  </Field>
                  <Field
                    label="Descripción SEO"
                    description={`Página ${pageLabel}`}
                    hint={`${seoDescriptionDisplay.length}/180 caracteres`}
                    {...(seoDescriptionError ? { error: seoDescriptionError } : {})}
                  >
                    <textarea
                      rows={2}
                      aria-label="Descripción SEO"
                      maxLength={180}
                      value={seoDescriptionDisplay}
                      onChange={(event) =>
                        updateField(
                          seoDescriptionKey,
                          event.target.value,
                          (next) => next.trim() !== "",
                          (next) => updatePage(page.id, { seoDescription: next }),
                        )
                      }
                    />
                  </Field>
                </div>
              );
            })}
          </div>
        </AccordionSection>

        <AccordionSection
          sectionKey="public-copy"
          label="Contenido global"
          icon={Article}
          collapsed={collapsedSections.has("public-copy")}
          onToggle={() => toggleSection("public-copy")}
        >
          <p className="form-help">
            Estos textos aparecen en controles y estados compartidos del sitio público. El contenido
            particular de cada sección se edita desde su propio inspector.
          </p>
          <div className="form-grid">
            {PUBLIC_COPY_FIELDS.map(({ group, key, label }) => {
              const copyGroup = project.publicCopy[
                group as keyof StoreProjectV1["publicCopy"]
              ] as Record<string, string>;
              const fieldKey = `public-copy-${group}-${key}`;
              const value = fieldValue(fieldKey, copyGroup[key] ?? "");
              const restrictedKey = `${group}.${key}`;
              const isRestricted = RESTRICTED_COPY_FIELDS.has(restrictedKey);
              const hasPlaceholder = PLACEHOLDER_COPY_FIELDS.has(restrictedKey);
              const minLength = MIN_LENGTH_COPY_FIELDS[restrictedKey];
              return (
                <Field
                  key={fieldKey}
                  label={label}
                  className="field--wide"
                  {...(isRestricted
                    ? { description: "Texto del sistema. Editar con cuidado." }
                    : {})}
                  {...(hasPlaceholder
                    ? { hint: "Contiene placeholders técnicos que no deben eliminarse" }
                    : {})}
                  {...(minLength !== undefined ? { hint: `Mínimo ${minLength} caracteres` } : {})}
                >
                  <input
                    aria-label={label}
                    value={value}
                    onChange={(event) =>
                      updateField(
                        fieldKey,
                        event.target.value,
                        (next) => next.trim() !== "",
                        (next) => updatePublicCopy(group, key, next),
                      )
                    }
                  />
                </Field>
              );
            })}
          </div>
        </AccordionSection>
      </div>
      <div className="overview-savebar" data-testid="ui-overview-savebar">
        {saveIndicator()}
        <span className="overview-savebar__note">
          Los cambios se guardan automáticamente en tu máquina.
        </span>
      </div>
      {pendingNavDelete ? (
        <ConfirmDialog
          title={
            pendingNavDelete.kind === "item"
              ? "Eliminar enlace de navegación"
              : "Eliminar subenlace de navegación"
          }
          body={
            pendingNavDelete.kind === "item" ? (
              <>
                Se eliminará «{pendingNavDelete.label}».
                {pendingNavDelete.childCount > 0
                  ? ` También se eliminarán ${pendingNavDelete.childCount} subenlace(s).`
                  : " No tiene subenlaces."}{" "}
                Podés deshacerlo desde la barra del editor.
              </>
            ) : (
              <>
                Se eliminará el subenlace «{pendingNavDelete.label}» de «
                {pendingNavDelete.parentLabel}». Podés deshacerlo desde la barra del editor.
              </>
            )
          }
          confirmLabel={pendingNavDelete.kind === "item" ? "Eliminar enlace" : "Eliminar subenlace"}
          danger
          onConfirm={confirmNavigationDelete}
          onCancel={() => setPendingNavDelete(null)}
        />
      ) : null}
    </section>
  );
}
