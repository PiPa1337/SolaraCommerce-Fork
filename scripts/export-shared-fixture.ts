import { generatePerformanceFixture } from "../packages/core/src/performance";
import { exportProject } from "../packages/exporter/src/index";
import { catalogModernStore } from "../packages/project-schema/src/catalog-modern-fixture";
import { catalogModernV2Store } from "../packages/project-schema/src/catalog-modern-v2-fixture";
import { referenceStore } from "../packages/project-schema/src/fixture";
import { catalogScaleStore } from "../packages/project-schema/src/scale-fixture";

// Fixture compartido de exports pesados (post-cambio rápido).
// Antes: benchmark + audit-2000 + audit-2000-repeat generaban el fixture de
// 2.000 productos y corrían exportProject cada uno desde cero (~48MB x3).
// Ahora: se genera y exporta una sola vez por proceso Vitest y se reutiliza.
// El proyecto compartido está congelado: quien necesite mutarlo debe clonarlo.
let cachedPerfProject: ReturnType<typeof generatePerformanceFixture> | null = null;
let cachedPerfExport: ReturnType<typeof exportProject> | null = null;
const cachedSmallExports = new Map<string, ReturnType<typeof exportProject>>();
const cachedSmallDraftExports = new Map<string, ReturnType<typeof exportProject>>();

export function getPerf2000Project() {
  if (!cachedPerfProject) {
    const project = generatePerformanceFixture(2000);
    project.commerceTemplates.designFamily = "catalog-modern-v2";
    cachedPerfProject = Object.freeze(project);
  }
  return cachedPerfProject;
}

export function getPerf2000Export() {
  if (!cachedPerfExport) {
    cachedPerfExport = exportProject(getPerf2000Project(), { mode: "production" });
  }
  return cachedPerfExport;
}

function getSmallExport(key: string, project: Parameters<typeof exportProject>[0]) {
  let cached = cachedSmallExports.get(key);
  if (!cached) {
    cached = exportProject(project, { mode: "production" });
    cachedSmallExports.set(key, cached);
  }
  return cached;
}

export function getCatalogModernExport() {
  return getSmallExport("catalogModern", catalogModernStore);
}

export function getCatalogModernV2Export() {
  return getSmallExport("catalogModernV2", catalogModernV2Store);
}

export function getReferenceExport() {
  return getSmallExport("reference", referenceStore);
}

export function getCatalogScaleExport() {
  return getSmallExport("catalogScale", catalogScaleStore);
}

export function getReferenceDraftExport() {
  let cached = cachedSmallDraftExports.get("reference");
  if (!cached) {
    cached = exportProject(referenceStore, { mode: "draft" });
    cachedSmallDraftExports.set("reference", cached);
  }
  return cached;
}
