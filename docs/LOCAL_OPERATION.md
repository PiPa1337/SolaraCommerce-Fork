# Operación local de SolaraCommerce

SolaraCommerce tiene un único runtime operativo basado en Node 24, servidor
loopback y navegador del sistema. Se puede iniciar con `Abrir SolaraCommerce.cmd`
o, como alternativa, con el tray liviano `Abrir SolaraCommerce.exe`; ambos usan
el mismo servidor, el mismo `proyectos/` y el mismo almacenamiento comercial.
El EXE no es una distribución portable ni empaqueta el Studio.

## Requisitos y arranque

- Windows 10/11 para los launchers `.cmd` y tray `.exe`.
- Node.js 24.x y Corepack.
- Dependencias instaladas con `corepack pnpm install --frozen-lockfile`.

Desde la raíz del checkout, abrí `Abrir SolaraCommerce.cmd`. El launcher valida
Node/Corepack, recompila el Studio cuando hace falta, inicia el servidor Node en
loopback y abre el navegador. `pnpm dev` sigue disponible para desarrollo, pero
la operación comercial normal usa el launcher.

El tray se genera con `corepack pnpm build:tray` y queda como
`Abrir SolaraCommerce.exe` en la raíz, ignorado por Git. Al abrirlo crea un único
icono por checkout. Su menú contextual muestra la cantidad de sesiones activas,
permite abrir una nueva, abrir o cerrar una sesión concreta, reiniciar la
aplicación o salir. `Reiniciar aplicación` cierra las sesiones gestionadas de
forma autenticada en segundo plano y un auxiliar espera la salida completa del
tray anterior antes de tomar el mutex y volver a levantar la misma cantidad; el
cierre sólo reutiliza un puerto cuando quedó realmente libre. Al iniciar una
sesión nueva, el launcher recompila el Studio si detecta fuentes más recientes,
conserva logs del servidor en `.solara-runtime/logs/` y abre las URLs resultantes.
`Salir` sólo termina cuando todas las sesiones gestionadas pudieron cerrarse. El
tray refresca el registro periódicamente y también detecta sesiones que ya
estaban abiertas antes de iniciarlo.

## Biblioteca de tiendas

El dashboard adapta la cantidad de tiendas por página al espacio disponible:
en escritorio, la grilla muestra 12 a la vez en 1366×768, 1440×900 y 1920×950.
Los controles inferiores permiten avanzar, retroceder o ir a una página concreta.
Buscar, ordenar y filtrar consultan todas las tiendas y vuelven a la primera página;
las fijadas aparecen primero y se pueden comparar tiendas de páginas distintas.

En móvil, seleccionar una tienda reemplaza la biblioteca por su detalle. `Cerrar detalle`
devuelve a la biblioteca; `Ver detalle` permite volver a la selección. La ilustración
decorativa es SVG local y estática. No requiere servicios externos ni modifica tiendas.

La cobertura `tests/e2e/dashboard-gargantua.spec.ts` usa IndexedDB aislado y un
servidor administrado de solo lectura; nunca siembra fixtures en `proyectos/`.

## Fuente de verdad y layout

`proyectos/` en la raíz del checkout es la única fuente de verdad de las tiendas
confirmadas en disco. Está ignorado por Git porque contiene datos reales; un
clone, pull o backup del repositorio no incluye esas tiendas.

```text
SolaraCommerce/
├── Abrir SolaraCommerce.cmd
├── Abrir SolaraCommerce.exe        # generado por build:tray
├── SolaraCommerce-Agent.cmd
├── proyectos/
│   └── <tienda>--<id>/
└── .solara-runtime/
    ├── logs/
    ├── transactions/
    ├── agent/
    ├── instances/
    │   └── <sessionId>.json
    └── instance.json
```

Los proyectos conservan el formato `manifestVersion: 2`, `current.projectPath`,
`.solara.json`, `actual/`, `respaldos/`, `respaldos-manuales/` y `sitios/`.
`.solara-runtime/` contiene estado operativo regenerable, logs, transacciones y
estado del agente; también conserva `gravity-preferences.json`, la configuración
personal del fondo de Gargantua. No reemplaza los respaldos de `proyectos/`.
`instances/`
mantiene un registro efímero por sesión activa. `instance.json` conserva sólo
metadata del layout local y no se usa como autoridad para cerrar procesos.

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
- Si falta `Abrir SolaraCommerce.exe`, ejecutá `corepack pnpm build:tray`.
- `corepack pnpm test:tray` recompila el tray y prueba detección previa,
  múltiples sesiones, cierre individual/total, registros inválidos, identidad
  exacta de sesión, fallo seguro de shutdown y el límite de ocho puertos usando
  exclusivamente raíces temporales.
- Si una tienda no aparece, revisá `proyectos/<tienda>/manifest.json`, que
  `current.projectPath` sea relativo y que el SHA-256 coincida con el respaldo.
- Si hay un error de permisos, verificá que el checkout y `proyectos/` sean
  escribibles y que no haya una transacción/lock activo.
- Antes de recuperar datos manualmente, conservá una copia completa de
  `proyectos/`; no borres staging de una transacción activa.

## Archivos de implementación

- `Abrir SolaraCommerce.cmd`: launcher clásico de Windows.
- `Abrir SolaraCommerce.exe`: tray opcional generado, sin empaquetado del Studio.
- `scripts/open-solara.ps1`: validación de Node/Corepack, build, selección de
  puerto y creación/reutilización de sesiones.
- `scripts/tray/SolaraCommerceTray.cs`: menú del tray, descubrimiento y cierre.
- `scripts/build-tray.ps1`: compilación WinForms con .NET Framework y el icono
  existente del Studio.
- `scripts/tray-smoke.mjs`: smoke aislado de sesiones y seguridad del tray.
- `packages/exporter/scripts/local-layout.mjs`: layout local y seguridad de paths.
- `packages/exporter/scripts/session-registry.mjs`: registro efímero por sesión.
- `packages/exporter/scripts/local-project-storage.mjs`: persistencia confirmada.
- `packages/exporter/scripts/solara-request-handler.mjs`: API local administrada.
- `packages/exporter/scripts/serve.mjs`: servidor Node HTTP loopback.
- `scripts/agent-cli.mjs`: entry Node del agente.
- `scripts/agent-host.mjs`: host JSONL/MCP.
- `packages/exporter/scripts/agent-lock.mjs`: lock cooperativo entre procesos.
- `packages/agent-control/src/index.ts`: operaciones, planes y commit seguro.
- `SolaraCommerce-Agent.cmd`: launcher de automatización local.
