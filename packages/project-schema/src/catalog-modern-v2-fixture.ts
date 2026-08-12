import { catalogModernStore } from "./catalog-modern-fixture";
import { StoreProjectV2Schema } from "./index";

/**
 * Fixture V2 aislada: conserva el catálogo determinista mientras la nueva
 * familia visual evoluciona sin reinterpretar proyectos catalog-modern-v1.
 */
export const catalogModernV2Store = StoreProjectV2Schema.parse({
  ...structuredClone(catalogModernStore),
  id: "store-catalog-modern-v2",
  theme: {
    ...catalogModernStore.theme,
    colors: {
      background: "#f7f5f0",
      surface: "#e9e5dd",
      text: "#11110f",
      muted: "#6d6961",
      accent: "#a63d2f",
      accentText: "#ffffff",
      border: "#d8d2c7",
    },
    typography: {
      ...catalogModernStore.theme.typography,
      display: 'Georgia, "Times New Roman", serif',
    },
    radius: 2,
    container: 1760,
  },
  commerceTemplates: {
    ...catalogModernStore.commerceTemplates,
    designFamily: "catalog-modern-v2",
  },
});
