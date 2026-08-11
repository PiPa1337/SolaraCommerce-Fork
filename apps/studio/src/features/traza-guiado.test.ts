import type { ContentRequirementScope } from "@solara/project-schema";
import { describe, expect, it } from "vitest";
import { destinationFor, type GuidedDestination } from "../lib/guidedDestinations";

/**
 * Contrato del flujo guiado (traza T17): el checklist navega a pestañas que
 * Studio acepta. La lista de pestañas se congela acá porque Studio.tsx no la
 * exporta; si el shell cambia un id, este test lo señala.
 */
const studioTabs = [
  "guided",
  "overview",
  "catalog",
  "builder",
  "theme",
  "assets",
  "seo",
  "export",
] as const;
type StudioTab = (typeof studioTabs)[number];

const scopes: ContentRequirementScope[] = [
  "identity",
  "home",
  "about",
  "contact",
  "navigation",
  "category",
  "product",
  "seo",
  "asset",
  "policy",
];

const expectedDestination: Record<ContentRequirementScope, StudioTab> = {
  identity: "overview",
  home: "builder",
  about: "overview",
  contact: "overview",
  navigation: "overview",
  category: "catalog",
  product: "catalog",
  seo: "seo",
  asset: "assets",
  domain: "overview",
  policy: "builder",
};

describe("flujo guiado: contrato scope → pestaña", () => {
  it("cada scope navega a un destino que el shell acepta", () => {
    for (const scope of scopes) {
      const destination: GuidedDestination = destinationFor(scope);
      expect(studioTabs, scope).toContain(destination);
    }
  });

  it("el mapa scope → destino coincide con el contrato fijado", () => {
    for (const scope of scopes) {
      expect(destinationFor(scope), scope).toBe(expectedDestination[scope]);
    }
  });
});
