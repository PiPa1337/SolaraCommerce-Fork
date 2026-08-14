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
| C5 | media | exporter/runtime | `data-theme` en `<html>` exportado sin consumidor CSS/JS | pendiente | deuda T15 |
| C6 | media | exporter | Errores de export accionables: envolver fallos de buildPages/buildFiles con ruta y contexto | pendiente | doctor C0 |
| C7 | media | studio | `requestWorker` sin reintento: si el worker muere, reintento con backoff y diagnóstico | pendiente | deuda abierta |
| C8 | media | runtime | Fetch de boot de `search-index.json` no gateado por la pausa `solara-pause` | pendiente | deuda abierta |
| C9 | baja | shell | Verificación de raíz portable ausente al arrancar (mover `.exe` recrea `proyectos/` sin aviso) | pendiente | deuda abierta |
| C10 | media | todos | Barrido continuo: hallazgos del doctor/e2e/visuales (se alimenta solo) | pendiente | proceso |

## Fase optimización

| id | prioridad | área | título | estado | evidencia |
|----|-----------|------|--------|--------|-----------|
| O1 | alta | runtime | Compactar runtime serializado (`parseCart`, `reconcileCartLines`, `levenshtein`, `normalizeSearchTokens`) sin romper contrato del bundle | pendiente | 55.845 B / tope 56 KiB |
| O2 | alta | studio | Compactar CSS del Studio | pendiente | ~99.2 KiB / tope 100 KiB |
| O3 | media | exporter | Auditar `styles.ts` del storefront (+8.1 %: 75 → 81 KB) | pendiente | deuda |
| O4 | media | exporter | Pases duplicados del export (`auditProject` vs `buildOptimizationReport`); cache incremental solo si el benchmark lo justifica (medir primero) | pendiente | HANDOFF |
| O5 | media | exporter | Prioridad de carga: preloads reales de LCP, orden de `<head>`, bajar findings `performance.*` | pendiente | site-optimizer |
| O6 | baja | exporter | Subsetting de fuentes self-host (~34.9 KB/familia) | pendiente | deuda |
| O7 | baja | studio | Recalibrar umbrales `perf-idle` sobre TaskDuration (hoy sobre ScriptDuration) | pendiente | deuda T10 |

## Deuda abierta (fuente de ítems futuros)

Documentada en `docs/TECHNICAL_DEBT.md`; se convierten en ítems al cerrar las
fases C y O (regla de selección nivel 3).

## Mejoras propias (hallazgos de barridos visuales y re-auditorías)

(se llena desde los barridos de Playwright/vision y del doctor)

## Mejoras propias (hallazgos de barridos visuales y re-auditorías)

| id | prioridad | área | título | estado | evidencia |
|----|-----------|------|--------|--------|-----------|
| V1 | media | exporter | Carrito vacío: mensaje y resumen desalineados verticalmente en desktop | pendiente | `_qa/2026-08-14-barrido-1/vision-report.md` |
| V2 | media | exporter | Sección "Comprar con claridad" aparece bajo la página 404 (¿layout global o bug?) | pendiente | idem |
| V3 | baja | exporter | Colección con pocos productos: espacio vacío masivo a la derecha | pendiente | idem |
| V4 | baja | exporter | Variantes de producto se ven como texto plano, no como pills seleccionables | pendiente | idem |
| V5 | baja | exporter | Home hero: espacio muerto en tercio derecho (aceptable, revisar) | pendiente | idem |
| V6 | baja | exporter | Home mobile: target táctil del carrito < 44px | pendiente | idem |

| C4b | media | exporter | baseUrl subcarpeta: hrefs internos del body (paginación, breadcrumbs, cards de productos, CTAs de carrito/compra, links de categorías hijas) | pendiente | derivado de C4a |
| C4c | media | exporter/runtime | baseUrl subcarpeta: navegación de datos del proyecto (siteShell/navigation) + fetches del runtime (`search-index.json`, `catalog-index.json`) | pendiente | derivado de C4a |

## SIGUIENTE

C5 — `data-theme` inerte: conectar consumidor o eliminar (deuda T15)
