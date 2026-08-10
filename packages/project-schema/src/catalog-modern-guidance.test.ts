import { describe, expect, it } from "vitest";
import {
  CATALOG_MODERN_PLACEHOLDER_PHONE,
  catalogModernPhoneValue,
  catalogModernTemplateManifest,
  evaluateCatalogModernReadiness,
  getCatalogModernContentRequirements,
} from "./catalog-modern-guidance";
import { buildCatalogModernProject } from "./catalog-modern-template";
import type { StoreProjectV2 } from "./index";

/** Resuelve un target del checklist en el proyecto real: secciones/páginas/productos por id o kind. */
function resolveTarget(project: StoreProjectV2, target: string): unknown {
  let current: unknown = project;
  for (const part of target.split(".")) {
    if (typeof current !== "object" || current === null) return undefined;
    if (Array.isArray(current)) {
      if (/^\d+$/.test(part)) {
        current = current[Number(part)];
        continue;
      }
      const items = current as Array<Record<string, unknown>>;
      const byId = items.find((item) => item.id === part);
      current = byId ?? items.find((item) => item.kind === part);
      continue;
    }
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

/** Normaliza un valor del proyecto a la serialización que usa el checklist (join/string). */
function asRequirementValue(value: unknown): string {
  if (Array.isArray(value)) return value.join(",");
  if (typeof value === "number") return String(value);
  return typeof value === "string" ? value : "";
}

describe("Catalog Modern guidance", () => {
  it("expone la base protegida con versión estable", () => {
    expect(catalogModernTemplateManifest.id).toBe("catalog-modern");
    expect(catalogModernTemplateManifest.version).toBe(2);
    expect(catalogModernTemplateManifest.protectedSectionIds).toContain("modo-section-hero");
  });

  it("detecta placeholders y campos críticos en una tienda limpia", () => {
    const project = buildCatalogModernProject({ seed: "clean" });
    const readiness = evaluateCatalogModernReadiness(project);
    expect(readiness.criticalPending).toBeGreaterThan(0);
    expect(readiness.requirements.some((item) => item.id === "home.hero.title")).toBe(true);
    expect(readiness.requirements.find((item) => item.id === "home.hero.title")?.status).toBe(
      "placeholder",
    );
  });

  it("incluye requisitos dinámicos de productos y categorías", () => {
    const project = buildCatalogModernProject({ seed: "demo" });
    const requirements = getCatalogModernContentRequirements(project);
    expect(requirements.some((item) => item.id === "product.modo-product-01.title")).toBe(true);
    expect(requirements.some((item) => item.scope === "category")).toBe(true);
    expect(evaluateCatalogModernReadiness(project).criticalPending).toBe(0);
  });

  it("trata el teléfono de la plantilla limpia como no configurado", () => {
    expect(catalogModernPhoneValue(CATALOG_MODERN_PLACEHOLDER_PHONE)).toBe("");
    expect(catalogModernPhoneValue("5491123456789")).toBe("5491123456789");
    const clean = buildCatalogModernProject({ seed: "clean" });
    const whatsapp = evaluateCatalogModernReadiness(clean).requirements.find(
      (item) => item.id === "identity.whatsapp",
    );
    expect(whatsapp?.status).toBe("missing");
    const demo = buildCatalogModernProject({ seed: "demo" });
    const demoWhatsapp = evaluateCatalogModernReadiness(demo).requirements.find(
      (item) => item.id === "identity.whatsapp",
    );
    expect(demoWhatsapp?.status).toBe("ready");
  });

  it("todo target del checklist existe en el proyecto y coincide con su valor (sin typos de ruta)", () => {
    for (const seed of ["clean", "demo"] as const) {
      const project = buildCatalogModernProject({ seed });
      for (const requirement of getCatalogModernContentRequirements(project)) {
        const resolved = resolveTarget(project, requirement.target);
        const message = `${seed}: ${requirement.id} -> ${requirement.target}`;
        expect(resolved, message).toBeDefined();
        const expected =
          requirement.target === "whatsapp.phone"
            ? requirement.value === ""
              ? CATALOG_MODERN_PLACEHOLDER_PHONE
              : requirement.value
            : requirement.value;
        expect(asRequirementValue(resolved), message).toBe(expected);
      }
    }
  });
});
