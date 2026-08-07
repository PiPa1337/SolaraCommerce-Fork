import type { Server } from "node:http";
import { expect, type Locator, type Page, test } from "@playwright/test";
import { startStudioServer, stopStudioServer } from "./studio-server";

/**
 * T0.2 — Inventario de controles y estados del editor.
 * Verifica con getComputedStyle que los controles distinguen disabled, hover,
 * focus-visible y loading, y que el inventario `data-testid="ui-*"` mantiene
 * estilos coherentes por estado en todas las pantallas.
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

async function openStore(page: Page): Promise<void> {
  await page.goto(studioUrl);
  await expect(page.getByRole("heading", { name: "Tus tiendas" })).toBeVisible();
  const card = page.locator(".dashboard-store-card").filter({ hasText: "Predeterminado" }).first();
  await card.locator(".dashboard-store-card__button").click();
  await expect(
    page.getByRole("complementary", { name: "Tienda seleccionada: Predeterminado" }),
  ).toBeVisible();
}

async function openStudio(page: Page): Promise<void> {
  await openStore(page);
  await page
    .getByRole("complementary", { name: "Tienda seleccionada: Predeterminado" })
    .getByRole("button", { name: "Abrir tienda" })
    .click();
  await expect(page.getByRole("navigation", { name: "Áreas de la tienda" })).toBeVisible();
}

function styleOf(locator: Locator) {
  return locator.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      cursor: style.cursor,
      opacity: style.opacity,
      background: `${style.backgroundColor} ${style.backgroundImage}`,
      border: style.borderColor,
      color: style.color,
    };
  });
}

async function expectEnabledButton(button: Locator, label: string) {
  await expect(button).toBeEnabled();
  const style = await styleOf(button);
  expect(style.cursor, `${label}: cursor de habilitado`).toBe("pointer");
  expect(Number(style.opacity), `${label}: opacidad de habilitado`).toBeGreaterThan(0.9);
}

async function expectDisabledButton(button: Locator, label: string) {
  await expect(button).toBeDisabled();
  const style = await styleOf(button);
  expect(style.cursor, `${label}: cursor de deshabilitado`).toBe("not-allowed");
  expect(Number(style.opacity), `${label}: opacidad de deshabilitado`).toBeLessThan(1);
}

async function expectFocusRing(element: Locator, label: string) {
  await element.focus();
  await expect(element).toBeFocused();
  await element.page().keyboard.press("Tab");
  await element.page().keyboard.press("Shift+Tab");
  await expect(element).toBeFocused();
  const hasRing = await element.evaluate((el) => {
    const visibleRing = (node: Element) => {
      const style = getComputedStyle(node);
      const outline = style.outlineStyle !== "none" && Number.parseFloat(style.outlineWidth) > 0;
      const shadow = style.boxShadow !== "none" && style.boxShadow !== "";
      return outline || shadow;
    };
    if (visibleRing(el)) return true;
    return el.parentElement !== null && visibleRing(el.parentElement);
  });
  expect(hasRing, `${label}: anillo de focus-visible`).toBe(true);
}

function hoverSignature(locator: Locator) {
  return locator.evaluate((el) =>
    [el, el.parentElement]
      .filter((node): node is Element => node !== null)
      .map((node) => {
        const style = getComputedStyle(node);
        return `${style.backgroundColor} ${style.backgroundImage} | ${style.borderColor}`;
      })
      .join(" § "),
  );
}

async function expectHoverChange(element: Locator, label: string) {
  const before = await hoverSignature(element);
  await element.hover();
  await expect
    .poll(() => hoverSignature(element), { message: `${label}: hover distinguible` })
    .not.toBe(before);
}

test("el dashboard distingue estados en sus controles", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(studioUrl);
  await expect(page.getByRole("heading", { name: "Tus tiendas" })).toBeVisible();

  const newStore = page.getByRole("button", { name: "Nueva tienda", exact: true });
  await expectEnabledButton(newStore, "Nueva tienda");
  await expectFocusRing(newStore, "Nueva tienda");
  await expectHoverChange(newStore, "Nueva tienda");

  const search = page.getByRole("searchbox", { name: "Buscar tienda" });
  await expectFocusRing(search, "Búsqueda del dashboard");
  await expectHoverChange(search, "Búsqueda del dashboard");

  const status = page.getByRole("combobox", { name: "Estado" });
  await expectFocusRing(status, "Filtro de estado");
  const sort = page.getByRole("combobox", { name: "Ordenar" });
  await expectFocusRing(sort, "Orden");

  const gridView = page.getByRole("button", { name: "Vista en grilla" });
  await expectHoverChange(gridView, "Vista en grilla");
  await expect(gridView).toHaveAttribute("aria-pressed", "true");

  const cardButton = page
    .locator(".dashboard-store-card")
    .filter({ hasText: "Predeterminado" })
    .nth(1)
    .locator(".dashboard-store-card__button");
  await expectHoverChange(cardButton, "Tarjeta de tienda");
  await expectFocusRing(cardButton, "Tarjeta de tienda");
});

test("el detalle de tienda y el Studio distinguen disabled, hover y focus", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openStore(page);

  const detail = page.getByRole("complementary", { name: "Tienda seleccionada: Predeterminado" });
  const backup = detail.getByRole("button", { name: "Respaldo ahora" });
  await expectEnabledButton(backup, "Respaldo ahora");
  await expectFocusRing(backup, "Respaldo ahora");
  await expectHoverChange(backup, "Respaldo ahora");

  const archive = detail.getByRole("button", { name: "Archivar" });
  await expectHoverChange(archive, "Archivar");

  await openStudio(page);

  await expectDisabledButton(page.getByRole("button", { name: "Deshacer" }), "Deshacer inicial");
  await expectDisabledButton(page.getByRole("button", { name: "Rehacer" }), "Rehacer inicial");
  await expectEnabledButton(
    page.getByRole("button", { name: "Volver a tiendas" }),
    "Volver a tiendas",
  );
  await expectFocusRing(page.getByRole("button", { name: "Volver a tiendas" }), "Volver a tiendas");

  const tab = page.getByRole("tab", { name: "Resumen", exact: true });
  await expectHoverChange(tab, "Pestaña Resumen");
  await expectFocusRing(
    page.getByRole("tab", { name: "Preparar", exact: true }),
    "Pestaña Preparar",
  );

  await tab.click();
  await expect(page.getByRole("heading", { name: "Resumen", exact: true })).toBeVisible();
  const title = page
    .locator("fieldset.field", { hasText: "Título visible" })
    .first()
    .locator("input");
  await expectFocusRing(title, "Título visible del Resumen");
  await title.fill("Casa de prueba");
  await title.blur();
  await expect(page.getByRole("button", { name: "Deshacer" })).toBeEnabled();
});

test("el catálogo y el exportador muestran estados disabled y loading", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openStudio(page);

  await page.getByRole("tab", { name: "Catálogo", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Catálogo", exact: true })).toBeVisible();
  await expectDisabledButton(page.getByRole("button", { name: "Anterior" }), "Anterior página 1");
  await page.getByRole("combobox", { name: "Filas" }).selectOption("25");
  await expectEnabledButton(page.getByRole("button", { name: "Siguiente" }), "Siguiente");
  await expectDisabledButton(page.getByRole("button", { name: "Anterior" }), "Anterior página 1");

  await page.getByRole("tab", { name: "Exportar", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Exportar", exact: true })).toBeVisible();
  const draft = page.getByRole("button", { name: /Exportar borrador|Generando/ });
  await expectEnabledButton(draft, "Exportar borrador");
  await draft.click();
  await expect
    .poll(() => draft.textContent(), { message: "Exportar borrador debe pasar por Generando" })
    .toBe("Generando");
  await expect(draft).toBeDisabled();
  await expect.poll(() => draft.textContent(), { timeout: 60_000 }).toBe("Exportar borrador");
  await expect(draft).toBeEnabled();
});

test("el inventario ui-* mantiene estilos coherentes por estado en todas las pantallas", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(studioUrl);
  await expect(page.getByRole("heading", { name: "Tus tiendas" })).toBeVisible();

  const checkConsistency = async (context: string) => {
    const states = await page
      .locator('[data-testid="ui-button"], [data-testid="ui-icon-button"]')
      .evaluateAll((elements) =>
        elements
          .filter((el): el is HTMLButtonElement => el instanceof HTMLButtonElement)
          .map((el) => {
            const style = getComputedStyle(el);
            const rect = el.getBoundingClientRect();
            return {
              label: el.getAttribute("aria-label") ?? el.textContent?.trim() ?? "",
              disabled: el.disabled,
              cursor: style.cursor,
              opacity: style.opacity,
              visible: rect.width > 0 && rect.height > 0,
            };
          }),
      );
    const visible = states.filter((state) => state.visible);
    expect(visible.length, `${context}: inventario visible`).toBeGreaterThan(0);
    for (const state of visible) {
      expect(state.cursor, `${context} "${state.label}": cursor por estado`).toBe(
        state.disabled ? "not-allowed" : "pointer",
      );
      if (state.disabled) {
        expect(Number(state.opacity), `${context} "${state.label}": atenuado`).toBeLessThan(1);
      } else {
        expect(Number(state.opacity), `${context} "${state.label}": sin atenuar`).toBeGreaterThan(
          0.9,
        );
      }
    }
  };

  await checkConsistency("Dashboard");
  await openStudio(page);

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
    await page.getByRole("tab", { name: tabName, exact: true }).click();
    await checkConsistency(`Pestaña ${tabName}`);
  }

  await page.getByRole("tab", { name: "Constructor", exact: true }).click();
  const inspectorInput = page.locator(".inspector input, .inspector select").first();
  await expectFocusRing(inspectorInput, "Input del inspector");
});
