# Contrato responsive del storefront

Este documento es el ledger vigente de los cortes de ancho del storefront
compartido. `packages/modules/src/styles.ts` se emite tanto para Preview como
para exportación; por eso cualquier cambio aquí afecta a las tiendas actuales y
futuras.

## Modos oficiales

| Modo | Rango de diseño | Checkpoint visual | Fronteras automáticas |
| --- | --- | --- | --- |
| Mobile | 320–767 px | 390 × 844 | 320, 762, 767, 768, 773 |
| Tablet | 768–1199 px | 1024 × 900 | 1194, 1199, 1200, 1205 |
| Desktop | ≥1200 px | 1440 × 900 | 1200, 1440, 1920 y 2560 cuando el riesgo lo exige |

> **Regla obligatoria:** el storefront sólo puede tener estos tres modos de
> diseño responsive: **Mobile, Tablet y Desktop**. No se permite crear un cuarto
> breakpoint de layout, un preset adicional de Preview ni un ajuste visual
> específico para un ancho intermedio. Las condiciones técnicas del ledger no
> son modos de diseño y no autorizan nuevos cortes visuales.

Los checkpoints expresan dónde se revisa visualmente el diseño. Las fronteras
comprueban continuidad geométrica y funcional; no son diseños adicionales.
Mobile soporta 320 px como mínimo. No se agregan presets de Preview para las
fronteras.

## Ledger de width conditions

| Ubicación | Corte | Categoría | Decisión y evidencia |
| --- | ---: | --- | --- |
| `packages/modules/src/styles.ts` | 767/768 | layout | Frontera oficial entre Mobile y Tablet; cubierta por `responsive-breakpoints.spec.ts` y `catalog-modern-v2.spec.ts`. |
| `packages/modules/src/styles.ts` | 1199/1200 | layout | Frontera oficial entre Tablet y Desktop; cubierta por assertions de modo, grilla y overflow. |
| `packages/modules/src/styles.ts` | 339 | seguridad de componente | Excepción para títulos/labels en el mínimo estrecho; conserva legibilidad sin crear un cuarto modo. Se prueba en 320 px. |
| `packages/modules/src/styles.ts` | 599/600 | geometría de componente | El drawer pasa de pantalla completa a panel lateral cuando existe ancho suficiente; protegido por `cart-drawer-responsive.spec.ts`. |
| `packages/storefront-runtime/src/index.ts` | 520 | geometría de componente | La línea del carrito reserva una segunda columna para cantidad/acción en anchos estrechos; no cambia el modo visual. |
| `packages/module-sdk/src/index.ts` | 1023 | entrega de assets | `<picture>` selecciona la fuente intermedia para recursos; no es layout. Se mantiene para paridad de bytes. |
| `packages/exporter/src/index.ts` | 1023/1024 | entrega de assets | El preload LCP espeja la condición de `<picture>` para evitar doble descarga; no se alinea mecánicamente con el modo Tablet. |
| `packages/modules/src/helpers.ts` | 640/1024/1280 | entrega de assets | Valores de `sizes`, no viewport breakpoints. Se validan con paridad de `<picture>`/preload. |
| `packages/modules/src/catalog-modern.ts` y `definitions.ts` | 767/1199 | entrega de assets | `sizes` expresa el ancho del slot; no crea layouts adicionales. |
| `packages/project-schema/src/media.ts` | 480/768/1800 | ancho físico de variante | Candidatos de imagen; fuera de la política de viewport. |

Los cortes históricos `339`, `450`, `520`, `560`, `599/600`, `640`, `899/900`,
`1023/1024`, `1100` y `1366–1919` fueron revisados. Los que eran tuning de
layout se consolidaron en `767/768` o `1199/1200`, o se reemplazaron por
`auto-fit`/límites fluidos. Sólo permanecen las excepciones anteriores con una
razón funcional.

El editor Studio tiene breakpoints propios para su shell y no forma parte del
contrato del sitio público. Preview conserva exactamente tres modos:
`desktop | tablet | mobile`.

## Regla para futuras modificaciones

Las condiciones de ancho de viewport del renderer y runtime deben usar las
fronteras oficiales. Si aparece una excepción, debe agregarse a este ledger,
tener una prueba reproducible y explicar qué rotura evita. La guarda
`corepack pnpm check:responsive` impide incorporar anchos no clasificados en los
archivos del renderer público.

## Evidencia visual

`tests/e2e/responsive-breakpoints.spec.ts` genera capturas reales del HTML
exportado para 762/773 y 1194/1205 —cinco píxeles antes y después de cada
frontera— además de 390/1024/1440. El mismo spec verifica Preview/exporter
indirectamente mediante el snapshot exportado y comprueba overflow en rutas
Home, categoría, producto y carrito.
