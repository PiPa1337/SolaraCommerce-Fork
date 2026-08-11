/**
 * Barrido A04 (2026-08-10) — Formulario base de producto (ProductEditor, OWNER).
 * Contrato de 3 capas por control: (1) click real → efecto asertado en
 * estado/datos/preview, (2) auto-feedback del control (selección, clase activa,
 * error inline + aria), (3) datos: draft → validateDraft → payload de guardado
 * → reducer (round-trip al reabrir el editor).
 *
 * Regresión incluida: el campo de precio en centavos permite vaciarse y
 * retipear desde cero sin "rebotar" al valor previo (bug corregido en A04);
 * el texto no entero también se conserva como escrito con su error; y el
 * cambio de sólo texto de precio marca el borrador como pendiente (dirty).
 */
import type { Server } from "node:http";
import { expect, type Locator, type Page, test } from "@playwright/test";
import { startStudioServer, stopStudioServer } from "./studio-server";

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

const STATUS_LABEL: Record<string, string> = {
  active: "Activo",
  hidden: "Oculto",
  archived: "Archivado",
};

async function openCatalog(page: Page) {
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
  await page.locator('[data-store-card-id="store-modo-sur-demo"]').click();
  await page.getByRole("button", { name: "Abrir tienda", exact: true }).click();
  await page.getByRole("tab", { name: "Catálogo", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Catálogo" })).toBeVisible();
}

/** Aísla la fila de un producto por su título exacto en la búsqueda. */
async function filterRow(page: Page, title: string): Promise<Locator> {
  await page.getByPlaceholder("Buscar por producto, marca o estado").fill(title);
  const rows = page.locator("tbody tr");
  await expect(rows).toHaveCount(1);
  return rows.first();
}

async function openCreateDialog(page: Page): Promise<Locator> {
  await page.getByRole("button", { name: "Agregar producto" }).first().click();
  const dialog = page.locator("dialog.product-dialog");
  await expect(dialog).toBeVisible();
  return dialog;
}

async function openEditDialog(page: Page, title: string): Promise<Locator> {
  const row = await filterRow(page, title);
  await row.getByRole("button", { name: "Editar" }).click();
  const dialog = page.locator("dialog.product-dialog");
  await expect(dialog).toBeVisible();
  return dialog;
}

async function saveDialog(dialog: Locator, create: boolean) {
  await dialog
    .getByRole("button", { name: create ? "Crear producto" : "Guardar producto" })
    .click();
  await expect(dialog).toBeHidden();
}

function previewCard(dialog: Locator): Locator {
  return dialog.getByTestId("ui-product-mini-preview");
}

test("título, slug y descripción reflejan la edición en preview, fila y al reabrir", async ({
  page,
}) => {
  test.setTimeout(120_000);
  await openCatalog(page);
  const dialog = await openEditDialog(page, "Camisa Rayas Finas");

  const titleInput = dialog.getByRole("textbox", { name: "Título" });
  const slugInput = dialog.getByRole("textbox", { name: "Slug" });
  const descriptionInput = dialog.getByRole("textbox", { name: "Descripción" });

  // El slug se auto-genera desde el título mientras no se tocó a mano.
  await titleInput.fill("Camisa Rayas Finas A04");
  await expect(slugInput).toHaveValue("camisa-rayas-finas-a04");
  await expect(slugInput).not.toHaveAttribute("aria-invalid", "true");
  await expect(
    slugInput
      .locator("xpath=ancestor::fieldset[contains(@class, 'field')]")
      .getByText("Disponible", { exact: true }),
  ).toBeVisible();
  await expect(previewCard(dialog).locator("strong")).toHaveText("Camisa Rayas Finas A04");

  // Tras editar el slug a mano, el título ya no lo pisa (feedback de estado).
  await slugInput.fill("camisa-a04");
  await titleInput.fill("Camisa Rayas Finas A04 BIS");
  await expect(slugInput).toHaveValue("camisa-a04");

  await descriptionInput.fill("Descripción de barrido A04.");
  await saveDialog(dialog, false);

  const row = await filterRow(page, "Camisa Rayas Finas A04 BIS");
  await expect(
    row.getByRole("textbox", { name: "Nombre de Camisa Rayas Finas A04 BIS" }),
  ).toBeVisible();

  // Datos: el guardado round-tripea el snapshot validado (round-trip al reabrir).
  const reopened = await openEditDialog(page, "Camisa Rayas Finas A04 BIS");
  await expect(reopened.getByRole("textbox", { name: "Título" })).toHaveValue(
    "Camisa Rayas Finas A04 BIS",
  );
  await expect(reopened.getByRole("textbox", { name: "Slug" })).toHaveValue("camisa-a04");
  await expect(reopened.getByRole("textbox", { name: "Descripción" })).toHaveValue(
    "Descripción de barrido A04.",
  );
});

test("el picker de imágenes cambia la imagen del mini preview y persiste", async ({ page }) => {
  test.setTimeout(120_000);
  await openCatalog(page);
  const dialog = await openEditDialog(page, "Camisa Rayas Finas");

  // Auto-feedback del paso: aria-current y clase activa se mueven con el click.
  const datosStep = dialog.getByRole("button", { name: "Datos", exact: true });
  await expect(datosStep).toHaveAttribute("aria-current", "step");
  const imagesStep = dialog.getByRole("button", { name: "Imágenes", exact: true });
  await imagesStep.click();
  await expect(imagesStep).toHaveAttribute("aria-current", "step");
  await expect(imagesStep).toHaveClass(/is-active/);
  await expect(datosStep).not.toHaveAttribute("aria-current", "step");

  const variantStep = dialog.getByRole("button", { name: "Variantes", exact: true });
  await variantStep.click();
  await expect(variantStep).toHaveAttribute("aria-current", "step");

  const previewImg = previewCard(dialog).locator("img");
  await expect(previewImg).toBeVisible();

  // Quitar la imagen principal: el preview pasa al placeholder (efecto real).
  const jeanOption = dialog.locator(".product-asset-option").filter({ hasText: "Jean recto azul" });
  const jeanInput = jeanOption.locator("input");
  await expect(jeanInput).toBeChecked();
  await jeanInput.uncheck();
  await expect(previewCard(dialog).getByText("Sin imagen")).toBeVisible();

  // Agregar otra imagen: el preview muestra su source exacto.
  const camisaOption = dialog
    .locator(".product-asset-option")
    .filter({ hasText: "Camisa a cuadros" });
  await camisaOption.locator("input").check();
  const camisaSrc = await camisaOption.locator("img").getAttribute("src");
  await expect(previewImg).toHaveAttribute("src", camisaSrc ?? "");

  await saveDialog(dialog, false);

  // Datos: imageIds persistidos → la fila y la reapertura conservan la imagen.
  const reopened = await openEditDialog(page, "Camisa Rayas Finas");
  await reopened.getByRole("button", { name: "Variantes", exact: true }).click();
  await expect(
    reopened
      .locator(".product-asset-option")
      .filter({ hasText: "Camisa a cuadros" })
      .locator("input"),
  ).toBeChecked();
  await expect(
    reopened
      .locator(".product-asset-option")
      .filter({ hasText: "Jean recto azul" })
      .locator("input"),
  ).not.toBeChecked();
});

test("el precio en centavos vacío da error inline con aria, bloquea y permite retipear (regresión)", async ({
  page,
}) => {
  test.setTimeout(120_000);
  await openCatalog(page);
  const dialog = await openCreateDialog(page);
  await dialog.getByRole("textbox", { name: "Título" }).fill("Precio A04");
  await dialog.getByRole("button", { name: "Variantes", exact: true }).click();

  const price = dialog.getByRole("spinbutton", { name: "Precio en centavos" });
  await expect(price).toHaveValue("0");

  // Vaciar el campo: ya no "rebota" al valor previo; queda vacío con error + aria.
  await price.fill("");
  await expect(price).toHaveValue("");
  const fieldError = dialog.locator("[data-testid='ui-field-error']").filter({
    hasText: "Escribí el precio en centavos.",
  });
  await expect(fieldError).toBeVisible();
  await expect(fieldError).toHaveAttribute("role", "alert");
  await expect(price).toHaveAttribute("aria-invalid", "true");
  await expect(price).toHaveAttribute("aria-describedby", /./);

  // Guardar bloqueado: el diálogo permanece abierto.
  await dialog.getByRole("button", { name: "Crear producto" }).click();
  await expect(dialog).toBeVisible();

  // Texto no entero: error específico visible + aria, sin rebote al valor previo.
  await price.fill("12.5");
  await expect(price).toHaveValue("12.5");
  const integerError = dialog.locator("[data-testid='ui-field-error']").filter({
    hasText: "El precio debe ser un número entero en centavos",
  });
  await expect(integerError).toBeVisible();
  await expect(integerError).toHaveAttribute("role", "alert");
  await expect(price).toHaveAttribute("aria-invalid", "true");
  await dialog.getByRole("button", { name: "Crear producto" }).click();
  await expect(dialog).toBeVisible();

  // Retipear desde cero: el valor entra limpio (sin dígitos residuales del viejo).
  await price.fill("5000");
  await expect(price).toHaveValue("5000");
  await expect(price).not.toHaveAttribute("aria-invalid", "true");
  await expect(fieldError).toHaveCount(0);

  await saveDialog(dialog, true);
  await expect(page.getByText(/51 productos y /)).toBeVisible();

  // Datos: 5000 centavos persistieron en el payload de guardado.
  const reopened = await openEditDialog(page, "Precio A04");
  await reopened.getByRole("button", { name: "Variantes", exact: true }).click();
  await expect(reopened.getByRole("spinbutton", { name: "Precio en centavos" })).toHaveValue(
    "5000",
  );
});

test("el select de estado muestra el actual, el preview lo refleja y persiste", async ({
  page,
}) => {
  test.setTimeout(120_000);
  await openCatalog(page);
  const dialog = await openEditDialog(page, "Camisa Rayas Finas");

  const statusSelect = dialog.getByLabel("Estado");
  const initial = (await statusSelect.inputValue()) as "active" | "hidden" | "archived";
  await expect(statusSelect).toHaveValue(initial);
  await expect(previewCard(dialog).locator(".product-mini-preview__status")).toHaveText(
    STATUS_LABEL[initial],
  );

  await statusSelect.selectOption("archived");
  await expect(statusSelect).toHaveValue("archived");
  await expect(previewCard(dialog).locator(".product-mini-preview__status")).toHaveText(
    "Archivado",
  );
  await expect(
    previewCard(dialog).locator(".product-mini-preview__status--archived"),
  ).toBeVisible();

  await saveDialog(dialog, false);

  // La fila y la reapertura conservan el estado archivado.
  const row = await filterRow(page, "Camisa Rayas Finas");
  await expect(row.locator(".status-label")).toHaveText("Archivado");
  const reopened = await openEditDialog(page, "Camisa Rayas Finas");
  await expect(reopened.getByLabel("Estado")).toHaveValue("archived");
});

test("la disponibilidad de la variante arranca marcada y persiste al reabrir", async ({ page }) => {
  test.setTimeout(120_000);
  await openCatalog(page);
  const dialog = await openCreateDialog(page);
  await dialog.getByRole("textbox", { name: "Título" }).fill("Disponibilidad A04");
  await dialog.getByRole("button", { name: "Variantes", exact: true }).click();

  const availability = dialog.getByRole("checkbox", { name: "Disponible para vender" });
  await expect(availability).toBeChecked();
  await availability.uncheck();
  await expect(availability).not.toBeChecked();

  await saveDialog(dialog, true);

  const reopened = await openEditDialog(page, "Disponibilidad A04");
  await reopened.getByRole("button", { name: "Variantes", exact: true }).click();
  await expect(
    reopened.getByRole("checkbox", { name: "Disponible para vender" }),
  ).not.toBeChecked();
});

test("cancelar sin cambios cierra directo; con cambios pide confirmación y descarta", async ({
  page,
}) => {
  test.setTimeout(120_000);
  await openCatalog(page);

  // Sin cambios: cierre directo, sin diálogo de confirmación.
  let dialog = await openEditDialog(page, "Camisa Rayas Finas");
  await dialog.getByRole("button", { name: "Cancelar" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByTestId("ui-confirm-dialog")).toHaveCount(0);

  // Con cambios: confirmación visible; al confirmar se descarta todo.
  dialog = await openEditDialog(page, "Camisa Rayas Finas");
  await dialog.getByRole("textbox", { name: "Título" }).fill("Camisa Rayas Finas CAMBIADA");
  await dialog.getByRole("button", { name: "Cancelar" }).click();
  const confirm = page.getByTestId("ui-confirm-dialog");
  await expect(confirm).toBeVisible();
  await confirm.getByRole("button", { name: "Salir sin guardar" }).click();
  await expect(dialog).toBeHidden();

  await expect(page.getByRole("textbox", { name: "Nombre de Camisa Rayas Finas" })).toBeVisible();
  await expect(
    page.getByRole("textbox", { name: "Nombre de Camisa Rayas Finas CAMBIADA" }),
  ).toHaveCount(0);

  // Sólo texto de precio (sin tocar el draft): el cambio se detecta como
  // pendiente y el cancelar pide confirmación (regresión dirty de A04).
  dialog = await openEditDialog(page, "Camisa Rayas Finas");
  await dialog.getByRole("button", { name: "Variantes", exact: true }).click();
  const price = dialog.getByRole("spinbutton", { name: "Precio en centavos" });
  const originalPrice = await price.inputValue();
  await price.fill("");
  await dialog.getByRole("button", { name: "Cancelar" }).click();
  const priceConfirm = page.getByTestId("ui-confirm-dialog");
  await expect(priceConfirm).toBeVisible();
  await priceConfirm.getByRole("button", { name: "Salir sin guardar" }).click();
  await expect(dialog).toBeHidden();

  // La edición se descartó entera: el precio original sigue persistido.
  const reopened = await openEditDialog(page, "Camisa Rayas Finas");
  await reopened.getByRole("button", { name: "Variantes", exact: true }).click();
  await expect(reopened.getByRole("spinbutton", { name: "Precio en centavos" })).toHaveValue(
    originalPrice,
  );
});

test("el título vacío muestra error inline visible con aria y bloquea el guardado", async ({
  page,
}) => {
  test.setTimeout(120_000);
  await openCatalog(page);
  const dialog = await openCreateDialog(page);

  const titleInput = dialog.getByRole("textbox", { name: "Título" });
  await titleInput.fill("");
  const fieldError = dialog.locator("[data-testid='ui-field-error']").filter({
    hasText: "Escribí un título para el producto.",
  });
  await expect(fieldError).toBeVisible();
  await expect(fieldError).toHaveAttribute("role", "alert");
  await expect(titleInput).toHaveAttribute("aria-invalid", "true");

  await dialog.getByRole("button", { name: "Crear producto" }).click();
  await expect(dialog).toBeVisible();

  await titleInput.fill("Título válido A04");
  await expect(titleInput).not.toHaveAttribute("aria-invalid", "true");
  await saveDialog(dialog, true);
});

test("el slug inválido y el duplicado muestran error inline con aria y bloquean el guardado", async ({
  page,
}) => {
  test.setTimeout(120_000);
  await openCatalog(page);
  const dialog = await openEditDialog(page, "Camisa Rayas Finas");

  const slugInput = dialog.getByRole("textbox", { name: "Slug" });
  const slugField = slugInput.locator("xpath=ancestor::fieldset[contains(@class, 'field')]");

  // Slug inválido (mayúsculas y espacios): error visible + aria; sin hint "Disponible".
  await slugInput.fill("Camisa Rayas");
  const patternError = dialog.locator("[data-testid='ui-field-error']").filter({
    hasText: "Solo minúsculas, números y guiones",
  });
  await expect(patternError).toBeVisible();
  await expect(patternError).toHaveAttribute("role", "alert");
  await expect(slugInput).toHaveAttribute("aria-invalid", "true");
  await expect(slugField.getByText("Disponible", { exact: true })).toHaveCount(0);

  await dialog.getByRole("button", { name: "Guardar producto" }).click();
  await expect(dialog).toBeVisible();

  // Slug duplicado (otro producto del catálogo): error específico y bloqueo.
  await slugInput.fill("camisa-oxford-liviana");
  const duplicateError = dialog.locator("[data-testid='ui-field-error']").filter({
    hasText: "Ya existe otro producto con este slug.",
  });
  await expect(duplicateError).toBeVisible();
  await expect(slugInput).toHaveAttribute("aria-invalid", "true");

  await dialog.getByRole("button", { name: "Guardar producto" }).click();
  await expect(dialog).toBeVisible();

  // Al corregir, el slug vuelve a estar disponible y el guardado persiste.
  await slugInput.fill("camisa-rayas-finas-a04");
  await expect(slugInput).not.toHaveAttribute("aria-invalid", "true");
  await expect(slugField.getByText("Disponible", { exact: true })).toBeVisible();
  await saveDialog(dialog, false);

  const reopened = await openEditDialog(page, "Camisa Rayas Finas");
  await expect(reopened.getByRole("textbox", { name: "Slug" })).toHaveValue(
    "camisa-rayas-finas-a04",
  );
});

test("guardar con error en otro paso acerca la razón al primer error (regresión A6)", async ({
  page,
}) => {
  test.setTimeout(120_000);
  await openCatalog(page);
  const dialog = await openCreateDialog(page);
  await dialog.getByRole("textbox", { name: "Título" }).fill("Scroll A04");
  await dialog.getByRole("button", { name: "Variantes", exact: true }).click();
  const price = dialog.getByRole("spinbutton", { name: "Precio en centavos" });
  await price.fill("-100");
  const priceError = price
    .locator("xpath=ancestor::fieldset[contains(@class, 'field')]")
    .getByTestId("ui-field-error");
  await expect(priceError).toBeVisible();
  // Volver a Datos deja el error de precio fuera del área visible del diálogo.
  await dialog.getByRole("button", { name: "Datos", exact: true }).click();
  await expect(priceError).not.toBeInViewport();

  // Al intentar guardar, la razón debe hacerse visible (scroll al primer error).
  await dialog.getByRole("button", { name: "Crear producto" }).click();
  await expect(dialog).toBeVisible();
  await expect.poll(() => dialog.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
  await expect(priceError).toBeInViewport();
});

test("el diálogo expone data-dirty cuando el formulario tiene cambios (regresión A6)", async ({
  page,
}) => {
  test.setTimeout(120_000);
  await openCatalog(page);
  const dialog = await openEditDialog(page, "Camisa Rayas Finas");
  await expect(dialog).not.toHaveAttribute("data-dirty", "true");

  await dialog.getByRole("textbox", { name: "Título" }).fill("Camisa A04 Sucia");
  await expect(dialog).toHaveAttribute("data-dirty", "true");
});
