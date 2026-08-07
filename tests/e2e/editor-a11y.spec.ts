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
  await expect(count).toHaveText("2 visibles");
  await search.fill("no existe");
  await expect(page.getByText("No hay coincidencias")).toBeVisible();
  await search.fill("");
  await expect(count).toHaveText("2 visibles");
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
