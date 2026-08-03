# Rediseño integral del storefront v2

## Estado

Implementado el contrato v2 y la primera integración completa del storefront
editorial. Studio, preview y ZIP siguen usando el mismo renderer.

## Cambios entregados

- `StoreProjectV2Schema` con navegación curada, páginas editables, templates
  comerciales y assets de video locales.
- `schemaVersion: 2` y reset controlado de únicamente
  `solara-commerce-studio` mediante `localStorage["solara-studio-storage-version"]`.
- Respaldos `.solara.zip` con manifest v2; los respaldos v1 se rechazan sin
  modificar el archivo original.
- Navbar con Inicio, Colecciones de hasta dos niveles, Contacto, Nosotros,
  búsqueda y carrito.
- Resumen de Studio para editar el nombre del catálogo, enlaces curados,
  visibilidad de acciones y metadata SEO de Home, Nosotros y Contacto.
- Hero audiovisual con modos imagen, carrusel y video local, poster obligatorio,
  autoplay silencioso, pausa visible, `Save-Data` y movimiento reducido.
- Páginas estáticas para home, contacto, nosotros, categorías paginadas,
  búsqueda lazy, producto, carrito, compra y políticas.
- `search-index.json`, `catalog-index.json`, JSON-LD de páginas y productos,
  sitemap de imágenes y video sitemap cuando el hero usa video. El sitemap de
  producción excluye búsqueda, carrito y compra; el draft no publica sitemaps.
- Videos MP4/WebM en Recursos, deduplicados por hash y embebidos en el ZIP.
- Preview con selector de ruta además de los marcos desktop, tablet y móvil.
- Estados empty/error/loading, foco visible, skip link y CSS responsive editorial.
- La home conserva el hero y coloca una grilla compacta de 12 productos debajo;
  el fixture de escala mantiene 50 productos y categorías paginadas para probar
  la densidad real del catálogo.
- Se corrigieron los renderizadores de `split-hero` y `editorial-hero`, incluyendo la
  posición de imagen y el aislamiento de sus clases.
- Studio usa un árbol de categorías contraíble, una toolbar de catálogo que no
  colapsa el buscador y un selector de preview compacto.
- El runtime comparte un scheduler de viewport para header y progreso de scroll;
  la grilla, búsqueda y paginación tienen estilos aislados.
- Los beneficios de confianza sin datos se omiten y se corrigieron textos fuente
  con codificación UTF-8 dañada.
- El inspector del hero ofrece edición visual de slides, incluyendo orden,
  duplicado, eliminación, media, copy y CTA.

## Escenario de escala jerárquico

El fixture complementario `catalogScaleStore` mantiene el mismo `schemaVersion: 2`
y prueba una tienda realista de catálogo: 10 categorías raíz, seis hijas bajo
Casa y Cocina, 50 productos activos y 60 variantes. `parentId` es opcional para
conservar compatibilidad con proyectos planos; los padres agregan productos de
sus descendientes y las hijas mantienen su propia página.

- Helpers compartidos: `getCategoryAncestors`, `getCategoryDescendants`,
  `getCategoryProductIds` y `getCategoryBreadcrumb`.
- Novedades contiene 35 productos y genera una segunda página rastreable.
- Búsqueda indexa los nombres e IDs de categorías ancestrales.
- El exporter deduplica assets y mantiene la misma semántica en preview y ZIP.
- Studio muestra el árbol, cantidades directas/heredadas y permite reubicar una
  categoría con bloqueo de ciclos y profundidad inválida.
- El escenario Chromium cubre navbar, subcategorías, paginación, producto 50,
  búsqueda por ancestro y layout móvil.
- Studio crea de forma idempotente `Demo catálogo jerárquico` al iniciar y lo
  muestra en el dashboard con 50 productos y 60 variantes.

El fixture se exporta desde `@solara/project-schema/scale-fixture` y se mantiene
separado del fixture visual pequeño y del benchmark de 1.000 productos.

## Verificación ejecutada

- `corepack pnpm typecheck`
- `corepack pnpm test`
- `corepack pnpm build`
- `corepack pnpm benchmark:export`
- `corepack pnpm test:e2e` (Chromium)
- `corepack pnpm check:budgets`
- `corepack pnpm pilot:preflight`
- La matriz manual con Node 24 permite Chromium y WebKit, pero Firefox no puede
  crear páginas con Playwright 1.55. El script release exige Node 22, por lo
  que la matriz oficial queda para CI con Node 22.

## Riesgos y límites conocidos

- El video se guarda autocontenido como data URL y no se transcodifica en el
  navegador; el límite inicial es 30 MB.
- El checkout sigue terminando en WhatsApp, por lo que la elegibilidad Merchant
  se mantiene como advertencia.
- La publicación real, dominio y credenciales de Google continúan fuera del
  runtime local.

## Próximo trabajo

Auditar manualmente las composiciones del nuevo storefront con foco en la grilla
de productos posterior al hero, añadir escenarios Playwright específicos de
densidad responsive y luego pasar el gate release con Lighthouse, axe y
Firefox/WebKit.

## Cierre de la integracion v2

La integracion actual tambien cubre el selector de rutas del preview, la
edicion de Home, Nosotros y Contacto desde el constructor, el ordenamiento de
enlaces del navbar, y la visibilidad configurable del shell. Preview y ZIP
comparten las mismas secciones, estilos deduplicados y metadatos audiovisuales.

El storefront incluye galeria de producto, filtros client-side de categoria,
productos relacionados, estados vacios, foco restaurado en carrito y menu,
trampa de foco, Escape, navegacion por teclado y validacion de media y destinos
internos antes de exportar.

El gate local final verificado para este cambio es:

```text
corepack pnpm check
corepack pnpm build
corepack pnpm check:budgets
corepack pnpm benchmark:export
corepack pnpm pilot:preflight
corepack pnpm test:e2e
```

La matriz release con Firefox/WebKit requiere Node 22 en CI; este entorno local
usa Node 24 y por eso no se presenta como una ejecucion release exitosa.
