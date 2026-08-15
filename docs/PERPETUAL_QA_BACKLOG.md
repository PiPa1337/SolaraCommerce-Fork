# Backlog del PLAN 9 (de 10) — run acotado con Δ%

Deuda residual y contratos persistidos. Formato: `Métrica | Antes | Después | Δ%`.

| id | capa | ítem | métrica | antes | después | Δ% | estado |
|----|------|------|---------|-------|---------|-----|--------|
| P9-1 | F | Contratos persistidos vs schema: ids de módulos/secciones en docs (DATA_MODEL/PROJECT_MAP) al día | drift docs | — | | | pendiente |
| P9-2 | F | Re-lectura de `docs/TECHNICAL_DEBT.md`: filas abiertas accionables → convertir | items | — | | | pendiente |
| P9-3 | F | Verificación de que `schemaVersion: 2` y `StoreProjectV1` alias no hayan mutado en el run | checks | — | | | pendiente |
| P9-4 | G | Migración `.solara.zip` legacy (fflate temporal): verificar que el test siga cubriendo la ruta | gates | — | | | pendiente |
| P9-5 | F | Docs de operación (HANDOFF/INTEGRATIONS) actualizados con los gates nuevos del run | checks | — | | | pendiente |
| P9-6 | E | Re-verificación final de rutas de los 3 fixtures (parity + nojs + preloads) | gates | OK | | | pendiente |
| P9-7 | C | Runtime raw final (estado real) + presupuesto | bytes | 55.845 B | | | pendiente |
| P9-8 | H | LCP/CLS final acumulado | ms | 44-56 | | | pendiente |

## SIGUIENTE

P9-1 — Contratos persistidos vs docs
