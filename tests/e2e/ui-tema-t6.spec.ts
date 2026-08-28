import { createServer, type Server } from "node:http";
import { expect, type Locator, type Page, test } from "@playwright/test";
import { exportProject } from "@solara/exporter";
import { readHashedStorefrontCss } from "./export-helpers";
import { createCleanStore } from "./project-helpers";
import { startStudioServer, stopStudioServer } from "./studio-server";

/**
 * Auditoría Tema T6 (2026-08-10) — Ancho del contenedor (960-1800 px).
 * Contrato de 4 capas para el input numérico del panel Tema:
 *   1. funcional: valores dentro de rango commitean; fuera de rango no;
 *      teclear por tecla pasa por borradores inválidos sin rebote (fix A16);
 *   2. auto-feedback: error inline "Ingresá un ancho de 960 a 1800 px." con
 *      aria-invalid mientras el borrador es inválido; se limpia al corregir;
 *   3. datos: el valor commiteado llega a --solara-container del preview y al
 *      proyecto persistido en IndexedDB (el mismo token que emite el exporter);
 *   4. utilidad: el ancho cambia el render — layout más ancho en el preview y
 *      en el sitio exportado (diff del CSS hasheado + medición real).
 */

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

interface StoredProjectRecord {
  project?: {
    name?: string;
    theme?: { container?: number };
  };
}

type ExportedProject = Parameters<typeof exportProject>[0];

/** Selectores de elementos cuyo ancho sigue el contenedor de la familia activa. */
const LAYOUT_SELECTORS = [
  ".solara-container",
  ".catalog-header-inner",
  ".catalog-hero-inner",
  ".catalog-footer-inner",
];

// Editorial V2 reserva 1.5rem por lado en su shell; el token controla el
// máximo sin alterar ese gutter visual deliberado.
const V2_HORIZONTAL_GUTTER = 48;

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

function containerInput(page: Page): Locator {
  return page.getByLabel("Ancho del contenedor");
}

function fieldsetOf(input: Locator): Locator {
  return input.locator("xpath=ancestor::fieldset[contains(@class, 'field')]");
}

/** Variable CSS computada --solara-container del preview. */
function previewContainerVar(page: Page): () => Promise<string> {
  const html = page.frameLocator('iframe[title="Vista previa desktop"]').locator("html");
  return async () => {
    try {
      return await html.evaluate((element) =>
        getComputedStyle(element).getPropertyValue("--solara-container").trim(),
      );
    } catch (reason) {
      if (reason instanceof Error && reason.message.includes("Frame was detached")) return "";
      throw reason;
    }
  };
}

/** Ancho del viewport del iframe y del primer elemento de layout dentro de él. */
function previewMetrics(page: Page): Promise<{ viewport: number; containerWidth: number }> {
  return page
    .frameLocator('iframe[title="Vista previa desktop"]')
    .locator("html")
    .evaluate((element, selectors) => {
      const owner = element.ownerDocument;
      let width = -1;
      for (const selector of selectors) {
        const node = owner.querySelector(selector);
        if (node !== null) {
          width = Math.round(node.getBoundingClientRect().width * 100) / 100;
          break;
        }
      }
      return { viewport: element.clientWidth, containerWidth: width };
    }, LAYOUT_SELECTORS);
}

/** Proyecto persistido en IndexedDB (store `projects`) para la tienda con ese nombre. */
function readStoredProject(page: Page, name: string): Promise<unknown> {
  return page.evaluate(
    (storeName) =>
      new Promise<unknown>((resolvePromise, reject) => {
        const request = indexedDB.open("solara-commerce-studio");
        request.addEventListener("error", () => reject(request.error));
        request.addEventListener("success", () => {
          const db = request.result;
          const transaction = db.transaction("projects", "readonly");
          const all = transaction.objectStore("projects").getAll();
          all.addEventListener("error", () => reject(all.error));
          all.addEventListener("success", () => {
            const records = all.result as StoredProjectRecord[];
            const record = records.find((entry) => entry.project?.name === storeName);
            resolvePromise(record?.project ?? null);
          });
        });
      }),
    name,
  );
}

async function readStoredContainer(page: Page, name: string): Promise<number | undefined> {
  const project = (await readStoredProject(page, name)) as StoredProjectRecord["project"] | null;
  return project?.theme?.container;
}

/** CSS del sitio exportado (assets/storefront.css) para un proyecto dado. */
function exportedCss(project: ExportedProject): string {
  const result = exportProject(project, { mode: "draft" });
  return readHashedStorefrontCss(result.files);
}

async function startExportedServer(
  files: Map<string, Uint8Array>,
): Promise<{ siteServer: Server; url: string }> {
  const siteServer = createServer((request, response) => {
    const url = new URL(request.url ?? "/", "http://127.0.0.1");
    const requested = decodeURIComponent(url.pathname).replace(/^\/+/, "");
    const path =
      requested === ""
        ? "index.html"
        : requested.endsWith("/")
          ? `${requested}index.html`
          : requested;
    const content = files.get(path);

    if (content === undefined) {
      response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" }).end("Not found");
      return;
    }

    const extension = path.split(".").pop() ?? "";
    const contentType =
      extension === "html"
        ? "text/html; charset=utf-8"
        : extension === "css"
          ? "text/css; charset=utf-8"
          : extension === "js"
            ? "text/javascript; charset=utf-8"
            : extension === "xml"
              ? "application/xml; charset=utf-8"
              : extension === "png"
                ? "image/png"
                : extension === "webp"
                  ? "image/webp"
                  : extension === "svg"
                    ? "image/svg+xml"
                    : "application/octet-stream";
    response.writeHead(200, { "Content-Type": contentType, "Cache-Control": "no-store" });
    response.end(content);
  });

  await new Promise<void>((resolveListening) =>
    siteServer.listen(0, "127.0.0.1", resolveListening),
  );
  const address = siteServer.address();
  if (address === null || typeof address === "string") {
    throw new Error("El servidor de pruebas no tiene una dirección TCP.");
  }
  return { siteServer, url: `http://127.0.0.1:${address.port}` };
}

async function closeServer(siteServer: Server): Promise<void> {
  await new Promise<void>((resolveClosing, reject) => {
    siteServer.close((error) => (error ? reject(error) : resolveClosing()));
  });
}

/** Ancho del layout en una página del sitio exportado. */
async function siteLayoutMetrics(
  page: Page,
): Promise<{ viewport: number; containerWidth: number }> {
  await page.waitForLoadState("load");
  await page.locator(LAYOUT_SELECTORS.join(",")).first().waitFor({ state: "attached" });
  return page.evaluate((selectors) => {
    let width = -1;
    for (const selector of selectors) {
      const node = document.querySelector(selector);
      if (node !== null) {
        width = Math.round(node.getBoundingClientRect().width * 100) / 100;
        break;
      }
    }
    // clientWidth excludes the vertical scrollbar; CSS percentages use the
    // layout viewport, so innerWidth is the reference for the width formula.
    return { viewport: window.innerWidth, containerWidth: width };
  }, LAYOUT_SELECTORS);
}

test("contenedor: valores fuera de rango muestran error inline y no commitean", async ({
  page,
}) => {
  await setupCleanStore(page, "T6 validación");
  await openThemeTab(page);

  const input = containerInput(page);
  const opening = await input.inputValue();
  const varValue = previewContainerVar(page);
  await expect.poll(varValue, { timeout: 15_000 }).toBe(`${opening}px`);

  // Debajo del mínimo: error inline, el borrador queda visible y sin commit.
  await input.fill("959");
  await expect(input).toHaveAttribute("aria-invalid", "true");
  await expect(fieldsetOf(input).getByTestId("ui-field-error")).toContainText(
    "Ingresá un ancho de 960 a 1800 px.",
  );
  await expect(input).toHaveValue("959");
  await expect.poll(varValue, { timeout: 15_000 }).toBe(`${opening}px`);

  // El mínimo válido commitea y limpia el error.
  await input.fill("960");
  await expect(input).not.toHaveAttribute("aria-invalid", "true");
  await expect(fieldsetOf(input).getByTestId("ui-field-error")).toHaveCount(0);
  await expect.poll(varValue, { timeout: 15_000 }).toBe("960px");

  // Sobre el máximo: error inline y sin commit.
  await input.fill("1801");
  await expect(input).toHaveAttribute("aria-invalid", "true");
  await expect(fieldsetOf(input).getByTestId("ui-field-error")).toContainText(
    "Ingresá un ancho de 960 a 1800 px.",
  );
  await expect(input).toHaveValue("1801");
  await expect.poll(varValue, { timeout: 15_000 }).toBe("960px");

  // El máximo válido commitea.
  await input.fill("1800");
  await expect(input).not.toHaveAttribute("aria-invalid", "true");
  await expect(fieldsetOf(input).getByTestId("ui-field-error")).toHaveCount(0);
  await expect.poll(varValue, { timeout: 15_000 }).toBe("1800px");

  await input.fill(opening);
  await expect.poll(varValue, { timeout: 15_000 }).toBe(`${opening}px`);
});

test("contenedor: teclear por tecla no rebota el borrador y el valor final commitea (fix A16)", async ({
  page,
}) => {
  await setupCleanStore(page, "T6 tecleo");
  await openThemeTab(page);

  const input = containerInput(page);
  const opening = await input.inputValue();
  const varValue = previewContainerVar(page);
  await expect.poll(varValue, { timeout: 15_000 }).toBe(`${opening}px`);

  // "1" es un borrador inválido a mitad de camino: el campo lo muestra sin
  // rebotar (fix A16-B1) y el token sigue en el valor confirmado.
  await input.click();
  await page.keyboard.press("ControlOrMeta+A");
  await page.keyboard.type("1");
  await expect(input).toHaveValue("1");
  await expect(input).toHaveAttribute("aria-invalid", "true");
  await expect.poll(varValue, { timeout: 15_000 }).toBe(`${opening}px`);

  // Completar el número commitea "1400" y limpia el error.
  await page.keyboard.type("400");
  await expect(input).toHaveValue("1400");
  await expect(input).not.toHaveAttribute("aria-invalid", "true");
  await expect(fieldsetOf(input).getByTestId("ui-field-error")).toHaveCount(0);
  await expect.poll(varValue, { timeout: 15_000 }).toBe("1400px");

  // Restaurar geometría vuelve al ancho de apertura con el borrador limpio.
  await page.getByTestId("ui-reset-geometry").click();
  await expect(input).toHaveValue(opening);
  await expect(input).not.toHaveAttribute("aria-invalid", "true");
  await expect.poll(varValue, { timeout: 15_000 }).toBe(`${opening}px`);
});

test("contenedor: 960 → 1800 ensancha el layout real del preview", async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await setupCleanStore(page, "T6 preview ancho");
  await openThemeTab(page);

  const input = containerInput(page);
  const varValue = previewContainerVar(page);

  await input.fill("960");
  await expect.poll(varValue, { timeout: 15_000 }).toBe("960px");

  // Modo foco: el iframe ocupa todo el ancho y el layout queda limitado por el
  // contenedor del tema (min(calc(100% - 2rem), var(--solara-container))).
  await page.getByTestId("ui-focus-toggle").click();
  await expect
    .poll(() => previewMetrics(page).then((metrics) => metrics.viewport), { timeout: 15_000 })
    .toBeGreaterThan(1500);
  await page.waitForTimeout(400);
  const at960 = await previewMetrics(page);
  expect(at960.containerWidth).not.toBe(-1);
  expect(Math.abs(at960.containerWidth - Math.min(at960.viewport - 32, 960))).toBeLessThanOrEqual(
    2,
  );

  await page.getByTestId("ui-focus-exit").click();
  await input.fill("1800");
  await expect.poll(varValue, { timeout: 15_000 }).toBe("1800px");

  await page.getByTestId("ui-focus-toggle").click();
  await expect
    .poll(() => previewMetrics(page).then((metrics) => metrics.viewport), { timeout: 15_000 })
    .toBeGreaterThan(1500);
  await page.waitForTimeout(400);
  const at1800 = await previewMetrics(page);
  expect(at1800.containerWidth).not.toBe(-1);
  expect(
    Math.abs(at1800.containerWidth - Math.min(at1800.viewport - 32, 1800)),
  ).toBeLessThanOrEqual(2);
  expect(at1800.containerWidth).toBeGreaterThan(at960.containerWidth);
});

test("contenedor: el valor llega al CSS exportado y al render del sitio (diff)", async ({
  page,
}) => {
  const storeName = "T6 sitio exportado";
  await setupCleanStore(page, storeName);
  await openThemeTab(page);

  const input = containerInput(page);
  const opening = Number(await input.inputValue());
  const varValue = previewContainerVar(page);

  // Estado ANTES: el proyecto persistido en IndexedDB ya tiene el ancho de apertura.
  await expect.poll(() => readStoredContainer(page, storeName), { timeout: 15_000 }).toBe(opening);
  const beforeProject = await readStoredProject(page, storeName);
  expect((beforeProject as StoredProjectRecord["project"] | null)?.theme?.container ?? -1).toBe(
    opening,
  );

  // Cambio real en el editor: el valor commiteado queda persistido.
  await input.fill("1800");
  await expect.poll(varValue, { timeout: 15_000 }).toBe("1800px");
  await expect.poll(() => readStoredContainer(page, storeName), { timeout: 15_000 }).toBe(1800);
  const afterProject = await readStoredProject(page, storeName);
  expect((afterProject as StoredProjectRecord["project"] | null)?.theme?.container ?? -1).toBe(
    1800,
  );

  // Capa de datos + utilidad: diff del CSS exportado entre antes y después.
  const cssBefore = exportedCss(beforeProject as ExportedProject);
  const cssAfter = exportedCss(afterProject as ExportedProject);
  const containerVar = (css: string): string => {
    const match = /--solara-container:\s*(\d+)px/.exec(css);
    if (match === null) throw new Error("Falta --solara-container en el CSS exportado");
    return match[1];
  };
  expect(containerVar(cssBefore)).toBe(String(opening));
  expect(containerVar(cssAfter)).toBe("1800");
  expect(cssBefore).not.toContain("--solara-container: 1800px");
  expect(cssAfter).not.toContain(`--solara-container: ${opening}px`);
  // Los consumidores del token están en ambos sitios: la regla base
  // .solara-container (styles.ts:126) y los layout modules de catalog-modern
  // (styles.ts:1963/2023/2054/...) con width: min(calc(100% - 2rem), var).
  expect(cssBefore).toMatch(/\.solara-container\{[^}]*var\(--solara-container\)/);
  expect(cssAfter).toMatch(/\.solara-container\{[^}]*var\(--solara-container\)/);
  expect(cssBefore).toMatch(
    /width:\s*min\(\s*calc\(100% - \s*2rem\)\s*,\s*var\(--solara-container\)\s*\)/,
  );
  expect(cssAfter).toMatch(
    /width:\s*min\(\s*calc\(100% - \s*2rem\)\s*,\s*var\(--solara-container\)\s*\)/,
  );

  // Render real del sitio ANTES y DESPUÉS: el layout se ve más ancho.
  const beforeSite = exportProject(beforeProject as ExportedProject, { mode: "draft" });
  const afterSite = exportProject(afterProject as ExportedProject, { mode: "draft" });
  const beforeServer = await startExportedServer(beforeSite.files);
  const afterServer = await startExportedServer(afterSite.files);
  try {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(beforeServer.url);
    const beforeMetrics = await siteLayoutMetrics(page);
    await page.goto(afterServer.url);
    const afterMetrics = await siteLayoutMetrics(page);

    expect(beforeMetrics.containerWidth).not.toBe(-1);
    expect(afterMetrics.containerWidth).not.toBe(-1);
    expect(
      Math.abs(
        beforeMetrics.containerWidth -
          Math.min(beforeMetrics.viewport - V2_HORIZONTAL_GUTTER, opening),
      ),
    ).toBeLessThanOrEqual(2);
    expect(
      Math.abs(
        afterMetrics.containerWidth - Math.min(afterMetrics.viewport - V2_HORIZONTAL_GUTTER, 1800),
      ),
    ).toBeLessThanOrEqual(2);
    expect(afterMetrics.containerWidth).toBeGreaterThan(beforeMetrics.containerWidth);
  } finally {
    await closeServer(beforeServer.siteServer);
    await closeServer(afterServer.siteServer);
  }
});

test("contenedor: el ancho persiste al recargar el editor", async ({ page }) => {
  const storeName = "T6 persistencia";
  await setupCleanStore(page, storeName);
  await openThemeTab(page);

  const input = containerInput(page);
  await input.fill("1500");
  await expect(input).toHaveValue("1500");
  await expect.poll(previewContainerVar(page), { timeout: 15_000 }).toBe("1500px");
  await expect.poll(() => readStoredContainer(page, storeName), { timeout: 15_000 }).toBe(1500);

  await page.reload();
  await expect(page.getByRole("heading", { name: "Tus tiendas" })).toBeVisible({
    timeout: 30_000,
  });
  const card = page.locator(".dashboard-store-card", { hasText: storeName });
  await expect(card.getByTestId("ui-card-open")).toBeVisible();
  await card.getByTestId("ui-card-open").click();
  await expect(page.getByRole("navigation", { name: "Áreas de la tienda" })).toBeVisible();
  await openThemeTab(page);

  await expect(containerInput(page)).toHaveValue("1500");
  await expect.poll(previewContainerVar(page), { timeout: 15_000 }).toBe("1500px");
});
