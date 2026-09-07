# Plan robusto para unificar breakpoints responsive

## Objetivo y contrato deseado

Unificar todas las tiendas actuales y futuras bajo **tres modos oficiales de diseño responsive**, reduciendo el tiempo de optimización visual sin perder compatibilidad, seguridad geométrica ni cobertura de QA.

| Modo oficial | Rango | Checkpoint visual principal |
| --- | ---: | ---: |
| Mobile | 320–767 px | 390 × 844 |
| Tablet | 768–1199 px | 1024 × 900 |
| Desktop | ≥1200 px | 1440 × 900 |

**320 px es el mínimo obligatorio soportado para Mobile.** Es un límite técnico de compatibilidad, no un cuarto diseño.

> **Regla normativa:** para el layout responsive de viewport sólo se permiten
> estos tres modos unificados: **Mobile, Tablet y Desktop**. Está prohibido
> introducir un cuarto breakpoint de diseño, un preset adicional de Preview o
> tuning visual específico para un ancho intermedio. Las excepciones técnicas
> de componente o de entrega de assets que figuran en el ledger no crean modos
> adicionales ni habilitan nuevos breakpoints de diseño.

La unificación significa **tres modos de diseño**, no “tres únicos `@media`”. Se pueden conservar excepciones técnicas de ancho cuando exista una razón demostrable, por ejemplo geometría mínima de un drawer, overflow, accesibilidad o compatibilidad de un módulo legacy. La meta es eliminar tuning visual arbitrario por ancho, no borrar media queries mecánicamente.

### Principios de seguridad

- El renderer compartido afecta a todas las tiendas actuales y futuras: cualquier cambio debe validarse como contrato global.
- No tocar `proyectos/`, `.release/`, `dist/` ni `.solara-runtime/` durante esta migración.
- No resetear, limpiar ni pisar cambios ajenos del checkout. Cada lote debe poder identificarse y revertirse de forma aislada.
- Antes de retirar un breakpoint hay que demostrar qué comportamiento reemplaza y cómo se conserva.
- Los tres checkpoints visuales no sustituyen los tests de frontera.
- Las media queries que no dependen del ancho (`prefers-reduced-motion`, `print`, orientación, altura, etc.) quedan fuera de esta política salvo que el cambio las afecte directamente.

---

## Fase 0. Preflight y congelar la línea base

Antes de modificar responsive:

1. Capturar `git status --short` y registrar qué archivos ya estaban modificados.
2. Identificar explícitamente los archivos ajenos a esta tarea y no tocarlos ni revertirlos.
3. Confirmar que `proyectos/`, `.release/`, `dist/` y `.solara-runtime/` no serán utilizados como fixtures ni destinos de prueba.
4. Localizar los archivos de responsive relevantes en módulos, storefront runtime, exporter/preview, tests y documentación.
5. Ejecutar una línea base enfocada de las pruebas responsive ya existentes antes del primer cambio de CSS.
6. Guardar evidencia de qué comportamiento actual se considera correcto y qué comportamiento se pretende simplificar.

### Cómo puede fallar

- Se atribuye a esta migración una regresión que ya existía antes.
- Se pisa trabajo concurrente en `styles.ts`, tests u otros archivos sucios.
- Un test o script usa accidentalmente datos reales de `proyectos/`.

### Cómo detectarlo

- El diff final incluye líneas que no pertenecen al lote responsive.
- La línea base ya falla antes de cambiar CSS.
- Aparecen cambios dentro de rutas de datos o builds ignorados.

### Mitigación

- Registrar el estado inicial y comparar cada lote contra él.
- Si la baseline falla, documentar ese fallo como preexistente y no usarlo como prueba de regresión nueva.
- Revertir únicamente archivos o hunks creados por esta tarea; nunca usar reset/stash global para “limpiar”.

### Criterio de salida

No comenzar la refactorización hasta conocer el estado inicial del checkout, los tests relevantes y el conjunto exacto de archivos que la tarea puede modificar.

---

## Fase 1. Inventario completo con ledger de breakpoints

Auditar breakpoints de ancho en:

- `packages/modules/src/styles.ts`;
- `packages/modules/src/catalog-modern.ts`;
- `packages/modules/src/definitions.ts`;
- `packages/modules/src/helpers.ts`;
- `packages/module-sdk/src/index.ts`;
- `packages/storefront-runtime/src/index.ts`;
- `packages/exporter/src/index.ts`;
- módulos legacy todavía compatibles;
- otros estilos emitidos por el storefront/exporter;
- Preview;
- tests E2E, visuales y de regresión;
- documentación vigente.

El barrido no debe limitarse a `@media`. Buscar también:

- `matchMedia(...)` en runtime;
- atributos HTML `<source media="...">`;
- `sizes` / `imagesizes` / `imagesrcset`;
- constantes que construyan media conditions del exporter;
- comparaciones JS de `innerWidth`, `clientWidth`, `visualViewport` o equivalentes;
- media queries generadas dentro de strings de HTML/CSS.

Crear un ledger antes de eliminar nada. Para cada breakpoint registrar:

| Campo | Contenido esperado |
| --- | --- |
| Archivo / línea | ubicación real |
| Ancho o rango | ej. `520`, `899/900`, `1366–1919` |
| Selector / módulo | qué UI afecta |
| Comportamiento | qué cambia visual o funcionalmente |
| Categoría | diseño/layout / técnica de componente / entrega de assets / no-breakpoint / obsoleta |
| Motivo técnico | geometría, overflow, compatibilidad, etc. |
| Evidencia para retirarlo | test o inspección que debe pasar |
| Reemplazo propuesto | regla oficial, CSS fluido, container query o conservación |
| Estado | pendiente / reemplazado / excepción documentada |

Revisar expresamente los anchos ya observados: `339`, `450`, `520`, `560`, `599/600`, `640`, `767/768`, `899/900`, `1023/1024`, `1100`, `1199/1200`, `1280`, `1366/1919` y cualquier otro que aparezca en la auditoría real.

Casos descubiertos que deben quedar clasificados explícitamente en el ledger:

- `packages/module-sdk/src/index.ts`: `renderImage()` emite `<source media="(max-width: 1023px)">`; es selección de fuente responsive y no debe eliminarse como si fuera un cuarto diseño sin revisar el contrato de imágenes;
- `packages/exporter/src/index.ts`: el preload del LCP separa `max-width: 1023px` y `min-width: 1024px`; debe seguir espejando el `<picture>` para evitar descarga incorrecta o duplicada;
- `packages/modules/src/helpers.ts`: `sizes` usa `640`, `1024` y `1280`; `1280` es un umbral de estimación de ancho de imagen, no un modo visual;
- `packages/modules/src/catalog-modern.ts`: existen `sizes` con `640/1024` y con las fronteras oficiales `767/1199`;
- `packages/modules/src/definitions.ts`: módulos legacy/compartidos también declaran `sizes` responsivos y deben entrar en el inventario;
- `packages/project-schema/src/media.ts`: `480/768/1800` son anchos de variantes físicas de imagen. Son **no-breakpoints** y una guarda automática no debe confundirlos con viewport thresholds;
- `packages/modules/src/styles.ts`: además de los cortes ya conocidos, existen cambios visuales concretos en `1024` (contacto), `899/900` (404, grillas y hero interno), `599/600` (drawer) y `451/450` (footer/gutters). Cada uno debe demostrar si es geometría necesaria o tuning histórico;
- `docs/STOREFRONT_ARCHITECTURE.md` todavía contiene una tabla normativa de breakpoints activos (`450`, `640`, `767`, `900`, `1023`, `1024`, `1100`, `1199`, `1366`) que deberá reemplazarse por el nuevo contrato para no perpetuar una cuarta definición.

### Cómo puede fallar

- Se encuentra un número en CSS y se asume que es tuning visual cuando en realidad protege una geometría mínima.
- Se auditan sólo los estilos principales y queda un breakpoint embebido en runtime, módulo legacy o test.
- Se confunden queries de ancho con media queries de accesibilidad/impresión.
- Se confunde un ancho de variante de imagen (`480/768/1800`) con un breakpoint de viewport.
- Se elimina un `media`/`sizes` de imágenes porque la página sigue viéndose bien, pero el navegador empieza a descargar un candidato demasiado grande o el preload deja de coincidir con el `<picture>`.

### Cómo detectarlo

- Un breakpoint no tiene selector, motivo o prueba asociada en el ledger.
- El número eliminado reaparece en otra fuente o el test sólo pasa porque sigue existiendo otra regla equivalente.
- El HTML exportado conserva un `source media`, `sizes` o preload que no está representado en el ledger.

### Mitigación

- No retirar nada que no tenga clasificación y evidencia.
- Limitar la gobernanza futura a media queries de viewport-width; no prohibir otras media features válidas.
- Para assets, gobernar el significado de la condición y su paridad con `<picture>`/preload, no exigir que todos los números coincidan con los tres modos visuales.

### Criterio de salida

Cada breakpoint de ancho activo debe estar inventariado y clasificado antes de comenzar su eliminación o consolidación.

---

## Fase 2. Crear una línea base de invariantes responsive antes del CSS

Definir tests o assertions que describan el comportamiento que no debe romperse.

Anchos mínimos de frontera y representación:

- 320 px;
- 390 px;
- 767 px;
- 768 px;
- 1024 px;
- 1199 px;
- 1200 px;
- 1440 px.

Cobertura adicional selectiva: 1920/2560 cuando corresponda comprobar layouts anchos.

Validar como mínimo:

- ausencia de overflow horizontal;
- modo correcto de navegación;
- carrito y drawer utilizables;
- hero y media sin clipping incorrecto;
- grillas sin colisiones ni columnas imposibles;
- imágenes sin deformación;
- nombres y textos largos;
- tarjetas de producto y categoría;
- búsqueda y filtros;
- página de producto y galería;
- formularios;
- footer;
- targets táctiles y foco accesible;
- contenido inicial útil sin JavaScript cuando corresponda;
- rutas críticas del storefront.

Agregar casos de contenido hostil o límite: nombres largos, precios largos, categorías numerosas, imágenes con relaciones distintas y texto sin espacios cuando el renderer ya deba soportarlo.

### Cómo puede fallar

- Se testean sólo 390/1024/1440 y se pierden discontinuidades exactamente en 767/768 o 1199/1200.
- Los tests existentes codifican el breakpoint viejo y producen falsos fallos o falsa confianza.
- Los screenshots comparan píxeles pero no detectan overflow, clipping o controles inaccesibles.

### Cómo detectarlo

- Un layout cambia al cruzar un solo píxel y no hay test para ambos lados.
- Un test falla únicamente porque espera un ancho antiguo sin expresar una necesidad funcional.
- El screenshot “se ve bien” mientras `scrollWidth > clientWidth` o un drawer queda fuera del viewport.

### Mitigación

- Separar assertions geométricas/funcionales de snapshots visuales.
- Revisar las expectativas antiguas antes de copiarlas al contrato nuevo.
- Probar siempre ambos lados de 767/768 y 1199/1200.

### Criterio de salida

Existe una baseline reproducible que detecta overflow, roturas funcionales y cambios de modo antes de modificar los breakpoints.

---

## Fase 3. Formalizar una única fuente de verdad del contrato responsive

Definir como contrato oficial:

- `mobile-max = 767`;
- `tablet-min = 768`;
- `tablet-max = 1199`;
- `desktop-min = 1200`;
- `mobile-min-supported = 320`.

La documentación fuente recomendada debe ser una única sección normativa en `docs/STOREFRONT_ARCHITECTURE.md`. El resto de los documentos debe referenciarla en vez de mantener tablas duplicadas que puedan divergir.

Si la arquitectura CSS actual no permite reutilizar constantes sin introducir acoplamiento innecesario, mantener los valores explícitos pero protegidos por tests/guardas de repositorio.

### Cómo puede fallar

- Se crean constantes TypeScript que el CSS embebido no puede consumir limpiamente y aumenta el acoplamiento.
- Se actualizan varias tablas copiadas y con el tiempo dejan de coincidir.
- Se interpreta “fuente de verdad” como una refactorización innecesaria del sistema de estilos.

### Cómo detectarlo

- Hay más de una definición normativa de los rangos.
- Cambiar un rango requiere editar múltiples documentos o fuentes de runtime.

### Mitigación

- Centralizar la decisión, no necesariamente la implementación física.
- Referenciar el contrato desde Testing/Guardians en vez de duplicarlo.

### Criterio de salida

Existe una definición normativa inequívoca de Mobile, Tablet, Desktop y 320 px mínimo.

---

## Fase 4. Crear una guarda contra nuevos breakpoints arbitrarios

Agregar una verificación enfocada en **condiciones de ancho de viewport**, aunque aparezcan en CSS, JS o markup generado.

Política propuesta:

- `767/768` y `1199/1200` son fronteras oficiales.
- Cualquier nuevo ancho de layout/componente debe aparecer en el ledger o mecanismo equivalente con una justificación técnica y una prueba que demuestre por qué es necesario.
- Umbrales de entrega de assets (`sizes`, `<source media>`, preload media) pueden diferir de las fronteras visuales si tienen una razón de selección de recurso y tests de paridad/rendimiento.
- Anchos intrínsecos de assets o candidatos de `srcset` (`480`, `768`, `1800`, etc.) no son breakpoints y deben quedar fuera de la regla de prohibición.
- Una excepción existente puede conservarse si sigue teniendo evidencia.
- La guarda no debe bloquear `prefers-reduced-motion`, `print`, queries de altura, orientación, safe-area u otras media features no relacionadas con la consolidación de width breakpoints.

### Cómo puede fallar

- Se implementa un regex demasiado ingenuo que bloquea CSS válido o no detecta expresiones equivalentes.
- La guarda obliga a eliminar un breakpoint necesario sólo para hacer pasar CI.
- La guarda detecta `@media` pero deja pasar `matchMedia()` o `<source media>` sin clasificación.
- La guarda marca `RESPONSIVE_IMAGE_WIDTHS = [480, 768, 1800]` como tres breakpoints nuevos aunque son tamaños físicos de archivo.

### Cómo detectarlo

- Falsos positivos sobre media queries sin width.
- Un desarrollador puede introducir un breakpoint arbitrario usando otra sintaxis y la guarda no lo ve.

### Mitigación

- Probar la guarda contra ejemplos positivos y negativos reales del repositorio.
- Permitir una lista explícita y pequeña de excepciones justificadas en lugar de una prohibición absoluta.
- Separar el parser/ledger de condiciones de viewport de los literales de ancho de assets; no usar un regex global de números `px` como fuente de verdad.

### Criterio de salida

Agregar un ancho intermedio nuevo requiere intención explícita, evidencia y documentación.

---

## Fase 5. Refactorizar breakpoints redundantes en lotes pequeños

Empezar por breakpoints claramente duplicados o de tuning visual.

Preferir, cuando preserve el diseño esperado:

- `clamp()`;
- `min()` / `max()`;
- `minmax()`;
- grid/flex fluidos;
- `auto-fit` o `auto-fill`;
- porcentajes y unidades relativas;
- límites fluidos de contenedor;
- container queries sólo donde aporten una solución más estable y sean compatibles con el storefront exportado y sus navegadores objetivo.

Cada lote debe eliminar o consolidar pocos casos relacionados y ejecutar su validación enfocada inmediatamente.

### Cómo puede fallar

- `auto-fit`, `minmax()` o `clamp()` cambian el número de columnas previsto, el wrapping o la densidad en tiendas reales.
- Se elimina un breakpoint porque “parece redundante” pero codifica una restricción geométrica real.
- Un lote demasiado grande impide saber qué cambio provocó la regresión.

### Cómo detectarlo

- Cambian las columnas o alturas esperadas en los checkpoints o fronteras.
- Aparece overflow entre checkpoints aunque los tres screenshots principales se vean correctos.
- Una regresión desaparece al restaurar una sola excepción del ledger.

### Mitigación

- Cambios por grupos pequeños y temáticos.
- Verificar continuidad dentro del rango, no sólo las tres capturas principales.
- Si una sustitución fluida altera la intención, mantener la excepción y documentarla.

### Criterio de salida

Cada breakpoint retirado tiene una sustitución demostrada; cada breakpoint que permanece tiene una razón explícita.

---

## Fase 6. Tratar las excepciones técnicas como contratos, no como deuda invisible

Revisar especialmente breakpoints pequeños como `339`, `450`, `520`, `560`, `599/600` y `640`.

Para cada uno comprobar carrito, drawer, navegación, marcas largas, tarjetas, footer, galería, formularios y texto límite.

Una excepción puede quedar si:

1. evita una rotura demostrable;
2. una solución fluida introduce peor comportamiento;
3. tiene una prueba o assertion que protege su motivo;
4. está documentada en el ledger/deuda técnica con condición de eliminación.

### Cómo puede fallar

- Se fuerza la pureza de “tres breakpoints” y se rompe un componente estrecho.
- Se dejan excepciones sin criterio y el sistema vuelve a acumular tuning por ancho.

### Cómo detectarlo

- Una excepción no puede explicar qué falla sin ella.
- Hay dos excepciones distintas resolviendo el mismo síntoma.

### Mitigación

- Exigir evidencia para conservar y para eliminar.
- Consolidar excepciones equivalentes cuando el mismo contrato las pueda cubrir.

### Criterio de salida

No quedan breakpoints “misteriosos”: cada ancho adicional es técnico, testeado y justificable.

---

## Fase 6A. Auditar el contrato responsive de imágenes sin convertirlo en modos de diseño

Tratar por separado la selección de layout y la selección de bytes de imagen. El objetivo de tres modos visuales no implica que `<picture>`, `sizes` o preload deban usar sólo `767/768/1199/1200`.

Inventariar y verificar como mínimo:

- `packages/module-sdk/src/index.ts`: `<source media="(max-width: 1023px)">` de `renderImage()`;
- `packages/exporter/src/index.ts`: `PICTURE_MOBILE_MEDIA = "(max-width: 1023px)"` y `PICTURE_DESKTOP_MEDIA = "(min-width: 1024px)"`;
- `packages/modules/src/helpers.ts`: `sizes` con `640/1024/1280`;
- `packages/modules/src/catalog-modern.ts`: funciones de `sizes` con `640/1024` y `767/1199`;
- `packages/modules/src/definitions.ts`: `sizes` de los módulos compartidos/legacy;
- `packages/storefront-runtime/src/index.ts`: `sizes` generado para resultados/búsqueda;
- `packages/project-schema/src/media.ts`: receta física `480/768/1800`, clasificada como anchos de candidatos y no como breakpoints de diseño.

La prueba de esta fase debe comprobar que el HTML exportado conserva coherencia entre:

1. `sizes` declarado y ancho visual esperado del componente;
2. `<source media>` y candidato responsive seleccionado;
3. preload LCP y el recurso que realmente puede seleccionar el `<picture>`;
4. `srcset` y archivos físicos exportados;
5. extensión/MIME/dimensiones declaradas y bytes reales cuando el lote toque el pipeline de imágenes.

### Cómo puede fallar

- La UI se ve idéntica, pero mobile/tablet descarga la fuente máxima innecesariamente.
- El preload usa la fuente desktop mientras `<picture>` elige la intermedia y se produce doble descarga.
- Se reemplaza `1023/1024` por `1199/1200` sólo para “alinear” números y empeora el LCP sin aportar consistencia visual.
- Se borra `1280` de `sizes` y el navegador sobreestima o subestima el slot real de una card.
- Un test visual pasa porque no inspecciona qué recurso descargó el navegador.

### Cómo detectarlo

- Tests deterministas del HTML exportado comparan `media`, `sizes`, `imagesizes` e `imagesrcset`.
- Prueba focal de exporter/module-sdk confirma paridad entre `<picture>` y preload.
- Donde el cambio altere selección de recursos, inspeccionar al menos un caso Mobile, Tablet y Desktop con red/browser o un test equivalente que demuestre el candidato elegido.

### Mitigación

- Mantener estos umbrales como categoría `entrega de assets` mientras su utilidad esté demostrada.
- Sólo alinearlos con las fronteras oficiales si la evidencia muestra que no cambia negativamente selección de recurso, LCP o bytes transferidos.
- No tocar la receta `480/768/1800` como parte de esta tarea salvo que exista una razón independiente de performance y tests propios.

### Criterio de salida

Los tres modos de diseño están desacoplados de la estrategia de entrega de imágenes y cada umbral adicional de assets tiene una función documentada y verificada.

---

## Fase 7. Consolidar Mobile entre 320 y 767 px

Optimizar visualmente en 390 × 844 y exigir compatibilidad funcional desde 320 px hasta 767 px.

Validar de forma especial:

- 320 y 360 px;
- 390 px como checkpoint visual;
- 430 px cuando exista riesgo por contenido;
- 767 px como límite superior.

320 debe comprobar overflow, drawers, formularios, navegación, carrito, hero, galería, grids, textos y controles.

### Cómo puede fallar

- Se diseña sólo para 390 y 320 queda funcionalmente roto.
- Se agregan microajustes distintos para 320, 360, 390 y 430, recreando el problema original.
- El ancho entra en pantalla pero el alto del viewport hace inutilizable un drawer o modal.

### Cómo detectarlo

- Hay scroll horizontal, clipping o controles fuera de alcance a 320.
- Aparecen nuevos breakpoints puramente visuales dentro de Mobile.
- Un componente depende de `100vh` y falla en viewport bajo/móvil.

### Mitigación

- Resolver con composición fluida primero.
- Tratar 320 como prueba de seguridad, no como diseño independiente.
- Incluir al menos una prueba de viewport móvil de altura reducida para componentes verticalmente críticos.

### Criterio de salida

Todo el rango 320–767 funciona sin requerir optimización visual individual por ancho.

---

## Fase 8. Consolidar Tablet entre 768 y 1199 px

Tomar 1024 × 900 como checkpoint visual principal y revisar de forma explícita los antiguos cortes 899/900, 1023/1024, 1100 y 1199.

Priorizar grid, flex, medidas fluidas y container queries justificadas antes de conservar cortes internos.

### Cómo puede fallar

- Un layout correcto a 1024 falla a 768, 900 o 1199.
- Se intenta mantener una cantidad rígida de columnas que no cabe en todo el rango.
- Tablet hereda reglas Mobile/Desktop incompatibles en los extremos.

### Cómo detectarlo

- Saltos repentinos de columna, texto o navegación dentro de 768–1199.
- Overflow o tarjetas demasiado estrechas cerca de 768 o 1199.

### Mitigación

- Probar 768, 1024 y 1199 como mínimo, más el ancho de cualquier excepción que se pretenda retirar.
- Definir límites mínimos de componente y densidad antes de decidir columnas.

### Criterio de salida

Tablet se comporta como un solo modo de diseño y cualquier excepción interna restante tiene una necesidad geométrica demostrada.

---

## Fase 9. Consolidar Desktop desde 1200 px

Tomar 1440 × 900 como checkpoint visual principal y verificar 1200, 1920 y 2560 cuando corresponda.

Revisar especialmente reglas como `1366–1919` y comprobar que una solución fluida no altere la densidad o el número máximo de columnas pretendido.

### Cómo puede fallar

- La grilla “fluida” añade demasiadas columnas en ultrawide o deja tarjetas excesivamente grandes.
- Un límite que existía para legibilidad se interpreta como breakpoint redundante.
- 1440 pasa pero 1200 tiene colisiones o 2560 queda visualmente descontrolado.

### Cómo detectarlo

- Column count, max-width o longitudes de línea salen de los límites de diseño.
- Aparece espacio vacío o estiramiento excesivo a gran ancho.

### Mitigación

- Definir max-width y límites de columna explícitos cuando formen parte de la intención visual.
- Mantener pruebas de extremos grandes como seguridad técnica, sin convertirlos en nuevos diseños.

### Criterio de salida

Desktop mantiene una intención visual estable desde 1200 en adelante sin tuning por resoluciones concretas.

---

## Fase 10. Verificar dimensiones distintas del ancho

La consolidación de width breakpoints no debe ocultar problemas de altura, safe areas o preferencias del usuario.

Revisar:

- drawers/modales con viewport bajo;
- `vh` frente a `svh`/`dvh` donde corresponda;
- contenido sticky/fixed;
- teclado virtual si afecta formularios o checkout;
- safe-area insets;
- `prefers-reduced-motion`;
- orientación cuando exista comportamiento real dependiente de ella.

### Cómo puede fallar

- Todos los tests por ancho pasan pero un teléfono apaisado o de baja altura deja controles fuera de alcance.
- La nueva regla fluida interacciona mal con un elemento fixed/sticky.

### Cómo detectarlo

- Elementos verticales críticos exceden el viewport o no pueden desplazarse.
- Un drawer no permite llegar al CTA en una altura reducida.

### Mitigación

- Añadir pocas pruebas funcionales de altura elegidas por riesgo, sin crear una nueva matriz visual completa.

### Criterio de salida

Los componentes críticos no dependen de una altura ideal para seguir siendo utilizables.

---

## Fase 11. Simplificar QA sin perder cobertura extrema

### Checkpoints visuales humanos

Usar sólo:

- Mobile: 390 × 844;
- Tablet: 1024 × 900;
- Desktop: 1440 × 900.

### Boundary/compatibility tests automáticos

Conservar:

- 320;
- 767 y 768;
- 1199 y 1200;
- 1920/2560 sólo donde protejan un riesgo real;
- alturas reducidas sólo para componentes verticalmente críticos.

Las suites que hoy usan muchos anchos deben reducirse sólo después de demostrar qué cobertura queda preservada por assertions geométricas o de frontera.

### Cómo puede fallar

- Se reduce la matriz demasiado pronto y se pierde cobertura de extremos.
- Se siguen manteniendo diez screenshots visuales y no se obtiene el ahorro buscado.
- Los tests de frontera se convierten de facto en nuevos checkpoints de diseño.

### Cómo detectarlo

- Un ancho eliminado era el único que detectaba una clase de overflow.
- Revisores siguen corrigiendo diferencias visuales específicas de 320, 430, 768, etc. aunque el contrato diga tres modos.

### Mitigación

- Separar claramente “debe verse diseñado aquí” de “debe no romperse aquí”.
- Reemplazar screenshots redundantes por assertions geométricas cuando sea suficiente.

### Criterio de salida

La revisión visual habitual exige tres tamaños, mientras los tests automáticos siguen protegiendo fronteras y extremos.

---

## Fase 12. Mantener Preview en tres modos

El Studio ya expone `desktop | tablet | mobile`; conservar ese modelo.

Mantener, salvo evidencia contraria:

- Mobile representativo: 390 px;
- Tablet representativo: 768 px en el iframe actual o ajustar sólo si el contrato de producto exige que el botón Tablet represente 1024;
- Desktop: modo amplio actual.

El plan no debe introducir nuevos botones o presets por cada boundary test.

### Cómo puede fallar

- Se modifica Preview innecesariamente y se rompe una UI que ya expresa tres modos.
- Se confunde el ancho interno actual del iframe Tablet con el checkpoint visual de QA y se cambia sin necesidad.

### Cómo detectarlo

- El diff de Preview contiene lógica nueva que no era necesaria para la consolidación.
- Aparecen más de tres opciones visibles.

### Mitigación

- Tratar Preview como consumidor del contrato y cambiarlo sólo si existe una discrepancia funcional demostrada.

### Criterio de salida

Preview continúa ofreciendo exactamente tres modos y la documentación explica la diferencia entre preset visual y pruebas de frontera.

---

## Fase 13. Proteger renderer compartido, tiendas futuras y compatibilidad legacy

La implementación debe hacerse en el renderer compartido y fixtures deterministas, especialmente `catalogModernStore`/`catalogScaleStore` cuando correspondan.

Verificar:

- módulos Catalog Modern activos;
- módulos legacy que sigan siendo parte del contrato de compatibilidad;
- densidad con catálogos pequeños y grandes;
- contenido largo;
- preview y exportación usando el mismo renderer;
- sitio inicial sin JavaScript cuando corresponda.

No usar tiendas reales de `proyectos/` como fixture destructiva.

### Cómo puede fallar

- La mejora funciona en una tienda de ejemplo pero rompe otro módulo compartido.
- Se optimiza Catalog Modern y se deja una regresión en compatibilidad legacy.
- Se valida Preview pero no el HTML exportado, o viceversa.

### Cómo detectarlo

- Diferencias entre Preview y exportación para el mismo snapshot.
- Un fixture pequeño pasa pero `catalogScaleStore` rompe densidad/columnas.

### Mitigación

- Probar fixtures deterministas representativos y el renderer compartido.
- Mantener las verificaciones de preview/export juntas en los lotes que toquen módulos o runtime.

### Criterio de salida

El contrato responsive es común a tiendas actuales y futuras y no depende de ajustes manuales por tienda.

---

## Fase 14. Actualizar documentación sin crear fuentes contradictorias

### Fuente normativa: `docs/STOREFRONT_ARCHITECTURE.md`

Documentar:

- los tres modos oficiales;
- 320 px como mínimo soportado;
- diferencia entre modo de diseño, boundary test y excepción técnica;
- diferencia entre breakpoint de layout, excepción geométrica de componente, umbral de entrega de assets y ancho físico de variante de imagen;
- política para nuevas width media queries.
- sustituir la tabla actual `Breakpoints activos` por el contrato de tres modos y, si siguen existiendo excepciones, un registro claramente no normativo de excepciones técnicas/asset-delivery con su motivo.

### `docs/TESTING.md`

Documentar:

- tres checkpoints visuales;
- anchos de frontera;
- diferencia entre validación visual y geométrica/funcional;
- cuándo usar alturas o extremos adicionales.

### `docs/GUARDIANS.md`

Documentar:

- qué guarda impide breakpoints arbitrarios;
- cómo se autorizan excepciones técnicas;
- qué suites conservan anchos extremos y por qué.

### `docs/TECHNICAL_DEBT.md`

Registrar sólo excepciones que realmente sigan pendientes de simplificación, con motivo y condición de retirada.

### `CHANGELOG.md`

Registrar la decisión cuando la implementación esté completada y validada, no durante una mera conversación de planificación.

Los documentos históricos o archivados no necesitan reescribirse si están claramente marcados como históricos y no se presentan como fuente actual.

### Cómo puede fallar

- Varias tablas se vuelven fuentes de verdad distintas.
- Se documenta “tres media queries” cuando el contrato real permite excepciones técnicas.
- El changelog declara una migración terminada antes de que los gates hayan pasado.

### Cómo detectarlo

- Buscar referencias a breakpoints devuelve contratos actuales contradictorios.
- Un lector no puede distinguir checkpoint, frontera y excepción.

### Mitigación

- Una sola fuente normativa y referencias desde los demás documentos.
- Actualizar CHANGELOG en el cierre validado.

### Criterio de salida

Toda la documentación vigente describe el mismo contrato sin prometer una pureza técnica que la implementación no necesita.

---

## Fase 15. Validación escalonada durante la implementación

### Después de cada lote pequeño

1. tests específicos del componente/módulo afectado;
2. assertions de frontera relevantes;
3. `corepack pnpm check:micro`;
4. `corepack pnpm test:e2e:smoke`.

### Cuando el lote toque `packages/modules`, renderer compartido, `storefront-runtime` o Preview

1. `corepack pnpm check:quick`;
2. `corepack pnpm test:e2e:smoke:full`.

### Cierre de la implementación completa

1. `corepack pnpm check:full`;
2. `corepack pnpm test:e2e:smoke:full`;
3. `corepack pnpm test:e2e`;
4. `git diff --check`;
5. `corepack pnpm check:repository`;
6. revisión del diff para confirmar que no entraron datos reales, builds ni cambios ajenos.

`test:e2e:audit` y `test:e2e:release` quedan on-demand según las reglas del repositorio y el riesgo final.

### Cómo puede fallar

- Se ejecutan sólo gates amplios al final y localizar una regresión se vuelve costoso.
- Un gate global falla por un problema preexistente y se interpreta como fallo de esta tarea.
- Se declara éxito sólo porque los tests unitarios pasan sin comprobar storefront real.

### Cómo detectarlo

- No existe asociación entre lote y prueba enfocada.
- Un fallo reproduce exactamente la baseline preflight.
- Preview/export o frontera no fueron ejercitados por ningún gate.

### Mitigación

- Validación incremental con evidencia por lote.
- Comparar fallos globales contra la baseline y documentar los preexistentes sin ocultarlos.
- No considerar terminada la migración si un gate obligatorio nuevo atribuible a la tarea falla.

### Criterio de salida

Todos los gates obligatorios atribuibles al cambio pasan y cualquier fallo preexistente está identificado con evidencia separada.

---

## Fase 16. Regla de parada y rollback por lote

Para evitar convertir una simplificación en una refactorización riesgosa:

1. cada lote debe tener alcance explícito y pequeño;
2. si rompe un invariante de baseline, detener ese lote;
3. aislar la regla responsable;
4. revertir sólo los cambios propiedad de ese lote si no hay una sustitución segura;
5. conservar la excepción técnica y documentarla si eliminarla requiere un rediseño fuera de alcance;
6. continuar con los demás breakpoints independientes.

### Cómo puede fallar

- Se insiste en eliminar una excepción hasta rediseñar componentes no relacionados.
- Se usa un rollback global y se pierden cambios concurrentes.

### Cómo detectarlo

- El diff crece hacia componentes que no aparecían en el ledger del lote.
- La única forma de “hacer pasar” el cambio exige modificar comportamiento de producto no solicitado.

### Mitigación

- Stop condition estricta: una excepción justificada es un resultado aceptable.
- Rollback quirúrgico por archivo/hunk propio.

### Criterio de salida

Cada lote termina en una de dos situaciones válidas: breakpoint consolidado con evidencia o excepción conservada con justificación y test.

---

## Fase 17. Criterios finales de aceptación

La unificación se considera completa cuando se cumple todo lo siguiente:

- existen exactamente **tres modos oficiales de diseño**: Mobile, Tablet y Desktop;
- Mobile soporta desde **320 px** sin overflow ni controles inutilizables;
- Tablet cubre 768–1199 px;
- Desktop cubre desde 1200 px;
- no hace falta tuning visual por cada ancho intermedio;
- los checkpoints visuales habituales son 390 × 844, 1024 × 900 y 1440 × 900;
- 320, 767/768 y 1199/1200 siguen cubiertos automáticamente como límites técnicos;
- extremos grandes siguen protegidos donde exista riesgo real;
- cualquier width breakpoint adicional está inventariado, justificado y testeado;
- cualquier umbral adicional de entrega de assets está clasificado y validado sin contarse como un cuarto modo visual;
- los anchos de variantes físicas de imagen no se confunden con breakpoints de viewport;
- no se han eliminado excepciones que codificaban geometría real;
- Preview mantiene tres modos;
- renderer compartido, Preview y exportación respetan el mismo contrato;
- tiendas actuales y futuras reciben el mismo comportamiento por renderer compartido;
- módulos activos y compatibilidad legacy relevante no presentan regresiones;
- las pruebas ya no dependen de supuestos arbitrarios de breakpoints antiguos;
- documentación vigente tiene una única fuente normativa;
- no se modificaron datos reales en `proyectos/` ni artefactos regenerables;
- no se pisaron cambios ajenos del checkout;
- los gates obligatorios del cierre están validados.

## Orden recomendado de ejecución

1. Preflight y baseline del checkout.
2. Inventario/ledger completo.
3. Tests de contrato e invariantes antes del CSS.
4. Formalizar fuente normativa y guarda de nuevos width breakpoints.
5. Consolidar redundantes en lotes pequeños.
6. Resolver o documentar excepciones técnicas.
7. Auditar `sizes`/`<picture>`/preload y separar asset-delivery de layout.
8. Consolidar Mobile.
8. Consolidar Tablet.
9. Consolidar Desktop.
10. Verificar altura y otros factores no cubiertos por width.
11. Simplificar la matriz de QA conservando fronteras/extremos.
12. Confirmar Preview y renderer compartido/legacy.
13. Sincronizar documentación.
14. Ejecutar gates de cierre.
15. Revisar diff final contra el preflight.

Este orden obliga a capturar evidencia antes de simplificar, reduce la probabilidad de borrar reglas que cumplen una función real y permite detener o revertir sólo el lote que falle sin arriesgar trabajo concurrente ni datos de tiendas.
