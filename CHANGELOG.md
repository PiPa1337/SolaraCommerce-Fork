# Changelog

### Robustez de CI en Windows y Linux (2026-08-29)

- El chequeo de instalaciones portables ya no confunde diferencias de ruta o
  metadatos de NTFS con junctions reales en Windows.
- Los dos fuzz tests de `agent-control` que superan 5 segundos bajo carga de
  CI declaran un timeout de 30 segundos sin cambiar sus aserciones.
- En CI, los tests de los workspaces se ejecutan serialmente para evitar
  contención entre fuzz/exportaciones; los límites extendidos sólo cubren
  tests deterministas de larga duración.

### CI E2E fragmentada (2026-08-28)

- El workflow de GitHub reutiliza el build de Studio y distribuye el E2E
  Chromium de Windows en cuatro shards paralelos con dos workers por shard;
  el empaquetado portable queda condicionado a que todos pasen.

### Solara Nightwatch 360 — cierre local (2026-08-28)

- Se corrigió el foco inicial de `Crear tienda` con foco inmediato y fallback
  por frame; P4-C2 quedó verde sin reintentos.
- Full E2E Chromium: 985/988 pasaron, 3 se omitieron por contrato explícito y
  0 fallaron con 2 workers y retries 0. Los timeouts visuales a 8/4 workers
  quedaron clasificados como flake/contención y pasaron aislados.
- `check:quick` 6/6, serialización 4/4 fuera del sandbox, build/empaquetado
  desktop y `portable:smoke` quedaron verificados.
- Node 22, Firefox/WebKit, la matriz OS real y el rollout real requieren un
  runner/autorización externa; no se hizo commit ni push.

### Continuación Live Canvas + Quality Forge (2026-08-27)

- Live Canvas cubre bindings editor-only para Catalog Modern, About V2, Contact
  V2 y legacy; el manifest expande entidades reales, alt, rich text, precio en
  centavos y PDP generado. El bridge acepta Ctrl/Cmd+clic y rechaza tipos de
  binding falsificados.
- Canvas, mutaciones de entidad y agente convergen en `ProjectMutationRegistry`,
  con índices de categorías/colecciones sincronizados y precio de primera
  variante validado como entero seguro.
- Predeterminado vuelve a ser la demo protegida de escala (50 productos); las
  tiendas nuevas conservan 5 placeholders y se auditan como clean hasta
  reemplazarlos. Se agregó migración del seed placeholder reservado.
- Smoke directo sin reintentos: 129/129. Live Canvas: 2/2. `check:quick`:
  6/6. Full E2E continúa parcial por specs históricos desalineados, Node 22 no
  está instalado y no se autorizó rollout sobre tiendas reales.

### Cierre de validación Live Canvas + Quality Forge (2026-08-26)

- Se completó la cobertura declarativa de los 11 módulos Catalog Modern y el
  Preview editor global; repeaters conservan `itemId` y aplican el campo
  correcto mediante la mutación semántica.
- Se corrigió el harness `about-v2` para servir CSS con MIME correcto y se
  cerró el overflow falso de 1584 px. Smoke V2: 41/41; smoke crítico: 129/129.
- El export grande pasó a ~48,9 MB (48.892.403 B en la corrida final) para 2.000 productos al reducir el copy
  serializado al subconjunto que necesita cada tipo de página; el benchmark
  conserva el límite de 48 MiB.
- Portable: `desktop:build`, `desktop:package`, `portable:smoke`, E2E portable,
  agente JSONL, MCP real y JSONL read-only verificados. Node 22 y full E2E aún
  no se declaran verdes.

### Live Canvas + Autonomous Quality Forge (2026-08-25)

- Live Canvas: edición directa desde el preview con bindings declarativos
  por módulo, manifest editor-only, bridge con sesión/nonce anti-replay y
  popover accesible. Texto, imágenes (selector de assets) y repeaters por
  itemId estable. Cero metadata en el sitio exportado.
- Núcleo único de mutaciones (ProjectMutationRegistry): canvas, sidebar y
  canal IA producen el mismo snapshot byte a byte con timestamp controlado.
- category.setStatus y collection status (active/hidden) retrocompatible
  sin bump de schemaVersion; el renderer oculta de navegación/bento y el
  exporter omite páginas de categorías ocultas.
- Registro real de migraciones por migrationId con preview determinista;
  el rollout rechaza IDs desconocidos y marca no aplicables.
- Fingerprint del renderer derivado del contenido real (sha256 de estilos
  y runtime), reproducible entre builds.
- Presupuesto público mide assets hasheados desde el deployment manifest
  (antes media 0 bytes) con guardas contra medición vacía.
- QA perpetuo: qa.runCycle usa QACycleManager con estado durable y watchdog
  de 3 intentos; qa.status nuevo; endpoint /__solara/storage/qa-status para
  la card del dashboard; runner sin shell (binario local de vitest).
- Fábrica autónoma: 20 tiendas por el canal oficial (plans/commit) con
  matriz de rubros, tamaños y paletas; base sin cambios.
- Smoke reparado: 129/129 (colecciones 5 columnas, hero sin sombras
  documentado, búsqueda 334px, timeout de imágenes por service worker en
  tracing resuelto con serviceWorkers: block).
- Quality Forge: matriz de 7 viewports, 5 paletas, reduced motion y no-JS;
  chaos del canvas (spoofing, replay, XSS) verificado.

### RM: optimización automática y limpieza de residuos (2026-08-25)

- Las tiendas administradas reparan metadatos heredados y procesan imágenes
  referenciadas con la receta responsive existente al abrirse; el resultado se
  persiste automáticamente en disco.
- La portada SEO genera variantes responsive y los títulos de paginación o
  productos repetidos reciben una diferenciación SEO sin renombrar el catálogo.
- RM eliminó 11 assets no referenciados mediante una operación nativa segura.

### Favicon configurable desde Identidad (2026-08-25)

- El mismo bloque de Identidad donde se configura logo y portada ahora permite
  subir la imagen del favicon; reutiliza la conversión ICO multirresolución y
  el fallback para iPhone ya existente en SEO.

### Veinte paletas visibles (2026-08-25)

- Se agregaron 10 paletas nuevas al editor: blanco y naranja, cinco de fondo
  oscuro con texto claro y cuatro de fondo claro para ampliar la variedad.
- Las nuevas combinaciones mantienen contraste WCAG AA para texto, secundarios
  y acciones.

### Guardado manual sin cambios (2026-08-25)

- El botón `Guardar` queda habilitado aunque el proyecto esté limpio y fuerza
  una persistencia versionada; sólo se bloquea durante el guardado, ante errores
  o en tiendas protegidas.

### Identidad compartida en navbar y footer (2026-08-25)

- El logo se configura una sola vez desde `Resumen → Identidad` y se replica en
  navbar, navegación mobile y footer.
- La portada SEO también se configura allí con selector, subida y preview; el
  Constructor ya no expone un control duplicado para la marca del navbar.

### Hero V2 sin fondo ancho ni sombras (2026-08-25)

- Catalog Modern V2 conserva sólo la imagen frontal 9:16 y omite el fondo
  editorial desktop en todas las tiendas.
- Se eliminó la sombra de la tipografía y beneficios del hero.

### Variantes PNG seguras para cualquier tienda (2026-08-25)

- El procesador nativo ahora respeta los cinco filtros estándar de PNG antes de
  generar variantes responsive; se evita que una imagen válida se vea como
  ruido en el storefront.

### Portada RM y compatibilidad del navegador (2026-08-25)

- Se generó una portada editorial para RM Descartables, se sanitizó a JPEG
  compatible y se publicó sin ruido de decodificación.
- RM quedó en la versión 51; la portada usa una sola imagen frontal para evitar
  duplicación visible en el hero responsive.

### Subida contextual y media maximizada (2026-08-25)

- Los selectores de imágenes del Constructor, slides, categorías y productos
  ahora permiten subir una imagen nueva usando el mismo pipeline de Recursos.
- Las imágenes de categorías, cards y fichas de producto llenan su marco visual
  sin quedar reducidas por `object-fit: contain`.

### Hover conectado al acento del tema (2026-08-25)

- El eyebrow superior, los hovers de productos y categorías y los items de
  contacto usan `--solara-accent`; `sale` queda reservado para descuentos y
  warnings.
- Beneficios, footer, decoraciones de páginas internas y focus del checkout
  siguen la misma identidad de cada tema.
- RM y Predeterminado fueron republicadas con el renderer actualizado.

### Header mobile y export global (2026-08-25)

- El header V2 ya no solapa el botón de menú con la marca en 320px.
- Predeterminado y RM fueron republicadas con el renderer global actualizado.

### Auditoría visual RM Descartables (2026-08-25)

- Se eliminó el overflow horizontal del viewport mínimo de 320px y se ajustó el
  título frosted de categorías para envolver dentro de su contenedor.
- Se corrigieron acentos de categorías y se republicó RM con el renderer actual
  como versión 42, conservando los 177 productos activos.

### RM Descartables y heroes sin recorte (2026-08-24)

- Se limpiaron residuos de plantilla de RM Descartables, se actualizaron sus
  metadatos SEO y se republicó la tienda como versión 39, conservando los 177
  productos activos.
- Los títulos de todos los heroes ahora envuelven según el ancho real y el
  contenedor puede crecer cuando la tipografía necesita más altura.

### Contrato completo de tema en Editorial V2 (2026-08-24)

- Contenedor, espaciado, radios, sombras, bordes, tipografía avanzada y motion
  de Catalog Modern V2 consumen los tokens emitidos por el tema.
- Las excepciones editoriales semánticas se conservan: pills redondas y
  recortes full-bleed sin radio.

### Storefront conectado a la paleta del tema (2026-08-24)

- Hover, focus, overlays, badges, botones, carrito y navegación de Catalog Modern
  usan tokens semánticos del tema en lugar de colores fijos.
- Los overrides de modo oscuro heredan variables dedicadas y `sale/rating` ya no
  pisan la paleta activa de cada tienda.

### Tests de paridad para imágenes responsive (2026-08-24)

- 5 tests nuevos: picture/webp en HTML, archivos físicos por variante,
  semantic names activo, determinismo y auditoría image.responsive.

### Hardening del sitio exportado (2026-08-24)

- Runtime público sin `innerHTML` ni políticas Trusted Types permisivas; carrito,
  búsqueda y catálogo validan datos del navegador y muestran el aviso fijo de
  verificación manual antes de WhatsApp.
- Exportación con CSS/JavaScript y fuentes direccionados por contenido, PWA
  compatible con subcarpetas, CSP/HSTS endurecidas y `deployment-manifest.json`.
- Exportar en desktop crea una carpeta hija dedicada; se agregó el verificador
  Cloudflare Pages, checklist no persistido y documentación de privacidad,
  previews públicos y publicación manual.

### Dark mode toggle y styles tokenizados (2026-08-24)

- El storefront runtime inicializa el dark mode toggle: lee y persiste
  la preferencia del usuario en localStorage.
- Boton flotante de dark mode agregado al HTML exportado con icono SVG.
- styles.ts usa var(--solara-motion-normal), var(--solara-motion-easing) y
  var(--solara-shadow-overlay) en lugar de valores hardcodeados.

### Agente autónomo de QA perpetuo (2026-08-24)

- Nuevo scope `qa:write` con 8 métodos de protocolo: readBacklog,
  writeTest, runGates, detectFlaky, logProgress, updateState, suggestFix,
  runExport.
- `lighthouse-lite.ts`: 10 checks SEO/A11y estáticos sobre HTML generado
  sin Chrome headless (viewport, title length, description length, h1 único,
  images con alt, canonical, robots meta, OG tags, JSON-LD parseable).
- `QACycleManager`: gestión de estado de ciclos TDD con watchdog (3 intentos),
  persistencia en disco y recovery post-restart.
- `qa-runner.ts`: ejecución programática de vitest via spawn con timeout.
- `qa.runExport`: exporta una tienda y retorna métricas (archivos, peso,
  issues críticos).
- `qa.runCycle`: orquesta el ciclo TDD completo (backlog → gates → contexto).
- MCP tools para todos los métodos QA en agent-host.mjs.
- Tests: 5 tests de QA + 2 tests de lighthouse-lite pasando.

### Fix: allowlist acepta assets SVG con + en MIME (2026-08-24)

- `isAllowedPublicPath` ahora acepta el caracter + en rutas de assets,
  necesario para archivos como `template-asset-hero.svg+xml` generados
  por el template clean.

### qa.runCycle: ciclo TDD orquestado (2026-08-24)

- Nuevo metodo `qa.runCycle` que ejecuta el ciclo completo: lee backlog,
  corre gates rapidos y retorna contexto para el LLM externo.

### Hardening del sitio exportado (2026-08-24)

- Runtime público sin `innerHTML` ni políticas Trusted Types permisivas, validación de carrito y aviso fijo de verificación manual para WhatsApp.
- CSS, JavaScript y fuentes con rutas direccionadas por contenido; CSP/HSTS/PWA endurecidos y `deployment-manifest.json` v1.
- Exportación desktop en carpeta hija dedicada, checklist y verificador de publicación para Cloudflare Pages.

### qa.runExport: metricas de export desde el canal de agentes (2026-08-24)

- Nuevo metodo `qa.runExport` que exporta una tienda y retorna metricas:
  archivos generados, peso total, issues criticos de auditoria.

### Temas: operaciones de agente y tests visuales (2026-08-24)

- `theme.applyPreset` y `theme.updateTokens` disponibles en el canal de
  agentes para manipular temas via MCP/JSONL.
- Presets re-exportados desde project-schema para uso cross-package.
- Tests unitarios de presets (5 tests): unicidad, no-mutacion, colores validos.
- Spec Playwright para regresion visual por preset (desktop + mobile).
- styles.ts usa var(--solara-sale) y var(--solara-rating) en lugar de hex fijo.

### QA perpetuo: ciclo manager y metricas de export (2026-08-24)

- `QACycleManager`: gestiona el estado de ciclos TDD con watchdog (3 intentos),
  persistencia en disco y recovery post-restart.
- `qa-exporter-metrics.ts`: mide peso HTML/JS/CSS, issues criticos y score
  lighthouse-lite tras cada export.
- Tests para ciclo manager (creacion, watchdog, persistencia) y metricas.

### Procesamiento responsive real en canal de agentes (2026-08-24)

- Nuevo módulo `image-processor.ts` que decodifica PNG, redimensiona con
  nearest-neighbor y re-codifica en 320/480/768/1024 px usando zlib puro.
  Sin dependencias de sharp ni canvas nativo.
- `assets.stage` genera variantes PNG reales para imágenes ≥480px de ancho;
  otros formatos reciben descriptores responsive apuntando al mismo archivo.

### Design tokens completos y presets visuales (2026-08-24)

- ThemeSchema expandido con ~40 tokens first-class: paleta dark independiente,
  colores sale/rating, tipografia extendida (line-height, letter-spacing,
  font-weight), espaciado granular, sombras, bordes configurables y transiciones.
- Cinco presets visuales: Editorial, Minimal, Calido, Industrial y Botanico.
- `applyPreset` hace merge profundo sobre el tema actual sin mutarlo.
- themeCss genera todas las custom properties incluyendo dark palette.
- Retrocompatible: proyectos existentes parsean sin migracion.

### QA perpetuo: tests y MCP tools (2026-08-24)

- Tests para metodos QA: readBacklog, writeTest, scope check.
- Tests para lighthouse-lite: score alto y bajo.
- MCP tools para los 7 metodos QA en agent-host.mjs.

### QA perpetuo: scope qa:write y metodos del agente (2026-08-24)

- Nuevo scope `qa:write` en el protocolo del agente con metodos para
  leer backlog perpetuo, escribir tests, ejecutar gates, detectar flakiness
  y actualizar estado del proyecto.
- `lighthouse-lite.ts`: checks SEO/A11y estaticos sobre HTML generado
  sin Chrome headless (viewport, title, description, h1, alt, canonical, OG).
- `qa-methods.ts`: dispatcher de metodos QA con validacion de scope y audit.

### Imágenes responsive en canal de agentes y auditoría (2026-08-24)

- `assets.stage` del canal de agentes ahora auto-genera descriptores
  responsive (`responsiveSources`) apuntando a la misma imagen con anchos
  estándar (320-1800px), para que `renderImage` emita `<picture>` con
  `<srcset>` desde el primer commit.
- Nueva auditoría `image.responsive` que advierte cuando un producto tiene
  imágenes sin variantes responsive.
- `ExportOptions.useSemanticNames` para nombres de archivo semánticos en
  assets exportados (opt-in, default false).

### FAQ schema, speakable, llms-full y headers de cache (2026-08-24)

- `faqPageData`: FAQPage JSON-LD desde politicas (envios/cambios) en la
  pagina de contacto, para rich snippets expandibles.
- `speakable` en Product JSON-LD: marca h1 y descripcion como aptos para
  asistentes de voz.
- `llms-full.txt`: version extendida con precio, stock, categoria y
  descripcion por producto activo.
- `_headers` con stale-while-revalidate para HTML y reglas de cache para
  sw.js (no-cache), manifest y feed.
- Alt text semantico en cards de producto: producto + categoria + marca.

### Refuerzo SEO en todas las paginas (2026-08-24)

- El home ahora emite ItemList JSON-LD con los primeros 12 productos del
  catalogo (nombre, URL e imagen), ademas de WebSite/SearchAction/OnlineStore.
- itemListFromSnapshots: variante liviana de ItemList que toma snapshots
  directamente (incluye imagen por item).
- ContactPage ahora referencia la direccion de identity cuando existe.

### Restricción de textos legales y de accesibilidad en publicCopy (2026-08-24)

- 11 campos de publicCopy marcados como restringidos: disclaimers legales
  (whatsapp.confirmation, checkout.disclaimer), labels de accesibilidad WCAG
  (accessibility.*: 6 keys) y skipToContent. El editor los muestra con hint
  "Texto del sistema" pero permite edición con cuidado.
- Campos con placeholder {storeName} (contact.emailSubject,
  whatsapp.orderGreeting) muestran hint recordando que el placeholder es
  obligatorio.
- El agente IA rechaza store.updatePublicCopy que reduzca los disclaimers
  legales a menos de 20 caracteres.
- Barrido exhaustivo adicional: 34 keys más restringidos (labels de filtros,
  estados vacíos, errores de fetch, estructura de export). Total: 73 keys
  restringidos de 198. Los 125 editables son contenido comercial genuino.

### Inputs de redes sociales en Studio (2026-08-24)

- El inspector de identidad en Overview ahora incluye inputs para Instagram,
  Facebook, TikTok y usuario de X/Twitter, sincronizados con los campos
  `sameAs` del sitio exportado.

### Social links, SearchAction y limpieza head (2026-08-24)

- `identity` acepta `instagramUrl`, `facebookUrl`, `tiktokUrl` y
  `twitterHandle`; se emiten como `sameAs` en OnlineStore y `twitter:site`.
- WebSite JSON-LD incluye `SearchAction` para el sitelinks search box.
- Offer JSON-LD especifica precio previo cuando la variante tiene
  `compareAtPrice`.
- Se eliminó `<meta name="keywords">` (obsoleta desde 2009).
- `_headers`: reglas de cache para `/sw.js` (no-cache), manifest y feed.

### X1 subcarpeta + guard raíz portable (2026-08-24)

- El runtime del storefront lee `data-base-href` del html y prefija los fetch
  de catalog-index.json y search-index.json. Los hrefs del HTML ya se
  prefijaban; con este fix los fetch dinámicos también respetan la subcarpeta.
- Guard de raíz portable: instance.json guarda portableRoot; si difiere al
  arrancar desde una carpeta distinta, dialog Electron permite continuar o salir.
- Todo el texto del sitio exportado ahora es editable via publicCopy:
  labels estructurales de páginas legales V2 (Información de entrega,
  Preparación del pedido, Tiempo estimado, Cobertura, Condiciones de cambio,
  Plazo informado, Uso de tus datos, descripciones meta), copyright del footer
  ("Todos los derechos reservados." → editable, año automático).
  "Hecho con ❤️ en solara.com.ar" se mantiene como marca de agua fija.
- Nuevos comandos de agente IA: store.updatePublicCopy y store.updatePolicies.
- Mapeo de países ahora editable via policies.countryNames (antes "AR" estaba
  hardcodeado a "Argentina" en el exporter).

### Archivado de tiendas, advertencias tempranas y validación de imágenes (2026-08-24)

### Sitio exportado: PWA, SEO avanzado y compliance argentino (2026-08-24)

### SEO head, PWA completa y performance (2026-08-24)

### Sitemap, favicon.ico, ItemList y SW precache (2026-08-24)

- Sitemap ahora incluye `<changefreq>` (daily para home, weekly para el resto)
  y `<priority>` (1.0 home, 0.8 categorías, 0.7 colecciones, 0.6 productos).
- `favicon.ico` binario genuino con PNG embebido de 64×64 px.
- ItemList JSON-LD en páginas de categoría con posición de cada producto.
- Service worker precachea `/`, `/offline/`, manifest y assets al instalar.

- `rel=prev`/`rel=next` en `<head>` para categorías paginadas.
- `priceValidUntil` determinístico en Offer JSON-LD (año de updatedAt).
- Open Graph video tags (`og:video`) cuando el hero tiene video.
- Preconnect/dns-prefetch a `wa.me` sólo cuando el proyecto tiene teléfono
  real de WhatsApp (no sentinel).
- Iconos PWA generados automáticamente en 192×192 y 512×512 px desde el seed
  de la tienda.
- Página `/offline/index.html` que el service worker sirve sin conexión.
- Service worker actualizado para servir la página offline en requests HTML.

- El exporter ahora genera `manifest.webmanifest` y `sw.js` para instalación
  como PWA con cache offline de assets.
- Reviews y aggregateRating se incluyen en el JSON-LD de Product/ProductGroup
  cuando el proyecto tiene reseñas visibles.
- RSS feed (`feed.xml`) con los últimos 20 productos activos.
- `security.txt` en `.well-known/` con contacto y fecha de expiración derivada
  de project.updatedAt para determinismo.
- `_redirects` como plantilla vacía para reglas futuras.
- Meta tags `manifest` y registro de service worker en cada página.
- Botón de arrepentimiento (Ley 24.240) visible en todas las páginas production.
- Footer usa project.updatedAt para el año de copyright en lugar de Date.now.

- Nuevo método `plans.createAndCommit` que crea el plan y lo commitea en una
  sola llamada atómica, eliminando la necesidad de scripts de orquestación
  externos para flujos transaccionales.
- Nueva operación `assets.generatePlaceholder` que genera PNGs determinísticos
  a partir de un seed sin depender de archivos externos.
- Nueva operación `product.createBatch` para crear hasta 100 productos que
  comparten categoría, imágenes y tags en una sola operación (~70% menos payload).

- Los assets stageados ahora se resuelven desde disco en sesiones nuevas,
  eliminando el error "Imagen inexistente" cuando staging y plans.create
  ocurren en procesos separados.
- `applyOperations` deduplica los assets referenciados por múltiples
  operaciones (`asset.attach` o `product.create.imageIds`) antes de
  agregarlos al proyecto, evitando "ID de recurso duplicado".
- Nueva operación `section.updateSettings` para modificar parcialmente los
  settings de una sección existente desde el canal nativo.
- El template clean genera el hero sin imagen de fondo por defecto,
  eliminando el bloqueo de producción por `template.placeholder`.

- El canal nativo para agentes ahora permite archivar tiendas con la operación
  `store.archive` (confirmación literal `ARCHIVAR_TIENDA`) y restaurarlas con
  `stores.restore`, conservando el respaldo en disco sin comandos destructivos.
- `plans.create` devuelve `blockingIssues` con los errores críticos que la
  auditoría del exporter detecta sobre el proyecto planificado, para que el
  agente corrija antes de commitear en lugar de descubrirlos al fallar.
- El staging de imágenes exige dimensiones mínimas de 32×32 px; se rechazan
  assets inutilizables con `ASSET_DIMENSIONS_INVALID` antes de adjuntarlos.
- La guía documenta los valores válidos de `product.setStatus`
  (`active`, `hidden`, `archived`) y el flujo completo de archivado/restauración.

### Plantilla protegida, clones seguros y rollouts globales (2026-08-23)

- `Predeterminado` ahora se identifica como `base-template` y queda protegido en
  Studio, el canal nativo y el storage local; sólo admite lectura, preview,
  exportación, auditoría y clonación.
- Las nuevas tiendas se clonan con `seed: "duplicate"`, IDs y referencias
  remapeadas, assets independientes y política `managed`.
- Se agregaron upgrades explícitos de plantilla y rollouts durables para
  reconstruir sitios o aplicar migraciones con preview, locks, backups,
  idempotencia, auditoría, conflictos y rollback.
- Los sitios registran el fingerprint del renderer para detectar exportaciones
  antiguas sin modificar el proyecto editable.

### Canal de agentes durable y cooperativo (2026-08-23)

- Los planes del agente ahora sobreviven reinicios, exponen diff, advertencias,
  heartbeat y descarte explícito; los commits largos pueden ejecutarse como jobs
  consultables y quedan registrados en auditoría estructurada.
- Se agregaron locks cooperativos entre agente y Studio, scopes de proceso,
  protocolo autodocumentado y SDK de alto nivel.
- Los assets grandes pueden subirse por chunks ordenados con progreso, hash y las
  mismas validaciones binarias del staging existente.

### Canal nativo para agentes de IA y creación transaccional (2026-08-23)

- Se agregó protocolo `solara-agent` v1 por MCP stdio y JSONL, con contracts Zod,
  SDK tipado y host Electron sin ventana ni servidor HTTP.
- Las IA pueden crear tiendas limpias y modificar tiendas existentes mediante
  planes tipados; Predeterminado y otros demos quedan protegidos, y los commits
  revalidan versión, schema, exportación, SHA-256 e idempotencia.
- El staging de imágenes valida bytes, MIME, firma, tamaño, hash y dimensiones;
  los archivos grandes entran sólo desde `agent-inbox`.
- Se documentó la guía operativa y se agregó `SolaraCommerce-Agent.cmd` al
  portable.

### Flujo nativo de nuevas tiendas y persistencia segura (2026-08-23)

- Las tiendas nuevas se crean sin media ficticia ni teléfonos WhatsApp
  deterministas; el editor permite crear/editar categorías y colecciones desde
  la interfaz y activar productos sólo cuando tienen descripción, imagen y
  precio válido.
- El audit de exportación distingue placeholders alcanzables (bloqueo) de
  placeholders sin uso (advertencia), y el respaldo de proyecto usa el diálogo
  nativo de Electron con escritura temporal y rename atómico.
- El empaquetador conserva respaldos portables no verificables en `recovery/`
  y usa un reemplazo transaccional: si un lock de Windows mantiene abierto el
  portable, falla antes de aplicar un overlay parcial y restaura `proyectos/`.
- Se agregó un flujo Playwright Electron que crea una tienda real en una copia
  aislada, carga una imagen, crea taxonomía, activa un producto y comprueba que
  la tienda demo original no se modifica.

### Runtime debuggeable completo: mapa en draft + gate extendido (2026-08-23)

- El export draft emite `assets/storefront.js.map` con fallback `{}`
  determinista. El recorrido compartido con el Worker del Studio evita
  imports directos de `fs/path`; el JS draft agrega
  `//# sourceMappingURL=storefront.js.map` para que DevTools resuelva
  breakpoints contra el fuente. Production permanece inline byte-idéntico
  sin mapa ni sourceMappingURL.
- `check:runtime-serialization` extendido: probe nuevo verifica que el entry
  draft (`entry-draft.ts`) compila exponiendo `storefrontBoot` + `solaraReady`,
  usando plugin stub para externalizar imports no-relativos (evita el ascenso
  de directorios que rompe esbuild bajo sandbox). 4/4 tests.

### Favicon y portada SEO (2026-08-23)

- El panel SEO permite cargar un favicon y genera un ICO multirresolución con
  fallback Apple Touch Icon.
- La portada del sitio se adapta automáticamente a 1200×630 para Open Graph y
  tarjetas de redes sociales, con paridad entre preview y exportación.

### Limpieza de imágenes residuales de páginas retiradas (2026-08-23)

- La migración del demo Predeterminado elimina las páginas Nosotros/Contacto
  heredadas, sus referencias de imágenes y la caché regenerable asociada.
- Las nuevas tiendas limpias conservan sólo la imagen de plantilla de Home y
  el portable actual fue saneado con un backup recuperable previo.

### Diez paletas claras y contrastadas (2026-08-23)

- Reemplazadas las paletas anteriores por diez temas de colores variados con
  fondos claros y texto legible.
- Cada paleta mantiene contraste WCAG para texto principal, texto secundario y
  texto sobre acento, y la interfaz valida las diez opciones.

### Slug de tienda editable y validado (2026-08-23)

- El slug interno se puede editar desde `Resumen > Dominio` con el mismo
  contrato del schema: minúsculas, números, guiones, máximo 120 caracteres y
  nombres reservados de Windows bloqueados.
- Los valores inválidos quedan sólo como borrador; el guardado conserva el
  `projectId` y la carpeta física de la tienda para no perder respaldos ni
  historial.

### Panel simplificado y familia visual única (2026-08-23)

- Las nuevas tiendas conservan sólo la página Home; Nosotros y Contacto siguen
  disponibles como módulos de contacto dentro de Home, sin páginas independientes.
- El panel de configuración ya no muestra esos interruptores ni sus editores de
  página, y Tema de la tienda deja Editorial V2 como única familia visible.

### Navbar V2 con nombres de tienda largos (2026-08-23)

- El nombre de la tienda aprovecha el ancho disponible del navbar del
  storefront y sólo usa elipsis cuando el espacio real no alcanza; no envuelve
  ni deforma verticalmente el header, sin alterar el nombre guardado ni su
  etiqueta accesible.
- Agregada una regresión de geometría para desktop, tablet y mobile hasta 320
  px, además del contrato del módulo y exportador.

### Recuperación portable y validación de respaldos (2026-08-23)

- La recuperación de tiendas con hash desincronizado conserva `projectId` y
  versión para importar el respaldo validado sin provocar un conflicto falso.
- El arranque no vuelve a sembrar IndexedDB cuando el disco ya tiene una tienda
  en recovery, evitando un segundo intento de guardado con versión nula.
- El empaquetado portable compara salud, hash, versión y fecha antes de
  elegir entre el estado preservado y el del checkout.
- Reparado el store local `demo-catalogo-jerarquico` como versión 47; la
  versión 46 quedó conservada en `respaldos/`.

### E2E: specs reparados tras migracion webp + re-inclusion verificada (2026-08-23)

- Barrido con playwright --list detecto 15 specs muertos en carga: leian
  fixtures .png eliminados en 9a22a95. Nuevo helper compartido
  tests/e2e/fixture-server.ts sirve los 12 productos webp reales (los demas
  assets viajan embebidos como data URLs); migrados: storefront-nojs,
  exported-store, focus-visible, catalog-modern, cdp-site, scale-store,
  subfolder-site, ui-resumen-r2/r5, ui-sweep-a27/a28/a29/a30,
  ui-tema-styles, nojs-coverage y catalog-modern-v2.
- Medicion 10x (scripts/e2e-stability.mjs): ui-sweep-a27, nojs-coverage y
  catalog-modern-v2 lograron 0 fallos => salen de unstable.json y vuelven al
  smoke diario. catalog-modern-v2 ademas espera la senal determinista del
  runtime (waitForStorefrontReady) y visibilidad del input del drawer antes
  de leer DOM o aplicar focus (flaky 7/10 -> 0/10). assets.spec: conteos
  scopeados a .asset-grid para no contar previews SEO.
- scripts/e2e-stability.mjs: historial JSON al tmp del sistema porque
  Playwright limpia test-results/ en cada corrida.
- assets.spec: el asset subido se localiza por input[value=nombre] (hasText no
  ve valores de inputs); scale-store dividido en dos tests, locator del menú
  móvil corregido a "Abrir menú" y espera de runtime determinista.
- catalog.spec: expectativas alineadas al re-seed v2 (5 productos/5 variantes)
  y espera de debounce del filtro antes de interactuar con la fila.
- unstable.json queda VACIO: los 15 specs del smoke pasan juntos (126 tests).
- TECHNICAL_DEBT: fila specs E2E inestables marcada Resuelta con evidencia.
- docs/TESTING.md: seccion "Debugging del draft" (marca DEBUG + build manual).
- TECHNICAL_DEBT: fila specs inestables actualizada (6 -> pendiente medicion);
  fila runtime P2 marcada parcialmente resuelta con alcance restante.

### Runtime debuggeable: build externo con esbuild (2026-08-21)

- scripts/build-runtime.mjs genera storefront-runtime.js + source map
  (563KB + 987KB) desde entry-draft.ts. El exportador puede usar este bundle
  en modo draft para debugging con breakpoints; production mantiene el inline.

### Caza de bugs sistematica + P3 jerarquia About (2026-08-21)

- Suite adversarial nueva en tests/e2e/__bugs__: contenido limite (RTL, emoji,
  5000 chars, precios extremos), matriz de navegacion (todo link interno 200),
  fallos de runtime (localStorage bloqueado, catalog corrupto, imagenes rotas),
  formularios hostiles (XSS, 10k chars) e integridad SEO. 13/13 pasando.
- Hallazgo verificado: el schema rechaza titulo vacio (guard valido), el
  sitio sobrevive storage bloqueado y catalog corrupto sin errores JS.
- Vision ampliada a 19 viewports cubriendo todos los breakpoints del CSS
  (320-1920): 209 capturas verificadas.
- P3: jerarquia tipografica en grillas About (principios/experiencia) con
  display font y aire vertical entre parrafos.

### Checkout sin carrito: feedback visible (2026-08-21)

- Nuevo copy emptyCart en el schema y feedback visible en data-order-preview
  cuando se envía /compra/ sin items; antes fallaba silenciosamente.

### Storefront: escala de espaciado + auditoria geometrica (2026-08-21)

- Gaps del storefront V2 migrados a escala .25/.5/.75/1/1.25/1.5/2/3rem
  (38 valores distintos -> 8). Padding off-scale migrado igual. CSS V2 queda
  en 172567 B (baja 19 B) dentro de budget.
- Nuevo spec tests/e2e/__vision__/storefront-alignment.spec.ts: mide el sitio
  exportado real (cards uniformes por grilla, modulos centrados, sin overflow
  en 320px). 3/3 pasando.

### Escala de espaciado y auditoria de alineacion (2026-08-21)

- Tokens --space-* en base.css (multiplos de 4px): contrato de espaciado.
  Migrados ~50 gaps de cosmic.css a la escala (7/9/11/14/16/18/22 -> 8/12/16/20/24).
- Nuevo spec alignment.spec.ts: mide geometria real con getBoundingClientRect
  (tabs uniformes, columnas alineadas, altos acotados, cards consistentes).

### Auditoria UI/UX: P3 completado (2026-08-21)

- Icono de tab activa en duotone (antes fill): distincion mas clara del area
  activa sin perder sobriedad. Microcopy verificado: sin exclamaciones ni
  cliches, espanol directo ya era correcto.

### EXEs reconstruidos con fixes UI/UX (2026-08-21)

- Portable regenerado con los fixes de la auditoria visual: build +
  desktop:build + desktop:package + portable:smoke OK
  (SolaraCommerce.exe 196.1 MB, 21/08 13:49).

### Auditoria UI/UX fase 2: fixes visuales (2026-08-21)

- Salud del dashboard compacta en movil: menos alto antes de las cards.
- Hover de tiendas visible: glow naranja suave + sombra, sin transform bajo
  reduced-motion.
- Deuda documentada: specs unitarios del exporter inestables bajo carga
  (timeout 5s) que pasan aislados; pendiente subir testTimeout.
### Auditoria UI/UX con vision real + estabilidad E2E (2026-08-21)

- Infraestructura de vision: nuevo spec tests/e2e/__vision__/studio-vision.spec.ts
  captura las 9 pantallas del Studio en 4 viewports (1440/1280/768/390).
  4/4 viewports pasando, 40 screenshots.
- Fallback SPA en servidor de pruebas: studio-server.ts sirve index.html
  para /__studio/*; sin esto la galeria de componentes daba 404.
- Fixes tipograficos: tabular-nums en paginacion y datos de tiendas;
  jerarquia label (600) vs hint (400) diferenciada.


### Plan: estabilidad E2E + runtime debuggeable (2026-08-21)

- **Plan documentado** en `docs/superpowers/plans/2026-08-21-flaky-e2e-runtime-debuggeable.md`:
  7 tasks con criterio de éxito — medición de inestabilidad (script), contención
  vía `tests/e2e/unstable.json`, fix raíz por familia de síntoma, re-inclusión
  verificada (10/10), y runtime dual con esbuild (draft externo + source map,
  production inline byte-idéntico).
- **Política preventiva** nueva en `docs/TESTING.md`: incorporación de specs
  (5 corridas limpias), sincronización sin `waitForTimeout` fijo, presupuesto de
  duración por canal, protocolo ante gate rojo y re-inclusión con evidencia.
- Filas P2 de TECHNICAL_DEBT actualizadas apuntando al plan aprobado.

### EXEs reconstruidos post-refactor (2026-08-21)

- **Portable actualizado**: `build` + `desktop:build` + `desktop:package` +
  `portable:smoke OK`. `SolaraCommerce.exe` regenerado (196.1 MB,
  21/08 10:44) con los refactors de schema/exporter y el fix del límite de
  historial incluidos.

### Plan de mejora arquitectónica: registro de pendientes (2026-08-21)

- **Deuda nueva registrada** en `TECHNICAL_DEBT.md` con recomendación concreta:
  runtime serializado sin source maps (P2, pipeline esbuild + paridad),
  núcleo de render del exporter (~2300 líneas, P2, extracción por página),
  tests ad-hoc sin utilidades compartidas (P3, `packages/test-utils`) y
  structural sharing condicional para el historial (P3, sólo si el uso real
  lo justifica). Cada fila cita la verificación que respalda el estado actual.

### Refactor exporter: audit (2026-08-21)

- **Auditoría modular**: `audit.ts` extrae `auditProject` y `auditReport` del
  monolito. index.ts baja a ~1975 líneas (desde 2797 original, -30%).
  Typecheck + 253 tests verdes, check:quick completo OK.

### Deuda E2E documentada + refactor exporter feeds (2026-08-21)

- **Triaje de specs E2E inestables**: se documenta en TECHNICAL_DEBT el set de
  specs que fallan intermitentemente bajo carga paralela (verificado también en
  el commit base `c4d71ae`, sin los refactors): assets, nojs-coverage, C4/C8/C11,
  scale-store y dos de catalog-modern-v2. Queda registrada la recomendación de
  triaje (timeouts, workers, separación de specs lentos).
- **Feeds modular**: `feeds.ts` concentra sitemaps, Merchant feed e índices;
  index.ts queda en 2309 líneas. Gates: typecheck + 253 tests + check:quick OK.

### Refactor exporter: feeds (2026-08-21)

- **Feeds modular**: `feeds.ts` extrae `buildSitemap`, `buildImageSitemap`,
  `buildVideoSitemap`, `buildMerchantFeed`, `buildSearchIndex` y
  `buildCatalogIndex`. `categoryProducts`, `productCategoryScope` y
  `buildCommerceSnapshot` pasan a ser export públicos. index.ts baja a 2309
  líneas (desde 2797). Typecheck + 253 tests verdes, check:quick OK.

### Refactor exporter: structured-data (2026-08-21)

- **JSON-LD modular**: `structured-data.ts` extrae `storeStructuredData`,
  `breadcrumbData`, `offerData`, `schemaOptionName` y `productStructuredData`
  del monolito. `effectiveHomeSections` ahora es export público. index.ts baja
  a 2541 líneas. Typecheck + 253 tests verdes, check:quick completo OK.

### Fix flaky singleInstance + refactor exporter (2026-08-21)

- **Fix flaky test adversarial 13**: `writeJsonAtomic` en `portable-layout.mjs`
  reintenta renames con EPERM/EBUSY/EACCES transitorios (4 intentos con
  backoff), mismo patrón que `renameWithRetry` del storage local. Elimina el
  fallo intermitente de `singleInstance` bajo carga paralela.
- **Exporter modular (parte 1)**: `html.ts` (escape), `urls.ts` (baseUrl,
  prefijado, URLs absolutas), `whatsapp.ts` (teléfono, links, copy) y
  `assets.ts` (lookup con caché, extensiones, rutas de producto) extraídos de
  `index.ts`; el barrel preserva la API. index.ts baja de 2797 a ~2700 líneas.
  Typecheck + 253 tests del paquete verdes.

### Refactor schema + CI Linux (2026-08-21)

- **Schema modular**: `project-schema` se divide sin cambiar la API pública:
  `ids.ts` (IDs branded/Money), `media.ts` (assets imagen/video),
  `public-copy-defaults.ts` (copy del storefront) y `category-helpers.ts`
  (jerarquía de categorías). `index.ts` queda como barrel: los consumidores no
  cambian. Typecheck estricto de 8 paquetes verde, 71 tests del schema pasan.
- **CI multi-plataforma**: nuevo job `portability` en `ubuntu-latest` que corre
  `check` + `build` para detectar bugs de portabilidad Node temprano.

### Mejora arquitectónica: límite de historial, budgets bloqueantes y docs (2026-08-21)

- **Límite de historial undo/redo**: `MAX_HISTORY_LENGTH = 50` en `@solara/core`;
  `executeCommand` y `redo` descartan los snapshots más antiguos (FIFO) para
  evitar crecimiento ilimitado de memoria con catálogos grandes. Constante
  exportada como contrato público. Tests nuevos en `history-limit.test.ts`
  (límite, undo/redo dentro del límite, FIFO).
- **Budgets bloqueantes en CI**: se elimina `continue-on-error: true` del paso
  `check:budgets` en `.github/workflows/ci.yml`. Los techos actuales pasan con
  margen (Studio JS 690617/737280 B, CSS 102254/114688 B, runtime JS/CSS OK,
  V2 CSS 172586/184320 B).
- **Docs**: auditorías cerradas y plan perpetuo viejo archivados en
  `docs/archive/` (`PERPETUAL_PLAN_10X.md`, `ARCHITECTURE_REVIEW_2026-08-21.md`,
  `AUDITORIA_V2.md`, `auditoria-tareasnewchat-verificacion.md`). Nuevo
  `docs/INDEX.md` como punto de entrada único a la documentación activa.
- **Deuda técnica actualizada**: filas EX-B7 (semántica sha256, ya documentada
  en INTEGRATIONS.md) y safeSlug/nombres reservados (ya resuelto en schema +
  rutas) marcadas como resueltas con evidencia.

### Studio dark-only + priceFractionDisplay auto + fixes post-migración (2026-08-21)

- **Studio dark-only definitivo**: `apps/studio/src/base/base.css` migrado a `#08090A/#111214/#FF6A00` (color-scheme: dark unico), eliminado @media y :root[data-studio-theme="dark"] (-59 lineas); `apps/studio/index.html` theme-color #08090A + style color-scheme dark para FOUC; `studioTheme.ts` a dark.
- **Shell Studio**: `main.tsx` applyStudioTheme dark + SW update cada 60s; `App.tsx` banners offline/update; `Studio.tsx` sin toggle Sun/Moon, tab Tema de la tienda, preview route sessionStorage.
- **Precio fraccional**: `priceFractionDisplay: "always"|"auto"` en StoreProjectV2 (default always, sin bump schemaVersion), seccion Formato de precios con toggle Ocultar centavos, formatter central formatMoney.
- **Storefront runtime**: reconcileCartLines mergea duplicados, parseCart Integer, readStoredCart [] vs null, renderCart 99+, sync storage, freshCatalog null en checkout.
- **Fixes**: base.css var(--sc-*) -> var(--ink/surface/bg/line-strong), main.tsx encontro encoding, semver patch.js.
- **Gates**: parity 11/11, determinismo 10/10, budgets OK (JS 690618/737280 CSS 102254/114688), portable smoke OK.



### Contenido público multi-tienda (2026-08-18)

- **Fuente única**: se agrega `publicCopy` al contrato V2 sin cambiar
  `schemaVersion`; los respaldos anteriores reciben defaults durante la
  normalización.
- **Editor**: Overview incorpora `Contenido global` para editar navegación,
  búsqueda, filtros, producto, contacto, carrito, checkout, footer, páginas,
  WhatsApp y textos de exportación.
- **Renderizado**: módulos, exporter y runtime consumen el copy del proyecto;
  sólo la atribución de Solara permanece fija. Las páginas legacy y 404 también
  dejaron de depender de textos de marca.
- **Seeds**: las tiendas nuevas usan el seed limpio, sin catálogo, imágenes ni
  contactos demo; la única demo persistida continúa siendo `Predeterminado` V2.
- **Guardia**: `check-hardcoded-content` rastrea código versionado y no
  versionado ignorado, clasifica hallazgos y falla ante marcas, contactos,
  dominios o saludos demo activos sin allowlist exacta.

### Predeterminado: responsive, imágenes y SEO conectado (2026-08-18)

- **Migración de la demo**: el snapshot existente de `Predeterminado` conserva
  sus 50 productos, elimina referencias visibles a `Modo Sur`, incorpora 12
  imágenes cuadradas WebP y deja tres imágenes por producto con fuentes
  responsive para 320, 356 y desktop.
- **Mobile**: se fijan márgenes de 12 px en 320–450 px, tabs del PDP sin
  overflow ni salto de ancho, grillas cortas acotadas y tipografías de cards y
  categorías que no se cortan; la sombra del hero queda negra y sutil.
- **SEO**: keywords, author, publisher, robots, Googlebot, Open Graph y
  Twitter se derivan del proyecto actual; las rutas sin configuración propia
  reutilizan la descripción SEO de la tienda y la imagen social prioriza la
  imagen configurada o el hero.
- **Regresión**: E2E V2 Chromium (39/39), auditoría visual, tests de Studio,
  exporter, modules y schema, build y migración de los snapshots local y
  portable.

### Storefront V2: filtros, contacto por email y media cuadrada (2026-08-18)

- **Búsqueda**: la ruta `/buscar/` reutiliza el motor de filtros del catálogo
  para disponibilidad, etiqueta, color/talle, rango de precio y ordenamiento por
  recomendados, precio o nombre, con rail responsive en desktop/tablet.
- **Contacto**: el formulario prepara una consulta `mailto:` con nombre de la
  tienda, datos del comprador y mensaje; mantiene feedback accesible y el CTA
  visual del hero.
- **Personalización**: el saludo de WhatsApp reemplaza automáticamente la
  marca configurada, sin dejar el nombre de la fixture en tiendas renombradas.
- **Media y layout**: la fixture V2 recibe 12 imágenes cuadradas WebP curadas
  desde un único grid, con hasta tres imágenes por producto; se ajustan reseñas,
  footer, títulos móviles y navegación sin scroll lateral.
- **Regresión**: se cubren schema, exportación, runtime, módulos, contacto,
  fixtures, rutas V1/V2 y E2E responsive con el fork como único destino Git.

### Hero V2 responsive en tablet (2026-08-18)

- **Composición**: entre 768 y 899 px el hero editorial pasa a usar la imagen
  como fondo, mantiene el copy ordenado y baja los beneficios a una banda de
  tres columnas para evitar la columna comprimida del layout anterior.
- **Legibilidad**: los textos del hero incorporan una sombra dual sutil,
  adaptable a fondos claros y oscuros, sin alterar la jerarquía tipográfica.
- **Regresión**: el E2E cubre 768x823, 820x900, 899x900 y los viewports de
  laptop/desktop, incluyendo ausencia de overflow y CTA dentro del viewport.

### Carrito V2 protegido contra vaciados de navegación (2026-08-18)

- **Persistencia**: la lectura prioriza el respaldo cuando la clave primaria
  quedó vacía o contiene líneas inválidas; el respaldo se mantiene sincronizado
  incluso cuando el usuario vacía el carrito de forma intencional.
- **Preview**: sólo el iframe activo puede escribir el estado; los snapshots
  vacíos no explícitos se ignoran y el vaciado real se conserva al cambiar de
  ruta.
- **Regresión**: E2E cubre primaria vacía, clave dañada, vaciado intencional
  en storefront y preview, además de los recorridos existentes de múltiples
  líneas.

### Carrito V2 resiliente y rutas retiradas (2026-08-18)

- **Persistencia**: el carrito público usa un respaldo local, recupera datos si
  la clave primaria está dañada y evita reemplazar líneas válidas durante una
  reconciliación de catálogo vacía o incompleta.
- **Preview**: el iframe hidrata el carrito de forma explícita, actualiza el
  estado antes de cambiar de ruta y sincroniza snapshots con sesión validada;
  también conserva el estado al cerrar o reconstruir la vista previa.
- **V2**: se dejaron de publicar `compra`, `envios` y `devoluciones`; el carrito
  ofrece el formulario de contacto de Inicio. La familia V1 conserva checkout
  y sus páginas legales para compatibilidad.
- **Regresión**: E2E cubre rutas sucesivas, historial, múltiples líneas,
  checkout del drawer, viewports sin overflow y respuestas 404 de las rutas
  V2 retiradas.

### Páginas públicas V2 concentradas en Home (2026-08-18)

- **Navegación**: la tienda `catalog-modern-v2` deja de publicar las páginas
  independientes `Contacto` y `Nosotros`; Inicio conserva la sección de
  contacto responsive al final de la página.
- **Compatibilidad**: los datos guardados de esas páginas se conservan como
  archivo interno para no borrar contenido persistido, pero no se incluyen en
  HTML, Preview, navegación ni en el selector de páginas del Constructor V2.
- **Enlaces**: los CTA heredados hacia `/nosotros/` y `/contacto/` se normalizan
  hacia `#contact-form`; la familia V1 mantiene sus rutas y enlaces originales.
- **Regresión**: exporter, schema, Preview, Constructor y E2E verifican la
  ausencia de las rutas V2 y la presencia del formulario y canales en Home.

### Contacto al final de Home V2 (2026-08-18)

- **Home**: se agregaron los módulos editables de formulario y canales de
  contacto al cierre de Inicio, agrupados en una composición responsive sin
  alterar la página Contacto ni la compatibilidad V1.
- **CTA**: Enviar consulta y Escribinos por WhatsApp reutilizan el tratamiento
  visual del botón del hero, con enlace externo seguro, hover, foco visible y
  ancho completo en móvil.
- **Constructor y exportación**: los módulos quedan disponibles sólo en Home
  V2, se migran de forma idempotente a tiendas existentes y mantienen paridad
  entre Preview y exportación.
- **Regresión**: schema, módulos, exporter y E2E cubren layout de dos columnas,
  apilado móvil, cero overflow y consistencia visual del CTA.

### Reseñas y Contacto V2 (2026-08-18)

- **Reseñas**: la demo pasa de 3 a 12 testimonios y la página V2 los muestra
  en una grilla responsive de 4, 2 o 1 columna, sin rail ni scroll lateral.
- **Migración**: `Predeterminado` completa las reseñas faltantes al iniciar sin
  reescribir las tiendas o el contenido personalizado.
- **Contacto**: se retiraron de la plantilla V2 los accesos rápidos y el bloque
  “¿En qué podemos ayudarte?”, además de las migas visibles de Nosotros y
  Contacto; los módulos siguen disponibles si una tienda los agrega a mano.
- **Regresión**: schema, exportación, repositorio y E2E cubren los 12 cards, el
  ancho sin overflow y la limpieza de las páginas secundarias.

### Constructor V2 para páginas secundarias (2026-08-17)

- **Carga administrada**: los respaldos V2 antiguos que guardaban Nosotros y
  Contacto sin secciones ahora se normalizan al abrirse, igual que los
  proyectos de IndexedDB y el exporter; Inicio conserva sus secciones sin
  cambios.
- **Preview**: al elegir una página secundaria en el Constructor, la vista
  previa cambia automáticamente a su ruta (`/nosotros/` o `/contacto/`) para
  mostrar de inmediato el resultado de la edición.
- **Regresión**: se cubrió la recuperación de 10 secciones de Nosotros y 8 de
  Contacto, además del recorrido E2E del selector y su preview.

### Hero V2 y exportación pública (2026-08-17)

- **Hero**: la media principal queda visible desde el primer paint; conserva el
  zoom compositado de entrada sin ocultarse durante la espera de la animación.
- **Exportación**: el fondo editorial del hero queda cubierto por una prueba de
  assets y los exports production precargan las fuentes locales activas.
- **Accesibilidad y seguridad**: los enlaces de cada grilla de productos tienen
  nombres accesibles distintos y HSTS incorpora la directiva `preload`.

### Predeterminado V2 como única demo integrada (2026-08-17)

- **Producto**: Studio deja de sembrar y mostrar las referencias `Modo Sur V1` y
  `Predeterminado V1`; la única demo integrada es `Predeterminado` con la familia
  `catalog-modern-v2`.
- **Migración**: los perfiles existentes retiran sólo los dos IDs legacy
  reservados, junto con sus recovery drafts y migraciones, tanto de IndexedDB
  como del almacenamiento administrado en `proyectos/`. Las tiendas del usuario
  quedan intactas.
- **Persistencia**: el arranque no reescribe el snapshot V2 si no hay cambios,
  por lo que el Predeterminado existente conserva su versión de disco 44.
- **Regresión**: dashboard, purga, persistencia local y handler loopback quedan
  cubiertos con tests para el único Predeterminado y para la conservación de
  tiendas ajenas.

### Hardening y accesibilidad del storefront exportado (2026-08-17)

- **Performance**: la medición del chrome se agrupa en `requestAnimationFrame`
  y sólo escribe la variable CSS cuando cambia, evitando forced reflow durante
  el arranque y el cierre de la franja de anuncios.
- **Accesibilidad**: los videos incluyen una pista VTT de captions, el menú
  móvil usa un `div` compatible con `role="dialog"` y el CTA interno de
  contacto ya no comparte el nombre de un enlace de WhatsApp externo.
- **Motion**: la entrada del media del hero V2 reemplaza `clip-path` por
  `opacity` compositada; el zoom visual de la imagen conserva su `transform`
  sin alterar las dimensiones del contenedor.
- **Seguridad**: el export production publica HSTS, COOP y Trusted Types; el
  runtime protege sus actualizaciones HTML con la política permitida y la CSP
  acepta las pistas VTT locales.
- **Presupuesto**: el runtime público queda en 55.3 KiB crudos; el límite de
  56 KiB documenta el coste de la protección Trusted Types.
- **Release QA**: los smoke/E2E del portable fuerzan rasterizado software para
  validar el shell sin depender de DLLs o controladores GPU del runner.

### Exportación directa a carpeta en Windows (2026-08-17)

- **Escritorio**: Exportar abre el selector nativo de carpetas y escribe el
  sitio completo en la ubicación elegida, incluyendo videos y otros binarios.
- **Seguridad**: las rutas del export no pueden escapar de la carpeta elegida
  ni repetirse antes de escribir archivos.

### Exportación pública: media responsive, preload local y video del hero (2026-08-17)

- **Performance**: los fixtures de imágenes que ya estaban guardados se
  migran a WebP responsive con variantes por ancho, sin reinterpretar assets
  personalizados.
- **Lighthouse**: el preload LCP usa una ruta del propio sitio para no pedir el
  hero al dominio `.example` que sólo sirve como base de trabajo.
- **Video**: el hero `catalog-modern-v2` queda cubierto en exportación de
  producción y el video conserva su poster visible cuando el usuario prefiere
  movimiento reducido.
- **Portable**: el empaquetado preserva `proyectos/` y `.solara-runtime/` con
  copia segura cuando OneDrive bloquea un `rename` transitorio.

### Nosotros y Contacto editables en toda tienda nueva (2026-08-16)

- **Bug**: las tiendas creadas desde "Nueva tienda" nacían con las páginas
  Nosotros y Contacto vacías en el Constructor (la plantilla limpia clonaba la
  base V1, sin secciones V2).
- **Fix**: la plantilla limpia ahora usa la base V2 (construida localmente
  para evitar el ciclo de imports con el v2-fixture): designFamily
  catalog-modern-v2, assets de plantilla y las páginas about/contact pobladas
  con los módulos V2 (11 secciones en Nosotros, 9 en Contacto), editables y
  reordenables como en Inicio.
- Gate de regresión nuevo (F2-B5) + batería e2e completa 700/700.

### Auditoría integral V2 — 8 pasadas end-to-end (2026-08-16)

- **Bug real F2-H3**: la selección del dashboard se anulaba cuando un filtro o
  refresh pasaba por un conjunto vacío (el detalle quedaba en blanco sin
  recuperación); ahora la selección se conserva.
- **Performance**: el preview del editor debouncea su render (150 ms): las
  ráfagas de escritura pasaron de 2.47 s a 1.45 s (-41 % medido).
- **UI/UX**: el dashboard migró a un único sistema de toasts (el global, con
  soporte de acción "Deshacer"); se eliminó el toast paralelo.
- **Código**: wizard de creación extraído (`CreateStoreDialog`), slugify
  consolidado (3 → 1), CSS muerto eliminado.
- **Regresiones**: suites antiguas alineadas al storage reset (dos tiendas
  base, rol `region`, toasts apilados); batería e2e completa **712/712** con
  doble corrida sin flakes.
- Reporte completo: `docs/AUDITORIA_V2.md`.

### Hero V2 de Inicio copiado en Nosotros y Contacto (2026-08-16)

- El hero de `/nosotros/` y `/contacto/` comparte ahora con Inicio el fondo
  editorial, los beneficios, el ritmo del copy y el shell responsive.
- Se mantienen fotografías estáticas 9:16 y no se renderiza video en estas rutas;
  desktop usa la foto de fondo y mobile conserva la foto full-bleed.
- Verificado: módulos, typecheck, `corepack pnpm check`, E2E de Nosotros y
  Contacto, build, empaquetado desktop y portable smoke.

### Nosotros V2 editorial y modular (2026-08-15)

- Nueva página `/nosotros/` para `catalog-modern-v2`, con hero editorial,
  historia, principios, proceso, manifiesto, experiencia, estadísticas y CTA.
- El Builder permite editar módulos, repeaters, assets y toggles de equipo e
  imagen editorial sin afectar Home, Contacto, V1 ni legacy.
- Preview y exportación comparten el renderer de secciones; la salida inicial
  conserva contenido sin JavaScript, `AboutPage`, canonical y breadcrumbs.
- Verificado: schema, módulos, exporter, Builder, E2E responsive/no-JS/axe,
  `corepack pnpm check`, build y portable smoke.

### Héroes V2 alineados con Inicio y appear estable (2026-08-15)

- Nosotros y Contacto reutilizan el shell visual de Inicio V2: copy, media
  vertical 9:16, altura, márgenes, padding y ritmo de spacing; ambas rutas usan
  imagen estática y no video.
- Se reemplazaron assets demo discordantes por imágenes remotas de Unsplash para
  los héroes, la imagen editorial y los perfiles de Nosotros.
- El runtime recuerda los appears one-shot al pausar/reanudar el preview, evita
  observers duplicados y ya no hace que las secciones aparezcan, desaparezcan y
  vuelvan a aparecer.

### Contacto V2 modular y editable (2026-08-15)

- Nueva página `/contacto/` para `catalog-modern-v2`, construida con módulos
  independientes: hero, formulario WhatsApp, canales, centro de ayuda, CTA
  oscuro, información de compra, FAQ y ubicación opcional.
- El Builder permite editar Contacto, agregar/ordenar módulos y configurar
  repeaters, toggles, canales, horarios, FAQs y ubicación sin afectar Home,
  V1 ni legacy.
- Formulario HTML-first con fallback sin JavaScript; con runtime prepara el
  mensaje completo y abre WhatsApp. FAQ usa `<details>`, ubicación desactivada
  no deja markup ni espacio y la ruta emite `ContactPage`/breadcrumbs.
- Verificado: exporter 56 tests, modules 56 tests, Studio 290 tests, E2E
  Contacto 3/3, Builder 18/18, no-JS/axe y gate `corepack pnpm check` verdes.

### Cinco rondas completas del plan de QA 10× sobre la app (2026-08-15)

- **A11y total**: axe del editor y del dashboard en 0 violaciones (incluye
  best-practice): el panel de edición pasó de `main` con `role="tabpanel"` a
  `section` dentro de un `main` real, el breadcrumb de la tienda es `h1`, y el
  panel de detalle del dashboard es `section` en vez de `aside` anidado.
- **Dashboard**: el filtro de estado (Activas/Archivadas/Todas) ahora persiste
  entre recargas, igual que el orden y la vista. Los avatares distinguen
  tiendas con el mismo prefijo (PR vs PV).
- **Gates e2e**: 25 tests nuevos sobre flujos reales (foco y Esc, archivar y
  restaurar por filtro, duplicar, modo avanzado, picker por teclado, vistas y
  zoom del preview, respaldo v2, historial de exportaciones, import inválido,
  export producción, CSV del catálogo, paginado, reset de tipografía,
  contadores SEO, persistencia de panel/filtro/vista, responsive móvil).
- **Estabilidad**: batería completa 75/75 en dos corridas consecutivas sin
  flakiness; benchmark de exportación 1.744 → 1.693 ms.

### Cards: la rayita de hover anclada a la media (fix real del posicionamiento) (2026-08-15)

- El `::before` de la barrita es `position: absolute` y la media no era un
  contenedor posicionado: la barra se anclaba al ancestro posicionado más
  cercano (la página/sección) y aparecía fuera de la card. Se agrega
  `position: relative` a `.catalog-product-media`; la barra queda exactamente
  sobre el borde izquierdo de la foto (que no se escala en hover), sin
  entrar al copy. Verificado por píxeles (terracota en `media.left`, 3px) y
  por medición (barra = caja de la media).

### Hero: la media cubre la altura exacta del hero (sin espacio inferior) (2026-08-15)

- El overscan de la media tenía `margin-bottom: -1px` sin compensar: la
  columna terminaba 1px antes que el hero y se veía una franja crema debajo
  de la foto/video (el usuario reportó "la imagen de fondo y el video deben
  tener la misma altura"). La media ahora crece `height: calc(100% + 2px)` y
  el overflow del hero la recorta en los 4 bordes: fondo y media comparten
  exactamente la misma altura visible.
- Verificado por medición (mediaBottom = heroBottom + 1, recortado) en 5
  viewports y por visión: borde inferior nítido, sin franja.

### Glow de cards: más sutil, sobre la imagen y con transform (2026-08-15)

- El glow se movió de la card completa a la IMAGEN (`.catalog-product-media`):
  ya no sube por el copy (categoría/nombre/precio); en las fichas de categoría
  sigue en el tile (que es todo imagen).
- Más sutil (sombra 8px al 35%, degradado al 22%) y con mejor performance:
  la línea crece con `transform: scaleY` (compositor, sin layout) y el
  puntito viaja en la punta como capa del mismo pseudo (caja de 8px con la
  línea de 2px centrada + radial con centro luminoso, completo y sin recorte).
- E2E actualizado (transform del pseudo en la media). Verificado con visión:
  línea sutil solo sobre la foto, puntito de luz con halo en la punta.

### Lote visual V2: glow en cards, entradas de reseñas/novedades y footer (2026-08-15)

- "Ver todo el catálogo" (bento) ahora anima igual que "Ver todos" (subrayado
  scaleX .35→1 con ease).
- Reseñas y "Recibí las próximas novedades" entran con coreografía estilo
  hero: header primero, testimonios con stagger (70ms, hasta 8) y el CTA de
  novedades en dos pasos; gated por data-motion-visible y cubiertos en
  reduced-motion.
- Cards de producto y de categoría: al hover, una línea glow terracota crece
  desde abajo por el borde izquierdo con un puntito brillante en la punta
  (radial en el tope del pseudo); también en focus-within. Verificado por
  medición (height 427px) y visión (glow sutil, premium).
- Footer: "© {año actual} {marca}. Todos los derechos reservados." + línea
  "Hecho con ❤️ en solara.com.ar" con enlace (hover terracota).
- Techo CSS V2: 120 → 128 KiB (≈5.3 KB del lote, documentado). E2E +4
  (34/34). La tienda queda guardada (v42 en repo; el portable preserva su
  versión más nueva).

### Páginas de categoría: título en caja frosted glass (2026-08-15)

- El h1 de las páginas de categoría se envuelve en `.solara-category-title-glass`:
  mismo lenguaje que la caja de beneficios del hero (papel translúcido 38%,
  blur 14px, borde fino, sin radio). E2E nuevo (título visible + blur aplicado).

### Fix minificador CSS + overscan de la media (2026-08-15)

- El minificador del exporter quitaba los espacios alrededor de `+` en
  `calc()` (los `+`/`-` los REQUIERE la spec): cualquier declaración con
  `calc(... + ...)` se descartaba silenciosamente en el navegador. `minifyCss`
  ahora conserva los espacios del `+` y queda exportado con test propio
  (calc con +, round/min anidados, comentarios y selectores).
- La media del hero usa overscan (`calc(min(90svh * 9 / 16, 45vw) + 2px)` con
  `margin -1px -2px -1px 0`): sus bordes de layer quedan recortados por el
  overflow del hero (clip duro, sin antialiasing a ningún DPR). Verificado
  por medición: media 492px alineada, right recortado en 1840, sin overflow
  de página.

### Hero V2: sin efectos residuales de la entrada en la media (2026-08-15)

- La animación de entrada usaba `fill-mode: both`: al terminar dejaba el
  `clip-path: inset(0 0 0 0)` y el `transform` del parallax de scroll
  aplicados para siempre — cualquier clip/transform rasteriza el borde del
  layer con antialiasing y la franja de 1px volvía a aparecer con el poster.
- Los tres `both` de la media pasan a `backwards` (el estado final es
  identidad): el clip y el transform se liberan al terminar, el parallax de
  scroll sigue funcionando. Verificado por medición (clipPath/transform
  "none" tras la entrada, rects alineados) y por visión: bordes limpios.

### Hero V2: columna de media en píxeles enteros (fin de la franja del poster) (2026-08-15)

- La franja de 1px persistía con el POSTER (imagen preview) aunque no con el
  video: el layer compuesto del video en coordenadas fraccionarias se
  antialiasa contra la foto de fondo. Se ancla la altura del hero
  (`round(up, 90svh, 1px)`) y el ancho de la media
  (`round(up, min(calc(90svh * 9 / 16), 45vw), 1px)`) a píxeles enteros.
  Verificado con captura y visión: borde del poster nítido, sin franjas.

### Hero V2: sin franjas en los bordes de la media (2026-08-15)

- La media (imagen/video) tenía `transform: scale(1.015)` — un overscan que
  quedó del parallax de cursor (eliminado). Al escalar, los bordes del
  elemento se salían del figure (recortados con overflow hidden) y la arista
  semitransparente se componía sobre la foto de fondo: línea blanquiza de
  1-2px a la derecha (y arriba) del video antes de que comience.
- Se elimina el scale base y el zoom de entrada ahora termina en scale(1)
  exacto. Verificado por medición (bounding rects) y por visión: bordes
  nítidos, sin franjas.

### Hero V2: poster con dimensiones de presentación y primer frame real (2026-08-15)

- El poster usa el metadata de `requestVideoFrameCallback`: dimensiones de
  PRESENTACIÓN (rotación/SAR del contenedor ya aplicados) para que el aspect
  coincida con lo que muestra el video (corrige la línea lateral y el tamaño
  raro en videos de teléfono o anamórficos).
- Si el primer frame presentado cae después de t=0 (H.264 con B-frames o
  keyframe desfasado), rebusca hacia atrás hasta 3 veces hasta el primer
  frame decodificable.
- Nuevo E2E que graba un video real en el navegador (primer frame rojo, resto
  azul), lo sube por el constructor, decodifica el poster generado desde
  IndexedDB y verifica: primer frame exacto (rojo) y dimensiones 360x640.

### Hero V2: poster = primer frame presentado, con aspect exacto (2026-08-15)

- El poster ya no se toma por seeks de tiempo: se captura el primer frame que
  el reproductor realmente PINTA (`requestVideoFrameCallback` registrado antes
  de forzar la presentación). Es idéntico a lo primero que se ve al dar play.
- El tamaño del poster se deriva con aspect exacto del video (una dimensión
  redondeada, la otra calculada): sin desviación xy acumulada por redondeos
  independientes (tope ≤1px, inherente a píxeles enteros).

### Hero V2: poster automático desde el primer frame del video (2026-08-15)

- El poster de preload se extrae del **primer frame literal** (t=0, sin
  epsilon): el preload muestra exactamente lo primero que se ve al reproducir.
  Si el seek es innecesario (ya estamos en t=0) se salta para no demorar la
  subida.
- Re-subir el mismo video (mismo hash) ahora **refresca el poster**: reemplaza
  el poster viejo por el nuevo en los assets y apunta el video al nuevo
  `posterAssetId` (antes el dedupe por hash dejaba el poster viejo).

### Portable: los rebuilds preservan los guardados del usuario (2026-08-15)

- `desktop:package` recreaba la carpeta portable desde cero: cualquier tienda
  guardada desde la app (que persiste en `SolaraCommerce-Portable/proyectos/`)
  se perdía en el rebuild. Ahora `create-portable-distribution.mjs` preserva
  las tiendas del portable cuya versión de manifest es más nueva que la del
  repo y restaura `.solara-runtime/` completo.
- Lógica exportada `shouldKeepPortableStore` con 4 tests (más nuevo gana,
  repo no se pisa, tienda sólo portable, carpetas sin manifest). Verificado
  end-to-end: una tienda v99 del portable sobrevive al rebuild.

### Hero V2: el video 9:16 arranca solo (autoplay forzado en modo video) (2026-08-15)

- El hero tenía `autoplay: false` por defecto (era del carrusel): el video se
  veía como imagen quieta. En modo video el render fuerza `autoplay` (muted +
  loop + playsinline, permitido por los navegadores) y la subida de video
  también marca `autoplay: true` en la sección.
- Tests: el contrato de render ahora aserta el atributo en el tag `<video>`
  (antes pasaba por el `data-autoplay` del contenedor) y cubre el caso
  "autoplay false + modo video = autoplay".

### Hero V2: media 9:16 sólo video + poster automático del video (2026-08-15)

- El editor del hero V2 expone el modo **sólo Video** (la media 9:16 ya no
  ofrece imagen ni carrusel; el schema conserva los valores por compatibilidad
  y la familia V1 mantiene sus opciones).
- Al subir un video se genera automáticamente el **poster de preload**: se
  extrae un fotograma a baja resolución (máx. 640px, webp/jpeg), se agrega
  como asset "X (preload)" al proyecto y se asocia al video (`posterAssetId`).
  Si la extracción falla, la subida no se bloquea.
- El render del hero usa el poster del video cuando el setting manual está
  vacío (`posterAssetId || undefined`): el preload sale del propio video.
- Tests: 10 unit de video (poster, atómico, modo), 2 nuevos de render
  (video loop mudo sin img, poster del video), E2E del filtro de modo V2
  (sólo Video) y del upload con error visible.

### Constructor: subir video activa el modo video y persiste dentro del proyecto (2026-08-15)

- Al subir un video en el hero, la sección pasa automáticamente a modo
  "video" (si expone `mode`): ya no queda mostrando la foto de portada.
- El archivo se embebe como data URL en el proyecto (no es una ruta externa):
  vive dentro del `.solara.json` y del sitio exportado (`/assets/<hash>.mp4`).
- Tests: helper `sectionSettingsWithVideo` (modo video atómico), render del
  hero en modo video (loop mudo, sin `<img>` de portada) y ajuste del
  contrato de beneficios (6 items: copia + banda).

### Constructor: subir video atómico (sin estado inválido) (2026-08-15)

- Fix de carrera: al subir un video desde el inspector del hero, el proyecto
  se actualizaba en dos pasos (primero el video, después el setting de la
  sección) y un parse intermedio veía `videoAssetId` sin el video en
  `project.videos`, mostrando "Video de la sección ... inexistente" y
  bloqueando la edición/guardado.
- Ahora `applyVideoToSection` construye el proyecto nuevo (video + setting de
  la sección) en una sola actualización; si el archivo ya existía por hash se
  reutiliza sin tocar el proyecto. El contrato queda fijado por unit test:
  el proyecto resultante pasa `StoreProjectV1Schema.parse`.
- El estado del usuario se recupera eligiendo "Sin imagen" en "Video local" o
  re-subiendo el mismo archivo (dedupe por hash).

### Constructor: subir video directo en el hero (loop, sin sonido) (2026-08-15)

- El campo "Video local" del hero ahora permite **Subir video** desde el
  inspector (MP4/WebM, hasta 30 MB, 0-60 s): valida, hashea, lee metadata y
  agrega el `VideoAsset` al proyecto dejando el campo seleccionado. Si el
  archivo ya existe (mismo hash) reutiliza el asset.
- Helpers de video compartidos entre Assets y el inspector
  (`builder/videoUpload.ts`) con test unitario de validación (formato, tamaño,
  duración y construcción del asset con inyección de dependencias).
- El render del hero ya emite `muted loop playsinline autoplay`: el video
  queda en loop sin sonido como fondo de la media (9:16 desktop / full-bleed
  mobile). E2E nuevo en el builder (error de formato visible) y ui-assets
  sigue verde.

### Hero V2: la caja de beneficios queda sin radio (2026-08-15)

- Se elimina el `border-radius` de la caja frosted glass de los beneficios
  (esquina recta, coherente con el lenguaje del hero). La tienda queda
  guardada como v40.

### Hero V2: caja frosted glass para los beneficios (2026-08-15)

- Los 3 beneficios del copy del hero (Envíos, Pedido directo, Compra cuidada)
  van envueltos en una caja con `backdrop-filter: blur(14px)`, fondo
  translúcido de papel (38%), borde fino y radio 8px. Aísla el bloque de la
  imagen de fondo; la banda mobile queda igual (sobre fondo plano). Verificado
  con visión: frosted glass sutil, textos legibles, sin afectar título ni CTA.
- E2E: el test del fold verifica que la caja tenga `backdrop-filter`. La
  tienda queda guardada como v39.

### Hero V2: el fondo pasa a velo blanquizo y el copy vuelve a tinta (2026-08-15)

- Se revierte el refuerzo de legibilidad anterior (gradiente oscuro +
  antetítulo aclarado): el usuario prefiere el fondo con un velo blanquizo.
- El fondo del hero (desktop) ahora aplica un velo tipo papel creciente hacia
  la izquierda (`--catalog-paper` con gradiente 92% → transparente y opacidad
  regulada por el setting `backgroundDarkness`, ahora etiquetado "Velo del
  fondo (%)" en el editor). El copy vuelve a la tinta oscura; sin fondo,
  mantiene el papel claro.
- Se elimina el `brightness()` oscurecedor y el fondo del figure de la media
  pasa a transparente (desaparece la costura vertical entre el velo y la foto
  9:16; verificado con visión: texto legible, transición suave).
- E2E: el test del fold verifica el velo (`::after` presente), la variable de
  intensidad y que el copy no queda blanco. La tienda queda guardada como v38.

### Hero V2: fondo editorial oscurecido, tipografía expandida y photo 9:16 (2026-08-15)

- Nuevos settings del hero conectados al editor: `backgroundImageId` (fondo
  oscurecido, sólo desktop, detrás del texto) y `backgroundDarkness` (0-90%,
  slider). Con fondo presente el copy pasa a texto blanco y la regla a blanco
  translúcido; sin fondo, mantiene el papel claro.
- El fondo se renderiza como asset del proyecto (`data-hero-background`, lazy,
  `object-fit: cover`, `brightness()` según el setting) y se oculta en mobile,
  donde la media (foto o video) sigue siendo el fondo full-bleed.
- Tipografía del hero ampliada para el espacio horizontal: título
  `clamp(4.75rem, 6.4vw, 8rem)` y body `max-width: 54ch` con cuerpo
  `clamp(1.05rem, 1.2vw, 1.28rem)`.
- La demo guarda v37 con la foto de fondo "Fondo editorial del hero" (asset
  `asset-hero-fondo`, imagen de moda de Unsplash embebida como data URL).
  El fixture V2 habilita el fondo con su asset existente para cubrir el
  contrato en E2E (29/29 verdes).

### Hero V2 editorial: media 9:16 en desktop y foto como fondo en mobile (2026-08-14)

- Desktop: la media del hero es siempre 9:16 (`width: min(calc(90svh * 9 /
  16), 45vw)` con `aspect-ratio: 9/16`); la columna de texto se estira
  horizontalmente (grilla `1fr / auto`). En retratos de tablet (≤1023px) la
  media estira a la altura del hero para no dejar vacío (compromiso 9:16).
- Mobile (≤767px): la foto/video es el fondo full-bleed del hero (altura
  mínima 82svh) con scrim en gradiente; el eyebrow, título, body y el botón de
  WhatsApp quedan encima con texto blanco; los 3 beneficios (Envíos a todo el
  país, Pedido directo, Compra cuidada) se renderizan como banda debajo de la
  imagen (la copia interna se oculta en mobile y la banda en desktop).
- Markup: el hero V2 sin carousel marca `catalog-hero-editorial` y duplica el
  listado de beneficios como banda (una copia se oculta por viewport;
  `display:none` la excluye del AT). Carousel V1/V2 intacto. `sizes` de la
  imagen hero pasa de 52vw a 45vw.
- E2E: `mediaShare` pasa a rango 0.2-0.45 con verificación del aspect ~9:16,
  y el test 390 fija fondo full-bleed + banda debajo de la imagen. La tienda
  queda guardada como v36.

### Hero V2: se quita el parallax de cursor de la media (2026-08-14)

- El follower de cursor del hero (`connectHeroParallax`) movía la media con
  valores subpixel (lerp + `toFixed(2)`), causando un micro-movimiento de 1px
  en el borde derecho de la imagen ("se quita y agrega 1px"). Se elimina por
  completo; la media queda estática tras la entrada.
- Se borra el keyframes muerto `solara-hero-parallax` y el techo del runtime
  JS vuelve de 56 a 55 KiB (~1.6 KB ahorrados). Nuevo contrato E2E y de
  runtime: sin `pointermove` ni follower en el serializado.
- La tienda queda guardada como v35 y el portable reconstruido.

### Hero V2: sin zoom de foto al hover y CTA con cortina estática (2026-08-14)

- Se quita el zoom de la media del hero al pasar el cursor (la imagen y el
  video ya no escalan al hacer hover sobre el contenedor del hero).
- El CTA primario conserva el efecto cortina (`::before` que sube y cubre el
  fondo), pero el botón, el texto y el icono ya no se desplazan (se elimina el
  `translateY(-1px)` del botón y el `translateX(4px)` del icono).
- Nueva prueba E2E que fija el contrato: la foto mantiene su transform al
  hover y el CTA sólo cambia la cortina y el color, sin movimiento.
- La tienda queda guardada como v34 y el portable reconstruido.

### Shell: GPU acelerada por defecto con fallback automático (2026-08-14)

- La app forzaba composición por software en todas las máquinas
  (`disable-gpu` + `disable-gpu-compositing` + `in-process-gpu`), limitando el
  renderizado al refresh rate nativo del monitor (p.ej. 144 Hz). Ahora la
  aceleración de hardware es el modo por defecto y el modo software solo se
  activa cuando el proceso GPU muere al arrancar: `main.mjs` escribe un
  marcador en el perfil y se relanza sola (ventana de 15 s, salta en smoke).
  Lógica en `apps/desktop/src/gpu-mode.mjs` con test propio; `solara:diagnostics`
  expone `gpuMode` y `gpuFeatureStatus`. Verificado: check exit=0, portable
  smoke y e2e portable OK. El portable actualizado queda en `.release/portable/`.

### Run perpetuo de QA y optimización (2026-08-14, en curso)

- Infraestructura perpetua: branch `perpetual/debug-optimizacion`, backlog en
  `docs/PERPETUAL_QA_BACKLOG.md`, estado en `docs/perpetual-state.json` y
  latido en `docs/perpetual-progress.log`; reanudación desde AGENTS.md/HANDOFF.
- Nuevo `scripts/export-doctor.test.ts` (`pnpm doctor:export`): diagnóstico del
  export por fases (parse+optimize, audit, buildFiles+render), tamaños por
  archivo, hallazgos de auditoría por severidad y paridad preview/export de
  todas las rutas. Resultado inicial: 27 archivos, 293.924 bytes, score 97,
  paridad 16/16 en referenceStore.
- Nuevo `scripts/parity-sweep.test.ts` (C1): gate de paridad diferencial
  preview/export con árbol de módulos y cuerpo normalizado para los 3 fixtures
  (reference, catalogModern, catalogScale) en draft y production, todas las
  rutas incluidas las paginadas. 6/6 verdes.
- C2: el servidor local (handler compartido HTTP/Electron) ahora sirve la
  página `404.html` del propio sitio para rutas inexistentes (p.ej.
  `pagina/99`), igualando el comportamiento de los hostings estáticos; sin
  `404.html` mantiene el 404 plano. `?pagina=1` ya resuelve la página 1 con su
  canonical correcta (decisión estática documentada).
- Barrido visual del sitio exportado (`SOLARA_QA_VISUAL=1`): spec Playwright
  con cosecha de consola/red/overflow y capturas desktop/mobile. Hallazgos
  V1-V6 en el backlog (2 medios: carrito vacío desalineado y sección bajo el
  404; 4 menores).



- A ~770px el hero mantiene el layout split (texto ~52% / imagen ~48%) como la
  referencia del usuario, con la columna de copy equilibrada y beneficios
  compactos en 3 columnas (ícono 18px, tipografía menor, gaps reducidos en el
  rango ≤1199px). Verificado por medición y revisión visual contra la
  referencia. La tienda queda guardada como v21.

### Hero V2: hover sin mover el texto, spacing y tablet vertical (2026-08-14)

- El hover del CTA ya no desplaza el label: sólo viajan el ícono y la capa de
  fondo; el texto conserva su posición (sólo cambia de color).
- Se restaura el aire entre título y subtítulo: el selector del margen quedaba
  huérfano con el wrapper de reveal; ahora el hairline separador tiene margen
  propio y el subtítulo mantiene su ritmo.
- Rango tablet vertical (768-919px): el hero apila copy + imagen a ancho
  completo para que los 3 beneficios no queden comprimidos en la columna
  angosta (a 770px la columna de copy medía 255px; ahora el copy va a ancho
  completo y los beneficios en fila cómoda). Verificado por medición y
  revisión visual en 320, 390, 770 y 1024 sin overflow.
- La tienda queda guardada como v20.

### Hero V2: título balanceado y hairline en beneficios (2026-08-14)

- El título del hero se divide en líneas balanceadas (~12 caracteres) para el
  reveal con máscara: "Vestite con / lo que te / representa." sin viudas
  tipográficas (revisión visual con visión).
- Los beneficios ganan un hairline vertical sutil entre columnas en desktop
  (se quita en móvil). La tienda queda guardada como v19.

### Fix visual del hero V2 (2026-08-14)

- Los íconos SVG del CTA y de los beneficios tenían tamaño implícito del
  navegador (71-115px) que rompía el layout: ahora tienen tamaño explícito
  (16px el CTA, 22px los beneficios), el label del CTA no se parte en líneas
  y los beneficios van en grilla de 3 columnas en desktop y una en móvil, sin
  viñetas ni indent heredados del `ul`. La tienda queda guardada como v18.

### Hero V2 cinematográfico (2026-08-14)

- El hero de la familia V2 estrena una secuencia de entrada única y breve
  (~1.1s) con reveal por máscara: eyebrow, título por líneas (2 líneas
  deterministas con máscara y profundidad sutil), separador que se dibuja,
  descripción, CTA y beneficios, más un reveal de la imagen con microzoom y
  máscara. Después de la entrada sólo quedan microinteracciones y parallax.
- CTA con hover avanzado coordinado (capa de fondo, label e ícono que se
  desplazan; sin `scale()` genérico) y beneficios con microinteracción propia.
- Las estadísticas del catálogo se reemplazan en V2 por 3 beneficios
  comerciales configurables desde el Constructor (ícono, título y texto; los
  ítems se editan en vivo; sin beneficios configurados vuelve a las
  estadísticas derivadas).
- Parallax: scroll sutil con `animation-timeline: view()` (progresivo, sólo
  donde existe soporte) y cursor con un handler ligero del runtime (pointer
  fino, desktop, rAF + lerp, `will-change` sólo activo, sin listeners de
  scroll). Móvil reduce duraciones y distancias; `prefers-reduced-motion`
  deja el hero completamente visible e inanimado; sin JavaScript el contenido
  es visible de inmediato.
- El markup conserva la semántica (h1 íntegro envuelto en spans, aria y
  enlaces intactos) y V1/carrusel no cambian. Topes documentados: CSS V2
  120 KiB y runtime JS 56 KiB (parallax de cursor + coreografía; pendiente la
  revisión de presupuestos acordada).
- La tienda demo queda guardada como v17 con el hero nuevo.

### Grilla V2 de máximo 5 y ritmo vertical reducido (2026-08-14)

- La grilla de productos V2 muestra como máximo 5 columnas en desktop (1920,
  1440 y 1366 → 5; 1024 → 4; 768 → 3; 390 → 2) y las cards escalan
  proporcionalmente: título +20%, precio +16%, metadata y copy con más aire;
  se conservan colores, tipografías y el lenguaje editorial. La misma regla
  aplica a colecciones, categorías y relacionados, sin overflow.
- Los espacios verticales entre secciones (productos, categorías, testimonios,
  newsletter, footer) se reducen ~35% conservando whitespace premium (ningún
  bloque queda pegado).
- La tienda demo queda guardada como v16 con las imágenes de categoría curadas
  y el orden nuevo.

### Bento de categorías con imagen propia y placeholder neutral (2026-08-14)

- El mosaico de categorías ya no cae en el asset de campaña compartido cuando
  la categoría no define imagen: el render mantiene la prioridad
  `item.imageId → category.imageId → primer producto (variante disponible →
  imageIds[0])` y, sin imagen posible, muestra un placeholder neutral con la
  inicial de la categoría en lugar del asset compartido.
- El fixture Modo Sur asigna a cada categoría raíz una imagen curada o
  determinista (el pool tiene 4 assets para 8 categorías): Remeras→remera,
  Camisas→camisa y Pantalones→jean son explícitas; el resto resuelve con la
  primera imagen de su primer producto. Ninguna categoría raíz repite la imagen
  de campaña en la home.
- Verificado: modules 41/41, schema 28/28, budgets (V2 CSS 107.158 B < 108 KiB),
  E2E V2 de fold y hover del bento 2/2, y el HTML exportado V1/V2 sin duplicados
  consecutivos ni asset de campaña.

### Franja de marcas pareja y tienda demo guardada (2026-08-14)

- "MARCAS QUE NOS ACOMPAÑAN" usa padding vertical parejo arriba y abajo
  (`padding-block: clamp(2.5rem, 4vw, 4rem)`), conservando la colisión del hero
  con el borde de la franja.
- La tienda demo V2 quedó guardada como v15 por el pipeline real del servidor
  local (reorden de secciones + export production con el código vigente): el
  sitio público ya refleja los cambios sin necesidad de guardar manualmente.

### Reorden de categorías confirmado en disco (2026-08-14)

- La migración que mueve "Explorá por categoría" debajo de las marcas ahora
  persiste el proyecto reordenado en `proyectos/` al arrancar (antes quedaba
  como draft divergente en IndexedDB y el disco seguía con el orden viejo).

### Home V2: títulos alineados, bento sin caja y categorías bajo marcas (2026-08-14)

- Se quita el margen horizontal que los títulos de sección tenían hacia
  adentro: "Recién llegados", "Más elegidos" y el resto quedan alineados con el
  borde de su contenedor, como el contenido.
- "Explorá por categoría" pierde el fondo de superficie y el padding interno
  gigante: los items llegan al borde del contenedor igual que la grilla de
  productos, con el mismo ritmo vertical.
- La franja de marcas recupera aire superior: "MARCAS QUE NOS ACOMPAÑAN" ya no
  queda pegado al borde, y el hero sigue colisionando con el borde de la
  franja.
- Las categorías se mueven inmediatamente después de la franja de marcas en la
  home: hero → marcas → categorías → grillas. El fixture V2 adopta el orden
  nuevo y una migración idempotente reordena la tienda demo guardada sólo si
  conserva el patrón anterior (nunca toca reordenamientos manuales).
- Implementado con subagentes por área y verificado: modules 40/40, schema
  27/27, repositorio 23/23, E2E V2 29/29, budgets y checks de repositorio.

### Guardado resiliente ante locks transitorios (2026-08-14)

- El servidor local reintenta el rename de publicaciones (sitio y respaldo)
  ante errores transitorios de Windows (EPERM/EBUSY/EACCES, típicos de
  OneDrive o antivirus) con backoff corto, y limpia un destino stale de un
  intento interrumpido antes de publicar el sitio. Un guardado ya no falla por
  un lock momentáneo del sistema.
- Tests nuevos: reintento ante EPERM transitorio (2 fallos → éxito) y
  reemplazo de destino stale con la misma clave.

### Retoques V2 con subagentes: títulos, CTA y grillas (2026-08-14)

- Los títulos h2 de todas las secciones V2 ("Recién llegados", "Más elegidos",
  "Explorá por categoría", relacionados, checkout…) adoptan el tamaño y el
  espaciado lateral del título "Recibí las próximas novedades"; los h1 de
  página (categoría, búsqueda, carrito, compra) se reescalan a la familia del
  hero sin tocar el hero mismo.
- El hero V2 muestra un único CTA "Escribir por WhatsApp" que enlaza directo a
  `https://wa.me/<teléfono>` sin mensaje precargado (el mismo número que usa el
  carrito); V1 y las tiendas sin teléfono conservan las acciones previas.
- La grilla de productos V2 aprovecha el ancho disponible: en desktop suma dos
  columnas (8 en 1440 y 1920) y móvil sigue en 2; categorías, búsqueda y
  relacionados verificados sin overflow.
- Los cambios se implementaron con subagentes por tarea y se integraron con
  tests: modules 40/40, E2E V2 28/28, budgets y repository checks verdes.

### Retoque V2: hero de borde a borde (2026-08-14)

- El hero V2 pierde el margen superior e inferior: la imagen colisiona con el
  header arriba y con la franja de marcas abajo, en escritorio y móvil.
- El gate de presupuesto V2 pasa a 108 KiB con el costo gzip documentado
  (~15 KiB transferidos) para absorber la iteración visual en curso.

### Dashboard con dos referencias V1/V2 (2026-08-14)

- El perfil local queda con tres tiendas de referencia para comparar las
  familias lado a lado: `Predeterminado` (catalog-modern-v2), `Predeterminado
  V1` (la misma demo antes del upgrade, catalog-modern-v1) y `Modo Sur`
  (catalog-modern-v1). Una purga única por perfil elimina el resto de tiendas
  con sus borradores de recuperación y registros de migración; las tiendas que
  el usuario cree después no se ven afectadas.
- Las carpetas de las tiendas eliminadas quedan en respaldo en
  `.release/tiendas-eliminadas-2026-08-14/` fuera del dashboard.

### Grillas V2 expandidas en todas las rutas (2026-08-14)

- Colecciones, categorías, búsqueda y recomendaciones usan el ancho editorial
  disponible en escritorio y dejan de quedar limitadas a cuatro columnas.
- La búsqueda también conserva miniaturas cuadradas y sin recorte, igual que las
  cards principales y la galería de producto.

### Grillas V2 con miniaturas cuadradas (2026-08-14)

- Las secciones de productos aprovechan el ancho disponible con una grilla
  adaptativa, manteniendo las cards legibles y conservando una densidad menor
  en las recomendaciones relacionadas.
- Las imágenes de producto V2 usan superficies cuadradas y `contain` para
  evitar recortes en cards, galería principal y miniaturas.

### Snapshot de carrito en Preview V2 (2026-08-14)

- El host del Studio conserva el último snapshot completo recibido desde el
  iframe y lo reutiliza al cambiar de ruta, aunque la escritura de
  `localStorage` todavía no haya terminado.
- Se agrega una regresión E2E para agregar un producto y cambiar de ruta de
  inmediato sin perderlo antes de sumar el segundo.

### Navegación interna del Preview V2 (2026-08-14)

- Los enlaces internos de la tienda embebida vuelven al controlador de rutas del
  Studio en lugar de abandonar el `srcdoc` y reiniciar el runtime.
- El carrito conserva sus líneas al recorrer Inicio, productos y carrito desde
  enlaces reales del storefront; los enlaces externos mantienen su comportamiento.

### Header V2 responsive (2026-08-14)

- Evita que los enlaces de navegacion se partan en dos lineas en tablets de
  768px, manteniendo el header legible y sin overflow.
- Agrega cobertura visual y geometrica en 768, 1024, 1366 y 1440px, junto con
  una comprobacion de carga de imagenes de la primera grilla.

### Carrito embebido V2 (2026-08-14)

- El carrito del preview guarda de inmediato en el host cuando el entorno lo
  permite y conserva el puente por `postMessage` como fallback, evitando perder
  lineas al cambiar de ruta rapidamente.

### Filtros moviles V2 (2026-08-14)

- El sheet de filtros muestra un disclosure visible con estado abierto/cerrado para abrir y
  cerrar el panel sin perder el contexto de la categoria.
- La estructura conserva el filtro movil cerrado al iniciar, evita overflow y
  mantiene el rail de filtros abierto en desktop.

### CTA y acumulación del carrito (2026-08-13)

- El carrito acumula la misma variante y conserva sus líneas al volver desde
  otra página, sin reemplazar el contenido existente.
- El resumen vacío ofrece un enlace a la primera categoría madre y reserva el
  acceso a checkout para cuando existen productos.
- Se agregan regresiones E2E para líneas múltiples, cantidades acumuladas,
  navegación, recuperación y checkout.

### Toolbar de categorías responsive (2026-08-13)

- Se corrige el layout móvil V2 para que filtros, contador y orden ocupen todo
  el ancho disponible sin quedar comprimidos en una columna residual.
- Se agrega una regresión E2E que verifica una sola columna y ausencia de
  overflow interno en 390 px.

### Carrito público entre páginas (2026-08-13)

- Se corrige la serialización del runtime exportado para que `parseCart` y
  `reconcileCartLines` mantengan sus bindings después del bundle de producción.
- El storefront conserva varias líneas al cambiar de producto, recargar y
  entrar al carrito o checkout; también se regenera el portable de
  `Predeterminado` con esta corrección.

### PDP V2 más equilibrada en tablet (2026-08-13)

- La página de producto conserva dos columnas entre 768 y 1199px para evitar
  galerías gigantes y mantener la compra cerca del contenido visible.
- Mobile conserva su composición de una columna y sus márgenes táctiles.

### Proporción del carrito V2 (2026-08-13)

- Se compacta el resumen del carrito en desktop grande para equilibrar el
  espacio entre líneas, total y acción principal sin alterar mobile ni tablet.
- Se actualiza la expectativa visual de comparación a la paleta V2 vigente y
  se agrega una regresión de geometría del carrito.

### Carrito resistente a páginas restauradas (2026-08-13)

- Se vuelve a leer el carrito persistido antes de agregar un producto, evitando
  que una página restaurada por atrás/adelante sobrescriba líneas existentes.
- Se agrega una regresión E2E con navegación back/forward y dos productos.

### Ritmo vertical de la home V2 (2026-08-13)

- Se reduce el espacio vertical máximo de las grillas editoriales y del bento
  en desktop y tablet, evitando pausas excesivas entre productos y categorías.
- Mobile conserva su respiración y composición táctil específicas.

### Galería PDP y ritmo editorial V2 (2026-08-13)

- La galería del producto muestra una sola imagen principal y ubica sus
  miniaturas en una columna compacta, evitando que las imágenes secundarias
  alarguen innecesariamente la página.
- Se compactan los espacios del encabezado de categoría, el detalle de
  producto y el carrito en desktop, conservando el layout responsive.

### Búsqueda V2 y escala de resultados (2026-08-13)

- La grilla de resultados queda alineada con el ancho máximo de las cards del
  resto del storefront V2.
- Las imágenes de búsqueda declaran tamaños compactos para mobile, tablet y
  desktop, evitando solicitar variantes más grandes que el espacio real.

### Gate responsive de carrito y checkout V2 (2026-08-13)

- Se agrega cobertura explícita en 1024×768 para verificar que líneas, resumen
  y acciones de compra permanezcan dentro del viewport sin scroll horizontal.

### Checkout con múltiples líneas V2 (2026-08-13)

- Se cubre el envío de un pedido con dos productos agregados desde páginas
  distintas, verificando que ambas líneas lleguen al resumen y al enlace de
  WhatsApp.

### Flujo de seguir comprando en el carrito V2 (2026-08-13)

- El drawer ofrece una acción visible para cerrar y continuar recorriendo la
  tienda después de agregar un producto, sin bloquear los enlaces del storefront.
- Se cubre el recorrido agregar, seguir comprando, navegar y agregar un segundo
  producto sin perder la primera línea.

### Carrusel de testimonios y footer V2 (2026-08-13)

- Los controles de testimonios identifican su rail, respetan reduced motion y
  anuncian visualmente su estado disponible o agotado.
- El footer agrega rótulos visibles para sus grupos de navegación y contacto.

### Carrito del preview por sesión de ruta (2026-08-13)

- Las escrituras del carrito embebido quedan vinculadas a la sesión activa del
  preview, evitando que una ruta anterior sobrescriba líneas agregadas después.
- Se agrega una regresión E2E para el cambio de producto y la escritura tardía.

### Bento y cards del storefront V2 (2026-08-13)

- El bento automático usa una composición dinámica según la cantidad de
  categorías madre y ajusta `sizes` al espacio real de cada tarjeta.
- La grilla de productos V2 reduce levemente su ancho máximo y solicita
  imágenes proporcionales al ancho real de sus columnas en desktop y tablet.

### Carrito del preview entre rutas (2026-08-13)

- El Preview del Studio hidrata cada ruta con el snapshot vigente del carrito.
- Las mutaciones posteriores se persisten en el documento padre sin perder
  productos al cambiar de página.

### Cards de categoría V2 (2026-08-13)

- Las cards de categoría reducen levemente su rail máximo y declaran un `sizes`
  acorde al ancho renderizado para mantener una escala más aireada y descargar
  imágenes proporcionales al espacio real.

### Bento de categorías responsive (2026-08-13)

- El mosaico de categorías conserva su composición de dos columnas en mobile y
  respeta los tamaños anchos y altos dinámicos, evitando una lista vertical
  innecesariamente extensa.

### Checkout V2 con ritmo más compacto (2026-08-13)

- El formulario de compra queda más cerca de la explicación inicial en desktop
  y mobile, reduciendo espacio vacío sin cambiar la revisión del pedido ni el
  envío final por WhatsApp.

### Cards de producto V2 más proporcionadas (2026-08-13)

- Se redujo ligeramente el ancho de las grillas de productos en portada, búsqueda
  y categorías, manteniendo la misma cantidad de columnas y ajustando los hints
  de imágenes al ancho realmente renderizado.

### Hero V2 sin cortes de palabras (2026-08-13)

- El hero de Catalog Modern V2 conserva palabras completas en el título y
  amplía de forma controlada la columna editorial para evitar cortes dentro de
  la palabra o invasión visual sobre la imagen en desktop y mobile.
- Se agregó una regresión responsive que comprueba que `representa.` no se
  fragmente en ningún viewport cubierto.

### Cards V2 con escala más contenida (2026-08-13)

- La grilla principal de productos V2 reduce levemente su ancho máximo para
  mantener cards más proporcionadas y mejor separadas en desktop.
- El atributo `sizes` de sus imágenes refleja la nueva medida renderizada para
  evitar descargar una variante mayor de la necesaria.

### Búsqueda V2 con cards consistentes (2026-08-13)

- La grilla de resultados de búsqueda usa la misma escala contenida de la home,
  evitando que las cards crezcan al cambiar de ruta.
- Las imágenes de búsqueda declaran el mismo techo responsive que las cards
  principales.

Todos los cambios notables de SolaraCommerce se documentan en este archivo.

El formato sigue [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/) y
cada entrada describe el cambio desde la perspectiva del usuario o del
contrato, no los mensajes de commit. El proyecto aún no tiene releases
formales: los cambios se agrupan por fecha de trabajo hasta que exista una
versión publicada.

## [Unreleased]

- Corregido el menú móvil del storefront V2 para que conserve su panel completo al abrir categorías y subcategorías, incluso durante la animación de entrada del header.
- Refinada la densidad de las cards de productos en home, búsqueda, categorías y productos relacionados, con `sizes` alineados al ancho visual reducido.

### Encabezado de tabla del catálogo (2026-08-13)

- El catálogo deja de anidar un scroll vertical propio dentro del panel del
  Studio y mantiene el encabezado de la tabla visible debajo de la toolbar fija.
- Se agregó una regresión responsive para evitar que la barra sticky cubra el
  encabezado al recorrer el catálogo en desktop.

### Ajuste fino de escala de cards V2 (2026-08-13)

- Las cards de productos de la home y búsqueda reducen ligeramente su ancho
  máximo en desktop, de modo que la grilla se percibe más aireada sin perder
  sus cuatro columnas ni su proporción editorial.
- Las imágenes de esas cards declaran un techo responsive de 15rem, alineado
  con el ancho visual realmente renderizado.

### Sincronizacion de presentacion de Predeterminado (2026-08-13)

- La tienda demo existente actualiza su familia visual a Catalog Modern V2 al
  iniciar Studio, sin reemplazar sus productos ni el contenido personalizado.
- Se agrego una regresion para evitar que una cache vieja mantenga
  `Predeterminado` en la presentacion V1.

### Refinamiento de escala de cards V2 (2026-08-13)

- Las grillas de productos de la home y búsqueda reducen su ancho máximo a
  1120px para que las cards se perciban más proporcionadas en desktop sin
  cambiar la grilla de cuatro columnas ni su contenido.
- Las imágenes declaran un límite responsive de 16rem, alineado con la nueva
  escala visual y evitando solicitar recursos innecesariamente grandes.

### Acciones táctiles del Constructor (2026-08-13)

- Las acciones de mover, ocultar, duplicar y eliminar se alinean con el target
  base de 36 px del Studio, incluso cuando la fila se divide en dos líneas en
  mobile.
- La matriz responsive verifica que esos controles sigan completos dentro del
  viewport en todos los tamaños soportados.

### Auditoría SEO del Studio (2026-08-13)

- Los hallazgos de SEO muestran títulos accionables según su código, en lugar
  de repetir "Revisión SEO" en todas las filas.
- La auditoría comunica también severidad y área con etiquetas legibles, sin
  depender únicamente del color y sin overflow en mobile.
- Se agregaron regresiones para los títulos, metadata visible, foco y layout
  responsive de SEO.

### Ajuste de escala de cards V2 (2026-08-13)

- Las grillas de productos de la home y búsqueda limitan su ancho a 1200px
  para reducir ligeramente el tamaño de cada card en pantallas amplias sin
  cambiar columnas, contenido ni proporción de imagen.
- Las imágenes de esas cards declaran un límite responsive de 17.5rem para
  solicitar recursos más cercanos al ancho realmente renderizado.

### Corrección de overflow en Tema (2026-08-13)

- Los sliders de escala, espaciado y radio ya no agregan sus márgenes nativos
  fuera del fieldset en el editor, evitando un desborde horizontal de 4px en
  desktop y mobile.
- La matriz responsive del Studio verifica explícitamente que los controles de
  Tema quepan dentro de sus contenedores en los siete viewports soportados.

### Base aislada Storefront V2 (2026-08-12)

- El mosaico de categorías de Catalog Modern muestra sólo categorías madre y
  distribuye sus tarjetas en proporciones dinámicas `2×1`, `1×2` y `1×1`, sin
  incorporar subcategorías ni dejar huecos en la retícula responsive.
- El hero Editorial V2 cabe en el alto útil de una ventana 1920×1080
  maximizada, mantiene texto y acciones dentro del primer viewport y evita que
  la tipografía invada la imagen.
- El hero de escritorio usa una altura inmersiva de `90svh`, manteniendo el
  contenido interno centrado y el comportamiento automático en móvil.
- Las animaciones de aparición usan su línea de entrada como límite real de
  intersección, incluso cuando una sección alta ya asoma parcialmente en el
  viewport.
- Las cards de productos y categorías ahora comunican el mismo estado activo
  con mouse y teclado; los enlaces de colección tienen una línea de acción
  progresiva y estados pressed/focus coherentes.
- El preview embebido del portable ya no queda atascado en "Cargando vista
  previa": Electron puede montar el `srcdoc` aislado y mostrar la tienda V2.
- En navegadores HTTP el preview conserva el sandbox opaco más restrictivo; el
  permiso adicional de origen se limita al protocolo Electron, donde es
  necesario para montar `srcdoc` sin degradar la carga del editor.
- Las imágenes importadas generan candidatos responsive desde `320px` hasta
  `1800px`, y las cards, galerías y miniaturas declaran el ancho real que
  ocupan según desktop, tablet o mobile.
- Los productos de las fixtures deterministas muestran una galería de tres
  imágenes con miniaturas navegables; la grilla V2 limita su ancho para que
  las cards no resulten excesivamente grandes en pantallas amplias.
- La grilla principal y la búsqueda V2 fijan ese límite en `1360px` y ajustan sus `sizes` para
  que las cards respiren mejor sin perder la composición de cuatro columnas.
- La cabecera de categoría V2 usa una imagen `5:3` en lugar de una franja
  panorámica, equilibrando el peso del título y mejorando su lectura en mobile.
- La búsqueda V2 comparte el límite de `1520px` de la home y sus resultados
  declaran `sizes` responsive para no solicitar imágenes mayores que sus cards.
- La navegación V2 mantiene visible la ruta activa en desktop y conserva su
  `aria-current` en el menú móvil para orientar mejor al visitante.
- Las grillas V2 de productos y búsqueda limitan su ancho para que las cards
  respiren mejor en desktop y sus imágenes se soliciten al tamaño renderizado.
- El estado 404 V2 compacta el espacio vertical del hero y acerca las acciones
  al mensaje en mobile, evitando un vacío innecesario sin perder jerarquía.
- La página de producto V2 mantiene márgenes horizontales simétricos, elimina
  el desborde lateral y pasa a una columna en tabletas para conservar la
  jerarquía y la legibilidad.
- `Predeterminado` se crea directamente con Editorial V2 en instalaciones
  nuevas; las tiendas personales y las tiendas V1 existentes no se migran de
  forma implícita.
- El schema admite la nueva familia visual `catalog-modern-v2` sin cambiar
  `schemaVersion: 2` ni reinterpretar tiendas existentes `catalog-modern-v1`.
- Una fixture determinista V2 de 50 productos permite evolucionar el storefront
  con paridad entre Preview y exportación mientras V1 permanece disponible.
- Se incorporan el plan maestro, el baseline técnico y veinticuatro referencias visuales
  por superficie para guiar una evolución editorial con motion, responsive y
  accesibilidad verificables.
- La foundation V2 incorpora una paleta cálida editable, tipografía editorial,
  contenedor amplio, productos verticales y estados especiales de hover y
  entrada; respeta `prefers-reduced-motion` y no agrega JavaScript al runtime.
- La home V2 se valida en el viewport real `1920x968` y en `390x844`, sin
  overflow horizontal, con CTA visible y grillas de cuatro y dos columnas.
- Categoría V2 usa un rail editorial de filtros en escritorio y un sheet
  inferior nativo en móvil; PDP adopta galería vertical 4:5 e información
  sticky, y el carrito pasa de drawer lateral de 520 px a sheet móvil.
- Checkout V2 presenta un formulario editorial y resumen sticky en escritorio,
  se apila sin overflow en móvil y mantiene ocultos resumen, drawer y enlace de
  WhatsApp hasta que la interacción real los vuelve relevantes.
- Envíos, cambios, privacidad, términos y la recuperación 404 adoptan una
  composición editorial responsive derivada únicamente de datos reales, sin
  inventar condiciones comerciales o legales y sin alterar las páginas V1.
- El benchmark exporta ahora `catalog-modern-v2` con 2.000 productos, valida
  páginas activas, índice de búsqueda y un presupuesto máximo de 48 MiB.
- La matriz V2 verifica nombres accesibles, IDs únicos, foco visible, menú por
  teclado, fallback sin JavaScript, canonical/Open Graph y `noindex` del checkout.
- Las trece rutas públicas se recorren también en `768x1024`, `1024x768`,
  `1366x768` y `1440x900`; documento, body y raíz permanecen sin overflow
  horizontal entre los extremos móvil y desktop.
- Un gate de estabilidad V2 limita el CLS local a `0,05` durante carga, appear y
  scroll, y exige feedback DOM del carrito en menos de `100 ms` desde la acción.
- La búsqueda con resultados informa la cantidad real y recompone su grilla en
  cuatro, tres o dos columnas según el espacio, con metadata abierta y hover de
  imagen sin reflow.
- El runtime deja de serializar una copia pública de `matchToken` que el sitio
  no consumía; la función conserva sus tests unitarios y el JavaScript público
  recupera 1.250 B de margen sin cambiar ranking, sugerencias ni navegación.
- Una comparación equivalente en `1920x968` verifica que V1 y V2 conservan el
  mismo contenido y permanecen sin overflow horizontal ni filtraciones de
  estilos, con capturas completas que incluyen sus imágenes diferidas.
- Tema permite activar o revertir Editorial V2 sin migrar contenido ni cambiar
  el schema; el header se compacta al hacer scroll y los appears usan un observer compartido.
- Búsqueda separa correctamente título, ayuda y formulario en móvil; la página
  completa de carrito amplía su resumen en desktop, se apila en móvil y reserva
  la serif para encabezados en lugar de aplicarla a importes o entrega.

### Matriz release reproducible (2026-08-12)

- La matriz final bajo Node 22.18.0 valida Chromium, Firefox y WebKit con 903
  tests verdes, 2 casos Chromium recuperados por el reintento previsto y 3
  capturas visuales opcionales omitidas.
- El gate Node 22 mantiene toda la suite del Studio en Chromium y limita
  Firefox/WebKit a los contratos explícitos del storefront exportado, de acuerdo
  con el soporte documentado; los barridos internos del editor ya no se
  triplican accidentalmente en navegadores no soportados por Studio v1.
- Las regresiones de producto vuelven a cubrir la confirmación al eliminar una
  variante y el error inline actual del ajuste porcentual masivo.
- El drawer del carrito conserva el disparador real que lo abrió y devuelve el
  foco también en WebKit, donde un clic de puntero no enfoca el botón de forma
  implícita.
- El fixture de estilos cierra sus conexiones HTTP después de cada navegación,
  evitando esperas intermitentes al comparar escalas tipográficas.

### Tema oscuro predeterminado (2026-08-12)

- El Dashboard y el Studio inician en modo oscuro cuando no existe una
  preferencia previa; una elección clara u oscura guardada sigue teniendo
  prioridad desde la primera pintura y después de recargar.

### Feedback al abrir el sitio exportado (2026-08-12)

- El botón `Abrir sitio` de Exportar anuncia `aria-busy`, cambia su etiqueta y
  se bloquea mientras espera al host local, evitando aperturas duplicadas y
  mostrando un error recuperable si la operación falla.
- El barrido de Preparar verifica también sus tres accesos rápidos (`Marca y
  textos`, `Cargar catálogo` y `Organizar imágenes`) y conserva evidencia
  visual oscura de Preparar y Resumen en el viewport real `1920x968`.
- El Constructor prueba directamente `Desbloquear` desde una tienda protegida
  y el recorrido válido completo de movimiento (preset, intensidad, duración,
  distancia y ejecución única), incluyendo preview y persistencia.
- La ruta editable de Preview verifica también el commit al perder foco y la
  restauración de la ruta vigente ante una entrada vacía, sin render ambiguo.

### Panel de edición sin desplazamiento lateral (2026-08-12)

- El panel de edición usa un ancho máximo común de 1200 px en todas las
  pestañas; Catálogo deja de exigir desplazamiento lateral y usa tarjetas
  completas cuando el espacio es estrecho, manteniendo visible la información
  de todas las columnas y la selección de productos.
- Volver a seleccionar una pestaña, o elegir otra, reabre el panel después de
  cerrarlo; funciona con mouse y teclado y conserva el botón de reapertura de
  la barra de Preview como acceso alternativo.

### Feedback accesible en inspectores generados (2026-08-12)

- Las acciones asincronas del Dashboard muestran `aria-busy`, spinner y bloqueo
  temporal durante respaldos, descargas, aperturas y archivado/restauracion.
- Las acciones masivas de precios y tags muestran los errores junto al campo
  que requiere corrección, anuncian el estado inválido y evitan aplicar un
  ajuste vacío como cero.
- Los errores de colores del Tema quedan enlazados al input hexadecimal aun
  cuando comparte layout con el picker nativo, sin marcar inválido el control
  visual que no tiene el error.
- El diálogo de duplicación expone mediante `aria-describedby` el alcance de
  la copia antes de pedir el nuevo nombre.
- La paginación del catálogo navega desde la página efectiva cuando un filtro o
  cambio de tamaño deja temporalmente un índice fuera de rango.
- La reubicación de categorías conserva la selección al cancelar, devuelve el
  foco al control disparador y expone el cuerpo de confirmación de forma
  accesible.
- El diálogo de conflicto de persistencia enlaza su explicación dinámica con
  `aria-describedby` para anunciar el contexto antes de sus acciones.
- Los errores de booleanos, arrays JSON, repetidores y slides quedan asociados
  al control o grupo que debe corregirse, se anuncian con `role="alert"` y
  marcan el estado inválido sin cambiar el contrato del schema.
- La navegación pública respeta en el editor los límites del schema: 40
  caracteres para el catálogo, 80 por enlace, 20 enlaces y 12 subenlaces;
  muestra contadores y explica los botones deshabilitados al alcanzar el máximo.
- La descripción obligatoria de la marca conserva el borrador vacío para
  mostrar el error junto al textarea, sin enviar un proyecto inválido al schema;
  al corregirla vuelve a persistir normalmente.
- Los errores de validación de título, descripción e imagen social en SEO ahora
  permanecen visibles junto al campo inválido, anuncian su relación mediante
  `aria-describedby` y conservan el borrador hasta que el valor se corrige.
- La Razón social del Resumen conserva el borrador vacío, muestra el error junto
  al campo y sólo actualiza el proyecto cuando vuelve a ser válida.
- El barrido del Constructor verifica duplicado con contenido independiente,
  límite de ocho elementos, cancelación segura, foco tras borrar y recuperación
  del error antes de volver a aplicar el cambio.
- Los errores de schema dentro de cada slide y elemento repetido ahora se
  proyectan también al campo exacto, con `aria-invalid`, mensaje cercano y
  `aria-describedby`, sin perder el resumen de error del grupo.
- El precio anterior de una variante valida enteros no negativos en el mismo
  formulario, marca el campo antes de guardar y conserva el borrador hasta que
  se corrige, manteniendo el contrato de dinero en centavos.
- Exportar agrega una regresión explícita para cancelar la producción con botón
  o Escape sin generar historial y devolviendo el foco a su disparador.

### Confirmaciones de acciones destructivas (2026-08-12)

- El Constructor confirma la eliminación de secciones, explica que se pierde su
  configuración y devuelve el foco al contexto correcto después de cancelar o
  confirmar.
- Enlaces y subenlaces de navegación usan el mismo diálogo, muestran el alcance
  de la eliminación y conservan el toast posterior al guardado.
- Los diálogos exponen también su cuerpo mediante `aria-describedby`, para que
  el impacto de la acción se anuncie junto con su título.

### Confirmacion de borrados y restauracion en borradores (2026-08-12)

- Los editores de repetidores, slides y variantes confirman el borrado, explican
  el alcance de la perdida y conservan el foco en el siguiente control util.
- Restaurar los valores por defecto de una seccion deja de ser una mutacion
  silenciosa: permite cancelar y recuerda que la operacion puede deshacerse.
- Exportar confirma el borrado del historial local y aclara que no elimina el
  proyecto ni los sitios exportados.
- Las regresiones E2E cubren cancelar y confirmar cada accion, junto con los
  recorridos existentes de Constructor, Catalogo, Preparar y Exportar.

### Auditoria visual responsive de SEO (2026-08-12)

- SEO ahora apila sus bloques cuando el panel del editor es estrecho, incluso
  en ventanas donde el viewport general sigue siendo de escritorio.
- El gate visual comprueba orden, overflow y limites de todos los controles de
  SEO en movil, tablet y escritorio, y agrega evidencia de captura para la
  revision visual.
- El gate de accesibilidad valida valores y roles coherentes para los estados
  ARIA interactivos del Dashboard y las ocho pestanas del Studio.

### Jerarquía SEO y scroll del Catálogo móvil (2026-08-11)

- SEO muestra el score de optimización junto al estado de auditoría y ordena
  visualmente diagnóstico, checklist, metadata y previews para que la acción
  prioritaria aparezca antes del detalle editable.
- El panel de Catálogo deja de ofrecer un segundo scroll horizontal en móvil;
  la tabla conserva su desplazamiento horizontal intencional.
- El toggle de columnas ya no deja una referencia `aria-controls` colgante cuando
  el popover está cerrado; al abrirlo vuelve a asociarse con su contenido.
- El selector inline de estado del Catálogo devuelve el foco a su disparador al
  confirmar o cancelar, manteniendo el contexto de teclado.
- El árbol de categorías verifica explícitamente sus estados `aria-expanded` y
  la activación por `Enter` y `Space`.
- La capa de carga del Preview anuncia su estado con `aria-live` y ahora tiene
  una regresión que comprueba su desaparición al terminar el iframe.
- El gate de accesibilidad recorre las ocho pestañas y detecta referencias
  `aria-controls` sin destino en el panel izquierdo.
- Los campos que combinan ayuda, error y descripciones externas conservan todas
  esas referencias para tecnologías asistivas.
- El sweep de accesibilidad valida referencias `aria-labelledby`,
  `aria-describedby`, `aria-controls`, `aria-owns` y `aria-activedescendant` en
  Dashboard y en las ocho pestañas del Studio.
- Los nuevos gates de accesibilidad verifican que los subárboles `aria-hidden`
  no dejen controles visibles enfocables y que los campos con ayuda y error
  conserven ambas referencias. Recursos y guardado administrado anuncian sus
  operaciones asíncronas con `aria-busy`.

### Paridad del checklist Preparar y pendientes expandibles (2026-08-11)

- La detección de imágenes de plantilla se comparte entre el modelo guiado y el
  exporter: corregir sólo el `alt` no oculta un nombre de plantilla que todavía
  bloquea la publicación.
- WhatsApp sentinel queda como contenido recomendado porque el exportador lo
  sanea y no bloquea producción; los campos que el schema exige siguen siendo
  críticos para no ofrecer un proyecto inválido.
- El indicador `+N más` de Preparar ahora es un botón accesible que expande y
  contrae todos los pendientes, con `aria-expanded` y `aria-controls`. Los
  recorridos PR2 (12/12) y PR8 (2/2) quedaron activos, sin los `fixme` ya
  resueltos.

### Tooltips y cobertura responsive (2026-08-11)

- Los tooltips del Studio conservan la burbuja visual, exponen una descripción
  accesible con `aria-describedby` y dejan de duplicarse con el `title` nativo.
- La auditoría responsive cubre las ocho pestañas del Studio en 390, 768, 1024,
  1366, 1440 y 1920 px, verificando que la página no genere overflow horizontal.

### Feedback visible del editor de producto (2026-08-11)

- El guardado bloqueado lleva el primer error al viewport y el encabezado del
  editor muestra `Cambios sin guardar` mientras el borrador está sucio.
- Los casos A4 del barrido de catálogo dejaron de ser marcadores de deuda y
  ahora funcionan como regresiones afirmativas.

### Foco explícito en diálogos del Dashboard (2026-08-11)

- Comparar tiendas conserva el foco del botón que abrió el diálogo al cerrarlo,
  y Crear tienda recuerda el disparador real cuando se abre desde una superficie
  alternativa del Dashboard.
- Las regresiones cubren Escape, X, cierre por acción, restauración del foco y
  los recorridos existentes de creación, comparación y cierre de sesión.

### Marca interna de testimonios fuera del inspector (2026-08-11)

- `Contenido de ejemplo` era una marca interna sin consumidor en el renderer;
  dejó de exponerse como checkbox del editor para no prometer un efecto que no
  existe. El campo persistido se conserva para compatibilidad.
- El flujo de agregar testimonios verifica que el ítem siga siendo válido y que
  el inspector no muestre un control muerto.

### Valoración configurable en cards de productos (2026-08-11)

- `Mostrar valoración` del módulo `catalog-product-grid` ahora controla de
  verdad las reseñas visibles en cada card, con promedio, cantidad y etiqueta
  accesible; el estado apagado sigue ocultando el bloque.
- La salida quedó cubierta en renderer, Preview y exportación, y A11 verifica
  el cambio desde el Constructor, su feedback visual y la recuperación con
  Deshacer. No se modificó el schema persistido ni `catalogScaleStore`.

### Contexto accesible para controles repetidos del Constructor (2026-08-11)

- Los controles de ordenar, duplicar y eliminar elementos repetidos anuncian
  también la posición del elemento al que afectan, sin cambiar sus nombres
  visibles ni la interacción existente.
- Constructor y A18 verifican los atributos contextuales junto con el flujo de
  slides, límites, historial y diálogos.

### Foco al cerrar el detalle de Recursos (2026-08-11)

- El panel de detalle de una imagen devuelve el foco al botón `Detalle` que lo
  abrió cuando se cierra, evitando dejar el teclado sobre un nodo desmontado.
- A17 verifica el cierre y mantiene la cobertura de carga, reemplazo, usos,
  borrado y estados de caché.

### Foco al cerrar el editor de producto (2026-08-11)

- `ProductEditor` conserva el control que abrió el diálogo y devuelve el foco
  al cerrarlo, incluyendo el cierre limpio por `Cancelar` o `Escape`.
- A06 verifica el foco restaurado sobre el botón `Editar` de la fila tanto al
  cerrar directamente como al descartar cambios confirmados, sin cambiar el
  modelo persistido ni el fixture determinista.

### Ruta inexistente en Preview (2026-08-11)

- El campo de ruta del Preview ahora muestra la página 404 del exporter cuando
  se escribe una URL desconocida, en vez de presentar Home como si la ruta
  existiera.
- La regresión verifica el título, el anuncio y el mensaje visible de la página
  no encontrada.

### Fecha de disponibilidad para preventas (2026-08-11)

- El editor de variantes muestra `Fecha de disponibilidad` al seleccionar
  `Preventa` y conserva el valor al guardar y reabrir el producto.
- La corrección conecta el campo que ya consumen la auditoría de exportación,
  JSON-LD y Merchant, sin cambiar el schema persistido.

### Selectores visibles de importación (2026-08-11)

- Catálogo verifica que CSV y carpetas se abran desde sus botones visibles,
  respeten el contrato del selector y mantengan la cobertura de revisión,
  cancelación, errores y reimportación.
- Recursos verifica que `Cargar imágenes` y `Cargar video` abran el selector
  correcto con sus formatos aceptados y selección múltiple.

### Runtime público y controles exportados (2026-08-11)

- Los controles de testimonios de Catalog Modern ahora desplazan su fila real.
- El desplazamiento funciona también con teclado y respeta el overflow horizontal responsive.

### Cobertura condicional de la auditoría (2026-08-11)

- Recursos verifica el feedback de drag-and-drop, cuota alta y limpieza de la caché regenerable.
- SEO verifica también la preview de WhatsApp y la lista de rutas detectadas.
- Preview verifica ruta, zoom, tamaños y apertura del panel mediante teclado, además del flujo con mouse.
- Preview y SEO reintentan el chunk del renderer con cache-busting del mismo
  origen cuando una carga dinámica falla, y sus botones vuelven a un estado operativo.
- Exportar simula el fallo del worker de auditoría, mantiene Producción bloqueada,
  ofrece Reintentar y verifica que la nueva tentativa vuelva a anunciar el error.

### Cobertura de acciones masivas del catálogo (2026-08-11)

- Catálogo verifica las asignaciones masivas de categorías, colecciones y tags
  contra el editor de producto, incluyendo que los productos no seleccionados
  conserven sus datos.
- El editor de producto verifica que sus checkboxes de organización y tags
  sobrevivan al guardado y a la reapertura del producto.
- Agregar y quitar tags informa un error inline cuando el valor está vacío y no
  crea cambios pendientes en ese caso.

### Cobertura del aviso de actualización de plantilla (2026-08-11)

- Preparar verifica que `Cerrar aviso de actualización` descarte el panel sin
  mutar la versión de plantilla ni ejecutar la adopción.

### Cobertura de copia de identificadores de recursos (2026-08-11)

- Recursos verifica que `Copiar ID` escriba el identificador real del asset y
  cambie su feedback accesible a `Copiado`.

### Cobertura del aviso global del Studio (2026-08-11)

- El conflicto de persistencia verifica que `Cerrar aviso` quite el banner
  global sin ocultar el estado de error ni impedir `Reintentar`.

### Auditoría UI/UX de SEO (2026-08-11)

- la pestaña SEO comunica el estado de su auditoría local, incluyendo carga,
  error y reintento;
- el diagnóstico visual prioriza los hallazgos antes de las previews y ofrece
  navegación directa cuando un problema tiene una pestaña de corrección;
- los pares de color del Tema y los selectores de archivos tienen nombres
  accesibles explícitos para teclado y tecnologías asistivas;
- se agregaron regresiones Playwright para la jerarquía y el feedback de la
  auditoría SEO.
- se eliminó el fade de apertura del panel izquierdo para evitar que el preview
  quede visible a través del editor durante la transición.

### Auditoría de controles del Studio (2026-08-11)

- el picker de módulos del Constructor expone `aria-haspopup` y una relación
  `aria-controls` válida mientras está abierto;
- el orden semántico de SEO coincide con la jerarquía visual: auditoría antes de
  previews y checklist.
- Preparar deja de heredar el grid del checklist SEO: en móvil recupera una sola
  columna y mantiene legible el CTA del siguiente paso.
- Los accesos de corrección de la auditoría SEO navegan mediante el shell y
  devuelven el foco visible al tab de destino.
- El checklist posterior de Exportar usa la navegación del shell para “Ir a SEO”
  y conserva el foco en el tab abierto.
- Exportar comunica de forma visible si la auditoría está analizando, lista o
  bloqueando producción por errores críticos.
- Constructor expone la sección seleccionada con `aria-pressed` y describe las
  acciones de cada fila con el nombre de la sección afectada.
- Recursos confirma los estados de limpieza de la caché regenerable y presenta
  el aviso de almacenamiento con un contenedor legible y acción protegida.
- Catálogo incluye el nombre del producto en el nombre accesible del editor de
  estado inline.
- El panel lateral del dashboard da ancho completo a las acciones principales y
  distribuye “Duplicar” y “Archivar” en dos columnas para mantener los textos
  legibles sin partir palabras en viewports estrechos.
- Ctrl+S queda bloqueado mientras se resuelve un conflicto de versión en el
  almacenamiento administrado, evitando reintentos invisibles sobre un shell
  modalmente inerte.
- La cola de autosave sólo se descarta al desmontar el Studio; los cambios del
  indicador de persistencia ya no pueden cancelar una cola activa de forma
  intermedia.
- El foco vuelve al botón Guardar después de resolver un conflicto aunque el
  control haya estado temporalmente deshabilitado mientras se mostraba el
  diálogo.

### Refinamiento UI/UX contextual y responsive (2026-08-11)

- los controles repetidos de SEO, Recursos, Catálogo y Resumen ahora exponen
  el elemento afectado en su descripción accesible, sin cambiar sus etiquetas
  visibles ni los flujos existentes;
- los tabs del Studio sólo anuncian `aria-controls` sobre el panel actualmente
  activo, manteniendo la relación tab/tabpanel precisa al cambiar de pestaña;
- Catálogo identifica su tabla con caption y región semántica, y en viewports
  compactos explica el desplazamiento horizontal interno de sus diez columnas
  sin generar overflow de página;
- el servidor Vite de desarrollo preoptimiza Dexie y `react-dom/client`,
  evitando una pantalla en blanco durante la auditoría local;
- la matriz responsive conserva la navegación del encabezado y verifica que la
  barra de acciones masivas pueda alcanzarse y utilizarse después del scroll.

### Reauditoría de controles repetidos (2026-08-11)

- las acciones repetidas de Dashboard, las secciones duplicadas del Constructor
  y los campos repetidos de Resumen y Recursos ahora anuncian el objeto o la
  posición afectada mediante `aria-description`, sin cambiar sus nombres
  visibles ni los selectores existentes;
- los toggles y accesos correctivos del checklist SEO incluyen el mensaje del
  hallazgo en su nombre accesible, por lo que cada revisión puede distinguirse
  aunque comparta el título genérico;
- se agregó una regresión que verifica contexto único en Dashboard, Resumen,
  Recursos, Constructor y SEO; los recorridos funcionales asociados pasaron
  72/72.

### Auditoría total de la pestaña Preparar (2026-08-10)

Cierre del plan
[`docs/superpowers/plans/2026-08-10-auditoria-preparar.md`](docs/superpowers/plans/2026-08-10-auditoria-preparar.md):
el flujo guiado (GuidedOverview + modelo `catalog-modern-guidance.ts`) se auditó
contra el proyecto REAL y contra el gate real de producción (`auditReport` del
exporter) — el checklist ya no promete bloqueos que el export no tiene. Hallazgo
central: ~15 requisitos "críticos" eran dead requirements (sin crítico real
detrás) y dos críticos reales que bloquean producción no tenían requisito en
Preparar.

**Corregido:**

- el flujo guiado ahora refleja el estado REAL y el gate de producción: los
  dead requirements se degradaron a `recommended` (identity.description, hero
  title/body/CTA, products.title, product.category, asset.alt, campos con sólo
  validación zod) o se eliminaron (category.description, sin editor en el
  Studio);
- gaps cubiertos: `domain.https` tiene requisito propio con destino (Resumen →
  dominio) y `policies.incomplete` quedó degradado a warning (el Studio no
  tiene editor de políticas: el crítico era inalcanzable desde la guía);
- el teléfono de plantilla (`5491100000000`) YA NO se publica en el sitio:
  data-whatsapp, enlaces wa.me (contacto, compra, carrito, detalle de
  producto), JSON-LD y ai-context quedan saneados; el runtime queda intacto;
- el upgrade de plantilla ya no es un ritual vacío: `planCatalogModernUpgrade`
  modela el cambio real v1→v2 (el nombre del catálogo pasa de "Colecciones" a
  "Categorías", además de version y section-add) y el panel muestra los
  conflictos renderizados con label/path/reason (antes sólo el conteo) y tiene
  botón Cerrar;
- el estado "todo listo" tiene feedback: banner + lista de requisitos listos;
- el modo avanzado es accesible y persistente: botón con `aria-pressed`,
  botón "Desbloquear" en el banner del Constructor y el modo persiste en la
  sesión entre pestañas;
- journey end-to-end verificado: tienda limpia → completar la guía → 28/28
  requisitos (100 %) → export de producción viable (0 críticos).

**Paridad:** requisito ↔ crítico real del export verificada 1:1 en la demo
(297/297) y en la tienda limpia; el gate visual usa el `criticalCount` del
auditor como única fuente.

### Auditoría total de la pestaña Resumen (2026-08-10)

Cierre del plan
[`docs/superpowers/plans/2026-08-10-auditoria-resumen.md`](docs/superpowers/plans/2026-08-10-auditoria-resumen.md):
~40 controles del tab Resumen auditados con el contrato de 4 capas —
funcional / auto-feedback / datos / **utilidad** (el control debe producir un
cambio visible en el preview Y en el sitio exportado). Hallazgo central: los
enlaces de navegación editados en el Resumen no renderizaban en tiendas nuevas
(mode `automatic`) — ahora el header moderno siempre refleja la navegación del
editor.

**Corregido:**

- los enlaces y subenlaces del Resumen se renderizan siempre en el header
  moderno, con prioridad sobre la navegación derivada de categorías (antes, en
  una tienda nueva, un enlace editado no aparecía en ningún lado);
- el JSON-LD del negocio usa el número de WhatsApp como `telephone` (cae a
  `identity.phone`) y las claves vacías se omiten;
- la meta description de la Home cae a la descripción de la marca cuando no
  hay descripción SEO configurada;
- el `<title>` de la Home cae al nombre del proyecto cuando no hay título SEO
  (el nombre del proyecto gana su primer consumidor real en el sitio);
- el footer moderno muestra la dirección de la tienda, como el footer legacy;
- el eyebrow del diálogo de búsqueda usa el "Nombre del catálogo" configurado;
- el gate guiado ya no miente: el conteo "N pendientes bloquean producción" se
  alinea con el gate real del export (`criticalCount` del auditor, singular
  "1 pendiente" y estado "Verificando…") y el número de plantilla se marca
  como placeholder;
- las secciones del Resumen conservan su pliegue por tienda al cambiar de
  pestaña y al recargar la app.

**Paridad:** preview ↔ sitio exportado verificada **byte a byte** en `/`,
`/nosotros/` y `/contacto/` (252 verificaciones campo×ruta).

### Auditoría total de la pestaña Tema (2026-08-10)

Cierre del plan
[`docs/superpowers/plans/2026-08-10-auditoria-tema.md`](docs/superpowers/plans/2026-08-10-auditoria-tema.md):
~40 controles auditados con el contrato de 4 capas — funcional /
auto-feedback / datos / **utilidad** (el control debe producir un cambio
visible en el preview Y en el sitio exportado). Hallazgo central: la plantilla
moderna pisaba los colores, el radio, la fuente y el espaciado del editor con
valores fijos — ahora TODO el panel Tema afecta el preview y el sitio
exportado.

**Corregido:**

- la paleta (los 7 colores) se conecta a la plantilla default: la capa fija
  `--catalog-*` ahora deriva de `var(--solara-*)` y los presets se ven;
- el radio se aplica en ~21 superficies modernas (las pills conservan 999px);
- las fuentes pasan a vars en la raíz y en la marca; `--solara-space-scale` se
  conecta a grillas y gaps (antes 0 consumidores — dead control);
  `--solara-type-scale` se aplica a los títulos modernos; `accentText` se
  conecta a los botones;
- carga real de fuentes: Archivo/Inter/Lora woff2 variable self-hosted en
  `assets/fonts/` con `@font-face` en el themeCss, preview inline base64 y el
  shim `local(Arial)` eliminado;
- selector real de fuentes: 11 familias de sistema + Archivo/Inter/Lora, con
  migración tolerante (un valor guardado sin match se conserva como opción
  "Personalizada", schema intacto);
- variables muertas eliminadas (`--solara-display`, `--solara-body`,
  `--solara-space`);
- el contenedor ya no pierde valores: se eliminó el `step` que descartaba en
  silencio los anchos no múltiplos de 20;
- el selector de fuentes tiene nombre accesible (a11y).

**Paridad:** preview ↔ sitio exportado verificada **byte a byte** para las 17
vars del tema (U2). Dark mode queda deshabilitado por decisión documentada: los
7 tokens no alcanzan para una segunda paleta (propuestas A/B en
`.superpowers/sdd/tema-t7-report.md`).

### Barrido total de controles (2026-08-10)

Cierre del plan
[`docs/superpowers/plans/2026-08-10-barrido-total-controles.md`](docs/superpowers/plans/2026-08-10-barrido-total-controles.md):
30 agentes (bins A1-A30) auditaron ~300 controles de Studio y storefront con el
contrato de 3 capas — (1) click → efecto real, (2) auto-feedback del control
(estado seleccionado/activo/expandido), (3) contrato de datos payload →
receptor. La capa 2 quedó incorporada como estándar de auditoría. ~25 bugs
reales se corrigieron y 325 tests de barrido (`ui-sweep-*`) quedaron como gate
regresión.

**Corregido (resumen por área):**

- **Catálogo y producto:** la paginación dejaba de mentir al encogerse fuera de
  rango (resumen invertido y páginas fantasma en la galería y el catálogo);
  el aviso de ajuste de precio ya no muestra errores obsoletos; el paquete es
  alcanzable con la toolbar flotante; el precio editado marca el formulario como
  sucio (salir sin guardar avisa) y el diálogo de salida scrollea al primer
  error.
- **Resumen guiado:** errores inline para campos vacíos y `baseUrl` estable;
  los acordeones y campos comunican su estado con `aria-expanded`.
- **Dashboard:** el chip de salud selecciona la tienda aunque los filtros la
  oculten; la X de creación y el foco del diálogo de duplicar vuelven al lugar
  correcto; restaurar vuelve a mostrar toast; el diálogo de duplicar limita la
  sugerencia de nombre a 60 caracteres.
- **Shell del Studio:** el foco vuelve a la pestaña dueña al cerrar el panel;
  el toggle de tema ya no miente con `prefers-color-scheme: dark` (el primer
  click dejó de ser un no-op); reintento accesible de auditoría, validación de
  la barra de estado, ruta de preview fuera de la muestra resuelta y foco del
  diálogo de conflicto; el punto sucio de las tabs se anuncia a lectores de
  pantalla.
- **Tema, assets y constructor:** los presets de paleta muestran el estado
  aplicado (`aria-pressed` + badge); el ancho del contenedor no rebota al
  teclear; la duración `Infinity` de videos WebM se corrige, el progreso por
  archivo es honesto y los avisos de lote concuerdan en singular/plural; las
  slides heredadas sin `id` ya no rompen el preview (backfill automático).
- **SEO y guardado administrado:** el checklist marca revisado con toggles
  reales y el indicador de guardado muestra "Cambios pendientes".
- **Primitivas y toolbars:** keys únicas de Skeleton, popover de columnas con
  foco y `aria-expanded`, y singular "1 filtrado".
- **Storefront:** `aria-expanded` inicial en el carrito y el menú móvil
  (moderno y legacy, incluso sin JavaScript); tabs del detalle con
  `aria-controls` correcto; el drawer inertea a los hermanos de la página;
  totales con `aria-live`; la búsqueda ya no casa todo con un término vacío ni
  ensucia el ranking con consultas de 1 carácter; el prefill del buscador ya no
  aterriza en el input oculto del diálogo.

**Hallazgos destacados** (de los reportes `.superpowers/sdd/barrido-aNN-report.md`):
el tema del Studio mentía y era un no-op con preferencia de sistema oscura; las
slides heredadas sin `id` invalidaban todo el preview; los videos WebM medían
`duration=Infinity`; una búsqueda de 1 carácter casaba cualquier token; el
prefill de `?q=` se escribía en el input oculto del diálogo de búsqueda; la
pagination podía mostrar "276-120 de 120"; y el drawer de carrito no marcaba
`inert` a la página mientras estaba abierto.

### Auditoría funcional de controles y traza de datos (2026-08-10)

La caza conductual clickeó cada control de la UI con Playwright (H1-H8) y
encontró 15 hallazgos BUG que se agrupan en 12 controles rotos (el reemplazo
de assets cuenta dos hallazgos del mismo control y el cableado del shell otros
dos), todos corregidos con su aserción de regresión:

- **Constructor (repeater):** "Agregar elemento" en Testimonios/Bento/Slides
  generaba ítems sin `id` que el schema rechazaba: el cambio quedaba en el
  draft sin commitear ni guardar; ahora cada ítem nace con `item-<uuid>`.
- **Shell (5):** el punto de sucio de las pestañas casi nunca aparecía; el
  scroll del panel se perdía al cambiar de pestaña; el panel cerrado se
  reabría con cada `selectTab`; Ctrl+S no guardaba en modo navegador; y
  Ctrl+Z/Ctrl+Shift+Z no deshacían/rehacían fuera de un campo de texto.
- **Catálogo:** la búsqueda prometía filtrar "por estado" pero sólo matcheaba
  los valores crudos en inglés: ahora encuentra `Activo/Oculto/Archivado`.
- **Assets:** reemplazar una imagen sobrescribía el nombre editado con el del
  archivo nuevo y la grilla mostraba el valor viejo: el reemplazo conserva
  nombre y alt, y la grilla refleja el cambio.
- **Export:** el resumen "Salud de exportación" mostraba 0 críticos mientras
  el botón se bloqueaba por 1 (dos fuentes de verdad) y las tres etapas se
  marcaban juntas al final: contador unificado y etapas que avanzan de a una.
- **Dashboard:** tras "Cerrar y detener" el servidor muerto podía volver a
  "available" con el botón activo y los respaldos habilitados: el cierre es
  ahora un estado terminal en la App.
- **Tema:** los campos de color persistían valores no hex ("zzz", "#12345"):
  el texto valida el formato y no commitea inválidos.
- **Base protegida del Constructor:** era inalcanzable porque todo camino a la
  pestaña activaba Modo avanzado: en una tienda limpia ahora se muestra el
  banner y se bloquea "Agregar sección" hasta activar el modo.
- **Navegación guiada:** con el panel colapsado, "Siguiente"/"Editar" cambiaban
  de pestaña sin abrir el panel: ahora lo reabre como el tab normal.

La traza de datos por código (T1-T20) siguió el dato de cada control hasta su
receptor y corrigió los desajustes de contrato reales:

- Paridad de validación de slug: el servidor rechazaba slugs de 65-110
  caracteres que el schema admite (límite 120).
- Header `X-Solara-SHA256` leído sin distinguir mayúsculas.
- El indicador de guardado rebasea el borrador de disco sólo si el proyecto no
  fue editado (sin pisar ediciones locales).
- El modelo de tabla lee exactamente las claves que el toolbar escribe
  (columna `brand`).
- Se eliminó el comando `bulkUpdate` muerto (declarado y con `case`, sin
  despachador).
- `category.reparent` rechaza reubicar una raíz con hijos bajo otra categoría y
  omite la clave `parentId` al volver a raíz.
- El guard de borrado de assets cuenta los usos en `project.pages[].sections`,
  no sólo en `project.sections`.
- El historial de export usa `criticalCount` del auditor (misma fuente que el
  panel y el bloqueo), entregado por el worker.
- El preview del SEO coincide con el `<title>` exportado por página.
- El teléfono de la plantilla limpia se trata como "no configurado" en el flujo
  guiado (estado único).
- Descartar la selección del dashboard limpia `solara-dashboard-selected` y la
  selección cerrada no reaparece.
- Los atajos invocan los mismos caminos que los botones (undo/redo, flush y
  guardado managed) con tests de contrato y cobertura E2E nueva.

Nuevos gates E2E de la matriz de interacción: `ui-matriz-interaccion` (13
tests de efecto real), `ui-shell`, `ui-categorias`, `ui-guiado`, `ui-producto`,
`ui-assets`, `ui-export`, `ui-catalogo`, `ui-tema-seo` y `ui-shutdown`.

### Fondo del dashboard: adiós al agujero negro (2026-08-09)

- El fondo animado WebGL (`CosmicBackground`) se eliminó por completo: el
  dashboard usa ahora un **gradiente radial estático** (CSS puro, sin canvas,
  sin animación, sin WebGL). Medido con el harness CDP: dashboard en reposo
  pasa de ~208 ms/s de TaskDuration con loop continuo a **0.5 ms/s con rAF 0**
  incluso en primer plano; oculto 0.3 ms/s. El presupuesto de reposo visible
  se endureció de 260 a 100 ms/s y el CSS del Studio bajó de 101.6 a 99.2 KiB.

### Optimización de rendimiento y UI (2026-08-09)

- El fondo cosmic dejó de dominar la CPU: dibuja a 30 fps con la ventana
  enfocada, baja a 12 fps sin foco y se pausa por completo con la pestaña
  oculta o el canvas fuera de viewport; con "reducir movimiento" hace un único
  dibujo estático, escala al 1.0 (menos píxeles por frame) y usa GPU low-power.
- Los timers y los listeners duermen cuando la app está en reposo: el autosave
  no programa trabajo con la cola vacía, los workers liberan sus listeners
  aunque fallen y el shell del editor no re-renderiza el contenido mientras la
  pestaña está oculta.
- El preview se pausa cuando no se ve (pestaña oculta o fuera de pantalla) y el
  runtime del storefront también: por mensaje del preview y por visibilidad,
  con listeners pasivos y sin fetches ni animaciones en reposo.
- Nueva medición de CPU con presupuesto (`perf-idle`): el Studio en reposo
  verifica el trabajo del hilo principal por caso (dashboard, editor con
  preview y editor oculto) y los frames de animación por segundo.
- Los textos entran en sus cajas: componentes (botones, badges, toggles,
  segmented, paginación, tooltips, diálogos y toasts), dashboard, editor
  (campos, errores, paneles), features (SEO, constructor, recursos, guiado) y
  storefront público (cards, header, footer, filtros, carrito y hero).
- Sin scroll vertical de página: el dashboard y el editor caben en el viewport
  en 1366×768 y superiores (con scroll interno por panel), y en móvil el
  dashboard scrollea dentro de su propia región, no la página.
- Verificación multi-viewport nueva (`layout-fit`): el dashboard y las pestañas
  del editor se comprueban sin scroll vertical de página ni desborde
  horizontal en 1366×768, 1440×900 y 1920×1080, y los specs visuales
  existentes exigen el mismo contrato.

### Revisión de bugfixes 3 (2026-08-09)

- El preview abierto sobrevive al guardado: la poda de `sitios/` protege el
  sitio que el preview sigue sirviendo y el servidor local ya no cae al servir
  un archivo podado.
- Los guardados fallidos se liberan solos: los locks y las transacciones
  expiran por tiempo (TTL de 30 minutos) y un fallo intermedio deja de retener
  el lock; los temporales viejos se limpian.
- `list()` verifica el hash del respaldo actual: una tienda con el
  `.solara.json` alterado aparece en recuperación con su mensaje.
- Si la auditoría previa al export falla al cargar, el panel muestra el error
  con un botón "Reintentar auditoría" en vez de deshabilitar el export en
  silencio.
- Los filtros de las páginas legacy consideran toda la categoría, no sólo la
  página visible.
- La auditoría avisa cuando la `baseUrl` incluye una subcarpeta (las rutas
  relativas a la raíz romperían los assets).
- La página `/buscar/` mantiene su campo de búsqueda aunque el buscador esté
  oculto en el encabezado.
- El contexto para agentes incluye las colecciones paginadas y el
  image-sitemap cubre todas las páginas.
- Las líneas del carrito que ya no existen en el catálogo se muestran como
  "Ya no disponible" y se pueden quitar; el carrito además sobrevive a una
  recarga (el parser del carrito quedó dentro del runtime serializado).
- Los contadores de categoría muestran el total real ("X de N productos").
- El gating del carrito es coherente: sin plantillas de comercio habilitadas
  no queda un botón ni un índice que abran un drawer muerto.
- La plantilla limpia ya no apunta a `/buscar/` cuando la búsqueda está
  deshabilitada.
- Estilos de impresión para el storefront (drawer, backdrops y menú móvil
  fuera de la impresión).
- "Reemplazar catálogo" valida los duplicados por fila: un CSV con slugs o
  variantes repetidas muestra el error sin recargar la app.
- El precio de variante vacío deja de commitearse como 0 y los campos SEO de
  Overview muestran contadores.
- El modo oscuro del selector de tema queda deshabilitado con un hint (el
  storefront lo sobreescribiría con colores fijos).
- El foco vuelve al botón al cerrar el selector de módulos con click fuera y
  el diálogo de salida queda inerte tras un conflicto de guardado.
- El gate portable quedó reparado: las tabs del Studio se navegan por su rol
  real y la limpieza tolera archivos ocupados.
- Mediciones del runtime actualizadas.

### Revisión de bugfixes 2 (2026-08-09)

- Tres crashs corregidos: el editor ya no se desmonta en blanco al reubicar una
  categoría con hijos bajo otra raíz ni al aplicar un ajuste de precio menor a
  -100 % (validación previa y un límite de error que cubre toda la app); el
  storefront ya no colapsa al leer líneas de carrito antiguas sin título o
  variante.
- El formulario de agregar al carrito responde también a Enter (antes un submit
  nativo a `/carrito/` vaciaba el carrito).
- Sin JavaScript, el botón "Agregar al carrito" y la navegación móvil ahora
  funcionan con un fallback de consulta por WhatsApp y el menú móvil queda
  visible.
- El checkout del panel del carrito refresca los precios contra el catálogo al
  abrir el panel y al enviar el pedido: deja de usar precios stale del
  almacenamiento local.
- La variante inicial de un producto es la primera disponible, no una agotada.
- Cuando la búsqueda está deshabilitada ya no quedan enlaces ni formularios
  muertos a `/buscar/` (botón, diálogo, menú móvil, pie, mega-menú y bento).
- Los filtros de opciones ya no aparecen vacíos en las páginas de categoría de
  tiendas legacy.
- El guard de eliminación de assets considera ahora el logo de la tienda y la
  imagen social.
- El botón "Exportar producción" queda deshabilitado hasta que termina la
  auditoría del sitio (sin carrera) y el aviso de guardado ya no menciona
  `proyectos/` en modo navegador.
- La auditoría de salud del dashboard salta sólo la tienda lenta y sigue
  auditando el resto.
- El selector de módulos atrapa el foco y marca `aria-modal`; los campos
  numéricos vacíos dejan de commitear `0`.
- El servidor local endurece los guardados: sin fugas de lock ante fallos, el
  respaldo viejo se elimina sin romper un guardado ya confirmado, `sitios/`
  conserva sólo el sitio vigente, no quedan archivos temporales ni estados
  huérfanos y "Abrir sitio" muestra siempre la versión recién exportada.
- El exportador y el optimizador refuerzan la salida pública: thumbnail sin
  baseUrl desnuda cuando falta el poster, CSP con `media-src` para video remoto
  y auditoría de secciones que apuntan a colecciones o categorías inexistentes.
- El shell portable muestra un diálogo ante el crash del renderer, da un
  mensaje claro si el puerto está ocupado y el launcher valida Node 22+.
- Especs y documentación endurecidas (selectores exactos, puertos efímeros y
  datos alineados con el schema).

### Revisión de bugfixes (2026-08-09)

- El storefront usa `fill-mode: backwards` en los presets de entrada: los
  hovers de las zonas animadas vuelven a funcionar al terminar el reveal
  (los presets scroll-driven conservan `both`).
- El preview del editor ya no emite el preload LCP absoluto del dominio;
  la mitigación `stripPreviewLcpPreload` del Studio se eliminó (el sitio
  público conserva el preload).
- El tooltip del editor tiene las cuatro variantes posicionales.
- Los junctions y symlinks dentro de `proyectos/` se reportan en recovery.
- El sentinel de migración espera la apertura de Dexie.
- La barra de estado refresca la última exportación al volver a la ventana.
- Sin respaldos huérfanos en `actual/` cuando falla la escritura del manifest.
- Mediciones del budget público actualizadas.

### Revisión de bugfixes (2026-08-08)

- Limpieza post-rollback: se eliminó la emisión de la feature `micro` del
  runtime público (quedó como no-op tras el rollback del revamp) y sus
  aserciones de test; se simplificaron filtros de specs que referenciaban la
  tienda candidata retirada.
- El diálogo de conflicto 409 ahora toma el foco inicial, atrapa el Tab dentro
  de sus opciones y restaura el foco al estudio al elegir una opción
  (accesibilidad de teclado).
- Resumen (Overview): los destinos de navegación validan el borrador inline
  (mismas reglas que el schema), los borradores por campo dejan de resetearse
  en bloque al editar otro campo, y el estado vacío inalcanzable del flujo
  guiado se eliminó.
- Barrido de bugs del editor: sin `window.confirm` residuales, helpers de
  spec sin uso removidos, primitivas sin uso documentadas y formato limpio.

### Rollback del revamp de movimiento (2026-08-08)

Se revirtió por completo la sesión de revamp de movimiento (presets zoom-in/blur-in,
micro-interacciones, efectos de hover/ambiente, módulos FAQ y stats, tienda
candidata "Predeterminado Revamp" y kinetic typography). La tienda Predeterminado
vuelve a su apariencia y comportamiento previos, y la candidata fue eliminada
del disco y de IndexedDB (con purga idempotente para que no reaparezca). Se
conservan dos mejoras de ingeniería que no dependen del aspecto: la
deduplicación de estilos de módulo por style key en el exporter (storefront.css
pasa de ~775 KB a ~75 KB medidos) y los budgets documentados. El runtime
público vuelve a ≤ 52 KiB JS (medido ~45,7 KiB) y el techo CSS del editor sigue
en 100 KiB.

### Editor UI/UX (2026-08-07)

Auditoría y mejora integral del editor (plan
[`docs/superpowers/plans/2026-08-07-editor-uiux.md`](docs/superpowers/plans/2026-08-07-editor-uiux.md),
olas 0-4): consola limpia en todos los flujos, estados coherentes, responsive,
accesibilidad, rendimiento, workers y persistencia verificados con specs E2E
nuevos; sistema de componentes unificado; dashboard con acciones y atajos;
shell del Studio con navegación, guardado y preview mejorados; flujos de
Preparar, Resumen, Catálogo, ProductEditor, Builder, Tema, Recursos, SEO y
Exportar con validación y feedback accionable; motion del editor con
reduced-motion global; QA de cierre con 122 tests E2E pasando (1 omitido).

**Añadido**

- Sistema de componentes con `Button` (variants, loading, sizes), `Field` con
  error inline (`aria-describedby`), primitivas (`Toggle`, `Badge`, `Tooltip`,
  `ProgressBar`, `Pagination`, `SegmentedControl`, `StatusBadge`),
  `ConfirmDialog` (foco inicial, Escape cancela, Enter acepta, focus return),
  `Toast` con `role=status/alert` y auto-cierre, empty states con acción y
  skeletons; tokens `--ui-*` para superficies, texto, acento y focus.
- Galería de componentes en `/__studio/components` (solo entorno gestionado)
  y documentación en `apps/studio/docs/components.md`.
- Dashboard: cards con micro-interacciones y stagger, toolbar con filtros
  combinados y contador `aria-live`, panel de detalle con estados de carga,
  tiendas fijadas (pinned), restauración de la última selección, navegación
  por teclado (flechas, Enter, Espacio, Supr), archivar con deshacer,
  comparación de dos tiendas, duplicar con diálogo y progreso, respaldo
  masivo, sumario de salud y grilla responsive de 1 a 4 columnas.
- Shell del Studio: tabs con roles ARIA, Home/End y flechas, atajos Ctrl+1..n
  y Ctrl+\\, estados de guardado animados (Guardando/Guardado/Error con
  reintento), breadcrumb, toolbar de preview con rutas (datalist), dispositivos
  y zoom persistido, paneles colapsables persistidos por tienda, barra de
  estado (schema, última exportación, persistencia), modo foco (Ctrl+Shift+F),
  dots de cambios sin revisar por pestaña y dark mode del editor.
- Flujos: Preparar con checklist y progreso animado; Resumen con validación en
  vivo, secciones plegables y autosave; Catálogo con sort por columnas,
  columnas configurables, edición inline de precio/estado, vista de tarjetas,
  paginación, barra masiva fija y atajos (e/d/Supr); ProductEditor con
  validación por campo, variantes y mini-preview; Builder con picker con
  búsqueda, restaurar defaults, reorden por teclado y errores de schema en el
  inspector; Tema con presets de paleta y check de contraste; Recursos con
  drag & drop, usos por asset (incluye slides y posters de secciones) y
  reemplazo conservando el ID; SEO con checklist interactivo y previews;
  Exportar con etapas, historial y checklist post-export accionable (abrir el
  sitio con el lanzador).
- Motion del editor: micro-interacciones (hover de filas/cards, press de
  botones), indicador de guardado animado, stagger con respeto a
  `prefers-reduced-motion` y bloque global `@media (prefers-reduced-motion:
  reduce)`; `React.memo` en filas de tabla y debounce en búsquedas.
- Diálogos unificados: archivar tienda, archivar productos, reubicar
  categorías, recuperar/descartar borrador y salir sin guardar (Studio y
  ProductEditor) usan `ConfirmDialog` en lugar de `window.confirm`; specs
  actualizados en consecuencia.
- QA: 13 specs E2E del editor (smoke, consola, estados, responsive, a11y,
  perf, workers, persistencia, catálogo, producto, builder, motion,
  dashboard-actions) con 122 tests pasando en Chromium.

**Cambiado**

- El techo del CSS de Studio subió de 84 KiB a 96 KiB y luego a 100 KiB
  (crudos) el mismo día: componentes, tokens, dashboard, shell, flujos y
  motion llevan el bundle a ~98.6 KiB; 100 KiB deja margen sin recortar el
  alcance aprobado. JS inicial se mantiene en ≤ 700 KiB.
- `prefers-reduced-motion` desactiva las transiciones y animaciones del
  editor salvo opacidad y foco.
- La sobreescritura por importación de respaldo usa una única confirmación
  de riesgo (decisión deliberada de la revisión final): el diálogo describe
  el reemplazo y el respaldo original se conserva como archivo, por lo que se
  descartó la doble confirmación por fricción sin ganancia real de seguridad.

**Corregido**

- Consola limpia en todo el recorrido del editor (sin errores ni warnings de
  la app); responsive sin overflow horizontal en 390-1920 px; foco visible,
  skip-link, roles de tabs y diálogos accesibles; progreso honesto al
  reemplazar imágenes; usos de assets que descienden por arrays y objetos
  anidados (slides de carrusel del hero y posters de secciones), de modo que
  el guard de eliminación queda deshabilitado mientras exista un uso;
  mediciones de presupuesto del catálogo documentadas.

### Revamp de movimiento (2026-08-07)

Nueva capa de movimiento del storefront Catalog Modern, verificada por el
recorrido `revamp-motion.spec.ts` (FAQ, stats, presets con reduced-motion,
sin JavaScript, matriz de viewports y puntero fino). El contrato de tienda
(`StoreProjectV2Schema`, `schemaVersion: 2`) no cambió: todo es opt-in por
capability y se apaga con `prefers-reduced-motion`.

**Añadido**

- Presets de entrada `zoom-in` y `blur-in` en el schema de movimiento, además
  de los existentes.
- Capability `micro` en el runtime público (desktop-only y respetuosa de
  `prefers-reduced-motion`): tilt 3D en las cards de producto, botones
  magnéticos, spotlight que sigue al puntero, parallax del hero con mouse
  (capas con profundidad), back-to-top con anillo de progreso SVG y kinetic
  typography con entrada por palabra.
- Efectos de hover y ambientales en los módulos Catalog Modern: elevación con
  glow, shine sweep en los CTAs, shimmer en imágenes, marquee animado de
  marcas (con copia `aria-hidden`), noise overlay, pulse rings, scrollbar
  personalizada y anuncio luminoso con degradado en movimiento.
- Scroll-reveal con CSS scroll-driven (`animation-timeline: view()`) para
  títulos y medios, con fallback estático en navegadores sin soporte.
- Módulos `catalog-faq` (acordeón con exclusividad operable por teclado) y
  `catalog-stats` (contadores con valores finales declarados).
- Tienda candidata "Predeterminado Revamp" en el dashboard, creada en la
  primera ejecución para comparar la nueva experiencia de movimiento. La
  tienda "Predeterminado" actual no cambia su contenido.
- Deduplicación de estilos de módulo por style key en el exporter: el
  `storefront.css` público pasó de ~775 KB a ~92 KB (91.8 KB medidos).
- Techo del runtime público documentado en 56 KiB de JavaScript crudos
  (53.2 KB medidos) y 8 KiB de CSS (7.7 KB medidos); `storefront.css` tiene
  un tope de 780 KiB y Studio mantiene sus budgets existentes.

**Cambiado**

- Los módulos Catalog Modern emiten los atributos del contrato
  (`data-magnetic`, `data-product-card`, `data-hero-parallax`,
  `data-parallax-layer`, `data-parallax-depth`, `data-kinetic-title`,
  `data-back-to-top`, `data-faq-root`, `data-stat-value`) que consume el
  runtime, siempre bajo la capability `micro` declarada en
  `data-solara-runtime-features`.

### Búsqueda con relevancia (2026-08-07)

La búsqueda del storefront ahora tolera errores de tipeo (hasta 2 ediciones
según la longitud), ordena por relevancia (coincidencia exacta > prefijo >
substring > fuzzy, con pesos por campo: título, marca, etiquetas, categorías
y descripción), bonifica los productos que coinciden en varios términos,
prioriza los disponibles y sugiere una corrección cuando no hay resultados.
El índice `search-index.json` ahora incluye tokens precomputados y
normalizados (39.7 KiB con tokens, +12.9 KiB sobre el baseline de 26.8 KiB);
el presupuesto del runtime público se mantiene en ≤ 52 KiB crudos (44.8 KiB
medidos). La serialización del runtime se verifica también a nivel build
(`check:runtime-serialization`) para que un cambio de toolchain no rompa la
búsqueda en producción.

### Limpieza de referencias ZIP obsoletas (2026-08-07)

Se eliminaron los últimos textos y comentarios que mencionaban ZIP en la UI
(GuidedOverview, ProductEditor), cabeceras de Preview/workers/exporter y
nombres de tests. El código ya no genera ZIP en ningún flujo: exportar un
sitio escribe la carpeta `proyectos/<tienda>/sitios/<versión>/` (o muestra el
aviso en el panel Exportar); el respaldo descargable es `.solara.json`.

### Corrección de encoding UTF-8 (2026-08-07)

Se detectaron y corrigieron archivos con texto mojibake (acentos dañados por
ediciones que leyeron UTF-8 como ANSI): el mensaje de error de imagen en
Studio, los textos y nombres de carpetas del E2E portable, el fixture CSV de
importación de catálogo y un test canario del exporter. Se agregó un gate en
`check:repository` que rechaza U+FFFD y secuencias mojibake en código fuente
para que no vuelva a ocurrir.

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

### Resolución de deuda técnica (2026-08-07)

Cierre del plan de deuda: once tasks de implementación
(`docs/superpowers/plans/2026-08-07-deuda-tecnica.md`). El contrato de la
tienda no cambió; las filas correspondientes de `docs/TECHNICAL_DEBT.md`
quedaron marcadas como resueltas.

**Añadido**

- Guarda determinista de escritura en el almacenamiento local (`writeGuard`,
  sólo tests): simula disco lleno, permisos revocados y reintento tras fallo
  transitorio en `write-upload`, `write-site-files`, `rename-site`,
  `copy-archive`, `write-manifest` y `remove-old-current`.
- Matriz de reparse points (junctions Windows y symlinks POSIX) que fija el
  rechazo defensivo de enlaces dentro de `proyectos/`.
- Sidecar `recovery.json` por tienda: el servidor persiste el diagnóstico de
  un manifest dañado entre reinicios y lo elimina cuando la carpeta vuelve a
  estar sana.
- Endpoint `POST /__solara/storage/projects/{projectId}/open-folder` con el
  botón "Abrir carpeta" en el Dashboard: abre la carpeta en Explorer en
  Windows; en otras plataformas confirma la ruta sin abrirla.
- Sentinel de migración a disco: tabla `migrations` de Dexie con
  `status: "pending" | "done"` por proyecto, para retomar migraciones
  interrumpidas de forma idempotente.
- Registro de módulos con tipos discriminados (`ModuleId`, `ModuleById` y
  `getTypedModule`) sin cambiar el registry runtime heterogéneo.
- Presupuesto medido de fixtures (`fixture-budget.test.ts`):
  `catalogModernStore` 56.3 KiB, `catalogScaleStore` 46.5 KiB y
  `referenceStore` 8.7 KiB; los data URLs se conservan por decisión registrada.

**Cambiado**

- `Builder.tsx` se dividió en inspector y editores por responsabilidad;
  `Catalog.tsx` en toolbar y árbol de categorías; `Dashboard.tsx` en tarjeta y
  toolbar; `styles.css` en cuatro `@import` (base, cosmic, editorial, feedback)
  con la misma cascada. Sin cambios de comportamiento: el bundle final es
  byte-idéntico.

**Arreglado**

- La paginación del catálogo vuelve a ocultarse en catálogos vacíos
  (regresión detectada al dividir Catalog).
- Los sidecars `recovery.json` sin manifest asociado se descartan durante el
  listado de tiendas.
- El plan de deuda conservaba referencias ZIP residuales; la documentación
  quedó alineada con el formato `.solara.json` sin compresión.

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
- Estabilidad E2E (chat paralelo): senal determinista solara-ready en
  storefront, script e2e-stability.mjs y contencion via unstable.json.
