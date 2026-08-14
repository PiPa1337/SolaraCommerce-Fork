import { gzipSync } from "node:zlib";
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

  // Mediciones reales al 2026-08-14 (bytes crudos tras dedupe y rollback):
  // storefront.css ≈ 75.132 B, storefront.js ≈ 54.261 B. El tope JS subió de
  // 53 a 56 KiB por el parallax de cursor del hero V2 (connectHeroParallax,
  // ~1.6 KB); el css incluye los estilos generados por página del sitio exportado.
  expect(Buffer.byteLength(css, "utf8")).toBeLessThanOrEqual(780 * 1024);
  expect(Buffer.byteLength(javascript, "utf8")).toBeLessThanOrEqual(56 * 1024);
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
  const cssGzip = Buffer.byteLength(gzipSync(css, { level: 9 }), "utf8");

  console.info({
    catalogModernV2CssRaw: cssBytes,
    catalogModernV2CssGzip: cssGzip,
    catalogModernV2JavascriptRaw: javascriptBytes,
  });

  // Análisis de costo (2026-08-14): CSS estático minificado servido una vez;
  // gzip lo comprime a ~14% (≈16 KiB transferidos). El techo subió de 108 a
  // 120 KiB por el motion cinematográfico del hero V2 (~9 KB minificado:
  // coreografía de entrada, hover del CTA, beneficios, parallax y reduced
  // motion), con margen para la iteración visual V2 en curso sin tocar los
  // gates del runtime (56 KiB JS / 8 KiB CSS) ni el tope público de V1 (780 KiB).
  expect(cssBytes).toBeLessThanOrEqual(120 * 1024);
  expect(javascriptBytes).toBeLessThanOrEqual(56 * 1024);
});
