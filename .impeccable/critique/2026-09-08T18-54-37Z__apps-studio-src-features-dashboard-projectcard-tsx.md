---
target: apps/studio/src/features/dashboard/ProjectCard.tsx
total_score: 33
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 3
target_identity: "file:C:\\Users\\PiPa\\Drive\\Documentos\\Websave\\OpenCode\\SolaraCommerce\\apps\\studio\\src\\features\\dashboard\\ProjectCard.tsx"
target_fingerprint: "sha256:49443929f6f4892bd3fdb328dbf59c4cc3781eb641910bb3f3a01ec40c866310"
target_path: "C:\\Users\\PiPa\\Drive\\Documentos\\Websave\\OpenCode\\SolaraCommerce\\apps\\studio\\src\\features\\dashboard\\ProjectCard.tsx"
timestamp: 2026-09-08T18-54-37Z
slug: apps-studio-src-features-dashboard-projectcard-tsx
closed: true
---
⚠️ DEGRADED: single-context (spawn_agent unavailable in this session)

## Scope

Auditoría profunda de la card de detalle de tienda mostrada en la referencia, su implementación en ProjectCard.tsx, cosmic.css, estados del calculador y eliminación, y la UI viva en http://127.0.0.1:4173/. El uso declarado es desktop.

## Design Health Score

| # | Heuristic | Score | Key issue |
|---|---|---:|---|
| 1 | Visibility of System Status | 4/4 | Estado, selección, fecha, versión y cargas son visibles. |
| 2 | Match System / Real World | 3/4 | Acciones familiares, pero algunas métricas usan lenguaje interno. |
| 3 | User Control and Freedom | 4/4 | Cerrar, Escape, cancelar y restaurar están contemplados. |
| 4 | Consistency and Standards | 3/4 | Los breakpoints de altura cambian demasiado el tamaño visual. |
| 5 | Error Prevention | 4/4 | La plantilla bloquea acciones sensibles y eliminar exige espera y confirmación. |
| 6 | Recognition Rather Than Recall | 4/4 | Todos los botones tienen texto e icono. |
| 7 | Flexibility and Efficiency | 3/4 | Hay atajos globales, pero no específicos para esta card. |
| 8 | Aesthetic and Minimalist Design | 3/4 | Hay claridad, pero también bordes, halos y cuatro acentos. |
| 9 | Error Recovery | 3/4 | Existen avisos y estados de carga; falta reservar mejor el espacio del feedback. |
| 10 | Help and Documentation | 2/4 | No hay ayuda contextual para datos técnicos ni respaldos. |
| **Total** |  | **33/40** | **Bueno, con una pasada fuerte de jerarquía y consistencia todavía pendiente.** |

## Design Specificity Verdict

El dashboard tiene una identidad propia por Gargantua, el ámbar, el fondo gravitacional y la noción de tiendas como objetos orbitando. Sin embargo, la card todavía puede leerse como un panel administrativo oscuro genérico: avatar, ocho métricas y una matriz de botones. La oportunidad es convertirla en una consola de control de una tienda.

El detector automático devolvió [] para ProjectCard.tsx. No encontró patrones mecánicos problemáticos en el markup; los hallazgos principales son de dirección visual, jerarquía y consistencia desktop.

## Evidence

Mediciones reales:

| Viewport | Card | Button height | Button text |
|---|---:|---:|---:|
| 1280x720 | 320x421 | 32px | 10px |
| 1440x900 | 318x527 | 38px | 10px |
| 1920x950 | 338x535 | 38px | 11px |

El modo desktop bajo reduce demasiado la tipografía y las acciones. La referencia visual se parece al modo desktop alto.

## Overall Impression

La base es sólida: identidad clara, métricas compactas, acciones completas y una protección seria para eliminación y plantilla. La card todavía presenta nueve operaciones como una lista densa; no todas tienen el mismo valor ni el mismo riesgo, y el sistema de bordes/accentos compite con el fondo de Gargantua.

## What's Working

- Abrir tienda es una primaria evidente y tiene contraste fuerte.
- La grilla de métricas en dos columnas mantiene buen alineamiento.
- Los labels de botones, estados de carga, foco, Escape y protección de plantilla están bien resueltos.
- El close de 36px y los radios 14/10/6 crean una escala razonable.

## Priority Issues

### [P1] Desktop bajo demasiado pequeño

En 1280x720 las acciones bajan a 32px y 10px. No hay overflow, pero sí pérdida de lectura. Mantener al menos 11-12px y 36px de alto; ahorrar espacio reduciendo ritmo de métricas antes que la tipografía. Suggested command: $impeccable typeset + $impeccable layout.

### [P1] Nueve decisiones visibles, grupos no visibles

El DOM tiene grupos accesibles, pero visualmente solo hay separadores. El usuario debe deducir navegación, mantenimiento, cálculo y riesgo. Hacer explícitos tres grupos visuales compactos sin crear headers altos. Suggested command: $impeccable clarify + $impeccable layout.

### [P1] Calculadora demasiado protagonista

El botón azul a ancho completo es el segundo foco más fuerte, aunque la prioridad del dashboard es revisar y abrir tiendas. Reducir saturación o usar un tratamiento neutral con acento azul. Suggested command: $impeccable colorize / $impeccable quieter.

### [P2] Exceso de capas de selección

Borde ámbar, outline, sombra, pseudo-borde rotado, halo del favicon y primary ámbar repiten la misma señal. Reducir a un borde y un indicador de selección. Suggested command: $impeccable quieter.

### [P2] Jerarquía tipográfica estrecha

Labels 10px, valores 11px y botones 10-11px con pesos 600-650 hacen que casi todo dependa del color. Aumentar el salto entre título, datos y acciones. Suggested command: $impeccable typeset.

### [P2] Métricas sin agrupación conceptual

ID, actualización, productos, mensualidad, recursos, versión y sitio público son una lista plana. Separar de forma mínima datos comerciales de persistencia/disco, sin tarjetas anidadas. Suggested command: $impeccable layout.

### [P2] Respaldar y descargar parecen duplicados

“Respaldo ahora” y “Descargar respaldo” comparten peso, fondo y proximidad. Cambiar “Respaldo ahora” por “Respaldar ahora” y diferenciarlos por agrupación o copy. Suggested command: $impeccable clarify.

### [P2] Archivar y Restaurar comparten semántica cromática

Archivar naranja es correcto, pero Restaurar hereda la misma señal de riesgo. Restaurar debería usar un tono de recuperación más neutral o verde tenue. El estado protegido también repite “Solo lectura” y “Plantilla protegida” sin explicar la causa dentro de la acción.

### [P2] Feedback puede modificar la geometría

actionNotice aparece debajo de las acciones y puede cambiar la altura de la card después de una operación. Reservar una zona estable o usar feedback externo al panel. Suggested command: $impeccable harden.

## Button Audit

| Element | Assessment |
|---|---|
| Cerrar | Buen tamaño, label accesible y foco; puede competir con el borde ámbar. |
| Abrir tienda | Excelente primaria; debe conservar mínimo 36px incluso en desktop bajo. |
| Abrir sitio público | Claro, pero demasiado parecido a una utilidad; podría expresar mejor salida externa. |
| Abrir carpeta | Icono correcto; conviene agruparlo como gestión local. |
| Respaldar ahora | Estado de carga bueno; el copy actual es nominal, no verbal. |
| Descargar respaldo | Claro, pero se confunde con el respaldo inmediato. |
| Duplicar | Correcto, aunque crea una tienda y tiene más impacto que abrir carpeta. |
| Calculadora | Fácil de encontrar, pero el azul full-width compite demasiado. |
| Archivar/Restaurar | Reversible y diferenciado de eliminar; Restaurar necesita otro tono. |
| Eliminar tienda | El rojo y la confirmación son correctos; queda demasiado cerca de Archivar. |

## Spacing, Borders, Radius

- Radio exterior 14px, close 10px, buttons 6px y pills 999px: escala coherente.
- Gaps de 6-7px son compactos y funcionales, pero el salto de 32px a 38px por altura genera dos productos visuales distintos.
- La referencia transmite más aire lateral que el modo wide medido, que queda en 11-12px de padding.
- La separación entre métricas y acciones funciona; la calculadora no tiene una separación suficientemente clara de las utilidades.
- La línea superior de los grupos es demasiado sutil para orientar, pero suficiente para sumar ruido.
- El pseudo-borde interno rotado parece más decorativo que funcional.

## Color and Contrast

El crema sobre negro, ámbar primario, rojo destructivo y texto de estado verde están bien elegidos. El blue de Calculadora introduce una cuarta familia cromática y el hover ámbar de todos los secundarios hace que cualquier utilidad parezca primaria mientras se apunta.

El disabled de la plantilla baja mucho el contraste visual. Aunque los controles disabled tienen excepciones normativas, el motivo de solo lectura debe seguir siendo inmediatamente legible.

## Typography

El principal problema es la escala baja en desktop de 720px y la poca distancia entre pesos. Los valores técnicos podrían usar una voz de dato más deliberada, especialmente el ID y la versión; el ID largo también necesitaría copiar o una lectura accesible más robusta que depender solo de title/truncation.

## Motion

La entrada de la card de 320ms con blur y translate está bien dirigida, pero el blur de toda la superficie en cada selección puede suavizar demasiado el texto y competir con el WebGL de fondo. Mantendría el blur para primer montaje y usaría opacity/translate para cambiar entre tiendas.

Hover y active tienen feedback consistente. Spinner, Escape y reduced-motion están contemplados. El sistema ya tiene más movimiento de fondo del que la card necesita.

## States and Edge Cases

- Activa: clara.
- Archivada: clara, pero Restaurar necesita semántica visual propia.
- Plantilla protegida: bloqueada correctamente, pero repetitiva en label y chip.
- Fuera del filtro: bien informado por chip, aunque la acción de abrir debe seguir siendo comprensible.
- Loading: label y aria-busy funcionan.
- ID largo: se trunca, sin copiar ni ampliar de forma ideal para teclado.
- actionNotice: debe probarse su impacto en la altura y el borde inferior.
- Calculadora: foco automático y Escape correctos; verificar valores extremos en desktop bajo.
- Eliminación: la espera de 30 segundos es una defensa sólida, aunque el flujo de dos confirmaciones puede ser pesado.

## Cognitive Load

La primaria se entiende en menos de cinco segundos, pero hay nueve acciones visibles. La diferencia entre respaldar y descargar exige interpretación, y los grupos son más accesibles que visibles. Las ocho métricas caben bien en dos columnas, pero mezclan datos comerciales y técnicos.

## Personas

### Alex — power user

Puede abrir rápido, pero no tiene shortcuts específicos para respaldo, duplicación o descarga. La card requiere demasiadas decisiones para el caso frecuente de revisar y abrir.

### Sam — teclado y lector de pantalla

Los labels, grupos y foco son buenos. El panel focusable agrega un stop extra y los IDs truncados dependen demasiado de title. El foco ámbar puede mezclarse con superficies ya ámbar/azules.

### Riley — operador que fuerza estados

Debe probar tiendas protegidas, archivadas, fuera de filtro, IDs largos, avisos posteriores a acciones y calculadora con valores extremos. Los cambios de label entre Archivar, Restaurar y Plantilla protegida requieren un sistema de estados más explícito.

## Questions to Consider

- ¿La card debe ser una ficha compacta o una consola operativa?
- ¿Calculadora merece más protagonismo que Abrir sitio público?
- ¿Qué acciones se usan todos los días y cuáles deberían quedar relegadas?
- ¿El borde interno rotado aporta identidad o agrega ruido?
- ¿Respaldo ahora y Descargar respaldo deben continuar siendo hermanos visuales?
