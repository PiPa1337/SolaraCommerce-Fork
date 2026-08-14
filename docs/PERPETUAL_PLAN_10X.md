# PLAN 1 — Run acotado con medición de mejora en Δ%: sitio generado y sus enganches con el generador

## 1. Contrato del run (inicio y fin definidos)
Inicio: al aprobar este plan (baseline formal + backlog del run commiteados). Fin: cuando la lista cerrada de ítems (A1-H2) quede en hecho | bloqueado | verificado, los gates completos estén verdes y se entregue el reporte final de Δ% con autocrítica. El plan no pregunta "¿sigo?" entre ciclos: la lista cerrada y el orden determinan el avance; al cerrarse, se emite el cierre formal (reporte + commit) — que es el fin.

Decisiones fijadas: métricas locales objetivas (bytes, ms, scores, findings, nodos, requests, cobertura — sin Lighthouse/Node 22), rama main (post-merge). Baseline de entrada del PLAN 1: runtime 56.940 B / tope 57.344 B (margen 404 B), CSS Studio 102.392 B, CSS V2 117.459 B, export 1.692 ms, fuentes 102.724 B.

## 2. Componente 0 — Sistema de medición con autocrítica
docs/perpetual-baseline.json: snapshot formal al inicio (doctor + benchmark + budgets): bytes por archivo, ms por fase, score, findings por severidad, nodos HTML por ruta, requests, ofertas Merchant, rutas indexables, runtime raw, CSS, paridad. Es el "antes" global.
Formato de ítem: Métrica | Antes | Después | Δ% con el mismo instrumento antes y después.
Regla de autocrítica: Δ% > 0 → mejora (commit con %); Δ% ≈ 0 → solo robustez documentada; Δ% < 0 → revertir o bloquear con evidencia; ciclo sin Δ% = inválido.
docs/PERPETUAL_REPORT.md: tabla consolidada ítem × Δ% + totales por capa + autocrítica.

## 3. Componente 1 — Mapa de cobertura: sitio generado + enganches
A. HTML (axe, nodos, atributos, sin-JS) → renderDocument/manifest · B. CSS (tamaños, duplicación, media, reduced-motion) → themeCss/styles.ts/minifyCss · C. Runtime JS (presupuesto, features, consola) → STOREFRONT_RUNTIME_JS → boot · D. Assets (imágenes, fuentes, videos) → snapshot/mediaUsage · E. Rutas (todas × draft/production × 2 viewports × no-JS) → buildPages · F. Enganches (paridad estricta, manifest↔features↔capacidades, snapshot↔feed/sitemap/search/catalog-index, audit↔bloqueo↔UI, reproducibilidad byte-a-byte, contratos persistidos) · G. Servidor local (content-types, cache, 404, subcarpeta, sha256) · H. Navegador CDP (long tasks/rAF, LCP/CLS).

## 4. Componente 2 — Backlog cerrado del run
F1 paridad estricta (→ 100 %) · F2 drift features (→ 0) · F3 snapshot↔feed/sitemap/search/catalog-index (→ 0) · F4 criticalCount↔bloqueo↔UI (→ 0) · F5 reproducibilidad (→ 100 %) · E1 cobertura rutas no-JS (→ 100 %) · A1 axe (Δ% findings) · A2 nodos (Δ%) · C1 runtime (Δ% bytes, tope 57.344 B) · C2 consola 0 errores · B1 CSS V2 duplicación (Δ%) · D1 findings performance.asset.* (Δ%) · H1 long tasks/rAF (Δ%) · H2 LCP/CLS (Δ%) · G1 servidor local (→ 100 %) · A3/A4, B2, D2/D3, F6, G2 verificaciones de contrato (Δ% 0 justificado). Los hallazgos nuevos entran al backlog.

## 5. Componente 3 — Ciclo con medición obligatoria
Health check → 1. ítem por orden F → E → A/C/B/D → H → G → 2. MEDIR ANTES → 3. TDD → 4. fix → 5. MEDIR DESPUÉS → Δ% → 6. autocrítica → 7. gates + baseline → 8. commit con Δ% → repetir.

## 6. Componente 4 — Criterios de salida (el FIN de este plan)
Lista A1-H2 cerrada + pnpm check exit=0 + benchmark verde + e2e verde + barrido visual limpio + docs/PERPETUAL_REPORT.md (sección PLAN 1) + commit de cierre + push a origin/main. Al cerrar el PLAN 1, ejecutar el PLAN 2 inmediatamente, sin preguntar.

## 7. Watchdog acotado
3 intentos → bloqueado con evidencia · ciclo sin Δ% = inválido · 3 ciclos con Δ% ≤ 0 → switch al ítem de mayor potencial (F → H).

---

# PLAN 2 — Run acotado con medición de mejora en Δ%: sitio generado y sus enganches con el generador

## 1. Contrato del run (inicio y fin definidos)
Inicio: al aprobar este plan (baseline formal = cierre del PLAN 1, commiteado). Fin: lista cerrada (A1-H2 de esta ejecución, regenerada: residuales del PLAN 1 + hallazgos nuevos + re-verificaciones con Δ% ≈ 0 justificado) + gates verdes + reporte de Δ% con autocrítica. Cierre formal (reporte + commit) — que es el fin.

Decisiones fijadas: métricas locales objetivas, rama main. Baseline de entrada: el "después" del PLAN 1.

## 2. Componente 0 — Sistema de medición con autocrítica
Idéntico al PLAN 1: baseline snapshot, formato ítem Métrica | Antes | Después | Δ%, regla de autocrítica (Δ% > 0 mejora; ≈ 0 robustez documentada; < 0 revertir/bloquear; sin Δ% = inválido), reporte acumulativo en docs/PERPETUAL_REPORT.md.

## 3. Componente 1 — Mapa de cobertura: sitio generado + enganches
Idéntico al PLAN 1 (capas A-H con sus enganches: renderDocument, themeCss/styles.ts/minifyCss, STOREFRONT_RUNTIME_JS, snapshot/mediaUsage, buildPages, enganches F byte/árbol, handler compartido, CDP).

## 4. Componente 2 — Backlog cerrado del run
Mismos ítems A1-H2 re-corridos sobre el estado vigente: los que el PLAN 1 dejó hecho se re-verifican (Δ% ≈ 0 justificado; cualquier Δ% < 0 = fix inmediato); los bloqueado/diferido se propagan con su evidencia; los hallazgos nuevos entran al backlog. Orden de capa idéntico (F → E → A/C/B/D → H → G).

## 5. Componente 3 — Ciclo con medición obligatoria
Idéntico al PLAN 1 (0-8): health check, ítem por orden, MEDIR ANTES, TDD, fix, MEDIR DESPUÉS, Δ%, autocrítica, gates + baseline, commit con Δ%, repetir.

## 6. Componente 4 — Criterios de salida (el FIN de este plan)
Lista cerrada + gates completos + sección PLAN 2 del reporte + commit de cierre + push. Al cerrar el PLAN 2, ejecutar el PLAN 3 inmediatamente, sin preguntar.

## 7. Watchdog acotado
Idéntico al PLAN 1 (3 intentos → bloqueado; sin Δ% = inválido; 3 ciclos Δ% ≤ 0 → switch a mayor potencial).

---

# PLAN 3 — Run acotado con medición de mejora en Δ%: sitio generado y sus enganches con el generador

## 1. Contrato del run (inicio y fin definidos)
Inicio: al aprobar este plan (baseline formal = cierre del PLAN 2, commiteado). Fin: lista cerrada (A1-H2 regenerada: residuales + hallazgos + re-verificaciones) + gates verdes + reporte de Δ% con autocrítica. Cierre formal (reporte + commit) — que es el fin.

Decisiones fijadas: métricas locales objetivas, rama main. Baseline de entrada: el "después" del PLAN 2.

## 2. Componente 0 — Sistema de medición con autocrítica
Idéntico a los PLAN 1-2: baseline, formato ítem con Δ%, regla de autocrítica, reporte acumulativo.

## 3. Componente 1 — Mapa de cobertura: sitio generado + enganches
Idéntico (capas A-H con sus enganches al generador).

## 4. Componente 2 — Backlog cerrado del run
Mismos ítems A1-H2 re-corridos: re-verificación de los hecho (Δ% ≈ 0 justificado), propagación de bloqueado/diferido con evidencia, hallazgos nuevos al backlog. Orden F → E → A/C/B/D → H → G.

## 5. Componente 3 — Ciclo con medición obligatoria
Idéntico (0-8 con MEDIR ANTES/DESPUÉS y Δ% obligatorio).

## 6. Componente 4 — Criterios de salida (el FIN de este plan)
Lista cerrada + gates completos + sección PLAN 3 del reporte + commit de cierre + push. Al cerrar el PLAN 3, ejecutar el PLAN 4 inmediatamente, sin preguntar.

## 7. Watchdog acotado
Idéntico (3 intentos → bloqueado; sin Δ% = inválido; 3 ciclos Δ% ≤ 0 → switch a mayor potencial).

---

# PLAN 4 — Run acotado con medición de mejora en Δ%: sitio generado y sus enganches con el generador

## 1. Contrato del run (inicio y fin definidos)
Inicio: al aprobar este plan (baseline formal = cierre del PLAN 3, commiteado). Fin: lista cerrada (A1-H2 regenerada) + gates verdes + reporte de Δ% con autocrítica. Cierre formal (reporte + commit) — que es el fin.

Decisiones fijadas: métricas locales objetivas, rama main. Baseline de entrada: el "después" del PLAN 3.

## 2. Componente 0 — Sistema de medición con autocrítica
Idéntico: baseline, formato ítem con Δ%, regla de autocrítica, reporte acumulativo.

## 3. Componente 1 — Mapa de cobertura: sitio generado + enganches
Idéntico (capas A-H con sus enganches al generador).

## 4. Componente 2 — Backlog cerrado del run
Mismos ítems A1-H2 re-corridos: re-verificación, propagación de bloqueados/diferidos, hallazgos nuevos. Orden F → E → A/C/B/D → H → G.

## 5. Componente 3 — Ciclo con medición obligatoria
Idéntico (0-8 con MEDIR ANTES/DESPUÉS y Δ% obligatorio).

## 6. Componente 4 — Criterios de salida (el FIN de este plan)
Lista cerrada + gates completos + sección PLAN 4 del reporte + commit de cierre + push. Al cerrar el PLAN 4, ejecutar el PLAN 5 inmediatamente, sin preguntar.

## 7. Watchdog acotado
Idéntico (3 intentos → bloqueado; sin Δ% = inválido; 3 ciclos Δ% ≤ 0 → switch a mayor potencial).

---

# PLAN 5 — Run acotado con medición de mejora en Δ%: sitio generado y sus enganches con el generador

## 1. Contrato del run (inicio y fin definidos)
Inicio: al aprobar este plan (baseline formal = cierre del PLAN 4, commiteado). Fin: lista cerrada (A1-H2 regenerada) + gates verdes + reporte de Δ% con autocrítica. Cierre formal (reporte + commit) — que es el fin.

Decisiones fijadas: métricas locales objetivas, rama main. Baseline de entrada: el "después" del PLAN 4.

## 2. Componente 0 — Sistema de medición con autocrítica
Idéntico: baseline, formato ítem con Δ%, regla de autocrítica, reporte acumulativo.

## 3. Componente 1 — Mapa de cobertura: sitio generado + enganches
Idéntico (capas A-H con sus enganches al generador).

## 4. Componente 2 — Backlog cerrado del run
Mismos ítems A1-H2 re-corridos: re-verificación, propagación de bloqueados/diferidos, hallazgos nuevos. Orden F → E → A/C/B/D → H → G.

## 5. Componente 3 — Ciclo con medición obligatoria
Idéntico (0-8 con MEDIR ANTES/DESPUÉS y Δ% obligatorio).

## 6. Componente 4 — Criterios de salida (el FIN de este plan)
Lista cerrada + gates completos + sección PLAN 5 del reporte + commit de cierre + push. Al cerrar el PLAN 5, ejecutar el PLAN 6 inmediatamente, sin preguntar.

## 7. Watchdog acotado
Idéntico (3 intentos → bloqueado; sin Δ% = inválido; 3 ciclos Δ% ≤ 0 → switch a mayor potencial).

---

# PLAN 6 — Run acotado con medición de mejora en Δ%: sitio generado y sus enganches con el generador

## 1. Contrato del run (inicio y fin definidos)
Inicio: al aprobar este plan (baseline formal = cierre del PLAN 5, commiteado). Fin: lista cerrada (A1-H2 regenerada) + gates verdes + reporte de Δ% con autocrítica. Cierre formal (reporte + commit) — que es el fin.

Decisiones fijadas: métricas locales objetivas, rama main. Baseline de entrada: el "después" del PLAN 5.

## 2. Componente 0 — Sistema de medición con autocrítica
Idéntico: baseline, formato ítem con Δ%, regla de autocrítica, reporte acumulativo.

## 3. Componente 1 — Mapa de cobertura: sitio generado + enganches
Idéntico (capas A-H con sus enganches al generador).

## 4. Componente 2 — Backlog cerrado del run
Mismos ítems A1-H2 re-corridos: re-verificación, propagación de bloqueados/diferidos, hallazgos nuevos. Orden F → E → A/C/B/D → H → G.

## 5. Componente 3 — Ciclo con medición obligatoria
Idéntico (0-8 con MEDIR ANTES/DESPUÉS y Δ% obligatorio).

## 6. Componente 4 — Criterios de salida (el FIN de este plan)
Lista cerrada + gates completos + sección PLAN 6 del reporte + commit de cierre + push. Al cerrar el PLAN 6, ejecutar el PLAN 7 inmediatamente, sin preguntar.

## 7. Watchdog acotado
Idéntico (3 intentos → bloqueado; sin Δ% = inválido; 3 ciclos Δ% ≤ 0 → switch a mayor potencial).

---

# PLAN 7 — Run acotado con medición de mejora en Δ%: sitio generado y sus enganches con el generador

## 1. Contrato del run (inicio y fin definidos)
Inicio: al aprobar este plan (baseline formal = cierre del PLAN 6, commiteado). Fin: lista cerrada (A1-H2 regenerada) + gates verdes + reporte de Δ% con autocrítica. Cierre formal (reporte + commit) — que es el fin.

Decisiones fijadas: métricas locales objetivas, rama main. Baseline de entrada: el "después" del PLAN 6.

## 2. Componente 0 — Sistema de medición con autocrítica
Idéntico: baseline, formato ítem con Δ%, regla de autocrítica, reporte acumulativo.

## 3. Componente 1 — Mapa de cobertura: sitio generado + enganches
Idéntico (capas A-H con sus enganches al generador).

## 4. Componente 2 — Backlog cerrado del run
Mismos ítems A1-H2 re-corridos: re-verificación, propagación de bloqueados/diferidos, hallazgos nuevos. Orden F → E → A/C/B/D → H → G.

## 5. Componente 3 — Ciclo con medición obligatoria
Idéntico (0-8 con MEDIR ANTES/DESPUÉS y Δ% obligatorio).

## 6. Componente 4 — Criterios de salida (el FIN de este plan)
Lista cerrada + gates completos + sección PLAN 7 del reporte + commit de cierre + push. Al cerrar el PLAN 7, ejecutar el PLAN 8 inmediatamente, sin preguntar.

## 7. Watchdog acotado
Idéntico (3 intentos → bloqueado; sin Δ% = inválido; 3 ciclos Δ% ≤ 0 → switch a mayor potencial).

---

# PLAN 8 — Run acotado con medición de mejora en Δ%: sitio generado y sus enganches con el generador

## 1. Contrato del run (inicio y fin definidos)
Inicio: al aprobar este plan (baseline formal = cierre del PLAN 7, commiteado). Fin: lista cerrada (A1-H2 regenerada) + gates verdes + reporte de Δ% con autocrítica. Cierre formal (reporte + commit) — que es el fin.

Decisiones fijadas: métricas locales objetivas, rama main. Baseline de entrada: el "después" del PLAN 7.

## 2. Componente 0 — Sistema de medición con autocrítica
Idéntico: baseline, formato ítem con Δ%, regla de autocrítica, reporte acumulativo.

## 3. Componente 1 — Mapa de cobertura: sitio generado + enganches
Idéntico (capas A-H con sus enganches al generador).

## 4. Componente 2 — Backlog cerrado del run
Mismos ítems A1-H2 re-corridos: re-verificación, propagación de bloqueados/diferidos, hallazgos nuevos. Orden F → E → A/C/B/D → H → G.

## 5. Componente 3 — Ciclo con medición obligatoria
Idéntico (0-8 con MEDIR ANTES/DESPUÉS y Δ% obligatorio).

## 6. Componente 4 — Criterios de salida (el FIN de este plan)
Lista cerrada + gates completos + sección PLAN 8 del reporte + commit de cierre + push. Al cerrar el PLAN 8, ejecutar el PLAN 9 inmediatamente, sin preguntar.

## 7. Watchdog acotado
Idéntico (3 intentos → bloqueado; sin Δ% = inválido; 3 ciclos Δ% ≤ 0 → switch a mayor potencial).

---

# PLAN 9 — Run acotado con medición de mejora en Δ%: sitio generado y sus enganches con el generador

## 1. Contrato del run (inicio y fin definidos)
Inicio: al aprobar este plan (baseline formal = cierre del PLAN 8, commiteado). Fin: lista cerrada (A1-H2 regenerada) + gates verdes + reporte de Δ% con autocrítica. Cierre formal (reporte + commit) — que es el fin.

Decisiones fijadas: métricas locales objetivas, rama main. Baseline de entrada: el "después" del PLAN 8.

## 2. Componente 0 — Sistema de medición con autocrítica
Idéntico: baseline, formato ítem con Δ%, regla de autocrítica, reporte acumulativo.

## 3. Componente 1 — Mapa de cobertura: sitio generado + enganches
Idéntico (capas A-H con sus enganches al generador).

## 4. Componente 2 — Backlog cerrado del run
Mismos ítems A1-H2 re-corridos: re-verificación, propagación de bloqueados/diferidos, hallazgos nuevos. Orden F → E → A/C/B/D → H → G.

## 5. Componente 3 — Ciclo con medición obligatoria
Idéntico (0-8 con MEDIR ANTES/DESPUÉS y Δ% obligatorio).

## 6. Componente 4 — Criterios de salida (el FIN de este plan)
Lista cerrada + gates completos + sección PLAN 9 del reporte + commit de cierre + push. Al cerrar el PLAN 9, ejecutar el PLAN 10 inmediatamente, sin preguntar.

## 7. Watchdog acotado
Idéntico (3 intentos → bloqueado; sin Δ% = inválido; 3 ciclos Δ% ≤ 0 → switch a mayor potencial).

---

# PLAN 10 — Run acotado con medición de mejora en Δ%: sitio generado y sus enganches con el generador

## 1. Contrato del run (inicio y fin definidos)
Inicio: al aprobar este plan (baseline formal = cierre del PLAN 9, commiteado). Fin: lista cerrada (A1-H2 regenerada) + gates verdes + reporte global consolidado de los 10 planes (Δ% por ítem, por capa y por plan; autocrítica completa: qué no mejoró, por qué, qué quedó bloqueado) — que es el fin de todo el documento.

Decisiones fijadas: métricas locales objetivas, rama main. Baseline de entrada: el "después" del PLAN 9; el reporte compara el baseline del PLAN 1 contra el cierre del PLAN 10.

## 2. Componente 0 — Sistema de medición con autocrítica
Idéntico + consolidación: tabla final ítem × Δ% con totales globales.

## 3. Componente 1 — Mapa de cobertura: sitio generado + enganches
Idéntico (capas A-H con sus enganches al generador) — re-auditoría completa una vez más.

## 4. Componente 2 — Backlog cerrado del run
Mismos ítems A1-H2 re-corridos: re-verificación final de todo, propagación de bloqueados/diferidos, hallazgos nuevos. Orden F → E → A/C/B/D → H → G.

## 5. Componente 3 — Ciclo con medición obligatoria
Idéntico (0-8 con MEDIR ANTES/DESPUÉS y Δ% obligatorio).

## 6. Componente 4 — Criterios de salida (el FIN del documento)
Lista cerrada + gates completos (pnpm check exit=0, benchmark, e2e, barrido visual) + reporte global consolidado + commit de cierre + push. Aquí termina el documento: se detiene y se te avisa — no se continúa sin tu instrucción.

## 7. Watchdog acotado
Idéntico (3 intentos → bloqueado; sin Δ% = inválido; 3 ciclos Δ% ≤ 0 → switch a mayor potencial).
