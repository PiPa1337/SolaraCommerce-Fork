import { expect, test } from "@playwright/test";
import { startStudioServer, stopStudioServer } from "./studio-server";

test("muestra y abre el proyecto demo de escala al iniciar Studio", async ({ page }) => {
  const running = await startStudioServer();
  try {
    await page.goto(running.url);
    await expect(page.getByRole("heading", { name: "Tus tiendas" })).toBeVisible();
    const demo = page.getByRole("button", { name: /Demo catálogo jerárquico/ });
    await expect(demo).toBeVisible();
    await expect(demo).toContainText("50 productos");

    await demo.click();
    await expect(page.getByRole("navigation", { name: "Áreas de la tienda" })).toBeVisible();
    await page.getByRole("button", { name: "Catálogo", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Catálogo" })).toBeVisible();
    await expect(page.getByText("50 productos y 60 variantes.")).toBeVisible();

    await page.goto(running.url);
    await expect(page.getByRole("button", { name: /Demo catálogo jerárquico/ })).toHaveCount(1);
  } finally {
    await stopStudioServer(running.server);
  }
});
