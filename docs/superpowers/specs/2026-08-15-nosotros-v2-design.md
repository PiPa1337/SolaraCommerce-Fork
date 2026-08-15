# Diseño: Nosotros V2 Editorial

## Estado

- Aprobado por el usuario en conversación.
- Alcance: únicamente `catalog-modern-v2`.
- `catalog-modern-v1` y `legacy-editorial-v1` conservan su renderer actual.
- `schemaVersion` permanece en `2`.

## Objetivo

Convertir `/nosotros/` de una página institucional básica a una página
editorial que explique identidad, criterio de selección y forma de trabajar,
reutilizando la visión visual de la Home V2.

La página debe poder funcionar para una marca grande, una marca unipersonal o
una tienda que no quiera mostrar personas.

## No objetivos

- No modificar Home, Contacto V2, V1 ni legacy.
- No crear un CMS remoto ni agregar dependencias de runtime.
- No hacer que las imágenes o textos de Nosotros dependan de URLs externas.
- No hardcodear contenido visual de V2 dentro del exporter.

## Arquitectura

Para `catalog-modern-v2`, `project.pages[kind="about"].sections` es la fuente
de verdad. El exporter renderiza la página desde módulos independientes,
igual que Home y Contacto V2.

Se agregan estos módulos V2:

- `about-hero`
- `about-history`
- `about-principles`
- `about-editorial-image`
- `about-process`
- `about-manifesto`
- `about-experience`
- `about-team`
- `about-stats`
- `about-products-cta`

El módulo de newsletter existente se reutiliza al final y el footer sigue
siendo el shell global.

V1 y legacy mantienen el contenido hardcodeado actual como fallback compatible.

## Contenido Y Settings

### `about-hero`

- `eyebrow`, default `NUESTRA MIRADA`.
- `title`, default `Una selección pensada para moverte.`.
- `body`, descripción editable.
- `actionLabel`, default `Explorar selección`.
- `actionHref`, default `/buscar/`.
- `imageAssetId`, default `asset-about-hero`, imagen editorial vertical 9:16.

El hero usa el mismo shell de `catalog-hero` de Inicio V2: `90svh`, copy a la
izquierda, media 9:16 a la derecha, ancho `--catalog-v2-wide` y el mismo
padding. Sólo usa una imagen estática; no emite video.

Cuando no hay imagen, el copy ocupa el ancho disponible sin dejar un hueco.

### `about-history`

- `title`, default `Cómo empezó todo`.
- `paragraphs`, repeater máximo 3.
- `year`, default `DESDE 2026`.
- `city`, default `BUENOS AIRES`.
- `country`, default `ARGENTINA`.

El layout desktop es 50/50: título a la izquierda y relato a la derecha. La
línea de metadatos se muestra debajo del relato.

### `about-principles`

- `title`, default `Lo que nos guía`.
- `items`, repeater máximo 4.
- Cada item contiene `number`, `icon`, `title` y `body`.

Defaults:

- `01 — Selección`: Elegimos productos que realmente sumaríamos a nuestro día a día.
- `02 — Calidad`: Priorizamos materiales, terminaciones y durabilidad.
- `03 — Simplicidad`: Una experiencia de compra directa y sin complicaciones.
- `04 — Atención`: Hablás directamente con nosotros cuando lo necesitás.

### `about-editorial-image`

- `enabled`, default `true`.
- `eyebrow`, default `NUESTRA FORMA DE ELEGIR`.
- `title`, default `Menos ruido. Mejores elecciones.`.
- `body`, explicación editable del criterio de selección.
- `imageAssetId`, fotografía horizontal opcional.

Si está desactivado o no hay asset, el módulo no genera markup ni deja espacio.

### `about-process`

- `title`, default `Cómo seleccionamos`.
- `items`, repeater máximo 4.
- Cada paso contiene `number`, `title`, `body` y `href` opcional.

Defaults:

- `01 — Descubrimos`.
- `02 — Evaluamos`.
- `03 — Seleccionamos`.
- `04 — Compartimos`.

En desktop se muestran en una fila con línea horizontal; en mobile se apilan.

### `about-manifesto`

- `quote`, default `No buscamos tener de todo. Buscamos tener lo que vale la pena.`.
- `accentLabel`, opcional.

El módulo tiene mucho whitespace y una única línea ladrillo como acento.

### `about-experience`

- `title`, default `La experiencia`.
- `items`, repeater máximo 4.
- Cada item contiene `icon`, `title` y `body`.

Defaults:

- Compra directa.
- Atención personalizada.
- Envíos.
- Información clara.

Los íconos son pictogramas lineales pequeños, no ilustraciones grandes.

### `about-team`

- `enabled`, default `true`.
- `title`, default `Detrás de la tienda`.
- `items`, repeater máximo 4.
- Cada miembro contiene `imageAssetId`, `name`, `role` y `body`.

Los defaults incluyen dos perfiles demo con retratos remotos del proyecto:
Sofía, Selección, y Martín, Atención y envíos. Una marca unipersonal puede
dejar un solo miembro; si no se quieren mostrar personas, se desactiva el
módulo completo y no queda espacio vacío.

### `about-stats`

- `items`, repeater máximo 4.
- Cada item contiene `icon`, `title` y `body`.

Defaults:

- Productos seleccionados.
- Envíos a todo el país.
- Compra directa.
- Atención personalizada.

### `about-products-cta`

- `title`, default `Conocé nuestra selección.`.
- `body`, descripción editable.
- `actionLabel`, default `Explorar productos`.
- `actionHref`, default `/buscar/` o la primera colección disponible.

## Diseño Visual

La página conserva exactamente la identidad de Home V2:

- Fondo cálido.
- Tipografía existente y títulos grandes.
- Negro/marrón para manifiesto y bloques protagonistas.
- Ladrillo como acento.
- Formas cuadradas, líneas finas y whitespace amplio.
- Sin cards redondeadas ni estética SaaS.
- Assets seleccionados desde el proyecto, con `object-fit: cover` y ratios
  explícitos.
- Los defaults visuales usan imágenes remotas de Unsplash almacenadas como
  datos de assets (`asset-about-hero`, `asset-about-editorial`,
  `asset-about-team-sofia`, `asset-about-team-martin`), sin binarios generados.

Orden desktop:

1. Hero con copy y fotografía vertical 9:16.
2. Nuestra historia.
3. Lo que nos guía.
4. Fotografía editorial grande y texto de criterio.
5. Cómo seleccionamos.
6. Manifiesto.
7. La experiencia 2x2.
8. Detrás de la tienda opcional.
9. Datos rápidos.
10. Conocé nuestra selección.
11. Newsletter.
12. Footer.

En mobile todo se apila manteniendo el mismo orden. Las imágenes ocupan el
ancho disponible y los repeaters no generan overflow horizontal. El ritmo de
padding y márgenes de cada bloque reutiliza el de Inicio V2.

## Builder

El selector de página conserva `Home`, `Nosotros` y `Contacto`. Al elegir
`Nosotros` con `catalog-modern-v2`, el picker ofrece solo módulos `about-*` y
el newsletter compartido.

El Constructor permite:

- Agregar, ordenar y eliminar módulos.
- Editar settings y repeaters.
- Activar/desactivar Historia, imagen editorial, manifiesto, proceso, equipo,
  estadísticas y CTA.
- Seleccionar assets del proyecto.
- Restaurar defaults por módulo.

`pages.about.title`, `seoTitle` y `seoDescription` permanecen como metadata de
página. El título visible del hero pertenece a `about-hero`, evitando dos
fuentes de contenido que se pisen.

Los proyectos V2 existentes con `about.sections` vacío reciben defaults al
cargarse y al exportarse. V1/legacy no reciben módulos nuevos.

## Render, SEO Y Persistencia

- V2 usa `renderProjectSections(project, aboutSections, { pageType: "about" })`.
- Nosotros y Contacto V2 comparten el renderer de hero editorial estático de
  Inicio; sus rutas nunca emiten video.
- El exporter mantiene `/nosotros/`, canonical y breadcrumbs.
- Structured data sigue siendo `AboutPage`.
- La salida V1/legacy conserva el renderer editorial actual.
- El HTML inicial contiene textos, imágenes y enlaces sin depender de JS.
- Assets usan helpers de escape, URL segura y datos del proyecto.
- Preview y exportación consumen el mismo snapshot.

## Motion Y Accesibilidad

- Hero, historia, principios, proceso, equipo, stats y CTA usan
  `data-motion-visible` y `data-motion-zone`.
- Los items pueden entrar con stagger de 70ms usando los keyframes de Home V2.
- No se agregan listeners de scroll.
- Los roots `once=true` se registran en una memoria one-shot del runtime; pausar
  y reanudar el preview no vuelve a ocultar ni reproducir el contenido ya visto.
- `prefers-reduced-motion: reduce` elimina animaciones y muestra el contenido
  inmediatamente.
- Imágenes tienen alt generado desde nombre/rol o setting editable.
- Las secciones opcionales desactivadas no generan landmarks vacíos.
- Navegación, links y controles conservan foco visible y targets táctiles.

## QA

- Tests de schemas, defaults y límites de repeaters.
- Tests de render/export V2 y fallback V1/legacy.
- E2E del Builder para seleccionar Nosotros, editar módulos, repeaters y
  toggles.
- E2E responsive desktop/mobile y no-JS.
- E2E de assets opcionales y ausencia de huecos al desactivar módulos.
- Axe y teclado en `/nosotros/`.
- Revisión visual contra la imagen de referencia enviada.
- Comparación E2E de columnas, altura, padding y spacing de hero contra Inicio en
  Nosotros y Contacto.
- `corepack pnpm check`, build, desktop package y portable smoke.
