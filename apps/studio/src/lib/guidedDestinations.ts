/** Destinos del flujo guiado: subconjunto de las pestañas que acepta Studio.tsx. */
import type { ContentRequirementScope } from "@solara/project-schema";

export type GuidedDestination = "overview" | "catalog" | "assets" | "builder" | "seo" | "export";

/** Mapa scope → pestaña: el checklist debe aterrizar siempre en una pestaña del shell. */
export function destinationFor(scope: ContentRequirementScope): GuidedDestination {
  if (scope === "product" || scope === "category") return "catalog";
  if (scope === "asset") return "assets";
  if (scope === "seo") return "seo";
  if (scope === "identity" || scope === "navigation" || scope === "about" || scope === "contact") {
    return "overview";
  }
  return "builder";
}
