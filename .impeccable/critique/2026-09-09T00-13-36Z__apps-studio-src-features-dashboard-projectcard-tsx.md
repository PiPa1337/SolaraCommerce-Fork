---
target: apps/studio/src/features/dashboard/ProjectCard.tsx
total_score: 30
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 2
target_identity: "file:C:\\Users\\PiPa\\Drive\\Documentos\\Websave\\OpenCode\\SolaraCommerce\\apps\\studio\\src\\features\\dashboard\\ProjectCard.tsx"
target_fingerprint: "sha256:325dad7d8e807da912fdfd549add1730d83c56bd69248ce4807a64dc59051958"
target_path: "C:\\Users\\PiPa\\Drive\\Documentos\\Websave\\OpenCode\\SolaraCommerce\\apps\\studio\\src\\features\\dashboard\\ProjectCard.tsx"
timestamp: 2026-09-09T00-13-36Z
slug: apps-studio-src-features-dashboard-projectcard-tsx
---
# Impeccable audit + critique: panel de detalle de tienda

Target: `apps/studio/src/features/dashboard/ProjectCard.tsx`, con sus reglas visuales en `apps/studio/src/dashboard/cosmic.css`.

## Audit health score

| # | Dimension | Score | Key finding |
|---|-----------|-------|-------------|
| 1 | Accessibility | 3/4 | Semántica, nombres accesibles y foco visible están bien resueltos; los botones del detalle bajan a 30px en móvil. |
| 2 | Performance | 4/4 | El panel usa contención de layout/paint, el favicon es lazy y no agrega animaciones costosas al rail. |
| 3 | Theming | 2/4 | El panel mezcla tokens con colores RGB/hex hard-coded y la cascada neutraliza estados semánticos. |
| 4 | Responsive Design | 2/4 | Desktop y tablet están cubiertos, pero el rail móvil conserva targets de 30px y texto muy comprimido. |
| 5 | Implementation Integrity | 4/4 | Detector Impeccable: `[]`; el markup conserva acciones reales, roles de grupo y estados de loading/disabled. |
| **Total** | | **15/20** | **Good, con dos riesgos que conviene resolver antes de cerrar la superficie.** |

### Implementation Integrity Verdict

**Pass.** El detalle expresa una superficie propia de SolaraCommerce: tienda seleccionada, estado operativo, facts persistidos y acciones reales. El detector no encontró markup intercambiable o atajos anti-pattern. Los problemas principales son de jerarquía visual y responsive, no de estructura funcional.

## Design health score

| # | Heuristic | Score | Key issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3/4 | Estado activo, fecha, sitio público y textos de loading son claros; los estados de éxito/error no viven dentro del panel. |
| 2 | Match System / Real World | 4/4 | “Abrir tienda”, “Respaldar ahora”, “Duplicar” y “Eliminar tienda” hablan el idioma operativo del usuario. |
| 3 | User Control and Freedom | 4/4 | Cerrar, fijar, Escape, backup y confirmación de borrado ofrecen salidas claras. |
| 4 | Consistency and Standards | 3/4 | La grilla es consistente, pero primary, calculator y danger usan una jerarquía cromática que no coincide con su importancia operativa. |
| 5 | Error Prevention | 3/4 | Hay confirmación y protección de plantilla; archive/delete no comunican con suficiente claridad su diferencia reversible/irreversible. |
| 6 | Recognition Rather Than Recall | 4/4 | Las acciones tienen texto e icono; los facts están a la vista. |
| 7 | Flexibility and Efficiency | 3/4 | Acciones directas y foco por teclado; no hay una ruta compacta para utilities poco frecuentes. |
| 8 | Aesthetic and Minimalist Design | 2/4 | El rail muestra siete acciones y cuatro bandas con mucho aire; la superficie se percibe más como matriz que como flujo de trabajo. |
| 9 | Error Recovery | 3/4 | Las acciones y estados de protección son claros, aunque “Recursos”, “Versión en disco” y “Sitio público” no tienen ayuda contextual. |
| 10 | Help and Documentation | 1/4 | No hay ayuda contextual o explicación inline para métricas y estados operativos. |
| **Total** | | **30/40** | **Good (75%), con oportunidad clara de mejorar jerarquía y progresive disclosure.** |

## Design specificity verdict

**Sí, el shell es específico de SolaraCommerce; el rail de acciones todavía es parcialmente intercambiable.** El fondo Gargantua, el tratamiento oscuro, la terminología argentina/española, los estados de tienda y los datos de operación construyen una identidad clara. En cambio, la matriz de botones podría pertenecer a cualquier panel CRUD: todos tienen casi el mismo peso, los grupos no tienen una señal semántica visible y la acción principal no domina lo suficiente.

El detector no contradice esta lectura: `[]` confirma que no hay atajos mecánicos, pero no puede evaluar la jerarquía visual que muestra la captura.

## Overall impression

La captura se ve cuidada y usable, pero el panel intenta resolver demasiadas decisiones simultáneas en una única columna. La oportunidad más grande es convertir el rail en una secuencia de intención: abrir primero, gestionar después, y riesgo al final con una señal inequívoca.

## What's working

- La identidad seleccionada se entiende en menos de un segundo: logo, nombre y estado están arriba, con fijar/cerrar en una zona estable.
- La metadata está bien escaneada en dos columnas y usa valores tabulares legibles.
- Los botones tienen texto, iconos reales, loading, disabled, foco y grupos ARIA; eso sostiene la operación con teclado y lector de pantalla.

## Priority issues

### [P1] La acción primaria perdió su primacía visual

**Location:** `apps/studio/src/dashboard/cosmic.css:8225-8267`, `ProjectCard.tsx:461-473`.

**Why it matters:** En la captura “Abrir tienda” y “Abrir sitio público” se perciben casi como pares equivalentes, aunque la primera es la acción central del dashboard. La regla glass genérica aplica el mismo fondo al rail y la regla primary posterior sólo cambia borde/color; el usuario debe leer antes de decidir.

**Fix:** Devolver a “Abrir tienda” un tratamiento de superficie/contraste claramente primario y dejar “Abrir sitio público” como secondary quiet. Mantener el cambio dentro del shell Gargantua y probar hover/focus/disabled.

**Suggested command:** `$impeccable layout`

### [P1] El rail móvil no alcanza un target táctil robusto

**Location:** `apps/studio/src/dashboard/cosmic.css:6315-6319`.

**Why it matters:** En el breakpoint móvil los botones del detalle bajan a `min-height: 30px`; eso es difícil de tocar con una mano y queda por debajo del target de 44px usado por el audit. El test responsive comprueba composición, pero no garantiza el tamaño táctil de cada acción.

**Fix:** Mantener como mínimo 44px para las acciones táctiles del detalle móvil, permitiendo scroll interno del panel y reduciendo densidad de facts antes que reducir los controles.

**Suggested command:** `$impeccable adapt`

### [P2] Siete acciones visibles compiten en el mismo nivel mental

**Location:** `ProjectCard.tsx:455-550`.

**Why it matters:** Abrir, publicar, carpeta, dos respaldos, duplicar, calculadora, archivar y eliminar aparecen como una matriz continua. Aunque el orden ayuda, el usuario debe evaluar demasiadas opciones en una sola decisión y la separación de grupos depende casi sólo del espacio.

**Fix:** Conservar “Abrir tienda” arriba; hacer visible un grupo compacto de gestión; agrupar respaldos/utilities bajo una disclosure o menú “Más herramientas”; aislar la zona de riesgo con una señal de sección, sin cambiar handlers ni contratos.

**Suggested command:** `$impeccable distill`

### [P2] La semántica de riesgo no coincide con la semántica cromática

**Location:** `apps/studio/src/base/feedback.css:23-31`, `apps/studio/src/dashboard/cosmic.css:8408-8421`.

**Why it matters:** “Archivar” recibe el acento ámbar y “Eliminar tienda” queda visualmente neutral en la captura. Para una operación irreversible, el usuario debería reconocer el peligro antes de leer el texto; el color no debe ser la única señal, pero tampoco debe contradecirla.

**Fix:** Reservar el ámbar para la operación reversible de archive/restore y recuperar un danger rojo sobrio para eliminar, con texto, icono, confirmación y foco coherentes.

**Suggested command:** `$impeccable colorize`

## Persona red flags

### Alex — power user

- Encuentra rápido la tienda y sus acciones, pero pierde tiempo distinguiendo “Abrir tienda” de “Abrir sitio público” porque comparten demasiado peso visual.
- Debe atravesar siete botones para localizar utilities de baja frecuencia; falta una ruta compacta para respaldos/duplicado.

### Sam — teclado/lector de pantalla

- Los nombres ARIA y los labels de botones están bien, y Escape cierra el detalle/modal.
- El orden DOM es razonable, pero los estados de riesgo y primary no se anuncian con una diferencia semántica adicional; el usuario depende de leer todo el nombre.
- En móvil, targets de 30px aumentan la dificultad para usuarios con baja precisión motora.

### Jordan — primer uso

- Puede entender las acciones porque tienen texto, pero “Recursos”, “Versión en disco” y “Sitio público” no explican qué decisión habilitan.
- “Archivar” y “Eliminar tienda” no hacen visible en el rail cuál es reversible y cuál es definitivo.

## Minor observations

- La captura deja una zona inferior de aire que se siente más como espacio residual que como cierre intencional del panel; un footer de estado breve o un agrupamiento de riesgo más claro podría darle propósito sin agrandar botones.
- Los ocho facts son útiles para administración, pero no todos tienen la misma frecuencia; “ID” y “Versión en disco” podrían bajar de prioridad visual.
- La consistencia de color debería derivarse de tokens del shell en vez de mezclar `#8ab4ff`, `rgb(...)` y valores semánticos de feedback.

## Questions to consider

- ¿Qué debería dominar el rail en tu uso real: abrir la tienda, respaldar o administrar el sitio público?
- ¿La zona de utilities debe seguir visible siempre o puede agruparse en “Más herramientas”?
