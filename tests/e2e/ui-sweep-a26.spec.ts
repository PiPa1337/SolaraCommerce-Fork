/**
 * Barrido A26 (2026-08-10) — primitivas de UI (components/primitives.tsx).
 * Contrato de 3 capas sobre Toggle, Badge/StatusBadge, Tooltip, ProgressBar,
 * Pagination y SegmentedControl:
 * - funcional: click/hover reales → efecto visible (estado, rango, tono);
 * - auto-feedback: aria-checked/aria-current/aria-pressed/aria-valuenow y
 *   clases activas coherentes con la lógica;
 * - datos: la galería fija el contrato de props; los usos reales (Catálogo y
 *   Resumen de la tienda demo) trazan el payload hasta el estado del proyecto.
 *
 * Cobertura:
 * - Galería (/__studio/components): toggles, tooltip hover+teclado+posiciones,
 *   progressbar determinada/indeterminada, paginación completa con límites y
 *   clamp del resumen, badges/status badges con estilo aplicado.
 * - Usos reales: SegmentedControl de vista (lista/tarjetas) + Pagination del
 *   catálogo (50 productos), toggles de WhatsApp/navegación y StatusBadge del
 *   teléfono en Resumen, Tooltip del encabezado del Studio.
 */
import type { Server } from "node:http";
import { expect, test } from "@playwright/test";
import { openMutableScaleStore } from "./project-helpers";
import { startStudioServer, stopStudioServer } from "./studio-server";

test.setTimeout(process.env.CI ? 180_000 : 150_000);

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

async function resetIndexedDb(page: import("@playwright/test").Page) {
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
}

async function openDemoStore(page: import("@playwright/test").Page) {
  await resetIndexedDb(page);
  await page.locator('[data-store-card-id="store-modo-sur-demo"]').click();
  await page.getByRole("button", { name: "Abrir tienda", exact: true }).click();
  await expect(page.getByRole("navigation", { name: "Áreas de la tienda" })).toBeVisible({
    timeout: 30_000,
  });
}

async function openMutableDemoStore(page: import("@playwright/test").Page) {
  await resetIndexedDb(page);
  await openMutableScaleStore(page, "Tienda A26 mutable");
}

async function openGallery(page: import("@playwright/test").Page) {
  await page.route("**/__studio/components", (route) =>
    route.fulfill({ path: "apps/studio/dist/index.html" }),
  );
  await page.goto(`${studioUrl}/__studio/components`);
  await expect(page.getByRole("heading", { name: "Galería de componentes" })).toBeVisible();
}

/** Opacidad y contenido de la burbuja ::after del tooltip (CSS puro). */
async function tooltipState(
  wrapper: import("@playwright/test").Locator,
): Promise<{ opacity: string; content: string }> {
  return wrapper.evaluate((element) => {
    const after = getComputedStyle(element, "::after");
    return { opacity: after.opacity, content: after.content };
  });
}

test("galería: los toggles cambian su estado al hacer click y el deshabilitado no responde", async ({
  page,
}) => {
  await openGallery(page);

  const publish = page.getByRole("switch", { name: "Publicar", exact: true });
  await expect(publish).toHaveAttribute("aria-checked", "true");
  await expect(publish).toHaveAttribute("aria-labelledby", /.+/);

  await publish.click();
  await expect(publish).toHaveAttribute("aria-checked", "false");
  await publish.click();
  await expect(publish).toHaveAttribute("aria-checked", "true");

  const disabledToggle = page.getByRole("switch", { name: "Deshabilitado", exact: true });
  await expect(disabledToggle).toBeDisabled();
  await expect(disabledToggle).toHaveAttribute("aria-checked", "false");
  await disabledToggle.click({ force: true }).catch(() => undefined);
  await expect(disabledToggle).toHaveAttribute("aria-checked", "false");
});

test("galería: el tooltip aparece en hover y con foco por teclado, con posiciones", async ({
  page,
}) => {
  await openGallery(page);

  const archive = page.locator('.ui-tooltip:has-text("Archivar")');
  await expect(archive).toHaveClass(/ui-tooltip--top/);
  await expect(archive).toHaveAttribute(
    "data-tip",
    "Archiva la tienda y deja de publicar su sitio",
  );

  await archive.hover();
  await expect
    .poll(() => tooltipState(archive), { timeout: 5_000 })
    .toMatchObject({ opacity: "1" });
  const hovered = await tooltipState(archive);
  expect(hovered.content).toContain("Archiva la tienda y deja de publicar su sitio");

  const save = page.locator('.ui-tooltip:has-text("Guardar")');
  await expect(save).toHaveClass(/ui-tooltip--bottom/);
  await save.getByRole("button", { name: "Guardar", exact: true }).focus();
  await expect.poll(() => tooltipState(save), { timeout: 5_000 }).toMatchObject({ opacity: "1" });
  const focused = await tooltipState(save);
  expect(focused.content).toContain("Guarda los cambios en disco");

  await page.mouse.move(0, 0);
  await expect
    .poll(() => tooltipState(archive), { timeout: 5_000 })
    .toMatchObject({ opacity: "0" });
});

test("galería: la progressbar determinada expone aria-valuenow real y la indeterminada no", async ({
  page,
}) => {
  await openGallery(page);

  const determinate = page.getByRole("progressbar", { name: "Exportando", exact: true });
  await expect(determinate).toHaveAttribute("aria-valuemin", "0");
  await expect(determinate).toHaveAttribute("aria-valuemax", "100");
  await expect(determinate).toHaveAttribute("aria-valuenow", "40");
  const fillWidth = await determinate
    .locator(".ui-progress__fill")
    .evaluate((node) => (node as HTMLElement).style.width);
  expect(fillWidth).toBe("40%");

  const indeterminate = page.getByRole("progressbar", { name: "Procesando", exact: true });
  await expect(indeterminate).toHaveAttribute("aria-valuemax", "100");
  await expect(indeterminate).not.toHaveAttribute("aria-valuenow", /\d+/);
  await expect(indeterminate).toHaveClass(/ui-progress--indeterminate/);
});

test("galería: la paginación navega, marca la página actual y deshabilita en los límites", async ({
  page,
}) => {
  await openGallery(page);

  const pagination = page.getByTestId("ui-pagination");
  await expect(pagination).toBeVisible();
  await expect(pagination.locator(".ui-pagination__summary")).toHaveText("11–20 de 120");

  const prev = pagination.getByRole("button", { name: "Anterior", exact: true });
  const next = pagination.getByRole("button", { name: "Siguiente", exact: true });
  await expect(prev).toBeEnabled();
  await expect(next).toBeEnabled();
  await expect(pagination.getByRole("button", { name: "2", exact: true })).toHaveAttribute(
    "aria-current",
    "page",
  );
  await expect(pagination.locator(".ui-pagination__page--active")).toHaveText("2");
  await expect(pagination.locator(".ui-pagination__ellipsis")).toHaveCount(1);

  await pagination.getByRole("button", { name: "3", exact: true }).click();
  await expect(pagination.locator(".ui-pagination__summary")).toHaveText("21–30 de 120");
  await expect(pagination.getByRole("button", { name: "3", exact: true })).toHaveAttribute(
    "aria-current",
    "page",
  );

  await pagination.getByRole("button", { name: "12", exact: true }).click();
  await expect(pagination.locator(".ui-pagination__summary")).toHaveText("111–120 de 120");
  await expect(next).toBeDisabled();
  await expect(prev).toBeEnabled();

  await pagination.getByRole("button", { name: "1", exact: true }).click();
  await expect(pagination.locator(".ui-pagination__summary")).toHaveText("1–10 de 120");
  await expect(prev).toBeDisabled();
  await expect(next).toBeEnabled();
});

test("galería: el resumen de paginación nunca sale del rango al cambiar el tamaño de página", async ({
  page,
}) => {
  await openGallery(page);

  const pagination = page.getByTestId("ui-pagination");
  const size = pagination.getByLabel("Filas por página");
  await expect(size).toHaveValue("10");

  await pagination.getByRole("button", { name: "12", exact: true }).click();
  await expect(pagination.locator(".ui-pagination__summary")).toHaveText("111–120 de 120");

  await size.selectOption("25");
  await expect(size).toHaveValue("25");
  await expect(pagination.locator(".ui-pagination__summary")).toHaveText("101–120 de 120");
  await expect(pagination.getByRole("button", { name: "5", exact: true })).toHaveAttribute(
    "aria-current",
    "page",
  );
  await expect(pagination.getByRole("button", { name: "12", exact: true })).toHaveCount(0);
  await expect(pagination.getByRole("button", { name: "Siguiente", exact: true })).toBeDisabled();
  await expect(pagination.locator(".ui-pagination__summary")).not.toHaveText("276–120 de 120");

  // Aunque el estado recibido aún conserva page=12, la navegación usa la
  // página efectiva clamped (5) y no queda atrapada en la página fantasma.
  await pagination.getByRole("button", { name: "Anterior", exact: true }).click();
  await expect(pagination.locator(".ui-pagination__summary")).toHaveText("76–100 de 120");
  await expect(pagination.getByRole("button", { name: "4", exact: true })).toHaveAttribute(
    "aria-current",
    "page",
  );
});

test("galería: badges y status badges renderizan tonos con estilo aplicado", async ({ page }) => {
  await openGallery(page);

  const tones: Array<[string, string]> = [
    ["Borrador", "ui-badge--neutral"],
    ["Nuevo", "ui-badge--accent"],
    ["Activa", "ui-badge--success"],
    ["Revisar", "ui-badge--warning"],
    ["Crítico", "ui-badge--danger"],
    ["Info", "ui-badge--info"],
  ];
  const colors: string[] = [];
  for (const [label, className] of tones) {
    const badge = page.getByTestId("ui-badge").filter({ hasText: label }).first();
    await expect(badge).toHaveClass(new RegExp(className));
    const color = await badge.evaluate((node) => getComputedStyle(node).backgroundColor);
    colors.push(color);
  }
  const unique = new Set(colors);
  expect(unique.size).toBeGreaterThanOrEqual(5);

  const statuses: Array<[string, string, string]> = [
    ["Al día", "ui-status-badge--ok", "ui-badge--success"],
    ["Sitio desactualizado", "ui-status-badge--warning", "ui-badge--warning"],
    ["Error de auditoría", "ui-status-badge--error", "ui-badge--danger"],
    ["Sin exportar", "ui-status-badge--idle", "ui-badge--neutral"],
    ["Exportando", "ui-status-badge--busy", "ui-badge--neutral"],
  ];
  for (const [label, statusClass, toneClass] of statuses) {
    const badge = page.getByTestId("ui-badge").filter({ hasText: label }).first();
    await expect(badge).toHaveClass(new RegExp(statusClass));
    await expect(badge).toHaveClass(new RegExp(toneClass));
  }

  const okDot = page.locator(".ui-status-badge--ok .ui-status-badge__dot");
  const errorDot = page.locator(".ui-status-badge--error .ui-status-badge__dot");
  const okColor = await okDot.evaluate((node) => getComputedStyle(node).backgroundColor);
  const errorColor = await errorDot.evaluate((node) => getComputedStyle(node).backgroundColor);
  expect(okColor).not.toBe(errorColor);

  const busyDot = page.locator(".ui-status-badge--busy .ui-status-badge__dot");
  const busyAnimation = await busyDot.evaluate((node) => getComputedStyle(node).animationName);
  expect(busyAnimation).toContain("ui-pulse");
  const idleDot = page.locator(".ui-status-badge--idle .ui-status-badge__dot");
  const idleAnimation = await idleDot.evaluate((node) => getComputedStyle(node).animationName);
  expect(idleAnimation).not.toContain("ui-pulse");
});

test("catálogo real: el segmented cambia la vista y la paginación navega las 50 prendas", async ({
  page,
}) => {
  await openDemoStore(page);
  await page.getByRole("tab", { name: "Catálogo", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Catálogo" })).toBeVisible();

  const segmented = page.getByTestId("ui-segmented");
  await expect(segmented).toHaveAttribute("aria-label", "Vista del catálogo");
  const tableOption = segmented.getByRole("button", { name: "Lista", exact: true });
  const cardsOption = segmented.getByRole("button", { name: "Tarjetas", exact: true });
  const initialCards = (await cardsOption.getAttribute("aria-pressed")) === "true";

  if (initialCards) {
    await tableOption.click();
    await expect(tableOption).toHaveAttribute("aria-pressed", "true");
    await expect(cardsOption).toHaveAttribute("aria-pressed", "false");
    await expect(page.locator(".table-shell")).toBeVisible();
    await expect(page.getByTestId("ui-catalog-cards")).toHaveCount(0);
  }
  await cardsOption.click();
  await expect(cardsOption).toHaveAttribute("aria-pressed", "true");
  await expect(tableOption).toHaveAttribute("aria-pressed", "false");
  await expect(page.getByTestId("ui-catalog-cards")).toBeVisible();
  await expect(page.locator(".table-shell")).toHaveCount(0);

  await tableOption.click();
  await expect(tableOption).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".table-shell")).toBeVisible();

  const pagination = page.getByTestId("ui-pagination");
  await expect(pagination).toBeVisible();
  await expect(pagination.locator(".ui-pagination__summary")).toHaveText("1–50 de 50");
  const prev = pagination.getByRole("button", { name: "Anterior", exact: true });
  const next = pagination.getByRole("button", { name: "Siguiente", exact: true });
  await expect(prev).toBeDisabled();
  await expect(next).toBeDisabled();
  await expect(pagination.locator(".ui-pagination__page")).toHaveCount(1);
  await page.getByLabel("Nombre de Remera esencial de algodón").isVisible();

  const size = pagination.getByLabel("Filas por página");
  await size.selectOption("25");
  await expect(pagination.locator(".ui-pagination__summary")).toHaveText("1–25 de 50");
  await expect(prev).toBeDisabled();
  await expect(next).toBeEnabled();

  await pagination.getByRole("button", { name: "2", exact: true }).click();
  await expect(pagination.locator(".ui-pagination__summary")).toHaveText("26–50 de 50");
  await expect(pagination.getByRole("button", { name: "2", exact: true })).toHaveAttribute(
    "aria-current",
    "page",
  );
  await expect(page.locator(".table-shell tbody tr")).toHaveCount(25);
  await expect(page.getByLabel("Nombre de Remera gráfica Ruta")).toBeVisible();
  await expect(prev).toBeEnabled();
  await expect(next).toBeDisabled();

  await pagination.getByRole("button", { name: "1", exact: true }).click();
  await expect(pagination.locator(".ui-pagination__summary")).toHaveText("1–25 de 50");
  await expect(page.getByLabel("Nombre de Remera esencial de algodón")).toBeVisible();
  await expect(prev).toBeDisabled();

  await size.selectOption("100");
  await expect(pagination.locator(".ui-pagination__summary")).toHaveText("1–50 de 50");
  await expect(pagination.locator(".ui-pagination__page")).toHaveCount(1);
  await expect(prev).toBeDisabled();
  await expect(next).toBeDisabled();
});

test("resumen real: los toggles commitean y el status badge reacciona al teléfono", async ({
  page,
}) => {
  await openMutableDemoStore(page);
  await page.getByRole("tab", { name: "Resumen", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Resumen" })).toBeVisible();

  const phone = page.getByLabel("Número internacional");
  const initiallyMissing = page.locator(".ui-status-badge--idle").filter({ hasText: "Pendiente" });
  await expect(initiallyMissing).toBeVisible();

  const phoneBadge = page.locator(".ui-status-badge--ok").filter({ hasText: "Formato correcto" });
  await phone.fill("5491123456789");
  await expect(phoneBadge).toBeVisible();

  await phone.fill("123");
  const warning = page.locator(".ui-status-badge--warning").filter({ hasText: "Revisar formato" });
  await expect(warning).toBeVisible();

  await phone.fill("");
  const idle = page.locator(".ui-status-badge--idle").filter({ hasText: "Pendiente" });
  await expect(idle).toBeVisible();

  await phone.fill("5491122334455");
  await expect(phoneBadge).toBeVisible({ timeout: 5_000 });

  const skuToggle = page.getByRole("switch", { name: "Incluir SKU en el mensaje", exact: true });
  const initial = await skuToggle.getAttribute("aria-checked");
  expect(initial).not.toBeNull();
  await skuToggle.click();
  await expect(skuToggle).toHaveAttribute("aria-checked", initial === "true" ? "false" : "true");
  await expect(page.getByTestId("ui-save-indicator")).toContainText("Sin guardar", {
    timeout: 5_000,
  });
  await skuToggle.click();
  await expect(skuToggle).toHaveAttribute("aria-checked", initial === "true" ? "true" : "false");
});

test("studio real: el tooltip del encabezado aparece al pasar el mouse", async ({ page }) => {
  await openDemoStore(page);

  const backButton = page.getByRole("button", { name: "Volver a tiendas", exact: true });
  const wrapper = backButton.locator("..");
  await expect(wrapper).toHaveClass(/ui-tooltip/);
  await expect(wrapper).toHaveClass(/ui-tooltip--bottom/);
  await expect(wrapper).toHaveAttribute("data-tip", "Volver a tiendas");

  await backButton.hover();
  await expect
    .poll(() => tooltipState(wrapper), { timeout: 5_000 })
    .toMatchObject({ opacity: "1" });
  const shown = await tooltipState(wrapper);
  expect(shown.content).toContain("Volver a tiendas");
});
