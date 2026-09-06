# Hallazgos de la documentación de SolaraCommerce

Fecha de revisión: 6 de septiembre de 2026.

Este documento reúne los hallazgos de una revisión integral de los archivos Markdown del repositorio. Su objetivo es dejar por escrito qué documentación es actualmente autoritativa, qué archivos cumplen una función especializada, qué documentos son evidencia histórica y cuáles presentan duplicación, obsolescencia o riesgo de confusión.

## Estado general

En la revisión se identificaron **61 archivos `.md`** distribuidos entre la raíz, `docs/`, `apps/studio/docs/`, `proyectos/` y subdirectorios de auditorías, reportes, referencias de diseño, planes y especificaciones.

La documentación no está conceptualmente rota, pero hay una mezcla de cuatro tipos de archivos:

1. documentación normativa y vigente;
2. documentación especializada;
3. planes, auditorías e informes históricos;
4. archivos que duplican información ya documentada en otros lugares.

La jerarquía documental más clara para el proyecto es:

`AGENTS.md` → `docs/INDEX.md` → `docs/PROJECT_MAP.md` / `docs/ARCHITECTURE.md` → documentación especializada → schema y código como autoridad ejecutable.

## Documentos que deberían considerarse núcleo vigente

Estos archivos tienen una función clara y deberían mantenerse actualizados:

- `AGENTS.md`: contrato operativo principal del repositorio para agentes y desarrolladores.
- `README.md`: introducción general al proyecto y punto de entrada para una persona nueva.
- `CHANGELOG.md`: historial de cambios notables.
- `docs/INDEX.md`: índice de documentación y punto de navegación principal.
- `docs/PROJECT_MAP.md`: mapa de módulos, carpetas y responsabilidades.
- `docs/ARCHITECTURE.md`: arquitectura técnica general.
- `docs/DATA_MODEL.md`: contrato documental de `StoreProjectV2` y estructura persistida.
- `docs/INTEGRATIONS.md`: persistencia local, servidor administrado e integraciones.
- `docs/TESTING.md`: estrategia de validación y comandos oficiales.
- `docs/DEVELOPMENT.md`: flujo de desarrollo local.
- `docs/TECHNICAL_DEBT.md`: deuda técnica conocida y límites pendientes.
- `docs/product-spec.md`: especificación funcional del producto.
- `docs/architecture-decisions.md`: razones detrás de decisiones arquitectónicas importantes.
- `docs/SECURITY.md`: modelo de seguridad y restricciones.
- `docs/backup-and-recovery.md`: backup, restauración y recuperación de datos.
- `docs/PORTABILITY.md`: documentación de distribución/autocontención que corresponda al estado vigente del producto.
- `docs/AI_AGENT_GUIDE.md`: guía específica para agentes de IA.
- `proyectos/LEEME.md`: protección y explicación de `proyectos/` como fuente de verdad de las tiendas reales.

## Fuente de verdad actual de los datos

La migración desde la antigua portable **ya terminó** y la portable **fue eliminada**. No debe describirse como parte del runtime, del proceso normal de trabajo ni como una fuente actual de datos.

La operación real vigente utiliza `Abrir SolaraCommerce.cmd` y `proyectos/` como fuente de verdad confirmada en disco. IndexedDB cumple funciones de caché y recuperación, no de autoridad final.

Cualquier documento que todavía presente la portable como arquitectura vigente debe considerarse histórico o actualizarse.

## Documentación especializada vigente

Estos archivos tienen una finalidad más acotada y siguen siendo útiles como referencias especializadas:

- `docs/STOREFRONT_ARCHITECTURE.md`: arquitectura específica del storefront exportado.
- `docs/STOREFRONT_V2.md`: decisiones y contratos asociados a Storefront V2.
- `docs/UI_SCALE.md`: reglas de escala, densidad y comportamiento visual.
- `docs/GUARDIANS.md`: guardrails que protegen contratos importantes del producto.
- `docs/LIVE_CANVAS.md`: diseño y funcionamiento de Live Canvas.
- `apps/studio/docs/components.md`: referencia de componentes del Studio.

## Referencias de diseño

Los siguientes documentos sirven para conservar decisiones visuales y comparativas de diseño:

- `docs/design-references/catalog-modern/README.md`
- `docs/design-references/catalog-modern/comparison-matrix.md`
- `docs/design-references/catalog-modern-v2/README.md`
- `docs/design-references/catalog-modern-v2/baseline.md`

Son útiles para explicar cómo se llegó a la dirección visual actual. `baseline.md` tiene un carácter principalmente histórico y comparativo.

## QA, releases y operación

Los siguientes documentos son válidos dentro de procesos concretos, pero no deberían confundirse con la documentación arquitectónica principal:

- `docs/release-candidate.md`: checklist o estado asociado a un release candidate.
- `docs/pilot-checklist.md`: checklist de piloto.
- `docs/PERPETUAL_PLAN_APP_10X.md`: estrategia del proceso de optimización continua.
- `docs/PERPETUAL_QA_BACKLOG.md`: backlog ejecutable del plan perpetuo de QA.
- `docs/MUSE_SPARK_1.2.md`: perfil e instrucciones para un agente/modelo concreto.

### Hallazgo sobre `docs/MUSE_SPARK_1.2.md`

Duplica varias reglas que ya viven en `AGENTS.md` y contiene datos ligados a snapshots concretos de gates, performance y operación. Esto aumenta el riesgo de drift. Conviene mantenerlo sólo como perfil especializado de ese agente, evitando que funcione como segunda fuente general de verdad.

## `docs/FULL_REFERENCE.md`

Es el archivo con mayor riesgo de duplicación documental.

Su intención es funcionar como referencia exhaustiva de SolaraCommerce, pero repite grandes partes de:

- `README.md`;
- `docs/ARCHITECTURE.md`;
- `docs/DATA_MODEL.md`;
- `docs/TESTING.md`;
- `docs/STOREFRONT_ARCHITECTURE.md`;
- `docs/TECHNICAL_DEBT.md`.

Ya se detectaron señales de drift, como referencias a baselines anteriores de Node y supuestos históricos de escala.

Recomendación: **no mantenerlo manualmente como una segunda fuente autoritativa**. Las opciones razonables son archivarlo o convertirlo en un documento generado a partir de las fuentes modulares vigentes.

## Planes de implementación históricos

Los archivos bajo `docs/superpowers/plans/` documentan cómo se planificaron cambios específicos:

- `2026-08-07-busqueda-relevancia.md`
- `2026-08-07-eliminar-zip.md`
- `2026-08-12-storefront-v2-motion.md`
- `2026-08-16-auditoria-integral-v2.md`
- `2026-08-31-optimizacion-apertura-top20.md`
- `2026-09-02-auditoria-fixes.md`
- `2026-09-02-data-real-portable.md`
- `2026-09-04-catalogo-buscar-todos-productos.md`
- `2026-09-04-product-gallery-videos.md`

Existen para conservar decisiones y secuencias de implementación. Una vez terminado el cambio correspondiente, deberían tratarse como historial técnico y no como contrato vigente.

## Especificaciones fechadas

Los archivos bajo `docs/superpowers/specs/` conservan el diseño previo de features o migraciones concretas:

- `2026-09-02-data-real-portable-design.md`
- `2026-09-04-catalogo-buscar-todos-productos-design.md`
- `2026-09-04-whatsapp-multiparte-design.md`

Son útiles para entender por qué una feature terminó teniendo determinada forma. Su autoridad queda por debajo de la documentación vigente y del código actual.

## Auditorías e informes históricos

Estos documentos son principalmente evidencia de trabajos ya realizados:

- `astrainforme.md`
- `docs/AUDITORIA.md`
- `docs/audits/margenestienda.md`
- `docs/reports/chaos-and-recovery.md`
- `docs/reports/global-rollout.md`
- `docs/reports/live-canvas-coverage.md`
- `docs/reports/slash-goal-handoff-2026-08-27.md`
- `apps/studio/docs/deuda-editor.md`

No deberían eliminarse sin necesidad porque conservan contexto, evidencia y decisiones anteriores, pero sí conviene diferenciarlos claramente de la documentación actual.

`docs/audits/margenestienda.md` ya se presenta como auditoría cerrada y contiene referencias históricas a la antigua portable. La fuente real vigente es `proyectos/`.

## Archivos ya correctamente archivados

Los siguientes documentos ya están en `docs/archive/` y su ubicación refleja correctamente que son historia del proyecto:

- `docs/archive/ARCHITECTURE_REVIEW_2026-08-21.md`
- `docs/archive/AUTONOMOUS_QUALITY_FORGE.md`
- `docs/archive/HARDCODED_CONTENT_AUDIT.md`
- `docs/archive/PERFORMANCE_RM_DESCARTABLES.md`
- `docs/archive/TOP20_RECURSOS.md`

Este patrón debería reutilizarse para otros documentos cerrados.

## Hallazgos sobre archivos de la raíz

### `pendiente.md`

Describe intentos o pendientes relacionados con la eliminación de Electron/portable. Dado que ese proceso ya fue completado, el archivo puede inducir a error si permanece en la raíz como si fuera trabajo vigente.

Recomendación: archivarlo como evidencia del proceso ya cerrado.

### `astrainforme.md`

Es un informe/auditoría puntual. Tiene valor como evidencia histórica, pero no necesita vivir en la raíz del repositorio.

Recomendación: moverlo a una zona de auditorías o archivo.

### `futuraeliminaciondeportable.md`

El objetivo principal del documento ya se cumplió: la portable fue eliminada.

El archivo conserva, sin embargo, un procedimiento reutilizable de seguridad para operaciones que reemplazan datos: staging, rollback, verificación mediante hashes y validación previa/posterior.

Recomendación:

1. extraer ese procedimiento reutilizable a un documento vigente de seguridad de almacenamiento, por ejemplo `docs/DATA_STORAGE_SAFETY.md`;
2. mover después el plan completo de migración a `docs/archive/` como evidencia histórica;
3. actualizar cualquier referencia que todavía sugiera que la portable existe actualmente.

## Problema transversal: documentación temporal mezclada con documentación permanente

El principal problema encontrado no es la cantidad de archivos, sino que documentos con ciclos de vida distintos conviven al mismo nivel.

Una estructura más clara sería:

- raíz: sólo archivos esenciales de entrada y gobierno del repo;
- `docs/`: documentación vigente;
- `docs/design-references/`: referencias visuales activas o comparativas;
- `docs/archive/`: auditorías, migraciones, reportes, planes y especificaciones ya cerrados.

Dentro de `docs/archive/` podrían existir subdirectorios como:

- `audits/`;
- `reports/`;
- `plans/`;
- `specs/`;
- `migrations/`.

## Política documental recomendada

Para evitar que vuelva a crecer documentación contradictoria:

1. `docs/INDEX.md` debe enumerar toda documentación vigente importante.
2. La documentación activa debería encontrarse en no más de dos saltos desde `docs/INDEX.md`.
3. Un plan, auditoría o informe terminado debería pasar a `docs/archive/` en lugar de permanecer junto a los contratos actuales.
4. No crear documentos exhaustivos que dupliquen manualmente todo el contenido de otros archivos.
5. Cuando una decisión cambie, actualizar primero la fuente autoritativa y luego corregir o archivar referencias históricas que puedan inducir a error.
6. El schema y el código continúan siendo la autoridad ejecutable cuando una descripción documental contradice el comportamiento real.

## Candidatos claros para reorganización futura

Sin eliminar historia, los candidatos más claros para una futura limpieza son:

- `pendiente.md` → archivo histórico;
- `astrainforme.md` → auditorías/archivo;
- `futuraeliminaciondeportable.md` → extraer procedimiento reusable y archivar migración;
- `docs/FULL_REFERENCE.md` → retirar como fuente autoritativa, archivar o generar automáticamente;
- `docs/AUDITORIA.md` → archivo;
- `docs/audits/margenestienda.md` → archivo;
- `docs/reports/*` → archivo histórico;
- `apps/studio/docs/deuda-editor.md` → archivo si sus deudas ya fueron resueltas o trasladadas a `TECHNICAL_DEBT.md`;
- planes/specs fechados ya completados → archivo;
- `docs/MUSE_SPARK_1.2.md` → mantener sólo si sigue existiendo una necesidad específica para ese perfil de agente.

## Conclusión de la revisión

El núcleo documental de SolaraCommerce es suficientemente sólido, pero la historia de desarrollo fue dejando planes, auditorías, migraciones y referencias temporales mezclados con documentación actual.

La limpieza debería preservar esa historia, no borrarla: consolidar la autoridad en los documentos principales, trasladar evidencia cerrada a `docs/archive/` y eliminar cualquier ambigüedad restante sobre arquitecturas que ya no existen, especialmente la antigua portable.
