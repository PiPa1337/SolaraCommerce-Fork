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
  StoreProjectV1,
  StoreSection,
} from "@solara/project-schema";
import {
  announcementBar,
  cartDrawer,
  collectionGrid,
  compactProductGrid,
  editorialFooter,
  editorialHeader,
  editorialHero,
  editorialProductGrid,
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
  imageTextContent,
  MODULE_STYLES,
  MODULE_STYLE_BLOCKS,
  officialModules,
  productDetail,
  splitHero,
  STORE_BASE_STYLES,
  trustStrip,
};

// The registry is intentionally heterogeneous because each module owns its settings schema.
// biome-ignore lint/suspicious/noExplicitAny: a runtime registry cannot retain each generic member separately
export type RegisteredModule = ModuleDefinition<any>;

export const moduleRegistry: Record<string, RegisteredModule> = Object.fromEntries(
  officialModules.map((definition) => [definition.manifest.id, definition]),
);

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

export function renderSections(
  project: StoreProjectV1,
  sections: readonly StoreSection[] = project.sections,
  pageContext: PageRenderContext = {},
): SafeHtml {
  return joinHtml(
    sections
      .filter((section) => section.enabled)
      .map((section) => {
        const definition = getModuleDefinition(section.moduleId);
        if (!definition) {
          throw new Error(`Módulo desconocido: ${section.moduleId}.`);
        }
        if (!definition.manifest.slots.includes(section.slot)) {
          throw new Error(
            `El módulo ${section.moduleId} no es compatible con el slot ${section.slot}.`,
          );
        }

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
  const target = getModuleDefinition(targetModuleId);
  if (!target) {
    throw new Error(`Módulo desconocido: ${targetModuleId}.`);
  }
  if (!target.manifest.slots.includes(section.slot)) {
    throw new Error(`El módulo ${targetModuleId} no es compatible con el slot ${section.slot}.`);
  }

  const settings = target.settingsSchema.parse(section.settings) as Record<string, unknown>;
  return {
    ...section,
    moduleId: targetModuleId,
    settings,
  };
}
