import { type CatalogCsvRecord, parseCatalogCsvRecords } from "@solara/core";
import type {
  Category,
  Collection,
  ImageAsset,
  Product,
  StoreProjectV1,
} from "@solara/project-schema";
import {
  hashFile,
  importCsvInWorker,
  processImageInWorker,
  readCatalogPackageInWorker,
} from "./workers";

interface PackageImageInput {
  path: string;
  type: string;
  buffer: ArrayBuffer;
}

export interface CatalogPackageSummary {
  filename: string;
  productsAdded: number;
  productsUpdated: number;
  productsUnchanged: number;
  categoriesAdded: number;
  collectionsAdded: number;
  imagesAdded: number;
  imagesReused: number;
  unmatchedImages: string[];
}

export interface CatalogPackagePlan {
  products: Product[];
  categories: Category[];
  collections: Collection[];
  assets: ImageAsset[];
  summary: CatalogPackageSummary;
}

function slugify(value: string): string {
  const slug = value
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("en-US")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return slug || "categoria";
}

function normalizePath(value: string): string {
  return value.trim().replaceAll("\\", "/").replace(/^\.\//, "");
}

function categoryPathParts(value: string): string[] {
  const parts = value
    .split(">")
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length > 2) {
    throw new Error(`La categoría "${value}" supera el máximo de dos niveles.`);
  }
  return parts;
}

function allocateId(prefix: string, slug: string, used: Set<string>): string {
  const base = `${prefix}-${slug}`;
  let id = base;
  let suffix = 2;
  while (used.has(id)) id = `${base}-${suffix++}`;
  used.add(id);
  return id;
}

function csvCategoryPaths(records: readonly CatalogCsvRecord[]): string[] {
  return [
    ...new Set(
      records.flatMap((record) =>
        record.categorias
          .split("|")
          .map((value) => value.trim())
          .filter(Boolean),
      ),
    ),
  ];
}

function csvCollectionNames(records: readonly CatalogCsvRecord[]): string[] {
  return [
    ...new Set(
      records.flatMap((record) =>
        record.colecciones
          .split("|")
          .map((value) => value.trim())
          .filter(Boolean),
      ),
    ),
  ];
}

function buildCategories(
  project: StoreProjectV1,
  paths: readonly string[],
): { categories: Category[]; pathToId: Record<string, string>; added: number } {
  const categories = structuredClone(project.categories);
  const usedIds = new Set(categories.map((category) => category.id));
  const bySlug = new Map<string, Category>(categories.map((category) => [category.slug, category]));
  const pathToId: Record<string, string> = {};
  let added = 0;

  for (const path of paths) {
    const parts = categoryPathParts(path);
    const rootTitle = parts[0];
    if (!rootTitle) continue;
    const rootSlug = slugify(rootTitle);
    let root = bySlug.get(rootSlug);
    if (!root) {
      root = {
        id: allocateId("category", rootSlug, usedIds) as Category["id"],
        slug: rootSlug as Category["slug"],
        title: rootTitle,
        description: "",
        productIds: [],
      };
      categories.push(root);
      bySlug.set(rootSlug, root);
      added += 1;
    }
    if (!parts[1]) {
      pathToId[normalizePath(path)] = root.id;
      continue;
    }
    const childTitle = parts[1];
    const childSlug = slugify(childTitle);
    let child = categories.find(
      (category) => category.slug === childSlug && category.parentId === root?.id,
    );
    if (!child) {
      child = {
        id: allocateId("category", childSlug, usedIds) as Category["id"],
        slug: childSlug as Category["slug"],
        title: childTitle,
        description: "",
        parentId: root.id,
        productIds: [],
      };
      categories.push(child);
      added += 1;
    }
    pathToId[normalizePath(path)] = child.id;
    pathToId[`${rootSlug}>${childSlug}`] = child.id;
  }

  return { categories, pathToId, added };
}

function buildCollections(
  project: StoreProjectV1,
  names: readonly string[],
): { collections: Collection[]; nameToId: Record<string, string>; added: number } {
  const collections = structuredClone(project.collections);
  const usedIds = new Set(collections.map((collection) => collection.id));
  const bySlug = new Map<string, Collection>(
    collections.map((collection) => [collection.slug, collection]),
  );
  const nameToId: Record<string, string> = {};
  let added = 0;

  for (const name of names) {
    const slug = slugify(name);
    let collection = bySlug.get(slug);
    if (!collection) {
      collection = {
        id: allocateId("collection", slug, usedIds) as Collection["id"],
        slug: slug as Collection["slug"],
        title: name,
        description: "",
        productIds: [],
      };
      collections.push(collection);
      bySlug.set(slug, collection);
      added += 1;
    }
    nameToId[name] = collection.id;
  }
  return { collections, nameToId, added };
}

function mergeProducts(
  current: readonly Product[],
  incoming: readonly Product[],
  at: string,
): { products: Product[]; added: number; updated: number; unchanged: number } {
  const byId = new Map(current.map((product) => [product.id, product]));
  const bySlug = new Map(current.map((product) => [product.slug, product]));
  const used = new Set(current.map((product) => product.id));
  let added = 0;
  let updated = 0;
  let unchanged = 0;
  const updates = new Map<string, Product>();

  for (const candidate of incoming) {
    const existing = byId.get(candidate.id) ?? bySlug.get(candidate.slug);
    if (!existing) {
      const id = used.has(candidate.id)
        ? (allocateId("product", slugify(candidate.slug), used) as Product["id"])
        : candidate.id;
      used.add(id);
      updates.set(id, { ...candidate, id, updatedAt: at });
      added += 1;
      continue;
    }

    const variants = candidate.variants.map((variant) => {
      const sameSku = variant.sku
        ? existing.variants.find((oldVariant) => oldVariant.sku === variant.sku)
        : undefined;
      return sameSku ? { ...variant, id: sameSku.id } : variant;
    });
    const merged = {
      ...candidate,
      id: existing.id,
      createdAt: existing.createdAt,
      updatedAt: at,
      variants,
    };
    const unchangedCandidate = { ...merged, updatedAt: existing.updatedAt };
    if (JSON.stringify(existing) === JSON.stringify(unchangedCandidate)) {
      unchanged += 1;
      updates.set(existing.id, existing);
    } else {
      updated += 1;
      updates.set(existing.id, merged);
    }
  }

  const products = current.map((product) => updates.get(product.id) ?? product);
  incoming.forEach((candidate) => {
    const existing = byId.get(candidate.id) ?? bySlug.get(candidate.slug);
    if (!existing) {
      const addedProduct = [...updates.values()].find((product) => product.slug === candidate.slug);
      if (addedProduct && !products.some((product) => product.id === addedProduct.id)) {
        products.push(addedProduct);
      }
    }
  });
  return { products, added, updated, unchanged };
}

async function buildAssets(
  images: readonly PackageImageInput[],
  project: StoreProjectV1,
): Promise<{
  assets: ImageAsset[];
  pathToId: Record<string, string>;
  added: number;
  reused: number;
}> {
  const assets = structuredClone(project.assets);
  const byHash = new Map(assets.map((asset) => [asset.hash, asset]));
  const pathToId: Record<string, string> = {};
  let added = 0;
  let reused = 0;

  for (const image of images) {
    const file = new File([image.buffer], image.path.split("/").pop() ?? "imagen", {
      type: image.type,
    });
    const hash = await hashFile(file);
    const existing = byHash.get(hash);
    if (existing) {
      pathToId[image.path] = existing.id;
      reused += 1;
      continue;
    }
    const processed = await processImageInWorker(file);
    const asset: ImageAsset = {
      kind: "image",
      id: `asset-${hash.slice(0, 24)}` as ImageAsset["id"],
      name: file.name,
      alt: "",
      mimeType: image.type,
      source: processed.primary,
      fallbackSource: processed.fallback,
      responsiveSources: processed.responsive,
      width: processed.width,
      height: processed.height,
      hash,
    };
    assets.push(asset);
    byHash.set(hash, asset);
    pathToId[image.path] = asset.id;
    added += 1;
  }
  return { assets, pathToId, added, reused };
}

export async function buildCatalogPackagePlan(
  file: File,
  project: StoreProjectV1,
): Promise<CatalogPackagePlan> {
  const contents = await readCatalogPackageInWorker(file);
  const records = parseCatalogCsvRecords(contents.csv);
  const timestamp = new Date().toISOString();
  const categoryPlan = buildCategories(project, csvCategoryPaths(records));
  const collectionPlan = buildCollections(project, csvCollectionNames(records));
  const assetPlan = await buildAssets(contents.images, project);
  const imported = await importCsvInWorker(contents.csv, {
    categories: categoryPlan.categories,
    collections: collectionPlan.collections,
    assets: [
      ...project.assets,
      ...assetPlan.assets.filter((asset) => !project.assets.some((old) => old.id === asset.id)),
    ],
    assetPathToId: assetPlan.pathToId,
    categoryPathToId: categoryPlan.pathToId,
    collectionNameToId: collectionPlan.nameToId,
    defaultTimestamp: timestamp,
    defaultBrand: project.identity.brandName,
  });
  const merged = mergeProducts(project.products, imported, timestamp);
  const referencedImages = new Set(
    records.flatMap((record) =>
      record.imagenes
        .split("|")
        .map((value) => normalizePath(value))
        .filter(Boolean),
    ),
  );
  const knownAssetIds = new Set(project.assets.map((asset) => asset.id));
  return {
    products: merged.products,
    categories: categoryPlan.categories,
    collections: collectionPlan.collections,
    assets: assetPlan.assets,
    summary: {
      filename: file.name,
      productsAdded: merged.added,
      productsUpdated: merged.updated,
      productsUnchanged: merged.unchanged,
      categoriesAdded: categoryPlan.added,
      collectionsAdded: collectionPlan.added,
      imagesAdded: assetPlan.added,
      imagesReused: assetPlan.reused,
      unmatchedImages: [...referencedImages].filter(
        (path) => !assetPlan.pathToId[path] && !knownAssetIds.has(path as ImageAsset["id"]),
      ),
    },
  };
}
