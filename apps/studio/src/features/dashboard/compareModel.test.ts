import type { StoreProjectV1 } from "@solara/project-schema";
import { buildCatalogModernProject } from "@solara/project-schema/catalog-modern-template";
import { referenceStore } from "@solara/project-schema/fixture";
import { describe, expect, test } from "vitest";
import type { StoredProject } from "../../lib/repository";
import { buildCompareReport, siteStatusLabel } from "./compareModel";

function stored(project: StoreProjectV1): StoredProject {
  return {
    id: project.id,
    name: project.name,
    status: project.status,
    updatedAt: project.updatedAt,
    project,
  };
}

describe("buildCompareReport", () => {
  test("demo vs revamp difieren en secciones y motion, no en inventario ni tema", () => {
    const demo = stored(
      buildCatalogModernProject({
        seed: "demo",
        id: "store-demo",
        name: "Predeterminado",
        slug: "demo",
        baseUrl: "https://demo.example",
      }),
    );
    const revamp = stored(
      buildCatalogModernProject({
        seed: "revamp",
        id: "store-revamp",
        name: "Predeterminado Revamp",
        slug: "revamp",
        baseUrl: "https://revamp.example",
      }),
    );

    const report = buildCompareReport(demo, revamp);

    expect(report.leftName).toBe("Predeterminado");
    expect(report.rightName).toBe("Predeterminado Revamp");
    for (const row of report.counts) {
      expect(row.left, `inventario ${row.label} igual`).toBe(row.right);
    }
    for (const row of report.theme) {
      expect(row.left, `tema ${row.label} igual`).toBe(row.right);
    }
    expect(report.sectionsOnlyInLeft).toEqual([]);
    expect(report.sectionsOnlyInRight).toEqual([]);

    const hero = report.motionDiffs.find((diff) => diff.moduleId === "catalog-hero");
    expect(hero).toBeDefined();
    expect(hero?.leftPreset).toBe("fade-up");
    expect(hero?.rightPreset).toBe("layer-stack");
    const brands = report.motionDiffs.find((diff) => diff.moduleId === "catalog-brand-strip");
    expect(brands?.rightPreset).toBe("fade");
    expect(
      report.motionDiffs.some((diff) => diff.moduleId === "catalog-product-grid"),
      "el grid diferencia distancias y stagger",
    ).toBe(true);
  });

  test("catalog modern vs referencia difieren en tema e inventario", () => {
    const modern = stored(
      buildCatalogModernProject({
        seed: "demo",
        id: "store-modern",
        name: "Moderno",
        slug: "moderno",
        baseUrl: "https://moderno.example",
      }),
    );
    const legacy = stored(referenceStore);

    const report = buildCompareReport(modern, legacy);

    const background = report.theme.find((row) => row.label === "Color de fondo");
    expect(background?.left).toBe("#fcfcfb");
    expect(background?.right).toBe("#f5f0e6");
    const radius = report.theme.find((row) => row.label === "Radio de esquinas");
    expect(radius?.left).toBe("16 px");
    expect(radius?.right).toBe("4 px");
    expect(
      report.counts.some((row) => row.left !== row.right),
      "algún conteo del inventario difiere",
    ).toBe(true);
  });

  test("el estado del sitio se etiqueta según el disco", () => {
    const base = stored(
      buildCatalogModernProject({
        seed: "clean",
        id: "store-clean",
        name: "Limpia",
        slug: "limpia",
        baseUrl: "https://limpia.example",
      }),
    );
    expect(siteStatusLabel(base)).toBe("Sin sitio en disco");
    expect(siteStatusLabel({ ...base, diskSiteStatus: "synced" })).toBe("Actualizado en disco");
    expect(siteStatusLabel({ ...base, diskSiteStatus: "site-outdated" })).toBe(
      "Sitio desactualizado",
    );
  });
});
