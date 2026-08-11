import type { Server } from "node:http";
import { expect, type Page, test } from "@playwright/test";
import { exportProject } from "@solara/exporter";
import { catalogModernCleanStore } from "@solara/project-schema/catalog-modern-template";
import { startStudioServer, stopStudioServer } from "./studio-server";

/**
 * Barrido T5 — Geometría del tema: radius (range 0-40) y spacingScale
 * (range 0.75-1.5).
 *
 * Capa 4 (utilidad) es el foco: el CSS exportado antes vs después del cambio
 * y el render real del preview. Hallazgo de esta auditoría (confirmado con
 * evidencia de grep y diff):
 *
 * 1. radius: el token --solara-radius SÍ tiene reglas consumidoras en
 *    styles.ts (base + bloques legacy), pero los bloques catalog-modern
 *    overridean todas las superficies visibles con valores fijos
 *    (999px/20px/16px) y NUNCA usan var(--solara-radius). Resultado
 *    empírico: el fingerprint de border-radius del preview es idéntico con
 *    radio 40 y radio 0 (probe ejecutado en esta auditoría).
 * 2. spacingScale: --solara-space y --solara-space-scale se emiten pero
 *    NINGUNA regla las consume (grep completo en styles.ts/catalog-modern/
 *    definitions/runtime: 0 usos de var(--solara-space)). El slider cambia
 *    dos vars que nadie lee: dead control confirmado por diff del CSS (solo
 *    cambian las dos líneas de la var) y por fingerprint idéntico del render.
 * 3. --solara-display (exporter:585) es un duplicado muerto de
 *    --solara-font-display (exporter:587): mismo valor emitido, y solo
 *    --solara-font-display tiene consumidores en styles.ts (85, 291, 583,
 *    1709).
 *
 * Los specs de comportamiento ACTUAL documentan el dead control; los
 * test.fixme nombran el fix de Ola 3 que debe invertir esas aserciones.
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
  await page.getByRole("button", { name: "Crear tienda vacía", exact: true }).click();
  await expect(page.getByRole("navigation", { name: "Áreas de la tienda" })).toBeVisible({
    timeout: 30_000,
  });
}

async function openThemeTab(page: Page): Promise<void> {
  await page.getByRole("tab", { name: "Tema", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Tema", exact: true })).toBeVisible();
}

function previewRoot(page: Page) {
  return page.frameLocator('iframe[title="Vista previa desktop"]').locator("html");
}

function previewVar(page: Page, name: string): () => Promise<string> {
  const html = previewRoot(page);
  return () =>
    html.evaluate(
      (element, token) => getComputedStyle(element).getPropertyValue(token).trim(),
      name,
    );
}

/**
 * Fingerprint de estilos de todos los elementos del preview. Devuelve una
 * lista ordenada de líneas "tag.clase:prop=valor|...". Dos fingerprints
 * iguales prueban que el render NO cambió.
 */
async function styleFingerprint(page: Page, props: string[]): Promise<string> {
  const root = page.frameLocator('iframe[title="Vista previa desktop"]').locator(".solara-page");
  return root.evaluate(
    (element, propNames) => {
      const lines: string[] = [];
      for (const el of element.querySelectorAll("*")) {
        const computed = getComputedStyle(el);
        const values = propNames
          .map((property) => `${property}=${computed.getPropertyValue(property).trim()}`)
          .join("|");
        lines.push(`${el.tagName}.${String(el.className)}:${values}`);
      }
      return lines.sort().join("\n");
    },
    props,
  );
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
  return String(exportProject(project, { mode: "draft" }).files.get("assets/storefront.css"));
}

test("radius: el token llega al preview y al sitio, pero el radio visual no cambia (T5)", async ({
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

  // El token se emite y las reglas base/legacy lo consumen en el CSS del
  // sitio exportado: la cadena de emisión existe.
  const css40 = exportCss(40, 1);
  const css0 = exportCss(0, 1);
  expect(css40).toMatch(/--solara-radius:\s*40px;/);
  expect(css0).toMatch(/--solara-radius:\s*0px;/);
  expect(css40.match(/border-radius:\s*var\(--solara-radius\)/g) ?? []).toHaveLength(5);

  // Comportamiento ACTUAL (evidencia empírica): los bloques catalog-modern
  // overridean todas las superficies visibles con radios fijos (999px, 20px,
  // 16px) y ninguno usa var(--solara-radius); el render es idéntico. El fix
  // de Ola 3 debe convertir esta igualdad en diferencia.
  expect(fingerprint40).toBe(fingerprint0);
});

test.fixme(
  "radius: efecto visible en catalog-modern tras conectar var(--solara-radius) a los bloques modernos (fix Ola 3, OWNER styles.ts)",
  async ({ page }) => {
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
  },
);

test("spacingScale: el valor llega a las vars pero ninguna regla la consume; el render no cambia (T5)", async ({
  page,
}) => {
  await setupCleanStore(page, "T5 spacing");
  await openThemeTab(page);

  const spacing = page.getByLabel(/^Espaciado /);

  await spacing.fill("1.5");
  await expect(page.getByLabel("Espaciado 1.50")).toBeVisible();
  await expect.poll(previewVar(page, "--solara-space"), { timeout: 15_000 }).toBe("1.5");
  await expect.poll(previewVar(page, "--solara-space-scale"), { timeout: 15_000 }).toBe("1.5");
  const fingerprint15 = await styleFingerprint(page, SPACING_PROPS);
  expect(fingerprint15.length).toBeGreaterThan(0);

  await spacing.fill("0.75");
  await expect.poll(previewVar(page, "--solara-space"), { timeout: 15_000 }).toBe("0.75");
  await expect.poll(previewVar(page, "--solara-space-scale"), { timeout: 15_000 }).toBe("0.75");
  const fingerprint075 = await styleFingerprint(page, SPACING_PROPS);

  // Dead control confirmado por diff del sitio: solo cambian las dos líneas
  // de la var; ninguna regla del CSS usa var(--solara-space) o
  // var(--solara-space-scale).
  const css15 = exportCss(1, 1.5);
  const css075 = exportCss(1, 0.75);
  expect(css15).toMatch(/--solara-space:\s*1\.5;/);
  expect(css15).toMatch(/--solara-space-scale:\s*1\.5;/);
  expect(css15).not.toContain("var(--solara-space)");
  expect(css15).not.toContain("var(--solara-space-scale)");
  expect(css15.replace(/--solara-space(?:-scale)?:\s*[\d.]+;/g, "")).toBe(
    css075.replace(/--solara-space(?:-scale)?:\s*[\d.]+;/g, ""),
  );

  // Comportamiento ACTUAL: el slider cambia la var pero el render es
  // idéntico (0 consumidores). El fix de Ola 3 debe invertir esta igualdad.
  expect(fingerprint15).toBe(fingerprint075);
});

test.fixme(
  "spacingScale: efecto visible tras conectar --solara-space a gaps/paddings reales (fix Ola 3, OWNER styles.ts + ThemeEditor)",
  async ({ page }) => {
    await setupCleanStore(page, "T5 spacing fix");
    await openThemeTab(page);

    const spacing = page.getByLabel(/^Espaciado /);
    await spacing.fill("1.5");
    await expect.poll(previewVar(page, "--solara-space"), { timeout: 15_000 }).toBe("1.5");
    const fingerprint15 = await styleFingerprint(page, SPACING_PROPS);
    await spacing.fill("0.75");
    await expect.poll(previewVar(page, "--solara-space"), { timeout: 15_000 }).toBe("0.75");
    const fingerprint075 = await styleFingerprint(page, SPACING_PROPS);
    expect(fingerprint15).not.toBe(fingerprint075);

    const css = exportCss(1, 1.5);
    expect(css).toContain("var(--solara-space");
  },
);

test("--solara-display: duplicado muerto de --solara-font-display (T5)", async () => {
  const css = exportCss(1, 1);

  // Ambas vars se emiten con el mismo valor (exporter index.ts:585 y 587).
  const display = /--solara-display:\s*([^;]+);/.exec(css)?.[1];
  const fontDisplay = /--solara-font-display:\s*([^;]+);/.exec(css)?.[1];
  expect(fontDisplay).toBeTruthy();
  expect(display).toBe(fontDisplay);

  // Solo --solara-font-display tiene consumidores en styles.ts
  // (85, 291, 583, 1709); --solara-display no se lee en ninguna regla.
  expect(css).toContain("var(--solara-font-display)");
  expect(css).not.toContain("var(--solara-display)");
});
