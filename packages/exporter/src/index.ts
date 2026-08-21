/**
 * Exporter público compartido por Preview y el sitio exportado. Construye un
 * snapshot una vez, renderiza páginas y metadatos rastreables, deduplica assets
 * y produce el sitio estático sin incluir estado interno del editor.
 */
import { normalizeSearchTokens } from "@solara/core";
import { internalHref, renderImage } from "@solara/module-sdk";
import {
  getModuleDefinition,
  MODULE_STYLE_BLOCKS,
  type PageRenderContext,
  renderSections,
  STORE_BASE_STYLES,
} from "@solara/modules";
import type {
  Category,
  ImageAsset,
  Product,
  StoreProjectV1,
  StoreSection,
  Variant,
  VideoAsset,
} from "@solara/project-schema";
import {
  CATALOG_MODERN_PLACEHOLDER_PHONE,
  getCategoryAncestors,
  getCategoryBreadcrumb,
  getCategoryProductIds,
  isCatalogModernPlaceholderAsset,
  personalizeWhatsAppGreeting,
  StoreProjectV1Schema,
} from "@solara/project-schema";
import { ensureCatalogModernV2Sections } from "@solara/project-schema/catalog-modern-template";
import { formatPrice } from "@solara/project-schema/money";
import {
  buildAiContext,
  buildLlmsTxt,
  type OptimizationOptions,
  type OptimizationReport,
  optimizeProject,
} from "@solara/site-optimizer";
import { STOREFRONT_RUNTIME_CSS, STOREFRONT_RUNTIME_JS } from "@solara/storefront-runtime";
import { activeFonts, type FontTransport, fontCssFor, fontFilesFor } from "./fonts";

export type { OptimizationReport } from "@solara/site-optimizer";
export type { FontOption, FontTransport } from "./fonts";
export { FONT_OPTIONS, fontCssFor, fontFilesFor } from "./fonts";

export type ExportMode = "draft" | "production";
export type AuditSeverity = "critical" | "warning" | "info";
export type AuditArea =
  | "technical"
  | "content"
  | "structured-data"
  | "merchant"
  | "performance"
  | "ai";
export type AuditFixTarget = "summary" | "catalog" | "assets" | "seo" | "export";

export interface AuditIssue {
  code: string;
  severity: AuditSeverity;
  area?: AuditArea;
  message: string;
  path?: string;
  entity?: {
    type: "store" | "product" | "variant" | "category" | "collection" | "asset";
    id: string;
    label: string;
  };
  fixTarget?: AuditFixTarget;
  documentationUrl?: string;
}

export interface CommerceOfferSnapshot {
  productId: string;
  variantId: string;
  itemGroupId: string;
  canonicalPath: string;
  variantPath: string;
  title: string;
  description: string;
  brand: string;
  sku: string;
  gtin?: string;
  mpn?: string;
  priceMinor: number;
  currency: string;
  availability: "in_stock" | "out_of_stock" | "preorder";
  availabilityDate?: string;
  imageUrls: readonly string[];
}

export interface CommerceProductSnapshot {
  productId: string;
  canonicalPath: string;
  title: string;
  imageUrls: readonly string[];
  offers: readonly CommerceOfferSnapshot[];
}

export interface CommerceSnapshot {
  baseUrl: string;
  updatedAt: string;
  products: readonly CommerceProductSnapshot[];
  offers: readonly CommerceOfferSnapshot[];
}

export interface AuditReport {
  issues: readonly AuditIssue[];
  criticalCount: number;
  warningCount: number;
  merchantMode: "experimental-whatsapp";
  optimization?: OptimizationReport;
}

export interface ExportOptions {
  mode: ExportMode;
  publicAiContext?: boolean;
  optimizationProfile?: OptimizationOptions["profile"];
}

export interface ExportResult {
  files: ReadonlyMap<string, string | Uint8Array>;
  audit: AuditIssue[];
  optimization: OptimizationReport;
}

export interface PageDescriptor {
  path: string;
  title: string;
  description: string;
  canonicalPath: string;
  pageType:
    | "home"
    | "category"
    | "collection"
    | "product"
    | "about"
    | "contact"
    | "search"
    | "cart"
    | "checkout"
    | "legal"
    | "not-found";
  body: string;
  structuredData: unknown[];
  image?: string;
  /** Image that is critical for this route, if one exists. Social images stay lazy. */
  preloadImage?: string;
}

export interface PublicExportManifest {
  pages: readonly PageDescriptor[];
  activeModules: readonly string[];
  usedAssetIds: readonly string[];
  usedVideoIds: readonly string[];
  runtimeFeatures: readonly string[];
  indexableRoutes: readonly string[];
  searchEnabled: boolean;
  cartEnabled: boolean;
  checkoutEnabled: boolean;
}

const encoder = new TextEncoder();

function parseProject(projectInput: StoreProjectV1, operation: string): StoreProjectV1 {
  const result = StoreProjectV1Schema.safeParse(projectInput);
  if (result.success) return ensureCatalogModernV2Sections(result.data);

  const details = result.error.issues
    .map((issue) => `${issue.path.join(".") || "project"}: ${issue.message}`)
    .join("; ");
  throw new Error(`No se puede ${operation}: el proyecto es inválido. ${details}`);
}

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;",
      })[character] ?? character,
  );
}

const escapeAttribute = escapeHtml;

function formatMoney(amount: number, project: StoreProjectV1): string {
  return formatPrice(amount, {
    currency: project.currency,
    locale: project.locale,
    priceFractionDisplay: (project as any).priceFractionDisplay ?? "always",
  });
}

function escapeXml(value: string): string {
  return escapeHtml(value);
}

function jsonForScript(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, "");
}

function baseUrlPathname(baseUrl: string): string {
  try {
    return new URL(baseUrl).pathname.replace(/\/+$/, "");
  } catch {
    return "";
  }
}

/** Prefija una ruta root-absoluta con la subcarpeta de la baseUrl si existe. */
function assetHref(project: StoreProjectV1, path: string): string {
  const prefix = baseUrlPathname(project.baseUrl);
  return prefix ? `${prefix}${path}` : path;
}

/**
 * Prefija los enlaces internos root-absolutos de un documento con la
 * subcarpeta de la baseUrl (paginación, breadcrumbs, cards, navegación de
 * datos del proyecto, forms, imágenes y videos). Cubre exporter y módulos en
 * un único punto y no duplica rutas ya prefijadas.
 */
function prefixDocumentHrefs(project: StoreProjectV1, document: string): string {
  const prefix = baseUrlPathname(project.baseUrl);
  if (!prefix) return document;
  // La posición del lookahead ya está después de la barra inicial: el prefijo
  // se compara sin esa barra (p.ej. "tienda/" para baseUrl "/tienda"). El
  // espacio previo evita prefijar atributos compuestos como data-base-href.
  const escapedPrefix = prefix.slice(1).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return document.replace(
    new RegExp(`(\\s)(href|action|src|poster)="/(?!/|${escapedPrefix}/)`, "g"),
    `$1$2="${prefix}/`,
  );
}

function absoluteUrl(project: StoreProjectV1, path: string): string {
  return `${normalizeBaseUrl(project.baseUrl)}${path.startsWith("/") ? path : `/${path}`}`;
}

function absoluteResourceUrl(project: StoreProjectV1, value: string): string {
  return /^https?:\/\//i.test(value) ? value : absoluteUrl(project, value);
}

/**
 * Recursos servidos por el propio sitio deben seguir siendo relativos en el
 * HTML. La baseUrl puede ser todavía el dominio de ejemplo mientras se
 * trabaja localmente; usarla para el preload dispararía una petición externa
 * fallida aunque el `<img>` relativo sí pudiera cargar.
 */
function resourceHref(project: StoreProjectV1, value: string): string {
  return /^https?:\/\//i.test(value) ? value : assetHref(project, value);
}

function publicWhatsAppPhone(project: StoreProjectV1): string {
  const phone = project.whatsapp.phone.trim();
  if (!phone || phone === CATALOG_MODERN_PLACEHOLDER_PHONE) return "";
  return phone;
}

function buildWhatsAppLink(project: StoreProjectV1, message: string): string {
  const phone = publicWhatsAppPhone(project).replace(/\D/g, "");
  if (!phone) return "";
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}

function interpolatePublicCopy(template: string, values: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => values[key] ?? `{${key}}`);
}

const imageLookupCache = new WeakMap<object, ReadonlyMap<string, ImageAsset>>();
const videoLookupCache = new WeakMap<object, ReadonlyMap<string, VideoAsset>>();

function imageFor(project: StoreProjectV1, assetId: string | undefined): ImageAsset | undefined {
  if (!assetId) return undefined;
  let lookup = imageLookupCache.get(project);
  if (!lookup) {
    lookup = new Map(project.assets.map((asset) => [asset.id, asset]));
    imageLookupCache.set(project, lookup);
  }
  return lookup.get(assetId);
}

function imageUrl(project: StoreProjectV1, assetId: string | undefined): string | undefined {
  const asset = imageFor(project, assetId);
  if (!asset) return undefined;
  if (asset.source.startsWith("data:")) return `/assets/${asset.hash}.${assetExtension(asset)}`;
  return asset.source;
}

function videoFor(project: StoreProjectV1, assetId: string | undefined): VideoAsset | undefined {
  if (!assetId) return undefined;
  let lookup = videoLookupCache.get(project);
  if (!lookup) {
    lookup = new Map(project.videos.map((video) => [video.id, video]));
    videoLookupCache.set(project, lookup);
  }
  return lookup.get(assetId);
}

function videoUrl(project: StoreProjectV1, assetId: string | undefined): string | undefined {
  const asset = videoFor(project, assetId);
  if (!asset) return undefined;
  if (asset.source.startsWith("data:")) return `/assets/${asset.hash}.${assetExtension(asset)}`;
  return asset.source;
}

function productImagePaths(project: StoreProjectV1, product: Product, variant?: Variant): string[] {
  const ids = [variant?.imageId, ...product.imageIds].filter((id): id is NonNullable<typeof id> =>
    Boolean(id),
  );
  return [...new Set(ids)]
    .map((assetId) => imageUrl(project, assetId))
    .filter((url): url is string => Boolean(url));
}

function offerAvailability(variant: Variant): CommerceOfferSnapshot["availability"] {
  return variant.stockStatus;
}

export function buildCommerceSnapshot(project: StoreProjectV1): CommerceSnapshot {
  const products = project.products
    .filter((product) => product.status === "active")
    .map((product) => {
      const canonicalPath = `/productos/${product.slug}/`;
      const productImages = productImagePaths(project, product);
      const offers = product.variants.map(
        (variant) =>
          ({
            productId: product.id,
            variantId: variant.id,
            itemGroupId: product.id,
            canonicalPath,
            variantPath: `${canonicalPath}?variant=${encodeURIComponent(variant.id)}`,
            title: `${product.title} - ${variant.title}`,
            description: product.description,
            brand: product.brand,
            sku: variant.sku,
            ...(variant.gtin ? { gtin: variant.gtin } : {}),
            ...(variant.mpn ? { mpn: variant.mpn } : {}),
            priceMinor: variant.price,
            currency: project.currency,
            availability: offerAvailability(variant),
            ...(variant.availabilityDate ? { availabilityDate: variant.availabilityDate } : {}),
            imageUrls: productImagePaths(project, product, variant).map((url) =>
              absoluteResourceUrl(project, url),
            ),
          }) satisfies CommerceOfferSnapshot,
      );
      return {
        productId: product.id,
        canonicalPath,
        title: product.title,
        imageUrls: productImages.map((url) => absoluteResourceUrl(project, url)),
        offers,
      } satisfies CommerceProductSnapshot;
    });

  return {
    baseUrl: normalizeBaseUrl(project.baseUrl),
    updatedAt: project.updatedAt,
    products,
    offers: products.flatMap((product) => product.offers),
  };
}

function assetExtension(asset: ImageAsset | VideoAsset): string {
  const extension = mimeTypeExtension(asset.mimeType);
  return extension || "bin";
}

function mimeTypeExtension(mimeType: string | undefined): string | undefined {
  const subtype = mimeType?.split("/")[1]?.split(";")[0]?.toLowerCase();
  if (!subtype) return undefined;
  return subtype === "jpeg" ? "jpg" : subtype;
}

function sourceExtension(source: string, fallback: string): string {
  const mimeType = /^data:([^;,]+)/i.exec(source)?.[1];
  return mimeTypeExtension(mimeType) ?? fallback;
}

function dataUrlBytes(source: string): Uint8Array | undefined {
  const match = /^data:([^;,]+)?(;base64)?,(.*)$/s.exec(source);
  if (!match) return undefined;
  const payload = match[3] ?? "";
  if (match[2]) {
    if (typeof atob === "function") {
      const binary = atob(payload);
      return Uint8Array.from(binary, (character) => character.charCodeAt(0));
    }
    return Uint8Array.from(Buffer.from(payload, "base64"));
  }
  return encoder.encode(decodeURIComponent(payload));
}

function publicAssetPath(
  asset: ImageAsset,
  kind: "primary" | "fallback",
  source: string,
  width?: number,
): string {
  const suffix = width ? `-${width}` : kind === "fallback" ? "-fallback" : "";
  const extension = sourceExtension(source, assetExtension(asset));
  return `/assets/${asset.hash}${suffix}.${extension}`;
}

function projectWithPublicAssetUrls(project: StoreProjectV1): StoreProjectV1 {
  const whatsAppPhone = publicWhatsAppPhone(project);
  return {
    ...project,
    whatsapp: {
      ...project.whatsapp,
      phone: whatsAppPhone,
    },
    assets: project.assets.map((asset) => ({
      ...asset,
      source: asset.source.startsWith("data:")
        ? publicAssetPath(asset, "primary", asset.source)
        : asset.source,
      ...(asset.fallbackSource
        ? {
            fallbackSource: asset.fallbackSource.startsWith("data:")
              ? publicAssetPath(asset, "fallback", asset.fallbackSource)
              : asset.fallbackSource,
          }
        : {}),
      ...(asset.responsiveSources
        ? {
            responsiveSources: asset.responsiveSources.map((source) => ({
              ...source,
              source: source.source.startsWith("data:")
                ? publicAssetPath(asset, "primary", source.source, source.width)
                : source.source,
            })),
          }
        : {}),
    })),
    videos: project.videos.map((video) => ({
      ...video,
      source: video.source.startsWith("data:")
        ? `/assets/${video.hash}.${assetExtension(video)}`
        : video.source,
    })),
  };
}

const PREVIEW_ASSET_PREFIX = "/__solara-preview-assets/";

interface PreviewAssetBundle {
  project: StoreProjectV1;
  sources: ReadonlyMap<string, string>;
}

function createPreviewAssetBundle(project: StoreProjectV1): PreviewAssetBundle {
  const sources = new Map<string, string>();
  const addSource = (asset: ImageAsset | VideoAsset, source: string, suffix = ""): string => {
    if (!source.startsWith("data:")) return source;
    const path = `${PREVIEW_ASSET_PREFIX}${asset.hash}${suffix}.${assetExtension(asset)}`;
    sources.set(path, source);
    return path;
  };

  return {
    project: {
      ...project,
      assets: project.assets.map((asset) => ({
        ...asset,
        source: addSource(asset, asset.source),
        ...(asset.fallbackSource
          ? { fallbackSource: addSource(asset, asset.fallbackSource, "-fallback") }
          : {}),
        ...(asset.responsiveSources
          ? {
              responsiveSources: asset.responsiveSources.map((responsive) => ({
                ...responsive,
                source: addSource(asset, responsive.source, `-${responsive.width}`),
              })),
            }
          : {}),
      })),
      videos: project.videos.map((video) => ({
        ...video,
        source: addSource(video, video.source),
      })),
    },
    sources,
  };
}

function previewAssetMarkup(
  sources: ReadonlyMap<string, string>,
  transport: "inline" | "parent" = "inline",
): string {
  if (sources.size === 0) return "";
  if (transport === "parent") {
    const paths = JSON.stringify([...sources.keys()]);
    return `<script>
(() => {
  const paths = ${paths};
  const hydrate = async (sources) => {
    const objectUrls = new Map();
    const sourceFor = async (value) => {
      const source = sources[value];
      if (!source) return "";
      const cached = objectUrls.get(value);
      if (cached) return cached;
      try {
        const response = await fetch(source);
        const objectUrl = URL.createObjectURL(await response.blob());
        objectUrls.set(value, objectUrl);
        return objectUrl;
      } catch {
        objectUrls.set(value, source);
        return source;
      }
    };
    const hydrateImage = (element) => {
      // Preview images use object URLs and must not wait for an iframe scroll
      // before decoding. Public exports keep their native lazy-loading policy.
      if (element.tagName === "IMG") {
        element.setAttribute("loading", "eager");
        element.setAttribute("fetchpriority", "high");
      }
    };
    document.querySelectorAll("img").forEach(hydrateImage);
    await Promise.all(paths.map((value) => sourceFor(value)));
    await Promise.all([...document.querySelectorAll("[data-solara-preview-src]")].map(async (element) => {
      const source = await sourceFor(element.getAttribute("data-solara-preview-src") || "");
      if (source) {
        hydrateImage(element);
        element.setAttribute("src", source);
      }
    }));
    await Promise.all([...document.querySelectorAll("[data-solara-preview-srcset]")].map(async (element) => {
      const srcset = element.getAttribute("data-solara-preview-srcset") || "";
      const entries = srcset.split(",");
      const hydrated = await Promise.all(entries.map(async (entry) => {
        const parts = entry.trim().split(/\\s+/);
        const source = await sourceFor(parts.shift() || "");
        return source ? [source, ...parts].join(" ") : entry;
      }));
      if (hydrated.length > 0) element.setAttribute("srcset", hydrated.join(","));
    }));
    await Promise.all([...document.querySelectorAll("[data-solara-preview-poster]")].map(async (element) => {
      const source = await sourceFor(element.getAttribute("data-solara-preview-poster") || "");
      if (source) element.setAttribute("poster", source);
    }));
  };
  window.addEventListener("message", (event) => {
    if (event.data?.type !== "solara-preview-assets-response") return;
    void hydrate(event.data.sources || {});
  });
  window.parent.postMessage({ type: "solara-preview-assets-request", paths }, "*");
})();
</script>`;
  }
  const serialized = jsonForScript(Object.fromEntries(sources));
  return `<script type="application/json" id="solara-preview-assets">${serialized}</script>
<script>
 (async () => {
  const payload = document.getElementById("solara-preview-assets");
  if (!payload) return;
  try {
    const sources = JSON.parse(payload.textContent || "{}");
    const objectUrls = new Map();
    const sourceFor = async (value) => {
      const source = sources[value];
      if (!source) return "";
      const cached = objectUrls.get(value);
      if (cached) return cached;
      try {
        const response = await fetch(source);
        const objectUrl = URL.createObjectURL(await response.blob());
        objectUrls.set(value, objectUrl);
        return objectUrl;
      } catch {
        objectUrls.set(value, source);
        return source;
      }
    };
    document.querySelectorAll("img").forEach((element) => {
      element.setAttribute("loading", "eager");
      element.setAttribute("fetchpriority", "high");
    });
    const values = [...new Set(Object.keys(sources))];
    await Promise.all(values.map(async (value) => sourceFor(value)));
    document.querySelectorAll("[data-solara-preview-src]").forEach((element) => {
      const source = objectUrls.get(element.getAttribute("data-solara-preview-src") || "");
      if (source) {
        element.setAttribute("loading", "eager");
        element.setAttribute("src", source);
      }
    });
    document.querySelectorAll("[data-solara-preview-srcset]").forEach((element) => {
      const srcset = element.getAttribute("data-solara-preview-srcset") || "";
      const hydrated = srcset
        .split(",")
        .map((entry) => {
          const parts = entry.trim().split(/\\s+/);
          const source = objectUrls.get(parts.shift() || "");
          return source ? [source, ...parts].join(" ") : entry;
        })
        .join(",");
      element.setAttribute("srcset", hydrated);
    });
    document.querySelectorAll("[data-solara-preview-poster]").forEach((element) => {
      const source = objectUrls.get(element.getAttribute("data-solara-preview-poster") || "");
      if (source) element.setAttribute("poster", source);
    });
    payload.remove();
  } catch {
    // A preview asset must never prevent the storefront from rendering.
  }
})();
</script>`;
}

function deferPreviewAssetMarkup(document: string, sources: ReadonlyMap<string, string>): string {
  if (sources.size === 0) return document;
  const isPreviewPath = (value: string): boolean => sources.has(value);
  const deferAttribute = (html: string, attribute: "src" | "poster"): string =>
    html.replace(new RegExp(`\\s${attribute}="([^"]+)"`, "g"), (match, value: string) =>
      isPreviewPath(value) ? ` data-solara-preview-${attribute}="${value}"` : match,
    );
  let deferred = deferAttribute(deferAttribute(document, "src"), "poster");
  deferred = deferred.replace(/\ssrcset="([^"]+)"/g, (match, value: string) =>
    value.split(",").some((entry: string) => isPreviewPath(entry.trim().split(/\s+/)[0] ?? ""))
      ? ` data-solara-preview-srcset="${value}"`
      : match,
  );
  return deferred;
}

function themeCss(project: StoreProjectV1, transport: FontTransport = "file"): string {
  const { colors, typography, spacingScale, radius, container } = project.theme;
  const rootColorScheme = project.theme.colorMode === "dark" ? "dark" : "light";
  return `
:root {
  color-scheme: ${rootColorScheme};
  --solara-background: ${colors.background};
  --solara-surface: ${colors.surface};
  --solara-text: ${colors.text};
  --solara-muted: ${colors.muted};
  --solara-accent: ${colors.accent};
  --solara-accent-text: ${colors.accentText};
  --solara-border: ${colors.border};
  --solara-font-display: ${typography.display};
  --solara-font-body: ${typography.body};
  --solara-type-scale: ${typography.scale};
  --solara-space-scale: ${spacingScale};
  --solara-radius: ${radius}px;
  --solara-container: ${container}px;
  --solara-chrome-height: 116px;
}

* { box-sizing: border-box; }
html { background: var(--solara-background); color: var(--solara-text); }
html[data-theme="dark"] { color-scheme: dark; }
html[data-theme="light"] { color-scheme: light; }
body { margin: 0; min-width: 320px; font-family: var(--solara-font-body); line-height: 1.5; }
${fontCssFor(typography.display, typography.body, transport)}
.solara-page[data-color-mode="dark"] { color-scheme: dark; }
@media (prefers-color-scheme: dark) {
  .solara-page[data-color-mode="auto"] { color-scheme: dark; }
}
img { display: block; max-width: 100%; height: auto; }
a { color: inherit; }
button, input, select, textarea { font: inherit; }
button, input, select, textarea, a { outline-offset: 3px; }
:focus-visible { outline: 2px solid var(--solara-accent); }
.solara-page { min-height: 100dvh; overflow: clip; }
.solara-container { width: min(calc(100% - 2rem), var(--solara-container)); margin-inline: auto; }
`.trim();
}

/** Remove CSS transport whitespace while preserving quoted content and calc spacing. */
export function minifyCss(value: string): string {
  const quoted: string[] = [];
  const protectedValue = value.replace(/("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')/g, (match) => {
    const token = `__SOLARA_CSS_STRING_${quoted.length}__`;
    quoted.push(match);
    return token;
  });
  let minified = protectedValue
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\s+/g, " ")
    // El `+` queda fuera: en calc() requiere espacios a ambos lados y
    // quitarlos vuelve inválida la declaración (el navegador la descarta).
    .replace(/\s*([{};,:>~])\s*/g, "$1")
    .replace(/;}/g, "}")
    .trim();
  quoted.forEach((match, index) => {
    minified = minified.replace(`__SOLARA_CSS_STRING_${index}__`, match);
  });
  return minified;
}

function shellSectionEnabled(project: StoreProjectV1, section: StoreSection): boolean {
  if (section.slot === "announcement") return project.siteShell.announcement;
  if (section.slot === "header") return project.siteShell.header;
  if (section.slot === "footer") return project.siteShell.footer;
  if (section.slot === "cart") return project.siteShell.cart;
  return true;
}

function activeProjectSections(
  project: StoreProjectV1,
  sections: readonly StoreSection[],
): StoreSection[] {
  return sections.filter((section) => shellSectionEnabled(project, section));
}

function isModernProject(project: StoreProjectV1): boolean {
  return (
    project.commerceTemplates.designFamily === "catalog-modern-v1" ||
    project.commerceTemplates.designFamily === "catalog-modern-v2"
  );
}

function isPublishedEditablePage(
  project: StoreProjectV1,
  page: StoreProjectV1["pages"][number],
): boolean {
  return !(
    project.commerceTemplates.designFamily === "catalog-modern-v2" &&
    (page.kind === "about" || page.kind === "contact")
  );
}

function modernProjectClass(project: StoreProjectV1): string {
  if (!isModernProject(project)) return "";
  return project.commerceTemplates.designFamily === "catalog-modern-v2"
    ? " catalog-modern catalog-modern-v2 cm v2"
    : " catalog-modern";
}

function publicMediaUsage(project: StoreProjectV1): {
  assetIds: Set<string>;
  videoIds: Set<string>;
} {
  const assetIds = new Set<string>();
  const videoIds = new Set<string>();
  const knownAssetIds = new Set<string>(project.assets.map((asset) => asset.id));
  const knownVideoIds = new Set<string>(project.videos.map((video) => video.id));
  const addValue = (value: unknown): void => {
    if (typeof value !== "string") return;
    if (knownAssetIds.has(value)) assetIds.add(value);
    if (knownVideoIds.has(value)) videoIds.add(value);
  };
  const scan = (value: unknown): void => {
    if (typeof value === "string") {
      addValue(value);
      return;
    }
    if (Array.isArray(value)) {
      value.forEach(scan);
      return;
    }
    if (typeof value === "object" && value !== null) {
      Object.values(value).forEach(scan);
    }
  };

  addValue(project.identity.logoAssetId);
  addValue(project.seo.socialImageId);
  project.products
    .filter((product) => product.status === "active")
    .forEach((product) => {
      product.imageIds.forEach(addValue);
      product.variants.forEach((variant) => {
        addValue(variant.imageId);
      });
    });
  project.categories.forEach((category) => {
    addValue(category.imageId);
  });
  project.collections.forEach((collection) => {
    addValue(collection.imageId);
  });
  [
    ...project.sections,
    ...project.pages
      .filter((page) => isPublishedEditablePage(project, page))
      .flatMap((page) => page.sections),
  ]
    .filter((section) => section.enabled && shellSectionEnabled(project, section))
    .forEach((section) => {
      scan(section.settings);
    });

  project.videos.forEach((video) => {
    if (videoIds.has(video.id)) addValue(video.posterAssetId);
  });
  const socialAsset = project.assets.find((asset) => asset.id === project.seo.socialImageId);
  if (!socialAsset && project.assets[0]) assetIds.add(project.assets[0].id);
  return { assetIds, videoIds };
}

/**
 * Resolve the public export graph once so every derived file uses the same
 * page/module/media decisions. This is intentionally not persisted.
 */
export function createPublicExportManifest(
  project: StoreProjectV1,
  pages: readonly PageDescriptor[] = buildPages(project),
): PublicExportManifest {
  const sections = activeProjectSections(project, [
    ...project.sections,
    ...project.pages
      .filter((page) => isPublishedEditablePage(project, page))
      .flatMap((page) => page.sections),
  ]);
  const activeModules = [...new Set(sections.map((section) => section.moduleId))].sort();
  const media = publicMediaUsage(project);
  const runtimeFeatures = new Set<string>();

  if (project.siteShell.header && activeModules.some((moduleId) => moduleId.includes("header"))) {
    runtimeFeatures.add("header");
  }
  if (project.commerceTemplates.search.enabled) runtimeFeatures.add("search");
  if (project.commerceTemplates.cart.enabled || project.siteShell.cart) runtimeFeatures.add("cart");
  if (project.commerceTemplates.checkout.enabled) runtimeFeatures.add("checkout");
  if (pages.some((page) => page.pageType === "category")) runtimeFeatures.add("category");
  if (pages.some((page) => page.pageType === "product")) runtimeFeatures.add("product");
  if (activeModules.some((moduleId) => moduleId.includes("hero"))) runtimeFeatures.add("hero");
  if (media.videoIds.size > 0) runtimeFeatures.add("video");
  if (activeModules.includes("contact-form")) runtimeFeatures.add("contact");
  if (activeModules.some((moduleId) => moduleId.includes("motion")) || sections.length > 0) {
    runtimeFeatures.add("motion");
  }
  if (pages.some((page) => page.pageType === "product" && page.body.includes("data-variant"))) {
    runtimeFeatures.add("variants");
  }
  if (pages.some((page) => page.pageType === "category" && page.body.includes("data-category"))) {
    runtimeFeatures.add("filters");
  }

  return {
    pages,
    activeModules,
    usedAssetIds: [...media.assetIds].sort(),
    usedVideoIds: [...media.videoIds].sort(),
    runtimeFeatures: [...runtimeFeatures].sort(),
    indexableRoutes: pages
      .filter((page) => !["search", "cart", "checkout", "not-found"].includes(page.pageType))
      .map((page) => page.canonicalPath),
    searchEnabled: project.commerceTemplates.search.enabled,
    cartEnabled: project.commerceTemplates.cart.enabled,
    checkoutEnabled: project.commerceTemplates.checkout.enabled,
  };
}

function effectiveHomeSections(project: StoreProjectV1): readonly StoreSection[] {
  const home = project.pages.find((page) => page.kind === "home");
  return home?.sections.length ? home.sections : project.sections;
}

const HOME_CONTACT_MODULE_IDS = new Set(["contact-form", "contact-channels"]);

function renderProjectSections(
  project: StoreProjectV1,
  sections: StoreSection[],
  pageContext: {
    pageType: PageDescriptor["pageType"];
    product?: Product;
    category?: Category;
    collection?: StoreProjectV1["collections"][number];
    products?: readonly Product[];
  },
): string {
  const modulePageType =
    pageContext.pageType === "legal" || pageContext.pageType === "not-found"
      ? "content"
      : pageContext.pageType;
  const activeSections = activeProjectSections(project, sections);
  const renderContext: PageRenderContext = {
    pageType: modulePageType,
    ...(pageContext.product ? { product: pageContext.product } : {}),
    ...(pageContext.category ? { category: pageContext.category } : {}),
    ...(pageContext.collection ? { collection: pageContext.collection } : {}),
    ...(pageContext.products ? { products: pageContext.products } : {}),
  };
  if (pageContext.pageType !== "home") {
    return String(renderSections(project, activeSections, renderContext));
  }

  // Los dos módulos de contacto se mantienen independientes para el
  // Constructor, pero comparten una grilla sólo cuando aparecen juntos en
  // Home. Así la página dedicada conserva su layout y Home puede reordenarlos
  // sin perder la composición responsive.
  const chunks: string[] = [];
  let contactSections: StoreSection[] = [];
  const flushContactSections = (): void => {
    if (contactSections.length === 0) return;
    chunks.push(
      `<div class="solara-home-contact">${String(renderSections(project, contactSections, renderContext))}</div>`,
    );
    contactSections = [];
  };

  for (const section of activeSections) {
    if (HOME_CONTACT_MODULE_IDS.has(section.moduleId)) {
      contactSections.push(section);
      continue;
    }
    flushContactSections();
    chunks.push(String(renderSections(project, [section], renderContext)));
  }
  flushContactSections();
  return chunks.join("");
}

function moduleStylesForSections(
  sections: readonly StoreSection[],
  additionalModuleIds: readonly string[] = [],
): string {
  const moduleIds = new Set([
    ...sections.filter((section) => section.enabled).map((section) => section.moduleId),
    ...additionalModuleIds,
  ]);
  if (moduleIds.has("split-hero")) moduleIds.add("hero-media");
  const styleKeys = [
    ...new Set(
      [...moduleIds].map((moduleId) => {
        const definition = getModuleDefinition(moduleId);
        if (!definition) throw new Error(`Módulo desconocido: ${moduleId}.`);
        return String(definition.styleAsset).replace(/^module-style-/, "");
      }),
    ),
  ];
  const blocks = styleKeys.map((styleKey) => MODULE_STYLE_BLOCKS[styleKey] ?? "");
  return `${STORE_BASE_STYLES}\n${blocks.filter(Boolean).join("\n")}`;
}

function stylesForProjectFamily(project: StoreProjectV1, styles: string): string {
  if (project.commerceTemplates.designFamily !== "catalog-modern-v2") return styles;
  const v2Styles = MODULE_STYLE_BLOCKS["catalog-modern-v2"] ?? "";
  return v2Styles ? `${styles}\n${v2Styles}` : styles;
}

function exportedModuleStyles(project: StoreProjectV1): string {
  const pageSections = project.pages
    .filter((page) => isPublishedEditablePage(project, page))
    .flatMap((page) => page.sections);
  const productModule = isModernProject(project) ? "catalog-product-detail" : "product-detail";
  return stylesForProjectFamily(
    project,
    moduleStylesForSections(
      activeProjectSections(project, [...project.sections, ...pageSections]),
      project.products.some((product) => product.status === "active") ? [productModule] : [],
    ),
  );
}

function previewModuleStyles(project: StoreProjectV1): string {
  const pageSections = project.pages
    .filter((page) => isPublishedEditablePage(project, page))
    .flatMap((page) => page.sections);
  const productModule = isModernProject(project) ? "catalog-product-detail" : "product-detail";
  return stylesForProjectFamily(
    project,
    moduleStylesForSections(
      activeProjectSections(project, [...project.sections, ...pageSections]),
      project.products.some((product) => product.status === "active") ? [productModule] : [],
    ),
  );
}

function productDetailSection(project: StoreProjectV1, product: Product): string {
  const moduleId = isModernProject(project) ? "catalog-product-detail" : "product-detail";
  const definition = getModuleDefinition(moduleId);
  if (!definition) throw new Error("Falta el módulo product-detail.");
  const section: StoreSection = {
    id: `${moduleId}-${product.id}` as StoreSection["id"],
    slot: "product",
    moduleId,
    enabled: true,
    settings: {},
    motion: {
      preset: "fade",
      intensity: 4,
      direction: "up",
      distance: 0,
      duration: 0.45,
      delay: 0,
      stagger: 0,
      easing: "cubic-bezier(.16,1,.3,1)",
      entryPoint: 0.15,
      once: true,
    },
  };
  const settings = definition.settingsSchema.parse({});
  const rendered = definition.render({
    project,
    section,
    settings,
    pageType: "product",
    product,
  });
  return String(rendered);
}

function listingSections(
  project: StoreProjectV1,
  pageType: "category" | "collection" | "related",
  limit: number,
): StoreSection[] {
  const source = project.sections.find(
    (section) =>
      section.slot === "catalog" &&
      (isModernProject(project)
        ? section.moduleId === "catalog-product-grid"
        : ["editorial-product-grid", "compact-product-grid"].includes(section.moduleId)),
  );
  if (!source) return [];
  if (!isModernProject(project)) return [source];
  return [
    {
      ...source,
      id: `${source.id}-${pageType}` as StoreSection["id"],
      settings: {
        ...source.settings,
        source: "all",
        sourceId: "",
        limit,
        showViewAll: pageType === "related" ? false : source.settings.showViewAll,
        ...(pageType === "related" ? { title: "También puede interesarte" } : {}),
      },
    },
  ];
}

function storeStructuredData(project: StoreProjectV1): unknown[] {
  const logo = imageUrl(project, project.identity.logoAssetId);
  const hero = effectiveHomeSections(project).find(
    (section) => section.slot === "hero" && section.enabled,
  );
  const heroVideoId =
    typeof hero?.settings.videoAssetId === "string" ? hero.settings.videoAssetId : undefined;
  const heroVideo = videoFor(project, heroVideoId);
  const heroPosterId =
    typeof hero?.settings.posterAssetId === "string"
      ? hero.settings.posterAssetId
      : heroVideo?.posterAssetId;
  const heroPosterUrl = heroPosterId ? imageUrl(project, heroPosterId) : undefined;
  const structured: unknown[] = [
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: project.identity.brandName,
      url: normalizeBaseUrl(project.baseUrl),
      inLanguage: project.locale,
    },
    {
      "@context": "https://schema.org",
      "@type": "OnlineStore",
      name: project.identity.brandName,
      legalName: project.identity.legalName,
      url: normalizeBaseUrl(project.baseUrl),
      description: project.identity.description,
      ...(logo ? { logo: absoluteResourceUrl(project, logo) } : {}),
      email: project.identity.email || undefined,
      ...(publicWhatsAppPhone(project) || project.identity.phone
        ? { telephone: publicWhatsAppPhone(project) || project.identity.phone }
        : {}),
      ...(project.identity.address ? { address: project.identity.address } : {}),
      hasMerchantReturnPolicy: {
        "@type": "MerchantReturnPolicy",
        applicableCountry: project.policies.returns.countries,
        merchantReturnDays: project.policies.returns.returnDays,
        returnPolicyCategory: "https://schema.org/MerchantReturnFiniteReturnWindow",
        returnMethod: "https://schema.org/ReturnByMail",
      },
    },
  ];
  if (heroVideo) {
    structured.push({
      "@context": "https://schema.org",
      "@type": "VideoObject",
      name: heroVideo.name,
      description: heroVideo.alt || heroVideo.name,
      contentUrl: absoluteResourceUrl(project, videoUrl(project, heroVideo.id) ?? ""),
      ...(heroPosterUrl ? { thumbnailUrl: absoluteResourceUrl(project, heroPosterUrl) } : {}),
      duration: `PT${Math.round(heroVideo.durationSeconds)}S`,
      uploadDate: project.updatedAt,
    });
  }
  return structured;
}

function breadcrumbData(
  project: StoreProjectV1,
  items: Array<{ name: string; path: string }>,
): unknown {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: absoluteUrl(project, item.path),
    })),
  };
}

function offerData(project: StoreProjectV1, offer: CommerceOfferSnapshot): unknown {
  return {
    "@type": "Offer",
    url: absoluteUrl(project, offer.variantPath),
    priceCurrency: offer.currency,
    price: (offer.priceMinor / 100).toFixed(2),
    availability:
      offer.availability === "in_stock"
        ? "https://schema.org/InStock"
        : offer.availability === "preorder"
          ? "https://schema.org/PreOrder"
          : "https://schema.org/OutOfStock",
    ...(offer.availabilityDate ? { availabilityStarts: offer.availabilityDate } : {}),
    itemCondition: "https://schema.org/NewCondition",
    seller: { "@type": "Organization", name: project.identity.brandName },
    shippingDetails: {
      "@type": "OfferShippingDetails",
      shippingDestination: {
        "@type": "DefinedRegion",
        addressCountry: project.policies.shipping.countries,
      },
      deliveryTime: {
        "@type": "ShippingDeliveryTime",
        handlingTime: {
          "@type": "QuantitativeValue",
          minValue: project.policies.shipping.handlingDaysMin,
          maxValue: project.policies.shipping.handlingDaysMax,
          unitCode: "DAY",
        },
        transitTime: {
          "@type": "QuantitativeValue",
          minValue: project.policies.shipping.transitDaysMin,
          maxValue: project.policies.shipping.transitDaysMax,
          unitCode: "DAY",
        },
      },
    },
  };
}

function schemaOptionName(value: string): string {
  const normalized = value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  const aliases: Record<string, string> = {
    color: "color",
    colour: "color",
    coloracion: "color",
    talle: "size",
    tamano: "size",
    size: "size",
    material: "material",
    patron: "pattern",
    pattern: "pattern",
  };
  return aliases[normalized] ?? normalized.replace(/[^a-z0-9]+/g, "");
}

function productStructuredData(
  project: StoreProjectV1,
  product: Product,
  snapshot: CommerceSnapshot,
): unknown {
  const productSnapshot = snapshot.products.find((item) => item.productId === product.id);
  if (!productSnapshot) return {};
  const variantNodes = productSnapshot.offers.map((offer) => ({
    "@type": "Product",
    name: offer.title,
    sku: offer.sku || undefined,
    ...(offer.gtin ? { gtin13: offer.gtin } : {}),
    ...(offer.mpn ? { mpn: offer.mpn } : {}),
    ...(offer.imageUrls.length ? { image: offer.imageUrls } : {}),
    offers: offerData(project, offer),
  }));

  if (product.variants.length === 1) {
    return {
      "@context": "https://schema.org",
      ...variantNodes[0],
      name: product.title,
      description: product.description,
      brand: { "@type": "Brand", name: product.brand },
      url: absoluteUrl(project, productSnapshot.canonicalPath),
    };
  }

  const variesBy = Array.from(
    new Set(product.variants.flatMap((variant) => Object.keys(variant.optionValues))),
  ).map((option) => `https://schema.org/${schemaOptionName(option)}`);

  return {
    "@context": "https://schema.org",
    "@type": "ProductGroup",
    productGroupID: product.id,
    name: product.title,
    description: product.description,
    brand: { "@type": "Brand", name: product.brand },
    url: absoluteUrl(project, `/productos/${product.slug}/`),
    ...(productSnapshot.imageUrls.length ? { image: productSnapshot.imageUrls } : {}),
    variesBy,
    hasVariant: variantNodes,
  };
}

function renderDocument(
  project: StoreProjectV1,
  page: PageDescriptor,
  mode: ExportMode,
  publicAiContext = false,
  manifest?: PublicExportManifest,
): string {
  const copy = project.publicCopy;
  const canonical = absoluteUrl(project, page.canonicalPath);
  const socialImageValue =
    page.image ??
    imageUrl(project, project.seo.socialImageId) ??
    imageUrl(project, project.assets[0]?.id);
  const socialImage = socialImageValue ? absoluteResourceUrl(project, socialImageValue) : undefined;
  const socialAsset = page.image
    ? project.assets.find(
        (asset) => imageUrl(project, asset.id) === page.image || asset.source === page.image,
      )
    : (imageFor(project, project.seo.socialImageId) ?? project.assets[0]);
  const keywords = [
    project.identity.brandName,
    page.title,
    ...project.categories
      .filter((category) => !category.parentId)
      .map((category) => category.title),
    ...project.collections.map((collection) => collection.title),
  ]
    .flatMap((value) => normalizeSearchTokens(value))
    .filter((value, index, values) => value.length >= 3 && values.indexOf(value) === index)
    .slice(0, 24)
    .join(", ");
  const author = project.identity.brandName || project.identity.legalName;
  const publisher = project.identity.legalName || author;
  const nonIndexablePage = ["search", "cart", "checkout", "not-found"].includes(page.pageType);
  const robots =
    mode === "draft"
      ? "noindex,nofollow"
      : nonIndexablePage
        ? "noindex,follow"
        : "index,follow,max-image-preview:large,max-video-preview:-1,max-snippet:-1";
  const verification = [
    project.seo.searchConsoleVerification
      ? `<meta name="google-site-verification" content="${escapeHtml(project.seo.searchConsoleVerification)}">`
      : "",
    project.seo.merchantVerification
      ? `<meta name="google-site-verification" content="${escapeHtml(project.seo.merchantVerification)}">`
      : "",
  ]
    .filter(Boolean)
    .join("\n");
  const structuredData = page.structuredData
    .map((data) => `<script type="application/ld+json">${jsonForScript(data)}</script>`)
    .join("\n");
  const colorMode =
    project.theme.colorMode === "auto" ? "" : ` data-theme="${project.theme.colorMode}"`;
  const baseHref = baseUrlPathname(project.baseUrl);
  const baseHrefAttribute = baseHref ? ` data-base-href="${escapeHtml(baseHref)}"` : "";
  const whatsAppPhone = publicWhatsAppPhone(project);
  const whatsappGreeting = interpolatePublicCopy(
    project.whatsapp.greeting.trim() || copy.whatsapp.orderGreeting,
    { storeName: project.identity.brandName },
  );
  const whatsAppAttributes = whatsAppPhone
    ? ` data-whatsapp="${escapeHtml(whatsAppPhone)}" data-whatsapp-greeting="${escapeHtml(personalizeWhatsAppGreeting(whatsappGreeting, project.identity.brandName))}" data-whatsapp-include-sku="${String(project.whatsapp.includeSku)}"`
    : "";
  const publicCopyAttribute = ` data-solara-copy="${escapeAttribute(JSON.stringify(project.publicCopy))}"`;
  const criticalImage = page.preloadImage ? resourceHref(project, page.preloadImage) : undefined;
  const lcpPreload =
    mode === "production" && criticalImage
      ? `<link rel="preload" as="image" href="${escapeAttribute(criticalImage)}" fetchpriority="high">`
      : "";
  const fontPreloads =
    mode === "production"
      ? activeFonts(project.theme.typography.display, project.theme.typography.body)
          .map(
            (font) =>
              `<link rel="preload" as="font" type="font/woff2" href="${escapeAttribute(assetHref(project, `/${font.woff2Path}`))}" crossorigin>`,
          )
          .join("\n  ")
      : "";
  const aiContextLinks =
    mode === "production" && publicAiContext && !nonIndexablePage
      ? `<link rel="alternate" type="application/json" title="Contexto publico para agentes" href="${escapeAttribute(assetHref(project, "/ai-context.json"))}">
  <link rel="alternate" type="text/plain" title="Resumen publico para agentes" href="${escapeAttribute(assetHref(project, "/llms.txt"))}">`
      : "";

  return `<!doctype html>
<html lang="${project.locale}" data-store-id="${escapeHtml(project.id)}" data-currency="${project.currency}" data-price-fraction-display="${escapeHtml((project as any).priceFractionDisplay ?? "always")}"${whatsAppAttributes}${publicCopyAttribute} data-solara-runtime-features="${escapeAttribute((manifest?.runtimeFeatures ?? []).join(","))}"${colorMode}${baseHrefAttribute}>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${escapeHtml(page.title)}</title>
  <meta name="description" content="${escapeHtml(page.description)}">
  <meta name="keywords" content="${escapeHtml(keywords)}">
  <meta name="author" content="${escapeHtml(author)}">
  <meta name="publisher" content="${escapeHtml(publisher)}">
  <meta name="robots" content="${robots}">
  <meta name="googlebot" content="${robots}">
  <link rel="canonical" href="${escapeHtml(canonical)}">
  <meta name="theme-color" content="${escapeHtml(project.theme.colors.background)}">
  <meta property="og:type" content="${page.pageType === "product" ? "product" : "website"}">
  <meta property="og:locale" content="es_AR">
  <meta property="og:site_name" content="${escapeHtml(project.identity.brandName)}">
  <meta property="og:title" content="${escapeHtml(page.title)}">
  <meta property="og:description" content="${escapeHtml(page.description)}">
  <meta property="og:url" content="${escapeHtml(canonical)}">
  ${socialImage ? `<meta property="og:image" content="${escapeHtml(socialImage)}"><meta property="og:image:alt" content="${escapeHtml(socialAsset?.alt || page.title)}">${socialAsset ? `<meta property="og:image:width" content="${socialAsset.width}"><meta property="og:image:height" content="${socialAsset.height}">` : ""}<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${escapeHtml(page.title)}"><meta name="twitter:description" content="${escapeHtml(page.description)}"><meta name="twitter:image" content="${escapeHtml(socialImage)}">` : `<meta name="twitter:card" content="summary">`}
  <meta property="og:updated_time" content="${escapeHtml(project.updatedAt)}">
  ${page.pageType === "product" ? `<meta property="article:published_time" content="${escapeHtml(project.createdAt)}"><meta property="article:modified_time" content="${escapeHtml(project.updatedAt)}"><meta property="article:author" content="${escapeHtml(author)}">` : ""}
  ${verification}
  ${lcpPreload}
  ${fontPreloads}
  ${aiContextLinks}
  <link rel="stylesheet" href="${escapeAttribute(assetHref(project, "/assets/storefront.css"))}">
  ${structuredData}
</head>
<body>
  <a class="solara-skip-link" href="#solara-main">${escapeHtml(copy.export.skipToContent)}</a>
  <div class="solara-page${modernProjectClass(project)}" data-solara-store data-design-family="${escapeHtml(project.commerceTemplates.designFamily ?? "legacy-editorial-v1")}" data-page-type="${page.pageType}" data-color-mode="${project.theme.colorMode}">${page.body.replace("<main", '<main id="solara-main"')}</div>
  <script src="${escapeAttribute(assetHref(project, "/assets/storefront.js"))}" defer></script>
</body>
</html>`;
}

function paginationNavigation(
  project: StoreProjectV1,
  basePath: string,
  pageNumber: number,
  totalPages: number,
): string {
  if (totalPages <= 1) return "";
  const copy = project.publicCopy.export;
  const pathFor = (page: number) =>
    internalHref(project, page === 1 ? `${basePath}/` : `${basePath}/pagina/${page}/`);
  return `<nav class="solara-pagination" aria-label="${escapeAttribute(copy.pagination)}">
    ${pageNumber > 1 ? `<a rel="prev" href="${escapeHtml(pathFor(pageNumber - 1))}">${escapeHtml(copy.previous)}</a>` : ""}
    <span>${escapeHtml(interpolatePublicCopy(copy.pageOf, { page: String(pageNumber), total: String(totalPages) }))}</span>
    ${pageNumber < totalPages ? `<a rel="next" href="${escapeHtml(pathFor(pageNumber + 1))}">${escapeHtml(copy.next)}</a>` : ""}
  </nav>`;
}

function categoryProducts(project: StoreProjectV1, category: Category): Product[] {
  const productIds = new Set(getCategoryProductIds(project, category.id));
  return project.products.filter(
    (product) => product.status === "active" && productIds.has(product.id),
  );
}

function categoryChildrenMarkup(project: StoreProjectV1, category: Category): string {
  const children = project.categories.filter((candidate) => candidate.parentId === category.id);
  if (children.length === 0) return "";
  const copy = project.publicCopy.export;
  return `<nav class="solara-category-children" aria-label="${escapeAttribute(interpolatePublicCopy(copy.categoryChildren, { category: category.title }))}"><h2>${escapeHtml(interpolatePublicCopy(copy.exploreCategory, { category: category.title }))}</h2><ul>${children
    .map(
      (child) =>
        `<li><a href="${internalHref(project, `/categorias/${child.slug}/`)}"><span>${escapeHtml(child.title)}</span><small>${getCategoryProductIds(project, child.id).length} ${escapeHtml(copy.categoryProducts)}</small></a></li>`,
    )
    .join("")}</ul></nav>`;
}

function categorySortSelect(project: StoreProjectV1): string {
  const copy = project.publicCopy.filters;
  return `<label>${escapeHtml(copy.sort)} <select data-category-sort><option value="recommended">${escapeHtml(copy.recommended)}</option><option value="price-asc">${escapeHtml(copy.priceAsc)}</option><option value="price-desc">${escapeHtml(copy.priceDesc)}</option><option value="name">${escapeHtml(copy.name)}</option></select></label>`;
}

function categoryListingMarkup(
  project: StoreProjectV1,
  products: readonly Product[],
  grid: string,
): string {
  const copy = project.publicCopy;
  const resultCount = `<span data-category-result-count data-category-total="${products.length}">${products.length} ${escapeHtml(copy.filters.resultCount)}</span>`;
  if (isModernProject(project)) {
    return `<div class="catalog-category-layout">
      ${modernCategoryFilters(project, products, project.commerceTemplates.designFamily === "catalog-modern-v2")}
      <div class="catalog-category-results">
        <div class="solara-category-toolbar" data-category-toolbar>
          ${resultCount}
          ${categorySortSelect(project)}
        </div>
        ${grid}
      </div>
    </div>`;
  }
  const tagOptions = [...new Set(products.flatMap((product) => product.tags))]
    .sort((a, b) => a.localeCompare(b))
    .slice(0, 12)
    .map((tag) => `<option value="${escapeAttribute(tag)}">${escapeHtml(tag)}</option>`)
    .join("");
  return `<div class="solara-category-toolbar" data-category-toolbar>
    ${resultCount}
    <details><summary>Filtrar</summary><div><label><input type="checkbox" data-category-available> Sólo disponibles</label><label>Etiqueta <select data-category-tag><option value="">Todas</option>${tagOptions}</select></label><label>Precio mínimo <input type="number" min="0" step="1" data-category-min-price inputmode="decimal"></label><label>Precio máximo <input type="number" min="0" step="1" data-category-max-price inputmode="decimal"></label></div></details>
    ${categorySortSelect(project)}
  </div>
  ${grid}`;
}

function modernCategoryFilters(
  project: StoreProjectV1,
  products: readonly Product[],
  mobileSheet = false,
  controlPrefix = "category",
): string {
  const copy = project.publicCopy.filters;
  const dataAttribute = (name: string): string => `data-${controlPrefix}-${name}`;
  const tags = [...new Set(products.flatMap((product) => product.tags))].slice(0, 12);
  const tagOptions = tags
    .map((tag) => `<option value="${escapeAttribute(tag)}">${escapeHtml(tag)}</option>`)
    .join("");
  const optionGroups = new Map<string, Set<string>>();
  products.forEach((product) => {
    product.variants.forEach((variant) => {
      Object.entries(variant.optionValues).forEach(([key, value]) => {
        const values = optionGroups.get(key) ?? new Set<string>();
        values.add(value);
        optionGroups.set(key, values);
      });
    });
  });
  const optionFilters = [...optionGroups.entries()]
    .slice(0, 6)
    .map(([key, values]) => {
      const options = [...values]
        .sort((left, right) => left.localeCompare(right, "es-AR"))
        .slice(0, 16)
        .map((value) => `<option value="${escapeAttribute(value)}">${escapeHtml(value)}</option>`)
        .join("");
      return `<fieldset><legend>${escapeHtml(key)}</legend><label><span class="sr-only">${escapeHtml(copy.filterByTag)} ${escapeHtml(key)}</span><select ${dataAttribute("option")} ${dataAttribute("option-key")}="${escapeAttribute(key)}"><option value="">${escapeHtml(copy.all)}</option>${options}</select></label></fieldset>`;
    })
    .join("");
  const groups = `<div class="catalog-filter-groups"><fieldset><legend>${escapeHtml(copy.availability)}</legend><label><input type="checkbox" ${dataAttribute("available")}> ${escapeHtml(copy.availableOnly)}</label></fieldset><fieldset><legend>${escapeHtml(copy.tag)}</legend><label><span class="sr-only">${escapeHtml(copy.filterByTag)}</span><select ${dataAttribute("tag")}><option value="">${escapeHtml(copy.all)}</option>${tagOptions}</select></label></fieldset>${optionFilters}<fieldset><legend>${escapeHtml(copy.price)}</legend><div class="catalog-price-fields"><label><span>${escapeHtml(copy.minimum)}</span><input type="number" min="0" step="1" ${dataAttribute("min-price")} inputmode="decimal"></label><label><span>${escapeHtml(copy.maximum)}</span><input type="number" min="0" step="1" ${dataAttribute("max-price")} inputmode="decimal"></label></div></fieldset></div>`;
  const summary = `<summary><span>${escapeHtml(copy.title)}</span><span class="catalog-filter-disclosure" aria-hidden="true">&#x2304;</span></summary>`;
  const content = mobileSheet
    ? `<details class="catalog-filter-toggle">${summary}</details>${groups}`
    : `<details open>${summary}${groups}</details>`;
  return `<aside class="catalog-category-filters${controlPrefix === "search" ? " solara-search-filters" : ""}" aria-label="${escapeAttribute(copy.title)}">${content}</aside>`;
}

function categoryBreadcrumbItems(
  project: StoreProjectV1,
  category: Category,
): Array<{ name: string; path: string }> {
  return [
    { name: project.publicCopy.pages.home, path: "/" },
    ...getCategoryBreadcrumb(project, category.id).map((item) => ({
      name: item.title,
      path: `/categorias/${item.slug}/`,
    })),
  ];
}

function categoryBreadcrumbMarkup(project: StoreProjectV1, category: Category): string {
  const items = categoryBreadcrumbItems(project, category);
  return `<nav class="solara-breadcrumbs" aria-label="${escapeAttribute(project.publicCopy.export.breadcrumbs)}">${items
    .map((item, index) => {
      const current = index === items.length - 1;
      return `${index > 0 ? '<span aria-hidden="true">/</span>' : ""}${
        current
          ? `<span aria-current="page">${escapeHtml(item.name)}</span>`
          : `<a href="${escapeAttribute(item.path)}">${escapeHtml(item.name)}</a>`
      }`;
    })
    .join("")}</nav>`;
}

function productCategoryScope(project: StoreProjectV1, product: Product): Set<string> {
  return new Set(
    product.categoryIds.flatMap((categoryId) => [
      categoryId,
      ...getCategoryAncestors(project, categoryId as Category["id"]).map((category) => category.id),
    ]),
  );
}

function buildPages(
  project: StoreProjectV1,
  snapshot = buildCommerceSnapshot(project),
): PageDescriptor[] {
  const copy = project.publicCopy;
  const sharedHeader = project.sections.filter((section) =>
    ["announcement", "header"].includes(section.slot),
  );
  const sharedFooter = project.sections.filter((section) =>
    isModernProject(project)
      ? ["cart", "footer"].includes(section.slot) || section.moduleId === "catalog-newsletter-cta"
      : ["trust", "cart", "footer"].includes(section.slot),
  );
  const homeHero = effectiveHomeSections(project).find(
    (section) => section.enabled && section.slot === "hero",
  );
  const homeHeroVideo =
    typeof homeHero?.settings.videoAssetId === "string"
      ? videoFor(project, homeHero.settings.videoAssetId)
      : undefined;
  const socialImage =
    imageUrl(project, project.seo.socialImageId) ??
    (typeof homeHero?.settings.posterAssetId === "string"
      ? imageUrl(project, homeHero.settings.posterAssetId)
      : undefined) ??
    imageUrl(project, homeHeroVideo?.posterAssetId) ??
    imageUrl(project, project.assets[0]?.id);
  const defaultSeoDescription =
    project.seo.description.trim() ||
    project.identity.description.trim() ||
    `Descubrí la propuesta de ${project.identity.brandName}.`;
  const homePreloadImage =
    (typeof homeHero?.settings.posterAssetId === "string"
      ? imageUrl(project, homeHero.settings.posterAssetId)
      : undefined) ??
    imageUrl(project, homeHeroVideo?.posterAssetId) ??
    socialImage;
  const homeConfig = project.pages.find((page) => page.kind === "home");
  const homeSections = homeConfig?.sections.length
    ? [...sharedHeader, ...homeConfig.sections, ...sharedFooter]
    : project.sections;

  const home: PageDescriptor = {
    path: "index.html",
    title: homeConfig?.seoTitle ?? project.seo.title ?? project.name ?? project.identity.brandName,
    description:
      homeConfig?.seoDescription ?? project.seo.description ?? project.identity.description,
    canonicalPath: "/",
    pageType: "home",
    body: `<main class="solara-home">${renderProjectSections(project, homeSections, { pageType: "home" })}</main>`,
    structuredData: storeStructuredData(project),
    ...(socialImage ? { image: socialImage } : {}),
    ...(homePreloadImage ? { preloadImage: homePreloadImage } : {}),
  };

  const categories = project.categories.flatMap((category) => {
    const products = categoryProducts(project, category);
    const pages: PageDescriptor[] = [];

    const pageSize = project.commerceTemplates.category.productsPerPage;
    const totalPages = Math.max(1, Math.ceil(products.length / pageSize));
    for (let offset = 0; offset < Math.max(products.length, 1); offset += pageSize) {
      const pageNumber = Math.floor(offset / pageSize) + 1;
      const paginated = products.slice(offset, offset + pageSize);
      const categoryAsset = imageFor(project, category.imageId);
      const categoryImage = imageUrl(project, category.imageId);
      const categoryMedia =
        categoryAsset && categoryImage
          ? String(
              renderImage(project, category.imageId, {
                className: "solara-category-hero-image",
                loading: "eager",
                fetchPriority: "high",
                sizes: "100vw",
                fallbackAlt: category.title,
              }),
            )
          : "";
      const categorySections = listingSections(project, "category", pageSize);
      const categoryGrid = renderProjectSections(project, categorySections, {
        pageType: "category",
        category: { ...category, productIds: paginated.map((product) => product.id) },
        products: paginated,
      });
      const body = [
        renderProjectSections(project, sharedHeader, { pageType: "category", category }),
        `<main class="solara-container catalog-category-page">
          ${categoryBreadcrumbMarkup(project, category)}
          <header class="solara-category-hero">
            <h1><span class="solara-category-title-glass">${escapeHtml(category.title)}</span></h1>
            <p>${escapeHtml(category.description)}</p>
            ${categoryMedia}
          </header>
          ${categoryChildrenMarkup(project, category)}
          ${categoryListingMarkup(project, products, categoryGrid)}
          ${paginationNavigation(project, `/categorias/${category.slug}`, pageNumber, totalPages)}
        </main>`,
        renderProjectSections(project, sharedFooter, { pageType: "category", category }),
      ].join("");
      const canonicalPath =
        pageNumber === 1
          ? `/categorias/${category.slug}/`
          : `/categorias/${category.slug}/pagina/${pageNumber}/`;
      pages.push({
        path:
          pageNumber === 1
            ? `categorias/${category.slug}/index.html`
            : `categorias/${category.slug}/pagina/${pageNumber}/index.html`,
        title: `${category.title} | ${project.identity.brandName}`,
        description: category.description || project.seo.description,
        canonicalPath,
        pageType: "category",
        body,
        structuredData: [breadcrumbData(project, categoryBreadcrumbItems(project, category))],
        ...(categoryImage ? { image: categoryImage } : {}),
        ...(categoryImage ? { preloadImage: categoryImage } : {}),
      });
    }

    return pages;
  });

  const collections = project.collections.flatMap((collection) => {
    const products = collection.productIds
      .map((id) => project.products.find((product) => product.id === id))
      .filter((product): product is Product => Boolean(product && product.status === "active"));
    const pages: PageDescriptor[] = [];
    const pageSize = project.commerceTemplates.category.productsPerPage;

    const totalPages = Math.max(1, Math.ceil(products.length / pageSize));
    for (let offset = 0; offset < Math.max(products.length, 1); offset += pageSize) {
      const pageNumber = Math.floor(offset / pageSize) + 1;
      const paginated = products.slice(offset, offset + pageSize);
      const collectionSections = listingSections(project, "collection", pageSize);
      const body = [
        renderProjectSections(project, sharedHeader, { pageType: "collection", collection }),
        `<main class="solara-container">
          <header>
            <h1>${escapeHtml(collection.title)}</h1>
            <p>${escapeHtml(collection.description)}</p>
          </header>
          ${renderProjectSections(project, collectionSections, {
            pageType: "collection",
            collection: { ...collection, productIds: paginated.map((product) => product.id) },
            products: paginated,
          })}
          ${paginationNavigation(project, `/colecciones/${collection.slug}`, pageNumber, totalPages)}
        </main>`,
        renderProjectSections(project, sharedFooter, { pageType: "collection", collection }),
      ].join("");
      const canonicalPath =
        pageNumber === 1
          ? `/colecciones/${collection.slug}/`
          : `/colecciones/${collection.slug}/pagina/${pageNumber}/`;
      const collectionImage = imageUrl(project, collection.imageId);
      pages.push({
        path:
          pageNumber === 1
            ? `colecciones/${collection.slug}/index.html`
            : `colecciones/${collection.slug}/pagina/${pageNumber}/index.html`,
        title: `${collection.title} | ${project.identity.brandName}`,
        description: collection.description || project.seo.description,
        canonicalPath,
        pageType: "collection",
        body,
        structuredData: [
          breadcrumbData(project, [
            { name: copy.pages.home, path: "/" },
            { name: collection.title, path: `/colecciones/${collection.slug}/` },
          ]),
        ],
        ...(collectionImage ? { image: collectionImage } : {}),
        ...(collectionImage ? { preloadImage: collectionImage } : {}),
      });
    }
    return pages;
  });

  const products = project.products
    .filter((product) => product.status === "active")
    .map((product): PageDescriptor => {
      const productImage = imageUrl(project, product.imageIds[0]);
      const productCategoryIds = productCategoryScope(project, product);
      const relatedProducts = project.products
        .filter((candidate) => {
          if (candidate.status !== "active" || candidate.id === product.id) return false;
          const candidateCategoryIds = productCategoryScope(project, candidate);
          return (
            [...candidateCategoryIds].some((id) => productCategoryIds.has(id)) ||
            candidate.collectionIds.some((id) => product.collectionIds.includes(id))
          );
        })
        .slice(0, 6);
      // En catálogos chicos completamos la fila con productos activos para
      // conservar una sección de recomendaciones útil y visualmente estable.
      if (relatedProducts.length < 6) {
        const relatedIds = new Set(relatedProducts.map((candidate) => candidate.id));
        relatedProducts.push(
          ...project.products
            .filter(
              (candidate) =>
                candidate.status === "active" &&
                candidate.id !== product.id &&
                !relatedIds.has(candidate.id),
            )
            .slice(0, 6 - relatedProducts.length),
        );
      }
      const relatedSections = project.commerceTemplates.product.showRelated
        ? listingSections(project, "related", 6)
        : [];
      const body = [
        renderProjectSections(project, sharedHeader, { pageType: "product", product }),
        `<main>${productDetailSection(project, product)}${
          relatedProducts.length && relatedSections.length
            ? `<section class="solara-related-products"><div class="solara-container">${renderProjectSections(project, relatedSections, { pageType: "product", products: relatedProducts })}</div></section>`
            : ""
        }</main>`,
        renderProjectSections(project, sharedFooter, { pageType: "product", product }),
      ].join("");
      return {
        path: `productos/${product.slug}/index.html`,
        title: `${product.title} | ${project.identity.brandName}`,
        description: product.description || project.seo.description,
        canonicalPath: `/productos/${product.slug}/`,
        pageType: "product",
        body,
        structuredData: [
          breadcrumbData(project, [
            { name: copy.pages.home, path: "/" },
            { name: copy.pages.products, path: "/" },
            { name: product.title, path: `/productos/${product.slug}/` },
          ]),
          productStructuredData(project, product, snapshot),
        ],
        ...(productImage ? { image: productImage } : {}),
        ...(productImage ? { preloadImage: productImage } : {}),
      };
    });

  const aboutConfig = project.pages.find((page) => page.kind === "about");
  const contactConfig = project.pages.find((page) => page.kind === "contact");
  const editableSections = (kind: "about" | "contact") =>
    project.pages.find((page) => page.kind === kind)?.sections ?? [];
  const isV2Design = project.commerceTemplates.designFamily === "catalog-modern-v2";
  const isAboutV2 = isV2Design;
  const aboutV2Sections = editableSections("about");
  const aboutHero = aboutV2Sections.find(
    (section) => section.moduleId === "about-hero" && section.enabled,
  );
  const aboutPreloadImage =
    isAboutV2 && typeof aboutHero?.settings.imageAssetId === "string"
      ? imageUrl(project, aboutHero.settings.imageAssetId)
      : undefined;
  const aboutV2Body = [
    renderProjectSections(project, sharedHeader, { pageType: "about" }),
    `<main class="solara-about-page solara-container"><div class="solara-about-sections">${renderProjectSections(project, aboutV2Sections, { pageType: "about" })}</div></main>`,
    renderProjectSections(project, sharedFooter, { pageType: "about" }),
  ].join("");
  const legacyAboutBody = [
    renderProjectSections(project, sharedHeader, { pageType: "about" }),
    `<main class="solara-editorial-page solara-container"><nav class="solara-breadcrumbs" aria-label="${escapeAttribute(copy.export.breadcrumbs)}"><a href="${internalHref(project, "/")}">${escapeHtml(copy.pages.home)}</a><span aria-hidden="true">/</span><span>${escapeHtml(copy.pages.about)}</span></nav><header class="solara-page-intro"><p class="solara-eyebrow">${escapeHtml(copy.pages.aboutEyebrow)}</p><h1>${escapeHtml(aboutConfig?.title ?? copy.pages.aboutFallbackTitle)}</h1><p>${escapeHtml(project.identity.description)}</p></header><section class="solara-story-grid"><div><h2>${escapeHtml(copy.pages.aboutGuidanceTitle)}</h2><p>${escapeHtml(project.identity.description)}</p></div><div><h2>${escapeHtml(copy.pages.aboutInformationTitle)}</h2><p>${escapeHtml(project.policies.shipping.summary)}</p><a class="solara-secondary-action" href="${escapeAttribute(internalHref(project, "/contacto/"))}">${escapeHtml(copy.pages.aboutContactAction)}</a></div></section><section class="solara-values-grid"><article><h2>${escapeHtml(copy.pages.aboutSelectionTitle)}</h2><p>${escapeHtml(project.collections[0]?.description ?? copy.pages.aboutSelectionFallback)}</p></article><article><h2>${escapeHtml(copy.pages.aboutDeliveryTitle)}</h2><p>${escapeHtml(project.policies.shipping.summary)}</p></article><article><h2>${escapeHtml(copy.pages.aboutDirectTitle)}</h2><p>${escapeHtml(project.identity.email || project.identity.phone || copy.pages.aboutDirectFallback)}</p></article></section></main>`,
    editableSections("about").length
      ? renderProjectSections(project, editableSections("about"), { pageType: "about" })
      : "",
    renderProjectSections(project, sharedFooter, { pageType: "about" }),
  ].join("");
  const aboutPage: PageDescriptor = {
    path: "nosotros/index.html",
    title: aboutConfig?.seoTitle ?? `Nosotros | ${project.identity.brandName}`,
    description: aboutConfig?.seoDescription ?? project.identity.description,
    canonicalPath: "/nosotros/",
    pageType: "about",
    body: isAboutV2 ? aboutV2Body : legacyAboutBody,
    structuredData: [
      {
        "@context": "https://schema.org",
        "@type": "AboutPage",
        name: aboutConfig?.title ?? copy.pages.about,
        url: absoluteUrl(project, "/nosotros/"),
        description: aboutConfig?.seoDescription ?? project.identity.description,
      },
      breadcrumbData(project, [
        { name: copy.pages.home, path: "/" },
        { name: copy.pages.about, path: "/nosotros/" },
      ]),
    ],
    ...(socialImage ? { image: socialImage } : {}),
    ...(aboutPreloadImage ? { preloadImage: aboutPreloadImage } : {}),
  };

  const copyValues = { storeName: project.identity.brandName };
  const whatsAppContactLink = buildWhatsAppLink(
    project,
    interpolatePublicCopy(copy.whatsapp.ask, copyValues),
  );
  const whatsAppPurchaseLink = buildWhatsAppLink(
    project,
    interpolatePublicCopy(copy.whatsapp.purchase, copyValues),
  );
  const isContactV2 = project.commerceTemplates.designFamily === "catalog-modern-v2";
  const contactV2Body = [
    renderProjectSections(project, sharedHeader, { pageType: "contact" }),
    `<main class="solara-contact-page solara-container"><div class="solara-contact-sections">${renderProjectSections(project, editableSections("contact"), { pageType: "contact" })}</div></main>`,
    renderProjectSections(project, sharedFooter, { pageType: "contact" }),
  ].join("");
  const contactPage: PageDescriptor = {
    path: "contacto/index.html",
    title: contactConfig?.seoTitle ?? `Contacto | ${project.identity.brandName}`,
    description: contactConfig?.seoDescription ?? defaultSeoDescription,
    canonicalPath: "/contacto/",
    pageType: "contact",
    body: isContactV2
      ? contactV2Body
      : [
          renderProjectSections(project, sharedHeader, { pageType: "contact" }),
          `<main class="solara-contact-page solara-container"><nav class="solara-breadcrumbs" aria-label="${escapeAttribute(copy.export.breadcrumbs)}"><a href="${internalHref(project, "/")}">${escapeHtml(copy.pages.home)}</a><span aria-hidden="true">/</span><span>${escapeHtml(copy.pages.contact)}</span></nav><header class="solara-page-intro"><p class="solara-eyebrow">${escapeHtml(copy.pages.contactEyebrow)}</p><h1>${escapeHtml(contactConfig?.title ?? copy.pages.contactFallbackTitle)}</h1><p>${escapeHtml(copy.pages.contactDescription)}</p></header><section class="solara-contact-grid"><div class="solara-contact-details">${project.identity.email ? `<a href="mailto:${escapeAttribute(project.identity.email)}"><span>${escapeHtml(copy.contact.email)}</span><strong>${escapeHtml(project.identity.email)}</strong></a>` : ""}${project.identity.phone ? `<a href="tel:${escapeAttribute(project.identity.phone)}"><span>${escapeHtml(copy.contact.phone)}</span><strong>${escapeHtml(project.identity.phone)}</strong></a>` : ""}${whatsAppContactLink ? `<a href="${escapeAttribute(whatsAppContactLink)}" target="_blank" rel="noopener noreferrer"><span>${escapeHtml(copy.contact.whatsapp)}</span><strong>${escapeHtml(copy.contact.whatsappAction)}</strong></a>` : ""}${project.identity.address ? `<div><span>${escapeHtml(copy.contact.address)}</span><strong>${escapeHtml(project.identity.address)}</strong></div>` : ""}</div><aside class="solara-contact-cta"><h2>${escapeHtml(copy.pages.contactPurchaseTitle)}</h2><p>${escapeHtml(copy.pages.contactPurchaseDescription)}</p>${whatsAppPurchaseLink ? `<a class="solara-primary-action" href="${escapeAttribute(whatsAppPurchaseLink)}" target="_blank" rel="noopener noreferrer">${escapeHtml(copy.contact.whatsappAction)}</a>` : ""}</aside></section></main>`,
          editableSections("contact").length
            ? renderProjectSections(project, editableSections("contact"), { pageType: "contact" })
            : "",
          renderProjectSections(project, sharedFooter, { pageType: "contact" }),
        ].join(""),
    structuredData: [
      {
        "@context": "https://schema.org",
        "@type": "ContactPage",
        name: contactConfig?.title ?? copy.pages.contact,
        url: absoluteUrl(project, "/contacto/"),
        mainEntity: {
          "@type": "Organization",
          name: project.identity.brandName,
          email: project.identity.email || undefined,
          telephone: project.identity.phone || undefined,
        },
      },
      breadcrumbData(project, [
        { name: copy.pages.home, path: "/" },
        { name: copy.pages.contact, path: "/contacto/" },
      ]),
    ],
    ...(socialImage ? { image: socialImage } : {}),
  };

  const searchControls = `<form class="solara-search-form" role="search" action="/buscar/" method="get"><label for="solara-search-input">${escapeHtml(copy.search.title)}</label><div><input id="solara-search-input" name="q" type="search" autocomplete="off" placeholder="${escapeAttribute(copy.search.placeholder)}"><button class="solara-primary-action" type="submit">${escapeHtml(copy.search.submit)}</button></div></form>`;
  const searchProducts = project.products.filter((product) => product.status === "active");
  const searchFilters = modernCategoryFilters(
    project,
    searchProducts,
    project.commerceTemplates.designFamily === "catalog-modern-v2",
    "category",
  );
  const searchSort = categorySortSelect(project).replace(
    "data-category-sort",
    "data-category-sort data-search-sort",
  );
  const searchPage: PageDescriptor = {
    path: "buscar/index.html",
    title: `${copy.search.title} | ${project.identity.brandName}`,
    description: defaultSeoDescription,
    canonicalPath: "/buscar/",
    pageType: "search",
    body: `${renderProjectSections(project, sharedHeader, { pageType: "search" })}<main class="solara-search-page solara-container"><nav class="solara-breadcrumbs" aria-label="${escapeAttribute(copy.export.breadcrumbs)}"><a href="${internalHref(project, "/")}">${escapeHtml(copy.pages.home)}</a><span aria-hidden="true">/</span><span>${escapeHtml(copy.pages.search)}</span></nav><header class="solara-page-intro"><p class="solara-eyebrow">${escapeHtml(copy.pages.catalog)}</p><h1>${escapeHtml(copy.search.title)}</h1><p>${escapeHtml(copy.search.queryLabel)}</p>${searchControls}</header><section class="catalog-category-layout solara-search-layout"><div class="solara-search-filter-column">${searchFilters}</div><div class="catalog-category-results solara-search-results"><div class="solara-category-toolbar" data-search-toolbar><span data-category-result-count data-search-result-count aria-live="polite">${escapeHtml(copy.search.empty)}</span>${searchSort}</div><div data-search-results aria-live="polite"><div class="solara-search-results-grid" data-category-grid></div></div></div></section></main>${renderProjectSections(project, sharedFooter, { pageType: "search" })}`,
    structuredData: [
      {
        "@context": "https://schema.org",
        "@type": "WebPage",
        name: copy.search.title,
        url: absoluteUrl(project, "/buscar/"),
      },
    ],
  };

  const firstRootCategory = project.categories.find((category) => !category.parentId);
  const emptyCartHref = firstRootCategory
    ? internalHref(project, `/categorias/${firstRootCategory.slug}/`)
    : internalHref(project, "/buscar/");
  const cartContinueHref = isV2Design
    ? internalHref(project, "/#contact-form")
    : internalHref(project, "/compra/");
  const cartContinueLabel = isV2Design ? copy.checkout.coordinate : copy.checkout.continue;
  const cartPage: PageDescriptor = {
    path: "carrito/index.html",
    title: `Carrito | ${project.identity.brandName}`,
    description: defaultSeoDescription,
    canonicalPath: "/carrito/",
    pageType: "cart",
    body: `${renderProjectSections(project, sharedHeader, { pageType: "cart" })}<main class="solara-cart-page solara-container"><nav class="solara-breadcrumbs" aria-label="${escapeAttribute(copy.export.breadcrumbs)}"><a href="${internalHref(project, "/")}">${escapeHtml(copy.pages.home)}</a><span aria-hidden="true">/</span><span>${escapeHtml(copy.pages.cart)}</span></nav><header class="solara-page-intro"><p class="solara-eyebrow">${escapeHtml(copy.checkout.selection)}</p><h1>${escapeHtml(copy.pages.cart)}</h1></header><section class="solara-cart-page-grid"><div data-cart-lines><p class="solara-empty-state">${escapeHtml(copy.empty.cart)}</p></div><aside class="solara-cart-summary"><p><span>${escapeHtml(copy.cart.subtotal)}</span><strong data-cart-subtotal>${escapeHtml(formatMoney(0, project))}</strong></p><p><span>${escapeHtml(copy.cart.delivery)}</span><strong>${escapeHtml(copy.cart.deliveryToCoordinate)}</strong></p><p><span>${escapeHtml(copy.checkout.total)}</span><strong data-cart-total>${escapeHtml(formatMoney(0, project))}</strong></p><a class="solara-primary-action" href="${escapeAttribute(cartContinueHref)}">${escapeHtml(cartContinueLabel)}</a></aside></section></main>${renderProjectSections(project, sharedFooter, { pageType: "cart" })}`,
    structuredData: [],
  };
  cartPage.body = cartPage.body.replace(
    `<a class="solara-primary-action" href="${escapeAttribute(cartContinueHref)}">${cartContinueLabel}</a>`,
    `<a data-cart-cta href="${escapeAttribute(emptyCartHref)}"><span class="solara-primary-action">${escapeHtml(copy.cart.exploreCategories)}</span></a><a data-cart-cta href="${escapeAttribute(cartContinueHref)}" hidden><span class="solara-primary-action">${escapeHtml(cartContinueLabel)}</span></a>`,
  );

  const checkoutWhatsAppLink = whatsAppContactLink
    ? `<a class="solara-secondary-action" data-whatsapp-link href="#" target="_blank" rel="noopener noreferrer" hidden>${escapeHtml(copy.checkout.sendWhatsApp)}</a>`
    : "";
  const checkoutFields = `<label for="solara-customer-name">${escapeHtml(copy.cart.name)}</label><input id="solara-customer-name" name="name" autocomplete="name" required><label for="solara-customer-phone">${escapeHtml(copy.cart.phone)}</label><input id="solara-customer-phone" name="phone" autocomplete="tel" inputmode="tel" pattern="[0-9+ ()-]{8,}" title="Ingresá un teléfono válido" required><label for="solara-customer-address">${escapeHtml(copy.cart.address)}</label><textarea id="solara-customer-address" name="address" autocomplete="street-address" required></textarea><label for="solara-customer-notes">${escapeHtml(copy.cart.notes)}</label><textarea id="solara-customer-notes" name="notes"></textarea><button class="solara-primary-action" type="submit">${escapeHtml(copy.checkout.submit)}</button>`;
  const checkoutForm =
    project.commerceTemplates.designFamily === "catalog-modern-v2"
      ? `<form class="solara-checkout-form solara-checkout-form-v2" data-checkout-form><div class="solara-checkout-fields">${checkoutFields}</div><aside class="solara-checkout-order-panel" aria-labelledby="solara-order-summary-title"><p class="solara-eyebrow">${escapeHtml(copy.checkout.selection)}</p><h2 id="solara-order-summary-title">${escapeHtml(copy.checkout.summary)}</h2><p>${escapeHtml(copy.checkout.prepare)}</p><pre data-order-preview aria-live="polite"></pre>${checkoutWhatsAppLink}</aside></form>`
      : `<form class="solara-checkout-form" data-checkout-form>${checkoutFields}<pre data-order-preview aria-live="polite"></pre>${checkoutWhatsAppLink}</form>`;
  const checkoutPage: PageDescriptor = {
    path: "compra/index.html",
    title: `${copy.pages.checkout} por WhatsApp | ${project.identity.brandName}`,
    description: defaultSeoDescription,
    canonicalPath: "/compra/",
    pageType: "checkout",
    body: `${renderProjectSections(project, sharedHeader, { pageType: "checkout" })}<main class="solara-checkout-page solara-container"><nav class="solara-breadcrumbs" aria-label="${escapeAttribute(copy.export.breadcrumbs)}"><a href="${internalHref(project, "/")}">${escapeHtml(copy.pages.home)}</a><span aria-hidden="true">/</span><a href="/carrito/">${escapeHtml(copy.pages.cart)}</a><span aria-hidden="true">/</span><span>${escapeHtml(copy.pages.checkout)}</span></nav><header class="solara-page-intro"><p class="solara-eyebrow">${escapeHtml(copy.hero.directOrder)}</p><h1>${escapeHtml(copy.checkout.coordinate)}</h1><p>${escapeHtml(copy.checkout.prepare)}</p></header>${checkoutForm}</main>${renderProjectSections(project, sharedFooter, { pageType: "checkout" })}`,
    structuredData: [],
  };

  const formatPolicyDays = (minimum: number, maximum: number) =>
    minimum === maximum
      ? `${minimum} ${minimum === 1 ? "día" : "días"}`
      : `${minimum} a ${maximum} días`;
  const policyCoverage = (countries: readonly string[]) =>
    countries.map((country) => (country === "AR" ? "Argentina" : country)).join(", ");
  const policyContactAction = whatsAppContactLink
    ? `<a class="solara-primary-action" href="${escapeAttribute(whatsAppContactLink)}" target="_blank" rel="noopener noreferrer">${escapeHtml(copy.product.askWhatsApp)}</a>`
    : `<a class="solara-secondary-action" href="${escapeAttribute(internalHref(project, isV2Design ? "/#contact-form" : "/contacto/"))}">${escapeHtml(isV2Design ? copy.hero.contact : copy.pages.contact)}</a>`;
  const renderV2PolicyPage = (
    title: string,
    eyebrow: string,
    summary: string,
    details: string,
    facts: readonly (readonly [label: string, value: string])[] = [],
  ) =>
    [
      renderProjectSections(project, sharedHeader, { pageType: "legal" }),
      `<main class="solara-editorial-page solara-policy-page solara-container"><nav class="solara-breadcrumbs" aria-label="${escapeAttribute(copy.export.breadcrumbs)}"><a href="${internalHref(project, "/")}">${escapeHtml(copy.pages.home)}</a><span aria-hidden="true">/</span><span>${escapeHtml(title)}</span></nav><header class="solara-page-intro"><p class="solara-eyebrow">${escapeHtml(eyebrow)}</p><h1>${escapeHtml(title)}</h1><p>${escapeHtml(summary)}</p></header><section class="solara-story-grid"><div><h2>${escapeHtml(copy.export.policyDetailsTitle)}</h2><p>${escapeHtml(details)}</p></div><div><h2>${escapeHtml(copy.export.policyQuestionsTitle)}</h2><p>${escapeHtml(copy.export.policyQuestionsBody)}</p>${policyContactAction}</div></section>${facts.length ? `<section class="solara-values-grid">${facts.map(([label, value]) => `<article><h2>${escapeHtml(label)}</h2><p>${escapeHtml(value)}</p></article>`).join("")}</section>` : ""}</main>`,
      renderProjectSections(project, sharedFooter, { pageType: "legal" }),
    ].join("");

  const notFoundPage: PageDescriptor = {
    path: "404.html",
    title: `${copy.pages.notFound} | ${project.identity.brandName}`,
    description: defaultSeoDescription,
    canonicalPath: "/404.html",
    pageType: "not-found",
    body: isV2Design
      ? `${renderProjectSections(project, sharedHeader, { pageType: "legal" })}<main class="solara-container solara-error-page"><nav class="solara-breadcrumbs" aria-label="${escapeAttribute(copy.export.breadcrumbs)}"><a href="${internalHref(project, "/")}">${escapeHtml(copy.pages.home)}</a><span aria-hidden="true">/</span><span>404</span></nav><section class="solara-error-hero"><div class="solara-error-copy"><p class="solara-eyebrow">${escapeHtml(copy.pages.notFoundEyebrow)}</p><h1>${escapeHtml(copy.pages.notFoundTitle)}</h1><p>${escapeHtml(copy.pages.notFoundDescription)}</p><div class="solara-error-actions"><a class="solara-primary-action" href="${internalHref(project, "/")}">${escapeHtml(copy.pages.returnHome)}</a>${project.categories[0] ? `<a class="solara-secondary-action" href="${escapeAttribute(internalHref(project, `/categorias/${project.categories[0].slug}/`))}">${escapeHtml(copy.pages.viewCategories)}</a>` : ""}</div></div><p class="solara-error-code" aria-hidden="true">404</p></section></main>${renderProjectSections(project, sharedFooter, { pageType: "legal" })}`
      : `${renderProjectSections(project, sharedHeader, { pageType: "legal" })}<main class="solara-container solara-error-page"><p class="solara-eyebrow">404</p><h1>${escapeHtml(copy.pages.notFoundTitle)}</h1><p>${escapeHtml(copy.pages.notFoundDescription)}</p><a class="solara-primary-action" href="${internalHref(project, "/")}">${escapeHtml(copy.pages.returnHome)}</a></main>${renderProjectSections(project, sharedFooter, { pageType: "legal" })}`,
    structuredData: [],
  };

  const legalPages: PageDescriptor[] = [
    {
      path: "envios/index.html",
      title: `${copy.pages.shipping} | ${project.identity.brandName}`,
      description: project.policies.shipping.summary,
      canonicalPath: "/envios/",
      pageType: "legal",
      body: isV2Design
        ? renderV2PolicyPage(
            copy.pages.shipping,
            "Información de entrega",
            project.policies.shipping.summary,
            project.policies.shipping.details,
            [
              [
                "Preparación del pedido",
                formatPolicyDays(
                  project.policies.shipping.handlingDaysMin,
                  project.policies.shipping.handlingDaysMax,
                ),
              ],
              [
                "Tiempo estimado de tránsito",
                formatPolicyDays(
                  project.policies.shipping.transitDaysMin,
                  project.policies.shipping.transitDaysMax,
                ),
              ],
              ["Cobertura", policyCoverage(project.policies.shipping.countries)],
            ],
          )
        : `${renderProjectSections(project, sharedHeader, { pageType: "legal" })}<main class="solara-container"><h1>${escapeHtml(copy.pages.shipping)}</h1><p>${escapeHtml(project.policies.shipping.details)}</p></main>${renderProjectSections(project, sharedFooter, { pageType: "legal" })}`,
      structuredData: [],
    },
    {
      path: "devoluciones/index.html",
      title: `${copy.pages.returns} | ${project.identity.brandName}`,
      description: project.policies.returns.summary,
      canonicalPath: "/devoluciones/",
      pageType: "legal",
      body: isV2Design
        ? renderV2PolicyPage(
            copy.pages.returns,
            "Condiciones de cambio",
            project.policies.returns.summary,
            project.policies.returns.details,
            [
              [
                "Plazo informado",
                formatPolicyDays(
                  project.policies.returns.returnDays,
                  project.policies.returns.returnDays,
                ),
              ],
              ["Cobertura", policyCoverage(project.policies.returns.countries)],
            ],
          )
        : `${renderProjectSections(project, sharedHeader, { pageType: "legal" })}<main class="solara-container"><h1>${escapeHtml(copy.pages.returns)}</h1><p>${escapeHtml(project.policies.returns.details)}</p></main>${renderProjectSections(project, sharedFooter, { pageType: "legal" })}`,
      structuredData: [],
    },
    {
      path: "privacidad/index.html",
      title: `${copy.pages.privacy} | ${project.identity.brandName}`,
      description: "Cómo usamos los datos compartidos al realizar un pedido.",
      canonicalPath: "/privacidad/",
      pageType: "legal",
      body: isV2Design
        ? renderV2PolicyPage(
            copy.pages.privacy,
            "Uso de tus datos",
            "Cómo usamos los datos compartidos al realizar un pedido.",
            project.policies.privacy,
          )
        : `${renderProjectSections(project, sharedHeader, { pageType: "legal" })}<main class="solara-container"><h1>${escapeHtml(copy.pages.privacy)}</h1><p>${escapeHtml(project.policies.privacy)}</p></main>${renderProjectSections(project, sharedFooter, { pageType: "legal" })}`,
      structuredData: [],
    },
    {
      path: "terminos/index.html",
      title: `${copy.pages.terms} | ${project.identity.brandName}`,
      description: "Condiciones comerciales de la tienda.",
      canonicalPath: "/terminos/",
      pageType: "legal",
      body: isV2Design
        ? renderV2PolicyPage(
            copy.pages.terms,
            "Condiciones comerciales",
            "Información vigente para coordinar una compra.",
            project.policies.terms,
          )
        : `${renderProjectSections(project, sharedHeader, { pageType: "legal" })}<main class="solara-container"><h1>${escapeHtml(copy.pages.terms)}</h1><p>${escapeHtml(project.policies.terms)}</p></main>${renderProjectSections(project, sharedFooter, { pageType: "legal" })}`,
      structuredData: [],
    },
  ];

  const publishedLegalPages = isV2Design
    ? legalPages.filter(
        (page) => page.canonicalPath !== "/envios/" && page.canonicalPath !== "/devoluciones/",
      )
    : legalPages;

  return [
    home,
    ...(isV2Design ? [] : [aboutPage, contactPage]),
    ...(project.commerceTemplates.search.enabled ? [searchPage] : []),
    ...(project.commerceTemplates.cart.enabled ? [cartPage] : []),
    ...(project.commerceTemplates.checkout.enabled && !isV2Design ? [checkoutPage] : []),
    notFoundPage,
    ...categories,
    ...collections,
    ...products,
    ...publishedLegalPages,
  ].map((page) => ({
    ...page,
    body: page.body || `<main><p>No hay contenido publicado.</p></main>`,
  }));
}

function buildSitemap(
  project: StoreProjectV1,
  pages: PageDescriptor[],
  manifest?: PublicExportManifest,
): string {
  const indexableRoutes = new Set(
    manifest?.indexableRoutes ??
      pages
        .filter((page) => !["search", "cart", "checkout", "not-found"].includes(page.pageType))
        .map((page) => page.canonicalPath),
  );
  const urls = pages
    .filter((page) => indexableRoutes.has(page.canonicalPath))
    .map(
      (page) => `<url>
  <loc>${escapeXml(absoluteUrl(project, page.canonicalPath))}</loc>
  <lastmod>${project.updatedAt.slice(0, 10)}</lastmod>
  ${page.image ? `<image:image><image:loc>${escapeXml(absoluteResourceUrl(project, page.image))}</image:loc></image:image>` : ""}
</url>`,
    );
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${urls.join("\n")}
</urlset>`;
}

function buildImageSitemap(project: StoreProjectV1): string {
  const byPage = new Map<string, Array<{ url: string; caption: string }>>();
  const add = (pagePath: string, url: string | undefined, caption: string): void => {
    if (!url) return;
    const entries = byPage.get(pagePath) ?? [];
    if (!entries.some((entry) => entry.url === url)) entries.push({ url, caption });
    byPage.set(pagePath, entries);
  };
  const pageSize = project.commerceTemplates.category.productsPerPage;
  project.products
    .filter((product) => product.status === "active")
    .forEach((product) => {
      productImagePaths(project, product).forEach((url) => {
        add(`/productos/${product.slug}/`, url, product.title);
      });
    });
  project.categories.forEach((category) => {
    const totalPages = Math.max(
      1,
      Math.ceil(categoryProducts(project, category).length / pageSize),
    );
    for (let page = 1; page <= totalPages; page += 1) {
      add(
        page === 1
          ? `/categorias/${category.slug}/`
          : `/categorias/${category.slug}/pagina/${page}/`,
        imageUrl(project, category.imageId),
        category.title,
      );
    }
  });
  project.collections.forEach((collection) => {
    const products = collection.productIds
      .map((id) => project.products.find((product) => product.id === id))
      .filter((product): product is Product => Boolean(product && product.status === "active"));
    const totalPages = Math.max(1, Math.ceil(products.length / pageSize));
    for (let page = 1; page <= totalPages; page += 1) {
      add(
        page === 1
          ? `/colecciones/${collection.slug}/`
          : `/colecciones/${collection.slug}/pagina/${page}/`,
        imageUrl(project, collection.imageId),
        collection.title,
      );
    }
  });
  const homeHero = effectiveHomeSections(project).find(
    (section) => section.slot === "hero" && section.enabled,
  );
  const homeHeroVideo =
    typeof homeHero?.settings.videoAssetId === "string"
      ? videoFor(project, homeHero.settings.videoAssetId)
      : undefined;
  const homeImage =
    (typeof homeHero?.settings.posterAssetId === "string"
      ? imageUrl(project, homeHero.settings.posterAssetId)
      : undefined) ??
    imageUrl(project, homeHeroVideo?.posterAssetId) ??
    imageUrl(project, project.seo.socialImageId) ??
    imageUrl(project, project.assets[0]?.id);
  add("/", homeImage, project.identity.brandName);
  const urls = [...byPage.entries()].map(
    ([pagePath, entries]) => `<url>
  <loc>${escapeXml(absoluteUrl(project, pagePath))}</loc>
  ${entries
    .map(
      (entry) => `<image:image>
    <image:loc>${escapeXml(absoluteResourceUrl(project, entry.url))}</image:loc>
    <image:caption>${escapeXml(entry.caption)}</image:caption>
  </image:image>`,
    )
    .join("\n  ")}
</url>`,
  );
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${urls.join("\n")}
</urlset>`;
}

function buildVideoSitemap(project: StoreProjectV1): string {
  const hero = effectiveHomeSections(project).find(
    (section) => section.slot === "hero" && section.enabled,
  );
  const videoId =
    typeof hero?.settings.videoAssetId === "string" ? hero.settings.videoAssetId : undefined;
  const video = videoFor(project, videoId);
  if (!video) {
    return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:video="http://www.google.com/schemas/sitemap-video/1.1"></urlset>`;
  }
  const poster =
    imageUrl(project, video.posterAssetId) ??
    (typeof hero?.settings.posterAssetId === "string"
      ? imageUrl(project, hero.settings.posterAssetId)
      : undefined);
  const content = videoUrl(project, video.id);
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:video="http://www.google.com/schemas/sitemap-video/1.1">
  <url><loc>${escapeXml(absoluteUrl(project, "/"))}</loc><video:video>${poster ? `<video:thumbnail_loc>${escapeXml(absoluteResourceUrl(project, poster))}</video:thumbnail_loc>` : ""}<video:title>${escapeXml(video.name)}</video:title><video:description>${escapeXml(video.alt || video.name)}</video:description><video:content_loc>${escapeXml(absoluteResourceUrl(project, content ?? ""))}</video:content_loc><video:duration>${Math.round(video.durationSeconds)}</video:duration></video:video></url>
</urlset>`;
}

function buildMerchantFeed(
  project: StoreProjectV1,
  snapshot = buildCommerceSnapshot(project),
): string {
  const items = snapshot.offers.map((offer) => {
    const identifier = offer.gtin
      ? `<g:gtin>${escapeXml(offer.gtin)}</g:gtin>`
      : offer.mpn
        ? `<g:mpn>${escapeXml(offer.mpn)}</g:mpn>`
        : "<g:identifier_exists>no</g:identifier_exists>";
    const additionalImages = offer.imageUrls
      .slice(1)
      .map((image) => `<g:additional_image_link>${escapeXml(image)}</g:additional_image_link>`)
      .join("\n  ");
    return `<item>
  <g:id>${escapeXml(offer.variantId)}</g:id>
  <g:item_group_id>${escapeXml(offer.itemGroupId)}</g:item_group_id>
  <title>${escapeXml(offer.title)}</title>
  <description>${escapeXml(offer.description)}</description>
  <link>${escapeXml(absoluteUrl(project, offer.variantPath))}</link>
  <g:image_link>${escapeXml(offer.imageUrls[0] ?? "")}</g:image_link>
  ${additionalImages}
  <g:availability>${offer.availability}</g:availability>
  ${offer.availabilityDate ? `<g:availability_date>${escapeXml(offer.availabilityDate)}</g:availability_date>` : ""}
  <g:price>${(offer.priceMinor / 100).toFixed(2)} ${offer.currency}</g:price>
  <g:condition>new</g:condition>
  <g:brand>${escapeXml(offer.brand)}</g:brand>
  ${identifier}
</item>`;
  });

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss xmlns:g="http://base.google.com/ns/1.0" version="2.0">
<channel>
  <title>${escapeXml(project.identity.brandName)}</title>
  <link>${escapeXml(normalizeBaseUrl(project.baseUrl))}</link>
  <description>${escapeXml(project.identity.description)}</description>
  ${items.join("\n")}
</channel>
</rss>`;
}

function buildSearchIndex(project: StoreProjectV1): string {
  const entries = project.products
    .filter((product) => product.status === "active")
    .map((product) => {
      const prices = product.variants.map((variant) => variant.price);
      const image = imageUrl(project, product.imageIds[0]);
      const imageAsset = imageFor(project, product.imageIds[0]);
      const categoryIds = [...productCategoryScope(project, product)];
      const categoryNames = categoryIds
        .map((id) => project.categories.find((category) => category.id === id)?.title)
        .filter((value): value is string => Boolean(value));
      const collectionNames = product.collectionIds
        .map((id) => project.collections.find((collection) => collection.id === id)?.title)
        .filter((value): value is string => Boolean(value));
      const options = [
        ...new Set(
          product.variants.flatMap((variant) =>
            Object.entries(variant.optionValues).map(([key, value]) => `${key}=${value}`),
          ),
        ),
      ].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
      return {
        id: product.id,
        slug: product.slug,
        title: product.title,
        brand: product.brand,
        description: product.description,
        tags: product.tags,
        categoryIds,
        collectionIds: product.collectionIds,
        categoryNames,
        collectionNames,
        options,
        ...(image ? { imageUrl: image } : {}),
        ...(imageAsset ? { imageWidth: imageAsset.width, imageHeight: imageAsset.height } : {}),
        priceMin: Math.min(...prices),
        available: product.variants.some((variant) => variant.available),
        path: `/productos/${product.slug}/`,
        tokens: {
          title: normalizeSearchTokens(product.title),
          brand: normalizeSearchTokens(product.brand),
          tags: normalizeSearchTokens((product.tags ?? []).join(" ")),
          categories: normalizeSearchTokens([...categoryNames, ...collectionNames].join(" ")),
          description: normalizeSearchTokens(product.description),
        },
      };
    });
  return JSON.stringify(entries);
}

function buildCatalogIndex(project: StoreProjectV1): string {
  const entries = project.products
    .filter((product) => product.status === "active")
    .flatMap((product) =>
      product.variants.map((variant) => {
        const asset = imageFor(project, variant.imageId ?? product.imageIds[0]);
        const image = imageUrl(project, variant.imageId ?? product.imageIds[0]);
        return {
          productId: product.id,
          variantId: variant.id,
          title: product.title,
          variantTitle: variant.title,
          sku: variant.sku,
          price: variant.price,
          available: variant.available,
          ...(image ? { imageUrl: image } : {}),
          ...(asset ? { imageWidth: asset.width, imageHeight: asset.height } : {}),
        };
      }),
    );
  return JSON.stringify(entries);
}

export function auditProject(project: StoreProjectV1): AuditIssue[] {
  const issues: AuditIssue[] = [];
  const productSlugs = new Map<string, number>();
  const categorySlugs = new Map<string, number>();
  const collectionSlugs = new Map<string, number>();
  const snapshot = buildCommerceSnapshot(project);
  const reservedSlugs = new Set([
    "assets",
    "categorias",
    "colecciones",
    "productos",
    "envios",
    "devoluciones",
    "privacidad",
    "terminos",
    "contacto",
    "nosotros",
    "buscar",
    "carrito",
    "compra",
  ]);

  if (!project.baseUrl.startsWith("https://")) {
    issues.push({
      code: "domain.https",
      severity: "critical",
      message: "El dominio de producción debe usar HTTPS.",
      path: "baseUrl",
    });
  }

  let baseUrlPathname = "/";
  try {
    baseUrlPathname = new URL(project.baseUrl).pathname;
  } catch {
    baseUrlPathname = "/";
  }
  if (baseUrlPathname !== "/") {
    issues.push({
      code: "domain.baseurl-path",
      severity: "warning",
      message:
        "La baseUrl usa una subcarpeta: canonical, sitemap, metadatos y recursos ya la respetan; la navegación interna del sitio y las búsquedas del runtime siguen asumiendo la raíz.",
      path: "baseUrl",
    });
  }

  if (project.origin?.seed === "clean") {
    const placeholders = project.assets.filter((asset) =>
      isCatalogModernPlaceholderAsset(project, asset),
    );
    if (placeholders.length > 0) {
      issues.push({
        code: "template.placeholder",
        severity: "critical",
        message: "Reemplazá las imágenes de plantilla antes de publicar esta tienda.",
        path: "assets",
        area: "content",
        fixTarget: "assets",
      });
    }
  }

  project.products.forEach((product, productIndex) => {
    productSlugs.set(product.slug, (productSlugs.get(product.slug) ?? 0) + 1);
    if (product.status !== "active") return;
    if (!product.description.trim()) {
      issues.push({
        code: "product.description",
        severity: "critical",
        message: `${product.title} no tiene descripción.`,
        path: `products.${productIndex}.description`,
      });
    }
    if (product.imageIds.length === 0) {
      issues.push({
        code: "product.image",
        severity: "critical",
        message: `${product.title} no tiene imagen.`,
        path: `products.${productIndex}.imageIds`,
      });
    }
    product.imageIds.forEach((assetId) => {
      const asset = imageFor(project, assetId);
      if (!asset || !asset.alt.trim()) {
        issues.push({
          code: "image.alt",
          severity: "warning",
          message: `${product.title} tiene una imagen sin texto alternativo.`,
          path: `products.${productIndex}.imageIds`,
        });
      }
    });
    product.variants.forEach((variant, variantIndex) => {
      if (variant.price <= 0) {
        issues.push({
          code: "variant.price",
          severity: "critical",
          message: `${product.title}, ${variant.title} no tiene un precio válido.`,
          path: `products.${productIndex}.variants.${variantIndex}.price`,
        });
      }
      if (!variant.gtin && !variant.mpn && !variant.sku) {
        issues.push({
          code: "variant.identifier",
          severity: "warning",
          message: `${product.title}, ${variant.title} no tiene identificador comercial.`,
          path: `products.${productIndex}.variants.${variantIndex}`,
        });
      }
    });
  });

  project.videos.forEach((video, videoIndex) => {
    const heroPoster = effectiveHomeSections(project).some(
      (section) =>
        section.enabled &&
        section.slot === "hero" &&
        section.settings.videoAssetId === video.id &&
        typeof section.settings.posterAssetId === "string" &&
        section.settings.posterAssetId.length > 0,
    );
    if (!video.posterAssetId && !heroPoster) {
      issues.push({
        code: "video.poster",
        severity: "critical",
        message: `${video.name} necesita un poster para mantener un primer paint estable.`,
        path: `videos.${videoIndex}.posterAssetId`,
        area: "content",
        fixTarget: "assets",
      });
    }
    const videoBytes = dataUrlBytes(video.source);
    if (videoBytes && videoBytes.byteLength > 30 * 1024 * 1024) {
      issues.push({
        code: "video.size",
        severity: "critical",
        message: `${video.name} supera el límite inicial de 30 MB.`,
        path: `videos.${videoIndex}.source`,
        area: "content",
        fixTarget: "assets",
      });
    }
    if (video.durationSeconds > 15) {
      issues.push({
        code: "video.duration",
        severity: "warning",
        message: `${video.name} supera la duración recomendada de 15 segundos.`,
        path: `videos.${videoIndex}.durationSeconds`,
        area: "content",
        fixTarget: "assets",
      });
    }
  });

  project.categories.forEach((category) => {
    categorySlugs.set(category.slug, (categorySlugs.get(category.slug) ?? 0) + 1);
  });
  project.collections.forEach((collection) => {
    collectionSlugs.set(collection.slug, (collectionSlugs.get(collection.slug) ?? 0) + 1);
  });

  productSlugs.forEach((count, slug) => {
    if (count > 1) {
      issues.push({
        code: "product.slug.duplicate",
        severity: "critical",
        message: `El slug de producto "${slug}" está repetido.`,
      });
    }
  });
  categorySlugs.forEach((count, slug) => {
    if (count > 1) {
      issues.push({
        code: "category.slug.duplicate",
        severity: "critical",
        message: `El slug de categoría "${slug}" está repetido.`,
      });
    }
  });
  collectionSlugs.forEach((count, slug) => {
    if (count > 1) {
      issues.push({
        code: "collection.slug.duplicate",
        severity: "critical",
        message: `El slug de colección "${slug}" está repetido.`,
        area: "technical",
        fixTarget: "catalog",
      });
    }
  });

  [...productSlugs.keys(), ...categorySlugs.keys(), ...collectionSlugs.keys()].forEach((slug) => {
    if (reservedSlugs.has(slug)) {
      issues.push({
        code: "slug.reserved",
        severity: "critical",
        message: `El slug "${slug}" está reservado por una ruta pública.`,
        area: "technical",
        fixTarget: "catalog",
      });
    }
  });

  if (project.policies.shipping.handlingDaysMin > project.policies.shipping.handlingDaysMax) {
    issues.push({
      code: "shipping.handling-range",
      severity: "critical",
      message: "El rango de preparación de envíos es inválido.",
      area: "content",
      fixTarget: "summary",
    });
  }
  if (project.policies.shipping.transitDaysMin > project.policies.shipping.transitDaysMax) {
    issues.push({
      code: "shipping.transit-range",
      severity: "critical",
      message: "El rango de tránsito de envíos es inválido.",
      area: "content",
      fixTarget: "summary",
    });
  }
  if (!project.identity.phone.trim() || !project.identity.address.trim()) {
    issues.push({
      code: "identity.contact",
      severity: "warning",
      message: "La tienda debería publicar teléfono y dirección comercial.",
      area: "content",
      fixTarget: "summary",
    });
  }

  project.products.forEach((product, productIndex) => {
    if (product.status !== "active") return;
    if (!product.brand.trim()) {
      issues.push({
        code: "product.brand",
        severity: "warning",
        message: `${product.title} no tiene marca comercial.`,
        area: "merchant",
        path: `products.${productIndex}.brand`,
        fixTarget: "catalog",
        entity: { type: "product", id: product.id, label: product.title },
      });
    }
    product.variants.forEach((variant, variantIndex) => {
      if (variant.stockStatus === "preorder" && !variant.availabilityDate) {
        issues.push({
          code: "variant.availability-date",
          severity: "critical",
          message: `${product.title}, ${variant.title} necesita fecha de disponibilidad para preorder.`,
          area: "merchant",
          path: `products.${productIndex}.variants.${variantIndex}.availabilityDate`,
          fixTarget: "catalog",
          entity: { type: "variant", id: variant.id, label: `${product.title} - ${variant.title}` },
        });
      }
      if (variant.stockStatus !== "preorder" && variant.availabilityDate) {
        issues.push({
          code: "variant.availability-date.unused",
          severity: "warning",
          message: `${product.title}, ${variant.title} tiene una fecha que sólo aplica a preorder.`,
          area: "merchant",
          path: `products.${productIndex}.variants.${variantIndex}.availabilityDate`,
          fixTarget: "catalog",
        });
      }
    });
  });

  const feed = buildMerchantFeed(project, snapshot);
  // Verificar cada oferta con `feed.includes(markup)` es O(ofertas × feed):
  // con 3.600 ofertas y un feed de ~1 MB son ~10 GB de comparación de strings.
  // El feed se construye desde el MISMO snapshot (price/availability no pueden
  // divergir); el contrato real es la presencia de cada oferta en el feed.
  const feedItemIds = new Set(
    [...feed.matchAll(/<g:id>([^<]+)<\/g:id>/g)].map((match) => match[1]),
  );
  snapshot.offers.forEach((offer) => {
    if (!feedItemIds.has(escapeXml(offer.variantId))) {
      issues.push({
        code: "merchant.snapshot-mismatch",
        severity: "critical",
        message: `La oferta ${offer.variantId} no coincide con el snapshot comercial.`,
        area: "merchant",
        fixTarget: "export",
        entity: { type: "variant", id: offer.variantId, label: offer.title },
      });
    }
  });

  if (!project.policies.shipping.details.trim() || !project.policies.returns.details.trim()) {
    issues.push({
      code: "policies.incomplete",
      // warning: el Studio no tiene editor de políticas; un crítico sin UI
      // para resolverlo bloquearía producción de forma inalcanzable.
      severity: "warning",
      message: "Las políticas de envío y devoluciones deben estar completas.",
    });
  }

  issues.push({
    code: "merchant.whatsapp-checkout",
    severity: "warning",
    message:
      "Google Merchant puede rechazar una tienda cuyo pedido se completa únicamente por WhatsApp.",
  });

  return issues.map((issue) => ({
    ...issue,
    area:
      issue.area ??
      (issue.code.startsWith("merchant") || issue.code.startsWith("variant.")
        ? "merchant"
        : issue.code.startsWith("domain") || issue.code.includes("slug")
          ? "technical"
          : issue.code.startsWith("image") || issue.code.startsWith("product")
            ? "content"
            : "structured-data"),
    fixTarget:
      issue.fixTarget ??
      (issue.code.startsWith("image")
        ? "assets"
        : issue.code.startsWith("variant")
          ? "catalog"
          : "seo"),
  }));
}

export function auditReport(project: StoreProjectV1): AuditReport {
  const baseIssues = auditProject(project);
  const optimization = optimizeProject(project, { mode: "draft", publicAiContext: false });
  const existingPaths = new Set(baseIssues.map((issue) => issue.path).filter(Boolean));
  const optimizationIssues: AuditIssue[] = optimization.findings
    .filter((finding) => !finding.path || !existingPaths.has(finding.path))
    .map((finding) => ({
      code: finding.code,
      severity: finding.severity,
      area: finding.area,
      message: finding.message,
      ...(finding.path ? { path: finding.path } : {}),
      ...(finding.entity ? { entity: finding.entity } : {}),
    }));
  const issues = [...baseIssues, ...optimizationIssues];
  return {
    issues,
    criticalCount: issues.filter((issue) => issue.severity === "critical").length,
    warningCount: issues.filter((issue) => issue.severity === "warning").length,
    merchantMode: "experimental-whatsapp",
    optimization,
  };
}

function buildFiles(
  project: StoreProjectV1,
  mode: ExportMode,
  publicAiContext: boolean,
): Map<string, string | Uint8Array> {
  const publicProject = projectWithPublicAssetUrls(project);
  const snapshot = buildCommerceSnapshot(publicProject);
  const pages = buildPages(publicProject, snapshot);
  const manifest = createPublicExportManifest(publicProject, pages);
  const mediaUsage = {
    assetIds: new Set(manifest.usedAssetIds),
    videoIds: new Set(manifest.usedVideoIds),
  };
  const files = new Map<string, string | Uint8Array>();
  pages.forEach((page) => {
    files.set(
      page.path,
      prefixDocumentHrefs(
        publicProject,
        renderDocument(publicProject, page, mode, publicAiContext, manifest),
      ),
    );
  });
  files.set(
    "assets/storefront.css",
    minifyCss(
      `${themeCss(publicProject)}\n${exportedModuleStyles(publicProject)}\n${STOREFRONT_RUNTIME_CSS}`,
    ),
  );
  files.set("assets/storefront.js", STOREFRONT_RUNTIME_JS);
  fontFilesFor(publicProject.theme.typography.display, publicProject.theme.typography.body).forEach(
    (bytes, path) => {
      files.set(path, bytes);
    },
  );
  if (manifest.searchEnabled) files.set("search-index.json", buildSearchIndex(publicProject));
  if (manifest.cartEnabled || manifest.checkoutEnabled || publicProject.siteShell.cart)
    files.set("catalog-index.json", buildCatalogIndex(publicProject));
  files.set(
    "robots.txt",
    mode === "draft"
      ? "User-agent: *\nDisallow: /\n"
      : `User-agent: *\nAllow: /\nSitemap: ${absoluteUrl(publicProject, "/sitemap.xml")}\n`,
  );
  if (mode === "production") {
    files.set("sitemap.xml", buildSitemap(publicProject, pages, manifest));
    files.set("image-sitemap.xml", buildImageSitemap(publicProject));
    if (manifest.usedVideoIds.length > 0)
      files.set("video-sitemap.xml", buildVideoSitemap(publicProject));
  }
  if (mode === "production") {
    files.set("google-merchant.xml", buildMerchantFeed(publicProject, snapshot));
    if (publicAiContext) {
      files.set("ai-context.json", buildAiContext(publicProject, { compact: true }));
      files.set("llms.txt", buildLlmsTxt(publicProject));
    }
    files.set(
      "_headers",
      `/*
  Cache-Control: public, max-age=0, must-revalidate
  Content-Security-Policy: default-src 'self'; img-src 'self' data: https: http:; script-src 'self'; style-src 'self'; style-src-attr 'unsafe-inline'; connect-src 'self'; media-src 'self' data: https: http:; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; require-trusted-types-for 'script'; trusted-types solara-storefront
  Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
  Cross-Origin-Opener-Policy: same-origin
  Referrer-Policy: strict-origin-when-cross-origin
  X-Content-Type-Options: nosniff
  X-Frame-Options: DENY
  Permissions-Policy: camera=(), microphone=(), geolocation=()

/assets/*
  Cache-Control: public, max-age=31536000, immutable

/sitemap.xml
  Cache-Control: public, max-age=3600, must-revalidate

/image-sitemap.xml
  Cache-Control: public, max-age=3600, must-revalidate

/video-sitemap.xml
  Cache-Control: public, max-age=3600, must-revalidate

/google-merchant.xml
  Cache-Control: public, max-age=900, must-revalidate

/ai-context.json
  Cache-Control: public, max-age=900, must-revalidate

/llms.txt
  Cache-Control: public, max-age=900, must-revalidate

/search-index.json
  Cache-Control: public, max-age=900, must-revalidate

/catalog-index.json
  Cache-Control: public, max-age=900, must-revalidate
`,
    );
  }

  project.assets
    .filter((asset) => mediaUsage.assetIds.has(asset.id))
    .forEach((asset) => {
      const bytes = dataUrlBytes(asset.source);
      if (bytes) files.set(publicAssetPath(asset, "primary", asset.source).slice(1), bytes);
      const fallbackBytes = asset.fallbackSource ? dataUrlBytes(asset.fallbackSource) : undefined;
      if (fallbackBytes) {
        files.set(
          publicAssetPath(asset, "fallback", asset.fallbackSource ?? "").slice(1),
          fallbackBytes,
        );
      }
      asset.responsiveSources?.forEach((source) => {
        const responsiveBytes = dataUrlBytes(source.source);
        if (responsiveBytes) {
          files.set(
            publicAssetPath(asset, "primary", source.source, source.width).slice(1),
            responsiveBytes,
          );
        }
      });
    });
  project.videos
    .filter((video) => mediaUsage.videoIds.has(video.id))
    .forEach((video) => {
      const bytes = dataUrlBytes(video.source);
      if (bytes) files.set(`assets/${video.hash}.${assetExtension(video)}`, bytes);
    });
  return files;
}

/**
 * Envuelve un error interno de generación con la fase en la que ocurrió y
 * conserva el mensaje original como causa, para que el usuario pueda accionar
 * sobre la entidad que falló en lugar de ver un stack interno.
 */
function withExportContext<T>(phase: string, fn: () => T): T {
  try {
    return fn();
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`La generación del sitio falló en ${phase}: ${detail}`, {
      cause: error,
    });
  }
}

/**
 * Builds the complete public artifact from one parsed snapshot. Keep all
 * generated files here so Preview, public site, SEO and Merchant cannot drift apart.
 */
export function exportProject(projectInput: StoreProjectV1, options: ExportOptions): ExportResult {
  const project = parseProject(projectInput, "exportar");
  const publicAiContext = options.publicAiContext ?? true;
  const optimization = optimizeProject(project, {
    mode: options.mode,
    profile: options.optimizationProfile ?? "safe",
    publicAiContext,
  });
  const baseAudit = auditProject(project);
  const existingPaths = new Set(baseAudit.map((issue) => issue.path).filter(Boolean));
  const optimizationAudit: AuditIssue[] = optimization.findings
    .filter((finding) => !finding.path || !existingPaths.has(finding.path))
    .map((finding) => ({
      code: finding.code,
      severity: finding.severity,
      area: finding.area,
      message: finding.message,
      ...(finding.path ? { path: finding.path } : {}),
      ...(finding.entity ? { entity: finding.entity } : {}),
    }));
  const audit = [...baseAudit, ...optimizationAudit];
  const critical = audit.filter((issue) => issue.severity === "critical");
  if (options.mode === "production" && critical.length > 0) {
    throw new Error(
      `La exportación de producción tiene ${critical.length} errores críticos: ${critical
        .map((issue) => issue.message)
        .join(" ")}`,
    );
  }

  const files = withExportContext("la fase de archivos del sitio", () =>
    buildFiles(project, options.mode, publicAiContext),
  );
  return { files, audit, optimization };
}

export function buildOptimizationReport(
  projectInput: StoreProjectV1,
  options: Pick<ExportOptions, "mode" | "publicAiContext" | "optimizationProfile"> = {
    mode: "draft",
    publicAiContext: true,
  },
): OptimizationReport {
  const project = parseProject(projectInput, "auditar la optimizacion");
  return optimizeProject(project, {
    mode: options.mode,
    profile: options.optimizationProfile ?? "safe",
    publicAiContext: options.publicAiContext ?? true,
  });
}

/** Renderiza el mismo árbol de exportProject sin escribir archivos. */
export function renderPreviewHtml(
  projectInput: StoreProjectV1,
  mode: ExportMode = "draft",
  path = "/",
  options: { assetTransport?: "inline" | "parent" } = {},
): string {
  const project = parseProject(projectInput, "renderizar la vista previa");
  const previewAssets = createPreviewAssetBundle(project);
  const pages = withExportContext("la fase de páginas del sitio", () =>
    buildPages(previewAssets.project),
  );
  const manifest = createPublicExportManifest(previewAssets.project, pages);
  const page =
    pages.find((candidate) => candidate.canonicalPath === path) ??
    pages.find((candidate) => candidate.pageType === "not-found") ??
    pages[0];
  if (!page) throw new Error("No se pudo renderizar la página inicial.");
  let document = withExportContext("la fase de documentos del sitio", () =>
    renderDocument(previewAssets.project, page, mode, false, manifest),
  );
  document = prefixDocumentHrefs(project, document);
  const usedSources = new Map(
    [...previewAssets.sources].filter(([path]) => document.includes(path)),
  );
  if (options.assetTransport === "parent") {
    document = deferPreviewAssetMarkup(document, usedSources);
  }
  const stylesheetHref = assetHref(project, "/assets/storefront.css");
  const storefrontSrc = assetHref(project, "/assets/storefront.js");
  return document
    .replace("</body>", `${previewAssetMarkup(usedSources, options.assetTransport)}\n</body>`)
    .replace(`href="${stylesheetHref}"`, 'href="data:text/css;base64,PREVIEW_STYLE"')
    .replace(
      `src="${storefrontSrc}"`,
      `src="data:text/javascript;base64,${toBase64(STOREFRONT_RUNTIME_JS)}"`,
    )
    .replace(
      "data:text/css;base64,PREVIEW_STYLE",
      `data:text/css;base64,${toBase64(
        minifyCss(
          `${themeCss(project, "inline")}\n${previewModuleStyles(project)}\n${STOREFRONT_RUNTIME_CSS}`,
        ),
      )}`,
    );
}

export function getPreviewAssetSources(projectInput: StoreProjectV1): ReadonlyMap<string, string> {
  const project = parseProject(projectInput, "preparar los recursos de la vista previa");
  return createPreviewAssetBundle(project).sources;
}

function toBase64(value: string): string {
  if (typeof btoa === "function") {
    const bytes = encoder.encode(value);
    let binary = "";
    bytes.forEach((byte) => {
      binary += String.fromCharCode(byte);
    });
    return btoa(binary);
  }
  return Buffer.from(value, "utf8").toString("base64");
}

export function createProjectArchive(projectInput: StoreProjectV1): string {
  const project = parseProject(projectInput, "crear el archivo del proyecto");
  return `${JSON.stringify(
    {
      format: "solara-project",
      version: 2,
      projectId: project.id,
      exportedAt: new Date().toISOString(),
      project,
    },
    null,
    2,
  )}\n`;
}

export function readProjectArchive(input: string): StoreProjectV1 {
  let envelope: {
    format?: string;
    version?: number;
    project?: unknown;
  };
  try {
    envelope = JSON.parse(input) as { format?: string; version?: number; project?: unknown };
  } catch {
    throw new Error("El respaldo está corrupto o no es JSON válido.");
  }
  if (envelope.format !== "solara-project" || envelope.version !== 2 || !envelope.project) {
    throw new Error(
      "Este respaldo pertenece a una versión anterior. Conservá el archivo original y creá una nueva tienda con el sistema actual.",
    );
  }
  return parseProject(envelope.project as StoreProjectV1, "leer el respaldo del proyecto");
}
