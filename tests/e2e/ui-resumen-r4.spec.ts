/**
 * Auditoría Resumen R4 (2026-08-11) — Navegación pública: enlaces.
 *
 * Contrato de 4 capas sobre "Agregar enlace de navegación" (Overview.tsx,
 * sección "Navegación pública"):
 *   1. funcional: agregar, editar nombre/destino, eliminar (confirmación +
 *      toast "Enlace de navegación eliminado") y reordenar (subir/bajar);
 *   2. auto-feedback: error inline de destino (`//` prohibido; http(s), rutas
 *      internas, mailto/tel) e indicador "Cambios guardados";
 *   3. datos: los enlaces persisten en `project.navigation.items` (IDB
 *      `projects`) con el orden del editor;
 *   4. utilidad: sitio exportado ANTES/DESPUÉS (patrón exported-store.spec.ts) —
 *      el header MODERNO (packages/modules/src/catalog-modern.ts,
 *      `.catalog-mega-group__link`) renderiza los enlaces curados en el mismo
 *      orden, y el consumidor LEGACY (packages/modules/src/definitions.ts,
 *      `editorial-header` → `solara-nav-dropdown`) renderiza el mismo contrato.
 *
 * Consumidores verificados por código (detalle en resumen-r4-report.md):
 *   - moderno: catalog-modern.ts:129,144 — lee `project.navigation.items`
 *     (NO `navigation.links` ni `siteShell.navLinks`) cuando
 *     `navigation.mode === "curated"`;
 *   - legacy: definitions.ts:115-147 — lee `project.navigation.items` y
 *     `catalogLabel` sin condición de mode.
 *
 * Tienda: "Predeterminado" (seed demo, `navigation.mode` curado con 8 enlaces).
 */
import type { Server } from "node:http";
import { expect, type Page, test } from "@playwright/test";
import { exportProject } from "@solara/exporter";
import type { StoreProjectV1 } from "@solara/project-schema";
import { referenceStore } from "@solara/project-schema/fixture";
import { startStudioServer, stopStudioServer } from "./studio-server";

test.setTimeout(process.env.CI ? 90_000 : 60_000);

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

const DEMO_STORE_NAME = "Predeterminado";

/** Abre la tienda demo (seed demo, mode curado) y la pestaña Resumen. */
async function openDemoResumen(page: Page): Promise<void> {
  await page.goto(studioUrl);
  await page.evaluate(
    () =>
      new Promise<void>((resolve, reject) => {
        const request = indexedDB.deleteDatabase("solara-commerce-studio");
        request.addEventListener("success", () => resolve());
        request.addEventListener("error", () => reject(request.error));
        request.addEventListener("blocked", () => reject(new Error("La base quedó bloqueada.")));
      }),
  );
  await page.reload();
  await expect(page.getByRole("heading", { name: "Tus tiendas" })).toBeVisible();
  const card = page.locator(".dashboard-store-card", { hasText: DEMO_STORE_NAME });
  await expect(card.getByTestId("ui-card-open")).toBeVisible();
  await card.getByTestId("ui-card-open").click();
  await page.getByRole("tab", { name: "Resumen", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Resumen", exact: true })).toBeVisible();
}

/** Lee el proyecto persistido de la tienda demo desde IndexedDB. */
async function readDemoProject(page: Page): Promise<StoreProjectV1> {
  return page.evaluate(
    (storeName) =>
      new Promise<StoreProjectV1>((resolve, reject) => {
        const request = indexedDB.open("solara-commerce-studio");
        request.addEventListener("error", () => reject(request.error));
        request.addEventListener("success", () => {
          const db = request.result;
          const all = db.transaction("projects").objectStore("projects").getAll();
          all.addEventListener("error", () => reject(all.error));
          all.addEventListener("success", () => {
            const records = all.result as Array<{ name: string; project: StoreProjectV1 }>;
            const record = records.find((item) => item.name === storeName);
            if (!record) reject(new Error(`No se encontró la tienda "${storeName}" en IDB.`));
            else resolve(record.project);
          });
        });
      }),
    DEMO_STORE_NAME,
  );
}

/** Espera a que el proyecto persistido cumpla una condición. */
async function pollProject(
  page: Page,
  predicate: (project: StoreProjectV1) => boolean,
  timeout = 15_000,
): Promise<StoreProjectV1> {
  await expect.poll(async () => predicate(await readDemoProject(page)), { timeout }).toBe(true);
  return readDemoProject(page);
}

function saveIndicator(page: Page) {
  return page.getByTestId("ui-save-indicator");
}

function navigationItems(page: Page) {
  return page.locator(".navigation-editor-item");
}

/** Editor del último enlace de la lista (el recién agregado no tiene subenlaces). */
function lastItem(page: Page) {
  return navigationItems(page).last();
}

/** Exporta el sitio en modo draft y devuelve el HTML de la portada. */
function exportHomeHtml(project: StoreProjectV1): string {
  const result = exportProject(project, { mode: "draft" });
  const file = result.files.get("index.html");
  if (file === undefined) throw new Error("El sitio exportado no contiene index.html");
  return typeof file === "string" ? file : new TextDecoder().decode(file);
}

/** Enlaces del menú de categorías del header MODERNO (catalog-modern.ts). */
function modernHeaderLinks(html: string): Array<{ href: string; label: string }> {
  return [
    ...html.matchAll(
      /<a class="catalog-mega-group__link" href="([^"]+)"><span>([\s\S]*?)<\/span><\/a>/g,
    ),
  ].map((match) => ({ href: match[1] ?? "", label: match[2] ?? "" }));
}

/** Enlaces del dropdown del header LEGACY (definitions.ts editorial-header). */
function legacyDropdownLinks(html: string): Array<{ href: string; label: string }> {
  const match =
    /<details class="solara-nav-dropdown[^"]*"><summary[^>]*>[\s\S]*?<\/summary><ul>([\s\S]*?)<\/ul><\/details>/.exec(
      html,
    );
  if (match === null) return [];
  const list = match[1] ?? "";
  return [...list.matchAll(/<a href="([^"]+)">([^<]+)<\/a>/g)].map((match) => ({
    href: match[1] ?? "",
    label: match[2] ?? "",
  }));
}

test("agregar y editar un enlace: persiste y aparece en el header moderno exportado (ANTES/DESPUÉS)", async ({
  page,
}) => {
  await openDemoResumen(page);

  const before = await pollProject(page, (project) => project.navigation.items.length > 0);
  const beforeLabels = before.navigation.items.map((item) => item.label);
  const beforeHtml = exportHomeHtml(before);
  expect(beforeHtml).not.toContain("Enlace R4");
  expect(modernHeaderLinks(beforeHtml).map((link) => link.label)).toEqual(beforeLabels);

  // El enlace "catálogo" integrado usa el nombre configurado en Resumen.
  const catalogLabel = before.navigation.catalogLabel;
  expect(beforeHtml).toContain(`<summary class="catalog-nav-trigger"`);
  expect(beforeHtml).toContain(`>${catalogLabel}<span class="catalog-nav-chevron"`);

  // Agregar: "Añadir enlace de catálogo" crea un ítem nuevo al final.
  await page.getByRole("button", { name: "Añadir enlace de catálogo", exact: true }).click();
  const newItemIndex = before.navigation.items.length + 1;
  const newItem = lastItem(page);
  await expect(newItem.getByLabel(`Enlace ${newItemIndex}`, { exact: true })).toHaveValue(
    "Nueva categoría",
  );

  // Editar nombre: commitea al escribir.
  await newItem.getByLabel(`Enlace ${newItemIndex}`, { exact: true }).fill("Enlace R4");
  await expect(newItem.getByLabel(`Enlace ${newItemIndex}`, { exact: true })).toHaveValue(
    "Enlace R4",
  );

  // Editar destino: ruta interna válida, commitea al salir del campo.
  await newItem.getByLabel("Destino", { exact: true }).fill("/categorias/camisas/");
  await newItem.getByLabel("Destino", { exact: true }).blur();
  await expect(saveIndicator(page)).toContainText("Cambios guardados", { timeout: 5_000 });

  const after = await pollProject(page, (project) =>
    project.navigation.items.some(
      (item) => item.label === "Enlace R4" && item.href === "/categorias/camisas/",
    ),
  );
  const afterItems = after.navigation.items;
  const lastNavItem = afterItems[afterItems.length - 1];
  expect(lastNavItem?.label).toBe("Enlace R4");
  expect(lastNavItem?.href).toBe("/categorias/camisas/");

  // Utilidad: el sitio DESPUÉS renderiza el enlace nuevo en el header moderno,
  // al final, respetando el orden del editor.
  const afterHtml = exportHomeHtml(after);
  const links = modernHeaderLinks(afterHtml);
  expect(links.map((link) => link.label)).toEqual([...beforeLabels, "Enlace R4"]);
  expect(links.at(-1)).toEqual({ href: "/categorias/camisas/", label: "Enlace R4" });

  // El preview (mismo renderer) muestra el enlace dentro del menú del header.
  // El summary queda parcialmente tapado por el panel del editor: se despacha
  // el click (patrón dispatchGuidedClick de ui-guiado.spec.ts) para abrirlo.
  const preview = page.frameLocator('iframe[title="Vista previa desktop"]');
  await preview.locator(".catalog-nav-trigger").first().dispatchEvent("click");
  await expect(
    preview.locator(".catalog-mega-group__link", { hasText: "Enlace R4" }),
  ).toBeVisible();
});

test("el destino inválido `//` no persiste y mailto/tel son aceptados", async ({ page }) => {
  await openDemoResumen(page);

  const before = await pollProject(page, (project) => project.navigation.items.length > 0);
  const beforeItems = before.navigation.items;

  await page.getByRole("button", { name: "Añadir enlace de catálogo", exact: true }).click();
  const newItem = lastItem(page);

  // `//` prohibido: muestra el error inline y NO commitea.
  await newItem.getByLabel("Destino", { exact: true }).fill("//evil.example");
  await newItem.getByLabel("Destino", { exact: true }).blur();
  await expect(
    newItem.getByRole("alert").getByText("Usá http(s) o una ruta interna (ej. /contacto/)."),
  ).toBeVisible();

  const rejected = await pollProject(
    page,
    (project) => project.navigation.items.length === beforeItems.length + 1,
  );
  const defaultHref = `/categorias/${rejected.categories[0]?.slug ?? ""}/`;
  expect(rejected.navigation.items.at(-1)?.href).toBe(defaultHref);

  // mailto es aceptado y persiste.
  await newItem.getByLabel("Destino", { exact: true }).fill("mailto:hola@tienda.example");
  await newItem.getByLabel("Destino", { exact: true }).blur();
  await expect(newItem.getByRole("alert")).toHaveCount(0);
  await expect(saveIndicator(page)).toContainText("Cambios guardados", { timeout: 5_000 });

  const withMailto = await pollProject(page, (project) =>
    project.navigation.items.some((item) => item.href === "mailto:hola@tienda.example"),
  );
  expect(withMailto.navigation.items.at(-1)?.href).toBe("mailto:hola@tienda.example");

  // Utilidad: mailto sobrevive a safeUrl en el header exportado.
  const html = exportHomeHtml(withMailto);
  expect(html).toContain('href="mailto:hola@tienda.example"');
  expect(html).not.toContain('href="//evil.example"');
});

test("eliminar un enlace: directo sin subenlaces, confirmación con subenlaces y ausencia en el sitio", async ({
  page,
}) => {
  await openDemoResumen(page);

  const before = await pollProject(page, (project) => project.navigation.items.length >= 2);
  const first = before.navigation.items[0];
  if (!first || !(first.children?.length ?? 0)) {
    throw new Error("El primer enlace de la tienda demo debe tener subenlaces.");
  }
  const beforeCount = before.navigation.items.length;

  // 1) Enlace sin subenlaces: se elimina directo (sin diálogo) con toast.
  await page.getByRole("button", { name: "Añadir enlace de catálogo", exact: true }).click();
  const newItem = lastItem(page);
  await newItem.getByLabel(`Enlace ${beforeCount + 1}`, { exact: true }).fill("Enlace R4");
  await expect(saveIndicator(page)).toContainText("Cambios guardados", { timeout: 5_000 });
  await pollProject(page, (project) =>
    project.navigation.items.some((item) => item.label === "Enlace R4"),
  );
  await page.getByRole("button", { name: "Eliminar enlace Enlace R4", exact: true }).click();
  await expect(page.getByTestId("ui-toast").last()).toContainText("Enlace de navegación eliminado");
  await expect(navigationItems(page)).toHaveCount(beforeCount);

  // 2) Enlace con subenlaces: el diálogo de confirmación describe el impacto.
  await page.getByRole("button", { name: `Eliminar enlace ${first.label}`, exact: true }).click();
  await expect(page.getByText("Eliminar enlace de navegación")).toBeVisible();
  await expect(page.getByText(new RegExp(`Se eliminará «${first.label}»`))).toBeVisible();

  // Cancelar: no borra nada.
  await page.getByRole("button", { name: "Cancelar", exact: true }).click();
  await expect(page.getByTestId("ui-confirm-dialog")).toHaveCount(0);
  await expect(navigationItems(page)).toHaveCount(beforeCount);

  // Confirmar: el enlace y sus subenlaces desaparecen con toast.
  await page.getByRole("button", { name: `Eliminar enlace ${first.label}`, exact: true }).click();
  await page.getByRole("button", { name: "Eliminar enlace", exact: true }).click();
  await expect(page.getByTestId("ui-toast").last()).toContainText("Enlace de navegación eliminado");
  const after = await pollProject(
    page,
    (project) =>
      project.navigation.items.length === beforeCount - 1 &&
      !project.navigation.items.some((item) => item.id === first.id),
  );

  // Utilidad: el sitio exportado ya no muestra el enlace eliminado (ni sus subenlaces).
  const html = exportHomeHtml(after);
  const links = modernHeaderLinks(html);
  expect(links).toHaveLength(beforeCount - 1);
  expect(links.some((link) => link.href === first.href)).toBe(false);
  for (const child of first.children ?? []) {
    expect(links.some((link) => link.href === child.href)).toBe(false);
  }
  expect(links.map((link) => link.label)).toEqual(after.navigation.items.map((item) => item.label));
});

test("reordenar: subir/bajar cambia el orden del editor y del sitio exportado", async ({
  page,
}) => {
  await openDemoResumen(page);

  const before = await pollProject(page, (project) => project.navigation.items.length >= 2);
  const [first, second] = before.navigation.items;
  if (!first || !second) throw new Error("La tienda demo necesita al menos 2 enlaces.");

  // Bajar el primero: pasa a segundo lugar.
  await page.getByRole("button", { name: `Mover ${first.label} abajo`, exact: true }).click();
  const movedDown = await pollProject(
    page,
    (project) => project.navigation.items[0]?.label === second.label,
  );
  expect(movedDown.navigation.items[1]?.label).toBe(first.label);
  await expect(saveIndicator(page)).toContainText("Cambios guardados", { timeout: 5_000 });

  // El editor refleja el nuevo orden en los rótulos de los campos.
  await expect(navigationItems(page).first().getByLabel("Enlace 1", { exact: true })).toHaveValue(
    second.label,
  );

  // Utilidad: el header moderno exportado respeta el orden del editor.
  const downHtml = exportHomeHtml(movedDown);
  const downLabels = modernHeaderLinks(downHtml).map((link) => link.label);
  expect(downLabels.slice(0, 2)).toEqual([second.label, first.label]);
  expect(downLabels).toEqual(movedDown.navigation.items.map((item) => item.label));

  // Volver a subirlo: restaura el orden original (Remeras quedó en segundo lugar).
  await page.getByRole("button", { name: `Mover ${first.label} arriba`, exact: true }).click();
  const movedUp = await pollProject(
    page,
    (project) => project.navigation.items[0]?.label === first.label,
  );
  expect(movedUp.navigation.items.map((item) => item.label)).toEqual(
    before.navigation.items.map((item) => item.label),
  );
  const upHtml = exportHomeHtml(movedUp);
  expect(modernHeaderLinks(upHtml).map((link) => link.label)).toEqual(
    before.navigation.items.map((item) => item.label),
  );
});

test("paridad legacy: editorial-header renderiza el mismo contrato de enlaces (definitions.ts)", async ({
  page,
}) => {
  await openDemoResumen(page);

  // Los enlaces tienen la MISMA forma que escribe el editor (id/label/href/
  // children), con destinos internos válidos en la tienda legacy.
  const curated = [
    {
      id: "nav-r4-casa",
      label: "Casa",
      href: "/colecciones/casa-serena/",
      children: [
        { id: "nav-r4-textiles", label: "Textiles", href: "/productos/manta-bruma/" },
        { id: "nav-r4-mesa", label: "Mesa", href: "/productos/jarra-delta/" },
      ],
    },
    { id: "nav-r4-envios", label: "Envíos", href: "/envios/" },
    { id: "nav-r4-mail", label: "Escribinos", href: "mailto:hola@tienda.example" },
  ];

  // Store LEGACY (editorial-header) con los mismos navigation.items del editor.
  const legacy = structuredClone(referenceStore) as StoreProjectV1;
  legacy.navigation = {
    ...legacy.navigation,
    catalogLabel: "Categorías",
    items: curated,
  };
  legacy.sections = legacy.sections.map((section) =>
    section.moduleId === "editorial-header"
      ? { ...section, settings: { ...section.settings, showCategories: true } }
      : section,
  );

  const html = exportHomeHtml(legacy);
  const links = legacyDropdownLinks(html);
  expect(links.length).toBeGreaterThan(0);

  // El dropdown usa el nombre del catálogo del Resumen.
  expect(html).toContain(`<summary>Categorías</summary>`);

  // Los enlaces curados aparecen en orden (el primero con sus subenlaces).
  expect(links[0]).toEqual({ href: "/colecciones/casa-serena/", label: "Casa" });
  for (const child of curated[0].children ?? []) {
    expect(links.some((link) => link.href === child.href && link.label === child.label)).toBe(true);
  }
  expect(links.some((link) => link.href === "/envios/" && link.label === "Envíos")).toBe(true);

  // mailto sobrevive en el header legacy y cierra la lista en orden.
  expect(links.at(-1)).toEqual({ href: "mailto:hola@tienda.example", label: "Escribinos" });
});
