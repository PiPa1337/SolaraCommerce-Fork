# Changelog

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
