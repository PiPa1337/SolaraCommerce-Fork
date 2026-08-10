/**
 * Barrido A14 — Studio: tabs, paneles, foco y tema del shell (OWNER:
 * `apps/studio/src/features/Studio.tsx`).
 *
 * Contrato de 3 capas por control: (1) click/tecla → efecto real en estado o
 * datos, (2) auto-feedback del control (aria-selected / aria-pressed /
 * aria-hidden / clase coherente con la lógica), (3) contrato de datos
 * (payload → receptor: pestaña → panel con data-tab, pane → localStorage,
 * tema → atributo `data-studio-theme` en <html> + localStorage).
 *
 * Cobertura: tabs (cambio de panel, aria-selected, roving tabindex, puntos
 * sucios), pane abrir/cerrar (clase, aria-hidden, foco restaurado, persistencia
 * y Ctrl+\), modo foco (cambio visual + foco restaurado + Escape y Ctrl+Shift+F),
 * tema (chrome re-estilizado, aria-pressed/label coherentes con el tema efectivo
 * incluida la preferencia del sistema), breadcrumb volver y teclado de tabs
 * (flechas con wrap, Home/End).
 */
import type { Server } from "node:http";
import { expect, type Locator, type Page, test } from "@playwright/test";
import { startStudioServer, stopStudioServer } from "./studio-server";

test.setTimeout(process.env.CI ? 180_000 : 120_000);

const FAKE_START = new Date("2026-08-10T08:00:00");
const FAKE_PAUSE = new Date("2026-08-10T08:30:00");

const DEMO_STORE_ID = "store-modo-sur-demo";

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

async function wipeIndexedDb(page: Page): Promise<void> {
  await page.evaluate(
    () =>
      new Promise<void>((resolvePromise, reject) => {
        const request = indexedDB.deleteDatabase("solara-commerce-studio");
        request.addEventListener("success", () => resolvePromise());
        request.addEventListener("error", () => reject(request.error));
        request.addEventListener("blocked", () =>
          reject(new Error("No se pudo limpiar la base de Studio.")),
        );
      }),
  );
}

async function openDemoStore(page: Page): Promise<void> {
  await page.goto(studioUrl);
  await wipeIndexedDb(page);
  await page.reload();
  await expect(page.getByRole("heading", { name: "Tus tiendas" })).toBeVisible({
    timeout: 30_000,
  });
  await page.locator(`[data-store-card-id="${DEMO_STORE_ID}"]`).click();
  await page.getByRole("button", { name: "Abrir tienda", exact: true }).click();
  await expect(page.getByRole("navigation", { name: "Áreas de la tienda" })).toBeVisible();
}

/** Selecciona la sección Hero en el Constructor de la tienda demo. */
async function openHeroInspector(page: Page): Promise<void> {
  await page.getByRole("tab", { name: "Constructor", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Constructor", exact: true })).toBeVisible();
  const hero = page.getByRole("listitem").filter({ hasText: "Hero de catálogo" });
  await hero.getByRole("button").first().click();
  await expect(page.getByRole("textbox", { name: "Título", exact: true })).toBeVisible();
}

const pane = (page: Page): Locator => page.locator("[data-studio-editor-pane]");

const tabByName = (page: Page, name: string): Locator =>
  page.getByRole("tab", { name, exact: true });

test("A14.1 tabs — el click cambia el panel, aria-selected, roving tabindex y el contrato de datos del pane", async ({
  page,
}) => {
  await openDemoStore(page);

  // Estado inicial: Preparar activa, las demás inactivas, roving tabindex y
  // el pane arranca cerrado (se abre al elegir una pestaña).
  await expect(tabByName(page, "Preparar")).toHaveAttribute("aria-selected", "true");
  await expect(tabByName(page, "Preparar")).toHaveAttribute("tabindex", "0");
  for (const name of [
    "Resumen",
    "Catálogo",
    "Constructor",
    "Tema",
    "Recursos",
    "SEO",
    "Exportar",
  ]) {
    await expect(tabByName(page, name)).toHaveAttribute("aria-selected", "false");
    await expect(tabByName(page, name)).toHaveAttribute("tabindex", "-1");
  }
  await expect(pane(page)).toHaveClass(/editor-pane--closed/);
  await expect(pane(page)).toHaveAttribute("aria-hidden", "true");

  // Click en Catálogo: efecto real (panel nuevo) y auto-feedback coherente.
  await tabByName(page, "Catálogo").click();
  await expect(tabByName(page, "Catálogo")).toHaveAttribute("aria-selected", "true");
  await expect(tabByName(page, "Preparar")).toHaveAttribute("aria-selected", "false");
  await expect(page.getByRole("heading", { name: "Catálogo", exact: true })).toBeVisible();
  await expect(pane(page)).toHaveAttribute("data-tab", "catalog");
  await expect(pane(page)).toHaveClass(/editor-pane--open/);
  await expect(tabByName(page, "Catálogo")).toBeFocused();

  // Contrato de datos: la tab activa declara aria-controls = id del tabpanel y
  // el tabpanel declara aria-labelledby = id de la tab activa.
  const paneId = await pane(page).getAttribute("id");
  expect(paneId).toBeTruthy();
  await expect(tabByName(page, "Catálogo")).toHaveAttribute("aria-controls", String(paneId));
  await expect(pane(page)).toHaveAttribute("aria-labelledby", "studio-tab-catalog");
  await expect(pane(page)).toHaveAttribute("role", "tabpanel");
  await expect(pane(page)).toHaveAttribute("aria-hidden", "false");
});

test("A14.2 tabs — los puntos sucios aparecen con el cambio, se limpian al visitar y al guardar", async ({
  page,
}) => {
  await page.clock.install({ time: FAKE_START });
  await openDemoStore(page);
  await openHeroInspector(page);
  await page.clock.pauseAt(FAKE_PAUSE);

  // Sin cambios: ningún punto.
  await expect(page.getByTestId("ui-tab-dirty")).toHaveCount(0);

  // Un único cambio marca las 7 pestañas ajenas (la activa está visitada).
  const title = page.getByRole("textbox", { name: "Título", exact: true });
  await title.fill("Cambio único A14");
  await expect(page.getByText("Cambios pendientes", { exact: true })).toBeVisible();
  await expect(page.getByTestId("ui-tab-dirty")).toHaveCount(7);
  await expect(tabByName(page, "Resumen").getByTestId("ui-tab-dirty")).toBeVisible();
  await expect(tabByName(page, "Catálogo").getByTestId("ui-tab-dirty")).toBeVisible();
  await expect(tabByName(page, "Constructor").getByTestId("ui-tab-dirty")).toHaveCount(0);

  // Visitar una pestaña limpia su punto; el guardado limpia el resto.
  await tabByName(page, "Resumen").click();
  await expect(page.getByRole("heading", { name: "Resumen", exact: true })).toBeVisible();
  await expect(page.getByTestId("ui-tab-dirty")).toHaveCount(6);
  await expect(tabByName(page, "Resumen").getByTestId("ui-tab-dirty")).toHaveCount(0);

  await page.clock.runFor(1_000);
  await expect(page.getByText(/^Guardado \d{2}:\d{2}$/)).toBeVisible();
  await expect(page.getByTestId("ui-tab-dirty")).toHaveCount(0);
});

test("A14.3 pane — cerrar/abrir con efecto real, persistencia y foco restaurado al tab", async ({
  page,
}) => {
  await openDemoStore(page);
  await tabByName(page, "Catálogo").click();
  await expect(page.getByRole("heading", { name: "Catálogo", exact: true })).toBeVisible();
  await expect(pane(page)).toHaveClass(/editor-pane--open/);
  await expect(pane(page)).toHaveAttribute("aria-hidden", "false");

  // Cerrar con la X: el pane se oculta y el foco vuelve al tab activo
  // (el contenido del pane deja de ser interactivo y no queda foco perdido).
  await page.getByRole("button", { name: "Cerrar panel de edición" }).click();
  await expect(pane(page)).toHaveClass(/editor-pane--closed/);
  await expect(pane(page)).toHaveAttribute("aria-hidden", "true");
  await expect(pane(page)).toBeHidden();
  await expect(tabByName(page, "Catálogo")).toBeFocused();
  let stored = await page.evaluate(() =>
    localStorage.getItem("solara-editor-pane:store-modo-sur-demo"),
  );
  expect(stored).toBe("closed");

  // Reabrir desde la toolbar: el panel vuelve y el feedback cambia.
  await page.getByRole("button", { name: "Abrir panel de edición" }).click();
  await expect(pane(page)).toHaveClass(/editor-pane--open/);
  await expect(pane(page)).toHaveAttribute("aria-hidden", "false");
  await expect(pane(page)).toBeVisible();
  stored = await page.evaluate(() =>
    localStorage.getItem("solara-editor-pane:store-modo-sur-demo"),
  );
  expect(stored).toBe("open");

  // El pane cerrado no se reabre al cambiar de pestaña (H3-B3): la pestaña
  // cambia (data-tab) pero el panel sigue oculto.
  await page.getByRole("button", { name: "Cerrar panel de edición" }).click();
  await expect(pane(page)).toHaveClass(/editor-pane--closed/);
  await tabByName(page, "Resumen").click();
  await expect(tabByName(page, "Resumen")).toHaveAttribute("aria-selected", "true");
  await expect(pane(page)).toHaveAttribute("data-tab", "overview");
  await expect(pane(page)).toHaveClass(/editor-pane--closed/);
  await expect(pane(page)).toBeHidden();
  await page.getByRole("button", { name: "Abrir panel de edición" }).click();
  await expect(pane(page)).toHaveClass(/editor-pane--open/);
  await expect(page.getByRole("heading", { name: "Resumen", exact: true })).toBeVisible();
  await expect(pane(page)).toHaveAttribute("data-tab", "overview");
});

test("A14.4 pane — Ctrl+\\ cierra con el foco dentro del panel y lo devuelve al tab", async ({
  page,
}) => {
  await openDemoStore(page);
  await openHeroInspector(page);
  const title = page.getByRole("textbox", { name: "Título", exact: true });
  await title.focus();
  await expect(title).toBeFocused();

  await page.keyboard.press("Control+\\");
  await expect(pane(page)).toHaveClass(/editor-pane--closed/);
  await expect(pane(page)).toHaveAttribute("aria-hidden", "true");
  await expect(tabByName(page, "Constructor")).toBeFocused();

  // Ctrl+\ vuelve a abrirlo.
  await page.keyboard.press("Control+\\");
  await expect(pane(page)).toHaveClass(/editor-pane--open/);
  await expect(pane(page)).toHaveAttribute("aria-hidden", "false");
  await expect(title).toBeVisible();
});

test("A14.5 pane — la persistencia del estado cerrado sobrevive a la recarga", async ({ page }) => {
  await openDemoStore(page);
  await tabByName(page, "Catálogo").click();
  await expect(pane(page)).toHaveClass(/editor-pane--open/);
  await page.getByRole("button", { name: "Cerrar panel de edición" }).click();
  await expect(pane(page)).toHaveClass(/editor-pane--closed/);

  // Recarga completa: el Studio vuelve a montarse con el pane cerrado.
  await page.reload();
  await expect(page.getByRole("heading", { name: "Tus tiendas" })).toBeVisible();
  await page.locator(`[data-store-card-id="${DEMO_STORE_ID}"]`).click();
  await page.getByRole("button", { name: "Abrir tienda", exact: true }).click();
  await expect(page.getByRole("navigation", { name: "Áreas de la tienda" })).toBeVisible();
  await expect(pane(page)).toHaveClass(/editor-pane--closed/);
  await expect(pane(page)).toBeHidden();
  await expect(page.getByRole("button", { name: "Abrir panel de edición" })).toBeVisible();
});

test("A14.6 modo foco — cambio visual del shell, foco restaurado y salida con Escape/atajo", async ({
  page,
}) => {
  await openDemoStore(page);
  const toggle = page.getByTestId("ui-focus-toggle");
  const shell = page.locator(".studio-shell");
  const preview = page.locator('iframe[title="Vista previa desktop"]');
  await expect(preview).toBeVisible();

  // Entrar: el shell oculta chrome (topbar, nav, statusbar), deja el preview y
  // el foco va al botón flotante de salida.
  await toggle.click();
  await expect(shell).toHaveAttribute("data-studio-focus", "true");
  await expect(page.locator(".studio-topbar")).toBeHidden();
  await expect(page.locator(".studio-nav")).toBeHidden();
  await expect(page.getByTestId("ui-status-bar")).toBeHidden();
  await expect(preview).toBeVisible();
  await expect(toggle).toHaveAttribute("aria-pressed", "true");
  const exit = page.getByTestId("ui-focus-exit");
  await expect(exit).toBeVisible();
  await expect(exit).toBeFocused();
  await expect(
    page.getByRole("button", { name: "Salir del modo foco", exact: true }),
  ).toBeVisible();

  // Escape sale y devuelve el foco al toggle.
  await page.keyboard.press("Escape");
  await expect(shell).not.toHaveAttribute("data-studio-focus", "true");
  await expect(page.locator(".studio-topbar")).toBeVisible();
  await expect(exit).toHaveCount(0);
  await expect(toggle).toBeFocused();
  await expect(toggle).toHaveAttribute("aria-pressed", "false");

  // Ctrl+Shift+F entra de nuevo y el botón flotante queda enfocado.
  await page.keyboard.press("Control+Shift+f");
  await expect(shell).toHaveAttribute("data-studio-focus", "true");
  await expect(page.getByTestId("ui-focus-exit")).toBeFocused();

  // El botón flotante sale y restaura el foco al toggle.
  await page.getByTestId("ui-focus-exit").click();
  await expect(shell).not.toHaveAttribute("data-studio-focus", "true");
  await expect(toggle).toBeFocused();
});

test("A14.7 tema — el toggle re-estiliza el chrome, refleja su estado y persiste", async ({
  page,
}) => {
  await openDemoStore(page);
  const toggle = page.getByTestId("ui-theme-toggle");
  const root = page.locator("html");

  // Sin override: sin atributo, chrome claro (paleta por defecto).
  await expect(root).not.toHaveAttribute("data-studio-theme");
  await expect(toggle).toHaveAttribute("aria-pressed", "false");
  await expect(toggle).toHaveAttribute("aria-label", "Usar tema oscuro");
  await expect
    .poll(() => page.evaluate(() => getComputedStyle(document.body).backgroundColor))
    .toBe("rgb(238, 234, 225)");

  // Primer click: tema oscuro aplicado + feedback del control coherente.
  await toggle.click();
  await expect(root).toHaveAttribute("data-studio-theme", "dark");
  await expect
    .poll(() => page.evaluate(() => getComputedStyle(document.body).backgroundColor))
    .toBe("rgb(23, 26, 23)");
  await expect(toggle).toHaveAttribute("aria-pressed", "true");
  await expect(toggle).toHaveAttribute("aria-label", "Usar tema claro");
  await expect(page.evaluate(() => localStorage.getItem("solara-studio-theme"))).resolves.toBe(
    "dark",
  );

  // Segundo click: vuelve al claro, con el mismo contrato de feedback.
  await toggle.click();
  await expect(root).toHaveAttribute("data-studio-theme", "light");
  await expect
    .poll(() => page.evaluate(() => getComputedStyle(document.body).backgroundColor))
    .toBe("rgb(238, 234, 225)");
  await expect(toggle).toHaveAttribute("aria-pressed", "false");
  await expect(toggle).toHaveAttribute("aria-label", "Usar tema oscuro");

  // Persistencia: la recarga conserva el override; el atributo se aplica al
  // abrir el editor y el chrome oscuro no depende de la preferencia del sistema.
  await toggle.click();
  await expect(root).toHaveAttribute("data-studio-theme", "dark");
  await page.reload();
  await expect(page.getByRole("heading", { name: "Tus tiendas" })).toBeVisible();
  await page.locator(`[data-store-card-id="${DEMO_STORE_ID}"]`).click();
  await page.getByRole("button", { name: "Abrir tienda", exact: true }).click();
  await expect(page.getByRole("navigation", { name: "Áreas de la tienda" })).toBeVisible();
  await expect(root).toHaveAttribute("data-studio-theme", "dark");
  await expect
    .poll(() => page.evaluate(() => getComputedStyle(document.body).backgroundColor))
    .toBe("rgb(23, 26, 23)");
  await expect(toggle).toHaveAttribute("aria-pressed", "true");
});

test("A14.8 tema — con preferencia del sistema oscura el toggle refleja el tema efectivo", async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await openDemoStore(page);
  const toggle = page.getByTestId("ui-theme-toggle");
  const root = page.locator("html");

  // Sin override la app sigue al sistema: chrome oscuro y el toggle lo dice.
  await expect(root).not.toHaveAttribute("data-studio-theme");
  await expect
    .poll(() => page.evaluate(() => getComputedStyle(document.body).backgroundColor))
    .toBe("rgb(23, 26, 23)");
  await expect(toggle).toHaveAttribute("aria-pressed", "true");
  await expect(toggle).toHaveAttribute("aria-label", "Usar tema claro");

  // El primer click NO es un no-op: fija el override claro sobre el sistema.
  await toggle.click();
  await expect(root).toHaveAttribute("data-studio-theme", "light");
  await expect
    .poll(() => page.evaluate(() => getComputedStyle(document.body).backgroundColor))
    .toBe("rgb(238, 234, 225)");
  await expect(toggle).toHaveAttribute("aria-pressed", "false");
  await expect(toggle).toHaveAttribute("aria-label", "Usar tema oscuro");

  // Y un segundo click vuelve al oscuro explícito.
  await toggle.click();
  await expect(root).toHaveAttribute("data-studio-theme", "dark");
  await expect(toggle).toHaveAttribute("aria-pressed", "true");
});

test("A14.9 breadcrumb — volver al dashboard con la flecha y con el enlace Tiendas", async ({
  page,
}) => {
  await openDemoStore(page);

  // Enlace «Tiendas» del breadcrumb: vuelve al dashboard.
  await page.getByRole("button", { name: "Tiendas", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Tus tiendas" })).toBeVisible();

  // La flecha «Volver a tiendas» de la topbar hace lo mismo desde el editor.
  await page.locator(`[data-store-card-id="${DEMO_STORE_ID}"]`).click();
  await page.getByRole("button", { name: "Abrir tienda", exact: true }).click();
  await expect(page.getByRole("navigation", { name: "Áreas de la tienda" })).toBeVisible();
  await page.getByRole("button", { name: "Volver a tiendas" }).click();
  await expect(page.getByRole("heading", { name: "Tus tiendas" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Áreas de la tienda" })).toHaveCount(0);
});

test("A14.10 teclado de tabs — flechas con wrap, Home y End mueven foco y selección", async ({
  page,
}) => {
  await openDemoStore(page);
  const tablist = page.getByRole("tablist", { name: "Áreas de la tienda" });

  const preparar = tabByName(page, "Preparar");
  await preparar.focus();
  await expect(preparar).toBeFocused();

  // ArrowDown: mueve y selecciona la siguiente (comportamiento cableado).
  await page.keyboard.press("ArrowDown");
  await expect(tabByName(page, "Resumen")).toBeFocused();
  await expect(tabByName(page, "Resumen")).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("heading", { name: "Resumen", exact: true })).toBeVisible();
  await expect(preparar).toHaveAttribute("aria-selected", "false");
  await expect(preparar).toHaveAttribute("tabindex", "-1");

  await page.keyboard.press("ArrowDown");
  await expect(tabByName(page, "Catálogo")).toBeFocused();
  await expect(tabByName(page, "Catálogo")).toHaveAttribute("aria-selected", "true");

  // ArrowUp: retrocede.
  await page.keyboard.press("ArrowUp");
  await expect(tabByName(page, "Resumen")).toBeFocused();
  await expect(tabByName(page, "Resumen")).toHaveAttribute("aria-selected", "true");

  // Home / End: primero y último.
  await page.keyboard.press("Home");
  await expect(tabByName(page, "Preparar")).toBeFocused();
  await expect(tabByName(page, "Preparar")).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("heading", { name: "Preparar tienda" })).toBeVisible();

  await page.keyboard.press("End");
  await expect(tabByName(page, "Exportar")).toBeFocused();
  await expect(tabByName(page, "Exportar")).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("heading", { name: "Exportar", exact: true })).toBeVisible();

  // Izquierda desde el último retrocede en la lista (sin wrap en el borde).
  await page.keyboard.press("ArrowLeft");
  await expect(tabByName(page, "SEO")).toBeFocused();
  await expect(tabByName(page, "SEO")).toHaveAttribute("aria-selected", "true");

  // El wrap está cableado sólo en el primer elemento: izquierda en Preparar
  // va al último y derecha en Exportar vuelve al primero.
  await page.keyboard.press("Home");
  await expect(tabByName(page, "Preparar")).toBeFocused();
  await page.keyboard.press("ArrowLeft");
  await expect(tabByName(page, "Exportar")).toBeFocused();
  await expect(tabByName(page, "Exportar")).toHaveAttribute("aria-selected", "true");
  await page.keyboard.press("ArrowRight");
  await expect(tabByName(page, "Preparar")).toBeFocused();
  await expect(tabByName(page, "Preparar")).toHaveAttribute("aria-selected", "true");
  await expect(tablist.locator('[role="tab"][tabindex="0"]')).toHaveCount(1);
});

test.fixme(
  "A14: el punto sucio no se anuncia a lectores de pantalla (span aria-hidden con title)",
  async ({ page }) => {
    await page.clock.install({ time: FAKE_START });
    await openDemoStore(page);
    await openHeroInspector(page);
    await page.clock.pauseAt(FAKE_PAUSE);

    const title = page.getByRole("textbox", { name: "Título", exact: true });
    await title.fill("Cambio único A14");
    await expect(page.getByText("Cambios pendientes", { exact: true })).toBeVisible();
    // La pestaña con cambios debe exponer el estado pendiente en su nombre
    // accesible; hoy el punto es aria-hidden y sólo lleva title.
    await expect(tabByName(page, "Resumen")).toHaveAccessibleName(/cambios sin revisar/i);
  },
);
