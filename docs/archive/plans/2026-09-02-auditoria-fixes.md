# Plan: Fixes de Auditoría RM Descartables (docs/AUDITORIA.md 100%)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Resolver todos los hallazgos de `docs/AUDITORIA.md` (auditorías #1 y #2) en el fork/exporter, con verificación medible y sin romper los flujos del repo.

**Architecture:** Todos los fixes estructurales viven en `packages/exporter`, `packages/storefront-runtime`, `packages/modules`, `packages/module-sdk`, `packages/site-optimizer`, `apps/studio` y `packages/agent-control`. Preview y sitio público comparten renderer, así que no hay divergencia posible. Los datos de la tienda real se migran automáticamente al abrir la tienda (predicado de optimización extendido). Checkpoint 1 (T1–T6) es deployable sin tocar datos; Checkpoint 2 (T7–T11) incluye migración de imágenes.

**Tech Stack:** TypeScript estricto, Vitest, strings-TS para CSS/JS públicos, `fflate` para PNG con paleta, Playwright para e2e.

## Global Constraints

- `StoreProjectV2Schema` es autoridad; `schemaVersion` queda en `2`. NINGÚN fix cambia el schema Zod ni migraciones. El campo `project.whatsapp.includeSku` queda tolerado en schema pero IGNORADO por el runtime (deprecado, documentado).
- Dinero SIEMPRE en centavos enteros; sin floats.
- Preview y sitio público usan el mismo renderer (`@solara/module-sdk` + `@solara/exporter`); prohibido duplicar lógica de render.
- El runtime público es un string serializado; el budget se mide sobre el resultado serializado (`scripts/public-storefront-budget.test.ts`). Los cambios de runtime deben pasar el budget.
- Sin dependencias runtime nuevas (`fflate` ya existe).
- Tests primero (TDD), commits en español breves y descriptivos, 1+ commit por tarea.
- Gates por tarea: tests del paquete tocado; al cierre de cada checkpoint: `corepack pnpm check:quick` + `corepack pnpm test:e2e:smoke`.
- Assets/binarios generados, `proyectos/`, `.solara-runtime/`, `.release/` nunca al commit.
- Umbrales firmados por el dueño: home desktop ≤700 KB, home móvil ≤500 KB, LCP categorías móvil ≤2,5 s, CLS buscar ≤0,02, URL WhatsApp ≤4.000 chars, deploy ≤24 MB, 0 errores consola con CSP real.
- Decisiones del dueño: SKU fuera del mensaje WhatsApp; variante no-default visible en el pedido; receta responsive 480/768/1800 NO se expande (deuda aceptada); dark mode = eliminar CSS muerto; www→apex 301 automático; og 1200×630 por imagen única (no por producto); WebP 0.82.

---

### Task 1: `_headers` — CSP sin Trusted-Types, Cache-Control detach CF, metas, reglas muertas

**Files:**
- Modify: `packages/exporter/src/index.ts:3089-3144` (template del `_headers`, solo production)
- Modify: `packages/exporter/src/index.ts:1582` (quitar `og:updated_time`)
- Test: `packages/exporter/src/index.test.ts`

**Interfaces:**
- Produces: archivo `_headers` con reglas válidas para Cloudflare Pages (detach `! Cache-Control` en cada regla específica que redefina la de `/*`), CSP sin `require-trusted-types-for` ni `trusted-types`.

Requisitos exactos:
1. CSP actual (línea ~3093) incluye `img-src 'self' data: https: http:` y `require-trusted-types-for 'script'; trusted-types 'none'`. Nueva CSP: igual pero (a) `img-src 'self' data: https:` y `media-src` sin `http:` (ajustar ambas directivas), (b) SIN las dos directivas trusted-types.
2. Cada regla específica posterior a `/*` que redefina `Cache-Control` (`/assets/*`, sitemaps, merchant, índices, sw.js si existe) debe emitir dos líneas: `! Cache-Control` y luego el valor. La regla de `/video-sitemap.xml` (líneas ~3112-3113) SOLO se emite cuando `manifest.usedVideoIds.length > 0`.
3. Quitar la línea `Access-Control-Allow-Origin: *` global.
4. HSTS pasa a `Strict-Transport-Security: max-age=31536000; includeSubDomains`.
5. Quitar el meta `og:updated_time` (index.ts:1582).
6. `_redirects` se conserva tal cual.

- [ ] **Step 1: Test que falla.** En `index.test.ts` (sección de production), exportar un proyecto production y asertar sobre `files.get("_headers")`: (a) `expect(headers).not.toContain("trusted-types")` y `not.toContain("require-trusted-types-for")`; (b) `not.toContain("Access-Control-Allow-Origin")`; (c) `toContain("includeSubDomains")`; (d) parsear bloques: para la sección `/assets/*`, contar ocurrencias de `! Cache-Control` seguido de valor con `max-age=31536000`; (e) `not.toMatch(/\/video-sitemap\.xml/)` cuando el fixture no tiene videos; (f) CSP `img-src` sin ` http:`; (g) HTML home sin `og:updated_time`.
- [ ] **Step 2: Correr test, verificar FAIL** (`corepack pnpm --filter @solara/exporter test -- index.test.ts`).
- [ ] **Step 3: Implementar** los 6 cambios en el template literal del `_headers` y borrar la línea de `og:updated_time`.
- [ ] **Step 4: Tests PASS** + buscar tests existentes que asertaran el contenido viejo del `_headers`/CSP y actualizarlos (grep `trusted-types`, `og:updated_time`, `video-sitemap` en `packages/exporter/src/*.test.ts` y `tests/`).
- [ ] **Step 5: Commit** `fix(exporter): headers CF con detach, CSP sin trusted-types y metas limpios`

---

### Task 2: CSS unificado por contenido + budget realista

**Files:**
- Modify: `packages/exporter/src/index.ts:3012-3060` (construcción cssFull/cssHome y guard de dedupe por PATH) y `index.ts:3042` (selección `runtimeAssetsHome`/`runtimeAssetsFull`)
- Modify: script de budget donde se declara el límite CSS (grep `8 * 1024` o `storefront` en `scripts/`, e.g. public-storefront-budget)
- Test: `packages/exporter/src/index.test.ts`

**Interfaces:**
- Produces: `runtimeAssetsFull.css` es la ÚNICA hoja de estilos emitida y referenciada (todas las páginas). La ruta de home ya no existe. `buildServiceWorker` recibe esa ruta (T3 depende de esto).

Requisitos exactos:
1. El guard actual `if (cssHomePath !== cssFullPath) files.set(...)` compara rutas, nunca contenidos; cuando `cssHome === cssFull` (byte-idénticos en catalog-modern) escribe dos archivos con el mismo hash y distinto prefijo.
2. Fix: si `cssHome === cssFull`, emitir solo `cssFullPath` y usar `runtimeAssetsFull` para TODAS las páginas (incluida home). Si difieren (tiendas con módulos exclusivos de páginas internas), mantener el comportamiento actual de dos archivos.
3. Eliminar `runtimeAssetsHome` cuando no se necesita (condicional, no borrar la infraestructura que sirve para el caso diferenciado).
4. Budget: actualizar el límite declarado de la CSS pública a 40 KB gz (con comentario de justificación: presupuesto anti-exceso, CSS real ~28 KB gz).

- [ ] **Step 1: Test que falla.** Con fixture catalog-modern: export production; asertar que existe EXACTAMENTE UN archivo en `files` que matchee `/^assets\/storefront.*\.css$/` (usar las dos claves conocidas: contar claves que empiecen con `assets/storefront` y terminen `.css`); asertar que el `<link rel="stylesheet">` de `index.html` y de una página de categoría apuntan a la MISMA ruta.
- [ ] **Step 2: FAIL.**
- [ ] **Step 3: Implementar** comparación por contenido y unificación; ajustar `runtimeAssets` por página.
- [ ] **Step 4: PASS** + actualizar tests que referencien `storefront-home` (grep en repo, incl. `scripts/sitio-consistencia.test.ts` y `scripts/public-storefront-budget.test.ts`).
- [ ] **Step 5: Commit** `fix(exporter): una sola CSS publica cuando home y resto comparten bytes`

---

### Task 3: Service Worker — precache correcto, runtime cache con allowlist, CACHE_NAME con revision

**Files:**
- Modify: `packages/exporter/src/pwa.ts:141-202` (`buildServiceWorker`), firma de opciones
- Modify: `packages/exporter/src/index.ts:3175-3183` (call site, pasar `revision` del deployment-manifest)
- Test: `packages/exporter/src/pwa.test.ts` (crear si no existe; si existe otro archivo de test de pwa, usarlo)

**Interfaces:**
- Consumes: T2 (una sola CSS). `buildServiceWorker(project, { runtimeCssPath, runtimeJsPath, offlinePath, revision })` — nuevo campo opcional `revision?: string`.
- Produces: `sw.js` con `CACHE_NAME = 'solara-<revision|hash>-<hash16>'`; runtime cache SOLO persiste respuestas same-origin OK cuyo pathname empiece con `/assets/` o matchee `/(^|\/)(search-index|catalog-index)\.json$|^\/assets\/copy\./` o pathname === `/offline/` o `/offline/index.html`.

Requisitos exactos:
1. Precache: `route(options.runtimeCssPath ?? "/assets/storefront.css")` — ya correcto tras T2; agregar TEST de coherencia: el `runtimeCssPath` pasado desde `buildFiles` == la ruta del `<link>` de la home.
2. Runtime cache (líneas ~184-189): envolver el `cache.put` con guard de allowlist (constante `RUNTIME_CACHE_PATTERN` como string de regex dentro del SW serializado). Todo lo demás (HTML dinámico) pasa network-first sin persistir.
3. `CACHE_NAME`: incluir `revision` del deployment-manifest si existe (fallback al hash actual). Invalida cachés viejas sin tocar lógica de activación.

- [ ] **Step 1: Test que falla:** (a) `sw.js` contiene `solara-<revision>-` cuando se pasa revision; (b) el fetch-handler NO contiene `cache.put` fuera del guard (parsear: la llamada a cache.put está tras un `if (RUNTIME_CACHE_PATTERN.test(pathname))` o equivalente); (c) precache list incluye exactamente la CSS pasada por opción.
- [ ] **Step 2: FAIL.**
- [ ] **Step 3: Implementar.**
- [ ] **Step 4: PASS** + `test:e2e` smoke de storefront sigue verde si corre rápido (opcional; la verificación offline e2e viene al final).
- [ ] **Step 5: Commit** `fix(exporter): sw con precache coherente, runtime cache acotado y cache-name por revision`

---

### Task 4: PWA assets — íconos desde logo, manifest completo, favicon dedup, /offline/ noindex

**Files:**
- Modify: `packages/exporter/src/pwa.ts:208-389` (`buildFaviconIco`, `generateIconPng`, `buildWebManifest`, `buildOfflinePage`)
- Modify: `packages/exporter/src/index.ts:3147-3166` (emisión de iconos/favicon/manifest/offline) y `<link rel=icon>` en `renderDocument` (grep `favicon`)
- Test: `packages/exporter/src/pwa.test.ts`

**Interfaces:**
- Consumes: `seo.faviconAssetId` del proyecto (asset PNG/ICO subido por la tienda).
- Produces: `manifest.webmanifest` con `id`, `description`, `icons` con `purpose: "any"` y una entrada `maskable`; `icons/icon-192.png` y `icons/icon-512.png` derivados del logo cuando exista (paleta 256 + zlibSync de fflate), sino color sólido comprimido; UN solo favicon en raíz.

Requisitos exactos:
1. `generateIconPng` hoy produce PNG sin compresión real (icon-512 = 787 KB). Reescribir encoder: PNG con paleta 256 colores (IHDR colorType 3) comprimido con `fflate.zlibSync`. Si el asset favicon/logo es PNG decodificable, escalar (nearest/bilinear simple sobre RGBA en JS) a 192/512 y cuantizar; si no, color sólido actual. Target: icon-512 < 60 KB con fixture sólido.
2. Manifest: agregar `id: start_url`, `description` (de `project.identity`/`publicCopy`, truncada a 200), icons con `purpose:"any"` + tercera entrada `{ src: icon-512, sizes: "512x512", purpose: "maskable" }`.
3. Favicon: `<link rel="icon">` apunta a `/favicon.ico` (raíz); NO emitir la copia byte-idéntica del asset favicon bajo `assets/` (dedupe). Cuidado: revisar referencias existentes al asset (grep `favicon-v1` o como se nombre) y al allowlist `assertPublicFileMap` (index.ts:2776) para no romper el mapa.
4. `buildOfflinePage` (pwa.ts:368-389): agregar `<meta name=robots content=noindex>`.

- [ ] **Step 1: Tests que fallan:** (a) manifest tiene `id`, `description` e icono maskable; (b) icon-512 < 60 KB (fixture sólido); (c) PNG válido: parsear firma + IHDR colorType 3; (d) en export, `files` NO contiene el favicon duplicado bajo assets/ y `index.html` linkea `/favicon.ico`; (e) offline/index.html contiene `name=robots`.
- [ ] **Step 2: FAIL.**
- [ ] **Step 3: Implementar** (encoder PNG paleta puede extraerse a helper `pwa-png.ts` si pwa.ts queda grande).
- [ ] **Step 4: PASS** + grep tests que referencien el favicon duplicado y actualizar.
- [ ] **Step 5: Commit** `fix(exporter): iconos pwa comprimidos desde logo, manifest completo y favicon sin duplicar`

---

### Task 5: `_worker.js` Cloudflare Pages — pages.dev noindex, www→apex, headers idempotentes

**Files:**
- Create: `packages/exporter/src/cf-worker.ts` (emisión del string `_worker.js`)
- Modify: `packages/exporter/src/index.ts` (emitir `files.set("_worker.js", ...)` en production; agregar a `assertPublicFileMap` y `essentialPaths` si corresponde)
- Test: `packages/exporter/src/cf-worker.test.ts`

**Interfaces:**
- Produces: `_worker.js` — módulo CF Pages: `export default { async fetch(request, env) }`. Comportamiento: (1) si `request.headers.get("host")` termina en `.pages.dev` → clonar respuesta con `X-Robots-Tag: noindex` agregado si no existe; (2) si host === `www.<apex>` → 301 a `https://<apex><path>` conservando query; (3) resto: `env.ASSETS.fetch(request)`; (4) IDEMPOTENTE: al respuesta de assets, agregar headers de seguridad (CSP, HSTS, X-Content-Type-Options, Referrer-Policy) SOLO si no están presentes — nunca duplicar (la duplicación es el bug original del `_headers`).

REQUISITO PREVIO OBLIGATORIO: antes de codificar, `webfetch` a las docs oficiales de Cloudflare Pages sobre `_worker.js` (advanced mode) para confirmar: ¿se procesan `_headers`/`_redirects` cuando existe `_worker.js`? ¿`env.ASSETS.fetch` existe? Anotar la conclusión en el reporte y diseñar acorde (el diseño idempotente funciona en ambos casos; si advanced mode ignora `_headers`, el worker debe aplicar TAMBIÉN las reglas de Cache-Control por ruta — copiar la lógica del `_headers` como mapa ruta→header dentro del worker, aplicada con la misma idempotencia).

- [ ] **Step 1: Verificar docs CF y anotar.**
- [ ] **Step 2: Test que falla:** unit test simulando Request/Response mínimos (constructor global en Node/vitest): (a) host pages.dev + respuesta sin X-Robots-Tag → sale con header; (b) host pages.dev + respuesta CON X-Robots-Tag: noindex ya presente → no duplica; (c) www host → 301 Location apex conservando query; (d) respuesta ya con CSP → worker no agrega segunda CSP; (e) respuesta sin CSP → agrega la misma CSP del `_headers`.
- [ ] **Step 3: Implementar** `cf-worker.ts` (string embebido, sin deps) + emisión en buildFiles + allowlist.
- [ ] **Step 4: PASS.**
- [ ] **Step 5: Commit** `feat(exporter): worker cf pages con noindex de pages.dev, 301 www y headers idempotentes`

---

### Task 6: WhatsApp compacto — sin SKU, variante visible, pattern v-mode

**Files:**
- Modify: `packages/storefront-runtime/src/index.ts:391-449` (`buildWhatsAppMessage`, `buildWhatsAppUrl`) y `:1267-1293` (handler del drawer reconstruye el mensaje a mano → reusar builder)
- Modify: `packages/modules/src/definitions.ts:1365` y `packages/exporter/src/index.ts:2281` (pattern)
- Test: `packages/storefront-runtime/src/*.test.ts` (buscar el test existente de buildWhatsAppMessage y extenderlo)

**Interfaces:**
- Consumes: `formatMoney`, `personalizeWhatsAppGreeting` (existentes). Carrito con líneas `{ productId, variantId, title, variantTitle, sku, quantity, priceCents }`.
- Produces: `buildWhatsAppMessage(project, lines, { customer, cartTotalCents })` — ÚNICA fuente del mensaje.

Requisitos exactos:
1. Compacción: (a) deduplicar líneas idénticas (mismo productId+variantId) sumando quantity; (b) OMITIR SKU siempre (deprecado — el campo schema queda tolerado pero ignorado, comentar en código); (c) variante: incluir ` (${variantTitle})` SOLO cuando `variantTitle` no sea default mono-variante: exactamente cuando `variantTitle` y además NO sea `Única`/`Unica` (case-insensitive, sin acentos); (d) cap: si tras dedupe hay >25 renglones, emitir los primeros 25 + renglón `- …y N productos más (no incluidos en este mensaje)`; el total del pedido SIEMPRE presente al final; (e) objetivo: fixture de 30 ítems ×2 unidades → URL wa.me ≤ 4000 chars.
2. Handler del drawer (1267-1293): eliminar el constructor inline, llamar `buildWhatsAppMessage` + `buildWhatsAppUrl`.
3. Aviso de truncado en UI: cuando el mensaje se trunca, el drawer muestra texto visible pequeño "El mensaje incluye los primeros 25 productos; el total del pedido es completo." (copy de `runtimeCopy` si existe una clave apta; si no, literal es-AR inline).
4. Pattern de teléfono en ambos puntos: `pattern="[\d\+\(\)\- ]{8,}"` (válido en regex v-mode). Test: `new RegExp("[\\d\\+\\(\\)\\- ]{8,}", "v")` no lanza.

- [ ] **Step 1: Test que falla:** fixture 30 ítems ×2u (títulos largos realistas) → `buildWhatsAppUrl(...).length ≤ 4000`; dedupe de duplicados; SKU ausente del mensaje aunque `includeSku: true`; variante "Única" ausente; variante "30x40cm" presente; cap 25 + renglón de excedentes + total; regex pattern compila con flag "v".
- [ ] **Step 2: FAIL.**
- [ ] **Step 3: Implementar** compactor + refactor del drawer + patterns.
- [ ] **Step 4: PASS** + `pnpm --filter @solara/storefront-runtime test` + budget test del runtime serializado (`scripts/public-storefront-budget.test.ts`) sigue en verde (el código nuevo debe compensarse o ser neto pequeño; si excede, minificar nombres locales).
- [ ] **Step 5: Commit** `fix(runtime): mensaje whatsapp compacto sin sku, variante visible y pattern telefono v-mode`

---

## CHECKPOINT 1 — fin de fase deployable sin migración de datos

Controller: correr `corepack pnpm check:quick` y `corepack pnpm test:e2e:smoke`. Balance al usuario. NO continuar a T7 sin gates verdes.

---

### Task 7: Imágenes P0 — alfa real, fallback jpg para fotos, migración automática

**Files:**
- Modify: `apps/studio/src/workers/image.worker.ts:95-126` (`sourceCanContainAlpha`) y `:171-203` (`processImage`: decidir `preserveAlpha` por escaneo de píxeles cuando PNG)
- Modify: `apps/studio/src/lib/workers.ts:69-100` (`processImageOnMainThread` usa `file.type !== "image/jpeg"` en línea 83 → usar detección real)
- Modify: `apps/studio/src/lib/repository.ts:668-695` (`needsImageOptimization` + `optimizeImageAsset`) y `:507-564`
- Modify: `packages/agent-control/src/image-processor.ts:178-186` (marcar assets PNG-only como pendientes de optimización)
- Test: `apps/studio/src/workers/image.worker.test.ts`, `packages/agent-control/src/image-processor.test.ts`, `apps/studio/src/lib/repository.test.ts`

**Interfaces:**
- Consumes: pipeline existente (`createImagePlan`, canvas en worker).
- Produces: (1) `hasVisibleAlpha(imageData): boolean` — muestreo con stride (ej. cada 4º píxel) del canal A; PNG con colorType 4/6 o tRNS pero alfa≥255 en muestra → opaco → fallback jpg + variantes webp/avif ya existentes; (2) `needsImageOptimization(asset)` NUEVA semántica: necesita optimización si NO tiene ninguna variante webp/avif (assets del canal agente) O tiene `fallbackSource` png siendo la fuente un png opaco; (3) assets creados por `agent-control/image-processor` llevan marca de pendiente (campo/meta existente para eso o flag en el asset record según lo que ya exista — leer el código antes de decidir, NO cambiar schema).

Requisitos exactos:
1. AlFA real: en `processImage`, para PNG: tras dibujar en canvas, `getImageData` y escanear alfa con stride; si opaco → `preserveAlpha=false` → fallback `image/jpeg` (el resto del pipeline ya usa esa flag para el fallback).
2. `workers.ts:83`: reemplazar `file.type !== "image/jpeg"` por la misma detección (extraer helper compartido en `apps/studio/src/lib/image-alpha.ts` reutilizado por worker y main-thread).
3. Migración: `needsImageOptimization` debe capturar los 105 `-fallback.png` de fotos opacas y los assets PNG-only del canal agente; `optimizeImageAsset` (ya existente) los reprocesa al abrir/guardar la tienda en Studio. NO escribir en la portable desde el repo: la migración corre en la app del usuario.
4. `agent-control/image-processor.ts`: al generar solo PNG 768, dejar la marca de pendiente documentada en el código; NO intentar codificar WebP en JS puro ahí.

- [ ] **Step 1: Tests que fallan:** (a) `hasVisibleAlpha` con ImageData sintético todo-alfa-255 → false; con un píxel 128 → true; (b) `needsImageOptimization`: asset con solo `-768.png` → true; asset con webp variantes y fallback png sin alfa → true; asset webp + jpg fallback → false; (c) fixture PNG opaco procesado en worker produce fallback `.jpg` (mock de canvas si el test de worker ya tiene harness — seguir el patrón existente).
- [ ] **Step 2: FAIL.**
- [ ] **Step 3: Implementar.**
- [ ] **Step 4: PASS** + tests de repository/agent-control actualizados.
- [ ] **Step 5: Commit** `fix(studio): alfa real en fotos png, fallback jpg y migracion automatica de assets sin webp`

---

### Task 8: Preload imagesrcset + og:image dims reales + og 1200×630 por imagen única

**Files:**
- Modify: `packages/exporter/src/index.ts:1509-1513` (lcpPreload) y `:1541-1547` (og dims)
- Modify: `packages/exporter/src/assets.ts:363-541` (`socialSourceForAsset`, `resolveSocialImage`)
- Modify: `apps/studio/src/workers/image.worker.ts` (receta social: crop 1200×630 cover → `og.jpg` por imagen única)
- Modify: `packages/module-sdk/src/index.ts:533-626` solo si hace falta exponer los descriptores del `<picture>` para el preload (helper `pictureDescriptorsForAsset`); NO cambiar el markup emitido
- Test: `packages/exporter/src/index.test.ts`, `apps/studio/src/workers/image.worker.test.ts`

**Interfaces:**
- Consumes: `responsiveSourcesForAsset` (index.ts:448-459), `resourceHref` (urls.ts:59), pipeline de derivados (fallback width = min(w,768), image.worker.ts:201-203).
- Produces: (1) `<link rel="preload" as="image" imagesrcset="..." imagesizes="..." fetchpriority="high">` cuyo srcset/sizes == los descriptores que `renderImage` emitirá para ese asset (test de igualdad); (2) `og:image:width/height` = dimensiones REALES del archivo referenciado (768×H para fallback, o 1200×630 para og.jpg); (3) nuevo derivado `og.jpg` (1200×630, cover crop, jpegQuality 0.82) generado UNA vez por imagen fuente única, referenciado como og:image de las páginas que usan esa imagen.

Requisitos exactos:
1. Preload: para la página con `preloadImage`, computar el MISMO srcset que `renderImage` produciría (intermedia 768w con media móvil + full desktop) y emitir `imagesrcset`/`imagesizes` con esos valores + `href` como fallback. Si el asset no tiene variantes, preload simple como hoy.
2. og dims: `resolveSocialImage` devuelve también el width/height reales del archivo elegido (og.jpg → 1200×630; fallback → min(w,768) × H proporcional según ratio del asset); emitir siempre las metas con esos valores.
3. og.jpg por imagen única: en `buildFiles`, derivar og.jpg de `asset.source` con crop cover 1200×630 solo si la fuente es ≥1200×630 (sino escalar lo que se pueda) y cachear por assetId (una vez por imagen única, 17 para 166 productos). Determinista.
4. og:image prefiere og.jpg cuando existe (antes que fallbackSource), vía `socialSourceForAsset`.

- [ ] **Step 1: Tests que fallan:** (a) igualdad de descriptores preload vs `<picture>` (parsear el HTML del index y del preload); (b) og:image:width/height presentes y == dims reales del archivo; (c) fixture con 2 productos compartiendo imagen → UN solo og.jpg en files; og:image apunta a og.jpg.
- [ ] **Step 2: FAIL.**
- [ ] **Step 3: Implementar** (worker: `createImagePlan` no se toca; función aparte `createSocialPlan`).
- [ ] **Step 4: PASS** + e2e de currentSrc del hero (tests/e2e/catalog-modern-v2.spec.ts:420-435) sigue verde.
- [ ] **Step 5: Commit** `feat(exporter): preload espejo del picture, og dims reales y og 1200x630 por imagen unica`

---

### Task 9: Runtime UX — a11y carrito, búsqueda con skeletons, memo índice, variante Única, placeholder bento

**Files:**
- Modify: `packages/storefront-runtime/src/index.ts:745-751` (aria-label carrito), `:1246` (invalidación freshCatalog), `:1868` (render búsqueda: skeletons + contador + title/h1)
- Modify: `packages/modules/src/catalog-modern.ts:1484-1486` (selector variante), `:345` (botón carrito si aplica), bento de categorías (grep bento/grid categorías)
- Modify: `packages/modules/src/definitions.ts:1136-1137` (selector variante legacy)
- Modify: `packages/modules/src/styles.ts:325-329,2501,3428` (min-height búsqueda → skeletons)
- Test: tests de runtime y modules existentes (buscar `variant-select`, `search`, `cart-label` en *.test.ts de ambos paquetes)

**Interfaces:**
- Produces: (1) aria-label del botón carrito = `${label} ${count}` (tokens exactos del texto visible); (2) `/buscar/`: grid renderiza N skeleton cards (mismo markup de card con clase `solara-skeleton`, shimmer CSS con `@media (prefers-reduced-motion: reduce)` que lo apaga) antes del fetch; tras resultados, texto visible "Mostrando N de M" cuando N < M, y `document.title`/h1 reflejan la query; (3) `freshCatalog` NO se invalida cuando el carrito está vacío (runtime:1246); (4) selector de variante oculto cuando `variants.length === 1` (label+select con `hidden`, el select queda en el DOM con su opción seleccionada para no tocar la lógica de carrito); (5) bento: categoría sin imagen renderiza tile placeholder (fondo del tema + inicial del título, aria-hidden) en lugar de hueco.

- [ ] **Step 1: Tests que fallan** (uno por comportamiento, en los archivos de test existentes de cada paquete).
- [ ] **Step 2: FAIL.**
- [ ] **Step 3: Implementar.**
- [ ] **Step 4: PASS** + budget runtime en verde.
- [ ] **Step 5: Commit** `fix(modules,runtime): a11y carrito, busqueda con skeletons y estado, variante unica oculta y placeholder bento`

---

### Task 10: Pulido visual — hamburguesa 44px, hero móvil, paginación numérica, títulos ≤60

**Files:**
- Modify: `packages/modules/src/catalog-modern.ts` (hamburguesa markup si falta área táctil) + `packages/modules/src/styles.ts` (hit-area ≥44px; clamp del H1 hero en <768px más compacto; estilos paginación numérica)
- Modify: `packages/exporter/src/index.ts` (paginación de categorías: emitir enlaces numéricos 1…n con ventana centrada, además de prev/next; grep `rel="prev"` para localizar el footer de paginación)
- Modify: `packages/site-optimizer/src/index.ts:302-343` (títulos: helper `fitTitle(entityTitle, brandName, max=60)` con truncado en límite de palabra + `…` solo si excede)
- Test: `packages/site-optimizer/src/*.test.ts`, `packages/exporter/src/index.test.ts` (paginación), snapshots de modules si existen

**Interfaces:**
- Produces: paginación con enlaces numerados (ventana de ±2 alrededor de la actual + primera/última, elipses sin link), canonical/prev/next sin cambios; títulos de rutas ≤60 chars (solo se trunca la parte de entidad, la marca se conserva completa).

- [ ] **Step 1: Tests que fallan:** (a) helper fitTitle: no trunca cuando cabe; trunca en palabra y agrega … cuando excede; (b) export de categoría con 6 páginas → HTML contiene enlaces a páginas 1..6 (o ventana) además de prev/next; (c) hit-area: aserción de CSS (grep en styles emitido) con `min-width/min-height` ≥ 44px para el botón hamburguesa.
- [ ] **Step 2: FAIL.**
- [ ] **Step 3: Implementar.**
- [ ] **Step 4: PASS.**
- [ ] **Step 5: Commit** `feat(modules,exporter): paginacion numerica, hero y hamburguesa moviles y titulos acotados`

---

### Task 11: Eliminar CSS dark muerto (decisión F4)

**Files:**
- Modify: `packages/exporter/src/index.ts:867-887` (bloques dark/auto de `themeCss`)
- Modify: `packages/modules/src/styles.ts:45-51,649-657` (bloques dark/auto de STORE_BASE_STYLES)
- Test: tests de modules/exporter que referencien `prefers-color-scheme` o `data-color-mode`

**Interfaces:**
- Consumes: schema INTOCADO (`colorMode` sigue aceptando auto/light/dark; el export simplemente ya no trae estilos dark — documentado).
- Produces: CSS pública sin bloques `prefers-color-scheme` ni `[data-color-mode="dark"]`; `data-color-mode="light"` sigue emitiéndose.

- [ ] **Step 1: Test que falla:** CSS exportada no contiene `prefers-color-scheme` ni `data-color-mode="dark"`; schema sigue validando `colorMode: "dark"` (test de schema existente sin cambios).
- [ ] **Step 2: FAIL.**
- [ ] **Step 3: Implementar** (borrar bloques; actualizar cualquier test que los asertara).
- [ ] **Step 4: PASS.**
- [ ] **Step 5: Commit** `refactor(exporter,modules): eliminar css dark muerto por decision f4`

---

### Task 12: Docs y cierre

**Files:**
- Modify: `README.md:215-221` (receta real: variantes 768 + máx ≤1800 + og.jpg 1200×630; dejar explícito que 480/1200 no se generan, decisión aceptada)
- Modify: `docs/TECHNICAL_DEBT.md` (F4 resuelta; deuda aceptada de receta; includeSku deprecado; data-solara-copy y _redirects como wontfix argumentado; X-Robots-Tag vía _worker.js)
- Modify: `CHANGELOG.md` (formato Keep a Changelog, en español, todos los cambios de la rama)
- Modify: `docs/AUDITORIA.md` (apéndice final "Resolución 2026-09-02" con tabla hallazgo→fix/estado)

- [ ] **Step 1: Redactar** los 4 archivos (sin crear docs nuevos).
- [ ] **Step 2: `git diff --check` + `corepack pnpm check:repository`** en verde.
- [ ] **Step 3: Commit** `docs: resolucion de auditoria rm descartables y deuda actualizada`

---

## Verificación final (controller, tras T12)

1. `corepack pnpm check:quick` + `corepack pnpm test:e2e:smoke` (checkpoint 2).
2. `corepack pnpm check` (full secuencial) + `corepack pnpm test:e2e` (74 specs).
3. Spec offline nuevo si no existió durante T3 (Playwright `context.setOffline`: home visit 2 con estilos desde precache).
4. Re-auditoría con batería recreada en temp sobre export production de fixture: `_headers` real servido en loopback, SW registra sin error bajo CSP, sin requests a `-fallback.png`, pesos por umbrales firmados, URL WhatsApp ≤4000, CLS/LCP Lighthouse móvil.
5. `git diff --check`, `check:repository`, revisión final de rama.
6. `corepack pnpm build` → `desktop:build` → `desktop:package` → `portable:smoke`.
7. CHANGELOG ya en T12; merge a `origin/main` tras aprobación del dueño (A2: el dueño re-exporta y publica).
