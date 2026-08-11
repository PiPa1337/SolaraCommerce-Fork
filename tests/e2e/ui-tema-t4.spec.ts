/**
 * Bin T4 — Auditoría de tipografía del tema (plan 2026-08-10, Ola 1).
 *
 * Contrato de 4 capas para "Familia de títulos" (typography.display),
 * "Familia de texto" (typography.body) y "Escala" (range 0.8-1.4):
 *
 * 1. Funcional: el valor escrito/deslizado llega a los tokens --solara-*.
 * 2. Auto-feedback: los campos controlados reflejan lo escrito.
 * 3. Datos: themeCss emite los mismos nombres en preview y exportación.
 * 4. Utilidad: font-family COMPUTADA en el preview y en el sitio servido,
 *    diff del CSS exportado antes/después, y evidencia de que el control no
 *    carga fuentes (ni Google Fonts ni @font-face del usuario): el efecto
 *    real depende de las familias instaladas en el sistema del visitante.
 */
import { createServer, type Server } from "node:http";
import { expect, type Locator, type Page, test } from "@playwright/test";
import { exportProject } from "@solara/exporter";
import { catalogModernCleanStore } from "@solara/project-schema/catalog-modern-template";
import { startStudioServer, stopStudioServer } from "./studio-server";

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
  await page.getByRole("button", { name: "Crear tienda vacía", exact: true }).click();
  await expect(page.getByRole("navigation", { name: "Áreas de la tienda" })).toBeVisible({
    timeout: 30_000,
  });
}

async function openThemeTab(page: Page): Promise<void> {
  await page.getByRole("tab", { name: "Tema", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Tema", exact: true })).toBeVisible();
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

test("T4: la familia de títulos llega al preview y al sitio; la de texto queda sobreescrita por el stack fijo del módulo", async ({
  page,
}) => {
  await setupCleanStore(page, "Tienda T4 familias");
  await openThemeTab(page);

  const previewStoreRoot = previewStore(page);
  const previewHeading = previewStoreRoot.locator("h1").first();

  // Inventario con el default: el CSS del módulo catalog-modern fija en la
  // raíz del storefront el stack "Archivo, Arial Narrow, Helvetica Neue,
  // Arial, sans-serif" (styles.ts:1951), y la marca del encabezado usa
  // "Georgia, Times New Roman, serif" fijo (styles.ts:1965/2302).
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
    .toContain("Georgia");

  const display = page.getByLabel("Familia de títulos");
  const body = page.getByLabel("Familia de texto");

  // Un cambio por vez: los commits del panel disparan actualizaciones del
  // preview que pueden llegar fuera de orden; el estado final tiene ambos.
  await display.fill("Georgia");
  await expect(display).toHaveValue("Georgia");
  await expect.poll(previewVar(page, "--solara-font-display"), { timeout: 15_000 }).toBe("Georgia");

  // "Familia de títulos" SÍ produce un efecto real: los títulos h1-h3 leen
  // var(--solara-font-display) (styles.ts:85) y computan la familia escrita.
  await expect
    .poll(() => previewHeading.evaluate((element) => getComputedStyle(element).fontFamily), {
      timeout: 15_000,
    })
    .toBe("Georgia");

  await body.fill("Georgia");
  await expect(body).toHaveValue("Georgia");
  await expect.poll(previewVar(page, "--solara-font-body"), { timeout: 15_000 }).toBe("Georgia");

  // "Familia de texto" NO produce efecto real en catalog-modern: el dato llega
  // al token (--solara-font-body: Georgia) pero la raíz del storefront queda
  // con el stack fijo del módulo, que gana por especificidad (0,2,0 vs 0,1,0).
  await expect
    .poll(() => previewStoreRoot.evaluate((element) => getComputedStyle(element).fontFamily), {
      timeout: 15_000,
    })
    .toContain("Archivo");
  const rootFamilyAfter = await previewStoreRoot.evaluate(
    (element) => getComputedStyle(element).fontFamily,
  );
  expect(rootFamilyAfter).not.toContain("Georgia");

  // El mismo proyecto persistido viaja al sitio exportado: se exporta lo que
  // el Studio escribió y el sitio servido repite el comportamiento (títulos
  // con la familia escrita, texto con el stack fijo). (La tienda limpia
  // arrastra imágenes de plantilla, así que el modo es draft: el CSS y el
  // render son los mismos que production, sólo cambia el noindex.)
  const project = await readProjectWithTheme(page, "Tienda T4 familias", {
    display: "Georgia",
    body: "Georgia",
  });
  const exported = exportProject(project as never, { mode: "draft" });
  const site = await startSiteServer(exported.files);
  try {
    await page.goto(`${site.url}/`);
    await expect(page.locator("[data-solara-store] h1").first()).toHaveCSS(
      "font-family",
      "Georgia",
    );
    const siteRootFamily = await page
      .locator("[data-solara-store]")
      .first()
      .evaluate((element) => getComputedStyle(element).fontFamily);
    expect(siteRootFamily).toContain("Archivo");
    expect(siteRootFamily).not.toContain("Georgia");
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

  // Los títulos usan tamaños en rem (clamp) y NO escalan con la var: la escala
  // sólo afecta al texto que hereda la raíz (hallazgo de utilidad parcial).
  const headingSizeBase = parseFloat(
    await previewStore(page)
      .locator("h1")
      .first()
      .evaluate((element) => getComputedStyle(element).fontSize),
  );
  await scale.fill("1");
  await expect.poll(rootFontSize, { timeout: 15_000 }).toBe(16);
  const headingSizeScaled = parseFloat(
    await previewStore(page)
      .locator("h1")
      .first()
      .evaluate((element) => getComputedStyle(element).fontSize),
  );
  expect(headingSizeScaled).toBe(headingSizeBase);

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

  await page.getByLabel("Familia de títulos").fill("Georgia");
  await page.getByLabel("Familia de texto").fill("Georgia");
  const scale = page.getByLabel(/^Escala /);
  await scale.fill("1.4");
  await expect.poll(previewVar(page, "--solara-type-scale"), { timeout: 15_000 }).toBe("1.4");

  const edited = exportProject(
    await readProjectWithTheme(page, "Tienda T4 diff", {
      display: "Georgia",
      body: "Georgia",
      scale: 1.4,
    }),
    { mode: "draft" },
  );
  const base = exportProject(catalogModernCleanStore, { mode: "draft" });

  const baseCss = String(base.files.get("assets/storefront.css"));
  const editedCss = String(edited.files.get("assets/storefront.css"));
  const editedHtml = String(edited.files.get("index.html"));

  // El default llega al CSS; el cambio lo reemplaza (diff de utilidad).
  expect(baseCss).toContain("--solara-font-display:Archivo");
  expect(editedCss).toContain("--solara-font-display:Georgia");
  expect(editedCss).toContain("--solara-font-body:Georgia");
  expect(editedCss).toContain("--solara-type-scale:1.4");
  expect(editedCss).not.toContain("--solara-font-display:Archivo");

  // Sin carga de fuentes: ni Google Fonts ni @font-face del usuario (sólo el
  // shim local "Archivo" → Arial), en el CSS y en el HTML del sitio.
  const fontFaceCount = (value: string): number => value.split("@font-face").length - 1;
  expect(fontFaceCount(baseCss)).toBe(1);
  expect(fontFaceCount(editedCss)).toBe(1);
  expect(editedCss).not.toContain("fonts.googleapis.com");
  expect(editedCss).not.toContain("@import");
  expect(editedHtml).not.toContain("fonts.googleapis.com");
  expect(editedHtml).not.toContain("preconnect");

  // El sitio servido repite las familias editadas.
  const site = await startSiteServer(edited.files);
  try {
    await page.goto(`${site.url}/`);
    await expect(page.locator("[data-solara-store] h1").first()).toHaveCSS(
      "font-family",
      "Georgia",
    );
  } finally {
    await stopSiteServer(site.server);
  }
});

test("T4: sin carga de fuentes, una familia desconocida se declara pero no se materializa", async ({
  page,
}) => {
  await setupCleanStore(page, "Tienda T4 desconocida");
  await openThemeTab(page);

  await page.getByLabel("Familia de títulos").fill("MiFuente");

  // Se declara (font-family computada = "MiFuente") pero no se carga: el
  // registro de fuentes del documento no tiene ninguna entrada "MiFuente"
  // (sólo el shim local "Archivo"), así que el navegador cae al fallback.
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
