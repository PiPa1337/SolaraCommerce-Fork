# Operación local de SolaraCommerce

SolaraCommerce tiene un único runtime operativo: `Abrir SolaraCommerce.cmd` abre
el Studio mediante Node 24 y el navegador del sistema. No existe una distribución
EXE/portable activa ni un segundo almacenamiento comercial.

## Requisitos y arranque

- Windows 10/11 para el launcher `.cmd`.
- Node.js 24.x y Corepack.
- Dependencias instaladas con `corepack pnpm install --frozen-lockfile`.

Desde la raíz del checkout, abrí `Abrir SolaraCommerce.cmd`. El launcher valida
Node/Corepack, recompila el Studio cuando hace falta, inicia el servidor Node en
loopback y abre el navegador. `pnpm dev` sigue disponible para desarrollo, pero
la operación comercial normal usa el launcher.

## Fuente de verdad y layout

`proyectos/` en la raíz del checkout es la única fuente de verdad de las tiendas
confirmadas en disco. Está ignorado por Git porque contiene datos reales; un
clone, pull o backup del repositorio no incluye esas tiendas.

```text
SolaraCommerce/
├── Abrir SolaraCommerce.cmd
├── SolaraCommerce-Agent.cmd
├── proyectos/
│   └── <tienda>--<id>/
└── .solara-runtime/
    ├── logs/
    ├── transactions/
    ├── agent/
    └── instance.json
```

Los proyectos conservan el formato `manifestVersion: 2`, `current.projectPath`,
`.solara.json`, `actual/`, `respaldos/`, `respaldos-manuales/` y `sitios/`.
`.solara-runtime/` contiene estado operativo regenerable, logs, transacciones y
estado del agente; no reemplaza los respaldos de `proyectos/`.

## Copiar o respaldar una instalación

Para respaldar las tiendas, copiá explícitamente la carpeta `proyectos/` con la
aplicación cerrada o sin escrituras en curso. Si querés mover toda la instalación
a otra carpeta/equipo, copiá el checkout y `proyectos/`; luego instalá Node 24,
Corepack y las dependencias en el destino antes de abrir el launcher.

No uses Git como respaldo de las tiendas: `proyectos/` no se versiona. Tampoco
copies `dist/` o `.release/` como si fueran datos comerciales; son salidas
regenerables. Si una operación debe reemplazar `proyectos/`, seguí
[`DATA_STORAGE_SAFETY.md`](DATA_STORAGE_SAFETY.md).

## Agente local

`SolaraCommerce-Agent.cmd` inicia directamente `scripts/agent-cli.mjs` con Node.
El modo predeterminado es JSONL; `SolaraCommerce-Agent.cmd --mcp` selecciona MCP
stdio. `--read-only` y `--scopes=...` siguen disponibles.

El agente usa el mismo `proyectos/` del checkout y las mismas transacciones/locks
que Studio. Sus pruebas deben usar raíces temporales mediante las variables de
entorno soportadas; nunca deben sembrar ni modificar el `proyectos/` comercial.

## Seguridad del layout

`packages/exporter/scripts/local-layout.mjs` y el storage local acotan todas las
rutas a la raíz de aplicación, `proyectos/` y `.solara-runtime/`. Se rechazan
traversal, segmentos reservados de Windows, rutas absolutas y reparse points
(symlinks/junctions) cuando una operación de escritura podría escapar del layout.
Las escrituras atómicas conservan reintentos ante `EPERM`, `EBUSY` y `EACCES`.

Studio sólo accede a persistencia mediante el servidor Node loopback y las rutas
`/__solara/*`. El storefront exportado sigue siendo estático; cuando una función
requiere HTTP local se usa un servidor efímero limitado a la carpeta publicada.

## Diagnóstico

- Si el launcher rechaza la versión de Node, instalá/activá Node 24.x.
- Si una tienda no aparece, revisá `proyectos/<tienda>/manifest.json`, que
  `current.projectPath` sea relativo y que el SHA-256 coincida con el respaldo.
- Si hay un error de permisos, verificá que el checkout y `proyectos/` sean
  escribibles y que no haya una transacción/lock activo.
- Antes de recuperar datos manualmente, conservá una copia completa de
  `proyectos/`; no borres staging de una transacción activa.

## Archivos de implementación

- `Abrir SolaraCommerce.cmd`: entrada operativa de Windows.
- `scripts/open-solara.ps1`: validación de Node/Corepack, build y apertura.
- `packages/exporter/scripts/local-layout.mjs`: layout local y seguridad de paths.
- `packages/exporter/scripts/local-project-storage.mjs`: persistencia confirmada.
- `packages/exporter/scripts/solara-request-handler.mjs`: API local administrada.
- `packages/exporter/scripts/serve.mjs`: servidor Node HTTP loopback.
- `scripts/agent-cli.mjs`: entry Node del agente.
- `scripts/agent-host.mjs`: host JSONL/MCP.
- `packages/exporter/scripts/agent-lock.mjs`: lock cooperativo entre procesos.
- `packages/agent-control/src/index.ts`: operaciones, planes y commit seguro.
- `SolaraCommerce-Agent.cmd`: launcher de automatización local.
