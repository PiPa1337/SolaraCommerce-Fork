/**
 * Smoke E2E del shell Electron: dos copias aisladas, Guardar real y traslado.
 * Requiere una distribuciÃ³n creada por `pnpm desktop:package`.
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
  throw new Error("No existe la distribuciÃ³n portable. EjecutÃ¡ `pnpm desktop:package` primero.");
}

const testRoot = mkdtempSync(join(tmpdir(), "solara-portable-e2e-"));
const copyA = join(testRoot, "Copia A - Ã¡rbol");
const copyB = join(testRoot, "Copia B - Î²eta");
const movedA = join(testRoot, "Copia movida - espacio y Ã¼");

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
  const manifestFolder = (folder) => {
    const projectFolder = readdirSync(join(folder, "proyectos"), { withFileTypes: true }).find(
      (entry) => entry.isDirectory(),
    );
    if (!projectFolder) throw new Error("La copia portable no contiene una tienda.");
    return join(folder, "proyectos", projectFolder.name);
  };
  const manifestAPath = join(manifestFolder(copyA), "manifest.json");
  const manifestBPath = join(manifestFolder(copyB), "manifest.json");
  const initialA = JSON.parse(readFileSync(manifestAPath, "utf8"));
  const initialB = JSON.parse(readFileSync(manifestBPath, "utf8"));

  await instanceA.page.getByRole("button", { name: "Abrir esta tienda" }).first().click();
  await instanceA.page.getByRole("button", { name: "Resumen", exact: true }).click();
  const name = instanceA.page.getByLabel("Nombre de la tienda");
  await name.fill("Predeterminado portable A");
  await instanceA.page.locator("[data-studio-save]").click();
  await instanceA.page.locator(".save-indicator--saved").waitFor({ timeout: 30_000 });

  const savedA = JSON.parse(readFileSync(manifestAPath, "utf8"));
  if (savedA.current.version <= initialA.current.version) {
    throw new Error("Guardar no incrementÃ³ la versiÃ³n en la copia A.");
  }
  if (!savedA.lastValidSite?.directoryPath) {
    throw new Error("Guardar no conservÃ³ un sitio pÃºblico vÃ¡lido en la copia A.");
  }
  if (!existsSync(join(copyA, savedA.lastValidSite.directoryPath, "index.html"))) {
    throw new Error("El sitio pÃºblico confirmado de A no contiene index.html.");
  }

  const publicSiteUrl = await instanceA.page.evaluate((projectId) => {
    if (!window.solaraDesktop?.openSite) throw new Error("Falta el puente para abrir el sitio.");
    return window.solaraDesktop.openSite(projectId);
  }, initialA.projectId);
  const publicResponse = await fetch(publicSiteUrl);
  if (!publicResponse.ok || !(await publicResponse.text()).includes("<!doctype html>")) {
    throw new Error("El servidor temporal no devolviÃ³ el sitio pÃºblico guardado.");
  }
  const outsideResponse = await fetch(`${publicSiteUrl}/../manifest.json`);
  if (outsideResponse.status !== 404 && outsideResponse.status !== 403) {
    throw new Error("El servidor temporal permitiÃ³ leer fuera de la carpeta pÃºblica.");
  }

  const bodyB = await instanceB.page.locator("body").innerText();
  if (bodyB.includes("Predeterminado portable A")) {
    throw new Error("La copia B vio cambios guardados exclusivamente en A.");
  }
  const unchangedB = JSON.parse(readFileSync(manifestBPath, "utf8"));
  if (unchangedB.current.version !== initialB.current.version) {
    throw new Error("La copia B cambiÃ³ su versiÃ³n al guardar A.");
  }

  await closePortable(instanceA);
  await closePortable(instanceB);
  await cp(copyA, movedA, { recursive: true });
  await rm(copyA, { recursive: true, force: true });

  const moved = await openPortable(movedA);
  try {
    const movedBody = await moved.page.locator("body").innerText();
    if (!movedBody.includes("Predeterminado portable A")) {
      throw new Error("La copia movida no recuperÃ³ el proyecto guardado.");
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
  rmSync(testRoot, { recursive: true, force: true });
}
