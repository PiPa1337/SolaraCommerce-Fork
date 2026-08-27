/**
 * T4 — Bugfix review 2: exportación.
 * ST-B5: el botón "Exportar producción" no debe habilitarse mientras la
 * auditoría está pendiente (primera carga y re-auditoría al alternar el
 * contexto público). ST-B6: en modo navegador (sin lanzador) el aviso de
 * exportación no debe prometer guardado en proyectos/<tienda>/sitios/.
 */
import type { Server } from "node:http";
import { expect, test } from "@playwright/test";
import { createCleanStore } from "./project-helpers";
import { startStudioServer, stopStudioServer } from "./studio-server";

test.setTimeout(process.env.CI ? 120_000 : 90_000);

let server: Server;
let studioUrl: string;

test.beforeAll(async () => {
  const running = await startStudioServer();
  server = running.server;
  studioUrl = running.url;
});

test.afterAll(async () => {
  await stopStudioServer(server);
});

/**
 * El studio registra un service worker PWA que desvía los requests de chunks
 * fuera de page.route. Se desactiva para que el retraso del chunk de
 * @solara/exporter sea determinístico.
 */
async function disableServiceWorker(page: import("@playwright/test").Page): Promise<void> {
  await page.addInitScript(() => {
    try {
      Object.defineProperty(navigator, "serviceWorker", {
        value: undefined,
        configurable: true,
      });
    } catch {
      // navegadores sin service workers: no hace falta neutralizarlo
    }
  });
}

/**
 * Retrasa la primera carga del chunk de @solara/exporter (identificado por su
 * cuerpo) para abrir una ventana determinística donde la auditoría asíncrona
 * del panel sigue pendiente. Otros JS pasan sin tocar.
 */
async function delayExporterChunk(
  page: import("@playwright/test").Page,
  delayMs: number,
): Promise<void> {
  await disableServiceWorker(page);
  let delayed = false;
  await page.route("**/assets/*.js", async (route) => {
    const request = route.request();
    if (delayed) {
      await route.continue();
      return;
    }
    const response = await route.fetch();
    const body = await response.body();
    delayed = body.includes("policies.incomplete");
    if (delayed) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
    await route.fulfill({ response, body });
  });
}

async function openDemoStore(page: import("@playwright/test").Page) {
  await page.goto(studioUrl);
  await expect(page.getByRole("heading", { name: "Tus tiendas" })).toBeVisible({
    timeout: 30_000,
  });
  await page
    .locator('article:has([data-store-card-id="store-modo-sur-demo"])')
    .getByRole("button", { name: "Abrir esta tienda" })
    .click();
  await expect(page.getByRole("navigation", { name: "Áreas de la tienda" })).toBeVisible();
}

test("no habilita el export de producción mientras la auditoría está pendiente", async ({
  page,
}) => {
  await delayExporterChunk(page, 10_000);
  await openDemoStore(page);
  await page.getByRole("tab", { name: "Exportar", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Exportar" })).toBeVisible({ timeout: 30_000 });

  const production = page.getByTestId("ui-export-production");
  await expect(production).toBeDisabled({ timeout: 1_500 });
  await expect(production).toBeEnabled({ timeout: 30_000 });
  await expect(page.getByText("Salud de exportación", { exact: false })).toBeVisible({
    timeout: 10_000,
  });
});

test("una tienda con críticos nunca habilita el export, ni al re-auditar por contexto", async ({
  page,
}) => {
  await delayExporterChunk(page, 12_000);
  await page.goto(studioUrl);
  await expect(page.getByRole("heading", { name: "Tus tiendas" })).toBeVisible({
    timeout: 30_000,
  });
  await createCleanStore(page, "Tienda de auditoría");
  await page.getByRole("tab", { name: "Exportar", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Exportar" })).toBeVisible({ timeout: 30_000 });

  const production = page.getByTestId("ui-export-production");
  await expect(production).toBeDisabled({ timeout: 1_500 });
  await page.locator(".export-ai-context input[type='checkbox']").uncheck();
  await expect(production).toBeDisabled({ timeout: 1_500 });
  await expect(page.locator(".export-warning")).toBeVisible({
    timeout: 30_000,
  });
  await expect(production).toBeDisabled();
});

test("el aviso post-exportación no promete guardado en proyectos/ en modo navegador", async ({
  page,
}) => {
  await openDemoStore(page);
  await page.getByRole("tab", { name: "Exportar", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Exportar" })).toBeVisible();

  await page.getByRole("button", { name: "Exportar borrador" }).click();
  const result = page.getByTestId("ui-export-result");
  await expect(result).toBeVisible({ timeout: 60_000 });
  await expect(result).toContainText("Exportación correcta");
  await expect(result).not.toContainText("proyectos/");
  await expect(result).not.toContainText("sitios/");
});
