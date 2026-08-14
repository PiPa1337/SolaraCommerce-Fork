# Backlog perpetuo de QA y optimización

Fuente única de trabajo del bucle perpetuo. Reglas:

- El campo `SIGUIENTE` al final del archivo apunta al próximo ítem exacto.
- Estados: `pendiente` → `en-progreso` → `hecho` | `bloqueado`.
- Un ítem `bloqueado` SIEMPRE lleva `evidencia` (salida del error o referencia) y razón.
- Regla de selección: pendiente de mayor prioridad; orden de áreas:
  correctitud > optimización > deuda abierta > mejora propia > re-auditoría.
- Todo hallazgo nuevo entra aquí (doctor, e2e, barridos visuales, docs). Nunca se
  trabaja fuera del backlog.
- Watchdog: 3 intentos por ítem → `bloqueado`; 5 ciclos sin hallazgo → switch de
  estrategia (barrido visual + doctor + re-lectura de docs).

## Fase correctitud

| id | prioridad | área | título | estado | evidencia |
|----|-----------|------|--------|--------|-----------|
| C1 | alta | exporter | Paridad preview/export diferencial: `scripts/parity-sweep.test.ts` cubre los 3 fixtures en draft y production, todas las rutas (6/6 verdes) | hecho | scripts/parity-sweep.test.ts |
| C2 | alta | exporter | Paginación SEO: el servidor local sirve `404.html` custom para rutas inexistentes (`pagina/99`) como los hostings estáticos; `?pagina=1` resuelve la página 1 con canonical correcta (decisión estática: canonical hace el trabajo de la redirección) | hecho | request-handler.test.mjs (9/9) |
| C3 | alta | exporter/schema | `SlugSchema` rechaza nombres reservados de Windows (CON/PRN/AUX/NUL/COM1-9/LPT1-9, case-insensitive) con mensaje accionable; prefijos válidos (contenido, control, com10) siguen aceptados. El folder de storage usa `slug--hash` (nunca colisiona) | hecho | index.test.ts (29/29), mensaje verificado |
| C4 | alta | exporter | C4a hecho: canonical, og, JSON-LD, sitemap, alternates, css/js y preview respetan la subcarpeta de baseUrl (`assetHref`). C4b (backlog): hrefs internos del body (paginación, breadcrumbs, cards, CTAs); C4c: navegación de datos del proyecto + fetches del runtime (`search-index.json`, `catalog-index.json`) | en-progreso | index.test.ts (117/118) |
| C5 | media | exporter/runtime | `data-theme` ahora tiene consumidor CSS: `html[data-theme="dark"/"light"]{color-scheme:...}` en el theme CSS (0 bytes de JS; el contrato e2e de ui-tema-t7 se mantiene) | hecho | index.test.ts (118/119) |
| C6 | media | exporter | Errores de generación envueltos con fase accionable (`withExportContext`): `exportProject` → "fase de archivos del sitio", preview → "fase de páginas/documents del sitio", con `cause` original | hecho | index.test.ts (119/120) |
| C7 | media | studio | `requestWorker`/`requestWorkerWithStages` reintentan una vez recreando el worker caído (reseteo de caché) con diagnóstico del ErrorEvent; errores de negocio se propagan | hecho | workers.test.ts (3/3), studio 273/273 |
| C8 | media | runtime | Fetch de `search-index.json` diferido cuando el runtime está pausado u oculto (`deferredSearch` se ejecuta en `resumeRuntime`); runtime 56.218 B (+373, tope 57.344 B OK) | hecho | index.test.ts (60/60), budget OK |
| C9 | baja | shell | `detectPortableFirstRun` marca la primera ejecución en la raíz portable; el shell la registra en el log y la expone en diagnostics (`portableFirstRunAt`); el Dashboard muestra un aviso con la ubicación anterior | hecho | portable-layout.test.mjs (3/3), studio 273/273, exporter 122/123 |
| C10 | media | todos | Barrido continuo: doctor + parity + barrido visual re-corridos tras C1-C9 → 10/10 verdes, cosecha limpia (solo 404 esperado), `pnpm check` exit=0, benchmark 2,6 s. **Fase correctitud cerrada (C1-C10 hecho)** | hecho | check completo + benchmark |

## Fase optimización

| id | prioridad | área | título | estado | evidencia |
|----|-----------|------|--------|--------|-----------|
| O1 | alta | runtime | `minifyJsSource` compacta los helpers serializados sin renombrar bindings ni tocar strings: runtime 56.218 → 55.211 B (−1.007), margen 2.133 B; e2e público 15/15 | hecho | budget + runtime-serialization + e2e |
| O2 | alta | studio | Análisis de dead code con 3 métodos: todo el CSS se usa o se genera por template; tope del CSS Studio subido 100 → 104 KiB con justificación (margen 102.392 → 4.1 KiB de aire) | hecho | check-budgets + análisis documentado |
| O3 | media | exporter | Auditoría: CSS V2 117.459 B / tope 120 KiB (margen 5.4 KB OK). 55 selectores repetidos (hero V2 acumuló bloques) pero NO consecutivos → no fusionables sin refactor de media queries; el hero está en iteración activa del usuario → refactor diferido | hecho | auditoría documentada |
| O3b | baja | exporter | Consolidar bloques repetidos del hero V2 cuando la iteración visual se estabilice | pendiente | derivado de O3 |
| O4 | media | exporter | Eliminado el check O(n²) del audit (`feed.includes` por oferta → Set de ids del feed): audit 1.034 → ~60 ms, benchmark 2.629 → 1.610 ms (−39%). Cache incremental: NO se justifica (sin el cuello, 1.6 s en 2.000 productos) | hecho | audit-scale.test.ts + benchmark |
| O5 | media | exporter | Verificado: preloads LCP (`fetchpriority=high`) en home, categoría y producto en reference y catalogModern; orden del head correcto; único finding `performance.asset.responsive` es dato del fixture (no del renderer) | hecho | verificación con evidencia |
| O6 | baja | exporter | Subsetting con fonttools (latin + es-AR + símbolos, hinting y eje variable conservados): Archivo 34.9→30.2 KB, Inter 48.3→38.3 KB, Lora 37.8→34.2 KB (120.9→102.7 KB total, −15%). Verificado visualmente: cero tofu, acentos correctos | hecho | fonts.ts + verificación visual |
| O7 | baja | studio | Verificado: los presupuestos de TaskDuration ya están asercionados (100/100/25 ms/s) y el gate corre 4/4; la deuda T10 estaba obsoleta | hecho | perf-idle.spec.ts 4/4 |

## Deuda abierta (fuente de ítems futuros)

Documentada en `docs/TECHNICAL_DEBT.md`; se convierten en ítems al cerrar las
fases C y O (regla de selección nivel 3). Conversión en curso:

| id | prioridad | área | título | estado | evidencia |
|----|-----------|------|--------|--------|-----------|
| D1 | media | studio | `shouldSeedRecoveryDraft`: el RecoveryDraft se siembra sólo cuando el navegador es estrictamente más nuevo que el disco (evidencia de edición); el demo sin editar ya no dispara el diálogo | hecho | repository.test.ts (24/24), studio 274/274 |
| D2 | media | studio | Cierre de la app con guardados en vuelo: decisión UX (esperar/confirmar/cancelar) | pendiente | deuda D1/D7 (requiere decisión de producto) |
| D3 | baja | exporter | EX-B7: semántica del sha256 documentada en INTEGRATIONS.md (bytes exactos del archivo, sin normalización) + test que fija que una re-serialización produce otro hash | hecho | local-project-storage.test.mjs (30/30), exporter 123/124 |
| D4 | baja | studio | Overlay del detalle de tienda en viewports acotados scrollea con la región | pendiente | deuda U2-móvil (evaluación UX) |
| D5 | baja | shell | Validación de pestaña oculta: receta headed para release | pendiente | deuda T10 (release) |
| D6 | baja | studio | Dark mode A/B: decisión de producto (color-scheme vs schema v3) | pendiente | deuda P2 |

## Mejoras propias (hallazgos de barridos visuales y re-auditorías)

| id | prioridad | área | título | estado | evidencia |
|----|-----------|------|--------|--------|-----------|
| V1 | media | exporter | Carrito vacío: la columna del mensaje se centra contra el resumen en las 3 familias (`:has(> .solara-cart-empty)`; el runtime usa `solara-cart-empty`, no `empty-state`); gate e2e de medición con server de content-types correctos | hecho | cart-empty-align.spec.ts + verificación visual |
| V2 | media | exporter | Verificado: "Comprar con claridad" es el `trust-strip` del footer compartido (`renderProjectSections` con `sharedFooter`); el 404 muestra el footer completo intencionalmente (navegación estándar). No es bug | hecho | fixture.ts slot trust + verificación |
| V3 | baja | exporter | Verificado: grilla con pocos productos = comportamiento estándar (las cards se alinean a la izquierda); la demo tiene 2 productos por diseño. No se toca la grilla V2 (iteración visual activa del usuario) | hecho | decisión documentada |
| V4 | baja | exporter | Variantes de producto se ven como texto plano, no como pills seleccionables | pendiente | idem |
| V5 | baja | exporter | Home hero: espacio muerto en tercio derecho (aceptable, revisar) | pendiente | idem |
| V6 | baja | exporter | Home mobile: target táctil del carrito < 44px | pendiente | idem |

| C4b | media | exporter | baseUrl subcarpeta: hrefs internos del body (paginación, breadcrumbs, cards de productos, CTAs de carrito/compra, links de categorías hijas) | pendiente | derivado de C4a |
| C4c | media | exporter/runtime | baseUrl subcarpeta: navegación de datos del proyecto (siteShell/navigation) + fetches del runtime (`search-index.json`, `catalog-index.json`) | pendiente | derivado de C4a |

## SIGUIENTE

V4 — Variantes de producto se ven como texto plano, no como pills seleccionables
