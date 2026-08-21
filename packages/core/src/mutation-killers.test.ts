import { catalogModernStore } from "@solara/project-schema/catalog-modern-fixture";
import { referenceStore } from "@solara/project-schema/fixture";
import { describe, expect, it } from "vitest";
import { adjustPrice, reduceProject } from "./index";

describe("mutation-killers: core / comandos", () => {
  it("adjustPrice amount no permite precio negativo (clamp a 0)", () => {
    expect(adjustPrice(500, { type: "amount", cents: -1000 })).toBe(0);
    // mutación quitar Math.max(0, ...) devolvería -500 y fallaría
    expect(adjustPrice(500, { type: "amount", cents: -500 })).toBe(0);
    expect(adjustPrice(1000, { type: "amount", cents: 500 })).toBe(1500);
  });
  it("adjustPrice percentage -100% lleva a 0 y -101% rechaza", () => {
    expect(adjustPrice(1000, { type: "percentage", basisPoints: -10000 })).toBe(0);
    expect(() => adjustPrice(1000, { type: "percentage", basisPoints: -10001 as any })).toThrow();
    // mutación que use float en lugar de bigint/divideAndRound produciría off-by-one
    expect(adjustPrice(999, { type: "percentage", basisPoints: 1000 })).toBe(1099); // +10%
  });
  it("adjustPrice rechaza basisPoints no entero", () => {
    expect(() => adjustPrice(1000, { type: "percentage", basisPoints: 10.5 as any })).toThrow();
  });
  it("ignorar productId inexistente lanza error (mutacion quitar guard)", () => {
    expect(() =>
      reduceProject(referenceStore, {
        type: "product.archive",
        productId: "nonexistent" as any,
        at: "2026-08-20T10:00:00.000Z",
      }),
    ).toThrow(/inexistente/i);
    // mutación que quitara validación y no lanzara permitiría corrupción silenciosa
  });
  it("products.adjustPrices no deja float en precios", () => {
    const product = referenceStore.products[0]!;
    const result = reduceProject(referenceStore, {
      type: "products.adjustPrices",
      productIds: [product.id],
      adjustment: { type: "percentage", basisPoints: 3333 }, // 33.33%
      at: "2026-08-20T10:00:00.000Z",
    });
    const updated = result.products.find((p) => p.id === product.id)?.variants[0]!;
    expect(Number.isInteger(updated.price)).toBe(true);
    expect(updated.price).toBeGreaterThanOrEqual(0);
  });
  it("category.reparent mantiene invariante producto-categoria (no huérfano)", () => {
    const source = catalogModernStore as unknown as typeof referenceStore;
    const root = source.categories.find((c) => !c.parentId)!;
    const child = source.categories.find((c) => c.parentId === root.id)!;
    const otherRoot = source.categories.find((c) => !c.parentId && c.id !== root.id)!;
    const prodBefore = source.products.find((p) => p.categoryIds.includes(child.id));
    const moved = reduceProject(source, {
      type: "category.reparent",
      categoryId: child.id as any,
      parentId: otherRoot.id as any,
      at: "2026-08-20T10:00:00.000Z",
    });
    expect(moved.categories.find((c) => c.id === child.id)?.parentId).toBe(otherRoot.id);
    if (prodBefore) {
      // tras mover, el nuevo padre hereda productos del hijo; el viejo padre ya no
      expect(moved.categories.find((c) => c.id === otherRoot.id)?.productIds).toContain(
        prodBefore.id,
      );
      expect(moved.categories.find((c) => c.id === root.id)?.productIds).not.toContain(
        prodBefore.id,
      );
      expect(moved.categories.find((c) => c.id === child.id)?.productIds).toContain(prodBefore.id);
    }
  });
});
