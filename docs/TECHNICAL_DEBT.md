# Deuda técnica y riesgos conocidos

Este registro evita que una futura IA confunda una limitación conocida con un
bug nuevo. No se realizaron refactors aquí porque podrían cambiar el contrato o
el comportamiento del producto.

| Prioridad | Problema y ubicación | Riesgo/impacto | Recomendación |
| --- | --- | --- | --- |
| P1 | `packages/exporter/scripts/local-project-storage.mjs` extrae ZIP con `fflate.unzipSync`. El archive de Studio usa la misma estrategia. | El consumo de memoria crece con el ZIP y la extracción no es streaming. | Evaluar extracción streaming con límites de tamaño, archivos y compresión; conservar protección Zip Slip y pruebas de corrupción. |
| P1 | El servicio local no tiene fault injection automatizado para disco lleno, permisos, interrupción entre staging y rename. | Una regresión podría dejar recovery o un manifest inconsistente. | Añadir harness de filesystem simulado y verificar que siempre sobreviva el manifest anterior. |
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

## Código potencialmente muerto o duplicado

La auditoría inicial no encontró un archivo que pueda eliminarse con seguridad:
los módulos legacy, fixtures y rutas de exportación tienen cobertura o cumplen
compatibilidad. Las áreas candidatas deben confirmarse con `rg` y tests antes de
quitarse; este documento no autoriza una limpieza automática.

## Cómo reducir la deuda sin romper tiendas

1. Reproducir el caso con un fixture determinista.
2. Añadir una prueba que fije el comportamiento actual.
3. Cambiar una capa por vez y verificar preview, ZIP y persisted data.
4. Mantener `schemaVersion: 2` y añadir migración antes de cambiar datos.
5. Medir memoria/tiempo antes de introducir abstracciones o dependencias.
