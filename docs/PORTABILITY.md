# SolaraCommerce Portable

SolaraCommerce tiene dos modos de ejecución deliberadamente separados:

| Modo | Entrada | Persistencia | Origen de Studio |
| --- | --- | --- | --- |
| Desarrollo | `pnpm dev` o `Abrir SolaraCommerce.cmd` sin `.exe` | IndexedDB y, con el launcher, `proyectos/` | HTTP loopback |
| Portable | `SolaraCommerce.exe` | `proyectos/` junto al ejecutable y perfil en `.solara-runtime/` | `solara://studio/` |

El modo portable está pensado para copiar una carpeta completa a Windows. No
usa `%APPDATA%`, `%LOCALAPPDATA%`, Node ni pnpm instalados en el equipo. Electron
incluye Chromium y el runtime necesario.

## Layout

```text
SolaraCommerce-Portable/
├── SolaraCommerce.exe
├── Abrir SolaraCommerce.cmd
├── README-PORTABLE.txt
├── proyectos/
│   └── <tienda>--<id>/
└── .solara-runtime/
    ├── electron-user-data/
    ├── logs/
    ├── transactions/
    └── instance.json
```

`proyectos/` es la fuente de verdad de las tiendas confirmadas en disco. El
perfil de Electron contiene IndexedDB, localStorage, caché y Service Workers
del origen portable; no se comparte con Chrome ni con otra copia de la carpeta.
Los archivos confirmados y el formato `LocalProjectManifestV1` siguen siendo
los mismos: `.solara.zip`, `actual/`, `respaldos/`, `respaldos-manuales/` y
`sitios/`.

`instance.json` sólo identifica el formato local y la versión del layout. No
guarda rutas absolutas ni identificadores del equipo.

## Cómo crear la carpeta portable

Desde la raíz del checkout, con Node 22 o posterior y las dependencias
instaladas:

```powershell
corepack pnpm install --frozen-lockfile
corepack pnpm desktop:build
corepack pnpm desktop:package
corepack pnpm portable:smoke
```

El resultado queda en:

```text
.release/portable/SolaraCommerce-Portable/
```

`desktop:package` genera una carpeta `win-unpacked`, la convierte en la carpeta
portable final y copia `proyectos/` si existe en el checkout. `.release/` está
ignorado por Git. `portable:clean` elimina únicamente esa salida generada.

Para distribuirla, copiá o comprimí la carpeta completa. No copies sólo el
`.exe`: `resources/app.asar`, `proyectos/` y `.solara-runtime/` forman una única
instalación.

## Arranque y actualización

Abrí `SolaraCommerce.exe` o `Abrir SolaraCommerce.cmd`. El launcher detecta el
ejecutable adyacente y no intenta iniciar Node. Si el ejecutable no existe,
mantiene el flujo de desarrollo anterior y levanta el servidor HTTP loopback.

Para actualizar una copia portable:

1. cerrá la aplicación;
2. respaldá la carpeta `proyectos/`;
3. reemplazá el `.exe` y `resources/` por los de la nueva distribución;
4. conservá `proyectos/` y `.solara-runtime/electron-user-data/`;
5. iniciá la nueva versión y revisá el estado de las tiendas.

No se migran automáticamente datos del IndexedDB del navegador del sistema.
Para traer una tienda antigua, exportá su `.solara.zip` e importala desde la
instalación portable.

## Protocolo y seguridad

Studio se sirve mediante el esquema privilegiado `solara://studio/`. El proceso
principal de Electron registra el mismo handler que usa `serve.mjs`, por lo que
las rutas `/__solara/session`, `/__solara/storage/*` y `/__solara/shutdown`
mantienen su contrato. No se inicia un puerto HTTP para el editor portable.

El renderer se ejecuta con `contextIsolation` y `nodeIntegration: false`. En la
versión actual `sandbox` queda desactivado de forma deliberada: Electron 37 en
Windows no completa la navegación del protocolo privilegiado `solara://` con el
sandbox activado. El preload sigue exponiendo sólo `solaraDesktop` con acciones
explícitas para estado, cierre, diagnóstico y apertura de un sitio; no expone
filesystem ni APIs Node. Las rutas que llegan al storage se resuelven contra
`proyectos/` o `.solara-runtime/`; se rechazan absolutas, traversal, enlaces
simbólicos y manifests con paths absolutos. Esta excepción está aislada al
shell portable y debe revisarse al actualizar Electron.

Cada copia configura su propio `userData`, `sessionData`, lock de instancia,
logs de Electron y servidor temporal de sitios. La ruta de logs se fija con
`app.setAppLogsPath()` dentro de `.solara-runtime/logs`, para no dejar
diagnósticos en AppData. Dos carpetas diferentes pueden ejecutarse al mismo
tiempo. Una segunda apertura de la misma carpeta enfoca la instancia existente
en lugar de crear otra.

## Sitios exportados

El botón de abrir sitio sigue levantando un servidor HTTP efímero en
`127.0.0.1`, limitado a la carpeta `sitios/<versión>/` de la tienda elegida.
El servidor se cierra al salir de Electron. La carpeta exportada sigue siendo
hosteable directamente en un proveedor estático; abrirla con `file://` no es el
modo soportado para búsqueda, índices o mejoras JavaScript que requieren HTTP.

## Diagnóstico

- Si aparece un error de permisos, mové la carpeta a una ubicación escribible.
  La aplicación no usa un fallback externo.
- Si `portable:smoke` falla, revisá `.solara-runtime/logs/main.log` dentro de la
  copia temporal y ejecutá de nuevo `desktop:package`.
- Si una tienda no aparece, comprobá `proyectos/<tienda>/manifest.json` y que
  `current.archivePath` sea relativo y que su SHA-256 coincida.
- Si necesitás recuperar una copia, conservá toda la carpeta `proyectos/` y los
  `.solara.zip` de `actual/` o `respaldos/`; no borres staging durante una
  transacción activa.

## Archivos de implementación

- `packages/exporter/scripts/portable-layout.mjs`: layout, instancia y paths.
- `packages/exporter/scripts/solara-request-handler.mjs`: API y archivos
  estáticos compartidos por HTTP y Electron.
- `packages/exporter/scripts/serve.mjs`: adaptador Node HTTP de desarrollo.
- `apps/desktop/src/main.mjs`: shell Electron, protocolo, lock y perfil.
- `apps/desktop/src/preload.mjs`: puente mínimo de IPC.
- `apps/desktop/electron-builder.yml`: empaquetado Windows por carpeta.
- `scripts/create-portable-distribution.mjs`: salida portable final.
