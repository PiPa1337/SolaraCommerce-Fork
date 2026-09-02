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
import {
  compactResponsiveSources,
  RESPONSIVE_IMAGE_INTERMEDIATE_WIDTH,
} from "@solara/project-schema";
import { formatPrice } from "@solara/project-schema/money";
import type { ZodType } from "zod";

declare const safeHtmlBrand: unique symbol;

export type SafeHtml = string & { readonly [safeHtmlBrand]: true };

export type ModuleSlot = StoreSection["slot"];

export type ModuleFamily = "legacy-editorial-v1" | "catalog-modern-v1" | "catalog-modern-v2";
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

export interface ModuleManifest<Id extends string = string> {
  id: Id;
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
  /** Presente sólo en el preview del editor; el export público nunca lo setea. */
  canvas?: CanvasEditorContext;
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

export interface ModuleDefinition<Id extends string = string, Settings = unknown> {
  manifest: ModuleManifest<Id>;
  settingsSchema: ZodType<Settings>;
  settingsFields: readonly SettingsFieldDefinition<Settings>[];
  motionZones: readonly MotionZoneDefinition[];
  /** Bindings declarativos de edición directa (Live Canvas). Vacío = módulo no
      editable en canvas (la UI muestra la razón, nunca selectores CSS). */
  canvasBindings?: readonly CanvasBinding[];
  render(context: RenderContext<Settings>): SafeHtml;
  clientAsset?: AssetId;
  styleAsset: AssetId;
}

export type CanvasCapability =
  | "edit-text"
  | "edit-rich-text"
  | "edit-image"
  | "edit-alt"
  | "edit-link"
  | "edit-number"
  | "toggle-boolean"
  | "edit-repeater-item"
  | "open-section-settings";

export type CanvasBindingSource =
  | { kind: "section-setting"; fieldKey: string }
  | { kind: "section-repeater-item"; fieldKey: string; itemFieldKey: string }
  | { kind: "identity"; field: keyof StoreProjectV1["identity"] }
  | {
      kind: "product";
      entityId: string;
      field: "title" | "description" | "richDescription" | "brand" | "imageIds" | "price";
    }
  | {
      kind: "category";
      entityId: string;
      field: "title" | "description" | "imageId";
    }
  | {
      kind: "collection";
      entityId: string;
      field: "title" | "description" | "imageId";
    }
  | { kind: "asset"; entityId: string; field: "name" | "alt" }
  | { kind: "public-copy"; group: string; field: string };

/** ID estable del item de repeater que el canvas debe enviar al padre. */
export function canvasRepeaterItemAttributes(
  context: CanvasEditorContext,
  bindingId: string,
  itemId: string,
): string {
  return context.editorMode
    ? ` data-canvas-edit="${canvasEditId(context, bindingId)}" data-canvas-item="${escapeAttribute(
        itemId,
      )}"`
    : "";
}

export interface CanvasBinding {
  id: string;
  label: string;
  kind: "text" | "rich-text" | "image" | "link" | "number" | "boolean" | "repeater-item";
  source: CanvasBindingSource;
  capabilities: readonly CanvasCapability[];
  multiline?: boolean;
  maxLength?: number;
}

export interface CanvasEditorContext {
  /** Sólo los renderers de Preview del editor lo activan; export público nunca. */
  editorMode: boolean;
  sectionId: string;
}

/** ID opaco y determinista por sección+binding; no revela paths internos. */
export function canvasEditId(context: CanvasEditorContext, bindingId: string): string {
  return `ce-${context.sectionId}-${bindingId}`;
}

/**
 * Builds the opaque DOM/manifest key for an entity binding. Entity IDs are
 * already constrained by StoreProjectV2; they are included only as an opaque
 * lookup key and never as a persisted path.
 */
export function canvasEntityEditId(
  sectionId: string,
  bindingId: string,
  entityKind: "identity" | "product" | "category" | "collection" | "asset" | "public-copy",
  entityId: string,
  field: string,
): string {
  return canvasEditId(
    { editorMode: true, sectionId },
    `${bindingId}-${entityKind}-${entityId}-${field}`,
  );
}

/** Atributos data-* que el bridge del canvas reconoce; vacío fuera del editor. */
export function canvasTextAttributes(
  context: CanvasEditorContext,
  bindingId: string,
  maxLength?: number,
): string {
  if (!context.editorMode) return "";
  const max = maxLength === undefined ? "" : ` data-canvas-maxlength="${maxLength}"`;
  return ` data-canvas-edit="${canvasEditId(context, bindingId)}"${max}`;
}

export function canvasImageAttributes(context: CanvasEditorContext, bindingId: string): string {
  return context.editorMode ? ` data-canvas-image="${canvasEditId(context, bindingId)}"` : "";
}

export function canvasEntityAttributes(
  context: CanvasEditorContext,
  bindingId: string,
  entityKind: "identity" | "product" | "category" | "collection" | "asset" | "public-copy",
  entityId: string,
  field: string,
  attributeKind: "text" | "image" = "text",
): string {
  if (!context.editorMode) return "";
  const editId = canvasEntityEditId(context.sectionId, bindingId, entityKind, entityId, field);
  const marker = attributeKind === "image" ? "data-canvas-image" : "data-canvas-edit";
  return ` ${marker}="${escapeAttribute(editId)}" data-canvas-entity-kind="${escapeAttribute(entityKind)}" data-canvas-entity-id="${escapeAttribute(entityId)}" data-canvas-field="${escapeAttribute(field)}"`;
}

export function canvasRepeaterAttributes(
  context: CanvasEditorContext,
  bindingId: string,
  itemId: string,
): string {
  return context.editorMode
    ? ` data-canvas-repeater="${canvasEditId(context, bindingId)}" data-canvas-item="${escapeAttribute(itemId)}"`
    : "";
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

/**
 * Ruta interna del sitio con la subcarpeta de la baseUrl prefijada cuando
 * existe (p.ej. baseUrl `https://dominio/tienda/` → `/tienda/productos/x/`).
 * Las URLs externas, anclas y rutas relativas pasan intactas por `safeUrl`.
 */
export function internalHref(project: StoreProjectV1, path: string): string {
  const candidate = safeUrl(path);
  if (!candidate.startsWith("/") || candidate.startsWith("//")) {
    return candidate;
  }
  try {
    const prefix = new URL(project.baseUrl).pathname.replace(/\/+$/, "");
    return prefix ? `${prefix}${candidate}` : candidate;
  } catch {
    return candidate;
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
  const caption = video.alt || options.fallbackAlt || video.name;
  const captions = `WEBVTT\n\n00:00:00.000 --> 99:59:59.000\n${caption}`;
  const captionsSource = `data:text/vtt;charset=utf-8,${encodeURIComponent(captions)}`;
  return safeHtml(
    `<video${className} width="${video.width}" height="${video.height}"${poster ? ` poster="${escapeAttribute(poster)}"` : ""} preload="${options.preload ?? "none"}" muted loop playsinline${autoplay} aria-label="${escapeAttribute(caption)}"><source src="${escapeAttribute(source)}" type="${escapeAttribute(video.mimeType)}"><track kind="captions" srclang="es" label="Español" src="${escapeAttribute(captionsSource)}"><span>${escapeHtml(caption)}</span></video>`,
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
  options: {
    tag?: "section" | "header" | "aside" | "footer";
    className?: string;
    ariaLabel?: string;
  } = {},
): SafeHtml {
  const tag = options.tag ?? "section";
  const className = options.className ? ` class="${escapeAttribute(options.className)}"` : "";
  const ariaLabel = options.ariaLabel ? ` aria-label="${escapeAttribute(options.ariaLabel)}"` : "";
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
    `<${tag} data-solara-module="${escapeAttribute(moduleId)}" data-solara-section="${escapeAttribute(section.id)}" ${motionAttributes}${className}${ariaLabel}>${content}</${tag}>`,
  );
}

export function formatMoney(
  amount: number,
  locale = "es-AR",
  currency = "ARS",
  priceFractionDisplay: "always" | "auto" = "always",
): string {
  return formatPrice(amount, { locale, currency, priceFractionDisplay });
}

export function formatMoneyForProject(
  amount: number,
  project: { locale: string; currency: string; priceFractionDisplay?: "always" | "auto" },
): string {
  return formatPrice(amount, {
    locale: project.locale,
    currency: project.currency,
    // El alias V1 no exponía este token en tipos antiguos, pero el renderer
    // debe conservarlo cuando llega desde un proyecto V2.
    // biome-ignore lint/suspicious/noExplicitAny: compatibilidad con snapshots V1 sin el campo tipado
    priceFractionDisplay: (project as any).priceFractionDisplay ?? "always",
  });
}

function canonicalImageMimeType(value: string | undefined): string | undefined {
  const normalized = value?.split(";", 1)[0]?.trim().toLowerCase();
  if (!normalized) return undefined;
  if (normalized === "image/jpg" || normalized === "image/pjpeg") return "image/jpeg";
  return normalized.startsWith("image/") ? normalized : undefined;
}

function imageMimeType(source: string, declaredMimeType?: string): string {
  const dataMime = canonicalImageMimeType(/^data:([^;,]+)/i.exec(source)?.[1]);
  if (dataMime) return dataMime;
  const extension = source.split(/[?#]/, 1)[0]?.split(".").pop()?.toLowerCase();
  if (extension === "jpg" || extension === "jpeg") return "image/jpeg";
  if (extension === "png") return "image/png";
  if (extension === "webp") return "image/webp";
  if (extension === "avif") return "image/avif";
  if (extension === "gif") return "image/gif";
  if (extension === "svg" || extension === "svgz") return "image/svg+xml";
  if (extension === "ico") return "image/x-icon";
  return canonicalImageMimeType(declaredMimeType) ?? "image/webp";
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
    responsiveMode?: "compact" | "cover";
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
  const primarySource = safeAssetUrl(asset.source, "");
  const primaryMime = imageMimeType(asset.source, asset.mimeType);
  const normalizedResponsive =
    primaryMime === "image/x-icon"
      ? asset.responsiveSources
      : compactResponsiveSources(asset.responsiveSources, asset.width, {
          width: asset.width,
          source: asset.source,
        });
  const responsiveEntries = (normalizedResponsive ?? [])
    .map((source) => {
      const safeSource = safeAssetUrl(source.source, "");
      return safeSource
        ? {
            mime: imageMimeType(source.source, asset.mimeType),
            source: safeSource,
            width: source.width,
          }
        : undefined;
    })
    .filter(
      (
        source,
      ): source is {
        mime: ReturnType<typeof imageMimeType>;
        source: string;
        width: number;
      } => Boolean(source),
    );
  const lowerCandidates = responsiveEntries.filter((source) => source.width < asset.width);
  const primaryMimeCandidates = lowerCandidates.filter((source) => source.mime === primaryMime);
  const intermediate = [
    ...(primaryMimeCandidates.length ? primaryMimeCandidates : lowerCandidates),
  ].sort((left, right) => {
    const distance =
      Math.abs(left.width - RESPONSIVE_IMAGE_INTERMEDIATE_WIDTH) -
      Math.abs(right.width - RESPONSIVE_IMAGE_INTERMEDIATE_WIDTH);
    return distance || right.width - left.width;
  })[0];
  const sourceBlocks: string[] = [];
  // Un hero 9:16 con object-fit: cover necesita la fuente completa: el navegador
  // calcula `sizes` contra la columna visible, pero la imagen se amplía por su
  // altura y una variante intermedia puede quedar pixelada.
  const useCoverSource = options.responsiveMode === "cover" && Boolean(primarySource);
  const mediaSources = useCoverSource
    ? [
        { mime: primaryMime, source: primarySource, width: asset.width },
        ...(intermediate && intermediate.mime !== primaryMime ? [intermediate] : []),
      ]
    : intermediate
      ? [intermediate]
      : [];
  for (const mediaSource of mediaSources) {
    sourceBlocks.push(
      `<source type="${mediaSource.mime}" media="(max-width: 1023px)" srcset="${escapeAttribute(mediaSource.source)} ${mediaSource.width}w"${sizes}>`,
    );
  }
  if (primarySource && (primarySource !== fallbackSource || intermediate)) {
    sourceBlocks.push(
      `<source type="${primaryMime}" srcset="${escapeAttribute(primarySource)} ${asset.width}w"${sizes}>`,
    );
  }
  const responsiveSources = sourceBlocks.join("");
  const image = `<img${className} src="${escapeAttribute(fallbackSource)}" alt="${escapeAttribute(asset.alt || options.fallbackAlt || "")}" width="${asset.width}" height="${asset.height}" loading="${options.loading ?? "lazy"}"${fetchPriority}${decoding}${sizes}>`;
  if (responsiveSources) {
    return safeHtml(`<picture>${responsiveSources}${image}</picture>`);
  }
  return safeHtml(image);
}
