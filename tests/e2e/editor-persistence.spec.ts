/**
 * T0.8 — Multi-tab y recovery draft con el servidor gestionado.
 * Verifica el conflicto 409 entre dos pestañas (mensaje claro y las opciones
 * recargar disco / conservar borrador / duplicar) y el diálogo de recuperación
 * del borrador al volver a abrir la tienda tras una recarga.
 */
import { type ChildProcess, spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { type Browser, expect, type Page, test } from "@playwright/test";

test.setTimeout(process.env.CI ? 180_000 : 120_000);

async function waitForServer(url: string): Promise<void> {
  await expect
    .poll(
      async () => {
        try {
          return (await fetch(`${url}/__solara/session`)).status;
        } catch {
          return 0;
        }
      },
      { timeout: 10_000, intervals: [100, 250, 500] },
    )
    .toBe(200);
}

interface ManagedServer {
  url: string;
  root: string;
  process: ChildProcess;
}

async function startManagedServer(): Promise<ManagedServer> {
  const applicationRoot = mkdtempSync(join(tmpdir(), "solara-persistence-e2e-"));
  const port = 4700 + Math.floor(Math.random() * 200);
  const token = randomBytes(24).toString("base64url");
  const url = `http://127.0.0.1:${port}`;
  const serverProcess: ChildProcess = spawn(
    process.execPath,
    [
      resolve("packages/exporter/scripts/serve.mjs"),
      resolve("apps/studio/dist"),
      String(port),
      token,
      applicationRoot,
    ],
    { cwd: resolve("."), stdio: "ignore" },
  );
  try {
    await waitForServer(url);
  } catch (reason) {
    serverProcess.kill();
    rmSync(applicationRoot, { recursive: true, force: true });
    throw reason;
  }
  return { url, root: applicationRoot, process: serverProcess };
}

async function stopManagedServer(managed: ManagedServer): Promise<void> {
  if (managed.process.exitCode === null) managed.process.kill();
  rmSync(managed.root, { recursive: true, force: true });
}

async function openDashboard(page: Page, url: string): Promise<void> {
  await page.goto(url);
  await expect(page.getByRole("heading", { name: "Tus tiendas" })).toBeVisible({
    timeout: 30_000,
  });
}

async function openDemoStore(page: Page): Promise<void> {
  await page
    .locator('article:has([data-store-card-id="store-modo-sur-demo"])')
    .getByRole("button", { name: "Abrir esta tienda" })
    .click();
  await page.getByRole("tab", { name: "Resumen" }).click();
  await expect(page.getByLabel("Nombre de la tienda")).toBeVisible();
}

async function renameAndSave(page: Page, name: string): Promise<void> {
  await page.getByLabel("Nombre de la tienda").fill(name);
  await page.locator("[data-studio-save]").click();
  await expect(page.locator(".save-indicator")).toContainText("Guardado", { timeout: 60_000 });
}

/** Abre una segunda ventana aislada (IndexedDB propio) sobre el mismo servidor. */
async function openSecondTab(browser: Browser, url: string): Promise<Page> {
  const context = await browser.newContext();
  const page = await context.newPage();
  await openDashboard(page, url);
  return page;
}

async function createConflict(
  browser: Browser,
  url: string,
  first: string,
  second: string,
): Promise<{ pageA: Page; pageB: Page }> {
  const contextA = await browser.newContext();
  const pageA = await contextA.newPage();
  await openDashboard(pageA, url);
  await openDemoStore(pageA);
  await renameAndSave(pageA, first);

  const pageB = await openSecondTab(browser, url);
  await openDemoStore(pageB);
  await renameAndSave(pageB, second);

  await pageA.getByLabel("Nombre de la tienda").fill(`${first} (borrador local)`);
  await pageA.locator("[data-studio-save]").click();
  await expect(pageA.getByTestId("ui-conflict-dialog")).toBeVisible({ timeout: 60_000 });
  return { pageA, pageB };
}

test("dos pestañas: la segunda guardada genera 409 con opciones y conservar borrador permite recuperarlo", async ({
  browser,
}) => {
  const managed = await startManagedServer();
  try {
    const { pageA } = await createConflict(
      browser,
      managed.url,
      "Predeterminado A",
      "Predeterminado B",
    );
    await expect(pageA.getByTestId("ui-conflict-dialog")).toContainText("otra pestaña");

    await pageA.getByTestId("ui-conflict-keep").click();
    await expect(pageA.getByTestId("ui-conflict-dialog")).toHaveCount(0);
    await expect(pageA.getByTestId("ui-studio-notice")).toContainText("Borrador conservado");
    await expect(pageA.getByLabel("Nombre de la tienda")).toHaveValue(
      "Predeterminado A (borrador local)",
    );

    const dialogs: string[] = [];
    pageA.on("dialog", (dialog) => {
      dialogs.push(dialog.message());
      void dialog.accept();
    });
    await pageA.reload();
    await expect(pageA.getByRole("heading", { name: "Tus tiendas" })).toBeVisible({
      timeout: 30_000,
    });
    await openDemoStore(pageA);
    await expect(pageA.getByLabel("Nombre de la tienda")).toHaveValue(
      "Predeterminado A (borrador local)",
      { timeout: 30_000 },
    );
    expect(dialogs.some((message) => /borrador/i.test(message))).toBe(true);
  } finally {
    await stopManagedServer(managed);
  }
});

test("el conflicto 409 permite recargar desde disco y descarta el borrador local", async ({
  browser,
}) => {
  const managed = await startManagedServer();
  try {
    const { pageA } = await createConflict(
      browser,
      managed.url,
      "Predeterminado C",
      "Predeterminado D",
    );
    await pageA.getByTestId("ui-conflict-reload").click();

    await expect(pageA.locator(".studio-brand strong")).toHaveText("Predeterminado D", {
      timeout: 60_000,
    });
    await pageA.getByRole("tab", { name: "Resumen" }).click();
    await expect(pageA.getByLabel("Nombre de la tienda")).toHaveValue("Predeterminado D");
  } finally {
    await stopManagedServer(managed);
  }
});

test("el conflicto 409 permite duplicar con el borrador local y persiste la copia", async ({
  browser,
}) => {
  const managed = await startManagedServer();
  try {
    const { pageA } = await createConflict(
      browser,
      managed.url,
      "Predeterminado E",
      "Predeterminado F",
    );
    await pageA.getByTestId("ui-conflict-duplicate").click();

    await expect(pageA.locator(".studio-brand strong")).toHaveText(
      "Predeterminado E (borrador local) copia",
      { timeout: 60_000 },
    );
    await pageA.getByRole("button", { name: "Volver a tiendas" }).click();
    await expect(pageA.getByRole("heading", { name: "Tus tiendas" })).toBeVisible();
    await expect(
      pageA.locator(".dashboard-store-card").getByText("Predeterminado E (borrador local) copia", {
        exact: true,
      }),
    ).toBeVisible();

    const listing = await pageA.evaluate(async () => {
      const response = await fetch("/__solara/storage/projects", { credentials: "same-origin" });
      return response.json();
    });
    const names = listing.projects.map((project: { name: string }) => project.name);
    expect(names).toContain("Predeterminado E (borrador local) copia");
    expect(listing.projects).toHaveLength(3);
  } finally {
    await stopManagedServer(managed);
  }
});

test("al recargar con cambios sin guardar, el diálogo de borrador recupera la edición", async ({
  browser,
}) => {
  const managed = await startManagedServer();
  const context = await browser.newContext();
  const page = await context.newPage();
  try {
    await openDashboard(page, managed.url);
    await openDemoStore(page);
    await page.getByLabel("Nombre de la tienda").fill("Predeterminado borrador");
    await page.waitForTimeout(1_200);

    const dialogs: string[] = [];
    page.on("dialog", (dialog) => {
      dialogs.push(dialog.message());
      void dialog.accept();
    });
    await page.reload();
    await expect(page.getByRole("heading", { name: "Tus tiendas" })).toBeVisible({
      timeout: 30_000,
    });
    await openDemoStore(page);
    await expect(page.getByLabel("Nombre de la tienda")).toHaveValue("Predeterminado borrador", {
      timeout: 30_000,
    });
    expect(dialogs.some((message) => /borrador/i.test(message))).toBe(true);
  } finally {
    await context.close();
    await stopManagedServer(managed);
  }
});

test("el diálogo de conflicto 409 es modal, con nombre y opciones accesibles (T6.8)", async ({
  browser,
}) => {
  const managed = await startManagedServer();
  try {
    const { pageA } = await createConflict(
      browser,
      managed.url,
      "Predeterminado G",
      "Predeterminado H",
    );
    const dialog = pageA.getByTestId("ui-conflict-dialog");
    await expect(dialog).toHaveAttribute("role", "dialog");
    await expect(dialog).toHaveAttribute("aria-modal", "true");
    // React 19 genera ids de useId() con formato «r0», sin el prefijo
    // "conflict"; el contrato accesible es que aria-labelledby apunte al
    // título del diálogo.
    const labelledBy = await dialog.getAttribute("aria-labelledby");
    expect(labelledBy, "el diálogo referencia su título por id").not.toBeNull();
    await expect(
      dialog.getByRole("heading", { name: "La tienda cambió en otra pestaña" }),
    ).toHaveId(labelledBy ?? "");
    await expect(dialog.getByRole("heading", { name: "La tienda cambió en otra pestaña" })).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Conservar borrador" })).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Recargar desde disco" })).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Duplicar con mi borrador" })).toBeVisible();

    await dialog.getByRole("button", { name: "Conservar borrador" }).click();
    await expect(dialog).toHaveCount(0);
    await expect(pageA.getByTestId("ui-studio-notice")).toContainText("Borrador conservado");
  } finally {
    await stopManagedServer(managed);
  }
});
