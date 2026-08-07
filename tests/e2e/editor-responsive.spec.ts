import type { Server } from "node:http";
import { expect, type Locator, type Page, test } from "@playwright/test";
import { startStudioServer, stopStudioServer } from "./studio-server";

/**
 * T0.3 — Matriz responsive del editor.
 * Recorre dashboard, todas las pestañas del Studio y el preview en 5 viewports,
 * y verifica ausencia de overflow horizontal y acciones visibles/accionables.
 */

const viewports = [
  { name: "móvil 390", width: 390, height: 844 },
  { name: "tablet 768", width: 768, height: 1024 },
  { name: "tablet 1024", width: 1024, height: 768 },
  { name: "desktop 1440", width: 1440, height: 900 },
  { name: "wide 1920", width: 1920, height: 1080 },
] as const;

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

async function expectNoHorizontalOverflow(page: Page, context: string) {
  await expect
    .poll(
      () =>
        page.evaluate(
          () => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1,
        ),
      { message: `${context}: sin overflow horizontal en ${page.viewportSize()?.width}px` },
    )
    .toBe(true);
}

async function expectActionUsable(page: Page, action: Locator, label: string) {
  await expect(action, `${label}: visible en ${page.viewportSize()?.width}px`).toBeVisible();
  await expect
    .poll(
      async () => {
        const box = await action.boundingBox();
        if (!box) return false;
        const width = page.viewportSize()?.width ?? 1920;
        return box.x >= -1 && box.x + box.width <= width + 1;
      },
      { message: `${label}: no cortado en ${page.viewportSize()?.width}px` },
    )
    .toBe(true);
  const box = await action.boundingBox();
  expect(box, `${label}: caja mensurable`).not.toBeNull();
}

const tabActions: Array<{ tab: string; heading: string; action: string }> = [
  { tab: "Preparar", heading: "Preparar tienda", action: "Modo avanzado" },
  { tab: "Resumen", heading: "Resumen", action: "Añadir enlace de catálogo" },
  { tab: "Catálogo", heading: "Catálogo", action: "Agregar producto" },
  { tab: "Constructor", heading: "Constructor", action: "Agregar sección" },
  { tab: "Recursos", heading: "Recursos", action: "Cargar imágenes" },
  { tab: "SEO", heading: "SEO y Google", action: "Descargar informe" },
  { tab: "Tema", heading: "Tema", action: "Modo" },
  { tab: "Exportar", heading: "Exportar", action: "Exportar borrador" },
];

test("el dashboard no desborda y mantiene acciones usables en los 5 viewports", async ({
  page,
}) => {
  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    await page.goto(studioUrl);
    await expect(page.getByRole("heading", { name: "Tus tiendas" })).toBeVisible();
    await expectNoHorizontalOverflow(page, `Dashboard ${viewport.name}`);

    await expectActionUsable(
      page,
      page.getByRole("button", { name: "Nueva tienda", exact: true }),
      "Nueva tienda",
    );
    await expect(page.getByRole("searchbox", { name: "Buscar tienda" })).toBeVisible();
    await expect(page.getByRole("combobox", { name: "Estado" })).toBeVisible();
    await expect(page.getByRole("combobox", { name: "Ordenar" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Vista en grilla" })).toBeVisible();

    const closeDetail = page.getByRole("button", { name: "Cerrar detalle" });
    if (await closeDetail.isVisible().catch(() => false)) {
      await closeDetail.click();
    }
    const card = page
      .locator(".dashboard-store-card")
      .filter({ hasText: "Predeterminado" })
      .first();
    await card.locator(".dashboard-store-card__button").click();
    const detail = page.getByRole("complementary", { name: "Tienda seleccionada: Predeterminado" });
    await expect(detail).toBeVisible();
    await expectNoHorizontalOverflow(page, `Dashboard detalle ${viewport.name}`);
    await expectActionUsable(
      page,
      detail.getByRole("button", { name: "Abrir tienda" }),
      "Abrir tienda",
    );

    if (viewport.width <= 820) {
      const position = await detail.evaluate((element) => getComputedStyle(element).position);
      expect(position, `Panel lateral como drawer en ${viewport.name}`).toBe("fixed");
    } else {
      const position = await detail.evaluate((element) => getComputedStyle(element).position);
      expect(position, `Panel lateral apilado en ${viewport.name}`).toBe("sticky");
    }

    await detail.getByRole("button", { name: "Cerrar detalle" }).click();
  }
});

test("cada pestaña del Studio no desborda y conserva su acción principal", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(studioUrl);
  await expect(page.getByRole("heading", { name: "Tus tiendas" })).toBeVisible();
  const card = page.locator(".dashboard-store-card").filter({ hasText: "Predeterminado" }).first();
  await card.locator(".dashboard-store-card__button").click();
  await page
    .getByRole("complementary", { name: "Tienda seleccionada: Predeterminado" })
    .getByRole("button", { name: "Abrir tienda" })
    .click();
  await expect(page.getByRole("navigation", { name: "Áreas de la tienda" })).toBeVisible();

  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    for (const { tab, heading, action } of tabActions) {
      await page.getByRole("tab", { name: tab, exact: true }).click();
      await expect(page.getByRole("heading", { name: heading, exact: true })).toBeVisible();
      await expectNoHorizontalOverflow(page, `Pestaña ${tab} ${viewport.name}`);
      await expectActionUsable(
        page,
        page.getByRole(tab === "Tema" ? "combobox" : "button", { name: action, exact: true }),
        action,
      );
    }
  }
});

test("el preview y su toolbar responden en los 5 viewports", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(studioUrl);
  await expect(page.getByRole("heading", { name: "Tus tiendas" })).toBeVisible();
  const card = page.locator(".dashboard-store-card").filter({ hasText: "Predeterminado" }).first();
  await card.locator(".dashboard-store-card__button").click();
  await page
    .getByRole("complementary", { name: "Tienda seleccionada: Predeterminado" })
    .getByRole("button", { name: "Abrir tienda" })
    .click();
  await expect(page.getByRole("navigation", { name: "Áreas de la tienda" })).toBeVisible();

  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    await page.getByRole("tab", { name: "Preparar", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Preparar tienda", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Cerrar panel de edición" }).click();
    await expect(page.getByRole("button", { name: "Abrir panel de edición" })).toBeVisible();
    await expectNoHorizontalOverflow(page, `Preview ${viewport.name}`);

    const toolbar = page.locator(".preview-toolbar");
    await expect(toolbar).toBeVisible();
    await expectActionUsable(
      page,
      page.getByRole("button", { name: "Vista de escritorio" }),
      "Vista de escritorio",
    );
    await expectActionUsable(
      page,
      page.getByRole("button", { name: "Vista móvil" }),
      "Vista móvil",
    );

    const frame = page.locator('iframe[title="Vista previa desktop"]');
    await expect(frame).toBeVisible();
    await expectNoHorizontalOverflow(page, `Preview iframe ${viewport.name}`);

    if (viewport.width <= 680) {
      const routeVisible = await page.locator(".preview-route select").isVisible();
      expect(routeVisible, `Selector de ruta plegado en ${viewport.name}`).toBe(false);
    }
  }
});
