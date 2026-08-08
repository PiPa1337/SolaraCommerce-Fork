import type { ImageAsset } from "@solara/project-schema";
import { catalogModernStore } from "@solara/project-schema/catalog-modern-fixture";
import { describe, expect, it } from "vitest";
import { assetUses } from "./assetUses";

const slideAsset = "asset-slide-1" as ImageAsset["id"];
const topLevelAsset = "asset-slide-top" as ImageAsset["id"];
const notCollected = "asset-not-collected" as ImageAsset["id"];

function withSections(settings: Record<string, unknown>[]) {
  const project = structuredClone(catalogModernStore);
  const hero = project.sections.find((section) => section.slot === "hero");
  if (!hero) throw new Error("la fixture demo debe tener un hero");
  project.sections.push(
    ...settings.map((sectionSettings, index) => ({
      ...hero,
      id: `asset-uses-test-section-${index}` as typeof hero.id,
      settings: sectionSettings,
    })),
  );
  return project;
}

describe("assetUses", () => {
  it("cuenta imágenes de slides de un carrusel del hero", () => {
    const project = withSections([
      { mode: "carousel", slides: [{ title: "Slide 1", imageId: slideAsset }] },
    ]);
    const uses = assetUses(project, slideAsset);
    expect(uses).toContainEqual({ label: "catalog-hero", detail: "Sección hero" });
  });

  it("cuenta un imageId de nivel superior en settings de una sección", () => {
    const project = withSections([{ imageId: topLevelAsset }]);
    const uses = assetUses(project, topLevelAsset);
    expect(uses).toContainEqual({ label: "catalog-hero", detail: "Sección hero" });
  });

  it("no cuenta strings que no estén en claves de imagen", () => {
    const project = withSections([
      {
        title: notCollected,
        slides: [{ title: notCollected, body: notCollected }],
      },
    ]);
    expect(assetUses(project, notCollected)).toEqual([]);
  });
});
