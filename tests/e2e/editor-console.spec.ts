import type { Server } from "node:http";
import { type ConsoleMessage, expect, type Page, test } from "@playwright/test";
import { startStudioServer, stopStudioServer } from "./studio-server";

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

/**
 * Mensajes del driver GL de Chromium headless (SwiftShader, sin GPU física).
 * Se conservan por compatibilidad con builds antiguos que usaban WebGL2 en el
 * fondo del dashboard (eliminado: hoy es un gradiente estático); en un
 * navegador con GPU estos avisos no existen y no representan un bug del
 * editor. Se excluyen con patrones exactos y documentados.
 */
const HEADLESS_GL_DRIVER_PATTERNS = [
  /Automatic fallback to software WebGL has been deprecated/,
  /GL Driver Message \(OpenGL, Performance, GL_CLOSE_PATH_NV, High\): GPU stall due to ReadPixels/,
];

/** Registra pageerror y console error/warning para fallar al final del recorrido. */
function trackConsoleProblems(page: Page): string[] {
  const problems: string[] = [];
  page.on("pageerror", (error) => {
    problems.push(`pageerror: ${error.message}`);
  });
  page.on("console", (message: ConsoleMessage) => {
    if (message.type() !== "error" && message.type() !== "warning") return;
    if (HEADLESS_GL_DRIVER_PATTERNS.some((pattern) => pattern.test(message.text()))) return;
    problems.push(`${message.type()}: ${message.text()}`);
  });
  return problems;
}

async function openDemoStore(page: Page) {
  await page.goto(studioUrl);
  await expect(page.getByRole("heading", { name: "Tus tiendas" })).toBeVisible({
    timeout: 30_000,
  });
  await page
    .locator('article:has([data-store-card-id="store-modo-sur-demo"])')
    .getByRole("button", { name: "Abrir esta tienda" })
    .click();
  await expect(page.getByRole("navigation", { name: "Áreas de la tienda" })).toBeVisible();
}

test("el editor recorre dashboard, tabs y acciones clave sin errores de consola", async ({
  page,
}) => {
  test.setTimeout(180_000);
  const problems = trackConsoleProblems(page);
  await page.setViewportSize({ width: 1440, height: 900 });

  await openDemoStore(page);

  const tabs: Array<{ button: string; heading: string }> = [
    { button: "Preparar", heading: "Preparar tienda" },
    { button: "Resumen", heading: "Resumen" },
    { button: "Catálogo", heading: "Catálogo" },
    { button: "Constructor", heading: "Constructor" },
    { button: "Tema", heading: "Tema" },
    { button: "Recursos", heading: "Recursos" },
    { button: "SEO", heading: "SEO y Google" },
    { button: "Exportar", heading: "Exportar" },
  ];
  for (const { button, heading } of tabs) {
    await page.getByRole("tab", { name: button, exact: true }).click();
    await expect(page.getByRole("heading", { name: heading })).toBeVisible();
  }

  await page.getByRole("tab", { name: "Catálogo", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Catálogo" })).toBeVisible();
  await page
    .getByPlaceholder("Buscar por producto, marca o estado")
    .fill("Remera esencial de algodón");
  await expect(page.getByLabel("Nombre de Remera esencial de algodón")).toBeVisible();
  await page.getByPlaceholder("Buscar por producto, marca o estado").fill("");

  await page.getByRole("button", { name: "Agregar producto" }).first().click();
  const dialog = page.locator("dialog.product-dialog");
  await expect(dialog).toBeVisible();
  await dialog.getByRole("textbox", { name: "Título" }).fill("Linterna Duna");
  await dialog.getByRole("textbox", { name: "Slug" }).fill("linterna-duna");
  await dialog.getByRole("textbox", { name: "Marca" }).fill("Modo Sur");
  await dialog.getByRole("textbox", { name: "Descripción" }).fill("Luz cálida de campamento.");
  await dialog.getByRole("textbox", { name: "SKU" }).fill("LIN-DUNA-01");
  await dialog.getByRole("spinbutton", { name: "Precio en centavos" }).fill("45000");
  await dialog.getByRole("button", { name: "Crear producto" }).click();
  await page.getByPlaceholder("Buscar por producto, marca o estado").fill("Linterna Duna");
  await expect(page.getByLabel("Nombre de Linterna Duna")).toBeVisible();
  await page.getByPlaceholder("Buscar por producto, marca o estado").fill("");

  await page.getByRole("tab", { name: "Constructor", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Constructor" })).toBeVisible();
  await page.locator(".section-row .section-select").first().click();
  await expect(page.getByRole("complementary", { name: "Inspector de sección" })).toBeVisible();

  await page.getByRole("tab", { name: "Exportar", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Exportar" })).toBeVisible();
  await page.getByRole("button", { name: "Exportar borrador" }).click();
  await expect(page.getByText("Exportación correcta", { exact: false })).toBeVisible({
    timeout: 60_000,
  });

  await page.getByRole("button", { name: "Vista de tablet" }).click();
  await expect(page.locator('iframe[title="Vista previa tablet"]')).toBeVisible();
  const routeInput = page.getByLabel("Ruta de vista previa");
  await routeInput.fill("/contacto/");
  await routeInput.press("Enter");
  await expect(page.locator('iframe[title="Vista previa tablet"]')).toBeVisible();
  await page.getByRole("button", { name: "Vista de escritorio" }).click();
  await expect(page.locator('iframe[title="Vista previa desktop"]')).toBeVisible();

  await page.getByRole("button", { name: "Volver a tiendas" }).click();
  await expect(page.getByRole("heading", { name: "Tus tiendas" })).toBeVisible();

  expect(problems, problems.join("\n")).toEqual([]);
});

test("el dashboard busca, selecciona y respalda sin errores de consola", async ({ page }) => {
  const problems = trackConsoleProblems(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(studioUrl);
  await expect(page.getByRole("heading", { name: "Tus tiendas" })).toBeVisible({
    timeout: 30_000,
  });

  await page.getByRole("searchbox", { name: "Buscar tienda" }).fill("predeterminado");
  await expect(page.locator(".dashboard-cosmic-count")).toHaveText(/visibles/);
  await page.getByRole("searchbox", { name: "Buscar tienda" }).fill("no existe esta tienda");
  await expect(page.getByText("No hay coincidencias")).toBeVisible();
  await page.getByRole("searchbox", { name: "Buscar tienda" }).fill("");

  await page
    .locator('article:has([data-store-card-id="store-modo-sur-demo"])')
    .locator(".dashboard-store-card__button")
    .click();
  const detail = page.getByRole("complementary", {
    name: "Tienda seleccionada: Predeterminado",
  });
  await expect(detail).toBeVisible();

  const downloadPromise = page.waitForEvent("download");
  await detail.getByRole("button", { name: "Respaldo ahora" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/\.solara\.json$/);

  await detail.getByRole("button", { name: "Cerrar detalle" }).click();
  await expect(detail).toBeHidden();

  expect(problems, problems.join("\n")).toEqual([]);
});

test("los flujos nuevos de la ola (tema, foco, zoom, diálogo, duplicado y archivo) no producen errores de consola (T6.5)", async ({
  page,
}) => {
  test.setTimeout(150_000);
  const problems = trackConsoleProblems(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await openDemoStore(page);

  const themeToggle = page.getByTestId("ui-theme-toggle");
  await themeToggle.click();
  await themeToggle.click();

  await page.getByTestId("ui-focus-toggle").click();
  await expect(page.locator(".studio-shell")).toHaveAttribute("data-studio-focus", "true");
  await page.keyboard.press("Escape");
  await expect(page.locator(".studio-shell")).not.toHaveAttribute("data-studio-focus", "true");

  await page.getByRole("tab", { name: "Resumen", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Resumen" })).toBeVisible();
  await page
    .getByRole("button", { name: /^Eliminar enlace / })
    .first()
    .click();
  const confirm = page.getByTestId("ui-confirm-dialog");
  await expect(confirm).toBeVisible();
  await confirm.getByRole("button", { name: "Cancelar" }).click();
  await expect(confirm).toBeHidden();

  await page.getByRole("button", { name: "75%", exact: true }).click();
  await expect(page.getByRole("button", { name: "75%", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page.getByRole("button", { name: "100%", exact: true }).click();

  await page.getByRole("button", { name: "Volver a tiendas" }).click();
  await expect(page.getByRole("heading", { name: "Tus tiendas" })).toBeVisible();

  const card = page.locator('[data-store-card-id="store-modo-sur-demo"]');
  // data-store-card-id está en el botón de selección; el descendiente
  // .dashboard-store-card__button no existe (es el propio elemento).
  await card.click();
  const demoDetail = page.getByRole("complementary", {
    name: "Tienda seleccionada: Predeterminado",
  });
  await demoDetail.getByRole("button", { name: "Duplicar" }).click();
  const duplicate = page.getByTestId("ui-duplicate-dialog");
  await expect(duplicate).toBeVisible();
  // La cabecera del diálogo tiene un botón "Cancelar duplicado" (aria-label que
  // contiene "Cancelar"); el botón de pie usa el nombre exacto.
  await duplicate.getByRole("button", { name: "Cancelar", exact: true }).click();
  await expect(duplicate).toBeHidden();

  // T4.12: el archivo de tienda confirma con el diálogo unificado.
  await demoDetail.getByRole("button", { name: "Archivar" }).click();
  const archiveConfirm = page.getByTestId("ui-confirm-dialog");
  await expect(archiveConfirm).toBeVisible();
  await archiveConfirm.getByRole("button", { name: "Archivar", exact: true }).click();
  await expect(archiveConfirm).toBeHidden();
  await page.locator(".dashboard-cosmic-select select").first().selectOption("archived");
  await expect(page.locator(".dashboard-cosmic-count")).toHaveText("1 visibles");
  await page
    .locator(".dashboard-store-card")
    .filter({ hasText: "Predeterminado" })
    .first()
    .locator(".dashboard-store-card__button")
    .click();
  await page.getByRole("button", { name: "Restaurar" }).click();
  await page.locator(".dashboard-cosmic-select select").first().selectOption("active");
  await expect(page.locator(".dashboard-cosmic-count")).toHaveText("1 visibles");

  expect(problems, problems.join("\n")).toEqual([]);
});
