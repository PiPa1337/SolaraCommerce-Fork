import { referenceStore } from "@solara/project-schema/fixture";
import { describe, expect, it } from "vitest";
import {
  adjustPrice,
  createHistory,
  executeCommand,
  exportCatalogCsv,
  exportProductsCsv,
  generatePerformanceFixture,
  importCatalogCsv,
  importProductsCsv,
  redo,
  reduceProject,
  undo,
} from "./index";

const timestamp = "2026-07-30T10:00:00.000Z";
const firstProduct = referenceStore.products[0];

if (firstProduct === undefined) {
  throw new Error("El fixture debe contener al menos un producto.");
}

describe("reduceProject", () => {
  it("es determinista para el mismo estado y comando", () => {
    const command = {
      type: "products.addTags" as const,
      productIds: [firstProduct.id],
      tags: ["destacado"],
      at: timestamp,
    };

    expect(reduceProject(referenceStore, command)).toEqual(reduceProject(referenceStore, command));
  });

  it("archiva y restaura productos", () => {
    const archived = reduceProject(referenceStore, {
      type: "product.archive",
      productId: firstProduct.id,
      at: timestamp,
    });
    expect(archived.products[0]?.status).toBe("archived");

    const restored = reduceProject(archived, {
      type: "product.restore",
      productId: firstProduct.id,
      at: "2026-07-30T11:00:00.000Z",
    });
    expect(restored.products[0]?.status).toBe("active");
  });

  it("ajusta precios masivos con enteros y redondeo estable", () => {
    expect(adjustPrice(10_001, { type: "percentage", basisPoints: 1_250 })).toBe(11_251);
    expect(adjustPrice(50, { type: "percentage", basisPoints: -5_000 })).toBe(25);
    expect(adjustPrice(50, { type: "amount", cents: -100 })).toBe(0);

    const adjusted = reduceProject(referenceStore, {
      type: "products.adjustPrices",
      productIds: referenceStore.products.map((product) => product.id),
      adjustment: { type: "percentage", basisPoints: 750 },
      at: timestamp,
    });

    for (const product of adjusted.products) {
      for (const variant of product.variants) {
        expect(Number.isInteger(variant.price)).toBe(true);
      }
    }
  });

  it("rechaza comandos con productos inexistentes sin cambios parciales", () => {
    const before = structuredClone(referenceStore);
    expect(() =>
      reduceProject(referenceStore, {
        type: "products.addTags",
        productIds: [firstProduct.id, "product-missing" as typeof firstProduct.id],
        tags: ["no-debe-aplicarse"],
        at: timestamp,
      }),
    ).toThrow("Productos inexistentes");
    expect(referenceStore).toEqual(before);
  });

  it("mantiene la misma referencia para operaciones sin cambios", () => {
    const unchanged = reduceProject(referenceStore, {
      type: "products.setStatus",
      productIds: [firstProduct.id],
      status: firstProduct.status,
      at: timestamp,
    });
    expect(unchanged).toBe(referenceStore);
  });

  it("no retrocede updatedAt si el reloj del dispositivo está atrasado", () => {
    const changed = reduceProject(referenceStore, {
      type: "product.update",
      productId: firstProduct.id,
      changes: { title: "Cambio con reloj atrasado" },
      at: "2020-01-01T00:00:00.000Z",
    });
    expect(changed.updatedAt).toBe(referenceStore.updatedAt);
    expect(changed.products[0]?.updatedAt).toBe(referenceStore.updatedAt);
  });

  it("aplica categorías, colecciones, tags y estados de forma coherente", () => {
    const category = referenceStore.categories[1];
    const collection = referenceStore.collections[0];
    if (!category || !collection) throw new Error("Fixture incompleto.");

    const categorized = reduceProject(referenceStore, {
      type: "products.setCategories",
      productIds: [firstProduct.id],
      categoryIds: [category.id],
      at: timestamp,
    });
    expect(categorized.products[0]?.categoryIds).toEqual([category.id]);
    expect(
      categorized.categories.find((candidate) => candidate.id === category.id)?.productIds,
    ).toContain(firstProduct.id);

    const collected = reduceProject(categorized, {
      type: "products.setCollections",
      productIds: [firstProduct.id],
      collectionIds: [collection.id],
      at: "2026-07-30T10:01:00.000Z",
    });
    const tagged = reduceProject(collected, {
      type: "products.addTags",
      productIds: [firstProduct.id],
      tags: ["nuevo", "nuevo"],
      at: "2026-07-30T10:02:00.000Z",
    });
    const cleaned = reduceProject(tagged, {
      type: "products.removeTags",
      productIds: [firstProduct.id],
      tags: ["nuevo"],
      at: "2026-07-30T10:03:00.000Z",
    });
    expect(cleaned.products[0]?.tags).not.toContain("nuevo");
  });
});

describe("historial", () => {
  it("revierte y rehace el estado completo", () => {
    const initial = createHistory(referenceStore);
    const changed = executeCommand(initial, {
      type: "product.update",
      productId: firstProduct.id,
      changes: { title: "Título editado" },
      at: timestamp,
    });

    expect(changed.present.products[0]?.title).toBe("Título editado");
    expect(undo(changed).present).toEqual(referenceStore);
    expect(redo(undo(changed)).present).toEqual(changed.present);
  });

  it("reemplaza todo el catálogo como una sola operación reversible", () => {
    const replacement = referenceStore.products.slice(0, 1);
    const changed = executeCommand(createHistory(referenceStore), {
      type: "products.replaceAll",
      products: replacement,
      at: timestamp,
    });

    expect(changed.present.products).toEqual(replacement);
    expect(undo(changed).present).toEqual(referenceStore);
    expect(redo(undo(changed)).present.products).toEqual(replacement);
  });

  it("normaliza referencias de otra tienda al importar un catálogo", () => {
    const foreignProducts = generatePerformanceFixture(2).products.map((product) => ({
      ...product,
      categoryIds: ["category-externa"] as typeof product.categoryIds,
      collectionIds: ["collection-externa"] as typeof product.collectionIds,
      imageIds: ["asset-externo"] as typeof product.imageIds,
      variants: product.variants.map((variant) => ({
        ...variant,
        imageId: "asset-externo" as NonNullable<typeof variant.imageId>,
      })),
    }));

    const changed = executeCommand(createHistory(referenceStore), {
      type: "products.replaceAll",
      products: foreignProducts,
      at: timestamp,
    });

    expect(changed.present.products).toHaveLength(2);
    expect(changed.present.products[0]?.categoryIds).toEqual([]);
    expect(changed.present.products[0]?.collectionIds).toEqual([]);
    expect(changed.present.products[0]?.imageIds).toEqual([]);
    expect(changed.present.products[0]?.variants[0]?.imageId).toBeUndefined();
  });
});

describe("CSV", () => {
  it("preserva el fixture en un round-trip", () => {
    const csv = exportProductsCsv(referenceStore.products);
    const imported = importProductsCsv(csv);
    expect(imported).toEqual(referenceStore.products);
  });

  it("neutraliza fórmulas de planilla sin perder contenido", () => {
    const products = [
      {
        ...firstProduct,
        title: '=IMPORTXML("https://example.com")',
      },
    ];
    const csv = exportProductsCsv(products);
    expect(csv).toContain("'=IMPORTXML");
    expect(importProductsCsv(csv)).toEqual(products);
  });

  it("acepta BOM, CRLF, comillas y contenido multilínea", () => {
    const products = [
      {
        ...firstProduct,
        description: 'Primera línea\r\nSegunda línea, con "comillas".',
      },
    ];
    const csv = `\uFEFF${exportProductsCsv(products)}`;
    expect(importProductsCsv(csv)).toEqual(products);
  });

  it("preserva 1.000 productos y 2.000 variantes", () => {
    const products = generatePerformanceFixture(1_000).products;
    expect(importProductsCsv(exportProductsCsv(products))).toEqual(products);
  });

  it("exporta e importa el CSV comercial con variantes agrupadas", () => {
    const csv = exportCatalogCsv(referenceStore);
    expect(csv.split("\r\n", 1)[0]).toContain("categorias");
    const imported = importCatalogCsv(csv, referenceStore);
    expect(imported).toEqual(referenceStore.products);
  });
});

describe("fixture de rendimiento", () => {
  it("genera 1.000 productos y variantes deterministas", () => {
    const fixture = generatePerformanceFixture(1_000);
    expect(fixture.products).toHaveLength(1_000);
    expect(fixture.products.every((product) => product.variants.length === 2)).toBe(true);
    expect(fixture).toEqual(generatePerformanceFixture(1_000));
  });

  it("aplica una acción masiva a 1.000 productos en menos de un segundo", () => {
    const fixture = generatePerformanceFixture(1_000);
    const startedAt = performance.now();
    const result = reduceProject(fixture, {
      type: "products.setStatus",
      productIds: fixture.products.map((product) => product.id),
      status: "archived",
      at: "2026-07-30T12:00:00.000Z",
    });
    const elapsed = performance.now() - startedAt;

    expect(result.products.every((product) => product.status === "archived")).toBe(true);
    expect(elapsed).toBeLessThan(1_000);
  });
});
