/**
 * Auditoría de controles (2026-08-10) — regresión del panel Exportar.
 * F8-B1: el resumen "Salud de exportación" debe mostrar el mismo conteo de
 * críticos que bloquea "Exportar producción" (una sola fuente de verdad).
 * F8-B2: las etapas de generación deben avanzar de a una a medida que el
 * worker las completa (validate antes que render/package).
 */
import type { Server } from "node:http";
import { expect, test } from "@playwright/test";
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

async function resetIndexedDb(page: import("@playwright/test").Page) {
  await page.goto(studioUrl);
  await page.evaluate(
    () =>
      new Promise<void>((resolveDelete, reject) => {
        const request = indexedDB.deleteDatabase("solara-commerce-studio");
        request.addEventListener("success", () => resolveDelete());
        request.addEventListener("error", () => reject(request.error));
      }),
  );
  await page.reload();
  await expect(page.getByRole("heading", { name: "Tus tiendas" })).toBeVisible();
}

async function openDemoStore(page: import("@playwright/test").Page) {
  await resetIndexedDb(page);
  await page.locator('[data-store-card-id="store-modo-sur-demo"]').click();
  await page.getByRole("button", { name: "Abrir tienda", exact: true }).click();
  await page.getByRole("tab", { name: "Exportar", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Exportar" })).toBeVisible();
}

async function createAuditStore(page: import("@playwright/test").Page) {
  await page.getByRole("button", { name: "Nueva tienda", exact: true }).click();
  await page.getByLabel("Nueva tienda").fill("Tienda de auditoría");
  for (let step = 0; step < 3; step += 1) {
    await page.getByRole("button", { name: "Continuar", exact: true }).click();
  }
  await page.getByRole("button", { name: "Crear tienda vacía", exact: true }).click();
  await expect(page.getByRole("navigation", { name: "Áreas de la tienda" })).toBeVisible({
    timeout: 30_000,
  });
}

test("el resumen de salud muestra el mismo conteo de críticos que bloquea la producción", async ({
  page,
}) => {
  await resetIndexedDb(page);
  await createAuditStore(page);
  await page.getByRole("tab", { name: "Exportar", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Exportar" })).toBeVisible();

  const block = page.getByText(/errores críticos deben resolverse/);
  await expect(block).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId("ui-export-production")).toBeDisabled();

  const blockCount = Number((await block.innerText()).match(/(\d+) errores críticos/)?.[1] ?? "0");
  expect(blockCount).toBeGreaterThan(0);
  await expect(page.locator(".optimization-export-summary")).toContainText(
    `${blockCount} críticos`,
  );
});

test("las etapas de generación avanzan de a una mientras exporta el borrador", async ({ page }) => {
  test.setTimeout(process.env.CI ? 150_000 : 90_000);
  await openDemoStore(page);

  await page.getByTestId("ui-export-draft").click();
  await expect(page.getByTestId("ui-export-stage")).toHaveCount(3);

  await page.waitForFunction(
    () => {
      const stages = Array.from(
        document.querySelectorAll<HTMLElement>('[data-testid="ui-export-stage"]'),
      );
      const done = (id: string) =>
        stages.find((node) => node.dataset.stage === id)?.dataset.done === "true";
      return done("validate") && !done("render");
    },
    undefined,
    { timeout: 60_000 },
  );

  await expect(page.getByTestId("ui-export-result")).toContainText("Exportación correcta", {
    timeout: 60_000,
  });
  for (const stage of ["validate", "render", "package"]) {
    await expect(
      page.locator(`[data-testid="ui-export-stage"][data-stage="${stage}"]`),
    ).toHaveAttribute("data-done", "true");
  }
});
