import { describe, expect, it } from "vitest";
import {
  getCategoryAncestors,
  getCategoryBreadcrumb,
  getCategoryDescendants,
  getCategoryProductIds,
  StoreProjectV2Schema,
} from "./index";
import { catalogScaleStore } from "./scale-fixture";

describe("fixture de catálogo jerárquico", () => {
  it("mantiene 50 productos, 15 categorías y 60 variantes", () => {
    expect(catalogScaleStore.products).toHaveLength(50);
    expect(catalogScaleStore.categories).toHaveLength(15);
    expect(catalogScaleStore.categories.filter((category) => !category.parentId)).toHaveLength(9);
    expect(catalogScaleStore.categories.filter((category) => category.parentId)).toHaveLength(6);
    expect(catalogScaleStore.products.flatMap((product) => product.variants)).toHaveLength(60);

    const casa = catalogScaleStore.categories.find((category) => category.slug === "casa");
    const textiles = catalogScaleStore.categories.find((category) => category.slug === "textiles");
    if (!casa || !textiles) throw new Error("Fixture de escala incompleto");

    expect(
      catalogScaleStore.categories.some((category) =>
        ["sale", "novedades"].includes(category.slug),
      ),
    ).toBe(false);
    expect(
      getCategoryDescendants(catalogScaleStore, casa.id).map((category) => category.slug),
    ).toEqual(["textiles", "decoracion", "iluminacion"]);
    expect(
      getCategoryAncestors(catalogScaleStore, textiles.id).map((category) => category.slug),
    ).toEqual(["casa"]);
    expect(
      getCategoryBreadcrumb(catalogScaleStore, textiles.id).map((category) => category.slug),
    ).toEqual(["casa", "textiles"]);
    expect(getCategoryProductIds(catalogScaleStore, casa.id)).toHaveLength(28);
  });

  it("rechaza padres inexistentes, ciclos y más de un nivel", () => {
    const missingParent = structuredClone(catalogScaleStore);
    const missingCategory = missingParent.categories[0];
    if (!missingCategory) throw new Error("Fixture de escala incompleto");
    missingCategory.parentId = "missing-parent" as typeof missingCategory.id;
    expect(() => StoreProjectV2Schema.parse(missingParent)).toThrow(/padre/);

    const cycle = structuredClone(catalogScaleStore);
    const first = cycle.categories[0];
    const second = cycle.categories[1];
    if (!first || !second) throw new Error("Fixture de escala incompleto");
    first.parentId = second.id;
    second.parentId = first.id;
    expect(() => StoreProjectV2Schema.parse(cycle)).toThrow(/jerarquía|nivel/);

    const tooDeep = structuredClone(catalogScaleStore);
    const root = tooDeep.categories[0];
    const child = tooDeep.categories[1];
    const grandchild = tooDeep.categories[2];
    if (!root || !child || !grandchild) throw new Error("Fixture de escala incompleto");
    child.parentId = root.id;
    grandchild.parentId = child.id;
    expect(() => StoreProjectV2Schema.parse(tooDeep)).toThrow(/nivel/);
  });
});
