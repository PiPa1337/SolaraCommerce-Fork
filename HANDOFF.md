# Handoff de SolaraCommerce

## Estado al entregar

SolaraCommerce es un estudio local-first que permite crear tiendas desde la
plantilla Catalog Modern, editar identidad, contenido, productos, categorías,
assets, tema y SEO, revisar un preview y exportar una tienda estática. La demo
`Predeterminado` usa el catálogo ficticio determinista; la plantilla limpia no
copia sus productos.

La aplicación funciona sin backend remoto. Cuando se abre con
`Abrir SolaraCommerce.cmd`, el servidor loopback guarda versiones en
`proyectos/`; IndexedDB queda como borrador de recuperación y caché. El
respaldo `.solara.json` se puede volver a importar y la carpeta pública puede
servirse en un hosting estático. El pedido se deriva a WhatsApp.

## Funcionalidades terminadas

- workspace pnpm con TypeScript estricto, Vite, Vitest, Biome y Playwright;
- schema Zod v2 con productos, variantes, categorías jerárquicas, colecciones,
  páginas, navegación, assets y templates comerciales;
- reducer de comandos, undo/redo, importación/exportación CSV y fixture de
  rendimiento;
- módulos legacy y familia Catalog Modern con renderer compartido;
- preview responsive y exportación HTML/CSS/JS a carpeta;
- SEO inicial, JSON-LD, sitemap, image/video sitemap, Merchant y contexto IA
  opcional;
- carrito local, selección de variantes y pedido determinista por WhatsApp;
- dashboard, flujo guiado, catálogo, constructor, tema, assets, SEO y export;
- guardado local versionado y transaccional mediante el servidor loopback.

## Incompleto o fuera de alcance

- no hay backend remoto, pagos online, colaboración, sincronización cloud ni
  publicación automática;
- la aprobación de Merchant con checkout sólo por WhatsApp debe verificarse en
  el dominio real;
- los fallos de escritura se simulan de forma determinista (writeGuard) y la
  matriz de reparse points corre en Vitest; la matriz OS real (disco lleno,
  permisos revocados a nivel de volumen) queda como job de release;
- release multi-browser y Lighthouse dependen de Node 22 y navegadores
  instalados; no se ejecutan necesariamente en cada cambio local;
- la deuda documentada en [`docs/TECHNICAL_DEBT.md`](docs/TECHNICAL_DEBT.md)
  se resolvió en su mayoría (ver "Resolución de deuda técnica"); quedan
  pendientes decisiones de producto y matrices de release.

## Decisiones que no deben romperse

1. `StoreProjectV2Schema` y `schemaVersion: 2` son el contrato persistido.
2. Preview y sitio público llaman al mismo renderer de `@solara/exporter`.
3. `productIds` derivados se recalculan desde comandos/helpers, no a mano en UI.
4. Precios en centavos enteros; nunca floats comerciales.
5. Assets y proyectos son datos no confiables: validar, escapar y deduplicar.
6. Los módulos no compilan código del usuario en el navegador.
7. `proyectos/` no se versiona en Git y el servicio sólo escucha loopback.
8. Los cambios de schema requieren migración y pruebas de round-trip.

## Archivos modificados durante este handoff

- `AGENTS.md`: guía operativa para futuras IAs y reglas de entrega.
- `README.md`: instalación, variables, comandos, arquitectura y troubleshooting.
- `docs/ARCHITECTURE.md`: capas y flujos con diagramas.
- `docs/DATA_MODEL.md`: entidades, relaciones y versionado.
- `docs/INTEGRATIONS.md`: API local e integraciones del storefront.
- `docs/PROJECT_MAP.md`: rutas de extensión por funcionalidad.
- `docs/TESTING.md`: niveles de verificación y flujos críticos.
- `docs/TECHNICAL_DEBT.md`: riesgos observados sin refactor riesgoso.
- `docs/backup-and-recovery.md`: autoridad de disco frente a recovery de IDB.
- `.env.example`: variables opcionales documentadas sin secretos.
- archivos fuente principales: comentarios de módulo y TSDoc de los flujos
  complejos, workers y servicios, sin cambiar lógica.

## Validaciones realizadas

Se ejecutaron con resultado exitoso:

- `corepack pnpm check`: scan de repository, formato, typecheck, tests de todos
  los paquetes y optimizer (22 project-schema, 23 core, 6 module-sdk, 6
  storefront-runtime, 6 site-optimizer, 16 modules, 57 exporter y 1 omitido en
  Windows, 42 Studio, 3 Desktop y 4 del optimizer en 2 archivos).
- `corepack pnpm build`: TypeScript y build Vite de Studio.
- `corepack pnpm test:e2e`: 38 tests Chromium pasaron y 1 prueba visual opcional
  fue omitida por no definir `VISUAL_REVIEW_STAGE`.
- `corepack pnpm benchmark:export`: 1.000 productos en 891 ms, 998 archivos,
  25.693.443 bytes de sitio sin empaquetado (carpeta directa).
- `corepack pnpm check:budgets` (bytes crudos): Studio JS ≤ 700 KiB y CSS
  ≤ 100 KiB (CSS medido ~98.6 KiB); runtime público JS ≤ 52 KiB (medido
  50.094 B, ~48.9 KiB) y CSS ≤ 8 KiB (medido 7.486 B, ~7.3 KiB);
  storefront.js ≤ 52 KiB y storefront.css ≤ 780 KiB (storefront.css
  deduplicado ~75 KiB).
- `corepack pnpm pilot:preflight`: fixture de referencia, 27 páginas y 3
  ofertas.
- `corepack pnpm check:repository`, `corepack pnpm format:check` y
  `git diff --check` sin errores.

`corepack pnpm test:e2e:release` fue intentado y no se ejecutó porque el script
exige Node 22 y este entorno tiene Node 24.18.0. La matriz Firefox/WebKit y
Lighthouse quedan por confirmar en CI/Node 22.

## Errores y riesgos observados

- El entorno local puede tener Node 24 aunque CI/release fija Node 22.
- La carpeta `proyectos/` y reportes locales son deliberadamente ignorados.
- Los fallos de escritura se simulan de forma determinista (writeGuard); la
  matriz OS real (disco lleno/permisos a nivel de volumen) queda como job de
  release.
- Un conflicto de guardado entre pestañas devuelve 409 y no se combina solo.

## Próximos pasos recomendados

1. Ejecutar el ciclo real del launcher en un perfil limpio y confirmar recuperar
   `Predeterminado` desde `proyectos/`.
2. Ejecutar la matriz OS real (disco lleno y permisos a nivel de volumen) como
   job Windows de release antes de volver a cambiar el servicio de disco.
3. Probar release con Node 22, Firefox, WebKit y Lighthouse.
4. Medir exportación de 1.000 productos antes de introducir cache incremental.
5. Si se necesita cloud, diseñar una capa nueva sin convertirla en requisito del
   storefront estático.

## Lectura sugerida para la siguiente IA

1. `AGENTS.md`.
2. `README.md` y `docs/PROJECT_MAP.md`.
3. `docs/ARCHITECTURE.md` y `docs/DATA_MODEL.md`.
4. El documento específico del cambio y sus tests.
5. `docs/TECHNICAL_DEBT.md` sólo para riesgos relevantes al trabajo.

## Runtime de testimonios exportados (2026-08-11)

La fila de testimonios de Catalog Modern conserva su fallback horizontal sin
JavaScript y ahora conecta `data-testimonials-prev` y
`data-testimonials-next` en el runtime público. Los botones avanzan o
retroceden una ventana de la fila y conservan el fallback horizontal cuando no
hay JavaScript. La regresión E2E usa el viewport móvil y activa ambos controles
mediante teclado. El presupuesto crudo del runtime se ajustó a 53 KiB para
incluir este comportamiento sin agregar dependencias.

## Cobertura condicional auditada (2026-08-11)

La segunda pasada de la auditoría agregó regresiones E2E para estados que no
aparecen en el recorrido inicial: el dropzone de Recursos comunica su estado
activo y vuelve a un estado limpio; el aviso de cuota alta permite limpiar la
caché regenerable y anuncia el resultado; SEO verifica la preview de WhatsApp y
la primera ruta del crawler; Preview verifica su toolbar mediante teclado además
del flujo con mouse. El sweep dedicado de Recursos quedó en 9/9, el de SEO en
12/12 y el de Preview en 9/9. Estos tests cubren feedback y datos visibles, pero
no sustituyen una prueba con lector de pantalla real.

## Auditoría del error de Exportar (2026-08-11)

La regresión dedicada `bugfix-audit-failure.spec.ts` cubre el fallo del worker
de auditoría de Exportar: el panel muestra el error, mantiene Producción
deshabilitada, deja disponible `Reintentar auditoría` y, al restaurar la carga,
verifica que la nueva tentativa complete la auditoría y habilite Producción.
Se retiró un test duplicado agregado durante esta pasada para conservar una
única fuente de evidencia sin cambiar la lógica de producción.

El inventario estático restante corresponde a salidas estructurales o estados
transitorios (`ui-dashboard-health`, `ui-seo-check-group`, `ui-preview-loading`,
`ui-toggle`, además de inputs cubiertos por locators semánticos). Los estados
dinámicos `ui-seo-audit-loading` y `ui-seo-audit-error` ahora tienen un recorrido
E2E estable en A21.3b; el mismo seam cubre el error de Preview y la recuperación
de su iframe en A20. La prueba desactiva sólo el service worker y aborta el
chunk del renderer, sin interceptar recursos del producto durante el flujo normal.

## Acciones masivas del catálogo (2026-08-11)

La pasada adicional de Catálogo cubre las acciones de asignar categorías,
colecciones y tags a una selección de productos. A02 verifica el efecto visible
en la tabla, confirma las asignaciones en el editor de producto y comprueba que
un producto no seleccionado conserve su categoría, colección y tags. El mismo
recorrido usa la selección por teclado para abrir el editor y mantiene el
contrato de `@solara/core`, que recalcula `productIds` derivados.
El editor individual también tiene una regresión de round-trip para sus
checkboxes de organización y el campo de tags en A04.

El campo de tags vacío ya no falla en silencio: `Agregar tags` y `Quitar tags`
anuncian un error inline y no generan cambios pendientes. No se modificó la
forma de `catalogScaleStore`; la corrección sólo agrega validación de UI y
regresión E2E sobre la demo determinista de 50 productos.

## Selectores visibles de importación (2026-08-11)

El barrido A03 ya no inyecta CSV o carpetas directamente en los inputs ocultos:
los helpers pulsan `Importar CSV` e `Importar carpeta + imágenes`, verifican el
contrato de `filechooser` y luego recorren la misma importación que usa la UI.
La cobertura conserva revisión, progreso, cancelación, errores, imágenes
faltantes y reimportación. El barrido A17 verifica de forma equivalente que
`Cargar imágenes` y `Cargar video` expongan sus formatos aceptados, selección
múltiple y nombres accesibles.

Resultado del checkpoint: A03 10/10 y A17 11/11 en Chromium. No se modificó la
lógica de producción ni el fixture determinista `catalogScaleStore`.

## Fecha de disponibilidad para preventas (2026-08-11)

El schema ya aceptaba `Variant.availabilityDate` y el exporter lo utilizaba
para `availabilityStarts` y `g:availability_date`, pero ProductEditor no tenía
un control para resolver el crítico de Merchant cuando `stockStatus` era
`preorder`. Ahora el editor muestra un campo de fecha contextual (también si
ya existe una fecha para permitir corregirla), serializa el día como
`T00:00:00.000Z` y conserva el valor en el round-trip de guardado.

No se cambió `schemaVersion` ni la forma de `catalogScaleStore`.

## Ruta inexistente en Preview (2026-08-11)

`renderPreviewHtml` conserva el renderer compartido y, cuando la ruta escrita
en el toolbar no coincide con una página, selecciona el descriptor existente
de tipo `not-found`. El export público no cambia: sólo se evita que el Preview
presente Home como respuesta de una URL inexistente. A20 comprueba título y
mensaje 404 dentro del iframe.

## Aviso de actualización de plantilla (2026-08-11)

A09 también cubre el botón `Cerrar aviso de actualización` del flujo Preparar.
El cierre es una acción de interfaz de sesión: oculta el panel y sus acciones,
pero mantiene `origin.templateVersion` sin cambios y no dispara el respaldo ni
la adopción de la plantilla. La acción de adopción sigue cubierta por el
recorrido que descarga el respaldo previo y persiste la versión nueva.

## Copia de IDs de recursos (2026-08-11)

A17 cubre el botón `Copiar ID` que aparece en cada recurso. La prueba reemplaza
el clipboard del contexto por un receptor determinista, comprueba que se escribe
el ID persistido (`asset-hero`) y verifica el feedback accesible `Copiado de
Campaña Modo Sur`. Las pruebas de carga y reemplazo siguen usando el clipboard
real sólo cuando no necesitan leerlo.

## Aviso global del Studio (2026-08-11)

El flujo A21.9 de conflicto de persistencia también cubre el botón `Cerrar
aviso` del banner global de Studio. Después de conservar el borrador, la prueba
lo cierra y confirma que el indicador continúa en error y que `Reintentar` sigue
disponible; cerrar el aviso no altera el estado de persistencia.

## Portabilidad Windows

La distribución portable está implementada en `apps/desktop`. Electron carga
Studio desde `solara://studio/`, con `contextIsolation` y `nodeIntegration: false`.
Electron 37 en Windows no completa la navegación de este protocolo con sandbox
activado, por lo que el shell lo deja desactivado de forma explícita y debe
revisarse al actualizar Electron. El proceso principal configura `userData` y `sessionData` dentro de
`.solara-runtime/`, usa un lock por carpeta y llama al mismo handler de requests
que el servidor HTTP de desarrollo. `proyectos/` continúa siendo la autoridad
de disco y no se cambió `StoreProjectV2`, `schemaVersion` ni `.solara.zip`.

Los nuevos puntos de extensión son:

- `packages/exporter/scripts/portable-layout.mjs`: paths, instance.json y
  validación de rutas relativas;
- `packages/exporter/scripts/solara-request-handler.mjs`: API y archivos
  estáticos compartidos por HTTP/Electron;
- `apps/desktop/src/main.mjs` y `preload.mjs`: shell, protocolo, IPC mínimo y
  rutas locales de perfil/logs;
- `apps/desktop/electron-builder.yml`: distribución `win-unpacked`;
- `scripts/create-portable-distribution.mjs`, `portable-smoke.mjs` y
  `portable-e2e.mjs`: salida y verificación de carpeta copiable.

Ver [`docs/PORTABILITY.md`](docs/PORTABILITY.md) antes de modificar el shell.

En este cambio se verificaron `desktop:build`, `desktop:package`,
`portable:smoke`, `test:e2e:portable` y cuatro tests unitarios de portabilidad
(rutas con espacios/Unicode, paridad HTTP/protocolo, rechazo de manifests con
paths absolutos y recuperación ante límites/interrupción de guardado). El E2E
Electron comprueba diagnósticos dentro de la raíz, guarda una tienda en una
copia, sirve el sitio público sin permitir traversal, confirma el aislamiento
de la segunda, reabre desde disco y valida el traslado de la carpeta.

## Eliminación de ZIP (2026-08-07)

El producto ya no usa ZIP ni gzip en ningún flujo. El trabajo se cerró en ocho
tareas (spec `docs/superpowers/specs/2026-08-07-eliminar-zip-design.md` y plan
`docs/superpowers/plans/2026-08-07-eliminar-zip.md`):

1. Storage local V2: el respaldo editable es `.solara.json` (envelope
   `{ format, version: 2, projectId, exportedAt, project }`, imágenes como
   data URLs) y el sitio se sube como mapa de archivos JSON que el servidor
   escribe directo en `sitios/<versión>/` (sin descompresión; manifest V2 con
   `current.projectPath`).
2. Migración única: `packages/exporter/scripts/legacy-zip-migration.mjs`
   convierte una sola vez los `.solara.zip` existentes (marca idempotente en
   `.solara-runtime/migration.json`; los ZIP viejos se conservan en
   `respaldos/`). Este módulo y la dependencia `fflate` son temporales: se
   eliminan en un release posterior.
3. Exporter sin ZIP: `exportProject` devuelve `{ files, audit, optimization }`.
4. Transporte de Studio en JSON (`.solara.json`, MIME
   `application/vnd.solara.project+json`).
5. Importación de catálogo por carpeta (`webkitdirectory` con `productos.csv`
   e `imagenes/`).
6. Budgets en bytes crudos (sin gzip): Studio JS ≤ 700 KiB, CSS ≤ 100 KiB,
   storefront.js ≤ 52 KiB, storefront.css ≤ 780 KiB, runtime JS ≤ 52 KiB,
   CSS ≤ 8 KiB (medidos 589,7 / 68,8 / 41,5 / 634,1 / 41,5 / 6,6 KiB).
7. Gate anti-ZIP: `check:repository` falla si reaparecen `fflate`, `zipSync`,
   `unzipSync`, `gzipSync`, `.solara.zip` o `site.zip` en fuentes (sólo exime
   al módulo de migración, su test y el propio gate).
8. Documentación actualizada y gate completo verde: `check`, `build`,
   `check:budgets`, `benchmark:export` y `test:e2e` (38 Chromium, 1 opcional
   omitida).

Publicar un sitio = copiar `proyectos/<tienda>/sitios/<versión>/` a un hosting
estático; no existe descarga de ZIP. `SOLARA_PILOT_PROJECT_ARCHIVE` apunta a un
`.solara.json`; `reference:export` y `pilot:export` escriben carpetas.
`StoreProjectV2Schema` y `schemaVersion: 2` no cambiaron.

## Resolución de deuda técnica (2026-08-07)

Cierre del plan [`docs/superpowers/plans/2026-08-07-deuda-tecnica.md`](docs/superpowers/plans/2026-08-07-deuda-tecnica.md).
La Task 1 (extracción streaming de ZIP) quedó resuelta por la eliminación de
ZIP; las 11 tasks de implementación y sus verificaciones:

1. **Fallos de escritura deterministas** (Task 2): opción `writeGuard` del
   storage local (sólo tests) con ops `write-upload`, `write-site-files`,
   `rename-site`, `copy-archive`, `write-manifest`, `remove-old-current`;
   cubre disco lleno, permisos revocados y reintento tras fallo transitorio.
2. **Matriz de reparse points** (Task 3): `reparse-points.test.mjs` fija el
   rechazo de junctions Windows y symlinks POSIX dentro de `proyectos/`.
3. **Diagnóstico de recovery persistido** (Task 4): sidecar `recovery.json`
   por carpeta con mensajes estables entre listados; las carpetas sanas lo
   eliminan. Fix posterior: sidecars huérfanos sin manifest se descartan.
4. **Endpoint `open-folder`** (Task 5): `POST
   /__solara/storage/projects/{projectId}/open-folder` abre la carpeta en
   Explorer en Windows (en otras plataformas confirma la ruta); botón
   "Abrir carpeta" en el Dashboard.
5. **Sentinel de migración** (Task 6): tabla `migrations` de Dexie con
   `status: "pending" | "done"` por proyecto; la migración a disco es
   idempotente ante interrupciones.
6. **Registro de módulos tipado** (Task 7): `ModuleId`, `ModuleById` y
   `getTypedModule(id)` sin romper el registry runtime heterogéneo.
7. **Budgets de fixtures** (Task 8): `fixture-budget.test.ts` registra la
   medición `catalogModernStore` 56.3 KiB, `catalogScaleStore` 46.5 KiB y
   `referenceStore` 8.7 KiB; se conservan los data URLs por decisión.
8. **Split de Builder** (Task 9): inspector y editores por responsabilidad.
9. **Split de Catalog** (Task 10): toolbar y árbol de categorías; fix de la
   paginación en catálogos vacíos.
10. **Split de Dashboard** (Task 11): tarjeta y toolbar.
11. **Split de styles.css** (Task 12): cuatro `@import` (base, cosmic,
    editorial, feedback) con cascada idéntica y bundle byte-idéntico.

**Gate completo (cierre):** `check`, `build`, `check:budgets`,
`benchmark:export` y `test:e2e` (Chromium) pasaron juntos. Budgets en bytes
crudos: Studio JS ≤ 700 KiB y CSS ≤ 100 KiB; storefront.js ≤ 52 KiB y
storefront.css ≤ 780 KiB; runtime JS ≤ 52 KiB y CSS ≤ 8 KiB.

**Pendientes documentados** en `docs/TECHNICAL_DEBT.md`: matriz OS real
(disco lleno/permisos a nivel de volumen) como job de release, release con
Node 22 (Firefox/WebKit/Lighthouse), aprobación Merchant con checkout por
WhatsApp, publicación manual y la migración temporal `legacy-zip-migration.mjs`
con `fflate`, que se elimina en un release posterior.

## Editor UI/UX (2026-08-07)

Sesión completa del plan
[`docs/superpowers/plans/2026-08-07-editor-uiux.md`](docs/superpowers/plans/2026-08-07-editor-uiux.md)
(olas 0-4). El editor ganó un sistema de componentes (`Ui.tsx` +
`components/primitives.tsx` + `ConfirmDialog` + `Toast`, tokens `--ui-*`,
galería `/__studio/components`), un dashboard con micro-interacciones, atajos,
pinned, comparación y respaldo masivo, un shell con tabs ARIA, guardado con
estados animados, preview con rutas/zoom, paneles persistidos, modo foco, dark
mode y barra de estado, y flujos con validación accionable (Preparar, Resumen,
Catálogo, ProductEditor, Builder, Tema, Recursos, SEO, Exportar). Motion del
editor con reduced-motion global; 13 specs E2E nuevos y 122 tests verdes en
Chromium. Se cerraron también los últimos `window.confirm` (archivar tienda,
archivar productos, reubicar categoría, recuperar/descartar borrador y salir
sin guardar) con `ConfirmDialog`, los usos de assets incluyen slides/posters de
secciones, el reemplazo de imágenes muestra progreso honesto y el checklist
post-export permite abrir el sitio con el lanzador.

**Decisión de budgets:** el techo de CSS de Studio subió de 84 a 96 y luego a
100 KiB crudos el mismo día (medido ~98.6 KiB; `check-budgets.mjs` documenta
la razón); JS inicial se mantiene en ≤ 700 KiB. Nada cambió en
`StoreProjectV2Schema`, el renderer compartido ni el storefront público.

Gate de cierre: `check`, `build`, `check:budgets`, `benchmark:export` y
`test:e2e` verdes; ejecutables reconstruidos (`desktop:build`,
`desktop:package`, `portable:smoke`) y commit enviado a `origin/main`.
Detalle por ola y reportes en `.superpowers/sdd/ola*-report.md`.

## Rollback del revamp de movimiento (2026-08-08)

La sesión de revamp del storefront (presets `zoom-in`/`blur-in`, capability
`micro`, efectos de hover/ambiente, módulos FAQ/stats y la tienda candidata
"Predeterminado Revamp") se revirtió por completo (commit `625f2c3`): la
tienda Predeterminado vuelve al sistema de movimiento previo (presets
`fade`/`fade-up`/`slide`/`scale`/`stagger`/`parallax`/`scroll-progress`/
`layer-stack` con `IntersectionObserver` y CSS scroll-timeline) y la candidata
fue eliminada del disco y de IndexedDB. Se conservaron la deduplicación de
estilos de módulo por style key en el exporter (storefront.css ~75 KB medidos)
y los budgets documentados. Registro completo en el
[`CHANGELOG.md`](CHANGELOG.md), sección "Rollback del revamp de movimiento".

## Revisión de bugfixes (2026-08-09)

Ocho defectos documentados se corrigieron y verificaron (plan
`docs/superpowers/plans/2026-08-09-bugfix-review.md`); detalle en el
[`CHANGELOG.md`](CHANGELOG.md), sección "Revisión de bugfixes (2026-08-09)".

## Revisión de bugfixes 2 (2026-08-09)

Cierre de la revisión de bugfixes 2 (plan
`docs/superpowers/plans/2026-08-09-bugfix-review-2.md`): 12 tareas que
corrigieron ~30 defectos de editor, runtime, storage, shell y specs; la deuda
cerrada y los diferidos quedaron registrados en
[`docs/TECHNICAL_DEBT.md`](docs/TECHNICAL_DEBT.md) y detalle en el
[`CHANGELOG.md`](CHANGELOG.md), sección "Revisión de bugfixes 2 (2026-08-09)".

## Optimización de rendimiento y UI (2026-08-09)

Cierre del plan
`docs/superpowers/plans/2026-08-09-optimizacion-rendimiento-ui.md` (olas A1-A8
y U1-U7/U11). Objetivo: reducir el ~30 % de un core (reportado en una máquina
9800X3D) que la app abierta consumía en reposo y garantizar que los textos
entren en sus cajas sin scroll vertical de página.

Números de referencia del harness `perf-idle` (A5, `tests/e2e/perf-idle.spec.ts`,
CDP `Performance.getMetrics`, Chromium headless con SwiftShader, settle 3 s +
muestreo 5 s):

- **Baseline (mid-flight):** dashboard con cosmic visible → ScriptDuration
  1.4-1.5 ms/s, **TaskDuration 196-226 ms/s (~200 ms/s ≈ 30 % de un core)**,
  rAF 20.7-22.7/s; editor con preview → Script 0.0, Task 0.9-1.7 ms/s; editor
  oculto (emulado) → Script 0.0, Task 1.0-1.3 ms/s. El coste del cosmic se ve
  en TaskDuration (el GL corre por SwiftShader en headless), no en
  ScriptDuration.
- **Objetivo del plan:** ScriptDuration < 100 ms/s visible y < 25 ms/s oculto
  (~1/3 del baseline); el spec presupuesta ambas métricas (dashboard
  100/300 ms/s + 500 rAF/s, editor 100/100, oculto 25/100) con umbrales
  provisionales a recalibrar sobre TaskDuration en el gate T10.
- **Viewports verificados (layout-fit, 15/15):** 1366×768, 1440×900 y
  1920×1080 sobre dashboard, Catálogo, Preparar, Resumen y Exportar (sin
  scroll vertical de página ni desborde horizontal); `editor-responsive` cubre
  390/844, 768/1024, 1024/768, 1440/900 y 1920/1080; en móvil el dashboard
  scrollea dentro de su región, no la página.
- Budgets tras la ola: runtime JS 52 644 B (tope 52 KiB, margen 604 B) y CSS
  inicial del Studio 101 610 B / 102 400 B (margen ~790 B).

Residuales documentados en [`docs/TECHNICAL_DEBT.md`](docs/TECHNICAL_DEBT.md)
(márgenes de budget, recalibración de umbrales del harness, receta headed para
pestaña oculta, `requestWorker` sin reintento, fetch de `search-index.json` sin
gate, detalle móvil dentro de la región).

## Auditoría de controles y traza de datos (2026-08-10)

Cierre del plan
[`docs/superpowers/plans/2026-08-10-auditoria-controles.md`](docs/superpowers/plans/2026-08-10-auditoria-controles.md):
la caza conductual (H1-H8) recorrió 199 chequeos con clicks reales y encontró
15 hallazgos BUG agrupados en 12 controles rotos, corregidos por F1-F14 (más
los commits de shell/categorías/matriz) con spec de regresión propio por área;
la traza estática (T1-T20) verificó el camino completo del dato de cada
control y corrigió 13 desajustes de contrato reales. Detalle por hallazgo en
[`CHANGELOG.md`](CHANGELOG.md) y en los reportes de `.superpowers/sdd/`.

Matriz conductual (`.superpowers/sdd/acciones-hN-report.md`):

| Área | Chequeos | OK | BUG |
| --- | --- | --- | --- |
| H1 Builder: picker e inspector | 19 | 19 | 0 |
| H2 Builder: operaciones de sección | 62 | 61 | 1 |
| H3 Shell del Studio | 20 | 15 | 5 |
| H4 Catálogo | 24 | 23 | 1 |
| H5 Assets | 17 | 12 | 2 (3 gaps) |
| H6 Export | 15 | 12 | 2 (1 no probado) |
| H7 Dashboard | 13 | 12 | 1 |
| H8 SEO/Tema/Overview/Guided | 29 | 26 | 3 |
| **Total** | **199** | **180** | **15** |

Traza de datos (`.superpowers/sdd/traza-tN-report.md`): T1 18/18 OK · T2 sin
desajustes (7 tests de contrato) · T3 sin desajustes (4 tests) · T4 1 fix ·
T5 18/18 OK · T6 3 fixes (slug, SHA256, rebase) · T7 1 fix (brand) · T8 1 fix
(bulkUpdate muerto) · T9 1 corrección de diseño (enums) · T10 2 fixes
(reparent) · T11 sin desajustes · T12 1 fix (usos en páginas) · T13 1 fix
(criticalCount) · T14 10/10 OK · T15 sin desajustes (hook `data-theme` inerte,
documentado) · T16 1 fix (preview SEO) · T17 1 fix (teléfono) · T18 sin
desajustes · T19 sin desajustes funcionales (limitación iframe documentada) ·
T20 1 fix (dashboard-selected).

Nuevos gates E2E: `ui-matriz-interaccion` (13), `ui-shell` (10),
`ui-categorias` (3), `ui-guiado` (3), `ui-producto` (5), `ui-assets` (2),
`ui-export` (2), `ui-catalogo` (1), `ui-tema-seo` (4), `ui-shutdown` (1).
Residuales y notas de proceso (stashes `stash@{0..2}`, `.playwright-cli/`) en
[`docs/TECHNICAL_DEBT.md`](docs/TECHNICAL_DEBT.md).

## Barrido total de controles (2026-08-10)

Cierre del plan
[`docs/superpowers/plans/2026-08-10-barrido-total-controles.md`](docs/superpowers/plans/2026-08-10-barrido-total-controles.md):
un despacho de 30 agentes (bins A1-A30) auditó ~300 controles de Studio y
storefront público con el **contrato de 3 capas** y dejó 325 tests de barrido
(`tests/e2e/ui-sweep-aNN.spec.ts`) como gate. ~25 bugs reales se corrigieron
con su aserción de regresión (detalle y commits por bin en
[`docs/TECHNICAL_DEBT.md`](docs/TECHNICAL_DEBT.md), sección "Barrido total de
controles (2026-08-10)", y en los reportes `.superpowers/sdd/barrido-aNN-report.md`).

**El contrato de 3 capas queda como estándar para futuras auditorías de
controles:**

1. **Funcional:** click/tecla real (Playwright) → aserción del efecto en
   estado, datos o preview (no "visible-only").
2. **Auto-feedback:** el control comunica su estado seleccionado/activo/
   expandido/deshabilitado (`aria-pressed`/`aria-expanded`/`aria-selected`/
   clase activa/`disabled`) en el HTML inicial y lo mantiene sincronizado con
   su lógica; si el estado cambia y el control no lo refleja, es un BUG.
3. **Datos:** payload del handler → receptor (traza estática corta): los campos
   que el receptor lee son exactamente los que el control envía.

Storefront (A27-A30) se audita contra el sitio **exportado**, no contra el
editor. Los bins AUDIT no editan el archivo compartido: reportan `test.fixme`
nombrando al OWNER, que corrige en la misma ola.

Residuales del barrido (budget del runtime JS con 13 B de margen, gaps de
auto-feedback documentados, `availabilityDate` sin control, moneda/locale
literales, camino 404 del preview, entre otros) en
[`docs/TECHNICAL_DEBT.md`](docs/TECHNICAL_DEBT.md); resumen de usuario en el
[`CHANGELOG.md`](CHANGELOG.md), sección "Barrido total de controles
(2026-08-10)".

## Reauditoría focal de UI/UX (2026-08-11)

La matriz visual e interactiva de las ocho pestañas del Studio se repitió en
390×844, 768×1024, 1024×768, 1366×768, 1440×900 y 1920×1080. No se observó
overflow horizontal de página; Catálogo conserva un scroll horizontal interno
intencional por sus diez columnas y ahora lo anuncia en viewports compactos con
una región semántica y caption accesible. Las pruebas responsive verifican que
la tabla y la barra de acciones masivas sigan siendo alcanzables.

Se agregaron descripciones accesibles contextuales para acciones repetidas de
SEO, Recursos, Catálogo y Resumen, y los tabs del Studio sólo anuncian la
relación `aria-controls` con el panel activo. El servidor Vite de desarrollo
preoptimiza `dexie` y `react-dom/client` porque la configuración anterior podía
dejar la pantalla en blanco durante una auditoría local. La batería focalizada
de Chromium quedó en 73/73 y el paquete Studio en 256/256 tests.

### Reauditoría de controles repetidos (2026-08-11)

El barrido fresco de Dashboard y las ocho pestañas no encontró grupos de
controles repetidos sin contexto. Se agregó `aria-description` para asociar
tienda a las acciones repetidas del Dashboard, posición a las secciones
duplicadas del Constructor, recurso a los campos de Recursos y página/enlace a
los campos repetidos de Resumen. El checklist SEO usa ahora el mensaje del
hallazgo para distinguir sus toggles y acciones aunque compartan el título
`Revisión SEO`.

La regresión nueva de accesibilidad pasó 21/21; los recorridos afectados de
Resumen, Constructor, Recursos, SEO y Dashboard pasaron 72/72. Las etiquetas
visibles y locators semánticos existentes se conservaron.

## Auditoría total de la pestaña Tema (2026-08-10)

Cierre del plan
[`docs/superpowers/plans/2026-08-10-auditoria-tema.md`](docs/superpowers/plans/2026-08-10-auditoria-tema.md):
~40 controles del panel Tema auditados con el contrato de 4 capas —
funcional / auto-feedback / datos / **utilidad** (el control debe producir un
cambio visible en el preview Y en el sitio exportado). La caza (T1-T8) y la
traza (U1-U4) encontraron el hallazgo central: la plantilla moderna pisaba los
colores, el radio, la fuente y el espaciado del editor con valores fijos (capa
`--catalog-*`, radios y stacks hardcodeados en `packages/modules/src/styles.ts`)
— el panel Tema casi no se veía. Tres agentes de fix + a11y conectaron todo;
quedan 3 decisiones abiertas (dark mode, familias Google Fonts adicionales,
peso del CSS del storefront).

Reportes: `.superpowers/sdd/tema-tN-report.md`, `tema-uN-report.md` y
`tema-fix-themeeditor.md`. Resumen de usuario en [`CHANGELOG.md`](CHANGELOG.md),
sección "Auditoría total de la pestaña Tema (2026-08-10)"; deuda abierta en
[`docs/TECHNICAL_DEBT.md`](docs/TECHNICAL_DEBT.md).

**Resuelto (commits `f6f9487`, `1728e72`, `c12daff`):** paleta conectada a la
plantilla default (`--catalog-*` deriva de `var(--solara-*)`: los 7 colores y
los 4 presets se ven); radius en ~21 superficies modernas (pills conservan
999px); fuentes → vars en raíz y marca; `--solara-space-scale` → grillas/gaps
(antes 0 consumidores — dead control); `--solara-type-scale` → títulos
modernos; accentText → botones; carga real de fuentes (Archivo/Inter/Lora
woff2 variable self-hosted en `assets/fonts/`, `@font-face` en themeCss,
preview inline base64, shim `local(Arial)` eliminado); vars muertas eliminadas
(`--solara-display`, `--solara-body`, `--solara-space`); selector real de
fuentes con migración tolerante (opción "Personalizada" conserva el valor,
schema intacto); contenedor sin pérdida de valores (step eliminado, T8-B1);
nombre accesible del selector (a11y).

**Paridad:** preview ↔ sitio exportado verificada **byte a byte** para las 17
vars del tema (U2) — el flujo del editor llega idéntico a ambos outputs.

**Decisiones abiertas (sin fix en esta ola):**

1. **Dark mode** — deshabilitado por decisión documentada: los 7 tokens no
   alcanzan para una segunda paleta y habilitarlo rompería la capa fija clara.
   Propuestas A (sólo `color-scheme`) y B (schema v3 con `colors.dark`) con
   evidencia en `.superpowers/sdd/tema-t7-report.md`; mantener el hint.
2. **Google Fonts self-host** — ~34.9 KB woff2 por familia en el sitio
   exportado (medido: Archivo 34.1 / Inter 47.1 / Lora 36.9 KB); revisar si se
   agregan familias.
3. **CSS del storefront** — +6 KB (+8.1 %: 75.1 → 81.2 KB, cap 780 KiB);
   vigilarlo en budgets ante cambios de styles.ts.

## Auditoría total de la pestaña Resumen (2026-08-10)

Cierre del plan
[`docs/superpowers/plans/2026-08-10-auditoria-resumen.md`](docs/superpowers/plans/2026-08-10-auditoria-resumen.md):
~40 controles del tab Resumen auditados con el contrato de 4 capas —
funcional / auto-feedback / datos / **utilidad**. La caza (R1-R8) y la traza
(P1-P4) encontraron el hallazgo central: los enlaces de navegación editados en
el Resumen no renderizaban en tiendas nuevas — la plantilla limpia siembra
`navigation.mode: "automatic"` y el header moderno descartaba
`navigation.items` (dead control P0: el Studio no exponía el modo). Tres
agentes de fix lo resolvieron: el header moderno siempre refleja la navegación
del editor, con prioridad sobre la navegación derivada de categorías.

Reportes: `.superpowers/sdd/resumen-rN-report.md`, `resumen-pN-report.md` y
`resumen-ola3-*-report.md`. Resumen de usuario en [`CHANGELOG.md`](CHANGELOG.md),
sección "Auditoría total de la pestaña Resumen (2026-08-10)"; deuda abierta en
[`docs/TECHNICAL_DEBT.md`](docs/TECHNICAL_DEBT.md).

**Resuelto (commits `268306e`, `e0d1330`, `237fed0`):** enlaces y subenlaces
con prioridad en el header moderno incluso en `mode: automatic` (dead control
P0, tiendas nuevas muestran los links editados); JSON-LD `telephone` =
`whatsapp.phone || identity.phone` con claves vacías omitidas; meta description
de Home con fallback `seoDescription ?? seo.description ?? identity.description`;
`<title>` de Home con fallback `seoTitle ?? seo.title ?? project.name ??
brandName` (`project.name` gana su primer consumidor real); dirección en el
footer moderno; `catalogLabel` en el eyebrow del search dialog; gate guiado
alineado con el gate real del export (`auditReport().criticalCount`, singular
"1 pendiente", estado "Verificando…"); sentinel de teléfono marca `placeholder`;
colapsables persistentes por tienda en localStorage; badge `invalid`
documentado como defensivo.

**Paridad:** preview ↔ sitio exportado verificada **byte a byte** en `/`,
`/nosotros/` y `/contacto/` (252 verificaciones campo×ruta, documento completo
normalizado idéntico en las 3 rutas — P2).

**Decisiones abiertas (documentadas, sin fix en esta ola):**

1. **`pages.home.title` (título visible de Home)** — sigue sin consumidor
   directo en el sitio: el `<title>` usa seo y el h1 viene del hero.
   Documentado como contrato.
2. **Slug interno** — identidad interna por diseño (carpeta `proyectos/`,
   respaldos e historial de export); el sitio exportado es idéntico ante
   cambios de slug (R3 test 5).

## Auditoría total de la pestaña Preparar (2026-08-10)

Cierre del plan
[`docs/superpowers/plans/2026-08-10-auditoria-preparar.md`](docs/superpowers/plans/2026-08-10-auditoria-preparar.md):
el flujo guiado se auditó contra el proyecto REAL y contra el gate real de
producción (`auditReport`). Hallazgo central: ~15 requisitos "críticos" eran
dead requirements y dos críticos reales que bloquean producción no tenían
requisito en Preparar. Con los fixes (requisitos honestos, upgrade con cambios
reales, modo avanzado accesible y persistente, sentinel WhatsApp nunca
publicado) el journey de tienda limpia completa TODO (28/28, 100 %) y exporta
producción viable. Reportes en `.superpowers/sdd/preparar-*.md`; resumen de
usuario en [`CHANGELOG.md`](CHANGELOG.md), sección "Auditoría total de la
pestaña Preparar (2026-08-10)"; deuda y decisiones abiertas en
[`docs/TECHNICAL_DEBT.md`](docs/TECHNICAL_DEBT.md), sección "Auditoría total de
la pestaña Preparar (2026-08-10)". Quedan abiertas, de olas previas, la
decisión de dark mode (Tema) y el contrato de `pages.home.title` (Resumen).

## Foco al cerrar ProductEditor (2026-08-11)

El diálogo nativo de edición de producto abría con `showModal()` pero no
conservaba el elemento que lo había disparado. `ProductEditor` ahora captura el
elemento activo al montar y, al desmontarse, cierra el diálogo y devuelve el
foco al disparador conectado mediante el siguiente frame. Esto mantiene el
contexto de teclado después de `Cancelar`, `Escape`, guardado o descarte
confirmado; si el disparador ya no existe, no intenta enfocar un nodo
desconectado.

La regresión está en `tests/e2e/ui-sweep-a06.spec.ts`: A06 queda en 11/11 en
Chromium. No se modificó `schemaVersion`, el contrato de catálogo ni
`catalogScaleStore`.

## Foco al cerrar el detalle de Recursos (2026-08-11)

El detalle de una imagen en Recursos se renderiza como un panel lateral
condicional, no como un diálogo. Al cerrarlo, el botón `Detalle` que lo abrió
ya no podía conservar el foco porque el panel desmontaba su propio botón de
cierre. `Assets` ahora guarda el disparador conectado y restaura el foco en el
siguiente frame; también cancela ese frame si el panel vuelve a abrirse antes
de ejecutarlo. Si el asset fue eliminado, el disparador desconectado se ignora.

La regresión está en `tests/e2e/ui-sweep-a17.spec.ts`: A17 queda en 11/11 en
Chromium. No se modificó el schema ni la forma de `catalogScaleStore`.

## Contexto accesible para controles repetidos del Constructor (2026-08-11)

Los botones de orden, duplicado y eliminación de los repetidores generados y
del editor de slides conservan sus nombres de acción estables para la UI, pero
ahora agregan `aria-description` con la posición y el total (`Slides 1 de 2`,
`Slide 2 de 2`). Esto permite distinguir controles iguales al navegar con
tecnologías asistivas sin introducir locators o textos visibles nuevos.

La cobertura está en `tests/e2e/studio-builder.spec.ts` y
`tests/e2e/ui-sweep-a18.spec.ts`: 3/3 y 13/13 pasan en Chromium.

## Valoración configurable en cards de productos (2026-08-11)

El inspector del módulo `catalog-product-grid` ya exponía `Mostrar valoración`,
pero `modernProductCard` no leía ese setting. Ahora el renderer consulta los
resúmenes de reseñas visibles y, cuando la opción está activa, muestra promedio,
cantidad y una etiqueta accesible en la card; cuando está desactivada, no emite
el bloque. El mismo contrato se mantiene en Preview y exportación.

La cobertura está en `packages/modules/src/index.test.ts` (33/33),
`packages/exporter/src/catalog-modern.test.ts` (109/109, 1 skipped) y
`tests/e2e/ui-sweep-a11.spec.ts` (11/11 en Chromium), incluyendo activación,
desactivación, feedback del inspector y undo. El build de Studio pasó y no se
modificaron `schemaVersion`, datos persistidos ni la forma de `catalogScaleStore`.

## Marca interna de testimonios fuera del inspector (2026-08-11)

Los ítems de `catalog-testimonials` conservan `example` en el schema para no
alterar proyectos guardados, pero el renderer nunca lo consumió. Por eso se
retiró `Contenido de ejemplo` de los campos editables del repeater: una marca
interna queda compatible en los datos, sin aparecer como un checkbox cuyo
resultado no se puede observar.

La cobertura está en `packages/modules/src/index.test.ts` y
`tests/e2e/editor-builder.spec.ts`; agregar un testimonio sigue generando un
ítem válido y el inspector ya no expone el control muerto.

## Foco explícito en diálogos del Dashboard (2026-08-11)

`CompareView` ahora captura el elemento que abrió el diálogo y lo vuelve a
enfocar al cerrar por Escape, X o el botón `Cerrar`. `Dashboard` aplica el mismo
contrato a Crear tienda y Cerrar app; Crear tienda conserva el disparador
actual, no sólo el botón hero, cuando otra superficie del Dashboard la abre.

La cobertura específica está en `tests/e2e/ui-sweep-a20.spec.ts`,
`tests/e2e/dashboard-actions.spec.ts` y `tests/e2e/ui-sweep-a13.spec.ts`.
Los recorridos de comparación y A13 mantienen sus regresiones de foco y pasan en
Chromium junto con las acciones del Dashboard.

## Tooltips accesibles y baseline responsive (2026-08-11)

`Tooltip` conserva la burbuja CSS para hover y foco, pero ahora renderiza una
descripción con `role="tooltip"` y conecta el control mediante
`aria-describedby`. Al clonar el control elimina el `title` nativo del wrapper
y del botón, evitando avisos duplicados sin perder el nombre o la descripción
para tecnologías asistivas.

La regresión de `tests/e2e/editor-a11y.spec.ts` cubre las variantes top y bottom;
`tests/e2e/ui-sweep-a26.spec.ts` cubre hover, foco y las cuatro posiciones. El
baseline responsive de `tests/e2e/ui-sweep-a21.spec.ts` recorre Preparar,
Resumen, Catálogo, Constructor, Tema, Recursos, SEO y Exportar en los seis
viewports del plan y verifica que `document` y `body` no creen overflow
horizontal.

## Feedback visible en ProductEditor (2026-08-11)

El encabezado de `ProductEditor` muestra un `output` con `aria-live="polite"` y
el texto `Cambios sin guardar` mientras el borrador difiere del producto
original. El diálogo conserva `data-dirty="true"` para las regresiones de estado,
y `save()` desplaza el primer error inline al viewport antes de bloquear el
guardado.

La cobertura afirmativa está en los dos casos A4 de
`tests/e2e/ui-sweep-a06.spec.ts`; ambos pasan con el scroll del error y el
indicador visible.
