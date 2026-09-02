# Auditoría integral de rendimiento — RM Descartables

Estado: baseline read-only más optimización conservadora verificada. RM
Descartables no fue modificada y no se cambió el schema persistido ni una API
pública.

Fecha del baseline histórico v31: 2026-09-01. La auditoría se puede repetir
con:

```powershell
corepack pnpm audit:performance:rm
```

El reporte machine-readable queda en
`test-results/performance/rm-descartables/report.json` junto con los reportes
por capa (`node.json`, `studio.json`, `storefront.json` y `portable.json`). Esos
archivos son artefactos ignorados y contienen métricas, rutas y tamaños, no el
catálogo, textos completos ni imágenes de RM. Si la versión o el hash de la
fuente cambia, el audit se cancela y se genera un baseline nuevo.

## Alcance y contrato de seguridad

RM Descartables se trató como fixture externo y snapshot de referencia. El
loader lee `manifest.json` y el archivo indicado por
`manifest.current.projectPath`, valida `StoreProjectV2Schema` y calcula SHA-256.
El inventario de la carpeta usa sólo metadatos de archivos (ruta relativa,
tamaño y fecha); no abre el contenido de backups ni de sitios históricos.

El transporte administrado del Studio es un mock con `writable: false`. Todo
POST, PUT u otro método distinto de GET bajo `/__solara/` responde 405 y queda
registrado. El storefront se sirve desde un `Map` en memoria. El portable se
ejecuta en una carpeta temporal que excluye `proyectos/` y `.solara-runtime/`,
y recibe sólo una copia del runtime, el manifest y el current de RM. Las
escrituras observadas del portable ocurrieron únicamente en esa copia temporal
(migración de demo); no son escrituras en la carpeta original.

## Fuente y ambiente — baseline histórico v31

| Campo | Valor |
| --- | --- |
| Proyecto | `store-rm-descartables` / RM Descartables |
| Versión | 31 |
| `manifest.current.projectPath` | `actual/rm-descartables-2026-09-01T05-21-18-588Z-v000031.solara.json` |
| Snapshot | 87.605.343 B |
| SHA-256 del snapshot | `9da9521e1e6fe692c1a42f7cf0fdfe87ba7c1bbb727f1cde6eafb97f00fe5cfa` |
| `savedAt` | `2026-09-01T05:21:18.588Z` |
| `projectUpdatedAt` | `2026-09-01T05:20:39.161Z` |
| Productos / activos / ocultos | 177 / 166 / 11 |
| Variantes / categorías / colecciones | 177 / 6 / 0 |
| Assets / data URLs | 187 / 187 |
| Bytes decodificables estimados de data URLs | 8.909.390 B |
| Design family | `catalog-modern-v2` |
| Node del run | 24.18.0 |
| Browser | Chromium 140.0.7339.16; Electron 37.3.1 en portable |
| Commit reportado | se toma del checkout al ejecutar el harness |

La carpeta completa de RM contiene aproximadamente 609 archivos y
2.912.316.829 B, pero la medición no copia ni procesa los respaldos históricos.
El snapshot actual y su manifest son la única fuente de contenido utilizada.

## Baseline vigente del audit reducido — v32

Durante la validación posterior la fuente cambió externamente antes de la
medición: `manifest.json` pasó de v31 a v32. El guard rechazó la primera corrida
con v31; siguiendo el contrato de seguridad se generó un baseline nuevo sin
modificar RM. El `report.json` vigente corresponde a:

| Campo | Valor |
| --- | --- |
| Versión / `projectPath` | 32 / `actual/rm-descartables-2026-09-01T17-57-19-443Z-v000032.solara.json` |
| Snapshot | 87.603.397 B |
| SHA-256 del snapshot | `0470b97017c871429d3d50a9cf79c9eda76f92f3db1fdd7f2b31d5dee56aa324` |
| `savedAt` / `projectUpdatedAt` | `2026-09-01T17:57:19.443Z` / `2026-09-01T17:56:34.58Z` |
| Productos / activos / ocultos | 177 / 166 / 11 |
| Variantes / categorías / colecciones | 177 / 6 / 0 |
| Assets / data URLs | 187 / 187 |
| Archivos / bytes de carpeta | 610 / 2.999.903.440 B |

Este baseline v32 sirve para verificar la seguridad del código actual, pero no
se usa para afirmar una mejora contra el baseline histórico v31: el contenido
de RM ya no es idéntico.

## Instrumentación

Node/exporter ejecuta una muestra fría y cinco calientes para cada operación:
lectura del manifest y snapshot/hash, parseo JSON, validación Zod, grafo de
assets, auditorías, snapshot comercial, exportación draft/production, preview de
home/categoría/producto/búsqueda/carrito/checkout/contacto y feeds. Registra
mediana, p95, muestras crudas, CPU de `process.resourceUsage`, heap, RSS,
memoria externa y ArrayBuffers.

Studio usa tres contextos aislados en 1440, 768 y 390 px. Mide dashboard,
apertura de RM, lectura de storage, primera apertura y reapertura de tabs,
catálogo, búsqueda, filtros, preview, worker frío/caliente, recargas, long
tasks, `TaskDuration`, `ScriptDuration`, layout, heap, requests y reposo visible
u oculto. El mock read-only verifica que no haya escrituras.

El storefront production se sirve desde un `Map` en memoria. Se recorren las
siete rutas comerciales con JavaScript habilitado y deshabilitado, tres
contextos fríos y tres recargas calientes. Se registran navegación, FCP/LCP,
CLS, tiempo hasta interacción, long tasks, requests, bytes transferidos,
duplicados, `catalog-index.json`, imágenes críticas, `srcset` y lazy loading.
También se comprueba que el índice de variantes coincida con el snapshot.

Portable mide tres arranques fríos y tres calientes, apertura de RM, primer
preview/worker, endpoints `__solara`, métricas CDP y RSS aproximado de procesos.
Compara integridad de la fuente antes y después y elimina sólo la carpeta
temporal creada por ese run.

## Resultados principales

Los números completos, incluidos los arrays de muestras, están en
`report.json`. Node/exporter usa una corrida fría y cinco calientes; Studio,
storefront y portable usan tres corridas frías y tres calientes donde aplica.
El siguiente resumen ordena los consumos observados por el p95 de cada
operación agregada:

| Orden | Capa / operación | Evidencia | Lectura inicial |
| ---: | --- | ---: | --- |
| 1 | Node `export.production` | 25,622 s p95; 48.752.780 B y 577 archivos | Production es el mayor output y tiempo del exporter en este run. |
| 2 | Node `export.draft` | 25,583 s p95; 47.995.430 B y 567 archivos | Draft repite gran parte del grafo público. |
| 3 | Studio `desktop.runtime` | 24,755 s p95 | La apertura incluye transporte administrado, snapshot, preview y render del editor. |
| 4 | Studio `tablet.runtime` | 23,338 s p95 | La latencia permanece en el mismo orden en 768 px. |
| 5 | Studio `mobile.runtime` | 23,336 s p95 | La latencia permanece en el mismo orden en 390 px. |
| 6 | Studio `tablet.export-worker` frío | 22,763 s p95 | El primer worker incluye lectura/clonado, parseo y exportación fuera del hilo UI. |
| 7 | Studio `desktop.export-worker` frío | 21,761 s p95 | Confirma que el worker es un hotspot de primer uso. |
| 8 | Studio `desktop.export-worker` caliente | 21,751 s p95 | El calentamiento no elimina el costo dominante en este snapshot. |
| 9 | Studio `mobile.export-worker` frío | 21,736 s p95 | El costo del worker no depende sólo del viewport. |
| 10 | Portable `preview-and-worker` | 21,545 s p95 | El shell conserva la latencia del flujo inicial de Studio. |

En Node, el mayor CPU registrado corresponde a `export.draft` (25.797 ms) y
`export.production` (25.703 ms); las previews quedan entre 13.000 y 13.109 ms
en la muestra agregada. El mayor RSS observado fue
`audit.optimization-report` con 2.313.080.832 B y 1.542.201.416 B de heap; le
siguen `feeds.commerce-snapshot` con 1.963.896.832 B y las exportaciones con
1.811.562.496 B / 1.807.908.864 B. Son picos de la operación instrumentada,
no una medición de memoria sostenida del proceso completo.

En los recursos, el snapshot es el mayor elemento individual. El `studio-dist`
medido suma 21.696.995 B, con 6.073.900 B de JS y 13.856.774 B de source maps;
los artefactos más grandes son `export.worker` (1.950.246 B), `csv.worker`
(1.134.663 B) y `fixture-data` (1.075.497 B). El storefront production suma
48.677.196 B: 38.336.527 B de imágenes, 8.762.574 B de HTML y 127.074 B de
JavaScript. Los budgets públicos actuales siguen en 62.751 B JS y 7.596 B CSS
para el runtime, con V2 CSS de 212.632 B raw / 27.501 B gzip.

En Studio, el runtime quedó entre 23.336 y 24.755 s p95, con FCP de 72–92 ms,
CLS de 0,0025–0,07559 y 5–6 long tasks que suman 1.320–1.701 ms, con máximos
de 342–357 ms. LCP no fue observado por este instrumento local y queda
pendiente; no se usa para justificar una optimización. Cada runtime registró
80 requests y aproximadamente 266 MB de respuestas del transporte local, por
lo que ese volumen no debe interpretarse como tráfico de red externo.

En storefront, el p95 JS máximo fue 78,973 ms en home y el no-JS máximo fue
106,238 ms. Home transfirió 4.755.761 B, incluidos 4.372.036 B de imágenes;
categoría transfirió 1.561.266 B, incluidos 1.173.217 B de imágenes. Las rutas
registraron 5–23 requests, `catalog-index.json` tuvo 166 entradas y coincidió
con el snapshot (`catalogIndexMatches: true`).

En portable, el arranque caliente alcanzó 2.959 ms p95, `open-rm` 21.159 s y
`preview-and-worker` 21.545 s. La apertura observó 1.028.841.472 B de RSS total
de procesos en la muestra. El reporte conserva los endpoints GET y las
escrituras de migración que ocurrieron sólo en la copia temporal.

## Implementación conservadora (2026-09-01)

Se aplicaron cambios privados y reversibles sobre el renderer compartido y las
rutas internas de lectura, sin cambiar contratos persistidos:

- `packages/exporter`: un contexto de media por ejecución; mapas de productos y
  cache de categorías/alcances; snapshot comercial y feeds sin búsquedas lineales
  repetidas; preview y exportación comparten las mismas decisiones de assets.
- `apps/studio`: el worker de preview conserva el proyecto por revisión y recibe
  luego sólo ruta/operación; el entrypoint pesado usa imports dinámicos; Preview
  conserva como máximo dos resultados por proyecto/ruta y evita duplicar el mapa
  de fuentes; la lectura administrada puede transferir el buffer y evita un
  `JSON.stringify` de 87,6 MB para detectar igualdad.
- `packages/core`: sincronización de categorías/colecciones en un recorrido,
  structural sharing y no-op por referencia; las comparaciones de comandos y del
  carrito ya no serializan JSON completo.
- `packages/storefront-runtime`: comparación semántica de líneas del carrito,
  sin agregar dependencias ni cambiar el contrato de capacidades.

La corrida del benchmark de 2.000 productos pasó de 27,713 s a 26,681 s en el
entorno local (aprox. 3,8%; variación menor al 10% exigido para aceptar una
mejora de la métrica principal). Por eso no se marca el tiempo total del
exporter como hotspot resuelto ni se oculta el rojo de bytes: el output actual
fue 51.527.135 B frente al límite advisory de 50.331.648 B. El resultado se
conserva como evidencia, no como autorización para subir el límite.

Sí hubo mejoras acotadas con guardas propias: el chunk inicial de
`export.worker` quedó liviano y carga exporter/archive por demanda; el runtime
público sigue dentro de sus budgets (63.361 B JS y 7.596 B CSS, frente a 64 KiB
y 8 KiB), y el aumento de JS fue 0,97%, menor al 5% protegido. Determinismo,
paridad, tests focalizados y build permanecen verdes. En el audit reducido v32,
Node midió export draft en 21,943 s p95 y production en 21,909 s p95; Studio
desktop midió 19,307 s y el preview/worker portable 18,162 s. Storefront exportó
48.752.623 B, con `catalogIndexMatches: true`. Node y portable terminaron con
`unchanged: true`; el Studio administrado no registró escrituras y el storefront
se sirvió desde un `Map` en memoria.

No se implementaron cambios de formato del snapshot, migraciones de blobs,
cache global, recomprensión de imágenes, división agresiva del runtime por
capacidad, cambios de retención/backup ni modificaciones de persistencia del
portable: no alcanzaban evidencia suficiente sin ampliar el riesgo.

## Hotspots y backlog seguro

Cada fila conserva evidencia, hipótesis, propuesta, riesgo e invariantes en el
campo `hotspots` del reporte. La clasificación indica el grado de certeza:
`observado` proviene de una medición; `inferido` es una explicación que aún
requiere una prueba antes/después; `pendiente` no debe usarse para justificar
un cambio. Las filas siguientes son el backlog inicial; lo implementado y lo
que quedó sin aceptar se detalla en la sección anterior.

| Prioridad | Estado | Capa | Propuesta | Riesgo e invariantes |
| ---: | --- | --- | --- | --- |
| P0 | observado | Snapshot/assets | Medir por separado metadata y blobs, deduplicación, carga diferida y copias main-thread/worker. | Alto: migración explícita, round-trip V2, recovery, hash de assets y paridad preview/export. |
| P0 | observado | Exporter | Reutilizar índices y snapshot normalizado; evaluar cache por snapshot/ruta. | Alto: determinismo, sitemap, Merchant, feeds y rutas deben coincidir. |
| P0 | observado | Portable/I-O | Diferir lecturas pesadas hasta abrir una tienda y no escanear backups innecesarios. | Alto: no tocar retención; probar manifest/current, recuperación y portable. |
| P1 | observado | Storefront/bytes | Reducir CSS por familia/módulo y revisar preload, `srcset`, lazy loading y bytes críticos. | Medio-alto: no-JS, LCP, CLS, accesibilidad y checkout. Mantener runtime JS ≤64 KiB y CSS ≤8 KiB. |
| P1 | observado | Preview | Comparar cache segura por hash de snapshot y ruta. | Alto: no mostrar ruta/asset viejo; preservar transporte parent y canvas manifest. |
| P1 | observado | Bundles/workers | Mantener fixtures, estilos, fuentes y runtime separados; dividir export/CSV por operación. | Medio-alto: first-use, retry del worker y exports deterministas. |
| P1 | observado | Startup/storage | Medir cada await; paralelizar sólo operaciones independientes y evitar parseo/hash repetido. | Alto: migraciones, IndexedDB, persistencia y recovery no pueden cambiar de orden incorrectamente. |
| P2 | inferido | Memoria/history | Medir clones y snapshots de undo; evaluar structural sharing o patches sólo con benchmark. | Alto: undo/redo, importación, autosave y persistencia atómica. |
| P2 | inferido | Runtime idle | Gatear fetches de búsqueda/carrito, polling y observers por capacidad y visibilidad. | Medio-alto: conservar no-JS, checkout y comportamiento al volver a visible. |
| P2 | pendiente | Telemetría | Resolver LCP no observado y RSS de browser no disponible antes de concluir sobre esos indicadores. | Bajo para la medición; no optimizar basándose en un dato ausente. |

Orden de implementación futuro: una fila por vez, TDD, medición idéntica antes y
después, gates de paridad y rollback si empeoran rendimiento, persistencia,
accesibilidad o determinismo. No se debe subir un límite de budget para ocultar
un rojo.

## Integridad y verificaciones

El harness compara antes/después manifest bytes/hash, versión, `projectPath`,
fechas, snapshot bytes/hash, cantidad de archivos, bytes de carpeta e inventario
metadata-only. En el run válido, la integridad de la fuente es `unchanged: true`.
La copia aislada del portable puede crecer por sus propias migraciones de demo;
esa diferencia queda en `temporaryBefore`/`temporaryAfter` y no se mezcla con la
fuente original.

Verificaciones ejecutadas en esta fase:

El audit reducido vigente se ejecutó con `SOLARA_RM_EXPECTED_VERSION=32`,
`SOLARA_PERF_WARM_RUNS=1`, `SOLARA_PERF_BROWSER_COLD_CONTEXTS=1`,
`SOLARA_PERF_BROWSER_WARM_RELOADS=1`, `SOLARA_PERF_PORTABLE_COLD_RUNS=1` y
`SOLARA_PERF_PORTABLE_WARM_RUNS=1`.

- `corepack pnpm build`: verde.
- `corepack pnpm check:budgets`: verde.
- `corepack pnpm check:repository`: verde.
- `corepack pnpm audit:performance:rm:readonly`: verde.
- `corepack pnpm audit:performance:rm:node`: verde con baseline v32; 1 test,
  una corrida fría y una caliente.
- `corepack pnpm audit:performance:rm:browser`: verde con baseline v32; 2 tests,
  un contexto frío y una recarga caliente por capa.
- `corepack pnpm audit:performance:rm:portable`: verde con baseline v32; 1
  arranque frío y 1 caliente, Electron 37.3.1.
- `corepack pnpm audit:performance:rm:merge`: verde; reportes agregados con
  fuente íntegra.
- `corepack pnpm test:e2e:smoke`: 158/158 verde.
- `corepack pnpm benchmark:export`: rojo por bytes en el run actual
  (51.525.579 B frente a 50.331.648 B); el tiempo observado fue 27,713 s,
  por debajo de 30.000 ms. El límite no se elevó.
- `corepack pnpm benchmark:export:ci`: la repetición final midió 26.681 s;
  el tiempo sigue por debajo de 30 s, pero la mejora frente al baseline no llegó
  al 10% y los bytes siguen advisory-rojos.
- `corepack pnpm check:quick`: el typecheck, image budget, repository y
  hardcoded-content pasaron; `format:check` reportó diagnósticos existentes en
  otros archivos y el test global de exporter tuvo un timeout no controlado de
  Vitest aunque sus pruebas reportaron 308 pasadas y 1 omitida. El harness
  focalizado y sus archivos cambiados pasan Biome.

La validación release con Node 22, `check:quick` y la matriz completa quedan
como deuda separada de CI/release; no se usan para invalidar esta optimización
focalizada. El ambiente utilizado para la medición fue Node 24.18.0.
