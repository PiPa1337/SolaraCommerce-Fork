/**
 * Barrido visual de las tiendas reales del disco (predeterminada y RM
 * Descartables) exportadas con el código de trabajo actual. Diagnóstico
 * manual, no es gate de CI. Escribe PNGs en screenshots/vision-stores-<fecha>/.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import {
  REAL_STORES,
  SWEEP_VIEWPORTS,
  type LoadedStore,
  loadStore,
  revealPage,
  serve,
} from "./real-store-loader";

const OUTPUT_ROOT = join("screenshots", "vision-stores-2026-08-29");

async function brokenImages(page: import("@playwright/test").Page): Promise<string[]> {
  return page
    .locator("img")
    .evaluateAll((images) =>
      images
        .filter((image) => image.complete && image.naturalWidth === 0)
        .map((image) => image.currentSrc || image.getAttribute("src") || image.getAttribute("alt") || "sin src"),
    );
}

for (const store of REAL_STORES) {
  test.describe(`tienda ${store.label}`, () => {
    let loaded: LoadedStore;
    let url = "";
    let server: import("node:http").Server;
    const summary: Record<string, unknown> = { store: store.label, capturas: [], rotas: [], errores: [] };

    test.beforeAll(async () => {
      test.setTimeout(420_000);
      loaded = loadStore(store.label, store.dir);
      const served = await serve(loaded.files);
      url = served.url;
      server = served.server;
    });

    test.afterAll(() => {
      server?.close();
      const outDir = join(OUTPUT_ROOT, store.label);
      mkdirSync(outDir, { recursive: true });
      writeFileSync(join(outDir, "resumen.json"), JSON.stringify(summary, null, 2));
    });

    for (const viewport of SWEEP_VIEWPORTS) {
      test(`captura ${viewport.name}px`, async ({ page }, testInfo) => {
        testInfo.setTimeout(300_000);
        await page.setViewportSize({ width: viewport.width, height: viewport.height });
        const outDir = join(OUTPUT_ROOT, store.label, viewport.name);
        mkdirSync(outDir, { recursive: true });
        for (const route of loaded.routes) {
          await page.goto(new URL(route.path, url).toString());
          await revealPage(page);
          const rotas = await brokenImages(page);
          if (rotas.length > 0) {
            (summary.rotas as string[]).push(`${viewport.name}/${route.name}: ${rotas.join(", ")}`);
          }
          await page.screenshot({ path: join(outDir, `${route.name}.png`), fullPage: true });
          (summary.capturas as string[]).push(`${viewport.name}/${route.name}.png`);
        }

        if (viewport.name === "390" || viewport.name === "1440") {
          const producto = loaded.routes.find((route) => route.name === "producto");
          if (producto) {
            await page.goto(new URL(producto.path, url).toString());
            await revealPage(page);
            const agregar = page.getByRole("button", { name: /agregar/i }).first();
            if (await agregar.isVisible().catch(() => false)) {
              await agregar.click();
              await page.waitForTimeout(600);
              const drawerRotas = await brokenImages(page);
              if (drawerRotas.length > 0) {
                (summary.rotas as string[]).push(`${viewport.name}/drawer: ${drawerRotas.join(", ")}`);
              }
              await page.screenshot({ path: join(outDir, "drawer-carrito.png"), fullPage: false });
              (summary.capturas as string[]).push(`${viewport.name}/drawer-carrito.png`);
              await page.goto(new URL("/carrito/", url).toString());
              await revealPage(page);
              await page.screenshot({ path: join(outDir, "carrito-lleno.png"), fullPage: true });
              (summary.capturas as string[]).push(`${viewport.name}/carrito-lleno.png`);
              if (loaded.files.has("checkout/index.html")) {
                await page.goto(new URL("/checkout/", url).toString());
                await revealPage(page);
                await page.screenshot({ path: join(outDir, "checkout-lleno.png"), fullPage: true });
                (summary.capturas as string[]).push(`${viewport.name}/checkout-lleno.png`);
              }
            } else {
              (summary.errores as string[]).push(`${viewport.name}: no se encontró botón Agregar en ${producto.path}`);
            }
          }
        }
        expect((summary.rotas as string[]).length, "imágenes rotas detectadas").toEqual(0);
      });
    }
  });
}
