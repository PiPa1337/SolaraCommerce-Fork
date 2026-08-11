import type { Server } from "node:http";
import { expect, type Locator, type Page, test } from "@playwright/test";
import { startStudioServer, stopStudioServer } from "./studio-server";

/**
 * Barrido A16 — ThemeEditor completo: efecto real, auto-feedback y contrato
 * de datos de TODOS los controles de tema.
 *
 * Capa 2 (auto-feedback) es el foco: cada control debe comunicar su estado
 * (preset marcado, error inline, disabled, campo que refleja lo escrito).
 * Capa 3 (datos): los valores editados llegan a los tokens CSS del preview
 * con los mismos nombres que lee el exporter (themeCss → --solara-*).
 */

test.setTimeout(process.env.CI ? 60_000 : 30_000);

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

async function setupCleanStore(page: Page, name: string): Promise<void> {
  await page.goto(studioUrl);
  await page.evaluate(
    () =>
      new Promise<void>((resolve, reject) => {
        const request = indexedDB.deleteDatabase("solara-commerce-studio");
        request.addEventListener("success", () => resolve());
        request.addEventListener("error", () => reject(request.error));
        request.addEventListener("blocked", () => reject(new Error("La base quedó bloqueada.")));
      }),
  );
  await page.reload();
  // El borrado de la DB deja la app arrancando con lentitud en máquinas
  // cargadas; los timeouts generosos evitan depender del helper compartido
  // (que asume 5s por paso).
  await expect(page.getByRole("heading", { name: "Tus tiendas" })).toBeVisible({
    timeout: 30_000,
  });
  await page.getByRole("button", { name: "Nueva tienda", exact: true }).click();
  await page.getByLabel("Nueva tienda").fill(name);
  await page.getByRole("button", { name: "Continuar", exact: true }).click();
  await page.getByRole("button", { name: "Continuar", exact: true }).click();
  await page.getByRole("button", { name: "Continuar", exact: true }).click();
  await page.getByRole("button", { name: "Crear tienda vacía", exact: true }).click();
  await expect(page.getByRole("navigation", { name: "Áreas de la tienda" })).toBeVisible({
    timeout: 30_000,
  });
}

async function openThemeTab(page: Page): Promise<void> {
  await page.getByRole("tab", { name: "Tema", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Tema", exact: true })).toBeVisible();
}

function fieldsetOf(input: Locator): Locator {
  return input.locator("xpath=ancestor::fieldset[contains(@class, 'field')]");
}

function previewRoot(page: Page): Locator {
  return page.frameLocator('iframe[title="Vista previa desktop"]').locator("html");
}

/** El div raíz del sitio público (lleva data-color-mode, data-design-family…). */
function previewPage(page: Page): Locator {
  return page.frameLocator('iframe[title="Vista previa desktop"]').locator(".solara-page");
}

function previewBackground(page: Page): () => Promise<string> {
  const html = previewRoot(page);
  return () => html.evaluate((element) => getComputedStyle(element).backgroundColor);
}

function previewVar(page: Page, name: string): () => Promise<string> {
  const html = previewRoot(page);
  return () =>
    html.evaluate(
      (element, token) => getComputedStyle(element).getPropertyValue(token).trim(),
      name,
    );
}

/** Cambia un input type="color" como lo haría el picker nativo y commitea. */
async function pickNativeColor(locator: Locator, hex: string): Promise<void> {
  await locator.evaluate((element, value) => {
    const input = element as HTMLInputElement;
    // React rastrea el value con un descriptor propio; asignar la propiedad
    // directamente no actualiza su tracker y el onChange nunca se dispara.
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    setter?.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }, hex);
}

test("presets: aplicar y desaplicar actualiza la marca activa en ambos sentidos", async ({
  page,
}) => {
  await setupCleanStore(page, "A16 presets");
  await openThemeTab(page);

  const presets = page.getByTestId("ui-theme-preset");
  const editorial = presets.filter({ hasText: "Editorial cálido" });
  const terracotta = presets.filter({ hasText: "Costa terracota" });

  // Al abrir, la paleta por defecto del fixture está activa.
  await expect(editorial).toHaveAttribute("aria-pressed", "true");
  await expect(editorial).toHaveAttribute("data-active", "true");
  await expect(terracotta).toHaveAttribute("aria-pressed", "false");

  await terracotta.click();
  await expect(terracotta).toHaveAttribute("aria-pressed", "true");
  await expect(editorial).toHaveAttribute("aria-pressed", "false");
  await expect
    .poll(() => terracotta.evaluate((el) => getComputedStyle(el, "::after").content))
    .toContain("Aplicada");

  // Deshacer vuelve la marca a la paleta anterior: el estado es derivado
  // del proyecto, no un flag que se quedó colgado.
  await page.keyboard.press("ControlOrMeta+z");
  await expect(editorial).toHaveAttribute("aria-pressed", "true");
  await expect(terracotta).toHaveAttribute("aria-pressed", "false");
});

test("un preset aplicado pierde la marca al editar un color a mano", async ({ page }) => {
  await setupCleanStore(page, "A16 preset+edición");
  await openThemeTab(page);

  const presets = page.getByTestId("ui-theme-preset");
  const editorial = presets.filter({ hasText: "Editorial cálido" });

  await page.getByRole("button", { name: "Aplicar paleta Salvia serena" }).click();
  await expect(editorial).toHaveAttribute("aria-pressed", "false");

  const accentText = page.getByTestId("ui-color-text-accent");
  await accentText.fill("#aa0000");
  await expect(accentText).toHaveValue("#aa0000");
  await expect(page.getByTestId("ui-color-native-accent")).toHaveValue("#aa0000");
  await expect(editorial).toHaveAttribute("aria-pressed", "false");

  // Restaurar vuelve a la paleta de apertura y la marca de "Editorial cálido".
  await page.getByTestId("ui-reset-colors").click();
  await expect(accentText).toHaveValue("#0b0b0c");
  await expect(editorial).toHaveAttribute("aria-pressed", "true");
});

test("input de color: hex válido commitea en preview y picker nativo", async ({ page }) => {
  await setupCleanStore(page, "A16 hex válido");
  await openThemeTab(page);

  const accentText = page.getByTestId("ui-color-text-accent");
  const accentNative = page.getByTestId("ui-color-native-accent");

  await accentText.fill("#B4552D");
  await expect(accentText).toHaveValue("#b4552d");
  await expect(accentNative).toHaveValue("#b4552d");
  await expect(accentText).not.toHaveAttribute("aria-invalid", "true");
  // El contraste del par acento reacciona al nuevo color en vivo (aria-live).
  await expect(page.getByTestId("ui-contrast-ok")).toHaveCount(3);
});

test("input de color: hex inválido se rechaza con error inline y sin commit", async ({ page }) => {
  await setupCleanStore(page, "A16 hex inválido");
  await openThemeTab(page);

  const accentText = page.getByTestId("ui-color-text-accent");
  const accentNative = page.getByTestId("ui-color-native-accent");
  const accentField = fieldsetOf(accentText);
  const originalNative = await accentNative.inputValue();

  await accentText.fill("no-es-hex");
  await expect(accentText).toHaveAttribute("aria-invalid", "true");
  await expect(accentField.getByTestId("ui-field-error")).toContainText("Ingresá un color hex");
  await expect(accentText).toHaveValue("no-es-hex");
  await expect(accentNative).toHaveValue(originalNative);

  // Corregir el texto limpia el error: feedback coherente con la validación.
  await accentText.fill(originalNative);
  await expect(accentText).not.toHaveAttribute("aria-invalid", "true");
  await expect(accentField.getByTestId("ui-field-error")).toHaveCount(0);
  await expect(accentNative).toHaveValue(originalNative);
});

test("picker nativo de color actualiza el texto y el preview", async ({ page }) => {
  await setupCleanStore(page, "A16 picker nativo");
  await openThemeTab(page);

  const backgroundNative = page.getByTestId("ui-color-native-background");
  const backgroundText = page.getByTestId("ui-color-text-background");

  await pickNativeColor(backgroundNative, "#1e2a3a");

  await expect(backgroundText).toHaveValue("#1e2a3a");
  await expect(backgroundNative).toHaveValue("#1e2a3a");
  await expect.poll(previewBackground(page), { timeout: 15_000 }).toBe("rgb(30, 42, 58)");
});

test("colorMode: Sistema cambia el preview y Oscuro está deshabilitado con aviso", async ({
  page,
}) => {
  await setupCleanStore(page, "A16 colorMode");
  await openThemeTab(page);

  const modeSelect = page.getByLabel("Modo", { exact: true });
  const modeField = fieldsetOf(modeSelect);
  // La tienda nueva (fixture Catalog Modern) inicia en "light".
  await expect(modeSelect).toHaveValue("light");

  // Opción deshabilitada: feedback del control sobre su propia limitación.
  const darkOption = modeSelect.locator("option[value='dark']");
  await expect(darkOption).toBeDisabled();
  await expect(modeField.getByText(/Oscuro está deshabilitado/)).toBeVisible();

  await modeSelect.selectOption("auto");
  await expect(modeSelect).toHaveValue("auto");
  await expect
    .poll(() => previewPage(page).getAttribute("data-color-mode"), { timeout: 15_000 })
    .toBe("auto");

  // "light" sigue funcionando tras tocar el selector.
  await modeSelect.selectOption("light");
  await expect(modeSelect).toHaveValue("light");
  await expect
    .poll(() => previewPage(page).getAttribute("data-color-mode"), { timeout: 15_000 })
    .toBe("light");
});

test("tipografía: familias y escala llegan a los tokens del preview", async ({ page }) => {
  await setupCleanStore(page, "A16 tipografía");
  await openThemeTab(page);

  const display = page.getByLabel("Familia de títulos");
  const body = page.getByLabel("Familia de texto");
  const scale = page.getByLabel(/^Escala /);

  await display.fill("Archivo");
  await body.fill("Inter");
  // El slider se mueve y su etiqueta refleja el valor elegido (auto-feedback).
  await scale.fill("1.25");

  await expect(display).toHaveValue("Archivo");
  await expect(body).toHaveValue("Inter");
  await expect(scale).toHaveValue("1.25");
  await expect(page.getByLabel("Escala 1.25")).toBeVisible();

  await expect.poll(previewVar(page, "--solara-display"), { timeout: 15_000 }).toBe("Archivo");
  await expect.poll(previewVar(page, "--solara-body"), { timeout: 15_000 }).toBe("Inter");
  await expect.poll(previewVar(page, "--solara-type-scale"), { timeout: 15_000 }).toBe("1.25");
});

test("geometría: espaciado, radio y contenedor cambian los tokens del preview", async ({
  page,
}) => {
  await setupCleanStore(page, "A16 geometría");
  await openThemeTab(page);

  const spacing = page.getByLabel(/^Espaciado /);
  const radius = page.getByLabel(/^Radio /);

  await spacing.fill("1.35");
  await radius.fill("28");

  await expect(spacing).toHaveValue("1.35");
  await expect(radius).toHaveValue("28");
  await expect(page.getByLabel("Radio 28px")).toBeVisible();

  await expect.poll(previewVar(page, "--solara-space-scale"), { timeout: 15_000 }).toBe("1.35");
  await expect.poll(previewVar(page, "--solara-space"), { timeout: 15_000 }).toBe("1.35");
  await expect.poll(previewVar(page, "--solara-radius"), { timeout: 15_000 }).toBe("28px");
});

test("contenedor: se puede teclear por tecla sin que el campo rebote (A16-B1)", async ({
  page,
}) => {
  await setupCleanStore(page, "A16 contenedor");
  await openThemeTab(page);

  const container = page.getByLabel("Ancho del contenedor");
  const original = await container.inputValue();

  // Teclear caracter a caracter pasa por valores intermedios inválidos
  // ("1", "14"); el campo debe mostrar lo escrito y commitar el valor final.
  await container.click();
  await page.keyboard.press("ControlOrMeta+A");
  await page.keyboard.type("1400");

  await expect(container).toHaveValue("1400");
  await expect.poll(previewVar(page, "--solara-container"), { timeout: 15_000 }).toBe("1400px");

  // Fuera de rango: error inline y sin commit.
  await container.click();
  await page.keyboard.press("ControlOrMeta+A");
  await page.keyboard.type("900");
  await expect(container).toHaveAttribute("aria-invalid", "true");
  await expect(fieldsetOf(container).getByTestId("ui-field-error")).toContainText(
    "Ingresá un ancho de 960 a 1800 px",
  );
  await expect.poll(previewVar(page, "--solara-container"), { timeout: 15_000 }).toBe("1400px");

  // Recuperarse a un valor válido limpia el error.
  await page.keyboard.press("ControlOrMeta+A");
  await page.keyboard.type("1500");
  await expect(container).toHaveValue("1500");
  await expect(container).not.toHaveAttribute("aria-invalid", "true");
  await expect(fieldsetOf(container).getByTestId("ui-field-error")).toHaveCount(0);
  await expect.poll(previewVar(page, "--solara-container"), { timeout: 15_000 }).toBe("1500px");

  // Restaurar geometría vuelve al ancho de apertura.
  await page.getByTestId("ui-reset-geometry").click();
  await expect(container).toHaveValue(original);
  await expect
    .poll(previewVar(page, "--solara-container"), { timeout: 15_000 })
    .toBe(`${original}px`);
});

test("reset con borrador inválido: restaura el valor y limpia el error (A16-B2)", async ({
  page,
}) => {
  await setupCleanStore(page, "A16 reset borrador");
  await openThemeTab(page);

  const accentText = page.getByTestId("ui-color-text-accent");
  const backgroundText = page.getByTestId("ui-color-text-background");
  const originalAccent = await accentText.inputValue();
  const originalBackground = await backgroundText.inputValue();

  // Borrador inválido sin cambios confirmados.
  await accentText.fill("zzz");
  await expect(accentText).toHaveAttribute("aria-invalid", "true");
  await expect(fieldsetOf(accentText).getByTestId("ui-field-error")).toContainText(
    "Ingresá un color hex",
  );

  // "Restaurar colores" debe volver el campo visible al valor de apertura.
  await page.getByTestId("ui-reset-colors").click();
  await expect(accentText).toHaveValue(originalAccent);
  await expect(accentText).not.toHaveAttribute("aria-invalid", "true");
  await expect(fieldsetOf(accentText).getByTestId("ui-field-error")).toHaveCount(0);
  await expect(backgroundText).toHaveValue(originalBackground);

  // El mismo contrato para el ancho del contenedor y "Restaurar geometría".
  const container = page.getByLabel("Ancho del contenedor");
  const originalContainer = await container.inputValue();
  await container.click();
  await page.keyboard.press("ControlOrMeta+A");
  await page.keyboard.type("900");
  await expect(container).toHaveAttribute("aria-invalid", "true");

  await page.getByTestId("ui-reset-geometry").click();
  await expect(container).toHaveValue(originalContainer);
  await expect(container).not.toHaveAttribute("aria-invalid", "true");
  await expect(fieldsetOf(container).getByTestId("ui-field-error")).toHaveCount(0);
});

test("resets por grupo: cada uno restaura sólo su grupo de valores de apertura", async ({
  page,
}) => {
  await setupCleanStore(page, "A16 resets por grupo");
  await openThemeTab(page);

  const backgroundText = page.getByTestId("ui-color-text-background");
  const display = page.getByLabel("Familia de títulos");
  const container = page.getByLabel("Ancho del contenedor");

  const opening = {
    background: await backgroundText.inputValue(),
    display: await display.inputValue(),
    container: await container.inputValue(),
  };

  await page.getByRole("button", { name: "Aplicar paleta Tinta profunda" }).click();
  await display.fill("Georgia");
  await container.fill(String(Number(opening.container) + 100));
  await expect(backgroundText).toHaveValue("#16151a");

  // Restaurar tipografía: sólo la familia vuelve; colores y contenedor siguen.
  await page.getByTestId("ui-reset-typography").click();
  await expect(display).toHaveValue(opening.display);
  await expect(backgroundText).toHaveValue("#16151a");
  await expect(container).toHaveValue(String(Number(opening.container) + 100));

  // Restaurar geometría: sólo el contenedor vuelve; los colores siguen.
  await page.getByTestId("ui-reset-geometry").click();
  await expect(container).toHaveValue(opening.container);
  await expect(backgroundText).toHaveValue("#16151a");

  // Restaurar colores: paleta de apertura y su preset marcado de nuevo.
  await page.getByTestId("ui-reset-colors").click();
  await expect(backgroundText).toHaveValue(opening.background);
  await expect(
    page.getByTestId("ui-theme-preset").filter({ hasText: "Editorial cálido" }),
  ).toHaveAttribute("aria-pressed", "true");
});
