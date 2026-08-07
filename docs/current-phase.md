# Tienda base `catalog-modern` y flujo guiado editable

## Cierre del servidor local

El lanzador de Windows inicia un servidor Node administrado con una sesión local
de un solo uso. En la pantalla principal de Studio, `Cerrar app` aparece sólo
cuando esa sesión está disponible. La confirmación detiene el proceso Node que
registró el lanzador y deja intactos IndexedDB, respaldos y exportaciones. El
servidor manual de desarrollo no expone el endpoint, así que Studio no puede
detener procesos que no inició.

## Flujo guiado de creación

La experiencia principal comienza en `Preparar`, no en un canvas libre. Cada
tienda nueva se crea con `buildCatalogModernProject({ seed: "clean" })`: conserva
el shell, la home, la navegación y los estados vacíos, pero no copia productos,
categorías ni colecciones de la demo. La checklist calcula requisitos desde el
mismo proyecto que usa el renderer y lleva a `Resumen`, `Recursos`, `Catálogo`,
`SEO` o `Exportar` según el pendiente.

- `Resumen` concentra marca, contacto, WhatsApp, navegación y textos de Home,
  Nosotros y Contacto.
- `Recursos` procesa imágenes fuera del hilo principal, deduplica por hash y
  separa la carga de videos para evitar lotes ambiguos.
- `Catálogo` permite crear productos uno a uno con pasos de datos, imágenes,
  organización y variantes, o importar una carpeta comercial con `productos.csv`
  e `imagenes/`. La importación crea categorías y colecciones faltantes, agrupa
  variantes, muestra una revisión y se aplica como una sola operación reversible.
- El primer producto activo o la primera importación activa automáticamente las
  grillas base intactas; no se habilitan módulos opcionales por sorpresa.
- `Modo avanzado` permite editar la secuencia completa y agregar módulos extra.
  En tiendas limpias las secciones esenciales quedan protegidas hasta que el
  usuario elige explícitamente ese modo.
- Si llega una versión nueva de la plantilla, `Preparar` muestra un plan con
  cambios seguros y conflictos. Antes de adoptar cambios se descarga un
  respaldo `.solara.json` y se conservan los settings del usuario.

`Predeterminado` es la tienda ficticia de referencia y se genera con la misma
fábrica para conservar una referencia de 50 productos, 14 categorías y 60
variantes. `Crear tienda` continúa usando la semilla limpia.

## Estado

Implementado el contrato v2 y una tienda base de catálogo moderno inspirada en
las referencias SHOP.CO compartidas: navegación compacta, hero editorial,
grillas densas de productos, categorías explorables, reviews estáticas,
newsletter y footer operativo. Studio, preview y exportación siguen usando el
mismo renderer.

## Cambios entregados

- `StoreProjectV2Schema` con navegación curada, páginas editables, templates
  comerciales y assets de video locales.
- `schemaVersion: 2` y reset controlado de únicamente
  `solara-commerce-studio` mediante `localStorage["solara-studio-storage-version"]`.
- Respaldos `.solara.json` con manifest v2; los respaldos v1 se rechazan sin
  modificar el archivo original.
- Navbar con Inicio, Categorías de hasta dos niveles, Contacto, Nosotros,
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
- Videos MP4/WebM en Recursos, deduplicados por hash e incluidos en la
  exportación.
- Preview con selector de ruta además de los marcos desktop, tablet y móvil.
- Estados empty/error/loading, foco visible, skip link y CSS responsive editorial.
- La home moderna conserva el hero y coloca grillas de 12 y 8 productos debajo;
  el fixture `catalogModernStore` mantiene 50 productos, 14 categorías y 60
  variantes para probar la densidad real del catálogo.
- Se corrigieron los renderizadores de `split-hero` y `editorial-hero`, incluyendo la
  posición de imagen y el aislamiento de sus clases.
- Studio usa un árbol de categorías contraíble, una toolbar de catálogo que no
  colapsa el buscador y un selector de preview compacto.
- El runtime usa IntersectionObserver para el header y las entradas en viewport;
  los presets de progreso usan CSS scroll-timeline cuando existe, sin listeners
  globales de scroll. La grilla, búsqueda y paginación tienen estilos aislados.
- Los beneficios de confianza sin datos se omiten y se corrigieron textos fuente
  con codificación UTF-8 dañada.
- El inspector del hero ofrece edición visual de slides, incluyendo orden,
  duplicado, eliminación, media, copy y CTA.
- Catálogo ofrece un CSV comercial separado: agrupa variantes por producto y
  conserva categorías, colecciones, opciones, identificadores e imágenes; se
  procesa en el mismo Web Worker del CSV técnico.
- La matriz de revisión visual de Catalog Modern cubre home, categoría,
  producto, carrito y preview en [`docs/design-references/catalog-modern/comparison-matrix.md`](design-references/catalog-modern/comparison-matrix.md).
- Las categorías modernas generan filtros de opciones desde
  `Variant.optionValues`; el producto tiene tabs progresivos de detalles,
  políticas y reseñas; el carrito muestra subtotal, entrega a coordinar y
  total estimado desde la misma fuente local.

## Familias visuales y tienda de referencia

La familia `catalog-modern-v1` es la base editable para nuevas tiendas. Usa
tokens monocromáticos, tipografía display pesada disponible localmente, tarjetas
de producto con imagen cuadrada, precio y disponibilidad, y una densidad cercana
al catálogo de las referencias. La primera pantalla prioriza la propuesta de
valor y la entrada al catálogo; la sección de productos no depende de JavaScript.

Incluye módulos nuevos para anuncio, header, hero audiovisual, marcas, grillas,
detalle de producto, bento de categorías, testimonios, newsletter, carrito y
footer. Las secciones anteriores permanecen como `legacy-editorial-v1` de
compatibilidad: no se muestran como opciones nuevas, pero siguen renderizando
proyectos que las usan.

El renderer de exportación se carga como chunk diferido cuando Studio necesita
Preview, SEO o Exportar. El bundle inicial conserva el presupuesto de JavaScript;
el worker de exportación y el renderer público no bloquean el arranque del editor.

`buildCatalogModernProject({ seed: "clean" | "demo" })` es la fábrica única de
la plantilla. Las tiendas nuevas usan `clean`: conservan el shell, la home y
los estados vacíos, pero empiezan sin productos, categorías ni colecciones. La
semilla `demo` alimenta `catalogModernStore` y la tienda `Predeterminado`, que
prueba copy, variantes, categorías y exportación con cuatro assets reutilizados;
no se crea un archivo por producto.
El dashboard abre el estudio directamente en `Preparar`: la base limpia conserva
un modo guiado para completar marca, recursos, catálogo y publicación. El modo
avanzado permite editar secciones y agregar módulos extra. El origen y la
versión de plantilla quedan en `project.origin` sin cambiar `schemaVersion: 2`.

### Dashboard local Cosmic

La pantalla de selección de tiendas se aisló visualmente del storefront y del
Studio de edición. Usa una superficie dark-tech cósmica, el logo orbital local y
un fondo procedural WebGL sin video ni dependencias nuevas. La cuadrícula de
proyectos muestra sólo datos reales del snapshot local: estado, productos
activos, categorías, colecciones, recursos y fecha de actualización. El panel
lateral concentra abrir, respaldar, duplicar y archivar/restaurar; la selección
no modifica ningún proyecto hasta que se ejecuta una acción explícita.

El toolbar permite búsqueda tolerante a acentos, filtro por estado, orden por
nombre/fecha/productos y vista de grilla o lista. El fondo baja a un fallback
CSS si WebGL no está disponible y pausa su render cuando la página no está
visible o el usuario prefiere movimiento reducido. El botón `Cerrar app` sólo
detiene el servidor local administrado por el lanzador; nunca borra datos.

## Escenario de escala jerárquico

El fixture complementario `catalogScaleStore` mantiene el mismo `schemaVersion: 2`
y prueba una tienda realista de catálogo: 9 categorías raíz, seis hijas bajo
Casa y Cocina, 50 productos activos y 60 variantes. `parentId` es opcional para
conservar compatibilidad con proyectos planos; los padres agregan productos de
sus descendientes y las hijas mantienen su propia página.

- Helpers compartidos: `getCategoryAncestors`, `getCategoryDescendants`,
  `getCategoryProductIds` y `getCategoryBreadcrumb`.
- Casa contiene 28 productos y genera una segunda página rastreable sin categorías de campaña.
- Búsqueda indexa los nombres e IDs de categorías ancestrales.
- El exporter deduplica assets y mantiene la misma semántica en preview y
  exportación.
- Studio muestra el árbol, cantidades directas/heredadas y permite reubicar una
  categoría con bloqueo de ciclos y profundidad inválida.
- El escenario Chromium cubre navbar, subcategorías, paginación, producto 50,
  búsqueda por ancestro y layout móvil.
- Studio crea de forma idempotente `Predeterminado` al iniciar y lo muestra en
  el dashboard con 50 productos y 60 variantes. Si existe la base limpia
  anterior sin cambios, la archiva como `Base limpia anterior` antes de crear
  la referencia; nunca sobrescribe una tienda que el usuario haya editado.

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
- El release multibrowser requiere ejecutar Node 22; el entorno local actual
  usa Node 24. La fuente Archivo Variable y un sprite SVG empaquetado quedan
  fuera hasta disponer de los assets de distribución definitivos; mientras
  tanto se conserva la pila local sin descargas remotas.
- La publicación real, dominio y credenciales de Google continúan fuera del
  runtime local.

## Próximo trabajo

Auditar manualmente las composiciones del nuevo storefront con foco en la grilla
de productos posterior al hero, añadir escenarios Playwright específicos de
densidad responsive y luego pasar el gate release con Lighthouse, axe y
Firefox/WebKit. Después se puede continuar con mejoras de edición de imágenes y
SEO avanzado sin reintroducir módulos legacy en la base.

## Optimizacion automatica post-generacion

La fase activa incorpora `packages/site-optimizer` como auditoria pura y
determinista. Recibe un `StoreProjectV1`, no muta el proyecto y devuelve un
`OptimizationReport` con hash del snapshot, score, hallazgos por area, rutas
indexables, cobertura factual, metricas de media y optimizaciones aplicadas por
el exporter.

El exporter usa el informe antes de construir archivos. HTML inicial, JSON-LD,
sitemap, `google-merchant.xml`, `ai-context.json` y `llms.txt` parten del mismo
proyecto validado. En modo production los errores criticos bloquean la
exportación; en draft se muestran para poder corregirlos sin publicar.

Los artefactos publicos para agentes son opcionales y se controlan con
`ExportOptions.publicAiContext` (activado por defecto en Studio):

- `ai-context.json`: entidades, paginas, categorias, productos, ofertas y
  politicas publicas, sin data URLs.
- `llms.txt`: resumen legible con enlaces canonicos a paginas y productos.

La auditoria no intenta fabricar datos faltantes ni contenido SEO en masa. Los
hallazgos apuntan a la ruta del editor para que la correccion conserve la verdad
del catalogo. La verificacion local es:

```text
corepack pnpm check:optimization
```

Este comando cubre la demo de 50 productos, `catalogScaleStore` (9 raices,
15 categorias y paginacion) y la plantilla limpia sin inventario. `corepack pnpm
check` lo ejecuta como parte del gate general.

El gate de budgets comprueba además el runtime storefront con los límites
actuales en bytes crudos (sin gzip): 52 KiB de JavaScript y 8 KiB de CSS. La
medición usa las constantes que realmente se insertan en `storefront.js` y
`storefront.css`, no un bundle de referencia separado.

## Cierre de la integracion v2

La integracion actual tambien cubre el selector de rutas del preview, la
edicion de Home, Nosotros y Contacto desde el constructor, el ordenamiento de
enlaces del navbar, y la visibilidad configurable del shell. Preview y
exportación comparten las mismas secciones, estilos deduplicados y metadatos
audiovisuales.

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

En el preview, las imágenes no reciben `src` temporal: se declaran como datos
pendientes, el iframe las solicita por `postMessage` y recién entonces asigna
URLs `blob:` eager. Así no hay 404 iniciales ni dependencia de desplazar el
iframe; la exportación pública mantiene lazy-loading para no aumentar la carga.

El preview deduplica assets embebidos: el `srcdoc` sólo contiene las rutas de
los recursos usados. El iframe los solicita por `postMessage`, los convierte a
URLs `blob:` dentro de su propio sandbox y evita iframes gigantes sin relajar
la política de aislamiento.

## Persistencia local en disco

La fase activa agrega un segundo nivel de persistencia para el uso mediante
`Abrir SolaraCommerce.cmd`:

- `proyectos/<slug-inicial>--<id-corto>/` es la carpeta estable de cada tienda.
- `manifest.json` apunta a la única versión editable actual y a la última
  exportación pública válida.
- `actual/` conserva el `.solara.json` confirmado más reciente; las versiones
  anteriores pasan a `respaldos/` y nunca se eliminan automáticamente.
- `sitios/` contiene cada exportación production como carpeta, lista para
  hosting estático.
- `respaldos-manuales/` recibe copias explícitas sin consumir una nueva versión.

El servidor Node local recibe la raíz de la aplicación y sólo escucha en
`127.0.0.1`. Las rutas de almacenamiento requieren la cookie `HttpOnly` de la
sesión y el mismo origen. Los uploads son streams de JSON (respaldo editable y
mapa del sitio) con SHA-256; el servidor valida el respaldo v2, limita tamaño y
archivos, valida rutas relativas del mapa del sitio y usa staging más rename
atómico para el manifiesto. Los guardados simultáneos de una tienda se bloquean
y un conflicto de versión devuelve `409`.

Studio ya no trata el autosave como confirmación de disco cuando el servidor
administrado está disponible. Cada edición crea un `RecoveryDraft` temporal en
IndexedDB y el botón `Guardar` (también `Ctrl+S`) confirma la versión completa.
Si la exportación production falla, el respaldo `.solara.json` se guarda
igualmente y el manifest queda `site-outdated`, conservando intacto el último
sitio público.
Al abrir una tienda desde disco se valida el hash y se ofrece recuperar un
borrador divergente; rechazarlo lo descarta sin modificar el archivo confirmado.

El dashboard permite crear respaldos manuales y abrir el último sitio válido en
un servidor estático temporal local. El servidor temporal se cierra junto con
SolaraCommerce y nunca expone archivos del editor.
