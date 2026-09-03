import { gzipSync } from "node:zlib";
import { expect, test } from "vitest";
import { exportProject } from "../packages/exporter/src/index";
import { catalogModernStore } from "../packages/project-schema/src/catalog-modern-fixture";
import {
  STOREFRONT_RUNTIME_CSS,
  STOREFRONT_RUNTIME_JS,
} from "../packages/storefront-runtime/src/index";

test("mantiene el runtime storefront dentro del presupuesto", () => {
  const javascriptBytes = Buffer.byteLength(STOREFRONT_RUNTIME_JS, "utf8");
  const cssBytes = Buffer.byteLength(STOREFRONT_RUNTIME_CSS, "utf8");

  // Medición real al 2026-08-17: runtime JS 55.3 KiB, runtime CSS 7.486 B.
  // El techo de 64 KiB incluye el pequeño coste de la política Trusted Types
  // que protege los sinks HTML del carrito y la búsqueda.
  console.log({
    storefrontRuntimeJavascriptRaw: javascriptBytes,
    storefrontRuntimeCssRaw: cssBytes,
  });
  expect(javascriptBytes).toBeLessThanOrEqual(64 * 1024);

  const { files } = exportProject(catalogModernStore, { mode: "production" });
  const manifest = JSON.parse(String(files.get("deployment-manifest.json"))) as {
    runtime: { css: string };
  };
  const cssPath = manifest.runtime.css.replace(/^\//, "");
  const publicCss = files.get(cssPath);
  if (publicCss === undefined) throw new Error(`Asset runtime CSS ausente: ${cssPath}`);
  const cssGzip = Buffer.byteLength(gzipSync(String(publicCss), { level: 9 }), "utf8");
  console.log({ publicStorefrontCssGzip: cssGzip });
  // El CSS público exportado mide ~28 KiB gz: 40 KiB gz es presupuesto anti-exceso, no límite de negocio.
  expect(cssGzip).toBeLessThanOrEqual(40 * 1024);
});
