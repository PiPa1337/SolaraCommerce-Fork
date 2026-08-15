/**
 * Smoke E2E del shell Electron: dos copias aisladas, Guardar real y traslado.
 * Requiere una distribución creada por `pnpm desktop:package`.
 */

import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { cp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { _electron as electron } from "@playwright/test";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const source = resolve(root, ".release/portable/SolaraCommerce-Portable");
const sourceExecutable = join(source, "SolaraCommerce.exe");
if (!existsSync(sourceExecutable)) {
  throw new Error("No existe la distribución portable. Ejecutá `pnpm desktop:package` primero.");
}

const testRoot = mkdtempSync(join(tmpdir(), "solara-portable-e2e-"));
const copyA = join(testRoot, "Copia A - árbol");
const copyB = join(testRoot, "Copia B - βeta");
const movedA = join(testRoot, "Copia movida - espacio y ü");

async function openPortable(folder) {
  const app = await electron.launch({
    executablePath: join(folder, "SolaraCommerce.exe"),
    timeout: 20_000,
  });
  const page = await app.firstWindow({ timeout: 20_000 });
  await page.getByRole("heading", { name: "Tus tiendas" }).waitFor({ timeout: 20_000 });
  return { app, page };
}

async function closePortable(instance) {
  try {
    const closeButton = instance.page.getByRole("button", { name: "Cerrar app" });
    if (await closeButton.isVisible({ timeout: 1_000 })) await closeButton.click();
  } catch {
    // close() es el fallback si el renderer ya no está disponible.
  }
  await instance.app.close();
}

async function assertPortableDiagnostics(instance, folder) {
  const diagnostics = await instance.page.evaluate(() => window.solaraDesktop?.diagnostics?.());
  if (!diagnostics?.portableRoot || !diagnostics?.profileRoot) {
    throw new Error("El shell no expuso diagnósticos portables.");
  }
  const expectedRoot = resolve(folder);
  if (resolve(diagnostics.portableRoot) !== expectedRoot) {
    throw new Error("La instancia resolvió una raíz portable distinta a su carpeta.");
  }
  if (
    !resolve(diagnostics.profileRoot).startsWith(
      `${expectedRoot}${process.platform === "win32" ? "\\" : "/"}`,
    )
  ) {
    throw new Error("El perfil Electron quedó fuera de la raíz portable.");
  }
  if (diagnostics.gpuMode !== "hardware" && diagnostics.gpuMode !== "software") {
    throw new Error(`El shell no expuso el modo de composición (${diagnostics.gpuMode}).`);
  }
}

try {
  await Promise.all([
    cp(source, copyA, { recursive: true }),
    cp(source, copyB, { recursive: true }),
  ]);

  const [instanceA, instanceB] = await Promise.all([openPortable(copyA), openPortable(copyB)]);
  await Promise.all([
    assertPortableDiagnostics(instanceA, copyA),
    assertPortableDiagnostics(instanceB, copyB),
  ]);
  const openedStoreId = async (page) => {
    const id = await page
      .locator("[data-store-card-id]")
      .first()
      .getAttribute("data-store-card-id");
    if (!id) throw new Error("El dashboard no expuso la tienda a abrir.");
    return id;
  };
  const storeFolder = (folder, storeId) => {
    const projectFolder = readdirSync(join(folder, "proyectos"), { withFileTypes: true }).find(
      (entry) =>
        entry.isDirectory() &&
        JSON.parse(readFileSync(join(folder, "proyectos", entry.name, "manifest.json"), "utf8"))
          .projectId === storeId,
    );
    if (!projectFolder) throw new Error(`La copia portable no contiene la tienda ${storeId}.`);
    return join(folder, "proyectos", projectFolder.name);
  };
  const projectIdA = await openedStoreId(instanceA.page);
  const projectIdB = await openedStoreId(instanceB.page);
  const manifestAPath = join(storeFolder(copyA, projectIdA), "manifest.json");
  const manifestBPath = join(storeFolder(copyB, projectIdB), "manifest.json");
  const initialA = JSON.parse(readFileSync(manifestAPath, "utf8"));
  const initialB = JSON.parse(readFileSync(manifestBPath, "utf8"));

  await instanceA.page.getByRole("button", { name: "Abrir esta tienda" }).first().click();
  const previewFrame = instanceA.page.locator('iframe[title="Vista previa desktop"]');
  await previewFrame.waitFor({ state: "visible", timeout: 20_000 });
  const previewState = await previewFrame.evaluate((frame) => ({
    sandbox: frame.getAttribute("sandbox") ?? "",
    ready: frame.contentDocument?.readyState === "complete",
    heading: frame.contentDocument?.querySelector("h1")?.textContent?.trim() ?? "",
  }));
  if (
    !previewState.sandbox.includes("allow-same-origin") ||
    !previewState.ready ||
    !previewState.heading
  ) {
    throw new Error("El preview Electron no montó el srcdoc aislado de la tienda.");
  }
  // El arranque puede guardar un RecoveryDraft cuando el demo de IndexedDB
  // difiere del seed en disco (App.tsx); este gate quiere la verdad del disco:
  // espera el tab del editor y, si el diálogo de recuperación aparece, lo
  // descarta. Bucle tolerante a la latencia de aparición del diálogo.
  const preview = instanceA.page.frameLocator('iframe[title="Vista previa desktop"]');
  const productPaths = await preview
    .locator('a[href^="/productos/"]')
    .evaluateAll((links) =>
      [...new Set(links.map((link) => link.getAttribute("href")))].filter(Boolean),
    );
  if (productPaths.length < 2) throw new Error("El preview portable no expuso dos productos.");
  const storeId = await preview.locator("html").getAttribute("data-store-id");
  if (!storeId) throw new Error("El preview portable no expuso el ID de la tienda.");
  await instanceA.page.evaluate((id) => localStorage.removeItem(`solara-cart:${id}`), storeId);
  const routeInput = instanceA.page.getByTestId("ui-preview-route");
  for (const [index, path] of productPaths.slice(0, 2).entries()) {
    await routeInput.fill(path);
    await routeInput.press("Enter");
    await preview.getByRole("heading", { level: 1 }).waitFor({ timeout: 20_000 });
    await preview.getByRole("button", { name: "Agregar al carrito" }).click();
    const expectedCount = String(index + 1);
    await preview.locator("[data-cart-count]").first().waitFor({ state: "visible" });
    const count = await preview.locator("[data-cart-count]").first().textContent();
    if (count !== expectedCount)
      throw new Error(`El carrito portable esperaba ${expectedCount}, recibió ${count}.`);
  }
  await routeInput.fill("/carrito/");
  await routeInput.press("Enter");
  await preview
    .locator(".solara-cart-page-grid [data-cart-lines] .solara-cart-line")
    .nth(1)
    .waitFor({ timeout: 20_000 });
  const portableLines = await preview
    .locator(".solara-cart-page-grid [data-cart-lines] .solara-cart-line")
    .count();
  if (portableLines !== 2)
    throw new Error(`El carrito portable conservó ${portableLines} líneas en vez de 2.`);

  for (let attempt = 0; attempt < 12; attempt++) {
    const tab = instanceA.page.getByRole("tab", { name: "Resumen", exact: true });
    if (await tab.isVisible({ timeout: 500 }).catch(() => false)) break;
    const dialog = instanceA.page.getByRole("dialog").first();
    if (await dialog.isVisible({ timeout: 500 }).catch(() => false)) {
      const discard = dialog.getByRole("button", { name: "Descartar borrador" });
      if (await discard.count()) {
        await discard.click();
        continue;
      }
    }
    await instanceA.page.waitForTimeout(1_000);
  }
  await instanceA.page.getByRole("tab", { name: "Resumen", exact: true }).click();
  const name = instanceA.page.getByLabel("Nombre de la tienda");
  await name.fill("Predeterminado portable A");
  await instanceA.page.locator("[data-studio-save]").click();
  await instanceA.page.locator(".save-indicator--saved").waitFor({ timeout: 30_000 });

  const savedA = JSON.parse(readFileSync(manifestAPath, "utf8"));
  if (savedA.current.version <= initialA.current.version) {
    throw new Error("Guardar no incrementó la versión en la copia A.");
  }
  if (!savedA.lastValidSite?.directoryPath) {
    throw new Error("Guardar no conservó un sitio público válido en la copia A.");
  }
  if (!existsSync(join(copyA, savedA.lastValidSite.directoryPath, "index.html"))) {
    throw new Error("El sitio público confirmado de A no contiene index.html.");
  }

  const publicSiteUrl = await instanceA.page.evaluate((projectId) => {
    if (!window.solaraDesktop?.openSite) throw new Error("Falta el puente para abrir el sitio.");
    return window.solaraDesktop.openSite(projectId);
  }, initialA.projectId);
  const publicResponse = await fetch(publicSiteUrl);
  if (!publicResponse.ok || !(await publicResponse.text()).includes("<!doctype html>")) {
    throw new Error("El servidor temporal no devolvió el sitio público guardado.");
  }
  const outsideResponse = await fetch(`${publicSiteUrl}/../manifest.json`);
  if (outsideResponse.status !== 404 && outsideResponse.status !== 403) {
    throw new Error("El servidor temporal permitió leer fuera de la carpeta pública.");
  }

  const bodyB = await instanceB.page.locator("body").innerText();
  if (bodyB.includes("Predeterminado portable A")) {
    throw new Error("La copia B vio cambios guardados exclusivamente en A.");
  }
  const unchangedB = JSON.parse(readFileSync(manifestBPath, "utf8"));
  if (unchangedB.current.version !== initialB.current.version) {
    throw new Error("La copia B cambió su versión al guardar A.");
  }

  await closePortable(instanceA);
  await closePortable(instanceB);
  await cp(copyA, movedA, { recursive: true });
  await rm(copyA, { recursive: true, force: true });

  const moved = await openPortable(movedA);
  try {
    const movedBody = await moved.page.locator("body").innerText();
    if (!movedBody.includes("Predeterminado portable A")) {
      throw new Error("La copia movida no recuperó el proyecto guardado.");
    }
  } finally {
    await closePortable(moved);
  }

  const profileA = join(movedA, ".solara-runtime", "electron-user-data");
  const profileB = join(copyB, ".solara-runtime", "electron-user-data");
  if (resolve(profileA) === resolve(profileB))
    throw new Error("Los perfiles portables colisionan.");
  console.log("portable e2e: OK");
} finally {
  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      rmSync(testRoot, { recursive: true, force: true });
      break;
    } catch (error) {
      const retriable = error?.code === "EPERM" || error?.code === "EBUSY";
      if (!retriable || attempt === 5) {
        console.warn(`portable e2e: limpieza de ${testRoot} incompleta (${error?.code ?? error})`);
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 1_000 * attempt));
    }
  }
}
