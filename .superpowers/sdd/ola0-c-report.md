# Ola 0 · Agente C — T0.4 (a11y del editor) y T0.6 (perf de arranque)

Fecha: 2026-08-07. Repo: SolaraCommerce (fork PiPa1337/SolaraCommerce-Fork).
Plan: `docs/superpowers/plans/2026-08-07-editor-uiux.md`.

## T0.4 — A11y del editor

### Spec nuevo
`tests/e2e/editor-a11y.spec.ts` — 10 tests:
skip-link del dashboard (primero en tab order + salta a `main#tiendas`),
orden de tabulación tarjetas → panel de detalle, skip-link del Studio,
roles `tablist/tab/tabpanel` + `aria-selected` + `aria-orientation`,
teclado de tabs (flechas, roving tabindex, Enter/Espacio), focus visible en
tarjetas y tabs, `aria-live` del contador de búsqueda y avisos globales,
diálogo de creación (foco inicial + Escape + focus return) y barrido de
controles sin nombre accesible en dashboard y Studio.

### Hallazgos y fixes (editor)

1. **Tabs del Studio sin patrón ARIA tabs** (`features/Studio.tsx`).
   Antes: `<nav>` con botones `aria-current="page"`. Ahora: `div[role="tablist"]`
   (vertical, flechas ↑↓←→, roving tabindex) con `role="tab"`, `aria-selected`,
   `aria-controls`; el panel (`motion.main`) es `role="tabpanel"` con
   `aria-labelledby` del tab activo y `tabIndex={-1}`. CSS actualizado en
   `dashboard/cosmic.css` y `editorial/editorial.css`
   (`[aria-current="page"]` → `[aria-selected="true"]`, regla del tablist).
2. **Sin skip-link** (`App.tsx`, `Studio.tsx`, `base/base.css`). Se agregó
   `.skip-link` (oculto hasta `:focus-visible`) en el dashboard → `#tiendas`
   y en el Studio → panel de edición; `main#tiendas` y el editor pane ahora
   son focables (`tabIndex={-1}`).
3. **Foco inicial del diálogo de creación** (`features/Dashboard.tsx`).
   `showModal()` enfocaba el botón de cierre (primer focusable); ahora se
   enfoca explícitamente el input de nombre tras abrir (`nameInputRef`).
   Se quitó `autoFocus` (no operaba con el diálogo ya montado).
4. **Panel de detalle fuera del tab order** (`features/dashboard/ProjectCard.tsx`).
   `aside` con `tabIndex={-1}` permanente; ahora `0` cuando hay tienda
   seleccionada, de modo que Tab llega del grid al detalle.
5. **Contador de resultados sin región viva** (`features/Dashboard.tsx`).
   `.dashboard-cosmic-count` ahora `aria-live="polite"` + `aria-atomic="true"`.
6. **Aviso global sin live region** (`App.tsx`): `output.global-notice` →
   `aria-live="polite"`.
7. **Diálogo de cierre sin nombre** (`features/Dashboard.tsx`): se agregó
   `aria-labelledby` al `<dialog>` de apagado del servidor.

No se encontraron controles visibles sin nombre accesible ni icon-buttons sin
`aria-label` en dashboard ni Studio (el barrido del spec pasa).

### Specs existentes ajustados (cambio de rol `button` → `tab` en las pestañas)
Se ajustaron los selectores en el mismo commit, según convención transversal:
`assets.spec.ts`, `catalog.spec.ts`, `catalog-guided.spec.ts`,
`local-storage.spec.ts`, `scale-demo.spec.ts`, `studio-builder.spec.ts`,
`studio-visual.spec.ts`. Ejecutados y verdes.

## T0.6 — Perf de arranque

### Spec nuevo
`tests/e2e/editor-perf.spec.ts` — 2 tests con `performance.now()` dentro de
la página: (a) arranque del dashboard hasta el h1 "Tus tiendas" (post-load,
incluye init de IndexedDB y demos), (b) apertura de "Predeterminado" hasta el
heading "Resumen" (incluye montaje del Studio y cambio de tab) y (c) cambio al
tab Catálogo hasta su heading.

### Mediciones (peor muestra de 5 ejecuciones, Chromium local)

| Métrica | Peor muestra | Budget (= peor × 1.5, redondeado) |
|---|---|---|
| Arranque dashboard | 483 ms | 800 ms |
| Apertura de tienda → Resumen | 421 ms | 700 ms |
| Cambio de tab → Catálogo | 47 ms | 100 ms |

Muestras típicas: boot 414–483 ms (navegación total ~500 ms), open 347–421 ms,
switch 34–47 ms. Sin hotspots que optimizar: todos los valores están muy por
debajo de cualquier umbral perceptible; el Studio ya está `lazy` y no se
encontró trabajo bloqueante obvio (no se hizo deep-profile, según el plan).

## Verificación (todo verde)

1. `corepack pnpm --filter @solara/studio typecheck` — clean.
2. `corepack pnpm --filter @solara/studio test` — 6 archivos, 44 tests OK.
3. `corepack pnpm --filter @solara/studio build` — OK (6.1–6.8 s).
4. `corepack pnpm exec playwright test tests/e2e/editor-a11y.spec.ts tests/e2e/editor-perf.spec.ts` — 12/12 OK.
5. Specs ajustados: assets, catalog, catalog-guided, local-storage, scale-demo,
   studio-builder, studio-visual, release-a11y, local-shutdown — todos verdes.
6. `biome check` sobre los 17 archivos tocados — clean; `git diff --check` — clean.

## Archivos del commit

```
tests/e2e/editor-a11y.spec.ts            (nuevo)
tests/e2e/editor-perf.spec.ts            (nuevo)
apps/studio/src/App.tsx
apps/studio/src/features/Dashboard.tsx
apps/studio/src/features/Studio.tsx
apps/studio/src/features/dashboard/ProjectCard.tsx
apps/studio/src/base/base.css
apps/studio/src/dashboard/cosmic.css
apps/studio/src/editorial/editorial.css
apps/studio/src/features/ManagedPersistenceControls.tsx   (fix de import de otro agente, ver abajo)
tests/e2e/assets.spec.ts, catalog.spec.ts, catalog-guided.spec.ts,
tests/e2e/local-storage.spec.ts, scale-demo.spec.ts, studio-builder.spec.ts,
tests/e2e/studio-visual.spec.ts
```

## Preocupaciones y notas de coordinación

- **Conflictos con agentes paralelos (trabajo ajeno NO revertido):**
  - `features/Studio.tsx` tenía en vuelo el diálogo de conflicto 409 (T0.8,
    `onConflict`/`onReloadFromDisk`). Se conservó íntegro; sólo se agregó el
    import de `Button` que faltaba (rompía `typecheck`) y `tabIndex={-1}`/roles
    nuevos en el panel (compatibles con su código).
  - `features/ManagedPersistenceControls.tsx`: fix de una línea (import de
    `LocalStorageError` como valor, no tipo) para desbloquear el typecheck del
    trabajo en vuelo de T0.8.
  - `Ui.tsx`, `Preview.tsx`, `Assets.tsx`, `Catalog.tsx`, `Export.tsx`,
    `workers.ts`, `csv.worker.ts`, `studio-server.ts`: cambios de otros agentes
    detectados; NO tocados por este agente.
- **Specs nuevos de otros agentes (NO tocados por instrucción):**
  `editor-console.spec.ts`, `editor-responsive.spec.ts`, `editor-states.spec.ts`
  (y `editor-persistence.spec.ts`) usan `getByRole("button", { name: <tab> })`
  para las pestañas del Studio. Con el cambio a `role="tab"` esos selectores
  dejarán de matchear: **necesitan cambiar `button` → `tab`** en la integración
  de la ola (una línea por uso, mismo cambio que se aplicó a los specs
  existentes). Pendiente documentado para el QA/cierre.
- **Flake observado:** el último test del spec a11y falló una vez en el
  segundo `page.goto` (heading "Tus tiendas" > 5 s); no reproducible en
  aislamiento ni en runs completos posteriores. Se subió el timeout del
  `openDashboard` a 20 s como red de seguridad. Causa probable: arranque con
  IndexedDB compartida entre la creación de demos y la navegación.
- **`format:check` repo-wide:** `tests/e2e/local-storage.spec.ts` ya fallaba
  biome en HEAD (formato preexistente en `seedDiskStore`); se formateó en este
  commit (archivo que tocábamos de todos modos).
- Los budgets de perf se midieron en esta máquina (Windows + Chromium local);
  en CI más lenta pueden acercarse al techo; si flaquean, re-medir y subir con
  la misma regla ×1.5 en vez de tocar el código.
