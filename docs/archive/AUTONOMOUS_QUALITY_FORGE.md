# Autonomous Quality Forge

Fábrica de tiendas por el canal oficial + QA visual/chaos automatizado.

## Evidencia de cierre parcial (2026-08-27)

Pasaron `check:quick` (6/6), el smoke directo sin retries (129/129), Live Canvas
(2/2), `desktop:build`, `desktop:package`, `portable:smoke`,
`test:e2e:portable`, `test:e2e:portable:agent`, `test:e2e:portable:new-store`,
MCP real (`initialize/tools/list/tools/call`) y JSONL `--read-only`. La fábrica
aislada verificó 20 tiendas por Vitest y el benchmark de exportación de 2.000
productos pasó con 48.892.403 B, sin relajar el límite de 48 MiB.

No se certifica aún como release completo: la matriz release Node 24.x no se ha
ejecutado completa, el full E2E tiene fallos fuera del smoke y el rollout global
con entidades persistidas requiere una corrida autorizada sobre tiendas reales.

## Fábrica de tiendas

`scripts/store-factory.mjs` define la matriz de creación usando **sólo** el canal nativo
(`plans.create` → `plans.get` → `plans.commit` → auditoría del receipt).
Matriz determinista: 8 rubros × 3 tamaños (6/30/120 productos) × 5 paletas.
Verificaciones por tienda: IDs independientes, export draft sin críticos
inesperados, versión de plantilla de la base sin cambios. Reporte JSON en
`docs/reports/agent-store-factory.json` (regenerable).
El test ejecutable es `packages/agent-control/src/store-factory.test.ts` y el
CLI `corepack pnpm qa:factory 20` pasa con el loader local de TypeScript.

## QA visual

`tests/e2e/quality-forge-visual.spec.ts`: 7 viewports (1920→320) sin overflow,
5 paletas oficiales con acento aplicado, reduced motion efectivo, HTML útil sin
JavaScript. La suite E2E completa aún no se certifica porque contiene specs
históricos desalineados con la plantilla protegida y los fixtures actuales.

## Seguridad del canvas

`apps/studio/src/features/canvas/canvas-security.test.ts` y
`canvasBridge.test.ts`: spoofing, sesión obsoleta, nonce inválido/reutilizado,
editId fuera de manifest, payload enorme y XSS — rechazados por el mismo
contrato de validación que corre en el Preview.

## Persistencia (preexistente, verificado)

`redteam-persist.test.mjs`: VERSION_CONFLICT entre beginSave y commit, nunca
reemplazar un sitio válido por uno incompleto, operación atómica sin respaldo
huérfano. `request-handler.test.mjs`: locks, EPERM transitorio con reintento.
