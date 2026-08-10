# Traza T15 — Flujo de datos del tema (ThemeEditor → schema → exporter → preview/sitio)

Fecha: 2026-08-10 · Agente: Trace T15 · Plan: `docs/superpowers/plans/2026-08-10-auditoria-controles.md`

## Alcance

- `apps/studio/src/features/ThemeEditor.tsx` (controles: presets, inputs de color con
  `normalizeHexColor`, select colorMode, resets por grupo).
- `packages/project-schema` (ThemeSchema y defaults de `buildCatalogModernProject`).
- `packages/exporter/src/index.ts` (CSS variables de tema en `themeCss`).
- Consumo compartido: preview (`renderPreviewHtml`) y exportación (`exportProject`) usan la
  misma `themeCss` y los mismos `--solara-*` (`packages/modules/src/styles.ts`,
  `packages/storefront-runtime/src/index.ts`).

## Contrato verificado (matriz token por token)

Nota: la convención del exporter no es `--color-*` sino `--solara-*`; no existe ninguna
variable `--color-` en el repositorio (grep global sin resultados).

| Clave que escribe el editor | Clave en `ThemeSchema` (`colors`) | Lectura del exporter | Variable emitida | Consumida por |
|---|---|---|---|---|
| `background` | `background` | `colors.background` | `--solara-background` | `styles.ts`, runtime, `html { background }`, `meta theme-color` (index.ts:1128) |
| `surface` | `surface` | `colors.surface` | `--solara-surface` | `styles.ts` |
| `text` | `text` | `colors.text` | `--solara-text` | `styles.ts`, runtime |
| `muted` | `muted` | `colors.muted` | `--solara-muted` | `styles.ts`, runtime |
| `accent` | `accent` | `colors.accent` | `--solara-accent` | `styles.ts`, `:focus-visible` |
| `accentText` | `accentText` | `colors.accentText` | `--solara-accent-text` | `styles.ts` |
| `border` | `border` | `colors.border` | `--solara-border` | `styles.ts`, runtime |

Las 7 claves coinciden exactamente en editor (colorLabels, presets tipados como
`Theme["colors"]`), schema (ThemeSchema index.ts:245-253) y exporter (index.ts:578-584).
`compareModel.ts:48-54` lee las mismas claves. No hay desajuste de nombres.

## Presets

- `THEME_PRESETS` están tipados como `Theme["colors"]` → contienen exactamente las 7 claves
  del schema; TypeScript impide un preset con clave faltante o extra.
- `editorial-cálido` == default de `buildCatalogModernProject` (fixture
  `catalog-modern-fixture.ts:391-410`: mismo colorMode `light` y los 7 colores idénticos).
  E2e `ui-tema-seo.spec.ts` H8-09 y `ui-matriz-interaccion.spec.ts` verifican que aplicar
  "Costa terracota" escribe `#b4552d`/`#faf6f2` y el preview los refleja.

## Resets

- `resetGroup` restaura `originalTheme.current` = el tema al abrir la pestaña (semántica
  H8-10, aserada por e2e "Restaurar colores vuelve a los valores de apertura"). En una
  tienda recién creada esos valores son exactamente los que siembra
  `buildCatalogModernProject` (seed clean y demo comparten tema), así que el contrato
  "reset = defaults del template" se cumple para el caso fresco y el caso editado devuelve
  al último estado confirmado de apertura, comportamiento deliberado y documentado en la UI.

## colorMode (auto / light / dark)

- El editor escribe `project.theme.colorMode` con valores del enum del schema
  (`z.enum(["auto","light","dark"])`), que es la única fuente de verdad.
- El exporter maneja los tres: `data-theme` sólo cuando no es `auto` (index.ts:1105);
  `data-color-mode` siempre con el valor crudo (index.ts:1144); `color-scheme: dark` en
  `:root` cuando es `dark` (index.ts:574) y para `auto` bajo `prefers-color-scheme: dark`
  (index.ts:601-604).
- El dark deshabilitado en el editor coincide con el soporte real del sitio:
  `packages/modules/src/styles.ts:23-29` y `:513-521` sobreescriben fondo, superficie,
  texto, secundario y borde con valores fijos cuando `data-color-mode` es `dark` (o `auto`
  con preferencia oscura), es decir la paleta del usuario no llegaría al sitio. El hint de
  la UI lo explica y remite a la paleta "Tinta profunda". El reset de colores restaura
  también `colorMode` (ThemeEditor.tsx:231), coherente con que el modo participa del grupo.

## Verificaciones

1. `corepack pnpm --filter @solara/exporter test` — 8 archivos, **84 passed**, 1 skipped.
2. `corepack pnpm --filter @solara/studio test` — 15 archivos, **109 passed**.
3. `corepack pnpm exec playwright test tests/e2e/ui-tema-seo.spec.ts tests/e2e/ui-matriz-interaccion.spec.ts` — **17 passed** (37.1 s).
4. `biome check` sobre el informe — sin hallazgos aplicables (Markdown); sin cambios de código.
5. `git diff --check` — limpio. Sin U+FFFD en el informe.

## Resultado

**Sin desajustes de contrato.** No se modificó ningún archivo de código: las claves que
escribe el editor son idénticas a las que lee el exporter para construir las variables
(no `--color-*` sino `--solara-*`), los presets cumplen el schema, el reset coincide con
los defaults sembrados en el caso fresco y el estado deshabilitado de dark corresponde al
soporte real del storefront. Commit sólo con este informe.

## Preocupaciones

- `data-theme` (atributo en `<html>`) no tiene consumidor CSS/JS en el sitio público: el
  mecanismo real son `data-color-mode` + `:root` variables. Es un hook inerte, no un
  desajuste, pero conviene documentarlo para no asumir que activa algo.
- El override fijo de dark en `styles.ts` cubre 5 de 7 tokens (no `accent`/`accentText`):
  si en el futuro se habilita dark, el par acento/acento-texto sí reflejaría la paleta.
- `packages/core/src/index.ts` aparecía modificado sin commitear al iniciar la traza
  (modificación ajena); no se tocó ni se incluyó en el commit.
