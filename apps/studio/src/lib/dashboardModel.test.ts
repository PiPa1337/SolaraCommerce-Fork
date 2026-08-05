import { catalogModernStore } from "@solara/project-schema/catalog-modern-fixture";
import { catalogModernCleanStore } from "@solara/project-schema/catalog-modern-template";
import { describe, expect, it } from "vitest";
import { filterDashboardProjects, getDashboardStats, getProjectMetrics } from "./dashboardModel";
import type { StoredProject } from "./repository";

function record(
  id: string,
  name: string,
  updatedAt: string,
  status: StoredProject["status"] = "active",
  project = catalogModernStore,
): StoredProject {
  return { id, name, status, updatedAt, project };
}

describe("modelo del dashboard", () => {
  it("resume sólo datos reales del proyecto", () => {
    const metrics = getProjectMetrics(catalogModernStore);

    expect(metrics.activeProducts).toBe(50);
    expect(metrics.categories).toBe(14);
    expect(metrics.collections).toBeGreaterThan(0);
    expect(metrics.assets).toBeGreaterThan(0);
  });

  it("suma tiendas activas y archivadas sin inventar métricas", () => {
    const projects = [
      record("active", "Activa", "2026-08-01T00:00:00.000Z"),
      record("archived", "Archivada", "2026-08-02T00:00:00.000Z", "archived", {
        ...catalogModernCleanStore,
        status: "archived",
      }),
    ];

    expect(getDashboardStats(projects)).toEqual({
      totalStores: 2,
      activeStores: 1,
      archivedStores: 1,
      activeProducts: 50,
    });
  });

  it("filtra sin distinguir acentos y ordena de forma determinista", () => {
    const projects = [
      record("zeta", "Álamo", "2026-08-01T00:00:00.000Z"),
      record("alpha", "Casa Sur", "2026-08-03T00:00:00.000Z"),
      record("archived", "Casa Antigua", "2026-08-02T00:00:00.000Z", "archived"),
    ];

    expect(
      filterDashboardProjects(projects, "alamo", "all", "name").map((item) => item.id),
    ).toEqual(["zeta"]);
    expect(
      filterDashboardProjects(projects, "casa", "active", "updated").map((item) => item.id),
    ).toEqual(["alpha"]);
    expect(filterDashboardProjects(projects, "", "all", "name").map((item) => item.id)).toEqual([
      "zeta",
      "archived",
      "alpha",
    ]);
  });
});
