# Backlog del PLAN 3 (de 10) — run acotado con Δ%

Re-verificaciones + hallazgos nuevos. Formato: `Métrica | Antes | Después | Δ%`.

| id | capa | ítem | métrica | antes | después | Δ% | estado |
|----|------|------|---------|-------|---------|-----|--------|
| P3-1 | F | Re-verificación de todos los gates del PLAN 2 (enganches, paridad, contratos, axe, nojs, cdp) | gates | OK | | | pendiente |
| P3-2 | C | Runtime: buscar compactación segura en helpers (sin tocar el boot revirtido) — evaluar `minifyJsSource` en helpers ya aplicado; medir alternativas | bytes | 55.845 B | | | pendiente |
| P3-3 | B | CSS Studio: margen 4.1 KiB — buscar reducción segura fuera de styles en iteración (base.css/feedback.css del Studio) | bytes | 102.392 B | | | pendiente |
| P3-4 | E | Ampliar cobertura: catalogModernStore en nojs-coverage + axe (hoy solo reference) | rutas | 7 | | | pendiente |
| P3-5 | A | Re-verificación a11y en catalogModern y catalogModernV2 | findings | — | | | pendiente |
| P3-6 | H | Re-medición CDP (LCP/tasks) post-cambios de a11y | ms | 788/552 | | | pendiente |
| P3-7 | G | Re-verificación handler + subcarpeta | gates | OK | | | pendiente |
| P3-8 | F | Reproducibilidad extendida: draft mode también (hoy solo production) | % | — | | | pendiente |
| P3-9 | C | Hallazgo: `search-index.json`/`catalog-index.json` de catalogScale con paginación — consistencia de rutas paginadas en search | drift | — | | | pendiente |

## SIGUIENTE

P3-1 — Re-verificación de gates del PLAN 2
