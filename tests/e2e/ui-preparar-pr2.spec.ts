/**
 * Auditoría Preparar PR2 (2026-08-11) — Paridad requisitos ↔ críticos de
 * producción. Contrato de 4 capas (plan
 * docs/superpowers/plans/2026-08-10-auditoria-preparar.md):
 * - funcional + auto-feedback: un requisito faltante aparece como "Falta
 *   completar" en el checklist de Preparar y el contador de bloqueos del tab
 *   ("N pendientes bloquean producción.") proviene del MISMO gate que el tab
 *   Exportar (`auditProjectInWorker` → `auditReport(...).criticalCount`);
 * - datos: los escenarios se construyen sobre el proyecto real autoservado en
 *   IndexedDB (el mismo receptor del payload del editor) mutado y recargado;
 * - utilidad (paridad con el gate real de producción): los requisitos críticos
 *   se verifican contra `auditReport(project)` y contra
 *   `exportProject(..., { mode: "production" })`. Los requisitos recomendados
 *   orientan contenido que no bloquea la exportación; no se confunden con un
 *   crítico del gate. Los casos que antes estaban marcados como deuda se
 *   convierten en regresiones explícitas cuando el contrato ya está resuelto.
 */
import type { Server } from "node:http";
import { expect, type Page, test } from "@playwright/test";
import { auditReport, exportProject } from "@solara/exporter";
import type { StoreProjectV1 } from "@solara/project-schema";
import { createCleanStore } from "./project-helpers";
import { startStudioServer, stopStudioServer } from "./studio-server";

test.setTimeout(process.env.CI ? 180_000 : 120_000);

const DEMO_PROJECT_ID = "store-modo-sur-demo";

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

async function resetIndexedDb(page: Page): Promise<void> {
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
    timeout: 20_000,
  });
}

async function openDemoStore(page: Page): Promise<void> {
  await resetIndexedDb(page);
  await page.locator(`[data-store-card-id="${DEMO_PROJECT_ID}"]`).click();
  await page.getByRole("button", { name: "Abrir tienda", exact: true }).click();
  await expect(page.getByRole("navigation", { name: "Áreas de la tienda" })).toBeVisible({
    timeout: 30_000,
  });
}

async function setupCleanStore(page: Page, name: string): Promise<void> {
  await resetIndexedDb(page);
  await createCleanStore(page, name);
  // Espera a que el autosave deje el registro persistido en IndexedDB (el
  // indicador ui-save-indicator sólo vive en el tab Overview).
  await expect.poll(async () => projectIdByName(page, name), { timeout: 15_000 }).toBeDefined();
}

async function openPrepararTab(page: Page): Promise<void> {
  await page.getByRole("tab", { name: "Preparar", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Preparar tienda" })).toBeVisible();
}

/** Lee el proyecto autoservado en IndexedDB (receptor del payload del editor). */
async function readStoredProject(page: Page, key: string): Promise<StoreProjectV1 | null> {
  return page.evaluate(
    (storeKey) =>
      new Promise<StoreProjectV1 | null>((resolve, reject) => {
        const request = indexedDB.open("solara-commerce-studio");
        request.addEventListener("error", () => reject(request.error));
        request.addEventListener("success", () => {
          const db = request.result;
          const found = db.transaction("projects").objectStore("projects").get(storeKey);
          found.addEventListener("error", () => reject(found.error));
          found.addEventListener("success", () => {
            const record = found.result as { project: StoreProjectV1 } | undefined;
            resolve(record?.project ?? null);
          });
        });
      }),
    key,
  );
}

/** Encuentra el id de la tienda por nombre (para tiendas creadas por la UI). */
async function projectIdByName(page: Page, name: string): Promise<string | undefined> {
  return page.evaluate(
    (storeName) =>
      new Promise<string | undefined>((resolve, reject) => {
        const request = indexedDB.open("solara-commerce-studio");
        request.addEventListener("error", () => reject(request.error));
        request.addEventListener("success", () => {
          const db = request.result;
          const cursorRequest = db.transaction("projects").objectStore("projects").openCursor();
          cursorRequest.addEventListener("error", () => reject(cursorRequest.error));
          cursorRequest.addEventListener("success", () => {
            const cursor = cursorRequest.result;
            if (!cursor) {
              resolve(undefined);
              return;
            }
            const record = cursor.value as { name: string };
            if (record.name === storeName) {
              resolve(cursor.key as string);
              return;
            }
            cursor.continue();
          });
        });
      }),
    name,
  );
}

/** Aplica una mutación al proyecto autoservado y la persiste en IndexedDB.
 *  El mutador viaja como fuente (los evaluate de Playwright no serializan
 *  funciones como argumentos) y se reconstruye dentro de la página. */
async function mutateStoredProject(
  page: Page,
  key: string,
  mutator: (project: StoreProjectV1) => void,
): Promise<void> {
  const applied = await page.evaluate(
    async ([storeKey, mutatorSource]) => {
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open("solara-commerce-studio");
        request.addEventListener("error", () => reject(request.error));
        request.addEventListener("success", () => resolve(request.result));
      });
      const record = await new Promise<{ name: string; project: StoreProjectV1 } | undefined>(
        (resolve, reject) => {
          const found = db.transaction("projects").objectStore("projects").get(storeKey);
          found.addEventListener("error", () => reject(found.error));
          found.addEventListener("success", () => {
            resolve(found.result as { name: string; project: StoreProjectV1 } | undefined);
          });
        },
      );
      if (!record) return false;
      const apply = new Function("project", `(${mutatorSource})(project)`) as (
        project: StoreProjectV1,
      ) => void;
      apply(record.project);
      await new Promise<void>((resolve, reject) => {
        const transaction = db.transaction("projects", "readwrite");
        transaction.objectStore("projects").put(record);
        transaction.addEventListener("complete", () => resolve());
        transaction.addEventListener("error", () => reject(transaction.error));
      });
      db.close();
      return true;
    },
    [key, mutator.toString()] as const,
  );
  expect(applied).toBe(true);
}

/** Restaura el proyecto autoservado completo (datos planos, serializables). */
async function restoreStoredProject(
  page: Page,
  key: string,
  original: StoreProjectV1,
): Promise<void> {
  const applied = await page.evaluate(
    ([storeKey, project]) =>
      new Promise<boolean>((resolve, reject) => {
        const request = indexedDB.open("solara-commerce-studio");
        request.addEventListener("error", () => reject(request.error));
        request.addEventListener("success", () => {
          const db = request.result;
          const found = db.transaction("projects").objectStore("projects").get(storeKey);
          found.addEventListener("error", () => reject(found.error));
          found.addEventListener("success", () => {
            const record = found.result as { name: string };
            const transaction = db.transaction("projects", "readwrite");
            transaction.objectStore("projects").put({ ...record, project });
            transaction.addEventListener("complete", () => resolve(true));
            transaction.addEventListener("error", () => reject(transaction.error));
          });
        });
      }),
    [key, original] as const,
  );
  expect(applied).toBe(true);
}

/** Recarga la app y reabre la tienda; devuelve el proyecto autoservado. */
async function reloadAndOpen(page: Page, storeKey: string): Promise<StoreProjectV1> {
  await page.reload();
  await expect(page.getByRole("heading", { name: "Tus tiendas" })).toBeVisible();
  await page.locator(`[data-store-card-id="${storeKey}"]`).click();
  await page.getByRole("button", { name: "Abrir tienda", exact: true }).click();
  await expect(page.getByRole("navigation", { name: "Áreas de la tienda" })).toBeVisible({
    timeout: 30_000,
  });
  const project = await readStoredProject(page, storeKey);
  expect(project).not.toBeNull();
  return project as StoreProjectV1;
}

function requirement(page: Page, requirementId: string) {
  return page.locator(
    `[data-testid="ui-guided-requirement"][data-requirement-id="${requirementId}"]`,
  );
}

function criticalCodes(project: StoreProjectV1): string[] {
  return auditReport(project)
    .issues.filter((issue) => issue.severity === "critical")
    .map((issue) => issue.code);
}

function exportOutcome(project: StoreProjectV1): { ok: boolean; message: string } {
  try {
    exportProject(project, { mode: "production" });
    return { ok: true, message: "" };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : String(error) };
  }
}

test("baseline demo: 297 requisitos listos, 0 críticos y producción exportable (PR2)", async ({
  page,
}) => {
  await openDemoStore(page);
  await openPrepararTab(page);

  // El checklist completo está listo y el gate del tab anuncia 0 bloqueos.
  await expect(page.getByTestId("ui-guided-ready")).toBeVisible();
  await expect(page.getByText("La tienda puede pasar a revisión de publicación.")).toBeVisible();

  const project = await readStoredProject(page, DEMO_PROJECT_ID);
  expect(project).not.toBeNull();
  expect(criticalCodes(project as StoreProjectV1)).toEqual([]);
  expect(exportOutcome(project as StoreProjectV1).ok).toBe(true);
});

test("paridad: sin descripción de producto el requisito falta, el crítico aparece y bloquea producción; completarla lo libera (product.description)", async ({
  page,
}) => {
  await openDemoStore(page);

  // 1. Romper: vaciar la descripción del primer producto activo.
  const before = await readStoredProject(page, DEMO_PROJECT_ID);
  const product = (before as StoreProjectV1).products.find((item) => item.status === "active");
  expect(product).toBeDefined();
  const requirementId = `product.${product?.id}.description`;
  await mutateStoredProject(page, DEMO_PROJECT_ID, (project) => {
    const target = project.products.find((item) => item.status === "active");
    if (target) target.description = "";
  });

  // 2. El checklist marca "Falta completar" y el gate del tab ve 1 bloqueo.
  const broken = await reloadAndOpen(page, DEMO_PROJECT_ID);
  await openPrepararTab(page);
  await expect(requirement(page, requirementId)).toHaveAttribute(
    "data-requirement-status",
    "missing",
  );
  await expect(requirement(page, requirementId)).toContainText("Falta completar");
  await expect(page.getByText("1 pendiente bloquea producción.")).toBeVisible();

  // 3. El auditReport real tiene el crítico y production se bloquea.
  expect(criticalCodes(broken)).toContain("product.description");
  const outcome = exportOutcome(broken);
  expect(outcome.ok).toBe(false);
  expect(outcome.message).toContain("no tiene descripción");

  // 4. Completar por la UI (Catálogo → Editar → Descripción → Guardar):
  // el requisito queda listo y el crítico desaparece de la auditoría.
  await page.getByRole("tab", { name: "Catálogo", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Catálogo" })).toBeVisible();
  await page
    .locator("tbody tr")
    .filter({ has: page.getByRole("checkbox", { name: `Seleccionar ${product?.title}` }) })
    .getByRole("button", { name: "Editar" })
    .click();
  const dialog = page.locator("dialog.product-dialog");
  await expect(dialog).toBeVisible();
  await dialog.getByRole("textbox", { name: "Descripción" }).fill("PR2 descripción completa");
  await dialog.getByRole("button", { name: "Guardar producto" }).click();
  await expect(dialog).toHaveCount(0);
  // El payload llega al proyecto autoservado (mismo receptor del editor).
  await expect
    .poll(
      async () =>
        (await readStoredProject(page, DEMO_PROJECT_ID))?.products.find(
          (item) => item.status === "active",
        )?.description,
      { timeout: 15_000 },
    )
    .toBe("PR2 descripción completa");

  await openPrepararTab(page);
  await expect(page.getByTestId("ui-guided-ready")).toBeVisible();
  await expect(page.getByText("La tienda puede pasar a revisión de publicación.")).toBeVisible();

  const completed = await readStoredProject(page, DEMO_PROJECT_ID);
  const completedProduct = (completed as StoreProjectV1).products.find(
    (item) => item.status === "active",
  );
  expect(completedProduct?.description).toBe("PR2 descripción completa");
  expect(criticalCodes(completed as StoreProjectV1)).not.toContain("product.description");
  expect(exportOutcome(completed as StoreProjectV1).ok).toBe(true);
});

test("paridad: producto sin imágenes bloquea producción y restaurarlas libera el crítico (product.image)", async ({
  page,
}) => {
  await openDemoStore(page);

  const before = await readStoredProject(page, DEMO_PROJECT_ID);
  const product = (before as StoreProjectV1).products.find((item) => item.status === "active");
  const requirementId = `product.${product?.id}.image`;
  await mutateStoredProject(page, DEMO_PROJECT_ID, (project) => {
    const target = project.products.find((item) => item.status === "active");
    if (target) target.imageIds = [];
  });

  const broken = await reloadAndOpen(page, DEMO_PROJECT_ID);
  await openPrepararTab(page);
  await expect(requirement(page, requirementId)).toHaveAttribute(
    "data-requirement-status",
    "missing",
  );
  await expect(page.getByText("1 pendiente bloquea producción.")).toBeVisible();
  expect(criticalCodes(broken)).toContain("product.image");
  const outcome = exportOutcome(broken);
  expect(outcome.ok).toBe(false);
  expect(outcome.message).toContain("no tiene imagen");

  // Completar restaurando la imagen (el mismo receptor del payload del editor).
  await restoreStoredProject(page, DEMO_PROJECT_ID, before as StoreProjectV1);
  const completed = await reloadAndOpen(page, DEMO_PROJECT_ID);
  await openPrepararTab(page);
  await expect(page.getByTestId("ui-guided-ready")).toBeVisible();
  expect(criticalCodes(completed)).not.toContain("product.image");
  expect(exportOutcome(completed).ok).toBe(true);
});

test("paridad: variante sin precio bloquea producción y restaurarlo libera el crítico (variant.price)", async ({
  page,
}) => {
  await openDemoStore(page);

  const before = await readStoredProject(page, DEMO_PROJECT_ID);
  const product = (before as StoreProjectV1).products.find((item) => item.status === "active");
  const requirementId = `product.${product?.id}.price`;
  await mutateStoredProject(page, DEMO_PROJECT_ID, (project) => {
    const target = project.products.find((item) => item.status === "active");
    if (target?.variants[0]) target.variants[0].price = 0;
  });

  const broken = await reloadAndOpen(page, DEMO_PROJECT_ID);
  await openPrepararTab(page);
  await expect(requirement(page, requirementId)).toHaveAttribute(
    "data-requirement-status",
    "missing",
  );
  await expect(page.getByText("1 pendiente bloquea producción.")).toBeVisible();
  expect(criticalCodes(broken)).toContain("variant.price");
  const outcome = exportOutcome(broken);
  expect(outcome.ok).toBe(false);
  expect(outcome.message).toContain("no tiene un precio válido");

  await restoreStoredProject(page, DEMO_PROJECT_ID, before as StoreProjectV1);
  const completed = await reloadAndOpen(page, DEMO_PROJECT_ID);
  await openPrepararTab(page);
  await expect(page.getByTestId("ui-guided-ready")).toBeVisible();
  expect(criticalCodes(completed)).not.toContain("variant.price");
  expect(exportOutcome(completed).ok).toBe(true);
});

test("paridad tienda limpia: las imágenes de plantilla pendientes bloquean producción y reemplazarlas libera el crítico (template.placeholder)", async ({
  page,
}) => {
  const storeName = "PR2 Limpia";
  await setupCleanStore(page, storeName);
  const storeKey = await projectIdByName(page, storeName);
  expect(storeKey).toBeDefined();
  const cleanStoreKey = storeKey as string;

  // 1. La tienda limpia: 5 de 18 requisitos listos y los assets en estado
  // "Reemplazar texto de plantilla" (el checklist muestra 12 y oculta el resto).
  await openPrepararTab(page);
  const placeholderAssets = page.locator(
    '[data-testid="ui-guided-requirement"][data-requirement-id^="asset."][data-requirement-status="placeholder"]',
  );
  await expect(page.getByText("5 de 18 requisitos listos")).toBeVisible();
  await expect(placeholderAssets).toHaveCount(3);
  await expect(page.getByText("+1 más")).toBeVisible();
  await expect(page.getByText("1 pendiente bloquea producción.")).toBeVisible();

  const clean = await readStoredProject(page, cleanStoreKey);
  expect(criticalCodes(clean as StoreProjectV1)).toEqual(["template.placeholder"]);
  const outcome = exportOutcome(clean as StoreProjectV1);
  expect(outcome.ok).toBe(false);
  expect(outcome.message).toContain("imágenes de plantilla");

  // 2. Completar: reemplazar nombre y alt de todas las imágenes de plantilla.
  await mutateStoredProject(page, cleanStoreKey, (project) => {
    project.assets.forEach((asset) => {
      asset.name = "Imagen real";
      asset.alt = "Imagen real para producción";
    });
  });

  // 3. El crítico desaparece y la producción limpia es exportable (0 críticos).
  const completed = await reloadAndOpen(page, cleanStoreKey);
  await openPrepararTab(page);
  await expect(
    page.locator(
      '[data-testid="ui-guided-requirement"][data-requirement-id^="asset."][data-requirement-status="placeholder"]',
    ),
  ).toHaveCount(0);
  expect(criticalCodes(completed)).toEqual([]);
  expect(exportOutcome(completed).ok).toBe(true);
  await expect(page.getByText("La tienda puede pasar a revisión de publicación.")).toBeVisible();
});

test("contenido recomendado: descripción de marca vacía queda pendiente pero no bloquea producción (identity.description)", async ({
  page,
}) => {
  await openDemoStore(page);
  await mutateStoredProject(page, DEMO_PROJECT_ID, (project) => {
    project.identity.description = "";
  });
  const broken = await reloadAndOpen(page, DEMO_PROJECT_ID);
  await openPrepararTab(page);
  await expect(requirement(page, "identity.description")).toHaveAttribute(
    "data-requirement-status",
    "missing",
  );
  expect(criticalCodes(broken)).toEqual([]);
  expect(exportOutcome(broken).ok).toBe(true);
});

test("contenido recomendado: el WhatsApp sentinel queda pendiente pero no bloquea producción (identity.whatsapp)", async ({
  page,
}) => {
  await openDemoStore(page);
  await mutateStoredProject(page, DEMO_PROJECT_ID, (project) => {
    project.whatsapp.phone = "5491100000000";
  });
  const broken = await reloadAndOpen(page, DEMO_PROJECT_ID);
  await openPrepararTab(page);
  await expect(requirement(page, "identity.whatsapp")).toHaveAttribute(
    "data-requirement-status",
    "placeholder",
  );
  expect(criticalCodes(broken)).toEqual([]);
  expect(exportOutcome(broken).ok).toBe(true);
});

test("contenido recomendado: los textos del hero vacíos quedan pendientes pero no bloquean producción", async ({
  page,
}) => {
  await openDemoStore(page);
  await mutateStoredProject(page, DEMO_PROJECT_ID, (project) => {
    const hero = project.sections.find((section) => section.id === "modo-section-hero");
    if (hero) {
      hero.settings.title = "";
      hero.settings.body = "";
      hero.settings.actionLabel = "";
    }
  });
  const broken = await reloadAndOpen(page, DEMO_PROJECT_ID);
  await openPrepararTab(page);
  for (const requirementId of ["home.hero.title", "home.hero.body", "home.hero.primary-cta"]) {
    await expect(requirement(page, requirementId)).toHaveAttribute(
      "data-requirement-status",
      "missing",
    );
  }
  expect(criticalCodes(broken)).toEqual([]);
  expect(exportOutcome(broken).ok).toBe(true);
});

test("contenido recomendado: título de la grilla de productos vacío queda pendiente pero no bloquea producción (home.products.title)", async ({
  page,
}) => {
  await openDemoStore(page);
  await mutateStoredProject(page, DEMO_PROJECT_ID, (project) => {
    const section = project.sections.find((item) => item.id === "modo-section-new");
    if (section) section.settings.title = "";
  });
  const broken = await reloadAndOpen(page, DEMO_PROJECT_ID);
  await openPrepararTab(page);
  await expect(requirement(page, "home.products.title")).toHaveAttribute(
    "data-requirement-status",
    "missing",
  );
  expect(criticalCodes(broken)).toEqual([]);
  expect(exportOutcome(broken).ok).toBe(true);
});

test("paridad: un dominio sin HTTPS aparece como inválido en Preparar y bloquea producción (domain.https)", async ({
  page,
}) => {
  await openDemoStore(page);
  await mutateStoredProject(page, DEMO_PROJECT_ID, (project) => {
    project.baseUrl = "http://modo-sur.example";
  });
  const broken = await reloadAndOpen(page, DEMO_PROJECT_ID);
  await openPrepararTab(page);
  await expect(page.getByTestId("ui-guided-ready")).toHaveCount(0);
  await expect(requirement(page, "domain.https")).toHaveAttribute(
    "data-requirement-status",
    "invalid",
  );
  await expect(requirement(page, "domain.https")).toContainText("Revisar formato");
  await requirement(page, "domain.https")
    .getByRole("button", { name: "Editar URL pública con HTTPS" })
    .click();
  await expect(page.getByRole("heading", { name: "Resumen", exact: true })).toBeVisible();
  expect(criticalCodes(broken)).toEqual(["domain.https"]);
  const outcome = exportOutcome(broken);
  expect(outcome.ok).toBe(false);
  expect(outcome.message).toContain("HTTPS");
});

test("contrato: políticas incompletas son una advertencia no bloqueante mientras no exista editor en Studio", async ({
  page,
}) => {
  await openDemoStore(page);
  await mutateStoredProject(page, DEMO_PROJECT_ID, (project) => {
    project.policies.shipping.details = "";
    project.policies.returns.details = "";
  });
  const broken = await reloadAndOpen(page, DEMO_PROJECT_ID);
  await openPrepararTab(page);
  await expect(page.getByTestId("ui-guided-ready")).toBeVisible();
  expect(criticalCodes(broken)).toEqual([]);
  expect(auditReport(broken).issues).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ code: "policies.incomplete", severity: "warning" }),
    ]),
  );
  const outcome = exportOutcome(broken);
  expect(outcome.ok).toBe(true);
});

test("paridad: una imagen de plantilla sigue pendiente si solo se corrige su alt (template.placeholder)", async ({
  page,
}) => {
  const storeName = "PR2 Limpia Nombre";
  await setupCleanStore(page, storeName);
  const storeKey = await projectIdByName(page, storeName);
  expect(storeKey).toBeDefined();
  const cleanStoreKey = storeKey as string;
  await mutateStoredProject(page, cleanStoreKey, (project) => {
    project.assets.forEach((asset) => {
      asset.alt = "Texto alternativo real";
    });
  });
  const broken = await reloadAndOpen(page, cleanStoreKey);
  await openPrepararTab(page);
  await expect(
    page.locator(
      '[data-testid="ui-guided-requirement"][data-requirement-id^="asset."][data-requirement-status="placeholder"]',
    ),
  ).toHaveCount(3);
  await expect(page.getByText("+1 más")).toBeVisible();
  expect(criticalCodes(broken)).toEqual(["template.placeholder"]);
  const outcome = exportOutcome(broken);
  expect(outcome.ok).toBe(false);
  expect(outcome.message).toContain("imágenes de plantilla");
});
