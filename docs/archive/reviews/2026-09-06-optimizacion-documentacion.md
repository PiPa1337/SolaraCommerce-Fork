# Optimización temporal de la documentación de SolaraCommerce

Fecha de revisión: 6 de septiembre de 2026.

Estado: **documento temporal de trabajo**. No es una nueva fuente de verdad del
producto. Su función es registrar qué conviene editar, simplificar, mover,
archivar o mantener antes de realizar una limpieza documental real.

La revisión parte de los **62 archivos Markdown existentes antes de crear este
documento temporal**. Se compararon propósito, ubicación, encabezados, estado
declarado y referencias sensibles como runtime, persistencia, portable/Electron,
Node, gates y documentación histórica.

## Objetivo

Reducir contradicciones y costo de mantenimiento sin perder historia técnica.
La documentación debería permitir que una persona o agente encuentre la fuente
correcta rápidamente y distinga con claridad entre:

1. contratos vigentes;
2. guías operativas vigentes;
3. referencias especializadas;
4. planes o diseños todavía activos;
5. evidencia histórica cerrada.

## Hallazgos prioritarios

### P0 — corregir contradicciones antes de una reorganización grande

1. `docs/FULL_REFERENCE.md` se presenta como "referencia única y exhaustiva",
   pero duplica documentación modular y ya contiene drift. Por ejemplo, habla de
   un usuario objetivo de `1-200 productos` y describe gates que no coinciden con
   `AGENTS.md`/`docs/TESTING.md` actuales.
2. `docs/MUSE_SPARK_1.2.md` contiene una fotografía vieja de ejecución: menciona
   Playwright con 8 workers, smoke de 15 specs para iteración y `check` como alias
   de `check:full`; la documentación operativa vigente define 3 workers por
   defecto, smoke quick de 5 specs y una separación distinta entre
   `check:micro`, `check:quick` y `check:full`.
3. `README.md` tiene un error editorial visible: `La El transporte local
   vigente...`.
4. `docs/INDEX.md` establece que auditorías y planes cerrados deben vivir en
   `docs/archive/`, pero todavía hay auditorías, reportes y planes históricos
   fuera de esa carpeta.
5. La portable/Electron ya no existe como runtime. Los documentos actuales que
   todavía necesitan conceptos reutilizables de aquella migración deberían
   referirse a un procedimiento neutro de protección de datos, no al plan
   histórico `futuraeliminaciondeportable.md`.

### P1 — reducir fuentes competidoras

- Mantener como núcleo: `AGENTS.md`, `README.md`, `docs/INDEX.md`,
  `docs/PROJECT_MAP.md`, `docs/ARCHITECTURE.md`, `docs/DATA_MODEL.md`,
  `docs/INTEGRATIONS.md`, `docs/TESTING.md`, `docs/DEVELOPMENT.md` y
  `docs/TECHNICAL_DEBT.md`.
- Convertir `docs/FULL_REFERENCE.md` en índice generado/resumen no autoritativo,
  o archivarlo.
- Mantener `docs/MUSE_SPARK_1.2.md` sólo como perfil diferencial del agente; no
  duplicar stack, gates ni contratos de `AGENTS.md`.
- Separar documentación activa de evidencia de una sesión o fecha concreta.

### P2 — mejorar mantenimiento

- Cada documento operativo debería declarar `Estado`, `Autoridad` y, cuando sea
  útil, `Última verificación`.
- Los números que cambian con frecuencia (cantidad de specs, workers, tiempos,
  tamaños, número de rutas) deberían enlazar al script/configuración que los
  define o generarse automáticamente.
- Los documentos históricos deben conservar el contenido original, agregando un
  banner claro de histórico/superado en vez de reescribir la evidencia.
- Los planes/specs deberían declarar explícitamente uno de estos estados:
  `propuesto`, `activo`, `implementado`, `superado`, `archivado`.

## Estructura documental objetivo propuesta

```text
/
├── README.md
├── AGENTS.md
├── CHANGELOG.md
├── HALLAZGOS_DOCUMENTACION.md        # temporal hasta cerrar la limpieza
└── docs/
    ├── INDEX.md
    ├── ARCHITECTURE.md
    ├── PROJECT_MAP.md
    ├── DATA_MODEL.md
    ├── DEVELOPMENT.md
    ├── TESTING.md
    ├── INTEGRATIONS.md
    ├── TECHNICAL_DEBT.md
    ├── SECURITY.md
    ├── guides/                        # operación y funciones específicas
    ├── design-references/             # referencias visuales vigentes
    ├── operations/                    # release, piloto, QA perpetuo
    └── archive/
        ├── audits/
        ├── migrations/
        ├── plans/
        ├── reports/
        └── reviews/
```

No es necesario aplicar exactamente esos nombres; la mejora importante es que
la separación entre **vigente** e **histórico** sea física además de conceptual.

## Revisión archivo por archivo

### Raíz y almacenamiento comercial

| Archivo | Evaluación | Optimización propuesta |
| --- | --- | --- |
| `AGENTS.md` | Núcleo vigente y contrato operativo principal. | **Editar poco.** Mantenerlo corto y normativo. Extraer el procedimiento reutilizable de staging/rollback/hashes a un documento vigente y dejar de depender de `futuraeliminaciondeportable.md`. Evitar snapshots de cantidades de tests que puedan derivar si no son necesarias. |
| `README.md` | Entrada humana principal, vigente. | **Editar.** Corregir `La El transporte...`. Reducir historia interna y detalles que ya están en `docs/`. Mantener apertura, requisitos, concepto del producto y enlaces a guías. |
| `CHANGELOG.md` | Historial legítimo, pero tiene más de 4.000 líneas. | **Optimizar.** Mantener `Unreleased` + versiones recientes en el archivo principal y mover historia antigua a uno o varios changelogs archivados enlazados. No borrar historial. |
| `HALLAZGOS_DOCUMENTACION.md` | Informe diagnóstico creado durante esta revisión. | **Temporal.** Aclarar que los 61 `.md` eran el inventario previo a su propia creación. Después de ejecutar la limpieza, moverlo a `docs/archive/reviews/` o eliminarlo sólo si ya quedó completamente absorbido por documentación permanente. |
| `astrainforme.md` | Auditoría incremental fechada; contiene evidencia anterior a la migración final. | **Archivar.** Mover a `docs/archive/audits/2026-09-05-astra.md`. Conservar el banner histórico. No usar sus findings como estado vigente sin revalidarlos. |
| `futuraeliminaciondeportable.md` | Plan de migración completado; 615 líneas de historia y evidencia. | **Extraer y archivar.** Sacar únicamente el patrón genérico de staging + hashes + rollback a una guía actual de seguridad de datos. Después mover este archivo intacto a `docs/archive/migrations/`. |
| `pendiente.md` | Registro de un intento de eliminación de Electron/portable. Su título ya contradice el hecho actual de que la eliminación terminó. | **Archivar.** Renombrar al moverlo como evidencia de cierre, por ejemplo `2026-09-06-eliminacion-electron-portable.md`. No debe permanecer como “pendiente” en raíz. |
| `proyectos/LEEME.md` | Protección útil junto a los datos reales. | **Mantener y simplificar.** Conservar sólo reglas permanentes de protección de `proyectos/`; reducir referencias narrativas a la migración portable, que ya es historia. Enlazar la futura guía neutral de seguridad de datos. |

### Núcleo técnico vigente

| Archivo | Evaluación | Optimización propuesta |
| --- | --- | --- |
| `docs/INDEX.md` | Buen punto de entrada y ya define una regla de archivo. | **Editar.** Hacer que refleje la estructura real después de mover históricos. Marcar cada entrada como contrato, guía, referencia u operación. No listar documentos cerrados como activos. |
| `docs/PROJECT_MAP.md` | Corto y útil para encontrar dónde editar. | **Mantener.** Añadir sólo rutas realmente estables. Evitar detalles de conteos o implementación que pertenecen a arquitectura. |
| `docs/ARCHITECTURE.md` | Fuente conceptual fuerte y actual. | **Mantener/afinar.** Definir explícitamente qué cosas son invariantes y cuáles son “estado actual”. Enlazar ADRs para explicar decisiones en vez de duplicar razones largas. |
| `docs/DATA_MODEL.md` | Contrato documental de `StoreProjectV2`; el schema es autoridad ejecutable. | **Mantener.** Añadir enlaces directos a símbolos/schema por sección. Evitar copiar defaults o listas que puedan extraerse del código automáticamente. |
| `docs/INTEGRATIONS.md` | Guía vigente de servidor local, navegador y exportación. | **Editar.** Separar claramente integraciones actuales de migraciones legacy ZIP. Mover el relato de migración cerrada a archivo y dejar sólo compatibilidad que siga existiendo en código. |
| `docs/TESTING.md` | Contrato de testing actual más preciso que otras copias. | **Convertir en autoridad única de gates.** `AGENTS.md` debería resumirlo; `FULL_REFERENCE` y `MUSE_SPARK` deberían enlazarlo. Cuando sea posible, generar conteos de specs/tests desde scripts en vez de escribirlos a mano. |
| `docs/DEVELOPMENT.md` | Onboarding técnico vigente. | **Mantener y adelgazar.** Setup, estructura y flujo de desarrollo aquí; detalles de arquitectura y testing deben ser enlaces a sus documentos autoritativos. |
| `docs/TECHNICAL_DEBT.md` | Registro útil pero extenso, mezcla deuda abierta y cierres históricos. | **Optimizar.** Separar `deuda abierta` de `resueltos`. Mover cierres antiguos a un archivo histórico periódico para que el documento principal responda rápido “qué sigue pendiente”. |
| `docs/architecture-decisions.md` | ADR compacto y útil. | **Mejorar formato.** Agregar fecha, estado (`accepted/superseded`) y enlaces a decisión reemplazada. Mantener cada ADR corto. |
| `docs/product-spec.md` | Spec de negocio muy corta. | **Expandir sólo invariantes.** Agregar alcance/no alcance vigente, límites comerciales importantes y flujo principal. No copiar arquitectura. |
| `docs/SECURITY.md` | Seguridad del sitio exportado; alcance algo estrecho para el nombre genérico. | **Aclarar alcance.** O renombrar conceptualmente a seguridad del storefront, o ampliar con índice hacia servidor local, archivos y agente. No duplicar implementación de `INTEGRATIONS.md`. |
| `docs/backup-and-recovery.md` | Guía operativa importante y actual. | **Mantener.** Extraer aquí o a una nueva `DATA_STORAGE_SAFETY.md` las reglas permanentes recuperadas del plan portable: staging, hash, rollback y no reemplazar `proyectos/` directamente. |
| `docs/PORTABILITY.md` | El contenido actual ya dice correctamente que no existe EXE/portable; el nombre quedó heredado. | **Renombrar conceptualmente.** Un nombre como `LOCAL_RUNTIME_AND_BACKUP.md` o `LOCAL_OPERATION.md` describe mejor el presente. Actualizar enlaces desde INDEX/AGENTS. |
| `docs/AI_AGENT_GUIDE.md` | Guía vigente y especializada. | **Mantener.** Separar contrato estable de ejemplos. Si el protocolo es machine-readable, generar tablas de métodos/scopes desde el schema para evitar drift. |

### Storefront, Studio y contratos visuales

| Archivo | Evaluación | Optimización propuesta |
| --- | --- | --- |
| `apps/studio/docs/components.md` | Referencia útil de componentes, pero nació como entrega fechada T1.9. | **Actualizar.** Quitar del título el número de tarea si ya funciona como referencia permanente. Confirmar que componentes/tokens listados sigan existiendo y enlazar la galería/story correspondiente. |
| `apps/studio/docs/deuda-editor.md` | Auditoría fechada de deuda; incluso referencia un plan eliminado. | **Archivar.** Mover a `docs/archive/audits/` o `docs/archive/reviews/`. La deuda todavía abierta debe vivir en `TECHNICAL_DEBT.md`. |
| `docs/STOREFRONT_ARCHITECTURE.md` | Referencia especializada útil. | **Mantener.** Evitar repetir breakpoints/variables si pueden apuntar a tokens fuente. Separar reglas contractuales de ejemplos de implementación. |
| `docs/STOREFRONT_V2.md` | Contrato de familia visual V2. | **Mantener/revalidar.** Cambiar “gates actuales” o conteos variables por enlaces a tests. Aclarar su relación con V1 y cuál es el default vigente. |
| `docs/UI_SCALE.md` | Contrato corto y concreto de espaciado. | **Mantener.** Es un buen ejemplo de doc pequeña. Enlazar directamente a tokens/tests guardianes para que los números tengan evidencia ejecutable. |
| `docs/GUARDIANS.md` | Catálogo útil de tests que protegen invariantes. | **Semi-generar.** Mantener la explicación humana, pero generar la lista de specs/comandos desde el árbol de tests para evitar nombres obsoletos. |
| `docs/LIVE_CANVAS.md` | Documento especializado vigente, con lenguaje de “esta entrega”. | **Editar.** Reemplazar estado de entrega por `Estado actual` + `Última verificación`. Mover evidencia fechada a reportes archivados. |

### Referencias de diseño

| Archivo | Evaluación | Optimización propuesta |
| --- | --- | --- |
| `docs/design-references/catalog-modern/README.md` | Referencia visual congelada de V1. | **Mantener.** Agregar estado `legacy vigente` o `referencia histórica` según corresponda y enlace al renderer/familia que todavía la usa. |
| `docs/design-references/catalog-modern/comparison-matrix.md` | Matriz visual pequeña y útil. | **Mantener.** Enlazar cada punto de control a la spec visual automatizada cuando exista. |
| `docs/design-references/catalog-modern-v2/README.md` | Dirección visual de V2, útil. | **Mantener.** Separar decisiones aceptadas de exploraciones rechazadas si el archivo crece; las rechazadas pueden ir a historial visual. |
| `docs/design-references/catalog-modern-v2/baseline.md` | Snapshot técnico previo a V2. | **Marcar histórico.** Puede quedarse junto a las referencias por contexto, pero debe decir claramente que sus presupuestos/rutas no son valores actuales. |

### Operación, release y QA continuo

| Archivo | Evaluación | Optimización propuesta |
| --- | --- | --- |
| `docs/release-candidate.md` | Procedimiento de cierre/release. | **Mover a `docs/operations/`.** Convertir números variables a comandos fuente. Diferenciar gate obligatorio de checks opcionales/on-demand. |
| `docs/pilot-checklist.md` | Checklist operativo útil. | **Mover a `docs/operations/`.** Mantenerlo como lista accionable, sin repetir arquitectura ni testing general. |
| `docs/PERPETUAL_PLAN_APP_10X.md` | Plan operativo especial, grande y de larga duración. | **Mover a `docs/operations/perpetual/`.** Separar contrato del bucle (estable) del listado de tareas (mutable). El estado debería vivir sólo en `perpetual-state.json`/backlog. |
| `docs/PERPETUAL_QA_BACKLOG.md` | Backlog pequeño y mutable del plan perpetuo. | **Mantener junto al plan operativo**, no entre docs generales. Añadir fecha/ID de run y evitar duplicar estado que ya esté en JSON. |

### `FULL_REFERENCE` y perfiles de agente

| Archivo | Evaluación | Optimización propuesta |
| --- | --- | --- |
| `docs/FULL_REFERENCE.md` | Mayor foco de duplicación. Afirma ser la referencia única, pero ya contradice docs actuales: `1-200 productos`, gates y tiempos antiguos. | **Alta prioridad: retirar autoridad.** Opción preferida: reemplazarlo por un índice generado que enlace a fuentes modulares. Alternativa: archivarlo. No seguir manteniendo manualmente una segunda copia completa de arquitectura, modelo, testing y deuda. |
| `docs/MUSE_SPARK_1.2.md` | Perfil específico de agente mezclado con una copia de AGENTS/testing. Tiene drift confirmado en workers, smoke y gates. | **Reducir drásticamente.** Dejar sólo personalidad/preferencias/deltas de Muse Spark y una instrucción de leer `AGENTS.md` + `TESTING.md`. Eliminar snapshots técnicos duplicados. |

### Auditorías y reportes fuera de `archive/`

| Archivo | Evaluación | Optimización propuesta |
| --- | --- | --- |
| `docs/AUDITORIA.md` | Auditoría fechada de RM Descartables. | **Mover a `docs/archive/audits/`.** Mantener fecha, alcance y evidencia. Los defectos todavía abiertos deben pasar a `TECHNICAL_DEBT.md`. |
| `docs/audits/margenestienda.md` | Auditoría final cerrada y aprobada. | **Mover a `docs/archive/audits/`.** Su propio encabezado ya indica que es una edición final cerrada. |
| `docs/reports/chaos-and-recovery.md` | Reporte fechado de verificación focal. | **Archivar en `docs/archive/reports/`.** Si contiene una regla permanente, trasladar esa regla a backup/security/testing. |
| `docs/reports/global-rollout.md` | Reporte fechado con corrida real pendiente en aquel momento. | **Archivar.** No debe confundirse con estado de rollout actual. |
| `docs/reports/live-canvas-coverage.md` | Evidencia fechada de cobertura. | **Archivar.** `LIVE_CANVAS.md` debe contener sólo el contrato vigente y apuntar a esta evidencia histórica si hace falta. |
| `docs/reports/slash-goal-handoff-2026-08-27.md` | Handoff cerrado de una sesión; menciona requisitos antiguos como Node 22. | **Archivar con prioridad.** Es evidencia histórica y puede inducir a ejecutar una matriz vieja si aparece como doc general. |

### Archivos que ya están correctamente archivados

| Archivo | Evaluación | Optimización propuesta |
| --- | --- | --- |
| `docs/archive/ARCHITECTURE_REVIEW_2026-08-21.md` | Revisión histórica. | **Mantener.** Opcional: añadir metadata uniforme `Fecha/Estado/Reemplazado por`. |
| `docs/archive/AUTONOMOUS_QUALITY_FORGE.md` | Evidencia de una campaña QA. | **Mantener archivado.** No actualizar cifras antiguas; son parte de la evidencia. |
| `docs/archive/HARDCODED_CONTENT_AUDIT.md` | Auditoría histórica, aunque algunas reglas siguen siendo útiles. | **Revisar una vez.** Si la “regla de mantenimiento” sigue vigente, mover esa regla a `GUARDIANS.md`/`TESTING.md` y dejar el audit intacto. |
| `docs/archive/PERFORMANCE_RM_DESCARTABLES.md` | Baseline y optimización fechada. | **Mantener archivado.** No convertir sus métricas en targets actuales. |
| `docs/archive/TOP20_RECURSOS.md` | Medición fechada con versiones y budgets específicos. | **Mantener archivado.** Puede enlazarse desde performance/deuda cuando se necesite contexto histórico. |

### Planes de implementación `docs/superpowers/plans/`

Regla común recomendada: cada plan debe comenzar con `Estado`, `Fecha`,
`Resultado/commit` y `Documento vigente relacionado`. Cuando está implementado o
superado, moverlo a `docs/archive/plans/`. No inferir el estado sólo porque la
fecha sea antigua.

| Archivo | Evaluación | Optimización propuesta |
| --- | --- | --- |
| `2026-08-07-busqueda-relevancia.md` | Plan detallado de una feature concreta. | **Revalidar estado.** Si ya se implementó, archivar y enlazar la documentación permanente de búsqueda. Si sigue abierto, agregar estado explícito y pendientes reales. |
| `2026-08-07-eliminar-zip.md` | Plan enorme de migración de ZIP; contiene mucha historia/checklist. | **Probable archivo histórico.** Confirmar qué compatibilidad ZIP sigue viva; mover sólo las reglas vigentes a `INTEGRATIONS.md`/backup y archivar el plan. |
| `2026-08-12-storefront-v2-motion.md` | Declara `Estado: activo desde 2026-08-12`. | **Revalidar.** “Activo desde” no dice si sigue abierto. Convertir a estado inequívoco; si se completó, archivar y conservar decisiones en `STOREFRONT_V2.md`. |
| `2026-08-16-auditoria-integral-v2.md` | Plan de auditoría integral, propio de una campaña. | **Revalidar y probablemente archivar.** Las obligaciones permanentes deben estar en testing/deuda, no en un plan fechado. |
| `2026-08-31-optimizacion-apertura-top20.md` | Plan de optimización basado en un baseline específico. | **Archivar al cerrar.** Targets y mediciones pertenecen a evidencia histórica; budgets vigentes deben venir de scripts. |
| `2026-09-02-auditoria-fixes.md` | Plan para resolver `docs/AUDITORIA.md`. | **Cerrar en pareja con la auditoría.** Si los fixes terminaron, ambos van al archivo y sólo la deuda pendiente permanece vigente. |
| `2026-09-02-data-real-portable.md` | Ya marcado `SUPERADO (06/09/2026)`. | **Archivar directamente** en `docs/archive/plans/`; no hay razón para que un contrato temporal superado permanezca entre planes activos. |
| `2026-09-04-catalogo-buscar-todos-productos.md` | Plan reciente de feature. | **Agregar estado explícito.** Si ya fue implementado, archivar; si sigue abierto, mantener hasta cierre y luego trasladar sólo el contrato final a docs permanentes/tests. |
| `2026-09-04-product-gallery-videos.md` | Plan extenso y reciente, potencialmente todavía operativo. | **Agregar estado explícito y reducir tras cierre.** La regla final de videos debe vivir en DATA_MODEL/storefront; el plan de 1.000+ líneas debe quedar como historia. |

### Especificaciones `docs/superpowers/specs/`

| Archivo | Evaluación | Optimización propuesta |
| --- | --- | --- |
| `2026-09-02-data-real-portable-design.md` | Ya marcado `SUPERADO (06/09/2026)` aunque conserva “pendiente de implementación” del estado anterior. | **Archivar directamente.** El banner superior evita confusión, pero moverlo elimina la contradicción de ubicación. |
| `2026-09-04-catalogo-buscar-todos-productos-design.md` | Diseño aprobado; no declara resultado final. | **Agregar estado de implementación.** Archivar cuando el comportamiento quede consolidado en tests/documentación permanente. |
| `2026-09-04-whatsapp-multiparte-design.md` | Diseño aprobado con simulaciones. | **Agregar estado de implementación.** Si ya está en producción, trasladar el contrato final de formato a la documentación del checkout y archivar la spec. |

## Cambios recomendados por orden

### Fase 1 — correcciones sin mover archivos

1. Corregir el typo de `README.md`.
2. Declarar `docs/TESTING.md` como autoridad única de gates y actualizar las
   copias contradictorias en `FULL_REFERENCE.md` y `MUSE_SPARK_1.2.md`.
3. Retirar de `FULL_REFERENCE.md` la afirmación de ser “referencia única”.
4. Agregar estados explícitos a los planes/specs recientes cuyo cierre no es
   evidente.
5. Aclarar en `HALLAZGOS_DOCUMENTACION.md` que los 61 eran el inventario previo.

### Fase 2 — extraer conocimiento permanente

1. Crear una guía neutral de seguridad de almacenamiento, por ejemplo
   `docs/DATA_STORAGE_SAFETY.md`.
2. Extraer ahí de `futuraeliminaciondeportable.md` sólo los principios vigentes:
   staging, verificación por hash, rollback, preservación y prohibición de
   reemplazar `proyectos/` de forma directa.
3. Simplificar `AGENTS.md`, `PORTABILITY.md`, `backup-and-recovery.md` y
   `proyectos/LEEME.md` para enlazar esa guía.

### Fase 3 — reorganizar historia

Mover sin reescribir evidencia cerrada:

- auditorías → `docs/archive/audits/`;
- migración portable → `docs/archive/migrations/`;
- reports/handoffs → `docs/archive/reports/`;
- planes/specs cerrados → `docs/archive/plans/`;
- deuda de editor fechada → archivo de auditorías/reviews.

Después actualizar `docs/INDEX.md` y todos los enlaces con una búsqueda global.

### Fase 4 — eliminar duplicación estructural

1. Decidir el destino de `FULL_REFERENCE.md`: índice generado o archivo.
2. Reducir `MUSE_SPARK_1.2.md` a deltas del perfil.
3. Separar deuda abierta de historial resuelto.
4. Archivar parte antigua de `CHANGELOG.md` conservando enlaces.
5. Mover documentación operativa especial a `docs/operations/`.

## Criterio de éxito de la futura limpieza

La optimización puede considerarse cerrada cuando:

- `docs/INDEX.md` permite llegar a cualquier documento vigente en dos saltos;
- no existe más de una fuente manual para gates, arquitectura, modelo de datos o
  runtime;
- ninguna doc activa presenta Electron/portable como runtime existente;
- los documentos históricos están físicamente separados y etiquetados;
- los planes/specs declaran estado inequívoco;
- los conteos volátiles se generan o enlazan a su fuente ejecutable;
- una búsqueda global de enlaces a archivos movidos no deja referencias rotas;
- `git diff --check` y `check:repository` pasan después de la reorganización.

## Qué no hacer

- No borrar auditorías, planes o reportes sólo porque estén viejos; primero
  archivarlos.
- No actualizar métricas históricas para que “parezcan actuales”; perderían su
  valor como evidencia.
- No convertir este documento temporal en otra fuente de verdad permanente.
- No mover documentos sin actualizar `docs/INDEX.md`, referencias cruzadas y
  rutas citadas desde `AGENTS.md`/`README.md`.
