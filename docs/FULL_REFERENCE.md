# Referencia completa de SolaraCommerce

Este documento es la referencia única y exhaustiva de toda la aplicación:
cada paquete, cada página del sitio exportado, cada módulo, cada comando,
cada spec de testing. Si algo no está acá, falta documentarlo.

---

## 1. Producto

**Qué es:** Aplicación local-first que permite a una persona crear, editar y
exportar sitios ecommerce estáticos. Sin backend remoto, sin pagos online.
El checkout cierra por WhatsApp. El usuario publica en cualquier hosting
estático (Vercel, Netlify, GitHub Pages, etc).

**Usuario objetivo:** Persona única que gestiona varias tiendas pequeñas
(1-200 productos) sin conocimientos técnicos.

**Flujo principal:** Crear tienda → editar identidad/productos/categorías →
previsualizar → exportar sitio estático → publicar.

**Fuera de alcance v2:** Backend remoto, pagos online, multiusuario, API pública,
importación desde otras plataformas, multidioma, IA generativa.

---

## 2. Stack tecnológico

| Tecnología | Versión | Uso |
| --- | --- | --- |
| Node.js | ≥22 | Runtime |
| pnpm (Corepack) | 10.15.1 | Gestor de paquetes |
| React | 19.1.1 | UI del editor |
| Vite | 7.1.3 | Build del Studio |
| Zod | — | Validación de schemas (fuente de verdad) |
| Dexie | 4.2.0 | IndexedDB wrapper (cache + recovery) |
| motion (Framer) | 12.23.12 | Transiciones del editor |
| @phosphor-icons/react | 2.1.10 | Iconografía |
| Playwright | 1.55.0 | Tests E2E Chromium |
| Biome | 2.2.2 | Lint + format |
| TypeScript | 5.9.2 | Tipado estricto |
| Vitest | 3.2.4 | Test runner unitario |

**Sin dependencias runtime externas en el sitio exportado.** El JS/CSS/HTML
es autocontenido.

---

## 3. Monorepo (paquetes)

### apps/

| Paquete | Descripción | Archivos clave |
| --- | --- | --- |
| `@solara/studio` | Editor React SPA. Dashboard, Constructor, Catálogo, Tema, Assets, SEO, Export, Preview. PWA con service worker. | `main.tsx`, `App.tsx`, `features/Studio.tsx` (1121), `features/Catalog.tsx` (1369), `features/Dashboard.tsx` (1068), `features/Overview.tsx` (1187) |
| `@solara/desktop` | Shell Electron portable Windows. Sirve el sitio + Studio localmente. | `src/main.mjs`, `src/preload.mjs` |

### packages/

| Paquete | Responsabilidad | Exports principales | Líneas index.ts |
| --- | --- | --- | --- |
| `@solara/project-schema` | Zod schemas, tipos branded, fixtures, template. Fuente de verdad del contrato de datos. | StoreProjectV2Schema, ProductSchema, CategorySchema, parseProject, migrateProject, buildCatalogModernProject, catalogModernStore/V2Store/ScaleStore/ CleanStore | ~1155 (dividido en ids.ts, media.ts, category-helpers.ts, public-copy-defaults.ts) |
| `@solara/core` | Reducer de dominio (DomainCommand), HistoryState undo/redo (MAX_HISTORY_LENGTH=50), CSV import/export. Sin navegador. | reduceProject, executeCommand, undo, redo, createHistory, MAX_HISTORY_LENGTH | — |
| `@solara/module-sdk` | Helpers compartidos para módulos: escapeHtml, safeAssetUrl, renderImage (picture + srcset + sizes), internalHref, sanitizeRichText. | renderImage, escapeAttribute, safeHtml, internalHref | — |
| `@solara/modules` | Registro de módulos (catalog-modern V1/V2, editorial). CSS generado (~4600 líneas en styles.ts). Settings schemas por módulo. Inspector metadata. | getModuleDefinition, MODULE_STYLE_BLOCKS, renderSections, STORE_BASE_STYLES | — |
| `@solara/exporter` | Renderer HTML/CSS/JS del sitio público. buildPages (11 rutas), renderDocument, buildFiles, auditProject, exportProject, renderPreviewHtml. Servidor local Node (serve.mjs). Handler compartido HTTP/Electron. | exportProject, buildPages, renderPreviewHtml, auditProject, auditReport, createProjectArchive | ~1974 (dividido en html.ts, urls.ts, assets.ts, whatsapp.ts, structured-data.ts, feeds.ts, audit.ts) |
| `@solara/storefront-runtime` | JS progresivo del sitio exportado. Carrito localStorage, variantes, búsqueda, filtros, menú móvil, hero motion. Se serializa como string inline en production. | STOREFRONT_RUNTIME_JS (inline), STOREFRONT_RUNTIME_CSS, reconcileCartLines, formatMoney | ~1963 |
| `@solara/site-optimizer` | Auditoría pura determinista. Hallazgos técnicos, contenido, SEO, Merchant, media, contexto IA. No muta el proyecto. | optimizeProject, buildOptimizationReport | — |

### scripts/

| Script | Función |
| --- | --- |
| check-quick.mjs | 6 gates en paralelo (~80s): repository, hardcoded-content, image-budget, format, typecheck, test |
| check-budgets.mjs | Verifica budgets de bundles Studio (JS ≤720 KiB, CSS ≤112 KiB) |
| check-image-budget.mjs | Falla si PNG >200KB en public/fixtures/ |
| check-hardcoded-content.mjs | Detecta contenido de demo filtrado a producción (con allowlist JSON) |
| static-server.mjs | Servidor estático mínimo para Lighthouse local |
| e2e-smoke.mjs | Smoke E2E: build cacheado + Playwright specs críticos |
| test-affected.mjs | Ejecuta sólo tests afectados por los cambios |
| create-portable-distribution.mjs | Genera .release/portable/SolaraCommerce-Portable |

---

## 4. Modelo de datos (StoreProjectV2)

```text
StoreProjectV2
├── schemaVersion: 2 (literal)
├── id: StoreId (branded)
├── slug: Slug (regex + nombres reservados Windows)
├── baseUrl: URL base para canonical/sitemap/feed
├── status: "active" | "archived"
├── locale, currency
├── createdAt, updatedAt (ISO datetime)
├── origin: { templateId, templateVersion, seed }
│   └── seed: "clean" | "demo" | "duplicate" | "placeholder"
├── identity: { legalName, brandName, description, email, phone, address, logoAssetId }
├── seo: { title, description, faviconAssetId?, socialImageId?, searchConsoleVerification, merchantVerification }
├── theme: { colors, typography, spacing, spacingScale, shadows, borders, motion, radius, container, colorMode }
├── navigation: { mode:"automatic"|"manual", items[], showHome/Contact/About/Search/Cart, catalogLabel }
├── whatsapp: { phone, greeting, includeSku }
├── commerceTemplates: { designFamily:"catalog-modern-v1"|"catalog-modern-v2", search:{enabled}, cart:{enabled}, checkout:{enabled}, ... }
├── policies: { shipping{...}, returns{...}, privacy, terms }
├── priceFractionDisplay: "always"|"auto"
├── assets: ImageAsset[] (id, name, alt, mimeType, source, fallbackSource?, responsiveSources[], width, height, hash)
├── videos: VideoAsset[]
├── products: Product[] (id, slug, title, description, richDescription?, status, brand, categoryIds[], collectionIds[], tags[], imageIds[], variants[] (id,title,price:Money,available,stockStatus,optionValues,sku?,gtin?,mpn?,imageId?), reviews?)
├── categories: Category[] (id, slug, title, description, parentId?(≤1 nivel), productIds derivados, imageId)
├── collections: Collection[] (id, slug, title, description, productIds derivados, imageId)
├── sections: StoreSection[] (id, slot, moduleId, enabled, settings: Record<string,unknown>, motion)
├── pages: PageConfig[] (id, kind: home|about|contact, slug, title, seoTitle?, seoDescription?, sections[])
└── siteShell: { announcement, header, footer, cart }
``

### Invariantes validadas por Zod (superRefine)

- IDs únicos dentro de su tipo (productos, categorías, colecciones)
- Slugs únicos por tipo, sin nombres reservados de Windows
- categoryIds de productos existen; parentId máximo 1 nivel
- collection.productIds apuntan a productos existentes
- asset.imageIds referencian assets existentes
- variant.price ≥ 0 (Money = entero centavos)

---

## 5. Seeds de tienda

| Seed | ID | Nombre | Productos | Categorías | Uso |
| --- | --- | --- | --- | --- | --- |
| `"placeholder"` | store-predeterminado-base / dinámico | Predeterminado / nombre usuario | 5 genéricos ("Producto 1"..."Producto 5") | 2 ("Categoria 1", "Categoria 2") | Base generadora: abrir, reemplazar placeholders, publicar |
| `"clean"` | store-catalog-modern-clean | Nueva tienda | 0 | 0 | Tienda completamente vacía |
| `"demo"` | store-modo-sur-demo (solo legacy) | Predeterminado | 62 con contenido real | 8 raíz + hijas | Referencia interna / tests |

El seed se define en `buildCatalogModernProject({ seed })` en
`packages/project-schema/src/catalog-modern-template.ts`. Cada seed produce
un proyecto que pasa Zod sin errores.

**Placeholder:** grillas activas (5 productos), bento activo, marcas y
testimonios desactivados. Hero con textos instructivos ("Titulo del hero").

**Clean:** grillas desactivadas, navegación automática sin links manuales,
hero con textos instructivos, imagen SVG placeholder embebida como data URL.

**Demo:** catálogo completo de indumentaria (62 productos, 8 categorías raíz,
hijas, 4 colecciones), imágenes WebP optimizadas, testimonios, marcas,
newsletter. Usado como referencia visual y para tests de escala.

---

## 6. Sitio exportado — páginas y rutas

El exporter genera las siguientes rutas desde un proyecto V2:

| Ruta | pageType | Condición | Módulos |
| --- | --- | --- | --- |
| `/` | home | Siempre | header, announcement, hero, brand-strip, category-bento, product-grid(s), testimonials, contact-form+channels, newsletter-cta, footer |
| `/categorias/{slug}/` (+ paginación) | category | Categorías con productos activos | header, breadcrumbs, filtros, grid, pagination, footer |
| `/productos/{slug}/` | product | Productos activos | header, breadcrumbs, product-detail (galería, variantes, tabs), related-products, footer |
| `/colecciones/{slug}/` (+ paginación) | collection | Colecciones definidas | header, collection-grid, pagination, footer |
| `/buscar/?q=` | search | search.enabled | header, search-results, footer · noindex |
| `/carrito/` | cart | cart.enabled | header, cart-page-grid (lines + summary), drawer, footer · noindex |
| `/compra/` | checkout | checkout.enabled && !isV2Design | header, checkout-form-v2, footer · noindex |
| `/contacto/` | contact | Solo V1 (en V2 son módulos de home) | header, contact-hero, form, channels, whatsapp-cta, purchase-info, faq, location, footer |
| `/nosotros/` | about | Solo V1 (en V2 son módulos de home) | header, about-hero, history, principles, editorial-image, process, manifesto, experience, team, stats, products-cta, footer |
| `/privacidad/` | legal | Siempre | header, policy-page (story-grid + values-grid), footer |
| `/terminos/` | legal | Siempre | header, policy-page, footer |
| `/envios/` | legal | Solo V1 | Igual que privacidad pero con datos de shipping |
| `/devoluciones/` | legal | Solo V1 | Igual que privacidad pero con datos de returns |
| 404.html | not-found | Siempre (fallback hosting) | header, error-hero con código 404 gigante, acciones, footer |

En **V2** las páginas Nosotros y Contacto NO se publican como rutas
independientes: sus módulos se renderizan como secciones al final del home.
Los links de navegación apuntan a `#contact-form` y `/#about-hero`.

### Archivos adicionales generados

| Archivo | Condición | Contenido |
| --- | --- | --- |
| `assets/storefront.css` | Siempre | CSS minificado combinado (base + módulos + runtime) |
| `assets/storefront.js` | Siempre | Runtime serializado inline (production) o bundle externo (draft) |
| `assets/storefront.js.map` | Solo draft | Source map para debugging |
| `sitemap.xml` | production | URLs indexables (sin search/cart/checkout/not-found) |
| `image-sitemap.xml` | production | URLs con imagen por producto/categoría |
| `video-sitemap.xml` | Solo si hay video hero | URLs con video schema |
| `google-merchant.xml` | production | Feed Google Merchant (RSS 2.0) |
| `search-index.json` | searchEnabled | Array de entries con tokens normalizados |
| `catalog-index.json` | cartEnabled o checkoutEnabled o siteShell.cart | Array de variantes para reconciliación de carrito |
| `robots.txt` | Siempre | Draft: Disallow all / Production: Allow all + Sitemap |
| `ai-context.json` | publicAiContext && production | Contexto estructurado para agentes IA |
| `llms.txt` | publicAiContext && production | Resumen en texto plano para LLMs |
| `manifest.webmanifest` | Siempre (Studio) | PWA manifest |

---

## 7. Módulos del storefront (catálogo V2)

Cada módulo tiene: id, slot (posición en la página), settings schema Zod,
función render que produce HTML string, y CSS aislado bajo `.cm.v2`.

| moduleId | Slot | Descripción |
| --- | --- | --- |
| catalog-header | header | Nav con logo, links de categorías, búsqueda y carrito |
| announcement-bar | announcement | Barra superior con texto + link opcional |
| catalog-hero | hero | Hero editorial con imagen/video, eyebrow, título, acciones. Modo imagen o video. Slides opcionales. |
| catalog-brand-strip | content | Franja horizontal de marcas (texto) |
| catalog-category-bento | catalog | Grid bento de categorías con imágenes |
| catalog-product-grid | catalog | Grilla responsive de productos desde colección o todos |
| catalog-testimonials | trust | Testimonios con rating y contexto |
| catalog-newsletter-cta | content | CTA para novedades vía WhatsApp |
| contact-form | contact | Formulario nombre/email/teléfono/mensaje |
| contact-channels | contact | Canales de contacto (WhatsApp, email, teléfono, dirección, horarios) |
| contact-whatsapp-cta | contact | CTA directo a WhatsApp |
| contact-purchase-info | contact | Info de compra (envío, cambios, etc.) |
| contact-faq | contact | Preguntas frecuentes (accordion) |
| contact-location | contact | Ubicación con mapa embebido |
| about-hero | about (V2) | Hero editorial de Nosotros |
| product-detail | product | Detalle del producto: galería, variantes, precio, tabs (descripción, envíos), reviews |
| collection-grid | collection | Grilla de colecciones |
| split-hero | home/content | Hero dividido texto/imagen |
| image-text-content | content | Bloque imagen + texto rico |
| trust-strip | content | Franja de confianza (iconos + texto) |
| cart-drawer | cart | Drawer lateral del carrito con checkout form |

### Slots disponibles

`announcement`, `header`, `hero`, `content`, `catalog`, `trust`, `cart`, `footer`

---

## 8. Runtime del storefront (JS progresivo)

El runtime se activa por capabilities declaradas en `data-solara-runtime-features`
del `<html>`. Sin JavaScript el contenido es navegable (fallback WhatsApp).

| Capability | Funcionalidad |
| --- | --- |
| `cart` | Agregar al carrito, drawer, localStorage persistente, reconcile con catalog-index.json |
| `checkout` | Formulario checkout, preview de pedido, link WhatsApp dinámico |
| `product` | Galería, variantes, tabs, stock status |
| `category` | Filtros, ordenamiento, paginación client-side |
| `search` | Búsqueda client-side con scoring (levenshtein + tokens) |
| `motion` | Appear on scroll, stagger, hover effects, parallax |

### Almacenamiento del carrito

Clave: `solara-cart:{storeId}`. Array JSON de `{ variantId, quantity }`. Se
reconcilia contra `catalog-index.json` al abrir drawer o checkout (precio y
disponibilidad siempre actuales, nunca stale de localStorage).

### Checkout sin carrito

Si se envía /compra/ sin items, muestra "Tu carrito está vacío" con role=alert.

### Pausa en pestaña oculta

`visibilitychange` pausa observers, autoplay y reconciliación. `postMessage`
desde Preview también pausa/reanuda (`solara-pause` / `solara-resume`).

---

## 9. Persistencia

### IndexedDB (Dexie)

Base: `solara-commerce-studio`. Tablas: `projects`, `recoveryDrafts`,
`migrations`. Es caché + recovery cuando hay servidor gestionado; fuente
primaria sin él.

### Servidor local (disco)

`Abrir SolaraCommerce.cmd` inicia un servidor Node en 127.0.0.1 que sirve:
- Studio SPA
- API de persistencia (`/__solara/*`) con cookie HttpOnly de sesión
- Sitio exportado en `proyectos/<tienda>/sitios/<versión>/`

El guardado usa transacciones atómicas: beginSave → upload → commit. SHA-256
verifica bytes exactos. Locks con TTL de 30 min. Reintentos ante EPERM/EBUSY.

### Respaldo editable

Formato: `.solara.json` — envelope `{ format, version, projectId, exportedAt, project }`.
Validación Zod completa antes de escribir. Versiones anteriores se conservan
en `respaldos/` hasta que un guardado exitoso las pode.

---

## 10. Testing

### Estructura de tests

| Tipo | Ubicación | Runner | Cantidad aprox |
| --- | --- | --- | --- |
| Unitarios por paquete | `packages/*/src/*.test.ts` | Vitest | ~254 tests |
| Studio unitarios | `apps/studio/src/**/*.test.ts(x)` | Vitest | ~339 tests |
| E2E Playwright | `tests/e2e/*.spec.ts` | Playwright Chromium | ~131 specs |
| Adversariales | `tests/e2e/__bugs__/` (5 specs) | Playwright | 13 tests |
| Visión geométrica | `tests/e2e/__vision__/alignment.spec.ts` + `storefront-alignment.spec.ts` | Playwright | 7 tests |
| Visión profunda | `tests/e2e/__vision__/storefront-deep-vision.spec.ts` | Playwright | 19 tests (manual, no gate) |
| Optimización fixtures | `tests/e2e/__vision__/optimize-fixtures.spec.ts` | Playwright | 1 test (one-shot) |

### Gates oficiales

| Comando | Qué corre | Duración | Cuándo |
| --- | --- | --- | --- |
| `check:quick` | repository, hardcoded-content, image-budget, format, typecheck, test (6 gates paralelo) | ~80s | Iteración diaria |
| `check:budgets` | Budgets de bundles + specs de runtime/storefront | ~3s | Con check:quick o CI |
| `check:full` / `check` | check:quick + check:slow (optimization, serialization, budgets, benchmark) + build | ~5-8 min | Cierre |
| `test:e2e:smoke` | Build cacheado + specs críticos Playwright | ~45s-2min | Diaria |
| `test:e2e` | Smoke full + todos los specs Playwright | ~3-4 min | Release |
| `desktop:package` + `portable:smoke` | EXE portable Windows + smoke test | ~2 min | Si toca app/shell |

### CI (GitHub Actions)

`ci.yml`: push/PR a main. Windows + Linux portabilidad. Steps: install →
repository → check → adversarial+vision specs → build → budgets → benchmark →
Chromium install → Playwright → desktop:package → portable E2E.

`release.yml`: manual dispatch. Agrega Firefox/WebKit, Lighthouse CI con
assertions (score ≥0.95 en todas las categorías), y publicación de artefactos.

---

## 11. Guardianes automáticos

Ver `docs/GUARDIANS.md` para el catálogo completo. Resumen:

| Categoría | Specs | Qué detectan |
| --- | --- | --- |
| Geométricos | alignment.spec.ts, storefront-alignment.spec.ts | Desalineación de columnas, tabs desiguales, cards inconsistentes, overflow horizontal |
| Adversariales | content-edge-cases, navigation-matrix, runtime-failures, forms-adversarial, seo-integrity | Contenido límite, links rotos, storage bloqueado, XSS, canonical duplicado |
| Presupuesto | check-image-budget.mjs, check-budgets.mjs, public-storefront-budget.test.ts | PNG sin optimizar, bundles excedidos |
| Seguridad | security-redteam.test.ts, chaos-storage.test.mjs, portable-adversarial.test.ts | Path traversal, CSV injection, locks, disco lleno |

---

## 12. Deuda técnica abierta (resumen)

Ver docs/TECHNICAL_DEBT.md para la lista completa con evidencia.

| Prioridad | Problema | Recomendación |
| --- | --- | --- |
| P2 | Busqueda sin JavaScript inviable sin backend | Aceptar limite o agregar backend en release futuro |
| P2 | Specs E2E inestables bajo carga paralela (pre-existente, verificado) | Plan de estabilidad en docs/superpowers/plans/ |
| P2 | Specs unitarios exporter inestables bajo carga paralela (timeout 5s) | Subir testTimeout a 10s o mover fuera del gate |
| P2 | Runtime serializado via fn.toString() sin source maps | Pipeline esbuild dedicado (build-runtime.mjs ya genera el bundle) |
| P2 | Margen budget runtime JS reducido (~604 B) | Medir y compactar antes de agregar comportamiento |
| P2 | Politica de retencion de sitios/: solo se conserva el sitio vigente | Definir politica de retencion |
| P3 | Jerarquia tipografica en paginas legales basica | Estilo editorial propio |
| P3 | Tests ad-hoc sin convencion ni utilidades compartidas | Crear packages/test-utils |

---

## 13. Flujos de usuario

### Crear tienda nueva (primera vez)

1. Abrir SolaraCommerce.cmd o `pnpm dev`
2. App detecta: sin servidor gestionado → IndexedDB; con launcher → disco
3. Si no hay proyectos: siembra Predeterminado (placeholder) automáticamente
4. Usuario abre Predeterminado → ve placeholders ("Producto 1", "Titulo del hero")
5. Reemplaza textos, sube imágenes por Recursos, agrega productos
6. Preview verifica en desktop/móvil
7. Guardar → exporta sitio a proyectos/<tienda>/sitios/
8. Publica archivos en hosting estático

### Editar producto

1. Catálogo → click en producto → ProductEditor
2. Tabs: Datos (nombre, descripción, marca), Imágenes (upload → worker optimiza),
   Organización (categorías, colecciones, etiquetas), Variantes (opciones, precio, stock)
3. Guardar → executeCommand → HistoryState push → RecoveryDraft → re-render preview
4. Undo/redo disponible (últimas 50 acciones)

### Exportar producción

1. Tab Exportar → seleccionar "Producción"
2. Botón habilitado cuando auditReady (sin errores críticos)
3. export.worker.ts corre exportProject fuera del hilo principal
4. buildFiles genera mapa completo de archivos
5. Servidor local escribe atómicamente a sitios/<versión>/
6. Receipt confirma versión y hash SHA-256

### Publicar

Manual: copiar contenido de sitios/<versión>/ al hosting estático.
No hay publicación automática (decisión de diseño v1).
