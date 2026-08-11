# Auditoría total de la pestaña Tema — 2026-08-10 — Implementation Plan

> **Ejecución:** Ola 1 = 8 agentes de caza en paralelo; Ola 2 = 4 agentes de traza/paridad; Ola 3 = fixes por owner; cierre. Alcance aprobado: **arreglar todo lo inútil** (todo control debe producir un efecto visible real en el preview Y en el sitio público exportado).

**Goal:** Cada control del panel Tema (ThemeEditor) debe (1) funcionar con efecto real, (2) comunicar su estado, (3) enviar el dato que el receptor espera, y (4) **producir un cambio visible en el preview y en el sitio exportado**. Los controles sin efecto real se arreglan (selector de fuentes con carga, spacing con consumidores, tokens conectados) o se eliminan.

**Contrato de 4 capas:** funcional / auto-feedback / datos / **utilidad** (la capa nueva: CSS exportado antes vs después + render).

**Hallazgos preliminares (evidencia de la inspección):**
- `ThemeSchema` (project-schema index.ts:243-263): colorMode (auto/light/dark), 7 colores, typography {display, body, scale 0.8-1.4}, spacingScale 0.75-1.5, radius 0-40, container 960-1800.
- El exporter emite TODOS como `--solara-*` (exporter index.ts:573-593) y styles.ts consume font/type-scale/radius/container — pero **`--solara-space` (spacingScale) no tiene consumidores conocidos** (candidato a dead control).
- "Familia de títulos"/"Familia de texto" son **inputs de texto libres sin carga de fuentes** (el caso del usuario: no se puede elegir).
- Dark deshabilitado con hint (overrides fijos del storefront — re-evaluar con evidencia).

## OLA 1 — CAZA (8 agentes, un lote)

Cada agente: clicks/cambios reales con Playwright sobre la tienda demo (boot `studio-server.ts`, tab Tema); para cada control verifica: efecto real asertado, auto-feedback, contrato de datos, y **utilidad**: exportar el sitio (patrón `exported-store.spec.ts`/`catalog-modern.spec.ts`) ANTES y DESPUÉS del cambio y comparar el CSS/HTML (¿el valor llegó y se ve?). Reporte `.superpowers/sdd/tema-tN-report.md` con MATRIZ | # | Control | Acción | Efecto preview | Efecto sitio exportado (diff) | Auto-feedback | Datos | Utilidad (SÍ/NO + evidencia) | Veredicto |. Reglas: spec nuevo por bin `tests/e2e/ui-tema-aN.spec.ts` (único), no editar archivos ajenos (los del panel los toca el OWNER en Ola 3), `git commit` con reintentos de index.lock, biome solo sobre lo propio, 0 U+FFFD.

| Bin | Controles | Enfoque |
|---|---|---|
| T1 | Presets (4) | aplican paleta en preview y en CSS exportado (diff por preset); auto-feedback (aria-pressed "✓ Aplicada" vigente) |
| T2 | Colores: 7 inputs texto + 7 pickers nativos | por token: var computada en preview y en el sitio; consumo real en styles.ts (¿muted/accentText/border se usan?); hex inválido; contraste |
| T3 | Panel de contraste WCAG | ratios vs cálculo real (¿algún par declarado OK falla?); avisos de color inválido; utilidad del panel |
| T4 | Tipografía: familias (2 inputs) + escala (range) | el caso del usuario: ¿qué pasa al escribir una familia? ¿llega al preview/sitio? (sin carga de fuentes, solo familias del sistema); escala → var usada |
| T5 | Geometría: radius (range) + spacingScale (range) | radius → var usada (real); spacing → ¿consumidor de `--solara-space`? (sospecha de dead control — confirmar con diff del CSS) |
| T6 | Contenedor (input numérico) | 960-1800: validación (error inline), preview (ancho), sitio (max-width) |
| T7 | colorMode (select auto/light/dark) | auto sigue el sistema en preview y sitio; dark deshabilitado — ¿qué pasaría si se habilita? (overrides fijos: localizarlos y evaluar) |
| T8 | Resets (3) + persistencia | restauran grupos a valores de apertura; tema persiste al recargar pestaña, guardar y en el respaldo `.solara.json` |

## OLA 2 — TRAZA Y PARIDAD (4 agentes, un lote)

| Bin | Misión |
|---|---|
| U1 | Mapa completo campo→var→consumidor: tabla por cada campo del ThemeSchema; vars emitidas sin consumidor (--solara-space, --solara-space-scale, --solara-display duplicado de --solara-font-display?) = hallazgo con evidencia |
| U2 | Paridad preview↔sitio: `renderPreviewHtml` y `exportProject` emiten los MISMOS valores de tema (diff de las vars entre ambos outputs) — si difieren, hallazgo |
| U3 | Matriz transversal de utilidad: control → var → consumidor → efecto visible en el sitio (dead-controls confirmados con captura) |
| U4 | Fuentes deep: inventario de familias del sistema (Georgia/Verdana/Arial/Tahoma/monospace…) y diseño del selector real + carga Google Fonts (`@font-face` generado en el export y el preview) con presupuesto (peso del CSS) |

## OLA 3 — FIXES (ola por owner según hallazgos)

Alcance aprobado (arreglar todo lo inútil):
- **Fuentes**: selector real (familias del sistema + opciones Google Fonts con `@font-face` generado en el export y el preview). OWNER: `ThemeEditor.tsx` + `packages/exporter` (carga de fuentes) + `packages/modules/styles.ts` si aplica.
- **Spacing**: conectar `--solara-space` a gaps/paddings reales del módulo (escala) o eliminar el slider si no aporta. OWNER: styles.ts + ThemeEditor.
- **Tokens de color sin consumidor**: conectar en styles.ts o eliminar del editor/exporter (decisión con evidencia). OWNER: styles.ts + ThemeEditor + exporter.
- **Dark mode**: si los overrides fijos se pueden reemplazar por tokens, habilitar "Oscuro"; si no, mantener deshabilitado con hint (evidencia). OWNER: styles.ts/runtime + ThemeEditor.
- Specs `tests/e2e/ui-tema-*.spec.ts` con aserciones preview↔sitio exportado (gate nuevo).

## CIERRE

Consolidar matriz 4-capas (1 agente) · gates (check, build, budgets — headroom runtime 13 B, benchmark, test:e2e 532+, portable) · docs (deuda: vars muertas, fuentes, dark) · ejecutables · push. Verificación de simultaneidad ×5; redespachos en lote.
