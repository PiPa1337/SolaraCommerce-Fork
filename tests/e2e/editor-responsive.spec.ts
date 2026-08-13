import type { Server } from "node:http";
import { expect, type Locator, type Page, test } from "@playwright/test";
import { startStudioServer, stopStudioServer } from "./studio-server";

/**
 * T0.3 — Matriz responsive del editor.
 * Recorre dashboard, todas las pestañas del Studio y el preview en 7 viewports,
 * y verifica ausencia de scroll vertical de página y overflow horizontal, más acciones visibles/accionables.
 */

const viewports = [
  { name: "móvil 390", width: 390, height: 844 },
  { name: "tablet 768", width: 768, height: 1024 },
  { name: "tablet 1024", width: 1024, height: 768 },
  { name: "desktop 1366", width: 1366, height: 768 },
  { name: "desktop 1440", width: 1440, height: 900 },
  { name: "desktop real 1920", width: 1920, height: 968 },
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

async function expectNoPageOverflow(page: Page, context: string, checkVertical = true) {
  await expect
    .poll(
      () =>
        page.evaluate(
          ({ checkVertical }) =>
            (!checkVertical ||
              document.documentElement.scrollHeight <= document.documentElement.clientHeight + 1) &&
            document.body.scrollWidth <= window.innerWidth + 1,
          { checkVertical },
        ),
      {
        message: checkVertical
          ? `${context}: sin scroll vertical de página ni overflow horizontal en ${page.viewportSize()?.width}px`
          : `${context}: sin overflow horizontal en ${page.viewportSize()?.width}px`,
      },
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

test("el dashboard no desborda y mantiene acciones usables en los 7 viewports", async ({
  page,
}) => {
  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    await page.goto(studioUrl);
    await expect(page.getByRole("heading", { name: "Tus tiendas" })).toBeVisible();
    await expectNoPageOverflow(page, `Dashboard ${viewport.name}`);

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
    await expectNoPageOverflow(page, `Dashboard detalle ${viewport.name}`, false);
    await expectActionUsable(
      page,
      detail.getByRole("button", { name: "Abrir tienda" }),
      "Abrir tienda",
    );
    for (const actionName of ["Respaldo ahora", "Duplicar", "Archivar"]) {
      const action = detail.getByRole("button", { name: actionName, exact: true });
      await expectActionUsable(page, action, actionName);
      const label = action.locator(":scope > span");
      await expect(label).toHaveCSS("white-space", "nowrap");
      await expect(label).toHaveCSS("overflow-wrap", "normal");
      await expect
        .poll(
          () =>
            label.evaluate((element) => {
              const style = getComputedStyle(element);
              const fontSize = Number.parseFloat(style.fontSize);
              const lineHeight =
                style.lineHeight === "normal"
                  ? fontSize * 1.25
                  : Number.parseFloat(style.lineHeight);
              return (
                element.scrollWidth <= element.clientWidth &&
                element.getBoundingClientRect().height <= lineHeight * 1.2
              );
            }),
          { message: `${actionName}: el texto no debe quedar cortado ni partirse` },
        )
        .toBe(true);
    }

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
    const paneWidths: number[] = [];
    for (const { tab, heading, action } of tabActions) {
      await page.getByRole("tab", { name: tab, exact: true }).click();
      await expect(page.getByRole("heading", { name: heading, exact: true })).toBeVisible();
      await expectNoPageOverflow(page, `Pestaña ${tab} ${viewport.name}`);
      const pane = page.locator(".editor-pane--open");
      const paneMetrics = await pane.evaluate((element) => {
        const bounds = element.getBoundingClientRect();
        return {
          clientWidth: element.clientWidth,
          scrollWidth: element.scrollWidth,
          overflowers: Array.from(element.querySelectorAll<HTMLElement>("*"))
            .map((child) => {
              const box = child.getBoundingClientRect();
              return {
                selector: `${child.tagName.toLowerCase()}.${child.className}`,
                clientWidth: child.clientWidth,
                scrollWidth: child.scrollWidth,
                left: Math.round(box.left - bounds.left),
                right: Math.round(box.right - bounds.left),
              };
            })
            .filter(
              (child) =>
                child.scrollWidth > child.clientWidth + 1 ||
                child.left < -1 ||
                child.right > element.clientWidth + 1,
            )
            .sort((left, right) => right.right - left.right)
            .slice(0, 12),
        };
      });
      paneWidths.push(paneMetrics.clientWidth);
      expect(
        paneMetrics.scrollWidth,
        `${tab} ${viewport.name}: el panel no debe tener scroll horizontal. ${JSON.stringify(paneMetrics.overflowers)}`,
      ).toBeLessThanOrEqual(paneMetrics.clientWidth + 1);

      const sectionMetrics = await pane.locator(".workspace-section").evaluate((element) => ({
        clientWidth: element.clientWidth,
        scrollWidth: element.scrollWidth,
      }));
      expect(
        sectionMetrics.scrollWidth,
        `${tab} ${viewport.name}: el contenido debe caber dentro del panel`,
      ).toBeLessThanOrEqual(sectionMetrics.clientWidth + 1);
      if (tab === "Tema") {
        const themeFieldsets = await pane
          .locator(".theme-layout fieldset")
          .evaluateAll((elements) =>
            elements.every((element) => element.scrollWidth <= element.clientWidth + 1),
          );
        expect(
          themeFieldsets,
          `Tema ${viewport.name}: los controles no deben desbordar sus fieldsets`,
        ).toBe(true);
      }
      await expectActionUsable(
        page,
        page.getByRole(tab === "Tema" ? "combobox" : "button", { name: action, exact: true }),
        action,
      );
      if (viewport.name === "desktop real 1920" && (tab === "Preparar" || tab === "Resumen")) {
        await page.screenshot({
          path: `test-results/${tab.toLowerCase()}-dark-1920x968.png`,
          fullPage: true,
        });
      }
      if (tab === "SEO") {
        await expect(page.locator(".seo-header-score")).toBeVisible();
        const seoOrder = await page.evaluate(() => {
          const boxOf = (selector: string) =>
            document.querySelector(selector)?.getBoundingClientRect();
          const audit = boxOf('[data-testid="ui-seo-audit-panel"]');
          const checklist = boxOf('[data-testid="ui-seo-checklist"]');
          const appearance = boxOf(".seo-fieldset--appearance");
          const previews = boxOf('[data-testid="ui-seo-preview-google"]');
          return {
            audit: audit?.y ?? null,
            checklist: checklist?.y ?? null,
            appearance: appearance?.y ?? null,
            previews: previews?.y ?? null,
          };
        });
        expect(seoOrder.audit).not.toBeNull();
        expect(seoOrder.checklist).not.toBeNull();
        expect(seoOrder.appearance).not.toBeNull();
        expect(seoOrder.previews).not.toBeNull();
        expect(seoOrder.audit).toBeLessThan(seoOrder.checklist ?? Number.POSITIVE_INFINITY);
        expect(seoOrder.checklist).toBeLessThan(seoOrder.appearance ?? Number.POSITIVE_INFINITY);
        expect(seoOrder.appearance).toBeLessThan(seoOrder.previews ?? Number.POSITIVE_INFINITY);
      }
      if (tab === "Catálogo") {
        await expect(
          page.getByText("Deslizá horizontalmente para ver todas las columnas."),
        ).toHaveCount(0);
        if (viewport.width <= 1240) {
          await expect(page.locator(".catalog-table-region")).toHaveCount(0);
          await expect(page.getByTestId("ui-catalog-cards")).toBeVisible();
          const firstCard = page.getByTestId("ui-catalog-card").first();
          await expect(firstCard).toContainText("Marca:");
          await expect(firstCard).toContainText("Categorías:");
          await expect(firstCard).toContainText("Precio:");
          await expect(firstCard).toContainText("Actualizado:");
          const selection = firstCard.getByRole("checkbox");
          await expect(selection).toBeVisible();
          await expect(page.getByRole("button", { name: "Lista" })).toBeDisabled();
          if (viewport.width === 1024) {
            await selection.check();
            await expect(page.getByText("1 seleccionados", { exact: true })).toBeVisible();
            await selection.uncheck();
            await expect(page.getByText("0 seleccionados", { exact: true })).toBeVisible();
            await firstCard.scrollIntoViewIfNeeded();
            await page.screenshot({
              path: "test-results/catalog-scale-compact-1024.png",
              fullPage: true,
            });
          }
        } else {
          await expect(page.locator(".catalog-table-region")).toHaveRole("region");
          await expect
            .poll(
              () =>
                page.locator(".table-shell").evaluate((element) => {
                  return element.scrollWidth <= element.clientWidth + 1;
                }),
              { message: `Catálogo ${viewport.name}: la tabla no agrega scroll horizontal` },
            )
            .toBe(true);
          if (viewport.width === 1366 || viewport.name === "desktop real 1920") {
            await page.locator(".table-shell").scrollIntoViewIfNeeded();
            await page.screenshot({
              path: `test-results/catalog-scale-table-${viewport.width}x${viewport.height}.png`,
              fullPage: true,
            });
          }
        }
      }
    }
    expect(
      Math.max(...paneWidths) - Math.min(...paneWidths),
      `${viewport.name}: todas las pestañas deben usar el mismo ancho de panel`,
    ).toBeLessThanOrEqual(1);
    if (viewport.width >= 1366) {
      expect(
        paneWidths[0],
        `${viewport.name}: el panel debe aprovechar el ancho ampliado`,
      ).toBeGreaterThanOrEqual(1120);
    }
  }
});

test("el preview y su toolbar responden en los 7 viewports", async ({ page }) => {
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
    // Seleccionar la pestaña recupera el panel aunque se haya cerrado en la
    // iteración anterior; el botón de la toolbar queda como segunda vía.
    const openPane = page.getByRole("button", { name: "Abrir panel de edición" });
    if (await openPane.isVisible().catch(() => false)) await openPane.click();
    await expect(page.getByRole("heading", { name: "Preparar tienda", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Cerrar panel de edición" }).click();
    await expect(page.getByRole("button", { name: "Abrir panel de edición" })).toBeVisible();
    await expectNoPageOverflow(page, `Preview ${viewport.name}`);

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
    await expect(frame).toHaveAttribute("sandbox", "allow-forms allow-scripts");
    await expectNoPageOverflow(page, `Preview iframe ${viewport.name}`);

    if (viewport.width <= 680) {
      const routeVisible = await page.locator(".preview-route input").isVisible();
      expect(routeVisible, `Selector de ruta plegado en ${viewport.name}`).toBe(false);
    }
  }
});

test("el recorrido clave del smoke no desborda en los 7 viewports (T6.3)", async ({ page }) => {
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

    await page.getByRole("tab", { name: "Catálogo", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Catálogo", exact: true })).toBeVisible();
    await expectNoPageOverflow(page, `Catálogo ${viewport.name}`);

    await page.getByRole("button", { name: "Agregar producto" }).first().click();
    const dialog = page.locator("dialog.product-dialog");
    await expect(dialog).toBeVisible();
    await expectNoPageOverflow(page, `Diálogo de producto ${viewport.name}`);
    await expectActionUsable(
      page,
      dialog.getByRole("button", { name: "Cancelar" }),
      "Cancelar del diálogo de producto",
    );
    await dialog.getByRole("button", { name: "Cancelar" }).click();
    await expect(dialog).toBeHidden();

    await page.getByRole("tab", { name: "Constructor", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Constructor", exact: true })).toBeVisible();
    await expectNoPageOverflow(page, `Constructor ${viewport.name}`);

    await page.getByRole("tab", { name: "Exportar", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Exportar", exact: true })).toBeVisible();
    await expectNoPageOverflow(page, `Exportar ${viewport.name}`);
  }
});
