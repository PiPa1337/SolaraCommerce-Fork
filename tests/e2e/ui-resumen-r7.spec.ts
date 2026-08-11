import type { Server } from "node:http";
import { expect, type Page, test } from "@playwright/test";
import { createCleanStore } from "./project-helpers";
import { startStudioServer, stopStudioServer } from "./studio-server";

/**
 * R7 — Flujo guiado del Resumen (plan `2026-08-10-auditoria-resumen.md`, bin R7,
 * contrato de 4 capas: funcional / auto-feedback / datos / utilidad).
 * Verifica que el checklist de Preparar refleje el proyecto REAL 1:1:
 *   - completar un campo marca el requisito done y el progreso % avanza;
 *   - "Siguiente" aterriza en el área del primer pendiente con el panel abierto
 *     (contrato H8-B3, fijado por F2, se reasegura como vigente);
 *   - "Modo avanzado" cambia al Constructor;
 *   - el gate de producción: un requisito pendiente debe verse reflejado en el
 *     Export (críticos → botón de producción deshabilitado);
 *   - badges de estado: ready / missing / placeholder (el sentinel de teléfono
 *     de la plantilla limpia es "placeholder": es un valor de plantilla que
 *     hay que reemplazar; el estado invalid es inalcanzable en un proyecto
 *     persistido porque el schema lo rechaza y lo deriva a recuperación);
 *   - el gate de producción usa la auditoría real del exporter: la copia de la
 *     guía ya no declara bloqueos para el sentinel de WhatsApp ni para los
 *     placeholders de texto (R7-F1 alineado), sólo para lo que `auditReport`
 *     marca como crítico.
 */

test.setTimeout(process.env.CI ? 60_000 : 45_000);

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

function editorPane(page: Page) {
  return page.locator("[data-studio-editor-pane]");
}

async function expectPaneOpen(page: Page): Promise<void> {
  await expect(editorPane(page)).toHaveAttribute("aria-hidden", "false");
  await expect(editorPane(page)).toHaveClass(/editor-pane--open/);
}

async function expectPaneClosed(page: Page): Promise<void> {
  await expect(editorPane(page)).toHaveAttribute("aria-hidden", "true");
  await expect(editorPane(page)).toHaveClass(/editor-pane--closed/);
}

/** Dispara el handler aunque el panel esté colapsado (H8-B3): con el panel
 *  cerrado el contenido queda `visibility: hidden` y `pointer-events: none`,
 *  así que el clic real no llega; el contrato es que la navegación reabra el
 *  panel para mostrar el destino. */
async function dispatchGuidedClick(locator: ReturnType<Page["getByTestId"]>): Promise<void> {
  await locator.dispatchEvent("click");
}

/** Requisitos pendientes visibles (lista directa del checklist, no el detalle "listos"). */
function pendingRequirements(page: Page) {
  return page.locator('section.guided-checklist > ul > [data-testid="ui-guided-requirement"]');
}

function requirement(page: Page, id: string) {
  return page.locator(`[data-testid="ui-guided-requirement"][data-requirement-id="${id}"]`);
}

async function readProgress(page: Page): Promise<{ text: string; percent: number }> {
  await expect(page.locator(".guided-progress")).toBeVisible();
  return {
    text: await page.locator(".guided-progress__copy > strong").innerText(),
    percent: Number(await page.getByTestId("ui-guided-progress").getAttribute("aria-valuenow")),
  };
}

async function openStoreFromDashboard(page: Page, name: string): Promise<void> {
  const card = page.locator(".dashboard-store-card", { hasText: name });
  await expect(card.getByTestId("ui-card-open")).toBeVisible();
  await card.getByTestId("ui-card-open").click();
  await expect(page.getByRole("navigation", { name: "Áreas de la tienda" })).toBeVisible();
}

/** Escribe un estado del proyecto directamente en IndexedDB (patrón H8-24):
 *  el record mantiene su shape y el studio lo vuelve a leer al recargar. */
type SeedKind = "ready-except-phone" | "invalid-email";

async function seedProjectRecord(page: Page, storeName: string, kind: SeedKind): Promise<void> {
  await page.waitForTimeout(900);
  const updated = await page.evaluate(
    ([name, seedKind]) =>
      new Promise<boolean>((resolve, reject) => {
        const request = indexedDB.open("solara-commerce-studio");
        request.addEventListener("error", () => reject(request.error));
        request.addEventListener("success", () => {
          const db = request.result;
          const transaction = db.transaction("projects", "readwrite");
          const store = transaction.objectStore("projects");
          const all = store.getAll();
          all.addEventListener("success", () => {
            const records = all.result as Array<{
              name: string;
              project: {
                identity: { description: string; email: string };
                seo: { description: string };
                pages: Array<{ kind: string; title: string }>;
                sections: Array<{ id: string; settings: Record<string, string> }>;
                assets: Array<{ name: string; alt: string }>;
              };
            }>;
            const record = records.find((item) => item.name === name);
            if (!record) {
              resolve(false);
              return;
            }
            const project = record.project;
            if (seedKind === "invalid-email") {
              project.identity.email = "correo-sin-arroba";
            } else {
              project.identity.description = "Marca textil artesanal con lanzamientos mensuales.";
              project.identity.email = "hola@ejemplo.com";
              project.seo.description = "Catálogo textil artesanal con lanzamientos mensuales.";
              project.pages = project.pages.map((item) => ({
                ...item,
                title:
                  item.kind === "about"
                    ? "Nuestra historia textil."
                    : item.kind === "contact"
                      ? "Escribinos por WhatsApp."
                      : item.title,
              }));
              const hero = project.sections.find((section) => section.id === "modo-section-hero");
              if (hero) {
                hero.settings.eyebrow = "Lanzamiento mensual";
                hero.settings.title = "Textiles artesanales de estación.";
                hero.settings.body = "Prendas tejidas a mano con tintes naturales.";
                hero.settings.actionLabel = "Ver catálogo";
              }
              project.assets = project.assets.map((asset) => ({
                ...asset,
                name: "tejido-estacion.png",
                alt: "Tejido textil en tonos tierra",
              }));
            }
            store.put({ ...record, project });
          });
          all.addEventListener("error", () => reject(all.error));
          transaction.addEventListener("complete", () => resolve(true));
          transaction.addEventListener("error", () => reject(transaction.error));
        });
      }),
    [storeName, kind],
  );
  expect(updated).toBe(true);
}

test("completar un campo marca el requisito listo, el progreso avanza y Siguiente aterriza con pane abierto (R7-1)", async ({
  page,
}) => {
  await setupCleanStore(page, "Tienda R7 progreso");

  await page.getByRole("tab", { name: "Preparar", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Preparar tienda" })).toBeVisible();

  // Estado inicial real de la plantilla limpia: 4 de 17 requisitos listos (24%).
  // El único bloqueo real del exporter es template.placeholder (auditReport),
  // no los 11 pendientes que la guía declaraba antes del fix R7-F1.
  const before = await readProgress(page);
  expect(before.text).toBe("4 de 17 requisitos listos");
  expect(before.percent).toBe(24);
  await expect(page.locator(".guided-progress__copy > span")).toHaveText(
    "1 pendiente bloquea producción.",
    { timeout: 20_000 },
  );

  // El primer pendiente es la Descripción (placeholder de plantilla): "Siguiente"
  // debe llevar a Resumen con el panel abierto (H8-B3 vigente).
  const firstPending = pendingRequirements(page).first();
  await expect(firstPending).toHaveAttribute("data-requirement-id", "identity.description");
  await expect(firstPending).toHaveAttribute("data-requirement-status", "placeholder");
  await expect(firstPending).toContainText("Reemplazar texto de plantilla");
  await expect(page.getByTestId("ui-guided-next")).toContainText("Siguiente: Descripción de marca");

  // El sentinel de teléfono (5491100000000) es un valor de plantilla, no una
  // ausencia: la guía lo marca "placeholder" ("Reemplazar texto de plantilla").
  const whatsappPending = requirement(page, "identity.whatsapp");
  await expect(whatsappPending).toHaveAttribute("data-requirement-status", "placeholder");
  await expect(whatsappPending).toContainText("Reemplazar texto de plantilla");

  await page.getByRole("button", { name: "Cerrar panel de edición" }).click();
  await expectPaneClosed(page);
  await dispatchGuidedClick(page.getByTestId("ui-guided-next"));
  await expectPaneOpen(page);
  await expect(page.getByRole("heading", { name: "Resumen", exact: true })).toBeVisible();
  await expect(page.getByLabel("Descripción", { exact: true })).toBeVisible();

  // En el campo, el sentinel se muestra vacío ("Falta completar el número").
  const phone = page.getByLabel("Número internacional");
  await expect(phone).toHaveValue("");

  await phone.fill("5491123456789");
  await expect(page.getByTestId("ui-save-indicator")).toContainText("Cambios guardados", {
    timeout: 5_000,
  });

  await page.getByRole("tab", { name: "Preparar", exact: true }).click();
  const after = await readProgress(page);
  expect(after.text).toBe("5 de 17 requisitos listos");
  expect(after.percent).toBeGreaterThan(before.percent);
  expect(after.percent).toBe(29);

  // El requisito completado figura como "listo" y salió de los pendientes.
  await expect(pendingRequirements(page)).toHaveCount(12);
  await expect(
    page.locator('[data-testid="ui-guided-requirement"][data-requirement-id="identity.whatsapp"]'),
  ).toHaveCount(1);
  await page.getByTestId("ui-guided-done").locator("summary").click();
  const doneItem = page.locator(
    '[data-testid="ui-guided-done"] [data-requirement-id="identity.whatsapp"]',
  );
  await expect(doneItem).toHaveAttribute("data-requirement-status", "ready");
  await expect(page.getByTestId("ui-guided-done").locator("summary")).toHaveText(
    "Requisitos listos (5)",
  );

  // Modo avanzado cambia al Constructor y Preparar restaura el guiado con el progreso intacto.
  await page.getByRole("button", { name: "Modo avanzado" }).click();
  await expect(page.getByRole("heading", { name: "Constructor", exact: true })).toBeVisible();
  await expectPaneOpen(page);
  await page.getByRole("tab", { name: "Preparar", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Preparar tienda" })).toBeVisible();
  await page.getByRole("tab", { name: "Preparar", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Preparar tienda" })).toBeVisible();
  await expect(page.locator(".guided-progress__copy > strong")).toHaveText(
    "5 de 17 requisitos listos",
  );
});

test("el requisito pendiente de imagen se refleja en el Export y desbloquea al completarse (R7-2)", async ({
  page,
}) => {
  await setupCleanStore(page, "Tienda R7 gate");

  await page.getByRole("tab", { name: "Preparar", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Preparar tienda" })).toBeVisible();

  // Las imágenes de plantilla están pendientes como placeholder y el audit del
  // exporter las bloquea como críticas (template.placeholder): 1:1 real.
  // La plantilla limpia tiene 4 assets; la lista visible muestra los primeros
  // 12 pendientes, así que la 4ta imagen queda en el "+1 más".
  const placeholderAsset = page.locator(
    '[data-testid="ui-guided-requirement"][data-requirement-id^="asset."]',
  );
  await expect(placeholderAsset).toHaveCount(3);
  await expect(placeholderAsset.first()).toHaveAttribute("data-requirement-status", "placeholder");
  await expect(page.locator(".guided-checklist__more")).toHaveText("+1 más");

  await page.getByRole("tab", { name: "Exportar", exact: true }).click();
  await expect(page.locator("output.optimization-export-summary")).toBeVisible({
    timeout: 20_000,
  });
  const summaryText = await page.locator("output.optimization-export-summary").innerText();
  const summaryCritical = Number(summaryText.match(/(\d+) críticos/)?.[1] ?? NaN);
  expect(summaryCritical).toBeGreaterThan(0);

  const warning = page.locator(".export-warning");
  await expect(warning).toBeVisible();
  await expect(warning).toHaveText(/^\d+ errores críticos deben resolverse\.$/);
  const warningCritical = Number(
    (await warning.innerText()).match(/^(\d+) errores críticos/)?.[1] ?? NaN,
  );
  expect(warningCritical).toBe(summaryCritical);
  await expect(page.getByTestId("ui-export-production")).toBeDisabled();

  // Completar los 4 assets de plantilla (nombre + texto alternativo) debe
  // eliminar el crítico template.placeholder y desbloquear producción.
  await page.getByRole("tab", { name: "Recursos", exact: true }).click();
  const assetCount = await page.getByLabel("Texto alternativo").count();
  expect(assetCount).toBe(4);
  for (let index = 0; index < assetCount; index += 1) {
    await page.getByLabel("Nombre").nth(index).fill(`tejido-estacion-${index}.png`);
    await page.getByLabel("Nombre").nth(index).blur();
    await page.getByLabel("Texto alternativo").nth(index).fill("Tejido textil en tonos tierra");
    await page.getByLabel("Texto alternativo").nth(index).blur();
  }

  await page.getByRole("tab", { name: "Preparar", exact: true }).click();
  await page.getByTestId("ui-guided-done").locator("summary").click();
  await expect(
    page.locator('[data-testid="ui-guided-done"] [data-requirement-id^="asset."]'),
  ).toHaveCount(4);
  await expect(
    page.locator('[data-testid="ui-guided-done"] [data-requirement-id^="asset."]').first(),
  ).toHaveAttribute("data-requirement-status", "ready");

  await page.getByRole("tab", { name: "Exportar", exact: true }).click();
  await expect(page.locator("output.optimization-export-summary")).toBeVisible({
    timeout: 20_000,
  });
  await expect(page.getByTestId("ui-export-production")).toBeEnabled({ timeout: 20_000 });
  await expect(page.locator(".export-warning")).toHaveCount(0);
  await expect(page.locator("output.optimization-export-summary")).toContainText("0 críticos");

  // La guía usa el gate real del exporter (auditReport): con 0 críticos, ya no
  // declara bloqueos para los placeholders de texto que siguen pendientes
  // (R7-F1 alineado); el checklist conserva el conteo de requisitos pendientes.
  await page.getByRole("tab", { name: "Preparar", exact: true }).click();
  await expect(page.locator(".guided-progress__copy > span")).toHaveText(
    "La tienda puede pasar a revisión de publicación.",
    { timeout: 20_000 },
  );
  await expect(pendingRequirements(page).filter({ hasText: "Descripción de marca" })).toHaveCount(
    1,
  );
});

test("el sentinel de WhatsApp pendiente NO bloquea producción y la guía ya no lo declara bloqueante (R7-3 — R7-F1 alineado)", async ({
  page,
}) => {
  const storeName = "Tienda R7 teléfono";
  await setupCleanStore(page, storeName);

  // Deja todo el contenido listo salvo el teléfono de la plantilla (sentinel).
  await seedProjectRecord(page, storeName, "ready-except-phone");
  await page.reload();
  await openStoreFromDashboard(page, storeName);

  await page.getByRole("tab", { name: "Preparar", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Preparar tienda" })).toBeVisible();

  // Exactamente un requisito pendiente: el WhatsApp, como placeholder de plantilla.
  await expect(pendingRequirements(page)).toHaveCount(1);
  const whatsapp = pendingRequirements(page).first();
  await expect(whatsapp).toHaveAttribute("data-requirement-id", "identity.whatsapp");
  await expect(whatsapp).toHaveAttribute("data-requirement-status", "placeholder");
  await expect(whatsapp).toContainText("Reemplazar texto de plantilla");
  await expect(page.locator(".guided-progress__copy > span")).toHaveText(
    "La tienda puede pasar a revisión de publicación.",
    { timeout: 20_000 },
  );
  await expect(page.getByTestId("ui-guided-done").locator("summary")).toHaveText(
    "Requisitos listos (16)",
  );

  // Coherencia con el gate real: el audit del exporter NO considera el sentinel
  // un crítico y la producción queda habilitada (1:1 con la copia de la guía).
  await page.getByRole("tab", { name: "Exportar", exact: true }).click();
  await expect(page.locator("output.optimization-export-summary")).toBeVisible({
    timeout: 20_000,
  });
  await expect(page.locator("output.optimization-export-summary")).toContainText("0 críticos");
  await expect(page.locator(".export-warning")).toHaveCount(0);
  await expect(page.getByTestId("ui-export-production")).toBeEnabled({ timeout: 20_000 });
});

test("el estado invalid es inalcanzable en un proyecto persistido: el schema lo deriva a recuperación (R7-4 — hallazgo)", async ({
  page,
}) => {
  const storeName = "Tienda R7 inválido";
  await setupCleanStore(page, storeName);

  // Sembrar un email inválido hace que el record falle el schema (`z.email()`):
  // el dashboard lo mueve a "recuperación" y no lo ofrece como tienda abrible.
  await seedProjectRecord(page, storeName, "invalid-email");
  await page.reload();

  await expect(page.getByRole("heading", { name: "Tus tiendas" })).toBeVisible();
  await expect(page.getByText(/requieren recuperación/)).toBeVisible();
  await expect(page.getByText(`${storeName}: identity.email`)).toBeVisible();
  const card = page.locator(".dashboard-store-card", { hasText: storeName });
  await expect(card.getByTestId("ui-card-open")).toHaveCount(0);
  await expect(card).toHaveCount(0);
});
