import {
  getModuleDefinition,
  MODULE_STYLE_BLOCKS,
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
  getCategoryAncestors,
  getCategoryBreadcrumb,
  getCategoryProductIds,
  StoreProjectV1Schema,
} from "@solara/project-schema";
import { STOREFRONT_RUNTIME_CSS, STOREFRONT_RUNTIME_JS } from "@solara/storefront-runtime";
import { strToU8, unzipSync, type Zippable, zipSync } from "fflate";

export type ExportMode = "draft" | "production";
export type AuditSeverity = "critical" | "warning" | "info";
export type AuditArea = "technical" | "content" | "structured-data" | "merchant";
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
}

export interface ExportOptions {
  mode: ExportMode;
}

export interface ExportResult {
  files: ReadonlyMap<string, string | Uint8Array>;
  zip: Uint8Array;
  audit: AuditIssue[];
}

interface PageDescriptor {
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
}

const encoder = new TextEncoder();
const decoder = new TextDecoder();
const stableMtime = new Date("2000-01-01T12:00:00.000Z");

function parseProject(projectInput: StoreProjectV1, operation: string): StoreProjectV1 {
  const result = StoreProjectV1Schema.safeParse(projectInput);
  if (result.success) return result.data;

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

function formatMoney(amount: number): string {
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" }).format(
    amount / 100,
  );
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

function absoluteUrl(project: StoreProjectV1, path: string): string {
  return `${normalizeBaseUrl(project.baseUrl)}${path.startsWith("/") ? path : `/${path}`}`;
}

function absoluteResourceUrl(project: StoreProjectV1, value: string): string {
  return /^https?:\/\//i.test(value) ? value : absoluteUrl(project, value);
}

function buildWhatsAppLink(project: StoreProjectV1, message: string): string {
  return `https://wa.me/${project.whatsapp.phone.replace(/\D/g, "")}?text=${encodeURIComponent(message)}`;
}

function imageFor(project: StoreProjectV1, assetId: string | undefined): ImageAsset | undefined {
  return project.assets.find((asset) => asset.id === assetId);
}

function imageUrl(project: StoreProjectV1, assetId: string | undefined): string | undefined {
  const asset = imageFor(project, assetId);
  if (!asset) return undefined;
  if (asset.source.startsWith("data:")) return `/assets/${asset.hash}.${assetExtension(asset)}`;
  return asset.source;
}

function videoFor(project: StoreProjectV1, assetId: string | undefined): VideoAsset | undefined {
  return project.videos.find((video) => video.id === assetId);
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
  return {
    ...project,
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

function previewAssetMarkup(sources: ReadonlyMap<string, string>): string {
  if (sources.size === 0) return "";
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
    const values = [...new Set(Object.keys(sources))];
    await Promise.all(values.map(async (value) => sourceFor(value)));
    document.querySelectorAll("[src]").forEach((element) => {
      const source = objectUrls.get(element.getAttribute("src") || "");
      if (source) element.setAttribute("src", source);
    });
    document.querySelectorAll("[srcset]").forEach((element) => {
      const srcset = element.getAttribute("srcset") || "";
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
    document.querySelectorAll("[poster]").forEach((element) => {
      const source = objectUrls.get(element.getAttribute("poster") || "");
      if (source) element.setAttribute("poster", source);
    });
    payload.remove();
  } catch {
    // A preview asset must never prevent the storefront from rendering.
  }
})();
</script>`;
}

function themeCss(project: StoreProjectV1): string {
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
  --solara-display: ${typography.display};
  --solara-body: ${typography.body};
  --solara-font-display: ${typography.display};
  --solara-font-body: ${typography.body};
  --solara-type-scale: ${typography.scale};
  --solara-space-scale: ${spacingScale};
  --solara-space: ${spacingScale};
  --solara-radius: ${radius}px;
  --solara-container: ${container}px;
  --solara-chrome-height: 116px;
}

* { box-sizing: border-box; }
html { background: var(--solara-background); color: var(--solara-text); }
body { margin: 0; min-width: 320px; font-family: var(--solara-body); line-height: 1.5; }
@font-face { font-family: "Archivo"; src: local("Arial"); font-display: swap; font-weight: 400 900; }
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
  return project.commerceTemplates.designFamily === "catalog-modern-v1";
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
  project.products.forEach((product) => {
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
  [...project.sections, ...project.pages.flatMap((page) => page.sections)]
    .filter((section) => section.enabled && shellSectionEnabled(project, section))
    .forEach((section) => {
      scan(section.settings);
    });

  project.videos.forEach((video) => {
    if (videoIds.has(video.id)) addValue(video.posterAssetId);
  });
  if (project.assets[0]) assetIds.add(project.assets[0].id);
  return { assetIds, videoIds };
}

function effectiveHomeSections(project: StoreProjectV1): readonly StoreSection[] {
  const home = project.pages.find((page) => page.kind === "home");
  return home?.sections.length ? home.sections : project.sections;
}

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
  return String(
    renderSections(project, activeProjectSections(project, sections), {
      pageType: modulePageType,
      ...(pageContext.product ? { product: pageContext.product } : {}),
      ...(pageContext.category ? { category: pageContext.category } : {}),
      ...(pageContext.collection ? { collection: pageContext.collection } : {}),
      ...(pageContext.products ? { products: pageContext.products } : {}),
    }),
  );
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
  const blocks = [...moduleIds].map((moduleId) => {
    const definition = getModuleDefinition(moduleId);
    if (!definition) throw new Error(`Módulo desconocido: ${moduleId}.`);
    const styleKey = String(definition.styleAsset).replace(/^module-style-/, "");
    return MODULE_STYLE_BLOCKS[styleKey] ?? "";
  });
  return `${STORE_BASE_STYLES}\n${blocks.filter(Boolean).join("\n")}`;
}

function exportedModuleStyles(project: StoreProjectV1): string {
  const pageSections = project.pages.flatMap((page) => page.sections);
  const productModule = isModernProject(project) ? "catalog-product-detail" : "product-detail";
  return moduleStylesForSections(
    activeProjectSections(project, [...project.sections, ...pageSections]),
    project.products.some((product) => product.status === "active") ? [productModule] : [],
  );
}

function previewModuleStyles(project: StoreProjectV1): string {
  const pageSections = project.pages.flatMap((page) => page.sections);
  const productModule = isModernProject(project) ? "catalog-product-detail" : "product-detail";
  return moduleStylesForSections(
    activeProjectSections(project, [...project.sections, ...pageSections]),
    project.products.some((product) => product.status === "active") ? [productModule] : [],
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
      telephone: project.identity.phone,
      address: project.identity.address,
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
      ...(heroPosterId
        ? {
            thumbnailUrl: absoluteResourceUrl(project, imageUrl(project, heroPosterId) ?? ""),
          }
        : {}),
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

function renderDocument(project: StoreProjectV1, page: PageDescriptor, mode: ExportMode): string {
  const canonical = absoluteUrl(project, page.canonicalPath);
  const socialImage = page.image ? absoluteResourceUrl(project, page.image) : undefined;
  const robots = mode === "draft" ? "noindex,nofollow" : "index,follow,max-image-preview:large";
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

  return `<!doctype html>
<html lang="${project.locale}" data-store-id="${escapeHtml(project.id)}" data-currency="${project.currency}" data-whatsapp="${escapeHtml(project.whatsapp.phone)}" data-whatsapp-greeting="${escapeHtml(project.whatsapp.greeting)}" data-whatsapp-include-sku="${String(project.whatsapp.includeSku)}"${colorMode}>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${escapeHtml(page.title)}</title>
  <meta name="description" content="${escapeHtml(page.description)}">
  <meta name="robots" content="${robots}">
  <link rel="canonical" href="${escapeHtml(canonical)}">
  <meta name="theme-color" content="${escapeHtml(project.theme.colors.background)}">
  <meta property="og:type" content="${page.pageType === "product" ? "product" : "website"}">
  <meta property="og:locale" content="es_AR">
  <meta property="og:site_name" content="${escapeHtml(project.identity.brandName)}">
  <meta property="og:title" content="${escapeHtml(page.title)}">
  <meta property="og:description" content="${escapeHtml(page.description)}">
  <meta property="og:url" content="${escapeHtml(canonical)}">
  ${socialImage ? `<meta property="og:image" content="${escapeHtml(socialImage)}">` : ""}
  ${verification}
  <link rel="stylesheet" href="/assets/storefront.css">
  ${structuredData}
</head>
<body>
  <a class="solara-skip-link" href="#solara-main">Ir al contenido</a>
  <div class="solara-page${isModernProject(project) ? " catalog-modern" : ""}" data-solara-store data-design-family="${escapeHtml(project.commerceTemplates.designFamily ?? "legacy-editorial-v1")}" data-page-type="${page.pageType}" data-color-mode="${project.theme.colorMode}">${page.body.replace("<main", '<main id="solara-main"')}</div>
  <script src="/assets/storefront.js" defer></script>
</body>
</html>`;
}

function paginationNavigation(basePath: string, pageNumber: number, totalPages: number): string {
  if (totalPages <= 1) return "";
  const pathFor = (page: number) => (page === 1 ? `${basePath}/` : `${basePath}/pagina/${page}/`);
  return `<nav class="solara-pagination" aria-label="Paginación">
    ${pageNumber > 1 ? `<a rel="prev" href="${escapeHtml(pathFor(pageNumber - 1))}">Anterior</a>` : ""}
    <span>Página ${pageNumber} de ${totalPages}</span>
    ${pageNumber < totalPages ? `<a rel="next" href="${escapeHtml(pathFor(pageNumber + 1))}">Siguiente</a>` : ""}
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
  return `<nav class="solara-category-children" aria-label="Subcategorías de ${escapeAttribute(category.title)}"><h2>Explorar ${escapeHtml(category.title)}</h2><ul>${children
    .map(
      (child) =>
        `<li><a href="/categorias/${escapeAttribute(child.slug)}/"><span>${escapeHtml(child.title)}</span><small>${getCategoryProductIds(project, child.id).length} productos</small></a></li>`,
    )
    .join("")}</ul></nav>`;
}

function categoryBreadcrumbItems(
  project: StoreProjectV1,
  category: Category,
): Array<{ name: string; path: string }> {
  return [
    { name: "Inicio", path: "/" },
    ...getCategoryBreadcrumb(project, category.id).map((item) => ({
      name: item.title,
      path: `/categorias/${item.slug}/`,
    })),
  ];
}

function categoryBreadcrumbMarkup(project: StoreProjectV1, category: Category): string {
  const items = categoryBreadcrumbItems(project, category);
  return `<nav class="solara-breadcrumbs" aria-label="Migas de pan">${items
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
  const sharedHeader = project.sections.filter((section) =>
    ["announcement", "header"].includes(section.slot),
  );
  const sharedFooter = project.sections.filter((section) =>
    ["trust", "cart", "footer"].includes(section.slot),
  );
  const socialImage =
    imageUrl(project, project.seo.socialImageId) ?? imageUrl(project, project.assets[0]?.id);
  const homeConfig = project.pages.find((page) => page.kind === "home");
  const homeSections = homeConfig?.sections.length
    ? [...sharedHeader, ...homeConfig.sections, ...sharedFooter]
    : project.sections;

  const home: PageDescriptor = {
    path: "index.html",
    title: homeConfig?.seoTitle ?? project.seo.title,
    description: homeConfig?.seoDescription ?? project.seo.description,
    canonicalPath: "/",
    pageType: "home",
    body: `<main class="solara-home">${renderProjectSections(project, homeSections, { pageType: "home" })}</main>`,
    structuredData: storeStructuredData(project),
    ...(socialImage ? { image: socialImage } : {}),
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
          ? `<img src="${escapeAttribute(categoryImage)}" alt="${escapeAttribute(categoryAsset.alt || category.title)}" width="${categoryAsset.width}" height="${categoryAsset.height}" loading="eager">`
          : "";
      const categorySections = listingSections(project, "category", pageSize);
      const filterTags = [...new Set(paginated.flatMap((product) => product.tags))].slice(0, 12);
      const tagOptions = filterTags
        .map((tag) => `<option value="${escapeAttribute(tag)}">${escapeHtml(tag)}</option>`)
        .join("");
      const body = [
        renderProjectSections(project, sharedHeader, { pageType: "category", category }),
        `<main class="solara-container">
          ${categoryBreadcrumbMarkup(project, category)}
          <header class="solara-category-hero">
            <h1>${escapeHtml(category.title)}</h1>
            <p>${escapeHtml(category.description)}</p>
            ${categoryMedia}
          </header>
          ${categoryChildrenMarkup(project, category)}
          <div class="solara-category-toolbar" data-category-toolbar>
            <span data-category-result-count>${products.length} productos</span>
            <details><summary>Filtrar</summary><div><label><input type="checkbox" data-category-available> Sólo disponibles</label><label>Etiqueta <select data-category-tag><option value="">Todas</option>${tagOptions}</select></label><label>Precio mínimo <input type="number" min="0" step="1" data-category-min-price inputmode="decimal"></label><label>Precio máximo <input type="number" min="0" step="1" data-category-max-price inputmode="decimal"></label></div></details>
            <label>Ordenar <select data-category-sort><option value="recommended">Recomendados</option><option value="price-asc">Precio menor</option><option value="price-desc">Precio mayor</option><option value="name">Nombre</option></select></label>
          </div>
          ${renderProjectSections(project, categorySections, {
            pageType: "category",
            category: { ...category, productIds: paginated.map((product) => product.id) },
            products: paginated,
          })}
          ${paginationNavigation(`/categorias/${category.slug}`, pageNumber, totalPages)}
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
          ${paginationNavigation(`/colecciones/${collection.slug}`, pageNumber, totalPages)}
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
            { name: "Inicio", path: "/" },
            { name: collection.title, path: `/colecciones/${collection.slug}/` },
          ]),
        ],
        ...(collectionImage ? { image: collectionImage } : {}),
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
        .slice(0, 4);
      const relatedSections = project.commerceTemplates.product.showRelated
        ? listingSections(project, "related", 4)
        : [];
      const body = [
        renderProjectSections(project, sharedHeader, { pageType: "product", product }),
        `<main>${productDetailSection(project, product)}</main>`,
        relatedProducts.length && relatedSections.length
          ? `<section class="solara-related-products"><div class="solara-container">${renderProjectSections(project, relatedSections, { pageType: "product", products: relatedProducts })}</div></section>`
          : "",
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
            { name: "Inicio", path: "/" },
            { name: "Productos", path: "/" },
            { name: product.title, path: `/productos/${product.slug}/` },
          ]),
          productStructuredData(project, product, snapshot),
        ],
        ...(productImage ? { image: productImage } : {}),
      };
    });

  const aboutConfig = project.pages.find((page) => page.kind === "about");
  const contactConfig = project.pages.find((page) => page.kind === "contact");
  const editableSections = (kind: "about" | "contact") =>
    project.pages.find((page) => page.kind === kind)?.sections ?? [];
  const aboutPage: PageDescriptor = {
    path: "nosotros/index.html",
    title: aboutConfig?.seoTitle ?? `Nosotros | ${project.identity.brandName}`,
    description: aboutConfig?.seoDescription ?? project.identity.description,
    canonicalPath: "/nosotros/",
    pageType: "about",
    body: [
      renderProjectSections(project, sharedHeader, { pageType: "about" }),
      `<main class="solara-editorial-page solara-container"><nav class="solara-breadcrumbs" aria-label="Migas de pan"><a href="/">Inicio</a><span aria-hidden="true">/</span><span>Nosotros</span></nav><header class="solara-page-intro"><p class="solara-eyebrow">Nuestra mirada</p><h1>${escapeHtml(aboutConfig?.title ?? "Elegimos objetos para vivirlos.")}</h1><p>${escapeHtml(project.identity.description)}</p></header><section class="solara-story-grid"><div><h2>Lo que nos guía</h2><p>${escapeHtml(project.identity.description)}</p></div><div><h2>Información clara</h2><p>${escapeHtml(project.policies.shipping.summary)}</p><a class="solara-secondary-action" href="/contacto/">Conocé cómo contactarnos</a></div></section><section class="solara-values-grid"><article><h2>Selección</h2><p>${escapeHtml(project.collections[0]?.description ?? "Conocé nuestras colecciones.")}</p></article><article><h2>Entrega</h2><p>${escapeHtml(project.policies.shipping.summary)}</p></article><article><h2>Atención directa</h2><p>${escapeHtml(project.identity.email || project.identity.phone || "Escribinos para recibir asesoramiento.")}</p></article></section></main>`,
      editableSections("about").length
        ? renderProjectSections(project, editableSections("about"), { pageType: "about" })
        : "",
      renderProjectSections(project, sharedFooter, { pageType: "about" }),
    ].join(""),
    structuredData: [
      {
        "@context": "https://schema.org",
        "@type": "AboutPage",
        name: aboutConfig?.title ?? "Nosotros",
        url: absoluteUrl(project, "/nosotros/"),
        description: aboutConfig?.seoDescription ?? project.identity.description,
      },
      breadcrumbData(project, [
        { name: "Inicio", path: "/" },
        { name: "Nosotros", path: "/nosotros/" },
      ]),
    ],
    ...(socialImage ? { image: socialImage } : {}),
  };

  const contactPage: PageDescriptor = {
    path: "contacto/index.html",
    title: contactConfig?.seoTitle ?? `Contacto | ${project.identity.brandName}`,
    description: contactConfig?.seoDescription ?? "Escribinos para coordinar tu pedido.",
    canonicalPath: "/contacto/",
    pageType: "contact",
    body: [
      renderProjectSections(project, sharedHeader, { pageType: "contact" }),
      `<main class="solara-contact-page solara-container"><nav class="solara-breadcrumbs" aria-label="Migas de pan"><a href="/">Inicio</a><span aria-hidden="true">/</span><span>Contacto</span></nav><header class="solara-page-intro"><p class="solara-eyebrow">Hablemos</p><h1>${escapeHtml(contactConfig?.title ?? "Estamos para ayudarte.")}</h1><p>Respondemos consultas, disponibilidad y detalles de entrega por canales directos.</p></header><section class="solara-contact-grid"><div class="solara-contact-details">${project.identity.email ? `<a href="mailto:${escapeAttribute(project.identity.email)}"><span>Email</span><strong>${escapeHtml(project.identity.email)}</strong></a>` : ""}${project.identity.phone ? `<a href="tel:${escapeAttribute(project.identity.phone)}"><span>Teléfono</span><strong>${escapeHtml(project.identity.phone)}</strong></a>` : ""}<a href="${escapeAttribute(buildWhatsAppLink(project, `Hola ${project.identity.brandName}, quiero hacer una consulta.`))}" target="_blank" rel="noopener noreferrer"><span>WhatsApp</span><strong>Escribir por WhatsApp</strong></a>${project.identity.address ? `<div><span>Dirección</span><strong>${escapeHtml(project.identity.address)}</strong></div>` : ""}</div><aside class="solara-contact-cta"><h2>Coordinemos tu compra</h2><p>Si ya elegiste una pieza, podés escribirnos y te confirmamos disponibilidad, envío y pago.</p><a class="solara-primary-action" href="${escapeAttribute(buildWhatsAppLink(project, `Hola ${project.identity.brandName}, quiero coordinar una compra.`))}" target="_blank" rel="noopener noreferrer">Escribir por WhatsApp</a></aside></section></main>`,
      editableSections("contact").length
        ? renderProjectSections(project, editableSections("contact"), { pageType: "contact" })
        : "",
      renderProjectSections(project, sharedFooter, { pageType: "contact" }),
    ].join(""),
    structuredData: [
      {
        "@context": "https://schema.org",
        "@type": "ContactPage",
        name: contactConfig?.title ?? "Contacto",
        url: absoluteUrl(project, "/contacto/"),
        mainEntity: {
          "@type": "Organization",
          name: project.identity.brandName,
          email: project.identity.email || undefined,
          telephone: project.identity.phone || undefined,
        },
      },
      breadcrumbData(project, [
        { name: "Inicio", path: "/" },
        { name: "Contacto", path: "/contacto/" },
      ]),
    ],
    ...(socialImage ? { image: socialImage } : {}),
  };

  const searchPage: PageDescriptor = {
    path: "buscar/index.html",
    title: `Buscar productos | ${project.identity.brandName}`,
    description: "Encontrá productos por nombre, marca, categoría o etiqueta.",
    canonicalPath: "/buscar/",
    pageType: "search",
    body: `${renderProjectSections(project, sharedHeader, { pageType: "search" })}<main class="solara-search-page solara-container"><nav class="solara-breadcrumbs" aria-label="Migas de pan"><a href="/">Inicio</a><span aria-hidden="true">/</span><span>Buscar</span></nav><header class="solara-page-intro"><p class="solara-eyebrow">Catálogo</p><h1>Buscar productos</h1><p>Buscá por nombre, marca, categoría o etiqueta.</p></header><form class="solara-search-form" role="search" action="/buscar/" method="get"><label for="solara-search-input">Buscar productos</label><div><input id="solara-search-input" name="q" type="search" autocomplete="off"><button class="solara-primary-action" type="submit">Buscar</button></div></form><section class="solara-search-results" data-search-results aria-live="polite"><p>Escribí una búsqueda para ver resultados.</p></section></main>${renderProjectSections(project, sharedFooter, { pageType: "search" })}`,
    structuredData: [
      {
        "@context": "https://schema.org",
        "@type": "WebPage",
        name: "Buscar productos",
        url: absoluteUrl(project, "/buscar/"),
      },
    ],
  };

  const cartPage: PageDescriptor = {
    path: "carrito/index.html",
    title: `Carrito | ${project.identity.brandName}`,
    description: "Revisá tus productos antes de coordinar el pedido.",
    canonicalPath: "/carrito/",
    pageType: "cart",
    body: `${renderProjectSections(project, sharedHeader, { pageType: "cart" })}<main class="solara-cart-page solara-container"><nav class="solara-breadcrumbs" aria-label="Migas de pan"><a href="/">Inicio</a><span aria-hidden="true">/</span><span>Carrito</span></nav><header class="solara-page-intro"><p class="solara-eyebrow">Tu selección</p><h1>Carrito</h1></header><section class="solara-cart-page-grid"><div data-cart-lines><p class="solara-empty-state">Tu carrito está vacío. Elegí una pieza para comenzar.</p></div><aside><p>Total estimado</p><strong data-cart-total>${escapeHtml(formatMoney(0))}</strong><a class="solara-primary-action" href="/compra/">Continuar a compra</a></aside></section></main>${renderProjectSections(project, sharedFooter, { pageType: "cart" })}`,
    structuredData: [],
  };

  const checkoutPage: PageDescriptor = {
    path: "compra/index.html",
    title: `Compra por WhatsApp | ${project.identity.brandName}`,
    description: "Completá tus datos para enviar el pedido por WhatsApp.",
    canonicalPath: "/compra/",
    pageType: "checkout",
    body: `${renderProjectSections(project, sharedHeader, { pageType: "checkout" })}<main class="solara-checkout-page solara-container"><nav class="solara-breadcrumbs" aria-label="Migas de pan"><a href="/">Inicio</a><span aria-hidden="true">/</span><a href="/carrito/">Carrito</a><span aria-hidden="true">/</span><span>Compra</span></nav><header class="solara-page-intro"><p class="solara-eyebrow">Pedido directo</p><h1>Coordinar compra</h1><p>Dejanos tus datos y abrí el mensaje preparado en WhatsApp.</p></header><form class="solara-checkout-form" data-checkout-form><label for="solara-customer-name">Nombre</label><input id="solara-customer-name" name="name" autocomplete="name" required><label for="solara-customer-phone">Teléfono</label><input id="solara-customer-phone" name="phone" autocomplete="tel" inputmode="tel" pattern="[0-9+ ()-]{8,}" title="Ingresá un teléfono válido" required><label for="solara-customer-address">Dirección o punto de entrega</label><textarea id="solara-customer-address" name="address" autocomplete="street-address" required></textarea><label for="solara-customer-notes">Notas opcionales</label><textarea id="solara-customer-notes" name="notes"></textarea><button class="solara-primary-action" type="submit">Preparar pedido</button><pre data-order-preview aria-live="polite"></pre><a class="solara-secondary-action" data-whatsapp-link href="#" target="_blank" rel="noopener noreferrer" hidden>Enviar pedido en WhatsApp</a></form></main>${renderProjectSections(project, sharedFooter, { pageType: "checkout" })}`,
    structuredData: [],
  };

  const notFoundPage: PageDescriptor = {
    path: "404.html",
    title: `Página no encontrada | ${project.identity.brandName}`,
    description: "La página que buscás no existe.",
    canonicalPath: "/404.html",
    pageType: "not-found",
    body: `${renderProjectSections(project, sharedHeader, { pageType: "legal" })}<main class="solara-container solara-error-page"><p class="solara-eyebrow">404</p><h1>No encontramos esa página.</h1><p>Podés volver al inicio o explorar nuestras colecciones.</p><a class="solara-primary-action" href="/">Volver al inicio</a></main>${renderProjectSections(project, sharedFooter, { pageType: "legal" })}`,
    structuredData: [],
  };

  const legalPages: PageDescriptor[] = [
    {
      path: "envios/index.html",
      title: `Envíos | ${project.identity.brandName}`,
      description: project.policies.shipping.summary,
      canonicalPath: "/envios/",
      pageType: "legal",
      body: `${renderProjectSections(project, sharedHeader, { pageType: "legal" })}<main class="solara-container"><h1>Envíos</h1><p>${escapeHtml(project.policies.shipping.details)}</p></main>${renderProjectSections(project, sharedFooter, { pageType: "legal" })}`,
      structuredData: [],
    },
    {
      path: "devoluciones/index.html",
      title: `Cambios y devoluciones | ${project.identity.brandName}`,
      description: project.policies.returns.summary,
      canonicalPath: "/devoluciones/",
      pageType: "legal",
      body: `${renderProjectSections(project, sharedHeader, { pageType: "legal" })}<main class="solara-container"><h1>Cambios y devoluciones</h1><p>${escapeHtml(project.policies.returns.details)}</p></main>${renderProjectSections(project, sharedFooter, { pageType: "legal" })}`,
      structuredData: [],
    },
    {
      path: "privacidad/index.html",
      title: `Privacidad | ${project.identity.brandName}`,
      description: "Cómo usamos los datos compartidos al realizar un pedido.",
      canonicalPath: "/privacidad/",
      pageType: "legal",
      body: `${renderProjectSections(project, sharedHeader, { pageType: "legal" })}<main class="solara-container"><h1>Privacidad</h1><p>${escapeHtml(project.policies.privacy)}</p></main>${renderProjectSections(project, sharedFooter, { pageType: "legal" })}`,
      structuredData: [],
    },
    {
      path: "terminos/index.html",
      title: `Términos | ${project.identity.brandName}`,
      description: "Condiciones comerciales de la tienda.",
      canonicalPath: "/terminos/",
      pageType: "legal",
      body: `${renderProjectSections(project, sharedHeader, { pageType: "legal" })}<main class="solara-container"><h1>Términos</h1><p>${escapeHtml(project.policies.terms)}</p></main>${renderProjectSections(project, sharedFooter, { pageType: "legal" })}`,
      structuredData: [],
    },
  ];

  return [
    home,
    aboutPage,
    contactPage,
    ...(project.commerceTemplates.search.enabled ? [searchPage] : []),
    ...(project.commerceTemplates.cart.enabled ? [cartPage] : []),
    ...(project.commerceTemplates.checkout.enabled ? [checkoutPage] : []),
    notFoundPage,
    ...categories,
    ...collections,
    ...products,
    ...legalPages,
  ].map((page) => ({
    ...page,
    body: page.body || `<main><p>No hay contenido publicado.</p></main>`,
  }));
}

function buildSitemap(project: StoreProjectV1, pages: PageDescriptor[]): string {
  const urls = pages
    .filter((page) => !["search", "cart", "checkout", "not-found"].includes(page.pageType))
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
  project.products
    .filter((product) => product.status === "active")
    .forEach((product) => {
      productImagePaths(project, product).forEach((url) => {
        add(`/productos/${product.slug}/`, url, product.title);
      });
    });
  project.categories.forEach((category) => {
    add(`/categorias/${category.slug}/`, imageUrl(project, category.imageId), category.title);
  });
  project.collections.forEach((collection) => {
    add(
      `/colecciones/${collection.slug}/`,
      imageUrl(project, collection.imageId),
      collection.title,
    );
  });
  const homeHero = effectiveHomeSections(project).find(
    (section) => section.slot === "hero" && section.enabled,
  );
  const homeImage =
    (typeof homeHero?.settings.posterAssetId === "string"
      ? imageUrl(project, homeHero.settings.posterAssetId)
      : undefined) ??
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
  <url><loc>${escapeXml(absoluteUrl(project, "/"))}</loc><video:video><video:thumbnail_loc>${escapeXml(absoluteResourceUrl(project, poster ?? ""))}</video:thumbnail_loc><video:title>${escapeXml(video.name)}</video:title><video:description>${escapeXml(video.alt || video.name)}</video:description><video:content_loc>${escapeXml(absoluteResourceUrl(project, content ?? ""))}</video:content_loc><video:duration>${Math.round(video.durationSeconds)}</video:duration></video:video></url>
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
      return {
        id: product.id,
        slug: product.slug,
        title: product.title,
        brand: product.brand,
        description: product.description,
        tags: product.tags,
        categoryIds,
        collectionIds: product.collectionIds,
        categoryNames: categoryIds
          .map((id) => project.categories.find((category) => category.id === id)?.title)
          .filter((value): value is string => Boolean(value)),
        collectionNames: product.collectionIds
          .map((id) => project.collections.find((collection) => collection.id === id)?.title)
          .filter((value): value is string => Boolean(value)),
        ...(image ? { imageUrl: image } : {}),
        ...(imageAsset ? { imageWidth: imageAsset.width, imageHeight: imageAsset.height } : {}),
        priceMin: Math.min(...prices),
        available: product.variants.some((variant) => variant.available),
        path: `/productos/${product.slug}/`,
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
  snapshot.offers.forEach((offer) => {
    const idMarkup = `<g:id>${escapeXml(offer.variantId)}</g:id>`;
    const priceMarkup = `<g:price>${(offer.priceMinor / 100).toFixed(2)} ${offer.currency}</g:price>`;
    const availabilityMarkup = `<g:availability>${offer.availability}</g:availability>`;
    if (
      !feed.includes(idMarkup) ||
      !feed.includes(priceMarkup) ||
      !feed.includes(availabilityMarkup)
    ) {
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
      severity: "critical",
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
  const issues = auditProject(project);
  return {
    issues,
    criticalCount: issues.filter((issue) => issue.severity === "critical").length,
    warningCount: issues.filter((issue) => issue.severity === "warning").length,
    merchantMode: "experimental-whatsapp",
  };
}

function buildFiles(project: StoreProjectV1, mode: ExportMode): Map<string, string | Uint8Array> {
  const publicProject = projectWithPublicAssetUrls(project);
  const mediaUsage = publicMediaUsage(project);
  const snapshot = buildCommerceSnapshot(publicProject);
  const pages = buildPages(publicProject, snapshot);
  const files = new Map<string, string | Uint8Array>();
  pages.forEach((page) => {
    files.set(page.path, renderDocument(publicProject, page, mode));
  });
  files.set(
    "assets/storefront.css",
    `${themeCss(publicProject)}\n${exportedModuleStyles(publicProject)}\n${STOREFRONT_RUNTIME_CSS}`,
  );
  files.set("assets/storefront.js", STOREFRONT_RUNTIME_JS);
  if (publicProject.commerceTemplates.search.enabled)
    files.set("search-index.json", buildSearchIndex(publicProject));
  if (
    publicProject.commerceTemplates.cart.enabled ||
    publicProject.commerceTemplates.checkout.enabled
  )
    files.set("catalog-index.json", buildCatalogIndex(publicProject));
  files.set(
    "robots.txt",
    mode === "draft"
      ? "User-agent: *\nDisallow: /\n"
      : `User-agent: *\nAllow: /\nSitemap: ${absoluteUrl(publicProject, "/sitemap.xml")}\n`,
  );
  if (mode === "production") {
    files.set("sitemap.xml", buildSitemap(publicProject, pages));
    files.set("image-sitemap.xml", buildImageSitemap(publicProject));
    if (mediaUsage.videoIds.size > 0)
      files.set("video-sitemap.xml", buildVideoSitemap(publicProject));
  }
  if (mode === "production") {
    files.set("google-merchant.xml", buildMerchantFeed(publicProject, snapshot));
    files.set(
      "_headers",
      `/*
  Content-Security-Policy: default-src 'self'; img-src 'self' data: https:; script-src 'self'; style-src 'self'; style-src-attr 'unsafe-inline'; connect-src 'none'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'
  Referrer-Policy: strict-origin-when-cross-origin
  X-Content-Type-Options: nosniff
  Permissions-Policy: camera=(), microphone=(), geolocation=()
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

function zipFiles(files: ReadonlyMap<string, string | Uint8Array>): Uint8Array {
  const zippable: Zippable = {};
  [...files.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .forEach(([path, value]) => {
      zippable[path] = [
        typeof value === "string" ? strToU8(value) : value,
        { level: 6, mtime: stableMtime },
      ];
    });
  return zipSync(zippable);
}

export function exportProject(projectInput: StoreProjectV1, options: ExportOptions): ExportResult {
  const project = parseProject(projectInput, "exportar");
  const audit = auditProject(project);
  const critical = audit.filter((issue) => issue.severity === "critical");
  if (options.mode === "production" && critical.length > 0) {
    throw new Error(
      `La exportación de producción tiene ${critical.length} errores críticos: ${critical
        .map((issue) => issue.message)
        .join(" ")}`,
    );
  }

  const files = buildFiles(project, options.mode);
  return { files, zip: zipFiles(files), audit };
}

export function renderPreviewHtml(
  projectInput: StoreProjectV1,
  mode: ExportMode = "draft",
  path = "/",
): string {
  const project = parseProject(projectInput, "renderizar la vista previa");
  const previewAssets = createPreviewAssetBundle(project);
  const pages = buildPages(previewAssets.project);
  const page = pages.find((candidate) => candidate.canonicalPath === path) ?? pages[0];
  if (!page) throw new Error("No se pudo renderizar la página inicial.");
  const document = renderDocument(previewAssets.project, page, mode);
  const usedSources = new Map(
    [...previewAssets.sources].filter(([path]) => document.includes(path)),
  );
  return document
    .replace("</body>", `${previewAssetMarkup(usedSources)}\n</body>`)
    .replace('href="/assets/storefront.css"', 'href="data:text/css;base64,PREVIEW_STYLE"')
    .replace(
      'src="/assets/storefront.js"',
      `src="data:text/javascript;base64,${toBase64(STOREFRONT_RUNTIME_JS)}"`,
    )
    .replace(
      "data:text/css;base64,PREVIEW_STYLE",
      `data:text/css;base64,${toBase64(
        `${themeCss(project)}\n${previewModuleStyles(project)}\n${STOREFRONT_RUNTIME_CSS}`,
      )}`,
    );
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

export function createProjectArchive(projectInput: StoreProjectV1): Uint8Array {
  const project = parseProject(projectInput, "crear el archivo del proyecto");
  const files = new Map<string, string | Uint8Array>([
    [
      "manifest.json",
      JSON.stringify({
        format: "solara-project",
        version: 2,
        projectId: project.id,
        exportedAt: new Date().toISOString(),
      }),
    ],
    ["project.json", JSON.stringify(project, null, 2)],
  ]);
  project.assets.forEach((asset) => {
    const bytes = dataUrlBytes(asset.source);
    if (bytes) files.set(`assets/${asset.hash}.${assetExtension(asset)}`, bytes);
  });
  project.videos.forEach((video) => {
    const bytes = dataUrlBytes(video.source);
    if (bytes) files.set(`assets/${video.hash}.${assetExtension(video)}`, bytes);
  });
  return zipFiles(files);
}

export function readProjectArchive(archive: Uint8Array): StoreProjectV1 {
  const files = unzipSync(archive);
  const manifestBytes = files["manifest.json"];
  const projectBytes = files["project.json"];
  if (!manifestBytes || !projectBytes)
    throw new Error("El archivo no contiene manifest.json y project.json.");
  let manifest: { format?: string; version?: number };
  try {
    manifest = JSON.parse(decoder.decode(manifestBytes)) as { format?: string; version?: number };
  } catch {
    throw new Error("El manifest del respaldo está corrupto.");
  }
  if (manifest.format !== "solara-project" || manifest.version !== 2) {
    throw new Error(
      "Este respaldo pertenece a una versión anterior. Conservá el ZIP original y creá una nueva tienda con el sistema actual.",
    );
  }
  return StoreProjectV1Schema.parse(JSON.parse(decoder.decode(projectBytes)));
}
