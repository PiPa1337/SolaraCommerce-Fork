import { expect, test } from "vitest";
import {
  STOREFRONT_RUNTIME_CSS,
  STOREFRONT_RUNTIME_JS,
} from "../packages/storefront-runtime/src/index";

test("mantiene el runtime storefront dentro del presupuesto en bytes crudos", () => {
  const javascriptBytes = Buffer.byteLength(STOREFRONT_RUNTIME_JS, "utf8");
  const cssBytes = Buffer.byteLength(STOREFRONT_RUNTIME_CSS, "utf8");

  // Medición Task 6 (Step 1): runtime JS 41.475 B, runtime CSS 6.608 B.
  // Topes crudos con margen ~20-28% sobre la medición.
  console.log({
    storefrontRuntimeJavascriptRaw: javascriptBytes,
    storefrontRuntimeCssRaw: cssBytes,
  });
  expect(javascriptBytes).toBeLessThanOrEqual(52 * 1024);
  expect(cssBytes).toBeLessThanOrEqual(8 * 1024);
});
