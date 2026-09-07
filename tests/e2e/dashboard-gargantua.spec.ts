import type { Server } from "node:http";
import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";
import { catalogModernCleanStore } from "@solara/project-schema/catalog-modern-template";
import { cloneProjectFromTemplate } from "@solara/project-schema/project-policy";
import { startStudioServer, stopStudioServer } from "./studio-server";

let server: Server;
let url: string;
test.beforeAll(async () => {
  const running = await startStudioServer();
  server = running.server;
  url = running.url;
});
test.afterAll(async () => stopStudioServer(server));

async function seedLibrary(page: Page, count = 120) {
  const names = [
    "Luna Norte",
    "Stylo Lashes",
    "RM Descartables",
    "Casa Oliva",
    "Atelier Sur",
    "Nómada",
    "Bruma",
    "Flora Estudio",
    "Café del Mar",
    "Ámbar Objetos",
    "Origen Natural",
    "Marea Textil",
  ];
  const records = Array.from({ length: count }, (_, index) => {
    const project = cloneProjectFromTemplate(catalogModernCleanStore, {
      id: `store-gargantua-${String(index).padStart(3, "0")}`,
      name: names[index] ?? `Tienda ${String(index + 1).padStart(3, "0")}`,
      slug: `gargantua-${index}`,
      now: "2026-09-07T12:00:00.000Z",
    });
    return {
      id: project.id,
      name: project.name,
      status: project.status,
      updatedAt: project.updatedAt,
      project,
    };
  });
  // Sólo IndexedDB del contexto aislado de Playwright. Nunca toca proyectos/.
  await page.evaluate(
    (items) =>
      new Promise<void>((resolve, reject) => {
        const open = indexedDB.open("solara-commerce-studio");
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result;
          const tx = db.transaction("projects", "readwrite");
          const store = tx.objectStore("projects");
          store.clear();
          for (const item of items) store.put(item);
          tx.oncomplete = () => {
            db.close();
            resolve();
          };
          tx.onerror = () => {
            db.close();
            reject(tx.error);
          };
        };
      }),
    records,
  );
  await page.reload();
  await expect(page.locator(".dashboard-cosmic-count")).toHaveText(`${count + 1} visibles`);
  const notice = page.getByRole("button", { name: "Cerrar aviso" });
  if (await notice.isVisible()) await notice.click();
  await page.getByRole("heading", { name: "Tus tiendas", exact: true }).click();
}

for (const [width, height] of [
  [1920, 950],
  [1366, 768],
  [1440, 900],
  [1024, 768],
  [390, 844],
  [320, 568],
]) {
  test(`biblioteca sin scroll a ${width}x${height}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.goto(url);
    await expect(page.getByRole("heading", { name: "Tus tiendas", exact: true })).toBeVisible();
    await seedLibrary(page);
    if (width >= 1366) await expect(page.locator(".dashboard-store-card")).toHaveCount(12);
    await page.screenshot({ path: `test-results/gargantua-${width}.png` });
    await expect(page.getByRole("navigation", { name: "Páginas de tiendas" })).toBeVisible();
    const overflow = await page.evaluate(() => {
      const root = document.documentElement;
      const violations =
        root.scrollHeight > root.clientHeight + 1 || root.scrollWidth > root.clientWidth + 1;
      const panels = [
        ...document.querySelectorAll<HTMLElement>(
          ".dashboard-cosmic-results, .dashboard-cosmic-store-groups, .dashboard-store-detail.is-open",
        ),
      ];
      return (
        violations ||
        panels.some(
          (el) =>
            el.getBoundingClientRect().width > 0 &&
            (el.scrollHeight > el.clientHeight + 1 || el.scrollWidth > el.clientWidth + 1),
        )
      );
    });
    expect(overflow).toBe(false);
  });
}

test("120 tiendas: páginas, búsqueda global, fijadas y comparación entre páginas", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto(url);
  await expect(page.locator(".dashboard-store-card").first()).toBeVisible();
  await seedLibrary(page);
  const accessibility = await new AxeBuilder({ page })
    .include(".dashboard-gargantua")
    .withTags(["wcag2a", "wcag2aa"])
    .analyze();
  expect(accessibility.violations).toEqual([]);
  const first = await page
    .locator("[data-store-card-id]")
    .first()
    .getAttribute("data-store-card-id");
  await page.getByRole("button", { name: "Página siguiente" }).click();
  await expect(page.locator(`[data-store-card-id="${first}"]`)).toHaveCount(0);
  await page.getByRole("button", { name: "Fijar tienda", exact: true }).first().click();
  await expect(page.getByRole("button", { name: "Quitar de fijadas" })).toHaveCount(1);
  await page.getByRole("button", { name: "Comparar tiendas", exact: true }).click();
  await page.getByTestId("ui-card-compare").first().check();
  await page.getByRole("button", { name: "Página siguiente" }).click();
  await page.getByTestId("ui-card-compare").first().check();
  await page.getByRole("button", { name: "Comparar", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Cancelar", exact: true }).click();
  await page.getByRole("searchbox", { name: "Buscar tienda" }).fill("Tienda 120");
  await expect(page.locator(".dashboard-store-card")).toHaveCount(1);
  await expect(page.locator(".dashboard-store-card")).toContainText("Tienda 120");
  await page.getByRole("button", { name: "Limpiar búsqueda" }).click();
  await page.getByRole("button", { name: "Vista en lista" }).click();
  await expect(page.locator(".dashboard-store-card")).toHaveCount(5);
});

test("detalle administrado completo, móvil y teclado", async ({ page }) => {
  const project = cloneProjectFromTemplate(catalogModernCleanStore, {
    id: "store-managed-gargantua",
    name: "Stylo Lashes",
    slug: "stylo-lashes",
  });
  const managed = await startStudioServer({
    managedProject: {
      projectId: project.id,
      name: project.name,
      slug: project.slug,
      version: 15,
      updatedAt: project.updatedAt,
      savedAt: project.updatedAt,
      folder: "gargantua-readonly",
      currentBytes: new TextEncoder().encode(
        JSON.stringify({
          format: "solara-project",
          version: 2,
          projectId: project.id,
          exportedAt: project.updatedAt,
          project,
        }),
      ),
    },
  });
  try {
    for (const [width, height] of [
      [1366, 768],
      [390, 844],
      [320, 568],
    ]) {
      await page.setViewportSize({ width, height });
      await page.goto(managed.url);
      await page.locator(".dashboard-store-card__button").first().click();
      const detail = page.getByRole("region", { name: "Tienda seleccionada: Stylo Lashes" });
      await expect(detail).toBeVisible();
      await expect(detail.getByRole("button", { name: "Abrir carpeta" })).toBeVisible();
      await page.screenshot({ path: `test-results/gargantua-managed-${width}.png` });
      expect(
        await detail.evaluate((el) => ({ scroll: el.scrollHeight, client: el.clientHeight })),
      ).toEqual(
        expect.objectContaining({ scroll: await detail.evaluate((el) => el.clientHeight) }),
      );
      await detail.getByRole("button", { name: "Calculadora", exact: true }).click();
      await expect(page.getByRole("dialog", { name: "Precio de tu tienda online" })).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(detail.getByRole("button", { name: "Calculadora", exact: true })).toBeFocused();
      await detail.getByRole("button", { name: "Cerrar detalle" }).click();
      await expect(page.getByRole("navigation", { name: "Páginas de tiendas" })).toBeVisible();
    }
    expect(managed.writeAttempts).toEqual([]);
  } finally {
    await stopStudioServer(managed.server);
  }
});
