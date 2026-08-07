# Eliminar ZIP del producto (formato JSON sin compresión) — Design spec

**Fecha:** 2026-08-07
**Estado:** aprobado por el usuario (4 secciones)

## Objetivo

Eliminar el uso de compresión ZIP (y de gzip incluso como medición) de todo el
producto SolaraCommerce. El respaldo editable pasa a un JSON único sin
comprimir; el sitio público pasa a ser únicamente una carpeta en disco; la
importación de catálogo comercial usa un selector de carpeta; los budgets
miden bytes crudos. `fflate` desaparece del código tras una migración única de
las tiendas existentes.

**No cambia:** `StoreProjectV2Schema`, `schemaVersion: 2`, el renderer
compartido (preview y sitio), el runtime público, ni el contrato de la tienda.
El cambio es de transporte/persistencia, no de modelo de datos.

## Decisiones tomadas (con el usuario)

1. Respaldo editable: **JSON único sin comprimir** `.solara.json`
   (`{ format, version, projectId, exportedAt, project }`; las imágenes ya
   son data URLs dentro de `project`).
2. Sitio público: **solo carpeta en disco** (`sitios/<versión>/` escrita por
   el servidor); se elimina `site.zip` y el botón "Descargar ZIP".
3. Importación de catálogo comercial: **selector de carpeta**
   (`webkitdirectory`) con `productos.csv` + `imagenes/`.
4. Migración: **conversión única al migrar**, en el servidor; el ZIP desaparece
   del código en un release posterior.
5. Budgets: **sin gzip**; topes recalculados en bytes crudos.

## Formato de respaldo `.solara.json`

```json
{
  "format": "solara-project",
  "version": 2,
  "projectId": "store-...",
  "exportedAt": "2026-08-07T00:00:00.000Z",
  "project": { "...": "StoreProjectV2 completo con data URLs" }
}
```

- Sustituye al ZIP que hoy contiene `manifest.json` + `project.json` + `assets/`.
  La carpeta `assets/` del ZIP era redundante: `project.json` ya embebe las
  imágenes como data URLs; el JSON nuevo es un solo archivo autocontenido.
- MIME de descarga/upload: `application/vnd.solara.project+json` (sucesor del `application/vnd.solara.project+zip` actual).
- Validación al leer: `format === "solara-project"`, `version === 2`, y el
  contenido de `project` contra `StoreProjectV2Schema` (mismo criterio que hoy).
- Rechazo de respaldos v1 (los `.solara.zip` subidos manualmente): mensaje
  claro que indique que el formato cambió y que los `.solara.zip` existentes en
  `proyectos/` se convierten automáticamente al migrar.

## Manifest local V2

`format: "solara-local-project"`, `manifestVersion: 2` (antes 1).

- `current.archivePath` → `current.projectPath` → `actual/<clave>.solara.json`.
- `respaldos/<clave>.solara.json` y `respaldos-manuales/<clave>-manual-*.solara.json`.
- `lastValidSite.directoryPath` sin cambios (ya apunta a carpeta).
- `status` (`synced` / `site-outdated`) y hashes SHA-256 sin cambios.

## Flujo de guardado (disco gestionado)

1. Studio (worker): valida snapshot, crea `.solara.json`, exporta el sitio y
   obtiene el mapa `files` (ruta → contenido).
2. Sube el `.solara.json` como stream JSON (SHA-256, límites, `409`, staging),
   igual que hoy pero sin `assets/` ni compresión.
3. Sube el mapa de archivos del sitio como JSON (rutas + base64) en la misma
   transacción.
4. El servidor valida el `.solara.json` (formato + schema) y escribe el sitio:
   valida cada ruta contra `sitios/` (misma política de rutas relativas que
   hoy; al no haber descompresión, no existe Zip Slip), respeta límites
   (nº de archivos, bytes totales, bytes por archivo), escribe en carpeta
   temporal y renombra a `sitios/<versión>/`.
5. Publica `actual/<clave>.solara.json`, conserva el anterior en `respaldos/`,
   renombra el manifest de forma atómica. Los fallos mantienen la versión
   anterior y el último sitio válido (mismo contrato que hoy).

## Exportación pública (solo carpeta)

- `exportProject` deja de devolver `zip`; devuelve `{ files, audit, optimization }`.
- Se eliminan `zipFiles`/`unzipSync` de `packages/exporter/src/index.ts` y la
  dependencia `fflate` del paquete exporter.
- `Export.tsx`: sin "Descargar ZIP". Acciones: exportar production/draft,
  ver informe, abrir sitio (servidor efímero existente), abrir carpeta
  (endpoint `open-folder` de la fase de deuda).
- Publicar = copiar `proyectos/<tienda>/sitios/<versión>/` a un hosting estático.
- Scripts: `pilot:export` y `reference:export` escriben carpetas
  (`.release/pilot-site/`, `.release/reference-site/`); el piloto referencia
  `reference.solara.json` en lugar de `reference.solara.zip`;
  `create-release-manifest.mjs` lista carpetas.
- `benchmark:export` mide bytes totales del mapa `files` (hoy `zipBytes`).

## Importación de catálogo (carpeta)

- `Catalog.tsx`: input con `webkitdirectory` y `multiple`, `accept` sin ZIP.
- `catalog-package.worker.ts`: elimina `unzipSync`; recibe la lista de `File`
  de la carpeta; resuelve `productos.csv` en la raíz e `imagenes/` por rutas
  relativas; mantiene agrupación por variantes, categorías `Casa>Textiles`,
  deduplicación por hash y revisión previa a guardar.
- E2E `catalog-package.spec.ts`: carpeta temporal real con `productos.csv` e
  `imagenes/taza.png`, `setInputFiles` con `webkitdirectory`.

## Migración única (solo servidor)

- Nuevo módulo aislado `packages/exporter/scripts/legacy-zip-migration.mjs`
  (único lugar del repo que conserva lectura de ZIP, y temporal).
- Se ejecuta dentro de `ensureRoots()` (primer punto async de cada operación),
  protegido por la marca idempotente para que sólo corra una vez. Por cada
  carpeta de `proyectos/` con manifest V1 y `current.archivePath` `.solara.zip`:
  1. lee el ZIP una sola vez (`unzipSync`), extrae `project.json`;
  2. escribe `actual/<clave>.solara.json` equivalente;
  3. mueve el ZIP a `respaldos/` (conservación ante fallos);
  4. reescribe `manifest.json` como V2 (con `current.projectPath`);
  5. si el sitio extraído ya existe en `sitios/<versión>/`, no se toca.
- Idempotente: marca de finalización en `.solara-runtime/migration.json`
  (formato `solara-migration`, versión 1, lista de projectIds convertidos).
- Si un ZIP está corrupto: no se convierte, el manifest queda como está y el
  proyecto pasa a la lista de recovery con mensaje claro (sin perder datos).
- **Eliminación posterior:** en un release siguiente se borran
  `legacy-zip-migration.mjs`, la marca de migración y la dependencia `fflate`
  del workspace (queda como "deuda documentada" en el código y en
  `TECHNICAL_DEBT.md` hasta entonces).

## Budgets sin gzip

- `scripts/check-budgets.mjs`, `scripts/storefront-runtime-budget.test.ts`,
  `scripts/public-storefront-budget.test.ts`,
  `scripts/optimization-baseline.test.ts` y
  `packages/storefront-runtime/src/index.test.ts`: eliminar `gzipSync`;
  medir bytes crudos.
- Recalibrar topes con los valores medidos al momento de la implementación
  (orden de magnitud esperado: Studio JS ~650 KiB crudo, CSS ~45 KiB; runtime
  JS ~35 KiB, CSS ~6 KiB; confirmar con la medición real y fijar techo
  documentado).

## Gate de repositorio contra el retorno de ZIP

`scripts/check-repository.mjs`: fallar si el código fuente (apps/, packages/,
scripts/, tests/, excluyendo `packages/exporter/scripts/legacy-zip-migration.mjs`
hasta su release de eliminación) contiene `fflate`, `zipSync`, `unzipSync`,
`.solara.zip`, `site.zip` o `gzipSync`.

## Cambios por archivo (referencia)

| Área | Archivos |
| --- | --- |
| Studio lib | `lib/projectArchive.ts` (JSON), `lib/localStorage.ts`, `lib/localProjectRepository.ts` (mapa files), `lib/workers.ts` |
| Studio workers | `workers/export.worker.ts`, `workers/catalog-package.worker.ts` |
| Studio UI | `features/Export.tsx`, `features/Catalog.tsx`, `features/Studio.tsx` (backup plantilla), `App.tsx` (import/descarga) |
| Exporter | `src/index.ts` (sin zip), `scripts/local-project-storage.mjs` (V2 + sitio carpeta), `scripts/legacy-zip-migration.mjs` (nuevo), `package.json` (sin fflate en el release de limpieza) |
| Tests | `projectArchive.test.ts`, `local-project-storage.test.mjs`, `index.test.ts`, `scale.test.ts`, `pilot-preflight.test.ts`, `optimization-baseline.test.ts`, budgets, `portable.test.mjs`, E2E `catalog-package.spec.ts`, `studio-visual.spec.ts`, scripts de export/benchmark, `check-repository.mjs` |
| Scripts | `export-benchmark.test.ts`, `write-pilot-export.test.ts`, `write-reference-export.test.ts`, `create-release-manifest.mjs` |
| Docs | `README.md`, `HANDOFF.md`, `DATA_MODEL.md`, `INTEGRATIONS.md`, `backup-and-recovery.md`, `PORTABILITY.md`, `ARCHITECTURE.md`, `current-phase.md`, `pilot-checklist.md`, `TESTING.md`, `project-spec.md`, `TECHNICAL_DEBT.md`, `docs/superpowers/plans/2026-08-07-deuda-tecnica.md` |

## Manejo de errores

- JSON del respaldo corrupto/incompatible → rechazo con mensaje que conserva el
  archivo original (misma política que hoy).
- Upload del sitio con ruta insegura → rechazo por validación de rutas (sin
  descompresión, el riesgo Zip Slip desaparece).
- Fallo de escritura del sitio → se conserva el último sitio válido y el
  `.solara.json` se confirma igualmente con `status: site-outdated`.
- Fallo de migración de un proyecto → no se toca; aparece en recovery.
- Límites (bytes, archivos) se mantienen y se aplican sobre JSON y carpetas.

## Estrategia de testing

- Round-trip `.solara.json` (crear → leer → validar) y rechazos.
- Storage: versionado, `409`, límites, interrupción con `faultInjector`,
  conservación de sitio válido — todo sin ZIP (helpers JSON).
- Migración: ZIP falso + manifest V1 → `.solara.json` + manifest V2 + ZIP en
  respaldos + idempotencia (segunda corrida no convierte de nuevo).
- Determinismo de exportación: igualdad sobre `files`.
- E2E: descarga `*.solara.json`, import de carpeta, recorrido de guardado.
- Gate completo: `check` (incluye nuevo check de repositorio), `build`,
  `check:budgets`, `benchmark:export`, `test:e2e` (Chromium).

## Fuera de alcance

- No cambia `schemaVersion` ni el schema de la tienda.
- No se tocan el renderer público, el runtime ni los módulos.
- La matriz OS de release (disco lleno real, permisos) sigue como pendiente
  documentada.
- La eliminación definitiva de `fflate`/módulo de migración ocurre en un
  release posterior, no en esta fase.

## Relación con el plan de deuda técnica

Este spec reemplaza la Task 1 del plan `2026-08-07-deuda-tecnica.md`
(extracción streaming ZIP ya no aplica). Las tasks 2–13 se adaptan: los límites
de escritura se aplican a JSON/carpetas, y el resto (reparse, sidecar de
recovery, open-folder, sentinel, tipos, fixtures, splits, docs) se ejecuta
después de esta migración. El plan de deuda se actualiza en consecuencia.
