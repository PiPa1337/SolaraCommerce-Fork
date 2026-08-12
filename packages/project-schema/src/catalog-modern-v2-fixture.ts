import { catalogModernStore } from "./catalog-modern-fixture";
import { StoreProjectV2Schema } from "./index";

/**
 * Fixture V2 aislada: conserva el catálogo determinista mientras la nueva
 * familia visual evoluciona sin reinterpretar proyectos catalog-modern-v1.
 */
export const catalogModernV2Store = StoreProjectV2Schema.parse({
  ...structuredClone(catalogModernStore),
  id: "store-catalog-modern-v2",
  commerceTemplates: {
    ...catalogModernStore.commerceTemplates,
    designFamily: "catalog-modern-v2",
  },
});
