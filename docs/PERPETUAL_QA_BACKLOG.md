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
| C1 | alta | exporter | Paridad preview/export diferencial: extender `normalize-parity.test.ts` a categorías paginadas, 404, políticas y búsqueda | pendiente | docs/TESTING.md |
| C2 | alta | exporter | Paginación SEO: `?pagina=1` redirige/rel-canonical; `pagina/99` → 404 real | pendiente | deuda P3 |
| C3 | alta | exporter/schema | `safeSlug` no sanitiza nombres reservados de Windows (CON, NUL, AUX, COM1-9, LPT1-9) → fallos de escritura indiagnosticables | pendiente | deuda abierta |
| C4 | alta | exporter | `baseUrl` en subcarpeta: URLs absolutas de recursos asumen raíz del dominio | pendiente | deuda X1 |
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

## SIGUIENTE

C1 — Paridad preview/export diferencial (normalize-parity.test.ts)
