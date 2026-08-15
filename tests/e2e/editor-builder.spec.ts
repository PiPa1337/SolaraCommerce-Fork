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
  // Predeterminado nace en V2; estos recorridos de inspector conservan su
  // baseline V1 explícito para probar también la reversibilidad de la familia.
  await page.getByRole("tab", { name: "Tema" }).click();
  await page.getByTestId("ui-design-family-v1").click();
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

  // El hero V2 tiene slides con campos "Título" propios (aria-description="Slide N");
  // el campo del módulo (top-level) no lleva esa marca.
  const title = page
    .getByRole("textbox", { name: "Título", exact: true })
    .and(page.locator("input:not([aria-description])"))
    .first();
  await title.fill("Un título editado");
  await expect(page.getByText("Cambios pendientes", { exact: true })).toBeVisible();
  await expect(
    page.frameLocator("iframe").locator('[data-solara-module="catalog-hero"] h1'),
  ).toHaveText("Un título editado", { timeout: 15_000 });

  await page.getByRole("button", { name: "Restaurar valores por defecto" }).click();
  const restoreDialog = page.getByRole("dialog", { name: "Restaurar valores por defecto" });
  await expect(restoreDialog).toBeVisible();
  await expect(restoreDialog.locator(".confirm-dialog__body")).toContainText("Hero de catálogo");
  await restoreDialog.getByRole("button", { name: "Cancelar", exact: true }).click();
  await expect(title).toHaveValue("Un título editado");
  await page.getByRole("button", { name: "Restaurar valores por defecto" }).click();
  await page
    .getByRole("dialog", { name: "Restaurar valores por defecto" })
    .getByRole("button", { name: "Restaurar valores", exact: true })
    .click();
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

test("el hero permite subir un video desde el campo de video", async ({ page }) => {
  await openBuilder(page);
  await selectHero(page);
  await expect(page.getByRole("button", { name: "Subir video" })).toBeVisible();
  await page.getByRole("button", { name: "Subir video" }).click();
  await page
    .locator('input[type="file"][accept*="video/"]')
    .first()
    .setInputFiles({
      name: "no-es-video.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("esto no es un video"),
    });
  await expect(page.getByText("Sólo se aceptan videos MP4 o WebM.")).toBeVisible();
});

test("subir un video real genera el poster con el primer frame exacto", async ({ page }) => {
  await openBuilder(page);
  await selectHero(page);

  // Grabar un video real en el navegador: el primer frame es rojo puro y el
  // resto azul. Si el poster se captura "después del primer frame", el centro
  // del poster sale azul y el test falla.
  const recorded = await page.evaluate(async () => {
    const canvas = document.createElement("canvas");
    canvas.width = 360;
    canvas.height = 640;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Sin contexto 2d");
    const stream = canvas.captureStream(30);
    const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
      ? "video/webm;codecs=vp9"
      : "video/webm";
    const recorder = new MediaRecorder(stream, { mimeType });
    const chunks: Blob[] = [];
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunks.push(event.data);
    };
    const stopped = new Promise<void>((resolve) => {
      recorder.onstop = () => resolve();
    });
    recorder.start(100);
    const t0 = performance.now();
    while (performance.now() - t0 < 400) {
      context.fillStyle = "#ff0000";
      context.fillRect(0, 0, 360, 640);
      await new Promise((resolve) => requestAnimationFrame(resolve));
    }
    context.fillStyle = "#0000ff";
    context.fillRect(0, 0, 360, 640);
    await new Promise((resolve) => setTimeout(resolve, 600));
    recorder.stop();
    await stopped;
    const blob = new Blob(chunks, { type: recorder.mimeType });
    return Array.from(new Uint8Array(await blob.arrayBuffer()));
  });

  await page.getByRole("button", { name: "Subir video" }).click();
  await page
    .locator('input[type="file"][accept*="video/"]')
    .first()
    .setInputFiles({
      name: "primer-frame-rojo.webm",
      mimeType: "video/webm",
      buffer: Buffer.from(recorded),
    });
  // La subida termina cuando el botón vuelve a estar habilitado.
  await expect(page.getByRole("button", { name: "Subir video" })).toBeEnabled({
    timeout: 25_000,
  });

  // Leer el poster generado desde IndexedDB y decodificarlo en la página.
  const posterInfo = await page.evaluate(async () => {
    const open = indexedDB.open("solara-commerce-studio");
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      open.onsuccess = () => resolve(open.result);
      open.onerror = () => reject(open.error);
    });
    const transaction = db.transaction("projects", "readonly");
    const store = transaction.objectStore("projects");
    const all = await new Promise<
      Array<{
        project?: {
          videos?: Array<{ posterAssetId?: string }>;
          assets?: Array<{ id: string; source: string }>;
        };
      }>
    >((resolve) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result ?? []);
    });
    const record = all.find((item) => (item.project?.videos?.length ?? 0) > 0);
    const video = record?.project?.videos?.[0];
    const poster = record?.project?.assets?.find((asset) => asset.id === video?.posterAssetId);
    if (!poster) return null;
    const image = new Image();
    image.src = poster.source;
    await image.decode();
    const probe = document.createElement("canvas");
    probe.width = image.naturalWidth;
    probe.height = image.naturalHeight;
    const probeContext = probe.getContext("2d");
    if (!probeContext) return null;
    probeContext.drawImage(image, 0, 0);
    const center = probeContext.getImageData(
      Math.floor(image.naturalWidth / 2),
      Math.floor(image.naturalHeight / 2),
      1,
      1,
    ).data;
    return {
      width: image.naturalWidth,
      height: image.naturalHeight,
      center: Array.from(center),
    };
  });

  expect(posterInfo).not.toBeNull();
  expect(posterInfo?.width).toBe(360);
  expect(posterInfo?.height).toBe(640);
  const [red, green, blue] = posterInfo?.center ?? [];
  expect(red).toBeGreaterThan(200);
  expect(green).toBeLessThan(80);
  expect(blue).toBeLessThan(80);
});

test("el hero V2 expone el modo sólo video (media 9:16)", async ({ page }) => {
  await openBuilder(page);
  await selectHero(page);
  const modeField = page.getByRole("combobox", { name: "Modo" });
  await expect(modeField).toBeVisible();
  await expect(modeField.locator("option")).toHaveCount(3);

  await page.getByRole("tab", { name: "Tema" }).click();
  await page.getByTestId("ui-design-family-v2").click();
  await page.getByRole("tab", { name: "Constructor" }).click();
  await expect(page.getByRole("heading", { name: "Constructor" })).toBeVisible();
  await selectHero(page);

  const v2ModeField = page.getByRole("combobox", { name: "Modo" });
  await expect(v2ModeField).toBeVisible();
  await expect(v2ModeField.locator("option")).toHaveCount(1);
  await expect(v2ModeField.locator("option")).toHaveAttribute("value", "video");
  await expect(v2ModeField).toHaveValue("video");
});

test("la familia Editorial V2 se activa y revierte sin cambiar el contenido", async ({ page }) => {
  await openBuilder(page);
  await page.getByRole("tab", { name: "Tema" }).click();
  await expect(page.getByRole("heading", { name: "Tema" })).toBeVisible();

  const v1 = page.getByTestId("ui-design-family-v1");
  const v2 = page.getByTestId("ui-design-family-v2");
  await expect(v1).toHaveAttribute("aria-pressed", "true");
  await v2.click();
  await expect(v2).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByText("Cambios pendientes", { exact: true })).toBeVisible();
  const preview = page.frameLocator("iframe");
  await expect(preview.locator('[data-design-family="catalog-modern-v2"]')).toBeVisible({
    timeout: 20_000,
  });
  await expect(preview.getByRole("heading", { level: 1 })).toHaveText(
    "Vestite con lo que te representa.",
  );

  await v1.click();
  await expect(v1).toHaveAttribute("aria-pressed", "true");
  await expect(preview.locator('[data-design-family="catalog-modern-v1"]')).toBeVisible({
    timeout: 20_000,
  });
  await expect(preview.getByRole("heading", { level: 1 })).toHaveText(
    "Vestite con lo que te representa.",
  );
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
  await expect(page.getByRole("checkbox", { name: "Contenido de ejemplo" })).toHaveCount(0);
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
  await expect(textHex).toHaveValue("#11110f");
});
