# Plan maestro — Storefront V2 motion-forward

**Estado:** activo desde 2026-08-12
**Repositorio autorizado:** `PiPa1337/SolaraCommerce-Fork`
**Rama de integración:** `main`
**Contrato persistido:** `StoreProjectV2`, `schemaVersion: 2`
**Familia existente preservada:** `catalog-modern-v1`

## 1. Objetivo derivado

Diseñar e implementar incrementalmente una nueva familia de storefront V2 para
SolaraCommerce, con calidad visual editorial premium y un sistema de movimiento
propio, expresivo y accesible. La V2 debe preservar completamente la V1, seguir
siendo estática y local-first, mantener la paridad entre Preview y exportación,
funcionar desde catálogos pequeños hasta 2.000 productos y permanecer abierta a
iteraciones visuales hasta que el usuario apruebe expresamente el resultado.

La nueva experiencia debe destacar por:

- animaciones especiales de hover, entrada, scroll y transición de estado;
- una home con ritmo editorial, imágenes protagonistas y jerarquía clara;
- navegación, búsqueda, categorías, producto y carrito rápidos y comprensibles;
- responsive real, no una versión desktop comprimida;
- accesibilidad WCAG 2.2 AA y alternativa completa con movimiento reducido;
- HTML inicial útil sin JavaScript y mejora progresiva cuando el runtime carga;
- rendimiento medido en cada fase, sin trasladar deuda al sitio público;
- compatibilidad explícita con tiendas V1 existentes.

## 2. Alcance

### Incluido

- shell público: anuncio, header, navegación, búsqueda, menú móvil y footer;
- home completa y módulos que la componen;
- tarjetas, grillas, colecciones, categorías, filtros y ordenamiento;
- detalle de producto, galería, variantes, disponibilidad, reseñas y relacionados;
- drawer del carrito, página de carrito y checkout por WhatsApp;
- páginas editoriales, políticas, contacto, búsqueda y estados vacíos;
- una nueva familia visual y módulos V2 editables desde Constructor;
- controles estrictamente necesarios en Studio para elegir y configurar V2;
- fixtures deterministas small, normal y large;
- sistema de movimiento y sus variantes responsive/reduced-motion;
- pruebas visuales, funcionales, semánticas, no-JS y multibrowser públicas;
- documentación de compatibilidad, actualización y rollback.

### Fuera de alcance inicial

- backend remoto, cuentas de cliente o autenticación;
- pagos online, inventario remoto o sincronización con terceros;
- analítica real de “más vistos” o recomendaciones basadas en seguimiento;
- wishlist y vistos recientemente como promesa base de V2;
- filtros server-side: la exportación sigue siendo estática;
- dependencias runtime nuevas sin autorización explícita;
- cambio de `schemaVersion` sin migración independiente y testeada;
- reemplazo automático de tiendas V1 antes de aprobar visualmente la V2.

Wishlist o vistos recientemente podrán evaluarse después como capacidades
opcionales en `localStorage`, nunca como requisito para completar la primera V2.

## 3. Decisiones de arquitectura no negociables

1. **V1 sigue disponible.** Los IDs actuales y `catalog-modern-v1` no se
   reinterpretan ni se sobrescriben.
2. **V2 es una familia nueva.** Se incorporará `catalog-modern-v2` con módulos
   V2 nuevos o wrappers explícitos; no se modificará silenciosamente el aspecto
   de tiendas guardadas.
3. **El schema permanece en versión 2.** Sólo se agregarán propiedades opcionales
   compatibles cuando la configuración visual lo requiera.
4. **Preview y exportación comparten renderer.** No habrá una implementación de
   muestra separada del HTML público real.
5. **Mejora progresiva.** Navegación, productos, precios, información de compra y
   WhatsApp deben seguir siendo utilizables sin JavaScript cuando aplique.
6. **Capabilities explícitas.** Cada comportamiento se activa desde
   `data-solara-features`; no se inicializa código innecesario en todas las rutas.
7. **Dominio como autoridad.** Categorías, colecciones, variantes, precios y
   asignaciones pasan por schema/core y conservan sus índices derivados.
8. **Recomendaciones deterministas.** Relacionados se calculan por categoría,
   colección y tags; no se inventan señales de comportamiento.
9. **Git recuperable.** Cada bloque se registra en commits pequeños sobre
   `origin/main`. El hash anterior a V2 será el baseline; V1 será el mecanismo de
   rollback funcional dentro del producto.
10. **Sólo el fork recibe pushes.** `upstream` no se usa para fetch, pull, merge
    ni push.

## 4. Dirección visual

### Concepto

La V2 será una tienda editorial de moda contemporánea: calmada en reposo,
expresiva durante la interacción y orientada a producto. Debe sentirse diseñada
por una marca real, no por una plantilla SaaS ni por una colección de tarjetas.

### Sistema elegido

- paradigma: `Pristine Light Mode` para el storefront público;
- fondo: superficies sólidas cálidas con profundidad ambiental muy sutil;
- tipografía: serif editorial para display + sans refinada para interfaz;
- hero: composición editorial desplazada con imagen protagonista;
- ritmo: bloques editoriales alternados y grilla suiza flexible;
- densidad: baja-media, con aire y pocos focos por viewport;
- radios: pequeños/medios según función; evitar cápsulas indiscriminadas;
- bordes: finos y funcionales; sombras reservadas para elevación interactiva;
- color: base cálida neutra, tinta profunda y un acento comercial configurable.

### Cuatro componentes firma

1. composición editorial off-grid en hero y campañas;
2. marcos de imagen estratificados con recortes de proporción fija;
3. grilla de producto gapless o de separación mínima en momentos seleccionados;
4. muro de testimonios dividido, tipográfico y con ritmo desigual.

### Reglas anti-genéricas

- no usar cajas dentro de cajas sin función;
- no envolver cada sección en un contenedor redondeado gigante;
- no repetir indefinidamente “texto a la izquierda, imagen a la derecha”;
- no depender de gradientes violeta/azul, glassmorphism ni glows decorativos;
- no llenar el hero con badges, métricas o microcopy de sistema;
- no ocultar información comercial detrás de una animación;
- no convertir cada dato en pill;
- no usar copy aspiracional genérica cuando exista contenido real de la tienda.

## 5. Sistema de movimiento

El movimiento será un lenguaje coherente, no una colección de efectos. Se
separará en cuatro capas y cada capa tendrá tokens de duración, easing,
distancia, retraso y capacidad.

### 5.1 Respuesta inmediata

Para botones, links, inputs, controles de cantidad, swatches y tabs:

- respuesta visible en menos de 100 ms;
- compresión física mínima al presionar;
- underline o borde que se dibuja con dirección en links principales;
- iconos que se desplazan o rotan sólo cuando refuerzan la acción;
- focus visible que no depende del hover;
- reversibilidad inmediata al retirar puntero o cancelar.

### 5.2 Hover especial

Sólo en dispositivos `hover: hover` y `pointer: fine`:

- tarjetas: recorte de imagen, leve escala interna y revelado de metadata/CTA;
- categorías: desplazamiento diferencial de título e imagen;
- navegación: indicador deslizante que conserva la pestaña actual;
- botones primarios: barrido de relleno o intercambio de capas de texto;
- galería: cursor y miniaturas con transición contextual;
- testimonios: énfasis tipográfico y desplazamiento de cita, sin tilt gratuito;
- ninguna información indispensable será hover-only.

### 5.3 Appear

- hero: máscara tipográfica por líneas, clip de imagen y entrada escalonada de CTA;
- encabezados de sección: revelado por baseline, no fade uniforme;
- grillas: stagger sólo para los primeros elementos visibles, con tope estricto;
- imágenes: clip/reveal según su marco, manteniendo espacio reservado;
- contenido crítico ya está en DOM y visible si el runtime no inicia;
- una sección no queda oculta indefinidamente por un observer fallido.

### 5.4 Scroll

- header que se comprime al bajar y reaparece al invertir dirección;
- profundidad sutil en imágenes amplias mediante transform, sin mover texto útil;
- secciones narrativas puntuales con pinning simulado/progresivo sólo si no
  bloquea scroll nativo;
- reveal por zonas mediante un único `IntersectionObserver` compartido;
- desplazamientos ligados al progreso sólo para pocos elementos protagonistas;
- no habrá scroll hijacking ni listeners no pasivos sobre el documento;
- listas grandes no animan cientos de nodos simultáneamente.

### 5.5 Transiciones de navegación y estado

- View Transitions API como mejora progresiva donde esté disponible;
- fallback instantáneo y correcto en navegadores sin soporte;
- continuidad visual producto → detalle mediante imagen/título cuando sea segura;
- drawer y menú con entrada/salida interrumpible y foco gestionado;
- filtros y ordenamiento con reflow legible, sin hacer saltar el viewport;
- feedback de agregado al carrito conectado entre CTA, badge y drawer.

### 5.6 Reduced motion

Con `prefers-reduced-motion: reduce`:

- se eliminan parallax, scrubbing, máscaras móviles y grandes traslaciones;
- se reducen transiciones a cambios breves de color/opacidad o se desactivan;
- autoplay queda detenido;
- el foco, estado y jerarquía siguen siendo igual de claros;
- el contenido nunca depende de haber completado una animación.

## 6. Matriz de escala y contenido

| Perfil | Categorías | Productos | Reseñas | Propósito |
|---|---:|---:|---:|---|
| Small | 3 | 10 | 0–2 | vacíos, poco contenido y layouts sin relleno artificial |
| Normal | 12 | 150 | 40 | uso habitual y riqueza editorial |
| Large | 40 | 2.000 | 400 | rendimiento, búsqueda, filtros y estabilidad de layout |

Los datos serán deterministas. Se reutilizará `catalogScaleStore` y se crearán
generadores de test cuando sea más económico que versionar grandes fixtures.

También se probarán:

- títulos de 1, 2 y 4 líneas;
- descripciones vacías, normales y extensas;
- productos sin imagen, con una imagen y con galerías completas;
- variantes agotadas, descuentos, precios largos y monedas configuradas;
- categorías profundas y asignaciones múltiples;
- reseñas ausentes, pocas y numerosas;
- navegación con muchos elementos;
- caracteres especiales, tildes y palabras extensas.

## 7. Viewports de aceptación

- `390x844` móvil principal;
- `768x1024` tablet portrait;
- `1024x768` laptop compacta;
- `1366x768` laptop común;
- `1440x900` desktop de desarrollo;
- `1920x968` pantalla ideal del usuario maximizada, descontando el HUD de Windows.

En todos se verificará overflow, clipping, orden visual, targets táctiles, foco,
lectura, densidad, carga de imágenes y estabilidad durante animaciones.

## 8. Fases de ejecución

### Fase 0 — Baseline verificable

**Objetivo:** congelar evidencia del comportamiento y costo actual.

- registrar hash de baseline y remoto;
- capturar home, categoría, producto y carrito V1 en desktop/móvil;
- medir HTML/CSS/runtime, LCP aproximado, CLS y tareas largas;
- inventariar módulos, capabilities y rutas públicas;
- registrar qué tests protegen V1 y cuáles faltan;
- documentar deuda de budget: el runtime actual está cerca de su límite;
- validar `catalogModernStore` y `catalogScaleStore` sin cambios.

**Gate:** baseline reproducible, V1 verde y ninguna modificación visual aún.

### Fase 1 — Contrato V2 y compatibilidad

**Objetivo:** crear el espacio seguro donde V2 puede evolucionar.

- agregar `catalog-modern-v2` al contrato permitido sin cambiar schemaVersion;
- definir registro y metadata de módulos V2;
- crear fixture V2 separado de `Predeterminado`;
- garantizar que V1 exporta bytes/estructura esperados;
- definir upgrade explícito V1 → V2, inicialmente no automático;
- agregar tests de parse, backup, reload, preview y exportación para ambas familias;
- documentar rollback a V1.

**Gate:** una tienda V1 abre/exporta igual y una V2 mínima recorre todo el pipeline.

### Fase 2 — Referencias visuales image-first

**Objetivo:** fijar una fuente visual concreta antes de diseñar en CSS.

Se generarán imágenes grandes e independientes para:

1. header + hero desktop;
2. navegación móvil + hero móvil;
3. home: confianza y descubrimiento editorial;
4. home: grilla de producto y categorías;
5. categoría/filtros desktop;
6. tarjeta y estados hover/focus;
7. detalle de producto desktop;
8. detalle de producto móvil;
9. carrito/checkout desktop;
10. carrito/checkout móvil;
11. testimonios + CTA;
12. footer y páginas editoriales.

Cada referencia se analizará por texto, grilla, tipografía, spacing, color,
botones, imágenes, estados y movimiento implícito. Si un detalle no es legible,
se generará una referencia nueva específica; no se recortará una imagen anterior.

**Gate:** design spec extraída, coherente entre imágenes y suficientemente clara
para implementar sin inventar una interfaz distinta.

### Fase 3 — Fundación visual y headroom de runtime

**Objetivo:** construir tokens V2 y recuperar margen antes de sumar movimiento.

- auditar código serializado duplicado y capabilities poco segmentadas;
- reducir el runtime sin elevar el límite arbitrariamente;
- definir tokens V2 de color, tipo, spacing, radius, layout y motion;
- crear CSS aislado bajo `data-design-family="catalog-modern-v2"`;
- reservar espacio de imágenes y fuentes para evitar CLS;
- definir utilidades de reveal, stagger acotado y reduced-motion;
- agregar tests de serialización, tamaño y aislamiento V1/V2.

**Gate:** margen suficiente para fases siguientes, V1 sin drift y tokens V2
verificados en HTML exportado.

### Fase 4 — Shell, navegación y búsqueda

**Objetivo:** dar a toda la V2 una primera impresión sólida y funcional.

- anuncio no intrusivo y persistencia de cierre;
- header desktop con estados inicial, compacto y dirección inversa;
- navegación con categorías profundas y foco completo;
- búsqueda expandida/dialog/página, no-JS y teclado;
- menú móvil con scroll, Escape, trap y retorno de foco;
- cart trigger con badge y feedback coordinado;
- footer y enlaces de ayuda;
- transiciones progresivas entre rutas.

**Gate:** mouse, touch, teclado, reduced-motion, no-JS y tres navegadores públicos.

### Fase 5 — Home editorial

**Objetivo:** implementar una home memorable sin perder claridad comercial.

- hero limpio de 1–3 líneas y CTA visible en laptop compacta;
- campaña/colección con composición off-grid;
- barra de confianza semántica y breve;
- productos destacados con densidad adaptativa;
- exploración por categoría con marcos de imagen consistentes;
- bloque editorial de marca;
- testimonios divididos;
- CTA final y newsletter reemplazada por contacto real cuando no haya backend;
- animaciones diferenciadas por sección, no el mismo fade repetido.

**Gate:** paridad con referencias, 390/1024/1920, contenido small/normal/large y
sin saltos de layout.

### Fase 6 — Descubrimiento, categorías y búsqueda

**Objetivo:** que 10 o 2.000 productos sigan siendo navegables.

- encabezado de categoría y breadcrumbs;
- filtros accesibles por disponibilidad, precio, tags y opciones;
- ordenamiento real y conteo honesto;
- panel responsive sin scroll horizontal;
- paginación como base estática/no-JS;
- “cargar más” sólo como mejora progresiva si aporta valor;
- búsqueda por relevancia, sugerencia, estados vacío/error y noindex;
- URLs compartibles cuando sea viable sin romper la base estática;
- animación de reordenamiento acotada a elementos visibles.

**Gate:** fixtures small/normal/large, teclado, no-JS y presupuesto por ruta.

### Fase 7 — Tarjeta de producto y grillas

**Objetivo:** elevar la pieza más repetida sin degradar escala.

- jerarquía clara de marca, nombre, precio, descuento y disponibilidad;
- proporciones fijas y fallback sin imagen;
- segunda imagen/preview sólo cuando exista y el dispositivo lo permita;
- hover editorial especial y focus equivalente;
- CTA rápido únicamente si variantes y contexto lo hacen seguro;
- badges limitados por prioridad;
- skeleton sólo para contenido realmente asíncrono;
- stagger con tope y desactivación automática en grillas grandes.

**Gate:** contenido extremo, pointer coarse/fine, 2.000 productos y cero CLS.

### Fase 8 — Detalle de producto

**Objetivo:** combinar deseo, información y seguridad de compra.

- galería desktop/móvil, teclado, swipe progresivo y alt text;
- título, precio, descuento, disponibilidad y SKU legibles;
- variantes con estados agotado/seleccionado/focus;
- cantidad y CTA con feedback inmediato;
- tabs/accordions para descripción, políticas y reseñas;
- reseñas paginadas o resumidas sin ocultar el total;
- relacionados deterministas por tags/categoría/colección;
- transición visual desde tarjeta cuando el navegador lo permita;
- sticky purchase bar móvil si pasa pruebas de espacio y accesibilidad.

**Gate:** todas las combinaciones de variantes, no-JS, WhatsApp y SEO de producto.

### Fase 9 — Carrito y checkout WhatsApp

**Objetivo:** cerrar el recorrido con confianza y sin pérdida de contexto.

- drawer desktop y sheet móvil con animación interrumpible;
- foco inicial, trap, Escape, backdrop y retorno de foco;
- cantidades 1–99, eliminación, agotados y precios reconciliados;
- subtotal, entrega y total estimado comprensibles;
- formulario con errores próximos y datos preservados;
- mensaje WhatsApp determinista, teléfono normalizado y fallback no-JS;
- feedback coordinado al agregar, actualizar, eliminar y continuar;
- persistencia segura sin líneas corruptas o fantasmas.

**Gate:** Chromium/Firefox/WebKit, reload, storage corrupto, teclado y móvil.

### Fase 10 — Responsive y adaptación por escala

**Objetivo:** convertir las reglas responsive en comportamiento de producto.

- container queries donde reduzcan excepciones;
- densidad de nav, grilla y filtros según espacio real;
- hero y campañas recompuestos, no meramente encogidos;
- imágenes con `srcset`, tamaños y ratios apropiados;
- touch targets de al menos 44 px cuando sea posible;
- safe areas y teclado móvil;
- catálogos grandes sin animaciones masivas;
- todas las rutas en los seis viewports de aceptación.

**Gate:** sin overflow horizontal, clipping, scroll atrapado ni acciones ocultas.

### Fase 11 — Accesibilidad, rendimiento, SEO y robustez

**Objetivo:** endurecer el producto antes de volverlo predeterminado.

- WCAG 2.2 AA automatizada y navegación manual por teclado;
- roles, nombres, estados, orden y live regions;
- contraste de texto, iconos, focus y estados deshabilitados;
- reduced-motion y ausencia de flashes;
- presupuestos por runtime/CSS/HTML/ruta;
- LCP, CLS e INP sobre fixtures normal/large;
- canonical, robots, sitemap, JSON-LD, Open Graph y Merchant;
- HTML inicial y rutas útiles sin JavaScript;
- consola limpia y recursos faltantes controlados;
- release multibrowser público bajo Node 22.

**Gate:** todos los gates oficiales verdes y riesgos residuales documentados.

### Fase 12 — Comparación, migración y aprobación

**Objetivo:** decidir con evidencia cuándo V2 puede ser la experiencia nueva.

- comparativa V1/V2 con capturas equivalentes;
- recorrido de upgrade y rollback probado;
- migración opcional de una copia de `Predeterminado`;
- revisión visual del usuario en 1920x968 y móvil;
- iteraciones adicionales sin cerrar el objetivo hasta aprobación explícita;
- sólo después de aprobación, evaluar V2 como default de nuevas tiendas;
- mantener V1 disponible para tiendas existentes.

**Gate:** aprobación expresa del usuario y release completo reproducible.

## 9. Presupuestos y rendimiento

No se elevará un budget para hacer pasar una fase sin analizar primero el costo.

- recuperar headroom del runtime antes de sumar capacidades;
- medir bytes crudos y comprimidos por milestone;
- un observer compartido para reveals y un número acotado de scroll effects;
- `transform` y `opacity` como propiedades animadas preferidas;
- evitar lecturas/escrituras de layout mezcladas por frame;
- no animar listas completas fuera del viewport;
- reservar dimensiones de media y fuentes para CLS cercano a cero;
- abortar fetches de búsqueda al abandonar la página;
- mantener la carga inicial útil sin esperar JavaScript;
- registrar tareas largas y degradar automáticamente complejidad en large.

Objetivos orientativos —se validarán contra el entorno local y no se presentarán
como métricas de campo reales—:

- CLS ≤ 0,05 en rutas principales;
- ninguna animación esencial por debajo de una experiencia fluida sostenida;
- respuesta visual al input < 100 ms;
- LCP de fixture normal dentro del presupuesto existente o mejor;
- runtime V2 dentro del gate acordado sin afectar V1.

## 10. Estrategia de pruebas

### Unitarias y contratos

- schema/familias/defaults/upgrades;
- metadata y settings de módulos;
- renderers y escape/sanitización;
- capabilities y serialización del runtime;
- recomendaciones deterministas;
- búsqueda, filtros, carrito y variantes;
- budgets y aislamiento CSS.

### E2E por flujo

- abrir home → categoría → producto → carrito → WhatsApp;
- búsqueda por teclado y resultado vacío;
- filtro + orden + paginación;
- variante agotada y cambio de imagen/precio;
- menú móvil, búsqueda modal y drawer;
- reload/persistencia y datos corruptos;
- no-JS en home, categoría, producto y checkout;
- reduced-motion;
- V1 y V2 en paralelo.

### Visual y visión

- capturas de referencias y del resultado implementado en pares;
- análisis de jerarquía, proporción, recorte, spacing y ritmo;
- estados hover/focus/open/empty/error;
- revisión desktop ideal `1920x968` y móvil `390x844`;
- no aprobar una fase sólo por similitud de screenshot: debe pasar interacción.

### Gates por entrega

1. test específico del paquete;
2. typecheck del paquete;
3. budget afectado;
4. E2E del flujo;
5. responsive y reduced-motion;
6. `git diff --check`;
7. `corepack pnpm check:repository`;
8. commit pequeño en español;
9. push sólo a `origin/main`.

### Gate release

- `corepack pnpm check`;
- `corepack pnpm build`;
- `corepack pnpm check:budgets`;
- `corepack pnpm test:e2e`;
- `corepack pnpm test:e2e:release` con Node 22;
- `corepack pnpm desktop:build`;
- `corepack pnpm desktop:package`;
- `corepack pnpm portable:smoke`;
- `corepack pnpm test:e2e:portable` cuando cambie shell/persistencia.

## 11. Checkpoints y continuidad

Cada checkpoint incluirá:

- fase y porcentaje global;
- referencia visual utilizada;
- comportamiento implementado;
- archivos/contratos afectados;
- tests y métricas reales;
- capturas desktop/móvil;
- commit y push;
- deuda o riesgo descubierto;
- próximo bloque autónomo.

Los commits serán pequeños, funcionales y en español. No se crearán commits
vacíos ni se publicarán fases con gates críticos fallidos. Los artefactos
generados, builds, stores locales, screenshots temporales y `.release/` no se
versionarán; las referencias visuales estables sí podrán vivir bajo
`docs/design-references/catalog-modern-v2/` cuando formen parte de la spec.

## 12. Orden de prioridad ante conflictos

1. integridad de datos y compatibilidad V1;
2. compra y navegación funcional;
3. accesibilidad y feedback;
4. responsive y ausencia de overflow;
5. rendimiento y no-JS;
6. fidelidad a la dirección visual;
7. riqueza de movimiento;
8. detalles decorativos.

Una animación que perjudique cualquiera de los primeros cinco puntos se reduce,
se degrada progresivamente o se elimina.

## 13. Definition of Done del objetivo largo

El objetivo sólo estará completo cuando:

- V1 siga abriendo, editando, previsualizando y exportando correctamente;
- V2 tenga familia, módulos, fixture y upgrade explícitos;
- home, categoría, búsqueda, producto, carrito, checkout y páginas editoriales
  estén implementadas con la misma calidad;
- hover, appear, scroll y transiciones sean distintivos, coherentes e
  interrumpibles;
- reduced-motion ofrezca una experiencia completa;
- los perfiles small/normal/large pasen sin overflow ni degradación funcional;
- Preview, export, metadata y HTML inicial sean equivalentes;
- todos los gates proporcionales y release pasen;
- el usuario haya revisado las capturas/experiencia y apruebe expresamente el
  cierre o indique que desea detener el objetivo.

Hasta esa aprobación, el objetivo permanece abierto a nuevos ajustes visuales y
de interacción solicitados por el usuario.
