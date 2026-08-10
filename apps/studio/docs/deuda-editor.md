# Deuda de código del editor — informe (T0.5, 2026-08-07)

Informe de la auditoría de deuda del editor del Studio (ola 0 del plan
[Editor UI/UX](../../../docs/superpowers/plans/2026-08-07-editor-uiux.md)).
Método: scan mecánico de selectores CSS (duplicados y muertos), imports sin
uso, `displayName` y `key` en listas; cada hallazgo se confirmó contra el
código fuente antes de tocar nada.

## Fixes mecánicos aplicados (seguros y confirmados)

### CSS muerto eliminado — `apps/studio/src/dashboard/cosmic.css`

El dashboard cosmic reemplazó el shell legacy; estos selectores ya no se
renderizan en ningún componente del Studio (verificado por búsqueda en
`apps/studio/src` y `tests/e2e`):

- `.segmented`, `.segmented button`, `.segmented button[aria-pressed="true"]`
  (líneas 1397–1421): el toggle de vista usa `.dashboard-cosmic-view-toggle`.
- `.create-store`, `.store-list`, `.store-row`, `.store-open` (+
  `:hover`, `> span:last-child`, `strong`, `small`), `.store-monogram`,
  `.row-actions` (líneas 1423–1498): markup legacy del dashboard; las cards
  actuales son `.dashboard-store-card*`.

### CSS muerto eliminado — `apps/studio/src/editorial/editorial.css`

- `.dashboard-session-actions` (65), `.dashboard-kicker` (138): shell legacy.
- `.create-store`, `.create-store__intro` (+ grupo con `.store-list__header`,
  + `p`), `.store-list`, `.store-list__header`, `.store-row` (+`:hover`),
  `.store-open` (+`strong`), `.store-monogram` (156–227): la creación usa el
  diálogo `.dashboard-cosmic-dialog`.
- `.create-store__summary`, `.create-store__seed-note`, `.create-store__actions`,
  `.store-row__template` (936–960): el diálogo usa
  `dashboard-cosmic-dialog__summary` / `__actions`.
- Reglas dentro de `@media (max-width: 680px)` de los selectores anteriores
  (`.dashboard-session-actions`, `.create-store`, `.create-store .button`,
  `.store-row`, `.row-actions`, `.create-store__actions` ×2).

Se conservaron `.create-store__steps`, `.create-store__contact-fields` y sus
reglas responsive: el diálogo de creación aún las usa.

### Duplicado real — `apps/studio/src/dashboard/cosmic.css`

- `.editor-group` aparecía en dos reglas consecutivas (2306 y 2310); se
  fusionaron en una sola (comportamiento idéntico: `scroll-margin-top`,
  `display: grid`, `gap`).

## Verificado y NO es deuda (falsos positivos del scan)

- `.button--quiet` / `.button--danger` (`base.css`): usados vía
  `button--${variant}` en `components/Ui.tsx:42`.
- `.save-indicator--pending` / `--saving` / `--site-outdated` (`cosmic.css`):
  usados vía `save-indicator--${state}` (`Studio.tsx:332`,
  `ManagedPersistenceControls.tsx:127`; el estado `site-outdated` pertenece a
  `DiskSaveState`).
- `.preview-stage--tablet` / `--mobile`: `preview-stage--${size}`
  (`Preview.tsx`).
- `.status-label--active` / `--archived`: `status-label--${status}`
  (`Catalog.tsx:291`).
- `.audit-item--error` / `--warning` / `--info`: `audit-item--${severity}`
  (`Seo.tsx:195`).
- `.optimization-score` / `--ready`: `Seo.tsx:229–230`.
- `.cosmic-background--subtle`: `cosmic-background--${intensity}`
  (`CosmicBackground.tsx:169`).
- `.editor-pane--closed`: plantilla de `Studio.tsx:412`.
- Los selectores compartidos entre `editorial.css` y `cosmic.css`
  (`.studio-topbar`, `.dashboard-page`, `.section-header`, etc.) son el
  **diseño documentado** de dos shells que comparten nombres de clase
  (ver `biome-ignore-all lint/style/noDescendingSpecificity` al inicio de cada
  archivo), no duplicados; el orden de `@import` en `styles.css` define la
  cascada intencional.

## Imports, displayName y keys

- **Imports sin uso: ninguno.** Scan estático + Biome con `recommended` sin
  hallazgos en `apps/studio/src`.
- **displayName: ninguno necesario.** Todos los componentes son funciones con
  nombre declaradas (`export function X()`); el único `forwardRef` es `Button`
  (`components/Ui.tsx:32`) con función interna nombrada, por lo que React
  infiere el nombre en DevTools. No existen wrappers `memo()` sin nombre.
- **`key` faltantes: ninguno** en bucles JSX; los `.map` marcados por el scan
  son transformaciones de datos (no renderizan listas).

## Top 25 de deuda del editor

| # | Archivo | Ítem | Estado |
|---|---------|------|--------|
| 1 | `dashboard/cosmic.css:1397–1421` | Bloque `.segmented` muerto (3 reglas) | eliminado |
| 2 | `dashboard/cosmic.css:1423–1498` | Bloque legacy `create-store`/`store-*`/`row-actions` (12 reglas) | eliminado |
| 3 | `editorial/editorial.css:65–71` | `.dashboard-session-actions` muerto | eliminado |
| 4 | `editorial/editorial.css:138–145` | `.dashboard-kicker` muerto | eliminado |
| 5 | `editorial/editorial.css:156–227` | Bloque legacy `create-store__intro`/`store-*` (11 reglas) | eliminado |
| 6 | `editorial/editorial.css:936–960` | `.create-store__summary`/`__seed-note`/`__actions`/`store-row__template` | eliminado |
| 7 | `editorial/editorial.css:696–722, 971–977` | Reglas responsive de selectores muertos | eliminado |
| 8 | `dashboard/cosmic.css:2306–2313` | `.editor-group` duplicado en dos reglas | fusionado |
| 9 | `base/base.css:295–305` | `button--quiet`/`button--danger` "muertos" aparentes | verificado: usados (Ui.tsx) |
| 10 | `cosmic.css:1565, 1573` | `save-indicator--*` "muertos" aparentes | verificado: usados (estados de guardado) |
| 11 | `cosmic.css:1738–1742` | `preview-stage--tablet/mobile` aparentes | verificado: usados |
| 12 | `cosmic.css:2253, 2518` | `status-label--active/archived` aparentes | verificado: usados |
| 13 | `cosmic.css:2882–2890` | `audit-item--*` aparentes | verificado: usados (severidades) |
| 14 | `cosmic.css:2962–2968` | `optimization-score(--ready)` aparente | verificado: usado (Seo) |
| 15 | `editorial.css:340` | `.editor-pane--closed` aparente | verificado: usado (Studio) |
| 16 | `editorial.css` + `cosmic.css` | Selectores compartidos entre shells | diseño documentado, no deuda |
| 17 | `apps/studio/src` (48 archivos) | Imports sin uso | ninguno (verificado) |
| 18 | `components/Ui.tsx` y 29 componentes más | displayName ausentes | ninguno necesario (React infiere nombres) |
| 19 | `features/*` y `features/catalog/*` | `key` faltantes en listas JSX | ninguno (los `.map` marcados son datos) |
| 20 | `tests/e2e/studio-server.ts` | 404 de `/__solara/session` (2 sondeos por boot) | corregido: el servidor de pruebas emula el endpoint |
| 21 | `features/Preview.tsx` | Preload absoluto del LCP en la vista previa | corregido: se elimina en modo preview |
| 22 | `packages/exporter/src/index.ts:1112–1117` | `renderPreviewHtml` emite preload absoluto con dominio del proyecto | resuelto (32036a7: sin preload absoluto en modo draft; el parche `stripPreviewLcpPreload` del Studio se eliminó en la revisión 1) |
| 23 | `vite.config.ts` | Sin proxy de `/__solara/session` en dev (ruido 404 en consola) | diferido (solo afecta dev) |
| 24 | `features/CosmicBackground.tsx` | WebGL2 en headless genera avisos del driver de Chromium | ambiente de test; allowlist documentada en el spec |
| 25 | `tests/e2e/studio-server.ts` | `server.close()` puede colgar con conexiones keep-alive | diferido (infra; no afecta specs actuales) |

## Diferidos a olas posteriores

- **Proxy de dev para `/__solara/session`** (índice 23): en `pnpm dev` el
  sondeo 404a y Chromium lo loguea. El launcher real siempre responde el
  endpoint; el arreglo es infra de dev, no código del editor.

## Verificación

- `typecheck` del Studio: limpio.
- Tests del Studio: 44/44 verdes.
- `check:budgets`: Studio JS 596 978 B (techo 716 800 B), CSS 67 843 B
  (techo 86 016 B); CSS bajó de 68 769 B pese a las adiciones de otras tasks
  de la ola.
- `tests/e2e/editor-console.spec.ts`: verde (recorrido completo sin
  errores/warnings de consola).

## T3.8 — Dark mode del editor (decisión de la ola 2)

**Decisión: implementado.** La auditoría previa mostró que las superficies del
editor están tokenizadas en `base.css` (`--bg`, `--surface`, `--surface-strong`,
`--surface-raised`, `--ink`, `--muted`, `--faint`, `--line`, `--line-strong`,
`--accent*`, `--danger*`, `--warning*`, `--info*`, `--shadow-*`); los únicos
colores hardcodeados fuera de las definiciones de tokens son:

- `editorial/editorial.css:94` y `:242` — overlays translúcidos (backdrop del
  diálogo y sombra del panel) neutros a ambos temas;
- `base/feedback.css` — toasts/overlays oscuros por diseño (ya legibles sobre
  fondo claro y oscuro);
- `dashboard/cosmic.css` — paleta propia del shell cosmic (`--cosmic-*` y
  colores de su fondo oscuro intencional), fuera del alcance del toggle.

Con menos de 20 valores no tokenizados y todos neutrales, el costo era bajo:

- `base/base.css`: bloque `:root[data-studio-theme="dark"]` con la paleta
  oscura existente del media query de sistema (misma paleta, un solo lugar de
  autoridad); el media query quedó como `:root:not([data-studio-theme="light"])`
  para que la preferencia manual gane sobre la del sistema.
- `Studio.tsx`: toggle `IconButton` (`data-testid="ui-theme-toggle"`) que
  escribe `data-studio-theme` en `<html>` y persiste en
  `localStorage["solara-studio-theme"]` ("light" | "dark" | sin clave = seguir
  al sistema).
- **Deuda conocida:** los dos bloques de paleta oscura (media query + atributo)
  deben mantenerse en sincronía; están comentados para ello. Si en el futuro se
  introduce otro color hardcodeado para superficies del editor, debe salir de
  los tokens para no romper el tema.