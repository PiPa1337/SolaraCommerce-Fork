# Changelog

Todos los cambios notables de SolaraCommerce se documentan en este archivo.

El formato sigue [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/) y
cada entrada describe el cambio desde la perspectiva del usuario o del
contrato, no los mensajes de commit. El proyecto aún no tiene releases
formales: los cambios se agrupan por fecha de trabajo hasta que exista una
versión publicada.

## [Unreleased]

### Auditoría UI/UX de SEO (2026-08-11)

- la pestaña SEO comunica el estado de su auditoría local, incluyendo carga,
  error y reintento;
- el diagnóstico visual prioriza los hallazgos antes de las previews y ofrece
  navegación directa cuando un problema tiene una pestaña de corrección;
- se agregaron regresiones Playwright para la jerarquía y el feedback de la
  auditoría SEO.

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
