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

