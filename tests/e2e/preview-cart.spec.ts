import { expect, test } from "@playwright/test";
import { startStudioServer, stopStudioServer } from "./studio-server";

test.setTimeout(120_000);

test("el preview V2 conserva el carrito al navegar con enlaces internos", async ({ page }) => {
  const running = await startStudioServer();
  try {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(running.url);
    await expect(page.getByRole("heading", { name: "Tus tiendas" })).toBeVisible({
      timeout: 30_000,
    });
    const card = page.locator(".dashboard-store-card").filter({
      has: page.getByText("Predeterminado", { exact: true }),
    });
    await card.getByRole("button", { name: "Abrir esta tienda" }).click();

    const preview = page.frameLocator('iframe[title="Vista previa desktop"]');
    await page.evaluate(() => localStorage.removeItem("solara-cart:store-modo-sur-demo"));
    await expect(preview.locator('[data-design-family="catalog-modern-v2"]')).toBeVisible({
      timeout: 30_000,
    });
    await preview.locator('a[href="/productos/remera-esencial-de-algodon/"]').first().click();
    await expect(preview.getByRole("heading", { level: 1 })).toHaveText(
      "Remera esencial de algodón",
      { timeout: 30_000 },
    );
    await preview.getByRole("button", { name: "Agregar al carrito" }).click();
    await expect(preview.locator("[data-cart-count]").first()).toHaveText("1");
    await preview.getByRole("button", { name: "Seguir comprando" }).click();

    await preview.locator('a[href="/"]').first().click();
    await expect(preview.getByRole("heading", { level: 1 })).toHaveText(
      "Vestite con lo que te representa.",
      { timeout: 30_000 },
    );
    await expect(preview.locator("[data-cart-count]").first()).toHaveText("1");

    await preview.locator('a[href="/productos/remera-grafica-horizonte/"]').first().click();
    await expect(preview.getByRole("heading", { level: 1 })).toHaveText(
      "Remera gráfica Horizonte",
      { timeout: 30_000 },
    );
    await expect(preview.locator("[data-cart-count]").first()).toHaveText("1");
    await preview.getByRole("button", { name: "Agregar al carrito" }).click();
    await expect(preview.locator("[data-cart-count]").first()).toHaveText("2");

    await page.getByTestId("ui-preview-route").fill("/carrito/");
    await page.getByTestId("ui-preview-route").press("Enter");
    await expect(preview.getByRole("heading", { level: 1 })).toHaveText("Carrito", {
      timeout: 30_000,
    });
    await expect(
      preview.locator(".solara-cart-page [data-cart-lines] .solara-cart-line"),
    ).toHaveCount(2);
  } finally {
    await stopStudioServer(running.server);
  }
});

test("el preview V2 conserva el carrito al cambiar de ruta inmediatamente después de agregar", async ({
  page,
}) => {
  const running = await startStudioServer();
  try {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(running.url);
    await expect(page.getByRole("heading", { name: "Tus tiendas" })).toBeVisible({
      timeout: 30_000,
    });
    const card = page.locator(".dashboard-store-card").filter({
      has: page.getByText("Predeterminado", { exact: true }),
    });
    await card.getByRole("button", { name: "Abrir esta tienda" }).click();

    const preview = page.frameLocator('iframe[title="Vista previa desktop"]');
    await page.evaluate(() => localStorage.removeItem("solara-cart:store-modo-sur-demo"));
    await expect(preview.locator('[data-design-family="catalog-modern-v2"]')).toBeVisible({
      timeout: 30_000,
    });
    await preview.locator('a[href="/productos/remera-esencial-de-algodon/"]').first().click();
    await expect(preview.getByRole("heading", { level: 1 })).toHaveText(
      "Remera esencial de algodón",
      { timeout: 30_000 },
    );
    await preview.getByRole("button", { name: "Agregar al carrito" }).click();

    await page.getByTestId("ui-preview-route").fill("/productos/remera-grafica-horizonte/");
    await page.getByTestId("ui-preview-route").press("Enter");
    await expect(preview.getByRole("heading", { level: 1 })).toHaveText(
      "Remera gráfica Horizonte",
      { timeout: 30_000 },
    );
    await expect(preview.locator("[data-cart-count]").first()).toHaveText("1");
    await preview.getByRole("button", { name: "Agregar al carrito" }).click();

    await page.getByTestId("ui-preview-route").fill("/carrito/");
    await page.getByTestId("ui-preview-route").press("Enter");
    await expect(preview.getByRole("heading", { level: 1 })).toHaveText("Carrito", {
      timeout: 30_000,
    });
    await expect(
      preview.locator(".solara-cart-page [data-cart-lines] .solara-cart-line"),
    ).toHaveCount(2);
  } finally {
    await stopStudioServer(running.server);
  }
});

test("P7-B5: los tamaños de vista y el zoom cambian el stage del preview", async ({ page }) => {
  const running = await startStudioServer();
  try {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(running.url);
    await expect(page.getByRole("heading", { name: "Tus tiendas" })).toBeVisible({
      timeout: 30_000,
    });
    const card = page.locator(".dashboard-store-card").filter({
      has: page.getByText("Predeterminado", { exact: true }),
    });
    await card.getByRole("button", { name: "Abrir esta tienda" }).click();
    await page.locator(".studio-shell").waitFor({ timeout: 30_000 });
    await page.waitForTimeout(1500);

    const frame = page.locator('.preview-stage iframe[title^="Vista previa"]');
    const desktopWidth = (await frame.boundingBox())?.width ?? 0;
    await page.getByRole("button", { name: "Vista de tablet" }).click();
    await page.waitForTimeout(500);
    const tabletWidth = (await frame.boundingBox())?.width ?? 0;
    await page.getByRole("button", { name: "Vista móvil" }).click();
    await page.waitForTimeout(500);
    const mobileWidth = (await frame.boundingBox())?.width ?? 0;
    console.log(
      "P7-B5 anchos: desktop",
      Math.round(desktopWidth),
      "tablet",
      Math.round(tabletWidth),
      "móvil",
      Math.round(mobileWidth),
    );
    expect(tabletWidth).toBeLessThan(desktopWidth);
    expect(mobileWidth).toBeLessThan(tabletWidth);

    await page.getByRole("button", { name: "75%" }).click();
    await page.waitForTimeout(400);
    const iframeZoom = await frame.evaluate((el) => getComputedStyle(el).zoom);
    console.log("P7-B5 zoom CSS tras 75%:", iframeZoom);
    expect(parseFloat(iframeZoom)).toBeLessThan(1);
  } finally {
    await stopStudioServer(running.server);
  }
});
