import { expect, test } from "vitest";
import { exportProject } from "../packages/exporter/src/index";
import { catalogModernStore } from "../packages/project-schema/src/catalog-modern-fixture";
import { referenceStore } from "../packages/project-schema/src/fixture";
import { catalogScaleStore } from "../packages/project-schema/src/scale-fixture";

test("P4-5: el export draft mantiene el contenido útil por ruta", () => {
  const result = exportProject(referenceStore, { mode: "draft" });
  for (const [path, marker] of [
    ["index.html", "Una casa con materia y calma."],
    ["productos/manta-bruma/index.html", "Manta Bruma"],
    ["categorias/textiles/index.html", "Textiles"],
    ["carrito/index.html", "Carrito"],
  ] as const) {
    const html = String(result.files.get(path) ?? "");
    expect(html, `draft ${path} sin contenido`).toContain(marker);
  }
  expect(String(result.files.get("index.html"))).toContain("noindex,nofollow");
  expect(String(result.files.get("robots.txt"))).toContain("Disallow: /");
  expect(result.files.has("sitemap.xml")).toBe(false);
  expect(result.files.has("google-merchant.xml")).toBe(false);
});

test("P4-9: robots/sitemap consistentes entre draft y production", () => {
  const draft = exportProject(referenceStore, { mode: "draft" });
  const production = exportProject(referenceStore, { mode: "production" });
  const draftRobots = String(draft.files.get("robots.txt"));
  const prodRobots = String(production.files.get("robots.txt"));
  expect(draftRobots).toContain("Disallow: /");
  expect(prodRobots).not.toContain("Disallow: /");
  const prodSitemap = String(production.files.get("sitemap.xml"));
  expect(prodSitemap).toContain("https://casa-luma.example/");
  for (const [name, project] of Object.entries({
    catalogModern: catalogModernStore,
    catalogScale: catalogScaleStore,
  })) {
    const exported = exportProject(project, { mode: "production" });
    const robots = String(exported.files.get("robots.txt"));
    expect(robots, `${name} robots`).toContain("Sitemap:");
    expect(robots, `${name} robots`).not.toContain("Disallow: /");
  }
});

test("P4-10: preload de la imagen LCP en todas las paginas con imagen", () => {
  for (const [name, project] of Object.entries({
    reference: referenceStore,
    catalogModern: catalogModernStore,
    catalogScale: catalogScaleStore,
  })) {
    const result = exportProject(project, { mode: "production" });
    let pages = 0;
    let withPreload = 0;
    for (const [path, content] of result.files) {
      if (!path.endsWith(".html")) continue;
      const html = String(content);
      if (!/<img[^>]*>/i.test(html) && !/<source[^>]*poster/i.test(html)) continue;
      pages += 1;
      if (/rel="preload" as="image"/.test(html)) withPreload += 1;
    }
    console.log(`${name}: ${withPreload}/${pages} paginas con imagen tienen preload LCP`);
    expect(withPreload, `${name}: preload faltante`).toBe(pages);
  }
});
