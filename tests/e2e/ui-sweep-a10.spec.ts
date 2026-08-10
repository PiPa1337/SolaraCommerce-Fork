/**
 * A10 — Barrido total de controles (2026-08-10): Builder, controles de picker
 * y alta de secciones. Verifica el contrato de 3 capas: (1) efecto real
 * (estado/datos/preview, no "visible-only"), (2) auto-feedback del control
 * (aria-expanded, dialog, slot label, foco devuelto, panel de error), y
 * (3) contrato de datos (settings contra el schema del módulo).
 *
 * Cobertura del bin A10:
 *  - "Agregar sección" abre el picker con aria-expanded/dialog.
 *  - Búsqueda de módulos filtra y muestra el estado vacío.
 *  - Elegir un módulo lo agrega al slot elegido (label visible + preview).
 *  - Restricción de slot: incompatibles deshabilitados con motivo.
 *  - Cierre por Escape / click fuera: dialog cerrado + foco devuelto.
 *  - Restaurar valores por defecto: feedback visible en inspector y preview.
 *  - Sección con esquema inválido: panel de error del Builder.
 *  - Regresiones: cambio de página reclama el slot del selector y el panel
 *    cubre también el motion fuera de rango.
 */
import type { Server } from "node:http";
import { expect, type Locator, type Page, test } from "@playwright/test";
import { startStudioServer, stopStudioServer } from "./studio-server";

test.setTimeout(process.env.CI ? 90_000 : 45_000);

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
  await expect(page.getByRole("heading", { name: "Tus tiendas" })).toBeVisible({
    timeout: 20_000,
  });
  await page.locator('[data-store-card-id="store-modo-sur-demo"]').click();
  await page.getByRole("button", { name: "Abrir tienda", exact: true }).click();
  await page.getByRole("tab", { name: "Constructor" }).click();
  await expect(page.getByRole("heading", { name: "Constructor" })).toBeVisible();
}

const sectionsList = (page: Page) => page.getByRole("list", { name: "Secciones de la tienda" });
const previewFrame = (page: Page) => page.frameLocator('iframe[title="Vista previa desktop"]');
const picker = (page: Page) => page.getByTestId("ui-module-picker");
const addButton = (page: Page) => page.getByRole("button", { name: "Agregar sección" });

async function openPicker(page: Page): Promise<Locator> {
  await addButton(page).click();
  const dialog = picker(page);
  await expect(dialog).toBeVisible();
  return dialog;
}

async function selectHero(page: Page) {
  const hero = sectionsList(page).getByRole("listitem").filter({ hasText: "Hero de catálogo" });
  await hero.getByRole("button").first().click();
}

test("agregar sección abre el picker como diálogo con aria-expanded coherente", async ({
  page,
}) => {
  await openBuilder(page);
  await expect(addButton(page)).toHaveAttribute("aria-expanded", "false");

  const dialog = await openPicker(page);
  await expect(dialog).toHaveRole("dialog");
  await expect(dialog).toHaveAttribute("aria-modal", "true");
  await expect(dialog.getByLabel("Buscar módulo")).toBeFocused();
  await expect(addButton(page)).toHaveAttribute("aria-expanded", "true");
});

test("la búsqueda filtra módulos y reporta el estado vacío", async ({ page }) => {
  await openBuilder(page);
  const dialog = await openPicker(page);

  await dialog.getByLabel("Buscar módulo").fill("detalle moderno");
  await expect(dialog.getByRole("button", { name: /Detalle moderno de producto/ })).toHaveCount(1);

  await dialog.getByLabel("Buscar módulo").fill("zzz-inexistente");
  await expect(dialog.getByText(/No hay módulos que coincidan/)).toBeVisible();
  await expect(dialog.getByText(/zzz-inexistente/)).toBeVisible();
});

test("elegir un módulo lo agrega al slot indicado y el preview lo refleja", async ({ page }) => {
  await openBuilder(page);
  const sections = sectionsList(page);
  const initialCount = await sections.getByRole("listitem").count();

  await page.getByLabel("Tipo de sección").selectOption("product");
  const dialog = await openPicker(page);
  await dialog.getByLabel("Buscar módulo").fill("detalle");
  await dialog.getByRole("button", { name: /Detalle moderno de producto/ }).click();

  await expect(dialog).toBeHidden();
  await expect(addButton(page)).toHaveAttribute("aria-expanded", "false");
  await expect(sections.getByRole("listitem")).toHaveCount(initialCount + 1);

  const added = sections.getByRole("listitem").last();
  await expect(added).toContainText("Detalle moderno de producto");
  await expect(added.locator(".section-select span")).toHaveText("Producto");
  await expect(page.locator(".inspector header span")).toHaveText("Producto");

  await expect(
    previewFrame(page).locator('[data-solara-module="catalog-product-detail"]'),
  ).toBeVisible({ timeout: 15_000 });
});

test("los módulos incompatibles con el slot quedan bloqueados con motivo", async ({ page }) => {
  await openBuilder(page);
  await page.getByLabel("Tipo de sección").selectOption("cart");
  const dialog = await openPicker(page);

  await dialog.getByLabel("Buscar módulo").fill("detalle");
  const blocked = dialog.getByRole("button", { name: /Detalle moderno de producto/ });
  await expect(blocked).toBeDisabled();
  await expect(blocked).toContainText("No compatible con «Carrito»");

  await dialog.getByLabel("Buscar módulo").fill("carrito");
  await expect(dialog.getByRole("button", { name: /Carrito moderno/ })).toBeEnabled();
});

test("Escape cierra el picker y devuelve el foco al botón de agregar", async ({ page }) => {
  await openBuilder(page);
  const dialog = await openPicker(page);
  await dialog.getByLabel("Buscar módulo").fill("hero");

  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(addButton(page)).toHaveAttribute("aria-expanded", "false");
  await expect(addButton(page)).toBeFocused();
});

test("un click fuera del picker lo cierra y devuelve el foco al botón", async ({ page }) => {
  await openBuilder(page);
  await openPicker(page);

  await sectionsList(page).getByRole("listitem").first().locator(".section-select").click();
  await expect(picker(page)).toBeHidden();
  await expect(addButton(page)).toHaveAttribute("aria-expanded", "false");
  await expect(addButton(page)).toBeFocused();
});

test("cambiar de página reclama el tipo de sección fuera del rango de esa página", async ({
  page,
}) => {
  await openBuilder(page);
  await page.getByLabel("Tipo de sección").selectOption("hero");
  await page.getByLabel("Página de edición").selectOption("about");
  await expect(page.getByLabel("Tipo de sección")).toHaveValue("catalog");

  const dialog = await openPicker(page);
  await dialog.getByLabel("Buscar módulo").fill("mosaico");
  const option = dialog.getByRole("button", { name: /Mosaico de categorías/ });
  await expect(option).toBeEnabled();
  await option.click();

  const added = sectionsList(page).getByRole("listitem").last();
  await expect(added).toContainText("Mosaico de categorías");
  await expect(added.locator(".section-select span")).toHaveText("Catálogo");
});

test("restaurar valores por defecto revierte la sección con feedback visible", async ({ page }) => {
  await openBuilder(page);
  await selectHero(page);

  const title = page.getByRole("textbox", { name: "Título", exact: true });
  const body = page.getByRole("textbox", { name: "Descripción", exact: true });
  await title.fill("Título del barrido");
  await body.fill("Cuerpo del barrido");
  await expect(previewFrame(page).locator('[data-solara-module="catalog-hero"] h1')).toHaveText(
    "Título del barrido",
    { timeout: 15_000 },
  );

  await page.getByRole("button", { name: "Restaurar valores por defecto" }).click();
  await expect(title).toHaveValue("Vestite con lo que te representa.");
  await expect(body).toHaveValue("Prendas elegidas para acompañarte todos los días.");
  await expect(previewFrame(page).locator('[data-solara-module="catalog-hero"] h1')).toHaveText(
    "Vestite con lo que te representa.",
    { timeout: 15_000 },
  );
});

test("un motion fuera de rango aparece en el panel de error de esquema y se limpia", async ({
  page,
}) => {
  await openBuilder(page);
  await selectHero(page);
  await expect(page.getByTestId("ui-section-schema-error")).toHaveCount(0);

  const distance = page.getByRole("spinbutton", { name: "Distancia" });
  await distance.fill("999");

  const panel = page.getByTestId("ui-section-schema-error");
  await expect(panel).toBeVisible();
  await expect(panel).toContainText("motion.distance");
  await expect(page.getByText("Cambios pendientes", { exact: true })).toBeVisible();

  await distance.fill("24");
  await expect(panel).toBeHidden();
});
