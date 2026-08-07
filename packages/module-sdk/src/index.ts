/**
 * SDK seguro de módulos. Define manifest, settings, metadata del inspector y
 * helpers de escape/URLs/assets; los módulos devuelven SafeHtml y no ejecutan
 * código arbitrario del usuario dentro del exporter.
 */
import type {
  AssetId,
  Category,
  Collection,
  Product,
  StoreProjectV1,
  StoreSection,
  VideoAsset,
} from "@solara/project-schema";
import type { ZodType } from "zod";

declare const safeHtmlBrand: unique symbol;

export type SafeHtml = string & { readonly [safeHtmlBrand]: true };

export type ModuleSlot = StoreSection["slot"];

export type ModuleFamily = "legacy-editorial-v1" | "catalog-modern-v1";
export type ModuleAvailability = "default" | "compatibility-only";

export type RenderPageType =
  | "home"
  | "category"
  | "collection"
  | "product"
  | "content"
  | "about"
  | "contact"
  | "search"
  | "cart"
  | "checkout";

export interface ModuleManifest {
  id: string;
  name: string;
  description: string;
  version: 1;
  slots: readonly ModuleSlot[];
  compatibleSettings: readonly string[];
  /** Omitted by pre-catalog modules; the registry treats those as Legacy. */
  family?: ModuleFamily;
  /** Omitted by pre-catalog modules; the registry treats those as compatibility-only. */
  availability?: ModuleAvailability;
}

export interface MotionZoneDefinition {
  id: string;
  label: string;
  selector: string;
  allowedPresets: readonly (
    | "none"
    | "fade"
    | "fade-up"
    | "slide"
    | "scale"
    | "stagger"
    | "parallax"
    | "scroll-progress"
    | "layer-stack"
  )[];
}

export interface RenderContext<Settings> {
  project: StoreProjectV1;
  section: StoreSection;
  settings: Settings;
  pageType: RenderPageType;
  product?: Product;
  category?: Category;
  collection?: Collection;
  products?: readonly Product[];
}

interface SettingsFieldBase<Settings> {
  key: Extract<keyof Settings, string>;
  label: string;
  description?: string;
}

export interface RepeaterItemField {
  key: string;
  label: string;
  type: "text" | "rich-text" | "url" | "asset" | "number" | "boolean" | "select";
  options?: readonly { value: string; label: string }[];
  min?: number;
  max?: number;
  step?: number;
}

export type SettingsFieldDefinition<Settings> =
  | (SettingsFieldBase<Settings> & {
      type: "text" | "rich-text" | "url" | "asset" | "array";
      placeholder?: string;
    })
  | (SettingsFieldBase<Settings> & {
      type: "number";
      min?: number;
      max?: number;
      step?: number;
    })
  | (SettingsFieldBase<Settings> & {
      type: "boolean";
    })
  | (SettingsFieldBase<Settings> & {
      type: "select";
      options: readonly { value: string; label: string }[];
    })
  | (SettingsFieldBase<Settings> & {
      type: "repeater";
      minItems?: number;
      maxItems?: number;
      itemLabelKey?: string;
      fields: readonly RepeaterItemField[];
    });

export interface ModuleDefinition<Settings> {
  manifest: ModuleManifest;
  settingsSchema: ZodType<Settings>;
  settingsFields: readonly SettingsFieldDefinition<Settings>[];
  motionZones: readonly MotionZoneDefinition[];
  render(context: RenderContext<Settings>): SafeHtml;
  clientAsset?: AssetId;
  styleAsset: AssetId;
}

export function safeHtml(value: string): SafeHtml {
  return value as SafeHtml;
}

export function joinHtml(
  parts: readonly (SafeHtml | string | false | null | undefined)[],
): SafeHtml {
  return safeHtml(parts.filter((part) => part !== false && part != null).join(""));
}

export function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function escapeAttribute(value: unknown): string {
  return escapeHtml(value).replaceAll("`", "&#96;");
}

const SAFE_PROTOCOLS = new Set(["http:", "https:", "mailto:", "tel:"]);

export function safeUrl(value: unknown, fallback = "#"): string {
  const candidate = String(value ?? "").trim();
  if (
    (candidate.startsWith("/") && !candidate.startsWith("//")) ||
    candidate.startsWith("#") ||
    candidate.startsWith("./") ||
    candidate.startsWith("../")
  ) {
    return candidate;
  }

  try {
    const parsed = new URL(candidate);
    return SAFE_PROTOCOLS.has(parsed.protocol) ? candidate : fallback;
  } catch {
    return fallback;
  }
}

export function safeAssetUrl(value: unknown, fallback = ""): string {
  const candidate = String(value ?? "").trim();
  if (candidate.startsWith("blob:")) {
    return candidate;
  }
  if (
    /^data:(?:image|video)\/(?:avif|gif|jpeg|jpg|png|webp|mp4|webm);base64,[a-z0-9+/=\s]+$/i.test(
      candidate,
    )
  ) {
    return candidate;
  }
  return safeUrl(candidate, fallback);
}

export function findAsset(project: StoreProjectV1, assetId?: AssetId | string) {
  return assetId ? project.assets.find((asset) => asset.id === assetId) : undefined;
}

export function assetUrl(
  project: StoreProjectV1,
  assetId?: AssetId | string,
  fallback = "",
): string {
  const source = findAsset(project, assetId)?.source;
  return source ? safeAssetUrl(source, fallback) : fallback;
}

export function findVideo(
  project: StoreProjectV1,
  assetId?: AssetId | string,
): VideoAsset | undefined {
  return assetId ? project.videos.find((video) => video.id === assetId) : undefined;
}

export function videoUrl(
  project: StoreProjectV1,
  assetId?: AssetId | string,
  fallback = "",
): string {
  const source = findVideo(project, assetId)?.source;
  return source ? safeAssetUrl(source, fallback) : fallback;
}

export function renderVideo(
  project: StoreProjectV1,
  assetId: AssetId | string | undefined,
  options: {
    className?: string;
    posterAssetId?: AssetId | string;
    preload?: "none" | "metadata" | "auto";
    autoplay?: boolean;
    fallbackAlt?: string;
  } = {},
): SafeHtml {
  const video = findVideo(project, assetId);
  if (!video) return safeHtml("");
  const className = options.className ? ` class="${escapeAttribute(options.className)}"` : "";
  const poster = assetUrl(project, options.posterAssetId ?? video.posterAssetId, "");
  const source = safeAssetUrl(video.source, "");
  if (!source) return safeHtml("");
  const autoplay = options.autoplay === false ? "" : " autoplay";
  return safeHtml(
    `<video${className} width="${video.width}" height="${video.height}"${poster ? ` poster="${escapeAttribute(poster)}"` : ""} preload="${options.preload ?? "none"}" muted loop playsinline${autoplay} aria-label="${escapeAttribute(video.alt || options.fallbackAlt || video.name)}"><source src="${escapeAttribute(source)}" type="${escapeAttribute(video.mimeType)}"><span>${escapeHtml(video.alt || options.fallbackAlt || video.name)}</span></video>`,
  );
}

const ALLOWED_RICH_TAGS = new Set([
  "p",
  "br",
  "strong",
  "em",
  "ul",
  "ol",
  "li",
  "a",
  "h2",
  "h3",
  "blockquote",
]);

function sanitizeTag(source: string): string {
  const match = source.match(/^<\s*(\/?)\s*([a-zA-Z0-9-]+)([^>]*)>$/);
  if (!match) {
    return "";
  }

  const closing = match[1] === "/";
  const tag = (match[2] ?? "").toLowerCase();
  const attributes = match[3] ?? "";
  if (!ALLOWED_RICH_TAGS.has(tag)) {
    return "";
  }

  if (closing) {
    return tag === "br" ? "" : `</${tag}>`;
  }

  if (tag !== "a") {
    return tag === "br" ? "<br>" : `<${tag}>`;
  }

  const hrefMatch = attributes.match(/\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/i);
  const href = safeUrl(hrefMatch?.[1] ?? hrefMatch?.[2] ?? hrefMatch?.[3] ?? "", "#");
  const external = href.startsWith("http://") || href.startsWith("https://");
  const externalAttributes = external ? ' target="_blank" rel="noopener noreferrer"' : "";
  return `<a href="${escapeAttribute(href)}"${externalAttributes}>`;
}

export function sanitizeRichText(value: unknown): SafeHtml {
  const source = String(value ?? "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(
      /<\s*(script|style|iframe|object|embed|svg|math|template)\b[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi,
      "",
    );
  const output: string[] = [];
  let cursor = 0;

  for (const match of source.matchAll(/<[^>]*>/g)) {
    const index = match.index ?? cursor;
    output.push(escapeHtml(source.slice(cursor, index)));
    output.push(sanitizeTag(match[0]));
    cursor = index + match[0].length;
  }

  output.push(escapeHtml(source.slice(cursor)));
  return safeHtml(output.join(""));
}

export function moduleRoot(
  moduleId: string,
  section: StoreSection,
  content: SafeHtml | string,
  options: { tag?: "section" | "header" | "aside" | "footer"; className?: string } = {},
): SafeHtml {
  const tag = options.tag ?? "section";
  const className = options.className ? ` class="${escapeAttribute(options.className)}"` : "";
  const motion = section.motion;
  const motionAttributes = [
    'data-motion-root="true"',
    `data-motion-preset="${escapeAttribute(motion.preset)}"`,
    `data-motion-once="${String(motion.once)}"`,
    `data-motion-direction="${escapeAttribute(motion.direction)}"`,
    `data-motion-intensity="${motion.intensity / 10}"`,
    `data-motion-entry="${motion.entryPoint}"`,
    `data-motion-distance="${motion.distance}"`,
    `style="--motion-distance:${motion.distance}px;--motion-duration:${motion.duration * 1000}ms;--motion-delay:${motion.delay * 1000}ms;--motion-stagger:${motion.stagger * 1000}ms;--motion-intensity:${motion.intensity / 10};--motion-entry:${motion.entryPoint};--motion-easing:${escapeAttribute(motion.easing)}"`,
  ].join(" ");
  return safeHtml(
    `<${tag} data-solara-module="${escapeAttribute(moduleId)}" data-solara-section="${escapeAttribute(section.id)}" ${motionAttributes}${className}>${content}</${tag}>`,
  );
}

export function formatMoney(amount: number, locale = "es-AR", currency = "ARS"): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(amount / 100);
}

function imageMimeType(source: string): "image/webp" | "image/jpeg" | "image/png" {
  const dataMime = /^data:(image\/(?:webp|jpeg|png));/i.exec(source)?.[1]?.toLowerCase();
  if (dataMime === "image/jpeg" || dataMime === "image/png" || dataMime === "image/webp") {
    return dataMime;
  }
  const extension = source.split(/[?#]/, 1)[0]?.split(".").pop()?.toLowerCase();
  if (extension === "jpg" || extension === "jpeg") return "image/jpeg";
  if (extension === "png") return "image/png";
  return "image/webp";
}

export function renderImage(
  project: StoreProjectV1,
  assetId: AssetId | string | undefined,
  options: {
    className?: string;
    loading?: "eager" | "lazy";
    fetchPriority?: "high" | "low" | "auto";
    decoding?: "async" | "sync" | "auto";
    sizes?: string;
    fallbackAlt?: string;
  } = {},
): SafeHtml {
  const asset = findAsset(project, assetId);
  if (!asset) {
    return safeHtml("");
  }

  const className = options.className ? ` class="${escapeAttribute(options.className)}"` : "";
  const sizes = options.sizes ? ` sizes="${escapeAttribute(options.sizes)}"` : "";
  const fetchPriority = options.fetchPriority
    ? ` fetchpriority="${escapeAttribute(options.fetchPriority)}"`
    : "";
  const decoding = ` decoding="${escapeAttribute(options.decoding ?? "async")}"`;
  const fallbackSource = safeAssetUrl(asset.fallbackSource ?? asset.source, "");
  const responsiveByMime = new Map<string, string[]>();
  asset.responsiveSources?.forEach((source) => {
    const safeSource = safeAssetUrl(source.source, "");
    if (!safeSource) return;
    const mime = imageMimeType(source.source);
    const entries = responsiveByMime.get(mime) ?? [];
    entries.push(`${escapeAttribute(safeSource)} ${source.width}w`);
    responsiveByMime.set(mime, entries);
  });
  const primarySource = safeAssetUrl(asset.source, "");
  const primaryMime = imageMimeType(asset.source);
  if (primarySource && primarySource !== fallbackSource && !responsiveByMime.has(primaryMime)) {
    responsiveByMime.set(primaryMime, [`${escapeAttribute(primarySource)} ${asset.width}w`]);
  }
  const responsiveSources = [...responsiveByMime.entries()]
    .sort(([left], [right]) => {
      if (left === "image/webp") return -1;
      if (right === "image/webp") return 1;
      return left.localeCompare(right);
    })
    .map(([mime, sources]) => `<source type="${mime}" srcset="${sources.join(", ")}"${sizes}>`)
    .join("");
  const image = `<img${className} src="${escapeAttribute(fallbackSource)}" alt="${escapeAttribute(asset.alt || options.fallbackAlt || "")}" width="${asset.width}" height="${asset.height}" loading="${options.loading ?? "lazy"}"${fetchPriority}${decoding}${sizes}>`;
  if (responsiveSources) {
    return safeHtml(`<picture>${responsiveSources}${image}</picture>`);
  }
  return safeHtml(image);
}
