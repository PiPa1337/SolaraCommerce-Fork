import { expect, type Page } from "@playwright/test";

export async function createCleanStore(page: Page, name = "Tienda de prueba"): Promise<void> {
  await expect(page.getByRole("heading", { name: "Tus tiendas" })).toBeVisible();
  await page.getByRole("button", { name: "Nueva tienda", exact: true }).click();
  await page.getByLabel("Nueva tienda").fill(name);
  await page.getByRole("button", { name: "Continuar", exact: true }).click();
  await page.getByRole("button", { name: "Continuar", exact: true }).click();
  await page.getByRole("button", { name: "Continuar", exact: true }).click();
  await page.getByRole("button", { name: "Crear tienda vacía", exact: true }).click();
  await expect(page.getByRole("navigation", { name: "Áreas de la tienda" })).toBeVisible();
}
