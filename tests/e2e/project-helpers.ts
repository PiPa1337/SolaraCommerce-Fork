import { expect, type Page } from "@playwright/test";

export async function createCleanStore(page: Page, name = "Tienda de prueba"): Promise<void> {
  await expect(page.getByRole("heading", { name: "Tus tiendas" })).toBeVisible();
  await page.getByRole("button", { name: "Nueva tienda", exact: true }).click();
  await page.getByLabel("Nueva tienda").fill(name);
  await page.getByRole("button", { name: "Continuar", exact: true }).click();
  await page.getByRole("button", { name: "Continuar", exact: true }).click();
  await page.getByRole("button", { name: "Continuar", exact: true }).click();
  await page.getByRole("button", { name: "Crear tienda desde plantilla", exact: true }).click();
  await expect(page.getByRole("navigation", { name: "Áreas de la tienda" })).toBeVisible();
}

export async function resetStudioIndexedDb(
  page: Page,
  studioUrl: string,
  headingTimeout = 20_000,
): Promise<void> {
  await page.goto(studioUrl);
  await page.evaluate(
    () =>
      new Promise<void>((resolveDelete, reject) => {
        const request = indexedDB.deleteDatabase("solara-commerce-studio");
        request.addEventListener("success", () => resolveDelete());
        request.addEventListener("error", () => reject(request.error));
        request.addEventListener("blocked", () => reject(new Error("La base quedó bloqueada.")));
      }),
  );
  await page.reload();
  await expect(page.getByRole("heading", { name: "Tus tiendas" })).toBeVisible({
    timeout: headingTimeout,
  });
}

/** Abre una copia mutable de la plantilla protegida conservando el catálogo de escala. */
export async function openMutableScaleStore(
  page: Page,
  name = "Tienda de escala mutable",
): Promise<string> {
  await expect(page.getByRole("heading", { name: "Tus tiendas" })).toBeVisible();
  await page.locator('[data-store-card-id="store-modo-sur-demo"]').click();
  await page
    .getByRole("region", { name: "Tienda seleccionada: Predeterminado" })
    .getByRole("button", { name: "Duplicar", exact: true })
    .click();
  const dialog = page.getByTestId("ui-duplicate-dialog");
  await expect(dialog).toBeVisible();
  await dialog.getByTestId("ui-duplicate-name").fill(name);
  await dialog.getByRole("button", { name: "Duplicar", exact: true }).click();
  await expect(dialog).toBeHidden();

  const copy = page.locator(".dashboard-store-card").filter({ hasText: name }).first();
  const id = await copy.locator(".dashboard-store-card__button").getAttribute("data-store-card-id");
  if (!id) throw new Error(`No se pudo identificar la copia mutable "${name}".`);
  await copy.locator(".dashboard-store-card__button").click();
  await page.getByRole("button", { name: "Abrir tienda", exact: true }).click();
  await expect(page.getByRole("navigation", { name: "Áreas de la tienda" })).toBeVisible();
  return id;
}
