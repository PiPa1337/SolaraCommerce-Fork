/**
 * Barrido A6 (2026-08-10) — ProductEditor: validar / guardar / cancelar.
 * Slice de AUDITORÍA sobre `apps/studio/src/features/catalog/ProductEditor.tsx`
 * (NO se edita; A4 es el OWNER). Cada test cubre un control con el contrato de
 * 3 capas: efecto real, auto-feedback (error inline + aria, prompt de descarte)
 * y contrato de datos (lo que se persiste / lo que se descarta).
 *
 * - Slug duplicado y con formato inválido: error inline + aria-invalid,
 *   guardado bloqueado, slug nunca commiteado.
 * - Precio inválido (negativo / flotante): error, bloqueo y persistencia sólo
 *   de enteros ≥ 0 en centavos (consistente con el schema).
 * - Campos requeridos vacíos (título, nombre de variante): marcados y bloqueo.
 * - Guardar con errores simultáneos: bloqueado con la razón visible en cada
 *   campo (auto-feedback por campo, role="alert").
 * - Cancelar con cambios: prompt, "Seguir editando" conserva el borrador,
 *   confirmar descarta y el formulario vuelve al valor de la tienda.
 * - Cerrar (X/Escape) con cambios: prompt de descarte que muestra el estado;
 *   cerrar limpio no pregunta.
 * - Mini preview: refleja en vivo título, precio mínimo y estado (crear/editar).
 * - A4: el guardado bloqueado lleva el primer error al viewport y el diálogo
 *   muestra el estado visible de cambios sin guardar.
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

async function openCreateDialog(page: Page): Promise<Locator> {
  await page.getByRole("button", { name: "Agregar producto" }).first().click();
  const dialog = page.locator("dialog.product-dialog");
  await expect(dialog).toBeVisible();
  return dialog;
}

/** Aísla la fila de un producto por su título exacto en la búsqueda. */
async function filterRow(page: Page, title: string): Promise<Locator> {
  await page.getByPlaceholder("Buscar por producto, marca o estado").fill(title);
  const rows = page.locator("tbody tr");
  await expect(rows).toHaveCount(1);
  return rows.first();
}

async function openEditDialog(page: Page, title: string): Promise<Locator> {
  const row = await filterRow(page, title);
  await row.getByRole("button", { name: "Editar" }).click();
  const dialog = page.locator("dialog.product-dialog");
  await expect(dialog).toBeVisible();
  return dialog;
}

/** Fieldset del Field que envuelve un control nativo (patrón de Ui.tsx). */
function fieldOf(input: Locator): Locator {
  return input.locator("xpath=ancestor::fieldset[contains(@class, 'field')]");
}

async function goToStep(dialog: Locator, label: string) {
  await dialog.getByRole("button", { name: label, exact: true }).click();
}

async function saveProduct(dialog: Locator, create: boolean) {
  await dialog
    .getByRole("button", { name: create ? "Crear producto" : "Guardar producto" })
    .click();
  await expect(dialog).toBeHidden();
}

async function discardChanges(page: Page) {
  const confirm = page.getByTestId("ui-confirm-dialog");
  await expect(confirm).toBeVisible();
  await confirm.getByRole("button", { name: "Salir sin guardar" }).click();
}

test("slug duplicado en edición: error inline con aria, guardado bloqueado y slug no commiteado", async ({
  page,
}) => {
  test.setTimeout(90_000);
  await openCatalog(page);
  const dialog = await openEditDialog(page, "Camisa Rayas Finas");

  const slugInput = dialog.getByRole("textbox", { name: "Slug" });
  await expect(slugInput).toHaveValue("camisa-rayas-finas");

  // Slug de otro producto del catálogo: error inline + aria en input y fieldset.
  await slugInput.fill("remera-esencial-de-algodon");
  await expect(slugInput).toHaveAttribute("aria-invalid", "true");
  await expect(fieldOf(slugInput)).toHaveAttribute("aria-invalid", "true");
  await expect(fieldOf(slugInput).getByTestId("ui-field-error")).toContainText(
    "Ya existe otro producto con este slug.",
  );
  await expect(fieldOf(slugInput).getByText("Disponible")).toHaveCount(0);

  // Guardar queda bloqueado: el diálogo permanece abierto y el slug no se commitea.
  await dialog.getByRole("button", { name: "Guardar producto" }).click();
  await expect(dialog).toBeVisible();
  await expect(page.getByText(/50 productos y /)).toBeVisible();

  // Formato inválido también marca error con su mensaje.
  await slugInput.fill("CAMISA-RAYAS");
  await expect(fieldOf(slugInput).getByTestId("ui-field-error")).toContainText(
    "Solo minúsculas, números y guiones (ejemplo: lampara-horizonte).",
  );

  // Restaurar el slug propio limpia el error y muestra "Disponible".
  await slugInput.fill("camisa-rayas-finas");
  await expect(slugInput).not.toHaveAttribute("aria-invalid", "true");
  await expect(fieldOf(slugInput).getByTestId("ui-field-error")).toHaveCount(0);
  await expect(fieldOf(slugInput).getByText("Disponible")).toBeVisible();

  await saveProduct(dialog, false);

  // Contrato: el producto conserva su título y su ruta original (slug intacto).
  await expect(page.getByText(/50 productos y /)).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Nombre de Camisa Rayas Finas" })).toBeVisible();
  const routeInput = page.getByTestId("ui-preview-route");
  await routeInput.fill("/productos/camisa-rayas-finas/");
  await routeInput.press("Enter");
  const previewBody = page.frameLocator('iframe[title="Vista previa desktop"]').locator("body");
  await expect(previewBody).toContainText("Camisa Rayas Finas", { timeout: 20_000 });
});

test("precio inválido (negativo y flotante) marca error y bloquea; sólo enteros en centavos persisten", async ({
  page,
}) => {
  test.setTimeout(90_000);
  await openCatalog(page);
  const dialog = await openEditDialog(page, "Camisa Rayas Finas");
  await goToStep(dialog, "Variantes");

  const priceInput = dialog.getByRole("spinbutton", { name: "Precio en centavos" });
  await expect(priceInput).toHaveValue("3225000");
  const priceError = fieldOf(priceInput).getByTestId("ui-field-error");

  // Negativo: error con aria, guardado bloqueado.
  await priceInput.fill("-500");
  await expect(priceError).toContainText(
    "El precio debe ser un número entero en centavos, mayor o igual a 0.",
  );
  await expect(priceInput).toHaveAttribute("aria-invalid", "true");
  await dialog.getByRole("button", { name: "Guardar producto" }).click();
  await expect(dialog).toBeVisible();

  // Flotante: sigue inválido (el schema exige enteros en centavos).
  await priceInput.fill("12.5");
  await expect(priceError).toBeVisible();
  await dialog.getByRole("button", { name: "Guardar producto" }).click();
  await expect(dialog).toBeVisible();

  // Entero válido: limpia el error y permite guardar.
  await priceInput.fill("999");
  await expect(priceError).toHaveCount(0);
  await expect(priceInput).not.toHaveAttribute("aria-invalid", "true");
  await saveProduct(dialog, false);

  // Contrato: actualización persistida; al reabrir el precio es 999.
  await expect(page.getByText(/50 productos y /)).toBeVisible();
  const edit = await openEditDialog(page, "Camisa Rayas Finas");
  await goToStep(edit, "Variantes");
  await expect(edit.getByRole("spinbutton", { name: "Precio en centavos" })).toHaveValue("999");
});

test("campos requeridos vacíos: título y nombre de variante marcados y guardado bloqueado", async ({
  page,
}) => {
  test.setTimeout(90_000);
  await openCatalog(page);
  const dialog = await openCreateDialog(page);

  const titleInput = dialog.getByRole("textbox", { name: "Título" });
  await titleInput.fill("");
  await expect(titleInput).toHaveAttribute("aria-invalid", "true");
  await expect(fieldOf(titleInput).getByTestId("ui-field-error")).toContainText(
    "Escribí un título para el producto.",
  );
  await dialog.getByRole("button", { name: "Crear producto" }).click();
  await expect(dialog).toBeVisible();

  // Nombre de variante vacío: error propio del campo de la variante.
  await goToStep(dialog, "Variantes");
  const variantName = dialog.getByRole("textbox", { name: "Nombre" });
  await variantName.fill("");
  await expect(variantName).toHaveAttribute("aria-invalid", "true");
  await expect(fieldOf(variantName).getByTestId("ui-field-error")).toContainText(
    "Escribí un nombre para la variante.",
  );

  // Completar ambos campos limpia los errores y el guardado avanza.
  await goToStep(dialog, "Datos");
  await titleInput.fill("Sweep A06 Requerido");
  await expect(titleInput).not.toHaveAttribute("aria-invalid", "true");
  await goToStep(dialog, "Variantes");
  await variantName.fill("Única");
  await expect(fieldOf(variantName).getByTestId("ui-field-error")).toHaveCount(0);
  await saveProduct(dialog, true);

  // Contrato: el producto nuevo existe en la fila y el contador creció.
  await expect(page.getByText(/51 productos y /)).toBeVisible();
  const row = await filterRow(page, "Sweep A06 Requerido");
  await expect(row.getByRole("textbox", { name: "Nombre de Sweep A06 Requerido" })).toBeVisible();
});

test("guardar con errores simultáneos: bloqueado con la razón visible en cada campo", async ({
  page,
}) => {
  test.setTimeout(90_000);
  await openCatalog(page);
  const dialog = await openCreateDialog(page);

  // Tres errores a la vez: título vacío, slug duplicado y precio negativo.
  await dialog.getByRole("textbox", { name: "Título" }).fill("");
  await dialog.getByRole("textbox", { name: "Slug" }).fill("remera-esencial-de-algodon");
  await goToStep(dialog, "Variantes");
  await dialog.getByRole("spinbutton", { name: "Precio en centavos" }).fill("-100");

  await dialog.getByRole("button", { name: "Crear producto" }).click();
  await expect(dialog).toBeVisible();

  // Auto-feedback: cada campo marcado con su razón (role="alert" inline).
  await expect(dialog.getByRole("textbox", { name: "Título" })).toHaveAttribute(
    "aria-invalid",
    "true",
  );
  await expect(dialog.getByRole("textbox", { name: "Slug" })).toHaveAttribute(
    "aria-invalid",
    "true",
  );
  await expect(dialog.getByRole("spinbutton", { name: "Precio en centavos" })).toHaveAttribute(
    "aria-invalid",
    "true",
  );
  await expect(dialog.locator('[data-testid="ui-field-error"]')).toHaveCount(3);
  await expect(page.getByText(/50 productos y /)).toBeVisible();

  // Corregir todo permite crear; el diálogo se cierra y el catálogo crece.
  await goToStep(dialog, "Datos");
  await dialog.getByRole("textbox", { name: "Título" }).fill("Sweep A06 Multi");
  await dialog.getByRole("textbox", { name: "Slug" }).fill("sweep-a06-multi");
  await goToStep(dialog, "Variantes");
  await dialog.getByRole("spinbutton", { name: "Precio en centavos" }).fill("1000");
  await expect(dialog.locator('[data-testid="ui-field-error"]')).toHaveCount(0);
  await saveProduct(dialog, true);

  await expect(page.getByText(/51 productos y /)).toBeVisible();
  const row = await filterRow(page, "Sweep A06 Multi");
  await expect(row.getByRole("textbox", { name: "Nombre de Sweep A06 Multi" })).toBeVisible();
});

test("cancelar con cambios: prompt conserva con Seguir editando; confirmar descarta y revierte el formulario", async ({
  page,
}) => {
  test.setTimeout(90_000);
  await openCatalog(page);
  const originalTitle = "Camisa Rayas Finas";
  const dialog = await openEditDialog(page, originalTitle);

  const titleInput = dialog.getByRole("textbox", { name: "Título" });
  await titleInput.fill("Camisa A06 MODIFICADA");

  // Cancelar con sucio: prompt con el estado del borrador.
  await dialog.getByRole("button", { name: "Cancelar" }).click();
  const confirm = page.getByTestId("ui-confirm-dialog");
  await expect(confirm).toBeVisible();
  await expect(confirm).toContainText("Hay cambios sin guardar en el producto.");

  // "Seguir editando": el borrador se conserva íntegro.
  await confirm.getByRole("button", { name: "Seguir editando" }).click();
  await expect(confirm).toBeHidden();
  await expect(dialog).toBeVisible();
  await expect(titleInput).toHaveValue("Camisa A06 MODIFICADA");

  // Confirmar el descarte: el formulario se cierra y la fila vuelve al original.
  await dialog.getByRole("button", { name: "Cancelar" }).click();
  await discardChanges(page);
  await expect(dialog).toBeHidden();
  await expect(page.getByRole("textbox", { name: `Nombre de ${originalTitle}` })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Nombre de Camisa A06 MODIFICADA" })).toHaveCount(
    0,
  );
  await expect(page.getByText(/50 productos y /)).toBeVisible();

  // Contrato: al reabrir, el formulario muestra el valor persistido (no el borrador).
  const edit = await openEditDialog(page, originalTitle);
  await expect(edit.getByRole("textbox", { name: "Título" })).toHaveValue(originalTitle);
});

test("cerrar con cambios: prompt por X y Escape conserva el estado; cerrar limpio no pregunta", async ({
  page,
}) => {
  test.setTimeout(90_000);
  await openCatalog(page);
  const originalTitle = "Camisa Rayas Finas";
  const dialog = await openEditDialog(page, originalTitle);
  const confirm = page.getByTestId("ui-confirm-dialog");

  await dialog.getByRole("textbox", { name: "Título" }).fill("Camisa A06 CERRAR");

  // Cerrar con la X: prompt de descarte; Escape en el prompt vuelve a editar.
  await dialog.getByRole("button", { name: "Cerrar editor" }).click();
  await expect(confirm).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(confirm).toBeHidden();
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("textbox", { name: "Título" })).toHaveValue("Camisa A06 CERRAR");

  // Escape en el diálogo: vuelve a preguntar (el estado sucio sigue presente).
  await page.keyboard.press("Escape");
  await expect(confirm).toBeVisible();
  await discardChanges(page);
  await expect(dialog).toBeHidden();
  await expect(page.getByRole("textbox", { name: `Nombre de ${originalTitle}` })).toBeVisible();
  await expect(page.getByText(/50 productos y /)).toBeVisible();

  // Sin cambios: Escape cierra directo, sin prompt.
  const clean = await openEditDialog(page, originalTitle);
  await page.keyboard.press("Escape");
  await expect(clean).toBeHidden();
  await expect(confirm).toHaveCount(0);
});

test("cerrar el editor sin cambios devuelve el foco al disparador de la fila", async ({ page }) => {
  test.setTimeout(90_000);
  await openCatalog(page);
  const row = await filterRow(page, "Camisa Rayas Finas");
  const editButton = row.getByRole("button", { name: "Editar" });
  await editButton.click();

  const dialog = page.locator("dialog.product-dialog");
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Cancelar" }).click();
  await expect(dialog).toBeHidden();
  await expect(editButton).toBeFocused();
});

test("descartar cambios confirmados devuelve el foco al disparador de la fila", async ({
  page,
}) => {
  test.setTimeout(90_000);
  await openCatalog(page);
  const row = await filterRow(page, "Camisa Rayas Finas");
  const editButton = row.getByRole("button", { name: "Editar" });
  await editButton.click();

  const dialog = page.locator("dialog.product-dialog");
  await expect(dialog).toBeVisible();
  await dialog.getByRole("textbox", { name: "Título" }).fill("Producto descartable A06");
  await dialog.getByRole("button", { name: "Cancelar" }).click();

  const confirm = page.getByTestId("ui-confirm-dialog");
  await expect(confirm).toBeVisible();
  await confirm.getByRole("button", { name: "Salir sin guardar" }).click();
  await expect(dialog).toBeHidden();
  await expect(editButton).toBeFocused();
});

test("la mini preview refleja en vivo título, precio mínimo y estado (edición y creación)", async ({
  page,
}) => {
  test.setTimeout(120_000);
  await openCatalog(page);

  // --- Edición ---
  const dialog = await openEditDialog(page, "Camisa Rayas Finas");
  await goToStep(dialog, "Variantes");
  const preview = dialog.getByTestId("ui-product-mini-preview");
  await expect(preview.locator("strong")).toHaveText("Camisa Rayas Finas");
  await expect(preview.locator(".product-mini-preview__info")).toContainText("Desde $3.225.000");
  await expect(preview.locator(".product-mini-preview__status")).toHaveText("Activo");
  // La primera imagen del producto se renderiza (los assets del estudio llegan
  // como data URLs, así que el contrato es img presente y placeholder ausente).
  await expect(preview.locator("img")).toBeVisible();
  await expect(preview.locator(".product-mini-preview__placeholder")).toHaveCount(0);

  // Título en vivo.
  await goToStep(dialog, "Datos");
  await dialog.getByRole("textbox", { name: "Título" }).fill("Camisa A06 Live");
  await expect(preview.locator("strong")).toHaveText("Camisa A06 Live");

  // Estado en vivo (clase de estado incluida).
  await dialog.getByLabel("Estado").selectOption("hidden");
  await expect(preview.locator(".product-mini-preview__status")).toHaveText("Oculto");
  await expect(preview.locator(".product-mini-preview__status")).toHaveClass(/status--hidden/);
  await dialog.getByLabel("Estado").selectOption("active");

  // Precio mínimo en vivo (única variante del fixture).
  await goToStep(dialog, "Variantes");
  await dialog.getByRole("spinbutton", { name: "Precio en centavos" }).fill("5000");
  await expect(preview.locator(".product-mini-preview__info")).toContainText("Desde $5.000");

  // Guardar y verificar el contrato en la ruta pública.
  await saveProduct(dialog, false);
  const row = await filterRow(page, "Camisa A06 Live");
  await expect(row.getByRole("textbox", { name: "Nombre de Camisa A06 Live" })).toBeVisible();
  const routeInput = page.getByTestId("ui-preview-route");
  await routeInput.fill("/productos/camisa-a06-live/");
  await routeInput.press("Enter");
  const previewBody = page.frameLocator('iframe[title="Vista previa desktop"]').locator("body");
  await expect(previewBody).toContainText("Camisa A06 Live", { timeout: 20_000 });

  // --- Creación ---
  const create = await openCreateDialog(page);
  await goToStep(create, "Variantes");
  const createPreview = create.getByTestId("ui-product-mini-preview");
  await expect(createPreview.locator("strong")).toHaveText("Nuevo producto");
  await expect(createPreview.locator(".product-mini-preview__info")).toContainText("Desde $0");
  await expect(createPreview.locator(".product-mini-preview__status")).toHaveText("Oculto");

  await goToStep(create, "Datos");
  await create.getByRole("textbox", { name: "Título" }).fill("Sweep A06 Mini");
  await expect(createPreview.locator("strong")).toHaveText("Sweep A06 Mini");
  await goToStep(create, "Variantes");
  await create.getByRole("spinbutton", { name: "Precio en centavos" }).fill("2500");
  await expect(createPreview.locator(".product-mini-preview__info")).toContainText("Desde $2.500");

  // Descartar el borrador: nada se commitea. La tabla sin coincidencias muestra
  // sólo su fila de estado vacío `tr > td.table-empty` (la clase vive en el td,
  // no en el tr), nunca una fila de producto.
  await create.getByRole("button", { name: "Cerrar editor" }).click();
  await discardChanges(page);
  await expect(create).toBeHidden();
  await page.getByPlaceholder("Buscar por producto, marca o estado").fill("Sweep A06 Mini");
  await expect(page.locator("tbody tr:not(:has(td.table-empty))")).toHaveCount(0);
  await expect(page.getByText("No hay productos que coincidan con la búsqueda.")).toBeVisible();
  await expect(page.getByText(/50 productos y /)).toBeVisible();
});

test("A4 — guardado bloqueado acerca la razón al campo visible", async ({ page }) => {
  test.setTimeout(90_000);
  await openCatalog(page);
  const dialog = await openCreateDialog(page);

  await dialog.getByRole("textbox", { name: "Título" }).fill("Sweep A06 Fixme");
  await goToStep(dialog, "Variantes");
  await dialog.getByRole("spinbutton", { name: "Precio en centavos" }).fill("-100");
  // Volver a Datos deja el error de precio fuera del área visible del body.
  await goToStep(dialog, "Datos");

  // El scroll real ocurre en el <dialog> (max-height con recorte del UA),
  // no en .product-dialog__body: el body crece y el diálogo es el contenedor
  // scrolleable.
  await expect(dialog.evaluate((element) => element.scrollTop)).resolves.toBe(0);

  // Al intentar guardar, la razón debería hacerse visible (scroll al primer
  // error o aviso transitorio).
  await dialog.getByRole("button", { name: "Crear producto" }).click();
  await expect(dialog.evaluate((element) => element.scrollTop)).resolves.toBeGreaterThan(0);
  const priceError = dialog
    .getByRole("spinbutton", { name: "Precio en centavos" })
    .locator("xpath=ancestor::fieldset[contains(@class, 'field')]")
    .getByTestId("ui-field-error");
  await expect(priceError).toBeInViewport();
});

test("A4 — el diálogo muestra un indicador visible de cambios sin guardar", async ({ page }) => {
  test.setTimeout(90_000);
  await openCatalog(page);
  const dialog = await openEditDialog(page, "Camisa Rayas Finas");
  await expect(dialog).not.toHaveAttribute("data-dirty", "true");

  await dialog.getByRole("textbox", { name: "Título" }).fill("Camisa A06 Sucia");
  await expect(dialog).toHaveAttribute("data-dirty", "true");
  await expect(dialog.getByTestId("ui-product-dirty")).toHaveText("Cambios sin guardar");
  await expect(dialog.getByTestId("ui-product-dirty")).toHaveAttribute("aria-live", "polite");
});
