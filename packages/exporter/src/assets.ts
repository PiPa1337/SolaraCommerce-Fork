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

export function assetExtension(asset: ImageAsset | VideoAsset): string {
  const extension = mimeTypeExtension(asset.mimeType);
  return extension || "bin";
}

export function mimeTypeExtension(mimeType: string | undefined): string | undefined {
  const subtype = mimeType?.split("/")[1]?.split(";")[0]?.toLowerCase();
  if (!subtype) return undefined;
  if (subtype === "jpeg") return "jpg";
  if (subtype === "x-icon" || subtype === "vnd.microsoft.icon") return "ico";
  return subtype;
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
  if (asset.source.startsWith("data:")) return `/assets/${asset.hash}.${assetExtension(asset)}`;
  return asset.source;
}

/**
 * Las tarjetas sociales necesitan un formato ampliamente aceptado por los
 * rastreadores. Mantener AVIF para el storefront, pero preferir el fallback
 * editorial del asset cuando existe.
 */
export function socialImageValue(
  project: StoreProjectV1,
  value: string | undefined,
): string | undefined {
  if (!value) return undefined;
  const asset = project.assets.find(
    (candidate) =>
      candidate.source === value ||
      candidate.fallbackSource === value ||
      imageUrl(project, candidate.id) === value,
  );
  return asset?.fallbackSource ?? value;
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
  if (asset.source.startsWith("data:")) return `/assets/${asset.hash}.${assetExtension(asset)}`;
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
