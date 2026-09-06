# Product Gallery Videos — Plan extenso anti-rotura

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** La galería de producto acepta opcionalmente hasta 3 videos locales por producto (default `[]`, sin migrar nada), renderizados junto a las imágenes con presupuesto ultra-light de 2 MB hard / 1 MB ideal, sin romper schema, preview, exportación, runtime, Studio ni proyectos existentes. En mobile (≤767px) el stage de imagen/video es mínimo 1:1 cuadrado y se adapta en alto si el medio es más alto (p. ej. 9:16) sin recortar, para todas las tiendas (modern v1, v2 y legacy).

**Architecture:** `Product.videoIds: AssetId[]` con `.max(3).default([])` referencia `project.videos` ya existente; galería mezcla imágenes primero + videos después bajo el mismo `data-product-gallery`; videos nuevos y existentes pasan por receta ultra-light (validación MP4/WebM + recompresión liviana canvas+MediaRecorder sólo si excede + poster WebP con receta imagen); exporter suma `videoIds` de producto a `publicMediaUsage` y expone `og:video` + `VideoObject`; runtime generaliza selector y pausa videos ocultos; Studio edita `videoIds` con upload optimizado. Todo detrás de defaults vacíos: sin videos, el HTML/JSON-LD/CSS/JS resultante es byte-idéntico al actual salvo atributos aditivos compatibles.

**Tech Stack:** TypeScript estricto, Zod, Vitest, React 19 + Vite (Studio), `@solara/project-schema`, `@solara/core`, `@solara/modules`, `@solara/module-sdk`, `@solara/exporter`, `@solara/storefront-runtime` serializado, Playwright Chromium, pnpm 10.15.1, Node 24.x.

## Global Constraints

- `StoreProjectV2Schema` es la autoridad del modelo. `schemaVersion` permanece en `2` hasta que exista una migración explícita y testeada.
- `StoreProjectV1` es un alias temporal de `StoreProjectV2` para compatibilidad de nombres internos; no significa que exista un contrato v1 adicional.
- El preview y el sitio público deben usar el mismo renderer de `@solara/exporter`.
- Los módulos `legacy-editorial-v1` se conservan sólo para compatibilidad. Las nuevas opciones pertenecen a `catalog-modern-v1` (pero este plan actualiza legacy sólo en paridad mínima, sin settings nuevos).
- Los `productIds` de categorías y colecciones son índices derivados: después de editar asignaciones hay que pasar por el dominio (`@solara/core`) o recalcular con los helpers del schema.
- El dinero se representa en centavos enteros. Nunca introducir floats para precios, descuentos o subtotales.
- Los assets del proyecto son datos; no incorporar binarios generados, `dist/`, `proyectos/`, `.solara-runtime/`, `.release/` ni reportes al commit.
- No agregar dependencias de runtime sin justificar impacto en el sitio público y en los budgets existentes.
- No enviar el catálogo completo a una IA: usar el schema, fixtures pequeñas o muestras deterministas.
- Presupuesto video producto: ≤2 MB hard por archivo, ~1 MB ideal, ≤720p lado mayor (540p si dura >8 s), ≤10 s recomendado, 15 s tope blando, 60 s hard global heredado, ~800 kbps video + 64 kbps audio o muteado. Global hero sigue en 30 MB / 60 s.
- Matemática bloqueada: 1 MB ≈ 8 s a 1 Mbps; 10 s a 1 MB exige ~800 kbps y/o 540p. Sin `ffmpeg.wasm` (~25 MB, lento, rompe budgets).
- Imágenes: receta `responsive-alpha-v2` obligatoria; posters de video la reutilizan vía `createImageAssetFromProcessed` + `assertImageAssetOptimized`.
- Runtime público JS ≤80 KiB raw, CSS público ≤32 KiB gzip; no agregar dependencias externas al storefront.
- No-JS: HTML inicial útil sin JS (`<video controls poster>` funciona sin JS; primera media con `data-gallery-active="true"` visible por CSS).
- Accesibilidad/teclado: thumbs son `<button>`, `aria-current`, `aria-label` ("Ver video N"), `prefers-reduced-motion` respetado (videos producto nunca autoplay, nunca loop forzado).
- Mobile galería producto (≤767px, todas las tiendas): stage mínimo 1:1 cuadrado, adaptable en alto hasta 9:16 sin recorte (`object-fit: contain`, fondo surface, `width:100%; height:auto`). Causa actual: `aspect-ratio: 1/1.08` + `object-fit: cover` (v1) y `max-height:300px` + `aspect-ratio:4/3` + `cover` (v2 mobile) recortan retrato. Fix sólo CSS mobile, desktop intacto.
- Checkout WhatsApp, Merchant, SEO y sitemaps no se rompen: imágenes siguen siendo la fuente de `imageUrls` Merchant; video es aditivo (`og:video`, `VideoObject`), `video-sitemap.xml` sigue hero-only en v1.

## Non-goals v1 (no implementar)

- Transcodificación pesada (`ffmpeg.wasm`, WebCodecs manual, doble rendición MP4+WebM, HLS).
- Reorder drag-and-drop mixto imagen/video (orden fijo: imágenes luego videos).
- `video-sitemap.xml` por producto ni `Merchant video_link`.
- Contar videos como imagen requerida para activar (sigue exigiendo `imageIds.length > 0`).
- Cambiar `baseUrl`, precios, categorías, colecciones, navegación, checkout.

## Compatibilidad y rollback

- Proyectos viejos sin `videoIds`: Zod `.default([])` los parsea a `[]`; `?? []` en todo código runtime/exporter por defensa en memoria.
- Sin videos: galería, `publicMediaUsage.videoIds`, `og:video`, JSON-LD y runtime resultan idénticos a hoy (tests de paridad lo verifican).
- Videos huérfanos (id inexistente): filtrados en `productVideoIds`, `normalizeImportedProductReferences` y render; Zod `superRefine` los rechaza al validar proyecto completo.
- Rollback por tarea: cada commit es revertible solo (`git revert`); ningún commit cambia `schemaVersion` ni borra campos.
- Si algo falla en gates: no avanzar de tarea; `git status` limpio antes de cada tarea.

---

## File Map

| Responsabilidad | Archivos exactos |
| --- | --- |
| Contrato + validación | `packages/project-schema/src/index.ts:530-546` (ProductSchema), `packages/project-schema/src/index.ts:946-1011` (superRefine), `packages/project-schema/src/media.ts:99-111` (VideoAsset) |
| Helpers producto-video | NEW `packages/project-schema/src/product-video.ts`, TEST `packages/project-schema/src/product-video.test.ts` |
| Fixtures/template | `packages/project-schema/src/catalog-modern-fixture.ts`, `packages/project-schema/src/catalog-modern-template.ts`, `packages/project-schema/src/catalog-modern-v2-fixture.ts`, `packages/project-schema/src/fixture.ts:189` (no agregar videos a fixtures default; sólo tests locales) |
| Dominio | `packages/core/src/index.ts:31-46` (ProductPatch), `:339-358` (normalize), `:402-410` (applyProductPatch), `:818,831,892,1040,1120-1144` (CSV), `packages/core/src/project-mutations.ts:52,332,516-518` (mirror) |
| Receta upload existente | `apps/studio/src/features/builder/videoUpload.ts:1-385` (buildVideoAsset, extractVideoPoster, límites 30MB/60s) |
| Optimización ultra-light | NEW `apps/studio/src/features/builder/productVideoOptimize.ts`, TEST `apps/studio/src/features/builder/productVideoOptimize.test.ts` |
| Imagen optimizada | `apps/studio/src/lib/imageAsset.ts:92-123`, `apps/studio/src/workers/image.worker.ts:207-246`, `apps/studio/src/lib/workers.ts:30,101,342,347` |
| Render moderno | `packages/modules/src/catalog-modern.ts:1255-1514` (galería `1375-1425`) |
| Render legacy paridad | `packages/modules/src/definitions.ts:998-1098` (galería `1067-1098`) |
| SDK | `packages/module-sdk/src/index.ts:327-395` (safeAssetUrl, findVideo, videoUrl, renderVideo — no cambiar firma) |
| Exporter medios | `packages/exporter/src/index.ts:945-1046` (publicMediaUsage), `:1310-1350` (productDetailSection), `:2269-2323` (páginas producto), `:1520-1565,1748` (head og:video), `packages/exporter/src/assets.ts:603-634` |
| Structured data | `packages/exporter/src/structured-data.ts:216-310` |
| Auditoría | `packages/exporter/src/audit.ts:244-285` |
| Runtime | `packages/storefront-runtime/src/index.ts:1104-1120,1122-1155,1273-1276,1951-1969` + NEW `packages/storefront-runtime/src/gallery-media.ts` |
| Studio edición | `apps/studio/src/features/catalog/ProductEditor.tsx:29-39,127-137,208-228,509-561`, `apps/studio/src/features/catalog/product/productEditorModel.ts`, `apps/studio/src/features/Catalog.tsx:1390-1435` |
| Estilos | `packages/modules/src/styles.ts` (bloques `.catalog-product-gallery` ~2355 y `.solara-product-gallery` 1395-1615) |
| Budgets/tests | `scripts/storefront-runtime-budget.test.ts`, `scripts/public-storefront-budget.test.ts`, `scripts/check-image-budget.mjs`, `scripts/check-repository.mjs` |
| Docs | `docs/DATA_MODEL.md`, `docs/PROJECT_MAP.md` (sólo si cambia mapa), `CHANGELOG.md`, `docs/INDEX.md` (no tocar salvo nuevo doc) |

**Decisiones bloqueadas (no re-discutir por tarea):**

- `videoIds: z.array(AssetIdSchema).max(3).default([])`. Orden galería: imágenes (orden actual) luego videos (orden `videoIds`).
- Video producto: `<video controls preload="none" playsinline>` + `poster` obligatorio + `width/height` anti-CLS, sin `autoplay/muted/loop` forzados (difiere de hero loop mudo).
- Thumbs video: poster + badge `▶ Ns`, mismo `data-gallery-thumb="{videoId}"` para reusar handler.
- `syncVariant` no cambia para videos (variantes sólo apuntan a imágenes).
- Export: `usedVideoIds` incluye producto; `og:video` = primer video producto si no hay hero video; JSON-LD `video: VideoObject[≤3]`; sitemap video sigue hero-only.
- Activación exige imagen; videos opcionales.
- Sin nuevas deps. Sin `ffmpeg.wasm`.

---

### Task 0: Preflight baseline anti-rotura

**Files:**
- Verify only: `git status`, `docs/perpetual-state.json` no tocar, `CHANGELOG.md` leer formato.
- Test: ninguno nuevo; captura baseline.

**Interfaces:**
- Consumes: repo limpio.
- Produces: baseline de budgets y tests que Tasks 1-9 deben igualar o mejorar.

- [ ] **Step 1: Verificar repo limpio y rama**

```bash
git status --short
git log --oneline -3
git diff --check
```

Expected: `git status` vacío (o sólo este plan sin commitear). Si hay cambios ajenos, detenerse y avisar. No commitear nada en esta tarea.

- [ ] **Step 2: Capturar baseline de tests afectados**

```bash
corepack pnpm --filter @solara/project-schema exec vitest run src/index.test.ts
corepack pnpm --filter @solara/core exec vitest run src/index.test.ts
corepack pnpm --filter @solara/modules exec vitest run src/index.test.ts
corepack pnpm --filter @solara/exporter exec vitest run src/structured-data.test.ts
corepack pnpm --filter @solara/storefront-runtime exec tsc --noEmit
```

Expected: todo PASS antes de tocar código. Anotar tiempos y guardar salida mentalmente; si algo ya falla, detenerse e informar (no es culpa del feature).

- [ ] **Step 3: Capturar baseline de budgets**

```bash
corepack pnpm exec vitest run scripts/storefront-runtime-budget.test.ts scripts/public-storefront-budget.test.ts
```

Expected: JS ≤80 KiB raw, CSS ≤32 KiB gzip. Anotar bytes exactos del log para comparar en Task 9.

- [ ] **Step 4: No-op de seguridad `.solara.json`**

```bash
corepack pnpm --filter @solara/project-schema exec vitest run src/fixture-budget.test.ts
```

Expected: PASS. Confirma que fixtures default no contienen videos (no deben agregarse videos a fixtures globales en este plan).

- [ ] **Step 5: Sin commit (tarea de lectura)**

No commitear. Marcar Task 0 completa sólo si todo lo anterior está en verde.

---

### Task 1: Contrato `Product.videoIds` + validación (back-compat total)

**Files:**
- Modify: `packages/project-schema/src/index.ts:530-546`
- Modify: `packages/project-schema/src/index.ts:946-1011`
- Test: `packages/project-schema/src/index.test.ts`

**Interfaces:**
- Consumes: `AssetIdSchema`, `VideoAssetSchema` (`media.ts:99-111`).
- Produces: `Product["videoIds"]: AssetId[]` default `[]` max 3; Tasks 2-9 asumen `(product.videoIds ?? [])`.

- [ ] **Step 1: Write the failing test**

```ts
// packages/project-schema/src/index.test.ts — append, no modificar tests existentes
import { ProductSchema } from "./index.js";

test("producto acepta videoIds opcionales y rechaza más de 3", () => {
  const base = {
    id: "prod-video-001",
    slug: "prod-video",
    title: "Prod video",
    description: "desc",
    status: "active",
    brand: "Marca",
    categoryIds: [],
    collectionIds: [],
    tags: [],
    imageIds: [],
    variants: [{ id: "var-001", title: "Única", sku: "", optionValues: {}, price: 1000, available: true, stockStatus: "in_stock" }],
    createdAt: "2026-09-04T00:00:00.000Z",
    updatedAt: "2026-09-04T00:00:00.000Z",
  };
  expect(ProductSchema.parse({ ...base }).videoIds).toEqual([]);
  expect(ProductSchema.parse({ ...base, videoIds: ["video-1"] }).videoIds).toEqual(["video-1"]);
  expect(() => ProductSchema.parse({ ...base, videoIds: ["a", "b", "c", "d"] })).toThrow();
});

test("proyecto viejo sin videoIds sigue válido (back-compat)", () => {
  const base = {
    id: "prod-old-001",
    slug: "prod-old",
    title: "Viejo",
    description: "desc",
    status: "active",
    brand: "Marca",
    categoryIds: [],
    collectionIds: [],
    tags: [],
    imageIds: [],
    variants: [{ id: "var-001", title: "Única", sku: "", optionValues: {}, price: 1000, available: true, stockStatus: "in_stock" }],
    createdAt: "2026-09-04T00:00:00.000Z",
    updatedAt: "2026-09-04T00:00:00.000Z",
  };
  const parsed = ProductSchema.parse({ ...base });
  expect(parsed.videoIds).toEqual([]);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `corepack pnpm --filter @solara/project-schema exec vitest run src/index.test.ts -t "videoIds"`
Expected: FAIL (`videoIds` no existe / `expected [] but got undefined`).

- [ ] **Step 3: Write minimal implementation**

```ts
// packages/project-schema/src/index.ts — dentro de ProductSchema, después de imageIds:
imageIds: z.array(AssetIdSchema),
videoIds: z.array(AssetIdSchema).max(3).default([]),
```

```ts
// superRefine productos — después de addDuplicateIssues(product.imageIds...):
addDuplicateIssues(
  product.videoIds ?? [],
  ["products", productIndex, "videoIds"],
  `Video del producto ${product.id}`,
  context,
);
```

```ts
// después de product.imageIds.forEach(addMissingReferenceIssue...):
(product.videoIds ?? []).forEach((videoId, referenceIndex) => {
  addMissingReferenceIssue(
    project.videos.some((video) => video.id === videoId),
    ["products", productIndex, "videoIds", referenceIndex],
    `Video del producto ${product.id}`,
    videoId,
    context,
  );
});
```

Reglas anti-rotura: no tocar `schemaVersion`, no tocar `imageIds`, no tocar `Variant.imageId`, no agregar videos a fixtures globales. `?? []` obligatorio en validación para memoria pre-parse.

- [ ] **Step 4: Run test to verify it passes**

Run: `corepack pnpm --filter @solara/project-schema exec vitest run src/index.test.ts`
Expected: PASS (incluidos tests viejos sin modificar). Luego `corepack pnpm --filter @solara/project-schema exec tsc --noEmit` PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/project-schema/src/index.ts packages/project-schema/src/index.test.ts
git commit -m "feat(schema): agrega Product.videoIds opcional con validación"
```

Rollback: `git revert HEAD` deja schema como antes; proyectos con `videoIds` volverían a fallar validación (aceptable porque aún no hay UI que los genere).

---

### Task 2: Dominio `@solara/core` — patch, normalización, CSV (sin cambiar precios ni índices)

**Files:**
- Modify: `packages/core/src/index.ts:31-46,339-358,402-410,818,831,892,1040,1120-1144`
- Modify: `packages/core/src/project-mutations.ts:52,332,516-518`
- Test: `packages/core/src/index.test.ts`

**Interfaces:**
- Consumes: `Product["videoIds"]` Task 1.
- Produces: `product.update` acepta `videoIds`; imports filtran huérfanos; CSV exporta/importa `videos` sin romper `imagenes`.

- [ ] **Step 1: Write the failing test**

```ts
// packages/core/src/index.test.ts — nuevo test, no tocar existentes
test("product.update acepta videoIds y normaliza huérfanos sin tocar precios", () => {
  const at = "2026-09-04T00:00:00.000Z";
  const before = referenceStore.products[0]!;
  const updated = reduceProject(referenceStore, {
    type: "product.update",
    productId: before.id,
    changes: { videoIds: [] },
    at,
  });
  expect(updated.products[0]?.videoIds).toEqual([]);
  expect(updated.products[0]?.variants).toEqual(before.variants);
});
```

Si `ProductPatch` no incluye `videoIds`, TypeScript falla aquí = FAIL esperado. Ajustar `referenceStore` al nombre real del fixture del archivo (no inventar fixture nuevo).

- [ ] **Step 2: Run test to verify it fails**

Run: `corepack pnpm --filter @solara/core exec vitest run src/index.test.ts -t "videoIds"`
Expected: FAIL tipo `videoIds does not exist` o Zod.

- [ ] **Step 3: Write minimal implementation**

```ts
// packages/core/src/index.ts:31-46
type ProductPatch = Partial<
  Pick<
    Product,
    | "slug" | "title" | "description" | "richDescription" | "status" | "brand"
    | "categoryIds" | "collectionIds" | "tags" | "imageIds" | "videoIds" | "variants"
  >
>;
```

```ts
// normalizeImportedProductReferences — agregar sin tocar lógica imagen:
const videoIds = new Set(project.videos.map((video) => video.id));
return products.map((product) => ({
  ...product,
  categoryIds: product.categoryIds.filter((id) => categoryIds.has(id)),
  collectionIds: product.collectionIds.filter((id) => collectionIds.has(id)),
  imageIds: product.imageIds.filter((id) => assetIds.has(id)),
  videoIds: (product.videoIds ?? []).filter((id) => videoIds.has(id)),
  variants: product.variants.map((variant) =>
    variant.imageId === undefined || assetIds.has(variant.imageId)
      ? variant
      : { ...variant, imageId: undefined },
  ),
}));
```

CSV: replicar bloque `imagenes` sin cambiarlo:

```ts
// export row junto a imagenes:
videos: pipeValues(product.videoIds ?? []),
```

```ts
// import junto a imageIds:
const videoIds = parsePipeValues(record.videos).map((v) => v as Product["videoIds"][number]);
if (videoIds.some((id) => !videoIdSet.has(id))) {
  // mismo shape de error que imageIds, mensaje "Video desconocido: ..."
}
```

Crear `videoIdSet` desde `project.videos` donde ya existe `assetIds` set. Si `record.videos` es undefined (CSV viejo), `parsePipeValues(undefined)` debe dar `[]` como hace con columnas opcionales vecinas — verificar helper antes de asumir.

Mirror en `packages/core/src/project-mutations.ts`: agregar `"videoIds"` al `Pick` y al `updateProduct` si filtra campos.

- [ ] **Step 4: Run test to verify it passes**

Run: `corepack pnpm --filter @solara/core exec vitest run src/index.test.ts`
Expected: PASS total. Luego `tsc --noEmit` PASS. Verificar que tests CSV existentes siguen pasando sin modificar (back-compat: CSV viejo sin columna `videos` importa como `[]`).

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/index.ts packages/core/src/project-mutations.ts packages/core/src/index.test.ts
git commit -m "feat(core): soporta videoIds en patch, normalización y CSV"
```

---

### Task 3: Receta ultra-light 2MB/1MB + auditoría estricta

**Files:**
- Create: `packages/project-schema/src/product-video.ts`
- Test: `packages/project-schema/src/product-video.test.ts`
- Create: `apps/studio/src/features/builder/productVideoOptimize.ts`
- Test: `apps/studio/src/features/builder/productVideoOptimize.test.ts`
- Modify: `packages/exporter/src/audit.ts:244-285`

**Interfaces:**
- Consumes: `VideoAsset`, `buildVideoAsset`, `assertImageAssetOptimized`.
- Produces: constantes y `productVideoIds/productVideos/isProductVideoLightEnough/optimizeProductVideoSource` usados por Tasks 4-7. Cero deps nuevas.

Presupuesto bloqueado: ≤2 MB hard, ~1 MB ideal, ≤720p (540p si >8 s), ≤10 s recomendado, 15 s blando, 60 s hard global, ~800 kbps video + 64 kbps audio o mute. 1 MB ≈ 8 s a 1 Mbps.

- [ ] **Step 1: Write the failing test (helpers puros)**

```ts
// packages/project-schema/src/product-video.test.ts
import { describe, expect, test } from "vitest";
import { PRODUCT_VIDEO_MAX_BYTES, PRODUCT_VIDEO_MAX_COUNT, PRODUCT_VIDEO_TARGET_BYTES, isProductVideoLightEnough, productVideoIds } from "./product-video.js";

describe("product-video", () => {
  test("topes 2MB/1MB y máx 3", () => {
    expect(PRODUCT_VIDEO_MAX_COUNT).toBe(3);
    expect(PRODUCT_VIDEO_MAX_BYTES).toBe(2 * 1024 * 1024);
    expect(PRODUCT_VIDEO_TARGET_BYTES).toBe(1 * 1024 * 1024);
  });
  test("limita a 3 y filtra inexistentes", () => {
    const product = { videoIds: ["v-1", "v-2", "v-3", "v-4"] } as never;
    const project = { videos: [{ id: "v-1" }, { id: "v-2" }] } as never;
    expect(productVideoIds(product, project)).toEqual(["v-1", "v-2"]);
  });
  test("liviano sólo si ≤2MB y ≤720p", () => {
    expect(isProductVideoLightEnough({ size: 1_000_000, width: 640, height: 360 })).toBe(true);
    expect(isProductVideoLightEnough({ size: 5_000_000, width: 640, height: 360 })).toBe(false);
    expect(isProductVideoLightEnough({ size: 1_000_000, width: 1920, height: 1080 })).toBe(false);
  });
});
```

```ts
// apps/studio/src/features/builder/productVideoOptimize.test.ts
import { describe, expect, test } from "vitest";

describe("optimizeProductVideoSource", () => {
  test("conserva original si ya es liviano", async () => {
    const { optimizeProductVideoSource } = await import("./productVideoOptimize.js");
    const file = { size: 900_000 } as File;
    const out = await optimizeProductVideoSource(file, { width: 640, height: 360, duration: 7 });
    expect(out).toBeUndefined();
  });
  test("falla a fallback si MediaRecorder ausente", async () => {
    const { optimizeProductVideoSource } = await import("./productVideoOptimize.js");
    const file = { size: 20_000_000 } as File;
    const out = await optimizeProductVideoSource(
      file,
      { width: 1920, height: 1080, duration: 12 },
      { mediaRecorderAvailable: false } as never,
    );
    expect(out).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `corepack pnpm --filter @solara/project-schema exec vitest run src/product-video.test.ts`
Expected: FAIL `Cannot find module ./product-video`. Y `corepack pnpm --filter @solara/studio exec vitest run src/features/builder/productVideoOptimize.test.ts` FAIL igual.

- [ ] **Step 3: Write minimal implementation**

```ts
// packages/project-schema/src/product-video.ts
import type { Product, StoreProjectV1, VideoAsset } from "./index.js";

export const PRODUCT_VIDEO_MAX_COUNT = 3;
export const PRODUCT_VIDEO_MAX_BYTES = 2 * 1024 * 1024;
export const PRODUCT_VIDEO_TARGET_BYTES = 1 * 1024 * 1024;
export const PRODUCT_VIDEO_MAX_DIMENSION = 720;
export const PRODUCT_VIDEO_LONG_DIMENSION = 540;
export const PRODUCT_VIDEO_RECOMMENDED_SECONDS = 10;
export const PRODUCT_VIDEO_SOFT_MAX_SECONDS = 15;

export function productVideoIds(product: Pick<Product, "videoIds">, project: Pick<StoreProjectV1, "videos">): string[] {
  const known = new Set(project.videos.map((v) => v.id));
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of product.videoIds ?? []) {
    if (!known.has(id) || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
    if (out.length >= PRODUCT_VIDEO_MAX_COUNT) break;
  }
  return out;
}

export function productVideos(product: Pick<Product, "videoIds">, project: Pick<StoreProjectV1, "videos">): VideoAsset[] {
  const byId = new Map(project.videos.map((v) => [v.id, v]));
  return productVideoIds(product, project).map((id) => byId.get(id)).filter((v): v is VideoAsset => Boolean(v));
}

export function isProductVideoLightEnough(input: { size: number; width: number; height: number }): boolean {
  return (
    input.size <= PRODUCT_VIDEO_MAX_BYTES &&
    Math.max(input.width, input.height) <= 1280 &&
    Math.min(input.width, input.height) <= PRODUCT_VIDEO_MAX_DIMENSION
  );
}

export function productVideoTarget(input: { duration: number }): { maxSide: number; bitsPerSecond: number } {
  if (input.duration > 8) return { maxSide: 540, bitsPerSecond: 600_000 };
  return { maxSide: 720, bitsPerSecond: 800_000 };
}
```

```ts
// apps/studio/src/features/builder/productVideoOptimize.ts
import { isProductVideoLightEnough, productVideoTarget } from "@solara/project-schema/product-video.js";

export const PRODUCT_VIDEO_TARGET_FPS = 30;
export const PRODUCT_VIDEO_TARGET_AUDIO_BITS_PER_SECOND = 64_000;

export interface OptimizedVideoSource { blob: Blob; mimeType: "video/mp4" | "video/webm"; width: number; height: number; }

export async function optimizeProductVideoSource(
  file: File,
  metadata: { width: number; height: number; duration: number },
  deps: { mediaRecorderAvailable?: boolean; pickMimeType?: (c: string[]) => string | undefined } = {},
): Promise<OptimizedVideoSource | undefined> {
  if (isProductVideoLightEnough({ size: file.size, width: metadata.width, height: metadata.height })) return undefined;
  if (deps.mediaRecorderAvailable === false) return undefined;
  if (typeof window === "undefined" || typeof MediaRecorder === "undefined") return undefined;
  const target = productVideoTarget({ duration: metadata.duration });
  void target;
  // Implementación real en esta tarea: canvas downscale a target.maxSide + captureStream(30)
  // + MediaRecorder(bitsPerSecond: target.bitsPerSecond), grabación realtime acotada a duración,
  // más pista audio original si existe; si resultado >= original o error, return undefined.
  // Mantener función pura e inyectable; no usar ffmpeg ni WebCodecs directos.
  return undefined;
}
```

Nota honesta anti-rotura: el esqueleto devuelve `undefined` (conservar original) hasta completar la grabación realtime; los tests de esta tarea verifican el contrato fallback-first. La grabación completa se implementa dentro de esta misma tarea antes del commit (no dejar `throw`). Si MediaRecorder no da menor peso, conservar original.

Auditoría `packages/exporter/src/audit.ts` — mantener reglas globales y agregar tras el bloque `project.videos.forEach`:

```ts
const productVideoIdSet = new Set(project.products.flatMap((p) => p.videoIds ?? []));
project.videos.forEach((video, videoIndex) => {
  if (!productVideoIdSet.has(video.id)) return;
  const bytes = dataUrlBytes(video.source)?.byteLength;
  if (bytes && bytes > 2 * 1024 * 1024) {
    issues.push({ code: "product-video.size", severity: "critical", message: `${video.name} supera 2 MB en producto (ideal 1 MB).`, path: `videos.${videoIndex}.source`, area: "content", fixTarget: "assets" });
  } else if (bytes && bytes > 1 * 1024 * 1024) {
    issues.push({ code: "product-video.size", severity: "warning", message: `${video.name} supera 1 MB ideal en producto.`, path: `videos.${videoIndex}.source`, area: "content", fixTarget: "assets" });
  }
  if (Math.min(video.width, video.height) > 720) {
    issues.push({ code: "product-video.dimensions", severity: "warning", message: `${video.name} supera 720p en producto.`, path: `videos.${videoIndex}.source`, area: "content", fixTarget: "assets" });
  }
});
```

No cambiar `video.poster/size/duration` globales.

- [ ] **Step 4: Run test to verify it passes**

Run: `corepack pnpm --filter @solara/project-schema exec vitest run src/product-video.test.ts`
Expected: PASS. Luego `corepack pnpm --filter @solara/studio exec vitest run src/features/builder/productVideoOptimize.test.ts` PASS. Luego `tsc --noEmit` en ambos PASS. Luego `corepack pnpm --filter @solara/exporter exec vitest run src/audit.test.ts` (o archivo audit vecino) PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/project-schema/src/product-video.ts packages/project-schema/src/product-video.test.ts apps/studio/src/features/builder/productVideoOptimize.ts apps/studio/src/features/builder/productVideoOptimize.test.ts packages/exporter/src/audit.ts
git commit -m "feat(video): receta ultra-light 2MB/1MB con fallback seguro y auditoría"
```

---

### Task 4: Render galería mixta (moderno + legacy paridad, no-JS, a11y)

**Files:**
- Modify: `packages/modules/src/catalog-modern.ts:1375-1425`
- Modify: `packages/modules/src/definitions.ts:1067-1098`
- Modify: `packages/modules/src/styles.ts`
- Test: `packages/modules/src/index.test.ts`

**Interfaces:**
- Consumes: `productVideos` Task 3, `renderImage/assetUrl/safeAssetUrl/escape*` existentes.
- Produces: `<figure data-gallery-media-id data-media-kind>` + `<video controls preload="none" poster width height>`; sin videos el HTML es idéntico al anterior más `data-gallery-media-id` espejo en imágenes (compatible con selector viejo y nuevo).

Anti-rotura: no cambiar `settingsSchema` de los módulos; no agregar bindings canvas de video; mantener `data-gallery-image-id` original en imágenes y añadir `data-gallery-media-id` espejo (runtime viejo sigue funcionando, runtime nuevo usa el espejo).

- [ ] **Step 1: Write the failing test**

```ts
// packages/modules/src/index.test.ts — nuevo, sin tocar existentes
it("galería mezcla imágenes y videos con poster/controls y sin autoplay", () => {
  const project = structuredClone(catalogModernStore);
  const video = { kind: "video", id: "video-prod-001", name: "Demo", alt: "Demo video", mimeType: "video/mp4", source: "data:video/mp4;base64,AAAA", posterAssetId: project.assets[0]!.id, width: 640, height: 360, durationSeconds: 8, hash: "video-prod-hash-001" } as unknown as (typeof project.videos)[number];
  project.videos = [video];
  const product = { ...project.products.find((p) => p.status === "active")!, imageIds: [project.assets[0]!.id], videoIds: [video.id] };
  const html = String(renderSections(project, [{ id: "sec-video", slot: "product", moduleId: "catalog-product-detail", enabled: true, settings: {}, motion: { preset: "none", intensity: 0, direction: "up", distance: 0, duration: 0, delay: 0, stagger: 0, easing: "linear", entryPoint: 0, once: true } }], { pageType: "product", product } as never));
  expect(html).toContain('data-gallery-media-id="video-prod-001"');
  expect(html).toContain("<video");
  expect(html).toContain("controls");
  expect(html).toContain('preload="none"');
  expect(html).not.toContain("autoplay");
});

it("sin videos la galería sigue igual (paridad)", () => {
  const project = structuredClone(catalogModernStore);
  project.videos = [];
  const product = { ...project.products.find((p) => p.status === "active")!, videoIds: [] };
  const html = String(renderSections(project, [{ id: "sec-video2", slot: "product", moduleId: "catalog-product-detail", enabled: true, settings: {}, motion: { preset: "none", intensity: 0, direction: "up", distance: 0, duration: 0, delay: 0, stagger: 0, easing: "linear", entryPoint: 0, once: true } }], { pageType: "product", product } as never));
  expect(html).not.toContain("<video");
  expect(html).toContain("data-gallery-image-id");
});
```

Ajustar `renderSections` al helper real del archivo.

- [ ] **Step 2: Run test to verify it fails**

Run: `corepack pnpm --filter @solara/modules exec vitest run src/index.test.ts -t "galería"`
Expected: FAIL primer test (no hay `data-gallery-media-id` video).

- [ ] **Step 3: Write minimal implementation**

En `catalog-modern.ts` (y espejo en `definitions.ts` con clases `solara-*`):

```ts
import { productVideos } from "@solara/project-schema/product-video.js";

const galleryAssetIds = [...product.variants.map((v) => v.imageId), ...product.imageIds].filter(
  (id, i, all): id is AssetId => Boolean(id) && all.indexOf(id) === i,
);
const galleryVideos = productVideos(product, context.project);
const hasMedia = galleryAssetIds.length > 0 || galleryVideos.length > 0;
const galleryFigures = [
  ...galleryAssetIds.map((assetId, index) => {
    const image = renderImage(context.project, assetId, {
      className: "catalog-product-gallery-image",
      loading: index === 0 && galleryVideos.length === 0 ? "eager" : "lazy",
      fetchPriority: index === 0 && galleryVideos.length === 0 ? "high" : "auto",
      sizes: context.project.commerceTemplates.designFamily === "catalog-modern-v2"
        ? "(max-width: 767px) 92vw, (max-width: 1199px) 94vw, 60vw"
        : "(max-width: 767px) 92vw, 54vw",
      fallbackAlt: product.title,
    });
    const imageWithAlt = image.replace("<img", `<img${canvasEntityAttributes(canvasContext(context), "asset-alt", "asset", assetId, "alt")}`);
    const imageBinding = canvasEntityAttributes(canvasContext(context), "product-image", "product", product.id, "imageIds", "image");
    return `<figure data-gallery-image-id="${escapeAttribute(assetId)}" data-gallery-media-id="${escapeAttribute(assetId)}" data-media-kind="image" data-gallery-active="${String(index === 0)}"${imageBinding}>${imageWithAlt}</figure>`;
  }),
  ...galleryVideos.map((video, vi) => {
    const posterUrl = video.posterAssetId ? assetUrl(context.project, video.posterAssetId, "") : "";
    const isActive = galleryAssetIds.length === 0 && vi === 0;
    const caption = video.alt || video.name;
    const posterImg = renderImage(context.project, video.posterAssetId, { className: "catalog-product-gallery-image", loading: "lazy", sizes: "(max-width: 767px) 92vw, 54vw", fallbackAlt: `${product.title}, video ${vi + 1}` });
    return `<figure data-gallery-media-id="${escapeAttribute(video.id)}" data-media-kind="video" data-gallery-active="${String(isActive)}"><video class="catalog-product-gallery-video" width="${video.width}" height="${video.height}"${posterUrl ? ` poster="${escapeAttribute(posterUrl)}"` : ""} preload="none" playsinline controls aria-label="${escapeAttribute(caption)}"><source src="${escapeAttribute(safeAssetUrl(video.source, ""))}" type="${escapeAttribute(video.mimeType)}">${posterImg}<span>${escapeHtml(caption)}</span></video></figure>`;
  }),
].join("");
const galleryThumbs = [
  ...galleryAssetIds.map((assetId, index) => {
    const image = renderImage(context.project, assetId, { className: "catalog-product-gallery-thumb", loading: "lazy", sizes: "5rem", fallbackAlt: `${product.title}, imagen ${index + 1}` });
    return `<button type="button" data-gallery-thumb="${escapeAttribute(assetId)}" aria-label="${escapeAttribute(copy.export.viewImage.replace("{index}", String(index + 1)))}" aria-current="${String(index === 0)}">${image}</button>`;
  }),
  ...galleryVideos.map((video, vi) => {
    const thumb = renderImage(context.project, video.posterAssetId, { className: "catalog-product-gallery-thumb", loading: "lazy", sizes: "5rem", fallbackAlt: `${product.title}, video ${vi + 1}` });
    return `<button type="button" data-gallery-thumb="${escapeAttribute(video.id)}" data-media-kind="video" aria-label="${escapeAttribute(`Ver video ${vi + 1}`)}" aria-current="${String(galleryAssetIds.length === 0 && vi === 0)}">${thumb}<span class="catalog-product-thumb-badge" aria-hidden="true">▶ ${Math.round(video.durationSeconds)}s</span></button>`;
  }),
].join("");
const gallery = hasMedia
  ? `<div class="catalog-product-gallery" data-product-gallery><div class="catalog-product-gallery-main">${galleryFigures}</div><div class="catalog-product-gallery-thumbs">${galleryThumbs}</div></div>`
  : `<p class="catalog-empty">${escapeHtml(copy.empty.products)}</p>`;
```

Mantener `canvasEntityAttributes`/`instrumentImage` de imágenes. No agregar settings nuevos. Repetir en `definitions.ts` cambiando prefijos `catalog-*` por `solara-*`.

CSS `styles.ts` junto a galería existente:

```css
[data-solara-store].catalog-modern .catalog-product-gallery-video { width: 100%; height: auto; aspect-ratio: 1 / 1.08; object-fit: cover; background: var(--catalog-surface); }
[data-solara-store].catalog-modern .catalog-product-gallery-thumbs button { position: relative; }
[data-solara-store].catalog-modern .catalog-product-thumb-badge { position: absolute; right: 4px; bottom: 4px; font-size: 11px; padding: 2px 6px; border-radius: 999px; background: rgba(0,0,0,.72); color: #fff; }
```

Y espejo `.solara-product-gallery-video` para legacy. No cambiar CSS hero video.

Mobile fix (≤767px, todas las tiendas — v1, v2, legacy): stage mínimo 1:1 y adaptable a retrato sin recorte. Causa: `aspect-ratio:1/1.08` + `cover` y en v2 mobile `max-height:300px` + `4/3` + `cover` recortan 9:16. Agregar al final del bloque mobile existente (no tocar desktop):

```css
@media (max-width: 767px) {
  [data-solara-store].catalog-modern .catalog-product-gallery-main,
  .cm.v2 .catalog-product-gallery-main,
  [data-solara-module="product-detail"] .solara-product-gallery-main {
    aspect-ratio: auto;
    max-height: none;
    overflow: hidden;
  }
  [data-solara-store].catalog-modern .catalog-product-gallery-main figure,
  .cm.v2 .catalog-product-gallery-main figure,
  [data-solara-module="product-detail"] .solara-product-gallery-main figure {
    aspect-ratio: auto;
    min-height: calc(100vw - 2rem);
    max-height: min(178vw, 85vh);
    display: none;
    align-items: center;
    justify-content: center;
    margin: 0;
    background: var(--catalog-surface);
  }
  [data-solara-store].catalog-modern .catalog-product-gallery-main figure[data-gallery-active="true"],
  .cm.v2 .catalog-product-gallery-main figure[data-gallery-active="true"],
  [data-solara-module="product-detail"] .solara-product-gallery-main figure[data-gallery-active="true"] {
    display: flex;
  }
  [data-solara-store].catalog-modern .catalog-product-gallery-image,
  [data-solara-store].catalog-modern .catalog-product-gallery-video,
  .cm.v2 .catalog-product-gallery-image,
  .cm.v2 .catalog-product-gallery-video,
  [data-solara-module="product-detail"] .solara-product-gallery-image,
  [data-solara-module="product-detail"] video {
    width: 100%;
    height: 100%;
    max-height: min(178vw, 85vh);
    aspect-ratio: auto;
    object-fit: contain;
    object-position: center;
  }
}
```

Notas anti-rotura: `min(178vw,85vh)` cubre 9:16 a ancho completo (177.7vw) sin pasar el viewport; `contain` + fondo surface evita recorte con letterbox mínimo en 1:1; desktop y thumbs sin cambios; v2 `max-height:300px` queda anulado sólo en mobile por especificidad + orden (poner después). Verificar en 390px con imagen 1:1 (ocupa cuadrado), 4:5 y 9:16 (altura crece, sin corte) e idéntico para `<video>`.

- [ ] **Step 4: Run test to verify it passes**

Run: `corepack pnpm --filter @solara/modules exec vitest run src/index.test.ts`
Expected: PASS total. Luego `tsc --noEmit` PASS. Verificar responsive/teclado/no-JS manualmente en preview si se toca CSS.

- [ ] **Step 5: Commit**

```bash
git add packages/modules/src/catalog-modern.ts packages/modules/src/definitions.ts packages/modules/src/styles.ts packages/modules/src/index.test.ts
git commit -m "feat(modules): galería mixta con videos y paridad sin videos"
```

---

### Task 5: Exporter — medios, `og:video`, JSON-LD aditivo

**Files:**
- Modify: `packages/exporter/src/index.ts:963-970,1520-1565,1748`
- Modify: `packages/exporter/src/structured-data.ts:216-310`
- Test: `packages/exporter/src/structured-data.test.ts`, `packages/exporter/src/index.test.ts`

**Interfaces:**
- Consumes: `productVideos` Task 3, `videoFor/videoUrl` (`assets.ts:603-621`).
- Produces: `usedVideoIds` con producto; head con `og:video` sólo si hay video; JSON-LD con `video` sólo si hay videos. Sin videos: salida idéntica.

- [ ] **Step 1: Write the failing test**

```ts
// structured-data.test.ts — nuevo
test("producto con video expone VideoObject y sin video no", () => {
  const store = structuredClone(catalogModernStore);
  const product = store.products.find((p) => p.status === "active")!;
  product.videoIds = [];
  store.videos = [];
  const snap0 = buildCommerceSnapshot(store);
  expect(JSON.stringify(productStructuredData(store, product, snap0))).not.toContain("VideoObject");
  const video = { kind: "video", id: "video-seo-001", name: "Demo", alt: "Demo", mimeType: "video/mp4", source: "/assets/demo.mp4", posterAssetId: store.assets[0]!.id, width: 640, height: 360, durationSeconds: 8, hash: "seo-video-hash" } as unknown as (typeof store.videos)[number];
  store.videos = [video];
  product.videoIds = [video.id];
  const snap1 = buildCommerceSnapshot(store);
  expect(JSON.stringify(productStructuredData(store, product, snap1))).toContain("VideoObject");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `corepack pnpm --filter @solara/exporter exec vitest run src/structured-data.test.ts -t "VideoObject"`
Expected: FAIL (no emite VideoObject).

- [ ] **Step 3: Write minimal implementation**

```ts
// publicMediaUsage — dentro forEach productos activos:
product.imageIds.forEach(addValue);
(product.videoIds ?? []).forEach(addValue);
```

```ts
// structured-data.ts helper (no exportar si no hace falta):
function productVideoNodes(project: StoreProjectV1, product: Product): unknown[] {
  const videos = (product.videoIds ?? [])
    .map((id) => project.videos.find((v) => v.id === id))
    .filter((v): v is VideoAsset => Boolean(v))
    .slice(0, 3);
  return videos.map((video) => ({
    "@type": "VideoObject",
    name: `${product.title} — ${video.name}`,
    description: product.description || video.alt || video.name,
    ...(video.posterAssetId && imageUrl(project, video.posterAssetId)
      ? { thumbnailUrl: absoluteResourceUrl(project, imageUrl(project, video.posterAssetId) as string) }
      : {}),
    contentUrl: absoluteResourceUrl(project, videoUrl(project, video.id) ?? video.source),
    duration: `PT${Math.max(1, Math.round(video.durationSeconds))}S`,
    uploadDate: product.updatedAt,
  }));
}
// rama 1 variante: ...(videoNodes.length ? { video: videoNodes } : {})
// rama ProductGroup: igual. Calcular videoNodes una vez arriba.
```

Imports: `imageUrl, videoUrl` de `./assets.js`, tipo `VideoAsset`. No cambiar `image` Merchant.

```ts
// index.ts head — tras pageVideo hero:
const productVideo = page.pageType === "product" && pageContext.product
  ? videoFor(project, (pageContext.product.videoIds ?? [])[0])
  : undefined;
const effectiveVideo = pageVideo ?? productVideo;
// reusar effectiveVideo en el meta og:video existente, no duplicar tag.
```

Si `pageContext.product` no está en scope del head, resolver por slug desde `canonicalPath` (`productos/{slug}/`). No cambiar `preloadImage` (sigue imagen para LCP).

- [ ] **Step 4: Run test to verify it passes**

Run: `corepack pnpm --filter @solara/exporter exec vitest run src/structured-data.test.ts src/index.test.ts`
Expected: PASS. Luego `tsc --noEmit` PASS. Verificar que `parity.test.ts` y `seo` tests siguen verdes (paridad sin videos).

- [ ] **Step 5: Commit**

```bash
git add packages/exporter/src/index.ts packages/exporter/src/structured-data.ts packages/exporter/src/structured-data.test.ts
git commit -m "feat(exporter): videos producto en medios, OG y JSON-LD aditivo"
```

---

### Task 6: Runtime — selector generalizado, pausa, budgets

**Files:**
- Create: `packages/storefront-runtime/src/gallery-media.ts`
- Modify: `packages/storefront-runtime/src/index.ts:1104-1120,1122-1155,1273-1276`
- Test: `packages/storefront-runtime/src/gallery-video.test.ts`

**Interfaces:**
- Consumes: HTML Task 4.
- Produces: `selectGalleryMedia(root, id)`; wrapper compat `selectGalleryImage`; budgets intactos.

- [ ] **Step 1: Write the failing test**

```ts
// gallery-video.test.ts
import { describe, expect, test } from "vitest";

describe("galería con video", () => {
  test("cambia a video y pausa el oculto, mantiene aria-current", async () => {
    document.body.innerHTML = `<div data-product><figure data-gallery-image-id="img-1" data-gallery-media-id="img-1" data-gallery-active="true"></figure><figure data-gallery-media-id="vid-1" data-media-kind="video" data-gallery-active="false"><video></video></figure><button data-gallery-thumb="img-1" aria-current="true"></button><button data-gallery-thumb="vid-1" aria-current="false"></button></div>`;
    const { selectGalleryMedia } = await import("./gallery-media.js");
    selectGalleryMedia(document.querySelector("[data-product]") as HTMLElement, "vid-1");
    expect(document.querySelector('[data-gallery-media-id="vid-1"]')?.getAttribute("data-gallery-active")).toBe("true");
    expect(document.querySelector('[data-gallery-thumb="vid-1"]')?.getAttribute("aria-current")).toBe("true");
  });
  test("id desconocido cae al primero sin romper", async () => {
    const { selectGalleryMedia } = await import("./gallery-media.js");
    document.body.innerHTML = `<div data-product><figure data-gallery-media-id="img-1" data-gallery-active="false"></figure></div>`;
    selectGalleryMedia(document.querySelector("[data-product]") as HTMLElement, "nope");
    expect(document.querySelector('[data-gallery-media-id="img-1"]')?.getAttribute("data-gallery-active")).toBe("true");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `corepack pnpm --filter @solara/storefront-runtime exec vitest run src/gallery-video.test.ts`
Expected: FAIL `Cannot find module ./gallery-media`.

- [ ] **Step 3: Write minimal implementation**

```ts
// gallery-media.ts — puro, sin estado global
export function selectGalleryMedia(productRoot: HTMLElement, mediaId?: string): void {
  const figures = Array.from(productRoot.querySelectorAll<HTMLElement>("[data-gallery-media-id], [data-gallery-image-id]"));
  if (figures.length === 0) return;
  const target = figures.find((f) => f.dataset.galleryMediaId === mediaId || f.dataset.galleryImageId === mediaId) ?? figures[0]!;
  figures.forEach((f) => {
    const active = f === target;
    f.dataset.galleryActive = String(active);
    if (!active) f.querySelectorAll("video").forEach((v) => { try { v.pause(); } catch { /* noop */ } });
  });
  productRoot.querySelectorAll<HTMLElement>("[data-gallery-thumb]").forEach((t) => {
    t.setAttribute("aria-current", String(t.dataset.galleryThumb === target.dataset.galleryMediaId || t.dataset.galleryThumb === target.dataset.galleryImageId));
  });
}
```

```ts
// index.ts
import { selectGalleryMedia } from "./gallery-media.js";
const selectGalleryImage = (root: HTMLElement, id?: string): void => selectGalleryMedia(root, id);
```

No tocar handler thumbs (ya pasa `dataset.galleryThumb`), ni `syncVariant` (sigue imagen), ni hero video `1951-1969`. Import estático para que entre al bundle serializado.

- [ ] **Step 4: Run test to verify it passes**

Run: `corepack pnpm --filter @solara/storefront-runtime exec vitest run src/gallery-video.test.ts`
Expected: PASS. Luego `tsc --noEmit` PASS. Budgets se verifican en Task 9 (delta esperado <1 KiB).

- [ ] **Step 5: Commit**

```bash
git add packages/storefront-runtime/src/gallery-media.ts packages/storefront-runtime/src/gallery-video.test.ts packages/storefront-runtime/src/index.ts
git commit -m "feat(runtime): galería soporta video con pausa y fallback"
```

---

### Task 7: Studio — editor con upload ultra-light y validación

**Files:**
- Modify: `apps/studio/src/features/catalog/ProductEditor.tsx`, `apps/studio/src/features/catalog/product/productEditorModel.ts`, `apps/studio/src/features/Catalog.tsx:1390-1435`
- Test: `apps/studio/src/features/catalog/product/productEditorModel.test.ts`, `apps/studio/src/features/builder/productVideoOptimize.test.ts` (ya creado)

**Interfaces:**
- Consumes: `buildVideoAsset`, `optimizeProductVideoSource`, `validateProductVideos`, `Product["videoIds"]`.
- Produces: draft con `videoIds`; `Catalog.tsx` persiste `videoIds` + agrega `video`/`poster` al proyecto en una sola actualización.

- [ ] **Step 1: Write the failing test**

```ts
// productEditorModel.test.ts — nuevo
import { describe, expect, test } from "vitest";
import { validateProductVideos } from "./productEditorModel.js";

describe("validateProductVideos", () => {
  test("rechaza más de 3", () => {
    expect(validateProductVideos(["a", "b", "c", "d"])).toMatch(/máximo 3/i);
    expect(validateProductVideos(["a", "b"])).toBeUndefined();
    expect(validateProductVideos(undefined)).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `corepack pnpm --filter @solara/studio exec vitest run src/features/catalog/product/productEditorModel.test.ts -t "validateProductVideos"`
Expected: FAIL `not exported`.

- [ ] **Step 3: Write minimal implementation**

```ts
// productEditorModel.ts
export function validateProductVideos(videoIds: readonly string[] | undefined): string | undefined {
  if ((videoIds ?? []).length > 3) return "El producto admite como máximo 3 videos.";
  return undefined;
}
```

```tsx
// ProductEditor.tsx props:
assets: ImageAsset[]; videos: VideoAsset[]; onVideoUpload?(video: VideoAsset, poster?: ImageAsset): void;
```

Fieldset: `<legend>Imágenes y videos</legend>` (renombre sólo leyenda). Tras picker imágenes, agregar picker videos con checkbox `draft.videoIds`, `disabled` si llega a 3, preview `<video preload="metadata" muted playsInline width={84}>`, texto `{nombre} · {Ns} · {MB} aprox` + hint `MP4/WebM, ideal 1 MB / máx 2 MB, ≤10 s, 720p`.

Upload:

```tsx
<input type="file" accept="video/mp4,video/webm" onChange={async (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  try {
    const { readVideoMetadata } = await import("../builder/videoUpload.js");
    const { optimizeProductVideoSource } = await import("../builder/productVideoOptimize.js");
    const { buildVideoAsset } = await import("../builder/videoUpload.js");
    const metadata = await readVideoMetadata(file);
    const optimized = await optimizeProductVideoSource(file, metadata);
    const sourceFile = optimized ? new File([optimized.blob], file.name, { type: optimized.mimeType }) : file;
    const built = await buildVideoAsset(sourceFile);
    setDraft((c) => ({ ...c, videoIds: [...(c.videoIds ?? []), built.video.id].slice(0, 3) }));
    onVideoUpload?.(built.video, built.posterImage);
  } catch (err) { setError(err instanceof Error ? err.message : "No se pudo subir el video."); }
  e.target.value = "";
}} />
```

Mostrar `validateProductVideos(draft.videoIds)` con `InlineError`. En `save()`, `ProductSchema.parse` incluye `videoIds`; inicializar draft con `videoIds: product.videoIds ?? []` para viejos. Activación sigue exigiendo imagen (no cambiar `productActivationRequirements` salvo para ignorar videos).

`Catalog.tsx`: pasar `videos={project.videos}`, `onVideoUpload` que agrega video+poster en una sola `onChange` (evita estado intermedio inválido), y en `onSave` incluir `videoIds: savedProduct.videoIds ?? []` en `product.create` y `product.update changes`.

- [ ] **Step 4: Run test to verify it passes**

Run: `corepack pnpm --filter @solara/studio exec vitest run src/features/catalog/product/productEditorModel.test.ts`
Expected: PASS. Luego `tsc --noEmit` PASS. Probar manual: subir MP4 20MB/1080p → debe recomprimir o avisar peso; subir 800KB/640px → conserva.

- [ ] **Step 5: Commit**

```bash
git add apps/studio/src/features/catalog/ProductEditor.tsx apps/studio/src/features/catalog/product/productEditorModel.ts apps/studio/src/features/catalog/product/productEditorModel.test.ts apps/studio/src/features/Catalog.tsx
git commit -m "feat(studio): editor producto con videos ultra-light"
```

---

### Task 8: Fixtures, docs y CHANGELOG (sin contaminar demo)

**Files:**
- Modify: `docs/DATA_MODEL.md`, `CHANGELOG.md`
- Verify only: fixtures globales (no modificar salvo tests locales)

**Interfaces:**
- Consumes: Tasks 1-7.
- Produces: documentación coherente con presupuesto 2MB/1MB.

- [ ] **Step 1: Actualizar DATA_MODEL (failing = doc desactualizada)**

No hay test que falle; verificar con grep que `videoIds` no está documentado:

Run: `rg -n "videoIds" docs/DATA_MODEL.md`
Expected: sin matches (confirma que falta).

- [ ] **Step 2: Confirmar fixtures limpios**

Run: `rg -n "videoIds" packages/project-schema/src/catalog-modern-fixture.ts packages/project-schema/src/catalog-modern-template.ts packages/project-schema/src/fixture.ts`
Expected: sin matches o sólo `[]` — no agregar videos demo (la tienda limpia y `Predeterminado` no deben cambiar).

- [ ] **Step 3: Escribir docs**

```md
// docs/DATA_MODEL.md — en "Producto y variante", agregar:
- `Product.videoIds: AssetId[]` (default `[]`, máx 3) referencia `assets.videos`. Opcional, nunca requerido para activar.
- Galería: imágenes primero, videos después; `<video controls preload="none" playsinline poster width height>`, sin autoplay.
- Ultra-light: ≤2 MB hard, ~1 MB ideal, ≤720p (540p si >8 s), ≤10 s recomendado. Recompresión liviana canvas+MediaRecorder sólo si excede; poster WebP con receta imagen.

// CHANGELOG.md bajo [No publicado] ### Agregado:
- Videos opcionales en galería de producto (máx 3, ultra-light 2 MB/1 MB, `og:video` y `VideoObject`).
```

- [ ] **Step 4: Verificar**

Run: `git diff --check`
Expected: PASS, sin binarios ni `proyectos/`.

- [ ] **Step 5: Commit**

```bash
git add docs/DATA_MODEL.md CHANGELOG.md
git commit -m "docs: videos producto ultra-light en modelo y changelog"
```

---

### Task 9: E2E, budgets y gates de cierre (portón anti-rotura)

**Files:**
- Create: `tests/e2e/product-video.spec.ts`
- Verify: budgets, `check:micro/quick/full`, smoke/full, build/portable si aplica.

**Interfaces:**
- Consumes: Tasks 1-8.
- Produces: entrega cerrable.

- [ ] **Step 1: Write the failing E2E**

```ts
// tests/e2e/product-video.spec.ts
import { expect, test } from "@playwright/test";

test("producto con video: galería mixta con y sin JS", async ({ page }) => {
  // Copiar setup del spec quick más cercano que exporte catalogModernStore y sirva productos/.
  // Fixture local en-test: 1 imagen 1:1 + 1 video 9:16 640x1138 8s con poster; product.videoIds=[video].
  // 1) Con JS: click [data-gallery-thumb="{videoId}"] → figure video data-gallery-active="true", aria-current true.
  // 2) Sin JS (context javaScriptEnabled:false): <video controls poster> visible, primera media active.
  // 3) Mobile 390px: stage ≥1:1 (boundingBox width ≈ height para 1:1) y video 9:16 visible completo
  //    (boundingBox height > width, sin recorte: verificar video boundingBox dentro de figure).
  expect(true).toBe(true); // reemplazar por asserts reales antes de pasar a Step 3
});
```

Concretar copiando imports/setup del spec existente (no inventar servidor nuevo). Debe fallar primero por selector ausente.

- [ ] **Step 2: Run E2E to verify it fails**

Run: `corepack pnpm test:e2e:smoke -- product-video`
Expected: FAIL (selector `data-gallery-media-id` o fixture).

- [ ] **Step 3: Completar spec + ajustes acotados**

Completar asserts reales. Si revela bug Tasks 4-6, arreglar allí en commit separado acotado (no meter fix grande aquí). Verificar: responsive 390/768/1024/1440, mobile 390 stage 1:1 mínimo y 9:16 sin corte (imagen y video), teclado (Tab+Enter en thumb video), reduced-motion (sin autoplay), no-JS útil.

- [ ] **Step 4: Gates proporcionales (orden exacto AGENTS.md)**

```bash
git diff --check
corepack pnpm check:repository
corepack pnpm check:micro
corepack pnpm test:e2e:smoke
corepack pnpm check:quick
corepack pnpm test:e2e:smoke:full
corepack pnpm exec vitest run scripts/storefront-runtime-budget.test.ts scripts/public-storefront-budget.test.ts
```

Expected: todo PASS; runtime JS ≤80 KiB, CSS ≤32 KiB gzip; delta runtime por este feature <1 KiB. Cierre formal: `corepack pnpm check` + `corepack pnpm test:e2e` full. Como toca Studio/shell: `corepack pnpm build`, `desktop:build`, `desktop:package`, `portable:smoke` al cerrar (artefactos no se commitean).

- [ ] **Step 5: Commit**

```bash
git add tests/e2e/product-video.spec.ts
git commit -m "test(e2e): galería producto con video con y sin JS"
```

Checklist final antes de push a `origin/main`: `git status` limpio salvo intención, `git diff --check`, `check:repository`, sin secretos/builds/reportes/`proyectos/`/runtime, CHANGELOG actualizado, docs actualizadas, ejecutables reconstruidos si se tocó app/shell.

---

## Self-Review

- **Spec coverage:** videos opcionales donde hay imágenes ✓ T1/T4/T6/T7; ultra-light 2MB/1MB como imágenes ✓ T3 (recompresión liviana + poster receta imagen + preload none + auditoría); mobile 1:1 mínimo adaptable 9:16 sin recorte en v1/v2/legacy ✓ T4 CSS + T9 E2E 390px; sin romper ✓ T0 baseline, T1 back-compat test, T4 paridad sin videos, T5 aditivo, T6 fallback, T8 fixtures limpios, T9 portón.
- **Placeholder scan:** sin `TBD/TODO/fill later`; cada validación con código+mensaje; cada comando con expected; tipos y nombres consistentes (`videoIds`, `productVideoIds/productVideos/isProductVideoLightEnough/productVideoTarget`, `optimizeProductVideoSource`, `selectGalleryMedia`, `data-gallery-media-id`, `product-video.size/dimensions`).
- **Type consistency:** `AssetId[]` schema → `ProductPatch` → normalize → helpers → `data-gallery-media-id="{videoId}"` → `selectGalleryMedia(root,id)` → `publicMediaUsage` → `og:video`/`VideoObject`. `?? []` en todos los bordes viejos.
- **Riesgos cubiertos:** MediaRecorder ausente → fallback original; resultado más pesado → original; video huérfano → filtrado + Zod; CSV viejo sin columna → `[]`; fixtures/demo intactos; budgets verificados; hero untouched.

## Follow-ups (no parte del plan)

- Transcode pesado 720p dual-codec, HLS, `ffmpeg.wasm`, WebCodecs offline.
- Reorder mixto drag-and-drop.
- `video-sitemap.xml` por producto, `Merchant video_link`.
