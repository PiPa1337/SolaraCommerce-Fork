/**
 * Auditoría Tema T8 (2026-08-10) — Resets por grupo y persistencia del tema.
 * Contrato de 4 capas (plan docs/superpowers/plans/2026-08-10-auditoria-tema.md):
 * - funcional: cada reset restaura SOLO su grupo a los valores de apertura de
 *   la pestaña (colores, tipografía y geometría por separado) y limpia los
 *   borradores inválidos (fix A16 de ThemeEditor);
 * - auto-feedback: inputs, errores inline y preview reflejan cada estado;
 * - datos: el tema editado persiste al recargar la pestaña, al Guardar en el
 *   navegador (IndexedDB) y en el respaldo .solara.json descargado;
 * - utilidad: tras los resets el preview y el sitio exportado vuelven al
 *   estado inicial (diff vacío en los archivos con variables --solara-*).
 */
import { readFileSync } from "node:fs";
import type { Server } from "node:http";
import { expect, type Locator, type Page, test } from "@playwright/test";
import { exportProject } from "@solara/exporter";
import { StoreProjectV1Schema, type Theme } from "@solara/project-schema";
import { catalogModernStore } from "@solara/project-schema/catalog-modern-fixture";
import { createCleanStore } from "./project-helpers";
import { startStudioServer, stopStudioServer } from "./studio-server";

test.setTimeout(process.env.CI ? 150_000 : 90_000);

const SALVIA_COLORS: Theme["colors"] = {
  background: "#f1f6f0",
  surface: "#e0ece0",
  text: "#1b2a20",
  muted: "#526457",
  accent: "#356248",
  accentText: "#f6fff7",
  border: "#c7d8c7",
};

const EDITED_TYPOGRAPHY: Theme["typography"] = {
  display: 'Georgia, "Times New Roman", serif',
  body: "Verdana, Geneva, Tahoma, sans-serif",
  scale: 1.15,
};

const EDITED_GEOMETRY = { spacingScale: 1.25, radius: 8, container: 1425 };

const demoTheme = structuredClone(catalogModernStore.theme);
const editedTheme: Theme = {
  ...structuredClone(demoTheme),
  colors: SALVIA_COLORS,
  typography: EDITED_TYPOGRAPHY,
  ...EDITED_GEOMETRY,
};

function withTheme(theme: Theme) {
  return StoreProjectV1Schema.parse({ ...structuredClone(catalogModernStore), theme });
}

// Sitio exportado en los tres estados: inicial, editado y posterior a los
// resets. La comparación de abajo fija la capa de utilidad (diff).
const initialExport = exportProject(withTheme(structuredClone(demoTheme)), { mode: "production" });
const editedExport = exportProject(withTheme(editedTheme), { mode: "production" });
const resetExport = exportProject(withTheme(structuredClone(demoTheme)), { mode: "production" });

/** Archivos del sitio que llevan variables de tema (tokens --solara-*). */
function themeCssOf(exported: { files: ReadonlyMap<string, string | Uint8Array> }): string[] {
  const entries: string[] = [];
  for (const [path, content] of exported.files) {
    const text = typeof content === "string" ? content : new TextDecoder().decode(content);
    if (text.includes("--solara-")) entries.push(`${path}\n${text}`);
  }
  return entries;
}

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

async function resetIndexedDb(page: Page): Promise<void> {
  await page.goto(studioUrl);
  await page.evaluate(
    () =>
      new Promise<void>((resolveDelete, reject) => {
        const request = indexedDB.deleteDatabase("solara-commerce-studio");
        request.addEventListener("success", () => resolveDelete());
        request.addEventListener("error", () => reject(request.error));
        request.addEventListener("blocked", () => reject(new Error("La base quedó bloqueada.")));
      }),
  );
  await page.reload();
  await expect(page.getByRole("heading", { name: "Tus tiendas" })).toBeVisible();
}

async function setupCleanStore(page: Page, name: string): Promise<void> {
  await resetIndexedDb(page);
  await createCleanStore(page, name);
}

async function openDemoStore(page: Page): Promise<void> {
  await page.locator('[data-store-card-id="store-modo-sur-demo"]').click();
  await page.getByRole("button", { name: "Abrir tienda", exact: true }).click();
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

/** Valor computado de una variable --solara-* en el preview desktop. */
function previewVar(page: Page, variable: string): () => Promise<string> {
  return () =>
    page
      .frameLocator('iframe[title="Vista previa desktop"]')
      .locator("html")
      .evaluate(
        (element, name) => getComputedStyle(element).getPropertyValue(name).trim(),
        variable,
      );
}

const COLOR_KEYS: Array<keyof Theme["colors"]> = [
  "background",
  "surface",
  "text",
  "muted",
  "accent",
  "accentText",
  "border",
];

/** Lee el tema completo desde los inputs del panel (contrato de datos). */
async function readTheme(page: Page): Promise<Theme> {
  const colors = {} as Theme["colors"];
  for (const key of COLOR_KEYS) {
    colors[key] = await page.getByTestId(`ui-color-text-${key}`).inputValue();
  }
  return {
    colorMode: (await page.getByLabel("Modo", { exact: true }).inputValue()) as Theme["colorMode"],
    colors,
    typography: {
      display: await page.getByTestId("ui-font-display").inputValue(),
      body: await page.getByTestId("ui-font-body").inputValue(),
      scale: Number(await page.getByLabel(/Escala/).inputValue()),
    },
    spacingScale: Number(await page.getByLabel(/Espaciado/).inputValue()),
    radius: Number(await page.getByLabel(/Radio/).inputValue()),
    container: Number(await page.getByLabel("Ancho del contenedor").inputValue()),
  };
}

/** Edita los tres grupos con valores deterministas (dentro del schema). */
async function applyEdits(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Aplicar paleta Jardín de salvia" }).click();
  await page.getByTestId("ui-font-display").selectOption(EDITED_TYPOGRAPHY.display);
  await page.getByTestId("ui-font-body").selectOption(EDITED_TYPOGRAPHY.body);
  await page.getByLabel(/Escala/).fill("1.15");
  await page.getByLabel(/Espaciado/).fill("1.25");
  await page.getByLabel(/Radio/).fill("8");
  await page.getByLabel("Ancho del contenedor").fill(String(EDITED_GEOMETRY.container));
}

/** Guardar del modo navegador: flush del autosave con Ctrl+S y aviso "Guardado". */
async function flushSave(page: Page): Promise<void> {
  await page.keyboard.press("Control+s");
  await expect(page.locator(".save-indicator")).toContainText("Guardado", { timeout: 30_000 });
}

test("Restaurar colores restaura solo el grupo de colores (tipografía y geometría intactas)", async ({
  page,
}) => {
  await setupCleanStore(page, "Tienda T8 colores");
  await openThemeTab(page);

  const opening = await readTheme(page);

  await page.getByLabel("Modo", { exact: true }).selectOption("auto");
  await applyEdits(page);
  await expect(page.getByTestId("ui-color-text-accent")).toHaveValue(SALVIA_COLORS.accent);

  await page.getByTestId("ui-reset-colors").click();

  const restored = await readTheme(page);
  expect(restored.colorMode).toBe(opening.colorMode);
  expect(restored.colors).toEqual(opening.colors);
  // Los otros grupos conservan la edición: el reset no los pisa.
  expect(restored.typography).toEqual(EDITED_TYPOGRAPHY);
  expect(restored.spacingScale).toBe(EDITED_GEOMETRY.spacingScale);
  expect(restored.radius).toBe(EDITED_GEOMETRY.radius);
  expect(restored.container).toBe(EDITED_GEOMETRY.container);

  // Preview: los colores vuelven a la apertura; el resto sigue editado.
  await expect
    .poll(previewVar(page, "--solara-background"), { timeout: 15_000 })
    .toBe(opening.colors.background);
  await expect.poll(previewVar(page, "--solara-radius"), { timeout: 15_000 }).toBe("8px");
  await expect.poll(previewVar(page, "--solara-type-scale"), { timeout: 15_000 }).toBe("1.15");
});

test("Restaurar tipografía restaura solo el grupo de tipografía", async ({ page }) => {
  await setupCleanStore(page, "Tienda T8 tipografía");
  await openThemeTab(page);

  const opening = await readTheme(page);
  await applyEdits(page);

  await page.getByTestId("ui-reset-typography").click();

  const restored = await readTheme(page);
  expect(restored.typography).toEqual(opening.typography);
  expect(restored.colors).toEqual(SALVIA_COLORS);
  expect(restored.spacingScale).toBe(EDITED_GEOMETRY.spacingScale);
  expect(restored.radius).toBe(EDITED_GEOMETRY.radius);
  expect(restored.container).toBe(EDITED_GEOMETRY.container);

  await expect.poll(previewVar(page, "--solara-type-scale"), { timeout: 15_000 }).toBe("1");
  await expect
    .poll(previewVar(page, "--solara-background"), { timeout: 15_000 })
    .toBe(SALVIA_COLORS.background);
  await expect.poll(previewVar(page, "--solara-radius"), { timeout: 15_000 }).toBe("8px");
});

test("Restaurar geometría restaura solo el grupo de geometría (incluye el contenedor)", async ({
  page,
}) => {
  await setupCleanStore(page, "Tienda T8 geometría");
  await openThemeTab(page);

  const opening = await readTheme(page);
  await applyEdits(page);

  await page.getByTestId("ui-reset-geometry").click();

  const restored = await readTheme(page);
  expect(restored.spacingScale).toBe(opening.spacingScale);
  expect(restored.radius).toBe(opening.radius);
  expect(restored.container).toBe(opening.container);
  expect(restored.colors).toEqual(SALVIA_COLORS);
  expect(restored.typography).toEqual(EDITED_TYPOGRAPHY);

  await expect
    .poll(previewVar(page, "--solara-container"), { timeout: 15_000 })
    .toBe(`${opening.container}px`);
  await expect
    .poll(previewVar(page, "--solara-radius"), { timeout: 15_000 })
    .toBe(`${opening.radius}px`);
  await expect.poll(previewVar(page, "--solara-type-scale"), { timeout: 15_000 }).toBe("1.15");
  await expect
    .poll(previewVar(page, "--solara-background"), { timeout: 15_000 })
    .toBe(SALVIA_COLORS.background);
});

test("los resets limpian borradores inválidos de color y de contenedor (fix A16)", async ({
  page,
}) => {
  await setupCleanStore(page, "Tienda T8 borradores");
  await openThemeTab(page);

  const accentText = page.getByTestId("ui-color-text-accent");
  const accentNative = page.getByTestId("ui-color-native-accent");
  const accentField = fieldsetOf(accentText);
  const openingAccent = await accentText.inputValue();

  // Hex inválido con los colores confirmados SIN cambios: el reset debe
  // descartar el borrador aunque el efecto de [project.theme.colors] no se
  // dispare (fix A16 de ThemeEditor).
  await accentText.fill("zzz");
  await expect(accentText).toHaveAttribute("aria-invalid", "true");
  await expect(accentField.getByTestId("ui-field-error")).toContainText("Ingresá un color hex");

  await page.getByTestId("ui-reset-colors").click();
  await expect(accentText).toHaveValue(openingAccent);
  await expect(accentText).not.toHaveAttribute("aria-invalid", "true");
  await expect(accentField.getByTestId("ui-field-error")).toHaveCount(0);
  await expect(accentNative).toHaveValue(openingAccent);

  // Mismo patrón para el borrador del ancho del contenedor (fuera de rango).
  // "900" queda por debajo del mínimo; el input ya no tiene step (fix T8-B1:
  // los valores no-múltiplos de 20 se descartaban en silencio).
  const container = page.getByLabel("Ancho del contenedor");
  const containerField = fieldsetOf(container);
  const openingContainer = await container.inputValue();
  await container.click();
  await page.keyboard.press("ControlOrMeta+A");
  await page.keyboard.type("900");
  await expect(container).toHaveAttribute("aria-invalid", "true");
  await expect(containerField.getByTestId("ui-field-error")).toContainText(
    "Ingresá un ancho de 960 a 1800 px",
  );

  await page.getByTestId("ui-reset-geometry").click();
  await expect(container).toHaveValue(openingContainer);
  await expect(container).not.toHaveAttribute("aria-invalid", "true");
  await expect(containerField.getByTestId("ui-field-error")).toHaveCount(0);

  // Un valor válido que NO es múltiplo del viejo step (20) commitea y
  // persiste: ni el borrador ni el token lo pierden (fix T8-B1).
  await container.click();
  await page.keyboard.press("ControlOrMeta+A");
  await page.keyboard.type("1150");
  await expect(container).toHaveValue("1150");
  await expect(container).not.toHaveAttribute("aria-invalid", "true");
  await expect(containerField.getByTestId("ui-field-error")).toHaveCount(0);
  await expect.poll(previewVar(page, "--solara-container"), { timeout: 15_000 }).toBe("1150px");

  await page.getByTestId("ui-reset-geometry").click();
  await expect(container).toHaveValue(openingContainer);
  await expect(container).not.toHaveAttribute("aria-invalid", "true");
  await expect(containerField.getByTestId("ui-field-error")).toHaveCount(0);
});

test("persistencia: recargar la pestaña conserva el tema editado y reancla los resets", async ({
  page,
}) => {
  const storeName = "Tienda T8 recarga";
  await setupCleanStore(page, storeName);
  await openThemeTab(page);

  await page.getByRole("button", { name: "Aplicar paleta Jardín de salvia" }).click();
  await page.getByTestId("ui-font-display").selectOption(EDITED_TYPOGRAPHY.display);
  await page.getByLabel("Ancho del contenedor").fill(String(EDITED_GEOMETRY.container));
  await flushSave(page);

  await page.reload();
  await expect(page.getByRole("heading", { name: "Tus tiendas" })).toBeVisible();

  const card = page.locator(".dashboard-store-card").filter({ hasText: storeName }).first();
  await card.locator(".dashboard-store-card__button").click();
  await page.getByRole("button", { name: "Abrir tienda", exact: true }).click();
  await expect(page.getByRole("navigation", { name: "Áreas de la tienda" })).toBeVisible();
  await openThemeTab(page);

  await expect(page.getByTestId("ui-color-text-background")).toHaveValue(SALVIA_COLORS.background);
  await expect(page.getByTestId("ui-font-display")).toHaveValue(EDITED_TYPOGRAPHY.display);
  await expect(page.getByLabel("Ancho del contenedor")).toHaveValue(
    String(EDITED_GEOMETRY.container),
  );

  // La apertura de la pestaña tras la recarga es la versión guardada: el
  // reset vuelve a esos valores editados, no a los de la plantilla.
  await page.getByTestId("ui-reset-colors").click();
  await expect(page.getByTestId("ui-color-text-background")).toHaveValue(SALVIA_COLORS.background);
  await expect(page.getByTestId("ui-font-display")).toHaveValue(EDITED_TYPOGRAPHY.display);
  await expect(page.getByLabel("Ancho del contenedor")).toHaveValue(
    String(EDITED_GEOMETRY.container),
  );
});

test("persistencia: Guardar en el navegador conserva todo el tema tras recargar la app (IndexedDB)", async ({
  page,
}) => {
  await resetIndexedDb(page);
  await openDemoStore(page);
  await openThemeTab(page);

  await applyEdits(page);
  await flushSave(page);

  await page.reload();
  await expect(page.getByRole("heading", { name: "Tus tiendas" })).toBeVisible();
  await openDemoStore(page);
  await openThemeTab(page);

  const restored = await readTheme(page);
  expect(restored).toEqual(editedTheme);
  await expect
    .poll(previewVar(page, "--solara-background"), { timeout: 15_000 })
    .toBe(SALVIA_COLORS.background);
});

test("persistencia: el respaldo .solara.json descargado contiene el theme editado", async ({
  page,
}) => {
  await resetIndexedDb(page);
  await openDemoStore(page);
  await openThemeTab(page);

  await applyEdits(page);
  await flushSave(page);

  await page.getByRole("button", { name: "Volver a tiendas" }).click();
  await expect(page.getByRole("heading", { name: "Tus tiendas" })).toBeVisible();

  const detail = page.getByRole("region", { name: "Tienda seleccionada: Predeterminado" });
  const downloadPromise = page.waitForEvent("download");
  await detail.getByRole("button", { name: "Respaldo ahora" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("demo-catalogo-jerarquico-respaldo.solara.json");

  const envelope = JSON.parse(readFileSync((await download.path()) ?? "", "utf8")) as {
    format: string;
    version: number;
    project: { schemaVersion: number; id: string; theme: Theme };
  };
  expect(envelope.format).toBe("solara-project");
  expect(envelope.version).toBe(2);
  expect(envelope.project.schemaVersion).toBe(2);
  expect(envelope.project.id).toBe("store-modo-sur-demo");
  expect(envelope.project.theme).toEqual(editedTheme);
});

test("utilidad: tras los tres resets el preview y el sitio exportado vuelven al estado inicial (diff)", async ({
  page,
}) => {
  await setupCleanStore(page, "Tienda T8 utilidad");
  await openThemeTab(page);

  const opening = await readTheme(page);
  expect(opening).toEqual(demoTheme);

  await applyEdits(page);
  const edited = await readTheme(page);
  expect(edited).toEqual(editedTheme);

  await page.getByTestId("ui-reset-colors").click();
  await page.getByTestId("ui-reset-typography").click();
  await page.getByTestId("ui-reset-geometry").click();

  const restored = await readTheme(page);
  expect(restored).toEqual(opening);

  // Preview: los tokens de los tres grupos vuelven al estado de apertura.
  await expect
    .poll(previewVar(page, "--solara-background"), { timeout: 15_000 })
    .toBe(opening.colors.background);
  await expect
    .poll(previewVar(page, "--solara-radius"), { timeout: 15_000 })
    .toBe(`${opening.radius}px`);
  await expect
    .poll(previewVar(page, "--solara-container"), { timeout: 15_000 })
    .toBe(`${opening.container}px`);
  await expect.poll(previewVar(page, "--solara-type-scale"), { timeout: 15_000 }).toBe("1");

  // Sitio exportado: el diff entre el estado inicial y el posterior a los
  // resets es vacío; el estado editado sí cambia los tokens.
  const initial = themeCssOf(initialExport);
  const afterReset = themeCssOf(resetExport);
  const afterEdit = themeCssOf(editedExport);
  expect(afterReset).toEqual(initial);
  expect(afterEdit).not.toEqual(initial);
  const editedCss = afterEdit.join("\n");
  expect(editedCss).toContain(`--solara-background:${SALVIA_COLORS.background}`);
  expect(editedCss).toContain(`--solara-radius:${EDITED_GEOMETRY.radius}px`);
  expect(editedCss).toContain(`--solara-container:${EDITED_GEOMETRY.container}px`);
  expect(editedCss).toContain("--solara-type-scale:1.15");
  // minifyCss compacta el espacio tras la coma de la familia tipográfica.
  expect(editedCss).toContain(
    `--solara-font-display:${EDITED_TYPOGRAPHY.display.replaceAll(", ", ",")}`,
  );
  expect(editedCss).toContain(`--solara-font-body:${EDITED_TYPOGRAPHY.body.replaceAll(", ", ",")}`);
});
