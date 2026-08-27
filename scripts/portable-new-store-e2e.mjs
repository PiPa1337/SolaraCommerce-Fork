/**
 * Flujo nativo de usuario para una tienda nueva. No escribe proyectos con
 * comandos: todas las mutaciones pasan por la interfaz Electron real.
 * Requiere una distribución creada por `pnpm desktop:package`.
 */

import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { cp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { _electron as electron } from "@playwright/test";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const source = resolve(
  process.env.SOLARA_NEW_STORE_SOURCE ?? ".release/portable/SolaraCommerce-Portable",
);
const executable = join(source, "SolaraCommerce.exe");
const imagePath = resolve(root, "qa-assets/luna-norte/luna-norte-editorial.png");

if (!existsSync(executable)) {
  throw new Error("No existe la distribución portable. Ejecutá `pnpm desktop:package` primero.");
}
if (!existsSync(imagePath)) {
  throw new Error(`Falta el asset de prueba ${imagePath}.`);
}

const testRoot = mkdtempSync(join(tmpdir(), "solara-new-store-e2e-"));
const copy = join(testRoot, "Copia aislada - nueva tienda");
const storeName = `Tienda QA Nativa ${Date.now()}`;
let currentStep = "preparación";
let closingExpected = false;

function storeFolder(folder, projectId) {
  const entry = readdirSync(join(folder, "proyectos"), { withFileTypes: true }).find(
    (candidate) => {
      if (!candidate.isDirectory()) return false;
      try {
        const manifest = JSON.parse(
          readFileSync(join(folder, "proyectos", candidate.name, "manifest.json"), "utf8"),
        );
        return manifest.projectId === projectId;
      } catch {
        return false;
      }
    },
  );
  if (!entry) throw new Error(`No se encontró la carpeta de la tienda ${projectId}.`);
  return join(folder, "proyectos", entry.name);
}

function readProject(folder, projectId) {
  const directory = storeFolder(folder, projectId);
  const manifest = JSON.parse(readFileSync(join(directory, "manifest.json"), "utf8"));
  const projectPath = manifest.current?.projectPath;
  if (typeof projectPath !== "string")
    throw new Error(`La tienda ${projectId} no tiene proyecto actual.`);
  const stored = JSON.parse(readFileSync(join(directory, projectPath), "utf8"));
  return stored.project ?? stored;
}

function stableStoreSnapshot(project) {
  return JSON.stringify({
    id: project.id,
    name: project.name,
    slug: project.slug,
    status: project.status,
    whatsapp: project.whatsapp,
    productIds: project.products.map((product) => product.id),
    categoryIds: project.categories.map((category) => category.id),
    collectionIds: project.collections.map((collection) => collection.id),
  });
}

function containsId(ids, value) {
  return ids.includes(value);
}

async function openPortable() {
  const app = await electron.launch({
    executablePath: join(copy, "SolaraCommerce.exe"),
    args: ["--disable-gpu", "--disable-gpu-compositing", "--in-process-gpu"],
    timeout: 45_000,
  });
  let page;
  try {
    page = await app.firstWindow({ timeout: 45_000 });
  } catch (error) {
    try {
      await app.close();
    } catch {}
    throw error;
  }
  closingExpected = false;
  page.on("close", () => {
    if (!closingExpected) console.error(`Ventana Electron cerrada durante: ${currentStep}`);
  });
  page.on("crash", () => console.error(`Renderer Electron colapsó durante: ${currentStep}`));
  page.on("pageerror", (error) =>
    console.error(`Page error durante ${currentStep}: ${error.message}`),
  );
  page.on("console", (message) => {
    if (message.type() === "error")
      console.error(`Console error durante ${currentStep}: ${message.text()}`);
  });
  page.on("dialog", (dialog) => {
    void dialog.dismiss().catch(() => undefined);
  });
  await page.getByRole("heading", { name: "Tus tiendas" }).waitFor({ timeout: 20_000 });
  await page
    .getByRole("heading", { name: "Plantilla, reconstrucciones y migraciones" })
    .waitFor({ timeout: 20_000 });
  return { app, page };
}

async function closePortable(instance) {
  closingExpected = true;
  try {
    await instance.app.evaluate(({ app }) => app.exit(0));
  } catch {
    // close() es el fallback si el proceso ya no responde al puente Electron.
  }
  try {
    await instance.app.close();
  } catch {
    // La aplicación puede haber terminado durante app.exit(0).
  }
}

let instance;
try {
  await cp(source, copy, { recursive: true });
  // El portable fuente puede traer estado regenerable de una corrida anterior;
  // la prueba de UI necesita un perfil nuevo dentro de esta copia aislada.
  await rm(join(copy, ".solara-runtime"), {
    recursive: true,
    force: true,
    maxRetries: 3,
    retryDelay: 250,
  });
  currentStep = "abrir dashboard";
  const defaultBefore = readProject(copy, "store-modo-sur-demo");
  const defaultProductIds = defaultBefore.products.map((product) => product.id);
  const defaultCategoryIds = defaultBefore.categories.map((category) => category.id);
  const defaultCollectionIds = defaultBefore.collections.map((collection) => collection.id);
  instance = await openPortable();

  const page = instance.page;
  currentStep = "crear tienda desde dashboard";
  await page.getByRole("button", { name: "Nueva tienda", exact: true }).click();
  const createDialog = page.getByRole("dialog", { name: "Crear tienda" });
  await createDialog.getByLabel("Nueva tienda").fill(storeName);
  for (let step = 0; step < 3; step += 1) {
    await createDialog.getByRole("button", { name: "Continuar", exact: true }).click();
  }
  await createDialog
    .getByRole("button", { name: "Crear tienda desde plantilla", exact: true })
    .click();
  currentStep = "esperar editor de tienda nueva";
  await page.getByRole("navigation", { name: "Áreas de la tienda" }).waitFor({ timeout: 20_000 });

  currentStep = "cargar imagen desde Recursos";
  await page.getByRole("tab", { name: "Recursos", exact: true }).click();
  await page.getByLabel("Seleccionar imágenes").setInputFiles(imagePath);
  const batchStatus = page.getByTestId("ui-asset-batch-status");
  await batchStatus.waitFor({ timeout: 20_000 });
  await page.getByTestId("ui-assets-progress").waitFor({ state: "hidden", timeout: 30_000 });
  const batchText = (await batchStatus.textContent()) ?? "";
  if (!batchText.includes("1 imagen agregada")) {
    throw new Error(`Recursos no incorporó la imagen de prueba: ${batchText}`);
  }
  currentStep = "abrir Catálogo";
  await page.getByRole("tab", { name: /^Catálogo/ }).click();

  currentStep = "crear categoría y colección";
  const taxonomy = page.getByRole("region", { name: "Árbol de categorías" });
  await taxonomy.getByRole("button", { name: "Categoría", exact: true }).click();
  let taxonomyEditor = page.getByRole("region", { name: "Editar organización" });
  await taxonomyEditor.locator("input").nth(0).fill("Ropa exterior");
  await taxonomyEditor.locator("textarea").fill("Prendas para todos los días.");
  await taxonomyEditor.getByRole("button", { name: "Crear", exact: true }).click();
  await taxonomy.locator(".category-tree").getByText("Ropa exterior", { exact: true }).waitFor();

  await taxonomy.getByRole("button", { name: "Colección", exact: true }).click();
  taxonomyEditor = page.getByRole("region", { name: "Editar organización" });
  await taxonomyEditor.locator("input").nth(0).fill("Selección de invierno");
  await taxonomyEditor.locator("textarea").fill("Una selección curada para la temporada.");
  await taxonomyEditor.getByRole("button", { name: "Crear", exact: true }).click();
  await taxonomy
    .locator(".taxonomy-collections")
    .getByText("Selección de invierno", { exact: true })
    .waitFor();

  currentStep = "crear y activar producto";
  await page.getByRole("button", { name: "Agregar producto", exact: true }).last().click();
  const productDialog = page.locator("dialog.product-dialog");
  await productDialog.getByLabel("Título").fill("Campera Bruma");
  await productDialog.getByLabel("Descripción").fill("Campera liviana para días frescos.");
  await productDialog.getByLabel("Precio en centavos").fill("890000");
  const productAsset = productDialog.locator(".product-asset-option input").first();
  await productAsset.waitFor({ state: "attached", timeout: 20_000 });
  await productAsset.check();
  await productDialog
    .locator("fieldset")
    .filter({ hasText: "Organización" })
    .getByLabel("Ropa exterior", { exact: true })
    .check();
  await productDialog
    .locator("fieldset")
    .filter({ hasText: "Organización" })
    .getByLabel("Selección de invierno", { exact: true })
    .check();
  await productDialog.getByRole("button", { name: "Crear y activar", exact: true }).click();
  await productDialog.waitFor({ state: "hidden", timeout: 20_000 });
  await page.getByLabel("Nombre de Campera Bruma", { exact: true }).waitFor();

  // La interfaz no debe permitir publicar un borrador incompleto.
  currentStep = "verificar bloqueo de activación incompleta";
  await page.getByRole("button", { name: "Agregar producto", exact: true }).last().click();
  const incompleteDialog = page.locator("dialog.product-dialog");
  await incompleteDialog.getByRole("button", { name: "Crear y activar", exact: true }).click();
  await page.getByText(/Para activar el producto completá/).waitFor();
  await incompleteDialog.getByRole("button", { name: "Cerrar editor", exact: true }).click();

  await page.locator("[data-studio-save]").click();
  currentStep = "guardar en disco y verificar preview";
  await page
    .locator(".save-indicator--saved, .save-indicator--site-outdated")
    .waitFor({ timeout: 30_000 });

  const preview = page.locator('iframe[title="Vista previa desktop"]');
  await preview.waitFor({ state: "visible", timeout: 20_000 });
  const newProjectId = await preview.evaluate((frame) =>
    frame.contentDocument?.documentElement?.getAttribute("data-store-id"),
  );
  if (!newProjectId) throw new Error("El preview no expuso el ID de la nueva tienda.");

  currentStep = "leer proyecto persistido";
  await closePortable(instance);
  instance = undefined;
  const created = readProject(copy, newProjectId);
  console.log(
    `Nueva tienda persistida: id=${newProjectId}, nombre=${created.name}, esperado=${storeName}`,
  );
  if (created.name !== storeName) throw new Error("La nueva tienda no conservó su nombre.");
  if (created.whatsapp.phone !== "") {
    throw new Error("La nueva tienda volvió a guardar un teléfono WhatsApp ficticio.");
  }
  if (!created.categories.some((category) => category.title === "Ropa exterior")) {
    throw new Error("La categoría creada desde la UI no quedó persistida.");
  }
  if (!created.collections.some((collection) => collection.title === "Selección de invierno")) {
    throw new Error("La colección creada desde la UI no quedó persistida.");
  }
  const createdProduct = created.products.find((product) => product.title === "Campera Bruma");
  if (!createdProduct || createdProduct.status !== "active") {
    throw new Error("El producto no quedó activo después del flujo nativo.");
  }
  if (
    created.products.some((product) => containsId(defaultProductIds, product.id)) ||
    created.categories.some((category) => containsId(defaultCategoryIds, category.id)) ||
    created.collections.some((collection) => containsId(defaultCollectionIds, collection.id))
  ) {
    throw new Error("La nueva tienda comparte IDs de catálogo con la plantilla.");
  }
  const defaultAfter = readProject(copy, "store-modo-sur-demo");
  if (stableStoreSnapshot(defaultBefore) !== stableStoreSnapshot(defaultAfter)) {
    throw new Error("La creación de la nueva tienda alteró la tienda demo original.");
  }
  console.log(`portable new-store e2e: OK (${created.id})`);
} catch (reason) {
  console.error(
    `portable new-store e2e: fallo durante ${currentStep}`,
    reason instanceof Error ? (reason.stack ?? reason.message) : String(reason),
  );
  if (instance && !instance.page.isClosed()) {
    console.error(
      `Tabs visibles: ${(await instance.page.getByRole("tab").allTextContents()).join(" | ")}`,
    );
    console.error(
      `Estado visible: ${(await instance.page.locator("body").innerText()).slice(0, 1200)}`,
    );
  }
  throw reason;
} finally {
  if (instance) await closePortable(instance);
  if (process.env.SOLARA_KEEP_E2E_ARTIFACTS === "1") {
    console.error(`Artefactos E2E conservados en ${testRoot}`);
  } else {
    try {
      rmSync(testRoot, { recursive: true, force: true, maxRetries: 3, retryDelay: 500 });
    } catch {}
  }
}
