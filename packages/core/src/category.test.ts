import { catalogScaleStore } from "@solara/project-schema/scale-fixture";
import { describe, expect, it } from "vitest";
import { createHistory, executeCommand, redo, reduceProject, undo } from "./index";

describe("jerarquía de categorías en el dominio", () => {
  it("recalcula productos heredados al reubicar una categoría", () => {
    const textiles = catalogScaleStore.categories.find((category) => category.slug === "textiles");
    const cocina = catalogScaleStore.categories.find((category) => category.slug === "cocina");
    const casa = catalogScaleStore.categories.find((category) => category.slug === "casa");
    if (!textiles || !cocina || !casa) throw new Error("Fixture incompleto");

    const moved = reduceProject(catalogScaleStore, {
      type: "category.reparent",
      categoryId: textiles.id,
      parentId: cocina.id,
      at: "2026-07-30T10:00:00.000Z",
    });

    expect(moved.categories.find((category) => category.id === textiles.id)?.parentId).toBe(
      cocina.id,
    );
    expect(moved.categories.find((category) => category.id === casa.id)?.productIds).toHaveLength(
      18,
    );
    expect(
      moved.categories.find((category) => category.id === cocina.id)?.productIds.length,
    ).toBeGreaterThan(
      catalogScaleStore.categories.find((category) => category.id === cocina.id)?.productIds
        .length ?? 0,
    );
  });

  it("rechaza una reubicación que crea más de un nivel", () => {
    const textiles = catalogScaleStore.categories.find((category) => category.slug === "textiles");
    const ceramica = catalogScaleStore.categories.find((category) => category.slug === "ceramica");
    const decoracion = catalogScaleStore.categories.find(
      (category) => category.slug === "decoracion",
    );
    if (!textiles || !ceramica || !decoracion) throw new Error("Fixture incompleto");

    expect(() =>
      reduceProject(catalogScaleStore, {
        type: "category.reparent",
        categoryId: decoracion.id,
        parentId: textiles.id,
        at: "2026-07-30T10:00:00.000Z",
      }),
    ).toThrow(/nivel/);
    expect(ceramica.parentId).toBe("category-cocina");
  });

  it("conserva reparentado en undo y redo", () => {
    const textiles = catalogScaleStore.categories.find((category) => category.slug === "textiles");
    const cocina = catalogScaleStore.categories.find((category) => category.slug === "cocina");
    if (!textiles || !cocina) throw new Error("Fixture incompleto");

    const changed = executeCommand(createHistory(catalogScaleStore), {
      type: "category.reparent",
      categoryId: textiles.id,
      parentId: cocina.id,
      at: "2026-07-30T10:00:00.000Z",
    });
    expect(undo(changed).present).toEqual(catalogScaleStore);
    expect(
      redo(undo(changed)).present.categories.find((category) => category.id === textiles.id)
        ?.parentId,
    ).toBe(cocina.id);
  });
});
