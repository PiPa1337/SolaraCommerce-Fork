# Escala de UI (contrato de espaciado)

Dos contextos, dos escalas. Cualquier cambio visual nuevo debe usar estos
tokens/valores; los specs geométricos en `tests/e2e/__vision__/` son los
guardianes (`alignment.spec.ts` para el editor, `storefront-alignment.spec.ts`
para el sitio exportado).

## Studio (editor)

Tokens `--space-*` en `apps/studio/src/base/base.css`: 4/8/12/16/20/24/32/48px.
Usar `var(--space-n)`. No introducir valores intermedios (7/9/14px...).
Radios: `var(--radius-input)` / `var(--radius-panel)`.

## Storefront exportado

Escala rem (respeta `--solara-type-scale`): .25 / .5 / .75 / 1 / 1.25 / 1.5 /
2 / 2.5 / 3 / 4. Los módulos definen su CSS en `packages/modules/src/styles.ts`.
Radios: `var(--solara-radius)` y derivados con calc().

## Guardianes automaticos

Los specs geometricos validan que el layout respete estas escalas:
- alignment.spec.ts: tabs, columnas, cards del editor
- storefront-alignment.spec.ts: cards por grilla, modulos centrados, sin overflow 320px

Si agregas un modulo nuevo o cambias padding/gap, corre estos specs.
