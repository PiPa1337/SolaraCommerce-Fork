import { type ChildProcess, spawn } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { expect, test } from "@playwright/test";
import { buildCatalogModernProject } from "@solara/project-schema/catalog-modern-template";

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

function seedDiskStore(applicationRoot: string): void {
  const project = buildCatalogModernProject({
    seed: "clean",
    id: "store-preexistente",
    name: "Tienda previa",
    slug: "tienda-previa",
  });
  const key = "tienda-previa-2026-08-07T10-00-00-000Z-v000001";
  const storeRoot = join(applicationRoot, "proyectos", "tienda-previa--preexistente");
  const actualRoot = join(storeRoot, "actual");
  mkdirSync(actualRoot, { recursive: true });
  const envelope = {
    format: "solara-project",
    version: 2,
    projectId: project.id,
    exportedAt: "2026-08-07T10:00:00.000Z",
    project,
  };
  const json = `${JSON.stringify(envelope, null, 2)}\n`;
  writeFileSync(join(actualRoot, `${key}.solara.json`), json, "utf8");
  const manifest = {
    format: "solara-local-project",
    manifestVersion: 2,
    projectId: project.id,
    storeName: project.name,
    slug: project.slug,
    schemaVersion: 2,
    status: "synced",
    current: {
      version: 1,
      key,
      projectPath: `actual/${key}.solara.json`,
      sha256: createHash("sha256").update(json).digest("hex"),
      savedAt: "2026-08-07T10:00:00.000Z",
      projectUpdatedAt: project.updatedAt,
    },
  };
  writeFileSync(
    join(storeRoot, "manifest.json"),
    `${JSON.stringify(manifest, null, 2)}\n`,
    "utf8",
  );
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
    // La primera ejecución crea Predeterminado y Predeterminado Revamp y
    // exporta el sitio de cada una antes de mostrar el dashboard.
    await expect(page.getByRole("heading", { name: "Tus tiendas" })).toBeVisible({
      timeout: 20_000,
    });
    await expect
      .poll(() => existsSync(join(applicationRoot, "proyectos")), { timeout: 15_000 })
      .toBe(true);

    await page
      .locator('article:has([data-store-card-id="store-modo-sur-demo"])')
      .getByRole("button", { name: "Abrir esta tienda" })
      .click();
    await page.getByRole("button", { name: "Resumen" }).click();
    const name = page.getByLabel("Nombre de la tienda");
    await name.fill("Predeterminado editado");
    await page.locator("[data-studio-save]").click();
    await expect(page.locator(".save-indicator")).toContainText("Guardado");

    const manifests = await page.evaluate(async () => {
      const response = await fetch("/__solara/storage/projects", { credentials: "same-origin" });
      return response.json();
    });
    expect(manifests.projects).toHaveLength(2);
    const demoProject = manifests.projects.find(
      (project) => project.projectId === "store-modo-sur-demo",
    );
    expect(demoProject, "el proyecto editado debe estar en disco").toBeTruthy();
    expect(demoProject?.version).toBe(2);

    const folder = demoProject?.folder as string;
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
    expect(shortcutListing.projects).toHaveLength(2);
    const demoShortcut = shortcutListing.projects.find(
      (project) => project.projectId === "store-modo-sur-demo",
    );
    expect(demoShortcut?.version).toBe(3);

    await page.getByRole("button", { name: "Volver a tiendas" }).click();
    await expect(page.getByRole("heading", { name: "Tus tiendas" })).toBeVisible();
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

test("con proyectos existentes en disco, la candidata revamp se agrega al dashboard", async ({
  page,
}) => {
  const applicationRoot = mkdtempSync(join(tmpdir(), "solara-managed-seeded-"));
  const port = 4500 + Math.floor(Math.random() * 100);
  const token = randomBytes(24).toString("base64url");
  const url = `http://127.0.0.1:${port}`;
  seedDiskStore(applicationRoot);
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
    await expect(page.getByRole("heading", { name: "Tus tiendas" })).toBeVisible({
      timeout: 30_000,
    });
    await expect(
      page.locator(".dashboard-store-card").getByText("Predeterminado Revamp", { exact: true }),
    ).toBeVisible({
      timeout: 30_000,
    });
    const listing = await page.evaluate(async () => {
      const response = await fetch("/__solara/storage/projects", { credentials: "same-origin" });
      return response.json();
    });
    const ids = listing.projects.map((project: { projectId: string }) => project.projectId);
    expect(ids).toContain("store-preexistente");
    expect(ids).toContain("store-modo-sur-revamp");
  } finally {
    if (serverProcess.exitCode === null) serverProcess.kill();
    rmSync(applicationRoot, { recursive: true, force: true });
  }
});
