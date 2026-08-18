# Mapa rápido del proyecto

Usá esta tabla como primer salto. Antes de editar, leé el contrato relacionado y
buscá sus tests con `rg`.

| Necesito modificar | Archivo o carpeta principal | Relacionados | Precauciones |
| --- | --- | --- | --- |
| Arranque de Studio | `apps/studio/src/main.tsx`, `App.tsx` | `repository.ts`, `localStorage.ts` | No perder detección del servidor gestionado ni del service worker de producción. |
| Dashboard y selección de tiendas | `apps/studio/src/features/Dashboard.tsx` | `GuidedOverview.tsx`, `repository.ts` | El filtro inicial es activos; crear/duplicar/archivar debe preservar IDs y estado. |
| Flujo de edición | `apps/studio/src/features/Studio.tsx` | `ManagedPersistenceControls.tsx`, `HistoryState` | Undo/redo, drafts y guardado en disco son flujos sensibles. |
| Tienda guiada | `apps/studio/src/features/GuidedOverview.tsx` | `catalog-modern-guidance`, `catalog-modern-template` | No copiar el fixture demo al crear una tienda limpia. |
| Constructor de secciones | `apps/studio/src/features/Builder.tsx` | `@solara/modules`, `module-sdk`, `project-schema` | Zod valida settings; módulos legacy y Catalog Modern tienen familias distintas. |
| Preview | `apps/studio/src/features/Preview.tsx` | `renderPreviewHtml`, workers, iframe messages | Preview y exportación deben producir el mismo árbol semántico. |
| Productos y variantes | `apps/studio/src/features/Catalog.tsx`, `catalog/` | `@solara/core`, CSV worker, schema | Precios en centavos; usar comandos del dominio para índices derivados. |
| Categorías y jerarquía | `packages/project-schema/src/index.ts` | `core`, exporter, búsqueda, navbar | `parentId` máximo a un nivel y `productIds` derivado. |
| Navbar público | `packages/modules/src/index.ts` y estilos | `storefront-runtime`, navigation schema | Mantener enlaces rastreables, teclado, focus return y fallback sin JS. |
| Footer y shell público | `packages/modules/src/` | `packages/exporter/src/index.ts`, `styles.css` | No mezclar selectores legacy con Catalog Modern sin una decisión explícita. |
| Hero, cards o bento | `packages/modules/src/index.ts` | module-sdk, fixtures, `styles.css` | Actualizar también `catalogScaleStore` y verificar 390/768/1024/1440. |
| Tema, familia V2, compatibilidad V1, colores y tipografías | `apps/studio/src/features/ThemeEditor.tsx`, `packages/modules` | `styles.css`, theme schema, `docs/STOREFRONT_V2.md` | V2 es el default; V1 sólo conserva proyectos legacy y cambiar familia no migra contenido. |
| Imágenes y videos | `apps/studio/src/features/Assets.tsx` | `image.worker.ts`, `workers.ts`, exporter | Conservar hash, dimensiones, alt, WebP/fallback y no bloquear UI. |
| SEO y auditoría | `apps/studio/src/features/Seo.tsx` | exporter, site-optimizer | HTML, JSON-LD, sitemap y feed deben salir del mismo snapshot. |
| Exportación del sitio | `packages/exporter/src/index.ts` | modules, runtime, `export.worker.ts` | No introducir datos del editor en la carpeta pública; mantener reproducibilidad. |
| Carrito y WhatsApp | `packages/storefront-runtime/src/index.ts` | exporter runtime, product templates | Reconciliar precios desde proyecto; no guardar datos personales. |
| Persistencia IndexedDB | `apps/studio/src/lib/repository.ts` | Dexie, recovery drafts | Es caché/recovery cuando el servidor gestionado está activo. |
| Guardado local en disco | `apps/studio/src/lib/localStorage.ts`, `localProjectRepository.ts` | `local-project-storage.mjs`, `serve.mjs` | Streams, SHA-256, `409`, staging y commit atómico son obligatorios. |
| Respaldo `.solara.json` | `apps/studio/src/lib/projectArchive.ts` | exporter, workers, schema | Validar envelope y schema; no asumir que un archivo externo es confiable. |
| Servidor local | `packages/exporter/scripts/serve.mjs` | `local-project-storage.mjs`, launcher | Loopback solamente; proteger sesión, rutas y shutdown. |
| Fixtures | `packages/project-schema/src/catalog-modern-fixture.ts`, `scale-fixture.ts` | templates, tests, benchmark | Deterministas; no cambiar silenciosamente Predeterminado administrado. |
| Tests unitarios | Cada paquete `src/*.test.ts` | Vitest | Ejecutar paquete afectado y luego `pnpm check`. |
| Tests E2E | `tests/e2e/` | `studio-server.ts`, helpers | Chromium local; release habilita Firefox/WebKit. |
| CI/release | `.github/workflows/`, `scripts/` | package scripts | CI usa Node 22 y pnpm 10.15.1; no introducir comandos no documentados. |
| Launcher Windows | `Abrir SolaraCommerce.cmd`, `scripts/open-solara.ps1` | `serve.mjs`, `.solara-runtime` | No matar procesos ajenos; revisar puertos 4173–4180. |
| Shell portable Windows | `apps/desktop/src/main.mjs` | `preload.mjs`, `vite.config.mjs`, `electron-builder.yml` | Usa `solara://studio`, perfil junto al ejecutable y lock por carpeta. |
| Layout portable | `packages/exporter/scripts/portable-layout.mjs` | `local-project-storage.mjs`, `docs/PORTABILITY.md` | No aceptar rutas absolutas ni escribir fuera de `proyectos/`/`.solara-runtime/`. |
| Handler HTTP/protocolo | `packages/exporter/scripts/solara-request-handler.mjs` | `serve.mjs`, Electron main, storage | Mantener paridad de endpoints y autorización entre ambos adaptadores. |

## Orden recomendado para una funcionalidad

1. Definir o verificar el schema y el fixture.
2. Implementar la transformación pura en `core` o `exporter`.
3. Escribir tests unitarios y de exportación.
4. Integrar el inspector o la pantalla de Studio.
5. Agregar un recorrido E2E si cambia una ruta del usuario.
6. Ejecutar el gate proporcional y actualizar esta tabla sólo si cambia el mapa.
