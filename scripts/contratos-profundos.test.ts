import { expect, test } from "vitest";
import { createPublicExportManifest, exportProject } from "../packages/exporter/src/index";
import { catalogModernStore } from "../packages/project-schema/src/catalog-modern-fixture";
import { referenceStore } from "../packages/project-schema/src/fixture";
import { getCategoryProductIds } from "../packages/project-schema/src/index";
import { catalogScaleStore } from "../packages/project-schema/src/scale-fixture";

const fixtures = {
  reference: referenceStore,
  catalogModern: catalogModernStore,
  catalogScale: catalogScaleStore,
} as const;

test("P6-2: data-design-family del html coincide con el fixture", () => {
  for (const [name, project] of Object.entries(fixtures)) {
    const result = exportProject(project, { mode: "production" });
    const home = String(result.files.get("index.html"));
    const family = project.commerceTemplates.designFamily ?? "legacy-editorial-v1";
    expect(home, `${name}: design-family`).toContain(`data-design-family="${family}"`);
  }
});

test("P6-3: los productIds de categorias y colecciones son indices derivados validos", () => {
  for (const [name, project] of Object.entries(fixtures)) {
    for (const category of project.categories) {
      const expected = getCategoryProductIds(project, category.id);
      const declared = category.productIds;
      expect(
        [...declared].sort(),
        `${name}: productIds de categoría ${category.slug} desincronizados`,
      ).toEqual([...expected].sort());
    }
    for (const collection of project.collections) {
      const activeIds = new Set(
        collection.productIds.filter((id) =>
          project.products.some((product) => product.id === id && product.status === "active"),
        ),
      );
      expect(activeIds.size, `${name}: colección ${collection.slug} con ids inactivos`).toBe(
        collection.productIds.length,
      );
    }
  }
});

test("P6-4: sin assets huerfanos ni faltantes en el export", () => {
  for (const [name, project] of Object.entries(fixtures)) {
    const result = exportProject(project, { mode: "production" });
    const htmlFiles = [...result.files.entries()]
      .filter(([path]) => path.endsWith(".html"))
      .map(([, value]) => String(value))
      .join("\n");
    const emitted = [...result.files.keys()].filter(
      (path) => path.startsWith("assets/") && !path.startsWith("assets/fonts/"),
    );
    expect(emitted.length, `${name}: sin assets emitidos`).toBeGreaterThan(0);
    const orphans = emitted.filter((path) => !htmlFiles.includes(`/${path}`));
    expect(orphans, `${name}: assets huerfanos ${orphans.join(", ")}`).toEqual([]);
  }
});

test("P6-5: las features del runtime estan declaradas en el html", () => {
  for (const [name, project] of Object.entries(fixtures)) {
    const result = exportProject(project, { mode: "production" });
    const home = String(result.files.get("index.html"));
    const manifest = createPublicExportManifest(project);
    const declared = (home.match(/data-solara-runtime-features="([^"]*)"/)?.[1] ?? "")
      .split(",")
      .filter(Boolean);
    for (const feature of manifest.runtimeFeatures ?? []) {
      expect(declared, `${name}: feature ${feature} no declarada`).toContain(feature);
    }
  }
});

test("P6-6: los estilos de familia estan aislados bajo su raiz", () => {
  for (const [name, project] of Object.entries(fixtures)) {
    const result = exportProject(project, { mode: "production" });
    const css = String(result.files.get("assets/storefront.css") ?? "");
    const family = project.commerceTemplates.designFamily ?? "legacy-editorial-v1";
    if (family === "catalog-modern-v2") {
      expect(css, `${name}: sin raiz .cm.v2`).toContain(".cm.v2");
      expect(css.indexOf(".catalog-hero-inner"), `${name}: hero v2 fuera de scope`).toBeGreaterThan(
        css.indexOf(".cm.v2"),
      );
    }
    if (family === "legacy-editorial-v1" || family === "catalog-modern-v1") {
      expect(css, `${name}: sin scope legacy`).toContain("[data-solara-store]");
    }
  }
});

test("P6-7: el sitemap no duplica canonicales", () => {
  for (const [name, project] of Object.entries(fixtures)) {
    const result = exportProject(project, { mode: "production" });
    const sitemap = String(result.files.get("sitemap.xml") ?? "");
    const locations = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
    expect(new Set(locations).size, `${name}: sitemap con duplicados`).toBe(locations.length);
    expect(locations.length, `${name}: sitemap vacio`).toBeGreaterThan(0);
  }
});
