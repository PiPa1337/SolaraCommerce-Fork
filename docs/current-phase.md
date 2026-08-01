# Fase 6 completada: SEO tecnico y Google Merchant

## Objetivo

Producir tiendas estaticas rastreables con rutas consistentes, HTML inicial
completo, datos estructurados, sitemaps y un feed Merchant generado desde el
mismo snapshot comercial.

## Entregado

- Snapshot comercial determinista con productos activos y una oferta por variante.
- URLs directas de variantes con `?variant={variantId}` y agrupacion por producto.
- Paginas de inicio, categorias paginadas, colecciones paginadas, productos y
  politicas publicas en rutas estables.
- Enlaces de paginacion `rel=prev` y `rel=next` cuando corresponde.
- `WebSite`, `OnlineStore`, `BreadcrumbList`, `Product`, `ProductGroup` y
  `Offer` en el HTML inicial.
- `sitemap.xml`, sitemap de imagenes, `robots.txt` y
  `google-merchant.xml` de produccion.
- Feed con IDs de variante, `item_group_id`, precios enteros convertidos a
  moneda, disponibilidad, imagenes absolutas, marca e identificadores reales.
- Auditoria con severidad, area, entidad y destino de correccion para dominio,
  contenido, slugs, politicas, variantes preorder y paridad Merchant.
- Studio muestra el resumen de auditoria y advierte que el checkout actual por
  WhatsApp es experimental para Merchant.

## Contratos preservados

- `StoreProjectV1` sigue en `schemaVersion: 1`.
- `availabilityDate` es opcional y mantiene compatibilidad con proyectos
  anteriores.
- No cambian IDs, formatos de ZIP, carrito, WhatsApp ni el renderer modular.
- Preview y ZIP usan el mismo renderer y los mismos datos de proyecto.
- El feed no se incluye en exportaciones draft y el sitio draft conserva
  `noindex,nofollow`.

## Verificacion de cierre

- Unit tests del schema para fechas opcionales y del exporter para snapshot,
  variantes, colecciones, rutas legales, sitemaps, feed y auditoria.
- Playwright verifica descubrimiento sin JavaScript de productos, colecciones,
  politicas, sitemap y feed.
- Gate de fase:
  - `corepack pnpm check`
  - `corepack pnpm build`
  - `corepack pnpm benchmark:export`
  - `corepack pnpm test:e2e`

## Limitacion Merchant

El checkout final por WhatsApp no equivale a un checkout convencional dentro
del sitio. La auditoria lo deja visible y la exportacion no afirma elegibilidad
automatica para Merchant. Para un piloto se debe validar manualmente la cuenta,
el dominio, las politicas y el flujo de compra antes de enviar el feed.

## Proxima fase

Animaciones premium accesibles: presets declarados por modulo, `inView`, scroll
progress y layer stack sin cambiar el HTML SEO ni bloquear el contenido cuando
JavaScript falla.
