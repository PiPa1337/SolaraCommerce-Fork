import { StoreProjectV2Schema } from "@solara/project-schema";
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

  it("devuelve a la raíz sin parentId y el resultado pasa el schema", () => {
    const textiles = catalogScaleStore.categories.find((category) => category.slug === "textiles");
    const casa = catalogScaleStore.categories.find((category) => category.slug === "casa");
    if (!textiles || !casa) throw new Error("Fixture incompleto");
    const textilesProductIds = catalogScaleStore.categories.find(
      (category) => category.id === textiles.id,
    )?.productIds;

    const moved = reduceProject(catalogScaleStore, {
      type: "category.reparent",
      categoryId: textiles.id,
      at: "2026-07-30T10:00:00.000Z",
    });

    const root = moved.categories.find((category) => category.id === textiles.id);
    expect(root?.parentId).toBeUndefined();
    expect("parentId" in (root ?? {})).toBe(false);
    expect(JSON.stringify(moved)).not.toContain('"parentId":""');
    expect(root?.productIds).toEqual(textilesProductIds);
    expect(moved.categories.find((category) => category.id === casa.id)?.productIds).toHaveLength(
      18,
    );
    expect(() => StoreProjectV2Schema.parse(moved)).not.toThrow();
  });

  it("rechaza reubicar una raíz con subcategorías bajo otra categoría", () => {
    const casa = catalogScaleStore.categories.find((category) => category.slug === "casa");
    const cocina = catalogScaleStore.categories.find((category) => category.slug === "cocina");
    if (!casa || !cocina) throw new Error("Fixture incompleto");

    expect(() =>
      reduceProject(catalogScaleStore, {
        type: "category.reparent",
        categoryId: casa.id,
        parentId: cocina.id,
        at: "2026-07-30T10:00:00.000Z",
      }),
    ).toThrow(/subcategorías/);
    expect(catalogScaleStore.categories.find((category) => category.id === casa.id)?.parentId).toBe(
      undefined,
    );
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
