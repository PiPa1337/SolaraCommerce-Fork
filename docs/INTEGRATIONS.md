# APIs e integraciones

SolaraCommerce es una aplicación local-first. No hay API remota obligatoria,
autenticación de usuarios, webhooks ni pagos online en v1. Las integraciones
que siguen son locales o están incluidas en el sitio exportado.

## Servidor local gestionado

`Abrir SolaraCommerce.cmd` inicia `packages/exporter/scripts/serve.mjs` en
`127.0.0.1`. El proceso sirve Studio, archivos estáticos y la API de persistencia
en disco. La cookie `solara_shutdown` es `HttpOnly`; el servidor verifica
origen, método y token de sesión. El servidor no se expone a la red y no forma
parte del ZIP público.

### Sesión y estado

| Método | Ruta | Uso | Respuesta esperada |
| --- | --- | --- | --- |
| GET | `/__solara/session` | Detectar servidor gestionado | Estado de sesión local |
| GET | `/__solara/storage/status` | Comprobar permisos y rutas | `managed`, `writable`, raíces |
| GET | `/__solara/storage/projects` | Listar tiendas desde manifests | Resúmenes sin datos comerciales completos |
| GET | `/__solara/storage/projects/{projectId}/current` | Leer el archivo actual | Proyecto validable + versión |

`{projectId}` se valida contra IDs del proyecto. El servidor nunca acepta una
ruta de filesystem enviada por el navegador.

### Guardado en disco

| Método | Ruta | Uso |
| --- | --- | --- |
| POST | `/__solara/storage/saves` | Abrir transacción con `expectedVersion` |
| PUT | `/__solara/storage/saves/{transactionId}/project` | Subir `.solara.zip` editable |
| PUT | `/__solara/storage/saves/{transactionId}/site` | Subir ZIP temporal del sitio |
| POST | `/__solara/storage/saves/{transactionId}/commit` | Validar y publicar versión |
| POST | `/__solara/storage/saves/{transactionId}/abort` | Cancelar y limpiar staging |

Los cuerpos binarios se transmiten como streams. El cliente envía SHA-256 y el
servidor vuelve a calcularlo. Un conflicto de versión responde `409`; Studio no
hace merge automático. Un fallo de exportación puede confirmar el proyecto
editable y conservar el último sitio público válido.

### Operaciones auxiliares

| Método | Ruta | Uso |
| --- | --- | --- |
| POST | `/__solara/storage/projects/{projectId}/manual-backup` | Copiar la versión actual a respaldos manuales |
| POST | `/__solara/storage/projects/{projectId}/open-site` | Levantar un servidor estático temporal |
| POST | `/__solara/shutdown` | Cerrar el proceso local tras confirmar el token |

El servidor de sitio temporal sólo expone la carpeta pública seleccionada. Las
rutas permanecen separadas del editor.

## Persistencia del navegador

`apps/studio/src/lib/repository.ts` encapsula Dexie. Guarda proyectos, caché de
assets y `RecoveryDraft`; no se comunica con servicios externos. En ausencia del
servidor gestionado funciona como fallback para desarrollo y recuperación.

## Exportación estática

`@solara/exporter` convierte un snapshot validado en HTML, CSS, runtime,
assets, JSON-LD, sitemaps, Merchant y contexto opcional para agentes. Todas las
rutas son archivos estáticos. No requiere endpoints del sitio en producción.

### Integraciones del storefront

- **WhatsApp:** `buildWhatsAppUrl` arma un enlace `https://wa.me/...` con un
  mensaje escapado. Requiere un número configurado; si falta, la compra muestra
  un error accionable. WhatsApp reemplaza al pago online en v1.
- **Google Merchant:** `google-merchant.xml` se genera localmente desde el
  mismo snapshot que HTML y JSON-LD. No se usa la Merchant API.
- **Search Console:** el export incluye tokens opcionales y `sitemap.xml`; la
  verificación y envío se hacen manualmente en el dominio publicado.
- **Hosting estático:** `_headers` contiene sugerencias compatibles con hosts
  estáticos. El usuario copia la carpeta `sitios/<versión>/` a su proveedor.

## Variables y dependencias externas

No hay claves, OAuth, webhooks ni servicios SaaS en runtime. `pnpm`, Node,
Playwright y los navegadores de tests son dependencias de desarrollo. Ver
[`README.md`](../README.md) para las variables locales permitidas y
[`docs/backup-and-recovery.md`](backup-and-recovery.md) para recuperación.

## Manejo de errores

- `400`: payload o parámetros inválidos.
- `401/403`: sesión, origen o token no válidos.
- `404`: tienda, transacción o recurso inexistente.
- `409`: versión de disco obsoleta o transacción concurrente.
- `413`: límites de ZIP, archivo o extracción superados.
- `500`: error de filesystem, permisos o exportación; la versión confirmada
  anterior debe permanecer intacta.

Para reemplazar el servidor local hay que conservar el contrato de
`LocalProjectManifestV1`, los hashes, el bloqueo por tienda y el commit atómico.
No se debe conectar el storefront directamente a estas rutas.
