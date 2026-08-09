# Deuda técnica y riesgos conocidos

Este registro evita que una futura IA confunda una limitación conocida con un
bug nuevo. Las filas marcadas como "Resuelto" se cerraron con el plan de deuda
[`docs/superpowers/plans/2026-08-07-deuda-tecnica.md`](../docs/superpowers/plans/2026-08-07-deuda-tecnica.md)
y la eliminación de ZIP
([`2026-08-07-eliminar-zip.md`](../docs/superpowers/plans/2026-08-07-eliminar-zip.md));
lo que sigue pendiente son decisiones de producto o matrices que exigen release.

| Prioridad | Problema y ubicación | Riesgo/impacto | Recomendación |
| --- | --- | --- | --- |
| P1 | `packages/exporter/scripts/legacy-zip-migration.mjs` y `fflate` siguen en el repositorio para la migración única de respaldos `.solara.zip` (manifest V1). | Son la única lectura de ZIP permitida por `check:repository`; si se conservan más de lo necesario, la dependencia y el código de lectura ZIP quedan como superficie de riesgo. | Eliminarlos en un release posterior, cuando no queden tiendas V1 sin migrar; `check:repository` ya bloquea cualquier otra aparición. |
| P1 | Resuelto: la extracción streaming de ZIP ya no aplica. El formato ZIP se eliminó del producto (plan `docs/superpowers/plans/2026-08-07-eliminar-zip.md`): el respaldo editable es `.solara.json` y el sitio se escribe como carpeta desde un mapa de archivos JSON con rutas relativas y límites de tamaño/cantidad. | — | Conservar la validación del mapa de archivos en `writeSiteFiles` (`packages/exporter/scripts/local-project-storage.mjs`). |
| P1 | Resuelto (determinista): el almacenamiento local simula fallos de escritura con la opción `writeGuard` (sólo tests) en `packages/exporter/scripts/local-project-storage.mjs`: disco lleno, permisos revocados y reintento tras fallo transitorio sobre las ops `write-upload`, `write-site-files`, `rename-site`, `copy-archive`, `write-manifest` y `remove-old-current` (Task 2 del plan de deuda). | — | Sigue pendiente la matriz OS real (disco lleno/permisos a nivel de volumen) como job de release, aislada de proyectos confirmados. |
| P1 | Resuelto: la matriz de reparse points fija el rechazo defensivo de enlaces: junctions de Windows y symlinks POSIX dentro de `proyectos/` (`packages/exporter/src/reparse-points.test.mjs`, Task 3 del plan de deuda). Nota: un junction como carpeta de tienda queda invisible para list()/findManifest (se salta por tipo de entrada); los directorios de sitio se rechazan por assertNoReparsePoints. | — | Re-ejecutar la matriz cuando cambie el servicio de disco. |
| P2 | `StoreProjectV1` es un alias de `StoreProjectV2`. | Puede inducir a crear una migración inexistente o leer un formato v1 que ya no se acepta. | Mantener el alias por compatibilidad (TSDoc) y documentar cualquier renombrado futuro con deprecación. |
| P2 | Resuelto: los archivos grandes se dividieron por comportamiento sin cambiar el contrato ni el bundle: `Builder.tsx` (inspector y editores por responsabilidad), `Catalog.tsx` (toolbar y árbol de categorías), `Dashboard.tsx` (tarjeta y toolbar) y `styles.css` en cuatro `@import` (base, cosmic, editorial, feedback) con cascada idéntica y bundle byte-idéntico (Tasks 9–12 del plan de deuda). | — | Mantener los splits: los cambios futuros van en el archivo de su responsabilidad, no de vuelta a `styles.css`. |
| P2 | Resuelto: el registro de módulos se tipó sin romper el registry runtime heterogéneo: `ModuleId`, `ModuleById` y `getTypedModule(id)` en `packages/modules/src/index.ts`; el `any` queda sólo donde el registry agrega definiciones con settings schema propios (Task 7 del plan de deuda). | — | Usar `getTypedModule` para acceso tipado; no ampliar el uso de `ModuleDefinition<any>`. |
| P2 | Resuelto: los fixtures conservan data URLs por decisión registrada con medición en `packages/project-schema/src/fixture-budget.test.ts` (Task 8): `catalogModernStore` 56.3 KiB, `catalogScaleStore` 46.5 KiB y `referenceStore` 8.7 KiB serializados. | — | Re-ejecutar `fixture-budget.test.ts` si un fixture crece más de un orden de magnitud. |
| P2 | Resuelto: la migración de proyectos a disco tiene sentinel por proyecto en la tabla `migrations` de Dexie (`status: "pending" | "done"`, `updatedAt`), idempotente ante flujos interrumpidos (Task 6 del plan de deuda). | — | Mantener el sentinel como parte del contrato de migración a disco. |
| P3 | Resuelto: el diagnóstico de un manifest con error se persiste en el sidecar `recovery.json` de la carpeta de la tienda (`{ format: "solara-local-recovery", folder, message, detectedAt }`); los listados devuelven mensajes estables y las carpetas sanas eliminan el sidecar (Task 4 del plan de deuda). | — | Conservar el sidecar como única fuente del mensaje entre reinicios. |
| P3 | Resuelto: existe el endpoint `POST /__solara/storage/projects/{projectId}/open-folder` con botón "Abrir carpeta" en el Dashboard; abre Explorer en Windows y en otras plataformas confirma la ruta sin abrirla (Task 5 del plan de deuda). | — | Mantener la ruta acotada al handler compartido HTTP/Electron. |
| P3 | El release exige Node 22; el desarrollo local puede usar Node 24 por `engines: >=22`. | Diferencias de runtime pueden ocultar problemas de CI. | Mantener Node 22 como referencia de release y probar localmente con la misma versión cuando sea posible. |
| P3 | El checkout depende de WhatsApp y no es un pago convencional. | Algunas aprobaciones Merchant pueden rechazar el flujo. | Mostrar la limitación en auditoría y no prometer aprobación automática. |
| P3 | La publicación es manual; no hay backend, colaboración ni sincronización remota. | El usuario debe copiar la carpeta pública a un hosting. | Mantener esta decisión explícita hasta definir requisitos de seguridad y operación. |
| P2 | La prueba portable cubre dos copias, Guardar, traslado, servidor público y aislamiento de rutas; la corrupción del `.solara.json` y del mapa del sitio y los fallos de escritura deterministas se validan en Vitest, pero la matriz de fallos del sistema operativo no corre en cada E2E. | Una regresión de recuperación ante fallos muy específicos de Windows podría pasar el E2E feliz. | Mantener la matriz determinista en Vitest y ejecutar la matriz OS real como job Windows de release cuando cambie el servicio de disco. |
| P3 | El runtime público anima las entradas de secciones con `animation-fill-mode: both` (`packages/storefront-runtime/src/index.ts`, presets ~1360-1410): al terminar la animación el fill-mode queda aplicado y puede tapar los efectos de hover de las zonas animadas (defecto del estado pre-revamp; el revamp lo corrigió con `backwards` y esa corrección se revirtió junto con él). | Los hovers de elementos con motion de entrada pueden quedar muertos hasta recargar la página. | Si se retoma el trabajo de motion, cambiar a `fill-mode: backwards` (conserva el estado oculto durante el delay sin pisar el hover posterior) y cubrirlo con un test E2E de hover posterior al reveal. |

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
