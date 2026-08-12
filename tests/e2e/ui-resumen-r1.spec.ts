/**
 * Auditoría Resumen R1 (2026-08-10) — Campos de Identidad del tab Resumen.
 * Contrato de 4 capas (plan docs/superpowers/plans/2026-08-10-auditoria-resumen.md):
 * - funcional + auto-feedback: nombre y email validan en vivo con errores
 *   inline (aria-invalid + role=alert) y sólo commitean valores válidos;
 * - datos: cada campo commitea a su ruta del schema y persiste tras recargar
 *   la app (IndexedDB);
 * - utilidad: el proyecto guardado en el Studio (leído de IndexedDB, el mismo
 *   receptor del payload) se exporta con exportProject() ANTES y DESPUÉS de
 *   editar, y el valor debe aparecer en los consumidores del sitio exportado:
 *   footer (marca/email/teléfono), JSON-LD del negocio, páginas Contacto y
 *   Nosotros, feed Merchant y meta description. Campos que no llegan al sitio
 *   son hallazgos de dead-field con evidencia.
 */
import type { Server } from "node:http";
import { expect, type Page, test } from "@playwright/test";
import { exportProject } from "@solara/exporter";
import type { StoreProjectV1 } from "@solara/project-schema";
import { startStudioServer, stopStudioServer } from "./studio-server";

test.setTimeout(process.env.CI ? 180_000 : 120_000);

/** Valores sentinel R1: difieren de todos los valores de la tienda demo. */
const VALUES = {
  name: "R1 Marca Aurora",
  legalName: "R1 Aurora Estudio SRL",
  description: "R1 Descripción de la marca auditada.",
  email: "r1@aurora.example",
  phone: "5491199990000",
  address: "R1 Calle Auditada 1234",
} as const;

/** Los valores originales de la tienda demo (catalogModernStore). */
const ORIGINAL = {
  name: "Modo Sur",
  legalName: "Modo Sur Estudio SRL",
  description: "Indumentaria y accesorios elegidos para acompañar tu forma de moverte.",
  email: "hola@modo-sur.example",
  phone: "5491123456789",
  address: "Buenos Aires, Argentina",
} as const;

interface StoredProjectRecord {
  name: string;
  project: StoreProjectV1;
}

interface ExportedSite {
  files: ReadonlyMap<string, string | Uint8Array>;
}

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
  await expect(page.getByRole("heading", { name: "Tus tiendas" })).toBeVisible({
    timeout: 20_000,
  });
}

async function openDemoStore(page: Page): Promise<void> {
  await page.locator('[data-store-card-id="store-modo-sur-demo"]').click();
  await page.getByRole("button", { name: "Abrir tienda", exact: true }).click();
  await expect(page.getByRole("navigation", { name: "Áreas de la tienda" })).toBeVisible({
    timeout: 30_000,
  });
}

async function openResumenTab(page: Page): Promise<void> {
  await page.getByRole("tab", { name: "Resumen", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Resumen", exact: true })).toBeVisible();
}

async function expectSaved(page: Page): Promise<void> {
  await expect(page.getByTestId("ui-save-indicator")).toContainText("Cambios guardados", {
    timeout: 5_000,
  });
}

/** Guardado del modo navegador: flush del autosave con Ctrl+S y aviso "Guardado". */
async function flushSave(page: Page): Promise<void> {
  await page.keyboard.press("Control+s");
  await expect(page.locator(".save-indicator")).toContainText("Guardado", { timeout: 30_000 });
}

/** Error inline por su texto exacto: en Resumen conviven varios errores. */
function fieldError(page: Page, text: string) {
  return page.getByTestId("ui-field-error").filter({ hasText: text });
}

/** El proyecto autoservado en IndexedDB, receptor del payload commiteado.
 *  La tienda demo vive bajo su id `store-modo-sur-demo` (su `name` inicial es
 *  "Predeterminado", aunque su brandName sea "Modo Sur"). */
async function readStoredProject(page: Page): Promise<StoreProjectV1 | null> {
  const record = await page.evaluate(
    () =>
      new Promise<StoredProjectRecord | null>((resolve, reject) => {
        const request = indexedDB.open("solara-commerce-studio");
        request.addEventListener("error", () => reject(request.error));
        request.addEventListener("success", () => {
          const db = request.result;
          const found = db
            .transaction("projects")
            .objectStore("projects")
            .get("store-modo-sur-demo");
          found.addEventListener("error", () => reject(found.error));
          found.addEventListener("success", () => {
            resolve((found.result as StoredProjectRecord | undefined) ?? null);
          });
        });
      }),
  );
  return record?.project ?? null;
}

function fileText(exported: ExportedSite, path: string): string {
  const content = exported.files.get(path);
  if (content === undefined) throw new Error(`El sitio exportado no contiene ${path}`);
  return typeof content === "string" ? content : new TextDecoder().decode(content);
}

function metaDescription(html: string): string {
  const match = /<meta name="description" content="([^"]*)"/.exec(html);
  return match?.[1] ?? "";
}

function identityInputs(page: Page) {
  return {
    name: page.getByLabel("Nombre de la tienda", { exact: true }),
    legalName: page.getByLabel("Razón social", { exact: true }),
    description: page.getByLabel("Descripción", { exact: true }),
    email: page.getByLabel("Email", { exact: true }),
    phone: page.getByLabel("Teléfono", { exact: true }),
    address: page.getByLabel("Dirección", { exact: true }),
  };
}

async function fillIdentity(page: Page): Promise<void> {
  const inputs = identityInputs(page);
  await inputs.name.fill(VALUES.name);
  await inputs.legalName.fill(VALUES.legalName);
  await inputs.description.fill(VALUES.description);
  await inputs.email.fill(VALUES.email);
  await inputs.phone.fill(VALUES.phone);
  await inputs.address.fill(VALUES.address);
  await expectSaved(page);
}

test("nombre y email validan en vivo con errores inline y sólo commitean valores válidos (R1)", async ({
  page,
}) => {
  await resetIndexedDb(page);
  await openDemoStore(page);
  await openResumenTab(page);

  // Nombre vacío → error inline "Completá el nombre de la tienda." sin commit.
  const nameInput = identityInputs(page).name;
  await nameInput.fill("");
  await expect(nameInput).toHaveAttribute("aria-invalid", "true");
  await expect(fieldError(page, "Completá el nombre de la tienda.")).toBeVisible();

  await nameInput.fill(VALUES.name);
  await expect(nameInput).not.toHaveAttribute("aria-invalid", "true");
  await expect(fieldError(page, "Completá el nombre de la tienda.")).toHaveCount(0);
  await expect(nameInput).toHaveValue(VALUES.name);

  // Razón social vacía → el borrador queda visible, el error se asocia al
  // campo y el proyecto confirmado conserva el valor anterior.
  const legalNameInput = identityInputs(page).legalName;
  await legalNameInput.fill("");
  await expect(legalNameInput).toHaveAttribute("aria-invalid", "true");
  const legalNameError = fieldError(page, "Completá la razón social.");
  await expect(legalNameError).toBeVisible();
  const legalNameDescribedBy = await legalNameInput.getAttribute("aria-describedby");
  expect(legalNameDescribedBy).toContain(await legalNameError.getAttribute("id"));
  await expect
    .poll(async () => readStoredProject(page), { timeout: 15_000 })
    .toMatchObject({
      identity: { legalName: ORIGINAL.legalName },
    });

  await legalNameInput.fill(VALUES.legalName);
  await expect(legalNameInput).not.toHaveAttribute("aria-invalid", "true");
  await expect(fieldError(page, "Completá la razón social.")).toHaveCount(0);

  // Email inválido → error inline "Ingresá un email válido." y borrador sin commit.
  const emailInput = identityInputs(page).email;
  await emailInput.fill("r1-invalido");
  await expect(emailInput).toHaveAttribute("aria-invalid", "true");
  await expect(fieldError(page, "Ingresá un email válido.")).toBeVisible();
  await expect.poll(async () => readStoredProject(page), { timeout: 15_000 }).not.toBeNull();
  expect((await readStoredProject(page))?.identity.email).toBe(ORIGINAL.email);

  await emailInput.fill(VALUES.email);
  await expect(emailInput).not.toHaveAttribute("aria-invalid", "true");
  await expect(fieldError(page, "Ingresá un email válido.")).toHaveCount(0);
  await expectSaved(page);

  // El payload válido llega al proyecto autoservado (capa de datos).
  await expect
    .poll(async () => readStoredProject(page), { timeout: 15_000 })
    .toMatchObject({
      name: VALUES.name,
      identity: { brandName: VALUES.name, email: VALUES.email },
    });
});

test("identidad completa: persiste tras recarga y cada campo llega al sitio exportado (R1)", async ({
  page,
}) => {
  await resetIndexedDb(page);
  await openDemoStore(page);
  await openResumenTab(page);

  // ANTES: el proyecto demo autoservado se exporta y sirve de línea de base.
  const storeBefore = await readStoredProject(page);
  expect(storeBefore).not.toBeNull();
  expect(storeBefore?.identity.brandName).toBe(ORIGINAL.name);
  const before = exportProject(storeBefore as StoreProjectV1, { mode: "production" });
  const beforeHome = fileText(before, "index.html");
  expect(beforeHome).toMatch(new RegExp(`© \\d{4} ${ORIGINAL.name}`));
  expect(beforeHome).toContain(`mailto:${ORIGINAL.email}`);
  expect(beforeHome).toContain(`tel:${ORIGINAL.phone}`);
  for (const value of Object.values(VALUES)) {
    expect(beforeHome).not.toContain(value);
  }

  // Edición real de los 6 campos de Identidad con valores sentinel R1.
  await fillIdentity(page);

  // Preview: la marca y el contacto editados se ven en el iframe desktop.
  const previewBody = page.frameLocator('iframe[title="Vista previa desktop"]').locator("body");
  await expect(previewBody).toContainText(VALUES.name, { timeout: 15_000 });
  await expect(previewBody).toContainText(VALUES.email);
  await expect(previewBody).toContainText(VALUES.phone);

  await flushSave(page);

  // Persistencia: recargar la app y reabrir la tienda conserva los 6 campos.
  await page.reload();
  await expect(page.getByRole("heading", { name: "Tus tiendas" })).toBeVisible();
  const card = page.locator(".dashboard-store-card").filter({ hasText: VALUES.name }).first();
  await card.locator(".dashboard-store-card__button").click();
  await page.getByRole("button", { name: "Abrir tienda", exact: true }).click();
  await expect(page.getByRole("navigation", { name: "Áreas de la tienda" })).toBeVisible();
  await openResumenTab(page);
  const inputs = identityInputs(page);
  await expect(inputs.name).toHaveValue(VALUES.name);
  await expect(inputs.legalName).toHaveValue(VALUES.legalName);
  await expect(inputs.description).toHaveValue(VALUES.description);
  await expect(inputs.email).toHaveValue(VALUES.email);
  await expect(inputs.phone).toHaveValue(VALUES.phone);
  await expect(inputs.address).toHaveValue(VALUES.address);

  // DESPUÉS: el proyecto guardado (mismo receptor del payload) se exporta.
  const storeAfter = await readStoredProject(page);
  expect(storeAfter).not.toBeNull();
  const after = exportProject(storeAfter as StoreProjectV1, { mode: "production" });
  const home = fileText(after, "index.html");
  const about = fileText(after, "nosotros/index.html");
  const contact = fileText(after, "contacto/index.html");
  const feed = fileText(after, "google-merchant.xml");

  // 1. Nombre de la tienda → footer, og:site_name y JSON-LD (WebSite + OnlineStore).
  expect(home).toMatch(new RegExp(`© \\d{4} ${VALUES.name}`));
  expect(home).not.toMatch(new RegExp(`© \\d{4} ${ORIGINAL.name}`));
  expect(home).toContain(`content="${VALUES.name}"`);
  expect(home).toContain(`"name":"${VALUES.name}"`);
  expect(feed).toContain(`<title>${VALUES.name}</title>`);

  // 2. Razón social → JSON-LD OnlineStore.
  expect(home).toContain(`"legalName":"${VALUES.legalName}"`);

  // 3. Descripción → JSON-LD, cuerpo de la página Nosotros y feed Merchant.
  expect(home).toContain(`"description":"${VALUES.description}"`);
  expect(about).toContain(VALUES.description);
  expect(feed).toContain(`<description>${VALUES.description}</description>`);
  // Hallazgo documentado: NINGUNA meta description usa la Descripción de la
  // marca. La Home usa seo.description y la de Nosotros usa page.seoDescription
  // (exporter: index.ts:1305 y index.ts:1482/1499).
  expect(metaDescription(home)).toContain("Indumentaria y accesorios para todos los días");
  expect(metaDescription(home)).not.toContain(VALUES.description);
  expect(metaDescription(about)).toContain("Conocé la mirada detrás de Modo Sur");
  expect(metaDescription(about)).not.toContain(VALUES.description);

  // 4. Email → footer (mailto), página Contacto y JSON-LD.
  expect(home).toContain(`mailto:${VALUES.email}`);
  expect(home).toContain(`"email":"${VALUES.email}"`);
  expect(contact).toContain(`mailto:${VALUES.email}`);

  // 5. Teléfono → footer (tel:), página Contacto y JSON-LD. El JSON-LD del
  // negocio prefiere whatsapp.phone y cae a identity.phone (R2-1 resuelto en
  // Ola 3, exporter storeStructuredData); la demo no edita WhatsApp.
  expect(home).toContain(`tel:${VALUES.phone}`);
  expect(home).toContain(`"telephone":"${ORIGINAL.phone}"`);
  expect(contact).toContain(`tel:${VALUES.phone}`);

  // 6. Dirección → JSON-LD y página Contacto (el footer moderno no la muestra).
  expect(home).toContain(`"address":"${VALUES.address}"`);
  expect(contact).toContain("Dirección");
  expect(contact).toContain(VALUES.address);

  // El contacto completo también llega a la página Nosotros (Atención directa).
  expect(about).toContain(VALUES.email);
});
