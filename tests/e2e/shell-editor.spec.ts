import { expect, test } from "@playwright/test";

test.setTimeout(180_000);

const STUDIO_URL = "http://localhost:4173";

test("P3-B2: el pane conserva scroll y foco al cambiar de pestaña y reabrir", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(STUDIO_URL, { waitUntil: "load" });
  await page.getByRole("heading", { name: "Tus tiendas" }).waitFor({ timeout: 30000 });
  await page
    .locator(".dashboard-store-card")
    .first()
    .locator(".dashboard-store-card__button")
    .dblclick();
  await page.locator(".studio-shell").waitFor({ timeout: 30000 });
  await page.waitForTimeout(1000);

  await page.getByRole("tab", { name: "Constructor", exact: true }).click();
  await page.waitForTimeout(1500);
  const pane = page.locator(".editor-pane");
  await expect(pane).toBeVisible();
  await pane.scrollIntoViewIfNeeded();
  await page.evaluate(() => {
    const el = document.querySelector<HTMLElement>(".editor-pane");
    if (el) el.scrollTop = 200;
  });
  const scrollBefore = await page.evaluate(
    () => document.querySelector<HTMLElement>(".editor-pane")?.scrollTop ?? 0,
  );

  await page.getByRole("tab", { name: "Resumen", exact: true }).click();
  await page.waitForTimeout(1200);
  await page.getByRole("tab", { name: "Constructor", exact: true }).click();
  await page.waitForTimeout(1500);
  const scrollAfter = await page.evaluate(
    () => document.querySelector<HTMLElement>(".editor-pane")?.scrollTop ?? 0,
  );
  console.log("P3-B2 scroll: antes", scrollBefore, "después", scrollAfter);
  expect(Math.abs(scrollAfter - scrollBefore)).toBeLessThanOrEqual(5);

  await page
    .getByRole("button", { name: "Cerrar panel de edición" })
    .click()
    .catch(() => undefined);
  await page.waitForTimeout(600);
  const closed = await page
    .locator(".editor-pane")
    .evaluate((el) => el.classList.contains("editor-pane--closed"));
  console.log("P3-B2 pane cerrado:", closed);
  await page.getByRole("tab", { name: "Resumen", exact: true }).click();
  await page.waitForTimeout(800);
  await page.getByRole("tab", { name: "Constructor", exact: true }).click();
  await page.waitForTimeout(1200);
  const reopened = await page
    .locator(".editor-pane")
    .evaluate((el) => el.classList.contains("editor-pane--open"));
  console.log("P3-B2 pane reabierto al volver:", reopened);
  expect(reopened).toBe(true);
});

test("P3-B3: Ctrl+Z deshace un cambio y Ctrl+S guarda en modo navegador", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(STUDIO_URL, { waitUntil: "load" });
  await page.getByRole("heading", { name: "Tus tiendas" }).waitFor({ timeout: 30000 });
  await page
    .locator(".dashboard-store-card")
    .first()
    .locator(".dashboard-store-card__button")
    .dblclick();
  await page.locator(".studio-shell").waitFor({ timeout: 30000 });
  await page.waitForTimeout(1000);

  await page.getByRole("tab", { name: "Resumen", exact: true }).click();
  await page.waitForTimeout(1200);
  const nameInput = page.getByRole("textbox", { name: "Nombre de la tienda" });
  await nameInput.fill("Tienda de prueba undo");
  await page.waitForTimeout(500);
  await page.keyboard.press("Control+z");
  await page.waitForTimeout(500);
  const valueAfterUndo = await nameInput.inputValue();
  console.log("P3-B3 valor tras Ctrl+Z:", valueAfterUndo);
  expect(valueAfterUndo).not.toBe("Tienda de prueba undo");

  await nameInput.fill("Tienda guardada");
  await page.keyboard.press("Control+s");
  await page.waitForTimeout(1200);
  const saved = await page
    .locator("[data-testid='ui-save-indicator']")
    .innerText()
    .catch(() => "");
  console.log("P3-B3 indicador tras Ctrl+S:", JSON.stringify(saved));
  expect(saved).toMatch(/guardad/i);
});

test("P3-B4: el modo foco oculta el panel y Esc lo restaura", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(STUDIO_URL, { waitUntil: "load" });
  await page.getByRole("heading", { name: "Tus tiendas" }).waitFor({ timeout: 30000 });
  await page
    .locator(".dashboard-store-card")
    .first()
    .locator(".dashboard-store-card__button")
    .dblclick();
  await page.locator(".studio-shell").waitFor({ timeout: 30000 });
  await page.waitForTimeout(1000);

  await page.getByRole("tab", { name: "Resumen", exact: true }).click();
  await page.waitForTimeout(1000);
  const pane = page.locator(".editor-pane");
  await expect(pane).toBeVisible();

  const focusButton = page.getByRole("button", { name: "Modo foco de la vista previa" });
  await focusButton.click();
  await page.waitForTimeout(700);
  const focused = await page.locator(".studio-shell").getAttribute("data-studio-focus");
  console.log("P3-B4 data-studio-focus:", JSON.stringify(focused));
  expect(focused).toBeTruthy();
  await expect(pane).toBeHidden();

  await page.keyboard.press("Escape");
  await page.waitForTimeout(700);
  const restored = await page.locator(".studio-shell").getAttribute("data-studio-focus");
  console.log("P3-B4 tras Esc: focus", JSON.stringify(restored));
  expect(restored).toBeFalsy();
  await expect(pane).toBeVisible();
});

test("P3-B6: Ctrl+Shift+F alterna el modo foco desde el teclado", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(STUDIO_URL, { waitUntil: "load" });
  await page.getByRole("heading", { name: "Tus tiendas" }).waitFor({ timeout: 30000 });
  await page
    .locator(".dashboard-store-card")
    .first()
    .locator(".dashboard-store-card__button")
    .dblclick();
  await page.locator(".studio-shell").waitFor({ timeout: 30000 });
  await page.waitForTimeout(1000);

  await page.keyboard.press("Control+Shift+f");
  await page.waitForTimeout(700);
  const focused = await page.locator(".studio-shell").getAttribute("data-studio-focus");
  console.log("P3-B6 foco tras Ctrl+Shift+F:", JSON.stringify(focused));
  expect(focused).toBeTruthy();

  await page.keyboard.press("Control+Shift+f");
  await page.waitForTimeout(700);
  const restored = await page.locator(".studio-shell").getAttribute("data-studio-focus");
  console.log("P3-B6 foco tras segundo Ctrl+Shift+F:", JSON.stringify(restored));
  expect(restored).toBeFalsy();
});
