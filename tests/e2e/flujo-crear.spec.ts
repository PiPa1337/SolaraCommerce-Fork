import { expect, test } from "@playwright/test";

test.setTimeout(180_000);

const STUDIO_URL = "http://localhost:4173";

test("P4-C2: crear una tienda desde el dashboard en pasos con validacion", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(STUDIO_URL, { waitUntil: "load" });
  await page.getByRole("heading", { name: "Tus tiendas" }).waitFor({ timeout: 30000 });

  const start = Date.now();
  await page.getByRole("button", { name: "Nueva tienda" }).click();
  const dialog = page.getByRole("dialog", { name: "Crear tienda" });
  await expect(dialog).toBeVisible();
  const focusOnOpen = await page.evaluate(() => document.activeElement?.tagName);
  console.log("P4-C2 foco inicial del diálogo:", focusOnOpen);
  expect(focusOnOpen).toBe("INPUT");

  await dialog.getByRole("button", { name: "Continuar" }).click();
  await expect(dialog.getByText("Escribí un nombre para continuar.")).toBeVisible();
  console.log("P4-C2 error de validación visible: true");

  await dialog.getByLabel("Nueva tienda").fill("Tienda del plan");
  await dialog.getByRole("button", { name: "Continuar" }).click();
  await expect(dialog.getByLabel("Nombre visible de la marca")).toBeVisible();
  await dialog.getByLabel("Nombre visible de la marca").fill("Marca del plan");
  await dialog.getByRole("button", { name: "Continuar" }).click();
  await expect(dialog.getByLabel("Email de contacto (opcional)")).toBeVisible();
  await dialog.getByLabel("Email de contacto (opcional)").fill("hola@plan.example");
  await dialog.getByLabel("WhatsApp (opcional)").fill("5491100000000");
  await dialog.getByRole("button", { name: "Continuar" }).click();
  await expect(dialog.getByText("Crear tienda vacía")).toBeVisible();
  await dialog.getByRole("button", { name: "Crear tienda vacía" }).click();
  await dialog.waitFor({ state: "hidden", timeout: 20000 });
  const elapsed = Date.now() - start;

  await page.waitForTimeout(2000);
  const bodyText = await page.locator("body").innerText();
  console.log("P4-C2 tienda en el body:", bodyText.includes("Tienda del plan"));
  await page.waitForTimeout(1500);
  const editorOpened = await page.locator(".studio-shell").count();
  const nameInEditor = (await page.locator("body").innerText()).includes("Tienda del plan");
  console.log(
    "P4-C2 editor abierto:",
    editorOpened > 0,
    "| nombre visible:",
    nameInEditor,
    "| tiempo:",
    elapsed,
    "ms",
  );
  expect(editorOpened).toBeGreaterThan(0);
  expect(nameInEditor).toBe(true);
});

test("F2-B5: la tienda nueva concentra Contacto al final de Home V2", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(STUDIO_URL, { waitUntil: "load" });
  await page.getByRole("heading", { name: "Tus tiendas" }).waitFor({ timeout: 30000 });

  await page.getByRole("button", { name: "Nueva tienda" }).click();
  await page.getByLabel("Nueva tienda").fill("Tienda Constructor");
  for (let step = 0; step < 3; step += 1) {
    await page.getByRole("button", { name: "Continuar" }).click();
  }
  await page.getByRole("button", { name: "Crear tienda vacía" }).click();
  await page.getByRole("navigation", { name: "Áreas de la tienda" }).waitFor({ timeout: 30_000 });

  await page.getByRole("tab", { name: "Constructor", exact: true }).click();
  await page.waitForTimeout(1500);
  const pageSelect = page.locator(".editor-pane select").nth(0);
  await expect(pageSelect).toHaveValue("home");
  await expect(pageSelect.locator("option")).toHaveCount(1);
  await expect(page.locator('[data-section-select="home-section-contact-form"]')).toBeVisible();
  await expect(page.locator('[data-section-select="home-section-contact-channels"]')).toBeVisible();
});

test("P4-B4: archivar una tienda desde el panel de detalle y restaurarla", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(STUDIO_URL, { waitUntil: "load" });
  await page.getByRole("heading", { name: "Tus tiendas" }).waitFor({ timeout: 30000 });

  await page.locator(".dashboard-store-card").first().click();
  await page.waitForTimeout(600);
  const archiveButton = page.locator(".dashboard-store-detail").getByRole("button", {
    name: "Archivar",
  });
  await expect(archiveButton).toBeVisible();

  await archiveButton.click();
  const dialog = page.getByRole("dialog", { name: "Archivar tienda" });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Archivar" }).click();
  const toast = page.locator("[data-testid='ui-toast']");
  await toast.waitFor({ state: "visible", timeout: 30_000 });
  const toastText = await toast.innerText();
  console.log("P4-B4 toast tras archivar:", JSON.stringify(toastText.slice(0, 60)));
  expect(toastText).toContain("archivada");

  await toast.getByRole("button", { name: "Deshacer" }).click();
  const restoredToast = page.locator("[data-testid='ui-toast']");
  await restoredToast.waitFor({ state: "visible", timeout: 30_000 });
  const restoredText = await restoredToast.innerText();
  console.log("P4-B4 toast tras deshacer:", JSON.stringify(restoredText.slice(0, 60)));
  expect(restoredText).toContain("restaurada");
});

test("P4-B6: restaurar una tienda archivada desde el filtro Archivadas", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(STUDIO_URL, { waitUntil: "load" });
  await page.getByRole("heading", { name: "Tus tiendas" }).waitFor({ timeout: 30000 });

  await page.locator(".dashboard-store-card").first().click();
  await page.waitForTimeout(500);
  await page.locator(".dashboard-store-detail").getByRole("button", { name: "Archivar" }).click();
  await page
    .getByRole("dialog", { name: "Archivar tienda" })
    .getByRole("button", {
      name: "Archivar",
    })
    .click();
  await page.locator("[data-testid='ui-toast']").waitFor({ state: "visible" });

  const filter = page.getByRole("combobox", { name: "Estado" });
  await filter.selectOption("archived");
  await page.waitForTimeout(700);
  const archivedCard = page.locator(".dashboard-store-card", { hasText: "Archivada" }).first();
  await expect(archivedCard).toBeVisible();
  await archivedCard.click();
  await page.waitForTimeout(500);
  await page.locator(".dashboard-store-detail").getByRole("button", { name: "Restaurar" }).click();
  const restoredToast = page.locator("[data-testid='ui-toast']", { hasText: "restaurada" });
  await expect(restoredToast).toBeVisible({ timeout: 30_000 });
  const finalText = await restoredToast.innerText();
  console.log("P4-B6 toast tras restaurar desde filtro:", JSON.stringify(finalText.slice(0, 60)));
});

test("R3-P2-B5: duplicar una tienda desde el panel de detalle", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(STUDIO_URL, { waitUntil: "load" });
  await page.getByRole("heading", { name: "Tus tiendas" }).waitFor({ timeout: 30000 });

  await page.locator(".dashboard-store-card").first().click();
  await page.waitForTimeout(500);
  await page.locator(".dashboard-store-detail").getByRole("button", { name: "Duplicar" }).click();
  const dialog = page.getByRole("dialog", { name: "Duplicar tienda" });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel("Nuevo nombre").fill("Copia de prueba");
  await dialog.getByRole("button", { name: "Duplicar" }).click();
  await expect(dialog).toBeHidden();
  await page.waitForTimeout(1200);

  const names = await page.locator(".dashboard-store-card strong").allInnerTexts();
  console.log("R3-P2-B5 tiendas tras duplicar:", JSON.stringify(names));
  expect(names.some((name) => name.includes("Copia de prueba"))).toBe(true);
});

test("R4-P4-B5: cancelar la creación de tienda no crea nada", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(STUDIO_URL, { waitUntil: "load" });
  await page.getByRole("heading", { name: "Tus tiendas" }).waitFor({ timeout: 30000 });
  const cardsBefore = await page.locator(".dashboard-store-card").count();

  await page.getByRole("button", { name: "Nueva tienda" }).click();
  const dialog = page.getByRole("dialog", { name: "Crear tienda" });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Cerrar creación" }).click();
  await expect(dialog).toBeHidden();
  await page.waitForTimeout(500);
  const cardsAfter = await page.locator(".dashboard-store-card").count();
  console.log("R4-P4-B5 cards antes/después:", cardsBefore, cardsAfter);
  expect(cardsAfter).toBe(cardsBefore);
});
