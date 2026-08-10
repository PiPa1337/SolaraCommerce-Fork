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
