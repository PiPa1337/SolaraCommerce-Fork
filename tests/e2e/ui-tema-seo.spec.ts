import type { Server } from "node:http";
import { expect, type Locator, type Page, test } from "@playwright/test";
import { createCleanStore } from "./project-helpers";
import { startStudioServer, stopStudioServer } from "./studio-server";

/**
 * F10 — Regresión de controles de Tema y SEO (hallazgo H8-B1).
 * Presets con paleta real en el preview, reset a los valores de apertura,
 * rechazo de hex inválido con error inline, y persistencia del título SEO.
 */

test.setTimeout(process.env.CI ? 60_000 : 30_000);

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

async function setupCleanStore(page: Page, name: string): Promise<void> {
  await page.goto(studioUrl);
  await page.evaluate(
    () =>
      new Promise<void>((resolve, reject) => {
        const request = indexedDB.deleteDatabase("solara-commerce-studio");
        request.addEventListener("success", () => resolve());
        request.addEventListener("error", () => reject(request.error));
        request.addEventListener("blocked", () => reject(new Error("La base quedó bloqueada.")));
      }),
  );
  await page.reload();
  await createCleanStore(page, name);
}

async function openThemeTab(page: Page): Promise<void> {
  await page.getByRole("tab", { name: "Tema", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Tema", exact: true })).toBeVisible();
}

function fieldsetOf(input: Locator): Locator {
  return input.locator("xpath=ancestor::fieldset[contains(@class, 'field')]");
}

function previewBackground(page: Page): () => Promise<string> {
  const html = page.frameLocator('iframe[title="Vista previa desktop"]').locator("html");
  return () => html.evaluate((element) => getComputedStyle(element).backgroundColor);
}

test("los presets de Tema aplican la paleta real al preview (H8-09)", async ({ page }) => {
  await setupCleanStore(page, "Tienda paleta");
  await openThemeTab(page);

  const accentText = page.getByTestId("ui-color-text-accent");
  const background = previewBackground(page);
  await expect.poll(background, { timeout: 15_000 }).toBe("rgb(252, 252, 251)");

  await page.getByRole("button", { name: "Aplicar paleta Costa terracota" }).click();

  await expect(accentText).toHaveValue("#b4552d");
  await expect(page.getByTestId("ui-color-text-background")).toHaveValue("#faf6f2");
  await expect.poll(background, { timeout: 15_000 }).toBe("rgb(250, 246, 242)");
});

test("el preset aplicado queda marcado como seleccionado en el panel (feedback visible)", async ({
  page,
}) => {
  await setupCleanStore(page, "Tienda selección");
  await openThemeTab(page);

  const presets = page.getByTestId("ui-theme-preset");

  await page.getByRole("button", { name: "Aplicar paleta Tinta profunda" }).click();

  const deepInk = presets.filter({ hasText: "Tinta profunda" });
  await expect(deepInk).toHaveAttribute("aria-pressed", "true");
  await expect(deepInk).toHaveAttribute("data-active", "true");
  // La marca "✓ Aplicada" vive en el pseudo-elemento ::after.
  await expect
    .poll(() => deepInk.evaluate((el) => getComputedStyle(el, "::after").content))
    .toContain("Aplicada");

  const editorial = presets.filter({ hasText: "Editorial cálido" });
  await expect(editorial).toHaveAttribute("aria-pressed", "false");

  // El preview y el input de fondo reflejan la paleta aplicada.
  await expect(page.getByTestId("ui-color-text-background")).toHaveValue("#16151a");
  await expect.poll(previewBackground(page), { timeout: 15_000 }).toBe("rgb(22, 21, 26)");
});

test("Restaurar colores vuelve a los valores de apertura de la pestaña (H8-10)", async ({
  page,
}) => {
  await setupCleanStore(page, "Tienda reset");
  await openThemeTab(page);

  const accentText = page.getByTestId("ui-color-text-accent");
  const backgroundText = page.getByTestId("ui-color-text-background");
  const originalAccent = await accentText.inputValue();
  const originalBackground = await backgroundText.inputValue();

  await page.getByRole("button", { name: "Aplicar paleta Salvia serena" }).click();
  await expect(accentText).toHaveValue("#3a5244");
  await expect(backgroundText).toHaveValue("#f5f7f4");

  await page.getByTestId("ui-reset-colors").click();
  await expect(accentText).toHaveValue(originalAccent);
  await expect(backgroundText).toHaveValue(originalBackground);
  await expect.poll(previewBackground(page), { timeout: 15_000 }).toBe("rgb(252, 252, 251)");
});

test("un color hex inválido muestra error inline y no commitea (H8-B1)", async ({ page }) => {
  await setupCleanStore(page, "Tienda hex inválido");
  await openThemeTab(page);

  const accentText = page.getByTestId("ui-color-text-accent");
  const accentNative = page.getByTestId("ui-color-native-accent");
  const accentField = fieldsetOf(accentText);
  const originalAccent = await accentText.inputValue();
  const originalNative = await accentNative.inputValue();

  await accentText.fill("zzz");
  await expect(accentText).toHaveAttribute("aria-invalid", "true");
  await expect(accentField.getByTestId("ui-field-error")).toContainText("Ingresá un color hex");
  await expect(accentText).toHaveValue("zzz");
  await expect(accentNative).toHaveValue(originalNative);
  await expect(page.getByTestId("ui-contrast-warn")).toHaveCount(0);

  await accentText.fill("#12345");
  await expect(accentField.getByTestId("ui-field-error")).toContainText("Ingresá un color hex");
  await expect(accentNative).toHaveValue(originalNative);

  await accentText.fill("#B4552D");
  await expect(accentField.getByTestId("ui-field-error")).toHaveCount(0);
  await expect(accentText).toHaveValue("#b4552d");
  await expect(accentNative).toHaveValue("#b4552d");

  await accentText.fill("#fff");
  await expect(accentText).toHaveValue("#ffffff");
  await expect(accentNative).toHaveValue("#ffffff");

  await accentText.fill(originalAccent);
  await expect(accentText).toHaveValue(originalAccent);
  await expect(accentNative).toHaveValue(originalNative);
});

test("el título SEO persiste al cambiar de pestaña (H8-01)", async ({ page }) => {
  await setupCleanStore(page, "Tienda SEO");
  await page.getByRole("tab", { name: "SEO", exact: true }).click();
  await expect(page.getByRole("heading", { name: "SEO y Google" })).toBeVisible();

  const title = page.getByLabel("Título SEO");
  await title.fill("Título SEO auditoría F10");
  await expect(page.getByText("24/70 caracteres")).toBeVisible();

  await page.getByRole("tab", { name: "Resumen", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Resumen", exact: true })).toBeVisible();

  await page.getByRole("tab", { name: "SEO", exact: true }).click();
  await expect(page.getByLabel("Título SEO")).toHaveValue("Título SEO auditoría F10");
});

test("los pares de color del Tema tienen nombres accesibles independientes", async ({ page }) => {
  await setupCleanStore(page, "Tienda colores accesibles");
  await openThemeTab(page);

  await expect(page.getByLabel("Fondo selector de color")).toHaveValue("#fcfcfb");
  await expect(page.getByLabel("Fondo valor hexadecimal")).toHaveValue("#fcfcfb");
  await expect(page.getByLabel("Texto secundario selector de color")).toBeVisible();
  await expect(page.getByLabel("Texto secundario valor hexadecimal")).toBeVisible();
});

test("SEO comunica el estado de auditoría y prioriza el diagnóstico sobre las previews", async ({
  page,
}) => {
  await setupCleanStore(page, "Tienda SEO estados");
  await page.getByRole("tab", { name: "SEO", exact: true }).click();

  const status = page.getByTestId("ui-seo-audit-state");
  const audit = page.getByTestId("ui-seo-audit-panel");
  const previews = page.getByTestId("ui-seo-preview-google");

  await expect(status).toBeVisible();
  await expect(status).toHaveText(/Auditoría lista|críticos/);
  await expect(audit).toBeVisible();
  await expect(audit).toContainText(/errores críticos|No se detectaron problemas/);

  const auditBox = await audit.boundingBox();
  const previewsBox = await previews.boundingBox();
  expect(auditBox).not.toBeNull();
  expect(previewsBox).not.toBeNull();
  expect(auditBox?.y).toBeLessThan(previewsBox?.y ?? Number.POSITIVE_INFINITY);
  const semanticOrder = await page
    .locator(".seo-grid")
    .evaluate((grid) => Array.from(grid.children).map((child) => child.className));
  expect(semanticOrder.indexOf("audit-panel")).toBeLessThan(semanticOrder.indexOf("seo-previews"));
});

test("los accesos de auditoría SEO navegan y devuelven el foco al tab destino", async ({
  page,
}) => {
  await setupCleanStore(page, "Tienda SEO foco");
  await page.getByRole("tab", { name: "SEO", exact: true }).click();

  const fix = page.getByTestId("ui-seo-audit-fix").first();
  await expect(fix).toBeVisible();
  await fix.click();

  const assetsTab = page.getByRole("tab", { name: "Recursos", exact: true });
  await expect(assetsTab).toHaveAttribute("aria-selected", "true");
  await expect(assetsTab).toBeFocused();
});
