# Relevo del slash goal — 2026-08-27

## Estado

El objetivo original sigue **activo y parcial**. No marcarlo como completo ni
presentar el release como certificado. No hay autorización para commit, push,
publicación externa ni rollout sobre tiendas reales en esta sesión.

## Pendientes obligatorios para cerrar el objetivo

### P0 — Full E2E verde sin retries

La suite completa todavía no está verde. La corrida amplia sin retries reprodujo
fallos y se detuvo después de confirmar patrones; el smoke no sustituye al full
E2E.

Reconciliar cada fallo contra el contrato actual y volver a ejecutar la suite
completa con `--retries=0`. Puntos ya observados:

- expectativas históricas que intentan editar `Predeterminado`, que debe seguir
  protegido fuera de un upgrade explícito;
- conteos antiguos del checklist y fixtures de productos/slugs que ya no
  corresponden al contrato V2;
- harnesses que todavía apuntan a `localhost:4173` o usan nombres de tabs/chunks
  anteriores;
- aserciones de nombres de productos, variantes, assets y tiempos bajo carga.

No relajar el contrato de protección ni actualizar snapshots a ciegas. Usar una
tienda mutable para los tests de edición y separar regresiones reales de
expectativas obsoletas.

Primer barrido recomendado, aislado y con un worker:

```text
tests/e2e/editor-builder.spec.ts
tests/e2e/editor-a11y.spec.ts
tests/e2e/editor-shell.spec.ts
tests/e2e/editor-persistence.spec.ts
tests/e2e/preview-cart.spec.ts
tests/e2e/ui-preparar-pr4.spec.ts
```

Después ejecutar el full E2E completo, no sólo los specs reparados.

### P0 — Validación release con Node 22

El host usado para este trabajo sólo tiene Node 24. Node 22 no está instalado,
por lo que no existe evidencia release válida todavía. En un runner Windows con
Node 22 ejecutar y conservar la salida de todos los gates del objetivo,
incluidos `check:full`, `check:runtime-serialization`, `check:budgets`,
`benchmark:export`, `test:e2e:smoke`, `test:e2e`, `test:e2e:release`, build,
desktop/package y los tres gates portable.

La matriz Firefox/WebKit y la certificación release también quedan pendientes
de ese entorno.

### P0 — Rollout real y propagación auditable

La infraestructura, el registro por `migrationId`, el preview/canary y los
tests del controlador están implementados/verificados, pero no se ejecutó un
rollout sobre las tiendas reales del usuario. Sólo hacerlo con autorización
explícita y mediante el canal oficial JSONL/MCP. Registrar por tienda:

- versión base, backup, preview, canary y resultado individual;
- conflictos, auditoría y rollback verificable;
- efecto sobre Predeterminado, tiendas activas, archivadas seleccionadas y
  futuras;
- prueba de que las personalizaciones no se sobrescriben silenciosamente.

No simular este punto editando directamente `IndexedDB`, `proyectos/`, manifests
ni archivos persistidos.

### P1 — Auditoría final de criterios y riesgos

Antes de cerrar, volver a comprobar explícitamente contra el objetivo:

- tests nuevos 5/5 y tests reparados 10/10, con evidencia identificable;
- todos los módulos oficiales con bindings o razón documentada;
- fábrica de 20 tiendas completas por JSONL/MCP y ausencia de cambios en
  Predeterminado;
- QA autónomo conectado de extremo a extremo (runner, persistencia, UI,
  `qa.runCycle` y `qa.status`);
- budgets sobre archivos reales, fingerprint reproducible y migraciones con
  `migrationId` real;
- matriz de resiliencia que todavía requiere runner release para la simulación
  OS real de volumen/permisos y reinicio durante rollout;
- disposición del warning de orden de headings en dashboard (Axe tiene 0
  violaciones `serious`, pero queda un warning `moderate`);
- warning del bundle inicial JS de Studio, aproximadamente 1.75 MB frente a
  737.280 B, aunque los budgets del storefront pasan.

## Evidencia ya registrada; no repetir sin necesidad

Quedaron registrados como verdes los gates focales de `check:quick`, smoke
directo sin retries, V2, Live Canvas, serialización de runtime fuera del
sandbox, fábrica aislada, build/empaquetado desktop, smoke portable, E2E
portable, agente JSONL, MCP y JSONL read-only. Esto no cubre los tres bloqueos
anteriores ni convierte el full E2E en verde.

## Reglas de relevo

- Preservar el worktree compartido y los cambios existentes; no usar `reset`,
  `clean`, checkout destructivo ni stash global.
- No tocar `dist/`, `.release/`, `proyectos/`, `.solara-runtime/` ni reportes
  generados para un commit.
- No crear un renderer alternativo, JSON Patch arbitrario, HTML/JS inyectado ni
  canal shell para IA.
- Al cerrar, actualizar este reporte, la documentación/changelog si cambió el
  comportamiento y entregar un reporte separado en implementado, verificado,
  fallido, flaky, bloqueado, no ejecutado, riesgos, métricas, rollouts, gates,
  Git y portable.
