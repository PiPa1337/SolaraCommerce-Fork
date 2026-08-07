/**
 * Registro de módulos oficiales y renderer de secciones. Mantiene separadas las
 * familias legacy y Catalog Modern y concentra defaults/reemplazos para que
 * Builder y exporter no tengan implementaciones duplicadas.
 */
import {
  joinHtml,
  type ModuleDefinition,
  type RenderPageType,
  type SafeHtml,
} from "@solara/module-sdk";
import type {
  Category,
  Collection,
  Product,
  SectionId,
  StoreProjectV1,
  StoreSection,
} from "@solara/project-schema";
import {
  catalogAnnouncement,
  catalogBrandStrip,
  catalogCartDrawer,
  catalogCategoryBento,
  catalogFooter,
  catalogHeader,
  catalogHero,
  catalogModernModules,
  catalogNewsletterCta,
  catalogProductDetail,
  catalogProductGrid,
  catalogTestimonials,
} from "./catalog-modern";
import {
  announcementBar,
  cartDrawer,
  collectionGrid,
  compactProductGrid,
  editorialFooter,
  editorialHeader,
  editorialHero,
  editorialProductGrid,
  heroMedia,
  imageTextContent,
  officialModules,
  productDetail,
  splitHero,
  trustStrip,
} from "./definitions";
import { MODULE_STYLE_BLOCKS, MODULE_STYLES, STORE_BASE_STYLES } from "./styles";

export {
  announcementBar,
  cartDrawer,
  collectionGrid,
  compactProductGrid,
  editorialFooter,
  editorialHeader,
  editorialHero,
  editorialProductGrid,
  heroMedia,
  imageTextContent,
  MODULE_STYLES,
  MODULE_STYLE_BLOCKS,
  officialModules,
  productDetail,
  splitHero,
  STORE_BASE_STYLES,
  trustStrip,
  catalogAnnouncement,
  catalogBrandStrip,
  catalogCategoryBento,
  catalogFooter,
  catalogHeader,
  catalogHero,
  catalogModernModules,
  catalogNewsletterCta,
  catalogCartDrawer,
  catalogProductDetail,
  catalogProductGrid,
  catalogTestimonials,
};
export type { RepeaterItemField } from "@solara/module-sdk";

// The registry is intentionally heterogeneous because each module owns its settings schema.
// Settings = any conserva la varianza previa: con el default unknown, settingsFields no sería
// asignable desde los miembros concretos y moduleRegistry dejaría de tipar.
// biome-ignore lint/suspicious/noExplicitAny: a runtime registry cannot retain each generic member separately
export type RegisteredModule = ModuleDefinition<any, any>;

export type AnyLegacyModule = (typeof officialModules)[number];
export type AnyCatalogModernModule = (typeof catalogModernModules)[number];
export type AnyModule = AnyLegacyModule | AnyCatalogModernModule;
export type ModuleId = AnyModule["manifest"]["id"];
export type ModuleById = { [Id in ModuleId]: Extract<AnyModule, { manifest: { id: Id } }> };

export function getTypedModule<Id extends ModuleId>(id: Id): ModuleById[Id] | undefined;
export function getTypedModule(id: string): AnyModule | undefined;
export function getTypedModule(id: string): RegisteredModule | undefined {
  return moduleRegistry[id] as RegisteredModule | undefined;
}

export const moduleRegistry: Record<string, RegisteredModule> = Object.fromEntries(
  [...officialModules, ...catalogModernModules].map((definition) => [
    definition.manifest.id,
    definition,
  ]),
);

export function isLegacyModule(definition: RegisteredModule): boolean {
  return (definition.manifest.family ?? "legacy-editorial-v1") === "legacy-editorial-v1";
}

export function isCatalogModernModule(definition: RegisteredModule): boolean {
  return definition.manifest.family === "catalog-modern-v1";
}

export function isAddableModule(definition: RegisteredModule): boolean {
  return (definition.manifest.availability ?? "compatibility-only") === "default";
}

export interface PageRenderContext {
  pageType?: RenderPageType;
  product?: Product;
  category?: Category;
  collection?: Collection;
  products?: readonly Product[];
}

export function getModuleDefinition(id: string): RegisteredModule | undefined {
  return moduleRegistry[id];
}

function requireCompatibleModule(moduleId: string, slot: StoreSection["slot"]): RegisteredModule {
  const definition = getModuleDefinition(moduleId);
  if (!definition) {
    throw new Error(`Módulo desconocido: ${moduleId}.`);
  }
  if (!definition.manifest.slots.includes(slot)) {
    throw new Error(`El módulo ${moduleId} no es compatible con el slot ${slot}.`);
  }
  return definition;
}

export function defaultSettingsForModule(moduleId: string): Record<string, unknown> {
  const definition = getModuleDefinition(moduleId);
  if (!definition) {
    throw new Error(`Módulo desconocido: ${moduleId}.`);
  }
  return definition.settingsSchema.parse({}) as Record<string, unknown>;
}

export function createModuleSection(input: {
  id: SectionId;
  slot: StoreSection["slot"];
  moduleId: string;
}): StoreSection {
  const definition = requireCompatibleModule(input.moduleId, input.slot);
  return {
    ...input,
    enabled: true,
    settings: definition.settingsSchema.parse({}) as Record<string, unknown>,
    motion: {
      preset: "none",
      intensity: 0,
      direction: "up",
      distance: 24,
      duration: 0.55,
      delay: 0,
      stagger: 0.08,
      easing: "cubic-bezier(.16,1,.3,1)",
      entryPoint: 0.25,
      once: true,
    },
  };
}

export function renderSections(
  project: StoreProjectV1,
  sections: readonly StoreSection[] = project.sections,
  pageContext: PageRenderContext = {},
): SafeHtml {
  return joinHtml(
    sections
      .filter((section) => section.enabled)
      .map((section) => {
        const definition = requireCompatibleModule(section.moduleId, section.slot);

        const settings = definition.settingsSchema.parse(section.settings);
        return definition.render({
          project,
          section,
          settings,
          pageType: pageContext.pageType ?? "home",
          ...(pageContext.product ? { product: pageContext.product } : {}),
          ...(pageContext.category ? { category: pageContext.category } : {}),
          ...(pageContext.collection ? { collection: pageContext.collection } : {}),
          ...(pageContext.products ? { products: pageContext.products } : {}),
        });
      }),
  );
}

export function replaceModuleInSection(
  section: StoreSection,
  targetModuleId: string,
): StoreSection {
  const target = requireCompatibleModule(targetModuleId, section.slot);
  const defaults = target.settingsSchema.parse({}) as Record<string, unknown>;
  const compatible = new Set(target.manifest.compatibleSettings);
  const preserved = Object.fromEntries(
    Object.entries(section.settings).filter(([key]) => compatible.has(key)),
  );
  if (compatible.has("imageId") && !("imageId" in preserved)) {
    const posterAssetId = section.settings.posterAssetId;
    if (typeof posterAssetId === "string") preserved.imageId = posterAssetId;
  }
  if (compatible.has("posterAssetId") && !("posterAssetId" in preserved)) {
    const imageId = section.settings.imageId;
    if (typeof imageId === "string") preserved.posterAssetId = imageId;
  }
  const settings = target.settingsSchema.parse({
    ...defaults,
    ...preserved,
  }) as Record<string, unknown>;
  return {
    ...section,
    moduleId: targetModuleId,
    settings,
  };
}
