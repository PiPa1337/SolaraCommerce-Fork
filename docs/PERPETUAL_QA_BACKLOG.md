# Backlog del PLAN 5 (de 10) — run acotado con Δ%

Re-verificaciones + hallazgos nuevos. Formato: `Métrica | Antes | Después | Δ%`.

| id | capa | ítem | métrica | antes | después | Δ% | estado |
|----|------|------|---------|-------|---------|-----|--------|
| P5-1 | F | Re-verificación gates PLAN 4 | gates | OK | | | pendiente |
| P5-2 | H | LCP/CLS: medición con navegador frío (sin caché) — 3 corridas y mediana | ms | 76/72 | | | pendiente |
| P5-3 | G | Servidor local: verificación de Cache-Control headers en assets estáticos | headers | — | | | pendiente |
| P5-4 | B | CSS V2: re-medir duplicación (el usuario iteró el hero/bento — puede haber crecido) | bytes | 247 B | | | pendiente |
| P5-5 | E | Rutas: catalogScale draft en nojs (paginación sin JS útil) | combos | — | | | pendiente |
| P5-6 | A | Axe en catalogScale (tercer fixture) | findings | — | | | pendiente |
| P5-7 | D | Videos: poster + tamaño en los fixtures que usan video | checks | — | | | pendiente |
| P5-8 | C | Consola del sitio con runtime real (no solo load — interacciones: carrito, búsqueda) | errores | 0 | | | pendiente |
| P5-9 | F | JSON-LD: validación de tipos y URLs absolutas en todas las páginas | checks | — | | | pendiente |
| P5-10 | A | Contraste del footer catalogModern (small ©) con axe ya en 0 — verificar tokens muted del modern | findings | 0 | | | pendiente |

## SIGUIENTE

P5-1 — Re-verificación de gates del PLAN 4
