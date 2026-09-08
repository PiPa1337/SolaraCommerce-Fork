# Transporte de sub-agents nativos de Codex

La colaboración de sub-agents vive fuera del agente de tiendas local. El contrato
en `scripts/codex-collaboration.ts` mantiene separados el transporte nativo, el
provisioning del worktree y la ejecución de la tarea.

## Pre-validación

`preflightTransport` corre antes de `backend.launch`. Sólo acepta el par
`provider=codex` y `backend=native`, con payload plaintext o encrypted. Cualquier
otro proveedor/backend lanza `NATIVE_BACKEND_REQUIRED`, no invoca el backend y
entrega una acción correctiva explícita. No existe fallback ni adapter externo.

## Provisioning

El backend puede devolver `threadId` directamente o un `clientThreadId` temporal.
En el segundo caso `waitForExecutableThread` consulta el estado con timeout y
backoff acotados. Los estados `pending`, `failed` y `timeout` quedan diferenciados
en el reporte; ningún follow-up se envía hasta tener un `threadId` ejecutable.

## Smoke real

`corepack pnpm test:codex-subagent-smoke` es opt-in: requiere que el runtime de
Codex inyecte `globalThis.__SOLARA_CODEX_SMOKE__` o que
`SOLARA_CODEX_SMOKE_MODULE` apunte a un módulo que exponga ese objeto, con el
backend nativo real, modelo, checkout y encoding usados. El backend debe ejecutar únicamente el
equivalente read-only de `scripts/site-optimizer-check.test.ts` y devolver
`executed=true`, `readOnly=true`, `check="site-optimizer"` y el resumen de
fixtures. Sin esa inyección el test falla como `Delegación no ejecutada`; no se
convierte en un falso positivo ni usa `scripts/optimization-baseline.test.ts`,
que genera artefactos.
