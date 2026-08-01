import {
  type CategoryId,
  type CollectionId,
  getCategoryProductIds,
  type Product,
  type ProductId,
  ProductSchema,
  parseProject,
  type StoreProjectV1,
} from "@solara/project-schema";
import { referenceStore } from "@solara/project-schema/fixture";

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
  | (CommandMetadata & { type: "product.archive"; productId: ProductId })
  | (CommandMetadata & {
      type: "product.restore";
      productId: ProductId;
      status?: Exclude<ProductStatus, "archived">;
    })
  | (CommandMetadata & {
      type: "products.bulkUpdate";
      productIds: ProductId[];
      changes: ProductPatch;
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
  | CategoryCommand;

// La reubicaciÃ³n conserva las asignaciones de productos y recalcula Ã­ndices heredados.
export type CategoryCommand = CommandMetadata & {
  type: "category.reparent";
  categoryId: CategoryId;
  parentId?: CategoryId;
};

const unique = <Value>(values: readonly Value[]): Value[] => [...new Set(values)];

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

function synchronizeAssignments(project: StoreProjectV1): StoreProjectV1 {
  const categories = project.categories.map((category) => ({
    ...category,
    productIds: getCategoryProductIds(project, category.id),
  }));
  const collections = project.collections.map((collection) => ({
    ...collection,
    productIds: project.products
      .filter((product) => product.collectionIds.includes(collection.id))
      .map((product) => product.id),
  }));

  return { ...project, categories, collections };
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

  const missing = [...selected].filter(
    (productId) => !project.products.some((product) => product.id === productId),
  );
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
    if (JSON.stringify(candidate) === JSON.stringify(product)) {
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

export function reduceProject(project: StoreProjectV1, command: DomainCommand): StoreProjectV1 {
  assertTimestamp(command.at);
  const at =
    Date.parse(command.at) < Date.parse(project.updatedAt) ? project.updatedAt : command.at;

  switch (command.type) {
    case "category.reparent": {
      const category = project.categories.find((candidate) => candidate.id === command.categoryId);
      if (!category) throw new Error(`La categorÃ­a no existe: ${command.categoryId}.`);
      if (category.parentId === command.parentId) return project;
      const categories = project.categories.map((candidate) =>
        candidate.id === category.id ? { ...candidate, parentId: command.parentId } : candidate,
      );
      return parseProject(
        synchronizeAssignments({
          ...project,
          categories,
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
        synchronizeAssignments({
          ...project,
          products: [...project.products, product],
          updatedAt: at,
        }),
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
    case "product.restore":
      return updateSelectedProducts(project, [command.productId], at, (product) => ({
        ...product,
        status: command.status ?? "active",
      }));
    case "products.bulkUpdate":
      return updateSelectedProducts(project, command.productIds, at, (product) =>
        applyProductPatch(product, command.changes),
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
      const products = command.products.map((product) => ProductSchema.parse(product));
      if (JSON.stringify(products) === JSON.stringify(project.products)) {
        return project;
      }
      return parseProject(
        synchronizeAssignments({
          ...project,
          products,
          updatedAt: latestTimestamp(at, ...products.map((product) => product.updatedAt)),
        }),
      );
    }
  }
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
  return {
    past: [...history.past, history.present],
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
    past: [...history.past, history.present],
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
  if (!/^-?\d+$/.test(value)) {
    throw new Error(`Entero inválido en ${label}, fila ${row}.`);
  }
  const parsed = Number(value);
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
    if (existing !== undefined && JSON.stringify(existing.base) !== JSON.stringify(base)) {
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

export function generatePerformanceFixture(productCount = 1_000): StoreProjectV1 {
  if (!Number.isInteger(productCount) || productCount < 0) {
    throw new Error("La cantidad de productos debe ser un entero no negativo.");
  }

  const timestamp = "2026-07-29T12:00:00.000Z";
  const products = Array.from({ length: productCount }, (_, index) => {
    const sequence = String(index + 1).padStart(4, "0");
    const productId = `performance-product-${sequence}`;
    const price = 100_000 + index * 137;
    return {
      id: productId,
      slug: `producto-prueba-${sequence}`,
      title: `Producto de prueba ${sequence}`,
      description: `Producto determinista para medir catálogos grandes, lote ${sequence}.`,
      status: index % 10 === 0 ? "hidden" : "active",
      brand: index % 2 === 0 ? "Casa Luma" : "Taller Nadir",
      categoryIds: [index % 2 === 0 ? "category-textiles" : "category-mesa"],
      collectionIds: ["collection-casa-serena"],
      tags: ["rendimiento", `grupo-${index % 10}`],
      imageIds: [index % 2 === 0 ? "asset-manta" : "asset-jarra"],
      variants: [
        {
          id: `${productId}-principal`,
          sku: `PERF-${sequence}-A`,
          title: "Principal",
          optionValues: { Acabado: "Principal" },
          price,
          available: true,
          stockStatus: "in_stock",
          imageId: index % 2 === 0 ? "asset-manta" : "asset-jarra",
        },
        {
          id: `${productId}-alternativa`,
          sku: `PERF-${sequence}-B`,
          title: "Alternativa",
          optionValues: { Acabado: "Alternativa" },
          price: price + 2_500,
          available: index % 7 !== 0,
          stockStatus: index % 7 === 0 ? "out_of_stock" : "in_stock",
          imageId: index % 2 === 0 ? "asset-manta" : "asset-jarra",
        },
      ],
      createdAt: timestamp,
      updatedAt: timestamp,
    };
  });

  return parseProject({
    ...structuredClone(referenceStore),
    id: "store-performance",
    name: "Catálogo de rendimiento",
    slug: "catalogo-rendimiento",
    baseUrl: "https://performance.example",
    createdAt: timestamp,
    updatedAt: timestamp,
    products,
    categories: referenceStore.categories.map((category) => ({
      ...category,
      productIds: products
        .filter((product) => product.categoryIds.includes(category.id))
        .map((product) => product.id),
    })),
    collections: referenceStore.collections.map((collection) => ({
      ...collection,
      productIds: products.map((product) => product.id),
    })),
  });
}
