# PERPETUAL REPORT — runs acotados con Δ%

## PLAN 1 (16:00-16:20Z, 2026-08-14)

| id | ítem | métrica | antes | después | Δ% | estado |
|----|------|---------|-------|---------|-----|--------|
| C1 | Runtime margen | runtimeJavascriptRaw | 56.940 B | 55.845 B | 1.9 % | bloqueado: el usuario revirtió el cambio propuesto (commit 729dded); margen final 1.499 B |
| F1 | Paridad estricta | % rutas paridad | 100 % | 100 % | 0 (re-verificado) | hecho (6/6) |
| F2 | Drift features manifest↔html | drift | 0 | 0 | 0 (verificado) | hecho (gate nuevo) |
| F3 | Snapshot↔feed/sitemap/search/catalog-index | inconsistencias | 0 | 0 | 0 (verificado) | hecho (gate nuevo) |
| F4 | criticalCount↔bloqueo↔UI | drift | 0 | 0 | 0 (verificado) | hecho (gate nuevo) |
| F5 | Reproducibilidad byte-a-byte | % fixtures | 100 % | 100 % | 0 (re-verificado) | hecho (gate nuevo) |
| E1 | Rutas útiles sin JS (7 rutas × con/sin JS) | % rutas | — | 100 % | gate nuevo | hecho |
| C2 | Errores consola/red | count | 0 | 0 | 0 (gate nuevo) | hecho |
| A1 | Axe a11y | findings | 14 (8 serios/críticos) | 7 (0 serios, 1 minor, 6 moderate) | 50 % total / 100 % serios | hecho (fix contraste trust+footer, listitem gallery) |
| A2 | Nodos HTML por ruta | nodos | 268 promedio | 268 | 0 (verificado, markup sano) | hecho |
| B1 | CSS V2 duplicación | bytes | 247 B repetidos | 247 | 0 (no fusionable, hero en iteración) | hecho |
| D1 | Findings performance.asset.* | findings | 6 | 6 | 0 (datos de fixtures, no del renderer) | hecho |
| H1 | Long tasks sitio (CDP) | ms/s | home 30.7 / prod 18.0 | baseline | — | hecho (baseline) |
| H2 | LCP (CDP) | ms | home 788 / prod 552 | baseline | — | hecho (baseline) |
| G1 | Servidor local checks | % checks | — | 100 % | gate existente | hecho (9/9 handler + 3 e2e) |
| V1 | Contratos A3/A4, B2, D2/D3, F6, G2 | drift | 0 | 0 | 0 (verificado) | hecho (124/29/7/274/9 verdes) |

### Totales PLAN 1
- Gates: `pnpm check` exit=0, benchmark 1.644 ms (Δ% 2.8 % vs baseline 1.692 ms), e2e 12/12, barrido visual sin hallazgos nuevos.
- Mejoras porcentuales reales: A1 (50 %), C1 (1.9 % por estado del usuario, sin cambio propio), benchmark (2.8 %).
- Autocrítica: el runtime quedó sin el minify del boot porque el usuario lo revirtió explícitamente; el resto de los Δ% 0 son verificaciones con gates nuevos permanentes (la mejora es la cobertura de tests, no la métrica).
- Nuevos gates permanentes: `enganches.test.ts`, `axe-site.spec.ts`, `nojs-coverage.spec.ts`, `cdp-site.spec.ts`.

## PLAN 2 (16:20-16:45Z, 2026-08-14)

| id | ítem | métrica | antes | después | Δ% | estado |
|----|------|---------|-------|---------|-----|--------|
| R1-R5 | Re-verificación F/E/A/C/B/D/H/G | gates | — | 16/16 + 124/59/274 + 4 e2e | 0 (re-verificado) | hecho |
| N1 | Axe restante: 6 region (trust-strip) + 1 minor (button role) + h2 related fuera del main | findings | 7 | 0 | **100 %** | hecho: aria-labels (moduleRoot + announcement + trust), related dentro del main, gallery sin roles inválidos |
| N2 | Controles del hero legacy 40px | px | 40 | 44 | **10 %** | hecho |
| N3 | Minor de axe (aria-allowed-role) | findings | 1 | 0 | 100 % (con N1) | hecho |
| N4 | Visión fresca: hallazgo ALTA (carrito "pegado abajo") → **desmentido por medición** (centros 687/688, es el estilo de h1 del diseño); hallazgo MEDIA (solape labels/valores del resumen legacy) → fijado con flex | px / layout | solape | resuelto | verificado | hecho |
| N5 | F6 contratos: moduleIds de fixtures vs registry | drift | — | 0 | gate nuevo | hecho (`contratos.test.ts`) |
| N6 | Runtime margen 1.499 B — compactar boot | margen | 1.499 B | — | — | bloqueado condicional (usuario revirtió el minify del boot en 729dded; requiere su aprobación) |

### Totales PLAN 2
- Gates: `pnpm check` exit=0, benchmark 1.602 ms (Δ% 5.3 % acumulado vs baseline PLAN 1), e2e 10/10, axe 0 findings.
- Mejoras porcentuales reales: N1 (100 %), N2 (10 %), benchmark acumulado (5.3 %).
- Autocrítica: el hallazgo "ALTA" de la visión era una percepción del estilo (h1 grandes); la medición lo desmintió — la regla medir-antes-de-tocar funcionó. El minify del boot sigue bloqueado por decisión del usuario.
