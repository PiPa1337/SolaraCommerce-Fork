# Deuda técnica y riesgos conocidos

Este registro evita que una futura IA confunda una limitación conocida con un
bug nuevo. No se realizaron refactors aquí porque podrían cambiar el contrato o
el comportamiento del producto.

| Prioridad | Problema y ubicación | Riesgo/impacto | Recomendación |
| --- | --- | --- | --- |
| P1 | `packages/exporter/scripts/legacy-zip-migration.mjs` y `fflate` siguen en el repositorio para la migración única de respaldos `.solara.zip` (manifest V1). | Son la única lectura de ZIP permitida por `check:repository`; si se conservan más de lo necesario, la dependencia y el código de lectura ZIP quedan como superficie de riesgo. | Eliminarlos en un release posterior, cuando no queden tiendas V1 sin migrar; `check:repository` ya bloquea cualquier otra aparición. |
| P1 | Resuelto: la extracción streaming de ZIP ya no aplica. El formato ZIP se eliminó del producto (plan `docs/superpowers/plans/2026-08-07-eliminar-zip.md`): el respaldo editable es `.solara.json` y el sitio se escribe como carpeta desde un mapa de archivos JSON con rutas relativas y límites de tamaño/cantidad. | — | Conservar la validación del mapa de archivos en `writeSiteFiles` (`packages/exporter/scripts/local-project-storage.mjs`). |
| P1 | El servicio local todavía no simula fallos reales de disco lleno o permisos revocados; sí tiene checkpoints de interrupción determinista y límites de upload/extracción en `packages/exporter/src/local-project-storage.test.mjs`. | Un cambio específico del sistema de archivos podría no quedar cubierto por Vitest. | Ejecutar una matriz Windows con volumen temporal de espacio limitado y permisos revocados, sin modificar proyectos confirmados. |
| P1 | La comprobación de symlinks y rutas está implementada defensivamente, pero no tiene una matriz dedicada de enlaces reparse de Windows. | Riesgo de escapar de `proyectos/` en entornos con enlaces especiales. | Agregar pruebas Windows específicas antes de ampliar el servicio. |
| P2 | `StoreProjectV1` es un alias de `StoreProjectV2`. | Puede inducir a crear una migración inexistente o leer un formato v1 que ya no se acepta. | Mantener el alias por compatibilidad y documentar cualquier renombrado futuro con deprecación. |
| P2 | `styles.css` (~82 KB), `Catalog.tsx` (~38 KB), `Builder.tsx` (~34 KB) y `Dashboard.tsx` (~28 KB) son grandes. | Cambios pequeños son difíciles de revisar y aumentan el riesgo de regresión. | Separar por comportamiento sólo con tests de UI y sin cambiar selectores exportados. |
| P2 | El registro de módulos usa `ModuleDefinition<any>` en un punto de agregación. | Se pierde seguridad de tipos en la unión heterogénea. | Introducir un tipo discriminado sólo cuando exista una necesidad real de validación adicional. |
| P2 | Algunos fixtures locales representan assets con data URLs. | Aumentan memoria y hacen más pesada la persistencia de ejemplos. | Mantenerlos para determinismo; mover binarios a archivos sólo si el costo medido lo justifica. |
| P2 | La migración de proyectos a disco no tiene un sentinel de migración explícito por proyecto. | Un flujo interrumpido depende de comprobar manifiestos existentes para ser idempotente. | Añadir registro de migración cuando se agreguen pruebas de recuperación. |
| P3 | Un manifest con error se expone como resumen de recuperación, pero no siempre se persiste como `status: recovery-required`. | La UI puede no conservar la causa entre reinicios. | Persistir el estado sólo junto con un diagnóstico estable y una versión de manifest compatible. |
| P3 | No existe endpoint para abrir directamente la carpeta en Explorer. | El usuario debe navegar manualmente a `proyectos/` si quiere inspeccionar archivos. | Agregar una acción explícita y acotada en Windows, sin aceptar rutas arbitrarias. |
| P3 | El release exige Node 22; el desarrollo local puede usar Node 24 por `engines: >=22`. | Diferencias de runtime pueden ocultar problemas de CI. | Mantener Node 22 como referencia de release y probar localmente con la misma versión cuando sea posible. |
| P3 | El checkout depende de WhatsApp y no es un pago convencional. | Algunas aprobaciones Merchant pueden rechazar el flujo. | Mostrar la limitación en auditoría y no prometer aprobación automática. |
| P3 | La publicación es manual; no hay backend, colaboración ni sincronización remota. | El usuario debe copiar la carpeta pública a un hosting. | Mantener esta decisión explícita hasta definir requisitos de seguridad y operación. |
| P2 | La prueba portable cubre dos copias, Guardar, traslado, servidor público y aislamiento de rutas; la corrupción del `.solara.json` y del mapa del sitio se valida en el storage test, pero la matriz de fallos del sistema operativo no corre en cada E2E. | Una regresión de recuperación ante fallos muy específicos de Windows podría pasar el E2E feliz. | Mantener la matriz determinista en Vitest y ejecutarla como job Windows de release cuando cambie el servicio de disco. |

## Código potencialmente muerto o duplicado

La auditoría inicial no encontró un archivo que pueda eliminarse con seguridad:
los módulos legacy, fixtures y rutas de exportación tienen cobertura o cumplen
compatibilidad. Las áreas candidatas deben confirmarse con `rg` y tests antes de
quitarse; este documento no autoriza una limpieza automática.

## Cómo reducir la deuda sin romper tiendas

1. Reproducir el caso con un fixture determinista.
2. Añadir una prueba que fije el comportamiento actual.
3. Cambiar una capa por vez y verificar preview, sitio exportado y persisted data.
4. Mantener `schemaVersion: 2` y añadir migración antes de cambiar datos.
5. Medir memoria/tiempo antes de introducir abstracciones o dependencias.
