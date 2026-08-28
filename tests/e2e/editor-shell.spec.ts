import type { Server } from "node:http";
import { expect, type Page, test } from "@playwright/test";
import { createCleanStore } from "./project-helpers";
import { startStudioServer, stopStudioServer } from "./studio-server";

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

async function openStore(page: Page) {
  await page.goto(studioUrl);
  await page.evaluate(
    () =>
      new Promise<void>((resolve, reject) => {
        const request = indexedDB.deleteDatabase("solara-commerce-studio");
        request.addEventListener("success", () => resolve());
        request.addEventListener("error", () => reject(request.error));
        request.addEventListener("blocked", () =>
          reject(new Error("No se pudo limpiar la base de Studio.")),
        );
      }),
  );
  await page.reload();
  await expect(page.getByRole("heading", { name: "Tus tiendas" })).toBeVisible();
  await createCleanStore(page, "Tienda shell");
  await page.getByRole("tab", { name: "Constructor", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Constructor" })).toBeVisible();
}

test("la barra de estado muestra esquema y modo de persistencia (T3.5)", async ({ page }) => {
  await openStore(page);
  const bar = page.getByTestId("ui-status-bar");
  await expect(bar).toBeVisible();
  await expect(bar).toContainText("Esquema v2");
  const text = await bar.textContent();
  expect(text).toMatch(/Persistencia: (Disco|IndexedDB)/);
});

test("el modo foco oculta el shell y se restaura con Escape (T3.6)", async ({ page }) => {
  await openStore(page);
  const shell = page.locator(".studio-shell");
  const toggle = page.getByTestId("ui-focus-toggle");

  await toggle.click();
  await expect(shell).toHaveAttribute("data-studio-focus", "true");
  await expect(page.getByTestId("ui-focus-exit")).toBeVisible();
  await expect(page.getByRole("tab", { name: "Constructor", exact: true })).not.toBeVisible();
  await expect(
    page.getByRole("button", { name: "Volver a tiendas", exact: true }),
  ).not.toBeVisible();
  await expect(page.getByTestId("ui-status-bar")).not.toBeVisible();
  await expect(page.getByRole("tabpanel")).not.toBeVisible();

  await page.keyboard.press("Escape");
  await expect(shell).not.toHaveAttribute("data-studio-focus", "true");
  await expect(page.getByRole("tab", { name: "Constructor", exact: true })).toBeVisible();
  await expect(page.getByTestId("ui-focus-exit")).toBeHidden();
  await expect(toggle).toBeFocused();
});

test("los puntos de sucio aparecen, se limpian al visitar y tras guardar (T3.7)", async ({
  page,
}) => {
  await openStore(page);
  const hero = page.getByRole("listitem").filter({ hasText: "Hero de catálogo" });
  await hero.getByRole("button").first().click();

  const title = page.getByRole("textbox", { name: "Título", exact: true }).first();
  await title.fill("Título con cambios");
  await expect(page.getByText("Cambios pendientes", { exact: true })).toBeVisible();

  // El segundo y tercer commit ocurren con el autosave pendiente: la marca de
  // sucio sólo vive mientras hay cambios sin persistir.
  await title.press(" ");
  const resumenTab = page.getByRole("tab", { name: /Resumen/ });
  await expect(resumenTab.getByTestId("ui-tab-dirty")).toBeVisible();
  await title.press(" ");
  const catalogoTab = page.getByRole("tab", { name: /Catálogo/ });
  await expect(catalogoTab.getByTestId("ui-tab-dirty")).toBeVisible();

  await title.press(" ");
  await resumenTab.click();
  await expect(resumenTab.getByTestId("ui-tab-dirty")).toBeHidden();

  await expect(page.getByText(/^Guardado/)).toBeVisible();
  await expect(page.getByTestId("ui-tab-dirty")).toHaveCount(0);
});

test("el tema oscuro es predeterminado y persiste al recargar (T3.8)", async ({ page }) => {
  await openStore(page);
  const root = page.locator("html");
  await expect(root).toHaveAttribute("data-studio-theme", "dark");
  // Dark-only: el toggle de tema claro fue deprecado, no debe existir.
  await expect(page.getByTestId("ui-theme-toggle")).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole("heading", { name: "Tus tiendas" })).toBeVisible();
  await expect(root).toHaveAttribute("data-studio-theme", "dark");
  await page.locator('[data-store-card-id="store-modo-sur-demo"]').click();
  await page.getByRole("button", { name: "Abrir tienda", exact: true }).click();
  await expect(root).toHaveAttribute("data-studio-theme", "dark");
});

test("el zoom de la vista previa se aplica y persiste en la sesión", async ({ page }) => {
  await openStore(page);
  const zoom75 = page.getByRole("button", { name: "75%", exact: true });

  await zoom75.click();
  await expect(zoom75).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".preview-pane iframe")).toHaveAttribute("style", /zoom:\s*0\.75/);

  await page.reload();
  await expect(page.getByRole("heading", { name: "Tus tiendas" })).toBeVisible();
  await page.locator('[data-store-card-id="store-modo-sur-demo"]').click();
  await page.getByRole("button", { name: "Abrir tienda", exact: true }).click();
  await expect(page.getByRole("button", { name: "75%", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.locator(".preview-pane iframe")).toHaveAttribute("style", /zoom:\s*0\.75/);

  await page.getByRole("button", { name: "100%", exact: true }).click();
  await expect(page.getByRole("button", { name: "100%", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
});
