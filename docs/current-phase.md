# Fase 5 completada: pipeline de imágenes responsive

## Objetivo

Procesar imágenes fuera del hilo principal, generar variantes responsive
deterministas, conservar transparencia, reutilizar transformaciones por hash y
exportar únicamente los binarios que utiliza la tienda.

## Entregado

- Worker con receta estable de anchos 480, 768, 1200 y 1800 px, sin upscaling.
- Validación de MIME y firma binaria para JPEG, PNG y WebP.
- Límites de 25 MB por archivo y 50 megapíxeles por imagen.
- Corrección de orientación mediante `createImageBitmap` y liberación segura de
  `ImageBitmap`.
- WebP como formato principal y fallback PNG para imágenes con transparencia o
  JPEG para imágenes opacas.
- Caché Dexie v2 con clave hash + versión de receta y `lastUsedAt`.
- Limpieza segura de caché regenerable y advertencia de cuota local.
- Progreso de lote, duplicados omitidos, reutilización de caché y errores por
  archivo sin abortar el lote válido.
- Renderer con `sizes`, `fetchpriority`, `decoding` y `<source>` por MIME real.
- Exporter con extensiones reales, rutas deterministas por hash y deduplicación
  de binarios.

## Contratos preservados

- `StoreProjectV1`, `schemaVersion`, `ImageAsset` y formatos públicos no cambian.
- La migración Dexie sólo descarta caché regenerable antigua.
- `.solara.zip` y `site.zip` siguen siendo formatos distintos.
- Preview, renderer y ZIP usan las mismas rutas públicas.
- SEO, carrito, WhatsApp y movimiento quedan fuera de esta fase.

## Verificación de cierre

- Tests del Worker para receta, dimensiones, MIME, firmas y alpha.
- Tests de repositorio para versionado, reutilización y limpieza de caché.
- Tests de renderer para responsive sources y atributos de prioridad.
- Tests de exporter para fallback PNG, responsive JPEG y deduplicación.
- Gate de fase:
  - `corepack pnpm check`
  - `corepack pnpm build`
  - `corepack pnpm benchmark:export`
  - `corepack pnpm test:e2e`

## Próxima fase

SEO técnico, JSON-LD, sitemaps, auditoría de coherencia y feed Merchant
experimental. El checkout continuará finalizando en WhatsApp y se informará la
limitación de elegibilidad de Google.
