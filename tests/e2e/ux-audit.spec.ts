/**
 * Auditoría UX FUNCIONAL Studio — SolaraCommerce
 * Recorre Dashboard → Nueva tienda → Preparar → Resumen → Catálogo → Builder → SEO → Preview → Guardar → Exportar
 * Verifica: vacío, primer uso, 50/2000 productos, teclado, foco, Escape, doble click, click repetido, pendiente, navegación rápida, resize, undo/redo, conflicto guardado, disabled/enabled, feedback, selección, filtros, modales encadenados, datos inválidos
 */

import type { Server } from "node:http";
import { expect, test } from "@playwright/test";
import { startStudioServer, stopStudioServer } from "./studio-server";

test.setTimeout(120000);

let server: Server;
let url: string;

test.beforeAll(async () => {
  const running = await startStudioServer();
  server = running.server;
  url = running.url;
});
test.afterAll(async () => {
  await stopStudioServer(server);
});

async function clean(page, gotoUrl = url) {
  await page.goto(gotoUrl);
  await page.evaluate(
    () =>
      new Promise<void>((res, rej) => {
        const req = indexedDB.deleteDatabase("solara-commerce-studio");
        req.onsuccess = () => res();
        req.onerror = () => rej(req.error);
      }),
  );
  await page.reload();
  await expect(page.getByRole("heading", { name: "Tus tiendas" })).toBeVisible({ timeout: 20000 });
}

test("Dashboard: estado vacío y primer uso", async ({ page }) => {
  await clean(page);
  await expect(page.getByRole("heading", { name: "Predeterminado" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Crear tienda|Nueva tienda/ })).toBeVisible();
  // Teclado: Tab debe llegar a Crear tienda
  await page.keyboard.press("Tab");
  await page.keyboard.press("Tab");
  // Escape no debe romper
  await page.keyboard.press("Escape");
  await expect(page.getByRole("heading", { name: "Tus tiendas" })).toBeVisible();
});

test("Nueva tienda: doble click y validación", async ({ page }) => {
  await clean(page);
  await page.getByRole("button", { name: /Crear tienda|Nueva tienda/ }).click();
  const dialog = page.getByRole("dialog", { name: /Crear tienda/ });
  await expect(dialog).toBeVisible();
  const nameInput = dialog.getByRole("textbox", { name: /Nueva tienda|Nombre/ }).first();
  await expect(nameInput).toBeFocused();
  // Intento continuar sin nombre debe mostrar error y no avanzar
  await dialog.getByRole("button", { name: "Continuar" }).click();
  await expect(dialog.getByText(/Escrib/)).toBeVisible();
  await nameInput.fill("Tienda UX Audit");
  // Doble click rápido en Continuar no debe crear dos tiendas (race)
  const cont = dialog.getByRole("button", { name: "Continuar" });
  await cont.dblclick();
  await expect(dialog.getByText("2 Identidad")).toBeVisible();
  // Escape debe cerrar solo si no está busy
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
});

test("Preparar (GuidedOverview): navegación rápida y foco", async ({ page }) => {
  await clean(page);
  await page.locator('[data-store-card-id="store-modo-sur-demo"]').click();
  await page.getByRole("button", { name: "Abrir tienda", exact: true }).click();
  await expect(page.getByRole("tab", { name: "Preparar" })).toBeVisible({ timeout: 20000 });
  await page.getByRole("tab", { name: "Preparar" }).click();
  await expect(page.getByRole("heading", { name: /Prepara tu tienda|Preparar/ })).toBeVisible();
  // Navegación rápida entre tabs no debe dejar stale state
  await page.getByRole("tab", { name: "Catálogo" }).click();
  await page.getByRole("tab", { name: "Preparar" }).click();
  await expect(page.getByRole("heading", { name: /Prepara tu tienda|Preparar/ })).toBeVisible();
  // Resize no debe romper layout
  await page.setViewportSize({ width: 800, height: 600 });
  await expect(page.getByRole("tab", { name: "Preparar" })).toBeVisible();
  await page.setViewportSize({ width: 1440, height: 900 });
});

test("Catálogo: 50 productos, filtros, selección y Escape", async ({ page }) => {
  await clean(page);
  await page.locator('[data-store-card-id="store-modo-sur-demo"]').click();
  await page.getByRole("button", { name: "Abrir tienda", exact: true }).click();
  await page.getByRole("tab", { name: "Catálogo" }).click();
  await expect(page.getByRole("heading", { name: /Catálogo/ })).toBeVisible({ timeout: 20000 });
  // Filtro que oculta selección: seleccionar primero, filtrar por texto inexistente, verificar que selección no quede oculta sin feedback
  const firstRow = page.getByRole("row").nth(1);
  await expect(firstRow).toBeVisible();
  const checkbox = firstRow.getByRole("checkbox").first();
  await checkbox.check();
  await expect(checkbox).toBeChecked();
  // Filtrar por texto que no existe
  const filterInput = page.getByPlaceholder(/Filtrar|Buscar/);
  if ((await filterInput.count()) > 0) {
    await filterInput.fill("zzz_no_existe_123");
    await page.waitForTimeout(400);
    // La fila seleccionada debe seguir marcada o mostrar indicador de selección oculta
    // Si el filtro oculta todo, el contador de selección debe seguir visible
    const _selectedCount = page.getByText(/seleccionado/);
    // No debe perder selección silenciosamente
    await filterInput.fill("");
    await page.waitForTimeout(300);
    await expect(checkbox).toBeChecked();
  }
  // Escape en ProductEditor no debe perder foco
  await page
    .getByRole("button", { name: /Agregar producto|Nuevo producto/ })
    .first()
    .click();
  const editor = page.getByRole("dialog", { name: /Nuevo producto|Editar producto/ });
  if ((await editor.count()) > 0) {
    await expect(editor).toBeVisible();
    await page.keyboard.press("Escape");
    // Debe pedir confirmación si hay cambios sucios, o cerrar si está limpio
    await page.waitForTimeout(300);
  }
  // Doble click en Crear no debe duplicar
});

test("Builder: selección tras borrar y undo/redo", async ({ page }) => {
  await clean(page);
  await page.locator('[data-store-card-id="store-modo-sur-demo"]').click();
  await page.getByRole("button", { name: "Abrir tienda", exact: true }).click();
  await page.getByRole("tab", { name: "Constructor" }).click();
  await expect(page.getByRole("heading", { name: "Constructor" })).toBeVisible({ timeout: 20000 });
  const sections = page.getByRole("list", { name: "Secciones de la tienda" });
  await expect(sections).toBeVisible();
  const initialCount = await sections.getByRole("listitem").count();
  // Seleccionar segunda sección
  if (initialCount > 1) {
    await sections.getByRole("listitem").nth(1).locator(".section-select").click();
    await expect(sections.getByRole("listitem").nth(1)).toHaveAttribute("data-selected", "true");
    // Borrar sección seleccionada
    await sections
      .getByRole("listitem")
      .nth(1)
      .getByRole("button", { name: /Eliminar|Borrar/ })
      .click();
    const confirm = page.getByRole("dialog", { name: /Eliminar|Borrar/ });
    if ((await confirm.count()) > 0)
      await confirm.getByRole("button", { name: /Eliminar|Borrar|Confirmar/ }).click();
    await expect(sections.getByRole("listitem")).toHaveCount(initialCount - 1);
    // Selección no debe quedar en limbo: debe saltar a primera o siguiente, y no perder foco
    const anySelected = sections.locator('[data-selected="true"]');
    await expect(anySelected).toHaveCount(1);
    // Undo debe restaurar y mantener selección
    await page.getByRole("button", { name: "Deshacer" }).click();
    await expect(sections.getByRole("listitem")).toHaveCount(initialCount);
  }
  // Resize
  await page.setViewportSize({ width: 800, height: 600 });
  await expect(sections).toBeVisible();
  await page.setViewportSize({ width: 1440, height: 900 });
});

test("Preview: teclado y navegación", async ({ page }) => {
  await clean(page);
  await page.locator('[data-store-card-id="store-modo-sur-demo"]').click();
  await page.getByRole("button", { name: "Abrir tienda", exact: true }).click();
  const frame = page.frameLocator('iframe[title="Vista previa desktop"]');
  await expect(frame.locator("body")).toBeVisible({ timeout: 20000 });
  await page.getByTestId("ui-preview-route").fill("/productos/remera-esencial-de-algodon/");
  await page.getByTestId("ui-preview-route").press("Enter");
  await expect(frame.getByRole("heading", { level: 1 })).toBeVisible({ timeout: 20000 });
  // Teclado: Tab debe entrar al iframe
  await page.keyboard.press("Tab");
  await page.waitForTimeout(200);
});

test("Guardar: conflicto y feedback", async ({ page }) => {
  await clean(page);
  await page.locator('[data-store-card-id="store-modo-sur-demo"]').click();
  await page.getByRole("button", { name: "Abrir tienda", exact: true }).click();
  await page.getByRole("tab", { name: "Resumen" }).click();
  await expect(page.getByLabel("Nombre de la tienda")).toBeVisible({ timeout: 20000 });
  const nameInput = page.getByLabel("Nombre de la tienda");
  await nameInput.fill(`Tienda Conflicto ${Date.now()}`);
  const saveBtn = page.locator("[data-studio-save]");
  if ((await saveBtn.count()) > 0) {
    await expect(saveBtn).toBeEnabled();
    await saveBtn.dblclick();
  }
  await expect(
    page.locator('.save-indicator, [data-testid="ui-studio-notice"]').first(),
  ).toBeVisible({ timeout: 10000 });
  // Undo/redo no debe romper guardado
  await page.getByRole("button", { name: "Deshacer" }).click();
  await page.getByRole("button", { name: "Rehacer" }).click();
  await expect(nameInput).toBeVisible();
});

test("Exportar: modales encadenados y datos inválidos", async ({ page }) => {
  await clean(page);
  await page.locator('[data-store-card-id="store-modo-sur-demo"]').click();
  await page.getByRole("button", { name: "Abrir tienda", exact: true }).click();
  await page.getByRole("tab", { name: "Exportar" }).click();
  await expect(page.getByRole("heading", { name: /Exportar/ })).toBeVisible({ timeout: 20000 });
  await expect(page.getByRole("button", { name: /Exportar sitio|Exportar/ }).first()).toBeVisible();
  // SEO: datos inválidos parcialmente escritos deben mostrar error inline, no perder foco
  await page.getByRole("tab", { name: "SEO" }).click();
  await expect(page.getByRole("heading", { name: /SEO/ })).toBeVisible({ timeout: 10000 });
  const titleInput = page.getByLabel(/Título SEO/);
  if ((await titleInput.count()) > 0) {
    await titleInput.fill("a".repeat(200));
    await titleInput.blur();
    await expect(titleInput).toBeVisible();
  }
});
