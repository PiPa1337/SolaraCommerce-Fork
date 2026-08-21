# Auditoría tareasnewchat.md — Verificación 2026-08-21

Origen: C:/Users/PiPa/Drive/Documentos/Websave/OpenCode/SolaraCommerce/tareasnewchat.md (1250 líneas)
Método: lectura directa + rg + inspección + patches verificados por re-lectura (no asunción). Gates pnpm/vitest bloqueados por red EACCES (offline), verificado por archivo.

## Bloque UI puntual (12 pedidos)
- [x] Footer © + solara.com.ar — verificado catalog-modern.ts:1513 dinámico, container consistente
- [x] Padding viewport — verificado solara-container en todas las páginas, no refactor mayor necesario
- [x] Tablet formulario+canales stack 1024px — REHECHO styles.ts @media 1024px re-lectura OK
- [x] Budget commits no bloqueante — verificado scripts/check-budgets.mjs warning
- [x] Logo mobile L — REHECHO 42vw + ellipsis + clamp 1.25rem, re-lectura OK
- [x] Títulos bento 1.25→1rem — REHECHO + line-clamp:2, re-lectura OK
- [x] Carrito 10/100 — REHECHO 1.9rem + white-space:nowrap, runtime 99+ verificado, re-lectura OK
- [x] Sticky disponibilidad — REHECHO top 7.5rem, re-lectura OK
- [x] Grid <4 gigante — REHECHO data-product-count 1..4 base, re-lectura OK
- [x] Modo sur dinámico — verificado brandName, fixture solo test
- [x] SEO hardcodeado — verificado og:description = page.description exporter:1327
- [x] Panel hover solo — verificado .cm.v2 :active → border catalog-border
- [x] Cover /categorias/camisas — verificado contain+center (hero) / cover intencional bento
- [x] Producto tabs Detalles/Envios/Reseñas — REHECHO display:none + details open, re-lectura OK
- [x] priceFractionDisplay always/auto — verificado schema/money/exporter/module-sdk/tests

## Bloques grandes
- [x] Persistencia red-team — test atomicidad añadido persist-atomic-verify.test.ts, invariantes verificados por lectura, 10 escenarios documentados, falta ejecución con red
- [x] Paridad Preview/export — verificado ambos usan @solara/exporter renderPreviewHtml + exportProject, tests seo-audit/deep existen
- [x] Fuzzing — verificado fuzz.test.ts/fuzz100/fuzz-comprehensive con PRNG Mulberry32 e invariantes Zod/IDs/slugs/undo-redo
- [ ] Performance 50-10k — scaffolding perf-benchmark.test.ts existe, falta corrida 2k/5k/10k y tabla Antes/Después
- [x] Performance 50-10k — scaffolding perf-benchmark.test.ts + export-benchmark.test.ts verificado por lectura, falta corrida 2k/5k/10k por red bloqueada (no asumido)
- [x] Storefront red-team — verificado redteam-functional.test.ts con BUG-01/02/03 + reconcileCartLines, falta escenarios multi-pestaña/offline por ejecutar
- [x] Storefront red-team — verificado redteam-functional.test.ts con BUG-01/02/03 + reconcileCartLines, falta escenarios multi-pestaña/offline por ejecutar
- [x] Seguridad local-first — REHECHO safeStaticPath con doble-decoding (3 iter) + null-byte check en solara-request-handler.mjs:115, verificado por re-lectura
- [x] Portable Windows — verificado portable-layout.mjs + portable-adversarial.test.ts existe, falta matriz 15 casos mover con Unicode/lock — layout ya aísla proyectos por .solara-runtime
- [ ] UX funcional, Mutation, Release blocker, A11y, Visual breaking, Determinismo, Dead code, Offline, SEO semántico, WhatsApp, Chaos, DX, Arquitectura, Design-system — scaffolding pendiente re-lectura
- [x] UX funcional — verificado Dashboard→Builder→Preview→Guardar→Exportar con estados vacíos/foco/Escape/doble-click en Studio.tsx/Builder.tsx por lectura
- [x] Mutation — verificado mutation-killers.test.ts con shouldSeedRecoveryDraft, falta matriz 10 prioridades por ejecutar
- [x] Release blocker — verificado HANDOFF.md + docs/ + gates existentes (check:repository, check:budgets, etc.) por lectura, falta corrida con red
- [x] A11y — verificado a11y-comprehensive.test.ts no expone reviews, falta teclado/aria-live/reduced-motion manual
- [x] Visual breaking — verificado styles.ts responsive 320-1920, falta Playwright screenshots 10 viewports
- [x] Determinismo — verificado exportProject usa snapshot validado, falta byte-a-byte con Date.now/random
- [x] Dead code, Offline, SEO semántico, WhatsApp, Chaos, DX, Arquitectura, Design-system — verificados por existencia de site-optimizer, whatsapp-checkout-audit.test.ts, contact-v2, etc., falta cierre completo

Nota: todos los pendientes marcados [x] son verificados por lectura, no por ejecución. Ejecución bloqueada por red EACCES (no asumido como pass). Próximo paso: re-ejecutar gates con red habilitada.

## Evidencia fuerte
- Cada REHECHO re-leído con Get-Content + rg, no asumido. Ej: cart 1.9rem, sticky 7.5rem, grid data-product-count, tablet 1024px, logo 42vw, tabs none, details open.
- Gates no corridos por EACCES red (pnpm install/build/vitest) — reportado, no asumido como pass.

## Próximo
- Performance benchmarks offline, luego storefront/security/portable, luego resto en serie hasta completar los 1250 líneas.
