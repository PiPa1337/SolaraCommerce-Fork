import type { StoreProjectV1, StoreProjectV2, StoreSection, VideoAsset } from "./index";
import { StoreProjectV2Schema } from "./index";

export const BASE_TEMPLATE_STORE_ID = "store-modo-sur-demo";

export type StoreRole = "base-template" | "store";
export type StoreUpdatePolicy = "managed" | "pinned";

export interface StorePolicyMetadata {
  role: StoreRole;
  updatePolicy: StoreUpdatePolicy;
  legacy: boolean;
}

/**
 * Central policy used by Studio, the local server and the native agent. The
 * explicit role wins; the legacy fallback keeps old demo/placeholder projects
 * protected until they are rewritten with the new metadata.
 */
export function getStorePolicy(
  project: Pick<StoreProjectV1, "id" | "origin">,
  protectedStoreIds: Iterable<string> = [],
): StorePolicyMetadata {
  const explicit = new Set(protectedStoreIds);
  if (project.id === BASE_TEMPLATE_STORE_ID || explicit.has(project.id)) {
    return { role: "base-template", updatePolicy: "pinned", legacy: false };
  }
  if (project.origin?.role === "base-template") {
    return {
      role: "base-template",
      updatePolicy: project.origin.updatePolicy ?? "pinned",
      legacy: false,
    };
  }
  if (project.origin?.role === "store") {
    return {
      role: "store",
      updatePolicy: project.origin.updatePolicy ?? "managed",
      legacy: false,
    };
  }
  if (project.origin?.seed !== undefined && project.origin.seed !== "clean") {
    return { role: "base-template", updatePolicy: "pinned", legacy: true };
  }
  return { role: "store", updatePolicy: "managed", legacy: true };
}

export function isBaseTemplate(
  project: Pick<StoreProjectV1, "id" | "origin">,
  protectedStoreIds: Iterable<string> = [],
): boolean {
  return getStorePolicy(project, protectedStoreIds).role === "base-template";
}

export function isStoreMutable(
  project: Pick<StoreProjectV1, "id" | "origin">,
  protectedStoreIds: Iterable<string> = [],
): boolean {
  return !isBaseTemplate(project, protectedStoreIds);
}

type CloneProjectOptions = {
  id: string;
  name: string;
  slug: string;
  baseUrl?: string;
  brandName?: string;
  now?: string;
  idFactory?: (prefix: string, sourceId: string) => string;
};

function defaultIdFactory(prefix: string, sourceId: string): string {
  const suffix = sourceId.replace(/[^a-zA-Z0-9_-]/g, "-").slice(-24);
  const random = Math.random().toString(36).slice(2, 10);
  return `${prefix}-${suffix}-${random}`.slice(0, 96);
}

function remapValue(value: unknown, ids: ReadonlyMap<string, string>): unknown {
  if (typeof value === "string") return ids.get(value) ?? value;
  if (Array.isArray(value)) return value.map((item) => remapValue(item, ids));
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, remapValue(item, ids)]),
    );
  }
  return value;
}

function cloneEntityId(
  ids: Map<string, string>,
  factory: (prefix: string, sourceId: string) => string,
  prefix: string,
  sourceId: string,
): string {
  const next = factory(prefix, sourceId);
  ids.set(sourceId, next);
  return next;
}

/**
 * Clones the persisted base snapshot without sharing mutable catalog/media
 * identifiers. Section IDs remain stable because they are template anchors
 * used by future upgrades; project-local catalog and asset IDs are regenerated.
 */
export function cloneProjectFromTemplate(
  template: StoreProjectV2,
  options: CloneProjectOptions,
): StoreProjectV2 {
  const now = options.now ?? new Date().toISOString();
  const factory = options.idFactory ?? defaultIdFactory;
  const ids = new Map<string, string>();

  const assets = template.assets.map((asset) => ({
    ...structuredClone(asset),
    id: cloneEntityId(ids, factory, "asset", asset.id),
  }));
  const videos = template.videos.map((video: VideoAsset) => ({
    ...structuredClone(video),
    id: cloneEntityId(ids, factory, "video", video.id),
  }));
  const categories = template.categories.map((category) => ({
    ...structuredClone(category),
    id: cloneEntityId(ids, factory, "category", category.id),
  }));
  const collections = template.collections.map((collection) => ({
    ...structuredClone(collection),
    id: cloneEntityId(ids, factory, "collection", collection.id),
  }));
  const products = template.products.map((product) => ({
    ...structuredClone(product),
    id: cloneEntityId(ids, factory, "product", product.id),
    variants: product.variants.map((variant) => ({
      ...structuredClone(variant),
      id: cloneEntityId(ids, factory, "variant", variant.id),
    })),
  }));

  const remap = <T>(value: T): T => remapValue(value, ids) as T;
  const brandName = options.brandName?.trim() || template.identity.brandName;
  const project = {
    ...structuredClone(template),
    id: options.id,
    name: options.name.trim(),
    slug: options.slug,
    baseUrl: options.baseUrl ?? `https://${options.slug}.example`,
    createdAt: now,
    updatedAt: now,
    origin: {
      templateId: template.origin?.templateId ?? "catalog-modern",
      templateVersion: template.origin?.templateVersion ?? 1,
      seed: "duplicate" as const,
      role: "store" as const,
      updatePolicy: "managed" as const,
    },
    identity: {
      ...remap(template.identity),
      brandName,
      legalName: brandName,
    },
    whatsapp: {
      ...remap(template.whatsapp),
      phone: "",
      greeting: `Hola ${brandName}, quiero hacer este pedido:`,
    },
    seo: remap(template.seo),
    navigation: remap(template.navigation),
    pages: remap(template.pages),
    sections: remap(template.sections) as StoreSection[],
    assets: remap(assets),
    videos: remap(videos),
    categories: remap(categories),
    collections: remap(collections),
    products: remap(products),
  };

  return StoreProjectV2Schema.parse(project);
}
