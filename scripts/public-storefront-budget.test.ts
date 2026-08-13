import { expect, test } from "vitest";
import { exportProject } from "../packages/exporter/src/index";
import { catalogModernStore } from "../packages/project-schema/src/catalog-modern-fixture";
import { catalogModernV2Store } from "../packages/project-schema/src/catalog-modern-v2-fixture";

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

test("mantiene la foundation V2 dentro de un presupuesto público explícito", () => {
  const result = exportProject(catalogModernV2Store, { mode: "production" });
  const css = String(result.files.get("assets/storefront.css") ?? "");
  const javascript = String(result.files.get("assets/storefront.js") ?? "");
  const cssBytes = Buffer.byteLength(css, "utf8");
  const javascriptBytes = Buffer.byteLength(javascript, "utf8");

  console.info({
    catalogModernV2CssRaw: cssBytes,
    catalogModernV2JavascriptRaw: javascriptBytes,
  });
  expect(cssBytes).toBeLessThanOrEqual(104 * 1024);
  expect(javascriptBytes).toBeLessThanOrEqual(53 * 1024);
});
