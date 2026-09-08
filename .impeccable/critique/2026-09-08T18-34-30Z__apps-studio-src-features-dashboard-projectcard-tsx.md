---
target: apps/studio/src/features/dashboard/ProjectCard.tsx
total_score: 34
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 2
target_identity: "file:C:\\Users\\PiPa\\Drive\\Documentos\\Websave\\OpenCode\\SolaraCommerce\\apps\\studio\\src\\features\\dashboard\\ProjectCard.tsx"
target_fingerprint: "sha256:49443929f6f4892bd3fdb328dbf59c4cc3781eb641910bb3f3a01ec40c866310"
target_path: "C:\\Users\\PiPa\\Drive\\Documentos\\Websave\\OpenCode\\SolaraCommerce\\apps\\studio\\src\\features\\dashboard\\ProjectCard.tsx"
timestamp: 2026-09-08T18-34-30Z
slug: apps-studio-src-features-dashboard-projectcard-tsx
---
⚠️ DEGRADED: single-context (spawn_agent unavailable in this session)

## Design Health Score

| Heuristic | Score | Key issue |
|---|---:|---|
| Visibility of System Status | 4/4 | Estado, fecha, versión, carga y selección son visibles. |
| Match System / Real World | 3/4 | Las acciones son reconocibles; algunas métricas usan términos internos. |
| User Control and Freedom | 4/4 | Cerrar, volver y cancelar acciones destructivas están contemplados. |
| Consistency and Standards | 3/4 | El layout original dependía de la posición DOM y cambiaba por breakpoint. |
| Error Prevention | 4/4 | La plantilla protegida bloquea archivar/eliminar y hay estados de carga. |
| Recognition Rather Than Recall | 4/4 | Identidad, métricas y acciones viven en el contexto seleccionado. |
| Flexibility and Efficiency | 3/4 | Hay atajos globales, pero no atajos propios visibles dentro de la card. |
| Aesthetic and Minimalist Design | 4/4 | Buen contraste y densidad; el apilado original desperdiciaba ritmo vertical. |
| Error Recovery | 3/4 | La eliminación tiene flujo propio; faltan errores persistentes dentro de esta card. |
| Help and Documentation | 2/4 | No hay ayuda contextual para métricas técnicas o respaldos. |
| **Total** | **34/40** | **Salud buena; la jerarquía operativa era la oportunidad principal.** |

## Design Specificity Verdict

La card está anclada al dashboard de SolaraCommerce: identidad de tienda, estado protegido, metadatos de disco, acciones de respaldo y lenguaje visual cósmico. Antes del ajuste, su superficie se parecía a un panel administrativo oscuro intercambiable porque las filas se decidían con `:first-child` y `:nth-child`; la reorganización aplicada vuelve explícita la intención de cada grupo.

El detector Impeccable devolvió `[]` para `ProjectCard.tsx`. La revisión visual en una pestaña nueva de `http://127.0.0.1:4173/` confirmó la card reorganizada, sin scroll visible.

## Overall Impression

La base es fuerte: identidad clara, métricas compactas y acciones completas. La principal oportunidad era hacer que el orden visual comunicara el nivel de riesgo y la frecuencia de uso. Ahora las acciones de apertura, utilidades y riesgo tienen una estructura estable y escaneable.

## What's Working

- La identidad, el estado y la protección se escanean rápidamente.
- La grilla de métricas en dos columnas conserva densidad y lectura numérica.
- Amarillo, azul, ámbar y rojo crean una jerarquía propia del dashboard sin perder contraste.

## Priority Issues

### [P1] Jerarquía ambigua de acciones

La versión original podía juntar “Duplicar” con “Calculadora” y mover “Abrir sitio público” entre filas según el ancho. Se resolvió con grupos semánticos: principales, herramientas/respaldos y riesgo; la calculadora queda como utilidad a ancho completo.

### [P1] Ritmo vertical innecesariamente largo

Los hechos y nueve botones podían acercarse al límite del panel. La nueva composición usa dos columnas internas y evita filas accidentales sin ocultar ninguna acción.

### [P2] Acciones destructivas mezcladas

“Archivar” y “Eliminar” ahora viven en un grupo de riesgo separado, conservan sus colores y siguen bloqueadas para la plantilla protegida.

### [P2] Responsive frágil

Se reemplazaron reglas basadas en la posición DOM por wrappers estables. El grupo principal se adapta a uno o dos botones; utilidades y riesgo conservan dos columnas cuando hay capacidad.

### [P3] Terminología técnica

“Recursos”, “Versión en disco” y “Sitio público” podrían recibir ayuda contextual en otra iteración, pero no se agregó texto que vuelva a alargar la card.

## Persona Red Flags

- **Power user:** el orden visual es predecible, pero la card todavía no muestra atajos propios.
- **Primera visita:** la división ayuda, aunque “Versión en disco” y “Recursos” pueden requerir ayuda contextual.
- **Operador cuidadoso:** la separación y el color de riesgo reducen errores; la plantilla protegida mantiene una señal clara de solo lectura.

## Minor Observations

- El nombre de la tienda y el ID ya tienen truncamiento seguro.
- Los estados de carga conservan el contexto de la acción.
- Los roles accesibles de los tres grupos hacen más navegable la card para tecnologías asistivas sin añadir texto visual.

## Questions to Consider

- ¿Conviene renombrar “Calculadora” a “Calcular tarifa” para hacer explícito su resultado?
- ¿Las métricas técnicas necesitan tooltip o una ayuda contextual en una siguiente pasada?
