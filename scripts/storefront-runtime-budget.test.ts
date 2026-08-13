import { expect, test } from "vitest";
import {
  STOREFRONT_RUNTIME_CSS,
  STOREFRONT_RUNTIME_JS,
} from "../packages/storefront-runtime/src/index";

test("mantiene el runtime storefront dentro del presupuesto en bytes crudos", () => {
  const javascriptBytes = Buffer.byteLength(STOREFRONT_RUNTIME_JS, "utf8");
  const cssBytes = Buffer.byteLength(STOREFRONT_RUNTIME_CSS, "utf8");

  // Medición real al 2026-08-13: runtime JS 52.993 B, runtime CSS 7.486 B.
  // El runtime incluye controles de testimonios exportados desde 2026-08-11.
  console.log({
    storefrontRuntimeJavascriptRaw: javascriptBytes,
    storefrontRuntimeCssRaw: cssBytes,
  });
  expect(javascriptBytes).toBeLessThanOrEqual(53 * 1024);
  expect(cssBytes).toBeLessThanOrEqual(8 * 1024);
});
