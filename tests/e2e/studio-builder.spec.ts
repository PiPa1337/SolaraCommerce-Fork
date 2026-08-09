import type { Server } from "node:http";
import { expect, type Page, test } from "@playwright/test";
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

async function openBuilder(page: Page) {
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
  await page.getByRole("button", { name: /Predeterminado/ }).click();
  await page.getByRole("button", { name: "Abrir tienda", exact: true }).click();
  await page.getByRole("tab", { name: "Constructor" }).click();
  await expect(page.getByRole("heading", { name: "Constructor" })).toBeVisible();
}

test("edita el hero moderno, actualiza el preview y persiste tras recargar", async ({ page }) => {
  await openBuilder(page);
  const hero = page.getByRole("listitem").filter({ hasText: "Hero de catálogo" });
  await hero.getByRole("button").first().click();

  const title = page.getByRole("textbox", { name: "Título", exact: true });
  await title.fill("Una portada persistente");
  await expect(page.getByText("Cambios pendientes", { exact: true })).toBeVisible();
  await expect(
    page.frameLocator("iframe").locator('[data-solara-module="catalog-hero"] h1'),
  ).toHaveText("Una portada persistente", { timeout: 15_000 });
  await expect(page.getByText(/^Guardado/, { exact: false })).toBeVisible();

  await page.reload();
  await expect(page.getByRole("heading", { name: "Tus tiendas" })).toBeVisible();
  await page.getByRole("button", { name: /Predeterminado/ }).click();
  await page.getByRole("button", { name: "Abrir tienda", exact: true }).click();
  await page.getByRole("tab", { name: "Constructor" }).click();
  await page
    .getByRole("listitem")
    .filter({ hasText: "Hero de catálogo" })
    .getByRole("button")
    .first()
    .click();
  await expect(page.getByRole("textbox", { name: "Título", exact: true })).toHaveValue(
    "Una portada persistente",
  );
  await expect(
    page.frameLocator("iframe").locator('[data-solara-module="catalog-hero"] h1'),
  ).toHaveText("Una portada persistente", { timeout: 15_000 });
});

test("edita slides modernos con el inspector generado por metadata", async ({ page }) => {
  await openBuilder(page);
  await page
    .getByRole("listitem")
    .filter({ hasText: "Hero de catálogo" })
    .getByRole("button")
    .first()
    .click();

  const addItem = page.getByRole("button", { name: "Agregar elemento" });
  await addItem.click();
  await addItem.click();
  await expect(page.locator(".repeater-editor__item")).toHaveCount(2);
  await page.locator(".repeater-editor__item").nth(0).getByRole("textbox").nth(0).fill("Primero");
  await page.locator(".repeater-editor__item").nth(1).getByRole("textbox").nth(0).fill("Segundo");
  await page
    .locator(".repeater-editor__item")
    .nth(0)
    .getByRole("button", { name: "Bajar elemento" })
    .click();
  await expect(
    page.locator(".repeater-editor__item").nth(0).getByRole("textbox").nth(0),
  ).toHaveValue("Segundo");
  await page
    .locator(".repeater-editor__item")
    .nth(0)
    .getByRole("button", { name: "Eliminar elemento" })
    .click();
  await expect(page.locator(".repeater-editor__item")).toHaveCount(1);
});

test("agrega, ordena, duplica, oculta, deshace y elimina secciones modernas", async ({ page }) => {
  test.setTimeout(60_000);
  await openBuilder(page);
  const sections = page.getByRole("list", { name: "Secciones de la tienda" });
  const initialCount = await sections.getByRole("listitem").count();
  const initialBrandCount = await sections
    .getByRole("listitem")
    .filter({ hasText: "Franja de marcas" })
    .count();

  await page.getByLabel("Tipo de sección").selectOption("content");
  await page.getByRole("button", { name: "Agregar sección" }).click();
  const picker = page.getByTestId("ui-module-picker");
  await expect(picker).toBeVisible();
  await picker.getByRole("button", { name: /Franja de marcas/ }).click();
  await expect(picker).toBeHidden();
  await expect(sections.getByRole("listitem")).toHaveCount(initialCount + 1);
  const added = sections.getByRole("listitem").last();
  await expect(added).toContainText("Franja de marcas");
  await added.getByRole("button", { name: "Mover arriba" }).click();

  const selectedAdded = sections
    .getByRole("listitem")
    .filter({ hasText: "Franja de marcas" })
    .last();
  await selectedAdded.getByRole("button", { name: "Duplicar sección" }).click();
  await expect(sections.getByRole("listitem").filter({ hasText: "Franja de marcas" })).toHaveCount(
    initialBrandCount + 2,
  );
  const duplicate = sections.getByRole("listitem").filter({ hasText: "Franja de marcas" }).last();
  await duplicate.getByRole("button", { name: "Eliminar sección" }).click();
  await expect(sections.getByRole("listitem").filter({ hasText: "Franja de marcas" })).toHaveCount(
    initialBrandCount + 1,
  );

  const hero = sections.getByRole("listitem").filter({ hasText: "Hero de catálogo" });
  await hero.getByRole("button", { name: "Ocultar sección" }).click();
  await expect(
    page.frameLocator("iframe").locator('[data-solara-module="catalog-hero"]'),
  ).toHaveCount(0, { timeout: 15_000 });
  await page.getByRole("button", { name: "Deshacer" }).click();
  await expect(
    page.frameLocator("iframe").locator('[data-solara-module="catalog-hero"] h1'),
  ).toHaveText("Vestite con lo que te representa.", { timeout: 15_000 });
  await page.getByRole("button", { name: "Rehacer" }).click();
  await expect(
    page.frameLocator("iframe").locator('[data-solara-module="catalog-hero"]'),
  ).toHaveCount(0, { timeout: 15_000 });

  await sections
    .getByRole("listitem")
    .filter({ hasText: "Franja de marcas" })
    .last()
    .getByRole("button", { name: "Eliminar sección" })
    .click();
  await expect(sections.getByRole("listitem")).toHaveCount(initialCount);
});
