# Traza T12 — Flujo de datos de assets (upload, replace, guard de borrado, dedupe)

Estado: **1 desajuste encontrado y corregido** (`assetUses.ts`). `Assets.tsx` e
`image.worker.ts` sin desajustes. Auditoría estática sobre el contrato vigente.

## Matriz de contrato

### 1. Upload: `features/Assets.tsx` → `workers/image.worker.ts` → asset record

Payload al worker (`lib/workers.ts:processImageInWorker`): `{ buffer, name, type, maxWidth: 1800 }` + `id` inyectado por `requestWorker`. Worker responde `{ id, ok, result }` con `result = { ...plan, primary, fallback, responsive }` (`plan` = width/height/responsiveWidths).

| Campo worker | Campo del record UI | Render en UI | Estado |
|---|---|---|---|
| `width` | `width` | grilla + detalle | ✅ |
| `height` | `height` | grilla + detalle | ✅ |
| `primary` | `source` | `<img src>` | ✅ |
| `fallback` | `fallbackSource` | exporter | ✅ |
| `responsive` | `responsiveSources` | exporter | ✅ |
| — | `id` | detalle / Copiar ID | ✅ generado en UI |
| — | `name` | grilla / detalle | ✅ desde `file.name` |
| — | `size` | grilla / detalle | ⚠️ no contractual: estimado como `source.length * 0.75` (base64); el schema no tiene campo `size` y el worker no lo devuelve. Consistente, no rompe contrato. |

Límites: 25 MB imágenes (`IMAGE_RECIPE.maxBytes`, `processImageInWorker` y el
hint de `Assets.tsx` coinciden); 30 MB + ≤60 s videos en `Assets.tsx:233,264`.
Caché (`repository.ts` `CachedAsset`) devuelve exactamente los campos de
`ProcessedImage` + extras; `Assets.tsx` consume los compartidos. ✅

### 2. Replace (fix de F7): campos preservados vs. intercambiados

`replaceAsset` (Assets.tsx:196) usa `updateAsset(asset.id, {...})`:
- Preservados: `id`, `name`, `alt`, `kind`.
- Intercambiados: `mimeType`, `source`, `fallbackSource`, `responsiveSources`, `width`, `height`, `hash`.

El resultado es un `ImageAsset` válido (todos los requeridos presentes) →
`replaceProject` (`Studio.tsx:502`, `StoreProjectV1Schema.safeParse`) lo acepta. ✅

### 3. Guard de borrado: `lib/assetUses.ts` vs. chequeo media del schema

El schema (`StoreProjectV1Schema` superRefine, `packages/project-schema/src/index.ts`) chequea:

| Referencia chequeada por el schema | `assetUses` | Estado |
|---|---|---|
| `identity.logoAssetId` | ✅ línea 28 | ✅ |
| `seo.socialImageId` | ✅ línea 31 | ✅ |
| `products[].imageIds[]` | ✅ línea 35 | ✅ |
| `products[].variants[].imageId` | ✅ línea 38 | ✅ |
| `videos[].posterAssetId` | ✅ línea 45 | ✅ |
| `sections[].settings.imageId` / `posterAssetId` (incl. `slides[].imageId`) | ✅ collector recursivo | ✅ |
| **`pages[].sections[].settings.imageId` / `posterAssetId` (incl. `slides[].imageId`)** | ❌ **no se iteraban las páginas** | 🔧 **CORREGIDO** |
| `categories[].imageId` | ✅ línea 50 | ✅ |
| `collections[].imageId` | ✅ línea 55 | ✅ |
| `sections[].settings.videoAssetId` (referencia a video) | N/A (guarda borrado de imágenes; `Assets.tsx` no borra videos) | ✅ N/A |

**Desajuste:** el schema valida media en `project.sections` Y `project.pages[].sections`
(`validateSectionMedia` se invoca para ambas, index.ts:688-695), y `Builder.tsx:290`
edita secciones de páginas editables. Un asset usado como `imageId` en una sección de
"about"/"contacto" pasaba el guard → el borrado se habilitaba → `replaceProject`
fallaba el safeParse (delete "allowed" que luego falla).

**Fix:** `assetUses` ahora itera `[...project.sections, ...project.pages.flatMap(p => p.sections)]`.

### 4. Dedupe del dropzone por hash vs. lista

`addFiles`/`addVideos` deduplican por SHA-256 contra `project.assets`/`project.videos`
y dentro del lote (`knownHashes`); la grilla muestra el mismo `hash` en el detalle.
Consistente. Nota menor: `hashFile` se ejecuta dos veces por imagen (dedupe +
`processImageFile`); costo aceptable, sin impacto de contrato.

## Cambios

- `apps/studio/src/lib/assetUses.ts`: guard cubre `pages[].sections` (también slides).
- `apps/studio/src/lib/assetUses.test.ts`: 2 tests nuevos:
  - usa una sección de página editable como uso;
  - paridad con el schema: borrar el asset referenciado hace fallar `StoreProjectV1Schema` (prueba que el guard impide un borrado que el schema rechazaría).

## Verificación

- `vitest run src/lib/assetUses.test.ts` → 6/6 PASS (suite studio: los 3 archivos
  fallidos son de otras trazas: `catalogTableModel.test.ts`, `traza-contrato.test.ts`
  (untracked), `export.worker.test.ts` (untracked) — fallan sin mis cambios).
- Typecheck: sin errores en mis archivos (errores actuales sólo en archivos de otras trazas).
- `playwright test tests/e2e/ui-assets.spec.ts tests/e2e/assets.spec.ts` → 4/4 GREEN.
- `biome check --write` aplicado; `git diff --check` limpio; 0 U+FFFD.

## Preocupaciones

1. `size` de grilla/detalle es un estimado base64, no un campo del contrato (no hay `size` en `ImageAssetSchema`). Si se quiere exactitud, medir bytes reales al procesar.
2. Entorno con agentes concurrentes: resets de working tree de otras trazas borraron mis
   cambios dos veces durante la sesión; el commit debe incluir sólo `assetUses.ts` + test.
3. `traza-contrato.test.ts` y `export.worker.test.ts` (untracked, otras trazas) rompen
   el suite y el typecheck de studio hasta que sus autores los terminen.
