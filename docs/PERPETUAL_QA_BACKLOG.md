# Backlog del PLAN 2 (de 10) — run acotado con Δ%

Residuales del PLAN 1 + re-verificaciones + hallazgos nuevos. Formato: `Métrica | Antes | Después | Δ%`.

| id | capa | ítem | métrica | antes | después | Δ% | estado |
|----|------|------|---------|-------|---------|-----|--------|
| R1 | F | Re-verificación F1-F5 (enganches) — esperado Δ% ≈ 0 | gates | 4/4 | | | pendiente |
| R2 | E/A | Re-verificación E1 + A2 (cobertura no-JS, nodos) | gates | OK | | | pendiente |
| R3 | C | Re-verificación runtime budget + serialización | raw | 55.845 B | | | pendiente |
| R4 | B/D | Re-verificación B1/D1 (CSS duplicación, findings assets) | gates | OK | | | pendiente |
| R5 | H/G | Re-verificación H1/H2/G1 (CDP + servidor local) | gates | OK | | | pendiente |
| N1 | A | Hallazgo PLAN 1: 6 moderados "region" del footer legacy → evaluar landmarks semánticos | findings moderate | 6 | | | pendiente |
| N2 | C | Hallazgo PLAN 1: controles del hero legacy `min-height: 40px` (target táctil) | px | 40 | | | pendiente |
| N3 | A | Hallazgo PLAN 1: 1 minor de axe sin identificar → detallar | findings minor | 1 | | | pendiente |
| N4 | E | Barrido visual fresco + visión (ojos nuevos sobre el sitio) | hallazgos | | | | pendiente |
| N5 | F | Contrato persistido: ids de módulos/secciones vs registry (F6) | drift | | | | pendiente |
| N6 | C | Runtime: margen 1.499 B — compactar sin tocar lo que el usuario revirtió (helpers ya compactados; evaluar boot SOLO si el usuario lo aprueba — condicional) | margen | 1.499 B | | | bloqueado condicional |

## SIGUIENTE

R1 — Re-verificación de enganches F1-F5
