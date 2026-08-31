/**
 * Auditoría Tema T1 (2026-08-10) — Presets del panel Tema.
 * Cada uno de los 10 presets debe:
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
import { readHashedStorefrontCss } from "./export-helpers";
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
  "Marfil editorial": {
    background: "#fcfcfb",
    surface: "#f0f0ee",
    text: "#0b0b0c",
    muted: "#696966",
    accent: "#0b0b0c",
    accentText: "#ffffff",
    border: "#dededa",
  },
  "Jardín de salvia": {
    background: "#f1f6f0",
    surface: "#e0ece0",
    text: "#1b2a20",
    muted: "#526457",
    accent: "#356248",
    accentText: "#f6fff7",
    border: "#c7d8c7",
  },
  "Terracota solar": {
    background: "#fff5ee",
    surface: "#f8e4d4",
    text: "#3a2118",
    muted: "#76584b",
    accent: "#9a442c",
    accentText: "#fff8f3",
    border: "#e8c8b3",
  },
  "Azul mediterráneo": {
    background: "#eff6fb",
    surface: "#ddebf5",
    text: "#172b3a",
    muted: "#4a6272",
    accent: "#1d5b7a",
    accentText: "#f7fcff",
    border: "#c5d8e5",
  },
  "Lavanda suave": {
    background: "#f6f2fb",
    surface: "#e9e0f3",
    text: "#29213a",
    muted: "#655978",
    accent: "#6d4a92",
    accentText: "#fbf8ff",
    border: "#d8c9e7",
  },
  "Rosa pétalo": {
    background: "#fff2f4",
    surface: "#f6e0e5",
    text: "#3a2028",
    muted: "#76515c",
    accent: "#9a3f56",
    accentText: "#fff7f9",
    border: "#e6c5cf",
  },
  "Menta fresca": {
    background: "#effaf7",
    surface: "#ddf1ea",
    text: "#17352f",
    muted: "#4d6a62",
    accent: "#1e6b59",
    accentText: "#f4fffc",
    border: "#c2ded5",
  },
  "Mostaza clara": {
    background: "#fff9e8",
    surface: "#f6edc7",
    text: "#332c18",
    muted: "#756b43",
    accent: "#766018",
    accentText: "#fffbef",
    border: "#e7d9a8",
  },
  "Coral suave": {
    background: "#fff4f1",
    surface: "#f6dfd8",
    text: "#3b201d",
    muted: "#765651",
    accent: "#a64034",
    accentText: "#fff8f6",
    border: "#e6c6be",
  },
  "Azul lavanda": {
    background: "#eef1fa",
    surface: "#dce2f2",
    text: "#202b4a",
    muted: "#56627d",
    accent: "#3d5592",
    accentText: "#f8faff",
    border: "#c8d0e5",
  },
  "Blanco y naranja": {
    background: "#fffaf5",
    surface: "#fff0e5",
    text: "#2a170f",
    muted: "#755043",
    accent: "#b84d12",
    accentText: "#ffffff",
    border: "#edcdb8",
  },
  "Grafito lima": {
    background: "#111416",
    surface: "#1b2023",
    text: "#f5f7f6",
    muted: "#bac3c6",
    accent: "#b4e34a",
    accentText: "#182000",
    border: "#3a464a",
  },
  "Azul noche": {
    background: "#101828",
    surface: "#18243a",
    text: "#f3f7ff",
    muted: "#b8c5d9",
    accent: "#57b8ff",
    accentText: "#062036",
    border: "#344766",
  },
  "Ciruela nocturna": {
    background: "#1b1220",
    surface: "#291a31",
    text: "#fff5fc",
    muted: "#d3b7ce",
    accent: "#ed8bc3",
    accentText: "#351326",
    border: "#55345e",
  },
  "Café espresso": {
    background: "#1a120e",
    surface: "#2a1d17",
    text: "#fff3e8",
    muted: "#d9bca7",
    accent: "#f0a35b",
    accentText: "#2b1709",
    border: "#5a3d2c",
  },
  "Bosque profundo": {
    background: "#0d1b17",
    surface: "#142923",
    text: "#effaf4",
    muted: "#b1cfc0",
    accent: "#6fdbad",
    accentText: "#06261c",
    border: "#31564a",
  },
  "Azul petróleo": {
    background: "#eef8fa",
    surface: "#dceff1",
    text: "#12333a",
    muted: "#4d6970",
    accent: "#087f86",
    accentText: "#f5ffff",
    border: "#c2dfe2",
  },
  "Arena y azul": {
    background: "#fbf7ed",
    surface: "#eee6d5",
    text: "#232c3a",
    muted: "#5f6874",
    accent: "#2c4c7a",
    accentText: "#f8fbff",
    border: "#d9ccb2",
  },
  "Uva crema": {
    background: "#fbf7ff",
    surface: "#eee5fa",
    text: "#281a3d",
    muted: "#635577",
    accent: "#70459e",
    accentText: "#ffffff",
    border: "#d9c8ec",
  },
  "Durazno mineral": {
    background: "#fff6f0",
    surface: "#f7e5da",
    text: "#3a211b",
    muted: "#76584d",
    accent: "#a7472e",
    accentText: "#fffaf7",
    border: "#e8c9b9",
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
  await page.getByRole("tab", { name: "Tema de la tienda", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Tema de la tienda", exact: true })).toBeVisible();
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
    html
      .evaluate(
        (element, variable) => getComputedStyle(element).getPropertyValue(variable),
        `--solara-${VAR_SUFFIX[key]}`,
      )
      .catch(() => "");
}

async function assertPreviewPalette(page: Page, colors: ThemeColors): Promise<void> {
  await expect.poll(previewVar(page, "background"), { timeout: 15_000 }).toBe(colors.background);
  for (const key of THEME_COLOR_KEYS) {
    if (key === "background") continue;
    await expect.poll(previewVar(page, key), { timeout: 15_000 }).toBe(colors[key]);
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
  const css = readHashedStorefrontCss(result.files);
  const vars = {} as ThemeColors;
  for (const key of THEME_COLOR_KEYS) {
    const suffix = VAR_SUFFIX[key];
    const match = new RegExp(`--solara-${suffix}(?![-\\w]):\\s*([^;}]+)`).exec(css);
    if (match === null) throw new Error(`Falta --solara-${suffix} en el CSS exportado`);
    vars[key] = match[1].trim();
  }
  return vars;
}

test("preset Marfil editorial: vuelve al default en preview, feedback y sitio exportado", async ({
  page,
}) => {
  await setupCleanStore(page, "T1 editorial");
  await openThemeTab(page);

  // La tienda vacía abre con la paleta editorial: es el estado ANTES.
  const defaultColors = await readThemeColors(page);
  expect(defaultColors).toEqual(PRESET_COLORS["Marfil editorial"]);
  const defaultVars = exportedThemeVars(defaultColors);
  await expect.poll(previewVar(page, "background"), { timeout: 15_000 }).toBe("#fcfcfb");

  // Cambio previo a Azul mediterráneo para demostrar el diff de vuelta a marfil.
  await applyPreset(page, "Azul mediterráneo");
  const inkColors = await readThemeColors(page);
  expect(inkColors).toEqual(PRESET_COLORS["Azul mediterráneo"]);
  expect(exportedThemeVars(inkColors)).toEqual(PRESET_COLORS["Azul mediterráneo"]);
  await expect.poll(previewVar(page, "background"), { timeout: 15_000 }).toBe("#eff6fb");

  // Click real sobre el preset: vuelve a la paleta marfil en las 4 capas.
  await applyPreset(page, "Marfil editorial");
  await expect(page.getByTestId("ui-color-text-background")).toHaveValue("#fcfcfb");
  expect(await readThemeColors(page)).toEqual(PRESET_COLORS["Marfil editorial"]);
  await assertPreviewPalette(page, PRESET_COLORS["Marfil editorial"]);
  await assertPresetFeedback(page, "Marfil editorial");
  const backVars = exportedThemeVars(await readThemeColors(page));
  expect(backVars).toEqual(PRESET_COLORS["Marfil editorial"]);
  expect(backVars).toEqual(defaultVars);
  for (const key of THEME_COLOR_KEYS) {
    expect(backVars[key]).not.toBe(exportedThemeVars(inkColors)[key]);
  }
});

test("preset Jardín de salvia: paleta en preview, feedback y CSS exportado", async ({ page }) => {
  await setupCleanStore(page, "T1 salvia");
  await openThemeTab(page);

  const before = await readThemeColors(page);
  const beforeVars = exportedThemeVars(before);
  await expect.poll(previewVar(page, "background"), { timeout: 15_000 }).toBe("#fcfcfb");

  await applyPreset(page, "Jardín de salvia");

  await expect(page.getByTestId("ui-color-text-background")).toHaveValue("#f1f6f0");
  expect(await readThemeColors(page)).toEqual(PRESET_COLORS["Jardín de salvia"]);
  await assertPreviewPalette(page, PRESET_COLORS["Jardín de salvia"]);
  await assertPresetFeedback(page, "Jardín de salvia");

  const afterVars = exportedThemeVars(await readThemeColors(page));
  expect(afterVars).toEqual(PRESET_COLORS["Jardín de salvia"]);
  for (const key of THEME_COLOR_KEYS) {
    if (before[key] === PRESET_COLORS["Jardín de salvia"][key]) continue;
    expect(afterVars[key]).not.toBe(beforeVars[key]);
  }
});

test("preset Terracota solar: paleta en preview, feedback y CSS exportado", async ({ page }) => {
  await setupCleanStore(page, "T1 costa");
  await openThemeTab(page);

  const before = await readThemeColors(page);
  const beforeVars = exportedThemeVars(before);
  await expect.poll(previewVar(page, "background"), { timeout: 15_000 }).toBe("#fcfcfb");

  await applyPreset(page, "Terracota solar");

  await expect(page.getByTestId("ui-color-text-background")).toHaveValue("#fff5ee");
  expect(await readThemeColors(page)).toEqual(PRESET_COLORS["Terracota solar"]);
  await assertPreviewPalette(page, PRESET_COLORS["Terracota solar"]);
  await assertPresetFeedback(page, "Terracota solar");

  const afterVars = exportedThemeVars(await readThemeColors(page));
  expect(afterVars).toEqual(PRESET_COLORS["Terracota solar"]);
  for (const key of THEME_COLOR_KEYS) {
    if (before[key] === PRESET_COLORS["Terracota solar"][key]) continue;
    expect(afterVars[key]).not.toBe(beforeVars[key]);
  }
});

test("preset Azul lavanda: paleta en preview, feedback y CSS exportado", async ({ page }) => {
  await setupCleanStore(page, "T1 tinta");
  await openThemeTab(page);

  const before = await readThemeColors(page);
  const beforeVars = exportedThemeVars(before);
  await expect.poll(previewVar(page, "background"), { timeout: 15_000 }).toBe("#fcfcfb");

  await applyPreset(page, "Azul lavanda");

  await expect(page.getByTestId("ui-color-text-background")).toHaveValue("#eef1fa");
  expect(await readThemeColors(page)).toEqual(PRESET_COLORS["Azul lavanda"]);
  await assertPreviewPalette(page, PRESET_COLORS["Azul lavanda"]);
  await assertPresetFeedback(page, "Azul lavanda");

  const afterVars = exportedThemeVars(await readThemeColors(page));
  expect(afterVars).toEqual(PRESET_COLORS["Azul lavanda"]);
  for (const key of THEME_COLOR_KEYS) {
    if (before[key] === PRESET_COLORS["Azul lavanda"][key]) continue;
    expect(afterVars[key]).not.toBe(beforeVars[key]);
  }
});

test("las 20 paletas son visibles y mantienen contraste WCAG", async ({ page }) => {
  await setupCleanStore(page, "T1 veinte paletas");
  await openThemeTab(page);

  await expect(page.getByTestId("ui-theme-preset")).toHaveCount(20);

  for (const [presetName, colors] of Object.entries(PRESET_COLORS)) {
    await applyPreset(page, presetName);
    await expect(page.getByTestId("ui-color-text-background")).toHaveValue(colors.background);
    await expect(page.getByTestId("ui-contrast-ok")).toHaveCount(4);
    await expect(page.getByTestId("ui-contrast-warn")).toHaveCount(0);
    await assertPresetFeedback(page, presetName);
  }
});
