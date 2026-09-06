# Futura eliminación de portable

> **COMPLETADO / HISTÓRICO (06/09/2026):** este archivo conserva el plan y la
> evidencia de la migración ya terminada. La operación vigente usa
> `Abrir SolaraCommerce.cmd` y el `proyectos/` raíz como única fuente comercial;
> `.release/` es sólo salida regenerable. No ejecutar nuevamente las fases de
> migración descritas aquí salvo una nueva decisión explícita.

## Master Plan corregido

El objetivo es migrar completamente la información de SolaraCommerce Portable a la aplicación normal iniciada mediante `Abrir SolaraCommerce.cmd`, verificar junto con el usuario que no falte absolutamente nada y que todo funcione, y eliminar la portable únicamente como una fase final independiente y después de autorización explícita.

## Fase 0 — Criterio de éxito

“No perder nada” significa conservar:

- proyectos actuales;
- todas las versiones y respaldos;
- respaldos manuales;
- assets;
- sitios exportados;
- `lastValidSite`;
- drafts recuperables;
- historial original de cada instalación;
- runtime portable como evidencia archivada;
- evidencia verificable de qué se migró y a dónde.

No necesitamos trasladar caches, locks, transacciones vencidas o estado temporal como datos activos.

### Estado real auditado al 5 de septiembre de 2026

La auditoría de lectura realizada sobre el estado actual encontró seis carpetas administradas en la portable:

| Carpeta portable | projectId |
|---|---|
| `demo-catalogo-jerarquico--ecb19169` | `store-modo-sur-demo` |
| `qa-post-package--dc2244b2` | `store-qa-post-package` |
| `qa-verif-sentinels--93267b1a` | `store-qa-verif-sentinels` |
| `qa-verif-whatsapp--cc62fc7c` | `store-qa-verif-whatsapp` |
| `rm-descartables--704e2877` | `store-rm-descartables` |
| `stylo-lashes--eb03b464` | `store-stylo-lashes` |

Además existen dos fuentes relevantes fuera de esas seis carpetas:

- el `proyectos/` normal contiene una rama administrada de Stylo Lashes con el mismo `projectId`, pero con historia y estado divergentes;
- `temporalstylolashes/` contiene `stylo-lashes.solara.json`, validado como evidencia separada de Stylo Lashes.

Por lo tanto Stylo Lashes debe tratarse como un conflicto de tres fuentes/evidencias: portable administrada, normal administrada y archivo temporal. El 5 de septiembre de 2026 el usuario resolvió el conflicto: **la versión de la portable será la activa**; la rama normal y `temporalstylolashes/` se conservarán completas como archivo/evidencia.

Tamaños observados en esta auditoría:

- portable `proyectos/`: aproximadamente **9,02 GiB**;
- portable `.solara-runtime/`: aproximadamente **443,31 MiB**;
- normal `proyectos/`: aproximadamente **36,54 MiB**;
- `temporalstylolashes/`: aproximadamente **15,63 MiB**.

El auditor actualmente informa **0 errores de fuente** y **0 IDs duplicados sin resolver**. La decisión de Stylo ya está registrada en `futuraeliminaciondeportable-decisions.json`: la versión activa será la de la portable; las copias normal y `temporalstylolashes` quedan preservadas como evidencia archivada. La demo protegida también queda archivada completa. En la auditoría actual sólo siguen bloqueando los RecoveryDrafts que requieren revisión en Studio y, mientras esté abierta, la instancia administrada normal.

## Fase 1 — Congelamiento inicial

Cerrar completamente:

- SolaraCommerce portable;
- `Abrir SolaraCommerce.cmd`;
- servidor local;
- agentes;
- procesos Electron relacionados.

No se modifica todavía ninguna tienda.

## Fase 2 — Comprobación de espacio previa

Antes de continuar, el migrador calcula cuánto espacio adicional necesita realmente en cada volumen. Con el diseño actual se presupuestan por separado:

- en `A:` dos snapshots comprimidos + todos los destinos de archivo + margen temporal;
- en `C:` staging activo + rollback del `proyectos/` normal + margen temporal.

Si no existe espacio suficiente con margen de seguridad, la operación no empieza.

La medición real actual usa una relación de compresión de **0,744432**, obtenida sobre un respaldo grande representativo de RM Descartables. Es decir, la compresión ahorró aproximadamente un 25,6 %; no alcanza para resolver por sí sola el problema de espacio.

Modelo medido actual:

| Concepto conocido hoy | Bytes | Aproximado |
|---|---:|---:|
| Fuentes incluidas en snapshot | 10.199.951.482 | 9,50 GiB |
| Un snapshot comprimido estimado | 7.593.170.282 | 7,07 GiB |
| Dos snapshots comprimidos | 15.186.340.564 | 14,14 GiB |
| Staging activo | 9.662.150.927 | 9,00 GiB |
| Rollback | 38.319.723 | 36,54 MiB |
| Evidencia destinada a archivo | 537.799.518 | 512,89 MiB |
| Dos snapshots + archivos + margen en `A:` | 17.871.623.730 | **16,64 GiB requeridos** |
| Espacio libre observado en `A:` | — | **821,00 GiB** |
| Staging + rollback + margen en `C:` | 11.847.954.298 | **11,03 GiB requeridos** |
| Espacio libre observado en `C:` | — | **14,99 GiB** |

Esta medición corresponde a las fuentes de filesystem que el auditor puede medir hoy y todavía no suma una eventual copia cruda de IndexedDB normal ni una nueva evidencia surgida de RecoveryDraft. Antes del primer snapshot se identifica y mide ese estado adicional; el cálculo se vuelve a ejecutar con su tamaño real. Los números de la tabla son por lo tanto un piso medido, no una autorización permanente.

Con los snapshots en `A:` el espacio no es un bloqueo para las fuentes actualmente medidas. El espacio libre es variable, así que este cálculo se repite justo antes de cada fase que cree copias. El procedimiento falla cerrado si cualquiera de los dos volúmenes deja de cumplir su margen de seguridad.

## Fase 3 — Snapshot original verdaderamente protegido

Sólo después de aprobar la Fase 2 crear:

`00-ORIGINAL-INMUTABLE`

Debe contener copia exacta de:

- portable `proyectos/`;
- portable `.solara-runtime/`;
- repo `proyectos/`;
- `temporalstylolashes/` y cualquier otra evidencia externa ya identificada;
- el estado persistente del navegador normal perteneciente a SolaraCommerce, incluyendo la evidencia de la base Dexie `solara-commerce-studio`/IndexedDB y sus RecoveryDrafts.

La evidencia de IndexedDB se captura con el navegador completamente cerrado y se conserva como copia cruda de solo lectura. No se abre, repara, compacta ni escribe esa copia. Si no puede aislarse de forma segura el almacenamiento perteneciente al origen de SolaraCommerce, esta fase queda bloqueada hasta disponer de un método de exportación/copia verificable; no se abre Studio normal primero y se asume que el estado previo seguirá igual.

Además:

- inventario completo de archivos;
- tamaño;
- SHA-256;
- ruta relativa;
- fecha;
- cantidad total de archivos.

Esta copia se guarda fuera de `.release`.

Debe existir al menos una copia verificable en una ubicación distinta del árbol regenerable del proyecto. Se verificó que la unidad `A:` (`NVME SSD`) dispone de aproximadamente **821 GiB libres** y se adopta como destino previsto de los snapshots. El auditor trata el espacio de snapshots y el espacio local de staging/rollback como presupuestos separados.

Después de copiar cada snapshot se vuelve a generar el inventario en el destino y se comparan los SHA-256 antes de considerarlo válido.

El objetivo de este primer snapshot es poder volver al estado anterior incluso si la posterior revisión mediante Studio transforma un RecoveryDraft o provoca una migración legítima de IndexedDB.

## Fase 4 — Resolver RecoveryDrafts

Abrimos una instalación por vez.

Primero portable.

Revisamos cada `RecoveryDraft` mediante Studio:

- recuperar;
- guardar;
- descartar conscientemente;
- o preservar por separado si existe duda.

Después hacemos lo mismo en la aplicación normal.

No intentaremos interpretar manualmente archivos internos de IndexedDB.

Los RecoveryDrafts de Electron portable y del navegador usado por la aplicación normal son estados separados. Cada instalación debe revisarse por separado. Si alguna vez se automatiza su inspección, sólo se hará de forma de solo lectura sobre una copia del perfil/base de datos, nunca modificando el IndexedDB original a mano.

Este punto es un gate obligatorio, no una revisión opcional. El arranque administrado actual carga primero los proyectos de disco y luego inspecciona IndexedDB. Si encuentra un proyecto del navegador que no existe en disco puede volver a persistirlo; si encuentra una versión divergente con `updatedAt` igual o posterior puede crear un `RecoveryDraft`. Por eso una copia vieja de Stylo en el navegador normal podría reaparecer después del cutover si no se resuelve antes.

Antes de crear `01-FUENTE-DEFINITIVA` se debe cumplir todo lo siguiente:

- revisar los RecoveryDrafts de la portable desde Studio;
- revisar los RecoveryDrafts y proyectos persistidos en IndexedDB de la aplicación normal desde Studio;
- resolver específicamente cualquier estado de Stylo que pueda competir con la versión portable elegida como activa;
- no borrar ni editar IndexedDB a mano;
- si un draft/proyecto del navegador contiene información que no está representada por una fuente ya inventariada, preservarlo mediante un flujo oficial/exportación y registrarlo como una fuente de evidencia adicional con inventario, hashes, decisión y destino propios antes de continuar;
- recién cuando esa revisión esté cerrada marcar `recoveryDraftsReviewed: true` en el archivo de decisiones y volver a ejecutar la auditoría.

Si aparece una nueva evidencia independiente durante esta revisión, la migración se detiene hasta incorporarla al baseline definitivo. No se permite continuar con una fuente conocida fuera del ledger.

## Fase 5 — Fuente definitiva

Una vez resueltos los drafts:

`01-FUENTE-DEFINITIVA`

Se vuelve a crear:

- snapshot;
- inventario;
- hashes.

Desde ese instante la portable queda congelada y no vuelve a utilizarse para editar.

Ésta será la fuente oficial de la migración.

El snapshot definitivo debe incluir también cualquier evidencia independiente surgida de la revisión de RecoveryDrafts. El baseline no queda cerrado hasta que el conjunto de fuentes descubiertas, evidencias exportadas y runtime portable coincida exactamente con el ledger que se verificará al final.

## Fase 6 — Auditoría automática previa

Crear el migrador/auditor, por ejemplo:

`scripts/migrate-portable-to-development.mjs`

Con modo:

`--audit`

Comando de auditoría usado con la relación de compresión medida:

```powershell
node scripts/migrate-portable-to-development.mjs --audit --decisions futuraeliminaciondeportable-decisions.json --snapshot-root A:\ --compression-ratio 0.744432
```

Ese comando sirve para el preflight de lectura. Cuando las fuentes y RecoveryDrafts ya estén cerrados y se vaya a crear el baseline que alimentará la verificación final, se ejecuta obligatoriamente una auditoría completa con hashes de todos los archivos:

```powershell
node scripts/migrate-portable-to-development.mjs --audit --hash-all --decisions futuraeliminaciondeportable-decisions.json --snapshot-root A:\ --compression-ratio 0.744432 --output auditoria-definitiva.json
```

`auditoria-definitiva.json` es el único baseline aceptable para `--verify`. El propio verificador rechaza un inventario heredado que no tenga SHA-256 completos; una auditoría rápida sin `--hash-all` nunca se reutiliza como baseline final.

La herramienta está diseñada deliberadamente como no destructiva: en sus modos actuales audita y verifica; no copia, mueve ni elimina la portable.

Debe verificar:

- manifests;
- `manifestVersion`;
- `current.projectPath`;
- SHA-256 actual;
- archivos inexistentes;
- rutas relativas;
- enlaces/junctions;
- `lastValidSite`;
- versiones;
- backups;
- backups manuales;
- assets;
- sitios;
- IDs;
- projectIds duplicados;
- RecoveryDrafts pendientes;
- espacio disponible.

Si existe una inconsistencia inexplicable, la migración se detiene antes del staging.

`lastValidSite` requiere una comprobación especial: los campos `files` y `bytes` del manifest describen el payload registrado originalmente y pueden diferir de la carpeta física si hubo postprocesado posterior. Esa diferencia se registra como deriva histórica y advertencia, no como corrupción automática. Para la migración sin pérdida, el árbol físico completo se conserva y se hashea por separado.

El registro normal `.solara-runtime/server.json` puede contener BOM y también puede quedar obsoleto. Un PID/puerto guardado nunca autoriza a matar un proceso por sí solo: se verifica que el PID exista y que el endpoint administrado responda antes de considerarlo un servidor activo.

## Fase 7 — Ledger de migración

Generamos una tabla explícita para cada carpeta encontrada:

| Fuente | projectId | Tipo | Destino | Acción inicial |
|---|---|---|---|---|
| portable RM Descartables | `store-rm-descartables` | comercial | activo | migrar completo |
| portable Demo | `store-modo-sur-demo` | demo protegida | archivo | **preservar completa** |
| portable QA post-package | `store-qa-post-package` | QA | archivo | preservar |
| portable QA sentinels | `store-qa-verif-sentinels` | QA | archivo | preservar |
| portable QA WhatsApp | `store-qa-verif-whatsapp` | QA | archivo | preservar |
| portable Stylo | `store-stylo-lashes` | conflicto resuelto | activo | **migrar completo como versión activa** |
| normal Stylo | `store-stylo-lashes` | historia alternativa | archivo | **preservar completa** |
| `temporalstylolashes/` | `store-stylo-lashes` | evidencia | archivo | **preservar completa** |
| runtime portable `.solara-runtime/` | — | evidencia de runtime | archivo | **preservar completo, nunca activar** |

Nada puede quedar fuera del ledger.

Contrato del ledger definitivo:

- cada fuente/evidencia descubierta debe aparecer exactamente una vez;
- cada entrada debe resolver exactamente una acción final (`migrate-active` o `archive`) y un destino explícito;
- el runtime portable es evidencia archivada y forma parte de la verificación, aunque no sea una tienda;
- una evidencia nueva surgida de RecoveryDraft/IndexedDB se agrega antes de cerrar el baseline;
- una decisión para una fuente que no exista en el baseline es un error;
- una fuente del baseline sin destino es un error;
- ningún archivo histórico se descarta para resolver un conflicto.

Así podemos demostrar posteriormente que una carpeta fue archivada deliberadamente y no olvidada.

## Fase 8 — Clasificación

Clasificamos:

- tiendas comerciales;
- tiendas QA;
- fixtures;
- demo protegida;
- tiendas conflictivas.

“Preservar todo” seguirá siendo obligatorio.

Pero preservar algo no obliga a mostrarlo como tienda activa en el dashboard.

## Fase 9 — Resolver Stylo Lashes — RESUELTA

Las tres fuentes/evidencias de Stylo son:

1. historial administrado de la portable;
2. historial administrado del `proyectos/` normal;
3. `temporalstylolashes/stylo-lashes.solara.json` como evidencia separada.

Compararemos:

- proyecto actual;
- versiones;
- fechas;
- catálogo;
- productos;
- categorías;
- precios;
- contenido;
- configuración;
- SEO;
- WhatsApp;
- assets;
- respaldos;
- sitios;
- `lastValidSite`;
- hashes;
- RecoveryDraft correspondiente.

Decisión registrada: `portable:stylo-lashes--eb03b464` será la tienda activa con el `projectId` original `store-stylo-lashes`.

`normal:stylo-lashes` y `temporal-stylo:temporalstylolashes` se preservarán exactamente como archivo/evidencia y seguirán figurando en el ledger. No se fusionarán manualmente con la rama activa.

Si también querés editarla en Studio, se creará después un clon oficial con un `projectId` nuevo. Su historia antigua seguirá conservada en el archivo original.

## Fase 10 — Staging aislado

Crear algo como:

`.migration-staging/proyectos/`

Todavía no se toca `proyectos/` real.

Ahí se construye el futuro almacenamiento completo.

## Fase 11 — Migración sin conflictos

Para cada tienda seleccionada como activa, copiar íntegramente:

- `manifest.json`;
- `actual/`;
- `respaldos/`;
- `respaldos-manuales/`;
- `sitios/`;
- assets y metadatos asociados.

Después verificar cada archivo copiado por SHA-256.

## Fase 12 — Validación semántica

Además de hashes, abrir cada proyecto mediante los mismos parsers/schema usados por SolaraCommerce.

Debe pasar:

- `StoreProjectV2Schema`;
- lectura del manifest;
- relación manifest/current;
- SHA actual;
- assets referenciados;
- backups relevantes;
- sitio válido;
- `lastValidSite`.

También se realiza comparación estructural del proyecto migrado contra su fuente.

Para `lastValidSite` se validan por separado el significado histórico del manifest y el árbol físico heredado. La conservación byte a byte del árbol físico es obligatoria aunque los contadores históricos del manifest no coincidan con archivos agregados por postprocesado.

## Fase 13 — Verificación del staging completo

El staging sólo puede avanzar si produce:

- cero archivos fuente inexplicablemente ausentes;
- cero hashes heredados incorrectos;
- cero manifests inválidos;
- cero proyectos inválidos;
- cero IDs activos duplicados;
- cero drafts inesperados;
- ledger 100 % resuelto;
- runtime portable con destino de archivo verificable;
- cero fuentes/evidencias conocidas fuera del baseline.

## Fase 14 — Preparar el nuevo contrato de datos

Antes de convertir el repo en almacenamiento comercial real, debemos eliminar la contradicción arquitectónica actual.

Actualizar posteriormente como parte de esta migración:

- `AGENTS.md`;
- documentación;
- scripts que consideran `proyectos/` una zona descartable;
- packaging;
- protección frente a limpiezas;
- comportamiento de tests.

Los tests y agentes no podrán volver a considerar `proyectos/` real como área temporal.

## Fase 15 — Protección del almacenamiento normal

Debemos revisar si conviene mantener los datos reales exactamente dentro del repo o hacer que `Abrir SolaraCommerce.cmd` use un directorio dedicado.

Si permanecen en:

`SolaraCommerce/proyectos/`

se agregan salvaguardas explícitas para impedir:

- limpiezas automáticas;
- uso por fixtures;
- sobrescrituras de tests;
- operaciones peligrosas de packaging.

**Decisión implementada:** las tiendas reales permanecerán en
`SolaraCommerce/proyectos/`, porque es el almacenamiento que ya usa
`Abrir SolaraCommerce.cmd` y permite un cutover por rename en el mismo volumen.
El contrato dejó de tratar esa carpeta como zona de pruebas; el modo administrado
ya no ejecuta la purga histórica de tiendas de IndexedDB, el packaging mantiene
separado el almacenamiento normal y el staging conserva el marcador
`proyectos/LEEME.md`. Tests y fixtures deben usar ubicaciones temporales.

## Fase 16 — Cutover transaccional

Con ambas aplicaciones cerradas:

1. verificar nuevamente staging;
2. renombrar `proyectos/` actual a rollback;
3. renombrar staging a `proyectos/`;
4. validar inmediatamente;
5. si falla cualquier punto, restaurar automáticamente el anterior.

El staging y destino deben estar en el mismo volumen para aprovechar el rename de forma segura.

También evitaremos que sincronización de Drive interfiera durante este punto crítico.

Antes del cutover real se prueba este mecanismo sobre una fixture: se induce un fallo después del rename y se verifica que el destino anterior vuelva a quedar restaurado y que el staging no se pierda.

## Fase 17 — Primer arranque normal

Abrimos exclusivamente:

`Abrir SolaraCommerce.cmd`

Este arranque sólo se permite después de cerrar la Fase 4 y confirmar `recoveryDraftsReviewed: true`. Como defensa adicional, se toma un inventario del `proyectos/` recién migrado inmediatamente antes de arrancar y otro después de cargar el dashboard. Si aparece una tienda, RecoveryDraft o escritura inesperada atribuible a estado viejo del navegador, se aborta la aceptación del cutover y se usa el rollback; no se normaliza ni descarta esa diferencia silenciosamente.

Verificamos:

- servidor;
- almacenamiento administrado;
- dashboard;
- número esperado de tiendas;
- nombres;
- estados de recuperación;
- ausencia de conflictos inesperados.

## Fase 18 — Nuestra primera verificación

Vos y yo revisamos una por una las tiendas comerciales.

En cada una:

- productos;
- categorías;
- variantes;
- precios;
- imágenes;
- identidad;
- páginas;
- textos;
- diseño;
- SEO;
- WhatsApp;
- configuraciones;
- Preview;
- sitio exportado.

Después hacemos una pequeña modificación controlada y guardamos.

Comprobamos:

- nueva versión;
- nuevo hash;
- respaldo creado;
- manifest actualizado;
- persistencia en disco.

## Fase 19 — Cierre y reapertura

Cerrar completamente la app.

Volver a abrirla.

Confirmar que cada tienda sigue exactamente como quedó.

Esto evita aceptar un estado que sólo existía en memoria.

## Fase 20 — Segunda verificación independiente

Hacemos nuevamente:

- lectura;
- guardado controlado;
- backup manual si corresponde;
- Preview;
- exportación;
- apertura del sitio generado.

Idealmente también después de reiniciar Windows.

## Fase 21 — Auditoría final

Ejecutar:

`--verify`

Forma prevista:

```powershell
node scripts/migrate-portable-to-development.mjs --verify --baseline <auditoria-definitiva.json> --decisions <decisiones.json>
```

El verificador debe entender que ahora existen dos tipos de archivos:

- archivos heredados obligatorios;
- archivos nuevos creados durante nuestra verificación.

Por eso no comparará ingenuamente árboles completos.

Debe comprobar que todo lo heredado sigue presente e intacto, permitiendo únicamente adiciones esperadas.

La verificación final recorre el ledger completo del baseline, no sólo las entradas escritas manualmente en el archivo de decisiones. Eso incluye tiendas activas, tiendas archivadas, evidencias y `.solara-runtime` portable. Una fuente sin destino, una decisión desconocida o una evidencia del baseline no verificada hacen fallar el cierre.

## Fase 22 — Estado de seguridad

La portable sigue existiendo, pero congelada.

Conservamos además:

- `00-ORIGINAL-INMUTABLE`;
- `01-FUENTE-DEFINITIVA`;
- ledger;
- inventarios;
- hashes;
- auditorías;
- rollback.

En este momento ya trabajamos exclusivamente con la aplicación normal.

## Fase 23 — Aprobación conjunta

Yo reviso los resultados automáticos.

Vos revisás las tiendas desde Studio.

Sólo si ambos controles coinciden consideramos completada la migración.

## Fase 24 — Autorización para eliminación

La eliminación no ocurre automáticamente.

Se presentará un resumen equivalente a:

> Migración verificada.  
> N/N fuentes y evidencias descubiertas contabilizadas dinámicamente.  
> 0 archivos heredados faltantes.  
> 0 hashes incorrectos.  
> 0 proyectos inválidos.  
> 0 conflictos pendientes.  
> Backups externos verificados.

Recién entonces el usuario decide si quiere eliminar la portable.

## Fase 25 — Eliminación final

Con autorización explícita se elimina:

`.release/portable/SolaraCommerce-Portable/`

No se toca:

- `proyectos/` nuevo;
- snapshots;
- ledger;
- evidencia;
- backups externos.

Después se vuelve a ejecutar una última comprobación de la aplicación normal.

## Regla principal

Borrar la portable no forma parte de la migración. Es una operación final independiente que sólo se habilita después de haber demostrado que todo fue migrado y verificado.

## Estado final del plan — COMPLETADO 06/09/2026

La migración quedó cerrada. La aplicación operativa es la que se inicia con
`Abrir SolaraCommerce.cmd` desde la raíz de SolaraCommerce y `proyectos/` es la
fuente de verdad comercial.

Resultados finales:

- RecoveryDraft/IndexedDB revisado desde copias aisladas de Chrome y Edge: 0
  RecoveryDrafts pendientes.
- snapshots `00-ORIGINAL-INMUTABLE` y `01-FUENTE-DEFINITIVA` conservados durante
  toda la migración y verificación final;
- ledger definitivo: 9/9 entradas verificadas, 2380/2380 archivos heredados
  comprobados;
- 3 tiendas activas y semánticamente sanas: Predeterminado protegida
  (`store-modo-sur-demo`, v9), RM Descartables (`store-rm-descartables`, v63) y
  Stylo Lashes portable (`store-stylo-lashes`, v5);
- 6 fuentes históricas fueron archivadas y verificadas durante el cutover: 3 QA,
  Stylo normal anterior, `temporalstylolashes` y `.solara-runtime` portable;
- la corrección de Predeterminado quedó incorporada al archivo de decisiones:
  permanece activa y además conserva su copia histórica;
- el usuario verificó manualmente que la versión por CMD funciona correctamente;
- después de esa aprobación, `.release/` fue eliminada por el usuario;
- la auditoría final posterior a la eliminación de `.release/` devolvió
  `ok: true` para las 9 entradas antes de la limpieza de los archivos temporales;
- se cerró y reabrió el servidor administrado: volvió con un PID nuevo y enumeró
  exactamente las 3 tiendas activas, todas `synced`, con `siteOutdated: false` y
  sus `index.html` vigentes presentes en disco;
- la prueba focal del migrador pasó 22/22 casos con Vitest.
- después de verificar manualmente la aplicación y las tres tiendas, el usuario
  eliminó `.migration-archive/`, `.migration-staging/`,
  `.migration-preflight.json` y `temporalstylolashes/` como limpieza final.

No queda ninguna fase pendiente de migración ni de eliminación de la portable.
`.release/` es desde ahora salida regenerable. Los archivos temporales de
migración ya fueron retirados y no forman parte del funcionamiento normal de
Studio; `proyectos/` es la única fuente de verdad comercial activa.
