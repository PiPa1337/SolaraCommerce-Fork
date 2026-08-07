import { expect, test } from "vitest";
import {
  STOREFRONT_RUNTIME_CSS,
  STOREFRONT_RUNTIME_JS,
} from "../packages/storefront-runtime/src/index";

test("mantiene el runtime storefront dentro del presupuesto en bytes crudos", () => {
  const javascriptBytes = Buffer.byteLength(STOREFRONT_RUNTIME_JS, "utf8");
  const cssBytes = Buffer.byteLength(STOREFRONT_RUNTIME_CSS, "utf8");

  // Medición Task 6 (Step 1): runtime JS 41.475 B, runtime CSS 6.608 B.
  // El techo JS subió de 52 a 56 KiB (2026-08-07): la búsqueda con relevancia
  // y la capa de movimiento aprobada (presets zoom/blur, capability micro con
  // tilt/magnetic/spotlight/parallax/back-to-top/kinetic, FAQ y stats) llevan
  // el runtime a ~53.2 KiB; 56 KiB bloquea crecimientos accidentales sin
  // obligar a recortar el alcance aprobado (~20-22 KiB gzip, sigue siendo
  // pequeño para un sitio estático). El CSS runtime se mantiene en 8 KiB.
  console.log({
    storefrontRuntimeJavascriptRaw: javascriptBytes,
    storefrontRuntimeCssRaw: cssBytes,
  });
  expect(javascriptBytes).toBeLessThanOrEqual(56 * 1024);
  expect(cssBytes).toBeLessThanOrEqual(8 * 1024);
});
