/**
 * Bin T4 — Auditoría de tipografía del tema (plan 2026-08-10, Ola 1 + Ola 3).
 *
 * Contrato de 4 capas para "Familia de títulos" (typography.display),
 * "Familia de texto" (typography.body) y "Escala" (range 0.8-1.4):
 *
 * 1. Funcional: la opción elegida del selector (stack completo) llega a los
 *    tokens --solara-*.
 * 2. Auto-feedback: el select refleja la opción resuelta del valor guardado.
 * 3. Datos: themeCss emite los mismos stacks en preview y exportación.
 * 4. Utilidad: font-family COMPUTADA en el preview y en el sitio servido,
 *    diff del CSS exportado antes/después, y evidencia de que un valor
 *    "Personalizada" (fuera del selector) se conserva sin cargarse. Las
 *    familias Google del registro se cargan self-host (@font-face + woff2
 *    propio); las personalizadas no emiten @font-face y el efecto real
 *    depende de las familias instaladas en el sistema.
 */
import { createServer, type Server } from "node:http";
import { expect, type Locator, type Page, test } from "@playwright/test";
import { exportProject } from "@solara/exporter";
import { catalogModernCleanStore } from "@solara/project-schema/catalog-modern-template";
import { startStudioServer, stopStudioServer } from "./studio-server";

const GEORGIA_STACK = `Georgia, "Times New Roman", serif`;
const ARCHIVO_STACK = `Archivo, Arial Narrow, Helvetica Neue, Arial, sans-serif`;
/** minifyCss compacta el espacio tras cada coma en themeCss (preview y export). */
const MINIFIED_GEORGIA_STACK = GEORGIA_STACK.replaceAll(", ", ",");

test.setTimeout(process.env.CI ? 120_000 : 90_000);

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

function previewRoot(page: Page): Locator {
  return page.frameLocator('iframe[title="Vista previa desktop"]').locator("html");
}

/** El div raíz del sitio público (lleva data-solara-store y los tokens). */
function previewStore(page: Page): Locator {
  return page.frameLocator('iframe[title="Vista previa desktop"]').locator(".solara-page");
}

function previewVar(page: Page, name: string): () => Promise<string> {
  const html = previewRoot(page);
  return () =>
    html.evaluate(
      (element, token) => getComputedStyle(element).getPropertyValue(token).trim(),
      name,
    );
}

/** Proyectos persistidos por el autosave del Studio (modo navegador). */
async function readStudioProjects(page: Page): Promise<Array<Record<string, unknown>>> {
  return page.evaluate(
    () =>
      new Promise<Array<Record<string, unknown>>>((resolve, reject) => {
        const request = indexedDB.open("solara-commerce-studio");
        request.addEventListener("success", () => {
          const database = request.result;
          const transaction = database.transaction("projects", "readonly");
          const records = transaction.objectStore("projects").getAll();
          records.addEventListener("success", () => {
            const projects = ((records.result ?? []) as Array<{ project: unknown }>).map(
              (record) => JSON.parse(JSON.stringify(record.project)) as Record<string, unknown>,
            );
            database.close();
            resolve(projects);
          });
          records.addEventListener("error", () => {
            database.close();
            reject(records.error);
          });
        });
        request.addEventListener("error", () => reject(request.error));
      }),
  );
}

/** Espera a que el autosave persista el tema editado y devuelve ese proyecto. */
async function readProjectWithTheme(
  page: Page,
  name: string,
  expected: Partial<{ display: string; body: string; scale: number }>,
): Promise<Record<string, unknown>> {
  const matches = async (): Promise<Record<string, unknown> | undefined> => {
    const projects = await readStudioProjects(page);
    return projects.find((project) => {
      if ((project as { name?: string }).name !== name) return false;
      const typography = (
        project as {
          theme?: { typography?: Partial<Record<keyof typeof expected, unknown>> };
        }
      ).theme?.typography;
      return Object.entries(expected).every(
        ([key, value]) => typography?.[key as keyof typeof expected] === value,
      );
    });
  };
  await expect.poll(matches, { timeout: 30_000 }).not.toBeUndefined();
  return (await matches()) as Record<string, unknown>;
}

/** Sirve un ExportResult como sitio estático (patrón exported-store.spec.ts). */
async function startSiteServer(
  files: Map<string, string | Uint8Array>,
): Promise<{ server: Server; url: string }> {
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
    const extension = path.split(".").pop();
    const contentType =
      extension === "html"
        ? "text/html; charset=utf-8"
        : extension === "css"
          ? "text/css; charset=utf-8"
          : extension === "js"
            ? "text/javascript; charset=utf-8"
            : extension === "xml"
              ? "application/xml; charset=utf-8"
              : "application/octet-stream";
    response.writeHead(200, { "Content-Type": contentType, "Cache-Control": "no-store" });
    response.end(content);
  });
  await new Promise<void>((resolveListening) =>
    siteServer.listen(0, "127.0.0.1", resolveListening),
  );
  const address = siteServer.address();
  if (!address || typeof address === "string") {
    throw new Error("No se pudo iniciar el servidor del sitio exportado.");
  }
  return { server: siteServer, url: `http://127.0.0.1:${address.port}` };
}

async function stopSiteServer(siteServer: Server): Promise<void> {
  await new Promise<void>((resolveClosing, reject) => {
    siteServer.close((error) => (error ? reject(error) : resolveClosing()));
  });
}

test("T4: las familias elegidas llegan al preview y al sitio: títulos, marca y texto", async ({
  page,
}) => {
  await setupCleanStore(page, "Tienda T4 familias");
  await openThemeTab(page);

  const previewStoreRoot = previewStore(page);
  const previewHeading = previewStoreRoot.locator("h1").first();

  // Inventario con el default: el selector resuelve el stack del fixture
  // (Archivo) por coincidencia exacta; la raíz del storefront consume
  // var(--solara-font-body) (styles.ts:1951) y la marca consume
  // var(--solara-font-display) (styles.ts:1965/2302), ambas con el stack
  // default del fixture.
  const display = page.getByTestId("ui-font-display");
  const body = page.getByTestId("ui-font-body");
  await expect(display).toHaveValue(ARCHIVO_STACK);
  await expect(body).toHaveValue(ARCHIVO_STACK);
  await expect
    .poll(() => previewStoreRoot.evaluate((element) => getComputedStyle(element).fontFamily), {
      timeout: 15_000,
    })
    .toContain("Archivo");
  await expect
    .poll(
      () =>
        previewStoreRoot
          .locator(".catalog-brand")
          .first()
          .evaluate((element) => getComputedStyle(element).fontFamily),
      { timeout: 15_000 },
    )
    .toContain("Archivo");

  // Un cambio por vez: los commits del panel disparan actualizaciones del
  // preview que pueden llegar fuera de orden; el estado final tiene ambos.
  await display.selectOption(GEORGIA_STACK);
  await expect(display).toHaveValue(GEORGIA_STACK);
  await expect
    .poll(previewVar(page, "--solara-font-display"), { timeout: 15_000 })
    .toBe(MINIFIED_GEORGIA_STACK);

  // "Familia de títulos" SÍ produce un efecto real: los títulos h1-h3 leen
  // var(--solara-font-display) (styles.ts:85) y la marca del encabezado
  // también (fix Ola 3: dejó de quedar fija en Georgia).
  await expect
    .poll(() => previewHeading.evaluate((element) => getComputedStyle(element).fontFamily), {
      timeout: 15_000,
    })
    .toBe(GEORGIA_STACK);
  await expect
    .poll(
      () =>
        previewStoreRoot
          .locator(".catalog-brand")
          .first()
          .evaluate((element) => getComputedStyle(element).fontFamily),
      { timeout: 15_000 },
    )
    .toBe(GEORGIA_STACK);

  await body.selectOption(GEORGIA_STACK);
  await expect(body).toHaveValue(GEORGIA_STACK);
  await expect
    .poll(previewVar(page, "--solara-font-body"), { timeout: 15_000 })
    .toBe(MINIFIED_GEORGIA_STACK);

  // "Familia de texto" produce un efecto real (fix Ola 3): la raíz del
  // storefront consume var(--solara-font-body) y computa la familia elegida.
  await expect
    .poll(() => previewStoreRoot.evaluate((element) => getComputedStyle(element).fontFamily), {
      timeout: 15_000,
    })
    .toBe(GEORGIA_STACK);
  const rootFamilyAfter = await previewStoreRoot.evaluate(
    (element) => getComputedStyle(element).fontFamily,
  );
  expect(rootFamilyAfter).toContain("Georgia");
  expect(rootFamilyAfter).not.toContain("Archivo");

  // El mismo proyecto persistido viaja al sitio exportado: se exporta lo que
  // el Studio escribió y el sitio servido repite el comportamiento (títulos,
  // marca y texto con la familia elegida). (La tienda limpia arrastra
  // imágenes de plantilla, así que el modo es draft: el CSS y el render son
  // los mismos que production, sólo cambia el noindex.)
  const project = await readProjectWithTheme(page, "Tienda T4 familias", {
    display: GEORGIA_STACK,
    body: GEORGIA_STACK,
  });
  const exported = exportProject(project as never, { mode: "draft" });
  const site = await startSiteServer(exported.files);
  try {
    await page.goto(`${site.url}/`);
    await expect
      .poll(
        () =>
          page
            .locator("[data-solara-store] h1")
            .first()
            .evaluate((element) => getComputedStyle(element).fontFamily),
        { timeout: 15_000 },
      )
      .toBe(GEORGIA_STACK);
    const siteRootFamily = await page
      .locator("[data-solara-store]")
      .first()
      .evaluate((element) => getComputedStyle(element).fontFamily);
    expect(siteRootFamily).toContain("Georgia");
    expect(siteRootFamily).not.toContain("Archivo");
  } finally {
    await stopSiteServer(site.server);
  }
});

test("T4: la escala del range cambia el tamaño real en el preview y en el sitio", async ({
  page,
}) => {
  await setupCleanStore(page, "Tienda T4 escala");
  await openThemeTab(page);

  const scale = page.getByLabel(/^Escala /);
  const rootFontSize = async (): Promise<number> =>
    parseFloat(await previewStore(page).evaluate((element) => getComputedStyle(element).fontSize));

  // Default: escala 1 → raíz del storefront en 16px.
  await expect(scale).toHaveValue("1");
  await expect.poll(rootFontSize, { timeout: 15_000 }).toBe(16);

  // La escala sube el tamaño real del texto heredado (var consumida).
  await scale.fill("1.4");
  await expect(scale).toHaveValue("1.4");
  await expect.poll(previewVar(page, "--solara-type-scale"), { timeout: 15_000 }).toBe("1.4");
  await expect.poll(rootFontSize, { timeout: 15_000 }).toBeCloseTo(22.4, 1);

  const sizeAt140 = await rootFontSize();
  expect(sizeAt140 / 16).toBeCloseTo(1.4, 2);

  // Los títulos escalan con la var (fix Ola 3): los h1 modernos usan
  // font-size: calc(clamp(...) * var(--solara-type-scale, 1)); la escala
  // afecta a la base y a los títulos por igual.
  const headingSizeAt140 = parseFloat(
    await previewStore(page)
      .locator("h1")
      .first()
      .evaluate((element) => getComputedStyle(element).fontSize),
  );
  await scale.fill("1");
  await expect.poll(rootFontSize, { timeout: 15_000 }).toBe(16);
  const headingSizeAt100 = parseFloat(
    await previewStore(page)
      .locator("h1")
      .first()
      .evaluate((element) => getComputedStyle(element).fontSize),
  );
  expect(headingSizeAt140 / headingSizeAt100).toBeCloseTo(1.4, 2);

  // El sitio exportado repite el mismo tamaño: escala 1.4 → 22.4px.
  await scale.fill("1.4");
  await expect.poll(rootFontSize, { timeout: 15_000 }).toBeCloseTo(22.4, 1);
  const project = await readProjectWithTheme(page, "Tienda T4 escala", {
    display: "Archivo, Arial Narrow, Helvetica Neue, Arial, sans-serif",
    body: "Archivo, Arial Narrow, Helvetica Neue, Arial, sans-serif",
    scale: 1.4,
  });
  const exported = exportProject(project as never, { mode: "draft" });
  const site = await startSiteServer(exported.files);
  try {
    await page.goto(`${site.url}/`);
    const siteRoot = page.locator("[data-solara-store]").first();
    await expect
      .poll(() => siteRoot.evaluate((element) => parseFloat(getComputedStyle(element).fontSize)), {
        timeout: 15_000,
      })
      .toBeCloseTo(22.4, 1);
  } finally {
    await stopSiteServer(site.server);
  }
});

test("T4: las familias y la escala viajan al CSS del sitio exportado (diff antes/después)", async ({
  page,
}) => {
  await setupCleanStore(page, "Tienda T4 diff");
  await openThemeTab(page);

  await page.getByTestId("ui-font-display").selectOption(GEORGIA_STACK);
  await page.getByTestId("ui-font-body").selectOption(GEORGIA_STACK);
  const scale = page.getByLabel(/^Escala /);
  await scale.fill("1.4");
  await expect.poll(previewVar(page, "--solara-type-scale"), { timeout: 15_000 }).toBe("1.4");

  const edited = exportProject(
    await readProjectWithTheme(page, "Tienda T4 diff", {
      display: GEORGIA_STACK,
      body: GEORGIA_STACK,
      scale: 1.4,
    }),
    { mode: "draft" },
  );
  const base = exportProject(catalogModernCleanStore, { mode: "draft" });

  const baseCss = String(base.files.get("assets/storefront.css"));
  const editedCss = String(edited.files.get("assets/storefront.css"));
  const editedHtml = String(edited.files.get("index.html"));
  const minifiedGeorgia = GEORGIA_STACK.replaceAll(", ", ",");

  // El default llega al CSS; el cambio lo reemplaza (diff de utilidad).
  expect(baseCss).toContain("--solara-font-display:Archivo");
  expect(editedCss).toContain(`--solara-font-display:${minifiedGeorgia}`);
  expect(editedCss).toContain(`--solara-font-body:${minifiedGeorgia}`);
  expect(editedCss).toContain("--solara-type-scale:1.4");
  expect(editedCss).not.toContain("--solara-font-display:Archivo");

  // Carga self-host (Ola 3): el default (Archivo, display === body) emite un
  // @font-face real con woff2 propio; una familia no registrada (Georgia) no
  // emite @font-face y el navegador cae al stack. Sin CDN ni @import.
  const fontFaceCount = (value: string): number => value.split("@font-face").length - 1;
  expect(fontFaceCount(baseCss)).toBe(1);
  expect(baseCss).toContain('url("/assets/fonts/archivo.woff2")');
  expect(fontFaceCount(editedCss)).toBe(0);
  expect(editedCss).not.toContain("@font-face{font-family");
  expect(editedCss).not.toContain("fonts.googleapis.com");
  expect(editedCss).not.toContain("@import");
  expect(editedHtml).not.toContain("fonts.googleapis.com");
  expect(editedHtml).not.toContain("preconnect");

  // El sitio servido repite las familias editadas.
  const site = await startSiteServer(edited.files);
  try {
    await page.goto(`${site.url}/`);
    await expect
      .poll(
        () =>
          page
            .locator("[data-solara-store] h1")
            .first()
            .evaluate((element) => getComputedStyle(element).fontFamily),
        { timeout: 15_000 },
      )
      .toBe(GEORGIA_STACK);
  } finally {
    await stopSiteServer(site.server);
  }
});

test("T4: un valor fuera del selector se conserva como 'Personalizada' sin reescribir el proyecto", async ({
  page,
}) => {
  await setupCleanStore(page, "Tienda T4 desconocida");
  // La migración tolerante arranca de un proyecto viejo guardado con un valor
  // libre ("MiFuente"): se escribe directo en IndexedDB y se reabre la tienda.
  await page.goto(studioUrl);
  await expect(page.getByRole("heading", { name: "Tus tiendas" })).toBeVisible();
  await page.evaluate(
    () =>
      new Promise<void>((resolve, reject) => {
        const request = indexedDB.open("solara-commerce-studio");
        request.addEventListener("error", () => reject(request.error));
        request.addEventListener("success", () => {
          const database = request.result;
          const transaction = database.transaction("projects", "readwrite");
          const store = transaction.objectStore("projects");
          const records = store.getAll();
          records.addEventListener("success", () => {
            const record = (records.result ?? []).find(
              (entry) =>
                (entry as { project?: { name?: string } }).project?.name ===
                "Tienda T4 desconocida",
            );
            if (record !== undefined) {
              (
                record as { project: { theme: { typography: { display: string } } } }
              ).project.theme.typography.display = "MiFuente";
              store.put(record);
            }
            database.close();
            resolve();
          });
          records.addEventListener("error", () => {
            database.close();
            reject(records.error);
          });
        });
      }),
  );
  await page.reload();
  await expect(page.getByRole("heading", { name: "Tus tiendas" })).toBeVisible();

  const card = page
    .locator(".dashboard-store-card")
    .filter({ hasText: "Tienda T4 desconocida" })
    .first();
  await card.locator(".dashboard-store-card__button").click();
  await page.getByRole("button", { name: "Abrir tienda", exact: true }).click();
  await expect(page.getByRole("navigation", { name: "Áreas de la tienda" })).toBeVisible();
  await openThemeTab(page);

  // El select muestra la opción "Personalizada" con el valor tal cual y el
  // resto del tema (body default = Archivo) sigue resolviendo sus opciones.
  const display = page.getByTestId("ui-font-display");
  const body = page.getByTestId("ui-font-body");
  await expect(display).toHaveValue("MiFuente");
  await expect(display.locator('optgroup[label="Personalizada"] option')).toContainText(
    "Personalizada: MiFuente",
  );
  await expect(body).toHaveValue(ARCHIVO_STACK);

  // Se declara (font-family computada = "MiFuente") pero no se carga: el
  // registro de fuentes no conoce "MiFuente", así que no emite @font-face y
  // el navegador cae al fallback.
  const frame = page.frameLocator('iframe[title="Vista previa desktop"]');
  await expect
    .poll(
      () =>
        frame
          .locator("h1")
          .first()
          .evaluate((element) => getComputedStyle(element).fontFamily),
      { timeout: 15_000 },
    )
    .toBe("MiFuente");
  await expect
    .poll(
      () =>
        frame.locator("html").evaluate((element) =>
          Array.from(element.ownerDocument.fonts)
            .map((face) => face.family)
            .filter((family) => family === "MiFuente"),
        ),
      { timeout: 15_000 },
    )
    .toEqual([]);

  // El valor viaja al export sin reescribirse ni registrarse como @font-face.
  const edited = exportProject(
    await readProjectWithTheme(page, "Tienda T4 desconocida", {
      display: "MiFuente",
    }),
    { mode: "draft" },
  );
  const editedCss = String(edited.files.get("assets/storefront.css"));
  expect(editedCss).toContain("--solara-font-display:MiFuente");
  expect(editedCss).not.toContain("@font-face{MiFuente");
  expect(editedCss).not.toContain("fonts.googleapis.com");
});
