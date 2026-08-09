import type { Server } from "node:http";
import { expect, type Page, test } from "@playwright/test";
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

async function openDashboard(page: Page): Promise<void> {
  await page.goto(studioUrl);
  await expect(page.getByRole("heading", { name: "Tus tiendas" })).toBeVisible({
    timeout: 20_000,
  });
}

async function openDefaultStore(page: Page): Promise<void> {
  await openDashboard(page);
  const card = page.locator(".dashboard-store-card").filter({
    has: page.getByText("Predeterminado", { exact: true }),
  });
  await expect(card).toBeVisible();
  await card.getByRole("button", { name: "Abrir esta tienda" }).click();
  await expect(page.getByRole("navigation", { name: "Áreas de la tienda" })).toBeVisible();
}

async function expectFocusVisible(
  page: Page,
  locator: import("@playwright/test").Locator,
): Promise<void> {
  await locator.focus();
  await expect(locator).toBeFocused();
  await page.keyboard.press("Tab");
  await page.keyboard.press("Shift+Tab");
  await expect(locator).toBeFocused();
  await expect
    .poll(() =>
      locator.evaluate((element) => {
        const style = getComputedStyle(element);
        return style.outlineStyle !== "none" && Number.parseFloat(style.outlineWidth) > 0;
      }),
    )
    .toBe(true);
}

/** Opacidad de la burbuja ::after del tooltip (1 con hover/foco). */
async function tooltipBubbleOpacity(wrapper: import("@playwright/test").Locator): Promise<string> {
  return wrapper.evaluate((element) => getComputedStyle(element, "::after").opacity);
}

/**
 * Caja real de la burbuja ::after. Los pseudoelementos no tienen rect
 * consultable; se reproduce su geometría con los valores usados de
 * getComputedStyle (offsets, width/height y transform en px) en un elemento
 * real dentro del mismo contenedor, y se mide su getBoundingClientRect.
 */
async function tooltipBubbleRect(
  wrapper: import("@playwright/test").Locator,
): Promise<{ x: number; y: number; width: number; height: number }> {
  return wrapper.evaluate((element) => {
    const style = getComputedStyle(element, "::after");
    const clone = document.createElement("span");
    clone.textContent = element.getAttribute("data-tip") ?? "";
    clone.style.cssText = [
      "position: absolute",
      `top: ${style.top}`,
      `left: ${style.left}`,
      `right: ${style.right}`,
      `bottom: ${style.bottom}`,
      `width: ${style.width}`,
      `height: ${style.height}`,
      "margin: 0",
      `padding: ${style.padding}`,
      "border: 0",
      `transform: ${style.transform}`,
      `transform-origin: ${style.transformOrigin}`,
      `box-sizing: ${style.boxSizing}`,
      "pointer-events: none",
    ].join(";");
    element.appendChild(clone);
    const rect = clone.getBoundingClientRect();
    clone.remove();
    return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
  });
}

test("el skip-link del dashboard es el primer control y salta al contenido", async ({ page }) => {
  await openDashboard(page);

  const skip = page.getByRole("link", { name: "Saltar al contenido" });
  await expect(skip).toBeVisible();
  const firstFocusableHref = await page.evaluate(() => {
    const focusables = [
      ...document.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])',
      ),
    ].filter((element) => {
      const style = getComputedStyle(element);
      return style.display !== "none" && style.visibility !== "hidden";
    });
    return focusables[0]?.getAttribute("href") ?? null;
  });
  expect(firstFocusableHref, "el skip-link debe ser el primer elemento enfocable").toBe("#tiendas");

  await skip.focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("main#tiendas")).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "Nueva tienda", exact: true })).toBeFocused();
});

test("el orden de tabulación llega de las tarjetas al panel de detalle", async ({ page }) => {
  await openDashboard(page);
  const cards = page.locator(".dashboard-store-card");
  await expect(cards.first()).toBeVisible();
  const lastOpen = cards.last().getByRole("button", { name: "Abrir esta tienda" });
  await lastOpen.focus();
  await page.keyboard.press("Tab");
  await expect(page.locator(".dashboard-store-detail")).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(
    page.locator(".dashboard-store-detail").getByRole("button", { name: "Cerrar detalle" }),
  ).toBeFocused();
});

test("el skip-link del Studio llega al panel de edición", async ({ page }) => {
  await openDefaultStore(page);
  await page.getByRole("tab", { name: "Resumen", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Resumen" })).toBeVisible();

  const skip = page.getByRole("link", { name: "Saltar al panel de edición" });
  await skip.focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("[data-studio-editor-pane]")).toBeFocused();
});

test("los tabs del Studio usan tablist/tab/tabpanel con aria-selected", async ({ page }) => {
  await openDefaultStore(page);

  await expect(page.getByRole("navigation", { name: "Áreas de la tienda" })).toBeVisible();
  const tablist = page.getByRole("tablist", { name: "Áreas de la tienda" });
  await expect(tablist).toBeVisible();
  await expect(tablist).toHaveAttribute("aria-orientation", "vertical");

  const preparar = page.getByRole("tab", { name: "Preparar", exact: true });
  const resumen = page.getByRole("tab", { name: "Resumen", exact: true });
  await expect(preparar).toHaveAttribute("aria-selected", "true");
  await expect(resumen).toHaveAttribute("aria-selected", "false");

  const panel = page.getByRole("tabpanel");
  await resumen.click();
  await expect(resumen).toHaveAttribute("aria-selected", "true");
  await expect(preparar).toHaveAttribute("aria-selected", "false");
  await expect(page.getByRole("heading", { name: "Resumen" })).toBeVisible();
  await expect(panel).toHaveAttribute("aria-labelledby", (await resumen.getAttribute("id")) ?? "");
});

test("el teclado mueve y activa los tabs con flechas y Enter/Espacio", async ({ page }) => {
  await openDefaultStore(page);

  const preparar = page.getByRole("tab", { name: "Preparar", exact: true });
  const resumen = page.getByRole("tab", { name: "Resumen", exact: true });
  const catalogo = page.getByRole("tab", { name: "Catálogo", exact: true });

  await preparar.focus();
  await page.keyboard.press("ArrowDown");
  await expect(resumen).toBeFocused();
  await expect(resumen).toHaveAttribute("aria-selected", "true");
  await expect(preparar).toHaveAttribute("tabindex", "-1");
  await expect(resumen).toHaveAttribute("tabindex", "0");

  await page.keyboard.press("ArrowRight");
  await expect(catalogo).toBeFocused();
  await expect(catalogo).toHaveAttribute("aria-selected", "true");
  await page.keyboard.press("ArrowUp");
  await expect(resumen).toBeFocused();
  await page.keyboard.press("ArrowLeft");
  await expect(preparar).toBeFocused();

  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: "Preparar tienda" })).toBeVisible();
  await page.keyboard.press("ArrowDown");
  await expect(resumen).toBeFocused();
  await page.keyboard.press(" ");
  await expect(page.getByRole("heading", { name: "Resumen" })).toBeVisible();
});

test("el foco visible es distinguible en tarjetas y tabs", async ({ page }) => {
  await openDashboard(page);
  await expectFocusVisible(
    page,
    page
      .locator(".dashboard-store-card")
      .first()
      .getByRole("button", { name: "Abrir esta tienda" }),
  );
  await openDefaultStore(page);
  await expectFocusVisible(page, page.getByRole("tab", { name: "Preparar", exact: true }));
});

test("la búsqueda del dashboard anuncia resultados en una región aria-live", async ({ page }) => {
  await openDashboard(page);

  const count = page.locator(".dashboard-cosmic-count");
  await expect(count).toHaveAttribute("aria-live", "polite");
  await expect(count).toHaveAttribute("aria-atomic", "true");

  const search = page.getByRole("searchbox", { name: "Buscar tienda" });
  await search.fill("predeterminado");
  await expect(count).toHaveText("1 visibles");
  await search.fill("no existe");
  await expect(page.getByText("No hay coincidencias")).toBeVisible();
  await search.fill("");
  await expect(count).toHaveText("1 visibles");
});

test("los avisos globales usan aria-live y el indicador de guardado también", async ({ page }) => {
  await openDashboard(page);
  await expect(page.locator("output.global-notice")).toHaveAttribute("aria-live", "polite", {
    timeout: 15_000,
  });
  await openDefaultStore(page);
  await expect(page.locator("output.save-indicator")).toHaveAttribute("aria-live", "polite");
});

test("el diálogo de creación enfoca su campo inicial y cierra con Escape devolviendo el foco", async ({
  page,
}) => {
  await openDashboard(page);

  const create = page.getByRole("button", { name: "Nueva tienda", exact: true });
  await create.click();
  const dialog = page.getByRole("dialog", { name: "Crear tienda" });
  await expect(dialog).toBeVisible();
  await expect(page.getByLabel("Nueva tienda")).toBeFocused();

  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(create).toBeFocused();
});

test("cada control visible del dashboard y del Studio tiene nombre accesible", async ({ page }) => {
  await openDashboard(page);
  const unlabeledDashboard = await unlabeledControls(page);
  expect(unlabeledDashboard, "controles del dashboard sin nombre accesible").toEqual([]);

  await openDefaultStore(page);
  const unlabeledStudio = await unlabeledControls(page);
  expect(unlabeledStudio, "controles del Studio sin nombre accesible").toEqual([]);
});

async function unlabeledControls(page: Page): Promise<string[]> {
  return page
    .locator("button, a, input, select, textarea, [role='tab'], [role='tablist']")
    .evaluateAll((elements) =>
      elements
        .filter((element) => {
          const style = getComputedStyle(element);
          return style.display !== "none" && style.visibility !== "hidden";
        })
        .filter((element) => {
          const labelledBy =
            element
              .getAttribute("aria-labelledby")
              ?.split(/\s+/)
              .map((id) => document.getElementById(id)?.textContent?.trim())
              .filter(Boolean)
              .join(" ") || undefined;
          const explicitLabel =
            (element.id
              ? document
                  .querySelector(`label[for="${CSS.escape(element.id)}"]`)
                  ?.textContent?.trim()
              : "") || undefined;
          const label =
            element.getAttribute("aria-label") ??
            labelledBy ??
            explicitLabel ??
            element.getAttribute("title") ??
            element.textContent?.trim() ??
            (element as HTMLInputElement).placeholder ??
            (element as HTMLInputElement).value;
          return !label;
        })
        .map((element) => element.outerHTML.slice(0, 160)),
    );
}

test("el ConfirmDialog de eliminar enlace enfoca, atrapa el foco, cancela con Escape y devuelve el foco (T6.4)", async ({
  page,
}) => {
  await openDefaultStore(page);
  await page.getByRole("tab", { name: "Resumen", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Resumen" })).toBeVisible();

  const deleteLink = page.getByRole("button", { name: /^Eliminar enlace / }).first();
  // El primer enlace eliminado puede no ser el primero de la lista; se recuerda
  // su nombre accesible para verificar que ese enlace desapareció.
  const deletedLabel = (await deleteLink.getAttribute("aria-label")) ?? "";
  await deleteLink.click();

  const dialog = page.getByRole("dialog", { name: "Eliminar enlace de navegación" });
  await expect(dialog).toBeVisible();
  await expect(dialog).toHaveAttribute("data-testid", "ui-confirm-dialog");

  const cancel = dialog.getByRole("button", { name: "Cancelar" });
  const confirm = dialog.getByRole("button", { name: "Eliminar enlace" });
  await expect(cancel, "en un diálogo peligroso el foco inicial va a Cancelar").toBeFocused();

  for (let tab = 0; tab < 8; tab += 1) await page.keyboard.press("Tab");
  await expect
    .poll(
      () =>
        page.evaluate(
          () =>
            document
              .querySelector("[data-testid='ui-confirm-dialog']")
              ?.contains(document.activeElement) ?? false,
        ),
      { message: "el foco no escapa del diálogo de confirmación" },
    )
    .toBe(true);

  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(deleteLink, "Escape devuelve el foco al botón que abrió el diálogo").toBeFocused();

  await deleteLink.click();
  await expect(dialog).toBeVisible();
  await page.keyboard.press("Tab");
  await expect(confirm).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(dialog).toBeHidden();
  await expect(page.getByTestId("ui-toast")).toContainText("Enlace de navegación eliminado");
  await expect(page.getByRole("button", { name: deletedLabel })).not.toBeVisible();

  await page.getByRole("button", { name: "Deshacer" }).click();
  await expect(page.getByRole("button", { name: deletedLabel })).toBeVisible();
});

test("el tooltip top de un IconButton aparece sobre el botón con fallback de título (A13)", async ({
  page,
}) => {
  await openDefaultStore(page);
  await page.getByRole("tab", { name: "Resumen", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Resumen" })).toBeVisible();

  // IconButton con `tooltip` (Overview.tsx) usa la variante top por defecto.
  const deleteLink = page.getByRole("button", { name: /^Eliminar enlace / }).first();
  const wrapper = deleteLink.locator("xpath=..");
  await expect(wrapper).toHaveClass(/ui-tooltip--top/);
  await expect(wrapper).toHaveAttribute("title", "Eliminar enlace");

  await deleteLink.hover();
  await expect
    .poll(() => tooltipBubbleOpacity(wrapper), "la burbuja debe hacerse visible")
    .toBe("1");

  const buttonBox = (await deleteLink.boundingBox()) ?? { x: 0, y: 0, width: 0, height: 0 };
  expect(buttonBox, "el botón debe tener caja medible").not.toEqual({
    x: 0,
    y: 0,
    width: 0,
    height: 0,
  });
  const bubble = await tooltipBubbleRect(wrapper);
  const gapAbove = buttonBox.y - (bubble.y + bubble.height);
  expect(gapAbove, "la burbuja top queda completamente sobre el botón").toBeGreaterThanOrEqual(0);
  expect(gapAbove, "la burbuja top queda pegada al botón (hueco de 7px)").toBeLessThanOrEqual(20);
  expect(
    bubble.x + bubble.width > buttonBox.x && bubble.x < buttonBox.x + buttonBox.width,
    "la burbuja top comparte el eje horizontal con el botón",
  ).toBe(true);
});

test("el tooltip bottom del toggle de tema aparece bajo el control con fallback de título (A13)", async ({
  page,
}) => {
  await openDefaultStore(page);

  const toggle = page.getByTestId("ui-theme-toggle");
  const wrapper = toggle.locator("xpath=..");
  await expect(wrapper).toHaveClass(/ui-tooltip--bottom/);
  await expect(wrapper).toHaveAttribute("title", /^Usar tema (claro|oscuro)$/);

  await toggle.hover();
  await expect
    .poll(() => tooltipBubbleOpacity(wrapper), "la burbuja debe hacerse visible")
    .toBe("1");

  const buttonBox = (await toggle.boundingBox()) ?? { x: 0, y: 0, width: 0, height: 0 };
  expect(buttonBox, "el toggle debe tener caja medible").not.toEqual({
    x: 0,
    y: 0,
    width: 0,
    height: 0,
  });
  const bubble = await tooltipBubbleRect(wrapper);
  const gapBelow = bubble.y - (buttonBox.y + buttonBox.height);
  expect(gapBelow, "la burbuja bottom queda bajo el control").toBeGreaterThanOrEqual(0);
  expect(gapBelow, "la burbuja bottom queda pegada al control (hueco de 7px)").toBeLessThanOrEqual(
    20,
  );
  expect(
    bubble.x + bubble.width > buttonBox.x && bubble.x < buttonBox.x + buttonBox.width,
    "la burbuja bottom comparte el eje horizontal con el control",
  ).toBe(true);
});
