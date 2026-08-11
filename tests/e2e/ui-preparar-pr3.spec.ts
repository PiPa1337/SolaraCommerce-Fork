/**
 * Auditoría Preparar PR3 (2026-08-11) — Progreso y feedback del flujo guiado.
 * Plan: docs/superpowers/plans/2026-08-10-auditoria-preparar.md
 * (PR3: %, "X de N", barra, aria-live, iconos/labels del checklist y anuncio a
 * lectores de pantalla).
 *
 * Contrato de 4 capas:
 * - funcional: completar un requisito sube "X de N" y el percent de la barra;
 *   revertir un requisito (volver a estar pendiente) BAJA el conteo; el
 *   checklist y el resumen de listos suman el total real (sin dobles conteos);
 * - auto-feedback: `output.guided-progress` es la única región aria-live del
 *   tab y su texto cambia con el estado; la barra es un `progressbar` con
 *   aria-valuenow exacto (percent real del modelo, no el de la severidad);
 * - datos: el percent del modelo es el percent de la UI (paridad modelo↔DOM,
 *   `Math.round(ready/total*100)` con los fixtures clean y demo);
 * - utilidad: "N pendientes bloquean producción" usa el gate REAL del export
 *   (criticalCount de `auditProjectInWorker`, mismo worker que el tab
 *   Exportar — fix 237fed0 vigente): singular, plural y paridad 1:1 con el
 *   resumen de críticos del Export en ambas direcciones; completar un
 *   requisito NO crítico del audit NO desbloquea (la copia no miente).
 *
 * A11y del checklist: los estados se anuncian por TEXTO (label "Falta
 * completar" / "Reemplazar texto de plantilla" / "Listo") dentro del árbol
 * accesible (verificado con ariaSnapshot); el icono (CheckCircle/WarningCircle/
 * XCircle) es decorativo (aria-hidden) y no duplica el anuncio. El estado
 * `invalid` es defensivo: el schema rechaza el dato y lo deriva a
 * recuperación (R7-F3), por lo que no aparece en ningún proyecto persistido.
 */
import type { Server } from "node:http";
import { expect, type Page, test } from "@playwright/test";
import { StoreProjectV1Schema } from "@solara/project-schema";
import { catalogModernStore } from "@solara/project-schema/catalog-modern-fixture";
import { evaluateCatalogModernReadiness } from "@solara/project-schema/catalog-modern-guidance";
import { buildCatalogModernProject } from "@solara/project-schema/catalog-modern-template";
import { createCleanStore } from "./project-helpers";
import { startStudioServer, stopStudioServer } from "./studio-server";

test.setTimeout(process.env.CI ? 150_000 : 90_000);

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
  await createCleanStore(page, name);
}

async function openPreparar(page: Page): Promise<void> {
  await page.getByRole("tab", { name: "Preparar", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Preparar tienda" })).toBeVisible();
}

/** La barra del progreso: role progressbar con el percent real del modelo. */
function progressBar(page: Page) {
  return page.getByTestId("ui-guided-progress");
}

/** Región viva del progreso: el output que anuncia los cambios a lectores de pantalla. */
function liveRegion(page: Page) {
  return page.locator("output.guided-progress");
}

function pendingRequirements(page: Page) {
  return page.locator('section.guided-checklist > ul > [data-testid="ui-guided-requirement"]');
}

function doneRequirement(page: Page, id: string) {
  return page.locator(`[data-testid="ui-guided-done"] [data-requirement-id="${id}"]`);
}

async function readProgressText(page: Page): Promise<{ ready: number; total: number }> {
  const text = await page.locator(".guided-progress__copy > strong").innerText();
  const match = text.match(/^(\d+) de (\d+) requisitos listos$/);
  expect(match, `copia de progreso inesperada: ${text}`).not.toBeNull();
  return { ready: Number(match?.[1]), total: Number(match?.[2]) };
}

test("completar un requisito sube X/N, el percent real y el contenido de la región viva (PR3-1)", async ({
  page,
}) => {
  await setupCleanStore(page, "Tienda PR3 progreso");
  await openPreparar(page);

  // Auto-feedback: la región viva del progreso es UN output aria-live polite y
  // es la única región viva del tab (sin anuncios duplicados).
  const live = liveRegion(page);
  await expect(live).toBeVisible();
  await expect(live).toHaveAttribute("aria-live", "polite");
  await expect(page.locator("section.guided-overview [aria-live]")).toHaveCount(1);

  // La barra es un progressbar con nombre y rango, y su valor es el percent real
  // del modelo: 5 de 18 = round(5/18*100) = 28.
  const bar = progressBar(page);
  await expect(bar).toHaveAttribute("role", "progressbar");
  await expect(bar).toHaveAttribute("aria-label", "Progreso de preparación");
  await expect(bar).toHaveAttribute("aria-valuemin", "0");
  await expect(bar).toHaveAttribute("aria-valuemax", "100");
  await expect(bar).toHaveAttribute("aria-valuenow", "28");
  await expect(bar.locator("span")).toHaveAttribute("style", "width: 28%;");

  // Funcional/datos: la copia X/N coincide con el modelo y con la barra.
  expect(await readProgressText(page)).toEqual({ ready: 5, total: 18 });
  expect(Math.round((5 / 18) * 100)).toBe(28);
  await expect(page.locator(".guided-progress__copy > strong")).toHaveText(
    "5 de 18 requisitos listos",
  );

  // Gate real (fix 237fed0 vigente): la plantilla limpia tiene exactamente 1
  // crítico del audit (template.placeholder), no los 13 pendientes de la guía.
  await expect(page.locator(".guided-progress__copy > span")).toHaveText(
    "1 pendiente bloquea producción.",
    { timeout: 20_000 },
  );

  const beforeText = await live.innerText();
  expect(beforeText).toContain("5 de 18 requisitos listos");

  // Completa UN requisito (Descripción de marca) desde el Resumen.
  await page.getByRole("tab", { name: "Resumen", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Resumen", exact: true })).toBeVisible();
  await page
    .getByLabel("Descripción", { exact: true })
    .fill("Textiles artesanales de estación para todos los días.");
  await page.keyboard.press("Tab");
  await expect(page.getByTestId("ui-save-indicator")).toContainText("Cambios guardados", {
    timeout: 5_000,
  });

  await openPreparar(page);

  // X/N sube 4 → 5, y la barra pasa a round(5/17*100) = 29 (percent real, no
  // un redondeo a mano).
  const after = await readProgressText(page);
  expect(after).toEqual({ ready: 6, total: 18 });
  expect(Math.round((6 / 18) * 100)).toBe(33);
  await expect(page.locator(".guided-progress__copy > strong")).toHaveText(
    "6 de 18 requisitos listos",
  );
  await expect(bar).toHaveAttribute("aria-valuenow", "33");
  await expect(bar.locator("span")).toHaveAttribute("style", "width: 33%;");

  // La región viva anuncia el nuevo estado: su contenido cambió y lleva el X/N.
  const afterText = await live.innerText();
  expect(afterText).not.toBe(beforeText);
  expect(afterText).toContain("6 de 18 requisitos listos");

  // Checklist: el requisito completado salió de pendientes (12 visibles, sin
  // "+N más") y figura como listo con su estado y conteo reales; pendientes +
  // listos = 17 (sin dobles conteos).
  await expect(pendingRequirements(page)).toHaveCount(12);
  await expect(page.locator(".guided-checklist__more")).toHaveCount(0);
  await expect(page.getByTestId("ui-guided-done").locator("summary")).toHaveText(
    "Requisitos listos (6)",
  );
  await expect(doneRequirement(page, "identity.description")).toHaveAttribute(
    "data-requirement-status",
    "ready",
  );

  // Gate honesto: completar un requisito que NO es crítico del audit no
  // desbloquea producción; la copia sigue al gate real (sigue en 1).
  await expect(page.locator(".guided-progress__copy > span")).toHaveText(
    "1 pendiente bloquea producción.",
    { timeout: 20_000 },
  );
});

test("iconos y labels del checklist por estado, anunciados a lectores de pantalla (PR3-2)", async ({
  page,
}) => {
  await setupCleanStore(page, "Tienda PR3 estados");
  await openPreparar(page);

  // La plantilla limpia tiene 13 pendientes: los primeros 12 visibles y 1
  // oculto en "+N más" (el 4to asset).
  await expect(pendingRequirements(page)).toHaveCount(12);
  await expect(page.locator(".guided-checklist__more")).toHaveText("+1 más");

  // Estados puntuales con sus labels reales (scope · estado):
  // - identity.email nace vacío en la plantilla → missing → "Falta completar";
  // - identity.description es texto de plantilla → placeholder;
  // - identity.whatsapp es el sentinel → placeholder (override R7-F2 vigente);
  // - los assets de plantilla → placeholder.
  const email = page.locator(
    '[data-testid="ui-guided-requirement"][data-requirement-id="identity.email"]',
  );
  await expect(email).toHaveAttribute("data-requirement-status", "missing");
  await expect(email.locator(".guided-checklist__text small")).toHaveText(
    "Marca · Falta completar",
  );

  const description = page.locator(
    '[data-testid="ui-guided-requirement"][data-requirement-id="identity.description"]',
  );
  await expect(description).toHaveAttribute("data-requirement-status", "placeholder");
  await expect(description.locator(".guided-checklist__text small")).toHaveText(
    "Marca · Reemplazar texto de plantilla",
  );

  const whatsapp = page.locator(
    '[data-testid="ui-guided-requirement"][data-requirement-id="identity.whatsapp"]',
  );
  await expect(whatsapp).toHaveAttribute("data-requirement-status", "placeholder");

  const heroAsset = page.locator(
    '[data-testid="ui-guided-requirement"][data-requirement-id="asset.asset-hero.alt"]',
  );
  await expect(heroAsset).toHaveAttribute("data-requirement-status", "placeholder");
  await expect(heroAsset.locator(".guided-checklist__text small")).toHaveText(
    "Imágenes · Reemplazar texto de plantilla",
  );

  // Para CADA pendiente visible: el icono es decorativo (aria-hidden) y su
  // data-status coincide con el del requisito; el ESTADO se anuncia por texto
  // según el mapeo de GuidedOverview.tsx:44-49. Si un estado llegara a ser
  // `invalid` en un proyecto persistido, el label "Revisar formato" fallaría
  // aquí (el estado invalid es defensivo: R7-F3).
  const statusLabelByStatus: Record<string, string> = {
    missing: "Falta completar",
    placeholder: "Reemplazar texto de plantilla",
    invalid: "Revisar formato",
  };
  for (const item of await pendingRequirements(page).all()) {
    const status = await item.getAttribute("data-requirement-status");
    expect(status, "requisito pendiente sin estado").not.toBeNull();
    expect(Object.hasOwn(statusLabelByStatus, status ?? "")).toBe(true);
    const icon = item.locator(".guided-checklist__status");
    await expect(icon).toHaveAttribute("aria-hidden", "true");
    await expect(icon).toHaveAttribute("data-status", status ?? "");
    await expect(icon.locator("svg")).toHaveCount(1);
    await expect(item.locator(".guided-checklist__text small")).toContainText(
      statusLabelByStatus[status ?? ""] ?? "",
    );
  }

  // Los listos: icono CheckCircle (data-status=ready, aria-hidden), scope y el
  // conteo real en el summary; el detalle se anuncia al abrirlo.
  await expect(page.getByTestId("ui-guided-done").locator("summary")).toHaveText(
    "Requisitos listos (5)",
  );
  await page.getByTestId("ui-guided-done").locator("summary").click();
  const readyBrand = page.locator(
    '[data-testid="ui-guided-done"] [data-requirement-id="identity.brand-name"]',
  );
  await expect(readyBrand).toHaveAttribute("data-requirement-status", "ready");
  const readyIcon = readyBrand.locator(".guided-checklist__status");
  await expect(readyIcon).toHaveAttribute("aria-hidden", "true");
  await expect(readyIcon).toHaveAttribute("data-status", "ready");
  await expect(readyIcon.locator("svg")).toHaveCount(1);
  await expect(readyBrand.locator(".guided-checklist__text small")).toHaveText("Marca");

  // Ningún proyecto persistido expone el estado `invalid` (el schema lo
  // rechaza y deriva a recuperación — R7-F3).
  await expect(
    page.locator('[data-testid="ui-guided-requirement"][data-requirement-status="invalid"]'),
  ).toHaveCount(0);

  // A11y: los estados están en el árbol accesible como TEXTO (ariaSnapshot los
  // incluye); el icono decorativo no los duplica.
  const snapshot = await page.locator("section.guided-checklist").ariaSnapshot();
  expect(snapshot).toContain("Falta completar");
  expect(snapshot).toContain("Reemplazar texto de plantilla");
  expect(snapshot).toContain("Requisitos listos (5)");
});

test("el gate de producción usa la auditoría real: singular, plural y paridad 1:1 con Exportar (PR3-3)", async ({
  page,
}) => {
  await setupCleanStore(page, "Tienda PR3 gate");
  await openPreparar(page);

  // Singular: la plantilla limpia tiene exactamente 1 crítico real.
  await expect(page.locator(".guided-progress__copy > span")).toHaveText(
    "1 pendiente bloquea producción.",
    { timeout: 20_000 },
  );

  // Paridad con el tab Exportar: la copia de la guía = criticalCount del audit.
  await page.getByRole("tab", { name: "Exportar", exact: true }).click();
  await expect(page.locator("output.optimization-export-summary")).toBeVisible({
    timeout: 20_000,
  });
  await expect(page.locator("output.optimization-export-summary")).toContainText("1 críticos");
  await expect(page.locator(".export-warning")).toContainText(
    "1 errores críticos deben resolverse.",
  );
  await expect(page.getByTestId("ui-export-production")).toBeDisabled();

  // Un segundo crítico REAL (dominio http:// → domain.https) debe subir la
  // copia al plural, con el mismo gate del export.
  await page.getByRole("tab", { name: "Resumen", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Resumen", exact: true })).toBeVisible();
  const urlInput = page.getByLabel("URL pública");
  const baseUrl = await urlInput.inputValue();
  expect(baseUrl.startsWith("https://")).toBe(true);
  await urlInput.fill(baseUrl.replace("https://", "http://"));
  await page.keyboard.press("Tab");
  await expect(page.getByTestId("ui-save-indicator")).toContainText("Cambios guardados", {
    timeout: 5_000,
  });

  await openPreparar(page);
  await expect(page.locator(".guided-progress__copy > span")).toHaveText(
    "2 pendientes bloquean producción.",
    { timeout: 20_000 },
  );

  await page.getByRole("tab", { name: "Exportar", exact: true }).click();
  await expect(page.locator("output.optimization-export-summary")).toBeVisible({
    timeout: 20_000,
  });
  await expect(page.locator("output.optimization-export-summary")).toContainText("2 críticos");
  await expect(page.locator(".export-warning")).toContainText(
    "2 errores críticos deben resolverse.",
  );
  await expect(page.getByTestId("ui-export-production")).toBeDisabled();

  // Revertir el dominio al HTTPS baja la copia a 1: el gate sigue al audit en
  // ambas direcciones (no es un contador interno de la guía).
  await page.getByRole("tab", { name: "Resumen", exact: true }).click();
  await page.getByLabel("URL pública").fill(baseUrl);
  await page.keyboard.press("Tab");
  await expect(page.getByTestId("ui-save-indicator")).toContainText("Cambios guardados", {
    timeout: 5_000,
  });

  await openPreparar(page);
  await expect(page.locator(".guided-progress__copy > span")).toHaveText(
    "1 pendiente bloquea producción.",
    { timeout: 20_000 },
  );
});

test("el percent del modelo es el percent de la UI y `invalid` es defensivo (PR3-4)", () => {
  const clean = buildCatalogModernProject({ seed: "clean" });
  const demo = catalogModernStore;

  // Datos: percent = round(ready/total*100) con los fixtures reales; la UI
  // muestra esos mismos valores (PR3-1: 24 → 29 sobre 17 requisitos).
  const cleanReadiness = evaluateCatalogModernReadiness(clean);
  expect(cleanReadiness.requirements).toHaveLength(18);
  expect(cleanReadiness.ready).toBe(5);
  expect(cleanReadiness.percent).toBe(28);
  expect(cleanReadiness.percent).toBe(Math.round((5 / 18) * 100));

  const demoReadiness = evaluateCatalogModernReadiness(demo);
  expect(demoReadiness.ready).toBe(284);
  expect(demoReadiness.pending).toBe(0);
  expect(demoReadiness.percent).toBe(100);

  // El mismo estado que completa PR3-1 (descripción real) produce el percent
  // que la UI muestra: paridad modelo↔DOM.
  const completed = structuredClone(clean);
  completed.identity.description = "Textiles artesanales de estación para todos los días.";
  const completedReadiness = evaluateCatalogModernReadiness(completed);
  expect(completedReadiness.ready).toBe(6);
  expect(completedReadiness.percent).toBe(33);

  // `invalid` existe en el modelo sólo como defensa: el dato que lo produce
  // (email sin @) es rechazado por el schema, así que un proyecto persistido
  // nunca lo expone (R7-F3) y el checklist tampoco (PR3-2).
  const invalid = structuredClone(clean);
  invalid.identity.email = "correo-sin-arroba";
  const invalidEmail = evaluateCatalogModernReadiness(invalid).requirements.find(
    (requirement) => requirement.id === "identity.email",
  );
  expect(invalidEmail?.status).toBe("invalid");
  const parsed = StoreProjectV1Schema.safeParse(invalid);
  expect(parsed.success).toBe(false);
  if (!parsed.success) {
    expect(
      parsed.error.issues.some((issue) => issue.path.includes("email")),
      "el rechazo debe apuntar al email",
    ).toBe(true);
  }
});
