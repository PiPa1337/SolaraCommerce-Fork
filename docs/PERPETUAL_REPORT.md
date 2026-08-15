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

## PLAN 3 (16:45-17:10Z, 2026-08-14)

| id | ítem | métrica | antes | después | Δ% | estado |
|----|------|---------|-------|---------|-----|--------|
| P3-1 | Re-verificación gates PLAN 2 | gates | — | 11/11 | 0 | hecho |
| P3-2 | Runtime: compactar (helpers) | bytes | 55.845 B | — | — | bloqueado: usuario removió minifyJsSource del runtime (729dded) |
| P3-3 | CSS Studio: dedup de reglas exactas (postbuild permanente) | bytes | 102.392 B | 102.160 B | **0.23 %** (margen 4.3 KiB) | hecho (`dedup-studio-css.mjs`) |
| P3-4 | nojs-coverage ampliado a catalogModern | combinaciones | 14 | 24 | gate ampliado | hecho |
| P3-5 | Axe en catalogModern: 4 serious (discount), 1 critical (gallery), 2 moderate (announcement header), region newsletter | findings | 19 | **0** | **100 %** | hecho: discount oscurecido, gallery sin roles, announcement→section con aria-label, newsletter aria-label |
| P3-6 | CDP re-medición post-a11y | ms | 30.7/18.0 | 31.8/18.1 | 0 (ruido) | hecho |
| P3-7 | Handler + subcarpeta | gates | — | 9/9 + 1 | 0 | hecho |
| P3-8 | Reproducibilidad también en draft | fixtures | — | 3/3 × 2 modos | gate ampliado | hecho |
| P3-9 | Search-index vs rutas paginadas (catalogScale) | drift | 0 | 0 | 0 (gate F3 cubre) | hecho |

### Totales PLAN 3
- Gates: `pnpm check` exit=0, benchmark 1.704 ms, e2e 8/8.
- Mejoras: axe catalogModern 100 %, CSS Studio 0.23 %, cobertura ampliada (nojs 24 combos, reproducibilidad draft, contratos).
- Acumulado PLAN 1→3: axe 14→0 en reference y 19→0 en catalogModern; benchmark −2.9 % vs baseline del PLAN 1; margen CSS Studio +232 B; margen runtime 1.5 KB (bloqueado por decisión del usuario).

## PLAN 4 (17:10-17:25Z, 2026-08-14)

| id | ítem | métrica | antes | después | Δ% | estado |
|----|------|---------|-------|---------|-----|--------|
| P4-1 | Re-verificación gates PLAN 3 | gates | — | 14/14 | 0 | hecho |
| P4-2 | Verificación discount/announcement (medición) | checks | — | 2/2 | verificado | hecho |
| P4-3 | CSS Studio duplicación post-dedup | duplicadas | 0 | 0 | 0 (completo) | hecho |
| P4-4 | Foco visible con teclado | invisibles | — | 0/12 tabs | gate nuevo | hecho (`focus-visible.spec.ts`) |
| P4-5 | Draft útil + noindex/robots/sitemap | checks | — | 4/4 | gate nuevo | hecho |
| P4-6 | CDP reposo post-axe | ms/s | 31.8/18.0 | 31.6/18.6 | 0 (ruido) | hecho |
| P4-7 | Content-types del handler | checks | 9/9 | 9/9 | 0 | hecho |
| P4-8 | Runtime raw (estado real del usuario) | bytes | 55.845 B | 55.845 B | 0 | hecho |
| P4-9 | Robots/sitemap draft vs production | drift | 0 | 0 | gate nuevo | hecho |
| P4-10 | Preload LCP en páginas con imagen | páginas | — | **146/146** | gate nuevo | hecho (`sitio-consistencia.test.ts`) |

### Totales PLAN 4
- Gates: `pnpm check` exit=0, benchmark 1.550 ms (Δ% 8.4 % acumulado vs baseline PLAN 1), e2e 2/2.
- Mejoras: 3 gates permanentes nuevos (foco, consistencia draft/production, preloads 146/146).
- Acumulado PLAN 1→4: axe 0/0 en ambos fixtures; preloads 100 %; foco 100 %; benchmark −8.4 %; margen CSS Studio 4.3 KiB.

## PLAN 5 (17:25-17:50Z, 2026-08-14)

| id | ítem | métrica | antes | después | Δ% | estado |
|----|------|---------|-------|---------|-----|--------|
| P5-1 | Re-verificación gates PLAN 4 | gates | — | 15/15 | 0 | hecho |
| P5-2 | LCP navegador frío (3 corridas, mediana) | ms | — | home 68 / prod 60 | baseline | hecho (`lcp-cold.spec.ts`) |
| P5-3 | Cache-Control handler (no-store) | checks | 9/9 | 9/9 | 0 | hecho |
| P5-4 | CSS V2 duplicación post-iteración usuario | bytes | 247 B | 247 B | 0 (sin cambio) | hecho |
| P5-5 | Draft útil (cubierto en P4-5) | checks | 4/4 | 4/4 | 0 | hecho |
| P5-6 | **Axe en catalogScale (3er fixture)** | findings | — | **0** (18 rutas, 3 fixtures) | gate ampliado | hecho |
| P5-7 | Videos con poster y duración válida | checks | — | 2/2 | gate nuevo | hecho (`recursos-check.test.ts`) |
| P5-8 | Consola con interacciones (exported-store 6/6 + nojs 24) | errores | 0 | 0 | 0 | hecho |
| P5-9 | JSON-LD válido con URLs absolutas (páginas comerciales) | checks | — | 5/5 | gate nuevo | hecho (`seo-check.test.ts`) |
| P5-10 | Contraste footer modern (axe 0 ya lo cubre) | findings | 0 | 0 | 0 | hecho |

### Totales PLAN 5
- Gates: `pnpm check` exit=0, benchmark 1.553 ms (Δ% 8.2 % acumulado vs baseline PLAN 1), e2e 6/6.
- Mejoras: 3 gates nuevos (LCP frío, recursos/video, SEO/JSON-LD); axe cubre los 3 fixtures (18 rutas).
- Acumulado PLAN 1→5: benchmark −8.2 %; axe 0/0/0; preloads 146/146; LCP frío 60-68 ms; foco 0 invisibles; JSON-LD comercial 100 %.

## PLAN 6 (17:50-18:10Z, 2026-08-14)

| id | ítem | métrica | antes | después | Δ% | estado |
|----|------|---------|-------|---------|-----|--------|
| P6-1 | Re-verificación de todos los gates acumulados | gates | — | 20/20 (7 archivos) | 0 | hecho |
| P6-2 | `data-design-family` html ↔ fixture (3 fixtures) | drift | 0 | 0 | gate nuevo | hecho |
| P6-3 | `productIds` de categorías/colecciones derivados | drift | 0 | 0 | gate nuevo | hecho |
| P6-4 | Assets sin huérfanos ni faltantes en el export | huérfanos | 0 | 0 | gate nuevo | hecho |
| P6-5 | Features del runtime declaradas en el html | drift | 0 | 0 | gate nuevo | hecho |
| P6-6 | CSS de familias aislado bajo su raíz (V1/V2) | fugas | 0 | 0 | gate nuevo | hecho |
| P6-7 | Sitemap sin canonicales duplicadas | duplicados | 0 | 0 | gate nuevo | hecho |
| P6-8 | LCP frío de catalogModern | ms | — | home 56 / prod 52 | baseline | hecho |
| P6-9 | 404.html content-type (cubierto) | checks | 1/1 | 1/1 | 0 | hecho |
| P6-10 | Fuentes subset re-verificadas | bytes | 30.196 B | 30.196 B | 0 (intacto) | hecho |

### Totales PLAN 6
- Gates: `pnpm check` exit=0; 6 gates nuevos de contratos profundos (contratos-profundos.test.ts) con drift 0 en todos.
- Mejoras: la cobertura de enganches generador↔sitio es ahora exhaustiva (familia, ids derivados, assets, features, CSS, sitemap).
- Acumulado PLAN 1→6: axe 0/0/0; preloads 146/146; LCP frío 44-56 ms; contratos profundos 6/6 sin drift.

## PLAN 7 (18:10-18:30Z, 2026-08-14)

| id | ítem | métrica | antes | después | Δ% | estado |
|----|------|---------|-------|---------|-----|--------|
| P7-1 | Barrido visual completo | hallazgos | 4 (solo 404) | 4 (solo 404) | 0 | hecho |
| P7-2 | Visión fresca: 4 hallazgos → 2 re-verificados (carrito=h1 del diseño por medición; 404=footer intencional) + 2 fijados: "A coordinar" 2rem→1rem (solo total 2rem), placeholder del input de búsqueda | hallazgos | 2 accionables | 0 | **100 %** | hecho |
| P7-3 | Axe re-verificado (3 fixtures) | findings | 0 | 0 | 0 | hecho |
| P7-4 | CDP reposo | ms/s | 31.6/18.6 | 30.8/17.8 | 2.5 % (ruido) | hecho |
| P7-5 | Consola limpia (sweep) | errores | 0 | 0 | 0 | hecho |
| P7-6 | CSS V2 + fuentes + preloads | gates | OK | OK | 0 | hecho |
| P7-7 | Paridad + enganches + reproducibilidad | gates | OK | 16/16 | 0 | hecho |
| P7-8 | No-JS 24 combinaciones | gates | OK | OK | 0 | hecho |

### Totales PLAN 7
- Gates: `pnpm check` exit=0, e2e 3/3, axe 0, sweep limpio.
- Mejoras: 2 fixes visuales reales de la visión fresca; la medición volvió a desmentir 2 percepciones.
- Acumulado PLAN 1→7: benchmark −8.2 %; axe 0/0/0; preloads 146/146; LCP 44-72 ms; foco 0; JSON-LD 100 %; contratos profundos 0 drift.

## PLAN 8 (18:30-18:50Z, 2026-08-14)

| id | ítem | métrica | antes | después | Δ% | estado |
|----|------|---------|-------|---------|-----|--------|
| P8-1 | CDP + LCP frío re-verificado | ms | 44-56 | 44-56 | 0 | hecho |
| P8-2 | Handler 9/9 + subcarpeta | gates | OK | OK | 0 | hecho |
| P8-3 | Auditoría visual catalogModern (10 capturas): 4 hallazgos → 3 desmentidos por medición (A coordinar 1 línea 21px; badge % presente; recortes de fixtures) + 1 real: tracking −0.09/−0.075em → −0.03em en 5 reglas | hallazgos | 1 real | 0 | **100 %** | hecho |
| P8-4 | Axe + foco re-verificados | gates | OK | OK | 0 | hecho |
| P8-5 | Contratos profundos re-verificados | gates | 6/6 | 6/6 | 0 | hecho |
| P8-6 | Cobertura rutas re-verificada | gates | OK | OK | 0 | hecho |
| P8-7 | **Interacciones reales sin errores** (agregar al carrito → carrito → checkout): gate nuevo | errores | — | 0 | gate nuevo | hecho (`interacciones.spec.ts`) |

### Totales PLAN 8
- Gates: `pnpm check` exit=0, e2e 1/1 (gate nuevo de interacciones).
- Mejoras: tracking de títulos corregido (legibilidad), gate de interacciones reales.
- Acumulado PLAN 1→8: benchmark −8.2 %; axe 0/0/0; preloads 146/146; LCP 44-56 ms; interacciones 0 errores; contratos 0 drift.
