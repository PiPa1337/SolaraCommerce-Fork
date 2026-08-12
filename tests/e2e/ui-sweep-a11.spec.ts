/**
 * Barrido A11 — Constructor: operaciones de sección (auditoría, slice de
 * `apps/studio/src/features/Builder.tsx`; NO lo edita: A10 es el owner).
 * Contrato de 3 capas por control: (1) click → efecto real en el proyecto
 * (lista, inspector y preview), (2) auto-feedback del control (disabled en
 * límites, `data-selected`, botones Deshacer/Rehacer, indicador de guardado),
 * (3) payload del handler → receptor (`replaceProject` valida con
 * `StoreProjectV1Schema` y empuja el snapshot al historial).
 *
 * Cobertura del bin A11:
 *  - Duplicar: copia con identidad propia (id nuevo) y contenido independiente.
 *  - Reemplazar módulo: el módulo cambia y sólo se conservan settings
 *    compatibles (`replaceModuleInSection`); id/slot/motion intactos.
 *  - Mover arriba/abajo (botones y teclado): el orden cambia en lista y
 *    preview; botones deshabilitados en los límites.
 *  - Eliminar: la sección sale del proyecto y del preview; la selección salta
 *    a la primera sección; undo la restaura con su contenido.
 *  - Guardar settings del inspector: valor válido aplica y persiste tras
 *    recarga; valor inválido NO entra al historial (payload rechazado).
 *  - Ocultar/mostrar sección: feedback de ícono/label + preview.
 *  - Undo/redo de cada operación con feedback del estado del historial.
 *
 * Los cambios de Builder.tsx quedan cubiertos como regresiones del owner A10.
 */
import type { Server } from "node:http";
import { expect, type Locator, type Page, test } from "@playwright/test";
import { startStudioServer, stopStudioServer } from "./studio-server";

test.setTimeout(process.env.CI ? 90_000 : 60_000);

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

async function openBuilder(page: Page): Promise<void> {
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
  await expect(page.getByRole("heading", { name: "Tus tiendas" })).toBeVisible({
    timeout: 20_000,
  });
  await page.locator('[data-store-card-id="store-modo-sur-demo"]').click();
  await page.getByRole("button", { name: "Abrir tienda", exact: true }).click();
  await page.getByRole("tab", { name: "Constructor" }).click();
  await expect(page.getByRole("heading", { name: "Constructor" })).toBeVisible();
}

/** Re-entrada a la tienda sin limpiar IndexedDB (conserva lo autoguardado). */
async function reopenBuilder(page: Page): Promise<void> {
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
const undoButton = (page: Page) => page.getByRole("button", { name: "Deshacer" });
const redoButton = (page: Page) => page.getByRole("button", { name: "Rehacer" });

function row(page: Page, index: number): Locator {
  return sectionsList(page).getByRole("listitem").nth(index);
}

function rowByName(page: Page, name: string): Locator {
  return sectionsList(page).getByRole("listitem").filter({ hasText: name });
}

function rowName(page: Page, index: number): Promise<string | null> {
  return row(page, index).locator(".section-select strong").textContent();
}

async function previewModuleOrder(page: Page): Promise<string[]> {
  return previewFrame(page)
    .locator("[data-solara-module]")
    .evaluateAll((elements) =>
      elements.map((element) => element.getAttribute("data-solara-module") ?? ""),
    );
}

async function selectHero(page: Page): Promise<void> {
  await rowByName(page, "Hero de catálogo").first().locator(".section-select").click();
}

test("duplicar crea una copia con id nuevo, contenido independiente y feedback de selección", async ({
  page,
}) => {
  await openBuilder(page);
  const sections = sectionsList(page);
  const initialCount = await sections.getByRole("listitem").count();

  await selectHero(page);
  const heroRow = rowByName(page, "Hero de catálogo").first();
  await expect(heroRow).toHaveAttribute("data-selected", "true");

  await heroRow.getByRole("button", { name: "Duplicar sección" }).click();

  // Auto-feedback: aparece una fila nueva justo después del original y queda
  // seleccionada; el original pierde la selección.
  await expect(sections.getByRole("listitem")).toHaveCount(initialCount + 1);
  const heroIndex = 2;
  await expect(row(page, heroIndex + 1)).toHaveAttribute("data-selected", "true");
  await expect(row(page, heroIndex)).toHaveAttribute("data-selected", "false");

  // Efecto real: el preview ahora renderiza dos héroes.
  await expect(previewFrame(page).locator('[data-solara-module="catalog-hero"]')).toHaveCount(2, {
    timeout: 15_000,
  });

  // Identidad propia: editar la copia no toca el original (id distinto).
  await row(page, heroIndex + 1)
    .locator(".section-select")
    .click();
  const title = page.getByRole("textbox", { name: "Título", exact: true });
  await title.fill("Hero duplicado del barrido");
  await expect(
    previewFrame(page).locator('[data-solara-module="catalog-hero"] h1').first(),
  ).toHaveText("Vestite con lo que te representa.", { timeout: 15_000 });
  await expect(
    previewFrame(page).locator('[data-solara-module="catalog-hero"] h1').last(),
  ).toHaveText("Hero duplicado del barrido", { timeout: 15_000 });

  // Undo del edit: vuelve el valor de la copia, sin tocar el original.
  await undoButton(page).click();
  await expect(title).toHaveValue("Vestite con lo que te representa.");
  await expect(sections.getByRole("listitem")).toHaveCount(initialCount + 1);

  // Undo de la duplicación: la copia desaparece (también del preview).
  await undoButton(page).click();
  await expect(sections.getByRole("listitem")).toHaveCount(initialCount);
  await expect(previewFrame(page).locator('[data-solara-module="catalog-hero"]')).toHaveCount(1, {
    timeout: 15_000,
  });
});

test("reemplazar módulo cambia el módulo y conserva sólo los settings compatibles", async ({
  page,
}) => {
  await openBuilder(page);
  const sections = sectionsList(page);

  const brands = rowByName(page, "Franja de marcas").first();
  await brands.locator(".section-select").click();
  await expect(page.locator(".inspector header h3")).toHaveText("Franja de marcas");

  const moduleSelect = page.getByLabel("Módulo");
  await expect(moduleSelect).toHaveValue("catalog-brand-strip");
  const title = page.getByRole("textbox", { name: "Título", exact: true });
  await expect(title).toHaveValue("Marcas que nos acompañan");
  await expect(page.getByRole("spinbutton", { name: "Cantidad" })).toHaveValue("5");

  // Reemplazo a Testimonios: compatibleSettings = ["title", "items"].
  await moduleSelect.selectOption("catalog-testimonials");

  // Efecto real: la fila en la misma posición, el inspector, el select y el
  // preview se actualizan. La fila cambia de nombre, por eso se re-consulta
  // por índice (posicional, igual que el id de sección).
  await expect(rowName(page, 3)).resolves.toBe("Testimonios");
  await expect(page.locator(".inspector header h3")).toHaveText("Testimonios");
  await expect(moduleSelect).toHaveValue("catalog-testimonials");
  await expect(
    previewFrame(page).locator('[data-solara-module="catalog-testimonials"]'),
  ).toHaveCount(2, { timeout: 15_000 });

  // Contrato: "title" se conserva; "limit" (incompatible) se descarta y el
  // campo Cantidad desaparece del inspector; "items" vuelve a defaults.
  await expect(title).toHaveValue("Marcas que nos acompañan");
  await expect(page.getByRole("spinbutton", { name: "Cantidad" })).toHaveCount(0);
  await expect(page.getByRole("group", { name: "Testimonios" })).toBeVisible();

  // El id de sección y el slot no cambian: la fila mantiene su posición.
  await expect(sections.getByRole("listitem").nth(3).locator(".section-select span")).toHaveText(
    "Contenido",
  );

  // Undo restaura el módulo anterior con sus valores.
  await undoButton(page).click();
  await expect(rowName(page, 3)).resolves.toBe("Franja de marcas");
  await expect(moduleSelect).toHaveValue("catalog-brand-strip");
  await expect(title).toHaveValue("Marcas que nos acompañan");
  await expect(page.getByRole("spinbutton", { name: "Cantidad" })).toHaveValue("5");

  // Redo vuelve a aplicar el reemplazo (historial completo).
  await redoButton(page).click();
  await expect(rowName(page, 3)).resolves.toBe("Testimonios");
  await expect(moduleSelect).toHaveValue("catalog-testimonials");
});

test("mover abajo con botón reordena lista y preview y deshabilita en los límites", async ({
  page,
}) => {
  await openBuilder(page);
  const sections = sectionsList(page);
  const initialCount = await sections.getByRole("listitem").count();

  // Auto-feedback de límites: primera fila sin "arriba", última sin "abajo".
  await expect(row(page, 0).getByRole("button", { name: "Mover arriba" })).toBeDisabled();
  await expect(row(page, 0).getByRole("button", { name: "Mover abajo" })).toBeEnabled();
  await expect(
    row(page, initialCount - 1).getByRole("button", { name: "Mover abajo" }),
  ).toBeDisabled();
  await expect(
    row(page, initialCount - 1).getByRole("button", { name: "Mover arriba" }),
  ).toBeEnabled();

  const firstBefore = await rowName(page, 0);
  const secondBefore = await rowName(page, 1);
  const orderBefore = await previewModuleOrder(page);
  const indexOfFirst = orderBefore.indexOf(await previewModuleId(firstBefore));
  const indexOfSecond = orderBefore.indexOf(await previewModuleId(secondBefore));
  expect(indexOfFirst).toBeGreaterThanOrEqual(0);
  expect(indexOfSecond).toBeGreaterThanOrEqual(0);

  // Mover la primera sección hacia abajo: intercambio real en lista y preview.
  await row(page, 0).getByRole("button", { name: "Mover abajo" }).click();
  await expect(rowName(page, 0)).resolves.toBe(secondBefore);
  await expect(rowName(page, 1)).resolves.toBe(firstBefore);

  const orderAfter = await previewModuleOrder(page);
  expect(orderAfter.indexOf(await previewModuleId(secondBefore))).toBeLessThan(
    orderAfter.indexOf(await previewModuleId(firstBefore)),
  );

  // Auto-feedback: la fila movida ya no está en el borde superior.
  await expect(row(page, 1).getByRole("button", { name: "Mover arriba" })).toBeEnabled();

  // Undo/redo de la operación de movimiento.
  await undoButton(page).click();
  await expect(rowName(page, 0)).resolves.toBe(firstBefore);
  await expect(rowName(page, 1)).resolves.toBe(secondBefore);
  await redoButton(page).click();
  await expect(rowName(page, 0)).resolves.toBe(secondBefore);
  await expect(rowName(page, 1)).resolves.toBe(firstBefore);
});

test("mostrar valoración controla las reseñas de las cards, actualiza el preview y admite undo", async ({
  page,
}) => {
  await openBuilder(page);
  const grid = rowByName(page, "Grilla moderna de productos").first();
  await grid.locator(".section-select").click();

  const rating = page.getByRole("checkbox", { name: "Mostrar valoración" });
  const previewGrid = previewFrame(page)
    .locator('[data-solara-module="catalog-product-grid"]')
    .first();

  await expect(rating).not.toBeChecked();
  await expect(previewGrid.locator(".catalog-product-rating")).toHaveCount(0);

  await rating.check();
  await expect(rating).toBeChecked();
  await expect(previewGrid.locator(".catalog-product-rating").first()).toContainText(
    "4.7 / 5 · 6 reseñas",
    { timeout: 15_000 },
  );

  await rating.uncheck();
  await expect(rating).not.toBeChecked();
  await expect(previewGrid.locator(".catalog-product-rating")).toHaveCount(0, {
    timeout: 15_000,
  });

  await undoButton(page).click();
  await expect(rating).toBeChecked();
  await expect(previewGrid.locator(".catalog-product-rating").first()).toContainText(
    "4.7 / 5 · 6 reseñas",
    { timeout: 15_000 },
  );
});

/** Resuelve el id de preview esperado para el nombre visible de una fila. */
async function previewModuleId(rowLabel: string | null): Promise<string> {
  const mapping: Record<string, string> = {
    "Barra informativa moderna": "catalog-announcement",
    "Navbar de catálogo": "catalog-header",
    "Hero de catálogo": "catalog-hero",
    "Franja de marcas": "catalog-brand-strip",
    "Grilla moderna de productos": "catalog-product-grid",
    "Mosaico de categorías": "catalog-category-bento",
    Testimonios: "catalog-testimonials",
    "CTA de novedades": "catalog-newsletter-cta",
    "Carrito moderno": "catalog-cart-drawer",
    "Footer de catálogo": "catalog-footer",
  };
  return mapping[rowLabel ?? ""] ?? "";
}

test("mover con teclado respeta el orden y no sale de los límites", async ({ page }) => {
  await openBuilder(page);
  const sections = sectionsList(page);

  const firstBefore = await rowName(page, 0);
  const secondBefore = await rowName(page, 1);

  // ArrowUp en el borde superior: sin efecto (no reordena, no rompe).
  await row(page, 0).locator(".section-select").focus();
  await page.keyboard.press("ArrowUp");
  await expect(rowName(page, 0)).resolves.toBe(firstBefore);

  // ArrowUp sobre la segunda fila la sube una posición.
  await row(page, 1).locator(".section-select").focus();
  await page.keyboard.press("ArrowUp");
  await expect(rowName(page, 0)).resolves.toBe(secondBefore);
  await expect(rowName(page, 1)).resolves.toBe(firstBefore);

  // ArrowDown en el borde inferior: sin efecto.
  const lastIndex = (await sections.getByRole("listitem").count()) - 1;
  const lastBefore = await rowName(page, lastIndex);
  await row(page, lastIndex).locator(".section-select").focus();
  await page.keyboard.press("ArrowDown");
  await expect(rowName(page, lastIndex)).resolves.toBe(lastBefore);
});

test("eliminar quita la sección del proyecto y del preview, salta la selección y undo la restaura", async ({
  page,
}) => {
  await openBuilder(page);
  const sections = sectionsList(page);
  const initialCount = await sections.getByRole("listitem").count();

  // Preparar contenido propio para verificar que undo restaura el snapshot.
  await selectHero(page);
  const title = page.getByRole("textbox", { name: "Título", exact: true });
  await title.fill("Hero que voy a borrar");
  await expect(previewFrame(page).locator('[data-solara-module="catalog-hero"] h1')).toHaveText(
    "Hero que voy a borrar",
    { timeout: 15_000 },
  );

  // Eliminar la sección seleccionada.
  await rowByName(page, "Hero de catálogo")
    .first()
    .getByRole("button", { name: "Eliminar sección" })
    .click();

  // Efecto real: fuera de la lista y del preview.
  await expect(sections.getByRole("listitem")).toHaveCount(initialCount - 1);
  await expect(previewFrame(page).locator('[data-solara-module="catalog-hero"]')).toHaveCount(0, {
    timeout: 15_000,
  });

  // Auto-feedback: la selección salta a la primera sección restante y el
  // inspector muestra ese módulo.
  await expect(row(page, 0)).toHaveAttribute("data-selected", "true");
  await expect(page.locator(".inspector header h3")).toHaveText("Barra informativa moderna");

  // Undo: la sección vuelve con su contenido editado (snapshot del historial).
  await undoButton(page).click();
  await expect(sections.getByRole("listitem")).toHaveCount(initialCount);
  await selectHero(page);
  await expect(title).toHaveValue("Hero que voy a borrar");
  await expect(previewFrame(page).locator('[data-solara-module="catalog-hero"] h1')).toHaveText(
    "Hero que voy a borrar",
    { timeout: 15_000 },
  );

  // Redo: se elimina de nuevo.
  await redoButton(page).click();
  await expect(sections.getByRole("listitem")).toHaveCount(initialCount - 1);
});

test("eliminar la última sección muestra el estado vacío y undo la devuelve", async ({ page }) => {
  await openBuilder(page);
  await page.getByLabel("Página de edición").selectOption("about");
  await expect(sectionsList(page).getByRole("listitem")).toHaveCount(0);

  // Alta en la página secundaria para dejar una única sección (setup).
  await page.getByRole("button", { name: "Agregar sección" }).click();
  await page
    .getByTestId("ui-module-picker")
    .getByRole("button", { name: /Testimonios/ })
    .click();
  await expect(sectionsList(page).getByRole("listitem")).toHaveCount(1);

  // Eliminar la última: estado vacío con invitación a seleccionar.
  await row(page, 0).getByRole("button", { name: "Eliminar sección" }).click();
  await expect(sectionsList(page).getByRole("listitem")).toHaveCount(0);
  await expect(page.getByText("Seleccioná una sección", { exact: true })).toBeVisible();

  // Undo la devuelve y la selección apunta a ella.
  await undoButton(page).click();
  await expect(sectionsList(page).getByRole("listitem")).toHaveCount(1);
  await expect(row(page, 0)).toHaveAttribute("data-selected", "true");
});

test("guardar un valor válido del inspector aplica al preview y persiste tras recarga", async ({
  page,
}) => {
  await openBuilder(page);
  await selectHero(page);

  const title = page.getByRole("textbox", { name: "Título", exact: true });
  await title.fill("Título persistente del barrido A11");
  await expect(page.getByText("Cambios pendientes", { exact: true })).toBeVisible();
  await expect(previewFrame(page).locator('[data-solara-module="catalog-hero"] h1')).toHaveText(
    "Título persistente del barrido A11",
    { timeout: 15_000 },
  );

  // El historial registra la edición (payload validado → snapshot).
  await expect(undoButton(page)).toBeEnabled();

  // El autosave persiste el valor: esperar el guardado y reabrir.
  await expect(page.getByText(/^Guardado/)).toBeVisible({ timeout: 15_000 });
  await page.reload();
  await reopenBuilder(page);
  await selectHero(page);
  await expect(page.getByRole("textbox", { name: "Título", exact: true })).toHaveValue(
    "Título persistente del barrido A11",
  );
});

test("un valor inválido del inspector NO entra al historial ni al preview", async ({ page }) => {
  await openBuilder(page);
  await selectHero(page);
  await expect(undoButton(page)).toBeDisabled();
  await expect(redoButton(page)).toBeDisabled();

  const interval = page.getByRole("spinbutton", { name: "Intervalo" });
  await interval.fill("100");

  // Auto-feedback de error: el borrador marca el campo y el panel de errores.
  await expect(page.getByTestId("ui-schema-errors")).toBeVisible();
  await expect(page.getByTestId("ui-schema-errors")).toContainText("intervalMs");

  // Efecto real: el preview sigue con el valor confirmado (6000).
  await expect(previewFrame(page).locator(".catalog-hero-inner")).toHaveAttribute(
    "data-interval",
    "6000",
    { timeout: 15_000 },
  );

  // Contrato de datos: sin commit, no hay autosave ni entrada en el historial.
  await expect(page.getByText("Cambios pendientes", { exact: true })).toHaveCount(0);
  await expect(undoButton(page)).toBeDisabled();
  await expect(redoButton(page)).toBeDisabled();

  // Corregir el valor vuelve a aplicar y habilita el historial.
  await interval.fill("6000");
  await expect(page.getByTestId("ui-schema-errors")).toHaveCount(0);
  await expect(undoButton(page)).toBeEnabled();
});

test("ocultar/mostrar sección cambia el ícono, el label y el preview", async ({ page }) => {
  await openBuilder(page);
  const heroRow = rowByName(page, "Hero de catálogo").first();
  await heroRow.locator(".section-select").click();

  await heroRow.getByRole("button", { name: "Ocultar sección" }).click();

  // Auto-feedback: el control pasa a "Mostrar sección" (estado invertido).
  await expect(heroRow.getByRole("button", { name: "Mostrar sección" })).toBeVisible();
  // Efecto real: el preview deja de renderizar el módulo.
  await expect(previewFrame(page).locator('[data-solara-module="catalog-hero"]')).toHaveCount(0, {
    timeout: 15_000,
  });

  // Volver a mostrarla restaura el preview.
  await heroRow.getByRole("button", { name: "Mostrar sección" }).click();
  await expect(heroRow.getByRole("button", { name: "Ocultar sección" })).toBeVisible();
  await expect(previewFrame(page).locator('[data-solara-module="catalog-hero"]')).toHaveCount(1, {
    timeout: 15_000,
  });
});

test("cada operación de sección entra al historial con feedback en Deshacer/Rehacer", async ({
  page,
}) => {
  await openBuilder(page);
  const sections = sectionsList(page);
  const initialCount = await sections.getByRole("listitem").count();
  await expect(undoButton(page)).toBeDisabled();
  await expect(redoButton(page)).toBeDisabled();

  // Duplicar → Deshacer habilitado, Rehacer no.
  await row(page, 0).getByRole("button", { name: "Duplicar sección" }).click();
  await expect(sections.getByRole("listitem")).toHaveCount(initialCount + 1);
  await expect(undoButton(page)).toBeEnabled();
  await expect(redoButton(page)).toBeDisabled();

  // Mover → nueva entrada.
  await row(page, 1).getByRole("button", { name: "Mover abajo" }).click();
  await expect(undoButton(page)).toBeEnabled();

  // Undo del movimiento: Rehacer se habilita, Deshacer sigue activo.
  await undoButton(page).click();
  await expect(redoButton(page)).toBeEnabled();
  await expect(undoButton(page)).toBeEnabled();

  // Undo de la duplicación: volvimos al inicio → Deshacer vuelve a apagarse.
  await undoButton(page).click();
  await expect(sections.getByRole("listitem")).toHaveCount(initialCount);
  await expect(undoButton(page)).toBeDisabled();
  await expect(redoButton(page)).toBeEnabled();

  // Redo de la duplicación: Deshacer se reactiva y la copia reaparece.
  await redoButton(page).click();
  await expect(sections.getByRole("listitem")).toHaveCount(initialCount + 1);
  await expect(undoButton(page)).toBeEnabled();

  // Eliminar la copia y rehacer la edición de settings entran al historial.
  await row(page, 1).getByRole("button", { name: "Eliminar sección" }).click();
  await expect(sections.getByRole("listitem")).toHaveCount(initialCount);
  await selectHero(page);
  const title = page.getByRole("textbox", { name: "Título", exact: true });
  await title.fill("Título en el ciclo de historial");
  await expect(undoButton(page)).toBeEnabled();

  // Rehacer todas las operaciones deshechas restaura el estado final completo.
  await undoButton(page).click();
  await expect(title).toHaveValue("Vestite con lo que te representa.");
  await redoButton(page).click();
  await expect(title).toHaveValue("Título en el ciclo de historial");
  await expect(undoButton(page)).toBeEnabled();
});
