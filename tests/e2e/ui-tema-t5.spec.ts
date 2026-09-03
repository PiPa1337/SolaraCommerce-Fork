import type { Server } from "node:http";
import { expect, type Page, test } from "@playwright/test";
import { exportProject } from "@solara/exporter";
import { catalogModernCleanStore } from "@solara/project-schema/catalog-modern-template";
import { readHashedStorefrontCss } from "./export-helpers";
import { startStudioServer, stopStudioServer } from "./studio-server";

/**
 * Barrido T5 — Geometría del tema: radius (range 0-40) y spacingScale
 * (range 0.75-1.5).
 *
 * Capa 4 (utilidad) es el foco: el CSS exportado antes vs después del cambio
 * y el render real del preview. La auditoría (2026-08-10) confirmó dos dead
 * controls: los bloques catalog-modern overrideaban el radio con valores
 * fijos y nadie consumía --solara-space/--solara-space-scale. El fix de Ola 3
 * (styles.ts) conectó ambos:
 *
 * 1. radius: las superficies modernas (cards, inputs, botones, dialogs)
 *    usan var(--solara-radius); las pills/badges semánticas conservan 999px.
 * 2. spacingScale: las grillas y stacks principales del skin moderno usan
 *    gap: calc(Xrem * var(--solara-space-scale, 1)), y la var ya tiene
 *    consumidores reales en el CSS exportado.
 * 3. --solara-display y --solara-body eran duplicados muertos; la emisión
 *    quedó en el token canónico (--solara-font-display / --solara-font-body),
 *    y --solara-space se unificó en --solara-space-scale (exporter).
 *
 * Este spec aserTA el comportamiento CORREGIDO: los fingerprints de
 * border-radius y de gap/padding/margin difieren entre valores extremos.
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
  await expect(page.getByRole("heading", { name: "Tus tiendas" })).toBeVisible({
    timeout: 30_000,
  });
  await page.getByRole("button", { name: "Nueva tienda", exact: true }).click();
  await page.getByLabel("Nueva tienda").fill(name);
  await page.getByRole("button", { name: "Continuar", exact: true }).click();
  await page.getByRole("button", { name: "Continuar", exact: true }).click();
  await page.getByRole("button", { name: "Continuar", exact: true }).click();
  await page.getByRole("button", { name: "Crear tienda desde plantilla", exact: true }).click();
  await expect(page.getByRole("navigation", { name: "Áreas de la tienda" })).toBeVisible({
    timeout: 30_000,
  });
}

async function openThemeTab(page: Page): Promise<void> {
  await page.getByRole("tab", { name: "Tema de la tienda", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Tema de la tienda", exact: true })).toBeVisible();
}

function previewRoot(page: Page) {
  return page.frameLocator('iframe[title="Vista previa desktop"]').locator("html");
}

function previewVar(page: Page, name: string): () => Promise<string> {
  const html = previewRoot(page);
  return async () => {
    try {
      return await html.evaluate(
        (element, token) => getComputedStyle(element).getPropertyValue(token).trim(),
        name,
      );
    } catch (reason) {
      if (reason instanceof Error && reason.message.includes("Frame was detached")) return "";
      throw reason;
    }
  };
}

/**
 * Fingerprint de estilos de todos los elementos del preview. Devuelve una
 * lista ordenada de líneas "tag.clase:prop=valor|...". Dos fingerprints
 * iguales prueban que el render NO cambió.
 */
async function styleFingerprint(page: Page, props: string[]): Promise<string> {
  const root = page.frameLocator('iframe[title="Vista previa desktop"]').locator(".solara-page");
  return root.evaluate((element, propNames) => {
    const lines: string[] = [];
    for (const el of element.querySelectorAll("*")) {
      const computed = getComputedStyle(el);
      const values = propNames
        .map((property) => `${property}=${computed.getPropertyValue(property).trim()}`)
        .join("|");
      lines.push(`${el.tagName}.${String(el.className)}:${values}`);
    }
    return lines.sort().join("\n");
  }, props);
}

const RADIUS_PROPS = [
  "border-radius",
  "border-top-left-radius",
  "border-top-right-radius",
  "border-bottom-left-radius",
  "border-bottom-right-radius",
];

const SPACING_PROPS = [
  "gap",
  "row-gap",
  "column-gap",
  "padding-top",
  "padding-bottom",
  "padding-left",
  "padding-right",
  "margin-top",
  "margin-bottom",
  "margin-left",
  "margin-right",
];

function exportCss(radius: number, spacingScale: number): string {
  const project = structuredClone(catalogModernCleanStore);
  project.theme = { ...project.theme, radius, spacingScale };
  return readHashedStorefrontCss(exportProject(project, { mode: "draft" }).files);
}

test("radius: el token llega al preview y al sitio y el radio visual cambia (T5)", async ({
  page,
}) => {
  await setupCleanStore(page, "T5 radius");
  await openThemeTab(page);

  const radius = page.getByLabel(/^Radio /);

  await radius.fill("40");
  await expect(page.getByLabel("Radio 40px")).toBeVisible();
  await expect.poll(previewVar(page, "--solara-radius"), { timeout: 15_000 }).toBe("40px");
  const fingerprint40 = await styleFingerprint(page, RADIUS_PROPS);
  expect(fingerprint40.length).toBeGreaterThan(0);

  await radius.fill("0");
  await expect.poll(previewVar(page, "--solara-radius"), { timeout: 15_000 }).toBe("0px");
  const fingerprint0 = await styleFingerprint(page, RADIUS_PROPS);

  // La cadena de emisión y consumo llega al CSS del sitio exportado: las
  // superficies modernas (cards, inputs, botones, dialogs) usan la var.
  // El skin moderno aplica el token a todas sus superficies (incluidas las
  // nuevas rutas editoriales y de checkout).
  const css40 = exportCss(40, 1);
  const css0 = exportCss(0, 1);
  expect(css40).toMatch(/--solara-radius:\s*40px;/);
  expect(css0).toMatch(/--solara-radius:\s*0px;/);
  // El skin moderno tiene 36 consumidores declarados desde que el panel del
  // menú hamburguesa pasó a pantalla completa sin radio (be9dceb6); los
  // controles de búsqueda son deliberadamente cuadrados y no dependen del
  // radio del tema.
  expect(css40.match(/border-radius:\s*var\(--solara-radius\)/g) ?? []).toHaveLength(36);

  // Comportamiento CORREGIDO (fix Ola 3): las superficies del skin moderno
  // consumen var(--solara-radius); el render del preview difiere entre 40 y 0.
  expect(fingerprint40).not.toBe(fingerprint0);
});

test("radius: los controles de búsqueda permanecen cuadrados (T5)", async ({ page }) => {
  await setupCleanStore(page, "T5 radius fix");
  await openThemeTab(page);

  const radius = page.getByLabel(/^Radio /);
  await radius.fill("40");
  await expect.poll(previewVar(page, "--solara-radius"), { timeout: 15_000 }).toBe("40px");
  const fingerprint40 = await styleFingerprint(page, RADIUS_PROPS);
  await radius.fill("0");
  await expect.poll(previewVar(page, "--solara-radius"), { timeout: 15_000 }).toBe("0px");
  const fingerprint0 = await styleFingerprint(page, RADIUS_PROPS);
  expect(fingerprint40).not.toBe(fingerprint0);

  // Una superficie principal (hero) sigue el slider...
  await radius.fill("40");
  await expect.poll(previewVar(page, "--solara-radius"), { timeout: 15_000 }).toBe("40px");
  const heroRadius = await previewRoot(page)
    .locator(".catalog-hero-inner")
    .first()
    .evaluate((element) => getComputedStyle(element).borderRadius);
  expect(heroRadius).toBe("40px");

  // ...pero los controles de búsqueda mantienen la geometría cuadrada.
  const searchRadius = await previewRoot(page)
    .locator(".catalog-search-link")
    .first()
    .evaluate((element) => getComputedStyle(element).borderRadius);
  expect(searchRadius).toBe("0px");
});

test("spacingScale: el valor llega a la var y las grillas modernas cambian su gap (T5)", async ({
  page,
}) => {
  await setupCleanStore(page, "T5 spacing");
  await openThemeTab(page);

  const spacing = page.getByLabel(/^Espaciado /);

  await spacing.fill("1.5");
  await expect(page.getByLabel("Espaciado 1.50")).toBeVisible();
  await expect.poll(previewVar(page, "--solara-space-scale"), { timeout: 15_000 }).toBe("1.5");
  const fingerprint15 = await styleFingerprint(page, SPACING_PROPS);
  expect(fingerprint15.length).toBeGreaterThan(0);

  await spacing.fill("0.75");
  await expect.poll(previewVar(page, "--solara-space-scale"), { timeout: 15_000 }).toBe("0.75");
  const fingerprint075 = await styleFingerprint(page, SPACING_PROPS);

  // Fix Ola 3: la var ya tiene consumidores reales en el CSS exportado
  // (grillas y stacks principales del skin moderno usan
  // calc(Xrem * var(--solara-space-scale, 1))); el resto del CSS solo
  // difiere en la línea de la var.
  const css15 = exportCss(1, 1.5);
  const css075 = exportCss(1, 0.75);
  expect(css15).toMatch(/--solara-space-scale:\s*1\.5;/);
  expect(css15).toContain("var(--solara-space-scale");
  expect(css15.replace(/--solara-space-scale:\s*[\d.]+;/g, "")).toBe(
    css075.replace(/--solara-space-scale:\s*[\d.]+;/g, ""),
  );

  // Comportamiento CORREGIDO: el slider cambia gaps/paddings reales y el
  // fingerprint del render difiere entre 1.5 y 0.75.
  expect(fingerprint15).not.toBe(fingerprint075);
});

test("spacingScale: el gap de la grilla principal de productos escala con el slider (T5)", async ({
  page,
}) => {
  await setupCleanStore(page, "T5 spacing fix");
  await openThemeTab(page);

  const spacing = page.getByLabel(/^Espaciado /);
  await spacing.fill("1.5");
  await expect.poll(previewVar(page, "--solara-space-scale"), { timeout: 15_000 }).toBe("1.5");
  const fingerprint15 = await styleFingerprint(page, SPACING_PROPS);
  await spacing.fill("0.75");
  await expect.poll(previewVar(page, "--solara-space-scale"), { timeout: 15_000 }).toBe("0.75");
  const fingerprint075 = await styleFingerprint(page, SPACING_PROPS);
  expect(fingerprint15).not.toBe(fingerprint075);

  // El CSS exportado consume la var en las grillas principales.
  const css = exportCss(1, 1.5);
  expect(css).toContain("var(--solara-space-scale");

  // La lectura inicial está en el mínimo del slider (0.75), por lo que el
  // extremo superior debe duplicar el gap, no multiplicarlo sólo por 1.5.
  const gridGap = async (): Promise<number> => {
    try {
      const value = await previewRoot(page)
        .locator(".catalog-product-grid")
        .first()
        .evaluate((element) => getComputedStyle(element).columnGap);
      return Number.parseFloat(value);
    } catch (reason) {
      if (reason instanceof Error && reason.message.includes("Frame was detached")) return -1;
      throw reason;
    }
  };
  await expect.poll(gridGap, { timeout: 15_000 }).toBeGreaterThan(0);
  const baseGap = await gridGap();
  // Para un range controlado, End/Home reproducen la interacción de usuario
  // completa y evitan que una asignación programática quede sin commit.
  await spacing.focus();
  await spacing.press("End");
  await spacing.blur();
  await expect.poll(previewVar(page, "--solara-space-scale"), { timeout: 15_000 }).toBe("1.5");
  await expect
    .poll(() => gridGap().then((value) => Math.abs(value - baseGap * (1.5 / 0.75))), {
      timeout: 15_000,
    })
    .toBeLessThanOrEqual(0.1);
  await spacing.press("Home");
  await spacing.blur();
  await expect.poll(previewVar(page, "--solara-space-scale"), { timeout: 15_000 }).toBe("0.75");
  await expect
    .poll(() => gridGap().then((value) => Math.abs(value - baseGap)), { timeout: 15_000 })
    .toBeLessThanOrEqual(0.1);
});

test("--solara-display: emisión muerta eliminada, queda solo el token canónico (T5)", async () => {
  const css = exportCss(1, 1);

  // --solara-font-display se emite y tiene consumidores en styles.ts
  // (85, 291, 583, 1709); --solara-display ya no se emite (exporter index.ts).
  expect(css).toContain("--solara-font-display:");
  expect(css).not.toMatch(/--solara-display:/);
  expect(css).toContain("var(--solara-font-display)");
  expect(css).not.toContain("var(--solara-display)");
});
