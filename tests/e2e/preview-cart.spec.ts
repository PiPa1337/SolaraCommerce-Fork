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
    // Nightwatch: Predeterminado es la fixture de escala (slugs reales, no
    // placeholder-1); derivar tarjetas con IDs de producto distintos desde el DOM.
    const productTargets = await preview.locator("[data-product-card]").evaluateAll((cards) => {
      const targets: Array<{ id: string; href: string }> = [];
      for (const card of cards) {
        const id = card.getAttribute("data-product-id");
        const href = card.querySelector('a[href^="/productos/"]')?.getAttribute("href");
        if (id && href && !targets.some((target) => target.id === id)) targets.push({ id, href });
      }
      return targets;
    });
    const firstTarget = productTargets[0];
    const secondTarget = productTargets[1];
    if (!firstTarget || !secondTarget) throw new Error("Se necesitan dos tarjetas de producto");
    await preview
      .locator(`[data-product-card][data-product-id="${firstTarget.id}"] a`)
      .first()
      .click();
    const firstTitle = preview.getByRole("heading", { level: 1 });
    await expect(firstTitle).toHaveText(/.+/, {
      timeout: 30_000,
    });
    const firstTitleText = await firstTitle.textContent();
    await preview.getByRole("button", { name: "Agregar al carrito" }).click();
    await expect(preview.locator("[data-cart-count]").first()).toHaveText("1");
    await preview.locator("[data-cart-drawer]").press("Escape");

    await preview.locator('a[href="/"]').first().click();
    await expect(preview.getByRole("heading", { level: 1 })).toBeVisible({
      timeout: 30_000,
    });
    await expect(preview.locator("[data-cart-count]").first()).toHaveText("1");

    await preview
      .locator(`[data-product-card][data-product-id="${secondTarget.id}"] a`)
      .first()
      .click();
    const secondTitle = preview.getByRole("heading", { level: 1 });
    await expect(secondTitle).toHaveText(/.+/, {
      timeout: 30_000,
    });
    await expect(secondTitle).not.toHaveText(firstTitleText ?? "");
    await expect(preview.locator("[data-cart-count]").first()).toHaveText("1");
    await preview.getByRole("button", { name: "Agregar al carrito" }).click();
    await expect(preview.locator("[data-cart-count]").first()).toHaveText("2");
    await page.getByTestId("ui-preview-route").fill("/carrito/");
    await page.getByTestId("ui-preview-route").press("Enter");
    await expect(preview.getByRole("heading", { level: 1 })).toHaveText("Carrito", {
      timeout: 30_000,
    });
    await expect(preview.getByRole("heading", { level: 1 })).toBeVisible({ timeout: 30_000 });
    await expect(
      preview.locator(".solara-cart-page [data-cart-lines] .solara-cart-line"),
    ).toHaveCount(2);
    const cartImages = preview.locator(".solara-cart-page [data-cart-lines] .solara-cart-line img");
    await expect(cartImages).toHaveCount(2);
    await expect
      .poll(() =>
        cartImages.evaluateAll(
          (images) => images.filter((image) => image.complete && image.naturalWidth > 0).length,
        ),
      )
      .toBe(2);
    const cartImageMetrics = await cartImages.evaluateAll((images) =>
      images.map((image) => {
        const rect = image.getBoundingClientRect();
        return {
          width: rect.width,
          height: rect.height,
          objectFit: getComputedStyle(image).objectFit,
        };
      }),
    );
    for (const metric of cartImageMetrics) {
      expect(Math.abs(metric.width - metric.height)).toBeLessThanOrEqual(0.5);
      expect(metric.objectFit).toBe("contain");
    }
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
    const productTargets = await preview.locator("[data-product-card]").evaluateAll((cards) => {
      const targets: Array<{ id: string; href: string }> = [];
      for (const card of cards) {
        const id = card.getAttribute("data-product-id");
        const href = card.querySelector('a[href^="/productos/"]')?.getAttribute("href");
        if (id && href && !targets.some((target) => target.id === id)) targets.push({ id, href });
      }
      return targets;
    });
    const firstTarget = productTargets[0];
    const secondTarget = productTargets[1];
    if (!firstTarget || !secondTarget) throw new Error("Se necesitan dos tarjetas de producto");
    await preview
      .locator(`[data-product-card][data-product-id="${firstTarget.id}"] a`)
      .first()
      .click();
    await expect(preview.getByRole("heading", { level: 1 })).toHaveText(/.+/, {
      timeout: 30_000,
    });
    await preview.getByRole("button", { name: "Agregar al carrito" }).click();

    await page.getByTestId("ui-preview-route").fill(secondTarget.href);
    await page.getByTestId("ui-preview-route").press("Enter");
    await expect(preview.getByRole("heading", { level: 1 })).toHaveText(/.+/, {
      timeout: 30_000,
    });
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

test("el preview V2 conserva el vaciado intencional al cambiar de ruta", async ({ page }) => {
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
    await page.evaluate(() => {
      localStorage.removeItem("solara-cart:store-modo-sur-demo");
      localStorage.removeItem("solara-cart:store-modo-sur-demo:backup");
    });
    await expect(preview.locator('[data-design-family="catalog-modern-v2"]')).toBeVisible({
      timeout: 30_000,
    });
    await preview.locator('a[href^="/productos/"]').first().click();
    await preview.getByRole("button", { name: "Agregar al carrito" }).click();
    await expect(preview.locator("[data-cart-count]").first()).toHaveText("1");
    await preview.locator("[data-cart-remove]").first().click();
    await expect(preview.locator("[data-cart-count]").first()).toHaveText("0");

    await page.getByTestId("ui-preview-route").fill("/carrito/");
    await page.getByTestId("ui-preview-route").press("Enter");
    await expect(preview.getByRole("heading", { level: 1 })).toHaveText("Carrito", {
      timeout: 30_000,
    });
    await expect(preview.locator("[data-cart-count]").first()).toHaveText("0");
    await expect(
      preview.locator(".solara-cart-page [data-cart-lines] .solara-cart-line"),
    ).toHaveCount(0);
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

test("P7-B6: el zoom del preview se conserva al recargar la sesión", async ({ page }) => {
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

    await page.getByRole("button", { name: "50%" }).click();
    await page.waitForTimeout(400);
    await page.reload();
    await expect(page.getByRole("heading", { name: "Tus tiendas" })).toBeVisible({
      timeout: 30_000,
    });
    const cardAfter = page.locator(".dashboard-store-card").filter({
      has: page.getByText("Predeterminado", { exact: true }),
    });
    await cardAfter.getByRole("button", { name: "Abrir esta tienda" }).click();
    await page.locator(".studio-shell").waitFor({ timeout: 30_000 });
    await page.waitForTimeout(1500);

    const frame = page.locator('.preview-stage iframe[title^="Vista previa"]');
    const persistedZoom = await frame.evaluate((el) => getComputedStyle(el).zoom);
    console.log("P7-B6 zoom tras recargar:", persistedZoom);
    expect(parseFloat(persistedZoom)).toBeLessThan(1);
    const zoomButton = page.getByRole("button", { name: "50%" });
    await expect(zoomButton).toHaveAttribute("aria-pressed", "true");
  } finally {
    await stopStudioServer(running.server);
  }
});
