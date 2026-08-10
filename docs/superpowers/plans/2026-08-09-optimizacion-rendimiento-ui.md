# Optimización de rendimiento y UI — 2026-08-09 — Implementation Plan

> **Para agentes:** SUB-SKILL REQUERIDA: `superpowers:subagent-driven-development` o `superpowers:executing-plans`. **Ejecución: 2 olas de ~10 agentes en simultáneo** (propiedad de archivos disjunta), verificando que estén realmente corriendo, luego cierre.

**Goal:** Reducir el consumo de CPU en reposo de la app abierta (reportado ~30% de un 9800X3D), garantizar que los textos entren en sus contenedores y que TODO el contenido se vea sin scroll vertical.

**Architecture:** 2 frentes: (A) CPU — 8 agentes (agujero negro = `CosmicBackground` WebGL 30fps + auditoría de loops/render loops + harness de medición CDP con presupuesto); (B) UI — 10 agentes (textos-en-boxes + no-scroll-vertical por archivo CSS/TSX + verificación visual multi-viewport). Cada agente posee un conjunto de archivos exclusivo; la medición (A5) define el baseline y el presupuesto que el cierre valida.

**Tech Stack:** Node 22+ (release), pnpm 10.15.1 vía `corepack`, Vitest 3.2.4, Playwright Chromium (CDP `Performance.getMetrics` para CPU), React 19.

## Global Constraints

- No modificar `StoreProjectV2Schema` ni `schemaVersion: 2`.
- No agregar dependencias de runtime.
- Presupuestos existentes: storefront.js ≤ 52 KiB (medido 50.094 B), storefront.css ≤ 780 KiB; Studio JS ≤ 700 KiB (medido 634.9), CSS ≤ 100 KiB (medido 98.78). **Cualquier cambio que suba el CSS del Studio exige quedarse dentro del techo** — priorizar reglas compactas.
- El runtime público es un string serializado: `scripts/runtime-serialization.test.ts` debe seguir verde.
- El preview y el sitio público usan el mismo renderer; los cambios del runtime sirven a ambos (pausa por visibilidad debe ser segura en ambos).
- Reducir a la mitad el trabajo de render en reposo es la meta del frente A; el harness mide ScriptDuration/TaskDuration con CDP.
- Gates por task: `corepack pnpm --filter <paquete> test` + `typecheck` + E2E propio. Cierre: `check`, `build`, `check:budgets`, `benchmark:export`, `test:e2e`, `test:e2e:portable`, `git diff --check`, `check:repository`, ejecutables.
- Commits breves en español, uno por task, `git add` explícito. Reportes `.superpowers/sdd/` nunca al commit. No correr `format:check` global (ola paralela); biome sólo sobre archivos propios.
- **Ola paralela:** si `git commit` falla por `index.lock`, esperar 3 s y reintentar hasta 5 veces. No tocar archivos de otras tareas (tabla de propietarios). Especs nuevos para escenarios nuevos (no editar specs ajenos).
- Windows + PowerShell; sin bash, sin rg (Select-String). 0 U+FFFD al terminar.
- **Contrato A3↔A4 (pausa del preview):** A4 agrega al runtime el manejo de `window.postMessage` entrante: `{ type: "solara-pause" }` → detiene observadores/animaciones/scroll-work; `{ type: "solara-resume" }` → reanuda. A3 (Preview.tsx) envía estos mensajes al iframe cuando: pestaña oculta, pane cerrado, o iframe fuera de viewport (IntersectionObserver). Sin esta cooperación el harness de A5 mide el preview idle.

## Propietarios de archivos (disjuntos — ola 1 = A1..A8, ola 2 = U1..U7 + U11, cierre = U8/U9/T10)

| # | Archivos | Agente |
|---|---|---|
| A1 | `apps/studio/src/features/CosmicBackground.tsx`, `apps/studio/src/dashboard/cosmic.css` | AGENTE A1 |
| A2 | `apps/studio/src/lib/**`, `apps/studio/src/App.tsx`, `apps/studio/src/main.tsx` | AGENTE A2 |
| A3 | `apps/studio/src/features/Preview.tsx` | AGENTE A3 |
| A4 | `packages/storefront-runtime/src/index.ts` + `index.test.ts` | AGENTE A4 |
| A5 | `scripts/check-optimization.mjs` (o el script que exista), `tests/e2e/perf-idle.spec.ts` (nuevo) | AGENTE A5 |
| A6 | `apps/studio/src/features/Studio.tsx` (sólo TSX) | AGENTE A6 |
| A7 | `apps/desktop/src/main.mjs`, `packages/exporter/scripts/serve.mjs` | AGENTE A7 |
| A8 | `apps/studio/src/debug/ComponentGallery.tsx`, `apps/studio/src/debug/component-gallery.css`, `apps/studio/docs/deuda-editor.md` | AGENTE A8 |
| U1 | `apps/studio/src/base/components.css`, `apps/studio/src/components/*.tsx` | AGENTE U1 |
| U2 | `apps/studio/src/features/Dashboard.tsx` (sólo TSX) | AGENTE U2 |
| U3 | `apps/studio/src/editorial/editorial.css` (sólo CSS) | AGENTE U3 |
| U4 | `apps/studio/src/base/base.css`, `apps/studio/src/base/feedback.css`, `apps/studio/src/styles.css` | AGENTE U4 |
| U5 | `apps/studio/src/features/catalog/**`, `apps/studio/src/features/Export.tsx`, `Assets.tsx`, `Seo.tsx`, `ThemeEditor.tsx`, `Overview.tsx`, `GuidedOverview.tsx`, `features/Builder.tsx`, `features/builder/**` (sólo TSX) | AGENTE U5 |
| U6 | `packages/modules/src/styles.ts`, `catalog-modern.ts`, `definitions.ts` (boxeo de textos públicos) | AGENTE U6 |
| U7 | `tests/e2e/layout-fit.spec.ts` (NUEVO; verificación multi-viewport), reporte de violaciones | AGENTE U7 |
| U11 | `tests/e2e/studio-visual.spec.ts`, `tests/e2e/editor-responsive.spec.ts` (asserts de fit/scroll) | AGENTE U11 |
| U8 | `docs/TECHNICAL_DEBT.md`, `CHANGELOG.md`, `HANDOFF.md` | cierre docs |
| U9 | revisión final (sólo lectura) | cierre review |
| T10 | gates, ejecutables, push | controlador |

---

## OLA 1 — CPU (A1..A8)

### Task A1 — CosmicBackground: fin del agujero negro — [AGENTE A1]

**Defecto (evidencia):** `CosmicBackground.tsx:139-160` — loop `requestAnimationFrame` continuo mientras `!reducedMotion.matches`, dibujo WebGL cada frame con cap de 33 ms (30fps), canvas a `devicePixelRatio` hasta ×1.25, `gl.flush()` por frame, sin `powerPreference` y sin pausa cuando el canvas está fuera de viewport (sólo `document.hidden`). Es el candidato #1 del ~30% de CPU en reposo.

- [ ] **Step 1: Medir el baseline** — con el harness de A5 (si ya aterrizó) o con el CDP inline del spec `perf-idle.spec.ts` (el spec de A5 incluye un caso "dashboard con cosmic"; correrlo ANTES de cambiar). Registrar ScriptDuration por segundo con el canvas visible.
- [ ] **Step 2: Implementar** (a) FPS cap por estado: 12 fps cuando la pestaña está inactiva **y** cuando el canvas no intersecta el viewport (IntersectionObserver sobre el canvas, además del visibilitychange existente); 30 fps sólo con tab activa + canvas visible; (b) `powerPreference: "low-power"` en `getContext`; (c) scale `Math.min(devicePixelRatio, 1.0)`; (d) si `document.hidden` o fuera de viewport → no encolar rAF (pausa total); (e) cuando `reducedMotion.matches` → UN solo dibujo estático (ya es el comportamiento; verificar que no re-anime); (f) asegurar cleanup completo en unmount (ya existe; verificar que `frame` se cancela en todos los paths).
- [ ] **Step 3: Verificar** (a) el spec de A5 "dashboard con cosmic" queda bajo el presupuesto (ScriptDuration < 50 ms/s en reposo); (b) `corepack pnpm --filter @solara/studio typecheck` + `test` PASS; (c) `playwright test tests/e2e/studio-visual.spec.ts` (el spec "el fondo cosmic mantiene movimiento perceptible" — mantener la percepción de movimiento con el FPS reducido; si el test aserta FPS o cambios de frame, ajustarlo sólo si rompe por el cap — coordinar con U11); (d) biome + `git diff --check`.
- [ ] **Step 4: Commit** → `git commit -m "Domina el consumo del fondo cosmic: FPS por estado y GPU low-power"`
- [ ] **Step 5: Reporte** `.superpowers/sdd/perf-t1-report.md` (baseline vs final)

### Task A2 — Auditoría de loops y listeners de lib/App — [AGENTE A2]

**Misión:** cazar render loops de React (efectos que setean estado sin deps o con deps inestables), timers sin cleanup, y acumulación de listeners en `apps/studio/src/lib/**` + `App.tsx` + `main.tsx`.

- [ ] **Step 1: Auditar** — leer `autosave.ts` (setInterval en líneas 7/36: cadencia del flush y si corre con tab oculta), `projectArchive.ts:77` (setTimeout), `localProjectRepository.ts` (polling de manifests), `repository.ts` (Dexie observables), `App.tsx` (efectos de boot, listeners de storage/session), `main.tsx`. Listar todo timer/listener con: cadencia, cleanup, comportamiento con `document.hidden`.
- [ ] **Step 2: Corregir** — (a) pausar timers no críticos con `document.hidden` (visibilitychange) y reanudarlos al volver; (b) `setInterval` del autosave: si su cadencia es < 5 s y no hay cambios, es trabajo en reposo → debounce a "sólo corre si hay cambios pendientes" (el queue ya tiene `pending` — verificar que el timer se duerme cuando `pending` está vacío; si no, arreglarlo); (c) listeners de `storage`/`focus`/`visibility` con cleanup en unmount (verificar `useEffect` return); (d) cualquier efecto con deps inestables que re-ejecute trabajo en loop (candidatos: objetos/arrays creados inline).
- [ ] **Step 3: Verificar** (a) spec `perf-idle.spec.ts` (editor abierto en reposo) bajo presupuesto; (b) `--filter @solara/studio test` + typecheck PASS; (c) `playwright test tests/e2e/editor-console.spec.ts tests/e2e/editor-smoke.spec.ts` GREEN (el autosave sigue guardando); (d) biome + diff-check.
- [ ] **Step 4: Commit** → `git commit -m "Duerme los timers y limpia listeners cuando la app está en reposo"`
- [ ] **Step 5: Reporte** `.superpowers/sdd/perf-t2-report.md` (tabla de hallazgos → fix)

### Task A3 — Preview: pausa del iframe — [AGENTE A3]

**Defecto:** el iframe del preview corre el runtime storefront completo (observadores, animaciones, posibles scroll listeners) incluso cuando la pestaña está oculta o el preview no se ve (pane cerrado, otra tab del Studio). **Contrato con A4:** el runtime escuchará `postMessage { type: "solara-pause" }` / `{ type: "solara-resume" }`.

- [ ] **Step 1: Implementar** en `Preview.tsx`: (a) IntersectionObserver sobre el iframe → cuando sale de viewport, `iframe.contentWindow.postMessage({ type: "solara-pause" }, "*")`; al volver, `solara-resume`; (b) `visibilitychange` de la pestaña → pause/resume; (c) cuando el pane del preview está cerrado (no renderizado, no aplica) — verificar cómo se desmonta; (d) en unmount, siempre enviar pause.
- [ ] **Step 2: Verificar** (a) `playwright test tests/e2e/editor-preview.spec.ts` (si existe; si no, `editor-console.spec.ts` que ejercita el preview) GREEN — el preview sigue funcionando al re-entrar (resume); (b) `--filter @solara/studio typecheck` + test PASS; (c) spec `perf-idle.spec.ts` (caso "editor con preview abierto, pestaña oculta") bajo presupuesto; (d) biome + diff-check.
- [ ] **Step 3: Commit** → `git commit -m "Pausa el runtime del preview cuando no se ve"`
- [ ] **Step 4: Reporte** `.superpowers/sdd/perf-t3-report.md`

### Task A4 — Runtime storefront: pausa y listeners pasivos — [AGENTE A4]

**Misión:** (a) implementar el manejo de `postMessage` `solara-pause`/`solara-resume` (contrato A3): al pausar — detener `IntersectionObserver` de motion (desconectar y recordar estado), ignorar `scroll`/`resize` handlers, cancelar fetches no críticos; al reanudar — reconectar y re-sincronizar; (b) hacer `{ passive: true }` en TODOS los listeners de `scroll`/`touch`/`wheel`; (c) `visibilitychange` interno: pausar el trabajo cuando el documento del iframe no es visible (aplica a sitio público con tab oculta también); (d) verificar que `renderCart`/`syncVariant` no fuerzan layout en loops.

- [ ] **Step 1: Tests que fallan (RED)** en `index.test.ts`: (1) el serializado contiene `"solara-pause"` y `"solara-resume"`; (2) el serializado usa `{ passive: true }` en scroll listeners (aserto de presencia).
- [ ] **Step 2: Implementar** (a)-(d) del contrato. Cuidar el budget: JS ≤ 52 KiB (50.094 actual — reportar bytes).
- [ ] **Step 3: Verificar** `--filter @solara/storefront-runtime test` PASS · `scripts/runtime-serialization.test.ts` PASS · budget PASS · `playwright test tests/e2e/editor-motion.spec.ts tests/e2e/catalog-modern.spec.ts` GREEN (motion sigue revelando tras resume) · biome + diff-check · 0 U+FFFD.
- [ ] **Step 4: Commit** → `git commit -m "El runtime se pausa por mensaje y por visibilidad y usa listeners pasivos"`
- [ ] **Step 5: Reporte** `.superpowers/sdd/perf-t4-report.md`

### Task A5 — Harness de medición de CPU idle + presupuesto — [AGENTE A5]

**Misión:** crear la medición objetiva del consumo en reposo. `tests/e2e/perf-idle.spec.ts` (nuevo): (a) abrir dashboard (cosmic visible), esperar 3 s, muestrear con CDP `Performance.getMetrics` (ScriptDuration/TaskDuration) durante 5 s → assert `ScriptDuration < 100 ms` (calibrado: hoy ~30% de un core ≈ 300 ms/s — el presupuesto exige reducir a ~1/3; si el baseline real medido difiere, ajustar el umbral documentándolo); (b) caso editor abierto con preview (pestaña visible, esperar settle) → mismo assert; (c) caso tab oculta (`page.evaluate` con CDP `Emulation.setPageVisibilityState` o `document.hidden` via `page.emulateMedia`? usar CDP `Page.setWebLifecycleState`/`Emulation` — verificar la API) → assert `ScriptDuration < 25 ms/s`; (d) un probe que cuente loops rAF activos (`PerformanceObserver` sobre `longtask` o inyección de contador — elegir el método estable). Además: revisar `scripts/check-optimization.mjs` (ya existe con 4 tests) y agregar si encaja un chequeo de bundles (no duplicar). Si los casos (b)/(c) son inestables, dejar (a) como gate duro y (b)/(c) informativos con umbral generoso — documentar.
- [ ] **Step 1: Implementar** el spec + medir el baseline REAL con el código actual (correr el spec ANTES de los fixes de A1-A4 — los agentes de la ola 1 corren en paralelo; el spec debe tolerar el código viejo y nuevo: umbral fijado al final del cierre; el spec se commitea con umbrales provisionales y el cierre los recalibra con medición post-fixes).
- [ ] **Step 2: Verificar** `playwright test tests/e2e/perf-idle.spec.ts` GREEN (con umbral provisional) · `corepack pnpm exec vitest run scripts/check-optimization.mjs` (o el comando real) PASS · biome + diff-check.
- [ ] **Step 3: Commit** → `git commit -m "Mide la CPU en reposo del Studio con un presupuesto CDP"`
- [ ] **Step 4: Reporte** `.superpowers/sdd/perf-t5-report.md` (baseline crudo del agujero negro)

### Task A6 — Shell del editor: visibilidad y re-renders — [AGENTE A6]

**Misión (sólo `Studio.tsx`):** (a) `visibilitychange` global: al ocultar la pestaña, pausar trabajo no crítico (el tick de exportTick y cualquier estado por tiempo); (b) auditar efectos que re-rendericen en reposo: `lastVisitedAt`, `saveIndicator`, estados derivados de `new Date()`; (c) memoizar componentes costosos del shell si el re-render idle los recalcula (verificar con el harness de A5 el caso editor); (d) `useEffect` sin deps o con deps inestables → corregir; (e) NO tocar el layout (CSS es de U3/U4) ni los diálogos ya corregidos.

- [ ] **Step 1: Implementar** (a)-(d) con evidencia del harness (correr `perf-idle.spec.ts` caso editor antes/después).
- [ ] **Step 2: Verificar** `--filter @solara/studio test` + typecheck PASS · `playwright test tests/e2e/editor-console.spec.ts tests/e2e/editor-a11y.spec.ts` GREEN · biome + diff-check.
- [ ] **Step 3: Commit** → `git commit -m "El shell del editor no trabaja en reposo"`
- [ ] **Step 4: Reporte** `.superpowers/sdd/perf-t6-report.md`

### Task A7 — Desktop y servidor: configuración de reposo — [AGENTE A7]

**Misión:** `apps/desktop/src/main.mjs`: (a) verificar `backgroundThrottling: true` en `webPreferences` del BrowserWindow (Electron la activa por defecto — confirmar que no se desactivó) y que la ventana use `minWidth/minHeight` que eviten layouts rotos (≥ 1024×700); (b) tamaño por defecto de ventana 1440×900 (o mantener el actual si es razonable; documentar); (c) verificar que no haya `powerSaveBlocker` activo ni `setInterval` en main; (d) `packages/exporter/scripts/serve.mjs`: confirmar que no hay timers ni trabajo periódico en reposo (sólo loopback pasivo). Si algo no aplica, documentar con evidencia.

- [ ] **Step 1: Implementar** los ajustes que apliquen (con evidencia).
- [ ] **Step 2: Verificar** `corepack pnpm desktop:build` PASS · `corepack pnpm portable:smoke` OK · biome + diff-check.
- [ ] **Step 3: Commit** → `git commit -m "El shell y el servidor no trabajan en reposo"`
- [ ] **Step 4: Reporte** `.superpowers/sdd/perf-t7-report.md`

### Task A8 — Galería de componentes y deuda editorial — [AGENTE A8]

**Misión:** `apps/studio/src/debug/ComponentGallery.tsx` + `component-gallery.css`: (a) textos que desborden sus boxes en la galería (auditar con las mismas reglas que U1-U4 y corregir EN LA GALERÍA); (b) `apps/studio/docs/deuda-editor.md`: actualizar la línea stale de `stripPreviewLcpPreload` (ya señalada) y agregar notas de rendimiento si la ronda las produce (sólo si hay datos).

- [ ] **Step 1: Implementar** (a) y (b).
- [ ] **Step 2: Verificar** typecheck + `--filter @solara/studio test` PASS (si la galería tiene tests) · biome + diff-check · 0 U+FFFD.
- [ ] **Step 3: Commit** → `git commit -m "Boxes de la galería y deuda editorial al día"`
- [ ] **Step 4: Reporte** `.superpowers/sdd/perf-t8-report.md`

---

## OLA 2 — UI (U1..U7, U11)

Reglas comunes de boxeo (las aplica cada agente en su área): todo texto en un contenedor debe poder envolverse o truncar — `min-width: 0` en flex items, `overflow-wrap: anywhere` / `text-overflow: ellipsis` + `white-space: nowrap` + `title` para etiquetas fijas, `max-width` con `clamp` para títulos, botones con `white-space: normal` cuando el label es largo (o ellipsis según el rol), inputs con `min-width: 0` en filas flex, diálogos con `width: min-content/…` y `max-height` con scroll interno SIEMPRE dentro del panel (nunca la página). Regla común de no-scroll: `html, body { height: 100% }`, contenedores de panel con `overflow: auto` interno, y el contenido principal completo visible sin scroll de página en 1366×768, 1440×900 y 1920×1080.

### Task U1 — Componentes: boxes + fit — [AGENTE U1]

**Archivos:** `apps/studio/src/base/components.css` + `apps/studio/src/components/*.tsx` (Ui, primitives, Toast, ConfirmDialog).

- [ ] **Step 1: Auditar** cada primitiva: botones (labels largos — "Restaurar valores por defecto"), badges, toggles, segmented (opciones largas), pagination, progress, tooltips (max-width + wrap, posición), diálogo de confirmación (textos largos, ancho), toasts (mensajes largos + stack vertical sin scroll de página).
- [ ] **Step 2: Corregir** en CSS (reglas de boxeo) y TSX sólo cuando haga falta estructura (título `title`, clases). **No tocar** otros CSS.
- [ ] **Step 3: Verificar** `--filter @solara/studio test` + typecheck PASS · `playwright test tests/e2e/editor-a11y.spec.ts tests/e2e/editor-console.spec.ts` GREEN (los diálogos siguen operables) · captura de pantalla de la galería (`debug/`) a 1366×768: sin desbordes · biome + diff-check.
- [ ] **Step 4: Commit** → `git commit -m "Los componentes envuelven y truncan sus textos"`
- [ ] **Step 5: Reporte** `.superpowers/sdd/ui-t1-report.md` (tabla componente → fix)

### Task U2 — Dashboard: boxes + todo visible — [AGENTE U2]

**Archivos:** `apps/studio/src/features/Dashboard.tsx` (TSX sólo).

- [ ] **Step 1: Auditar** (render real con Playwright a 1366×768): cabecera ("Tus tiendas" + stats), cards de tienda (nombres largos, "Predeterminado editado — modo-sur"), chips de salud, panel de detalle (overlay), diálogos (crear/respaldo/apagar), toasts. Verificar si el documento scrollea verticalmente para ver "Proyectos guardados" + salud juntos.
- [ ] **Step 2: Corregir** en TSX: (a) estructura para que el contenido quepa (layout compacto: reducción de padding/gaps vía clases EXISTENTES — el CSS es de A1/U3; si hace falta CSS nuevo, dejar las clases en el TSX y reportar a U3); (b) `title` en textos truncados; (c) spans/wrappers para ellipsis; (d) verificar el panel de detalle con contenido largo.
- [ ] **Step 3: Verificar** `playwright test tests/e2e/dashboard-actions.spec.ts` (o el spec real del dashboard) GREEN · capturas a 3 viewports: sin scroll vertical de página · `--filter @solara/studio test` + typecheck PASS · biome + diff-check.
- [ ] **Step 4: Commit** → `git commit -m "El dashboard cabe en el viewport y sus textos no desbordan"`
- [ ] **Step 5: Reporte** `.superpowers/sdd/ui-t2-report.md`

### Task U3 — CSS del editor: boxes y no-scroll — [AGENTE U3]

**Archivos:** `apps/studio/src/editorial/editorial.css` (TODOS los estilos del editor viven aquí — es el archivo grande; SÓLO CSS).

- [ ] **Step 1: Auditar** con selectores: toolbar/tabs (labels largos), statusbar (mensajes de validación largos — no romper la fila), panes (inspector de Builder, catálogo, SEO, assets), el contenido principal: ¿el editor scrollea verticalmente en 1366×768? (el shell debe usar `height: 100vh` con scroll interno por panel).
- [ ] **Step 2: Corregir** (a) `min-width: 0` + `overflow-wrap`/ellipsis en los puntos de desborde; (b) shell del editor: `html/body/#root` altura completa y paneles con `overflow: auto` interno — coordinar con U4 (styles.css/base.css): U3 aplica las reglas de los paneles editoriales; (c) statusbar con `flex-wrap` o ellipsis según el mensaje; (d) no aumentar el tamaño total del CSS más de lo necesario (techo 100 KiB, 98.78 actual — reportar bytes).
- [ ] **Step 3: Verificar** `playwright test tests/e2e/editor-smoke.spec.ts tests/e2e/editor-console.spec.ts tests/e2e/editor-a11y.spec.ts` GREEN · capturas a 3 viewports (editor con catálogo abierto): sin scroll vertical de página · `--filter @solara/studio typecheck` PASS · `corepack pnpm check:budgets` PASS (reportar CSS bytes) · biome + diff-check.
- [ ] **Step 4: Commit** → `git commit -m "El editor no scrollea verticalmente y sus textos entran en las boxes"`
- [ ] **Step 5: Reporte** `.superpowers/sdd/ui-t3-report.md`

### Task U4 — Base, feedback y globales — [AGENTE U4]

**Archivos:** `apps/studio/src/base/base.css`, `apps/studio/src/base/feedback.css`, `apps/studio/src/styles.css`.

- [ ] **Step 1: Auditar** base: inputs (padding vs border), labels (textos largos con `for`), errores inline (`field-error` con mensajes largos), notices, empty-states, `#root`/body (altura 100%, scroll), el `@import` de styles.css. Verificar que `styles.css` tenga la regla global `html, body { height: 100%; overflow: hidden }` con scroll interno por panel (si falta, agregarla — es la regla maestra del no-scroll; verificar que no rompa el scroll de listas largas internas: los paneles deben tener `overflow: auto`).
- [ ] **Step 2: Corregir** en los 3 archivos (boxeo + altura global + scroll interno). Coordinar con U3: la regla maestra en styles.css, las reglas de panel en editorial.css — no duplicar.
- [ ] **Step 3: Verificar** `--filter @solara/studio test` + typecheck PASS · `playwright test tests/e2e/editor-smoke.spec.ts tests/e2e/editor-states.spec.ts` (si existe) GREEN · capturas: errores largos envueltos, sin scroll de página · `corepack pnpm check:budgets` PASS (reportar bytes) · biome + diff-check.
- [ ] **Step 4: Commit** → `git commit -m "Base y feedback: textos envueltos y altura de página contenida"`
- [ ] **Step 5: Reporte** `.superpowers/sdd/ui-t4-report.md`

### Task U5 — Features del editor: TSX — [AGENTE U5]

**Archivos (TSX sólo):** `features/catalog/**`, `features/Export.tsx`, `features/Assets.tsx`, `features/Seo.tsx`, `features/ThemeEditor.tsx`, `features/Overview.tsx`, `features/GuidedOverview.tsx`, `features/Builder.tsx`, `features/builder/**`.

- [ ] **Step 1: Auditar** (render real a 1366×768, flujos: catálogo con productos de nombre largo, export con checklist, assets con errores largos, SEO con contadores, builder con nombres de módulos largos, Overview/resumen con textos guiados): ¿dónde desborda el texto? ¿dónde scrollea la página?
- [ ] **Step 2: Corregir** en TSX: `title` para truncar, estructura que habilite ellipsis/wrap (wrappers, `min-w-0` via clases existentes), `maxLength` donde aplique, estados vacíos legibles. NO tocar CSS (U3/U4) ni Dashboard/Studio/Preview (otros dueños).
- [ ] **Step 3: Verificar** `--filter @solara/studio test` + typecheck PASS · `playwright test tests/e2e/editor-workers.spec.ts tests/e2e/editor-builder.spec.ts tests/e2e/editor-catalog.spec.ts` (los specs reales) GREEN · capturas: flujos clave sin desbordes ni scroll de página · biome + diff-check.
- [ ] **Step 4: Commit** → `git commit -m "Los paneles de features no desbordan textos ni requieren scroll de página"`
- [ ] **Step 5: Reporte** `.superpowers/sdd/ui-t5-report.md`

### Task U6 — Storefront público: boxes — [AGENTE U6]

**Archivos:** `packages/modules/src/styles.ts`, `catalog-modern.ts`, `definitions.ts` (sólo boxeo de textos del sitio público).

- [ ] **Step 1: Auditar** cards de producto (títulos largos con `clamp`, precios, badges "Sin stock"), botones (actionLabel largo), header (nombre de tienda largo + nav), footer, filtros (opciones largas), carrito (líneas largas, "Ya no disponible"), search input. El sitio público SÍ scrollea (es un sitio web): aquí sólo importa que los textos entren en sus boxes sin desbordes horizontales (no crear scroll-x).
- [ ] **Step 2: Corregir** en CSS/TSX del módulo. Cuidar el budget del sitio (CSS ≤ 780 KiB; hoy ~75 KB — reportar delta) y la serialización.
- [ ] **Step 3: Verificar** `corepack pnpm --filter @solara/modules test` PASS · `--filter @solara/exporter test` PASS · `playwright test tests/e2e/catalog-modern.spec.ts tests/e2e/storefront-nojs.spec.ts` GREEN · capturas del sitio a 390 px y 1366 px: sin overflow-x · budget PASS · biome + diff-check · 0 U+FFFD.
- [ ] **Step 4: Commit** → `git commit -m "El storefront envuelve y trunca sus textos"`
- [ ] **Step 5: Reporte** `.superpowers/sdd/ui-t6-report.md`

### Task U7 — Verificación multi-viewport + spec global — [AGENTE U7]

**Archivos:** `tests/e2e/layout-fit.spec.ts` (NUEVO). Misión de VERIFICACIÓN: (a) spec que abre dashboard, editor (tab Catálogo), editor (tab Preparar/Resumen) y Export en 1366×768, 1440×900, 1920×1080: aserta que NO hay scroll vertical de PÁGINA (`document.documentElement.scrollHeight <= clientHeight + 1`) y que ningún elemento visible desborda horizontalmente (`scrollWidth` de `body`); (b) correr el spec contra el código ACTUAL (ola 2 en vuelo) y reportar violaciones por archivo → cada violación se asigna al agente dueño vía el reporte; (c) el spec se commitea con las aserciones duras (si hoy falla, documentar qué aserción queda `test.skip` hasta el cierre con TODO list — NO dejar skips silenciosos: listar en el reporte).
- [ ] **Step 1: Implementar** el spec (patrón de boot de editor-smoke/studio-server).
- [ ] **Step 2: Ejecutar** contra el estado actual y producir el TODO de violaciones (reporte `.superpowers/sdd/ui-t7-report.md` con tabla viewport→área→archivo→fix asignado).
- [ ] **Step 3: Commit** → `git commit -m "Verifica el ajuste al viewport sin scroll ni desbordes"`
- [ ] **Step 4: Reporte** — el TODO de violaciones ES el entregable clave del cierre.

### Task U11 — Specs visuales existentes — [AGENTE U11]

**Archivos:** `tests/e2e/studio-visual.spec.ts`, `tests/e2e/editor-responsive.spec.ts`.

- [ ] **Step 1: Actualizar** las aserciones existentes para el nuevo contrato: "el fondo cosmic mantiene movimiento perceptible" (A1 baja FPS — si el test mide frecuencia de frame, ajustar a "sigue animando" sin fijar FPS), y agregar en `editor-responsive.spec.ts` asserts de no-scroll-vertical de página y no-overflow-x a los anchos ya cubiertos (si el spec ya cubre 390/768/1366, extender a alto 768).
- [ ] **Step 2: Verificar** `playwright test tests/e2e/studio-visual.spec.ts tests/e2e/editor-responsive.spec.ts` GREEN · biome + diff-check.
- [ ] **Step 3: Commit** → `git commit -m "Los specs visuales exigen ajuste al viewport sin scroll"`
- [ ] **Step 4: Reporte** `.superpowers/sdd/ui-t11-report.md`

---

## CIERRE

### Task U8 — Docs — [Agente docs]
`docs/TECHNICAL_DEBT.md`: filas RESUELTAS (con commits) por A1-A8 + U1-U7/U11; nuevas ABIERTAS si la auditoría lo exige (p. ej. render del cosmic por pedido si el presupuesto no se cumple); `CHANGELOG.md`: entrada "Optimización de rendimiento y UI (2026-08-09)"; `HANDOFF.md`: números de rendimiento (ScriptDuration idle por caso + viewports verificados).

### Task U9 — Revisión final — [Agente review]
Revisar `planBase..HEAD` (2 olas) contra el plan; verificar presupuestos (budgets, serialización, perf-idle), contrato A3↔A4, propiedad de archivos, `.only(`, U+FFFD. Veredicto APPROVED/CHANGES.

### Task T10 — Gates y publicación — [Controlador]
`corepack pnpm check` · `build` · `check:budgets` · `benchmark:export` · `test:e2e` (incl. `perf-idle.spec.ts` con umbral recalibrado post-fixes: el cierre ajusta los números del spec A5 con las mediciones finales y lo deja como gate duro) · `test:e2e:portable` · `git diff --check` · `check:repository` · ejecutables (`desktop:build`, `desktop:package`, `portable:smoke`) · push.

---

## Self-Review (autor)

- **Cobertura:** 30% CPU → A1-A7 (cosmic, loops, preview, runtime, harness, shell, desktop) + A5 mide y presupuesta; textos en boxes → U1-U6 + A8 (por archivo CSS/TSX); no-scroll vertical → U2-U4 + U7 (verificación multi-viewport) + U11 (specs existentes); docs/review/cierre → U8/U9/T10. Total ~20 agentes en 2 olas simultáneas (8 + 11) + cierre.
- **Conflictos:** tabla de propietarios disjunta verificada (cosmic.css=A1, editorial.css=U3, base/feedback/styles=U4, componentes=U1, Dashboard.tsx=U2, Studio.tsx=A6, Preview=A3, runtime=A4, módulos=U6, specs: U7 nuevo / U11 existentes). Contrato A3↔A4 es el único acoplamiento → nombre exacto de mensajes fijado en el plan.
- **Riesgo:** el techo de CSS del Studio (100 KiB, 98.78) limita el boxeo — los agentes reportan bytes; si se excede, el cierre decide compactación. El harness puede medir ruido → umbrales provisionales y recalibración en el cierre con medición real.
- **Placeholders:** "verificar al implementar" indica qué comprobar y la decisión permitida; U7 define qué queda skip vs duro.
