---
target: apps/studio/src/features/Dashboard.tsx
total_score: 27
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 3
target_identity: "file:C:\\Users\\PiPa\\Drive\\Documentos\\Websave\\OpenCode\\SolaraCommerce\\apps\\studio\\src\\features\\Dashboard.tsx"
target_fingerprint: "sha256:44b2d10f39152c382fdfe70ff057863271494876cdf4ee0bb7ba0e891113303f"
target_path: "C:\\Users\\PiPa\\Drive\\Documentos\\Websave\\OpenCode\\SolaraCommerce\\apps\\studio\\src\\features\\Dashboard.tsx"
timestamp: 2026-09-08T07-03-15Z
slug: apps-studio-src-features-dashboard-tsx
closed: true
---
⚠️ DEGRADED: single-context (spawn_agent unavailable in this session)

## Design Health Score

| # | Heurística | Score | Problema clave |
|---|---|---:|---|
| 1 | Visibilidad del estado del sistema | 2/4 | El título y el conteo están sólo en contenido visualmente oculto; varios estados dependen de toasts o de un `title`. |
| 2 | Correspondencia con el mundo real | 3/4 | El vocabulario de tiendas, archivado, respaldo y comparación es natural; la diferencia entre seleccionar y abrir no lo es. |
| 3 | Control y libertad del usuario | 4/4 | Hay cierre, cancelación, undo de archivado, foco restaurado y salidas claras en los flujos modales. |
| 4 | Consistencia y estándares | 3/4 | El lenguaje cosmic y los componentes son coherentes, pero el doble clic introduce una convención oculta junto a `Abrir`. |
| 5 | Prevención de errores | 3/4 | Hay confirmaciones, límites de comparación, estados protegidos y acciones destructivas escalonadas; el atajo de archivar con Delete/Backspace no es descubrible. |
| 6 | Reconocimiento antes que recuerdo | 2/4 | Los filtros tienen etiquetas accesibles, pero faltan título/conteo visibles, ayuda de atajos y una explicación de la interacción de cada tarjeta. |
| 7 | Flexibilidad y eficiencia | 3/4 | `/`, `N`, flechas, grilla/lista, fijadas y comparación ayudan a usuarios expertos; los aceleradores no se anuncian en la superficie. |
| 8 | Diseño estético y minimalista | 3/4 | La paleta oscuro/ámbar y la densidad son propias y controladas, pero la primera vista acumula controles de igual peso y metadata muy pequeña. |
| 9 | Reconocer, diagnosticar y recuperarse de errores | 3/4 | Los diálogos y toasts preservan el trabajo; algunos errores se delegan al banner global en vez de permanecer junto a la acción. |
| 10 | Ayuda y documentación | 1/4 | No hay ayuda contextual visible ni guía de primer uso; el modo de respaldo masivo sólo se explica mediante tooltip. |
| **Total** |  | **27/40** | **Aceptable: buena base, pero requiere una mejora significativa de jerarquía y descubribilidad.** |

## Design Specificity Verdict

**Evaluación manual:** se siente razonablemente authored para SolaraCommerce: el shell dark/cosmic, el acento ámbar, las tiendas fijadas, la comparación y el tratamiento de plantilla protegida expresan un estudio local de ecommerce. Sin embargo, la composición todavía puede intercambiarse por la de cualquier SaaS de inventario: la primera pantalla es esencialmente filtros + acciones + cards, sin un encabezado visible que comunique qué debe hacer aquí la persona.

**Detector determinista:** `impeccable detect --json apps/studio/src/features/Dashboard.tsx` terminó con código 0 y `[]` (0 hallazgos). Eso confirma que no aparecen patrones automáticos del detector en el TSX; no invalida los problemas de jerarquía, copy o affordances que requieren juicio humano.

**Evidencia visual:** inspeccioné el build existente en un navegador nuevo. La pantalla cargó el estado vacío/recuperación a 762×900; el entorno tenía un respaldo persistido inválido, por lo que no fue posible alcanzar una biblioteca poblada sin mutar datos locales. El banner con JSON de schema pertenece al flujo global de recuperación y queda fuera de los hallazgos de `Dashboard.tsx`. No hay overlay `[Human]` disponible: la superficie CUA expuesta no permite evaluación/mutación de página para inyectar `detect.js` de forma fiable.

## Overall Impression

La base es fuerte: el dashboard tiene una identidad clara, controles reales y buenos guardrails. La oportunidad principal no es agregar más funciones ni cambiar la estética; es hacer que el primer viewport explique inmediatamente “qué estoy viendo, cuántas tiendas hay y cuál es el siguiente paso”. Hoy la interfaz empieza por la mecánica antes que por la orientación.

## What's Working

- El registro visual oscuro/ámbar es específico, sobrio y consistente con el contrato de Studio; la acción `Nueva tienda` tiene una jerarquía reconocible.
- La progresión de complejidad está bien resuelta en varias partes: el modo comparación sólo despliega sus checkboxes y barra cuando se activa, y el detalle aparece al seleccionar una tienda.
- Hay una inversión real en control y accesibilidad: foco devuelto al origen, `Escape`, navegación por flechas, atajos `/` y `N`, labels de controles y acciones destructivas confirmadas.

## Priority Issues

### [P1] El dashboard oculta su propio título y conteo

**Por qué importa:** `Tus tiendas` y `{visible.length} visibles` existen sólo como contenido `visually-hidden` (`Dashboard.tsx:794-804`). En la primera vista visual el usuario recibe filtros y botones, pero no una orientación ni la escala de la biblioteca.

**Fix:** hacer visible un encabezado compacto con `Tus tiendas`, el conteo y, si corresponde, el modo (“activas”, “archivadas” o “coincidencias”). Mantener el `aria-live` para lectores de pantalla, pero usar la misma información para la jerarquía visual.

**Suggested command:** `$impeccable layout`

### [P1] Filtros y acciones compiten como una única franja de controles

**Por qué importa:** `DashboardToolbar` expone búsqueda, estado, orden y vista, y `Dashboard.tsx:818-860` agrega comparar, respaldar y crear sin un encabezado o separación de intención. Son más de cuatro decisiones visibles antes de llegar a una tienda; la acción primaria pierde contexto y la interfaz se siente operativa antes de sentirse comprensible.

**Fix:** crear una cabecera de biblioteca con título + `Nueva tienda`; agrupar filtros bajo una etiqueta “Filtrar y ordenar”; mover comparar y respaldo a un grupo secundario explícito o a “Más acciones”, manteniendo las capacidades. En móvil, conservar el apilado pero con el mismo orden de prioridad.

**Suggested command:** `$impeccable distill`

### [P1] `Respaldar todo` deshabilitado sólo explica el motivo por tooltip

**Por qué importa:** cuando `managed` es falso el botón queda disabled y el motivo vive en `title` (`Dashboard.tsx:822-834`). En touch, teclado y zoom no hay una explicación visible; parece una función rota aunque el modo navegador tenga una alternativa por tienda.

**Fix:** mostrar una nota de modo persistente y breve junto al grupo (“En modo navegador, descargá el respaldo desde cada tienda”) o renderizar la acción sólo en modo administrado y ofrecer un enlace/acción contextual a los respaldos por tienda.

**Suggested command:** `$impeccable clarify`

### [P2] La tarjeta tiene un camino oculto de doble clic

**Por qué importa:** el botón central selecciona (`Dashboard.tsx:141-151`), el doble clic también abre y además existe el botón visible `Abrir` (`Dashboard.tsx:180-188`). La diferencia no está explicada, no es natural en móvil y obliga a descubrir por ensayo que un clic no entra al editor.

**Fix:** elegir un modelo explícito: clic en la tarjeta para seleccionar y un único botón `Abrir`, eliminando el doble clic; o hacer que la tarjeta abra y dejar una acción secundaria separada para el detalle. Alinear la ruta de teclado con ese modelo.

**Suggested command:** `$impeccable clarify`

### [P2] La metadata de la tarjeta es demasiado comprimida para escanear prioridades

**Por qué importa:** nombre, estado, productos y fecha se apilan con 11–15px y tonos secundarios muy cercanos. En una biblioteca grande, la información comercial importante compite con el índice, pin y `Abrir`; el estado protegido depende además del color ámbar.

**Fix:** reservar una línea tipográfica claramente dominante para nombre + estado, subir ligeramente el contraste de productos/fecha y tratar “Plantilla protegida” como badge semántico, no sólo como otra línea de status.

**Suggested command:** `$impeccable typeset`

## Persona Red Flags

### Alex (Power User)

- Los atajos `/`, `N` y las flechas existen, pero no hay una ayuda visible que permita aprenderlos; Alex debe descubrirlos por inspección o memoria.
- El flujo de tarjeta exige distinguir selección, doble clic y `Abrir`; la alternativa rápida no es evidente.
- `Respaldar todo` puede estar deshabilitado en modo navegador, y la alternativa por tienda no se presenta en el mismo contexto.

### Sam (Accessibility-Dependent User)

- El foco y los nombres accesibles están cuidados, pero la orientación visual equivalente al `h1` y al conteo no existe; el usuario que amplía o navega visualmente ve una barra de controles sin contexto.
- Cada tarjeta puede aportar foco a pin, selección y apertura, mientras el detalle cambia en otra región; conviene verificar que el cambio de selección se anuncia de forma suficientemente local y no obliga a recorrer una lista grande.
- `.dashboard-cosmic-store-groups` es un `aria-live` sobre el conjunto de tarjetas (`Dashboard.tsx:862-864`); al filtrar una biblioteca grande puede generar anuncios excesivos. Debe validarse con NVDA/VoiceOver.

### Jordan (First-Timer)

- La primera acción visible no está enmarcada por un título o una explicación de la biblioteca; sólo aparecen controles.
- No hay una pista visible de que hacer clic selecciona una tienda y que `Abrir` entra al editor.
- El respaldo masivo deshabilitado no explica el modo de ejecución sin depender de hover/tooltip.

## Minor Observations

- La vista de grilla/lista usa iconos correctamente etiquetados, pero una etiqueta visible o tooltip consistente ayudaría a usuarios que no reconocen el símbolo.
- El índice numérico de las tarjetas aporta orden, pero no comunica una prioridad de negocio; si no es accionable, podría ceder espacio a la última acción o estado relevante.
- La arquitectura responsive es sensata: a ≤820px el detalle pasa a una superficie fija inferior y a ≤560px la toolbar se apila. Conviene revisar la altura útil del bottom sheet con teclado abierto en móvil.

## Questions to Consider

- ¿La primera vista podría responder “qué tiendas necesitan atención” antes de mostrar todos los controles?
- ¿Qué gana realmente el producto con el doble clic si ya existe `Abrir tienda` y una selección para el detalle?
- ¿Podrían comparar y respaldar vivir como acciones secundarias junto a una cabecera más clara, en vez de compartir el mismo peso que crear una tienda?
