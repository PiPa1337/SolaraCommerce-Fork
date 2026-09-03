/**
 * Auditoría Tema T7 (actualizada 2026-09-03 — decisión F4: el sitio siempre light).
 * Contrato de 4 capas:
 * - funcional: la paleta servida es siempre la del usuario (light). Ni el modo
 *   auto ni un colorMode "dark" declarado en el proyecto cambian los tokens;
 *   el CSS exportado no contiene media query de prefers-color-scheme, ni
 *   override [data-color-mode="dark"], ni color-scheme dark;
 * - auto-feedback: el select Modo mantiene la opción Oscuro deshabilitada con
 *   el hint conectado por aria-describedby;
 * - datos: el valor llega a project.theme.colorMode (IndexedDB) y al atributo
 *   data-color-mode del .solara-page del HTML exportado;
 * - utilidad: los tokens --solara-* y la capa --catalog-* del skin
 *   catalog-modern se resuelven sobre la paleta activa; el CSS ya no define
 *   variables --solara-dark-*.
 */
import { createServer, type Server } from "node:http";
import { expect, type Locator, type Page, test } from "@playwright/test";
import { exportProject } from "@solara/exporter";
import { readHashedStorefrontCss } from "./export-helpers";
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

interface StoredProjectRecord {
  project?: {
    name?: string;
    theme?: { colorMode?: "auto" | "light" | "dark" };
  };
}

type ExportedProject = Parameters<typeof exportProject>[0];

/** Paleta por defecto de la tienda limpia catalog-modern (catalog-modern-fixture.ts:391-401). */
const THEME_BACKGROUND = "#fcfcfb";
const THEME_BACKGROUND_RGB = "rgb(252, 252, 251)";

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

function modeSelect(page: Page): Locator {
  return page.getByLabel("Modo de color", { exact: true });
}

/**
 * Valor computado de una variable --solara-* en el preview desktop. Desde la
 * decisión F4 los tokens sólo viven en :root (no hay override dark por
 * data-color-mode), así que leerlos sobre .solara-page refleja la paleta
 * activa servida.
 */
function previewVar(page: Page, variable: string): () => Promise<string> {
  return () =>
    page
      .frameLocator('iframe[title="Vista previa desktop"]')
      .locator(".solara-page")
      .evaluate(
        (element, name) => getComputedStyle(element).getPropertyValue(name).trim(),
        variable,
      )
      .catch(() => "");
}

/** color-scheme computado del .solara-page del preview desktop. */
function previewColorScheme(page: Page): () => Promise<string> {
  return () =>
    page
      .frameLocator('iframe[title="Vista previa desktop"]')
      .locator(".solara-page")
      .evaluate((element) => getComputedStyle(element).colorScheme)
      .catch(() => "");
}

/** data-color-mode del .solara-page del preview desktop. */
function previewDataColorMode(page: Page): () => Promise<string | null> {
  return () =>
    page
      .frameLocator('iframe[title="Vista previa desktop"]')
      .locator(".solara-page")
      .evaluate((element) => element.getAttribute("data-color-mode"))
      .catch(() => null);
}

/** backgroundColor computado del root catalog-modern del preview (capa --catalog-*). */
function previewCatalogBackground(page: Page): () => Promise<string> {
  return () =>
    page
      .frameLocator('iframe[title="Vista previa desktop"]')
      .locator(".catalog-modern")
      .evaluate((element) => getComputedStyle(element).backgroundColor)
      .catch(() => "");
}

/** Tokens y color-scheme computados del .solara-page de una página servida. */
function servedTheme(page: Page): () => Promise<{ background: string; colorScheme: string }> {
  return () =>
    page.locator(".solara-page").evaluate((element) => {
      const style = getComputedStyle(element);
      return {
        background: style.getPropertyValue("--solara-background").trim(),
        colorScheme: style.colorScheme,
      };
    });
}

/** backgroundColor computado del root catalog-modern de una página servida. */
function servedCatalogBackground(page: Page): () => Promise<string> {
  return () =>
    page
      .locator(".catalog-modern")
      .evaluate((element) => getComputedStyle(element).backgroundColor)
      .catch(() => "");
}

/**
 * El CSS servido no puede volver a traer la capa dark muerta: ni media query
 * del sistema, ni overrides por data-color-mode, ni variables --solara-dark-*.
 */
function expectNoDarkCss(css: string): void {
  expect(css).not.toContain("prefers-color-scheme");
  expect(css).not.toContain("data-color-mode");
  expect(css).not.toContain("--solara-dark-");
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

function readStoredColorMode(page: Page, name: string): Promise<string | undefined> {
  return readStoredProject(page, name).then(
    (project) => (project as StoredProjectRecord["project"] | null)?.theme?.colorMode,
  );
}

function exportedHtml(project: ExportedProject): string {
  const result = exportProject(project, { mode: "draft" });
  const file = result.files.get("index.html");
  if (file === undefined) throw new Error("El sitio exportado no contiene index.html");
  return typeof file === "string" ? file : new TextDecoder().decode(file);
}

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

test("estabilidad light: el preview no cambia con el sistema en oscuro (auto incluido)", async ({
  page,
}) => {
  // La emulación queda activa antes de crear el iframe del preview: si
  // reapareciera cualquier regla dark por prefers-color-scheme, este test la
  // detectaría.
  await page.emulateMedia({ colorScheme: "dark" });
  await setupCleanStore(page, "Tienda T7 preview light");
  await openThemeTab(page);

  // La tienda limpia arranca en Claro: la paleta activa se mantiene intacta.
  await expect
    .poll(previewVar(page, "--solara-background"), { timeout: 15_000 })
    .toBe(THEME_BACKGROUND);
  await expect.poll(previewColorScheme(page), { timeout: 15_000 }).toBe("light");
  await expect.poll(previewCatalogBackground(page), { timeout: 15_000 }).toBe(THEME_BACKGROUND_RGB);

  // Pasar a auto no introduce dark: data-color-mode se emite como dato pero no
  // existe regla CSS que convierta la paleta, aunque el sistema siga en oscuro.
  await modeSelect(page).selectOption("auto");
  await expect.poll(previewDataColorMode(page), { timeout: 15_000 }).toBe("auto");
  await expect
    .poll(previewVar(page, "--solara-background"), { timeout: 15_000 })
    .toBe(THEME_BACKGROUND);
  await expect.poll(previewColorScheme(page), { timeout: 15_000 }).toBe("light");
  await expect.poll(previewCatalogBackground(page), { timeout: 15_000 }).toBe(THEME_BACKGROUND_RGB);
});

test("estabilidad light: el sitio exportado con auto no sigue el sistema", async ({ page }) => {
  const storeName = "Tienda T7 sitio auto";
  await setupCleanStore(page, storeName);
  await openThemeTab(page);

  await modeSelect(page).selectOption("auto");
  await expect.poll(() => readStoredColorMode(page, storeName), { timeout: 15_000 }).toBe("auto");

  const project = (await readStoredProject(page, storeName)) as ExportedProject;
  const html = exportedHtml(project);
  const css = exportedCss(project);

  // Datos en el HTML exportado: .solara-page lleva data-color-mode="auto" y el
  // <html> NO lleva data-theme (sólo se emite para light/dark).
  expect(html).toContain('data-color-mode="auto"');
  expect(html).not.toContain('data-theme="');

  // Utilidad: el CSS servido no trae capa dark y fija la paleta clara en :root.
  const normalizedCss = css.replaceAll(/\\+(?=")/g, "");
  expectNoDarkCss(normalizedCss);
  expect(normalizedCss).toContain(":root{color-scheme:light");
  expect(normalizedCss).toContain(`--solara-background:${THEME_BACKGROUND}`);

  const exported = exportProject(project, { mode: "draft" });
  const siteServer = await startExportedServer(exported.files);
  try {
    await page.emulateMedia({ colorScheme: "dark" });
    await page.goto(siteServer.url);
    await page.locator(".solara-page").waitFor({ state: "attached" });
    await expect.poll(servedTheme(page)).toEqual({
      background: THEME_BACKGROUND,
      colorScheme: "light",
    });

    // Con el sistema en claro el resultado es idéntico: estabilidad light.
    await page.emulateMedia({ colorScheme: "light" });
    await expect.poll(servedTheme(page)).toEqual({
      background: THEME_BACKGROUND,
      colorScheme: "light",
    });
  } finally {
    await closeServer(siteServer.siteServer);
  }
});

test("estabilidad light: el sitio exportado con colorMode dark mantiene la paleta clara", async ({
  page,
}) => {
  const storeName = "Tienda T7 sitio dark";
  await setupCleanStore(page, storeName);

  // La UI no permite elegir Oscuro (option deshabilitada), pero el schema sigue
  // aceptando colorMode "dark": un proyecto heredado puede traerlo y el sitio
  // exportado debe verse igual de light.
  const stored = (await readStoredProject(page, storeName)) as ExportedProject;
  const darkProject = {
    ...stored,
    theme: { ...stored.theme, colorMode: "dark" as const },
  } as ExportedProject;

  const html = exportedHtml(darkProject);
  const css = exportedCss(darkProject);

  // data-color-mode sigue presente en el HTML (incluido "dark") y el <html>
  // conserva data-theme="dark" como hook heredado sin consumidor; la paleta y
  // el color-scheme en cambio no cambian.
  expect(html).toContain('data-color-mode="dark"');
  expect(html).toContain('data-theme="dark"');
  expectNoDarkCss(css.replaceAll(/\\+(?=")/g, ""));
  expect(css).not.toContain("color-scheme:dark");

  const exported = exportProject(darkProject, { mode: "draft" });
  const siteServer = await startExportedServer(exported.files);
  try {
    await page.emulateMedia({ colorScheme: "dark" });
    await page.goto(siteServer.url);
    await page.locator(".solara-page").waitFor({ state: "attached" });
    // La paleta y el color-scheme servidos son los claros del proyecto:
    // colorMode ya no arrastra ni tokens ni color-scheme dark (decisión f4).
    await expect
      .poll(() => servedTheme(page)(), { timeout: 15_000 })
      .toEqual({ background: THEME_BACKGROUND, colorScheme: "light" });
    await expect
      .poll(servedCatalogBackground(page), { timeout: 15_000 })
      .toBe(THEME_BACKGROUND_RGB);
  } finally {
    await closeServer(siteServer.siteServer);
  }
});

test("Oscuro: deshabilitado con hint conectado por aria-describedby", async ({ page }) => {
  await setupCleanStore(page, "Tienda T7 oscuro");
  await openThemeTab(page);

  const select = modeSelect(page);
  await expect(select).toHaveValue("light");

  // La opción "Oscuro" existe pero está deshabilitada: no se puede elegir.
  const darkOption = select.locator('option[value="dark"]');
  await expect(darkOption).toBeDisabled();
  await expect(darkOption).toHaveText("Oscuro");
  await expect(select.locator('option[value="auto"]')).toBeEnabled();
  await expect(select.locator('option[value="light"]')).toBeEnabled();

  // Hint explicando por qué está deshabilitado, conectado por aria-describedby.
  const hintText =
    "Oscuro está deshabilitado: el editor todavía no permite configurar una paleta oscura independiente. Las paletas disponibles están diseñadas para fondos claros.";
  const describedBy = await select.getAttribute("aria-describedby");
  expect(describedBy).not.toBeNull();
  await expect(page.locator(`#${describedBy}`)).toContainText(hintText);
});

test("tokens: el CSS exportado no define capa dark y catalog-modern hereda --solara-*", async ({
  page,
}) => {
  const storeName = "Tienda T7 tokens";
  await setupCleanStore(page, storeName);

  const project = (await readStoredProject(page, storeName)) as ExportedProject;
  const css = exportedCss(project);

  // Sin capa dark: ni variables --solara-dark-* ni overrides por color-mode.
  expectNoDarkCss(css);

  // La paleta fija heredada del skin antiguo nunca debe volver como dark fijo.
  expect(css).not.toContain("--solara-background:#1d1e19");
  expect(css).not.toContain("--solara-surface:#292a23");
  expect(css).not.toContain("--solara-text:#f3eee4");
  expect(css).not.toContain("--solara-muted:#b8b2a5");
  expect(css).not.toContain("--solara-border:#47483d");

  // La capa --catalog-* del skin catalog-modern es un alias de los tokens
  // --solara-* y conserva sale/rating de la paleta activa.
  expect(css).toContain("--catalog-ink:var(--solara-text,#0b0b0c)");
  expect(css).toContain("--catalog-paper:var(--solara-background,#fcfcfb)");
  expect(css).toContain("--catalog-surface:var(--solara-surface,#f0f0ee)");
  expect(css).toContain("--catalog-muted:var(--solara-muted,#696966)");
  expect(css).toContain("--catalog-border:var(--solara-border,#dededa)");
  expect(css).toContain("--catalog-sale:var(--solara-sale");
  expect(css).toContain("--catalog-rating:var(--solara-rating");
  expect(css).toContain("--catalog-ink:var(");
  expect(css).toContain("--catalog-paper:var(");
  expect(css).toContain("--catalog-surface:var(");
  expect(css).toContain("--catalog-muted:var(");
  expect(css).toContain("--catalog-border:var(");
});
