/**
 * Dominio puro de catálogo. Reduce DomainCommand sobre StoreProjectV2,
 * recalcula índices derivados y ofrece historial/CSV sin depender del navegador
 * para que la misma operación sea determinista en Studio y tests.
 */
import {
  type Category,
  type CategoryId,
  CategorySchema,
  type Collection,
  type CollectionId,
  CollectionSchema,
  type Product,
  type ProductId,
  ProductSchema,
  parseProject,
  type StoreProjectV1,
} from "@solara/project-schema";

export { generatePerformanceFixture } from "./performance.js";

export {
  type AppliedMutation,
  applyMutation,
  createMutationRegistry,
  type ProjectMutation,
  type ProjectMutationActor,
} from "./project-mutations.js";

type ProductStatus = Product["status"];
type ProductPatch = Partial<
  Pick<
    Product,
    | "slug"
    | "title"
    | "description"
    | "richDescription"
    | "status"
    | "brand"
    | "categoryIds"
    | "collectionIds"
    | "tags"
    | "imageIds"
    | "variants"
  >
>;

type CategoryPatch = Partial<
  Pick<Category, "slug" | "title" | "description" | "imageId" | "status">
>;
type CollectionPatch = Partial<
  Pick<Collection, "slug" | "title" | "description" | "imageId" | "status">
>;

interface CommandMetadata {
  at: string;
}

export type PriceAdjustment =
  | { type: "amount"; cents: number }
  | { type: "percentage"; basisPoints: number };

export type DomainCommand =
  | (CommandMetadata & { type: "product.create"; product: Product })
  | (CommandMetadata & {
      type: "product.update";
      productId: ProductId;
      changes: ProductPatch;
    })
  | (CommandMetadata & { type: "product.delete"; productId: ProductId })
  | (CommandMetadata & { type: "product.archive"; productId: ProductId })
  | (CommandMetadata & {
      type: "product.restore";
      productId: ProductId;
      status?: Exclude<ProductStatus, "archived">;
    })
  | (CommandMetadata & {
      type: "products.adjustPrices";
      productIds: ProductId[];
      adjustment: PriceAdjustment;
    })
  | (CommandMetadata & {
      type: "products.setCategories";
      productIds: ProductId[];
      categoryIds: CategoryId[];
    })
  | (CommandMetadata & {
      type: "products.setCollections";
      productIds: ProductId[];
      collectionIds: CollectionId[];
    })
  | (CommandMetadata & {
      type: "products.addTags";
      productIds: ProductId[];
      tags: string[];
    })
  | (CommandMetadata & {
      type: "products.removeTags";
      productIds: ProductId[];
      tags: string[];
    })
  | (CommandMetadata & {
      type: "products.setStatus";
      productIds: ProductId[];
      status: ProductStatus;
    })
  | (CommandMetadata & {
      type: "products.replaceAll";
      products: Product[];
    })
  | (CommandMetadata & {
      type: "catalog.applyImport";
      products: Product[];
      categories: Category[];
      collections: Collection[];
    })
  | CategoryCommand
  | CollectionCommand;

// Las operaciones de taxonomía conservan las asignaciones y recalculan índices derivados.
export type CategoryCommand =
  | (CommandMetadata & { type: "category.create"; category: Category })
  | (CommandMetadata & { type: "category.update"; categoryId: CategoryId; changes: CategoryPatch })
  | (CommandMetadata & {
      type: "category.reparent";
      categoryId: CategoryId;
      parentId?: CategoryId;
    });

export type CollectionCommand =
  | (CommandMetadata & { type: "collection.create"; collection: Collection })
  | (CommandMetadata & {
      type: "collection.update";
      collectionId: CollectionId;
      changes: CollectionPatch;
    });

const unique = <Value>(values: readonly Value[]): Value[] => [...new Set(values)];

const RESERVED_PUBLIC_SLUGS = new Set([
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

function assertAvailableSlug(
  slug: string,
  entries: readonly { id: string; slug: string }[],
  currentId: string | undefined,
  label: string,
): void {
  if (RESERVED_PUBLIC_SLUGS.has(slug)) {
    throw new Error(`El slug de ${label} "${slug}" está reservado por una ruta pública.`);
  }
  if (entries.some((entry) => entry.id !== currentId && entry.slug === slug)) {
    throw new Error(`El slug de ${label} "${slug}" ya está en uso.`);
  }
}

function assertCategoryParent(
  project: StoreProjectV1,
  categoryId: CategoryId,
  parentId: CategoryId | undefined,
): void {
  if (!parentId) return;
  const parent = project.categories.find((category) => category.id === parentId);
  if (!parent) throw new Error(`La categoría padre no existe: ${parentId}.`);
  if (parent.id === categoryId || parent.parentId !== undefined) {
    throw new Error("Las categorías sólo pueden tener una raíz y un nivel de subcategorías.");
  }
}

function assertTimestamp(value: string): void {
  if (Number.isNaN(Date.parse(value))) {
    throw new Error(`Fecha de comando inválida: ${value}.`);
  }
}

function assertInteger(value: number, label: string): void {
  if (!Number.isSafeInteger(value)) {
    throw new Error(`${label} debe ser un entero seguro.`);
  }
}

function latestTimestamp(...values: string[]): string {
  return values.reduce((latest, value) =>
    Date.parse(value) > Date.parse(latest) ? value : latest,
  );
}

function divideAndRound(numerator: bigint, denominator: bigint): bigint {
  const quotient = numerator / denominator;
  const remainder = numerator % denominator;
  const absoluteRemainder = remainder < 0n ? -remainder : remainder;
  const direction = numerator < 0n ? -1n : 1n;
  return absoluteRemainder * 2n >= denominator ? quotient + direction : quotient;
}

export function adjustPrice(price: number, adjustment: PriceAdjustment): number {
  assertInteger(price, "El precio");

  if (adjustment.type === "amount") {
    assertInteger(adjustment.cents, "El ajuste de precio");
    return Math.max(0, price + adjustment.cents);
  }

  assertInteger(adjustment.basisPoints, "El porcentaje");
  if (adjustment.basisPoints < -10_000) {
    throw new Error("El porcentaje no puede reducir el precio por debajo de cero.");
  }

  const factor = BigInt(10_000 + adjustment.basisPoints);
  const adjusted = divideAndRound(BigInt(price) * factor, 10_000n);
  const result = Number(adjusted);
  assertInteger(result, "El precio ajustado");
  return result;
}

function sameValue(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true;
  if (typeof left !== "object" || left === null || typeof right !== "object" || right === null) {
    return false;
  }
  if (Array.isArray(left) || Array.isArray(right)) {
    if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) return false;
    return left.every((value, index) => sameValue(value, right[index]));
  }
  const leftRecord = left as Record<string, unknown>;
  const rightRecord = right as Record<string, unknown>;
  const leftKeys = Object.keys(leftRecord);
  const rightKeys = Object.keys(rightRecord);
  if (leftKeys.length !== rightKeys.length) return false;
  return leftKeys.every(
    (key) => Object.hasOwn(rightRecord, key) && sameValue(leftRecord[key], rightRecord[key]),
  );
}

function synchronizeAssignments(project: StoreProjectV1): StoreProjectV1 {
  const categoryById = new Map<CategoryId, Category>(
    project.categories.map((category) => [category.id, category]),
  );
  const categoryProductIds = new Map<CategoryId, ProductId[]>();
  const categoryScopeCache = new Map<CategoryId, readonly CategoryId[]>();
  const categoryScope = (categoryId: CategoryId): readonly CategoryId[] => {
    const cached = categoryScopeCache.get(categoryId);
    if (cached) return cached;
    const scope = new Set<CategoryId>([categoryId]);
    const seen = new Set<CategoryId>([categoryId]);
    let current = categoryById.get(categoryId)?.parentId;
    while (current && !seen.has(current)) {
      seen.add(current);
      scope.add(current);
      current = categoryById.get(current)?.parentId;
    }
    const resolved = [...scope];
    categoryScopeCache.set(categoryId, resolved);
    return resolved;
  };

  const collectionProductIds = new Map<CollectionId, ProductId[]>();
  for (const product of project.products) {
    const productCategoryScope = new Set<CategoryId>();
    for (const categoryId of product.categoryIds) {
      for (const id of categoryScope(categoryId)) productCategoryScope.add(id);
    }
    productCategoryScope.forEach((categoryId) => {
      const ids = categoryProductIds.get(categoryId) ?? [];
      ids.push(product.id);
      categoryProductIds.set(categoryId, ids);
    });
    for (const collectionId of product.collectionIds) {
      const ids = collectionProductIds.get(collectionId) ?? [];
      ids.push(product.id);
      collectionProductIds.set(collectionId, ids);
    }
  }

  let categoriesChanged = false;
  const categories = project.categories.map((category) => {
    const productIds = categoryProductIds.get(category.id) ?? [];
    if (sameValue(category.productIds, productIds)) return category;
    categoriesChanged = true;
    return { ...category, productIds };
  });
  let collectionsChanged = false;
  const collections = project.collections.map((collection) => {
    const productIds = collectionProductIds.get(collection.id) ?? [];
    if (sameValue(collection.productIds, productIds)) return collection;
    collectionsChanged = true;
    return { ...collection, productIds };
  });

  return categoriesChanged || collectionsChanged
    ? { ...project, categories, collections }
    : project;
}

function activateCatalogModernDefaults(project: StoreProjectV1): StoreProjectV1 {
  if (project.origin?.templateId !== "catalog-modern" || project.origin.seed !== "clean") {
    return project;
  }
  const hasActiveProducts = project.products.some((product) => product.status === "active");
  const hasCategories = project.categories.length > 0;
  if (!hasActiveProducts && !hasCategories) return project;
  let changed = false;
  const sections = project.sections.map((section) => {
    const settings = section.settings;
    const isProductDefault =
      section.id === "modo-section-new" &&
      section.moduleId === "catalog-product-grid" &&
      settings.title === "Productos" &&
      settings.source === "all" &&
      settings.limit === 12;
    const isCategoryDefault =
      section.id === "modo-section-categories" &&
      section.moduleId === "catalog-category-bento" &&
      Array.isArray(settings.items) &&
      settings.items.length === 0;
    if (section.enabled || (!isProductDefault && !isCategoryDefault)) return section;
    if ((isProductDefault && !hasActiveProducts) || (isCategoryDefault && !hasCategories)) {
      return section;
    }
    changed = true;
    return { ...section, enabled: true };
  });
  return changed ? { ...project, sections } : project;
}

function normalizeImportedProductReferences(
  project: StoreProjectV1,
  products: readonly Product[],
): Product[] {
  const categoryIds = new Set(project.categories.map((category) => category.id));
  const collectionIds = new Set(project.collections.map((collection) => collection.id));
  const assetIds = new Set(project.assets.map((asset) => asset.id));

  return products.map((product) => ({
    ...product,
    categoryIds: product.categoryIds.filter((categoryId) => categoryIds.has(categoryId)),
    collectionIds: product.collectionIds.filter((collectionId) => collectionIds.has(collectionId)),
    imageIds: product.imageIds.filter((assetId) => assetIds.has(assetId)),
    variants: product.variants.map((variant) =>
      variant.imageId === undefined || assetIds.has(variant.imageId)
        ? variant
        : { ...variant, imageId: undefined },
    ),
  }));
}

function updateSelectedProducts(
  project: StoreProjectV1,
  productIds: readonly ProductId[],
  at: string,
  update: (product: Product) => Product,
): StoreProjectV1 {
  const selected = new Set(productIds);
  if (selected.size === 0) {
    return project;
  }

  const existingProductIds = new Set(project.products.map((product) => product.id));
  const missing = [...selected].filter((productId) => !existingProductIds.has(productId));
  if (missing.length > 0) {
    throw new Error(`Productos inexistentes: ${missing.join(", ")}.`);
  }

  let changed = false;
  let projectUpdatedAt = at;
  const products = project.products.map((product) => {
    if (!selected.has(product.id)) {
      return product;
    }
    const candidate = update(product);
    if (sameValue(candidate, product)) {
      return product;
    }
    changed = true;
    const updatedAt = latestTimestamp(at, product.updatedAt);
    projectUpdatedAt = latestTimestamp(projectUpdatedAt, updatedAt);
    return { ...candidate, updatedAt };
  });

  if (!changed) {
    return project;
  }

  return parseProject(
    synchronizeAssignments({ ...project, products, updatedAt: projectUpdatedAt }),
  );
}

function applyProductPatch(product: Product, changes: ProductPatch): Product {
  return ProductSchema.parse({
    ...product,
    ...changes,
    id: product.id,
    createdAt: product.createdAt,
    updatedAt: product.updatedAt,
  });
}

/**
 * Applies one deterministic domain command, recalculates derived indexes and
 * rejects the whole operation if the resulting project fails the schema.
 */
export function reduceProject(project: StoreProjectV1, command: DomainCommand): StoreProjectV1 {
  assertTimestamp(command.at);
  const at =
    Date.parse(command.at) < Date.parse(project.updatedAt) ? project.updatedAt : command.at;

  switch (command.type) {
    case "category.create": {
      const category = CategorySchema.parse(command.category);
      if (project.categories.some((candidate) => candidate.id === category.id)) {
        throw new Error(`Ya existe la categoría ${category.id}.`);
      }
      assertAvailableSlug(category.slug, project.categories, undefined, "categoría");
      assertCategoryParent(project, category.id, category.parentId);
      return parseProject(
        synchronizeAssignments({
          ...project,
          categories: [...project.categories, { ...category, productIds: [] }],
          updatedAt: at,
        }),
      );
    }
    case "category.update": {
      const category = project.categories.find((candidate) => candidate.id === command.categoryId);
      if (!category) throw new Error(`La categoría no existe: ${command.categoryId}.`);
      const candidate = CategorySchema.parse({ ...category, ...command.changes });
      assertAvailableSlug(candidate.slug, project.categories, category.id, "categoría");
      if (sameValue(candidate, category)) return project;
      return parseProject(
        synchronizeAssignments({
          ...project,
          categories: project.categories.map((item) =>
            item.id === category.id ? { ...candidate, productIds: item.productIds } : item,
          ),
          updatedAt: at,
        }),
      );
    }
    case "category.reparent": {
      const category = project.categories.find((candidate) => candidate.id === command.categoryId);
      if (!category) throw new Error(`La categoría no existe: ${command.categoryId}.`);
      if (category.parentId === command.parentId) return project;
      assertCategoryParent(project, category.id, command.parentId);
      const hasChildren = project.categories.some(
        (candidate) => candidate.parentId === category.id,
      );
      if (hasChildren && command.parentId !== undefined) {
        throw new Error(
          "Las categorías con subcategorías no pueden reubicarse bajo otra categoría.",
        );
      }
      const categories = project.categories.map((candidate) =>
        candidate.id === category.id
          ? command.parentId === undefined
            ? (Object.fromEntries(
                Object.entries(candidate).filter(([key]) => key !== "parentId"),
              ) as Category)
            : { ...candidate, parentId: command.parentId }
          : candidate,
      );
      return parseProject(
        synchronizeAssignments({
          ...project,
          categories,
          updatedAt: at,
        }),
      );
    }
    case "collection.create": {
      const collection = CollectionSchema.parse(command.collection);
      if (project.collections.some((candidate) => candidate.id === collection.id)) {
        throw new Error(`Ya existe la colección ${collection.id}.`);
      }
      assertAvailableSlug(collection.slug, project.collections, undefined, "colección");
      return parseProject(
        synchronizeAssignments({
          ...project,
          collections: [...project.collections, { ...collection, productIds: [] }],
          updatedAt: at,
        }),
      );
    }
    case "collection.update": {
      const collection = project.collections.find(
        (candidate) => candidate.id === command.collectionId,
      );
      if (!collection) throw new Error(`La colección no existe: ${command.collectionId}.`);
      const candidate = CollectionSchema.parse({ ...collection, ...command.changes });
      assertAvailableSlug(candidate.slug, project.collections, collection.id, "colección");
      if (sameValue(candidate, collection)) return project;
      return parseProject(
        synchronizeAssignments({
          ...project,
          collections: project.collections.map((item) =>
            item.id === collection.id ? { ...candidate, productIds: item.productIds } : item,
          ),
          updatedAt: at,
        }),
      );
    }
    case "product.create": {
      if (project.products.some((product) => product.id === command.product.id)) {
        throw new Error(`Ya existe el producto ${command.product.id}.`);
      }
      if (project.products.some((product) => product.slug === command.product.slug)) {
        throw new Error(`Ya existe el slug de producto ${command.product.slug}.`);
      }
      const product = ProductSchema.parse({
        ...command.product,
        createdAt: at,
        updatedAt: at,
      });
      return parseProject(
        activateCatalogModernDefaults(
          synchronizeAssignments({
            ...project,
            products: [...project.products, product],
            updatedAt: at,
          }),
        ),
      );
    }
    case "product.update":
      return updateSelectedProducts(project, [command.productId], at, (product) =>
        applyProductPatch(product, command.changes),
      );
    case "product.archive":
      return updateSelectedProducts(project, [command.productId], at, (product) => ({
        ...product,
        status: "archived",
      }));
    case "product.delete": {
      const product = project.products.find((candidate) => candidate.id === command.productId);
      if (!product) throw new Error(`El producto no existe: ${command.productId}.`);
      if (product.status !== "archived") {
        throw new Error(`Sólo se pueden eliminar productos archivados: ${command.productId}.`);
      }
      return parseProject(
        synchronizeAssignments({
          ...project,
          products: project.products.filter((candidate) => candidate.id !== command.productId),
          updatedAt: at,
        }),
      );
    }
    case "product.restore":
      return activateCatalogModernDefaults(
        updateSelectedProducts(project, [command.productId], at, (product) => ({
          ...product,
          status: command.status ?? "active",
        })),
      );
    case "products.adjustPrices":
      return updateSelectedProducts(project, command.productIds, at, (product) =>
        ProductSchema.parse({
          ...product,
          variants: product.variants.map((variant) => ({
            ...variant,
            price: adjustPrice(variant.price, command.adjustment),
            ...(variant.compareAtPrice === undefined
              ? {}
              : {
                  compareAtPrice: adjustPrice(variant.compareAtPrice, command.adjustment),
                }),
          })),
        }),
      );
    case "products.setCategories":
      return updateSelectedProducts(project, command.productIds, at, (product) => ({
        ...product,
        categoryIds: unique(command.categoryIds),
      }));
    case "products.setCollections":
      return updateSelectedProducts(project, command.productIds, at, (product) => ({
        ...product,
        collectionIds: unique(command.collectionIds),
      }));
    case "products.addTags":
      return updateSelectedProducts(project, command.productIds, at, (product) => ({
        ...product,
        tags: unique([...product.tags, ...command.tags.map((tag) => tag.trim()).filter(Boolean)]),
      }));
    case "products.removeTags": {
      const removed = new Set(command.tags);
      return updateSelectedProducts(project, command.productIds, at, (product) => ({
        ...product,
        tags: product.tags.filter((tag) => !removed.has(tag)),
      }));
    }
    case "products.setStatus":
      return updateSelectedProducts(project, command.productIds, at, (product) => ({
        ...product,
        status: command.status,
      }));
    case "products.replaceAll": {
      const products = normalizeImportedProductReferences(
        project,
        command.products.map((product) => ProductSchema.parse(product)),
      );
      if (sameValue(products, project.products)) {
        return project;
      }
      return parseProject(
        activateCatalogModernDefaults(
          synchronizeAssignments({
            ...project,
            products,
            updatedAt: latestTimestamp(at, ...products.map((product) => product.updatedAt)),
          }),
        ),
      );
    }
    case "catalog.applyImport": {
      const categories = command.categories.map((category) => CategorySchema.parse(category));
      const collections = command.collections.map((collection) =>
        CollectionSchema.parse(collection),
      );
      const candidate = { ...project, categories, collections };
      const products = normalizeImportedProductReferences(
        candidate,
        command.products.map((product) => ProductSchema.parse(product)),
      );
      const next = parseProject(
        activateCatalogModernDefaults(
          synchronizeAssignments({
            ...candidate,
            products,
            updatedAt: latestTimestamp(at, ...products.map((product) => product.updatedAt)),
          }),
        ),
      );
      return sameValue(next, project) ? project : next;
    }
  }
}

/**
 * Límite de snapshots de undo. Evita crecimiento ilimitado de memoria con
 * catálogos grandes; los estados más antiguos se descartan primero.
 */
export const MAX_HISTORY_LENGTH = 50;
export const MAX_HISTORY_LENGTH_LARGE = 20;
export const LARGE_CATALOG_THRESHOLD = 500;

export function getMaxHistoryLength(project: StoreProjectV1): number {
  return project.products.length > LARGE_CATALOG_THRESHOLD
    ? MAX_HISTORY_LENGTH_LARGE
    : MAX_HISTORY_LENGTH;
}

export interface HistoryState {
  past: StoreProjectV1[];
  present: StoreProjectV1;
  future: StoreProjectV1[];
}

export function createHistory(project: StoreProjectV1): HistoryState {
  return { past: [], present: project, future: [] };
}

export function executeCommand(history: HistoryState, command: DomainCommand): HistoryState {
  const next = reduceProject(history.present, command);
  if (next === history.present) {
    return history;
  }
  const maxLen = getMaxHistoryLength(next);
  return {
    past: [...history.past, history.present].slice(-maxLen),
    present: next,
    future: [],
  };
}

export function undo(history: HistoryState): HistoryState {
  const previous = history.past.at(-1);
  if (previous === undefined) {
    return history;
  }
  return {
    past: history.past.slice(0, -1),
    present: previous,
    future: [history.present, ...history.future],
  };
}

export function redo(history: HistoryState): HistoryState {
  const next = history.future[0];
  if (next === undefined) {
    return history;
  }
  return {
    past: [...history.past, history.present].slice(-getMaxHistoryLength(history.present)),
    present: next,
    future: history.future.slice(1),
  };
}

const csvColumns = [
  "product_id",
  "slug",
  "title",
  "description",
  "rich_description",
  "status",
  "brand",
  "category_ids",
  "collection_ids",
  "tags",
  "image_ids",
  "variant_id",
  "variant_title",
  "sku",
  "option_values",
  "price_cents",
  "compare_at_price_cents",
  "available",
  "stock_status",
  "gtin",
  "mpn",
  "variant_image_id",
  "created_at",
  "updated_at",
] as const;

type CsvColumn = (typeof csvColumns)[number];
type CsvRecord = Record<CsvColumn, string>;

function neutralizeFormula(value: string): string {
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
}

function restoreFormulaValue(value: string): string {
  return /^'[=+\-@\t\r]/.test(value) ? value.slice(1) : value;
}

function encodeCsvCell(value: string): string {
  const safe = neutralizeFormula(value);
  return /[",\r\n]/.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe;
}

function parseCsvRows(csv: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  for (let index = 0; index < csv.length; index += 1) {
    const character = csv[index];
    if (quoted) {
      if (character === '"' && csv[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        cell += character;
      }
    } else if (character === '"') {
      if (cell.length !== 0) {
        throw new Error(`Comilla inesperada en la fila ${rows.length + 1}.`);
      }
      quoted = true;
    } else if (character === ",") {
      row.push(restoreFormulaValue(cell));
      cell = "";
    } else if (character === "\n") {
      row.push(restoreFormulaValue(cell.replace(/\r$/, "")));
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += character;
    }
  }

  if (quoted) {
    throw new Error("El CSV termina dentro de un campo entre comillas.");
  }
  if (cell.length > 0 || row.length > 0) {
    row.push(restoreFormulaValue(cell.replace(/\r$/, "")));
    rows.push(row);
  }
  return rows.filter((candidate) => candidate.some((value) => value.length > 0));
}

function jsonStringArray(value: readonly string[]): string {
  return JSON.stringify(value);
}

export function exportProductsCsv(products: readonly Product[]): string {
  const rows = products.flatMap((product) =>
    product.variants.map((variant) => {
      const record: CsvRecord = {
        product_id: product.id,
        slug: product.slug,
        title: product.title,
        description: product.description,
        rich_description: product.richDescription ?? "",
        status: product.status,
        brand: product.brand,
        category_ids: jsonStringArray(product.categoryIds),
        collection_ids: jsonStringArray(product.collectionIds),
        tags: jsonStringArray(product.tags),
        image_ids: jsonStringArray(product.imageIds),
        variant_id: variant.id,
        variant_title: variant.title,
        sku: variant.sku,
        option_values: JSON.stringify(variant.optionValues),
        price_cents: String(variant.price),
        compare_at_price_cents: variant.compareAtPrice?.toString() ?? "",
        available: String(variant.available),
        stock_status: variant.stockStatus,
        gtin: variant.gtin ?? "",
        mpn: variant.mpn ?? "",
        variant_image_id: variant.imageId ?? "",
        created_at: product.createdAt,
        updated_at: product.updatedAt,
      };
      return csvColumns.map((column) => encodeCsvCell(record[column])).join(",");
    }),
  );
  return [csvColumns.join(","), ...rows].join("\r\n");
}

function parseJson(value: string, label: string, row: number): unknown {
  try {
    return JSON.parse(value);
  } catch {
    throw new Error(`JSON inválido en ${label}, fila ${row}.`);
  }
}

function parseInteger(value: string, label: string, row: number): number {
  const normalized = value.trim();
  if (!/^-?\d+$/.test(normalized)) {
    throw new Error(`Entero inválido en ${label}, fila ${row}.`);
  }
  const parsed = Number(normalized);
  assertInteger(parsed, `${label} de la fila ${row}`);
  return parsed;
}

export function importProductsCsv(csv: string): Product[] {
  const rows = parseCsvRows(csv.replace(/^\uFEFF/, ""));
  const header = rows[0];
  if (header === undefined) {
    return [];
  }
  if (
    header.length !== csvColumns.length ||
    csvColumns.some((column, index) => header[index] !== column)
  ) {
    throw new Error("Las columnas del CSV no coinciden con el formato SolaraCommerce.");
  }

  const grouped = new Map<string, { base: Omit<Product, "variants">; variants: unknown[] }>();

  rows.slice(1).forEach((values, rowIndex) => {
    const rowNumber = rowIndex + 2;
    if (values.length !== csvColumns.length) {
      throw new Error(`Cantidad de columnas inválida en la fila ${rowNumber}.`);
    }
    const record = Object.fromEntries(
      csvColumns.map((column, index) => [column, values[index] ?? ""]),
    ) as CsvRecord;
    const existing = grouped.get(record.product_id);
    const base = {
      id: record.product_id,
      slug: record.slug,
      title: record.title,
      description: record.description,
      ...(record.rich_description === "" ? {} : { richDescription: record.rich_description }),
      status: record.status,
      brand: record.brand,
      categoryIds: parseJson(record.category_ids, "category_ids", rowNumber),
      collectionIds: parseJson(record.collection_ids, "collection_ids", rowNumber),
      tags: parseJson(record.tags, "tags", rowNumber),
      imageIds: parseJson(record.image_ids, "image_ids", rowNumber),
      createdAt: record.created_at,
      updatedAt: record.updated_at,
    };
    if (existing !== undefined && !sameValue(existing.base, base)) {
      throw new Error(`Las filas del producto ${record.product_id} no comparten los mismos datos.`);
    }
    const group = existing ?? {
      base: base as Omit<Product, "variants">,
      variants: [],
    };
    group.variants.push({
      id: record.variant_id,
      sku: record.sku,
      title: record.variant_title,
      optionValues: parseJson(record.option_values, "option_values", rowNumber),
      price: parseInteger(record.price_cents, "price_cents", rowNumber),
      ...(record.compare_at_price_cents === ""
        ? {}
        : {
            compareAtPrice: parseInteger(
              record.compare_at_price_cents,
              "compare_at_price_cents",
              rowNumber,
            ),
          }),
      available:
        record.available === "true"
          ? true
          : record.available === "false"
            ? false
            : (() => {
                throw new Error(`Booleano inválido en available, fila ${rowNumber}.`);
              })(),
      stockStatus: record.stock_status,
      ...(record.gtin === "" ? {} : { gtin: record.gtin }),
      ...(record.mpn === "" ? {} : { mpn: record.mpn }),
      ...(record.variant_image_id === "" ? {} : { imageId: record.variant_image_id }),
    });
    grouped.set(record.product_id, group);
  });

  return [...grouped.values()].map((group) =>
    ProductSchema.parse({ ...group.base, variants: group.variants }),
  );
}

export const catalogCsvColumns = [
  "producto_id",
  "variante_id",
  "slug",
  "titulo",
  "descripcion",
  "marca",
  "estado",
  "categorias",
  "colecciones",
  "etiquetas",
  "imagenes",
  "variante",
  "sku",
  "opciones",
  "precio_centavos",
  "precio_anterior_centavos",
  "disponible",
  "estado_stock",
  "gtin",
  "mpn",
  "imagen_variante",
  "creado_en",
  "actualizado_en",
] as const;

type CatalogCsvColumn = (typeof catalogCsvColumns)[number];
export type CatalogCsvRecord = Record<CatalogCsvColumn, string>;

function pipeValues(value: readonly string[]): string {
  return value.join("|");
}

function parsePipeValues(value: string): string[] {
  return value
    .split("|")
    .map((item) => item.trim())
    .filter(Boolean);
}

function optionValuesText(values: Record<string, string>): string {
  return Object.entries(values)
    .map(([key, value]) => `${key}=${value}`)
    .join("|");
}

function parseOptionValues(value: string, row: number): Record<string, string> {
  const entries = parsePipeValues(value);
  const result: Record<string, string> = {};
  for (const entry of entries) {
    const separator = entry.indexOf("=");
    if (separator <= 0) throw new Error(`Opción inválida en opciones, fila ${row}.`);
    const key = entry.slice(0, separator).trim();
    const option = entry.slice(separator + 1).trim();
    if (!key || !option) throw new Error(`Opción inválida en opciones, fila ${row}.`);
    result[key] = option;
  }
  return result;
}

export function parseCatalogCsvRecords(csv: string): CatalogCsvRecord[] {
  const rows = parseCsvRows(csv.replace(/^\uFEFF/, ""));
  const header = rows[0];
  if (!header) return [];
  if (
    header.length !== catalogCsvColumns.length ||
    catalogCsvColumns.some((column, index) => header[index] !== column)
  ) {
    throw new Error("Las columnas del CSV comercial no coinciden con la plantilla Catalog Modern.");
  }
  return rows.slice(1).map((values, rowIndex) => {
    const row = rowIndex + 2;
    if (values.length !== catalogCsvColumns.length) {
      throw new Error(`Cantidad de columnas inválida en la fila ${row}.`);
    }
    return Object.fromEntries(
      catalogCsvColumns.map((column, index) => [column, values[index] ?? ""]),
    ) as CatalogCsvRecord;
  });
}

export function exportCatalogCsv(
  project: Pick<StoreProjectV1, "products" | "categories" | "collections">,
): string {
  const categorySlugs = new Map(project.categories.map((category) => [category.id, category.slug]));
  const collectionSlugs = new Map(
    project.collections.map((collection) => [collection.id, collection.slug]),
  );
  const rows = project.products.flatMap((product) =>
    product.variants.map((variant) => {
      const record: CatalogCsvRecord = {
        producto_id: product.id,
        variante_id: variant.id,
        slug: product.slug,
        titulo: product.title,
        descripcion: product.description,
        marca: product.brand,
        estado: product.status,
        categorias: pipeValues(product.categoryIds.map((id) => categorySlugs.get(id) ?? id)),
        colecciones: pipeValues(product.collectionIds.map((id) => collectionSlugs.get(id) ?? id)),
        etiquetas: pipeValues(product.tags),
        imagenes: pipeValues(product.imageIds),
        variante: variant.title,
        sku: variant.sku,
        opciones: optionValuesText(variant.optionValues),
        precio_centavos: String(variant.price),
        precio_anterior_centavos: variant.compareAtPrice?.toString() ?? "",
        disponible: String(variant.available),
        estado_stock: variant.stockStatus,
        gtin: variant.gtin ?? "",
        mpn: variant.mpn ?? "",
        imagen_variante: variant.imageId ?? "",
        creado_en: product.createdAt,
        actualizado_en: product.updatedAt,
      };
      return catalogCsvColumns.map((column) => encodeCsvCell(record[column])).join(",");
    }),
  );
  return [catalogCsvColumns.join(","), ...rows].join("\r\n");
}

export interface CatalogCsvContext {
  categories: readonly { id: string; slug: string }[];
  collections: readonly { id: string; slug: string }[];
  assets: readonly { id: string }[];
  assetPathToId?: Readonly<Record<string, string>>;
  categoryPathToId?: Readonly<Record<string, string>>;
  collectionNameToId?: Readonly<Record<string, string>>;
  defaultTimestamp?: string;
  defaultBrand?: string;
}

function resolveCatalogAssetRef(value: string, context: CatalogCsvContext): string {
  const normalized = value.replaceAll("\\", "/").replace(/^\.\//, "");
  return context.assetPathToId?.[normalized] ?? value;
}

function resolveCatalogCategoryRef(value: string, context: CatalogCsvContext): string {
  const normalized = value.trim().replaceAll("\\", "/");
  return context.categoryPathToId?.[normalized] ?? value;
}

function resolveCatalogCollectionRef(value: string, context: CatalogCsvContext): string {
  const normalized = value.trim();
  return context.collectionNameToId?.[normalized] ?? value;
}

export function importCatalogCsv(csv: string, context: CatalogCsvContext): Product[] {
  const records = parseCatalogCsvRecords(csv);
  const rows = [
    catalogCsvColumns,
    ...records.map((record) => catalogCsvColumns.map((column) => record[column])),
  ];
  const header = records.length > 0 ? catalogCsvColumns : undefined;
  if (!header) return [];
  if (
    header.length !== catalogCsvColumns.length ||
    catalogCsvColumns.some((column, index) => header[index] !== column)
  ) {
    throw new Error("Las columnas del CSV comercial no coinciden con la plantilla Catalog Modern.");
  }
  const categoryIds = new Map<string, string>(
    context.categories.map((category) => [String(category.slug), String(category.id)]),
  );
  const collectionIds = new Map<string, string>(
    context.collections.map((collection) => [String(collection.slug), String(collection.id)]),
  );
  const assetIds = new Set<string>(context.assets.map((asset) => String(asset.id)));
  const grouped = new Map<string, { base: Omit<Product, "variants">; variants: unknown[] }>();

  rows.slice(1).forEach((values, rowIndex) => {
    const row = rowIndex + 2;
    if (values.length !== catalogCsvColumns.length) {
      throw new Error(`Cantidad de columnas inválida en la fila ${row}.`);
    }
    const record = Object.fromEntries(
      catalogCsvColumns.map((column, index) => [column, values[index] ?? ""]),
    ) as CatalogCsvRecord;
    const productId = record.producto_id || `product-${record.slug}`;
    const categoryValues = parsePipeValues(record.categorias);
    const collectionValues = parsePipeValues(record.colecciones);
    const imageIds = parsePipeValues(record.imagenes).map((value) =>
      resolveCatalogAssetRef(value, context),
    );
    const categoryIdsForProduct = categoryValues.map((value) => {
      const resolved = resolveCatalogCategoryRef(value, context);
      return categoryIds.get(resolved) ?? resolved;
    });
    const collectionIdsForProduct = collectionValues.map((value) => {
      const resolved = resolveCatalogCollectionRef(value, context);
      return collectionIds.get(resolved) ?? resolved;
    });
    if (imageIds.some((assetId) => !assetIds.has(assetId))) {
      throw new Error(`Imagen inexistente en imagenes, fila ${row}.`);
    }
    const base = {
      id: productId,
      slug: record.slug,
      title: record.titulo,
      description: record.descripcion,
      status: record.estado.trim() || "active",
      brand: record.marca.trim() || context.defaultBrand || "",
      categoryIds: categoryIdsForProduct,
      collectionIds: collectionIdsForProduct,
      tags: parsePipeValues(record.etiquetas),
      imageIds,
      createdAt: record.creado_en.trim() || context.defaultTimestamp || "",
      updatedAt: record.actualizado_en.trim() || context.defaultTimestamp || "",
    };
    const existing = grouped.get(productId);
    if (existing && !sameValue(existing.base, base)) {
      throw new Error(`Las filas del producto ${productId} no comparten los mismos datos.`);
    }
    const available = record.disponible.trim() !== "false";
    if (available === undefined) throw new Error(`Booleano inválido en disponible, fila ${row}.`);
    const variant = {
      id: record.variante_id || `${productId}-variante-${(existing?.variants.length ?? 0) + 1}`,
      title: record.variante || "Única",
      sku: record.sku,
      optionValues: parseOptionValues(record.opciones, row),
      price: parseInteger(record.precio_centavos, "precio_centavos", row),
      ...(record.precio_anterior_centavos
        ? {
            compareAtPrice: parseInteger(
              record.precio_anterior_centavos,
              "precio_anterior_centavos",
              row,
            ),
          }
        : {}),
      available: available ?? true,
      stockStatus: record.estado_stock.trim() || "in_stock",
      ...(record.gtin ? { gtin: record.gtin } : {}),
      ...(record.mpn ? { mpn: record.mpn } : {}),
      ...(record.imagen_variante
        ? { imageId: resolveCatalogAssetRef(record.imagen_variante, context) }
        : {}),
    };
    const group = existing ?? { base: base as Omit<Product, "variants">, variants: [] };
    group.variants.push(variant);
    grouped.set(productId, group);
  });

  return [...grouped.values()].map((group) =>
    ProductSchema.parse({ ...group.base, variants: group.variants }),
  );
}

/** Normaliza texto de búsqueda: minúsculas es-AR, sin diacríticos, tokens. */
export function normalizeSearchTokens(value: string): string[] {
  return String(value ?? "")
    .toLocaleLowerCase("es-AR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}
