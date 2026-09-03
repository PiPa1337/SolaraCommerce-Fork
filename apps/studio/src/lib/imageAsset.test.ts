import { IMAGE_ASSET_RECIPE, type ImageAsset, StoreProjectV1Schema } from "@solara/project-schema";
import { catalogModernCleanStore } from "@solara/project-schema/catalog-modern-template";
import { referenceStore } from "@solara/project-schema/fixture";
import { describe, expect, it } from "vitest";
import {
  assertImageAssetOptimized,
  assertProjectImagesOptimized,
  createImageAssetFromProcessed,
  dataUrlMimeType,
  IMAGE_ASSET_RECIPE_V2,
  isOptimizedImageAsset,
  markImageAssetAsOptimized,
} from "./imageAsset";

const primary = "data:image/avif;base64,cHJpbWFyeQ==";
const fallback = "data:image/jpeg;base64,ZmFsbGJhY2s=";

function processedAsset(): ImageAsset {
  return createImageAssetFromProcessed(
    {
      id: "asset-optimized" as ImageAsset["id"],
      name: "Producto",
      alt: "Producto optimizado",
      hash: "hash-original",
    },
    {
      width: 1_800,
      height: 1_200,
      primary,
      fallback,
      responsive: [
        { width: 480, source: primary },
        { width: 768, source: primary },
        { width: 1_800, source: primary },
      ],
    },
  );
}

describe("invariante de assets de imagen", () => {
  it("materializa la receta, conserva el MIME real y rechaza una imagen cruda", () => {
    const asset = processedAsset();

    expect(asset.mimeType).toBe("image/avif");
    expect(asset.optimizationRecipe).toBe(IMAGE_ASSET_RECIPE_V2);
    expect(isOptimizedImageAsset(asset)).toBe(true);
    expect(isOptimizedImageAsset({ ...asset, optimizationRecipe: IMAGE_ASSET_RECIPE })).toBe(true);
    expect(dataUrlMimeType(asset.source)).toBe("image/avif");

    const rawCandidate = {
      ...asset,
      id: referenceStore.assets[0]?.id ?? asset.id,
      optimizationRecipe: undefined,
      mimeType: "image/jpeg",
      source: "data:image/jpeg;base64,cmF3",
      fallbackSource: undefined,
      responsiveSources: undefined,
    };
    const raw = StoreProjectV1Schema.parse({
      ...referenceStore,
      id: "store-raw-image",
      assets: referenceStore.assets.map((candidate, index) =>
        index === 0 ? rawCandidate : candidate,
      ),
    }).assets[0];
    if (!raw) throw new Error("Asset de prueba inexistente");

    expect(isOptimizedImageAsset(raw)).toBe(false);
    expect(() => assertImageAssetOptimized(raw)).toThrow(/no está optimizada/);
  });

  it("repara el MIME y la marca de un asset legacy que ya tenía variantes", () => {
    const legacy = { ...processedAsset(), optimizationRecipe: undefined, mimeType: "image/webp" };
    const repaired = markImageAssetAsOptimized(legacy);

    expect(repaired?.mimeType).toBe("image/avif");
    expect(repaired?.optimizationRecipe).toBe(IMAGE_ASSET_RECIPE_V2);
    expect(repaired && isOptimizedImageAsset(repaired)).toBe(true);
  });

  it("permite los placeholders internos y exige la receta a todos los demás assets", () => {
    const project = StoreProjectV1Schema.parse({
      ...catalogModernCleanStore,
      id: "store-image-invariant",
      assets: [
        {
          ...catalogModernCleanStore.assets[0],
          hash: "template-asset-placeholder",
          source: "data:image/svg+xml,%3Csvg/%3E",
          fallbackSource: undefined,
          responsiveSources: undefined,
        },
        processedAsset(),
      ],
    });

    expect(() => assertProjectImagesOptimized(project)).not.toThrow();
  });
});
