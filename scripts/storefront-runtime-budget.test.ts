import { gzipSync } from "node:zlib";
import { expect, test } from "vitest";
import {
  STOREFRONT_RUNTIME_CSS,
  STOREFRONT_RUNTIME_JS,
} from "../packages/storefront-runtime/src/index";

test("mantiene el runtime storefront dentro del presupuesto gzip", () => {
  const javascriptBytes = gzipSync(Buffer.from(STOREFRONT_RUNTIME_JS, "utf8")).byteLength;
  const cssBytes = gzipSync(Buffer.from(STOREFRONT_RUNTIME_CSS, "utf8")).byteLength;

  console.log({
    storefrontRuntimeJavascriptGzip: javascriptBytes,
    storefrontRuntimeCssGzip: cssBytes,
  });
  expect(javascriptBytes).toBeLessThanOrEqual(35 * 1024);
  expect(cssBytes).toBeLessThanOrEqual(30 * 1024);
});
