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
