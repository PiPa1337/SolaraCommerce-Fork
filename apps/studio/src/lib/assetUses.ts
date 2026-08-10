import type { ImageAsset, StoreProjectV1 } from "@solara/project-schema";

export interface AssetUse {
  label: string;
  detail: string;
}

/** Referencias de imagen dentro de un valor de settings (slides, posters, etc.). */
export function collectSettingAssetIds(value: unknown, collected: string[], key?: string): void {
  if (Array.isArray(value)) {
    for (const item of value) collectSettingAssetIds(item, collected);
    return;
  }
  if (value && typeof value === "object") {
    for (const [entryKey, item] of Object.entries(value)) {
      collectSettingAssetIds(item, collected, entryKey);
    }
    return;
  }
  if (typeof value === "string" && (key === "imageId" || key === "posterAssetId")) {
    collected.push(value);
  }
}

/** Usos de una imagen: productos (incluidas variantes), portadas, categorías, colecciones y secciones. */
export function assetUses(project: StoreProjectV1, assetId: ImageAsset["id"]): AssetUse[] {
  const uses: AssetUse[] = [];
  if (project.identity.logoAssetId === assetId) {
    uses.push({ label: "Logo de la tienda", detail: "Identidad" });
  }
  if (project.seo.socialImageId === assetId) {
    uses.push({ label: "Imagen social", detail: "SEO" });
  }
  for (const product of project.products) {
    if (product.imageIds.includes(assetId)) {
      uses.push({ label: product.title, detail: "Imagen de producto" });
    }
    for (const variant of product.variants) {
      if (variant.imageId === assetId) {
        uses.push({ label: product.title, detail: `Imagen de variante ${variant.title}` });
        break;
      }
    }
  }
  for (const video of project.videos) {
    if (video.posterAssetId === assetId) {
      uses.push({ label: video.name, detail: "Portada de video" });
    }
  }
  for (const category of project.categories) {
    if (category.imageId === assetId) {
      uses.push({ label: category.title, detail: "Imagen de categoría" });
    }
  }
  for (const collection of project.collections) {
    if (collection.imageId === assetId) {
      uses.push({ label: collection.title, detail: "Imagen de colección" });
    }
  }
  const sectionPages = [...project.sections, ...project.pages.flatMap((page) => page.sections)];
  for (const section of sectionPages) {
    const referenced: string[] = [];
    collectSettingAssetIds(section.settings, referenced);
    if (referenced.includes(assetId)) {
      uses.push({ label: section.moduleId, detail: `Sección ${section.slot}` });
    }
  }
  return [...new Map(uses.map((use) => [`${use.label}|${use.detail}`, use])).values()];
}
