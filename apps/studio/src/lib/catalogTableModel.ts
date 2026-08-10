/**
 * T4.3/T4.4 — Modelo puro de la tabla del catálogo: columnas configurables
 * (persistidas por tienda), helpers de fila (stock, categorías) y duplicado
 * de productos. Los helpers de persistencia aceptan un Storage inyectable
 * para poder testearlos sin navegador.
 */
import type { Product, StoreProjectV1 } from "@solara/project-schema";
import { type FilterFn, filterFns } from "@tanstack/react-table";

export interface CatalogColumnOption {
  id: string;
  label: string;
}

export const catalogColumns: CatalogColumnOption[] = [
  { id: "title", label: "Producto" },
  { id: "brand", label: "Marca" },
  { id: "categories", label: "Categorías" },
  { id: "price", label: "Precio" },
  { id: "status", label: "Estado" },
  { id: "stock", label: "Stock" },
  { id: "variants", label: "Variantes" },
  { id: "updated", label: "Actualizado" },
];

export const catalogColumnIds = catalogColumns.map((column) => column.id);

export const defaultCatalogColumnVisibility: Record<string, boolean> = Object.fromEntries(
  catalogColumnIds.map((id) => [id, true]),
);

export function catalogColumnsStorageKey(storeId: string): string {
  return `solara-catalog-columns:${storeId}`;
}

export function catalogViewStorageKey(storeId: string): string {
  return `solara-catalog-view:${storeId}`;
}

const noopStorage: Pick<Storage, "getItem" | "setItem"> = {
  getItem: () => null,
  setItem: () => undefined,
};

const defaultStorage: Pick<Storage, "getItem" | "setItem"> =
  typeof window === "undefined" ? noopStorage : window.localStorage;

/** Lee la visibilidad de columnas persistida para la tienda; valida las claves. */
export function loadCatalogColumnVisibility(
  storeId: string,
  storage: Pick<Storage, "getItem"> = defaultStorage,
): Record<string, boolean> {
  const raw = storage.getItem(catalogColumnsStorageKey(storeId));
  if (raw === null) return { ...defaultCatalogColumnVisibility };
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      return { ...defaultCatalogColumnVisibility };
    }
    const merged = { ...defaultCatalogColumnVisibility };
    for (const [id, value] of Object.entries(parsed)) {
      if (catalogColumnIds.includes(id) && typeof value === "boolean") {
        merged[id] = value;
      }
    }
    return merged;
  } catch {
    return { ...defaultCatalogColumnVisibility };
  }
}

export function saveCatalogColumnVisibility(
  storeId: string,
  visibility: Record<string, boolean>,
  storage: Pick<Storage, "setItem"> = defaultStorage,
): void {
  storage.setItem(catalogColumnsStorageKey(storeId), JSON.stringify(visibility));
}

/** Lee la vista persistida; cualquier valor desconocido vuelve a la tabla. */
export function loadCatalogView(
  storeId: string,
  storage: Pick<Storage, "getItem"> = defaultStorage,
): "table" | "cards" {
  return storage.getItem(catalogViewStorageKey(storeId)) === "cards" ? "cards" : "table";
}

export function saveCatalogView(
  storeId: string,
  view: "table" | "cards",
  storage: Pick<Storage, "setItem"> = defaultStorage,
): void {
  storage.setItem(catalogViewStorageKey(storeId), view);
}

/** Etiqueta visible (es-AR) del estado de un producto. */
export const productStatusLabel = (status: Product["status"]): string =>
  status === "active" ? "Activo" : status === "hidden" ? "Oculto" : "Archivado";

/** Filtro global del catálogo (H4-S2): la columna de estado matchea tanto el
 *  valor crudo (`active/hidden/archived`) como la etiqueta visible en español
 *  (`Activo/Oculto/Archivado`); el resto de columnas conserva el
 *  `includesString` por defecto de tanstack. */
export const catalogGlobalFilter: FilterFn<Product> = (row, columnId, filterValue, addMeta) => {
  if (columnId === "status") {
    const status = row.getValue<Product["status"]>(columnId);
    const query = String(filterValue).toLocaleLowerCase();
    return (
      status.toLocaleLowerCase().includes(query) ||
      productStatusLabel(status).toLocaleLowerCase().includes(query)
    );
  }
  return filterFns.includesString(row, columnId, filterValue, addMeta);
};

/** Resumen de stock del producto a partir de sus variantes. */
export function productStockLabel(product: Product): string {
  const statuses = product.variants.map((variant) => variant.stockStatus);
  if (statuses.every((status) => status === "out_of_stock")) return "Agotado";
  if (statuses.some((status) => status === "preorder")) return "Preventa";
  return "En stock";
}

/** Títulos de categorías del producto en el orden de asignación. */
export function productCategoryTitles(
  product: Product,
  project: Pick<StoreProjectV1, "categories">,
): string {
  const titles = product.categoryIds
    .map((id) => project.categories.find((category) => category.id === id)?.title)
    .filter((title): title is string => title !== undefined);
  return titles.length > 0 ? titles.join(", ") : "—";
}

/** Copia editable de un producto con id, slug, variantes y fechas nuevas.
 *  Registra el slug nuevo en `takenSlugs` para que una tanda de duplicados
 *  no colisione; los IDs de variante se regeneran porque son únicos globales. */
export function duplicateProduct(
  product: Product,
  takenSlugs: Set<string>,
  stamp = new Date().toISOString(),
): Product {
  const base = product.slug.length > 110 ? product.slug.slice(0, 110) : product.slug;
  let slug = `${base}-copia`;
  let suffix = 2;
  while (takenSlugs.has(slug)) {
    slug = `${base}-copia-${suffix}`;
    suffix += 1;
  }
  takenSlugs.add(slug);
  return {
    ...product,
    id: `product-${crypto.randomUUID()}` as Product["id"],
    slug: slug as Product["slug"],
    variants: product.variants.map((variant) => ({
      ...variant,
      id: `variant-${crypto.randomUUID()}` as typeof variant.id,
    })),
    createdAt: stamp,
    updatedAt: stamp,
  };
}
