import type { Server } from "node:http";
import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";
import { catalogModernCleanStore } from "@solara/project-schema/catalog-modern-template";
import { cloneProjectFromTemplate } from "@solara/project-schema/project-policy";
import { startStudioServer, stopStudioServer } from "./studio-server";

let server: Server;
let url: string;
test.beforeAll(async () => {
  const running = await startStudioServer();
  server = running.server;
  url = running.url;
});
test.afterAll(async () => stopStudioServer(server));

async function seedLibrary(page: Page, count = 120) {
  const names = [
    "Luna Norte",
    "Stylo Lashes",
    "RM Descartables",
    "Casa Oliva",
    "Atelier Sur",
    "Nómada",
    "Bruma",
    "Flora Estudio",
    "Café del Mar",
    "Ámbar Objetos",
    "Origen Natural",
    "Marea Textil",
  ];
  const records = Array.from({ length: count }, (_, index) => {
    const project = cloneProjectFromTemplate(catalogModernCleanStore, {
      id: `store-gargantua-${String(index).padStart(3, "0")}`,
      name: names[index] ?? `Tienda ${String(index + 1).padStart(3, "0")}`,
      slug: `gargantua-${index}`,
      now: "2026-09-07T12:00:00.000Z",
    });
    return {
      id: project.id,
      name: project.name,
      status: project.status,
      updatedAt: project.updatedAt,
      project,
    };
  });
  // Sólo IndexedDB del contexto aislado de Playwright. Nunca toca proyectos/.
  await page.evaluate(
    (items) =>
      new Promise<void>((resolve, reject) => {
        const open = indexedDB.open("solara-commerce-studio");
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result;
          const tx = db.transaction("projects", "readwrite");
          const store = tx.objectStore("projects");
          store.clear();
          for (const item of items) store.put(item);
          tx.oncomplete = () => {
            db.close();
            resolve();
          };
          tx.onerror = () => {
            db.close();
            reject(tx.error);
          };
        };
      }),
    records,
  );
  await page.reload();
  const expectedVisible = count + 1;
  await expect(page.locator(".dashboard-cosmic-count")).toHaveText(`${expectedVisible} visibles`);
  const notice = page.getByRole("button", { name: "Cerrar aviso" });
  if (await notice.isVisible()) await notice.click();
  await page.getByRole("heading", { name: "Tus tiendas", exact: true }).click();
}

test("el arranque entra desde Gargantua y libera el dashboard", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(url, { waitUntil: "commit" });

  const boot = page.getByTestId("solara-app-boot");
  await expect(boot).toBeVisible();
  await expect(boot.locator(".dashboard-gravity-field")).toHaveAttribute("data-renderer", "webgl2");
  await page.waitForFunction(() => {
    const canvas = document.querySelector<HTMLCanvasElement>(
      '[data-testid="solara-app-boot"] .dashboard-gravity-field canvas',
    );
    return canvas !== null && Number.parseFloat(getComputedStyle(canvas).opacity) >= 0.99;
  }, undefined, { timeout: 2_000 });
  await page.waitForFunction(() => document.documentElement.dataset.solaraBoot === "entering", {
    timeout: 5_000,
  });
  await expect(page.locator(".dashboard-gargantua > .dashboard-gravity-field")).toHaveAttribute(
    "data-animation-state",
    "running",
  );
  await expect(page.locator(".dashboard-cosmic-library")).toHaveCSS("opacity", "1");
  await expect(page.getByRole("heading", { name: "Tus tiendas", exact: true })).toBeVisible();
  await expect(boot).toHaveCount(0, { timeout: 5_000 });
  await expect(page.locator(".dashboard-gargantua > .dashboard-gravity-field")).toHaveAttribute(
    "data-animation-state",
    "running",
  );
  await expect(page.getByTestId("gargantua-debug-controls")).toBeVisible();
  await expect(page.getByLabel("Opacidad de la interfaz del dashboard")).toHaveValue("100");
  await expect(page.locator('[data-gargantua-debug="true"]')).toHaveCount(1);
});

for (const [width, height] of [
  [1920, 950],
  [1366, 768],
  [1280, 720],
  [1440, 900],
  [1024, 768],
  [390, 844],
  [320, 568],
]) {
  test(`biblioteca sin scroll a ${width}x${height}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.goto(url);
    await expect(page.getByRole("heading", { name: "Tus tiendas", exact: true })).toBeVisible();
    await seedLibrary(page);
    await expect(page.locator(".dashboard-gargantua > .dashboard-gravity-field")).toHaveAttribute(
      "data-renderer",
      "webgl2",
    );
    await expect(page.locator(".dashboard-gargantua > .dashboard-gravity-field")).toHaveCount(1);
    await expect(page.locator(".dashboard-cosmic-library > .dashboard-gravity-field")).toHaveCount(
      0,
    );
    await expect(page.locator(".dashboard-cosmic-store-groups .dashboard-store-card")).toHaveCount(
      12,
    );
    await expect(page.locator(".dashboard-cosmic-side > .dashboard-store-card")).toHaveCount(0);
    await expect(page.locator(".dashboard-store-card__hero img")).toHaveCount(12);
    await expect
      .poll(() =>
        page
          .locator(".dashboard-cosmic-store-groups .dashboard-store-card__hero img")
          .first()
          .evaluate((image) => image.complete && image.naturalWidth > 0),
      )
      .toBe(true);
    const firstHeroOpacity = await page
      .locator(".dashboard-cosmic-store-groups .dashboard-store-card__hero")
      .first()
      .evaluate((element) => Number.parseFloat(getComputedStyle(element).opacity));
    expect(firstHeroOpacity).toBeGreaterThanOrEqual(width >= 821 ? 0.7 : 0.5);
    await page.screenshot({ path: `test-results/gargantua-${width}.png` });
    await expect(page.getByRole("navigation", { name: "Páginas de tiendas" })).toBeVisible();
    const overflow = await page.evaluate(() => {
      const root = document.documentElement;
      const violations =
        root.scrollHeight > root.clientHeight + 1 || root.scrollWidth > root.clientWidth + 1;
      const panels = [
        ...document.querySelectorAll<HTMLElement>(
          ".dashboard-cosmic-command-bar, .dashboard-cosmic-results, .dashboard-cosmic-store-groups, .dashboard-store-detail.is-open",
        ),
      ];
      return {
        hasOverflow:
          violations ||
          panels.some(
            (el) =>
              el.getBoundingClientRect().width > 0 &&
              (el.scrollHeight > el.clientHeight + 1 || el.scrollWidth > el.clientWidth + 1),
          ),
      };
    });
    expect(overflow.hasOverflow, JSON.stringify(overflow)).toBe(false);
  });
}

test("cards y detalle comparten línea superior y margen para hover", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(url);
  await expect(page.getByRole("heading", { name: "Tus tiendas", exact: true })).toBeVisible();
  await seedLibrary(page, 12);

  const card = page.locator(".dashboard-cosmic-store-groups .dashboard-store-card").first();
  const detail = page.locator(".dashboard-store-detail.is-open");
  await expect(card).toBeVisible();
  await expect(detail).toBeVisible();

  const alignment = await page.evaluate(() => {
    const card = document.querySelector<HTMLElement>(
      ".dashboard-cosmic-store-groups .dashboard-store-card",
    );
    const detail = document.querySelector<HTMLElement>(".dashboard-store-detail.is-open");
    const results = document.querySelector<HTMLElement>(".dashboard-cosmic-results");
    if (!card || !detail || !results)
      throw new Error("No se pudo medir la alineación del dashboard");
    const cardRect = card.getBoundingClientRect();
    const detailRect = detail.getBoundingClientRect();
    const resultsRect = results.getBoundingClientRect();
    return {
      topDelta: Math.abs(cardRect.top - detailRect.top),
      cardInset: cardRect.top - resultsRect.top,
    };
  });

  expect(alignment.topDelta).toBeLessThanOrEqual(1);
  expect(alignment.cardInset).toBeGreaterThanOrEqual(10);

  await card.hover();
  const hoveredTop = await card.evaluate((element) => element.getBoundingClientRect().top);
  const resultsTop = await page
    .locator(".dashboard-cosmic-results")
    .evaluate((element) => element.getBoundingClientRect().top);
  expect(hoveredTop).toBeGreaterThanOrEqual(resultsTop + 10);
});

test("Gargantua continúa detrás del navbar superior", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(url);
  await expect(page.getByRole("heading", { name: "Tus tiendas", exact: true })).toBeVisible();

  const metrics = await page.evaluate(() => {
    const root = document.querySelector<HTMLElement>(".app-root--dashboard-cosmic");
    const field = document.querySelector<HTMLElement>(".dashboard-gravity-field");
    const header = document.querySelector<HTMLElement>(".app-header--dashboard-cosmic");
    if (!root || !field || !header) throw new Error("No se pudo medir el fondo del dashboard");
    const fieldRect = field.getBoundingClientRect();
    const rootRect = root.getBoundingClientRect();
    const headerStyle = getComputedStyle(header);
    return {
      fieldPosition: getComputedStyle(field).position,
      fieldTop: fieldRect.top,
      fieldBottom: fieldRect.bottom,
      fieldLeft: fieldRect.left,
      fieldRight: fieldRect.right,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      headerBackgroundImage: headerStyle.backgroundImage,
      headerBackdropFilter: headerStyle.backdropFilter,
      rootOverflow:
        root.scrollWidth <= root.clientWidth + 1 && root.scrollHeight <= root.clientHeight + 1,
      rootRect: { top: rootRect.top, bottom: rootRect.bottom },
    };
  });

  expect(metrics.fieldPosition).toBe("fixed");
  expect(metrics.fieldTop).toBeLessThanOrEqual(0);
  expect(metrics.fieldBottom).toBeGreaterThanOrEqual(metrics.viewportHeight);
  expect(metrics.fieldLeft).toBeLessThanOrEqual(0);
  expect(metrics.fieldRight).toBeGreaterThanOrEqual(metrics.viewportWidth);
  expect(metrics.headerBackgroundImage).toContain("linear-gradient");
  expect(metrics.headerBackdropFilter).toContain("blur");
  expect(metrics.rootOverflow).toBe(true);
});

test("desktop ajusta la grilla a la cantidad real de tiendas", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(url);
  await expect(page.getByRole("heading", { name: "Tus tiendas", exact: true })).toBeVisible();
  await seedLibrary(page, 1);
  await page.getByRole("button", { name: "Vista en grilla", exact: true }).click();

  const grid = page.locator(".dashboard-cosmic-store-groups .dashboard-cosmic-store-grid");
  await expect
    .poll(() =>
      grid.evaluate(
        (element) => getComputedStyle(element).gridTemplateColumns.trim().split(/\s+/).length,
      ),
    )
    .toBe(2);

  const cards = await grid
    .locator(".dashboard-store-card")
    .evaluateAll((elements) =>
      elements.map((element) => Math.round(element.getBoundingClientRect().width)),
    );
  expect(cards).toHaveLength(2);
  expect(cards[0]).toBeGreaterThan(350);
  expect(cards[0]).toBe(cards[1]);
});

test("preview y detalle mantienen lectura, espaciado y overflow controlado", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(url);
  await expect(page.getByRole("heading", { name: "Tus tiendas", exact: true })).toBeVisible();
  await seedLibrary(page, 12);
  await page
    .locator(".dashboard-cosmic-store-groups .dashboard-store-card__button")
    .first()
    .click();
  await expect(page.locator(".dashboard-store-detail.is-open")).toBeVisible();

  const metrics = await page.evaluate(() => {
    const root = document.documentElement;
    const cards = [...document.querySelectorAll<HTMLElement>(".dashboard-store-card")];
    const detail = document.querySelector<HTMLElement>(".dashboard-store-detail.is-open");
    const buttons = detail
      ? [...detail.querySelectorAll<HTMLButtonElement>(".dashboard-store-detail__actions .button")]
      : [];
    return {
      rootOverflow:
        root.scrollWidth > root.clientWidth + 1 || root.scrollHeight > root.clientHeight + 1,
      cards: cards.map((card) => {
        const hero = card.querySelector<HTMLElement>(".dashboard-store-card__hero");
        const image = card.querySelector<HTMLImageElement>(".dashboard-store-card__hero img");
        const rect = hero?.getBoundingClientRect();
        const style = hero ? getComputedStyle(hero) : null;
        return {
          heroVisible: Boolean(
            hero &&
              rect &&
              rect.width >= 80 &&
              rect.height >= 70 &&
              style?.visibility !== "hidden" &&
              Number.parseFloat(style.opacity) >= 0.4,
          ),
          imageReady: !image || (image.complete && image.naturalWidth > 0),
        };
      }),
      detailOverflow: detail
        ? detail.scrollWidth > detail.clientWidth + 1 ||
          detail.scrollHeight > detail.clientHeight + 1
        : true,
      actionColumns: detail
        ? getComputedStyle(detail.querySelector<HTMLElement>(".dashboard-store-detail__actions")!)
            .gridTemplateColumns.trim()
            .split(/\s+/).length
        : 0,
      actionGroupColumns: detail
        ? [
            ".dashboard-store-detail__actions-primary",
            ".dashboard-store-detail__actions-secondary",
            ".dashboard-store-detail__actions-danger",
          ].map(
            (selector) =>
              getComputedStyle(detail.querySelector<HTMLElement>(selector)!)
                .gridTemplateColumns.trim()
                .split(/\s+/).length,
          )
        : [],
      actionLabels: detail
        ? [
            ".dashboard-store-detail__actions-secondary",
            ".dashboard-store-detail__actions-danger",
          ].map((selector) => detail.querySelector<HTMLElement>(selector)?.dataset.label ?? "")
        : [],
      actionDividerWidths: detail
        ? [
            ".dashboard-store-detail__actions-secondary",
            ".dashboard-store-detail__actions-danger",
          ].map((selector) =>
            getComputedStyle(detail.querySelector<HTMLElement>(selector)!).borderTopWidth.trim(),
          )
        : [],
      buttonHeights: buttons.map((button) => Math.round(button.getBoundingClientRect().height)),
      buttonPadding: buttons.map((button) => {
        const style = getComputedStyle(button);
        return {
          paddingInline:
            Number.parseFloat(style.paddingLeft) + Number.parseFloat(style.paddingRight),
          paddingBlock:
            Number.parseFloat(style.paddingTop) + Number.parseFloat(style.paddingBottom),
        };
      }),
    };
  });

  expect(metrics.rootOverflow).toBe(false);
  expect(metrics.cards.every((card) => card.heroVisible && card.imageReady)).toBe(true);
  expect(metrics.detailOverflow).toBe(false);
  expect(metrics.actionColumns).toBe(2);
  expect(metrics.actionGroupColumns[0]).toBeGreaterThanOrEqual(1);
  expect(metrics.actionGroupColumns.slice(1)).toEqual([2, 2]);
  expect(metrics.actionLabels).toEqual(["Gestionar y respaldar", "Zona de riesgo"]);
  expect(metrics.actionDividerWidths).toEqual(["0px", "0px"]);
  expect(metrics.buttonHeights.every((height) => height >= 38)).toBe(true);
  expect(
    metrics.buttonPadding.every(
      ({ paddingInline, paddingBlock }) => paddingInline >= 16 && paddingBlock >= 10,
    ),
  ).toBe(true);
});

test("rail desktop bajo mantiene las acciones de una tienda normal sin scroll", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto(url);
  await expect(page.getByRole("heading", { name: "Tus tiendas", exact: true })).toBeVisible();
  await seedLibrary(page, 3);

  await page.locator(".dashboard-cosmic-store-groups .dashboard-store-card__button").nth(1).click();
  const detail = page.locator(".dashboard-store-detail.is-open");
  await expect(detail).toBeVisible();

  const metrics = await page.evaluate(() => {
    const root = document.documentElement;
    const detail = document.querySelector<HTMLElement>(".dashboard-store-detail.is-open");
    if (!detail) throw new Error("No se encontró el detalle de una tienda normal");
    const buttons = [
      ...detail.querySelectorAll<HTMLButtonElement>(".dashboard-store-detail__actions .button"),
    ];
    return {
      rootOverflow:
        root.scrollWidth > root.clientWidth + 1 || root.scrollHeight > root.clientHeight + 1,
      detailOverflow:
        detail.scrollWidth > detail.clientWidth + 1 ||
        detail.scrollHeight > detail.clientHeight + 1,
      buttonHeights: buttons.map((button) => Math.round(button.getBoundingClientRect().height)),
      labels: buttons.map((button) => button.textContent?.trim() ?? ""),
    };
  });

  expect(metrics.rootOverflow).toBe(false);
  expect(metrics.detailOverflow).toBe(false);
  expect(metrics.buttonHeights.every((height) => height >= 36)).toBe(true);
  expect(metrics.labels).toEqual(
    expect.arrayContaining([
      "Abrir tienda",
      "Respaldar ahora",
      "Duplicar",
      "Calculadora",
      "Archivar",
      "Eliminar tienda",
    ]),
  );
});

test("movimiento reducido elimina la profundidad transformada", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto(url);
  await expect(page.locator(".dashboard-store-card").first()).toBeVisible();

  const transforms = await page
    .locator(".dashboard-store-card")
    .first()
    .evaluate((card) => ({
      card: getComputedStyle(card).transform,
      button: getComputedStyle(card.querySelector(".dashboard-store-card__button")!).transform,
      mark: getComputedStyle(card.querySelector(".dashboard-store-card__mark")!).transform,
      title: getComputedStyle(card.querySelector("strong")!).transform,
    }));
  expect(transforms).toEqual({
    card: "none",
    button: "none",
    mark: "none",
    title: "none",
  });
});

test("el parallax de Gargantua responde al puntero en escritorio", async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto(url);
  await expect(page.getByRole("heading", { name: "Tus tiendas", exact: true })).toBeVisible();
  await seedLibrary(page);
  const card = page.locator(".dashboard-cosmic-store-groups .dashboard-store-card").first();
  await expect(card).toBeVisible();
  const bounds = await card.boundingBox();
  if (!bounds) throw new Error("No se pudo medir la card para el parallax");

  const initial = await card.evaluate((element) => ({
    rotateX: element.style.getPropertyValue("--card-rotate-x"),
    rotateY: element.style.getPropertyValue("--card-rotate-y"),
  }));
  await page.mouse.move(bounds.x + bounds.width * 0.18, bounds.y + bounds.height * 0.22);
  const pointed = await card.evaluate((element) => ({
    rotateX: element.style.getPropertyValue("--card-rotate-x"),
    rotateY: element.style.getPropertyValue("--card-rotate-y"),
  }));

  expect(pointed.rotateX).not.toBe("");
  expect(pointed.rotateY).not.toBe("");
  expect(pointed.rotateX).not.toBe(initial.rotateX);
  expect(pointed.rotateY).not.toBe(initial.rotateY);
});

test("el teclado separa revisar estado de abrir la tienda", async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto(url);
  await expect(page.getByRole("heading", { name: "Tus tiendas", exact: true })).toBeVisible();
  await seedLibrary(page, 12);
  await expect(page.locator(".dashboard-cosmic-shortcuts")).toBeVisible();
  await expect(page.locator(".dashboard-cosmic-actions__legend")).toContainText("Seleccionar");
  await expect(page.locator(".dashboard-cosmic-actions__legend")).toContainText("Abrir");

  const detail = page.getByRole("region", { name: /Tienda seleccionada:/ });
  if (await detail.isVisible())
    await detail.getByRole("button", { name: "Cerrar detalle" }).click();
  const card = page.locator("[data-store-card-id]").first();
  await card.focus();
  await page.keyboard.press("Enter");
  await expect(detail).toBeVisible();
  await detail.getByRole("button", { name: "Abrir tienda", exact: true }).click();
  await expect(page.getByRole("tab", { name: "Preparar", exact: true })).toBeVisible();
});

test("abrir una tienda atraviesa Gargantua antes de montar Studio", async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto(url);
  await expect(page.getByRole("heading", { name: "Tus tiendas", exact: true })).toBeVisible();
  await seedLibrary(page, 12);

  await page.locator(".dashboard-store-card__button").first().click();
  await page
    .getByRole("region", { name: /Tienda seleccionada:/ })
    .getByRole("button", { name: "Abrir tienda", exact: true })
    .click();
  await expect(page.getByTestId("gargantua-launch")).toBeVisible({ timeout: 2_000 });
  await expect(page.locator(".dashboard-gargantua-transition__readout")).toHaveCount(0);
  await expect(page.getByRole("tab", { name: "Preparar", exact: true })).toBeVisible({
    timeout: 10000,
  });
  await expect(page.getByTestId("gargantua-launch")).toHaveCount(0);
  await expect(page.getByTestId("store-route-curtain")).toHaveCount(0, { timeout: 2_000 });
});

test("el slider de opacidad de Gargantua vive en el navbar", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto(url);
  await expect(page.getByRole("heading", { name: "Tus tiendas", exact: true })).toBeVisible();
  const control = page.locator(
    ".app-header--dashboard-cosmic .app-header__actions .app-gargantua-opacity-control",
  );
  await expect(control).toBeVisible();
  await expect(control.locator("input[type=range]")).toHaveValue("100");
  await expect(page.locator('[data-gargantua-debug="true"]')).toHaveCount(1);
});

test("las flechas respetan el orden visual después de fijar una tienda", async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto(url);
  await expect(page.getByRole("heading", { name: "Tus tiendas", exact: true })).toBeVisible();
  await seedLibrary(page, 12);

  const gridCards = page.locator(".dashboard-cosmic-store-groups .dashboard-store-card");
  const firstId = await gridCards
    .nth(0)
    .locator("[data-store-card-id]")
    .getAttribute("data-store-card-id");
  const secondCard = gridCards.nth(1);
  const secondId = await secondCard
    .locator("[data-store-card-id]")
    .getAttribute("data-store-card-id");
  if (!firstId || !secondId) throw new Error("No se pudieron obtener las cards para la navegación");

  await secondCard.locator(".dashboard-store-card__button").click();
  const detail = page.getByRole("region", { name: /Tienda seleccionada:/ });
  await detail.getByTestId("ui-detail-pin").click();
  await expect(
    page
      .locator(".dashboard-cosmic-store-groups .dashboard-store-card")
      .first()
      .locator("[data-store-card-id]"),
  ).toHaveAttribute("data-store-card-id", secondId);
  await page.locator(`[data-store-card-id="${secondId}"]`).focus();
  await page.keyboard.press("ArrowRight");
  await expect
    .poll(() => page.evaluate(() => document.activeElement?.getAttribute("data-store-card-id")))
    .toBe(firstId);
});

test("120 tiendas: páginas, búsqueda global, fijadas y comparación entre páginas", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto(url);
  await expect(page.locator(".dashboard-store-card").first()).toBeVisible();
  await seedLibrary(page);
  const accessibility = await new AxeBuilder({ page })
    .include(".dashboard-gargantua")
    .withTags(["wcag2a", "wcag2aa"])
    .analyze();
  expect(accessibility.violations).toEqual([]);
  const first = await page
    .locator("[data-store-card-id]")
    .first()
    .getAttribute("data-store-card-id");
  await page.getByRole("button", { name: "Página siguiente" }).click();
  await expect(page.locator(`[data-store-card-id="${first}"]`)).toHaveCount(0);
  await page.getByRole("button", { name: "Fijar tienda", exact: true }).first().click();
  await expect(page.getByRole("button", { name: "Quitar de fijadas" })).toHaveCount(1);
  await page.getByRole("button", { name: "Comparar tiendas", exact: true }).click();
  const compareAction = page.getByRole("button", { name: "Comparar", exact: true });
  await expect(compareAction).toBeDisabled();
  await expect
    .poll(() => compareAction.evaluate((element) => getComputedStyle(element).backgroundColor))
    .toBe("rgba(255, 255, 255, 0.06)");
  await page.getByTestId("ui-card-compare").first().check();
  const comparedCard = page.locator(".dashboard-store-card").first();
  await expect(comparedCard).toHaveClass(/is-compare-mode/);
  await expect(comparedCard.getByTestId("ui-card-compare")).toBeChecked();
  await page.screenshot({ path: "test-results/gargantua-compare-selected-1366.png" });
  await expect(compareAction).toBeDisabled();
  await page.getByRole("button", { name: "Página siguiente" }).click();
  await page.getByTestId("ui-card-compare").first().check();
  await expect(compareAction).toBeEnabled();
  await compareAction.click();
  await expect(page.getByRole("dialog")).toBeVisible();
  const typographyRow = page
    .locator(".compare-dialog .compare-view__row")
    .filter({ hasText: "Tipografía display" })
    .first();
  await expect
    .poll(() =>
      typographyRow.evaluate((element) => {
        const values = [...element.querySelectorAll("strong")];
        return {
          wraps: values.every((value) => getComputedStyle(value).whiteSpace === "normal"),
          overlaps:
            values[0].getBoundingClientRect().right > values[1].getBoundingClientRect().left,
        };
      }),
    )
    .toEqual({ wraps: true, overlaps: false });
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Cancelar", exact: true }).click();
  await page.getByRole("searchbox", { name: "Buscar tienda" }).fill("Tienda 120");
  await expect(page.locator(".dashboard-store-card")).toHaveCount(1);
  await expect(page.locator(".dashboard-store-card")).toContainText("Tienda 120");
  await expect(page.getByText("Fuera del filtro", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Limpiar búsqueda" }).click();
  await page.getByRole("searchbox", { name: "Buscar tienda" }).fill("__sin_coincidencias__");
  await expect(page.getByText("No hay coincidencias", { exact: true })).toBeVisible();
  await expect(page.locator(".dashboard-gargantua .empty-state")).toHaveCSS(
    "border-style",
    "dashed",
  );
  await expect(page.locator("[data-store-card-id]")).toHaveCount(0);
  await expect
    .poll(() =>
      page.evaluate(() => ({
        root: document.documentElement.scrollHeight <= document.documentElement.clientHeight + 1,
        width: document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1,
      })),
    )
    .toEqual({ root: true, width: true });
  await page.getByRole("button", { name: "Limpiar búsqueda" }).click();
  await page.getByRole("button", { name: "Vista en lista" }).click();
  await expect(page.locator(".dashboard-cosmic-store-groups .dashboard-store-card")).toHaveCount(5);
  await expect(page.locator(".dashboard-cosmic-side > .dashboard-store-card")).toHaveCount(0);
  await expect(
    page.locator(".dashboard-cosmic-store-groups .dashboard-store-card__badge"),
  ).toHaveCount(1);
  const mainListGrid = page.locator(
    ".dashboard-cosmic-results--list .dashboard-cosmic-store-groups > .dashboard-cosmic-group .dashboard-cosmic-store-grid",
  );
  await expect
    .poll(() =>
      mainListGrid
        .first()
        .evaluate(
          (element) => getComputedStyle(element).gridTemplateColumns.trim().split(/\s+/).length,
        ),
    )
    .toBe(1);
});

test("comparación compacta y detalle móvil conservan el viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(url);
  await expect(page.getByRole("heading", { name: "Tus tiendas", exact: true })).toBeVisible();
  await seedLibrary(page, 12);

  await page.getByRole("button", { name: "Comparar tiendas", exact: true }).click();
  await expect(page.getByText("Elegí 2 tiendas para comparar", { exact: true })).toBeVisible();
  await page.getByTestId("ui-card-compare").nth(0).check();
  await page.getByTestId("ui-card-compare").nth(1).check();
  await expect(page.getByText("2 tiendas seleccionadas", { exact: true })).toBeVisible();

  const hasOverflow = async () =>
    page.evaluate(() => {
      const root = document.documentElement;
      const panels = [
        ...document.querySelectorAll<HTMLElement>(
          ".dashboard-cosmic-results, .dashboard-cosmic-store-groups, .dashboard-store-detail.is-open",
        ),
      ];
      return (
        root.scrollHeight > root.clientHeight + 1 ||
        root.scrollWidth > root.clientWidth + 1 ||
        panels.some(
          (element) =>
            element.getBoundingClientRect().width > 0 &&
            (element.scrollHeight > element.clientHeight + 1 ||
              element.scrollWidth > element.clientWidth + 1),
        )
      );
    });

  expect(await hasOverflow()).toBe(false);
  await page.locator(".dashboard-store-card__button").first().click();
  await expect(page.locator(".dashboard-store-detail.is-open")).toBeVisible();
  expect(await hasOverflow()).toBe(false);
});

test("estado vacío a 320 px conserva el viewport sin scroll", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto(url);
  await expect(page.getByRole("heading", { name: "Tus tiendas", exact: true })).toBeVisible();
  await seedLibrary(page, 12);

  await page.getByRole("searchbox", { name: "Buscar tienda" }).fill("__sin_coincidencias__");
  await expect(page.getByText("No hay coincidencias", { exact: true })).toBeVisible();
  await page.screenshot({ path: "test-results/gargantua-empty-320.png" });
  const metrics = await page.evaluate(() => {
    const root = document.documentElement;
    const panels = [
      ...document.querySelectorAll<HTMLElement>(
        ".dashboard-cosmic-results, .dashboard-cosmic-store-groups",
      ),
    ];
    return {
      rootScrollHeight: root.scrollHeight,
      rootClientHeight: root.clientHeight,
      rootScrollWidth: root.scrollWidth,
      rootClientWidth: root.clientWidth,
      panelsOverflow: panels.some(
        (element) =>
          element.scrollHeight > element.clientHeight + 1 ||
          element.scrollWidth > element.clientWidth + 1,
      ),
    };
  });

  expect(metrics.rootScrollHeight).toBeLessThanOrEqual(metrics.rootClientHeight + 1);
  expect(metrics.rootScrollWidth).toBeLessThanOrEqual(metrics.rootClientWidth + 1);
  expect(metrics.panelsOverflow).toBe(false);
});

test("comparación móvil cabe en el viewport sin scroll interno", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(url);
  await expect(page.getByRole("heading", { name: "Tus tiendas", exact: true })).toBeVisible();
  await seedLibrary(page, 12);

  await page.getByRole("button", { name: "Comparar tiendas", exact: true }).click();
  await page.getByTestId("ui-card-compare").nth(0).check();
  await page.getByTestId("ui-card-compare").nth(1).check();
  await page.getByRole("button", { name: "Comparar", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Comparar tiendas" });
  await expect(dialog).toBeVisible();
  await page.screenshot({ path: "test-results/gargantua-compare-390.png" });

  const metrics = await dialog.evaluate((element) => ({
    scrollHeight: element.scrollHeight,
    clientHeight: element.clientHeight,
    scrollWidth: element.scrollWidth,
    clientWidth: element.clientWidth,
  }));
  expect(metrics.scrollHeight).toBeLessThanOrEqual(metrics.clientHeight + 1);
  expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth + 1);
});

test("vista lista móvil conserva la densidad y no crea scroll", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(url);
  await expect(page.getByRole("heading", { name: "Tus tiendas", exact: true })).toBeVisible();
  await seedLibrary(page, 12);
  await page.getByRole("button", { name: "Vista en lista", exact: true }).click();

  await expect(page.locator(".dashboard-cosmic-results--list .dashboard-store-card")).toHaveCount(
    5,
  );
  await expect
    .poll(() =>
      page
        .locator(".dashboard-cosmic-results--list .dashboard-store-card__badge")
        .first()
        .evaluate((element) => ({
          gridColumn: getComputedStyle(element).gridColumnStart,
          gridRow: getComputedStyle(element).gridRowStart,
        })),
    )
    .toEqual({ gridColumn: "3", gridRow: "2" });
  await page.screenshot({ path: "test-results/gargantua-list-390.png" });
  const metrics = await page.evaluate(() => {
    const root = document.documentElement;
    const panel = document.querySelector<HTMLElement>(".dashboard-cosmic-results");
    return {
      rootScrollHeight: root.scrollHeight,
      rootClientHeight: root.clientHeight,
      rootScrollWidth: root.scrollWidth,
      rootClientWidth: root.clientWidth,
      panelScrollHeight: panel?.scrollHeight ?? 0,
      panelClientHeight: panel?.clientHeight ?? 0,
      panelScrollWidth: panel?.scrollWidth ?? 0,
      panelClientWidth: panel?.clientWidth ?? 0,
    };
  });
  expect(metrics.rootScrollHeight).toBeLessThanOrEqual(metrics.rootClientHeight + 1);
  expect(metrics.rootScrollWidth).toBeLessThanOrEqual(metrics.rootClientWidth + 1);
  expect(metrics.panelScrollHeight).toBeLessThanOrEqual(metrics.panelClientHeight + 1);
  expect(metrics.panelScrollWidth).toBeLessThanOrEqual(metrics.panelClientWidth + 1);
});

test("detalle administrado completo, móvil y teclado", async ({ page }) => {
  const project = cloneProjectFromTemplate(catalogModernCleanStore, {
    id: "store-managed-gargantua",
    name: "Stylo Lashes",
    slug: "stylo-lashes",
  });
  const managed = await startStudioServer({
    managedProject: {
      projectId: project.id,
      name: project.name,
      slug: project.slug,
      version: 15,
      updatedAt: project.updatedAt,
      savedAt: project.updatedAt,
      folder: "gargantua-readonly",
      currentBytes: new TextEncoder().encode(
        JSON.stringify({
          format: "solara-project",
          version: 2,
          projectId: project.id,
          exportedAt: project.updatedAt,
          project,
        }),
      ),
    },
  });
  try {
    for (const [width, height] of [
      [1366, 768],
      [390, 844],
      [320, 568],
    ]) {
      await page.setViewportSize({ width, height });
      await page.goto(managed.url);
      if (width < 821) {
        await expect(page.locator(".dashboard-store-detail.is-open")).toHaveCount(0);
      }
      await page.locator(".dashboard-store-card__button").first().click();
      const detail = page.getByRole("region", { name: "Tienda seleccionada: Stylo Lashes" });
      await expect(detail).toBeVisible();
      await expect(detail.getByRole("button", { name: "Abrir carpeta" })).toBeVisible();
      if (width < 821) {
        const bounds = await detail.evaluate((element) => {
          const rect = element.getBoundingClientRect();
          const identity = element
            .querySelector<HTMLElement>(".dashboard-store-detail__identity")
            ?.getBoundingClientRect();
          return {
            top: rect.top,
            bottom: rect.bottom,
            viewport: window.innerHeight,
            identityTop: identity?.top ?? null,
          };
        });
        expect(bounds.top).toBeGreaterThanOrEqual(0);
        expect(bounds.bottom).toBeLessThanOrEqual(bounds.viewport + 1);
        expect(bounds.identityTop).toBeGreaterThanOrEqual(0);
        if (width <= 340) expect(bounds.top).toBeLessThanOrEqual(9);
      }
      await page.screenshot({ path: `test-results/gargantua-managed-${width}.png` });
      expect(
        await detail.evaluate((el) => ({ scroll: el.scrollHeight, client: el.clientHeight })),
      ).toEqual(
        expect.objectContaining({ scroll: await detail.evaluate((el) => el.clientHeight) }),
      );
      await detail.getByRole("button", { name: "Calculadora", exact: true }).click();
      await expect(page.getByRole("dialog", { name: "Precio de tu tienda online" })).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(detail.getByRole("button", { name: "Calculadora", exact: true })).toBeFocused();
      // El dashboard bloquea el scroll de página y Chromium intenta realinear
      // este control contra el header aunque su punto visible esté libre.
      await detail.getByRole("button", { name: "Cerrar detalle" }).click({ force: true });
      await expect(page.getByRole("navigation", { name: "Páginas de tiendas" })).toBeVisible();
    }
    expect(managed.writeAttempts).toEqual([]);
  } finally {
    await stopStudioServer(managed.server);
  }
});
