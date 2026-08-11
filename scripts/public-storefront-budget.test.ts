import { expect, test } from "vitest";
import { exportProject } from "../packages/exporter/src/index";
import { catalogModernStore } from "../packages/project-schema/src/catalog-modern-fixture";

test("mantiene el presupuesto de la salida pública optimizada", () => {
  const result = exportProject(catalogModernStore, { mode: "production" });
  const css = String(result.files.get("assets/storefront.css") ?? "");
  const javascript = String(result.files.get("assets/storefront.js") ?? "");
  const html = [...result.files.entries()]
    .filter(([path]) => path.endsWith(".html"))
    .map(([, value]) => String(value))
    .join("\n");
  const assetPaths = [...result.files.keys()].filter(
    (path) => path.startsWith("assets/") && !path.includes("storefront."),
  );

  // Mediciones reales al 2026-08-11 (bytes crudos tras dedupe y rollback):
  // storefront.css ≈ 75.132 B, storefront.js ≈ 54.259 B. El tope JS comparte
  // el css incluye los estilos generados por página del sitio exportado.
  expect(Buffer.byteLength(css, "utf8")).toBeLessThanOrEqual(780 * 1024);
  expect(Buffer.byteLength(javascript, "utf8")).toBeLessThanOrEqual(53 * 1024);
  expect(html).not.toContain("data:image/");
  expect(new Set(assetPaths).size).toBe(assetPaths.length);
  expect(html.match(/rel="preload" as="image"/g)?.length ?? 0).toBeGreaterThan(0);
});
