# Reporte de fábrica autónoma

Fecha: 2026-08-27. Estado: verificado por `store-factory.test.ts`.

La prueba `packages/agent-control/src/store-factory.test.ts` crea 20 tiendas
mediante `plans.create` → `plans.get` → `plans.commit` → `stores.get` y exporta
cada snapshot. Verifica IDs independientes, archivos no vacíos, ausencia de
críticos inesperados y que la plantilla no cambia.

El CLI `corepack pnpm qa:factory 20` pasa con el loader ESM local y el
transformador nativo de Node 24; no agrega dependencias de runtime.

El flujo portable del agente también pasó JSONL sobre el EXE real y confirmó
que la base protegida no admite mutaciones. Las matrices de 250–500 y 2.000
productos del mandato todavía no se ejecutaron como lote completo.
