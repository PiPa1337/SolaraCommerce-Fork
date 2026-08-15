import { catalogModernStore } from "./catalog-modern-fixture";
import { ensureCatalogModernV2Sections } from "./catalog-modern-template";
import { type StoreProjectV2, StoreProjectV2Schema } from "./index";

/**
 * Orden de secciones de la home V2: el bento de categorías queda
 * inmediatamente después de la franja de marcas y antes de las grillas de
 * productos (hero → marcas → categorías → grillas → testimonios → newsletter).
 * Los ids y settings de las secciones se conservan intactos; sólo cambia el
 * orden del array.
 */
function v2SectionsWithBentoAfterBrands(): StoreProjectV2["sections"] {
  const sections = structuredClone(catalogModernStore.sections);
  const brandIndex = sections.findIndex((section) => section.moduleId === "catalog-brand-strip");
  const bentoIndex = sections.findIndex((section) => section.moduleId === "catalog-category-bento");
  if (brandIndex < 0 || bentoIndex < 0) return sections;
  const bento = sections.splice(bentoIndex, 1)[0];
  if (!bento) return sections;
  sections.splice(brandIndex + 1, 0, bento);
  return sections;
}

/**
 * Fixture V2 aislada: conserva el catálogo determinista mientras la nueva
 * familia visual evoluciona sin reinterpretar proyectos catalog-modern-v1.
 */
const v2Project = StoreProjectV2Schema.parse({
  ...structuredClone(catalogModernStore),
  id: "store-catalog-modern-v2",
  sections: v2SectionsWithBentoAfterBrands(),
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

export const catalogModernV2Store = StoreProjectV2Schema.parse(
  ensureCatalogModernV2Sections(v2Project),
);
