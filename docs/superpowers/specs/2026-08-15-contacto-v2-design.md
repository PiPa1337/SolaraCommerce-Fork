# Diseño: Contacto V2 Modular

## Estado

- Aprobado por el usuario en conversación.
- Alcance: únicamente `catalog-modern-v2`.
- `catalog-modern-v1` y `legacy-editorial-v1` conservan su salida actual.
- `schemaVersion` permanece en `2`.

## Objetivo

Convertir `/contacto/` en una página de ayuda y conversión completa, con la
misma identidad visual de la Home V2 y con todos sus bloques editables,
ordenables y activables desde el Constructor.

La página debe servir tanto para una tienda pequeña que atiende por WhatsApp
como para un comercio con email, teléfono, horarios, local físico, FAQ y
políticas propias.

## No objetivos

- No crear un backend de formularios ni una bandeja de consultas.
- No modificar la página `Nosotros` en esta etapa.
- No reemplazar la estructura de Contacto de V1 o legacy.
- No duplicar un CTA de WhatsApp en la newsletter final si ya existe el CTA
  protagonista de la página.

## Arquitectura

Para Contacto V2, `project.pages[kind="contact"].sections` es la fuente de
verdad. El exporter renderiza esas secciones con el mismo sistema de módulos
que usa la Home; no se agregan bloques de contenido hardcodeados al exporter
para V2.

Se agregan módulos independientes, disponibles en la página `contact` y en la
familia `catalog-modern-v2`:

- `contact-hero`: eyebrow, título, descripción y accesos rápidos.
- `contact-form`: formulario que construye un mensaje y abre WhatsApp.
- `contact-channels`: WhatsApp, email, teléfono, dirección y horarios.
- `contact-help-grid`: cuatro bloques de ayuda configurables.
- `contact-whatsapp-cta`: bloque oscuro protagonista.
- `contact-purchase-info`: franja de Envíos, Pagos y Cambios.
- `contact-faq`: acordeón de preguntas y respuestas.
- `contact-location`: local, horarios, foto/mapa y enlace de ubicación.

El módulo de newsletter existente se reutiliza al final. El footer y el shell
de navegación también se reutilizan sin crear variantes paralelas.

Cada módulo declara `settingsSchema`, `settingsFields`, slots, disponibilidad
V2, zonas de motion y estilos aislados bajo los selectores del módulo.

## Contenido Y Settings

### `contact-hero`

- `eyebrow`, default `HABLEMOS`.
- `title`, default `Estamos para ayudarte.`.
- `body`, texto breve editable.
- `quickLinks`, repeater máximo 4 con `icon`, `title`, `body`, `href` y
  `actionLabel`.

Defaults de accesos:

- Respondemos por WhatsApp.
- Consultas generales.
- Seguimiento de pedidos.
- Cambios y devoluciones.

### `contact-form`

- `title`, default `Escribinos`.
- `body` o ayuda introductoria.
- Visibilidad de teléfono y número de pedido.
- Labels, placeholders y texto del botón.
- `reasons`, lista editable de motivos.

Los campos son nombre, email, teléfono, motivo, número de pedido opcional y
mensaje. El submit valida localmente y abre `https://wa.me/` con un mensaje
codificado que incluye todos los valores completados.

### `contact-channels`

- Título e introducción.
- Toggles independientes para WhatsApp, email, teléfono, dirección y
  horarios.
- Email, teléfono y dirección toman los valores globales de Identidad.
- Horarios tienen un texto propio editable.
- Cada canal permite editar la etiqueta de acción.

Un canal sin dato o desactivado no renderiza fila ni deja espacio vacío.

### `contact-help-grid`

Repeater máximo 4 con ícono, título, descripción, enlace y etiqueta de acción.
Defaults:

- Comprar un producto.
- Mi pedido.
- Cambios y devoluciones.
- Otra consulta.

### `contact-whatsapp-cta`

- Título `¿Preferís hablar directamente?`.
- Descripción editable.
- Etiqueta de botón `Iniciar conversación`.
- Usa el WhatsApp público de la tienda.
- Si no hay teléfono público, el módulo se oculta o muestra una salida de
  contacto configurable sin inventar un número.

### `contact-purchase-info`

Repeater máximo 3 con ícono, título, texto y enlace opcional. Defaults:

- Envíos: `Coordinamos la entrega.`
- Pagos: `Confirmamos los detalles antes de finalizar.`
- Cambios: `Consultá condiciones y disponibilidad.`

### `contact-faq`

- Toggle del módulo.
- Título e introducción.
- Repeater máximo 8 con pregunta, respuesta y `enabled`.
- Se renderiza con elementos nativos `<details>` y `<summary>`.

Defaults:

- ¿Cómo realizo una compra?
- ¿Cómo consulto el estado de mi pedido?
- ¿Hacen envíos?
- ¿Cómo solicito un cambio?
- ¿Puedo consultar disponibilidad antes de comprar?
- ¿Cómo me comunico por WhatsApp?

### `contact-location`

- Toggle principal `enabled`.
- Título y descripción.
- Dirección y horarios.
- Asset opcional de fotografía o mapa.
- URL opcional para `Cómo llegar`.

Cuando `enabled` es falso, o no hay ubicación configurada, el módulo no genera
markup ni espacio en el flujo.

## Diseño Visual

La página reutiliza la visión de la Home V2:

- Fondo cálido y tipografía existente.
- Negro/marrón para bloques protagonistas.
- Acento ladrillo para eyebrow, enlaces y acciones.
- Formas cuadradas, radios mínimos o nulos y líneas finas.
- Sin cards redondeadas ni sombras pesadas.
- Blur translúcido solo donde ayude a separar contenido de una imagen; no se
  agrega una estética nueva que compita con la Home.

Orden de desktop:

1. Hero con breadcrumb, título y accesos rápidos.
2. Formulario y canales en grilla aproximada `60/40`.
3. `¿En qué podemos ayudarte?` con cuatro bloques cuadrados.
4. CTA oscuro protagonista de WhatsApp.
5. Franja editorial Envíos / Pagos / Cambios.
6. Preguntas frecuentes.
7. Ubicación opcional.
8. Newsletter.
9. Footer.

Mobile apila en el mismo orden, con formulario y canales en una columna,
ayuda en una grilla adaptable, FAQ nativa y ubicación omitida completamente
cuando no corresponde.

## Builder

El selector de página del Builder conserva `Home`, `Nosotros` y `Contacto`.
Al elegir `Contacto`, la lista de secciones opera sobre
`project.pages[kind="contact"].sections` en lugar de `project.sections`.

El Constructor debe permitir:

- Agregar módulos compatibles con el slot `content`.
- Ordenar y eliminar secciones.
- Activar/desactivar módulos mediante el estado de sección.
- Editar textos, toggles y repeaters mediante `SettingsInspector`.
- Seleccionar assets desde el proyecto para ubicación y medios.
- Restaurar defaults de un módulo sin afectar las otras secciones.

La plantilla limpia y los fixtures V2 deben recibir una configuración inicial
de Contacto V2. Para proyectos V2 existentes con `contact.sections` vacío se
aplica una normalización compatible que agrega defaults sin modificar el
contenido de Home ni elevar `schemaVersion`.

## Render, Fallback Y Persistencia

- V2 renderiza la página desde sus módulos editables.
- V1/legacy mantienen el renderer actual como fallback compatible.
- El formulario no persiste datos personales ni los envía a un backend.
- Los links de WhatsApp, email, teléfono y ubicación se generan con helpers
  de escape y URL segura.
- Preview y exportación usan el mismo render de módulos.
- El HTML inicial sigue siendo útil sin JavaScript: textos, canales, FAQ y
  links deben estar presentes; JavaScript solo mejora el armado del mensaje de
  WhatsApp y el comportamiento visual.

## Motion Y Accesibilidad

- Los módulos declaran `data-motion-zone` y usan el observer existente.
- Hero, ayuda, CTA, FAQ y ubicación pueden tener entradas coordinadas, sin
  listeners de scroll nuevos.
- `prefers-reduced-motion: reduce` elimina animaciones y deja el contenido
  visible inmediatamente.
- Todos los campos tienen label; el acordeón usa elementos nativos; los links
  y botones tienen foco visible y targets táctiles adecuados.
- La ubicación y los canales ocultos no dejan nodos vacíos ni landmarks
  duplicados.

## SEO Y QA

- `/contacto/` conserva canonical, title y description editables de la página.
- El exporter genera `ContactPage` y breadcrumbs desde el snapshot validado.
- Tests de schema para defaults, límites y settings de módulos.
- Tests de render/export para V2 y fallback V1.
- E2E del Builder para cambiar a Contacto, agregar/ordenar/ocultar módulos y
  editar repeaters.
- E2E del formulario verificando la URL WhatsApp codificada.
- E2E responsive en desktop y mobile.
- No-JS, teclado y axe para la página exportada.
- Caso de ubicación desactivada: no hay markup ni hueco.
- Revisión visual contra la referencia aprobada, sin alterar Home V2.
