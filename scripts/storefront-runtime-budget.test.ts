import { expect, test } from "vitest";
import {
  STOREFRONT_RUNTIME_CSS,
  STOREFRONT_RUNTIME_JS,
} from "../packages/storefront-runtime/src/index";

test("mantiene el runtime storefront dentro del presupuesto en bytes crudos", () => {
  const javascriptBytes = Buffer.byteLength(STOREFRONT_RUNTIME_JS, "utf8");
  const cssBytes = Buffer.byteLength(STOREFRONT_RUNTIME_CSS, "utf8");

  // Medición real al 2026-08-14: runtime JS 54.2 KB, runtime CSS 7.486 B.
  // El tope volvió de 56 a 55 KiB al quitar el parallax de cursor del hero V2
  // (connectHeroParallax, ~1.6 KB) que causaba micro-movimiento de 1px en el
  // borde derecho de la media. El runtime incluye controles de testimonios
  // exportados desde 2026-08-11.
  console.log({
    storefrontRuntimeJavascriptRaw: javascriptBytes,
    storefrontRuntimeCssRaw: cssBytes,
  });
  expect(javascriptBytes).toBeLessThanOrEqual(55 * 1024);
  expect(cssBytes).toBeLessThanOrEqual(8 * 1024);
});
