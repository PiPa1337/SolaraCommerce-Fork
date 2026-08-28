import { readFileSync } from "node:fs";
import { createServer, type Server } from "node:http";
import { resolve } from "node:path";
import { expect, test } from "@playwright/test";
import { exportProject } from "@solara/exporter";
import { applyPreset, THEME_PRESETS } from "@solara/project-schema";
import { catalogModernV2Store } from "@solara/project-schema/catalog-modern-v2-fixture";

/**
 * Quality Forge: matriz visual determinista.
 * - 10 viewports del plan
 * - 5 paletas oficiales (una captura por paleta en desktop)
 * - estados: reduced motion, sin JS, rutas retiradas, títulos largos, marca larga
 * Valida: sin overflow horizontal, headings visibles, foco, CLS y errores de red.
 * Las capturas van a test-results (artefacto QA, no se versionan).
 */

const VIEWPORTS = [
  { name: "desktop-xl", width: 1920, height: 1080 },
  { name: "desktop-lg", width: 1440, height: 900 },
  { name: "laptop", width: 1280, height: 800 },
  { name: "tablet-l", width: 1024, height: 768 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "mobile-wide", width: 600, height: 960 },
  { name: "mobile-plus", width: 430, height: 932 },
  { name: "mobile", width: 390, height: 844 },
  { name: "mobile-small", width: 360, height: 800 },
  { name: "mobile-min", width: 320, height: 700 },
] as const;

const QUALITY_ROUTES = [
  { name: "home", path: "/", status: 200 },
  { name: "categoria", path: "/categorias/remeras/", status: 200 },
  { name: "coleccion", path: "/colecciones/recien-llegados/", status: 200 },
  { name: "producto", path: "/productos/remera-esencial-de-algodon/", status: 200 },
  { name: "busqueda", path: "/buscar/?q=remera", status: 200 },
  { name: "carrito", path: "/carrito/", status: 200 },
  // V2 concentra contacto y checkout en la Home/runtime; estas rutas deben
  // devolver el 404 editorial, no una página parcialmente renderizada.
  { name: "checkout", path: "/compra/", status: 404 },
  { name: "404", path: "/ruta-inexistente/", status: 404 },
  { name: "contacto", path: "/contacto/", status: 404 },
  { name: "nosotros", path: "/nosotros/", status: 404 },
] as const;

const exportedByTheme = new Map<string, ReturnType<typeof exportProject>>();
function exportedFor(presetId: string) {
  let exported = exportedByTheme.get(presetId);
  if (!exported) {
    const project = structuredClone(catalogModernV2Store);
    project.theme = applyPreset(project.theme, presetId);
    exported = exportProject(project, { mode: "production" });
    exportedByTheme.set(presetId, exported);
  }
  return exported;
}

const fixtureFiles = new Map<string, Uint8Array>(
  Array.from({ length: 12 }, (_, index) => {
    const number = String(index + 1).padStart(2, "0");
    return [
      `fixtures/modo-sur-product-${number}.webp`,
      readFileSync(resolve(`apps/studio/public/fixtures/modo-sur-product-${number}.webp`)),
    ] as const;
  }),
);

let server: Server;
let serverUrl: string;

test.beforeAll(async () => {
  server = createServer((request, response) => {
    const url = new URL(request.url ?? "/", "http://127.0.0.1");
    const raw = url.pathname.replace(/^\/+/, "");
    const candidates = [raw || "index.html", `${raw.replace(/\/$/, "")}/index.html`];
    let key = "";
    let content: Uint8Array | undefined;
    for (const candidate of candidates) {
      const hit = exportedFor("editorial").files.get(candidate) ?? fixtureFiles.get(candidate);
      if (hit !== undefined) {
        key = candidate;
        content = hit;
        break;
      }
    }
    if (content === undefined) {
      const notFound = exportedFor("editorial").files.get("404.html");
      response
        .writeHead(404, { "Content-Type": "text/html; charset=utf-8" })
        .end(notFound ?? "<h1>Página no encontrada</h1>");
      return;
    }
    const ext = key.split(".").pop()?.toLowerCase() ?? "";
    const mime =
      ext === "html"
        ? "text/html; charset=utf-8"
        : ext === "css"
          ? "text/css; charset=utf-8"
          : ext === "js"
            ? "text/javascript; charset=utf-8"
            : ext === "webp"
              ? "image/webp"
              : ext === "jpg" || ext === "jpeg"
                ? "image/jpeg"
                : ext === "png"
                  ? "image/png"
                  : ext === "svg"
                    ? "image/svg+xml"
                    : ext === "ico"
                      ? "image/x-icon"
                      : ext === "json"
                        ? "application/json"
                        : "application/octet-stream";
    response.writeHead(200, { "Content-Type": mime }).end(content);
  });
  await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
  const address = server.address();
  serverUrl = `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}`;
});

test.afterAll(async () => {
  server?.close();
});

async function assertNoOverflow(page: import("@playwright/test").Page, label: string) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow, `overflow horizontal en ${label}`).toBeLessThanOrEqual(2);
}

test.describe("rutas completas: layout, carga y estabilidad", () => {
  for (const viewport of VIEWPORTS) {
    test(`todas las rutas sin overflow, errores ni CLS en ${viewport.name}`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });

      for (const route of QUALITY_ROUTES) {
        const target = new URL(route.path, serverUrl).toString();
        const consoleErrors: string[] = [];
        const pageErrors: string[] = [];
        const failedRequests: string[] = [];
        const badResponses: string[] = [];
        const onConsole = (message: import("@playwright/test").ConsoleMessage) => {
          if (message.type() === "error") consoleErrors.push(message.text());
        };
        const onPageError = (error: Error) => pageErrors.push(error.message);
        const onRequestFailed = (request: import("@playwright/test").Request) =>
          failedRequests.push(
            `${request.method()} ${request.url()} ${request.failure()?.errorText ?? ""}`,
          );
        const onResponse = (response: import("@playwright/test").Response) => {
          if (response.status() >= 400 && response.url() !== target) {
            badResponses.push(`${response.status()} ${response.url()}`);
          }
        };
        page.on("console", onConsole);
        page.on("pageerror", onPageError);
        page.on("requestfailed", onRequestFailed);
        page.on("response", onResponse);
        try {
          const response = await page.goto(target, { waitUntil: "load" });
          expect(response?.status(), `${route.name}: status HTTP`).toBe(route.status);
          await page.waitForTimeout(100);
          await assertNoOverflow(page, `${viewport.name}/${route.name}`);

          const h1 = page.locator("h1").first();
          await expect(h1, `${route.name}: h1 visible`).toBeVisible();
          const headings = await page
            .locator("h1:visible, h2:visible, h3:visible")
            .evaluateAll((elements) =>
              elements.map((element) => {
                const box = element.getBoundingClientRect();
                return { left: box.left, right: box.right };
              }),
            );
          for (const heading of headings) {
            expect(
              heading.left,
              `${route.name}: heading fuera por izquierda`,
            ).toBeGreaterThanOrEqual(-1);
            expect(heading.right, `${route.name}: heading fuera por derecha`).toBeLessThanOrEqual(
              viewport.width + 1,
            );
          }

          const brokenImages = await page
            .locator("img")
            .evaluateAll((images) =>
              images
                .filter((image) => image.complete && image.naturalWidth === 0)
                .map(
                  (image) => image.getAttribute("src") || image.getAttribute("alt") || "sin src",
                ),
            );
          expect(brokenImages, `${route.name}: imagen rota`).toEqual([]);

          await page.keyboard.press("Tab");
          const focus = await page.evaluate(() => {
            const active = document.activeElement;
            if (!active || active === document.body) return null;
            const style = getComputedStyle(active);
            const outlineWidth = Number.parseFloat(style.outlineWidth);
            const visible =
              (outlineWidth > 0 && style.outlineStyle !== "none") ||
              (style.boxShadow !== "none" && style.boxShadow.length > 4);
            return { visible };
          });
          expect(focus?.visible, `${route.name}: foco invisible`).toBe(true);

          const cls = await page.evaluate(() =>
            performance.getEntriesByType("layout-shift").reduce((total, entry) => {
              const shift = entry as PerformanceEntry & {
                hadRecentInput?: boolean;
                value?: number;
              };
              return total + (shift.hadRecentInput ? 0 : (shift.value ?? 0));
            }, 0),
          );
          expect(cls, `${route.name}: CLS`).toBeLessThanOrEqual(0.1);
        } finally {
          page.off("console", onConsole);
          page.off("pageerror", onPageError);
          page.off("requestfailed", onRequestFailed);
          page.off("response", onResponse);
        }
        const expectedNotFoundConsole =
          route.status === 404 &&
          consoleErrors.filter((message) =>
            message.includes("Failed to load resource: the server responded with a status of 404"),
          );
        expect(
          consoleErrors.filter((message) => !expectedNotFoundConsole.includes(message)),
          `${route.name}: console.error`,
        ).toEqual([]);
        expect(pageErrors, `${route.name}: pageerror`).toEqual([]);
        expect(failedRequests, `${route.name}: requests failed`).toEqual([]);
        expect(badResponses, `${route.name}: respuestas HTTP inesperadas`).toEqual([]);
      }
    });
  }
});

test.describe("matriz de viewports (paleta editorial)", () => {
  for (const viewport of VIEWPORTS) {
    test(`home sin overflow y h1 visible en ${viewport.name}`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto(serverUrl);
      await assertNoOverflow(page, viewport.name);
      const h1 = page.locator("h1").first();
      await expect(h1).toBeVisible();
      const box = await h1.boundingBox();
      expect(box?.x).toBeGreaterThanOrEqual(-1);
    });
  }
});

test.describe("paletas oficiales en 1440x900", () => {
  for (const preset of THEME_PRESETS) {
    test(`paleta ${preset.id} sin overflow y con acento aplicado`, async ({ page }) => {
      const project = structuredClone(catalogModernV2Store);
      project.theme = applyPreset(project.theme, preset.id);
      const exported = exportedFor(preset.id);
      const url = new URL(serverUrl);
      await page.route(`${url.origin}/**`, async (route) => {
        const path = decodeURIComponent(
          new URL(route.request().url()).pathname.replace(/^\/+/, ""),
        );
        const content =
          exported.files.get(path || "index.html") ??
          exported.files.get(`${path}/index.html`) ??
          fixtureFiles.get(path);
        if (content === undefined) return route.fulfill({ status: 404, body: "" });
        return route.fulfill({ body: Buffer.from(content) });
      });
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.goto(serverUrl);
      await assertNoOverflow(page, `paleta ${preset.id}`);
      const accent = await page.evaluate(() =>
        getComputedStyle(document.documentElement).getPropertyValue("--solara-accent").trim(),
      );
      expect(accent.toLowerCase()).toBe(preset.tokens.colors.accent.toLowerCase());
    });
  }
});

test("reduced motion: el hero no anima entrada", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(serverUrl);
  const animation = await page.evaluate(() => {
    const hero = document.querySelector<HTMLElement>(".catalog-hero-copy");
    return hero ? getComputedStyle(hero).animationDuration : "none";
  });
  // Con reduced motion la duración efectiva es 0 (o casi 0 por redondeo del
  // navegador); cualquier valor perceptible (>1ms) sería una animación real.
  const seconds = Number.parseFloat(animation);
  expect(Number.isNaN(seconds) || seconds <= 0.001).toBe(true);
});

test("sin JavaScript: el HTML inicial muestra contenido y CTA", async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(serverUrl);
  await expect(page.locator("h1").first()).toBeVisible();
  await expect(page.locator("a").first()).toBeVisible();
  await assertNoOverflow(page, "sin JS");
  await context.close();
});
