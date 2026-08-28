import { type StoreProjectV2, StoreProjectV2Schema } from "@solara/project-schema";
import { catalogModernStore } from "@solara/project-schema/catalog-modern-fixture";
import {
  buildCatalogModernProject,
  CATALOG_MODERN_TEMPLATE_VERSION,
} from "@solara/project-schema/catalog-modern-template";
import { isBaseTemplate } from "@solara/project-schema/project-policy";
import { describe, expect, it } from "vitest";
import { defaultMigrationId, migrationApplies, resolveMigration } from "./migration-registry.js";

function fuzzProject(seed: number): StoreProjectV2 {
  const project = buildCatalogModernProject({
    seed: seed % 2 === 0 ? "demo" : "placeholder",
    id: `store-migration-fuzz-${seed}`,
    name: `Migración fuzz ${seed}`,
    slug: `migracion-fuzz-${seed}`,
  });
  const firstAsset = project.assets[0];
  const firstProduct = project.products[0];
  if (!firstAsset || !firstProduct) throw new Error("fixture de migración incompleto");

  const removedSectionId = seed % 3 === 0 ? "modo-section-brands" : undefined;
  const heroTitle = `Personalización previa ${seed}`;
  const sections = project.sections
    .filter((section) => section.id !== removedSectionId)
    .map((section) => {
      if (section.moduleId === "catalog-hero" && seed % 2 === 0) {
        return { ...section, settings: { ...section.settings, title: heroTitle } };
      }
      if (section.moduleId === "catalog-testimonials" && seed % 2 === 1) {
        const items = section.settings.items as Array<Record<string, unknown>>;
        return { ...section, settings: { ...section.settings, items: [...items].reverse() } };
      }
      return section;
    });
  if (seed % 5 === 0) {
    const source = sections[0];
    if (!source) throw new Error("fixture sin secciones");
    sections.push({ ...structuredClone(source), id: `modo-section-custom-${seed}` });
  }

  const ownedAsset = {
    ...structuredClone(firstAsset),
    id: `asset-owned-${seed}`,
    name: `Asset propio ${seed}`,
    source: `/uploads/owned-${seed}.webp`,
    hash: `owned-hash-${seed}`,
  };
  const products = project.products.map((product, index) =>
    index === 0
      ? {
          ...product,
          status: "archived" as const,
          imageIds: [...product.imageIds, ownedAsset.id],
        }
      : product,
  );

  return StoreProjectV2Schema.parse({
    ...project,
    navigation: { ...project.navigation, catalogLabel: "Colecciones" },
    origin: {
      ...project.origin,
      templateVersion: 1,
      seed: seed % 2 === 0 ? "demo" : "placeholder",
      role: "store",
      updatePolicy: "managed",
    },
    sections,
    assets: [...project.assets, ownedAsset],
    products,
  });
}

describe("N6 Migration & Rollout Fuzz", () => {
  it("preserva personalizaciones, assets, estados, repeaters y secciones en clones", () => {
    const migration = resolveMigration(defaultMigrationId());
    if (!migration) throw new Error("migración Catalog Modern ausente");

    for (let seed = 0; seed < 30; seed += 1) {
      const project = fuzzProject(seed);
      expect(migrationApplies(defaultMigrationId(), project)).toBe(true);
      const preview = migration.preview(project);
      expect(preview.safeChanges).toContain("template.version");
      expect(migration.fromTemplateVersion).toBe(1);
      expect(migration.toTemplateVersion).toBe(CATALOG_MODERN_TEMPLATE_VERSION);

      const accepted = [...preview.safeChanges];
      const upgraded = migration.apply(project, accepted);
      expect(upgraded.origin?.templateVersion).toBe(CATALOG_MODERN_TEMPLATE_VERSION);
      expect(upgraded.navigation.catalogLabel).toBe("Categorías");
      expect(upgraded.products[0]?.status).toBe("archived");
      expect(upgraded.assets.some((asset) => asset.id === `asset-owned-${seed}`)).toBe(true);

      if (seed % 3 === 0) {
        expect(upgraded.sections.some((section) => section.id === "modo-section-brands")).toBe(
          true,
        );
      }
      if (seed % 2 === 0) {
        expect(
          upgraded.sections.find((section) => section.moduleId === "catalog-hero")?.settings.title,
        ).toBe(`Personalización previa ${seed}`);
        expect(preview.preserved).toContain("sections.modo-section-hero.settings");
      } else {
        const before = project.sections.find(
          (section) => section.moduleId === "catalog-testimonials",
        );
        const after = upgraded.sections.find(
          (section) => section.moduleId === "catalog-testimonials",
        );
        expect(after?.settings.items).toEqual(before?.settings.items);
      }
      if (seed % 5 === 0) {
        expect(preview.conflicts).toContain(`section.removed.modo-section-custom-${seed}`);
        expect(
          upgraded.sections.some((section) => section.id === `modo-section-custom-${seed}`),
        ).toBe(true);
      }

      const repeated = migration.apply(upgraded, accepted);
      expect(JSON.stringify(repeated)).toBe(JSON.stringify(upgraded));

      // El proyecto puede cambiar después del preview: aplicar los cambios
      // seguros no debe pisar la personalización nueva ni los datos propios.
      const changedAfterPreview = StoreProjectV2Schema.parse({
        ...project,
        sections: project.sections.map((section) =>
          section.moduleId === "catalog-hero"
            ? { ...section, settings: { ...section.settings, title: `Posterior ${seed}` } }
            : section,
        ),
      });
      const appliedAfterPreview = migration.apply(changedAfterPreview, accepted);
      expect(
        appliedAfterPreview.sections.find((section) => section.moduleId === "catalog-hero")
          ?.settings.title,
      ).toBe(`Posterior ${seed}`);
      expect(appliedAfterPreview.assets.some((asset) => asset.id === `asset-owned-${seed}`)).toBe(
        true,
      );
      expect(StoreProjectV2Schema.safeParse(appliedAfterPreview).success).toBe(true);
    }
  });

  it("mantiene la política de plantilla separada de los clones mutables", () => {
    const template = StoreProjectV2Schema.parse({
      ...catalogModernStore,
      origin: { ...catalogModernStore.origin, role: "base-template", updatePolicy: "pinned" },
    });
    const clone = fuzzProject(91);
    expect(isBaseTemplate(template)).toBe(true);
    expect(isBaseTemplate(clone)).toBe(false);
  });
});
