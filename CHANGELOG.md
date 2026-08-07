# Changelog

Todos los cambios notables de SolaraCommerce se documentan en este archivo.

El formato sigue [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/) y
cada entrada describe el cambio desde la perspectiva del usuario o del
contrato, no los mensajes de commit. El proyecto aún no tiene releases
formales: los cambios se agrupan por fecha de trabajo hasta que exista una
versión publicada.

## [Unreleased]

### Eliminación de ZIP y gzip (2026-08-07)

El producto dejó de usar compresión ZIP (y gzip incluso como medición) en
todos sus flujos. El contrato de la tienda (`StoreProjectV2Schema`,
`schemaVersion: 2`) no cambió; sólo el transporte y la persistencia.

**Añadido**

- Respaldo editable en JSON único sin comprimir: `.solara.json` con envelope
  `{ format, version: 2, projectId, exportedAt, project }`; las imágenes viajan
  como data URLs dentro del proyecto.
- Manifest local V2 con `current.projectPath` apuntando a
  `actual/<clave>.solara.json`; los respaldos y respaldos-manuales usan la
  misma extensión.
- Migración única en el servidor de las tiendas `.solara.zip` existentes a
  `.solara.json`, idempotente mediante marca en `.solara-runtime/migration.json`.
  Los ZIP viejos se conservan en `respaldos/`. El módulo
  `legacy-zip-migration.mjs` y la dependencia `fflate` son temporales: se
  eliminarán en un release posterior.
- Importación de catálogo comercial por carpeta (selector `webkitdirectory`
  con `productos.csv` e `imagenes/`) en lugar de ZIP.
- Gate anti-ZIP en `check:repository`: falla si el código fuente reintroduce
  `fflate`, `zipSync`, `unzipSync`, `gzipSync`, `.solara.zip` o `site.zip`
  (sólo exime al módulo de migración, su test y el propio gate).

**Cambiado**

- El sitio público ya no se descarga como `site.zip`: el exportador devuelve el
  mapa de archivos y el servidor lo escribe directo en
  `proyectos/<tienda>/sitios/<versión>/`. Publicar = copiar esa carpeta a un
  hosting estático.
- `exportProject` devuelve `{ files, audit, optimization }` sin `zip`; los
  tests de determinismo comparan los mapas de archivos.
- El transporte de Studio usa `application/vnd.solara.project+json`; las
  descargas de respaldo son `*.solara.json` y la importación acepta JSON.
- Budgets en bytes crudos sin gzip: Studio JS ≤ 700 KiB y CSS ≤ 84 KiB;
  storefront.js ≤ 52 KiB, storefront.css ≤ 780 KiB; runtime JS ≤ 52 KiB y
  CSS ≤ 8 KiB (topes calibrados sobre medición real).
- `SOLARA_PILOT_PROJECT_ARCHIVE` apunta a un `.solara.json`; `reference:export`
  y `pilot:export` escriben carpetas (`.release/reference-site/`,
  `.release/pilot-site/`).
- Los límites del servidor (bytes totales, por archivo y nº de archivos) se
  aplican al mapa de archivos del sitio; al no haber descompresión, el riesgo
  de Zip Slip desaparece.

**Eliminado**

- `site.zip`, `.solara.zip`, descarga de ZIP del sitio y botón "Descargar ZIP".
- La extracción ZIP síncrona del servidor y su deuda asociada.
- `fflate` del paquete Studio y del exporter en código (sólo persiste en el
  módulo temporal de migración).

**Arreglado**

- El guardado restaura el chequeo de integridad del `projectId` contra la
  transacción (un respaldo de otra tienda se rechaza).
- La migración no se desactiva ante fallos transitorios del filesystem y no
  rompe el storage si falla; sanitiza rutas y claves antes de escribir.
- `writeSiteFiles` valida entradas no string y rechaza rutas duplicadas.
- `LocalSaveReceipt` declara `projectPath` (el servidor nunca devolvió
  `archivePath` en V2).

## Historial anterior (resumen)

Antes de este changelog, el repositorio acumuló las siguientes fases
(ver `docs/HANDOFF.md` para el detalle):

- Contrato `StoreProjectV2` (`schemaVersion: 2`), plantilla Catalog Modern,
  fixtures deterministas y validación con Zod.
- Reducer de comandos, undo/redo e importación/exportación CSV en
  `@solara/core`.
- Módulos legacy `legacy-editorial-v1` (compatibilidad) y familia
  `catalog-modern-v1` con renderer compartido entre preview y exportación.
- Preview responsive, exportación HTML/CSS/JS, SEO, JSON-LD, sitemaps,
  Merchant y contexto público para agentes.
- Carrito local, selección de variantes y pedido determinista por WhatsApp.
- Dashboard local cósmico, flujo guiado `Preparar` y modo avanzado.
- Persistencia local en disco (`proyectos/`) con servidor loopback, staging,
  SHA-256, versionado, conflictos `409` y manifest atómico.
- Distribución portable autocontenida para Windows (Electron,
  `solara://studio`).
