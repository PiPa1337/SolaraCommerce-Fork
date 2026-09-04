# Catálogo completo en `/buscar/` — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que "Ver todos los productos" muestre el catálogo completo paginado en `/buscar/` (reutilizando la búsqueda) y que el fallback con búsqueda deshabilitada deje de apuntar a `/categorias/` (404 latente).

**Architecture:** El runtime de storefront, al llegar a `/buscar/` sin `?q=`, hace el mismo fetch a `search-index.json` que el modo búsqueda y renderiza todas las cards. La paginación es una ventana dentro de `render()` del handler `[data-category-sort]`, activada por `data-products-per-page` que inyecta el exporter. El fix del fallback vive en `catalogSearchHref` de `@solara/modules`.

**Tech Stack:** TypeScript estricto, Vitest (unit), Playwright (e2e contra export real servido local), pnpm workspace.

**Spec:** `docs/superpowers/specs/2026-09-04-catalogo-buscar-todos-productos-design.md`

## Global Constraints

- Cero cambios en `StoreProjectV2`, `publicCopy`, schemaVersion ni migraciones.
- Cero claves de copy nuevas: reusar `publicCopy.export.{pagination,previous,next,pageOf}` y `filters.resultCount` (ya embebidos en `data-solara-copy` para `pageType: "search"`).
- Dinero en centavos enteros (inputs de precio decimales × 100, como hoy).
- El runtime es un string serializado: budget JS ≤ 68 KiB (`scripts/storefront-runtime-budget.test.ts`).
- `/buscar/` sigue noindex,follow; también setear noindex dinámico con `?pagina=N`.
- Copys y IDs de secciones/módulos son contratos persistidos: no renombrar.
- Commits en español, uno por tarea, después de que sus tests pasen.
- Comandos siempre con `corepack pnpm` (Windows, PowerShell).

---

### Task 1: Exporter — atributos del catálogo en `/buscar/`

**Files:**
- Modify: `packages/exporter/src/index.ts` (línea ~2438, body de `searchPage`)
- Test: `packages/exporter/src/index.test.ts` (agregar cerca del test que contiene `href="/tienda/buscar/"`, línea ~1218)

**Interfaces:**
- Consumes: `searchProducts` (ya definido en el body de la página de búsqueda), `project.commerceTemplates.category.productsPerPage`.
- Produces: atributos `data-products-per-page="<N>"` en el grid de búsqueda y `data-category-total="<M>"` en el count. El runtime (Tasks 2-3) los consume.

- [ ] **Step 1: Escribir el test que falla**

Agregar en `packages/exporter/src/index.test.ts` (dentro del describe principal, junto a los tests de rutas):

```ts
it("la página de búsqueda declara pageSize y total del catálogo", () => {
  const { files } = exportProject(catalogScaleStore, { mode: "production" });
  const searchHtml = String(files.get("buscar/index.html"));
  expect(searchHtml).toContain(
    `data-products-per-page="${catalogScaleStore.commerceTemplates.category.productsPerPage}"`,
  );
  const total = catalogScaleStore.products.filter(
    (product) => product.status === "active",
  ).length;
  expect(total).toBe(50);
  expect(searchHtml).toContain(`data-category-total="${total}"`);
});
```

- [ ] **Step 2: Ejecutar y confirmar que falla**

Run: `corepack pnpm exec vitest run packages/exporter/src/index.test.ts -t "pageSize y total"`
Expected: FAIL (el HTML no contiene `data-products-per-page`).

- [ ] **Step 3: Implementar**

En `packages/exporter/src/index.ts`, dentro del body de `searchPage` (línea ~2438), reemplazar:

```ts
<span data-category-result-count data-search-result-count aria-live="polite">${escapeHtml(copy.search.empty)}</span>${searchSort}</div><div data-search-results aria-live="polite"><div class="solara-search-results-grid" data-category-grid></div>
```

por:

```ts
<span data-category-result-count data-search-result-count data-category-total="${searchProducts.length}" aria-live="polite">${escapeHtml(copy.search.empty)}</span>${searchSort}</div><div data-search-results aria-live="polite"><div class="solara-search-results-grid" data-category-grid data-products-per-page="${project.commerceTemplates.category.productsPerPage}"></div>
```

- [ ] **Step 4: Ejecutar y confirmar que pasa**

Run: `corepack pnpm exec vitest run packages/exporter/src/index.test.ts -t "pageSize y total"`
Expected: PASS.

- [ ] **Step 5: Verificar que no rompió el resto del exporter**

Run: `corepack pnpm exec vitest run packages/exporter/src/index.test.ts packages/exporter/src/scale.test.ts packages/exporter/src/parity.test.ts`
Expected: PASS (parity compara el mismo body en buildPages/renderDocument; los atributos viajan en ambos).

- [ ] **Step 6: Commit**

```powershell
git add packages/exporter/src/index.ts packages/exporter/src/index.test.ts
git commit -m "feat(sitio): declara pageSize y total del catalogo en /buscar/"
```

---

### Task 2: Runtime — modo "todos los productos" (grid poblado)

**Files:**
- Modify: `packages/storefront-runtime/src/index.ts` (bloque de búsqueda, líneas ~1786-1965)
- Create: `tests/e2e/search-catalog.spec.ts`
- Modify: `tests/e2e/ui-sweep-a30.spec.ts` (test "casos borde", líneas 115-132)

**Interfaces:**
- Consumes: `data-products-per-page` y `data-category-total` (Task 1); `search-index.json`; helpers existentes `node`, `showSearchSkeletons`, `showSearchMessage`, `validSearchEntry`, `safeRuntimeImageUrl`, `money`, `s` (copy.search), `baseHref`.
- Produces: función local `renderSearchResult(entry): HTMLElement` (reutilizada por ambos modos); rama `else` que puebla el grid cuando no hay `?q=`. Task 3 añade paginación encima.

- [ ] **Step 1: Escribir los e2e que fallan**

Crear `tests/e2e/search-catalog.spec.ts` (modelo: `tests/e2e/catalog-modern.spec.ts`, líneas 1-67):

```ts
import { createServer, type Server } from "node:http";
import { expect, test } from "@playwright/test";
import { exportProject } from "@solara/exporter";
import { catalogScaleStore } from "@solara/project-schema/scale-fixture";

import { FIXTURE_PRODUCT_FILES } from "./fixture-server";

const exported = exportProject(catalogScaleStore, { mode: "production" });
const fixtureFiles = FIXTURE_PRODUCT_FILES;

let server: Server;
let serverUrl: string;

test.beforeAll(async () => {
  server = createServer((request, response) => {
    const url = new URL(request.url ?? "/", "http://127.0.0.1");
    const requested = decodeURIComponent(url.pathname).replace(/^\/+/, "");
    const path =
      requested === ""
        ? "index.html"
        : requested.endsWith("/")
          ? `${requested}index.html`
          : requested;
    const content = exported.files.get(path) ?? fixtureFiles.get(path);
    if (content === undefined) {
      response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" }).end("Not found");
      return;
    }
    const extension = path.split(".").pop();
    const contentType =
      extension === "html"
        ? "text/html; charset=utf-8"
        : extension === "css"
          ? "text/css; charset=utf-8"
          : extension === "js"
            ? "text/javascript; charset=utf-8"
            : extension === "xml"
              ? "application/xml; charset=utf-8"
              : extension === "png"
                ? "image/png"
                : "application/octet-stream";
    response.writeHead(200, { "Content-Type": contentType, "Cache-Control": "no-store" });
    response.end(content);
  });
  await new Promise<void>((resolveListening) => {
    server.listen(0, "127.0.0.1", resolveListening);
  });
  const address = server.address();
  if (address === null || typeof address === "string") {
    throw new Error("El servidor de pruebas no tiene una dirección TCP.");
  }
  serverUrl = `http://127.0.0.1:${address.port}`;
});

function storeUrl(path: string): string {
  return new URL(path, serverUrl).toString();
}

test.afterAll(async () => {
  await new Promise<void>((resolveClosing, reject) => {
    server.close((error) => (error ? reject(error) : resolveClosing()));
  });
});

test("ver todos los productos puebla /buscar/ con la primera página del catálogo", async ({
  page,
}) => {
  await page.goto(storeUrl("/buscar/"));
  const cards = page.locator("[data-search-results] .solara-search-result");
  await expect(cards).toHaveCount(24, { timeout: 15_000 });
  await expect(page.locator("[data-category-result-count]")).toContainText("50 de 50");
});
```

- [ ] **Step 2: Ejecutar y confirmar que falla**

Run: `corepack pnpm exec playwright test tests/e2e/search-catalog.spec.ts`
Expected: FAIL (grid vacío, count "Elegí una búsqueda").

- [ ] **Step 3: Extraer el renderer de card compartido**

En `packages/storefront-runtime/src/index.ts`, después de la definición de `suggestCorrection` (línea ~1853) y antes de `const query = ...` (línea 1854), agregar (el cuerpo es el mismo markup del modo query, líneas 1924-1954):

```ts
    const renderSearchResult = (entry: SearchEntryWithTokens): HTMLElement => {
      const article = node("article", undefined, {
        class: "solara-search-result",
        "data-product-card": "",
        "data-product-price": entry.priceMin,
        "data-product-available": entry.available,
        "data-product-tags": (entry.tags ?? []).join(","),
        "data-product-options": (entry.options ?? []).join("|"),
      });
      const link = node("a", undefined, { href: entry.path });
      const imageUrl = safeRuntimeImageUrl(entry.imageUrl);
      if (imageUrl) {
        link.append(
          node("img", undefined, {
            src: imageUrl,
            alt: entry.title,
            width: entry.imageWidth ?? 1,
            height: entry.imageHeight ?? 1,
            sizes: "(max-width: 767px) 46vw, (max-width: 1199px) 18rem, 13rem",
            loading: "lazy",
          }),
        );
      }
      const details = node("div");
      details.append(
        node("h2", entry.title),
        node("p", entry.brand),
        node("strong", money.format(entry.priceMin / 100)),
      );
      link.append(details);
      article.append(link);
      return article;
    };
```

Y en el modo query (línea ~1922) reemplazar el `.map` inline por:

```ts
            searchGrid.replaceChildren(
              ...ranked.slice(0, 48).map(({ entry }) => renderSearchResult(entry)),
            );
```

(borrar el bloque duplicado de construcción de `article`).

- [ ] **Step 4: Agregar la rama "todos los productos"**

El `if (query) { ... }` cierra en la línea ~1964 con `    }\n  }`. Reemplazar el cierre por:

```ts
    } else {
      const controller = new AbortController();
      showSearchSkeletons();
      const searchIndexError =
        (copy as Record<string, Record<string, string>>).errors?.searchIndexLoad ??
        "No se pudo cargar el índice de búsqueda.";
      fetch(`${baseHref}/search-index.json`, { signal: controller.signal })
        .then((response) => {
          if (!response.ok) throw new Error(searchIndexError);
          return response.json() as Promise<SearchEntryWithTokens[]>;
        })
        .then((entries) => {
          const safeEntries = Array.isArray(entries) ? entries.filter(validSearchEntry) : [];
          searchGrid.replaceChildren(...safeEntries.map(renderSearchResult));
          searchGrid.dispatchEvent(new Event("f"));
        })
        .catch(() => {
          showSearchMessage(s.error, undefined, "alert");
        });
      window.addEventListener("pagehide", () => controller.abort(), { once: true });
    }
  }
```

- [ ] **Step 5: Ejecutar el e2e nuevo y confirmar que pasa**

Run: `corepack pnpm exec playwright test tests/e2e/search-catalog.spec.ts`
Expected: PASS (24 cards, count "50 de 50").

- [ ] **Step 6: Actualizar el test de ui-sweep-a30 que este cambio rompe**

En `tests/e2e/ui-sweep-a30.spec.ts`, test "búsqueda: casos borde" (líneas 115-132), reemplazar las primeras 4 líneas de aserción (después de `await page.goto(scaleUrlFor("/buscar/"));`):

Antes:

```ts
  const results = page.locator("[data-search-results]");
  const resultCount = page.locator("[data-category-result-count]");
  await expect(results).toHaveAttribute("aria-live", "polite");
  await expect(resultCount).toHaveText("Elegí una búsqueda");
```

Después:

```ts
  const results = page.locator("[data-search-results]");
  const resultCount = page.locator("[data-category-result-count]");
  await expect(results).toHaveAttribute("aria-live", "polite");
  // Sin query: catálogo completo paginado client-side (50 productos, 24/página).
  await expect(results.locator(".solara-search-result")).toHaveCount(24, { timeout: 15_000 });
  await expect(resultCount).toContainText("50 de 50");
```

(el resto del test — casos `?q=` — queda igual).

- [ ] **Step 7: Ejecutar los specs de búsqueda afectados**

Run: `corepack pnpm exec playwright test tests/e2e/ui-sweep-a30.spec.ts tests/e2e/search-catalog.spec.ts`
Expected: PASS (los tests con `?q=` no cambian; el modo query sigue intacto).

- [ ] **Step 8: Commit**

```powershell
git add packages/storefront-runtime/src/index.ts tests/e2e/search-catalog.spec.ts tests/e2e/ui-sweep-a30.spec.ts
git commit -m "feat(sitio): /buscar/ sin query muestra el catalogo completo paginado"
```

---

### Task 3: Runtime — paginación client-side de "todos los productos"

**Files:**
- Modify: `packages/storefront-runtime/src/index.ts` (handler `[data-category-sort]`, líneas ~2006-2085)
- Modify: `packages/modules/src/styles.ts` (reglas CSS de `.solara-pagination`, después de la línea 403)
- Modify: `tests/e2e/search-catalog.spec.ts` (agregar tests)

**Interfaces:**
- Consumes: `data-products-per-page` (Task 1), cards pobladas (Task 2), `copy.export.{pagination,previous,next,pageOf}` (ya embebido para `pageType: "search"`), copys `f.resultCount`.
- Produces: nav `.solara-pagination` con `button[data-pagination-prev]`, `span[data-pagination-status]` (tabindex -1, aria-live polite, aria-current="page"), `button[data-pagination-next]`; estado `?pagina=N` en la URL; noindex dinámico con pagina > 1.

- [ ] **Step 1: Escribir los e2e que fallan**

Agregar a `tests/e2e/search-catalog.spec.ts`:

```ts
test("la paginación client-side navega y refleja la página en la URL", async ({ page }) => {
  await page.goto(storeUrl("/buscar/"));
  const nav = page.locator(".solara-search-page .solara-pagination");
  await expect(nav).toBeVisible({ timeout: 15_000 });
  await expect(nav).toContainText("Página 1 de 3");
  await expect(nav.getByRole("button", { name: "Anterior" })).toBeDisabled();
  await expect(nav.getByRole("button", { name: "Siguiente" })).toBeEnabled();
  await nav.getByRole("button", { name: "Siguiente" }).click();
  await expect(page).toHaveURL(/\/buscar\/\?pagina=2$/);
  await expect(nav).toContainText("Página 2 de 3");
  await expect(
    page.locator("[data-search-results] .solara-search-result:not([hidden])"),
  ).toHaveCount(24);
  await nav.getByRole("button", { name: "Siguiente" }).click();
  await expect(nav).toContainText("Página 3 de 3");
  await expect(
    page.locator("[data-search-results] .solara-search-result:not([hidden])"),
  ).toHaveCount(2);
  await expect(nav.getByRole("button", { name: "Siguiente" })).toBeDisabled();
  await expect(nav.getByRole("button", { name: "Anterior" })).toBeEnabled();
});

test("el deep-link ?pagina=3 abre esa página y fuera de rango se clampea", async ({ page }) => {
  await page.goto(storeUrl("/buscar/?pagina=3"));
  const nav = page.locator(".solara-search-page .solara-pagination");
  await expect(nav).toContainText("Página 3 de 3", { timeout: 15_000 });
  await expect(
    page.locator("[data-search-results] .solara-search-result:not([hidden])"),
  ).toHaveCount(2);

  await page.goto(storeUrl("/buscar/?pagina=99"));
  await expect(nav).toContainText("Página 3 de 3", { timeout: 15_000 });
  await expect(page).toHaveURL(/\/buscar\/\?pagina=3$/);
});

test("?pagina= profunda declara noindex,follow", async ({ page }) => {
  await page.goto(storeUrl("/buscar/?pagina=2"));
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
    "content",
    "noindex,follow",
    { timeout: 15_000 },
  );
});

test("los filtros operan sobre todo el catálogo y re-paginan", async ({ page }) => {
  await page.goto(storeUrl("/buscar/?pagina=3"));
  const nav = page.locator(".solara-search-page .solara-pagination");
  const maxPrice = page.locator("[data-category-max-price]");
  await maxPrice.fill("12500");
  // Precio ≤ $12.500: sólo 2 productos del scale store (basePrice $12.250 y $12.500).
  await expect(page.locator("[data-category-result-count]")).toContainText("2 de 50");
  await expect(nav).toBeHidden();
  await expect(
    page.locator("[data-search-results] .solara-search-result:not([hidden])"),
  ).toHaveCount(2);

  // Con 25 resultados el clamp vuelve a la última página existente (2 de 2).
  await page.goto(storeUrl("/buscar/?pagina=3"));
  const tagFilter = page.locator("[data-category-tag]");
  await tagFilter.selectOption("casa");
  await expect(nav).toContainText("Página 2 de 2", { timeout: 15_000 });
  await expect(page).toHaveURL(/\/buscar\/\?pagina=2$/);
});
```

- [ ] **Step 2: Ejecutar y confirmar que fallan**

Run: `corepack pnpm exec playwright test tests/e2e/search-catalog.spec.ts`
Expected: los 4 tests nuevos FALLAN (no hay nav de paginación); el test de población sigue PASS.

- [ ] **Step 3: Implementar la paginación en el handler `[data-category-sort]`**

En `packages/storefront-runtime/src/index.ts`, dentro de `document.querySelectorAll<HTMLSelectElement>("[data-category-sort]").forEach(...)` (línea ~2006), después de la inserción de `filterEmpty` (línea ~2025) y antes de `const render = ...`, agregar:

```ts
    const pageSize =
      Number(grid.dataset.productsPerPage ?? "") ||
      (grid.closest("[data-search-results]") ? 24 : 0);
    let currentPage = 1;
    if (pageSize > 0) {
      const rawPage = Number.parseInt(
        new URLSearchParams(window.location.search).get("pagina") ?? "1",
        10,
      );
      currentPage = Number.isFinite(rawPage) && rawPage > 0 ? rawPage : 1;
      if (currentPage > 1) {
        document.querySelector('meta[name="robots"]')?.setAttribute("content", "noindex,follow");
      }
    }
    const paginationCopy = copy.export ?? {
      pagination: "Paginación",
      previous: "Anterior",
      next: "Siguiente",
      pageOf: "Página {page} de {total}",
    };
    const paginationNav = document.createElement("nav");
    paginationNav.className = "solara-pagination";
    paginationNav.setAttribute("aria-label", paginationCopy.pagination);
    paginationNav.hidden = true;
    const prevButton = node("button", paginationCopy.previous, {
      type: "button",
      "data-pagination-prev": "",
    });
    const pageStatus = node("span", "", {
      "data-pagination-status": "",
      "aria-live": "polite",
      tabindex: "-1",
    });
    const nextButton = node("button", paginationCopy.next, {
      type: "button",
      "data-pagination-next": "",
    });
    paginationNav.append(prevButton, pageStatus, nextButton);
    if (pageSize > 0) filterEmpty.insertAdjacentElement("afterend", paginationNav);
```

- [ ] **Step 4: Aplicar la ventana dentro de render()**

Reemplazar el tramo final de `render()` (desde `sorted.forEach((card) => { grid.append(card); });` hasta el cierre de `if (resultCount) { ... }`) por:

```ts
      const totalFilteredPages =
        pageSize > 0 ? Math.max(1, Math.ceil(sorted.length / pageSize)) : 1;
      if (currentPage > totalFilteredPages) currentPage = totalFilteredPages;
      const pageWindow = new Set(
        pageSize > 0 ? sorted.slice((currentPage - 1) * pageSize, currentPage * pageSize) : sorted,
      );
      sorted.forEach((card) => {
        grid.append(card);
      });
      cards.forEach((card) => {
        card.hidden = !pageWindow.has(card);
      });
      filterEmpty.hidden = visible.length > 0;
      if (resultCount) {
        const total = resultCount.getAttribute("data-category-total") ?? String(visible.length);
        resultCount.textContent = `${visible.length} de ${total} ${f.resultCount}`;
      }
      if (pageSize > 0) {
        paginationNav.hidden = totalFilteredPages <= 1;
        prevButton.disabled = currentPage <= 1;
        nextButton.disabled = currentPage >= totalFilteredPages;
        pageStatus.textContent = paginationCopy.pageOf
          .replace("{page}", String(currentPage))
          .replace("{total}", String(totalFilteredPages));
        pageStatus.setAttribute("aria-current", "page");
        const url = new URL(window.location.href);
        if (currentPage > 1) url.searchParams.set("pagina", String(currentPage));
        else url.searchParams.delete("pagina");
        window.history.replaceState(null, "", url);
      }
    };
```

(Con `pageSize = 0` — páginas de categoría/colección — `pageWindow` es igual a `sorted` y el comportamiento es idéntico al actual.)

- [ ] **Step 5: Navegación con foco y scroll**

Después de la definición de `render()` (antes de `grid.addEventListener("f", render);`), agregar:

```ts
    const goToPage = (next: number): void => {
      currentPage = Math.max(1, next);
      render();
      pageStatus.focus({ preventScroll: true });
      grid.scrollIntoView({
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "auto"
          : "smooth",
        block: "start",
      });
    };
```

Y después de los listeners existentes (`minPrice?.addEventListener...`, línea ~2084), agregar:

```ts
    prevButton.addEventListener("click", () => goToPage(currentPage - 1));
    nextButton.addEventListener("click", () => goToPage(currentPage + 1));
```

- [ ] **Step 6: CSS de los botones de paginación**

En `packages/modules/src/styles.ts`, después del bloque `[data-solara-store] .solara-pagination a:hover { ... }` (línea ~407), agregar:

```css
[data-solara-store] .solara-pagination button {
  min-width: 2.75rem;
  min-height: 2.75rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: .5rem .75rem;
  border: 1px solid var(--solara-border);
  border-radius: var(--solara-radius);
  background: transparent;
  font: inherit;
  color: inherit;
  cursor: pointer;
}
[data-solara-store] .solara-pagination button:hover:not(:disabled) {
  border-color: var(--solara-accent);
  color: var(--solara-accent);
}
[data-solara-store] .solara-pagination button:disabled {
  opacity: .45;
  cursor: default;
}
```

(No tocar el selector existente `.solara-pagination a, ... span`: los tests de a11y de `packages/modules/src/index.test.ts:1107-1141` hacen regex sobre ese texto.)

- [ ] **Step 7: Ejecutar el spec completo y los tests unitarios de estilos**

Run: `corepack pnpm exec playwright test tests/e2e/search-catalog.spec.ts`
Expected: PASS los 5 tests.

Run: `corepack pnpm exec vitest run packages/modules/src/index.test.ts`
Expected: PASS (los regex de paginación no cambiaron).

- [ ] **Step 8: Verificar specs vecinos**

Run: `corepack pnpm exec playwright test tests/e2e/ui-sweep-a30.spec.ts tests/e2e/axe-site.spec.ts tests/e2e/catalog-modern.spec.ts`
Expected: PASS (axe valida `/buscar/` con botones accesibles; el test de href "Ver todos" → `/buscar/` de catalog-modern.spec.ts:371 sigue pasando con búsqueda habilitada).

- [ ] **Step 9: Commit**

```powershell
git add packages/storefront-runtime/src/index.ts packages/modules/src/styles.ts tests/e2e/search-catalog.spec.ts
git commit -m "feat(sitio): paginacion client-side del catalogo en /buscar/"
```

---

### Task 4: Módulos — fallback de `/buscar/` apunta a la primera categoría

**Files:**
- Modify: `packages/modules/src/catalog-modern.ts` (líneas 586-588, 853, 878, 1212)
- Test: `packages/modules/src/index.test.ts` (test "no emite /buscar/ en la plantilla limpia", líneas 991-1003; nuevo test al lado)

**Interfaces:**
- Consumes: `context.project.categories` (schema `Category`).
- Produces: `catalogSearchHref(searchEnabled: boolean, href: string, project: StoreProjectV1): string` — con búsqueda deshabilitada y href `/buscar...`, devuelve `/categorias/<primera-raíz-visible>/` o `/`. Los tres call sites (hero 853, hero-slide 878, viewAll 1212) pasan `context.project`.

- [ ] **Step 1: Actualizar y agregar los tests unitarios**

En `packages/modules/src/index.test.ts`, reemplazar el test de las líneas 991-1003 por:

```ts
  it("no emite /buscar/ en la plantilla limpia cuando la búsqueda está apagada", () => {
    const project = structuredClone(catalogModernCleanStore);
    project.commerceTemplates.search.enabled = false;

    const html = renderSections(project, project.sections, { pageType: "home" });
    expect(html).not.toContain("/buscar/");
    // Sin categorías el fallback es la home; nunca `/categorias/` (404 latente).
    expect(html).toContain('class="catalog-view-all" href="/"');
    expect(html).not.toContain('href="/categorias/"');

    const enabledHtml = renderSections(catalogModernCleanStore, catalogModernCleanStore.sections, {
      pageType: "home",
    });
    expect(enabledHtml).toContain('href="/buscar/"');
  });

  it("con búsqueda apagada el viewAll /buscar/ cae en la primera categoría raíz visible", () => {
    const project = structuredClone(catalogModernCleanStore);
    project.commerceTemplates.search.enabled = false;
    project.categories = [
      CategorySchema.parse({
        id: "category-fallback-test",
        slug: "test-principal",
        title: "Test principal",
        description: "",
        productIds: [],
      }),
    ];

    const html = renderSections(project, project.sections, { pageType: "home" });
    expect(html).toContain('class="catalog-view-all" href="/categorias/test-principal/"');
    expect(html).not.toContain("/buscar/");
    expect(html).not.toContain('href="/categorias/"');
  });
```

Si `CategorySchema` no está importado, agregar al import de `@solara/project-schema`: `import { CategorySchema } from "@solara/project-schema";` (verificar el nombre exacto del import existente en el archivo y extenderlo).

- [ ] **Step 2: Ejecutar y confirmar que fallan**

Run: `corepack pnpm exec vitest run packages/modules/src/index.test.ts`
Expected: FAIL (hoy el fallback emite `href="/categorias/"` y el nuevo test no encuentra `/categorias/test-principal/`).

- [ ] **Step 3: Implementar**

En `packages/modules/src/catalog-modern.ts`, reemplazar `catalogSearchHref` (líneas 586-588) por:

```ts
function catalogSearchHref(searchEnabled: boolean, href: string, project: StoreProjectV1): string {
  if (searchEnabled || !href.startsWith("/buscar")) return href;
  const firstRootCategory = project.categories.find(
    (category) => !category.parentId && category.status !== "hidden",
  );
  return firstRootCategory ? `/categorias/${firstRootCategory.slug}/` : "/";
}
```

Y actualizar los tres call sites añadiendo `context.project` como tercer argumento:

- Línea 853: `catalogSearchHref(searchEnabled, activeSlide?.actionHref ?? settings.actionHref, context.project)`
- Línea 878: `catalogSearchHref(searchEnabled, slide.actionHref, context.project)`
- Línea 1212: `catalogSearchHref(searchEnabled, context.settings.viewAllHref, context.project)`

- [ ] **Step 4: Ejecutar y confirmar que pasan**

Run: `corepack pnpm exec vitest run packages/modules/src/index.test.ts`
Expected: PASS (incluye el test "no emite rutas a /buscar/" de la línea 975 y los de mega menú/bento).

- [ ] **Step 5: Commit**

```powershell
git add packages/modules/src/catalog-modern.ts packages/modules/src/index.test.ts
git commit -m "fix(sitio): viewAll sin busqueda cae en la primera categoria, no en /categorias/"
```

---

### Task 5: E2E — búsqueda deshabilitada con click-through

**Files:**
- Modify: `tests/e2e/storefront-nojs.spec.ts` (setup `noSearchStore`, líneas 37-38; nuevo test al final)

**Interfaces:**
- Consumes: `noSearchStore`/`noSearchPort` ya existentes en el spec; `catalogModernStore` (primera categoría raíz visible: `remeras`).
- Produces: verificación end-to-end del fallback del Task 4.

- [ ] **Step 1: Sembrar viewAllHref /buscar/ en el store sin búsqueda**

En `tests/e2e/storefront-nojs.spec.ts`, después de `noSearchStore.commerceTemplates.search.enabled = false;` (línea 38), agregar:

```ts
// Los grid de la plantilla limpia siembran viewAllHref "/buscar/": con la
// búsqueda apagada deben resolver a la primera categoría raíz visible.
noSearchStore.sections = noSearchStore.sections.map((section) =>
  section.moduleId === "catalog-product-grid"
    ? { ...section, settings: { ...section.settings, viewAllHref: "/buscar/" } }
    : section,
);
```

(Si TypeScript no infiere el spread del settings union, usar el módulo `catalog-product-grid` del registro de `@solara/modules` para tipar, o un cast puntual `as typeof section.settings & { viewAllHref: string }` validado contra el schema con `exportProject`.)

- [ ] **Step 2: Agregar el test e2e**

Al final de `tests/e2e/storefront-nojs.spec.ts`:

```ts
test("búsqueda deshabilitada: 'Ver todos' cae en la primera categoría raíz visible", async ({
  page,
}) => {
  await page.goto(`http://127.0.0.1:${noSearchPort}/`);
  const viewAll = page.locator("a.catalog-view-all").first();
  await expect(viewAll).toHaveAttribute("href", "/categorias/remeras/");
  await viewAll.click();
  await expect(page).toHaveURL(/\/categorias\/remeras\/$/);
  await expect(page.getByRole("heading", { level: 1, name: "Remeras" })).toBeVisible();
});
```

- [ ] **Step 3: Ejecutar el spec**

Run: `corepack pnpm exec playwright test tests/e2e/storefront-nojs.spec.ts`
Expected: PASS — el test existente "no se emiten formularios ni enlaces muertos a /buscar/" sigue pasando (los hrefs ahora son `/categorias/remeras/`, no `/buscar/`).

- [ ] **Step 4: Commit**

```powershell
git add tests/e2e/storefront-nojs.spec.ts
git commit -m "test(e2e): verifica el fallback de ver todos con busqueda apagada"
```

---

### Task 6: Documentación y CHANGELOG

**Files:**
- Modify: `docs/FULL_REFERENCE.md` (tabla de rutas, línea ~161)
- Modify: `docs/TECHNICAL_DEBT.md` (fila NG-1, línea 116; nueva fila de follow-up)
- Modify: `CHANGELOG.md` (entrada arriba del todo)

- [ ] **Step 1: FULL_REFERENCE**

En `docs/FULL_REFERENCE.md`, debajo de la fila de `/buscar/?q=`, agregar:

```markdown
| `/buscar/?pagina=N` | search | search.enabled | grid del catálogo completo paginado client-side (pageSize = `commerceTemplates.category.productsPerPage`); sin JS el grid queda vacío · noindex |
```

- [ ] **Step 2: TECHNICAL_DEBT**

Actualizar la fila NG-1 (línea 116) cambiando "el render sustituye el href por `/categorias/`" por "el render sustituye el href por la primera categoría raíz visible (`/` si no hay categorías; el fallback anterior `/categorias/` era un 404 latente)".

Agregar una fila de follow-up:

```markdown
| P3 | Abierto (catálogo en /buscar/ 2026-09-04): el render() del runtime re-apendea todas las cards en cada keystroke de precio; con catálogos de cientos de productos puede producir jank en equipos modestos. | Coste DOM por filtro. | Medir con el benchmark de export y un store de ~500 productos; si hace falta, debounce del render sólo en el scope de búsqueda. |
```

- [ ] **Step 3: CHANGELOG**

Agregar arriba del todo de `CHANGELOG.md` (formato del archivo, español):

```markdown
### Catálogo completo en "Ver todos los productos" (2026-09-04)

**Added**

- `/buscar/` sin query ahora muestra el catálogo completo paginado client-side
  (`search-index.json` + misma card de resultados), con controles
  `‹ Página X de Y ›`, deep-link `?pagina=N`, filtros y orden sobre todo el
  conjunto y `noindex,follow` en páginas profundas. Sin JS el grid sigue vacío
  (limitación C8 documentada).

**Fixed**

- Con la búsqueda deshabilitada, "Ver todos los productos" caía en
  `/categorias/` (ruta inexistente): ahora apunta a la primera categoría raíz
  visible o a la home.
```

- [ ] **Step 4: Commit**

```powershell
git add docs/FULL_REFERENCE.md docs/TECHNICAL_DEBT.md CHANGELOG.md
git commit -m "docs: documenta el catalogo paginado de /buscar/ y el fallback de viewAll"
```

---

### Task 7: Gates de cierre

**Files:** sin cambios de código; verificación y reconstrucción de artefactos.

- [ ] **Step 1: Loop post-cambio**

Run: `corepack pnpm check:micro`
Expected: PASS (diff + repository + typecheck/test de paquetes afectados).

- [ ] **Step 2: Budget del runtime**

Run: `corepack pnpm exec vitest run scripts/storefront-runtime-budget.test.ts scripts/public-storefront-budget.test.ts`
Expected: PASS (JS ≤ 68 KiB; el agregado de paginación es ~1-2 KiB).

- [ ] **Step 3: Smoke e2e**

Run: `corepack pnpm test:e2e:smoke`
Expected: PASS. Si toca `packages/exporter` o storefront (toca), correr además `corepack pnpm test:e2e:smoke:full`.

- [ ] **Step 4: Cierre**

Run: `corepack pnpm check:quick` y luego `corepack pnpm test:e2e` (full, ~3-4 min).
Expected: PASS completo.

- [ ] **Step 5: Reconstruir artefactos portable**

Run: `corepack pnpm build; corepack pnpm desktop:build; corepack pnpm desktop:package; corepack pnpm portable:smoke`
Expected: PASS (el código de storefront/exporter afecta el output de la app; AGENTS exige artefactos al día).

- [ ] **Step 6: Estado final**

Run: `git status; git log --oneline -8`
Expected: árbol limpio, 6 commits de la feature, artefactos regenerados (no commiteados).

---

## Notas de ejecución

- Los números de línea son los del working tree al 2026-09-04; si drifted, anclar por contenido (los strings exactos están en cada paso).
- Si el e2e de Task 3 "filtros re-paginan" resulta no determinístico por orden de tags, anclar con `selectOption({ label: "casa" })` y verificar el dataset de tags del scale store (línea 205 de scale-fixture: `["escala", par ? "casa" : "uso-diario"]` → 25 productos con "casa").
- El runtime no tiene harness DOM: la verificación de comportamiento es e2e; los unit del runtime validan strings del serializado si se requiere guard adicional.
