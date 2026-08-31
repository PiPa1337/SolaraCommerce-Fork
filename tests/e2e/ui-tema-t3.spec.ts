/**
 * Auditoría Tema T3 (2026-08-11) — Panel de contraste WCAG.
 * El panel declara 3 pares (Texto sobre fondo, Texto secundario sobre fondo,
 * Texto sobre acento) y un umbral de 4.5:1. Contrato verificado:
 *   1. cada par declarado OK coincide con un cálculo de luminancia WCAG 2.1
 *      propio del spec (parseHex + linealización + luminancia relativa) y el
 *      ratio mostrado (toFixed(2)) es el mismo;
 *   2. cambiar un color para romper contraste (muted = background) pasa el par
 *      a warning EN VIVO (data-testid ui-contrast-warning, "inferior a 4.5:1")
 *      sin recargar, y restaurarlo vuelve a OK;
 *   3. un hex inválido NO commitea: el campo muestra el error inline y el
 *      panel sigue reflejando el último color confirmado (el estado
 *      "color no válido" del panel nunca aparece en este flujo).
 * El panel se lee desde la tienda demo default (paleta "Marfil editorial" del
 * fixture catalog-modern: background #fcfcfb, text #0b0b0c, muted #696966,
 * accent #0b0b0c, accentText #ffffff).
 */
import type { Server } from "node:http";
import { expect, type Locator, type Page, test } from "@playwright/test";
import { createCleanStore } from "./project-helpers";
import { startStudioServer, stopStudioServer } from "./studio-server";

test.setTimeout(process.env.CI ? 90_000 : 60_000);

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

type ThemeColorKey =
  | "background"
  | "surface"
  | "text"
  | "muted"
  | "accent"
  | "accentText"
  | "border";

const THEME_COLOR_KEYS: readonly ThemeColorKey[] = [
  "background",
  "surface",
  "text",
  "muted",
  "accent",
  "accentText",
  "border",
];

/** Pares del panel (mismo contrato que CONTRAST_PAIRS de ThemeEditor). */
const CONTRAST_PAIRS: ReadonlyArray<{
  id: string;
  label: string;
  foreground: ThemeColorKey;
  background: ThemeColorKey;
}> = [
  { id: "text", label: "Texto sobre fondo", foreground: "text", background: "background" },
  {
    id: "muted",
    label: "Texto secundario sobre fondo",
    foreground: "muted",
    background: "background",
  },
  { id: "accent", label: "Texto sobre acento", foreground: "accentText", background: "accent" },
];

const CONTRAST_THRESHOLD = 4.5;

/**
 * Luminancia relativa WCAG 2.1 (sRGB lineal + pesos) calculada de forma
 * independiente del panel, con el umbral 0.03928 de la definición oficial.
 */
function luminance(hex: string): number | null {
  const match = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  if (match === null) return null;
  let channels = match[1] ?? "";
  if (channels.length === 3) {
    channels = channels
      .split("")
      .map((channel) => channel + channel)
      .join("");
  }
  const linear = (channel: number) => {
    const value = channel / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };
  const rgb = [0, 2, 4].map((offset) => parseInt(channels.slice(offset, offset + 2), 16));
  return 0.2126 * linear(rgb[0]) + 0.7152 * linear(rgb[1]) + 0.0722 * linear(rgb[2]);
}

/** Ratio de contraste WCAG 2.x entre dos hex; null si alguno no es válido. */
function contrastRatio(foreground: string, background: string): number | null {
  const light = luminance(foreground);
  const dark = luminance(background);
  if (light === null || dark === null) return null;
  const lighter = Math.max(light, dark);
  const darker = Math.min(light, dark);
  return (lighter + 0.05) / (darker + 0.05);
}

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
  await createCleanStore(page, name);
}

async function openThemeTab(page: Page): Promise<void> {
  await page.getByRole("tab", { name: "Tema de la tienda", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Tema de la tienda", exact: true })).toBeVisible();
}

/** Colores confirmados del proyecto: los pickers nativos reflejan el commit. */
async function readCommittedColors(page: Page): Promise<Record<ThemeColorKey, string>> {
  const colors = {} as Record<ThemeColorKey, string>;
  for (const key of THEME_COLOR_KEYS) {
    colors[key] = await page.getByTestId(`ui-color-native-${key}`).inputValue();
  }
  return colors;
}

function contrastRow(page: Page, label: string): Locator {
  return page
    .locator(".contrast-check__row")
    .filter({ has: page.getByText(label, { exact: true }) });
}

test("pares del panel: 3 pares declarados OK coinciden con el cálculo WCAG propio", async ({
  page,
}) => {
  await setupCleanStore(page, "T3 pares");
  await openThemeTab(page);

  const panel = page.locator(".contrast-check");
  await expect(panel).toContainText("Contraste (WCAG)");
  await expect(panel).toHaveAttribute("aria-live", "polite");

  const colors = await readCommittedColors(page);
  for (const pair of CONTRAST_PAIRS) {
    const expected = contrastRatio(colors[pair.foreground], colors[pair.background]);
    expect(expected, `${pair.label}: colores confirmados válidos`).not.toBeNull();
    const row = contrastRow(page, pair.label);
    await expect(row).toHaveAttribute("data-testid", "ui-contrast-ok");
    await expect(row.locator(".contrast-check__ratio")).toHaveText(
      `${(expected as number).toFixed(2)}:1`,
    );
    expect(expected as number).toBeGreaterThanOrEqual(CONTRAST_THRESHOLD);
  }
});

test("romper contraste en vivo: muted = fondo pasa el par a warning y restaurar lo devuelve a OK", async ({
  page,
}) => {
  await setupCleanStore(page, "T3 warning");
  await openThemeTab(page);

  const mutedRow = contrastRow(page, "Texto secundario sobre fondo");
  await expect(mutedRow).toHaveAttribute("data-testid", "ui-contrast-ok");

  // muted = background (#fcfcfb): ratio 1.00:1, el panel avisa sin recargar.
  await page.getByTestId("ui-color-text-muted").fill("#fcfcfb");
  await expect(mutedRow).toHaveAttribute("data-testid", "ui-contrast-warning");
  await expect(mutedRow.locator(".contrast-check__ratio")).toHaveText("1.00:1 — inferior a 4.5:1");

  // Los otros pares siguen OK (el cambio es por par).
  await expect(contrastRow(page, "Texto sobre fondo")).toHaveAttribute(
    "data-testid",
    "ui-contrast-ok",
  );

  // Restaurar el valor default devuelve el par a OK en vivo.
  await page.getByTestId("ui-color-text-muted").fill("#696966");
  await expect(mutedRow).toHaveAttribute("data-testid", "ui-contrast-ok");
  await expect(mutedRow.locator(".contrast-check__ratio")).toHaveText("5.36:1");
});

test("hex inválido: el campo avisa y el panel sigue reflejando el último color confirmado", async ({
  page,
}) => {
  await setupCleanStore(page, "T3 inválido");
  await openThemeTab(page);

  const mutedRow = contrastRow(page, "Texto secundario sobre fondo");
  await expect(mutedRow).toHaveAttribute("data-testid", "ui-contrast-ok");

  // "zzz" no commitea: error inline en el campo, panel sin estado "no válido".
  await page.getByTestId("ui-color-text-muted").fill("zzz");
  await expect(page.getByTestId("ui-field-error")).toHaveText("Ingresá un color hex como #1a2b3c.");
  const invalidMuted = page.getByTestId("ui-color-text-muted");
  await expect(invalidMuted).toHaveAttribute("aria-invalid", "true");
  await expect(invalidMuted).toHaveAttribute("aria-describedby", "theme-color-error-muted");
  await expect(page.locator("#theme-color-error-muted")).toHaveText(
    "Ingresá un color hex como #1a2b3c.",
  );
  await expect(mutedRow).toHaveAttribute("data-testid", "ui-contrast-ok");
  await expect(mutedRow.locator(".contrast-check__ratio")).toHaveText("5.36:1");
  await expect(page.getByTestId("ui-contrast-warn")).toHaveCount(0);

  // Un hex válido limpia el error y el commit vuelve a actualizar el panel.
  await page.getByTestId("ui-color-text-muted").fill("#0b0b0c");
  await expect(page.getByTestId("ui-field-error")).toHaveCount(0);
  const expected = contrastRatio("#0b0b0c", "#fcfcfb");
  await expect(mutedRow).toHaveAttribute("data-testid", "ui-contrast-ok");
  await expect(mutedRow.locator(".contrast-check__ratio")).toHaveText(
    `${(expected as number).toFixed(2)}:1`,
  );
});
