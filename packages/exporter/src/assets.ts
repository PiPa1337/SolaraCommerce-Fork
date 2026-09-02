/**
 * Helpers de assets: lookup con caché, URLs de imagen/video y rutas de
 * producto. Extraídos de index.ts como parte de la división por
 * responsabilidad (2026-08-21).
 */
import type {
  ImageAsset,
  Product,
  StoreProjectV1,
  Variant,
  VideoAsset,
} from "@solara/project-schema";
import { isCatalogModernPlaceholderAsset } from "@solara/project-schema";

export function assetExtension(asset: ImageAsset | VideoAsset): string {
  const mimeType =
    asset.kind === "image"
      ? imageMimeTypeFromSource(asset.source, asset.mimeType)
      : canonicalMimeType(asset.mimeType);
  const extension = mimeTypeExtension(mimeType);
  return extension || "bin";
}

export function mimeTypeExtension(mimeType: string | undefined): string | undefined {
  const subtype = mimeType?.split("/")[1]?.split(";")[0]?.toLowerCase();
  if (!subtype) return undefined;
  if (subtype === "jpeg") return "jpg";
  if (subtype === "svg+xml") return "svg";
  if (subtype === "x-icon" || subtype === "vnd.microsoft.icon") return "ico";
  return /^[a-z0-9]+$/.test(subtype) ? subtype : undefined;
}

const imageLookupCache = new WeakMap<object, ReadonlyMap<string, ImageAsset>>();
const videoLookupCache = new WeakMap<object, ReadonlyMap<string, VideoAsset>>();

export function imageFor(
  project: StoreProjectV1,
  assetId: string | undefined,
): ImageAsset | undefined {
  if (!assetId) return undefined;
  let lookup = imageLookupCache.get(project);
  if (!lookup) {
    lookup = new Map(project.assets.map((asset) => [asset.id, asset]));
    imageLookupCache.set(project, lookup);
  }
  return lookup.get(assetId);
}

export function imageUrl(project: StoreProjectV1, assetId: string | undefined): string | undefined {
  const asset = imageFor(project, assetId);
  if (!asset) return undefined;
  if (/^data:/i.test(asset.source)) return `/assets/${asset.hash}.${assetExtension(asset)}`;
  return asset.source;
}

export interface ParsedDataUrl {
  mimeType?: string;
  bytes: Uint8Array;
}

/**
 * Cache de data URLs decodificadas. La misma imagen se consulta muchas veces
 * por exportación (extensión, MIME real, escritura del archivo) y decodificar
 * el base64 completo por consulta era el coste dominante de exportar y auditar.
 * Los bytes decodificados nunca se mutan; el tope acota la memoria del worker.
 */
const dataUrlCache = new Map<string, ParsedDataUrl | undefined>();
const dataUrlCacheMaxBytes = 64 * 1024 * 1024;
let dataUrlCacheBytes = 0;

function rememberParsedDataUrl(source: string, parsed: ParsedDataUrl | undefined): void {
  const previous = dataUrlCache.get(source);
  if (previous) dataUrlCacheBytes -= previous.bytes.byteLength;
  dataUrlCache.set(source, parsed);
  if (parsed) dataUrlCacheBytes += parsed.bytes.byteLength;
  while (dataUrlCacheBytes > dataUrlCacheMaxBytes) {
    const oldest = dataUrlCache.keys().next();
    if (oldest.done) break;
    const evicted = dataUrlCache.get(oldest.value);
    dataUrlCache.delete(oldest.value);
    if (evicted) dataUrlCacheBytes -= evicted.bytes.byteLength;
  }
}

function decodeBase64Payload(payload: string): Uint8Array | undefined {
  // Buffer prioriza la ruta nativa de Node (el exporter también corre allí);
  // fromBase64 cubre navegadores recientes y atob+loop el resto.
  if (typeof Buffer !== "undefined") {
    return Buffer.from(payload, "base64");
  }
  const fromBase64 = (
    Uint8Array as unknown as {
      fromBase64?: (input: string) => Uint8Array;
    }
  ).fromBase64;
  if (typeof fromBase64 === "function") {
    return fromBase64(payload);
  }
  if (typeof atob === "function") {
    const binary = atob(payload);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }
    return bytes;
  }
  return undefined;
}

function computeParsedDataUrl(source: string): ParsedDataUrl | undefined {
  if (!/^data:/i.test(source)) return undefined;
  const comma = source.indexOf(",");
  if (comma < 5) return undefined;
  const header = source.slice(5, comma);
  const tokens = header.split(";");
  const rawMimeType = tokens.shift()?.trim();
  const mimeType = rawMimeType?.includes("/") ? rawMimeType.toLowerCase() : undefined;
  const isBase64 = tokens.some((token) => token.trim().toLowerCase() === "base64");
  const rawPayload = source.slice(comma + 1);
  // El percent-decoding sólo puede cambiar el payload cuando hay '%'; saltarlo
  // evita escanear y copiar payloads base64 de megabytes en cada consulta.
  let payload = rawPayload;
  if (rawPayload.includes("%")) {
    try {
      payload = decodeURIComponent(rawPayload);
    } catch {
      return undefined;
    }
  }
  if (isBase64) {
    const normalizedPayload = payload.replace(/\s/g, "");
    if (!/^[A-Za-z0-9+/]*={0,2}$/.test(normalizedPayload) || normalizedPayload.length % 4 === 1) {
      return undefined;
    }
    try {
      const bytes = decodeBase64Payload(normalizedPayload);
      if (bytes) return { ...(mimeType ? { mimeType } : {}), bytes };
    } catch {
      return undefined;
    }
    return undefined;
  }
  return {
    ...(mimeType ? { mimeType } : {}),
    bytes: new TextEncoder().encode(payload),
  };
}

/**
 * Decodifica data URLs con parámetros, base64 y payloads percent-encoded. El
 * exporter y sus validaciones deben interpretar una URL exactamente igual.
 */
export function parseDataUrl(source: string): ParsedDataUrl | undefined {
  if (dataUrlCache.has(source)) {
    const cached = dataUrlCache.get(source);
    if (cached) {
      // Refrescar recencia para que la política de expulsión sea LRU real.
      dataUrlCache.delete(source);
      dataUrlCache.set(source, cached);
    }
    return cached;
  }
  const parsed = computeParsedDataUrl(source);
  rememberParsedDataUrl(source, parsed);
  return parsed;
}

function ascii(bytes: Uint8Array, start: number, length: number): string {
  return String.fromCharCode(...bytes.subarray(start, start + length));
}

/** Detecta el formato real de los binarios que el exportador va a escribir. */
export function imageMimeTypeFromBytes(bytes: Uint8Array | undefined): string | undefined {
  if (!bytes || bytes.length === 0) return undefined;
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return "image/png";
  }
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }
  if (bytes.length >= 6 && (ascii(bytes, 0, 6) === "GIF87a" || ascii(bytes, 0, 6) === "GIF89a")) {
    return "image/gif";
  }
  if (
    bytes.length >= 4 &&
    bytes[0] === 0x00 &&
    bytes[1] === 0x00 &&
    (bytes[2] === 0x01 || bytes[2] === 0x02) &&
    bytes[3] === 0x00
  ) {
    return "image/x-icon";
  }
  if (bytes.length >= 12 && ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 4) === "WEBP") {
    return "image/webp";
  }
  if (bytes.length >= 12 && ascii(bytes, 4, 4) === "ftyp") {
    const brands = [ascii(bytes, 8, 4)];
    for (let offset = 16; offset + 4 <= Math.min(bytes.length, 256); offset += 4) {
      brands.push(ascii(bytes, offset, 4));
    }
    if (brands.some((brand) => brand === "avif" || brand === "avis")) return "image/avif";
  }
  const text = new TextDecoder()
    .decode(bytes.subarray(0, 1024))
    .replace(/^\uFEFF/, "")
    .trimStart();
  if (/^<svg(?:\s|>)/i.test(text) || (/^<\?xml/i.test(text) && /<svg(?:\s|>)/i.test(text))) {
    return "image/svg+xml";
  }
  return undefined;
}

export type SocialImageFormat = "compatible" | "incompatible" | "unknown";
export type SocialImageMimeType = string;

export interface SocialImageDiagnostic {
  assetId?: string;
  status: Exclude<SocialImageFormat, "compatible"> | "missing";
}

export interface SocialImageResolution {
  asset?: ImageAsset;
  source?: string;
  mimeType?: SocialImageMimeType;
  kind?: "primary" | "fallback";
  status: "resolved" | "missing" | "incompatible" | "unknown";
  diagnostics: readonly SocialImageDiagnostic[];
}

export interface SocialImageResolutionOptions {
  /** Assets que pueden usarse como fallback implícito. */
  allowedAssetIds?: ReadonlySet<string>;
  /** Formato comprobado antes de convertir data URLs a rutas públicas. */
  compatibilityByAssetId?: ReadonlyMap<string, SocialImageFormat>;
}

function canonicalMimeType(mimeType: string | undefined): string | undefined {
  const normalized = mimeType?.split(";")[0]?.trim().toLowerCase();
  if (!normalized) return undefined;
  if (normalized === "image/jpg" || normalized === "image/pjpeg") return "image/jpeg";
  return normalized;
}

function extensionFromReference(value: string): string | undefined {
  try {
    const pathname = new URL(value, "https://solara.invalid/").pathname;
    return /\.([a-z0-9]+)$/i.exec(pathname)?.[1]?.toLowerCase();
  } catch {
    return /\.([a-z0-9]+)$/i.exec(value)?.[1]?.toLowerCase();
  }
}

function mimeTypeFromExtension(extension: string | undefined): string | undefined {
  if (!extension) return undefined;
  if (extension === "jpg" || extension === "jpeg") return "image/jpeg";
  if (extension === "png") return "image/png";
  if (extension === "webp") return "image/webp";
  if (extension === "avif") return "image/avif";
  if (extension === "gif") return "image/gif";
  if (extension === "svg" || extension === "svgz") return "image/svg+xml";
  if (extension === "ico") return "image/x-icon";
  return undefined;
}

/** MIME efectivo: bytes reales para data URLs, extensión para rutas y luego declaración. */
export function imageMimeTypeFromSource(
  source: string,
  declaredMimeType?: string,
): string | undefined {
  const dataUrl = parseDataUrl(source);
  if (dataUrl) {
    return canonicalMimeType(
      imageMimeTypeFromBytes(dataUrl.bytes) ?? dataUrl.mimeType ?? declaredMimeType,
    );
  }
  return canonicalMimeType(
    mimeTypeFromExtension(extensionFromReference(source)) ?? declaredMimeType,
  );
}

export function imageExtensionFromSource(source: string, fallback?: string): string | undefined {
  return mimeTypeExtension(imageMimeTypeFromSource(source)) ?? fallback;
}

/** Reescribe sólo el MIME de un data URL cuando su firma binaria demuestra otro formato. */
export function normalizeDataUrlMimeType(source: string): string {
  const dataUrl = parseDataUrl(source);
  const actualMimeType = imageMimeTypeFromBytes(dataUrl?.bytes);
  if (!dataUrl || !actualMimeType || dataUrl.mimeType === actualMimeType) return source;
  const comma = source.indexOf(",");
  if (comma < 5) return source;
  const tokens = source.slice(5, comma).split(";");
  if (tokens[0]?.includes("/")) tokens[0] = actualMimeType;
  else tokens.unshift(actualMimeType);
  return `data:${tokens.join(";")},${source.slice(comma + 1)}`;
}

function sourceFormat(
  source: string,
  declaredMimeType?: string,
): {
  format: SocialImageFormat;
  mimeType?: string;
} {
  if (/^data:/i.test(source)) {
    const dataUrl = parseDataUrl(source);
    const declared = canonicalMimeType(dataUrl?.mimeType ?? declaredMimeType);
    const actual = imageMimeTypeFromBytes(dataUrl?.bytes);
    if (!dataUrl || !actual) {
      return { format: "unknown", ...(declared ? { mimeType: declared } : {}) };
    }
    return {
      format: actual === "image/jpeg" || actual === "image/png" ? "compatible" : "incompatible",
      mimeType: actual,
    };
  }
  const mimeType = imageMimeTypeFromSource(source, declaredMimeType);
  if (!mimeType) return { format: "unknown" };
  return {
    format: mimeType === "image/jpeg" || mimeType === "image/png" ? "compatible" : "incompatible",
    mimeType,
  };
}

function normalizeReference(project: StoreProjectV1, value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return trimmed;
  if (/^data:/i.test(trimmed)) return normalizeDataUrlMimeType(trimmed);
  try {
    const base = `${project.baseUrl.replace(/\/+$/, "")}/`;
    const url = new URL(trimmed, base);
    url.hash = "";
    url.search = "";
    return url.href;
  } catch {
    return trimmed.replace(/[?#].*$/, "");
  }
}

function imageByReference(project: StoreProjectV1, value: string): ImageAsset | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const byId = imageFor(project, trimmed);
  if (byId) return byId;
  const normalized = normalizeReference(project, trimmed);
  return project.assets.find((asset) =>
    [asset.source, asset.fallbackSource, imageUrl(project, asset.id)]
      .filter((candidate): candidate is string => Boolean(candidate))
      .some((candidate) => normalizeReference(project, candidate) === normalized),
  );
}

function socialSourceForAsset(
  asset: ImageAsset,
): { source: string; kind: "primary" | "fallback"; mimeType: SocialImageMimeType } | undefined {
  const fallback = asset.fallbackSource
    ? sourceFormat(asset.fallbackSource)
    : { format: "unknown" as const };
  if (fallback.format === "compatible") {
    return {
      source: asset.fallbackSource as string,
      kind: "fallback",
      mimeType: fallback.mimeType as SocialImageMimeType,
    };
  }
  const primary = sourceFormat(asset.source, asset.mimeType);
  if (primary.format === "compatible") {
    return {
      source: asset.source,
      kind: "primary",
      mimeType: primary.mimeType as SocialImageMimeType,
    };
  }
  return undefined;
}

function imageSourceForAsset(
  asset: ImageAsset,
): { source: string; kind: "primary" | "fallback"; mimeType: SocialImageMimeType } | undefined {
  const candidates = [
    asset.fallbackSource ? { source: asset.fallbackSource, kind: "fallback" as const } : undefined,
    { source: asset.source, kind: "primary" as const },
  ];
  for (const candidate of candidates) {
    if (!candidate) continue;
    const resolved = sourceFormat(
      candidate.source,
      candidate.kind === "primary" ? asset.mimeType : undefined,
    );
    if (resolved.format !== "unknown" && resolved.mimeType) {
      return { ...candidate, mimeType: resolved.mimeType };
    }
  }
  return undefined;
}

/** Indica si un asset puede producir una portada JPG/PNG para redes sociales. */
export function socialImageCompatibility(asset: ImageAsset): SocialImageFormat {
  const candidate = socialSourceForAsset(asset);
  if (candidate) return "compatible";
  const fallback = asset.fallbackSource ? sourceFormat(asset.fallbackSource).format : undefined;
  const primary = sourceFormat(asset.source, asset.mimeType).format;
  return fallback === "unknown" || primary === "unknown" ? "unknown" : "incompatible";
}

export function socialImageCompatibilityByAssetId(
  project: StoreProjectV1,
): ReadonlyMap<string, SocialImageFormat> {
  return new Map(
    project.assets.map((asset) => [asset.id, socialImageCompatibility(asset)] as const),
  );
}

/**
 * Resolver único de portada social. Las imágenes AVIF/WebP siguen siendo
 * válidas para el storefront; si no existe un JPG/PNG verificable, se usa la
 * mejor imagen conocida para no dejar metadata social rota.
 */
export function resolveSocialImage(
  project: StoreProjectV1,
  pageImage?: string,
  options: SocialImageResolutionOptions = {},
): SocialImageResolution {
  const diagnostics: SocialImageDiagnostic[] = [];
  const visited = new Set<string>();
  let fallbackResolution: SocialImageResolution | undefined;
  let hasUnknown = false;
  let hasIncompatible = false;

  const note = (assetId: string | undefined, status: SocialImageDiagnostic["status"]): void => {
    if (status === "unknown") hasUnknown = true;
    if (status === "incompatible") hasIncompatible = true;
    diagnostics.push({ ...(assetId ? { assetId } : {}), status });
  };

  const evaluate = (asset: ImageAsset): SocialImageResolution | undefined => {
    if (visited.has(asset.id)) return undefined;
    visited.add(asset.id);
    const knownCompatibility = options.compatibilityByAssetId?.get(asset.id);
    // A data URL becomes a public path before the final render. Preserve the
    // original byte verdict so an invalid source cannot look valid merely
    // because its generated path ends in .jpg or .png.
    const candidate = knownCompatibility === "unknown" ? undefined : socialSourceForAsset(asset);
    if (candidate) {
      return { ...candidate, asset, status: "resolved", diagnostics };
    }
    const bestAvailable = knownCompatibility === "unknown" ? undefined : imageSourceForAsset(asset);
    if (bestAvailable && !fallbackResolution) {
      fallbackResolution = {
        ...bestAvailable,
        asset,
        status: "resolved",
        diagnostics,
      };
    }
    const status =
      knownCompatibility === "compatible" ? "unknown" : socialImageCompatibility(asset);
    if (status !== "compatible") note(asset.id, status);
    return undefined;
  };

  if (pageImage) {
    const pageAsset = imageByReference(project, pageImage);
    if (pageAsset) {
      const resolved = evaluate(pageAsset);
      if (resolved) return resolved;
    } else {
      const direct = sourceFormat(pageImage);
      if (direct.format === "compatible" && /^https?:\/\//i.test(pageImage)) {
        return {
          source: pageImage,
          mimeType: direct.mimeType as SocialImageMimeType,
          status: "resolved",
          diagnostics,
        };
      }
      if (/^https?:\/\//i.test(pageImage) && direct.mimeType && !fallbackResolution) {
        fallbackResolution = {
          source: pageImage,
          mimeType: direct.mimeType,
          status: "resolved",
          diagnostics,
        };
      }
      if (direct.format !== "compatible") note(undefined, direct.format);
    }
  }

  if (project.seo.socialImageId) {
    const selectedAsset = imageFor(project, project.seo.socialImageId);
    if (selectedAsset) {
      const resolved = evaluate(selectedAsset);
      if (resolved) return resolved;
    } else {
      diagnostics.push({ assetId: project.seo.socialImageId, status: "missing" });
    }
  }

  for (const asset of project.assets) {
    if (isCatalogModernPlaceholderAsset(project, asset)) continue;
    if (options.allowedAssetIds && !options.allowedAssetIds.has(asset.id)) continue;
    const resolved = evaluate(asset);
    if (resolved) return resolved;
  }

  if (fallbackResolution) return fallbackResolution;

  return {
    status: hasUnknown ? "unknown" : hasIncompatible ? "incompatible" : "missing",
    diagnostics,
  };
}

/**
 * Las tarjetas sociales prefieren el fallback editorial del asset cuando es
 * compatible, pero conservan una imagen conocida si la tienda no tiene otro
 * formato disponible.
 */
export function socialImageValue(
  project: StoreProjectV1,
  value: string | undefined,
): string | undefined {
  if (!value) return undefined;
  const asset = imageByReference(project, value);
  const source = asset
    ? (socialSourceForAsset(asset) ?? imageSourceForAsset(asset))?.source
    : sourceFormat(value).format === "compatible" && /^https?:\/\//i.test(value)
      ? value
      : undefined;
  return source ? normalizeDataUrlMimeType(source) : undefined;
}

export function videoFor(
  project: StoreProjectV1,
  assetId: string | undefined,
): VideoAsset | undefined {
  if (!assetId) return undefined;
  let lookup = videoLookupCache.get(project);
  if (!lookup) {
    lookup = new Map(project.videos.map((video) => [video.id, video]));
    videoLookupCache.set(project, lookup);
  }
  return lookup.get(assetId);
}

export function videoUrl(project: StoreProjectV1, assetId: string | undefined): string | undefined {
  const asset = videoFor(project, assetId);
  if (!asset) return undefined;
  if (/^data:/i.test(asset.source)) return `/assets/${asset.hash}.${assetExtension(asset)}`;
  return asset.source;
}

export function productImagePaths(
  project: StoreProjectV1,
  product: Product,
  variant?: Variant,
): string[] {
  const ids = [variant?.imageId, ...product.imageIds].filter((id): id is NonNullable<typeof id> =>
    Boolean(id),
  );
  return [...new Set(ids)]
    .map((assetId) => imageUrl(project, assetId))
    .filter((url): url is string => Boolean(url));
}
