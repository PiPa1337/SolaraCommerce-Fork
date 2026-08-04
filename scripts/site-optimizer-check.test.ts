import { expect, test } from "vitest";
import { catalogModernStore } from "../packages/project-schema/src/catalog-modern-fixture";
import { catalogModernCleanStore } from "../packages/project-schema/src/catalog-modern-template";
import { catalogScaleStore } from "../packages/project-schema/src/scale-fixture";
import {
  buildAiContext,
  buildLlmsTxt,
  optimizeProject,
  serializeOptimizationReport,
} from "../packages/site-optimizer/src/index";

test("la demo moderna mantiene cobertura SEO, merchant y rutas deterministas", () => {
  const report = optimizeProject(catalogModernStore, {
    mode: "production",
    profile: "safe",
    publicAiContext: true,
  });

  expect(report.counts.activeProducts).toBe(50);
  expect(report.routes.filter((route) => route.pageType === "product")).toHaveLength(50);
  expect(
    report.routes
      .filter((route) => route.indexable)
      .every((route) => route.canonicalPath.startsWith("/")),
  ).toBe(true);
  expect(report.aiReadiness.structuredDataSource).toBe("shared-snapshot");
  expect(report.aiReadiness.factualProductCoverage).toBe(1);
  expect(report.aiReadiness.publicContextAvailable).toBe(true);
  expect(serializeOptimizationReport(report)).toContain(report.snapshotHash);
});

test("la escala de catálogo conserva padres, hojas y paginación en el inventario de rutas", () => {
  const report = optimizeProject(catalogScaleStore, {
    mode: "production",
    profile: "strict",
    publicAiContext: true,
  });
  const categoryRoutes = report.routes.filter((route) => route.pageType === "category");

  expect(catalogScaleStore.products).toHaveLength(50);
  expect(catalogScaleStore.categories).toHaveLength(16);
  expect(categoryRoutes).toHaveLength(17);
  expect(categoryRoutes.some((route) => route.path === "/categorias/novedades/pagina/2/")).toBe(
    true,
  );
  expect(
    new Set(report.routes.filter((route) => route.indexable).map((route) => route.canonicalPath))
      .size,
  ).toBe(report.routes.filter((route) => route.indexable).length);
});

test("la plantilla limpia no publica inventario ficticio y genera contexto AI legible", () => {
  const report = optimizeProject(catalogModernCleanStore, {
    mode: "draft",
    publicAiContext: true,
  });
  const context = JSON.parse(buildAiContext(catalogModernCleanStore)) as {
    products: unknown[];
    categories: unknown[];
  };

  expect(report.counts.activeProducts).toBe(0);
  expect(context.products).toHaveLength(0);
  expect(context.categories).toHaveLength(0);
  expect(buildLlmsTxt(catalogModernCleanStore)).toContain("## Productos");
});
