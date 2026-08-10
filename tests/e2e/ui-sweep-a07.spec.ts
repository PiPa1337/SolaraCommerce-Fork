import type { Server } from "node:http";
import { expect, type Page, test } from "@playwright/test";
import { createCleanStore } from "./project-helpers";
import { startStudioServer, stopStudioServer } from "./studio-server";

/**
 * A07 — Barrido del flujo guiado del resumen (OWNER: features/Overview.tsx).
 * Contrato de 3 capas sobre los controles guiados de Resumen:
 *  (1) edición → commit real en el proyecto (verificado en IndexedDB);
 *  (2) auto-feedback: indicador de guardado (aria-live), errores inline
 *      (aria-invalid + role=alert), acordeones (aria-expanded), switches
 *      (aria-checked), pestaña activa (aria-selected) y progreso guiado
 *      (progressbar + aria-valuenow);
 *  (3) datos: payload del campo → ruta del schema (identity.brandName,
 *      whatsapp.phone, navigation.catalogLabel, pages.title, ...).
 * Incluye la regresión del borrador inválido que otro commit destruía y el
 * toggle guiado/manual (Modo avanzado): la vista cambia y el estado persiste.
 */

test.setTimeout(process.env.CI ? 60_000 : 30_000);

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
  // El arranque del dashboard compite con otros workers del barrido: dar
  // presupuesto de boot sin relajar la aserción (es dura, sólo más paciente).
  await expect(page.getByRole("heading", { name: "Tus tiendas" })).toBeVisible({
    timeout: 20_000,
  });
  await createCleanStore(page, name);
}

async function openStudioTab(page: Page, tab: string): Promise<void> {
  await page.getByRole("tab", { name: tab, exact: true }).click();
}

async function expectSaved(page: Page): Promise<void> {
  await expect(page.getByTestId("ui-save-indicator")).toContainText("Cambios guardados", {
    timeout: 5_000,
  });
}

async function expectUnsaved(page: Page): Promise<void> {
  await expect(page.getByTestId("ui-save-indicator")).toContainText("Sin guardar", {
    timeout: 5_000,
  });
}

/** Error inline por su texto exacto: en Resumen conviven varios errores
 *  (p. ej. el WhatsApp pendiente de una tienda limpia siempre está presente). */
function fieldError(page: Page, text: string) {
  return page.getByTestId("ui-field-error").filter({ hasText: text });
}

interface StoredRecord {
  name: string;
  project: {
    name: string;
    baseUrl?: string;
    identity: { brandName?: string; description?: string; email?: string };
    whatsapp: { phone?: string; includeSku?: boolean };
    navigation: {
      catalogLabel?: string;
      items?: Array<{ id: string; label?: string }>;
    };
    pages: Array<{ kind: string; title: string; seoTitle?: string }>;
  };
}

/** Lee el proyecto autoservado en IndexedDB (receptor del payload commiteado).
 *  El registro se re-guarda con el nombre del proyecto: buscarlo por
 *  `project.name` (no por la tienda de origen, que puede haberse renombrado). */
async function readStoredProject(page: Page, projectName: string): Promise<StoredRecord | null> {
  return page.evaluate(
    ([name]) =>
      new Promise<StoredRecord | null>((resolve, reject) => {
        const request = indexedDB.open("solara-commerce-studio");
        request.addEventListener("error", () => reject(request.error));
        request.addEventListener("success", () => {
          const db = request.result;
          const all = db.transaction("projects").objectStore("projects").getAll();
          all.addEventListener("success", () => {
            const records = all.result as StoredRecord[];
            resolve(records.find((record) => record.project.name === name) ?? null);
          });
          all.addEventListener("error", () => reject(all.error));
        });
      }),
    [projectName],
  );
}

async function progressValue(page: Page): Promise<number> {
  const value = await page.getByTestId("ui-guided-progress").getAttribute("aria-valuenow");
  return Number(value ?? NaN);
}

function pageEditor(page: Page, kind: string) {
  return page.locator(".page-editor", { hasText: kind });
}

test("los campos guiados commitean, dan feedback de guardado y persisten (capa 1+2+3)", async ({
  page,
}) => {
  const storeName = "Tienda Aurora";
  await setupCleanStore(page, storeName);

  await openStudioTab(page, "Resumen");
  await expectSaved(page);

  // Nombre de la tienda → project.name + identity.brandName. Se escribe un
  // valor DISTINTO al de creación: el input commitea sólo ante un cambio real.
  const nameInput = page.getByLabel("Nombre de la tienda", { exact: true });
  await nameInput.fill("Aurora Commerce");
  await expectUnsaved(page);
  await expectSaved(page);

  // Descripción, email, WhatsApp y catálogo → rutas del schema.
  await page.getByLabel("Descripción", { exact: true }).fill("Indumentaria pensada para la ciudad.");
  await page.getByLabel("Email", { exact: true }).fill("hola@aurora.example");
  await page.getByLabel("Número internacional", { exact: true }).fill("5491123456789");
  await page.getByLabel("Nombre del catálogo", { exact: true }).fill("La Colección");
  await expectSaved(page);

  // Ida y vuelta de pestañas: el valor visible persiste (receptor = historial validado).
  await openStudioTab(page, "Preparar");
  await openStudioTab(page, "Resumen");
  await expect(nameInput).toHaveValue("Aurora Commerce");
  await expect(page.getByLabel("Descripción", { exact: true })).toHaveValue(
    "Indumentaria pensada para la ciudad.",
  );
  await expect(page.getByLabel("Email", { exact: true })).toHaveValue("hola@aurora.example");
  await expect(page.getByLabel("Número internacional", { exact: true })).toHaveValue(
    "5491123456789",
  );
  await expect(page.getByLabel("Nombre del catálogo", { exact: true })).toHaveValue("La Colección");

  // Capa 3: el payload commiteado llega al proyecto autoservado (bajo project).
  await expect
    .poll(async () => readStoredProject(page, "Aurora Commerce"), { timeout: 15_000 })
    .toMatchObject({
      project: {
        name: "Aurora Commerce",
        identity: {
          brandName: "Aurora Commerce",
          description: "Indumentaria pensada para la ciudad.",
          email: "hola@aurora.example",
        },
        whatsapp: { phone: "5491123456789" },
        navigation: { catalogLabel: "La Colección" },
      },
    });
});

test("el borrador inválido de un campo sobrevive al commit de otro campo (regresión)", async ({
  page,
}) => {
  await setupCleanStore(page, "Tienda borrador inválido");

  await openStudioTab(page, "Resumen");

  // Email inválido: queda como borrador sin commitear y muestra su error.
  const emailInput = page.getByLabel("Email", { exact: true });
  await emailInput.fill("abc@");
  await expect(emailInput).toHaveValue("abc@");
  await expect(fieldError(page, "Ingresá un email válido.")).toBeVisible();

  // Un commit de OTRO campo no debe destruir el borrador pendiente.
  await page.getByLabel("Descripción", { exact: true }).fill("Descripción que sí commitea");
  await expect(emailInput).toHaveValue("abc@");
  await expect(fieldError(page, "Ingresá un email válido.")).toBeVisible();

  // Corrección: el campo válido commitea y el error desaparece.
  await emailInput.fill("hola@aurora.example");
  await expect(emailInput).toHaveValue("hola@aurora.example");
  await expect(fieldError(page, "Ingresá un email válido.")).toHaveCount(0);
});

test("los vacíos de campos obligatorios dan error inline sin rechazo global (regresión B1)", async ({
  page,
}) => {
  await setupCleanStore(page, "Tienda vacíos B1");

  await openStudioTab(page, "Resumen");

  // Label de enlace: vaciarlo no commitea y avisa en el campo, sin InlineError global.
  await page.getByRole("button", { name: "Añadir enlace de catálogo" }).click();
  const item = page.locator(".navigation-editor-item").first();
  const labelInput = item.getByLabel("Enlace 1", { exact: true });
  await labelInput.fill("Mi enlace");
  await expect(labelInput).toHaveValue("Mi enlace");
  await labelInput.fill("");
  await expect(item.getByTestId("ui-field-error")).toContainText(
    "Completá el nombre del enlace.",
  );
  await expect(page.getByTestId("ui-inline-error")).toHaveCount(0);
  await expect
    .poll(
      async () =>
        (await readStoredProject(page, "Tienda vacíos B1"))?.project.navigation.items?.[0]?.label,
      { timeout: 15_000 },
    )
    .toBe("Mi enlace");

  // URL pública: el vacío conserva el valor previo commiteado y avisa en el campo.
  const urlInput = page.getByLabel("URL pública", { exact: true });
  const initialUrl = await urlInput.inputValue();
  expect(initialUrl).toMatch(/^https:\/\/.*\.example$/);
  await urlInput.fill("");
  await expect(
    page.locator('[data-accordion-id="domain"]').getByTestId("ui-field-error"),
  ).toContainText("Completá la URL pública.");
  await expect(page.getByTestId("ui-inline-error")).toHaveCount(0);
  await expect
    .poll(
      async () => (await readStoredProject(page, "Tienda vacíos B1"))?.project.baseUrl,
      { timeout: 15_000 },
    )
    .toBe(initialUrl);

  // Título SEO: el vacío no commitea y conserva el valor previo en el proyecto.
  const homeEditor = page.locator(".page-editor", { hasText: "Home" });
  const seoInput = homeEditor.getByLabel("Título SEO", { exact: true });
  const seoInitial = await seoInput.inputValue();
  await seoInput.fill("");
  await expect(homeEditor.getByTestId("ui-field-error")).toContainText(
    "Completá el título SEO.",
  );
  await expect(page.getByTestId("ui-inline-error")).toHaveCount(0);
  await expect
    .poll(
      async () =>
        (await readStoredProject(page, "Tienda vacíos B1"))?.project.pages.find(
          (p) => p.kind === "home",
        )?.seoTitle,
      { timeout: 15_000 },
    )
    .toBe(seoInitial);
});

test("el progreso guiado anuncia por aria-live, sube al completar y marca el paso activo", async ({
  page,
}) => {
  await setupCleanStore(page, "Tienda progreso guiado");

  await openStudioTab(page, "Preparar");
  await expect(page.getByRole("heading", { name: "Preparar tienda" })).toBeVisible();

  // Auto-feedback del progreso: output aria-live + progressbar 0..100.
  const progress = page.getByTestId("ui-guided-progress");
  await expect(progress).toHaveAttribute("role", "progressbar");
  await expect(progress).toHaveAttribute("aria-valuemin", "0");
  await expect(progress).toHaveAttribute("aria-valuemax", "100");
  await expect(page.locator("output.guided-progress")).toHaveAttribute("aria-live", "polite");
  const initialProgress = await progressValue(page);
  expect(Number.isFinite(initialProgress)).toBe(true);

  // "Siguiente" lleva al área del primer requisito pendiente y marca la pestaña activa.
  const nextButton = page.getByTestId("ui-guided-next");
  await expect(nextButton).toContainText("Siguiente:");
  await nextButton.click();
  await expect(page.getByRole("heading", { name: "Resumen", exact: true })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Resumen", exact: true })).toHaveAttribute(
    "aria-selected",
    "true",
  );

  // Completar un requisito crítico (WhatsApp) desde el campo guiado.
  const phoneInput = page.getByLabel("Número internacional", { exact: true });
  await phoneInput.fill("5491123456789");
  await expect(phoneInput).toHaveValue("5491123456789");

  // El checklist lo marca listo y el progreso sube.
  await openStudioTab(page, "Preparar");
  await expect(
    page.locator('[data-requirement-id="identity.whatsapp"]'),
  ).toHaveAttribute("data-requirement-status", "ready");
  await expect(page.getByText(/\d+ de \d+ requisitos listos/)).toBeVisible();
  await expect.poll(async () => progressValue(page)).toBeGreaterThan(initialProgress);
});

test("los acordeones y switches reflejan su estado y persisten (capa 2)", async ({ page }) => {
  await setupCleanStore(page, "Tienda acordeones");

  await openStudioTab(page, "Resumen");

  // Acordeón de identidad: aria-expanded coherente y panel oculto/visible.
  const identityToggle = page.getByRole("button", { name: "Identidad", exact: true });
  await expect(identityToggle).toHaveAttribute("aria-expanded", "true");
  const identityPanel = page.locator('[data-accordion-id="identity"] .overview-accordion__panel');
  await expect(identityPanel).toBeVisible();
  await identityToggle.click();
  await expect(identityToggle).toHaveAttribute("aria-expanded", "false");
  await expect(identityPanel).toBeHidden();
  await identityToggle.click();
  await expect(identityToggle).toHaveAttribute("aria-expanded", "true");
  await expect(identityPanel).toBeVisible();

  // Switches: la plantilla limpia arranca con includeSku y búsqueda activados;
  // alternar refleja aria-checked y el cambio persiste entre pestañas.
  // Nota: los nombres usan exact:true — "Mostrar carrito" es substring de
  // "Mostrar carrito lateral" y getByRole matchea por substring por defecto.
  const skuSwitch = page.getByRole("switch", { name: "Incluir SKU en el mensaje", exact: true });
  const searchSwitch = page.getByRole("switch", { name: "Mostrar búsqueda", exact: true });
  const cartSwitch = page.getByRole("switch", { name: "Mostrar carrito", exact: true });
  await expect(skuSwitch).toHaveAttribute("aria-checked", "true");
  await expect(searchSwitch).toHaveAttribute("aria-checked", "true");
  await skuSwitch.click();
  await searchSwitch.click();
  await expect(skuSwitch).toHaveAttribute("aria-checked", "false");
  await expect(searchSwitch).toHaveAttribute("aria-checked", "false");

  await openStudioTab(page, "Preparar");
  await openStudioTab(page, "Resumen");
  await expect(skuSwitch).toHaveAttribute("aria-checked", "false");
  await expect(searchSwitch).toHaveAttribute("aria-checked", "false");
  await expect(cartSwitch).toHaveAttribute("aria-checked", "true");
});

test("el editor de navegación valida destinos, reordena y borra con confirmación", async ({
  page,
}) => {
  await setupCleanStore(page, "Tienda navegación");

  await openStudioTab(page, "Resumen");

  const addLinkButton = page.getByRole("button", { name: "Añadir enlace de catálogo" });
  await addLinkButton.click();
  await addLinkButton.click();

  const firstItem = page.locator(".navigation-editor-item").nth(0);
  const secondItem = page.locator(".navigation-editor-item").nth(1);

  // Destino válido: commitea al salir del campo.
  await firstItem.getByLabel("Enlace 1", { exact: true }).fill("Colección Nueva");
  const firstDestination = firstItem.getByLabel("Destino", { exact: true });
  await firstDestination.fill("https://ejemplo.com/tienda");
  await firstDestination.press("Tab");

  // Destino inválido: error visible (acotado a este ítem) y borrador conservado al salir.
  const secondDestination = secondItem.getByLabel("Destino", { exact: true });
  await secondDestination.fill("no es una url");
  await expect(secondItem.getByTestId("ui-field-error")).toContainText(
    "Usá http(s) o una ruta interna",
  );
  await secondDestination.press("Tab");
  await expect(secondDestination).toHaveValue("no es una url");
  await expect(secondItem.getByTestId("ui-field-error")).toContainText(
    "Usá http(s) o una ruta interna",
  );

  // Reordenar: los botones mueven el ítem y reflejan límites con disabled.
  await expect(
    firstItem.getByRole("button", { name: "Mover Colección Nueva arriba" }),
  ).toBeDisabled();
  await firstItem.getByRole("button", { name: "Mover Colección Nueva abajo" }).click();
  await expect(firstItem.getByLabel("Enlace 1", { exact: true })).toHaveValue("Nueva categoría");
  await expect(secondItem.getByLabel("Enlace 2", { exact: true })).toHaveValue("Colección Nueva");

  // El destino válido persiste tras el reorden y el cambio de pestaña.
  await expect(secondItem.getByLabel("Destino", { exact: true })).toHaveValue(
    "https://ejemplo.com/tienda",
  );
  await openStudioTab(page, "Preparar");
  await openStudioTab(page, "Resumen");
  await expect(page.locator(".navigation-editor-item").nth(1).getByLabel("Destino", { exact: true }))
    .toHaveValue("https://ejemplo.com/tienda");

  // Borrar un ítem sin subenlaces es directo (sin diálogo).
  const itemWithoutChildren = page.locator(".navigation-editor-item").nth(0);
  await itemWithoutChildren.getByRole("button", { name: "Eliminar enlace Nueva categoría" }).click();
  await expect(page.getByTestId("ui-confirm-dialog")).toHaveCount(0);
  await expect(page.locator(".navigation-editor-item")).toHaveCount(1);

  // Con subenlaces pide confirmación: cancelar conserva, aceptar elimina.
  const remainingItem = page.locator(".navigation-editor-item").nth(0);
  await remainingItem.getByRole("button", { name: "Añadir subenlace" }).click();
  await expect(remainingItem.getByLabel("Subenlace 1", { exact: true })).toBeVisible();
  await remainingItem
    .getByRole("button", { name: "Eliminar enlace Colección Nueva" })
    .click();
  await expect(page.getByTestId("ui-confirm-dialog")).toBeVisible();
  await page.getByRole("button", { name: "Cancelar", exact: true }).click();
  await expect(page.locator(".navigation-editor-item")).toHaveCount(1);
  await remainingItem
    .getByRole("button", { name: "Eliminar enlace Colección Nueva" })
    .click();
  await page.getByTestId("ui-confirm-accept").click();
  await expect(page.locator(".navigation-editor-item")).toHaveCount(0);
});

test("las páginas editoriales persisten títulos y cuentan el SEO (capa 2+3)", async ({ page }) => {
  await setupCleanStore(page, "Tienda páginas");

  await openStudioTab(page, "Resumen");

  const homeEditor = pageEditor(page, "Home");
  const homeTitle = homeEditor.getByLabel("Título visible", { exact: true });
  await homeTitle.fill("Aurora en casa");
  await expectSaved(page);

  // El título vacío da error inline (aria-invalid + role=alert), acotado a la página.
  await homeTitle.fill("");
  await expect(homeEditor.getByTestId("ui-field-error")).toContainText(
    "Completá el título visible.",
  );
  await homeTitle.fill("Aurora en casa");

  // Contadores SEO: hint del campo refleja el largo efectivo.
  const homeSeoTitle = homeEditor.getByLabel("Título SEO", { exact: true });
  const homeSeoDescription = homeEditor.getByLabel("Descripción SEO", { exact: true });
  await homeSeoTitle.fill("A".repeat(70));
  await expect(homeEditor.getByText("70/70 caracteres")).toBeVisible();
  await homeSeoDescription.fill("B".repeat(180));
  await expect(homeEditor.getByText("180/180 caracteres")).toBeVisible();

  // Persistencia: el título visible y el SEO viajan en el proyecto.
  await openStudioTab(page, "Preparar");
  await openStudioTab(page, "Resumen");
  await expect(homeTitle).toHaveValue("Aurora en casa");
  await expect(homeSeoTitle).toHaveValue("A".repeat(70));
  await expect(homeSeoDescription).toHaveValue("B".repeat(180));
});

test("el toggle guiado/manual cambia la vista y persiste el estado", async ({ page }) => {
  await setupCleanStore(page, "Tienda modo");

  // Vista guiada: Constructor protegido (base limpia) hasta activar Modo avanzado.
  await openStudioTab(page, "Preparar");
  await expect(page.getByRole("heading", { name: "Preparar tienda" })).toBeVisible();
  await openStudioTab(page, "Constructor");
  await expect(page.getByRole("button", { name: "Agregar sección" })).toBeDisabled();

  // Manual: "Modo avanzado" abre Constructor, marca la pestaña y desprotege la base.
  await openStudioTab(page, "Preparar");
  await page.getByRole("button", { name: "Modo avanzado" }).click();
  await expect(page.getByRole("tab", { name: "Constructor", exact: true })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect(page.getByRole("button", { name: "Agregar sección" })).toBeEnabled();

  // El estado persiste al recorrer otras pestañas (no se resetea al salir).
  await openStudioTab(page, "Resumen");
  await openStudioTab(page, "Constructor");
  await expect(page.getByRole("button", { name: "Agregar sección" })).toBeEnabled();

  // Volver al flujo guiado restaura la vista guiada y la protección de la base.
  await openStudioTab(page, "Preparar");
  await expect(page.getByRole("heading", { name: "Preparar tienda" })).toBeVisible();
  await openStudioTab(page, "Constructor");
  await expect(page.getByRole("button", { name: "Agregar sección" })).toBeDisabled();
});
