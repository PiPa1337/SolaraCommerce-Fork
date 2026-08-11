/**
 * Auditoría Tema T1 (2026-08-10) — Presets del panel Tema.
 * Cada uno de los 4 presets debe:
 *   1. aplicar la paleta real al preview (variable CSS --solara-* computada);
 *   2. llegar al sitio exportado: exportProject() ANTES y DESPUÉS del click
 *      (patrón exported-store.spec.ts) y las 7 variables de color del preset
 *      deben estar presentes y con el valor esperado en assets/storefront.css;
 *   3. dejar el preset activo marcado (aria-pressed=true + "✓ Aplicada");
 *   4. escribir los valores del preset en el proyecto (los inputs del panel,
 *      que son los valores persistidos, deben coincidir con la paleta).
 */
import type { Server } from "node:http";
import { expect, type Page, test } from "@playwright/test";
import { exportProject } from "@solara/exporter";
import { referenceStore } from "@solara/project-schema/fixture";
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
type ThemeColors = Record<ThemeColorKey, string>;

/** Los mismos 7 colores que declara THEME_PRESETS en ThemeEditor.tsx. */
const PRESET_COLORS: Record<string, ThemeColors> = {
  "Editorial cálido": {
    background: "#fcfcfb",
    surface: "#f0f0ee",
    text: "#0b0b0c",
    muted: "#696966",
    accent: "#0b0b0c",
    accentText: "#ffffff",
    border: "#dededa",
  },
  "Salvia serena": {
    background: "#f5f7f4",
    surface: "#e7ece6",
    text: "#18231f",
    muted: "#5f6b62",
    accent: "#3a5244",
    accentText: "#fbfcfb",
    border: "#d4dcd3",
  },
  "Costa terracota": {
    background: "#faf6f2",
    surface: "#f1e9e1",
    text: "#231510",
    muted: "#7c6a5c",
    accent: "#b4552d",
    accentText: "#fff8f3",
    border: "#e6dacd",
  },
  "Tinta profunda": {
    background: "#16151a",
    surface: "#1f1e24",
    text: "#f2f0f4",
    muted: "#a29daa",
    accent: "#e9e6ee",
    accentText: "#16151a",
    border: "#33313a",
  },
};

const THEME_COLOR_KEYS: readonly ThemeColorKey[] = [
  "background",
  "surface",
  "text",
  "muted",
  "accent",
  "accentText",
  "border",
];

/** Sufijo de la variable CSS del sitio para cada token del proyecto. */
const VAR_SUFFIX: Record<ThemeColorKey, string> = {
  background: "background",
  surface: "surface",
  text: "text",
  muted: "muted",
  accent: "accent",
  accentText: "accent-text",
  border: "border",
};

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
  await page.getByRole("tab", { name: "Tema", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Tema", exact: true })).toBeVisible();
}

async function applyPreset(page: Page, presetName: string): Promise<void> {
  await page.getByRole("button", { name: `Aplicar paleta ${presetName}` }).click();
}

/** Los inputs del panel son los valores persistidos del proyecto (datos). */
async function readThemeColors(page: Page): Promise<ThemeColors> {
  const colors = {} as ThemeColors;
  for (const key of THEME_COLOR_KEYS) {
    colors[key] = await page.getByTestId(`ui-color-text-${key}`).inputValue();
  }
  return colors;
}

/** Variable CSS computada del preview para un token. */
function previewVar(page: Page, key: ThemeColorKey) {
  const html = page.frameLocator('iframe[title="Vista previa desktop"]').locator("html");
  return () =>
    html.evaluate(
      (element, variable) => getComputedStyle(element).getPropertyValue(variable),
      `--solara-${VAR_SUFFIX[key]}`,
    );
}

async function assertPreviewPalette(page: Page, colors: ThemeColors): Promise<void> {
  await expect.poll(previewVar(page, "background"), { timeout: 15_000 }).toBe(colors.background);
  for (const key of THEME_COLOR_KEYS) {
    if (key === "background") continue;
    expect(await previewVar(page, key)()).toBe(colors[key]);
  }
}

async function assertPresetFeedback(page: Page, presetName: string): Promise<void> {
  const presets = page.getByTestId("ui-theme-preset");
  const active = presets.filter({ hasText: presetName });
  await expect(active).toHaveAttribute("aria-pressed", "true");
  await expect(active).toHaveAttribute("data-active", "true");
  // La marca "✓ Aplicada" vive en el pseudo-elemento ::after.
  await expect
    .poll(() => active.evaluate((element) => getComputedStyle(element, "::after").content))
    .toContain("Aplicada");
  for (const other of Object.keys(PRESET_COLORS)) {
    if (other === presetName) continue;
    await expect(presets.filter({ hasText: other })).toHaveAttribute("aria-pressed", "false");
  }
}

/** Exporta el sitio con la paleta dada y lee los 7 valores --solara-* del CSS. */
function exportedThemeVars(colors: ThemeColors): ThemeColors {
  const store = structuredClone(referenceStore);
  store.theme = { ...store.theme, colors: { ...colors } };
  const result = exportProject(store, { mode: "production" });
  const file = result.files.get("assets/storefront.css");
  if (file === undefined) throw new Error("El sitio exportado no contiene assets/storefront.css");
  const css = typeof file === "string" ? file : new TextDecoder().decode(file);
  const vars = {} as ThemeColors;
  for (const key of THEME_COLOR_KEYS) {
    const suffix = VAR_SUFFIX[key];
    const match = new RegExp(`--solara-${suffix}(?![-\\w]):\\s*([^;}]+)`).exec(css);
    if (match === null) throw new Error(`Falta --solara-${suffix} en el CSS exportado`);
    vars[key] = match[1].trim();
  }
  return vars;
}

test("preset Editorial cálido: vuelve al default en preview, feedback y sitio exportado", async ({
  page,
}) => {
  await setupCleanStore(page, "T1 editorial");
  await openThemeTab(page);

  // La tienda vacía abre con la paleta editorial: es el estado ANTES.
  const defaultColors = await readThemeColors(page);
  expect(defaultColors).toEqual(PRESET_COLORS["Editorial cálido"]);
  const defaultVars = exportedThemeVars(defaultColors);
  await expect.poll(previewVar(page, "background"), { timeout: 15_000 }).toBe("#fcfcfb");

  // Cambio previo a Tinta profunda para demostrar el diff de vuelta a editorial.
  await applyPreset(page, "Tinta profunda");
  const inkColors = await readThemeColors(page);
  expect(inkColors).toEqual(PRESET_COLORS["Tinta profunda"]);
  expect(exportedThemeVars(inkColors)).toEqual(PRESET_COLORS["Tinta profunda"]);
  await expect.poll(previewVar(page, "background"), { timeout: 15_000 }).toBe("#16151a");

  // Click real sobre el preset: vuelve a la paleta editorial en las 4 capas.
  await applyPreset(page, "Editorial cálido");
  await expect(page.getByTestId("ui-color-text-background")).toHaveValue("#fcfcfb");
  expect(await readThemeColors(page)).toEqual(PRESET_COLORS["Editorial cálido"]);
  await assertPreviewPalette(page, PRESET_COLORS["Editorial cálido"]);
  await assertPresetFeedback(page, "Editorial cálido");
  const backVars = exportedThemeVars(await readThemeColors(page));
  expect(backVars).toEqual(PRESET_COLORS["Editorial cálido"]);
  expect(backVars).toEqual(defaultVars);
  for (const key of THEME_COLOR_KEYS) {
    expect(backVars[key]).not.toBe(exportedThemeVars(inkColors)[key]);
  }
});

test("preset Salvia serena: paleta en preview, feedback y CSS exportado", async ({ page }) => {
  await setupCleanStore(page, "T1 salvia");
  await openThemeTab(page);

  const before = await readThemeColors(page);
  const beforeVars = exportedThemeVars(before);
  await expect.poll(previewVar(page, "background"), { timeout: 15_000 }).toBe("#fcfcfb");

  await applyPreset(page, "Salvia serena");

  await expect(page.getByTestId("ui-color-text-background")).toHaveValue("#f5f7f4");
  expect(await readThemeColors(page)).toEqual(PRESET_COLORS["Salvia serena"]);
  await assertPreviewPalette(page, PRESET_COLORS["Salvia serena"]);
  await assertPresetFeedback(page, "Salvia serena");

  const afterVars = exportedThemeVars(await readThemeColors(page));
  expect(afterVars).toEqual(PRESET_COLORS["Salvia serena"]);
  for (const key of THEME_COLOR_KEYS) {
    if (before[key] === PRESET_COLORS["Salvia serena"][key]) continue;
    expect(afterVars[key]).not.toBe(beforeVars[key]);
  }
});

test("preset Costa terracota: paleta en preview, feedback y CSS exportado", async ({ page }) => {
  await setupCleanStore(page, "T1 costa");
  await openThemeTab(page);

  const before = await readThemeColors(page);
  const beforeVars = exportedThemeVars(before);
  await expect.poll(previewVar(page, "background"), { timeout: 15_000 }).toBe("#fcfcfb");

  await applyPreset(page, "Costa terracota");

  await expect(page.getByTestId("ui-color-text-background")).toHaveValue("#faf6f2");
  expect(await readThemeColors(page)).toEqual(PRESET_COLORS["Costa terracota"]);
  await assertPreviewPalette(page, PRESET_COLORS["Costa terracota"]);
  await assertPresetFeedback(page, "Costa terracota");

  const afterVars = exportedThemeVars(await readThemeColors(page));
  expect(afterVars).toEqual(PRESET_COLORS["Costa terracota"]);
  for (const key of THEME_COLOR_KEYS) {
    if (before[key] === PRESET_COLORS["Costa terracota"][key]) continue;
    expect(afterVars[key]).not.toBe(beforeVars[key]);
  }
});

test("preset Tinta profunda: paleta en preview, feedback y CSS exportado", async ({ page }) => {
  await setupCleanStore(page, "T1 tinta");
  await openThemeTab(page);

  const before = await readThemeColors(page);
  const beforeVars = exportedThemeVars(before);
  await expect.poll(previewVar(page, "background"), { timeout: 15_000 }).toBe("#fcfcfb");

  await applyPreset(page, "Tinta profunda");

  await expect(page.getByTestId("ui-color-text-background")).toHaveValue("#16151a");
  expect(await readThemeColors(page)).toEqual(PRESET_COLORS["Tinta profunda"]);
  await assertPreviewPalette(page, PRESET_COLORS["Tinta profunda"]);
  await assertPresetFeedback(page, "Tinta profunda");

  const afterVars = exportedThemeVars(await readThemeColors(page));
  expect(afterVars).toEqual(PRESET_COLORS["Tinta profunda"]);
  for (const key of THEME_COLOR_KEYS) {
    if (before[key] === PRESET_COLORS["Tinta profunda"][key]) continue;
    expect(afterVars[key]).not.toBe(beforeVars[key]);
  }
});
