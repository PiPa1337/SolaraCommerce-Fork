# Revisión de Bugfixes 3 — 2026-08-09 — Implementation Plan

> **Para agentes:** SUB-SKILL REQUERIDA: `superpowers:subagent-driven-development` o `superpowers:executing-plans`. Pasos con casillas (`- [ ]`). **Ejecución: una ola de 9 implementadores en paralelo** (propiedad de archivos disjunta), luego cierre T10.

**Goal:** Corregir las regresiones de las rondas 1-2, el gate roto `test:e2e:portable` y los hallazgos accionables de la caza de la ronda 3 (5 agentes), con test primero.

**Architecture:** 9 tareas con propietario exclusivo (tabla abajo) + T10 cierre. Las tareas T1 (storage), T3 (exporter), T4 (runtime), T5 (módulos) tocan salida pública o el servidor: exigen budget, serialización o E2E de integración.

**Tech Stack:** Node 22+ (release), pnpm 10.15.1 vía `corepack`, Vitest 3.2.4, Playwright Chromium, Node `fs` nativo.

## Global Constraints

- No modificar `StoreProjectV2Schema` ni `schemaVersion: 2`. SCH1/SCH2/C8 quedan diferidos (decisión documentada; el export estático no puede hacer SSR por query).
- No agregar dependencias de runtime.
- Preview y sitio público usan el mismo renderer; `scripts/public-storefront-budget.test.ts` exige: production conserva preload LCP; storefront.js ≤ 52 KiB (medido 48.512 B); storefront.css ≤ 780 KiB.
- El runtime es un string serializado: `scripts/runtime-serialization.test.ts` debe seguir verde.
- El servidor local conserva: validación de rutas, 409, lock por tienda, manifest atómico, `writeGuard` (sólo tests). `solara-request-handler.mjs` compartido HTTP/Electron: no cambiar el contrato de respuestas (`open-site` sigue devolviendo `{ ok: true, url }`).
- Gates por task: `corepack pnpm --filter <paquete> test` + `typecheck` + E2E propio. Cierre: `check`, `build`, `check:budgets`, `benchmark:export`, `test:e2e`, `test:e2e:portable` (gate reparado en T8), `git diff --check`, `check:repository`, ejecutables.
- Commits breves en español, uno por task, `git add` explícito. Reportes `.superpowers/sdd/` nunca al commit. No correr `format:check` global (ola paralela); biome sólo sobre archivos propios.
- **Ola paralela:** si `git commit` falla por `index.lock`, esperar 3 s y reintentar hasta 5 veces. No tocar archivos de otras tareas. No editar specs E2E existentes salvo los asignados (los nuevos escenarios van en specs nuevos).
- Windows + PowerShell; sin bash, sin rg (Select-String). 0 U+FFFD al terminar (verificar con `Select-String -Pattern ([char]0xFFFD)`).

## Propietarios de archivos (disjuntos)

| Tarea | Archivos | Agente |
|---|---|---|
| T1 | `packages/exporter/scripts/local-project-storage.mjs`, `packages/exporter/scripts/solara-request-handler.mjs`, `packages/exporter/src/local-project-storage.test.mjs`, `packages/exporter/src/request-handler.test.mjs` (si existe) | G |
| T2 | `apps/studio/src/features/Export.tsx` (+ spec nuevo `tests/e2e/bugfix-audit-failure.spec.ts` si hace falta) | D |
| T3 | `packages/exporter/src/index.ts`, `packages/site-optimizer/src/index.ts` + sus tests | J |
| T4 | `packages/storefront-runtime/src/index.ts` + `index.test.ts` | H |
| T5 | `packages/modules/src/catalog-modern.ts`, `packages/modules/src/definitions.ts`, `packages/modules/src/styles.ts` + tests | I |
| T6 | `apps/studio/src/features/Catalog.tsx`, `apps/studio/src/workers/workers.ts`, `apps/studio/src/features/catalog/ProductEditor.tsx`, `apps/studio/src/features/ThemeEditor.tsx`, `apps/studio/src/features/Overview.tsx` | A |
| T7 | `apps/studio/src/features/Builder.tsx`, `apps/studio/src/features/Studio.tsx` | B |
| T8 | `scripts/portable-e2e.mjs`, fila P3 de `docs/TECHNICAL_DEBT.md` | K |
| T9 | `HANDOFF.md`, `scripts/storefront-runtime-budget.test.ts`, `apps/studio/docs/deuda-editor.md`, `playwright.config.ts` | L |
| T10 | `docs/TECHNICAL_DEBT.md`, `CHANGELOG.md`, `README.md` | cierre |

---

### Task 1 — Storage: preview abierto sobrevive al guardado + cierres de estado (F-01, S-01, S-02, EX-B9, EX-B8, log dedupe)

**Defectos (evidencia de la caza de regresiones y del re-hunt):**
- **F-01 (HIGH, regresión de T7/c4198e3)**: la poda de `sitios/` (`local-project-storage.mjs:576-598`) borra el directorio que el servidor cacheado de `open-site` sigue sirviendo (`solara-request-handler.mjs:286-296` sólo cierra el server en la SIGUIENTE llamada a open-site) → la pestaña de preview abierta hace 404 tras un guardado con sitio; riesgo latente: `writeNodeFile` (`:172-176`) hace `createReadStream(file).pipe(reply)` sin handler de error → un ENOENT durante el borrado emite `uncaughtException` y **tumba el servidor local entero**. Fix: (a) la ruta de commit del handler pasa `{ protectedSiteKeys: [...siteServers.values()].map(s => s.key) }` a `storage.commit(transactionId, opts)`; (b) `commit` filtra la poda con `!protectedSiteKeys.includes(entry.name)`; (c) `.on("error")` en el stream de `writeNodeFile` → responder 404/500 sin crashear; (d) test de integración: open-site → save con sitio → el server viejo sigue sirviendo; open-site de nuevo → cambia a la key nueva.
- **S-01 (MEDIUM)**: errores de commit entre `before-project-archive` y el try del manifest (`:525-537`: copyFile/rename del archive, respaldos, readFile, mkdir, assertNoReparsePoints) dejan `projectLocks`+`transactions` para siempre (el cliente muere: Electron `render-process-gone` recarga y el abort nunca llega). Fix: try/finally que libere lock + entrada + `rm(transaction.root)` en el camino de error (o en la ruta de commit del handler: `catch → storage.abort(transactionId)`).
- **S-02 (LOW-MED)**: los `.tmp` de sitios (`sitios/.${key}.${tx}.tmp`, `:495-512`) y de archives (`actual/.${name}.${tx}.tmp`) quedan para siempre: la poda excluye dot-dirs (`:583`) y `cleanupStaging` sólo mira staging. Fix: en la poda (o un barrido), eliminar dot-dirs con mtime > 24 h.
- **EX-B9 (MEDIUM)**: sin TTL de transacciones: un cliente muerto retiene el lock toda la sesión (`getTransaction` `:445-449` ya dice "no existe o expiró"). Fix: TTL 30 min en `getTransaction` (liberar lock + mapa + `rm(root)` + throw "expiró") y un barrido de locks stale en `beginSave`.
- **EX-B8 (LOW)**: `list()` declara sana una tienda cuyo `current` falla el hash en `readCurrent` (`:306-307` vs `:630-640`). Fix: verificar el sha256 en `list()` y derivar a recovery con el mensaje claro.
- **Log dedupe (LOW)**: `remove-old-current` no-fatal loguea `console.error` en cada guardado con fallo (`:600-615`). Fix: dedupe por path (Set) o downgrade.

- [ ] **Step 1: Tests que fallan (RED)** en `local-project-storage.test.mjs`/`request-handler.test.mjs` (patrones existentes de writeGuard y open-site): (1) integración open-site→save→server viejo sirve (con la API real del handler); (2) fallo en `copy-archive` (writeGuard) → el lock se libera y un segundo `beginSave` funciona; (3) dot-tmp viejo en `sitios/` se elimina en la poda (crear uno con mtime viejo); (4) transacción con `createdAt` vencida (inyectar reloj o escribir el marcador viejo) → `commit` falla "expiró" y el lock se libera; (5) `list()` con `current` corrupto (escribir bytes que no coinciden con el hash del manifest) → la tienda aparece en `recovery`.
- [ ] **Step 2: Implementar** los 6 fixes con las recetas arriba; respetar el contrato `{ ok, url }` de open-site y el formato del manifest (no renombrar campos).
- [ ] **Step 3: GREEN** `corepack pnpm --filter @solara/exporter test` PASS (todos: junction T4, writeGuard T8, poda T7) · `corepack pnpm exec playwright test tests/e2e/local-storage.spec.ts` GREEN · biome sobre los 4 archivos · `git diff --check` · 0 U+FFFD.
- [ ] **Step 4: Commit** → `git commit -m "El preview abierto sobrevive al guardado y los estados fallidos se liberan"`
- [ ] **Step 5: Reporte** `.superpowers/sdd/bugfix3-t1-report.md`

---

### Task 2 — Export: fallo de auditoría visible y recuperable (F-02)

**Defecto (regresión de T4/b283635)**: `Export.tsx:106-123` — si `import("@solara/exporter")` rechaza o `auditReport(project)` lanza, `auditReady` queda `false` para siempre (`.catch(() => undefined)` traga el error) y "Exportar producción" queda deshabilitado en silencio sin retry (`:407`).

- [ ] **Step 1: E2E que falla (RED)** en spec nuevo `tests/e2e/bugfix-audit-failure.spec.ts` (patrón de `bugfix-export.spec.ts` con `page.route` que falla el chunk del auditor): tras el fallo, el panel muestra un mensaje de error con un botón "Reintentar auditoría"; pulsar reintentar (con la ruta restaurada) habilita el botón de producción. Verificar selectores reales del panel al implementar.
- [ ] **Step 2: Implementar** (a) capturar el error del import/audit en un estado `auditError` y renderizarlo (patrón `InlineError`); (b) botón "Reintentar auditoría" que re-ejecuta el efecto (o exponer `runAudit` extraíble); (c) en fallo, `auditReady` vuelve a `true` con `critical: 0`? NO — dejar deshabilitado hasta el reintento exitoso, pero con el error visible (sin silencio).
- [ ] **Step 3: GREEN** `--filter @solara/studio test` + `typecheck` PASS · `playwright test tests/e2e/bugfix-audit-failure.spec.ts tests/e2e/bugfix-export.spec.ts tests/e2e/editor-console.spec.ts` GREEN · biome + diff-check.
- [ ] **Step 4: Commit** → `git commit -m "Muestra y reintenta la auditoría cuando el export falla al cargarla"`
- [ ] **Step 5: Reporte** `.superpowers/sdd/bugfix3-t2-report.md`

---

### Task 3 — Exporter/optimizer: legacy coherente, avisos honestos y contexto completo (F-03, X1, gates, NG-2, X4, X5, CSP, audit páginas)

**Defectos:**
- **F-03 (regresión de T10/ac34c5e, LOW-MED)**: en legacy, `tagOptions` se construye desde `paginated` (sólo la página, `index.ts:1200-1203`) mientras moderno usa todos los productos → tags de otras páginas inalcanzables. Fix: para legacy, construir las opciones desde TODOS los productos de la categoría (mismo `products` que usa el moderno); el filtro sigue operando sobre las cards de la página actual (limitación SF-B8 documentada).
- **X1 (MEDIUM UX)**: `baseUrl` con subcarpeta rompe assets root-relativos en silencio. Fix SIN schema: en `auditProject` (exporter) agregar warning `domain.baseurl-path` ("El sitio usa rutas relativas a la raíz; una baseUrl con subcarpeta rompe los assets") cuando `new URL(project.baseUrl).pathname !== "/"` + test.
- **Gate catalog-index (LOW)**: `index.ts:2222-2223` gatea `catalog-index.json` con `cartEnabled || checkoutEnabled` pero el runtime considera la feature `cart` con `siteShell.cart` — con drawer activo y ambos templates apagados, drawer que nunca reconcilia. Fix: agregar `|| project.siteShell.cart` al gate.
- **NG-2 (LOW-MED)**: con `navigation.showSearch=false` y `search.enabled=true`, la página `/buscar/` moderna se genera pero no tiene input persistente (el input del header está gateado) → búsqueda muerta con JS. Fix: en la página `/buscar/` moderna, emitir un form con `<input id="solara-search-input">` persistente (el runtime ya lo bindea; verificar los ids exactos en `index.ts:1057-1061`) + su label.
- **Audit de secciones huérfanas (LOW)**: `site-optimizer/src/index.ts:505-506` sólo escanea `project.sections`; un `catalog-product-grid` en `project.pages[].sections` con `sourceId` colgado renderiza grid vacío sin aviso. Fix: escanear también `project.pages.flatMap(p => p.sections)` + test.
- **X4 (LOW)**: `buildRoutes` (`site-optimizer/src/index.ts:288-300`) emite una sola ruta por colección; el sitio pagina colecciones (`index.ts:1374-1428`) y el sitemap las incluye. Fix: espejar el loop de paginación de categorías para colecciones en `buildRoutes` + test.
- **X5 (LOW)**: `buildImageSitemap` (`:1693-1702`) lista sólo page-1; `sitemap.xml` incluye las paginadas. Fix: iterar las rutas paginadas también.
- **CSP snapshot (LOW)**: el test sólo usa `toContain`; un cambio de directiva puede pasar. Fix: snapshot del string completo de `_headers` en `index.test.ts`.

- [ ] **Step 1: Tests que fallan (RED)** (en los test files existentes del exporter/site-optimizer): (1) legacy scale: opciones de etiqueta incluyen tags de productos de otras páginas (categoría con > productsPerPage); (2) auditoría con baseUrl `/tienda/` → warning `domain.baseurl-path`; (3) `siteShell.cart` sin templates → `catalog-index.json` presente en los files; (4) search page con `showSearch=false` → contiene `<input id="solara-search-input">`; (5) grid huérfano en una página → hallazgo de auditoría; (6) ai-context/llms.txt incluyen `/colecciones/<slug>/pagina/2/`; (7) image-sitemap incluye rutas paginadas; (8) snapshot exacto del header CSP.
- [ ] **Step 2: Implementar** los 8 fixes (sin cambiar URLs de production ni el contrato de respuestas).
- [ ] **Step 3: GREEN** `--filter @solara/exporter test` PASS · `--filter @solara/site-optimizer test` PASS · budget test PASS · `playwright test tests/e2e/scale-store.spec.ts tests/e2e/catalog-modern.spec.ts` GREEN · biome + diff-check · 0 U+FFFD.
- [ ] **Step 4: Commit** → `git commit -m "Coherencia legacy, avisos honestos y contexto de agentes completo"`
- [ ] **Step 5: Reporte** `.superpowers/sdd/bugfix3-t3-report.md`

---

### Task 4 — Runtime: líneas de cart no desaparecen y conteos honestos (F-04, SF-B7, SF-B8-runtime, C6, NG-4, SF-B13)

**Defectos:**
- **F-04 (regresión de T8/540731d, LOW-MED)**: `applyCatalog` (`index.ts:282-303`) descarta (`continue`) líneas cuyo variante no está en el index, y `openCart` llama `reconcileCart()` siempre (`:320-345`) → líneas de una exportación anterior desaparecen en silencio de cualquier página. Fix: en vez de descartar, marcarlas `available: false` y renderizarlas con nota "Ya no disponible" + permitir quitarlas; el checkout del drawer excluye (o bloquea) líneas no disponibles con mensaje. NO descartar.
- **SF-B7 (LOW)**: búsqueda corta en 48 sin aviso (`:1155-1157`). Fix: si `ranked.length > 48`, inyectar `<p class="solara-search-summary">Mostrando 48 de N resultados. Refiná tu búsqueda…</p>` (clase scoped ya existente o nueva en styles — NO tocar styles.ts; usar una clase existente o inline).
- **SF-B8-runtime (LOW-MED)**: el runtime sobreescribe el conteo de la categoría con el de la página visible (`:1211,1254-1261`). Coordinación con T3: el exporter emitirá `data-category-total="<total categoría>"` en `[data-category-result-count]`; el runtime, al actualizar, muestra `"X de N productos"` usando `data-category-total` para N (nunca lo pisa) y X = visibles actuales.
- **C6 (LOW)**: la tecla Escape/trap del drawer está gateada con `if (!hasFeature("cart")) return;` (`:578`); con checkout-only el drawer abre sin Escape ni trampa. Fix: `if (!hasFeature("cart") && !hasFeature("checkout")) return;`.
- **NG-4 (P3)**: input de cantidad del drawer `min="0"` vs mínimo efectivo 1 (`:221`). Fix: `min="1"`.
- **SF-B13 (LOW)**: menú móvil `aria-modal` sin `inert` en el fondo (`catalog-modern.ts:230` markup; runtime `:777-790`). Fix: al abrir, `inert` en los hermanos del menú (o el wrapper de página); al cerrar, quitarlo — espejar el patrón del drawer (`:329-361`).

- [ ] **Step 1: Tests que fallan (RED)** en `index.test.ts` (estilo serializado): (1) `applyCatalog` conserva la línea no disponible (exportar la función si hace falta, respetando el estilo del archivo) y el render la marca; (2) el serializado contiene `data-category-total` en la actualización de conteo (y "de N"); (3) el serializado contiene el summary de búsqueda con `Mostrando 48 de`; (4) el keydown del drawer incluye la condición checkout; (5) `min="1"` en el input del drawer.
- [ ] **Step 2: Implementar** los 6 fixes. Cuidado con el budget: `corepack pnpm exec vitest run scripts/public-storefront-budget.test.ts` (JS ≤ 52 KiB, medido 48.512 B) — reportar bytes finales.
- [ ] **Step 3: GREEN** `--filter @solara/storefront-runtime test` PASS · `scripts/runtime-serialization.test.ts` PASS · budget PASS · `playwright test tests/e2e/editor-motion.spec.ts tests/e2e/catalog-modern.spec.ts` GREEN · biome + diff-check · 0 U+FFFD.
- [ ] **Step 4: Commit** → `git commit -m "Las líneas no disponibles se ven y los conteos de categoría son honestos"`
- [ ] **Step 5: Reporte** `.superpowers/sdd/bugfix3-t4-report.md`

---

### Task 5 — Módulos: gating de carrito, template limpio y estilos (C11, NG-1, NG-3, NG-5, SF-B11+NG-6)

**Defectos:**
- **C11 (LOW)**: el botón de carrito moderno (`catalog-modern.ts:217-220`) se muestra con `navigation.showCart && siteShell.cart` mientras legacy exige además `(cart.enabled || checkout.enabled)` (`definitions.ts:149`) → moderno con ambos templates apagados abre un drawer muerto. Fix: agregar la misma condición a moderno (y así el drawer no se renderiza — el `footer cart slot` del exporter se alinea en T3 con el gate del index).
- **NG-1 (LOW-MED)**: la plantilla limpia (`packages/project-schema/src/catalog-modern-template.ts:34,54`) siembra `viewAllHref`/`actionHref` `/buscar/` sin gate; en una tienda con búsqueda apagada la sección apunta a 404. Fix en el render (NO en la plantilla): en hero/grid, si `search` está deshabilitada, sustituir el href por `/categorias/` (o ocultar el control) — verificar cómo se resuelven `viewAllHref`/`actionHref` en `catalog-modern.ts:263,483`; extender el test de gating de `modules/src/index.test.ts` para correr contra la plantilla limpia (no sólo la fixture).
- **NG-3 (P3)**: `aria-pressed` inicial de las pills de opciones usa `matching[0]` (`catalog-modern.ts:731-737`) en vez de `firstVariant.optionValues[name] === value` → SSR puede mostrar pill sin pulsar para la combinación real. Fix: computar de `firstVariant.optionValues`.
- **NG-5 (LOW)**: el empty-state del filtro legacy sin estilo (`styles.ts:2172` sólo moderno). Fix: regla scoped legacy (p. ej. `[data-solara-module="editorial-product-grid"] [data-category-grid] + .solara-empty-state`).
- **SF-B11 + NG-6 (LOW)**: sin `@media print` en el storefront; el menú móvil puede filtrarse en impresión desde viewport angosto. Fix: bloque `@media print` en `styles.ts` (ocultar `[data-cart-drawer]`, backdrops, `.catalog-mobile-menu`, resetear transforms) + en `catalog-modern.ts` el noscript del menú no aplica en print (regla print con `!important`).

- [ ] **Step 1: Tests que fallan (RED)** en `packages/modules/src/index.test.ts` + spec storefront existente o nuevo: (1) template limpia con search off → sin href `/buscar/` en hero/grid; (2) header moderno con templates off → sin botón de carrito; (3) pills: `aria-pressed` correcto para firstVariant con opciones múltiples (proyecto en memoria); (4) print: el CSS serializado del módulo contiene `@media print` con `[data-cart-drawer]`.
- [ ] **Step 2: Implementar** los 5 fixes.
- [ ] **Step 3: GREEN** tests del paquete modules PASS · `--filter @solara/exporter test` PASS (el módulo alimenta el exporter) · `playwright test tests/e2e/catalog-modern.spec.ts tests/e2e/storefront-nojs.spec.ts` GREEN · budget PASS · biome + diff-check · 0 U+FFFD.
- [ ] **Step 4: Commit** → `git commit -m "Gating coherente de carrito y búsqueda y estilos de impresión del storefront"`
- [ ] **Step 5: Reporte** `.superpowers/sdd/bugfix3-t5-report.md`

---

### Task 6 — Studio: CSV con duplicados no tumba la app y formularios coherentes (F1, F2, F4, F6)

**Defectos (nuevos de la caza de Studio):**
- **F1 (MEDIUM)**: "Reemplazar catálogo" con CSV que repite `slug` (o ids de producto/variante) → `Catalog.tsx:918-921` despacha `products.replaceAll` sin try/catch → ZodError en `executeCommand` → el ErrorBoundary recarga la app y pierde undo. Fix: validar duplicados tras el parseo CSV (`workers.ts:165` `importCsvInWorker`) y reportar por fila (mismo patrón que `applyPackage` en `Catalog.tsx:710-733`), o try/catch alrededor del dispatch con mensaje inline; preferir la validación por fila (mejor UX). Test: worker CSV con slugs duplicados → error por fila, sin dispatch.
- **F2 (LOW)**: `ProductEditor.tsx:687-694` precio de variante `Number("")` → 0 en silencio (inconsistente con `:701-709`). Fix: mismo guard que SettingsInspector (`""` → no commit).
- **F4 (LOW/MED)**: `ThemeEditor.tsx:19-21` comenta que el modo oscuro "dispararía overrides hardcodeados del storefront" pero el select (`:249-263`) permite elegirlo. Fix: alinear comportamiento: deshabilitar la opción "Oscuro" (y "Claro" si aplica) con un hint, o eliminar el comentario si el comportamiento es intencional — decidir leyendo el código y el preview; lo correcto es impedir la selección rota (disabled + tooltip) manteniendo "Auto".
- **F6 (LOW)**: `Overview.tsx:709-722` `seoTitle`/`seoDescription` sin maxLength ni contadores (el schema caps 70/180; `Seo.tsx:172-186` sí tiene). Fix: agregar maxLength + contador (mismo patrón que Seo.tsx).

- [ ] **Step 1: Tests que fallan (RED)**: (1) worker CSV: fixture con slugs duplicados → resultados con error por fila (test de worker existente — verificar nombre); (2) E2E opcional si el flujo lo permite (spec nuevo `tests/e2e/bugfix-csv-dupes.spec.ts`): reemplazar catálogo con duplicados → error visible, app viva.
- [ ] **Step 2: Implementar** los 4 fixes.
- [ ] **Step 3: GREEN** `--filter @solara/studio test` PASS + typecheck · `playwright test tests/e2e/bugfix-csv-dupes.spec.ts tests/e2e/editor-smoke.spec.ts` (si el spec existe) GREEN · biome + diff-check.
- [ ] **Step 4: Commit** → `git commit -m "El reemplazo de catálogo valida duplicados y los formularios no mutan en silencio"`
- [ ] **Step 5: Reporte** `.superpowers/sdd/bugfix3-t6-report.md`

---

### Task 7 — Studio: foco del picker y diálogos simultáneos (F-05/F8, F-06)

**Defectos:**
- **F-05/F8 (LOW, regresión parcial de T6/a1d0567)**: cerrar el ModulePicker con click fuera llama `setPickerOpen(false)` directo (`Builder.tsx:257-263`) en vez de `closePicker()` (`:266-270`, que restaura el foco al botón y resetea el query). Fix: `handleOutside` → `closePicker()`.
- **F-06 (LOW, edge de T2/ad4d31a)**: `confirmLeave` (ConfirmDialog) se renderiza como hermano del shell inert (`Studio.tsx:887-900`), así que puede quedar interactivo detrás del overlay 409. Fix: mover el ConfirmDialog dentro del contenedor inert (o inertearlo explícitamente mientras hay conflicto).

- [ ] **Step 1: E2E que falla (RED)** en `tests/e2e/editor-a11y.spec.ts` (anexar, sin pisar): (1) abrir picker → click fuera → el foco vuelve al botón "Agregar sección" (`document.activeElement`); (2) abrir "Volver a tiendas" y provocar 409 → el diálogo confirmLeave no es enfocable (Tab no llega a sus botones). Si el segundo es frágil, mínimo el primero.
- [ ] **Step 2: Implementar** los 2 fixes.
- [ ] **Step 3: GREEN** `--filter @solara/studio test` + typecheck · `playwright test tests/e2e/editor-a11y.spec.ts tests/e2e/editor-shell.spec.ts` GREEN · biome + diff-check.
- [ ] **Step 4: Commit** → `git commit -m "El cierre por fuera del picker restaura el foco y el diálogo de salida queda inert"`
- [ ] **Step 5: Reporte** `.superpowers/sdd/bugfix3-t7-report.md`

---

### Task 8 — Gate portable reparado (H1, H2)

**Defectos:**
- **H1 (HIGH)**: `scripts/portable-e2e.mjs:87` usa `getByRole("button", { name: "Resumen" })` pero las tabs del Studio son `role="tab"` (`Studio.tsx:730-740`; todos los specs usan `getByRole("tab")`) → `test:e2e:portable` falla siempre con timeout ~30 s. Fix: `getByRole("tab", { name: "Resumen", exact: true })` (patrón `local-storage.spec.ts:52`). Además corregir la fila P3 de `docs/TECHNICAL_DEBT.md` (`:88` → `:87` y quitar la afirmación "hoy convive porque el flujo real no falla", que es falsa).
- **H2 (MEDIUM)**: `scripts/portable-e2e.mjs:146-148` — `rmSync(testRoot, { recursive: true, force: true })` en `finally` puede lanzar EPERM/EBUSY (Electron no ha liberado las carpetas) y enmascarar el resultado real. Fix: loop de reintentos (3-5 con espera) ignorando EPERM/EBUSY, o try/catch que loguee y no falle la corrida.

- [ ] **Step 1: Corregir** H1 y H2.
- [ ] **Step 2: Verificar** `corepack pnpm exec node scripts/portable-e2e.mjs` (requiere la distribución portable ya empaquetada; si el empaquetado quedó viejo, correr antes `corepack pnpm desktop:package`) — GREEN (tiempo: ~1-2 min; antes fallaba en ~30 s en Resumen) · `git diff --check`.
- [ ] **Step 3: Commit** → `git add scripts/portable-e2e.mjs docs/TECHNICAL_DEBT.md` → `git commit -m "Repara el gate portable: tabs y limpieza tolerante"`
- [ ] **Step 4: Reporte** `.superpowers/sdd/bugfix3-t8-report.md`

---

### Task 9 — Números actuales y limpieza de config (D1/D2, deuda-editor, baseURL)

**Defectos/limpieza (bajos, docs+config):**
- **D1/D2**: `HANDOFF.md:88` "runtime JS ≤ 52 KiB (medido ~41 KiB) y CSS ≤ 8 KiB (medido ~6.6 KiB)" — mediciones viejas; hoy JS = 48.512 B (~47.4 KiB), CSS = 7.486 B (~7.3 KiB). Igual en el comentario de `scripts/storefront-runtime-budget.test.ts:11` ("41.475 B / 6.608 B"). Actualizar ambos con las mediciones reales (verificarlas corriendo el test).
- **deuda-editor.md:121**: afirma que `stripPreviewLcpPreload` "se aplicó" — el código se eliminó en la ronda 1. Actualizar la línea (o marcarla como eliminada).
- **playwright.config.ts:12**: `baseURL: "http://127.0.0.1:4175"` muerto (ningún spec navega relativo). Removerlo (y verificar que ningún spec use `page.goto` relativo).

- [ ] **Step 1: Implementar** los 3 ajustes.
- [ ] **Step 2: Verificar** `corepack pnpm exec vitest run scripts/storefront-runtime-budget.test.ts scripts/public-storefront-budget.test.ts` PASS con las mediciones actuales · `corepack pnpm exec playwright test tests/e2e/editor-smoke.spec.ts` GREEN (sin baseURL) · `git diff --check` · 0 U+FFFD.
- [ ] **Step 3: Commit** → `git commit -m "Actualiza mediciones del runtime y quita la baseURL muerta"`
- [ ] **Step 4: Reporte** `.superpowers/sdd/bugfix3-t9-report.md`

---

### Task 10 — Cierre: deuda, CHANGELOG, gates, ejecutables, push

- [ ] **Step 1: Deuda** — marcar RESUELTAS (con commits): F-01/S-01/S-02/EX-B9/EX-B8 (T1), F-02 (T2), F-03/X1/gates/NG-2/X4/X5/CSP/audit-páginas (T3), F-04/SF-B7/SF-B8/C6/NG-4/SF-B13 (T4), C11/NG-1/NG-3/NG-5/SF-B11 (T5), F1/F2/F4/F6 (T6), F-05/F-06 (T7), H1/H2 (T8), D1/D2 (T9). Añadir filas nuevas si no existen. Dejar ABIERTAS (documentadas): C8 (no-JS SSR inviable en estático), D1/D7 (cierre con guardados en vuelo — decisión UX pendiente), SF-B3 (flags muertos — opcional), EX-B7 (semántica sha256), P2 (raíz portable), P3 (nombres reservados), SCH1/SCH2 (schema), baseUrl subcarpeta fix completo (el warning X1 es el primer paso).
- [ ] **Step 2: CHANGELOG** — entrada "Revisión de bugfixes 3 (2026-08-09)" (formato Keep a Changelog, español).
- [ ] **Step 3: Gates** `corepack pnpm check` · `build` · `check:budgets` · `benchmark:export` · `test:e2e` · `test:e2e:portable` · `git diff --check` · `check:repository` — todos PASS (si el runtime excede el budget, volver a T4).
- [ ] **Step 4: Ejecutables** `desktop:build` · `desktop:package` · `portable:smoke` — OK.
- [ ] **Step 5: Commit y push** docs → `git commit -m "Cierra la revisión de bugfixes 3"` → `git push origin main`.
- [ ] **Step 6: Verificación final** `git log --oneline -15`, `git status --porcelain` vacío salvo reportes ignorados, ledger actualizado.

---

## Self-Review (autor)

- **Cobertura:** los 5 informes de caza (incl. el reintento del storage) quedan mapeados: F-01/S-01/S-02/EX-B9/EX-B8→T1; F-02→T2; F-03/X1/NG-2/X4/X5/CSP/audit-páginas/gate→T3; F-04/SF-B7/SF-B8/C6/NG-4/SF-B13→T4; C11/NG-1/NG-3/NG-5/SF-B11→T5; F1/F2/F4/F6→T6; F-05/F-06→T7; H1/H2→T8; D1/D2/deuda-editor/baseURL→T9; cierre→T10. Diferidos documentados: C8, D1/D7, SF-B3, EX-B7, P2, P3, SCH1/SCH2, X1-fix-completo, V4/V5.
- **Conflictos:** propietarios disjuntos verificados; SF-B8 coordina T3 (emite `data-category-total`) y T4 (lo consume) — el nombre del atributo es contrato entre tareas; C11 coordina T5 (markup) y T3 (gate del index).
- **Contratos:** sin cambios de schema; `{ ok, url }` intacto; budget JS ≤ 52 KiB; serialización verde.
- **Placeholders:** los "verificar al implementar" indican qué comprobar y la decisión permitida.
