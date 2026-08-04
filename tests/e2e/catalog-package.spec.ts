import type { Server } from "node:http";
import { expect, test } from "@playwright/test";
import { strToU8, zipSync } from "fflate";
import { createCleanStore } from "./project-helpers";
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

test("importa un ZIP comercial con imagen y crea categorías faltantes", async ({ page }) => {
  await page.goto(studioUrl);
  await page.evaluate(
    () =>
      new Promise<void>((resolve, reject) => {
        const request = indexedDB.deleteDatabase("solara-commerce-studio");
        request.addEventListener("success", () => resolve());
        request.addEventListener("error", () => reject(request.error));
      }),
  );
  await page.reload();
  await expect(page.getByRole("heading", { name: "Tus tiendas" })).toBeVisible();
  await createCleanStore(page, "Tienda de importación");
  await page.getByRole("button", { name: /Cat/ }).click();

  const csv = [
    "producto_id,variante_id,slug,titulo,descripcion,marca,estado,categorias,colecciones,etiquetas,imagenes,variante,sku,opciones,precio_centavos,precio_anterior_centavos,disponible,estado_stock,gtin,mpn,imagen_variante,creado_en,actualizado_en",
    ",,taza-nueva,Taza nueva,Taza para todos los dÃ­as,,active,Cocina>Favoritos,,casa,imagenes/taza.png,Ãšnica,TAZA-001,,125000,,, ,,,imagenes/taza.png,,",
  ].join("\r\n");
  const pixel = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
    "base64",
  );
  const archive = zipSync({ "productos.csv": strToU8(csv), "imagenes/taza.png": pixel });
  await page.locator('input[type="file"][accept=".zip,application/zip"]').setInputFiles({
    name: "catalogo.zip",
    mimeType: "application/zip",
    buffer: Buffer.from(archive),
  });

  await expect(page.getByRole("heading", { name: "catalogo.zip" })).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.getByText("Productos nuevos").locator("..")).toContainText("1");
  await page.getByRole("button", { name: "Agregar y actualizar" }).click();
  await expect(page.getByText(/1 productos y 1 variantes/)).toBeVisible({ timeout: 15_000 });
  const categoryTree = page.getByRole("region", { name: /rbol de categor/ });
  const categoryList = categoryTree.getByRole("list", { name: /Categor/ });
  await expect(categoryList.getByText("Cocina", { exact: true })).toBeVisible();
  await expect(categoryList.getByText("Favoritos", { exact: true })).toBeVisible();
});
