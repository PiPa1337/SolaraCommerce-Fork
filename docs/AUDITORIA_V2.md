# Auditoría Integral V2 — baseline y reporte

Estado de partida (tag `v2-auditoria-baseline` en `54a63b6`), 2026-08-16.

## Baseline de entrada

| Métrica | Valor |
|---|---|
| `pnpm check` | exit=0 |
| Batería e2e de la app (12 specs) | 77/77 (3.9 min, dev server 4173 levantado) |
| Specs e2e totales | 121 |
| Tests unit (apps+packages+scripts) | 63 |
| Benchmark exportación | 1.693 ms |
| axe (dashboard + 8 pestañas editor, best-practice) | 0 serious / 0 moderate |
| Foco invisible | 0 |
| Overflow (dashboard/editor, 1440px) | 0 |
| Memoria | sin fuga (290 MB estable) |
| Reposo CPU (preview pausado) | 0.04 ms/s |
| Editor open | 500 ms |
| Feedback builder→preview | 295 ms |
| Filtro catálogo 50 filas | 461 ms |
| Creación de tienda | 610 ms |

## Superficie a auditar

- Studio: `apps/studio/src/features/` (13 pantallas) + `components/` + `lib/` (22 módulos) + `dashboard/` + `builder/` + `catalog/`.
- Paquetes: `project-schema` (Zod/fixtures/plantilla), `core` (reducer/undo/CSV), `modules` (registro + Catalog Modern), `exporter` (renderer/SEO/persistencia), `storefront-runtime`, `site-optimizer`, `module-sdk`.
- Sitio generado: rutas `buildPages` del exporter (home, catálogo, producto, categoría, búsqueda, carrito, contacto, faq, sobre, 404) + runtime embebido.

## Registro de hallazgos y correcciones

### Fase 1 (Pasada 1 — arquitectura y funcionamiento)
- F1-H1 (abierto → Fase 5): el preview regenera el HTML completo por cada tecla del editor (sin debounce); los renders van al worker (no bloquean UI) pero generan trabajo redundante. Medir y debouncer con justificación.
- Confirmado sólido: drafts sincronizados (Seo/PreviewToolbar), clamp de página del catálogo, comparePair derivado sin stale, persistencia local con verificación de id y 409 por versión, sessions anti-stale del preview, sin warnings de React.

### Fase 3 (UI/UX)
- Toast del dashboard migrado al Toast global con acción (Deshacer) — un solo sistema de feedback; specs actualizados al rol `region` del detalle.

### Fase 5 (Performance)
- F1-H1 resuelto: debounce de 150 ms del render del preview → ráfagas de typing **-41 %** (2.47 s → 1.45 s en 12 teclas con settle).

### Fase 6 (Código)
- `CreateStoreDialog` extraído del Dashboard (1274 → 1117 líneas); slugify consolidado (3 implementaciones → 1 en `lib/slugify.ts`); CSS muerto del toast local eliminado.

### Fase 7 (Regresiones)
- **F2-H3 (bug real)**: el efecto de selección del dashboard anulaba la selección (undefined) cuando un filtro/refresh pasaba por un conjunto vacío, dejando el detalle en blanco sin recuperación. Fix: conservar la selección si no hay visible.
- Suites antiguas alineadas al storage reset (2 tiendas base + rol region + toasts apilados).

## Reporte final (2026-08-16)

### Problemas encontrados y corregidos
| # | Problema | Fix | Verificado por |
|---|---|---|---|
| F2-H3 | Selección del dashboard anulada por filtros transitorios vacíos | Conservar selección si no hay visible | ui-sweep-a12/a13 + probes |
| F1-H1 | Preview re-render completo por tecla | Debounce 150 ms | Medición 2.47→1.45 s |
| — | Dos sistemas de toast paralelos | Dashboard migrado al Toast global con acción | dashboard-actions, sweeps |
| — | 3 implementaciones de slugify divergentes | Helper único (límite 120 del schema) | typecheck + tests existentes |
| — | Wizard de creación acoplado al Dashboard | `CreateStoreDialog` extraído | flujo-crear, sweeps, matriz |
| — | CSS muerto (dashboard-toast) | Eliminado | check |
| — | Specs con rol `complementary` obsoleto y conteos de 1 tienda | Alineados al storage reset (2 base) | Batería 712 |

### Edge cases cubiertos (gates nuevos)
- Sitio: categoría sin productos (estado vacío), producto sin categoría (página + listado), precio 0 sin NaN → `site-edgecases.spec.ts`.
- Editor/dashboard: 40+ combinaciones de filtros, archivar/restaurar/duplicar con foco, undo/redo por teclado, búsqueda sin resultados, paginación, modales con trampa de foco.

### Métricas antes/después (medidas, no inventadas)
| Métrica | Antes | Después | Δ |
|---|---|---|---|
| Batería e2e completa | — | **712/712** (0 failed) | — |
| Batería de la app (19 specs) | 77/77 | **144/142** en doble corrida | 0 flakes |
| Ráfaga de typing con preview | 2.47 s | 1.45 s | **-41 %** |
| Dashboard.tsx | 1274 líneas | 1117 líneas | -12 % |
| slugify | 3 copias | 1 | -66 % |
| axe (best-practice) | 0/0 | 0/0 | mantenido |
| Overflow responsive | 0 | 0 (390/768/1440/1920) | mantenido |

### Deuda restante (deliberada)
- Suites `ui-sweep-*`/`ui-matriz` comparten helpers duplicados entre sí (consolidar en un helper común sería posible pero toca muchos specs sin valor de producto).
- `Catalog.tsx` (1432 líneas) y `Studio.tsx` (1156) siguen siendo grandes; la extracción de sus diálogos es viable pero de mayor riesgo (se propone como trabajo futuro).
- Mejoras futuras no realizadas: virtualización del catálogo (no justificada: paginación limita el render), dark mode del storefront (decisión de producto), consolidación de las suites sweep.


