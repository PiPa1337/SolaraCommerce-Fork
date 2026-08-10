/**
 * T4.3/T4.4 — Modelo puro de la tabla del catálogo: columnas configurables,
 * stock, categorías, duplicado y persistencia por tienda.
 */
import { generatePerformanceFixture } from "@solara/core";
import type { Product } from "@solara/project-schema";
import type { Row } from "@tanstack/react-table";
import { describe, expect, it } from "vitest";
import {
  catalogColumnIds,
  catalogColumnsStorageKey,
  catalogGlobalFilter,
  catalogViewStorageKey,
  defaultCatalogColumnVisibility,
  duplicateProduct,
  loadCatalogColumnVisibility,
  loadCatalogView,
  productCategoryTitles,
  productStatusLabel,
  productStockLabel,
  saveCatalogColumnVisibility,
  saveCatalogView,
} from "./catalogTableModel";

class MemoryStorage implements Storage {
  readonly values = new Map<string, string>();
  get length() {
    return this.values.size;
  }
  clear() {
    this.values.clear();
  }
  getItem(key: string) {
    return this.values.get(key) ?? null;
  }
  key(index: number) {
    return [...this.values.keys()][index] ?? null;
  }
  removeItem(key: string) {
    this.values.delete(key);
  }
  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
}

describe("columnas configurables", () => {
  it("devuelve las siete columnas por defecto visibles sin preferencia guardada", () => {
    expect(loadCatalogColumnVisibility("store-1", new MemoryStorage())).toEqual(
      defaultCatalogColumnVisibility,
    );
    expect(catalogColumnIds).toEqual([
      "title",
      "categories",
      "price",
      "status",
      "stock",
      "variants",
      "updated",
    ]);
  });

  it("persiste y recupera la visibilidad por tienda", () => {
    const storage = new MemoryStorage();
    const next = { ...defaultCatalogColumnVisibility, categories: false, stock: false };
    saveCatalogColumnVisibility("store-1", next, storage);
    expect(loadCatalogColumnVisibility("store-1", storage)).toEqual(next);
    expect(loadCatalogColumnVisibility("store-2", storage)).toEqual(defaultCatalogColumnVisibility);
    expect(storage.getItem(catalogColumnsStorageKey("store-1"))).toBe(JSON.stringify(next));
  });

  it("ignora claves desconocidas, valores inválidos y JSON corrupto", () => {
    const storage = new MemoryStorage();
    storage.setItem(
      catalogColumnsStorageKey("store-1"),
      JSON.stringify({ hola: true, price: "x" }),
    );
    expect(loadCatalogColumnVisibility("store-1", storage).price).toBe(true);
    storage.setItem(catalogColumnsStorageKey("store-1"), "{no-json");
    expect(loadCatalogColumnVisibility("store-1", storage)).toEqual(defaultCatalogColumnVisibility);
  });

  it("persiste la vista de tarjetas y lista por tienda", () => {
    const storage = new MemoryStorage();
    expect(loadCatalogView("store-1", storage)).toBe("table");
    saveCatalogView("store-1", "cards", storage);
    expect(loadCatalogView("store-1", storage)).toBe("cards");
    expect(loadCatalogView("store-2", storage)).toBe("table");
    expect(storage.getItem(catalogViewStorageKey("store-1"))).toBe("cards");
  });
});

describe("filtro global y etiquetas de estado (H4-S2)", () => {
  const project = generatePerformanceFixture(3);
  const base = project.products[0];
  if (!base) throw new Error("El fixture debe tener al menos un producto.");

  const productWithStatus = (status: Product["status"]): Product => ({ ...base, status });
  const rowFor = (product: Product): Row<Product> =>
    ({
      getValue: (columnId: string) =>
        columnId === "status" ? product.status : product[columnId as keyof Product],
    }) as unknown as Row<Product>;
  const globalFilter = (row: Row<Product>, columnId: string, value: unknown) =>
    catalogGlobalFilter(row, columnId, value, () => undefined);

  it("traduce el estado a su etiqueta visible", () => {
    expect(productStatusLabel("active")).toBe("Activo");
    expect(productStatusLabel("hidden")).toBe("Oculto");
    expect(productStatusLabel("archived")).toBe("Archivado");
  });

  it("matchea el estado por la etiqueta visible además del valor crudo", () => {
    const active = rowFor(productWithStatus("active"));
    expect(globalFilter(active, "status", "Activo")).toBe(true);
    expect(globalFilter(active, "status", "activo")).toBe(true);
    expect(globalFilter(active, "status", "active")).toBe(true);
    expect(globalFilter(active, "status", "act")).toBe(true);
    expect(globalFilter(active, "status", "Archivado")).toBe(false);

    const hidden = rowFor(productWithStatus("hidden"));
    expect(globalFilter(hidden, "status", "Oculto")).toBe(true);
    expect(globalFilter(hidden, "status", "ocult")).toBe(true);
    expect(globalFilter(hidden, "status", "hidden")).toBe(true);
    expect(globalFilter(hidden, "status", "Activo")).toBe(false);

    const archived = rowFor(productWithStatus("archived"));
    expect(globalFilter(archived, "status", "Archivado")).toBe(true);
    expect(globalFilter(archived, "status", "archiv")).toBe(true);
    expect(globalFilter(archived, "status", "archived")).toBe(true);
    expect(globalFilter(archived, "status", "activo")).toBe(false);
  });

  it("conserva el includesString por defecto para el resto de columnas", () => {
    expect(globalFilter(rowFor(base), "title", base.title.slice(0, 6))).toBe(true);
    expect(globalFilter(rowFor(base), "brand", base.brand.toLowerCase())).toBe(true);
    expect(globalFilter(rowFor(base), "title", "no-existe-xyz")).toBe(false);
  });
});

describe("helpers de fila", () => {
  const project = generatePerformanceFixture(3);
  const first = project.products[0];
  const second = project.products[1];
  const third = project.products[2];
  if (!first || !second || !third) {
    throw new Error("El fixture debe tener al menos tres productos.");
  }

  it("resume el stock de las variantes", () => {
    expect(productStockLabel(first)).toBe("En stock");
    expect(productStockLabel(second)).toBe("En stock");
    expect(productStockLabel(third)).toBe("En stock");
  });

  it("marca agotado cuando todas las variantes están agotadas", () => {
    const product = {
      ...first,
      variants: first.variants.map((variant) => ({
        ...variant,
        stockStatus: "out_of_stock" as const,
      })),
    };
    expect(productStockLabel(product)).toBe("Agotado");
  });

  it("marca preventa cuando alguna variante está en preventa", () => {
    const product = {
      ...first,
      variants: first.variants.map((variant, index) => ({
        ...variant,
        stockStatus: (index === 0 ? "preorder" : "in_stock") as "preorder" | "in_stock",
      })),
    };
    expect(productStockLabel(product)).toBe("Preventa");
  });

  it("une los títulos de categorías y muestra un guión sin asignación", () => {
    expect(productCategoryTitles(first, project)).toBe("Textiles");
    expect(
      productCategoryTitles({ ...first, categoryIds: [] as typeof first.categoryIds }, project),
    ).toBe("—");
  });

  it("duplica un producto con slug, id y fechas nuevas sin repetir slug", () => {
    const firstVariant = first.variants[0];
    if (!firstVariant) throw new Error("El primer producto debe tener una variante.");
    const taken = new Set(project.products.map((candidate) => candidate.slug));
    const copy = duplicateProduct(first, taken, "2026-08-07T12:00:00.000Z");
    const copyVariant = copy.variants[0];
    if (!copyVariant) throw new Error("La copia debe conservar las variantes.");
    expect(copy.id).not.toBe(first.id);
    expect(copy.slug).toBe(`${first.slug}-copia`);
    expect(taken.has(copy.slug)).toBe(true);
    expect(copy.createdAt).toBe("2026-08-07T12:00:00.000Z");
    expect(copy.updatedAt).toBe("2026-08-07T12:00:00.000Z");
    expect(copy.variants).toHaveLength(first.variants.length);
    expect(copyVariant.sku).toBe(firstVariant.sku);
    expect(copyVariant.title).toBe(firstVariant.title);
    expect(copyVariant.price).toBe(firstVariant.price);
    copy.variants.forEach((variant, index) => {
      expect(variant.id).not.toBe(first.variants[index]?.id);
    });
    expect(copy.title).toBe(first.title);

    const second = duplicateProduct(first, taken, "2026-08-07T12:00:01.000Z");
    expect(second.slug).toBe(`${first.slug}-copia-2`);
  });
});
