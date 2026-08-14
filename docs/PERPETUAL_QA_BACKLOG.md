# Backlog del PLAN 1 (de 10) — run acotado con Δ%

Formato: `Métrica | Antes | Después | Δ%`. Regla: Δ% < 0 → revertir/bloquear; Δ% ≈ 0 solo en robustez documentada; ciclo sin Δ% = inválido.

| id | capa | ítem | métrica | antes | después | Δ% | estado |
|----|------|------|---------|-------|---------|-----|--------|
| C1 | C | Runtime JS: recuperar margen (el parallax del bento consumió 1.7 KB) | runtimeJavascriptRaw | 56.940 B | | | pendiente |
| F1 | F | Paridad estricta árbol+body, 3 fixtures × 2 modos, todas las rutas | % rutas paridad | 100 % | | | pendiente |
| F2 | F | Manifest runtimeFeatures ↔ data-solara-runtime-features ↔ capacidades del HTML | drift count | | | | pendiente |
| F3 | F | Snapshot ↔ feed/sitemap/search-index/catalog-index (ids, precios, urls) | inconsistencias | | | | pendiente |
| F4 | F | criticalCount audit ↔ bloqueo production ↔ UI | drift | | | | pendiente |
| F5 | F | Reproducibilidad byte-a-byte 3 fixtures × 2 runs | % reproducibles | | | | pendiente |
| E1 | E | Cobertura rutas draft+production × desktop/mobile × no-JS | % rutas verificadas | | | | pendiente |
| A1 | A | Axe/a11y sobre el sitio exportado | findings por página | | | | pendiente |
| A2 | A | Nodos HTML por ruta | nodos | | | | pendiente |
| C2 | C | Errores de consola/red del sitio | count | | | | pendiente |
| B1 | B | CSS V2 duplicación fusionable post-hero | bytes | | | | pendiente |
| D1 | D | Findings performance.asset.* del optimizador | findings | | | | pendiente |
| H1 | H | Long tasks/rAF del sitio exportado (CDP) | ms/s | | | | pendiente |
| H2 | H | LCP/CLS con PerformanceObserver | ms | | | | pendiente |
| G1 | G | Servidor local: content-types/cache/404/subcarpeta | % checks | | | | pendiente |
| V1 | verif | A3/A4, B2, D2/D3, F6, G2 contratos | Δ% 0 justificado | | | | pendiente |

## SIGUIENTE

C1 — Runtime JS: recuperar margen (56.940 B → objetivo < 56.000 B)
