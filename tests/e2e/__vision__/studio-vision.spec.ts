/**
 * Visión real del Studio: recorre cada pantalla y captura screenshots en
 * múltiples viewports para auditoría UI/UX. No es un test de CI: es una
 * herramienta de diagnóstico (se ejecuta manualmente con --config apuntando
 * a este archivo, o vía `pnpm vision` si se registra el script).
 */
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { startStudioServer, stopStudioServer } from "../studio-server";

const OUTPUT_ROOT = "test-results/studio-vision";

const VIEWPORTS = [
  { name: "wide", width: 1440, height: 900 },
  { name: "desktop", width: 1280, height: 800 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "mobile", width: 390, height: 844 },
] as const;

let server: Awaited<ReturnType<typeof startStudioServer>>["server"];
let url = "";

test.beforeAll(async () => {
  const started = await startStudioServer();
  server = started.server;
  url = started.url;
});

test.afterAll(async () => {
  await stopStudioServer(server);
});

async function cleanIndexedDb(page: import("@playwright/test").Page): Promise<void> {
  await page.evaluate(
    () =>
      new Promise<void>((resolve, reject) => {
        const request = indexedDB.deleteDatabase("solara-commerce-studio");
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      }),
  );
}

/**
 * El servidor de pruebas no tiene fallback SPA: /__studio/components no
 * existe como archivo y respondería 404. Interceptar la ruta y servir el
 * index.html del Studio replica el comportamiento de un hosting estático.
 */
async function enableSpaFallback(
  page: import("@playwright/test").Page,
  baseUrl: string,
): Promise<void> {
  await page.route("**/__studio/components*", async (route) => {
    const indexResponse = await page.request.get(`${baseUrl}/`);
    route.fulfill({
      status: 200,
      contentType: "text/html; charset=utf-8",
      body: await indexResponse.text(),
    });
  });
}

/** Abre el Studio con datos limpios y espera el shell listo. */
async function openStudio(page: import("@playwright/test").Page): Promise<void> {
  await page.goto(url);
  await cleanIndexedDb(page);
  await page.reload();
  await expect(page.getByRole("heading", { name: "Tus tiendas" })).toBeVisible({ timeout: 20000 });
}

/** Cierra el panel de detalle del dashboard si quedó abierto. */
async function closeDetailIfOpen(page: import("@playwright/test").Page): Promise<void> {
  const closeButton = page.getByRole("button", { name: "Cerrar detalle" });
  if (await closeButton.isVisible().catch(() => false)) {
    // Escape es el atajo oficial del panel y evita overlays que interceptan
    // el puntero sobre el botón en viewports angostos.
    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);
  }
}

for (const viewport of VIEWPORTS) {
  test.describe(`vision ${viewport.name} ${viewport.width}x${viewport.height}`, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height } });

    test(`captura todas las pantallas`, async ({ page }) => {
      const outDir = join(OUTPUT_ROOT, viewport.name);
      mkdirSync(outDir, { recursive: true });
      await enableSpaFallback(page, url);

      // 1) Dashboard
      await openStudio(page);
      await page.waitForTimeout(400);
      // En viewports angostos la primera tienda puede llegar seleccionada:
      // capturar con el detalle abierto (estado real del usuario) y cerrarlo
      // antes de navegar, porque su overlay intercepta el puntero.
      await page.screenshot({ path: join(outDir, "01-dashboard.png"), fullPage: true });
      await closeDetailIfOpen(page);

      // 2-9) Tabs del Studio sobre la tienda Predeterminado
      // El detalle puede seguir abierto (estado real tras la captura): el
      // botón "Abrir tienda" vive dentro del propio panel, así que no hace
      // falta cerrarlo ni clickear la card de nuevo.
      await page
        .getByRole("button", { name: "Cerrar detalle" })
        .isVisible({ timeout: 3000 })
        .catch(() => {});
      const openButton = page.getByRole("button", { name: "Abrir tienda", exact: true });
      if (await openButton.isVisible().catch(() => false)) {
        await openButton.click();
      } else {
        await page.locator("[data-store-card-id]").first().click();
        await page.getByRole("button", { name: "Abrir tienda", exact: true }).click();
      }
      await expect(page.getByRole("tab", { name: "Preparar" })).toBeVisible({ timeout: 20000 });
      const tabsToCapture = [
        ["Preparar", "01-guided"],
        ["Resumen", "02-overview"],
        ["Catálogo", "03-catalog"],
        ["Constructor", "04-builder"],
        ["Tema de la tienda", "05-theme"],
        ["Recursos", "06-assets"],
        ["SEO", "07-seo"],
        ["Exportar", "08-export"],
      ] as const;
      for (const [tabLabel, fileName] of tabsToCapture) {
        await page.getByRole("tab", { name: tabLabel, exact: true }).click();
        await page.waitForTimeout(600);
        await page.screenshot({ path: join(outDir, `${fileName}.png`), fullPage: true });
      }

      // El servidor de pruebas ahora sirve index.html para /__studio/*
      // (fallback SPA); la galería renderiza igual que en producción.
      await page.goto(new URL("/__studio/components", url).toString());
      await page.waitForTimeout(1500);
      // Diagnóstico: si el heading no aparece, capturar igual para ver el estado.
      await expect(page.getByRole("heading", { name: "Galería de componentes" })).toBeVisible({
        timeout: 10000,
      });
      await page.screenshot({ path: join(outDir, "09-component-gallery.png"), fullPage: true });
    });
  });
}
