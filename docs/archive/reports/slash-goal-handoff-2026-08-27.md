# Relevo del slash goal — cierre 2026-08-28

## Estado

El objetivo local quedó **cerrado y verificado**. El release integral todavía no
está certificado porque Node 22, Firefox/WebKit, la matriz OS real y el rollout
real requieren infraestructura o autorización externa. El commit local está
autorizado; no se hará push ni publicación externa en este cierre.

## Pendientes obligatorios para cerrar el objetivo

### P0 — Full E2E verde sin retries — cerrado localmente

El full E2E final pasó **985/988**, con 3 pruebas omitidas por contrato
explícito, 0 fallos, `--retries=0` y 2 workers. El smoke pasó 129/129. El
único bug reproducible fue el foco inicial del diálogo Crear tienda: se corrigió
con foco inmediato y fallback por `requestAnimationFrame`; P4-C2 pasó aislado y
en el full.

Los timeouts de la familia visual a 8/4 workers se reprodujeron como contención
del runner, no como fallo de producto: la familia aislada pasó 53/53 y el full
final a 2 workers quedó verde. Se conservaron las protecciones de Predeterminado,
los contratos V2 y las rutas independientes retiradas.

### P0 — Validación release con Node 22

El host usado para este trabajo sólo tiene Node 24. Node 22 no está instalado,
por lo que no existe evidencia release válida todavía. En un runner Windows con
Node 22 ejecutar y conservar la salida de todos los gates del objetivo,
incluidos `check:full`, `check:runtime-serialization`, `check:budgets`,
`benchmark:export`, `test:e2e:smoke`, `test:e2e`, `test:e2e:release`, build,
desktop/package y los tres gates portable.

La matriz Firefox/WebKit y la certificación release también quedan pendientes
de ese entorno; no se presentan como verificadas por el resultado local.

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

### P1 — Auditoría final de criterios y riesgos — cerrada localmente

Antes de cerrar, volver a comprobar explícitamente contra el objetivo:

- tests nuevos y reparados quedaron cubiertos por las suites focales y el full
  E2E verde, con evidencia identificable en `test-results/nightwatch/`;
- todos los módulos oficiales con bindings o razón documentada;
- fábrica de 20 tiendas completas por JSONL/MCP y ausencia de cambios en
  Predeterminado;
- QA autónomo conectado de extremo a extremo (runner, persistencia, UI,
  `qa.runCycle` y `qa.status`);
- budgets sobre archivos reales, fingerprint reproducible y migraciones con
  `migrationId` real;
- matriz de resiliencia que todavía requiere runner release para la simulación
  OS real de volumen/permisos y reinicio durante rollout;
- disposición del warning de orden de headings en dashboard: Axe no detectó
  violaciones en la auditoría ejecutada; cualquier warning no bloqueante queda
  registrado como riesgo visual;
- warning del bundle inicial JS de Studio, aproximadamente 1.75 MB frente a
  737.280 B, aunque los budgets del storefront pasan.

## Evidencia ya registrada; no repetir sin necesidad

Quedaron registrados como verdes `check:quick` 6/6, smoke directo sin retries,
V2, Live Canvas 12/12, serialización de runtime 4/4 fuera del sandbox, fábrica
aislada, build/empaquetado desktop, smoke portable, E2E portable, agente JSONL,
MCP, JSONL read-only y full E2E 985/988. Los bloqueos externos siguen sin
convertirse artificialmente en evidencia local.

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
