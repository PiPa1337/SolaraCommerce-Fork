# Auditoría Integral V2 — Implementation Plan

> **Para workers agentic:** ejecutar con superpowers:executing-plans (inline, con checkpoints por fase). Las tareas usan checkbox (`- [ ]`).

**Goal:** Recorrer el 100% de SolaraCommerce (dashboard, editor, sitio generado), detectar y corregir bugs, edge cases, fricciones UI/UX, problemas de responsive, accesibilidad, performance, arquitectura y seguridad; dejar una V2 perceptiblemente mejor con métricas antes/después justificadas.

**Architecture:** 8 pasadas por método DESCUBRIR → ENTENDER → REPRODUCIR → CORREGIR → REFACTORIZAR → TESTEAR → VALIDAR → CONTINUAR. Cada bug corregido queda protegido por un test. Gates por fase: `corepack pnpm check` exit=0 + batería e2e de la app verde + commit/push por fase.

**Tech Stack:** pnpm workspace, React 19 + Vite, TypeScript estricto, Biome, Vitest, Playwright, Zod, Dexie, motion.

## Global Constraints

- `StoreProjectV2Schema` es la autoridad del modelo; `schemaVersion` permanece en 2.
- Preview y sitio público usan el mismo renderer de `@solara/exporter`.
- Dinero en centavos enteros; nunca floats para precios/subtotales.
- No agregar dependencias de runtime; no romper URLs, SEO, configuraciones guardadas ni datos existentes.
- No tocar los archivos modificados sin commitear por el usuario (`apps/desktop/src/main.mjs`, `packages/modules/src/catalog-modern.ts`, `styles.ts`, `about-v2.test.ts`, `contact-v2.test.ts`, `scripts/enganches.test.ts`, `scripts/recursos-check.test.ts`, `tests/e2e/lcp-cold.spec.ts`, `CHANGELOG.md`, carpeta `diseño v2 codex/`).
- Punto de restauración: tag `v2-auditoria-baseline` en `54a63b6`.
- Commits breves en español por tarea; push a `origin/main` sólo con gates verdes.

## Fase 0 — Baseline, inventario y restauración

- [ ] **Task 0.1: Baseline métrico** — registrar en `docs/AUDITORIA_V2.md`:
  - `pnpm check` exit=0; batería app 75/75 (doble corrida); specs e2e totales = 121; unit = 63+; benchmark export = 1.693 ms; axe app 0/0; foco 0; overflow 0 en dashboard/editor.
- [ ] **Task 0.2: Inventario de superficie** — mapear por área (dashboard/editor/sitio): páginas, rutas, componentes, modales, tablas, formularios, estados vacíos, loadings, toasts. Guardar en `docs/AUDITORIA_V2.md`. Verificar contra el mapa de `docs/PROJECT_MAP.md`.
- [ ] **Task 0.3: Batería de regresión inicial** — correr los 12 specs de la app (75 tests) y registrar duración como baseline de estabilidad.

## Fase 1 — PASADA 1: Arquitectura y funcionamiento

Recorrer los flujos completos acción → resultado:

- [ ] **Task 1.1: Flujo editor → configuración → preview → persistencia → sitio** — auditar `Studio.tsx`, `replaceProject`, `autosave`, `ManagedPersistenceControls`, `Preview.tsx`, `export.worker.ts`. Buscar: re-renders dobles, estados stale (`seoDraft`, `routeDraft`), doble ejecución, actualizaciones perdidas al navegar rápido entre pestañas. Corregir hallazgos con test unit/e2e.
- [ ] **Task 1.2: Dashboard** — auditar `Dashboard.tsx` (1300 líneas): sincronización selección/filtros/chips, `comparePair`, bulk backup, el efecto de selección con `focusCardOnSelectRef`. Buscar race conditions entre `onArchive` y refresh.
- [ ] **Task 1.3: Catálogo** — auditar `Catalog.tsx` (1432 líneas): `pendingArchiveIds`, orden + filtro + paginación combinados, edición inline con teclado, CSV import/export en worker con estados de error.
- [ ] **Task 1.4: Constructor** — auditar `Builder.tsx` + `SettingsInspector` + `RepeaterEditor` + `HeroSlidesEditor`: defaults paralelos vs `compatibleSettings`, commits parciales, trampas de foco.
- [ ] **Task 1.5: Persistencia local** — auditar `localProjectRepository.ts`, `repository.ts`, `autosave.ts`: borradores duplicados, timers sin limpiar, guardados consecutivos, conflicto 409 con versión stale.

**Validación Fase 1:** `pnpm check` + tests de los flujos tocados + commit.

## Fase 2 — PASADA 2: Bugs y edge cases

- [ ] **Task 2.1: Edge cases de catálogo** — tests: 0 productos, 1 producto, 2000+ (CSV grande), productos sin categoría, categorías sin productos, búsqueda sin resultados (estado vacío visible), precios extremos (0, 2^31), caracteres Unicode/emojis en nombres y slugs.
- [ ] **Task 2.2: Edge cases de dashboard** — 0 tiendas (estado vacío existente), 1 tienda, 40+ tiendas (render), tienda eliminada mientras está seleccionada, archivar la última tienda activa, doble click en "Nueva tienda" (doble diálogo), click repetido en Guardar.
- [ ] **Task 2.3: Edge cases del editor** — textos extremos (300+ chars en inputs con maxLength), refresh en medio de guardado, atrás/adelante del navegador (el SPA ignora back), inputs con solo espacios, doble submit en export.
- [ ] **Task 2.4: Edge cases del sitio generado** — 0 productos publicados, 1 producto, 2000+ (rendering), imágenes ausentes (fallback), imágenes gigantes (intrínseco vs CSS), ratios extremos, reseñas 0, testimonios 0, FAQ vacío, categoría sin productos (no rompe navegación).

**Validación Fase 2:** tests nuevos verdes + `pnpm check` + commit.

## Fase 3 — PASADA 3: UI/UX global

- [ ] **Task 3.1: Estados interactivos** — auditar hover/focus/active/disabled en botones, cards, tabs, filas de tabla, items de picker. Corregir inconsistencias (faltan `:focus-visible`, cursors, estados pressed).
- [ ] **Task 3.2: Estados vacíos y de carga** — inventariar empty states (dashboard sin tiendas, catálogo sin resultados, historial vacío, picker sin coincidencias) y loadings (export, preview, CSV, backup). Unificar patrones visuales existentes (no redesign).
- [ ] **Task 3.3: Feedback de acciones** — toasts del dashboard vs globales (`ui-dashboard-toast` vs `ui-toast`): unificar visualmente, verificar timing (2.5s/5s/8s), mensajes consistentes en español.
- [ ] **Task 3.4: Microinteracciones** — mejorar transiciones existentes (pane, tabs, dialog, picker) con movimiento sutil: preferir transform/opacity, respetar `prefers-reduced-motion`, sin animaciones genéricas nuevas.

**Validación Fase 3:** captura visual (vision) antes/después de las áreas tocadas + `pnpm check` + commit.

## Fase 4 — PASADA 4: Responsive y accesibilidad

- [ ] **Task 4.1: Barrido responsive** — capturas con vision en 390/768/1024/1440/1920/2560: dashboard, editor (panel + preview), catálogo (tabla y cards), builder, export, tema, SEO, assets. Corregir cortes abruptos y overflow (gate: `scrollWidth <= viewport` por pantalla).
- [ ] **Task 4.2: Navegación de teclado** — verificar: skip-links (existen), orden de tabulación dashboard→panel, trampas de foco (conflicto, picker, diálogos), Esc en todos los modales, focus visible en todos los controles.
- [ ] **Task 4.3: axe completo** — corrida con best-practice (sin exclude del iframe donde sea apropiado y con exclude documentado donde no): dashboard, 8 pestañas del editor, diálogos, toasts. Meta: 0 serious + 0 moderate nuevos.
- [ ] **Task 4.4: Contraste y lectores** — verificar pares de color de estado (Activa/Archivada), hints de error con `aria-describedby`, `aria-live` de regiones dinámicas.

**Validación Fase 4:** axe 0 serious / 0 moderate nuevos + gates responsive + `pnpm check` + commit.

## Fase 5 — PASADA 5: Performance

- [ ] **Task 5.1: Re-renders del editor** — medir con perf-app (baseline existente): tabs (44-168 ms), editor open (500 ms). Buscar memoización faltante en listas del catálogo (50+ filas) y del builder. Solo corregir con medición que lo justifique.
- [ ] **Task 5.2: Listas grandes** — catálogo 2000+ productos: verificar paginación (25/50/100) sin virtualización; medir filtro D7 (461 ms) y el render de la vista cards. Si el filtro crece >30%, optimizar el modelo puro (test unit).
- [ ] **Task 5.3: Sitio generado** — auditar: lazy loading de imágenes del storefront, `loading="lazy"`, fuentes (`font-display`), CSS crítico, budget del runtime serializado (budget existente). Sin tocar si el budget se mantiene.
- [ ] **Task 5.4: Leaks y listeners** — revisar `addEventListener` en Studio.tsx, Preview.tsx, timers de toasts/autosave; verificar con perf-app heap (baseline 290 MB sin fuga).

**Validación Fase 5:** perf-app verde + benchmark export ≤ 1.693 ms + `pnpm check` + commit.

## Fase 6 — PASADA 6: Código y mantenibilidad

- [ ] **Task 6.1: Componentes gigantes** — `Dashboard.tsx` (1300), `Catalog.tsx` (1432), `Studio.tsx` (1156): extraer bloques autocontenidos SOLO si hay una responsabilidad clara y sin riesgo (ej.: diálogos de catálogo, formulario de creación del dashboard). Sin refactor por refactor.
- [ ] **Task 6.2: Duplicación y helpers** — buscar helpers duplicados (slugify, formatDate, currency) entre `apps/studio/src/lib`, `packages/core`, `exporter`. Consolidar solo los que estén duplicados reales.
- [ ] **Task 6.3: Magic values y tipos** — constantes de timing (2.5s/5s/8s de toasts), límites (70/180 SEO, 60 chars nombres), colores duplicados en CSS. Mover a constantes nombradas con test cuando corresponda.
- [ ] **Task 6.4: Código muerto** — barrido con biome (noUnused) + búsqueda de exports sin uso. Eliminar solo con verificación de que no hay consumidores.

**Validación Fase 6:** `pnpm check` + test suite completa + commit.

## Fase 7 — PASADA 7: Testing y regresiones

- [ ] **Task 7.1: Cobertura de flujos críticos** — verificar que creación/edición/guardado/eliminación/publicación/generación/navegación/formularios/persistencia tienen al menos un test e2e o unit. Completar huecos con los tests de las Fases 1-2.
- [ ] **Task 7.2: Batería completa** — correr TODOS los specs e2e (121) + unit + `pnpm check`. Registrar duración y resultados como baseline final de estabilidad.
- [ ] **Task 7.3: Flakiness** — doble corrida de la batería de la app (75 tests). Meta: 0 flakes.

**Validación Fase 7:** batería completa verde + doble corrida estable + commit.

## Fase 8 — PASADA 8: Auditoría final como usuario real

- [ ] **Task 8.1: Recorrido real** — con el portable o el dev server: crear tienda → completar guiado → editar catálogo → exportar → abrir el sitio → navegar como cliente (móvil y desktop). Anotar cualquier fricción restante.
- [ ] **Task 8.2: Seguridad** — revisar: XSS en campos renderizados en el sitio (escape del module-sdk), URLs `target="_blank"` con `rel`, import de archivos (validación del worker), exposición de secrets (check:repository ya lo cubre), manipulación de IDs (sin auth no aplica — local-first documentado).
- [ ] **Task 8.3: Reporte final** — `docs/AUDITORIA_V2.md`: problemas encontrados/corregidos, edge cases cubiertos, refactors, UI/UX, performance, accesibilidad, tests, deuda restante, métricas antes/después (solo % justificados), mejoras futuras deliberadamente no realizadas.
- [ ] **Task 8.4: Cierre** — CHANGELOG + `pnpm build` + `desktop:package` + `test:e2e:portable` (los exes quedan listos).

**Validación Fase 8:** check exit=0 + portable smoke/e2e OK + reporte completo + push final.
