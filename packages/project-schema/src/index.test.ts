import { describe, expect, it } from "vitest";
import { referenceStore } from "./fixture";
import {
  MoneySchema,
  migrateProject,
  SlugSchema,
  type StoreProjectV1,
  StoreProjectV1Schema,
} from "./index";

function invalidProject(mutator: (project: StoreProjectV1) => void): StoreProjectV1 {
  const project = structuredClone(referenceStore);
  mutator(project);
  return project;
}

describe("StoreProjectV1Schema", () => {
  it("valida el fixture compartido", () => {
    expect(StoreProjectV1Schema.parse(referenceStore)).toEqual(referenceStore);
  });

  it("rechaza dinero fraccionario y slugs inválidos", () => {
    expect(MoneySchema.safeParse(19.99).success).toBe(false);
    expect(SlugSchema.safeParse("Manta Bruma").success).toBe(false);
  });

  it("rechaza versiones sin migración", () => {
    expect(() => migrateProject({ ...referenceStore, schemaVersion: 2 })).toThrow(
      "Versión de proyecto incompatible",
    );
  });

  it("rechaza IDs duplicados de entidades y variantes", () => {
    const duplicateProduct = invalidProject((project) => {
      const first = project.products[0];
      if (first) project.products.push(structuredClone(first));
    });
    expect(() => StoreProjectV1Schema.parse(duplicateProduct)).toThrow("ID de producto duplicado");

    const duplicateVariant = invalidProject((project) => {
      const firstVariant = project.products[0]?.variants[0];
      const secondVariant = project.products[1]?.variants[0];
      if (firstVariant && secondVariant) secondVariant.id = firstVariant.id;
    });
    expect(() => StoreProjectV1Schema.parse(duplicateVariant)).toThrow("ID de variante duplicado");

    const duplicateSection = invalidProject((project) => {
      const first = project.sections[0];
      if (first) project.sections.push(structuredClone(first));
    });
    expect(() => StoreProjectV1Schema.parse(duplicateSection)).toThrow("ID de sección duplicado");
  });

  it("rechaza slugs duplicados por familia", () => {
    const duplicateProductSlug = invalidProject((project) => {
      const first = project.products[0];
      const second = project.products[1];
      if (first && second) second.slug = first.slug;
    });
    expect(() => StoreProjectV1Schema.parse(duplicateProductSlug)).toThrow(
      "Slug de producto duplicado",
    );

    const duplicateCategorySlug = invalidProject((project) => {
      const first = project.categories[0];
      const second = project.categories[1];
      if (first && second) second.slug = first.slug;
    });
    expect(() => StoreProjectV1Schema.parse(duplicateCategorySlug)).toThrow(
      "Slug de categoría duplicado",
    );
  });

  it("rechaza referencias inexistentes e índices inversos incoherentes", () => {
    const missingCategory = invalidProject((project) => {
      const product = project.products[0];
      const existing = project.categories[0];
      if (product && existing)
        product.categoryIds = [`${existing.id}-missing` as typeof existing.id];
    });
    expect(() => StoreProjectV1Schema.parse(missingCategory)).toThrow("Categoría del producto");

    const missingAsset = invalidProject((project) => {
      const product = project.products[0];
      const existing = project.assets[0];
      if (product && existing) product.imageIds = [`${existing.id}-missing` as typeof existing.id];
    });
    expect(() => StoreProjectV1Schema.parse(missingAsset)).toThrow("Imagen del producto");

    const inconsistentIndex = invalidProject((project) => {
      const category = project.categories[0];
      if (category) category.productIds = [];
    });
    expect(() => StoreProjectV1Schema.parse(inconsistentIndex)).toThrow(
      "no coincide con las asignaciones",
    );
  });

  it("rechaza cronología imposible", () => {
    const invalidTimestamp = invalidProject((project) => {
      project.updatedAt = "2020-01-01T00:00:00.000Z";
    });
    expect(() => StoreProjectV1Schema.parse(invalidTimestamp)).toThrow(
      "updatedAt anterior a createdAt",
    );
  });
});
