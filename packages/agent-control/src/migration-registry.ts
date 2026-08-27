/**
 * Registro real de migraciones tipadas.
 *
 * Cada migración declara su migrationId, alcance, versiones de plantilla
 * origen/destino, si aplica a un proyecto dado, un preview determinista y un
 * apply idempotente. El rollout resuelve por migrationId y rechaza IDs
 * desconocidos en vez de ejecutar siempre planCatalogModernUpgrade.
 */

import type { StoreProjectV2 } from "@solara/project-schema";
import { CATALOG_MODERN_TEMPLATE_VERSION } from "@solara/project-schema/catalog-modern-template";
import {
  applyCatalogModernUpgrade,
  planCatalogModernUpgrade,
} from "@solara/project-schema/catalog-modern-upgrade";

export interface RegisteredProjectMigration {
  migrationId: string;
  scope: string;
  fromTemplateVersion: number;
  toTemplateVersion: number;
  description: string;
  applies(project: StoreProjectV2): boolean;
  preview(project: StoreProjectV2): {
    safeChanges: string[];
    conflicts: string[];
    preserved: string[];
  };
  apply(project: StoreProjectV2, acceptedChangeIds: readonly string[]): StoreProjectV2;
}

function templateVersionOf(project: StoreProjectV2): number {
  return project.origin?.templateVersion ?? 1;
}

const catalogModernUpgrade: RegisteredProjectMigration = {
  migrationId: "catalog-modern.template-upgrade",
  scope: "catalog-modern",
  fromTemplateVersion: 1,
  toTemplateVersion: CATALOG_MODERN_TEMPLATE_VERSION,
  description: "Upgrade incremental de plantilla Catalog Modern (secciones y navegación).",
  applies: (project) => (project.commerceTemplates.designFamily ?? "").startsWith("catalog-modern"),
  preview: (project) => {
    const plan = planCatalogModernUpgrade(project);
    return {
      safeChanges: plan.safeChanges.map((change) => change.id),
      conflicts: plan.conflicts.map((conflict) => conflict.id),
      preserved: plan.preservedUserChanges,
    };
  },
  apply: (project, accepted) => applyCatalogModernUpgrade(project, accepted),
};

const REGISTRY = new Map<string, RegisteredProjectMigration>([
  [catalogModernUpgrade.migrationId, catalogModernUpgrade],
]);

export function resolveMigration(migrationId: string): RegisteredProjectMigration | undefined {
  return REGISTRY.get(migrationId);
}

export function listMigrations(): RegisteredProjectMigration[] {
  return [...REGISTRY.values()];
}

/** El default histórico sigue disponible, pero ya no es el único camino. */
export function defaultMigrationId(): string {
  return catalogModernUpgrade.migrationId;
}

export function migrationApplies(migrationId: string, project: StoreProjectV2): boolean {
  return resolveMigration(migrationId)?.applies(project) ?? false;
}

export function templateVersionOfProject(project: StoreProjectV2): number {
  return templateVersionOf(project);
}
