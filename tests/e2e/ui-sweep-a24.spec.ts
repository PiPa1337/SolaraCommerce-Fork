import type { Server } from "node:http";
import { expect, type Locator, type Page, test } from "@playwright/test";
import { startStudioServer, stopStudioServer } from "./studio-server";

/**
 * Barrido A24: RepeaterEditor (agregar con id válido, duplicar, quitar,
 * campos que persisten, reordenar) y CategoryTree (expandir/colapsar con
 * aria-expanded, reubicar válido, destinos bloqueados y diálogo de
 * confirmación) con el contrato de 3 capas: efecto real, auto-feedback y
 * contrato de datos (payload -> receptor).
 */

let studioServer: Server;
let studioUrl: string;

test.beforeAll(async () => {
  const studio = await startStudioServer();
  studioServer = studio.server;
  studioUrl = studio.url;
});

test.afterAll(async () => {
  await stopStudioServer(studioServer);
});

test.setTimeout(120_000);

async function openStore(page: Page) {
  await expect(page.getByRole("heading", { name: "Tus tiendas" })).toBeVisible({
    timeout: 20_000,
  });
  await page.locator('[data-store-card-id="store-modo-sur-demo"]').click();
  await page.getByRole("button", { name: "Abrir tienda", exact: true }).click();
}

async function openBuilder(page: Page) {
  await page.goto(studioUrl);
  await openStore(page);
  await page.getByRole("tab", { name: "Constructor" }).click();
  await expect(page.getByRole("heading", { name: "Constructor" })).toBeVisible();
}

async function openCatalog(page: Page) {
  await page.goto(studioUrl);
  await openStore(page);
  await page.getByRole("tab", { name: "Catálogo", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Catálogo" })).toBeVisible();
  await expect(page.getByRole("list", { name: "Categorías ordenadas" })).toBeVisible();
}

async function selectTestimonials(page: Page, expectedItems = 3) {
  const sections = page.getByRole("list", { name: "Secciones de la tienda" });
  await sections
    .getByRole("listitem")
    .filter({ hasText: "Testimonios" })
    .first()
    .locator(".section-select")
    .click();
  const editor = page.locator(".repeater-editor");
  await expect(editor).toBeVisible();
  await expect(editor.locator(".repeater-editor__item")).toHaveCount(expectedItems);
  return editor;
}

const testimonialsPreview = (page: Page) =>
  page
    .frameLocator("iframe")
    .locator('[data-solara-module="catalog-testimonials"]')
    .first();

const treeItems = (page: Page) => page.getByRole("list", { name: "Categorías ordenadas" }).locator("li");

async function treeIndexOf(page: Page, text: string) {
  const items = treeItems(page);
  const count = await items.count();
  for (let index = 0; index < count; index += 1) {
    if ((await items.nth(index).textContent())?.includes(text)) return index;
  }
  return -1;
}

test("el repeater agrega un ítem con id válido, sus campos persisten y sobrevive a la recarga", async ({
  page,
}) => {
  await openBuilder(page);
  const editor = await selectTestimonials(page);
  const items = editor.locator(".repeater-editor__item");

  await page.getByRole("button", { name: "Agregar elemento" }).click();
  await expect(items).toHaveCount(4);
  await expect(items.nth(3).locator("header strong")).toHaveText("Nuevo elemento");
  await expect(page.getByTestId("ui-schema-errors")).toHaveCount(0);
  await expect(testimonialsPreview(page).locator(".catalog-testimonial")).toHaveCount(4, {
    timeout: 15_000,
  });
  await expect(testimonialsPreview(page).locator(".catalog-testimonial").nth(3).locator("h3")).toHaveText(
    "Nuevo elemento",
    { timeout: 15_000 },
  );

  await items.nth(3).getByLabel("Nombre").fill("Cliente A24");
  await expect(items.nth(3).locator("header strong")).toHaveText("Cliente A24");
  await expect(testimonialsPreview(page).locator(".catalog-testimonial").nth(3).locator("h3")).toHaveText(
    "Cliente A24",
    { timeout: 15_000 },
  );
  await expect(page.getByText(/^Guardado/)).toBeVisible({ timeout: 15_000 });

  await page.reload();
  await openStore(page);
  await page.getByRole("tab", { name: "Constructor" }).click();
  await expect(page.getByRole("heading", { name: "Constructor" })).toBeVisible();
  const editorAfter = await selectTestimonials(page, 4);
  const itemsAfter = editorAfter.locator(".repeater-editor__item");
  await expect(itemsAfter.nth(3).getByLabel("Nombre")).toHaveValue("Cliente A24");
  await expect(page.getByTestId("ui-schema-errors")).toHaveCount(0);
  await expect(testimonialsPreview(page).locator(".catalog-testimonial").nth(3).locator("h3")).toHaveText(
    "Cliente A24",
    { timeout: 15_000 },
  );
});

test("duplicar un ítem clona sus campos con un id nuevo y persiste tras recargar", async ({ page }) => {
  await openBuilder(page);
  const editor = await selectTestimonials(page);
  const items = editor.locator(".repeater-editor__item");
  const firstBody = await items.nth(0).getByLabel("Texto", { exact: true }).inputValue();

  await items.nth(0).getByRole("button", { name: "Duplicar elemento" }).click();
  await expect(items).toHaveCount(4);
  await expect(items.nth(1).locator("header strong")).toHaveText("Sofía M.");
  await expect(items.nth(1).getByLabel("Texto", { exact: true })).toHaveValue(firstBody);
  await expect(items.nth(1).getByLabel("Nombre")).toHaveValue("Sofía M.");
  await expect(page.getByTestId("ui-schema-errors")).toHaveCount(0);

  const preview = testimonialsPreview(page);
  await expect(preview.locator(".catalog-testimonial")).toHaveCount(4, { timeout: 15_000 });
  await expect(preview.locator(".catalog-testimonial h3").nth(0)).toHaveText("Sofía M.", {
    timeout: 15_000,
  });
  await expect(preview.locator(".catalog-testimonial h3").nth(1)).toHaveText("Sofía M.");
  await expect(preview.locator(".catalog-testimonial h3").nth(2)).toHaveText("Julián R.");
  await expect(page.getByText(/^Guardado/)).toBeVisible({ timeout: 15_000 });

  await page.reload();
  await openStore(page);
  await page.getByRole("tab", { name: "Constructor" }).click();
  await expect(page.getByRole("heading", { name: "Constructor" })).toBeVisible();
  const editorAfter = await selectTestimonials(page, 4);
  await expect(editorAfter.locator(".repeater-editor__item")).toHaveCount(4);
  await expect(page.getByTestId("ui-schema-errors")).toHaveCount(0);
});

test("quitar un ítem lo elimina del editor y del preview sin invalidar el schema", async ({ page }) => {
  await openBuilder(page);
  const editor = await selectTestimonials(page);
  const items = editor.locator(".repeater-editor__item");

  await items.nth(0).getByRole("button", { name: "Eliminar elemento" }).click();
  await expect(items).toHaveCount(2);
  await expect(items.nth(0).locator("header strong")).toHaveText("Julián R.");
  await expect(editor.locator(".repeater-editor__item").filter({ hasText: "Sofía M." })).toHaveCount(0);
  await expect(page.getByTestId("ui-schema-errors")).toHaveCount(0);
  await expect(testimonialsPreview(page).locator(".catalog-testimonial")).toHaveCount(2, {
    timeout: 15_000,
  });
  await expect(testimonialsPreview(page).locator(".catalog-testimonial h3").nth(0)).toHaveText(
    "Julián R.",
    { timeout: 15_000 },
  );
});

test("reordenar intercambia los ítems con estados disabled coherentes y se refleja en el preview", async ({
  page,
}) => {
  await openBuilder(page);
  const editor = await selectTestimonials(page);
  const items = editor.locator(".repeater-editor__item");

  await expect(items.nth(0).getByRole("button", { name: "Subir elemento" })).toBeDisabled();
  await expect(items.nth(2).getByRole("button", { name: "Bajar elemento" })).toBeDisabled();

  await items.nth(0).getByRole("button", { name: "Bajar elemento" }).click();
  await expect(items.nth(0).locator("header strong")).toHaveText("Julián R.");
  await expect(items.nth(1).locator("header strong")).toHaveText("Sofía M.");
  const preview = testimonialsPreview(page);
  await expect(preview.locator(".catalog-testimonial h3").nth(0)).toHaveText("Julián R.", {
    timeout: 15_000,
  });
  await expect(preview.locator(".catalog-testimonial h3").nth(1)).toHaveText("Sofía M.");

  await items.nth(1).getByRole("button", { name: "Subir elemento" }).click();
  await expect(items.nth(0).locator("header strong")).toHaveText("Sofía M.");
  await expect(preview.locator(".catalog-testimonial h3").nth(0)).toHaveText("Sofía M.", {
    timeout: 15_000,
  });
});

test("los campos numéricos y booleanos del repeater persisten tras recargar", async ({ page }) => {
  await openBuilder(page);
  const editor = await selectTestimonials(page);
  const items = editor.locator(".repeater-editor__item");

  await items.nth(0).getByRole("spinbutton", { name: "Valoración" }).fill("3");
  await items.nth(0).getByRole("checkbox", { name: "Contenido de ejemplo" }).uncheck();
  await expect(
    testimonialsPreview(page)
      .locator(".catalog-testimonial")
      .first()
      .locator(".catalog-testimonial-rating"),
  ).toHaveAttribute("aria-label", "3 de 5", { timeout: 15_000 });
  await expect(page.getByText(/^Guardado/)).toBeVisible({ timeout: 15_000 });

  await page.reload();
  await openStore(page);
  await page.getByRole("tab", { name: "Constructor" }).click();
  await expect(page.getByRole("heading", { name: "Constructor" })).toBeVisible();
  await selectTestimonials(page);
  await expect(items.nth(0).getByRole("spinbutton", { name: "Valoración" })).toHaveValue("3");
  await expect(items.nth(0).getByRole("checkbox", { name: "Contenido de ejemplo" })).not.toBeChecked();
  await expect(
    testimonialsPreview(page)
      .locator(".catalog-testimonial")
      .first()
      .locator(".catalog-testimonial-rating"),
  ).toHaveAttribute("aria-label", "3 de 5", { timeout: 15_000 });
});

test("el árbol colapsa y expande raíces con aria-expanded y oculta/restaura sus hijas", async ({
  page,
}) => {
  await openCatalog(page);
  const tree = page.getByRole("list", { name: "Categorías ordenadas" });

  await expect(tree.locator("li")).toHaveCount(14);
  await expect(page.getByRole("button", { name: "Contraer Remeras" })).toHaveAttribute(
    "aria-expanded",
    "true",
  );

  await page.getByRole("button", { name: "Contraer Remeras" }).click();
  await expect(page.getByRole("button", { name: "Expandir Remeras" })).toHaveAttribute(
    "aria-expanded",
    "false",
  );
  await expect(tree.locator("li")).toHaveCount(11);
  await expect(tree.locator("li").filter({ hasText: "Básicas" })).toHaveCount(0);
  await expect(tree.locator("li").filter({ hasText: "Manga larga" })).toHaveCount(0);

  await page.getByRole("button", { name: "Expandir Remeras" }).click();
  await expect(page.getByRole("button", { name: "Contraer Remeras" })).toHaveAttribute(
    "aria-expanded",
    "true",
  );
  await expect(tree.locator("li")).toHaveCount(14);
  await expect(tree.locator("li").filter({ hasText: "Básicas" })).toHaveCount(1);
});

test("reubicar una categoría hoja la mueve de verdad y el padre actual deja de ofrecerse", async ({
  page,
}) => {
  await openCatalog(page);
  const tree = page.getByRole("list", { name: "Categorías ordenadas" });
  const moveSelect = page.getByLabel("Categoría a reubicar");
  const parentSelect = page.getByLabel("Nuevo padre");
  const moveButton = page.getByRole("button", { name: "Reubicar categoría" });

  await moveSelect.selectOption({ label: "Vestidos" });
  await expect(moveButton).toBeEnabled();
  await expect(parentSelect).toBeEnabled();
  await parentSelect.selectOption({ label: "Remeras" });
  await expect(parentSelect).toHaveValue("category-remeras");

  await moveButton.click();
  const dialog = page.getByRole("dialog", { name: "Reubicar categoría" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText("¿Reubicar Vestidos bajo Remeras?")).toBeVisible();
  await dialog.getByTestId("ui-confirm-accept").click();
  await expect(dialog).toBeHidden();

  await expect(tree.locator('li[data-depth="0"]')).toHaveCount(7);
  await expect(tree.locator('li[data-depth="1"]').filter({ hasText: "Vestidos" })).toHaveCount(1);
  const remerasIndex = await treeIndexOf(page, "Remeras");
  expect(remerasIndex).toBeGreaterThanOrEqual(0);
  expect(await treeIndexOf(page, "Vestidos")).toBe(remerasIndex + 1);
  await expect(parentSelect.locator("option", { hasText: "Remeras" })).toHaveCount(0);

  await parentSelect.selectOption({ index: 0 });
  await moveButton.click();
  await expect(dialog).toBeVisible();
  await dialog.getByTestId("ui-confirm-accept").click();
  await expect(tree.locator('li[data-depth="0"]').filter({ hasText: "Vestidos" })).toHaveCount(1);
  await expect(tree.locator('li[data-depth="0"]')).toHaveCount(8);
});

test("una raíz con hijos queda bloqueada: hint, botón deshabilitado y destinos deshabilitados", async ({
  page,
}) => {
  await openCatalog(page);
  const moveSelect = page.getByLabel("Categoría a reubicar");
  const parentSelect = page.getByLabel("Nuevo padre");
  const moveButton = page.getByRole("button", { name: "Reubicar categoría" });

  await moveSelect.selectOption({ label: "Remeras" });
  await expect(moveButton).toBeDisabled();
  await expect(page.locator(".category-reparent")).toContainText(
    "Esta categoría tiene subcategorías y debe permanecer como raíz.",
  );
  await expect(parentSelect).toBeEnabled();
  const enabledRootOptions = await parentSelect
    .locator('option:not([value=""]):not([disabled])')
    .count();
  expect(enabledRootOptions).toBe(0);
  await expect(parentSelect.locator("option", { hasText: "Remeras" })).toHaveCount(0);
  await expect(parentSelect.locator("option", { hasText: "Básicas" })).toHaveCount(0);

  await parentSelect.selectOption({ index: 0 });
  await expect(moveButton).toBeDisabled();
});

test("cancelar, Escape y la X cierran el diálogo sin reubicar y devuelven el foco", async ({
  page,
}) => {
  await openCatalog(page);
  const tree = page.getByRole("list", { name: "Categorías ordenadas" });
  const moveSelect = page.getByLabel("Categoría a reubicar");
  const parentSelect = page.getByLabel("Nuevo padre");
  const moveButton = page.getByRole("button", { name: "Reubicar categoría" });
  const dialog = page.getByRole("dialog", { name: "Reubicar categoría" });

  await moveSelect.selectOption({ label: "Vestidos" });
  await parentSelect.selectOption({ label: "Remeras" });

  await moveButton.click();
  await expect(dialog).toBeVisible();
  await expect(dialog.getByTestId("ui-confirm-accept")).toBeFocused();
  await dialog.getByRole("button", { name: "Cancelar", exact: true }).click();
  await expect(dialog).toBeHidden();
  await expect(moveButton).toBeFocused();
  await expect(tree.locator('li[data-depth="0"]')).toHaveCount(8);

  await moveButton.click();
  await expect(dialog).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(tree.locator('li[data-depth="0"]').filter({ hasText: "Vestidos" })).toHaveCount(1);

  await moveButton.click();
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Cerrar diálogo" }).click();
  await expect(dialog).toBeHidden();
  await expect(tree.locator('li[data-depth="0"]')).toHaveCount(8);
});
