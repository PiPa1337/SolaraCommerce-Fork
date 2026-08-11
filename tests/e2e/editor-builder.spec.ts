import type { Server } from "node:http";
import { expect, type Page, test } from "@playwright/test";
import { startStudioServer, stopStudioServer } from "./studio-server";

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

async function openBuilder(page: Page) {
  await page.goto(studioUrl);
  await page.evaluate(
    () =>
      new Promise<void>((resolve, reject) => {
        const request = indexedDB.deleteDatabase("solara-commerce-studio");
        request.addEventListener("success", () => resolve());
        request.addEventListener("error", () => reject(request.error));
        request.addEventListener("blocked", () =>
          reject(new Error("No se pudo limpiar la base de Studio.")),
        );
      }),
  );
  await page.reload();
  await expect(page.getByRole("heading", { name: "Tus tiendas" })).toBeVisible({
    timeout: 20_000,
  });
  await page.locator('[data-store-card-id="store-modo-sur-demo"]').click();
  await page.getByRole("button", { name: "Abrir tienda", exact: true }).click();
  await page.getByRole("tab", { name: "Constructor" }).click();
  await expect(page.getByRole("heading", { name: "Constructor" })).toBeVisible();
}

/** Re-entrada a la tienda sin limpiar IndexedDB (conserva lo autoguardado). */
async function reopenStore(page: Page) {
  await expect(page.getByRole("heading", { name: "Tus tiendas" })).toBeVisible({
    timeout: 20_000,
  });
  await page.locator('[data-store-card-id="store-modo-sur-demo"]').click();
  await page.getByRole("button", { name: "Abrir tienda", exact: true }).click();
  await page.getByRole("tab", { name: "Constructor" }).click();
  await expect(page.getByRole("heading", { name: "Constructor" })).toBeVisible();
}

async function selectHero(page: Page) {
  const hero = page.getByRole("listitem").filter({ hasText: "Hero de catálogo" });
  await hero.getByRole("button").first().click();
}

test("la sección seleccionada y sus acciones exponen el contexto accesible", async ({ page }) => {
  await openBuilder(page);
  await selectHero(page);

  const hero = page.getByRole("listitem").filter({ hasText: "Hero de catálogo" });
  const selector = hero.getByRole("button").first();
  await expect(selector).toHaveAttribute("aria-pressed", "true");

  const describedBy = await hero
    .getByRole("button", { name: "Duplicar sección" })
    .getAttribute("aria-describedby");
  expect(describedBy).toBeTruthy();
  await expect(page.locator(`#${describedBy}`)).toHaveText("Hero de catálogo");
});

test("el picker de módulos filtra por nombre y agrega el módulo elegido", async ({ page }) => {
  await openBuilder(page);
  const sections = page.getByRole("list", { name: "Secciones de la tienda" });
  const initialCount = await sections.getByRole("listitem").count();

  await page.getByLabel("Tipo de sección").selectOption("content");
  await page.getByRole("button", { name: "Agregar sección" }).click();
  const picker = page.getByTestId("ui-module-picker");
  await expect(picker).toBeVisible();

  await picker.getByLabel("Buscar módulo").fill("testimonios");
  await expect(picker.getByRole("button", { name: /Testimonios/ })).toHaveCount(1);
  await expect(picker.getByRole("button", { name: /Testimonios/ })).toContainText("Testimonios");
  await expect(picker.getByRole("button", { name: /Testimonios/ })).toContainText("Nuevo");

  await picker.getByRole("button", { name: /Testimonios/ }).click();
  await expect(picker).toBeHidden();
  await expect(sections.getByRole("listitem")).toHaveCount(initialCount + 1);
  await expect(sections.getByRole("listitem").last()).toContainText("Testimonios");
});

test("el picker marca la incompatibilidad de slot de forma explícita", async ({ page }) => {
  await openBuilder(page);
  await page.getByLabel("Tipo de sección").selectOption("footer");
  await page.getByRole("button", { name: "Agregar sección" }).click();
  const picker = page.getByTestId("ui-module-picker");
  await expect(picker).toBeVisible();

  await picker.getByLabel("Buscar módulo").fill("hero");
  const heroOption = picker.getByRole("button", { name: /Hero de catálogo/ });
  await expect(heroOption).toBeDisabled();
  await expect(heroOption).toContainText("No compatible con «Pie»");
  await picker.getByLabel("Buscar módulo").fill("");
  await expect(picker.getByRole("button", { name: /Footer de catálogo/ })).toBeEnabled();
});

test("restaurar valores por defecto devuelve la sección al estado inicial", async ({ page }) => {
  await openBuilder(page);
  await selectHero(page);

  const title = page.getByRole("textbox", { name: "Título", exact: true });
  await title.fill("Un título editado");
  await expect(page.getByText("Cambios pendientes", { exact: true })).toBeVisible();
  await expect(
    page.frameLocator("iframe").locator('[data-solara-module="catalog-hero"] h1'),
  ).toHaveText("Un título editado", { timeout: 15_000 });

  await page.getByRole("button", { name: "Restaurar valores por defecto" }).click();
  await expect(title).toHaveValue("Vestite con lo que te representa.");
  await expect(
    page.frameLocator("iframe").locator('[data-solara-module="catalog-hero"] h1'),
  ).toHaveText("Vestite con lo que te representa.", { timeout: 15_000 });
});

test("mover una sección con el teclado reordena la lista", async ({ page }) => {
  await openBuilder(page);
  const sections = page.getByRole("list", { name: "Secciones de la tienda" });
  const firstName = await sections
    .getByRole("listitem")
    .first()
    .locator(".section-select strong")
    .textContent();
  const secondName = await sections
    .getByRole("listitem")
    .nth(1)
    .locator(".section-select strong")
    .textContent();

  const firstHeader = sections.getByRole("listitem").first().locator(".section-select");
  await firstHeader.focus();
  await firstHeader.press("ArrowDown");

  await expect(sections.getByRole("listitem").first().locator(".section-select strong")).toHaveText(
    secondName ?? "",
  );
  await expect(sections.getByRole("listitem").nth(1).locator(".section-select strong")).toHaveText(
    firstName ?? "",
  );
});

test("un valor fuera de rango muestra el error de esquema y no se aplica", async ({ page }) => {
  await openBuilder(page);
  await selectHero(page);

  const interval = page.getByRole("spinbutton", { name: "Intervalo" });
  await interval.fill("100");
  await expect(page.getByTestId("ui-schema-errors")).toBeVisible();
  await expect(page.getByTestId("ui-schema-errors")).toContainText("intervalMs");
  await expect(interval).toHaveValue("100");
  await expect(page.getByText("Cambios pendientes", { exact: true })).toHaveCount(0);

  await page.reload();
  await reopenStore(page);
  await selectHero(page);
  await expect(page.getByTestId("ui-schema-errors")).toHaveCount(0);
  await expect(page.getByRole("spinbutton", { name: "Intervalo" })).toHaveValue("6000");
});

test("un preset de tema aplica los colores y el preview los refleja", async ({ page }) => {
  await openBuilder(page);
  await page.getByRole("tab", { name: "Tema" }).click();
  await expect(page.getByRole("heading", { name: "Tema" })).toBeVisible();

  await page.getByTestId("ui-theme-preset").filter({ hasText: "Salvia serena" }).click();
  const backgroundHex = page.locator(".color-grid input[type='text']").first();
  await expect(backgroundHex).toHaveValue("#f5f7f4");
  await expect
    .poll(
      async () =>
        page
          .frameLocator("iframe")
          .locator("html")
          .evaluate((element) =>
            getComputedStyle(element).getPropertyValue("--solara-background").trim(),
          ),
      { timeout: 20_000 },
    )
    .toBe("#f5f7f4");
});

test("agregar un testimonio genera un ítem válido que commitea y persiste en el preview", async ({
  page,
}) => {
  await openBuilder(page);
  const sections = page.getByRole("list", { name: "Secciones de la tienda" });
  const initialCount = await sections.getByRole("listitem").count();

  await page.getByLabel("Tipo de sección").selectOption("content");
  await page.getByRole("button", { name: "Agregar sección" }).click();
  await page
    .getByTestId("ui-module-picker")
    .getByRole("button", { name: /Testimonios/ })
    .click();
  await expect(sections.getByRole("listitem")).toHaveCount(initialCount + 1);

  await page.getByRole("button", { name: "Agregar elemento" }).click();
  await expect(page.getByText("Cambios pendientes", { exact: true })).toBeVisible();
  await expect(page.getByTestId("ui-schema-errors")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Deshacer" })).toBeEnabled();
  const newTestimonial = page
    .frameLocator("iframe")
    .locator('[data-solara-module="catalog-testimonials"]')
    .last()
    .locator(".catalog-testimonial h3");
  await expect(newTestimonial).toHaveText("Nuevo elemento", { timeout: 15_000 });

  await expect(page.getByText(/^Guardado/)).toBeVisible({ timeout: 15_000 });
  await page.reload();
  await reopenStore(page);
  await sections
    .getByRole("listitem")
    .filter({ hasText: "Testimonios" })
    .last()
    .locator(".section-select")
    .click();
  await expect(page.getByTestId("ui-schema-errors")).toHaveCount(0);
  await expect(newTestimonial).toHaveText("Nuevo elemento", { timeout: 15_000 });
});

test("un par de bajo contraste muestra la advertencia y el reset por grupo la limpia", async ({
  page,
}) => {
  await openBuilder(page);
  await page.getByRole("tab", { name: "Tema" }).click();
  await expect(page.getByRole("heading", { name: "Tema" })).toBeVisible();

  const textHex = page.locator(".color-grid input[type='text']").nth(2);
  await textHex.fill("#fdfdfd");

  const warning = page.getByTestId("ui-contrast-warning");
  await expect(warning).toBeVisible();
  await expect(warning).toContainText("Texto sobre fondo");
  await expect(warning).toContainText("4.5:1");

  await page.getByRole("button", { name: "Restaurar colores" }).click();
  await expect(warning).toBeHidden();
  await expect(textHex).toHaveValue("#0b0b0c");
});
