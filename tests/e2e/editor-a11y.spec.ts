import { type ChildProcess, spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import type { Server } from "node:http";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { type Browser, expect, type Page, test } from "@playwright/test";
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
  await expect(resumen).toHaveAttribute("aria-controls", (await panel.getAttribute("id")) ?? "");
  await expect(preparar).not.toHaveAttribute("aria-controls");
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

test("las referencias aria-controls del panel izquierdo siempre tienen destino", async ({
  page,
}) => {
  await openDefaultStore(page);

  for (const tabName of [
    "Preparar",
    "Resumen",
    "Catálogo",
    "Constructor",
    "Tema",
    "Recursos",
    "SEO",
    "Exportar",
  ]) {
    const tab = page.getByRole("tab", { name: tabName, exact: true });
    await tab.click();
    await expect(tab).toHaveAttribute("aria-selected", "true");

    const danglingControls = await page.locator("[aria-controls]").evaluateAll((elements) =>
      elements.flatMap((element) => {
        const controls = element.getAttribute("aria-controls")?.trim().split(/\s+/) ?? [];
        const missing = controls.filter((id) => !document.getElementById(id));
        return missing.length > 0
          ? [
              `${element.tagName.toLowerCase()}[aria-label="${element.getAttribute("aria-label") ?? ""}"] -> ${missing.join(",")}`,
            ]
          : [];
      }),
    );

    expect(danglingControls, `${tabName}: aria-controls sin destino`).toEqual([]);
  }
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

test("los controles repetidos conservan contexto accesible por superficie", async ({ page }) => {
  await openDashboard(page);

  const distinctDescriptions = async (locator: import("@playwright/test").Locator) => {
    const values = await locator.evaluateAll((elements) =>
      elements.map((element) => element.getAttribute("aria-description") ?? ""),
    );
    expect(values.every(Boolean)).toBe(true);
    expect(new Set(values).size).toBe(values.length);
  };

  await distinctDescriptions(page.getByTestId("ui-card-pin"));
  await distinctDescriptions(page.getByTestId("ui-card-open"));

  await openDefaultStore(page);
  await page.getByRole("tab", { name: "Resumen", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Resumen", exact: true })).toBeVisible();
  await distinctDescriptions(page.getByLabel("Destino", { exact: true }));
  await distinctDescriptions(page.getByLabel("Subenlace 1", { exact: true }));
  await distinctDescriptions(page.getByLabel("Título visible", { exact: true }));
  await distinctDescriptions(page.getByLabel("Título SEO", { exact: true }));
  await distinctDescriptions(page.getByLabel("Descripción SEO", { exact: true }));

  await page.getByRole("tab", { name: "Recursos", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Recursos", exact: true })).toBeVisible();
  await distinctDescriptions(page.getByLabel("Nombre", { exact: true }));
  await distinctDescriptions(page.getByLabel("Texto alternativo", { exact: true }));

  await page.getByRole("tab", { name: "Constructor", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Constructor", exact: true })).toBeVisible();
  const sectionSelects = page.locator(".section-select");
  await expect(sectionSelects).not.toHaveCount(0);
  await distinctDescriptions(sectionSelects);
  const sectionActionDescriptions = await page
    .locator(".section-row-actions [data-testid='ui-icon-button']")
    .evaluateAll((elements) => elements.map((element) => element.getAttribute("aria-description")));
  expect(sectionActionDescriptions.every(Boolean)).toBe(true);

  await page.getByRole("tab", { name: "SEO", exact: true }).click();
  await expect(page.getByRole("heading", { name: "SEO y Google", exact: true })).toBeVisible();
  const checklistToggles = page.getByTestId("ui-seo-check-toggle");
  await expect(checklistToggles).not.toHaveCount(0);
  const labels = await checklistToggles.evaluateAll((elements) =>
    elements.map((element) => element.getAttribute("aria-label") ?? ""),
  );
  expect(labels.every((label) => label.includes(":"))).toBe(true);
  expect(new Set(labels).size).toBe(labels.length);
});

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

test("el tooltip top de un IconButton aparece sobre el botón con descripción accesible (A13)", async ({
  page,
}) => {
  await openDefaultStore(page);
  await page.getByRole("tab", { name: "Resumen", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Resumen" })).toBeVisible();

  // IconButton con `tooltip` (Overview.tsx) usa la variante top por defecto.
  const deleteLink = page.getByRole("button", { name: /^Eliminar enlace / }).first();
  const wrapper = deleteLink.locator("xpath=..");
  await expect(wrapper).toHaveClass(/ui-tooltip--top/);
  await expect(wrapper).toHaveAttribute("data-tip", "Eliminar enlace");
  const description = wrapper.locator('[role="tooltip"]');
  await expect(description).toHaveText("Eliminar enlace");
  await expect(deleteLink).toHaveAttribute(
    "aria-describedby",
    await description.getAttribute("id"),
  );
  await expect(wrapper).not.toHaveAttribute("title");
  await expect(deleteLink).not.toHaveAttribute("title");

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

test("el tooltip bottom del toggle de tema aparece bajo el control con descripción accesible (A13)", async ({
  page,
}) => {
  await openDefaultStore(page);

  const toggle = page.getByTestId("ui-theme-toggle");
  const wrapper = toggle.locator("xpath=..");
  await expect(wrapper).toHaveClass(/ui-tooltip--bottom/);
  await expect(wrapper).toHaveAttribute("data-tip", /^Usar tema (claro|oscuro)$/);
  const description = wrapper.locator('[role="tooltip"]');
  await expect(description).toHaveText(/^Usar tema (claro|oscuro)$/);
  await expect(toggle).toHaveAttribute("aria-describedby", await description.getAttribute("id"));
  await expect(wrapper).not.toHaveAttribute("title");
  await expect(toggle).not.toHaveAttribute("title");

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
  const gapBelow = bubble.y - (buttonBox.y + bubble.height);
  expect(gapBelow, "la burbuja bottom queda bajo el control").toBeGreaterThanOrEqual(0);
  expect(gapBelow, "la burbuja bottom queda pegada al control (hueco de 7px)").toBeLessThanOrEqual(
    20,
  );
  expect(
    bubble.x + bubble.width > buttonBox.x && bubble.x < buttonBox.x + buttonBox.width,
    "la burbuja bottom comparte el eje horizontal con el control",
  ).toBe(true);
});

/** Abre el Constructor de la tienda demo (mismo arranque que editor-builder.spec.ts). */
async function openBuilderForPicker(page: Page): Promise<void> {
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

test("el selector de módulos es modal, enfoca la búsqueda y atrapa el foco (ST-B8)", async ({
  page,
}) => {
  await openBuilderForPicker(page);
  const addButton = page.getByRole("button", { name: "Agregar sección" });
  await page.getByLabel("Tipo de sección").selectOption("content");
  await addButton.click();

  const picker = page.getByTestId("ui-module-picker");
  await expect(picker).toBeVisible();
  await expect(picker).toHaveAttribute("aria-modal", "true");
  await expect(addButton).toHaveAttribute("aria-haspopup", "dialog");
  const pickerId = await picker.getAttribute("id");
  expect(pickerId).toBeTruthy();
  await expect(addButton).toHaveAttribute("aria-controls", pickerId ?? "");
  await expect(picker.getByLabel("Buscar módulo")).toBeFocused();

  for (let tab = 0; tab < 25; tab += 1) await page.keyboard.press("Tab");
  await expect
    .poll(
      () =>
        page.evaluate(
          () =>
            document
              .querySelector("[data-testid='ui-module-picker']")
              ?.contains(document.activeElement) ?? false,
        ),
      { message: "el foco no escapa del selector de módulos" },
    )
    .toBe(true);

  await page.keyboard.press("Escape");
  await expect(picker).toBeHidden();
  await expect(addButton).toBeFocused();
});

test("vaciar un campo numérico del inspector no commitea 0 y muestra el error de esquema (ST-B12)", async ({
  page,
}) => {
  await openBuilderForPicker(page);
  const hero = page.getByRole("listitem").filter({ hasText: "Hero de catálogo" });
  await hero.getByRole("button").first().click();

  const interval = page.getByRole("spinbutton", { name: "Intervalo" });
  await expect(interval).toHaveValue("6000");
  await interval.fill("");
  await expect(interval).toHaveValue("");
  await expect(page.getByTestId("ui-schema-errors")).toContainText("intervalMs");
  await expect(page.getByText("Cambios pendientes", { exact: true })).toHaveCount(0);
});

test("vaciar un número en un repeater no commitea 0 y muestra el error de esquema (ST-B12)", async ({
  page,
}) => {
  await openBuilderForPicker(page);
  await page.getByLabel("Tipo de sección").selectOption("content");
  await page.getByRole("button", { name: "Agregar sección" }).click();
  const picker = page.getByTestId("ui-module-picker");
  await picker.getByLabel("Buscar módulo").fill("testimonios");
  await picker.getByRole("button", { name: /Testimonios/ }).click();
  await expect(picker).toBeHidden();

  await page.getByRole("button", { name: "Agregar elemento" }).click();
  const rating = page.getByRole("spinbutton", { name: "Valoración" });
  await expect(rating).toHaveValue("1");
  await rating.fill("");
  await expect(rating).toHaveValue("");
  await expect(page.getByTestId("ui-schema-errors")).toContainText("items");
  await expect(page.getByText("Cambios pendientes", { exact: true })).toHaveCount(0);
});

test("un cambio inválido en SEO anuncia el error de validación sin servidor (ST-B3)", async ({
  page,
}) => {
  await openDefaultStore(page);
  await page.getByRole("tab", { name: "SEO", exact: true }).click();
  const title = page.getByRole("textbox", { name: "Título SEO" });
  await expect(title).toBeVisible();
  await title.fill("");
  await title.blur();
  await expect(page.getByTestId("ui-inline-error")).toBeVisible();
  await expect(page.getByTestId("ui-inline-error")).toContainText("seo.title");
  await expect(page.getByTestId("ui-status-bar")).toBeVisible();
});

async function waitForServer(url: string): Promise<void> {
  await expect
    .poll(
      async () => {
        try {
          return (await fetch(`${url}/__solara/session`)).status;
        } catch {
          return 0;
        }
      },
      { timeout: 10_000, intervals: [100, 250, 500] },
    )
    .toBe(200);
}

interface ManagedServer {
  url: string;
  root: string;
  process: ChildProcess;
}

async function startManagedServer(): Promise<ManagedServer> {
  const applicationRoot = mkdtempSync(join(tmpdir(), "solara-a11y-managed-"));
  const port = 4900 + Math.floor(Math.random() * 200);
  const token = randomBytes(24).toString("base64url");
  const url = `http://127.0.0.1:${port}`;
  const serverProcess: ChildProcess = spawn(
    process.execPath,
    [
      resolve("packages/exporter/scripts/serve.mjs"),
      resolve("apps/studio/dist"),
      String(port),
      token,
      applicationRoot,
    ],
    { cwd: resolve("."), stdio: "ignore" },
  );
  try {
    await waitForServer(url);
  } catch (reason) {
    serverProcess.kill();
    rmSync(applicationRoot, { recursive: true, force: true });
    throw reason;
  }
  return { url, root: applicationRoot, process: serverProcess };
}

async function stopManagedServer(managed: ManagedServer): Promise<void> {
  if (managed.process.exitCode === null) managed.process.kill();
  rmSync(managed.root, { recursive: true, force: true });
}

async function openDemoStoreManaged(page: Page): Promise<void> {
  await page
    .locator('article:has([data-store-card-id="store-modo-sur-demo"])')
    .getByRole("button", { name: "Abrir esta tienda" })
    .click();
  await page.getByRole("tab", { name: "Resumen" }).click();
  await expect(page.getByLabel("Nombre de la tienda")).toBeVisible();
}

async function renameAndSave(page: Page, name: string): Promise<void> {
  await page.getByLabel("Nombre de la tienda").fill(name);
  await page.locator("[data-studio-save]").click();
  await expect(page.locator(".save-indicator")).toContainText("Guardado", { timeout: 60_000 });
}

async function openSecondTab(browser: Browser, url: string): Promise<Page> {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(url);
  await expect(page.getByRole("heading", { name: "Tus tiendas" })).toBeVisible({
    timeout: 30_000,
  });
  return page;
}

async function createConflict(
  browser: Browser,
  url: string,
  first: string,
  second: string,
): Promise<{ pageA: Page; pageB: Page }> {
  const contextA = await browser.newContext();
  const pageA = await contextA.newPage();
  await pageA.goto(url);
  await expect(pageA.getByRole("heading", { name: "Tus tiendas" })).toBeVisible({
    timeout: 30_000,
  });
  await openDemoStoreManaged(pageA);
  await renameAndSave(pageA, first);

  const pageB = await openSecondTab(browser, url);
  await openDemoStoreManaged(pageB);
  await renameAndSave(pageB, second);

  await pageA.getByLabel("Nombre de la tienda").fill(`${first} (borrador local)`);
  await pageA.locator("[data-studio-save]").click();
  await expect(pageA.getByTestId("ui-conflict-dialog")).toBeVisible({ timeout: 60_000 });
  return { pageA, pageB };
}

test("el diálogo 409 cierra con Escape conservando el borrador y el fondo es inert (ST-B9)", async ({
  browser,
}) => {
  test.setTimeout(180_000);
  const managed = await startManagedServer();
  try {
    const { pageA } = await createConflict(browser, managed.url, "A11y A", "A11y B");
    const dialog = pageA.getByTestId("ui-conflict-dialog");
    await expect(dialog).toBeVisible({ timeout: 60_000 });
    let commitAttemptsAfterConflict = 0;
    pageA.on("request", (request) => {
      if (request.url().includes("/__solara/storage/saves/") && request.url().endsWith("/commit")) {
        commitAttemptsAfterConflict += 1;
      }
    });
    await pageA.keyboard.press("Control+S");
    await pageA.waitForTimeout(350);
    expect(commitAttemptsAfterConflict, "Ctrl+S no debe reintentar un conflicto visible").toBe(0);
    await expect(pageA.locator(".studio-shell")).toHaveAttribute("inert", "");

    await pageA.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(pageA.getByTestId("ui-studio-notice")).toContainText("Borrador conservado");
    await expect(pageA.locator("[data-studio-save]")).toBeFocused();
    await expect(pageA.locator(".studio-shell")).not.toHaveAttribute("inert", "");
  } finally {
    await stopManagedServer(managed);
  }
});

test("cerrar el picker con click fuera devuelve el foco al botón y resetea la búsqueda (F-05/F8)", async ({
  page,
}) => {
  await openBuilderForPicker(page);
  const addButton = page.getByRole("button", { name: "Agregar sección" });
  await page.getByLabel("Tipo de sección").selectOption("content");
  await addButton.click();

  const picker = page.getByTestId("ui-module-picker");
  await expect(picker).toBeVisible();
  await picker.getByLabel("Buscar módulo").fill("testimonios");

  await page.getByRole("heading", { name: "Constructor" }).click();
  await expect(picker).toBeHidden();
  await expect(addButton).toBeFocused();

  await addButton.click();
  await expect(picker).toBeVisible();
  await expect(picker.getByLabel("Buscar módulo")).toHaveValue("");
  await expect(picker.getByRole("button", { name: /Testimonios/ })).toBeVisible();
});

test("el diálogo de salida sin guardar queda fuera del foco cuando llega el 409 (F-06)", async ({
  browser,
}) => {
  test.setTimeout(180_000);
  const managed = await startManagedServer();
  try {
    const contextA = await browser.newContext();
    const pageA = await contextA.newPage();
    await pageA.goto(managed.url);
    await expect(pageA.getByRole("heading", { name: "Tus tiendas" })).toBeVisible({
      timeout: 30_000,
    });
    await openDemoStoreManaged(pageA);
    await renameAndSave(pageA, "F06 A");

    const pageB = await openSecondTab(browser, managed.url);
    await openDemoStoreManaged(pageB);
    await renameAndSave(pageB, "F06 B");

    await pageA.getByLabel("Nombre de la tienda").fill("F06 A (borrador local)");
    await pageA.route("**/__solara/storage/saves/*/commit", async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 2500));
      await route.continue();
    });

    await pageA.locator("[data-studio-save]").click();
    await pageA.getByRole("button", { name: "Volver a tiendas" }).click();

    const leaveDialog = pageA.getByTestId("ui-confirm-dialog");
    await expect(leaveDialog).toBeVisible();

    const conflictDialog = pageA.getByTestId("ui-conflict-dialog");
    await expect(conflictDialog).toBeVisible({ timeout: 60_000 });
    await expect(leaveDialog).toHaveCount(0);

    await expect(pageA.locator(".studio-shell")).toHaveAttribute("inert", "");
    await expect(conflictDialog.getByRole("button", { name: "Conservar borrador" })).toBeFocused();

    for (let tab = 0; tab < 6; tab += 1) await pageA.keyboard.press("Tab");
    await expect
      .poll(
        () =>
          pageA.evaluate(
            () =>
              document
                .querySelector("[data-testid='ui-confirm-dialog']")
                ?.contains(document.activeElement) ?? false,
          ),
        { message: "el foco no escapa del diálogo de conflicto hacia el de salida" },
      )
      .toBe(false);
  } finally {
    await stopManagedServer(managed);
  }
});
