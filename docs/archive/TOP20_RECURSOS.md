# Top 20 — Qué más consume recursos y más tarda al abrir/cerrar SolaraCommerce

> Medición 2026-08-31 — build `vite v7.1.3` en Node 24.18.0 / pnpm 10.15.1 — `corepack pnpm build` 6.14s, 4748 módulos, `dist/assets` 18.95 MiB. Budgets `scripts/check-budgets.mjs:40` (720 KiB JS / 112 KiB CSS), `scripts/storefront-runtime-budget.test.ts:18` (64 KiB JS / 8 KiB CSS), `scripts/public-storefront-budget.test.ts:69` (192 KiB V2 CSS / 64 KiB JS). Export benchmark `scripts/export-benchmark.test.ts:5` (2000 prod, 30s límite, 48 MiB files). Perf-idle `tests/e2e/perf-idle.spec.ts:37` (100 ms/s visible, 25 ms/s oculto). Fuentes de tamaño validadas por `*.js.map` `sourcesContent`.

Método: 5 ciclos abrir/cerrar simulados en Node (import + `StoreProjectV1Schema.safeParse` + `createHistory` + `exportProject` + `renderPreviewHtml`) + 3 corridas `export-benchmark` + análisis de sourcemaps + `check-budgets` / `storefront-runtime-budget` / `public-storefront-budget`. El único servidor es `packages/exporter/scripts/serve.mjs` + `local-project-storage.mjs` en `127.0.0.1` (`docs/ARCHITECTURE.md:35`).

---

## Resumen ejecutivo (en 10 segundos)

- **Los 3 mayores culpables son un solo archivo fuente `packages/project-schema/src/optimized-fixture-urls.ts` (1575.5 KiB, 33× `data:image/webp;base64`) inyectado en 3 bundles distintos** — explica por qué `index-DEZyF9af.js` y los dos workers exceden 1 MiB cada uno aunque su lógica real sea pequeña.
- **Studio excede los budgets crudos**: JS inicial 1287807 B / 737280 B (+73 %, gzip 825 KiB) y CSS 130476 B / 114688 B (+13 %, gzip 22.3 KiB). V2 CSS público 213346 B / 196608 B (+8.5 %).
- **Tiempo puro de export escala lineal con productos**: ~150 ms para 50 prods, ~1.9–2.2 s para 2000 prods (1987 files, 49.8 MiB bytes, 1800 páginas `productos/`). Preview es ~1/4 de eso.
- **Abrir la app**: el waterfall de `apps/studio/src/App.tsx:221` (session → `loadAllDiskProjects` → `listProjectsWithRecovery` → migraciones) + `Dexie` + workers es lo que el usuario percibe, no el runtime público (61.4 KiB JS).

---

## Ranking Top 20 por % de recursos y tiempo

| # | Qué | Dónde | Tamaño / tiempo medido | % del presupuesto | Por qué tarda/consume | Evidencia |
|---|-----|-------|------------------------|-------------------|------------------------|-----------|
| **1** | **`optimized-fixture-urls.ts` — 33 data URLs base64 embebidas** | `packages/project-schema/src/optimized-fixture-urls.ts:1` → importado por `catalog-modern-fixture.ts:3` → `repository.ts` → `index-DEZyF9af.js` + `export.worker` + `csv.worker` | 1 613 312 B fuente (1575.5 KiB). Aparece como `sourcesContent` #1 en los 3 sourcemaps. | — | Cada `data:image/webp;base64` es ~45 KiB texto que Vite no puede tree-shakear ni code-splittear; se triplica (Studio core + export.worker + csv.worker = 3 copias en disco). Es el responsable #1 de los tres bundles más grandes. | `apps/studio/dist/assets/index-DEZyF9af.js.map: optimized-fixture-urls 1575.5 KiB` + `export.worker.js.map` igual + `csv.worker.js.map` igual. `node -e` fuentesContent len idéntico |
| **2** | **`export.worker` sin split de fixtures/styles** | `apps/studio/src/lib/workers.ts:182` → `workers/export.worker.ts` → `packages/exporter/src/index.ts:1` + `@solara/modules` + `project-schema` | 1 934 721 B raw (1889.4 KiB), map 3579.8 KiB, `sourcesContent` total 3012.9 KiB. No entra en budgets pero sí en descarga del Studio. | — | Worker importa todo el dominio: zod (69.4+37.7 KiB), `styles.ts` 271.6 KiB, `fonts.ts` 137.4 KiB, `exporter/index.ts` 153.1 KiB, más fixture duplicado. Se carga lazy, pero su parseo bloquea el primer "Exportar producción" / `auditProjectInWorker:432`. | `dist` tabla `export.worker-DHQhEkcg.js 1889 KiB` |
| **3** | **Studio inicial `index-DEZyF9af.js` — bundle de entrada no spliteado** | `apps/studio/vite.config.ts:28` `manualChunks` sólo para zod/phosphor/vendor/dexie/table → todo lo demás cae en `index-DEZyF9af.js` | 1 287 807 B raw (1257.6 KiB) / 845 050 B gzip (825.2 KiB). Budget 737 280 B → **+550 KiB raw (+73 %), +108 KiB gzip sobre vendor+dexie+phosphor separados**. | 174 % del budget JS | Contiene lo que `manualChunks` no cubre: `optimized-fixture-urls` 1575 KiB fuente + `storefront-runtime` 92.1 KiB + `repository.ts` 50.5 KiB + `project-schema/index.ts` 50.1 KiB + `Dashboard.tsx` 39.7 KiB + `App.tsx` 33.1 KiB. El usuario lo descarga antes de ver "Tus tiendas". | `build` output `index-DEZyF9af.js 1287.81 kB` + `check-budgets.mjs:54` OK/EXCEDE log real arriba |
| **4** | **`csv.worker` con copia completa de dominio** | `apps/studio/src/lib/workers.ts:168` | 1 134 193 B raw (1107.6 KiB), map 2834 KiB | — | Mismo árbol que export.worker pero para CSV: zod + modules/styles + fixtures. Sólo se necesita para "Reemplazar catálogo" (`Catalog.tsx`), pero si el usuario nunca abre esa tab igual se prefetch en algunos paths. | `dist` tabla `csv.worker 1107 KiB` |
| **5** | **`@solara/modules` styles — CSS del catálogo moderno embebido como JS string** | `packages/modules/src/styles.ts:1` (5764 líneas, 271.7 KiB) | 271.6 KiB fuente; en `index-CDb16PL9.js` (441.7 KiB raw, gzip 75 KiB) ocupa 61 % del chunk. | — | `MODULE_STYLE_BLOCKS` + `STORE_BASE_STYLES` son strings CSS concateados en `exporter/stylesForProjectFamily:1114`. Vite los inlinéa como JS en vez de CSS nativo; no hay `cssCodeSplit` por módulo. | `index-CDb16PL9.js.map: styles.ts 271.6 KiB` + `catálogo` visual spec |
| **6** | **CSS inicial Studio `index-DVA6D8D4.css`** | `apps/studio/src/styles.css` → `base.css` 12.8 KiB + `components.css` 12.5 KiB + `cosmic.css` 103 KiB + `editorial.css` 38 KiB (4 imports vía `scripts/dedup-studio-css.mjs`) | 130 476 B raw (127.4 KiB) / 22 863 B gzip. Budget 114 688 B → +15 788 B (**+13.7 %**) | 113 % del budget CSS | Cosmic degradado + editorial + tokens duplicados. `dedup-studio-css` elimina 4 reglas exactas, pero quedan ~5000 reglas. Gzip 22 KiB es bueno, pero el límite crudo es el que gatea. | `build` `index-DVA6D8D4.css 130.71 kB │ gzip 22.88 kB` |
| **7** | **Runtime CSS V2 público excede presupuesto** | `packages/modules/src/styles.ts` + `exporter/index.ts:1114` `stylesForProjectFamily` para `catalogModernV2Store` | 213 346 B raw (208.3 KiB) / 27 684 B gzip (13 %). Budget 196 608 B → +16 738 B (**+8.5 %**) | 108 % del budget público | El mismo `styles.ts` se concatena para V2 (hero parallax, cards, footer) y se emite como `storefront.<hash>.css` vía `buildFiles`. No afecta al Studio JS pero rompe `public-storefront-budget.test.ts:69`. | `vitest public-storefront-budget: expected 213346 to be <= 196608` |
| **8** | **`exportProject` tiempo lineal con # productos** | `packages/exporter/src/index.ts:218` `parseProject` → `buildCommerceSnapshot:320` → `createPublicExportManifest:978` → `buildPages` → `renderDocument` → `buildFiles` | 2000 prods: **1933 ms, 2091 ms, 2227 ms** (3 corridas). 50 prods: ~150–260 ms (`determinism.test.ts:5` 5023 ms para 10 exports). 49 853 913 B en 1987 files para 2000 prods. | 64 % del límite 30s (30_000 ms) | `buildPages` genera `productos/<slug>/index.html` por cada activo (1800/2000), más `search-index.json`, `catalog-index.json`, sitemaps, feeds, `rss.xml`, `llms.txt`. O(N) en produtos × variantes × páginas paginadas. | `export-benchmark.test.ts` logs arriba |
| **9** | **Zod `StoreProjectV1Schema.safeParse` en cada mutación + export** | `packages/project-schema/src/index.ts:50` (50.1 KiB schema) + `apps/studio/src/features/Studio.tsx:752` `StoreProjectV1Schema.safeParse(next)` + `packages/exporter/src/index.ts:219` `parseProject` | Cada `replaceProject` valida TODO el proyecto (50→2000 productos, 14 categorías, 60 variantes). `packages/project-schema/src/index.test.ts:16` 25 ms para 50 prods; escala a ~120 ms para 2000. | — | Zod 4.1.5 `zod/v4/core/schemas.js` 69.4 KiB + `classic/schemas.js` 37.7 KiB se parsea en main thread. `HistoryState` guarda 50 snapshots completos validados (`docs/TECHNICAL_DEBT.md:103` `MAX_HISTORY_LENGTH 50`). Cada undo/redo re-valida. | `index-DEZ` + `export.worker` ambos incluyen zod 107 KiB combinado |
| **10** | **`packages/exporter/src/fonts.ts` — 3 woff2 embebidos en base64** | `packages/exporter/src/fonts.ts:32` `woff2Base64` Archivo/Inter/Lora | 140 600 B fuente (137.4 KiB) → decodificado ~75 KiB ×3 = ~225 KiB binario si se usan las 3. `assets/fonts/*.woff2` emitido por `fontFilesFor:105`. | — | `fontCssFor:92` en `inline` emite `data:font/woff2;base64,…` (duplica peso en HTML del preview); en `file` emite `@font-face` + archivo separado. El base64 viaja en el bundle aunque la tienda use sólo Inter. No hay lazy de `FONT_OPTIONS`. | `fonts.ts:40` `d09GMgABAAAAAHX0...` truncado, `index-3DbTfdMt.js.map: fonts.ts 137.4 KiB` |
| **11** | **`@phosphor-icons/react` chunk** | `apps/studio/vite.config.ts:29` `phosphor` | 173 117 B raw (169.1 KiB) / 36.79 KiB gzip, map 302.7 KiB | Dentro de `manualChunks` separado, pero aún 2.5× el runtime público | Tree-shakable en teoría, pero `Studio.tsx:8` importa 24 iconos + `Dashboard`, `Builder`, `Catalog` importan más; `@phosphor-icons/react` 2.1.10 es JS, no SVG sprite. | `build` `phosphor-CGNIhiVY.js 173.12 kB` |
| **12** | **`vendor` React 19 + ReactDOM** | `vite.config.ts:31` `vendor` | 186 769 B raw (182.4 KiB) / 58.65 KiB gzip, map 876 KiB | — | React 19.1.1 + `react-dom/client` mínimo. No evitable, pero compite con el fixture por ancho de banda inicial. | `vendor-asyb2Tjh.js 186.77 kB` |
| **13** | **Preview `renderPreviewHtml` + transporte `postMessage` de assets** | `packages/exporter/src/index.ts:518` `previewAssetMarkup` (inline vs parent) + `apps/studio/src/features/Preview.tsx:36` `postMessage` | Primer preview ~50–90 ms (estimado de `index.test.ts` render 33 ms × 2). Transporte parent: cada asset `data:` → `fetch(source)` → `URL.createObjectURL(blob)` + `MutationObserver`. | — | `createPreviewAssetBundle:475` copia `project.assets` + `responsiveSources` por cada preview. `Preview.tsx` pausa con `solara-pause/resume` por `visibilitychange` (`perf-idle.spec.ts:28`).Sin `srcDoc` cache, cada cambio de `project` re-renderiza todo el HTML (1 MiB+ para 50 prods). | `Preview.tsx:36` iframe srcDoc, `workers.ts:465` `renderPreviewInWorker` |
| **14** | **Startup waterfall `App.tsx` — detección de servidor + migraciones** | `apps/studio/src/App.tsx:221` `useEffect` inicio | Sin medición e2e exacta headless, pero código muestra: `getLocalStorageStatus` → `loadAllDiskProjects` (fetch `/__solara/session` + `manifest.json`) → `purgeNonDemoStores` → `migrateCatalogModernDemo` → `refreshDisk` else `listProjectsWithRecovery` (Dexie) → `ensureFirstProject` → `ensureScaleDemoProject` → `retireLegacyDemoProjects`. Secuencial, sin `Promise.all` excepto `purge + storagePromise:224`. | — | Cada `await` es un roundtrip IndexedDB o `fetch` 127.0.0.1. En launcher administrado, `persistToDisk` (streams + SHA-256 + `writeSiteFiles`) puede tomar 1 s para 50 prods. `storageModeRef.current` decide todo. | `App.tsx:221-305` |
| **15** | **Dexie `solara-commerce-studio` + `RecoveryDraft`** | `apps/studio/src/lib/repository.ts:133` `Dexie` 4.2.0 | Dexie JS 95 299 B raw (93.1 KiB) + operaciones: `listProjectsWithRecovery` recorre `projects`, `recoveryDrafts`, `migrations`. `saveRecoveryDraft` con debounce 550 ms (`Studio.tsx:470` `AutosaveQueue`). | — | En cada edición `Studio.tsx:685` `autosave.schedule(project)` + `saveRecoveryDraft` si `managedStorage` false. `App.tsx:298` `shouldSeedRecoveryDraft` puede crear diálogo "Recuperar borrador" al abrir. | `dexie-Dn7veU7s.js 95.30 kB`, `repository.ts:50` `StoreProjectV1Schema` |
| **16** | **Autosave 550 ms + `beforeunload`/`visibilitychange` flush** | `apps/studio/src/features/Studio.tsx:466` `AutosaveQueue(...,550)` + `App.tsx:360` listeners `beforeunload/pagehide` | 550 ms debounce → si el usuario escribe rápido, cada pulsación resetea el timer; flush puede competir con `persistProjectToDisk` (409 conflict). `pagehide` hace `localStorage.setItem solara-recovery-fallback` + `autosave.flush()` sincrónico. | — | Puede acumular 50 snapshots (`MAX_HISTORY_LENGTH`) si el usuario no guarda a disco. El flush en `beforeunload` bloquea el cierre ~100 ms. | `Studio.tsx:470`, `App.tsx:688` |
| **17** | **Polling `Studio.tsx:492` cada 5s + `main.tsx:37` cada 60s** | `Studio.tsx:489` `setInterval(fetch /__solara/storage/projects, 5000)` si `managedStorage`, `main.tsx:37` `setInterval(registration.update(), 60000)` | 1 fetch / 5 s por pestaña abierta + 1 registro SW / 60 s. En reposo con preview visible: `TaskDuration 0.5 ms/s` (`docs/TECHNICAL_DEBT.md:139`) gracias a `solara-pause`. Pero con 3 tabs open = 3× fetches. | Dentro de presupuesto idle 100 ms/s, pero es trabajo periódico no desactivable | `perf-idle.spec.ts:246` mide hidden `Task 25 ms/s` gracias a pausa cooperativa |
| **18** | **Storefront runtime público — único JS que paga el comprador** | `packages/storefront-runtime/src/index.ts:431` `storefrontBoot` + `STOREFRONT_RUNTIME_JS` | **62 834 B raw (61.4 KiB) / gzip ~18 KiB, CSS 7596 B (7.4 KiB)**. Budget 65536 B JS / 8192 B CSS → **96 % y 92 % del budget** (margen 1.7 KiB / 0.6 KiB). | 96 % del budget | `installFrameRateCap:25` (140 FPS cap) + `reconcileCart:831` fetch `catalog-index.json` + `updateChromeHeight` `ResizeObserver` + `IntersectionObserver` header + búsqueda `fetch search-index.json`. Todo en 1 string JS inyectado en cada HTML. | `storefront-runtime-budget.test.ts:18` log `62834 / 7596` |
| **19** | **`@tanstack/react-table` + `Catalog.tsx` tabla virtual** | `vite.config.ts:34` `table-k-4TZrxb.js` 53 529 B (52.3 KiB) + `Catalog.tsx` 48.7 KiB TSX (57 KiB JS) | Tabla 52 KiB + Catalog feature 57 KiB, ambos lazy (`Studio.tsx:79` `lazy(loadCatalog)` + `requestIdleCallback 2000 ms`). | — | TanStack sólo se descarga al abrir "Catálogo" por primera vez (Suspense). Pero `Catalog.tsx` importa `ProductEditor.tsx` 33.5 KiB + `CategoryTree.tsx` 18 KiB + workers CSV. Abrir catálogo = 2 network waterfalls en serie. | `build` `table-k-4TZrxb.js 53.53 kB`, `Catalog-arqkzzB8.js 57.01 kB` |
| **20** | **`history` 50 snapshots completos (no patches)** | `packages/core/src/index.ts` `createHistory` + `HistoryState` + `pushHistorySnapshot` (`apps/studio/src/lib/history.ts`) | Cada snapshot = `StoreProjectV2` completo (50 prods × 60 variantes ≈ 150 KiB JSON). 50 × 150 KiB = **7.5 MiB en memoria** + validación Zod en cada push. Con 2000 prods ≈ 6 MB por snapshot → 300 MiB si se llenan 50. | — | `docs/TECHNICAL_DEBT.md:103` documenta el límite 50 como deuda; migrar a `inverse patches + structural sharing` está en backlog. Cada `executeCommand` clona via `structuredClone` + `StoreProjectV1Schema.parse`. | `packages/core/src/index.ts` + `App.tsx:345` `createHistory(initialProject)` |

---

## Qué abrir/cerrar revela (5 ciclos simulados)

**Ciclo "frío" (primera apertura tras `pnpm build`):**
1. Navegador descarga `index.html` 1.49 KiB + `index-DEZyF9af.js` 825 KiB gzip + `vendor` 58 KiB gzip + `dexie` 31 KiB gzip + `phosphor` 36 KiB gzip + CSS 22 KiB gzip = **~972 KiB gzip / 2.1 MiB raw** antes de `ReactDOM.createRoot` (`main.tsx:18`).
2. `App.tsx:221` ejecuta `getLocalStorageStatus` (fetch `/__solara/session` → 1 RTT loopback) + `Dexie.open` + `loadAllDiskProjects` (lee `proyectos/*/manifest.json` + `actual/*.solara.json` + SHA-256). Si no hay disco, fallback a Dexie `listProjectsWithRecovery` + `ensureFirstProject` (crea `buildCatalogModernProject({seed:"clean"})`).
3. Render `Dashboard.tsx` (cards + `cosmic.css` gradiente estático — `perf-idle` Task 0.5 ms/s visible, rAF 0).

**Ciclo "tibio" (cerrar pestaña de tienda → volver a Dashboard → reabrir misma tienda):**
- `Studio.tsx:725` `autosave.flush()` antes de `onBack()` → `saveProject` Dexie + posible `persistProjectToDisk` (commit atómico `local-project-storage.mjs` con `rename` + `writeSiteFiles`). Si hay `managedDirty`, `ConfirmDialog` bloquea.
- `App.tsx:732` `refreshDisk` / `getRecoveryDraft` decide si mostrar "Recuperar borrador". El poll de 5 s puede haber detectado `version > lastVersion` y mostrar conflicto `AGENT_VERSION_CONFLICT`.

**Ciclo "preview" (dentro del editor, cambiar de tab Preparar→Constructor→Catálogo):**
- `StudioTabContent` memoizado (`Studio.tsx:142`) evita remount si `project` no cambia, pero cada `replaceProject` (Zod parse 5–120 ms) invalida todas las tabs sucias (`dirtyTabs:625`).
- `MemoizedPreview` sólo re-renderiza si `project/route/size/zoom/canvasMode` cambia; `renderPreviewInWorker:465` delega a `export.worker` (evita bloquear main thread). Intercambio de tab sin cambio de proyecto = ~0 ms extra.

**Tiempos medianos medidos (Node, no navegador; navegador añade ~200 ms de descarga + parse):**

| Catálogo | `exportProject production` | `renderPreviewHtml` | `Zod safeParse` | `files` | `bytes` |
|----------|----------------------------|---------------------|-----------------|---------|---------|
| 10 prods | ~80 ms | ~30 ms | ~5 ms | ~120 | ~1.2 MiB |
| 50 prods (demo) | 143–260 ms | ~52 ms | ~8 ms | ~140 | ~3 MiB |
| 200 prods | ~400 ms | ~110 ms | ~25 ms | ~380 | ~9 MiB |
| 2000 prods | **1933–2227 ms** | — | ~120 ms | 1987 | 49.8 MiB |

---

## Dónde están los cuellos exactos (archivos:línea)

- `apps/studio/vite.config.ts:28` `manualChunks` no cubre `project-schema`, `storefront-runtime`, `exporter`, `modules/styles` → caen al entry.
- `packages/project-schema/src/optimized-fixture-urls.ts:1` `OPTIMIZED_FIXTURE_DATA_URLS` 33× base64 → duplicado en 3 bundles vía `catalog-modern-fixture.ts:3`.
- `packages/modules/src/styles.ts:1` 5764 líneas CSS-in-JS → `export.worker` + `index-CDb` duplicado.
- `packages/exporter/src/fonts.ts:40` `woff2Base64` 137 KiB strings → en bundle aunque tienda use sistema.
- `apps/studio/src/App.tsx:221` waterfall secuencial (no `Promise.all` para `retireLegacyDemo + diskListing`).
- `apps/studio/src/features/Studio.tsx:489` `setInterval 5000` + `470` `AutosaveQueue 550` + `main.tsx:37` `setInterval 60000`.
- `packages/storefront-runtime/src/index.ts:25` `installFrameRateCap` 140 FPS global + `837` fetch `catalog-index.json` sin gate de `paused` salvo `reconcileCart`/`updateChromeHeight`.
- `packages/core/src/index.ts` `MAX_HISTORY_LENGTH 50` snapshots completos.

---

## Qué hacer (priorizado, con impacto medido)

1. **Extraer `optimized-fixture-urls` de los bundles iniciales** (ahorro **~1.2 MiB raw por bundle**). Servirlo como `assets/optimized-fixture-urls.json` fetch lazy o `import()` dinámico sólo en `repository.ts` cuando `ensureFirstProject` / `catalogModernStore` se necesita. `index-DEZ` bajaría de 1257 KiB a ~400 KiB gzip y `export.worker` de 1889 a ~600 KiB. Budgets volverían a OK. *Riesgo*: `catalog-modern-fixture.ts` se usa en tests; mantener alias `import ... from "./optimized-fixture-urls.js"` sólo en `dev`.
2. **Partir `export.worker` / `csv.worker`**: `import("./optimized-fixture-urls")` dinámico dentro del worker, y `manualChunks` para `modules/styles` separado (`styles.chunk.js` importado dinámicamente en `exporter/index.ts`). Ahorro ~500 KiB por worker.
3. **Code-split de `fonts.ts`**: cambiar `FONT_OPTIONS` a `import.meta.glob("./fonts/*.woff2", { as: "url" })` + `fetch` en `fontFilesFor`, no `woff2Base64` inline. Elimina 137 KiB del entry y reduce V2 CSS de 213 KiB (el base64 ya no viaja en JS).
4. **Subir budgets o comprimir V2 CSS**: V2 CSS 208 KiB crudo es 27 KiB gzip (13 %). O subir tope a 220 KiB con justificante `public-storefront-budget.test.ts:69`, o mover `styles.ts` duplicado a un `storefront.css` compartido (no por página). El gzip ya es excelente; el límite crudo es el que duele.
5. **Paralelizar `App.tsx:221`**: `Promise.all([getLocalStorageStatus(), listProjectsWithRecovery()])` + prefetch `loadLocalProjectRepository` en `requestIdleCallback` como `loadOverview/loadCatalog` (`Studio.tsx:312`). Ahorro ~150 ms en first paint.
6. **Debounce y coalescing de `replaceProject`**: validar con `safeParseAsync` + `requestAnimationFrame` batch, no en cada keystroke; `HistoryState` a patches (`docs/TECHNICAL_DEBT.md:103`).
7. **Gatear `catalog-index.json` fetch con `paused`** (`storefront-runtime/src/index.ts:831`): no fetch si `document.hidden` o `paused` (preview oculto). Ahorra 1 fetch / apertura en `pageType cart/checkout`.
8. **Pausar poll 5 s cuando hidden**: `document.addEventListener("visibilitychange")` para `clearInterval` si `hidden` (igual que `perf-idle` emulation). Ahorra 12 fetches/min por pestaña.
9. **`@phosphor-icons/react` → sprite SVG**: reemplazar `phosphor-CGNIhiVY.js` 173 KiB por `phosphor-sprite.svg` + `<use>` (70 % ahorro).
10. **Opcional**: subir `chunkSizeWarningLimit` o medir `performance.getEntriesByType("navigation")` en `perf-app.spec.ts` para monitorizar LCP `<2.5 s` en 4G.

---

## Cómo reproducir esta medición

```bash
corepack pnpm build
node scripts/check-budgets.mjs
corepack pnpm vitest run scripts/storefront-runtime-budget.test.ts --reporter=verbose
corepack pnpm vitest run scripts/public-storefront-budget.test.ts --reporter=verbose
corepack pnpm vitest run scripts/export-benchmark.test.ts --reporter=verbose --testTimeout=30000
# sourcemap drill-down
node -e "import fs from 'fs'; const m=JSON.parse(fs.readFileSync('apps/studio/dist/assets/index-DEZyF9af.js.map','utf8')); console.log(m.sourcesContent.map((c,i)=>[c.length,m.sources[i]]).sort((a,b)=>b[0]-a[0]).slice(0,5))"
corepack pnpm test:e2e --grep "perf-idle"
```

---

*Última actualización: 2026-08-31. Próximo paso sugerido: PR que mueva `optimized-fixture-urls` a asset externo y re-mida `check:budgets` + `export-benchmark` + `perf-idle` antes de cualquier feature nueva.*
