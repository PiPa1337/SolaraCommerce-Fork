# Ola 0 — B: T0.2 Estados de controles + T0.3 Matriz responsive

Fecha: 2026-08-07 · Agente: B (T0.2 + T0.3) · Plan: `docs/superpowers/plans/2026-08-07-editor-uiux.md`

## Alcance

- `tests/e2e/editor-states.spec.ts` (nuevo): inventario de controles y estados del editor.
- `tests/e2e/editor-responsive.spec.ts` (nuevo): matriz responsive en 390/768/1024/1440/1920.
- Testids `ui-*` y fixes de CSS del editor. No se tocó storefront ni specs ajenos.

## Testids agregados

- `components/Ui.tsx`: `Button` → `data-testid="ui-button"`; `IconButton` → `ui-icon-button`;
  `EmptyState` → `ui-empty-state`; `InlineError` → `ui-inline-error`.
- `features/Studio.tsx`: pestañas del shell → `data-testid="ui-tab"` (absorbido por el commit
  del agente A11y/Perf `3b14710`, que commiteó el árbol compartido con mi cambio incluido).
- `features/Dashboard.tsx`: botón de apertura de la card → `data-testid="ui-card-open"`
  (también absorbido por `3b14710`).
- `features/Preview.tsx`: select de ruta → `data-testid="ui-preview-route"` (en este commit).

Nota: el commit `3b14710` (T0.4/T0.6) incluyó dos de mis reglas CSS (hover de búsqueda/select
y hover del toggle de vista del dashboard cosmic) porque ambos agentes trabajamos sobre el
mismo árbol de trabajo; quedaron así atribuidas a ese commit, no revertidas.

## Inventario de controles y estados (T0.2)

Recorridos y controles cubiertos por el spec:

- **Dashboard cosmic:** "Nueva tienda" (primary), searchbox, selects Estado/Ordenar, toggle
  grilla/lista (icon con `aria-pressed`), botón de card, detalle (Respaldo ahora, Archivar).
- **Studio shell:** Volver a tiendas, Deshacer/Rehacer (disabled al inicio), pestañas,
  toolbar de preview (Abrir panel, tamaños), input "Título visible" del Resumen.
- **Catálogo:** paginación (Anterior disabled en página 1, Siguiente enabled con 25 filas),
  select "Filas".
- **Exportar:** "Exportar borrador" con estado loading "Generando" + disabled durante el worker.
- **Barrido `ui-*`:** todas las pantallas (dashboard + 8 pestañas) verifican que cada
  `ui-button`/`ui-icon-button` visible tiene cursor `pointer` habilitado / `not-allowed`
  deshabilitado y opacidad coherente (habilitado > 0.9, disabled < 1).

Técnica: `getComputedStyle` (cursor, opacity, background, border) + `:focus-visible` con
modality de teclado forzada (focus → Tab → Shift+Tab, patrón del spec a11y), hover con
signature de elemento y padre (los inputs del dashboard muestran el hover en el label).

### Bugs de estados encontrados y corregidos

1. **Búsqueda/select del dashboard sin hover** — `.dashboard-cosmic-search:hover,
   `.dashboard-cosmic-select:hover` → borde ámbar suave. (En `3b14710`, ver Nota.)
2. **Toggle grilla/lista sin hover** (el estado `aria-pressed` tapaba la regla base) —
   hover 0.08 alfa para no presionado y 0.26 para presionado. (En `3b14710`, ver Nota.)
3. **`button--danger` cosmic sin hover** — el botón "Archivar" era idéntico en hover;
   agregado `.app-root--dashboard-cosmic .button--danger:hover` en `feedback.css` (este commit).

## Matriz responsive (T0.3)

Aserciones por viewport (390/768/1024/1440/1920) y pantalla (dashboard, 8 pestañas del
Studio, preview con panel cerrado): `document.documentElement.scrollWidth <= clientWidth`
sin overflow horizontal y acciones principales visibles dentro del viewport (boundingBox
completo, con poll contra la animación de apertura del panel). Dashboard además verifica
que el panel de detalle sea drawer (`position: fixed`) ≤820px y apilado (`sticky`) mayor.

### Bugs responsive encontrados y corregidos (solo CSS del editor)

| Viewport | Hallazgo | Fix |
|---|---|---|
| 390/768 (≤820px) | El panel de detalle vacío ("Seleccioná una tienda") quedaba `position: fixed` sobre las cards y bloqueaba el click de la primera card | `@media (max-width: 820px)` → `.dashboard-store-detail:not(.is-open) { display: none }` en `cosmic.css` |
| 390 | El panel de edición abierto traslada contenido mientras anima (`transform` 220ms); el boundingBox momentáneo daba x negativa | Ninguno de producto: el spec espera la posición final con `expect.poll` |

Sin overflow horizontal documental en ningún viewport después de los fixes; el shell del
Studio ya contenía el scroll en `.editor-pane`/`.preview-stage` (overflow auto), el nav en
móvil es scroll-x dentro de `.studio-nav` y el preview móvil usa `min(390px, 100%)`.

## Verificaciones

1. `corepack pnpm --filter @solara/studio typecheck` — limpio (sin salida).
2. `corepack pnpm --filter @solara/studio test` — 6 archivos, 44 tests verdes.
3. `corepack pnpm --filter @solara/studio build` — OK (CSS bundle 69.24 kB < 84 KiB).
4. `corepack pnpm exec playwright test tests/e2e/editor-states.spec.ts tests/e2e/editor-responsive.spec.ts` — **7 passed** (26 s).
5. `biome check` sobre los 8 archivos tocados — limpio; `git diff --check` — limpio.

## Archivos

Commit de esta tarea:

- `tests/e2e/editor-states.spec.ts` (nuevo)
- `tests/e2e/editor-responsive.spec.ts` (nuevo)
- `apps/studio/src/components/Ui.tsx` (testids `ui-*`)
- `apps/studio/src/features/Preview.tsx` (testid `ui-preview-route`)
- `apps/studio/src/base/feedback.css` (hover de danger cosmic)
- `apps/studio/src/dashboard/cosmic.css` (ocultar drawer vacío ≤820px)
- `.superpowers/sdd/ola0-b-report.md` (este informe)

## Preocupaciones

- **Árbol compartido:** el agente T0.4/T0.6 commitó `3b14710` con mi `ui-tab`/`ui-card-open`
  y dos de mis reglas CSS incluidas (working tree compartido). No se revertió nada; quedó
  documentado. Mi commit es independiente y los specs pasan sobre HEAD actual.
- **Attribution de Preview.tsx:** mi commit original absorbió el hunk inédito
  `stripPreviewLcpPreload` del agente de consola (T0.1) que vive en el mismo archivo; se
  corrigió con `commit --amend` (ahora `9434598`) y el hunk quedó devuelto al working tree
  sin commitear para que lo commitee su dueño. Verificar con `git status` que sigue presente.
- Los specs usan `role="tab"` para las pestañas (patrón T3.1 ya presente en el árbol);
  si la ola 1 cambia la semántica de tabs, revisar selectores de ambos specs.
- El estado "loading" se verifica en Exportar (worker real): si el worker llegara a ser
  sub-50ms en futuras optimizaciones, el poll inicial podría no capturar "Generando"
  (el spec tiene 60 s de margen para el retorno).
- El hover del botón "Archivar" (danger) ahora es distinguible; el resto de estados
  críticos (disabled/focus/loading) ya estaban cubiertos por base.css.
