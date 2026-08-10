# Traza T20 — Round-trip de persistencia (auditoría estática de claves)

Fecha: 2026-08-10 · Alcance: `apps/studio` (IndexedDB + localStorage + sessionStorage) · Contrato: toda clave persistida se escribe y se lee con la misma forma en la misma clave.

## Matriz de claves

### IndexedDB — Dexie `solara-commerce-studio` (`lib/repository.ts`)

| Clave | Se escribe (file:line) | Se lee (file:line) | ¿Misma forma? | Veredicto |
|---|---|---|---|---|
| `projects` (pk `id`) | `saveProject` put `toRecord` (`repository.ts:390`) | `getProject` get(id) (`:375`), `listProjectsWithRecovery` (`:354`), `ensureFirstProject`/`ensureScaleDemoProject`/`ensureModernBaseProject`/`ensureCatalogModernDemoReviews` get(id) | Sí — objeto `StoredProject` íntegro, `project` revalidado con Zod al leer; campos opcionales `diskVersion`/`diskSiteStatus` sin sesgo | OK |
| `projects` delete | `purgeRolledBackDemoRecords` (`:527`) | misma clave de borrado que la escritura | Sí | OK |
| `assetCache` (pk `hash`) | `putCachedAsset` (`:646`) con `cacheKey = hash:recipe-N` | `getCachedAsset` get(hash) + check `recipeVersion` (`:659-662`) | Sí — `hash` como clave primaria en v1/v2/v3/v4; caché regenerable | OK |
| `recoveryDrafts` (pk `projectId`) | `saveRecoveryDraft` (`:400`) | `getRecoveryDraft` get(projectId) (`:410`), `clearRecoveryDraft` delete (`:418`) | Sí | OK |
| `migrations` (pk `projectId`) | `markProjectMigration` (`:426`) | `getProjectMigration` get(projectId) (`:433`) | Sí — round-trip testeado (`repository.test.ts:304-325`, sentinel de la ronda 1) | OK |

### localStorage

| Clave | Se escribe (file:line) | Se lee (file:line) | ¿Misma forma? | Veredicto |
|---|---|---|---|---|
| `solara-studio-storage-version` | `repository.ts:131` (`"2"`) | `repository.ts:126` (=== `"2"`) | Sí | OK |
| `solara-deprecated-category-cleanup` | `repository.ts:334` (`"1"`) | `repository.ts:310` (=== `"1"`) | Sí | OK |
| `solara-export-history:<slug>` | `exportHistory.ts:50` (`JSON.stringify(ExportHistoryEntry[])`) | `exportHistory.ts:29` (JSON.parse + `Array.isArray`), remove `:62` | Sí — mismo prefijo `EXPORT_HISTORY_KEY_PREFIX` en las tres; fallback `[]` | OK |
| `solara-dashboard-pinned` | `dashboardStorage.ts:43` (`JSON.stringify(string[])`) vía `Dashboard.tsx:431` | `dashboardStorage.ts:31` (JSON.parse, filtro string) vía `Dashboard.tsx:217` | Sí | OK |
| `solara-dashboard-selected` | `dashboardStorage.ts:59` (id crudo) vía `Dashboard.tsx:409`; **limpieza** `dashboardStorage.ts:67` vía `Dashboard.tsx:414`/`:1043` | `dashboardStorage.ts:51` (`?? undefined`) vía `Dashboard.tsx:216` | Sí — antes el descarte (Escape/cerrar panel) dejaba el id viejo y el round-trip devolvía una selección que el usuario había cerrado; ahora el descarte limpia la clave | **FIX T20** |
| `solara-dashboard-sort` | `dashboardStorage.ts:87` vía `Dashboard.tsx:419` | `dashboardStorage.ts:75` (validación + fallback `"updated"`) vía `Dashboard.tsx:213` | Sí | OK |
| `solara-dashboard-view` | `dashboardStorage.ts:107` vía `Dashboard.tsx:424` | `dashboardStorage.ts:95` (validación + fallback `"grid"`) vía `Dashboard.tsx:214` | Sí | OK |
| `solara-catalog-view:<storeId>` | `catalogTableModel.ts:92` (crudo `"table"`/`"cards"`) vía `Catalog.tsx:618` | `catalogTableModel.ts:84` (=== `"cards"` else `"table"`) vía `Catalog.tsx:402/410` | Sí | OK |
| `solara-catalog-columns:<storeId>` | `catalogTableModel.ts:76` (JSON del objeto completo fusionado) vía `Catalog.tsx:611` | `catalogTableModel.ts:52` (merge sobre defaults + validación de claves booleanas) vía `Catalog.tsx:399/409` | Sí — el write parte del objeto ya fusionado, round-trip estable | OK |
| `solara-editor-pane:<projectId>` | `Studio.tsx:345` y `:385` (`"open"`/`"closed"`) | `Studio.tsx:212` (=== `"open"`) | Sí | OK |
| `solara-studio-theme` | `Studio.tsx:600` (`"light"`/`"dark"`) | `Studio.tsx:298-300` (validación, `null` por defecto) | Sí — `null` en memoria ≠ clave ausente; sin ambigüedad | OK |

### sessionStorage

| Clave | Se escribe (file:line) | Se lee (file:line) | ¿Misma forma? | Veredicto |
|---|---|---|---|---|
| `solara-preview-zoom` | `Studio.tsx:356` (`String(zoom)`) | `Studio.tsx:221` (`Number` + validación 100/75/50) | Sí | OK |

## Multi-tab (punto 3 del contrato)

- **No existe ningún listener de `storage` ni `BroadcastChannel` en Studio** (grep completo). Una escritura en la pestaña A no invalida la caché de la pestaña B: `solara-studio-theme`, `solara-editor-pane:<id>` y `solara-export-history:<slug>` se leen sólo al montar o al recuperar el foco (`Studio.tsx:396-409` relee el historial al volver a la ventana).
- Veredicto: sin desajuste de forma (nadie relee con otra forma), pero la sincronización entre pestañas es una mejora pendiente de UX, no un bug de round-trip. No se agregó listener para no cambiar comportamiento fuera del contrato.

## Desajustes encontrados y corregidos

1. **`solara-dashboard-selected` (fix en `Dashboard.tsx` + nuevo `lib/dashboardStorage.ts`)**: al descartar la selección (Escape en tarjeta o cerrar el panel de detalle) el estado pasaba a `undefined` pero la clave conservaba el id viejo; al reabrir el dashboard la selección cerrada volvía a aparecer. El estado "descartado" no tenía forma persistida. Fix: `clearStoredSelectedId()` (removeItem) en ambos puntos y extracción de toda la persistencia de preferencias del dashboard a un módulo puro con Storage inyectable (patrón `catalogTableModel`). Test: `lib/dashboardStorage.test.ts` (5 tests, incluye el round-trip del descarte: write → read → clear → `undefined`).
2. **Gate de suite roto por archivo ajeno**: `src/features/builder/traza-contrato.test.ts` (untracked, de otro agente) importaba `zod` sin declararlo. Se agregó `zod@4.1.5` como devDependency de `@solara/studio` (`package.json` + `pnpm-lock.yaml`, 3 líneas) para que la suite complete pase; el archivo del otro agente queda intacto.

## Verificación

- `corepack pnpm --filter @solara/studio test`: **21 files / 217 tests PASS** (incluye `dashboardStorage.test.ts` nuevo y `traza-contrato.test.ts` antes roto).
- typecheck studio: **0 errores en archivos de T20** (el comando completo reporta errores preexistentes en archivos untracked/modificados de otros agentes: `ManagedPersistenceControls.test.ts`, `Seo.preview.test.ts`, `export.worker.test.ts`).
- `corepack pnpm exec playwright test tests/e2e/editor-persistence.spec.ts`: **5/5 GREEN** (dos corridas tuvieron un fallo transitorio de artefactos de trace ENOENT al cerrar context; la corrida limpia pasó).
- `biome check --write` aplicado a los 3 archivos de T20; `git diff --check` limpio; 0 U+FFFD en archivos tocados.
- No se corrió format:check global ni se tocaron archivos de otros agentes (`Studio.tsx` y `Export.tsx` modificados por otro trace quedaron intactos).

## Archivos de T20

- `apps/studio/src/lib/dashboardStorage.ts` (nuevo) y `dashboardStorage.test.ts` (nuevo)
- `apps/studio/src/features/Dashboard.tsx`
- `apps/studio/package.json` y `pnpm-lock.yaml` (zod devDep, sólo para el test de otro agente)
