import { gzipSync } from "node:zlib";
import { expect, test } from "vitest";
import {
  STOREFRONT_RUNTIME_CSS,
  STOREFRONT_RUNTIME_JS,
} from "../packages/storefront-runtime/src/index";
import { getCatalogModernExport } from "./export-shared-fixture";

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
  // Task 9: skeletons de búsqueda, contador visible, título con query y guards del índice suman ~450 B; tope 68 KiB autorizado por el brief.
  expect(javascriptBytes).toBeLessThanOrEqual(68 * 1024);

  const { files } = getCatalogModernExport();
  const manifest = JSON.parse(String(files.get("deployment-manifest.json"))) as {
    runtime: { css: string };
  };
  const cssPath = manifest.runtime.css.replace(/^\//, "");
  const publicCss = files.get(cssPath);
  if (publicCss === undefined) throw new Error(`Asset runtime CSS ausente: ${cssPath}`);
  const cssGzip = Buffer.byteLength(gzipSync(String(publicCss), { level: 9 }), "utf8");
  console.log({ publicStorefrontCssGzip: cssGzip });
  // 2026-09-03 (task 11): css dark muerto eliminado (decisión F4); el CSS
  // público exportado mide ~13,6 KiB gz: 32 KiB gz es presupuesto anti-exceso,
  // no límite de negocio.
  expect(cssGzip).toBeLessThanOrEqual(32 * 1024);
});
