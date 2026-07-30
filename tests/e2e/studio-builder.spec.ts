import type { Server } from "node:http";
import { expect, type Page, test } from "@playwright/test";
import { startStudioServer, stopStudioServer } from "./studio-server";

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
  await expect(page.getByRole("heading", { name: "Tus tiendas" })).toBeVisible();
  await page.getByRole("button", { name: /Casa Luma/ }).click();
  await page.getByRole("button", { name: "Constructor" }).click();
  await expect(page.getByRole("heading", { name: "Constructor" })).toBeVisible();
}

test("edita el contenido, actualiza el preview y persiste tras recargar", async ({ page }) => {
  await openBuilder(page);
  const hero = page.getByRole("listitem").filter({ hasText: "Hero dividido" });
  await hero.getByRole("button").first().click();

  const title = page.getByRole("textbox", { name: "Título", exact: true });
  await title.fill("Una portada persistente");
  await expect(page.getByText("Cambios pendientes", { exact: true })).toBeVisible();
  await expect(
    page.frameLocator("iframe").getByRole("heading", { name: "Una portada persistente" }),
  ).toBeVisible();
  await expect(page.getByText("Guardado", { exact: true })).toBeVisible();

  await page.reload();
  await expect(page.getByRole("heading", { name: "Tus tiendas" })).toBeVisible();
  await page.getByRole("button", { name: /Casa Luma/ }).click();
  await page.getByRole("button", { name: "Constructor" }).click();
  await page
    .getByRole("listitem")
    .filter({ hasText: "Hero dividido" })
    .getByRole("button")
    .first()
    .click();

  await expect(page.getByRole("textbox", { name: "Título", exact: true })).toHaveValue(
    "Una portada persistente",
  );
  await expect(
    page.frameLocator("iframe").getByRole("heading", { name: "Una portada persistente" }),
  ).toBeVisible();
});

test("agrega, ordena, duplica, oculta, reemplaza, deshace y elimina secciones", async ({
  page,
}) => {
  await openBuilder(page);
  const sections = page.getByRole("list", { name: "Secciones de la tienda" });
  const initialCount = await sections.getByRole("listitem").count();

  await page.getByLabel("Tipo de sección").selectOption("content");
  await page.getByRole("button", { name: "Agregar sección" }).click();
  await expect(sections.getByRole("listitem")).toHaveCount(initialCount + 1);

  const added = sections.getByRole("listitem").last();
  await expect(added).toContainText("Contenido imagen y texto");
  await added.getByRole("button", { name: "Mover arriba" }).click();
  await expect(sections.getByRole("listitem").nth(initialCount - 1)).toContainText(
    "Contenido imagen y texto",
  );

  const selectedAdded = sections
    .getByRole("listitem")
    .filter({ hasText: "Contenido imagen y texto" })
    .first();
  await selectedAdded.getByRole("button", { name: "Duplicar sección" }).click();
  await expect(
    sections.getByRole("listitem").filter({ hasText: "Contenido imagen y texto" }),
  ).toHaveCount(2);

  const duplicate = sections
    .getByRole("listitem")
    .filter({ hasText: "Contenido imagen y texto" })
    .last();
  await duplicate.getByRole("button", { name: "Eliminar sección" }).click();
  await expect(
    sections.getByRole("listitem").filter({ hasText: "Contenido imagen y texto" }),
  ).toHaveCount(1);

  const hero = sections.getByRole("listitem").filter({ hasText: "Hero dividido" });
  await hero.getByRole("button").first().click();
  await page.getByLabel("Módulo").selectOption({ label: "Hero editorial" });
  const replacedHero = sections.getByRole("listitem").filter({ hasText: "Hero editorial" });
  await expect(replacedHero).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Título", exact: true })).toHaveValue(
    "Una casa con materia y calma.",
  );

  await replacedHero.getByRole("button", { name: "Ocultar sección" }).click();
  await expect(
    page.frameLocator("iframe").getByRole("heading", { name: "Una casa con materia y calma." }),
  ).toHaveCount(0);

  await page.getByRole("button", { name: "Deshacer" }).click();
  await expect(
    page.frameLocator("iframe").getByRole("heading", { name: "Una casa con materia y calma." }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Rehacer" }).click();
  await expect(
    page.frameLocator("iframe").getByRole("heading", { name: "Una casa con materia y calma." }),
  ).toHaveCount(0);

  const addedAgain = sections.getByRole("listitem").filter({ hasText: "Contenido imagen y texto" });
  await addedAgain.getByRole("button", { name: "Eliminar sección" }).click();
  await expect(sections.getByRole("listitem")).toHaveCount(initialCount);
});
