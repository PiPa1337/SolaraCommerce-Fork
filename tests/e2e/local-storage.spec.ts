import { type ChildProcess, spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { expect, test } from "@playwright/test";

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

test("el lanzador persiste el proyecto y el sitio fuera de IndexedDB", async ({ page }) => {
  const applicationRoot = mkdtempSync(join(tmpdir(), "solara-managed-e2e-"));
  const port = 4300 + Math.floor(Math.random() * 200);
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
    await page.goto(url);
    await expect(page.getByRole("heading", { name: "Tus tiendas" })).toBeVisible();
    await expect
      .poll(() => existsSync(join(applicationRoot, "proyectos")), { timeout: 15_000 })
      .toBe(true);

    await page
      .locator('article:has([data-store-card-id="store-modo-sur-demo"])')
      .getByRole("button", { name: "Abrir esta tienda" })
      .click();
    await page.getByRole("tab", { name: "Resumen" }).click();
    const name = page.getByLabel("Nombre de la tienda");
    await name.fill("Predeterminado editado");
    await page.locator("[data-studio-save]").click();
    await expect(page.locator(".save-indicator")).toContainText("Guardado");

    const manifests = await page.evaluate(async () => {
      const response = await fetch("/__solara/storage/projects", { credentials: "same-origin" });
      return response.json();
    });
    expect(manifests.projects).toHaveLength(1);
    expect(manifests.projects[0].version).toBe(2);

    const folder = manifests.projects[0].folder as string;
    const manifest = JSON.parse(
      readFileSync(join(applicationRoot, "proyectos", folder, "manifest.json"), "utf8"),
    ) as { current: { version: number }; lastValidSite?: { directoryPath: string } };
    expect(manifest.current.version).toBe(2);
    expect(manifest.lastValidSite?.directoryPath).toBeTruthy();
    expect(
      existsSync(join(applicationRoot, manifest.lastValidSite?.directoryPath ?? "", "index.html")),
    ).toBe(true);

    await name.fill("Predeterminado con atajo");
    await page.keyboard.press("Control+s");
    await expect(page.locator(".save-indicator--saved")).toContainText("Guardado");
    const shortcutListing = await page.evaluate(async () => {
      const response = await fetch("/__solara/storage/projects", { credentials: "same-origin" });
      return response.json();
    });
    expect(shortcutListing.projects[0].version).toBe(3);

    await page.getByRole("button", { name: "Volver a tiendas" }).click();
    await expect(page.getByRole("heading", { name: "Tus tiendas" })).toBeVisible();
    await page.locator('[data-store-card-id="store-modo-sur-demo"]').click();
    const popupPromise = page.waitForEvent("popup");
    await page.getByRole("button", { name: "Abrir sitio público" }).click();
    const popup = await popupPromise;
    await popup.waitForLoadState("domcontentloaded");
    await expect(popup).toHaveTitle(/Modo Sur|Predeterminado/i);
    await popup.close();
  } finally {
    if (serverProcess.exitCode === null) serverProcess.kill();
    rmSync(applicationRoot, { recursive: true, force: true });
  }
});

