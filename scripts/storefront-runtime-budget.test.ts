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
  // La medición histórica de 55.3 KiB precede al techo vigente de 80 KiB,
  // que incluye Trusted Types y las capacidades agregadas después.
  console.log({
    storefrontRuntimeJavascriptRaw: javascriptBytes,
    storefrontRuntimeCssRaw: cssBytes,
  });
  // Task 9 agregó skeletons, contador, título con query y guards del índice.
  // Desde 2026-09-04 el checkout WhatsApp multiparte llevó el guard vigente a
  // 80 KiB con margen para el runtime serializado actual.
  expect(javascriptBytes).toBeLessThanOrEqual(80 * 1024);

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
