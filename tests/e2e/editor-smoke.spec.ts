/**
 * T6.1 — Smoke completo del editor.
 * Recorrido de regresión de punta a punta: dashboard → abrir Predeterminado →
 * cada tab → crear producto → editar sección → exportar borrador → volver →
 * archivar/restaurar. Sin aserciones finas de contenido: cada pantalla
 * verifica su elemento clave (heading/testid).
 */
import type { Server } from "node:http";
import { expect, type Page, test } from "@playwright/test";
import { startStudioServer, stopStudioServer } from "./studio-server";

test.setTimeout(process.env.CI ? 240_000 : 180_000);

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

async function openDashboard(page: Page): Promise<void> {
  await page.goto(studioUrl);
  await expect(page.getByRole("heading", { name: "Tus tiendas" })).toBeVisible({
    timeout: 30_000,
  });
}

/** Entra a la tienda demo desde un dashboard ya cargado. */
async function openDemoStore(page: Page): Promise<void> {
  // El atributo data-store-card-id vive en el botón principal de la card, no
  // en el article; el botón "Abrir esta tienda" es un hermano. Se enmarca con
  // article:has(...) igual que editor-console.spec.ts.
  await page
    .locator('article:has([data-store-card-id="store-modo-sur-demo"])')
    .getByRole("button", { name: "Abrir esta tienda" })
    .click();
  await expect(page.getByRole("navigation", { name: "Áreas de la tienda" })).toBeVisible();
}

test("recorre el editor de punta a punta: tabs, producto, sección, exportación y vuelta", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openDashboard(page);
  await page.evaluate(
    () =>
      new Promise<void>((resolveDelete, reject) => {
        const request = indexedDB.deleteDatabase("solara-commerce-studio");
        request.addEventListener("success", () => resolveDelete());
        request.addEventListener("error", () => reject(request.error));
      }),
  );
  await page.reload();
  await expect(page.getByRole("heading", { name: "Tus tiendas" })).toBeVisible({
    timeout: 30_000,
  });

  await expect(
    page.locator('[data-store-card-id="store-modo-sur-demo"]'),
    "la tienda Predeterminado aparece en el dashboard",
  ).toBeVisible();

  await openDemoStore(page);

  const tabs: Array<{ tab: string; heading: string }> = [
    { tab: "Preparar", heading: "Preparar tienda" },
    { tab: "Resumen", heading: "Resumen" },
    { tab: "Catálogo", heading: "Catálogo" },
    { tab: "Constructor", heading: "Constructor" },
    { tab: "Tema", heading: "Tema" },
    { tab: "Recursos", heading: "Recursos" },
    { tab: "SEO", heading: "SEO y Google" },
    { tab: "Exportar", heading: "Exportar" },
  ];
  for (const { tab, heading } of tabs) {
    await page.getByRole("tab", { name: tab, exact: true }).click();
    await expect(page.getByRole("heading", { name: heading, exact: true })).toBeVisible();
  }

  await expect(page.getByTestId("ui-status-bar")).toContainText("Esquema v2");
  await expect(page.locator('iframe[title="Vista previa desktop"]')).toBeVisible();
  await expect(page.locator(".preview-toolbar")).toBeVisible();

  await page.getByRole("tab", { name: "Catálogo", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Catálogo", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Agregar producto" }).first().click();
  const dialog = page.locator("dialog.product-dialog");
  await expect(dialog).toBeVisible();
  await dialog.getByRole("textbox", { name: "Título" }).fill("Linterna Bruma");
  await dialog.getByRole("textbox", { name: "Slug" }).fill("linterna-bruma");
  await dialog.getByRole("textbox", { name: "SKU" }).fill("LIN-BRUMA-01");
  await dialog.getByRole("spinbutton", { name: "Precio en centavos" }).fill("45000");
  await dialog.getByRole("button", { name: "Crear producto" }).click();
  await expect(dialog).toBeHidden();
  await page.getByPlaceholder("Buscar por producto, marca o estado").fill("Linterna Bruma");
  await expect(page.getByLabel("Nombre de Linterna Bruma")).toBeVisible();
  await page.getByPlaceholder("Buscar por producto, marca o estado").fill("");

  await page.getByRole("tab", { name: "Constructor", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Constructor", exact: true })).toBeVisible();
  const hero = page.getByRole("listitem").filter({ hasText: "Hero de catálogo" });
  await hero.getByRole("button").first().click();
  await expect(page.getByRole("complementary", { name: "Inspector de sección" })).toBeVisible();
  const title = page.getByRole("textbox", { name: "Título", exact: true });
  await title.fill("Título del smoke");
  await expect(title).toHaveValue("Título del smoke");
  await expect(page.getByText("Cambios pendientes", { exact: true })).toBeVisible();

  await page.getByRole("tab", { name: "Exportar", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Exportar", exact: true })).toBeVisible();
  const draft = page.getByTestId("ui-export-draft");
  await draft.click();
  await expect(draft).toBeDisabled();
  await expect(draft).toContainText("Generando");
  await expect(page.getByTestId("ui-export-result")).toContainText("Exportación correcta", {
    timeout: 60_000,
  });
  await expect(draft).toBeEnabled();

  await page.getByRole("button", { name: "Volver a tiendas" }).click();
  await expect(page.getByRole("heading", { name: "Tus tiendas" })).toBeVisible();
});

test("archiva la tienda demo desde el dashboard y la restaura", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openDashboard(page);

  const card = page.locator('[data-store-card-id="store-modo-sur-demo"]');
  // El locator ya es el botón de selección de la card (data-store-card-id vive
  // en él); un selector descendente .dashboard-store-card__button no matchea.
  await card.click();
  const detail = page.getByRole("region", { name: "Tienda seleccionada: Predeterminado" });
  await expect(detail).toBeVisible();

  // T4.12: el archivo de tienda confirma con el diálogo unificado en vez de
  // window.confirm; el botón de aceptar usa el mismo nombre "Archivar".
  await detail.getByRole("button", { name: "Archivar" }).click();
  const confirm = page.getByTestId("ui-confirm-dialog");
  await expect(confirm).toBeVisible();
  await expect(confirm).toContainText("Predeterminado");
  await confirm.getByRole("button", { name: "Archivar", exact: true }).click();
  await expect(confirm).toBeHidden();
  await page.locator(".dashboard-cosmic-select select").first().selectOption("archived");
  await expect(page.locator(".dashboard-cosmic-count")).toHaveText("1 visibles");

  const archivedCard = page
    .locator(".dashboard-store-card")
    .filter({ hasText: "Predeterminado" })
    .first();
  await archivedCard.locator(".dashboard-store-card__button").click();
  await expect(
    page.getByRole("region", { name: "Tienda seleccionada: Predeterminado" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Restaurar" }).click();
  await expect(page.locator(".dashboard-cosmic-count")).toHaveText("0 visibles");

  await page.locator(".dashboard-cosmic-select select").first().selectOption("active");
  await expect(page.locator(".dashboard-cosmic-count")).toHaveText("1 visibles");
  await expect(page.locator('[data-store-card-id="store-modo-sur-demo"]')).toBeVisible();
});
