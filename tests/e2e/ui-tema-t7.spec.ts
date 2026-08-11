/**
 * Auditoría Tema T7 (2026-08-11) — colorMode (Sistema / Claro / Oscuro deshabilitado).
 * Contrato de 4 capas (plan docs/superpowers/plans/2026-08-10-auditoria-tema.md):
 * - funcional: "Sistema" sigue prefers-color-scheme en preview y sitio exportado
 *   (emulando la media), "Claro" fuerza light aunque el sistema sea oscuro y
 *   "Oscuro" no se puede elegir (option deshabilitada);
 * - auto-feedback: el select Modo expone la opción Oscuro deshabilitada y el
 *   hint "Oscuro está deshabilitado..." conectado por aria-describedby;
 * - datos: el valor llega a project.theme.colorMode (IndexedDB) y a los
 *   atributos data-color-mode / data-theme del HTML exportado;
 * - utilidad: el sitio exportado emite color-scheme + media query de
 *   prefers-color-scheme, el preview cambia de verdad al emular la media, y los
 *   overrides fijos del dark (styles.ts:23-29 y 513-521) quedan documentados:
 *   pisan 5 de 7 tokens del usuario y la capa --catalog-* (styles.ts:1942-1948)
 *   no los respeta → mezcla claro/oscuro ilegible si se habilitara "Oscuro".
 */
import { createServer, type Server } from "node:http";
import { expect, type Locator, type Page, test } from "@playwright/test";
import { exportProject } from "@solara/exporter";
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

/** Overrides fijos del dark en STORE_BASE_STYLES (packages/modules/src/styles.ts). */
const FIXED_DARK_TOKENS = [
  "#1d1e19", // --solara-background (styles.ts:24 y 515)
  "#292a23", // --solara-surface (styles.ts:25 y 516)
  "#f3eee4", // --solara-text (styles.ts:26 y 517)
  "#b8b2a5", // --solara-muted (styles.ts:27 y 518)
  "#47483d", // --solara-border (styles.ts:28 y 519)
] as const;

/** Paleta por defecto de la tienda limpia catalog-modern (catalog-modern-fixture.ts:391-401). */
const THEME_BACKGROUND = "#fcfcfb";

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

function modeSelect(page: Page): Locator {
  return page.getByLabel("Modo", { exact: true });
}

/**
 * Valor computado de una variable --solara-* en el preview desktop. Se lee
 * sobre .solara-page: el override fijo del dark (styles.ts:513-521) pisa los
 * tokens ahí (data-color-mode="auto"), no en <html> (que conserva la paleta
 * del :root emitida por themeCss).
 */
function previewVar(page: Page, variable: string): () => Promise<string> {
  return () =>
    page
      .frameLocator('iframe[title="Vista previa desktop"]')
      .locator(".solara-page")
      .evaluate(
        (element, name) => getComputedStyle(element).getPropertyValue(name).trim(),
        variable,
      );
}

/** color-scheme computado del .solara-page del preview desktop. */
function previewColorScheme(page: Page): () => Promise<string> {
  return () =>
    page
      .frameLocator('iframe[title="Vista previa desktop"]')
      .locator(".solara-page")
      .evaluate((element) => getComputedStyle(element).colorScheme);
}

/** data-color-mode del .solara-page del preview desktop. */
function previewDataColorMode(page: Page): () => Promise<string | null> {
  return () =>
    page
      .frameLocator('iframe[title="Vista previa desktop"]')
      .locator(".solara-page")
      .evaluate((element) => element.getAttribute("data-color-mode"));
}

/** backgroundColor computado del root catalog-modern del preview (capa --catalog-*). */
function previewCatalogBackground(page: Page): () => Promise<string> {
  return () =>
    page
      .frameLocator('iframe[title="Vista previa desktop"]')
      .locator(".catalog-modern")
      .evaluate((element) => getComputedStyle(element).backgroundColor);
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
  const file = result.files.get("assets/storefront.css");
  if (file === undefined) throw new Error("El sitio exportado no contiene assets/storefront.css");
  return typeof file === "string" ? file : new TextDecoder().decode(file);
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

test("Sistema: el preview sigue prefers-color-scheme al emular la media", async ({ page }) => {
  // La emulación debe estar activa ANTES de que se cree el documento del iframe
  // de preview (srcDoc): los iframes existentes no reaccionan a un cambio de
  // emulateMedia posterior, pero los nuevos documentos sí la heredan.
  await page.emulateMedia({ colorScheme: "dark" });
  await setupCleanStore(page, "Tienda T7 sistema");
  await openThemeTab(page);

  await modeSelect(page).selectOption("auto");
  await expect.poll(previewDataColorMode(page), { timeout: 15_000 }).toBe("auto");

  // Con el sistema en oscuro, el modo auto aplica el override fijo del dark:
  // pisa 5 de los 7 tokens del usuario (styles.ts:513-521).
  await expect.poll(previewVar(page, "--solara-background"), { timeout: 15_000 }).toBe("#1d1e19");
  await expect.poll(previewVar(page, "--solara-text"), { timeout: 15_000 }).toBe("#f3eee4");
  await expect.poll(previewColorScheme(page), { timeout: 15_000 }).toBe("dark");

  // Fix Ola 3: la capa --catalog-* del skin catalog-modern deriva de los
  // tokens --solara-* (styles.ts:1942-1948), así que el root del skin sigue
  // al override del dark (#1d1e19) y la mezcla ilegible ya no existe.
  await expect.poll(previewCatalogBackground(page), { timeout: 15_000 }).toBe("rgb(29, 30, 25)");

  // Con el sistema en claro, el modo auto respeta la paleta del usuario. El
  // cambio de emulación requiere un iframe nuevo: un cambio de modo (idempotente
  // al volver a auto) reconstruye el documento bajo la emulación vigente.
  await page.emulateMedia({ colorScheme: "light" });
  await modeSelect(page).selectOption("light");
  await modeSelect(page).selectOption("auto");
  await expect
    .poll(previewVar(page, "--solara-background"), { timeout: 15_000 })
    .toBe(THEME_BACKGROUND);
  await expect.poll(previewColorScheme(page), { timeout: 15_000 }).toBe("light");
});

test("Sistema: el sitio exportado sigue prefers-color-scheme al emular la media", async ({
  page,
}) => {
  const storeName = "Tienda T7 sitio sistema";
  await setupCleanStore(page, storeName);
  await openThemeTab(page);

  await modeSelect(page).selectOption("auto");
  await expect.poll(() => readStoredColorMode(page, storeName), { timeout: 15_000 }).toBe("auto");

  const project = (await readStoredProject(page, storeName)) as ExportedProject;
  const html = exportedHtml(project);
  const css = exportedCss(project);

  // Datos en el HTML exportado: .solara-page lleva data-color-mode="auto" y el
  // <html> NO lleva data-theme (index.ts:1104-1105 sólo lo emite para light/dark).
  expect(html).toContain('data-color-mode="auto"');
  expect(html).not.toContain('data-theme="');

  // Utilidad: el CSS exportado emite color-scheme y la media query que sigue al
  // sistema (index.ts:601-604) + el override fijo de los 5 tokens (styles.ts:513-521).
  expect(css).toContain('.solara-page[data-color-mode="auto"]{color-scheme:dark}');
  expect(css).toMatch(/@media \(prefers-color-scheme:dark\)/);
  expect(css).toContain('[data-solara-store][data-color-mode="auto"]{');
  expect(css).toContain("--solara-background:#1d1e19");

  const exported = exportProject(project, { mode: "draft" });
  const siteServer = await startExportedServer(exported.files);
  try {
    await page.emulateMedia({ colorScheme: "dark" });
    await page.goto(siteServer.url);
    await page.locator(".solara-page").waitFor({ state: "attached" });
    await expect
      .poll(() =>
        page.locator(".solara-page").evaluate((element) => {
          const style = getComputedStyle(element);
          return {
            background: style.getPropertyValue("--solara-background").trim(),
            colorScheme: style.colorScheme,
          };
        }),
      )
      .toEqual({ background: "#1d1e19", colorScheme: "dark" });

    await page.emulateMedia({ colorScheme: "light" });
    await expect
      .poll(() =>
        page.locator(".solara-page").evaluate((element) => {
          const style = getComputedStyle(element);
          return {
            background: style.getPropertyValue("--solara-background").trim(),
            colorScheme: style.colorScheme,
          };
        }),
      )
      .toEqual({ background: THEME_BACKGROUND, colorScheme: "light" });
  } finally {
    await closeServer(siteServer.siteServer);
  }
});

test("Claro: fuerza light aunque el sistema sea oscuro (preview y sitio)", async ({ page }) => {
  const storeName = "Tienda T7 claro";
  // Emulación activa antes de crear el iframe del preview (ver test 1).
  await page.emulateMedia({ colorScheme: "dark" });
  await setupCleanStore(page, storeName);
  await openThemeTab(page);

  await modeSelect(page).selectOption("light");
  await expect.poll(() => readStoredColorMode(page, storeName), { timeout: 15_000 }).toBe("light");

  // Preview: con el sistema en oscuro, la paleta del usuario se conserva.
  await expect
    .poll(previewVar(page, "--solara-background"), { timeout: 15_000 })
    .toBe(THEME_BACKGROUND);
  await expect.poll(previewColorScheme(page), { timeout: 15_000 }).toBe("light");

  const project = (await readStoredProject(page, storeName)) as ExportedProject;
  const html = exportedHtml(project);
  expect(html).toContain('data-theme="light"');
  expect(html).toContain('data-color-mode="light"');

  // Sitio exportado: también conserva la paleta con el sistema en oscuro.
  const exported = exportProject(project, { mode: "draft" });
  const siteServer = await startExportedServer(exported.files);
  try {
    await page.goto(siteServer.url);
    await page.locator(".solara-page").waitFor({ state: "attached" });
    await expect
      .poll(() =>
        page.locator(".solara-page").evaluate((element) => {
          const style = getComputedStyle(element);
          return {
            background: style.getPropertyValue("--solara-background").trim(),
            colorScheme: style.colorScheme,
          };
        }),
      )
      .toEqual({ background: THEME_BACKGROUND, colorScheme: "light" });
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
    "Oscuro está deshabilitado: el sitio lo sobreescribiría con colores fijos. Usá la paleta Tinta profunda.";
  const describedBy = await select.getAttribute("aria-describedby");
  expect(describedBy).not.toBeNull();
  await expect(page.locator(`#${describedBy}`)).toContainText(hintText);
});

test("utilidad: los overrides fijos del dark ya viajan en el CSS exportado (qué rompería)", async ({
  page,
}) => {
  const storeName = "Tienda T7 overrides";
  await setupCleanStore(page, storeName);
  await openThemeTab(page);

  const project = (await readStoredProject(page, storeName)) as ExportedProject;
  const css = exportedCss(project);

  // El selector [data-color-mode="dark"] (styles.ts:23-29) está en el sitio
  // aunque el modo no exista en la UI: si se habilitara "Oscuro" pisa los
  // 5 tokens con valores fijos ajenos a la paleta elegida.
  const darkBlock = `[data-solara-store][data-color-mode="dark"]{--solara-background:${FIXED_DARK_TOKENS[0]};--solara-surface:${FIXED_DARK_TOKENS[1]};--solara-text:${FIXED_DARK_TOKENS[2]};--solara-muted:${FIXED_DARK_TOKENS[3]};--solara-border:${FIXED_DARK_TOKENS[4]}}`;
  expect(css).toContain(darkBlock);

  // La media query de auto (styles.ts:513-521) repite los mismos 5 valores:
  // cada token fijo aparece exactamente 2 veces en el CSS.
  for (const token of FIXED_DARK_TOKENS) {
    expect(css.split(token).length - 1).toBe(2);
  }

  // Sólo 5 de los 7 tokens se sobreescriben: accent y accentText quedan fuera
  // del override y conservan el valor del usuario.
  expect(css).not.toMatch(
    /data-color-mode="dark"\]\{[^}]*--solara-accent:|\]\[data-color-mode="dark"\]\s*\{[^}]*--solara-accent-text/,
  );

  // La capa --catalog-* del skin catalog-modern (styles.ts:1942-1948) es un
  // alias de los tokens --solara-* con fallback al valor claro original
  // (fix Ola 3): el override del dark SÍ alcanza las superficies modernas,
  // salvo accent/accentText que el override no toca.
  expect(css).toContain("--catalog-ink:var(--solara-text,#0b0b0c)");
  expect(css).toContain("--catalog-paper:var(--solara-background,#fcfcfb)");
  expect(css).toContain("--catalog-surface:var(--solara-surface,#f0f0ee)");
  expect(css).toContain("--catalog-muted:var(--solara-muted,#696966)");
  expect(css).toContain("--catalog-border:var(--solara-border,#dededa)");
  expect(css).toContain("--catalog-ink:var(");
  expect(css).toContain("--catalog-paper:var(");
  expect(css).toContain("--catalog-surface:var(");
  expect(css).toContain("--catalog-muted:var(");
  expect(css).toContain("--catalog-border:var(");
});
