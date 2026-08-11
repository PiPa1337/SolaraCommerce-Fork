/**
 * Auditoría Resumen R3 (2026-08-11) — Dominio: URL pública (baseUrl) y slug interno.
 * Contrato de 4 capas (plan docs/superpowers/plans/2026-08-10-auditoria-resumen.md):
 * - funcional: editar la URL pública commitea el nuevo valor al proyecto; el
 *   slug interno es identidad de solo lectura (readOnly) que se asigna al
 *   crear o duplicar la tienda;
 * - auto-feedback: vacío → "Completá la URL pública." (post-fix A8), inválida
 *   → "Ingresá una URL válida con http(s).", con aria-invalid en el input; la
 *   auditoría de SEO advierte subcarpeta (domain.baseurl-path) y exige HTTPS
 *   (domain.https) con el hallazgo visible en el checklist;
 * - datos: baseUrl commiteada persiste en IndexedDB y tras recargar la app;
 * - utilidad: exportar el sitio ANTES/DESPUÉS — la URL nueva reescribe
 *   canonical, og:url, JSON-LD (WebSite/OnlineStore), sitemap.xml, robots.txt
 *   y feeds; el slug interno NO aparece en ningún archivo del sitio exportado
 *   (diff vacío): es identidad interna (carpeta proyectos/, respaldo y
 *   historial de exportación), no afecta las URLs públicas.
 */
import type { Server } from "node:http";
import { expect, type Page, test } from "@playwright/test";
import { exportProject } from "@solara/exporter";
import { SlugSchema, StoreProjectV1Schema } from "@solara/project-schema";
import { catalogModernStore } from "@solara/project-schema/catalog-modern-fixture";
import { startStudioServer, stopStudioServer } from "./studio-server";

test.setTimeout(process.env.CI ? 150_000 : 90_000);

const NEW_BASE_URL = "https://tienda-modo-sur.example";
const SUBFOLDER_BASE_URL = "https://modo-sur.example/tienda/";
const HTTP_BASE_URL = "http://modo-sur-http.example";

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

async function resetIndexedDb(page: Page): Promise<void> {
  await page.goto(studioUrl);
  await page.evaluate(
    () =>
      new Promise<void>((resolveDelete, reject) => {
        const request = indexedDB.deleteDatabase("solara-commerce-studio");
        request.addEventListener("success", () => resolveDelete());
        request.addEventListener("error", () => reject(request.error));
        request.addEventListener("blocked", () => reject(new Error("La base quedó bloqueada.")));
      }),
  );
  await page.reload();
  await expect(page.getByRole("heading", { name: "Tus tiendas" })).toBeVisible();
}

async function openDemoStore(page: Page): Promise<void> {
  await page.locator('[data-store-card-id="store-modo-sur-demo"]').click();
  await page.getByRole("button", { name: "Abrir tienda", exact: true }).click();
  await expect(page.getByRole("navigation", { name: "Áreas de la tienda" })).toBeVisible();
}

async function openResumenTab(page: Page): Promise<void> {
  await page.getByRole("tab", { name: "Resumen", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Resumen", exact: true })).toBeVisible();
}

const domainSection = (page: Page) => page.locator('[data-accordion-id="domain"]');
const urlField = (page: Page) =>
  domainSection(page).locator("fieldset.field").filter({ hasText: "URL pública" });
const urlInput = (page: Page) => domainSection(page).getByLabel("URL pública", { exact: true });
const slugInput = (page: Page) => domainSection(page).getByLabel("Slug interno", { exact: true });

/** baseUrl autoservada en IndexedDB (receptor del payload commiteado). */
async function storedBaseUrl(page: Page): Promise<string | undefined> {
  return page.evaluate(
    () =>
      new Promise<string | undefined>((resolve, reject) => {
        const request = indexedDB.open("solara-commerce-studio");
        request.addEventListener("error", () => reject(request.error));
        request.addEventListener("success", () => {
          const db = request.result;
          const all = db.transaction("projects").objectStore("projects").getAll();
          all.addEventListener("success", () => {
            const records = all.result as Array<{ id: string; project: { baseUrl: string } }>;
            resolve(records.find((record) => record.id === "store-modo-sur-demo")?.project.baseUrl);
          });
          all.addEventListener("error", () => reject(all.error));
        });
      }),
  );
}

/** Guardar del modo navegador: flush del autosave con Ctrl+S y aviso "Guardado". */
async function flushSave(page: Page): Promise<void> {
  await page.keyboard.press("Control+s");
  await expect(page.locator(".save-indicator")).toContainText("Guardado", { timeout: 30_000 });
}

/** Decodifica los archivos del sitio exportado a texto (los assets binarios son URL de datos). */
function asText(files: ReadonlyMap<string, string | Uint8Array>): Map<string, string> {
  return new Map(
    [...files.entries()].map(([path, content]) => [
      path,
      typeof content === "string" ? content : new TextDecoder().decode(content),
    ]),
  );
}

/** Sitios exportados ANTES y DESPUÉS del cambio de URL pública. */
const beforeExport = exportProject(catalogModernStore, { mode: "production" });
const afterExport = exportProject(
  StoreProjectV1Schema.parse({ ...structuredClone(catalogModernStore), baseUrl: NEW_BASE_URL }),
  { mode: "production" },
);
/** Mismo sitio con otro slug interno: la identidad no debe tocar los archivos. */
const otherSlugExport = exportProject(
  StoreProjectV1Schema.parse({
    ...structuredClone(catalogModernStore),
    slug: "otra-identidad-interna",
  }),
  { mode: "production" },
);

const OLD_HOST = "https://modo-sur.example";
const beforeText = asText(beforeExport.files);
const afterText = asText(afterExport.files);
const otherSlugText = asText(otherSlugExport.files);

test("URL pública: edición válida commitea, vacío e inválido muestran error inline (post-fix A8)", async ({
  page,
}) => {
  await resetIndexedDb(page);
  await openDemoStore(page);
  await openResumenTab(page);

  const initialUrl = await urlInput(page).inputValue();
  expect(initialUrl).toBe("https://demo-catalogo-jerarquico.example");

  // Vacío: error inline sin commit (post-fix A8).
  await urlInput(page).fill("");
  await expect(urlField(page).getByTestId("ui-field-error")).toContainText(
    "Completá la URL pública.",
  );
  await expect(urlInput(page)).toHaveAttribute("aria-invalid", "true");
  await expect(page.getByTestId("ui-inline-error")).toHaveCount(0);
  await expect.poll(() => storedBaseUrl(page)).toBe(initialUrl);

  // Inválida: error inline sin commit.
  await urlInput(page).fill("sin-protocolo");
  await expect(urlField(page).getByTestId("ui-field-error")).toContainText(
    "Ingresá una URL válida con http(s).",
  );
  await expect(urlInput(page)).toHaveAttribute("aria-invalid", "true");
  await expect.poll(() => storedBaseUrl(page)).toBe(initialUrl);

  // Válida: se commitea y el error desaparece.
  await urlInput(page).fill(NEW_BASE_URL);
  await expect(urlField(page).getByTestId("ui-field-error")).toHaveCount(0);
  await expect(urlInput(page)).not.toHaveAttribute("aria-invalid", "true");
  await expect.poll(() => storedBaseUrl(page)).toBe(NEW_BASE_URL);

  // Datos: persiste tras recargar la app (IndexedDB).
  await flushSave(page);
  await page.reload();
  await expect(page.getByRole("heading", { name: "Tus tiendas" })).toBeVisible();
  await openDemoStore(page);
  await openResumenTab(page);
  await expect(urlInput(page)).toHaveValue(NEW_BASE_URL);
});

test("Slug interno: identidad de solo lectura, validada por el schema (no editable)", async ({
  page,
}) => {
  await resetIndexedDb(page);
  await openDemoStore(page);
  await openResumenTab(page);

  // El slug de la tienda demo se asignó al crearla (identidad, no contenido).
  await expect(slugInput(page)).toHaveValue("demo-catalogo-jerarquico");
  await expect(slugInput(page)).toHaveAttribute("readonly", "");
  await expect(slugInput(page)).toHaveAttribute("aria-readonly", "true");
  await expect(
    domainSection(page).getByText(
      "La exportación de producción usa esta URL para canonical y feeds.",
    ),
  ).toBeVisible();

  // El contrato del schema: patrón ^[a-z0-9]+(?:-[a-z0-9]+)*$ (SlugSchema).
  expect(SlugSchema.safeParse("demo-catalogo-jerarquico").success).toBe(true);
  expect(SlugSchema.safeParse("otra-identidad-interna").success).toBe(true);
  expect(SlugSchema.safeParse("Con Espacios").success).toBe(false);
  expect(SlugSchema.safeParse("Mayuscula").success).toBe(false);
  expect(SlugSchema.safeParse("guion_inicial").success).toBe(false);
});

test("Auditoría: subcarpeta en la URL pública advierte domain.baseurl-path y http advierte domain.https", async ({
  page,
}) => {
  await resetIndexedDb(page);
  await openDemoStore(page);
  await openResumenTab(page);

  const openSeoTab = async () => {
    await page.getByRole("tab", { name: "SEO", exact: true }).click();
    await expect(page.getByTestId("ui-seo-checklist")).toBeVisible();
  };
  const urlAlert = (code: string) =>
    page.locator(`[data-testid="ui-seo-check-item"][data-issue-id="${code}"]`);

  // Subcarpeta: la URL es válida para el schema y commitea, pero la auditoría
  // advierte que rompe los assets root-relativos.
  await urlInput(page).fill(SUBFOLDER_BASE_URL);
  await expect(urlField(page).getByTestId("ui-field-error")).toHaveCount(0);
  await expect.poll(() => storedBaseUrl(page)).toBe(SUBFOLDER_BASE_URL);
  await openSeoTab();
  await expect(urlAlert("domain.baseurl-path")).toBeVisible();
  await expect(
    page
      .locator(".audit-item--warning")
      .filter({ hasText: "una baseUrl con subcarpeta rompe los assets" }),
  ).toBeVisible();

  // HTTP: crítico de auditoría (el export de producción queda bloqueado).
  await page.getByRole("tab", { name: "Resumen", exact: true }).click();
  await urlInput(page).fill(HTTP_BASE_URL);
  await expect.poll(() => storedBaseUrl(page)).toBe(HTTP_BASE_URL);
  await openSeoTab();
  await expect(urlAlert("domain.https")).toBeVisible();
  await expect(
    page.locator(".audit-item--error").filter({ hasText: "debe usar HTTPS" }),
  ).toBeVisible();
  await expect(urlAlert("domain.baseurl-path")).toHaveCount(0);

  // Restaurar una URL raíz HTTPS: ambos hallazgos desaparecen.
  await page.getByRole("tab", { name: "Resumen", exact: true }).click();
  await urlInput(page).fill("https://modo-sur.example");
  await expect.poll(() => storedBaseUrl(page)).toBe("https://modo-sur.example");
  await openSeoTab();
  await expect(urlAlert("domain.https")).toHaveCount(0);
  await expect(urlAlert("domain.baseurl-path")).toHaveCount(0);
});

test("utilidad: la URL pública nueva reescribe canonical, sitemap, JSON-LD, robots y feeds (diff ANTES/DESPUÉS)", async ({
  page,
}) => {
  // Sanity del estado ANTES: el sitio de la fixture usa el host original.
  const beforeHome = beforeText.get("index.html") ?? "";
  expect(beforeHome).toContain(`<link rel="canonical" href="${OLD_HOST}/">`);
  expect(beforeText.get("sitemap.xml") ?? "").toContain(`<loc>${OLD_HOST}/</loc>`);
  expect(beforeText.get("robots.txt") ?? "").toContain(`Sitemap: ${OLD_HOST}/sitemap.xml`);

  // DESPUÉS: canonical y og:url apuntan al dominio nuevo.
  const afterHome = afterText.get("index.html") ?? "";
  expect(afterHome).toContain(`<link rel="canonical" href="${NEW_BASE_URL}/">`);
  expect(afterHome).toContain(`<meta property="og:url" content="${NEW_BASE_URL}/">`);

  // JSON-LD: WebSite y OnlineStore usan la URL nueva (normalizada sin slash).
  const scripts = [
    ...afterHome.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g),
  ].map((match) => JSON.parse(match[1]) as Record<string, unknown>);
  const website = scripts.find((data) => data["@type"] === "WebSite");
  const store = scripts.find((data) => data["@type"] === "OnlineStore");
  expect(website?.url).toBe(NEW_BASE_URL);
  expect(store?.url).toBe(NEW_BASE_URL);

  // sitemap, robots y feeds: dominio nuevo.
  expect(afterText.get("sitemap.xml") ?? "").toContain(`<loc>${NEW_BASE_URL}/</loc>`);
  expect(afterText.get("robots.txt") ?? "").toContain(`Sitemap: ${NEW_BASE_URL}/sitemap.xml`);
  expect(afterText.get("google-merchant.xml") ?? "").toContain(`${NEW_BASE_URL}/productos/`);
  expect(afterText.get("image-sitemap.xml") ?? "").toContain(`${NEW_BASE_URL}/`);

  // Ningún archivo que usaba el host viejo lo conserva tras el cambio.
  let swept = 0;
  for (const [path, text] of afterText) {
    if (beforeText.get(path)?.includes(OLD_HOST)) {
      expect(text, `host viejo en ${path}`).not.toContain(OLD_HOST);
      swept += 1;
    }
  }
  expect(swept).toBeGreaterThanOrEqual(6);
  void page;
});

test("utilidad: el slug interno no aparece en el sitio exportado (diff vacío entre slugs)", async ({
  page,
}) => {
  // El slug nuevo no llega a ningún archivo del sitio: es identidad interna.
  for (const [path, text] of otherSlugText) {
    expect(text, `slug nuevo en ${path}`).not.toContain("otra-identidad-interna");
  }

  // Los archivos del sitio son idénticos con cualquier slug: mismo set y contenido.
  expect(otherSlugText.size).toBe(beforeText.size);
  const otherSlugFiles = [...otherSlugText.entries()];
  for (const [path, text] of otherSlugFiles) {
    expect(beforeText.get(path), `contenido distinto en ${path}`).toBe(text);
  }
  void page;
});
