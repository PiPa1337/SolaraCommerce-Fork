import { StoreProjectV2Schema } from "@solara/project-schema";
import { catalogModernCleanStore } from "@solara/project-schema/catalog-modern-template";
import { catalogScaleStore } from "@solara/project-schema/scale-fixture";
import { describe, expect, it } from "vitest";
import { createHistory, executeCommand, redo, reduceProject, undo } from "./index";

describe("jerarquía de categorías en el dominio", () => {
  it("crea y edita categorías y colecciones desde un proyecto limpio", () => {
    const category = {
      id: "category-ropa" as const,
      slug: "ropa" as const,
      title: "Ropa",
      description: "Prendas de la colección.",
      productIds: [],
    };
    const child = {
      id: "category-ropa-invierno" as const,
      slug: "ropa-invierno" as const,
      title: "Invierno",
      description: "Abrigos y prendas cálidas.",
      parentId: category.id,
      productIds: [],
    };
    const created = reduceProject(catalogModernCleanStore, {
      type: "category.create",
      category,
      at: "2026-08-23T10:00:00.000Z",
    });
    const withChild = reduceProject(created, {
      type: "category.create",
      category: child,
      at: "2026-08-23T10:01:00.000Z",
    });
    const withCollection = reduceProject(withChild, {
      type: "collection.create",
      collection: {
        id: "collection-invierno",
        slug: "invierno",
        title: "Invierno",
        description: "Selección de invierno.",
        productIds: [],
      },
      at: "2026-08-23T10:02:00.000Z",
    });
    const edited = reduceProject(withCollection, {
      type: "category.update",
      categoryId: category.id,
      changes: { title: "Ropa esencial", description: "Prendas esenciales." },
      at: "2026-08-23T10:03:00.000Z",
    });

    expect(edited.categories.find((item) => item.id === category.id)?.title).toBe("Ropa esencial");
    expect(edited.categories.find((item) => item.id === child.id)?.parentId).toBe(category.id);
    expect(edited.collections).toHaveLength(1);
    expect(() => StoreProjectV2Schema.parse(edited)).not.toThrow();
  });

  it("rechaza slugs públicos reservados y una tercera profundidad", () => {
    const root = {
      id: "category-root" as const,
      slug: "ropa" as const,
      title: "Ropa",
      description: "",
      productIds: [],
    };
    const child = {
      id: "category-child" as const,
      slug: "ropa-casual" as const,
      title: "Casual",
      description: "",
      parentId: root.id,
      productIds: [],
    };
    const project = reduceProject(catalogModernCleanStore, {
      type: "category.create",
      category: root,
      at: "2026-08-23T11:00:00.000Z",
    });
    const nested = reduceProject(project, {
      type: "category.create",
      category: child,
      at: "2026-08-23T11:01:00.000Z",
    });
    expect(() =>
      reduceProject(nested, {
        type: "category.create",
        category: {
          id: "category-third",
          slug: "ropa-casual-invierno",
          title: "Invierno",
          description: "",
          parentId: child.id,
          productIds: [],
        },
        at: "2026-08-23T11:02:00.000Z",
      }),
    ).toThrow(/nivel/);
    expect(() =>
      reduceProject(catalogModernCleanStore, {
        type: "collection.create",
        collection: {
          id: "collection-reserved",
          slug: "productos",
          title: "Productos",
          description: "",
          productIds: [],
        },
        at: "2026-08-23T11:03:00.000Z",
      }),
    ).toThrow(/reservado/);
  });

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

  it("mantiene la misma referencia para actualizaciones sin cambios", () => {
    const category = catalogScaleStore.categories[0];
    const collection = catalogScaleStore.collections[0];
    if (!category || !collection) throw new Error("Fixture incompleto");

    expect(
      reduceProject(catalogScaleStore, {
        type: "category.update",
        categoryId: category.id,
        changes: { title: category.title },
        at: "2026-08-23T12:00:00.000Z",
      }),
    ).toBe(catalogScaleStore);
    expect(
      reduceProject(catalogScaleStore, {
        type: "collection.update",
        collectionId: collection.id,
        changes: { title: collection.title },
        at: "2026-08-23T12:00:00.000Z",
      }),
    ).toBe(catalogScaleStore);
  });
});
