import { referenceStore } from "@solara/project-schema/fixture";
import { describe, expect, it } from "vitest";
import {
  adjustPrice,
  createHistory,
  executeCommand,
  exportProductsCsv,
  generatePerformanceFixture,
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
});

describe("fixture de rendimiento", () => {
  it("genera 1.000 productos y variantes deterministas", () => {
    const fixture = generatePerformanceFixture(1_000);
    expect(fixture.products).toHaveLength(1_000);
    expect(fixture.products.every((product) => product.variants.length === 2)).toBe(true);
    expect(fixture).toEqual(generatePerformanceFixture(1_000));
  });
});
