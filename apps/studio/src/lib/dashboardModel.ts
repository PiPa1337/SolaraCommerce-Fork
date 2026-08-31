import type { StoredProject } from "./repository";

export type DashboardStatusFilter = "all" | "active" | "archived";
export type DashboardSort = "name" | "updated" | "products";

export interface DashboardStats {
  totalStores: number;
  activeStores: number;
  archivedStores: number;
  activeProducts: number;
}

export interface ProjectMetrics {
  activeProducts: number;
  categories: number;
  collections: number;
  assets: number;
}

export interface PinnedPartition<T> {
  pinned: T[];
  rest: T[];
}

export interface HealthAuditResult {
  critical: number;
  skipped: number;
}

export function storeMark(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return (words[0] ?? "").slice(0, 2).toUpperCase() || "?";
  return words
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();
}

export function storeFaviconSrc(project: StoredProject["project"]): string | undefined {
  const faviconId = project.seo.faviconAssetId;
  if (!faviconId) return undefined;
  const asset = project.assets.find((candidate) => candidate.id === faviconId);
  if (!asset) return undefined;
  return asset.fallbackSource ?? asset.source;
}

export function auditStoreHealth(
  projects: readonly StoredProject[],
  audit: (project: StoredProject["project"]) => number,
  timeoutMs: number,
  now: () => number,
): HealthAuditResult {
  let critical = 0;
  let skipped = 0;
  for (const record of projects) {
    const startedAt = now();
    let issues: number | undefined;
    try {
      issues = audit(record.project);
    } catch {
      // Una tienda puede no auditarse; el resto del sumario sigue disponible.
    }
    if (now() - startedAt > timeoutMs) {
      skipped += 1;
    } else if (issues !== undefined) {
      critical += issues;
    }
  }
  return { critical, skipped };
}

export function partitionPinnedProjects<T extends { id: string }>(
  projects: readonly T[],
  pinnedIds: readonly string[],
): PinnedPartition<T> {
  const pinnedSet = new Set(pinnedIds);
  const pinned: T[] = [];
  const rest: T[] = [];
  for (const project of projects) {
    (pinnedSet.has(project.id) ? pinned : rest).push(project);
  }
  return { pinned, rest };
}

export function getProjectMetrics(project: StoredProject["project"]): ProjectMetrics {
  return {
    activeProducts: project.products.filter((product) => product.status === "active").length,
    categories: project.categories.length,
    collections: project.collections.length,
    assets: project.assets.length,
  };
}

/**
 * Configuración de precios mensual — centralizada para que el popup de
 * Calculadora y la card de Mensualidad usen la misma fuente de verdad.
 * Ajustar aquí modifica ambos lugares sin tocar la UI.
 */
export const MONTHLY_PRICING = {
  base: 20000,
  included: 20,
  tiers: [
    { upTo: 100, price: 300 }, // 21..100
    { upTo: 200, price: 200 }, // 101..200
    { upTo: Infinity, price: 100 }, // 201+
  ],
} as const;

/**
 * Calcula el coste mensual según cantidad de productos activos.
 * Fórmula: base (incluye `included`) + tramos adicionales.
 * Ej: 50 → 20.000 + 30×300 = 29.000
 */
export function calculateMonthlyCostForCount(count: number): number {
  const { base, included, tiers } = MONTHLY_PRICING;
  if (count <= included) return base;
  let total = base;
  let previousUpTo = included;
  for (const tier of tiers) {
    if (count <= previousUpTo) break;
    const upper = Math.min(count, tier.upTo);
    const productsInTier = upper - previousUpTo;
    total += productsInTier * tier.price;
    previousUpTo = tier.upTo;
    if (count <= tier.upTo) break;
  }
  return total;
}

export function calculateMonthlyCost(project: StoredProject["project"]): number {
  const metrics = getProjectMetrics(project);
  return calculateMonthlyCostForCount(metrics.activeProducts);
}

export function formatMonthlyCost(value: number): string {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(value);
}

/** Desglose por tramo para el popup de Calculadora. */
export function getMonthlyCostBreakdown(count: number): Array<{
  label: string;
  products: number;
  price: number;
  subtotal: number;
}> {
  const { base, included, tiers } = MONTHLY_PRICING;
  const breakdown: Array<{ label: string; products: number; price: number; subtotal: number }> = [];
  if (count <= included) return breakdown;
  let previousUpTo = included;
  for (const tier of tiers) {
    if (count <= previousUpTo) break;
    const upper = Math.min(count, tier.upTo);
    const productsInTier = upper - previousUpTo;
    if (productsInTier <= 0) {
      previousUpTo = tier.upTo;
      continue;
    }
    const label =
      tier.upTo === Infinity
        ? `Productos 201 en adelante`
        : `Productos ${previousUpTo + 1} al ${tier.upTo}`;
    breakdown.push({
      label,
      products: productsInTier,
      price: tier.price,
      subtotal: productsInTier * tier.price,
    });
    previousUpTo = tier.upTo;
    if (count <= tier.upTo) break;
  }
  return breakdown;
}

export function getDashboardStats(projects: readonly StoredProject[]): DashboardStats {
  return projects.reduce<DashboardStats>(
    (stats, record) => {
      stats.totalStores += 1;
      if (record.status === "active") stats.activeStores += 1;
      if (record.status === "archived") stats.archivedStores += 1;
      stats.activeProducts += getProjectMetrics(record.project).activeProducts;
      return stats;
    },
    { totalStores: 0, activeStores: 0, archivedStores: 0, activeProducts: 0 },
  );
}

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es-AR")
    .trim();
}

export function filterDashboardProjects(
  projects: readonly StoredProject[],
  query: string,
  status: DashboardStatusFilter,
  sort: DashboardSort,
): StoredProject[] {
  const needle = normalize(query);
  const filtered = projects.filter((record) => {
    if (status !== "all" && record.status !== status) return false;
    if (!needle) return true;
    const haystack = normalize(`${record.name} ${record.project.slug} ${record.project.baseUrl}`);
    return haystack.includes(needle);
  });

  return filtered.toSorted((left, right) => {
    if (sort === "updated") {
      const updated = right.updatedAt.localeCompare(left.updatedAt);
      return updated || left.id.localeCompare(right.id);
    }
    if (sort === "products") {
      const products =
        getProjectMetrics(right.project).activeProducts -
        getProjectMetrics(left.project).activeProducts;
      return (
        products || left.name.localeCompare(right.name, "es-AR") || left.id.localeCompare(right.id)
      );
    }
    return left.name.localeCompare(right.name, "es-AR") || left.id.localeCompare(right.id);
  });
}
