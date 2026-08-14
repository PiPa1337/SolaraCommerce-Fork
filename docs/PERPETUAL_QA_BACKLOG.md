# Backlog del PLAN 6 (de 10) — run acotado con Δ%

Re-verificación profunda de enganches + hallazgos nuevos. Formato: `Métrica | Antes | Después | Δ%`.

| id | capa | ítem | métrica | antes | después | Δ% | estado |
|----|------|------|---------|-------|---------|-----|--------|
| P6-1 | F | Re-verificación de TODOS los gates acumulados (PLAN 1-5) | gates | OK | | | pendiente |
| P6-2 | F | Contrato persistido: `data-design-family` en el html vs fixture en los 3 fixtures | drift | — | | | pendiente |
| P6-3 | F | `productIds` de categorías/colecciones derivados vs ids reales (recalculo del schema) | drift | — | | | pendiente |
| P6-4 | F | Manifest del export: `usedAssets`/`usedVideos` vs archivos emitidos (nada huérfano, nada faltante) | drift | — | | | pendiente |
| P6-5 | C | Runtime: features declaradas vs inicializadas en el boot (cada `hasFeature` cubierta) | drift | — | | | pendiente |
| P6-6 | B | CSS: `data-design-family` scope de las familias (V1 vs V2 sin fuga entre sí) | checks | — | | | pendiente |
| P6-7 | E | Rutas: canonical única por ruta (sin duplicados en sitemap) | checks | — | | | pendiente |
| P6-8 | H | LCP frío de catalogModern (hoy solo reference) | ms | — | | | pendiente |
| P6-9 | G | Handler: ruta `404.html` servida con el content-type html (verificado) | checks | 1/1 | 1/1 | 0 | pendiente |
| P6-10 | D | Fuentes: subset re-verificado (Archivo 30.196 B) tras reversiones del usuario | bytes | — | | | pendiente |

## SIGUIENTE

P6-1 — Re-verificación de todos los gates acumulados
