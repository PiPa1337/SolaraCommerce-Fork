/**
 * F14 — Matriz de interacción (auditoría de controles 2026-08-10): gate duro
 * que recorre los controles clave de TODAS las áreas de la app y aserta el
 * EFECTO REAL (cambio de estado), no sólo la visibilidad del control:
 * Builder (agregar/editar/duplicar/eliminar/deshacer), Shell (tabs, tema,
 * indicador de guardado), Catálogo (búsqueda, orden, bulk, archivar con
 * confirmación), Producto (guardar/cancelar), Assets (subir, reemplazar,
 * borrado bloqueado con usos), Export (borrador, bloqueo con críticos,
 * etapas), Dashboard (crear, duplicar, archivar/restaurar, vista) y
 * SEO/Tema (preset, hex inválido, persistencia).
 *
 * Pendientes por agentes en paralelo: los tres tests de Shell quedan en
 * test.fixme hasta que F2 (Studio.tsx) aterrice; al habilitarlos, el cuerpo
 * ya está escrito y sólo hay que quitar el fixme.
 */
import type { Server } from "node:http";
import { expect, type Locator, type Page, test } from "@playwright/test";
import { createCleanStore } from "./project-helpers";
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

// PNG 1x1 y PNG 2x2 teal: contenidos distintos para que el hash cambie al reemplazar.
const PIXEL_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);
const PIXEL_TEAL_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAAASSURBVBhXY2BoaPgPxhBGw38AQfQH/dpeE7AAAAAASUVORK5CYII=",
  "base64",
);

const IMAGE_INPUT = 'input[type="file"][accept*="image/"]';

async function resetIndexedDb(page: Page): Promise<void> {
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
  await expect(page.getByRole("heading", { name: "Tus tiendas" })).toBeVisible({
    timeout: 20_000,
  });
}

async function openDemoStore(page: Page): Promise<void> {
  await resetIndexedDb(page);
  await page.locator('[data-store-card-id="store-modo-sur-demo"]').click();
  await page.getByRole("button", { name: "Abrir tienda", exact: true }).click();
  await expect(page.getByRole("navigation", { name: "Áreas de la tienda" })).toBeVisible({
    timeout: 20_000,
  });
}

async function openDemoTab(page: Page, tab: string, heading: string): Promise<void> {
  await openDemoStore(page);
  await page.getByRole("tab", { name: tab, exact: true }).click();
  await expect(page.getByRole("heading", { name: heading })).toBeVisible();
}

const sectionsList = (page: Page) => page.getByRole("list", { name: "Secciones de la tienda" });

async function selectHero(page: Page): Promise<void> {
  const hero = page.getByRole("listitem").filter({ hasText: "Hero de catálogo" });
  await hero.getByRole("button").first().click();
}

async function openCatalog(page: Page): Promise<void> {
  await openDemoTab(page, "Catálogo", "Catálogo");
  await expect(page.locator("tbody tr")).toHaveCount(50);
}

const searchBox = (page: Page) => page.getByPlaceholder("Buscar por producto, marca o estado");

async function filterRow(page: Page, title: string): Promise<Locator> {
  await searchBox(page).fill(title);
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

async function saveProduct(dialog: Locator, create: boolean): Promise<void> {
  await dialog
    .getByRole("button", { name: create ? "Crear producto" : "Guardar producto" })
    .click();
  await expect(dialog).toBeHidden();
}

async function setRowStatus(page: Page, rowIndex: number, value: string, label: string) {
  const row = page.locator("tbody tr").nth(rowIndex);
  await row.getByTestId("ui-status-edit-trigger").click();
  const statusSelect = row.getByTestId("ui-status-edit");
  await expect(statusSelect).toBeVisible();
  await statusSelect.selectOption(value);
  await expect(row.locator(".status-label")).toHaveText(label);
}

test.describe("Builder", () => {
  test("agregar, editar, duplicar, eliminar y deshacer cambian el proyecto de verdad", async ({
    page,
  }) => {
    await openDemoTab(page, "Constructor", "Constructor");
    const sections = sectionsList(page);
    await expect(sections).toBeVisible();

    // Agregar una sección al slot Contenido: aterriza en la lista del proyecto.
    const initialCount = await sections.getByRole("listitem").count();
    await page.getByLabel("Tipo de sección").selectOption("content");
    await page.getByRole("button", { name: "Agregar sección" }).click();
    await page
      .getByTestId("ui-module-picker")
      .getByRole("button", { name: /Testimonios/ })
      .click();
    await expect(sections.getByRole("listitem")).toHaveCount(initialCount + 1);
    const lastRow = sections.getByRole("listitem").last();
    await expect(lastRow.locator(".section-select span")).toHaveText("Contenido");
    await expect(lastRow.locator(".section-select strong")).toHaveText("Testimonios");

    // Editar un campo del inspector: el preview y el proyecto cambian.
    await selectHero(page);
    await page.getByRole("textbox", { name: "Título", exact: true }).fill("Título Matriz F14");
    await expect(page.getByText("Cambios pendientes", { exact: true })).toBeVisible();
    await expect(
      page
        .frameLocator('iframe[title="Vista previa desktop"]')
        .locator('[data-solara-module="catalog-hero"] h1'),
    ).toHaveText("Título Matriz F14", { timeout: 15_000 });

    // Duplicar: la copia aparece y queda seleccionada.
    const countAfterAdd = await sections.getByRole("listitem").count();
    await sections
      .getByRole("listitem")
      .first()
      .getByRole("button", { name: "Duplicar sección" })
      .click();
    await expect(sections.getByRole("listitem")).toHaveCount(countAfterAdd + 1);
    await expect(sections.getByRole("listitem").nth(1)).toHaveAttribute("data-selected", "true");

    // Eliminar: la copia desaparece del proyecto.
    await sections
      .getByRole("listitem")
      .nth(1)
      .getByRole("button", { name: "Eliminar sección" })
      .click();
    await expect(sections.getByRole("listitem")).toHaveCount(countAfterAdd);

    // Deshacer: la copia vuelve.
    await page.getByRole("button", { name: "Deshacer" }).click();
    await expect(sections.getByRole("listitem")).toHaveCount(countAfterAdd + 1);
  });
});

test.describe("Shell", () => {
  test.fixme(
    "cambiar de pestaña cambia el panel del editor y su tab queda seleccionada (pendiente de F2)",
    async ({ page }) => {
      await openDemoStore(page);
      const pane = page.locator("[data-studio-editor-pane]");
      await expect(pane).toHaveAttribute("data-tab", "guided");

      await page.getByRole("tab", { name: "Resumen", exact: true }).click();
      await expect(pane).toHaveAttribute("data-tab", "overview");
      await expect(page.getByRole("heading", { name: "Resumen", exact: true })).toBeVisible();
      await expect(page.getByRole("tab", { name: "Resumen", exact: true })).toHaveAttribute(
        "aria-selected",
        "true",
      );
    },
  );

  test.fixme(
    "el toggle de tema cambia data-studio-theme en el documento (pendiente de F2)",
    async ({ page }) => {
      await openDemoStore(page);
      const themeBefore = await page.evaluate(() =>
        document.documentElement.getAttribute("data-studio-theme"),
      );
      await page.getByTestId("ui-theme-toggle").click();
      await expect(page.locator("html")).toHaveAttribute(
        "data-studio-theme",
        themeBefore === "dark" ? "light" : "dark",
      );
    },
  );

  test.fixme(
    "guardar en el navegador pasa por Cambios pendientes y llega a Guardado (pendiente de F2)",
    async ({ page }) => {
      await openDemoTab(page, "Constructor", "Constructor");
      await selectHero(page);
      await page.getByRole("textbox", { name: "Título", exact: true }).fill("Guardado Matriz F14");
      await expect(page.getByText("Cambios pendientes", { exact: true })).toBeVisible();
      await expect(page.getByText(/^Guardado/)).toBeVisible({ timeout: 15_000 });
    },
  );
});

test.describe("Catálogo", () => {
  test("la búsqueda filtra las filas y el orden por precio reordena", async ({ page }) => {
    await openCatalog(page);
    const rows = page.locator("tbody tr");
    const priceInputs = page.locator("tbody tr [data-testid='ui-price-edit']");

    await setRowStatus(page, 0, "hidden", "Oculto");
    await searchBox(page).fill("Oculto");
    await expect(rows).toHaveCount(1);
    await expect(rows.locator(".status-label")).toHaveText(["Oculto"]);
    await searchBox(page).fill("");
    await expect(rows).toHaveCount(50);

    const readPrices = async () =>
      await priceInputs.evaluateAll((inputs) =>
        inputs.map((input) => Number((input as HTMLInputElement).value)),
      );

    await page.getByRole("button", { name: "Precio", exact: true }).click();
    await expect(page.locator("th[aria-sort='ascending']")).toContainText("Precio");
    const ascending = await readPrices();
    for (let index = 1; index < ascending.length; index += 1) {
      expect(ascending[index]).toBeGreaterThanOrEqual(ascending[index - 1]);
    }

    await page.getByRole("button", { name: "Precio", exact: true }).click();
    await expect(page.locator("th[aria-sort='descending']")).toContainText("Precio");
    const descending = await readPrices();
    for (let index = 1; index < descending.length; index += 1) {
      expect(descending[index]).toBeLessThanOrEqual(descending[index - 1]);
    }
  });

  test("el ajuste bulk afecta sólo a los seleccionados y archivar pide confirmación", async ({
    page,
  }) => {
    await openCatalog(page);
    const rows = page.locator("tbody tr");
    const priceOf = (index: number) => rows.nth(index).getByTestId("ui-price-edit");

    await rows.nth(0).getByRole("checkbox").check();
    await rows.nth(1).getByRole("checkbox").check();
    await expect(page.getByText("2 seleccionados")).toBeVisible();

    const original0 = Number(await priceOf(0).inputValue());
    const original1 = Number(await priceOf(1).inputValue());
    const original2 = Number(await priceOf(2).inputValue());

    const bulk = page.getByRole("region", { name: "Acciones masivas" });
    await bulk.getByRole("combobox", { name: "Ajuste" }).selectOption("amount");
    await bulk.getByRole("spinbutton", { name: "Centavos" }).fill("100");
    await bulk.getByRole("button", { name: "Ajustar precios" }).click();

    await expect(priceOf(0)).toHaveValue(String(original0 + 100));
    await expect(priceOf(1)).toHaveValue(String(original1 + 100));
    await expect(priceOf(2)).toHaveValue(String(original2));

    await page.getByRole("button", { name: "Limpiar", exact: true }).click();
    await expect(page.getByText("2 seleccionados")).toHaveCount(0);

    await rows.nth(0).getByRole("checkbox").check();
    await expect(page.getByText("1 seleccionados")).toBeVisible();
    await page.getByRole("heading", { name: "Catálogo" }).click();
    await page.keyboard.press("Delete");
    const confirm = page.getByTestId("ui-confirm-dialog");
    await expect(confirm).toBeVisible();
    await expect(confirm).toContainText("¿Archivar el producto seleccionado?");
    await expect(rows.nth(0).locator(".status-label")).toHaveText("Activo");

    await confirm.getByRole("button", { name: "Archivar", exact: true }).click();
    await expect(confirm).toBeHidden();
    await expect(rows.nth(0).locator(".status-label")).toHaveText("Archivado");
    await searchBox(page).fill("Archivado");
    await expect(rows).toHaveCount(1);
  });
});

test.describe("Producto", () => {
  test("guardar persiste en fila y preview; cancelar descarta", async ({ page }) => {
    await openCatalog(page);

    const dialog = await openCreateDialog(page);
    await dialog.getByRole("textbox", { name: "Título" }).fill("Remera Matriz F14");
    await dialog.getByRole("spinbutton", { name: "Precio en centavos" }).fill("42900");
    await dialog.getByLabel("Estado").selectOption("active");
    await saveProduct(dialog, true);

    const row = await filterRow(page, "Remera Matriz F14");
    await expect(row.getByRole("textbox", { name: "Nombre de Remera Matriz F14" })).toBeVisible();
    await page.getByTestId("ui-preview-route").fill("/productos/remera-matriz-f14/");
    await page.getByTestId("ui-preview-route").press("Enter");
    await expect(
      page.frameLocator('iframe[title="Vista previa desktop"]').locator("body"),
    ).toContainText("Remera Matriz F14", { timeout: 20_000 });

    const originalTitle = "Camisa Rayas Finas";
    await searchBox(page).fill(originalTitle);
    const rows = page.locator("tbody tr");
    await expect(rows).toHaveCount(1);
    await rows.first().getByRole("button", { name: "Editar" }).click();
    const editDialog = page.locator("dialog.product-dialog");
    await expect(editDialog).toBeVisible();
    await editDialog.getByRole("textbox", { name: "Título" }).fill("Camisa Rayas Finas MODIFICADA");
    await editDialog.getByRole("button", { name: "Cancelar" }).click();
    const confirm = page.getByTestId("ui-confirm-dialog");
    await expect(confirm).toBeVisible();
    await confirm.getByRole("button", { name: "Salir sin guardar" }).click();
    await expect(editDialog).toBeHidden();

    await expect(page.getByRole("textbox", { name: `Nombre de ${originalTitle}` })).toBeVisible();
    await expect(
      page.getByRole("textbox", { name: "Nombre de Camisa Rayas Finas MODIFICADA" }),
    ).toHaveCount(0);
  });
});

test.describe("Assets", () => {
  test("subir un asset lo hace aparecer y reemplazarlo conserva su nombre", async ({ page }) => {
    await resetIndexedDb(page);
    await createCleanStore(page, "Tienda recursos matriz");
    await page.getByRole("tab", { name: "Recursos", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Recursos" })).toBeVisible();

    await page.locator(IMAGE_INPUT).setInputFiles({
      name: "pixel.png",
      mimeType: "image/png",
      buffer: PIXEL_PNG,
    });
    await expect(page.locator("output").filter({ hasText: "1 imagen agregada" })).toBeVisible({
      timeout: 15_000,
    });
    const assetItem = page.locator(".asset-item").filter({
      has: page.locator('input[value="pixel"]'),
    });
    await expect(assetItem).toBeVisible();

    await assetItem.getByTestId("ui-asset-detail-open").click();
    const detail = page.getByTestId("ui-asset-detail");
    await expect(detail).toBeVisible();
    await page.getByTestId("ui-asset-replace").click();
    await page.locator(IMAGE_INPUT).setInputFiles({
      name: "pixel-teal.png",
      mimeType: "image/png",
      buffer: PIXEL_TEAL_PNG,
    });
    await expect(page.locator("output").filter({ hasText: "Imagen reemplazada" })).toBeVisible({
      timeout: 15_000,
    });

    await expect(detail).toContainText("2 × 2");
    await expect(detail.getByRole("heading")).toHaveText("pixel");
    await expect(assetItem.locator("input").first()).toHaveValue("pixel");
  });

  test("eliminar un asset en uso queda bloqueado con aviso", async ({ page }) => {
    await resetIndexedDb(page);
    const card = page
      .locator(".dashboard-store-card")
      .filter({ has: page.getByText("Predeterminado", { exact: true }) });
    await card.getByRole("button", { name: "Abrir esta tienda" }).click();
    await expect(page.getByRole("navigation", { name: "Áreas de la tienda" })).toBeVisible();
    await page.getByRole("tab", { name: "Recursos", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Recursos" })).toBeVisible();

    const heroAsset = page.locator(".asset-item").filter({
      has: page.locator('input[value="Campaña Modo Sur"]'),
    });
    await heroAsset.getByTestId("ui-asset-detail-open").click();
    const detail = page.getByTestId("ui-asset-detail");
    await expect(detail).toBeVisible();
    await expect(detail).toContainText("catalog-hero");
    await expect(page.getByTestId("ui-asset-delete")).toBeDisabled();
    await expect(page.getByTestId("ui-asset-delete")).toHaveAttribute(
      "title",
      "Sólo se puede eliminar una imagen que no esté en uso",
    );
  });
});

test.describe("Export", () => {
  test("el borrador exporta por etapas de a una y produce el aviso", async ({ page }) => {
    test.setTimeout(150_000);
    await openDemoTab(page, "Exportar", "Exportar");
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
      timeout: 90_000,
    });
    for (const stage of ["validate", "render", "package"]) {
      await expect(
        page.locator(`[data-testid="ui-export-stage"][data-stage="${stage}"]`),
      ).toHaveAttribute("data-done", "true");
    }
  });

  test("la producción queda bloqueada cuando hay errores críticos", async ({ page }) => {
    await resetIndexedDb(page);
    await createCleanStore(page, "Tienda export crítica");
    await page.getByRole("tab", { name: "Exportar", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Exportar" })).toBeVisible();

    const block = page.getByText(/errores críticos deben resolverse/);
    await expect(block).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId("ui-export-production")).toBeDisabled();
    const blockCount = Number(
      (await block.innerText()).match(/(\d+) errores críticos/)?.[1] ?? "0",
    );
    expect(blockCount).toBeGreaterThan(0);
    await expect(page.locator(".optimization-export-summary")).toContainText(
      `${blockCount} críticos`,
    );
  });
});

test.describe("Dashboard", () => {
  test("crear, duplicar, archivar/restaurar y el toggle de vista actúan de verdad", async ({
    page,
  }) => {
    await resetIndexedDb(page);
    await expect(page.locator(".dashboard-cosmic-count")).toHaveText("1 visibles");

    // Crear una tienda: entra al editor con el nombre nuevo.
    await page.getByRole("button", { name: "Nueva tienda", exact: true }).click();
    await page.getByLabel("Nueva tienda").fill("Tienda Matriz F14");
    for (let step = 0; step < 3; step += 1) {
      await page.getByRole("button", { name: "Continuar", exact: true }).click();
    }
    await page.getByRole("button", { name: "Crear tienda vacía", exact: true }).click();
    await expect(page.getByRole("navigation", { name: "Áreas de la tienda" })).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.locator(".studio-breadcrumb__current")).toHaveText("Tienda Matriz F14");

    // Volver al dashboard para las acciones restantes.
    await page.getByRole("button", { name: "Volver a tiendas" }).click();
    await expect(page.getByRole("heading", { name: "Tus tiendas" })).toBeVisible();
    await expect(page.locator(".dashboard-cosmic-count")).toHaveText("2 visibles");

    // Archivar con confirmación y restaurar desde el deshacer.
    const card = page
      .locator(".dashboard-store-card")
      .filter({ has: page.getByText("Predeterminado", { exact: true }) });
    await card.locator(".dashboard-store-card__button").click();
    await page
      .getByRole("complementary", { name: "Tienda seleccionada: Predeterminado" })
      .getByRole("button", { name: "Archivar" })
      .click();
    const confirm = page.getByTestId("ui-confirm-dialog");
    await expect(confirm).toBeVisible();
    await confirm.getByRole("button", { name: "Archivar", exact: true }).click();
    await expect(confirm).toBeHidden();
    await expect(page.locator(".dashboard-cosmic-count")).toHaveText("1 visibles");
    const toast = page.getByTestId("ui-dashboard-toast");
    await expect(toast).toContainText("Deshacer");
    await toast.getByRole("button", { name: "Deshacer" }).click();
    await expect(page.locator(".dashboard-cosmic-count")).toHaveText("2 visibles");

    // Al archivar (filtro por defecto "Activas") la selección salta a la
    // primera visible; se vuelve a elegir Predeterminado para duplicarla.
    const restoredCard = page
      .locator(".dashboard-store-card")
      .filter({ has: page.getByText("Predeterminado", { exact: true }) });
    await restoredCard.locator(".dashboard-store-card__button").click();
    const detail = page.getByRole("complementary", { name: "Tienda seleccionada: Predeterminado" });
    await expect(detail).toBeVisible();

    // Duplicar: la copia aparece con id nuevo.
    await detail.getByRole("button", { name: "Duplicar" }).click();
    const duplicate = page.getByRole("dialog", { name: "Duplicar tienda" });
    await expect(duplicate).toBeVisible();
    await page.getByTestId("ui-duplicate-name").fill("Copia Matriz F14");
    await duplicate.getByRole("button", { name: "Duplicar", exact: true }).click();
    await expect(duplicate).toBeHidden();
    await expect(page.locator(".dashboard-cosmic-count")).toHaveText("3 visibles");
    const copy = page.locator(".dashboard-store-card").filter({ hasText: "Copia Matriz F14" });
    await expect(copy).toBeVisible();
    await expect(copy.locator(".dashboard-store-card__button")).not.toHaveAttribute(
      "data-store-card-id",
      "store-modo-sur-demo",
    );

    // Vista: el toggle cambia el layout de los resultados.
    const results = page.locator(".dashboard-cosmic-results");
    await expect(results).toHaveClass(/dashboard-cosmic-results--grid/);
    await page.getByRole("button", { name: "Vista en lista", exact: true }).click();
    await expect(page.getByRole("button", { name: "Vista en lista", exact: true })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(results).toHaveClass(/dashboard-cosmic-results--list/);
    await page.getByRole("button", { name: "Vista en grilla", exact: true }).click();
    await expect(results).toHaveClass(/dashboard-cosmic-results--grid/);
  });
});

test.describe("SEO y Tema", () => {
  test("preset, hex inválido y persistencia SEO cambian o validan el estado", async ({ page }) => {
    await resetIndexedDb(page);
    await createCleanStore(page, "Tienda tema matriz");
    const previewBackground = () =>
      page
        .frameLocator('iframe[title="Vista previa desktop"]')
        .locator("html")
        .evaluate((element) => getComputedStyle(element).backgroundColor);

    await page.getByRole("tab", { name: "Tema", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Tema", exact: true })).toBeVisible();
    await expect.poll(previewBackground, { timeout: 15_000 }).toBe("rgb(252, 252, 251)");

    // Preset: aplica la paleta real a los campos y al preview.
    await page.getByRole("button", { name: "Aplicar paleta Costa terracota" }).click();
    await expect(page.getByTestId("ui-color-text-accent")).toHaveValue("#b4552d");
    await expect(page.getByTestId("ui-color-text-background")).toHaveValue("#faf6f2");
    await expect.poll(previewBackground, { timeout: 15_000 }).toBe("rgb(250, 246, 242)");

    // Hex inválido: error inline, no commitea y el nativo conserva el último válido.
    const accentText = page.getByTestId("ui-color-text-accent");
    const accentNative = page.getByTestId("ui-color-native-accent");
    const accentField = accentText.locator("xpath=ancestor::fieldset[contains(@class, 'field')]");
    const originalAccent = await accentText.inputValue();
    const originalNative = await accentNative.inputValue();
    await accentText.fill("zzz");
    await expect(accentText).toHaveAttribute("aria-invalid", "true");
    await expect(accentField.getByTestId("ui-field-error")).toContainText("Ingresá un color hex");
    await expect(accentNative).toHaveValue(originalNative);
    await accentText.fill(originalAccent);
    await expect(accentText).not.toHaveAttribute("aria-invalid", "true");
    await expect(accentNative).toHaveValue(originalNative);

    // SEO: el título persiste al cambiar de página.
    await page.getByRole("tab", { name: "SEO", exact: true }).click();
    await expect(page.getByRole("heading", { name: "SEO y Google" })).toBeVisible();
    await page.getByLabel("Título SEO").fill("Título SEO Matriz F14");
    await expect(page.getByText("21/70 caracteres")).toBeVisible();
    await page.getByRole("tab", { name: "Resumen", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Resumen", exact: true })).toBeVisible();
    await page.getByRole("tab", { name: "SEO", exact: true }).click();
    await expect(page.getByLabel("Título SEO")).toHaveValue("Título SEO Matriz F14");
  });
});
