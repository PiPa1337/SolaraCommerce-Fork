import { type ImageAsset, StoreProjectV1Schema } from "@solara/project-schema";
import { catalogModernStore } from "@solara/project-schema/catalog-modern-fixture";
import { describe, expect, it } from "vitest";
import { assetUses } from "./assetUses";

const slideAsset = "asset-slide-1" as ImageAsset["id"];
const topLevelAsset = "asset-slide-top" as ImageAsset["id"];
const notCollected = "asset-not-collected" as ImageAsset["id"];
const logoAsset = "asset-logo" as ImageAsset["id"];
const socialAsset = "asset-social" as ImageAsset["id"];
const faviconAsset = "asset-favicon" as ImageAsset["id"];

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

  it("cuenta el logo, la imagen social y el favicon", () => {
    const project = structuredClone(catalogModernStore);
    project.identity.logoAssetId = logoAsset;
    project.seo.socialImageId = socialAsset;
    project.seo.faviconAssetId = faviconAsset;
    expect(assetUses(project, logoAsset)).toContainEqual({
      label: "Logo de la tienda",
      detail: "Identidad",
    });
    expect(assetUses(project, socialAsset)).toContainEqual({
      label: "Imagen social",
      detail: "SEO",
    });
    expect(assetUses(project, faviconAsset)).toContainEqual({
      label: "Favicon del sitio",
      detail: "SEO",
    });
  });

  it("cuenta una imagen referenciada en una sección de una página editable", () => {
    const project = structuredClone(catalogModernStore);
    const about = project.pages.find((page) => page.kind === "about");
    if (!about) throw new Error("la fixture demo debe tener una página about");
    const hero = project.sections.find((section) => section.slot === "hero");
    if (!hero) throw new Error("la fixture demo debe tener un hero");
    about.sections.push({
      ...structuredClone(hero),
      id: "asset-uses-test-page-section" as typeof hero.id,
      settings: { imageId: topLevelAsset },
    });
    expect(assetUses(project, topLevelAsset)).toContainEqual({
      label: "catalog-hero",
      detail: "Sección hero",
    });
  });

  it("el guard cubre toda referencia que el schema rechaza al eliminar el asset", () => {
    const project = structuredClone(catalogModernStore);
    const about = project.pages.find((page) => page.kind === "about");
    const hero = project.sections.find((section) => section.slot === "hero");
    if (!about || !hero) throw new Error("la fixture demo debe tener página about y hero");
    about.sections.push({
      ...structuredClone(hero),
      id: "asset-uses-test-page-section" as typeof hero.id,
      settings: { imageId: topLevelAsset },
    });
    const withoutAsset = {
      ...project,
      assets: project.assets.filter((asset) => asset.id !== topLevelAsset),
    };
    expect(StoreProjectV1Schema.safeParse(withoutAsset).success).toBe(false);
  });
});
