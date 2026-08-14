# Backlog del PLAN 4 (de 10) — run acotado con Δ%

Re-verificaciones + hallazgos nuevos. Formato: `Métrica | Antes | Después | Δ%`.

| id | capa | ítem | métrica | antes | después | Δ% | estado |
|----|------|------|---------|-------|---------|-----|--------|
| P4-1 | F | Re-verificación gates del PLAN 3 | gates | OK | | | pendiente |
| P4-2 | V | Verificación visual del discount oscurecido + announcement (capturas + visión) | hallazgos | 0 | | | pendiente |
| P4-3 | B | CSS Studio: duplicación post-dedup → re-medir; buscar más duplicación por prefijo de bloque (`@media` internos) | bytes | 102.160 B | | | pendiente |
| P4-4 | A | A11y: axe con teclado (tab) en rutas clave — foco visible | findings | — | | | pendiente |
| P4-5 | E | Rutas draft: nojs-coverage en draft mode (hoy solo production) | combos | 24 | | | pendiente |
| P4-6 | H | CDP: long tasks en reposo post-axe (home) | ms/s | 31.8 | | | pendiente |
| P4-7 | G | Servidor local: content-types de cada extensión (png/webp/woff2/xml) — test dedicado | % checks | — | | | pendiente |
| P4-8 | C | Runtime: re-medir raw post-reversiones del usuario (estado real) | bytes | 55.845 B | | | pendiente |
| P4-9 | F | Manifest: `robots.txt`/`sitemap.xml` en draft vs production (noindex/Disallow consistente) | drift | — | | | pendiente |
| P4-10 | D | Assets: preloads/`fetchpriority` en todas las páginas con imagen (barrido) | % páginas | — | | | pendiente |

## SIGUIENTE

P4-1 — Re-verificación de gates del PLAN 3
