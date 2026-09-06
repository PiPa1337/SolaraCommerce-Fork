# Auditoría técnica — Exportación SolaraCommerce "RM Descartables"

**Fecha:** 2026-09-02
**Sitio auditado:** exportación estática en esta carpeta (`lop+`), baseUrl `https://rmdescartables.com.ar/`
**Auditoría #1 — Alcance:** SEO técnico, XMLs/manifiestos, pipeline de imágenes, performance. **Excluido por pedido:** diseño, UI/UX, contenido y copy. *(Ampliado en Auditoría #2, ver abajo.)*
**Método:** análisis estático completo (scripts PowerShell en temp) + sitio servido en loopback (puerto 8899, servidor Node propio con MIME correcto) y ejecutado con Playwright/Chromium headless (desktop 1920px, móvil 390px/DPR3). Segunda pasada con la CSP real del `_headers` aplicada (puerto 8898). Flujo carrito → checkout → WhatsApp probado end-to-end.

## Inventario rápido

- 577 archivos, 46,5 MB · 183 HTML · 166 productos · 6 categorías · paginación en categorías
- Runtime: `assets/storefront.bc701962c285c63a.js` (40,1 KB raw / 12,6 KB gz) ✅ dentro de presupuesto
- CSS: `storefront.css` y `storefront-home.css` (211,7 KB raw / 27,8 KB gz cada uno) ⚠️ 26x presupuesto (8 KiB declarado)
- Índices: `search-index.json` 154 KB (16,2 gz) · `catalog-index.json` 60,5 KB (12,2 gz)
- Manifiestos: `sitemap.xml` (179 URLs) · `image-sitemap.xml` (178 imágenes) · `google-merchant.xml` (166 ítems) · `feed.xml` (166) · `ai-context.json` · `llms.txt` · `llms-full.txt` · `robots.txt` · `_headers` · `manifest.webmanifest` · `deployment-manifest.json` (revision `73bceb2667d42713`)
- SW activo (`sw.js`) con precache + runtime cache

## P0 — Críticos

### 1. La CSP rompe el Service Worker en producción (PWA offline muerta)
`_headers:3` declara `require-trusted-types-for 'script'` + `trusted-types 'none'`.
**Verificado** con esos headers exactos (servidor de prueba 8898): `serviceWorker.register('/sw.js')` lanza
`TypeError: Failed to execute 'register' on 'ServiceWorkerContainer': This document requires 'TrustedScriptURL' assignment`.
- En hosts que procesan `_headers` (Netlify, Cloudflare Pages) el SW nunca se registra → sin precache, sin offline, sin caché. En hosts que ignoran `_headers` (nginx, GitHub Pages) no pasa nada → bug invisible en desarrollo.
- Combinación contradictoria: `trusted-types 'none'` prohíbe crear la política que el runtime necesitaría para el TrustedScriptURL.
- **Fix:** quitar ambas directivas trusted-types, o declarar `trusted-types solara` + crear la política en el runtime antes de `register()`.

### 2. Fotos servidas como PNG sin conversión a WebP → home de 4,5 MB
Las 6 imágenes de categorías son PNG originales (1024×1024, 468–794 KB). El pipeline conserva el formato en vez de convertir fotos opacas:
- Desktop (>1023px): `<picture>` con `type="image/png"` y candidato único `.png 1024w` (los PNG completos) → **home = 4.515 KB decodificados, 91% son esas 6 imágenes**.
- Móvil: carga `-768.png` de 310–500 KB → **home móvil = 2.955 KB**.
- Prueba de que son fotos opacas: el exportador ya genera `-fallback.jpg` de 39–73 KB por cada una (JPG no soporta transparencia).
- **Impacto:** LCP de la página más importante del sitio penalizado. Con WebP serían ~50–80 KB c/u (**4,1 MB → ~400 KB en desktop**).
- **Fix:** convertir a WebP todo PNG fotográfico opaco; PNG solo para gráficos con transparencia real. El markup `<picture>` ya existe, falta la variante `image/webp` en el source.

## P1 — Importantes

### 3. CSS duplicado byte a byte
`assets/storefront.e396f7d1529fc1f1.css` ≡ `assets/storefront-home.e396f7d1529fc1f1.css` (**idénticos, 211.679 bytes, verificado con FC**).
Home carga uno, resto del sitio el otro → navegar home↔categoría descarga 211 KB dos veces (sin reuso de caché).
**Fix:** un solo archivo/URL.

### 4. Pipeline responsive incompleto (vs. README: recetas 480/768/1200/1800)
Solo existen `-768.webp` (114) + base (~1717/1800w). Sin 480 ni 1200.
- Logo desktop: `sizes="12rem"` (192px) con único candidato 1800w → **96 KB por página** (debería ~10 KB con 480w).
- Hero móvil DPR3 (necesita ~1170w): srcset de un solo candidato (1717w, 83 KB); con 1200w sería ~40 KB.
- Los `sizes` declarados no tienen candidatos intermedios que aprovechar.
**Fix:** generar 480 y 1200 y ofrecer 3–4 candidatos por srcset.

### 5. Fallbacks PNG de tamaño completo = 22,5 MB de peso muerto
105 archivos `*-fallback.png` (22,46 MB, promedio 214 KB) como `src` de los `<img>`. **104 tienen WebP paralelo**; navegadores modernos nunca los piden. JSON-LD apunta a `.webp` y `og:image` a `-fallback.jpg`.
Ejemplo: producto `73b95e5b…`: webp 5,5 KB / `-768.webp` 3,5 KB / **`-fallback.png` 117,7 KB (21x, sin uso)**.
- 48% del peso total del sitio (46,5 MB). Afecta deploy, caché del SW (#6) y crawlers que resuelven el `src`.
- **Fix:** apuntar los `<img src>` de fotos al `-fallback.jpg` ya generado y eliminar los `-fallback.png` de imágenes opacas. **Deploy 46,5 MB → ~24 MB (con #2: ~12 MB).**

## P2 — Pulido

### 6. Caché runtime del SW sin límites
`sw.js:22-25`: `cache.put` de toda respuesta same-origin OK sin cuota ni eviction (HTML, imágenes, JSON). Con 46,5 MB presiona la cuota en móvil. Solo `/assets/*` tiene cache-first (`sw.js:20`).
**Fix:** LRU simple o restringir runtime cache a `/assets/`, índices JSON y `/offline/`.

### 7. Precache del SW no cubre la CSS de la home
`sw.js:2` precachea `/assets/storefront.css`; la home usa `storefront-home.css` (`index.html:38`). Primera visita offline a `/` = HTML sin estilos. Se resuelve con #3 + corregir lista.

### 8. Íconos y favicon sobredimensionados (~1 MB)
- `favicon.ico` = 90.151 B, **duplicado exacto** (SHA-256) en raíz y `assets/10e2f17f…-favicon-v1.ico`.
- `icons/icon-192.png` = 110,9 KB · `icons/icon-512.png` = **787 KB** (bien cuantizado: 15–40 KB).
- `manifest.webmanifest` sin `id`, sin `description`, sin icono `purpose:"maskable"`.
**Fix:** recomprimir (paleta 256), deduplicar favicon, agregar maskable + `id`.

### 9. Regex inválida en `pattern` del teléfono
`pattern="[0-9+ ()-]{8,}"` (drawer de checkout en las 183 páginas): **inválida en modo `v`** (Chrome/Edge modernos) → `SyntaxError: Invalid character in character class` en consola en cada validación, y la validación del teléfono queda silenciosamente deshabilitada (pattern no parseable = ignorado). **Verificado end-to-end: el checkout funciona igual** (por eso P2 y no P0).
**Fix:** `pattern="[\d+\(\)\- ]{8,}"` o validar solo en JS (ya normaliza con `replace(/\D/g,"")`).

### 10. Reglas muertas en `_headers` y `_redirects`
- `_headers:22-23`: cache-control para `/video-sitemap.xml` que **no existe** (tienda sin videos).
- `_redirects` vacío (solo comentario).

### 11. `/offline/` sin `noindex`
`404.html`, `/buscar/`, `/carrito/` tienen `noindex,follow` ✅. `offline/index.html` no tiene robots meta.

### 12. Ruido menor de metadatos
- `og:updated_time` con timestamp exacto de exportación (`index.html:26`: `2026-09-02T05:12:14.316Z`).
- `Access-Control-Allow-Origin: *` global (innecesario sin API).
- HSTS sin `includeSubDomains`; `img-src`/`media-src` permiten `http:`.

### 13. Duplicación inline menor
- `data-solara-copy` ~10,5 KB raw (~2 KB gz) × 181 páginas (340 KB total): mismo diccionario de textos en todas las rutas; podría ser recurso cacheable.
- `catalog-index.json` se fetchea **2 veces** al cargar página de producto.

### 14. Ajuste fino de metas
14 títulos >60 chars (máx 67); 8 descripciones <70 chars. No urgente.

## Lo que está muy bien (verificado)

| Área | Resultado |
|---|---|
| Integridad de enlaces | **13.239 verificados, 0 rotos** |
| Consola JS (sin CSP) | 0 errores en home, categorías, producto, búsqueda, carrito, 404 |
| Checkout WhatsApp | End-to-end OK: mensaje completo (ítems, SKU, total `$ 7.700` bien formateado, datos cliente, disclaimer), fallback `mailto:`, validación de formulario |
| SEO on-page | 182/182 páginas con 1 `h1`; title+description en 100%; canonical self + `rel prev/next` en paginación; `noindex` correcto en buscar/carrito/404 |
| JSON-LD | WebSite+SearchAction, OnlineStore+MerchantReturnPolicy, Product completo (Offer, shippingDetails, Brand, Speakable, BreadcrumbList) — válido y consistente con HTML |
| XMLs | sitemap 179/179 URLs resueltas con lastmod; merchant válido (166 ítems, 1 por variante); image-sitemap y feed válidos |
| Agentes/AI | robots+sitemap, `llms.txt`, `llms-full.txt`, `ai-context.json` bien estructurados |
| Imágenes de producto | WebP 10–20 KB, srcset/sizes correctos, lazy en grids, width/height explícitos (CLS contenido), alt en todas |
| LCP hero | `preload as=image` + `fetchpriority=high` al mismo recurso que pinta el `<picture>` (sin doble descarga) |

## Resumen de impacto

| Fix | Esfuerzo | Ganancia |
|---|---|---|
| #2 PNG→WebP fotos categorías | Medio (pipeline) | Home desktop **4,5 MB → ~600 KB** |
| #5 eliminar fallback PNG muertos | Bajo | Deploy **46,5 MB → ~24 MB** (con #2: ~12 MB) |
| #3 unificar CSS | Bajo | -211 KB por navegación cruzada |
| #1 CSP × Trusted Types | Bajo (editar `_headers`) | PWA/offline revive en producción |
| #4 variantes 480/1200 | Medio | Logo 96→~10 KB; hero móvil 83→~40 KB |

## Pendientes / próximos pasos

- [ ] Decidir si los fixes se aplican como post-proceso de esta exportación o como cambios en el fork de SolaraCommerce (exporter).
- [ ] Si post-proceso: script que (a) convierta PNG fotos → WebP y reescriba los `<picture>`, (b) unifique CSS, (c) reemplace `<img src>` fallback PNG→JPG y borre PNGs muertos, (d) edite `_headers` (CSP), (e) recomprima íconos, (f) corrija pattern, (g) agregue noindex a /offline/.
- [ ] Re-test con CSP aplicada tras fix #1 (SW debe registrar sin errores).
- [ ] Lighthouse contra sitio servido (pendiente; no corrido en esta pasada).
- [ ] Verificar en catálogo real si las fotos compartidas entre productos hermanos justifican los og:image JPG compartidos (17 JPGs para 166 productos).
- [ ] Opcional: revisar por qué el pipeline no generó 480/1200 (¿configuración o bug del exporter?).

## Artefactos de la auditoría (en temp, pueden no persistir)

- `C:\Users\PiPa\AppData\Local\Temp\opencode\runtime-audit.js` + `runtime-desktop.json` + `runtime-mobile.json` (métricas por página)
- `...\cart-test.js`/`.json` (carrito), `...\wa-test*.js` (checkout), `...\csp-server.js` + `csp-test.js` (CSP real), `...\static-server.js`, `...\linkcheck.ps1`
- Servidores detenidos; nada fue modificado dentro de la carpeta del sitio (solo lectura).

---

# AUDITORÍA #2 — Scope ampliado (2026-09-02)

**Cambios de scope:** se incluye diseño/UX/contenido (antes excluido). **Host objetivo confirmado: Cloudflare Pages** (esto activa y agrava hallazgos de la #1). Prioridad de negocio: SEO → Performance → Google (Shopping) → Seguridad.
**Método adicional:** Lighthouse 13.4.1 (7 páginas × móvil/desktop, 14 corridas), métricas CDP con throttling Slow-4G + CPU 4x y repeat-view, verificación binaria de dimensiones de imágenes, parser JSON-LD completo en 182 páginas, grafo de enlaces interno, validación UTF-8/IDs/headings, análisis estático de seguridad del runtime, 10 payloads XSS en 2 endpoints, edge cases de carrito (huérfano, precio 0, 30 ítems reales), pruebas sin JavaScript, Firefox real, análisis visual de 10 capturas (desktop/móvil/dark).
**Artefactos persistentes:** carpeta `auditoria-2/` — `findings.json` (machine-readable), `lh/*.json` (14 corridas Lighthouse), `lh-issues.json`, `cdp-metrics.json`, `image-dims.json`, `seo-deep.json`, `linkgraph.json`, `xss-tests.json`, `flows.json`, `wa-bulk.json`, `crossbrowser-firefox.json`, `nojs.json`, `screenshots/` (10 PNG). Scripts reproducibles en temp (`lh-run.ps1`, `cdp-metrics.js`, `img-dims.js`, `seo-deep.js`, `linkgraph.js`, `sec-static.js`, `xss-test.js`, `flows-test.js`, `wa-bulk.js`, `crossbrowser.js`, `nojs-test.js`, `screenshots.js`).

## Nuevos hallazgos (P1 → P3)

### A2-P1 · Cache-Control de assets ROTO en Cloudflare Pages (semántica Netlify en host CF)
El `_headers` está escrito con semántica Netlify (la regla más específica gana por header). **Cloudflare Pages joinea headers duplicados con coma** (doc oficial): un request a `/assets/x.webp` recibe
`Cache-Control: public, max-age=0, must-revalidate, stale-while-revalidate=86400, public, max-age=31536000, immutable`.
El primer `max-age` gana (RFC 7234) → **los assets hasheados se revalidan en cada visita**. Combinado con el P0 #1 (SW muerto por la CSP del mismo archivo), el sitio en Cloudflare pierde TODO el caching de repeat-view diseñado.
**Fix:** usar la sintaxis de detach de CF (`! Cache-Control` antes de la directiva) en cada regla específica (assets, sitemap, merchant, índices).
*Impacto medido del combo:* repeat-view con SW funcionando = **LCP 44–64 ms** (CDP); en Cloudflare tal como está, repeat-view ≈ primera vista con 304s.

### A2-P1 · LCP móvil de categorías: 8,1 s + doble descarga del banner
Lighthouse móvil categoría = **8,1 s LCP (perf 74)**; CDP 4G+CPU4x = 5,9 s. Causa: banner PNG completo (478 KB en Bolsas) como LCP. Encima, **el `<link rel="preload">` apunta al PNG completo pero en móvil el `<picture>` elige `-768.png`** → descarga 478 KB (sin usar) + 312 KB (usado) ≈ 790 KB solo para el banner en cada categoría móvil.
**Fix:** preload con `imagesrcset`/`imagesizes` espejando el `<picture>` + conversión WebP (ver P0 #2 de la auditoría #1, mismo árbol de causa).

### A2-P1 · Mensaje de WhatsApp supera el límite práctico en pedidos grandes
Medido con 30 ítems reales del catálogo (×2 u): **URL de 4.548 chars** (>4.096 práctico de wa.me). 15 ítems = 2.536. Tienda B2B → pedidos grandes son el caso normal.
**Fix:** compactar mensaje (SKU opcional ~30 chars/ítem, truncar lista con contador, agrupar por producto).

### A2-P2 · `og:image` con dimensiones mal declaradas (27 páginas)
Declaran 1200×630; los archivos reales miden 768×403 o 768×768 (categorías con imagen cuadrada). Previews sociales pueden recortar mal. *(4.798 descriptores srcset y 2.399 ratios width/height verificados binariamente: 0 discrepancias — el problema es solo og.)*

### A2-P2 · `priceValidUntil` hardcodeado: 2026-12-31 en las 166 ofertas
Fecha fija de exportación. Tras esa fecha Google puede marcar precios stale en Shopping. Requiere re-export antes; el exporter debería derivarla (exportación + 90 días).

### A2-P2 · Modo oscuro declarado pero desactivado
El CSS incluye el sistema dark (2 bloques `prefers-color-scheme` + 25 usos de variables dark), pero cada página emite `data-color-mode="light"` fijo. Captura dark ≡ captura light. El README del fork declara modo oscuro; el selector fue deshabilitado por decisión documentada (deuda F4). Decidir: respetar `prefers-color-scheme` o quitar el claim.

### A2-P2 · Contenido/UX con severidad media-alta
- Card **"Papelería y Varios" sin imagen** en el bento de la home (asimetría vs otras 5 categorías).
- **"Entrega: A coordinar"** en carrito/checkout sin explicación ni link — fricción B2B real.
- **Selector de variante "Única" redundante** en las 166 fichas (todas mono-variante).

### A2-P2 · Falta `X-Robots-Tag: noindex` para `*.pages.dev`
Recomendación oficial de CF para evitar indexación del host alterno (los canonicals ya mitigan). Regla de 2 líneas en `_headers`.

### A2-P3 · Pulido (resumen)
- a11y: label-content-name-mismatch en botón carrito (WCAG 2.5.3, flag en 12/12 páginas).
- CLS 0,136 en buscar-desktop (inyección de resultados; reservar altura).
- Búsqueda: cap 48 sin mensaje "Mostrando N" visible; title/h1 no reflejan la query (noindex → cosmético).
- Móvil: hamburguesa ~24 px (<44 px), hero H1 en 4 líneas empuja el CTA bajo el fold, barra de aviso corta texto, filtros colapsados por defecto.
- Desktop: acordeones de envíos/cambios cerrados en ficha; sin CTA secundario en hero; paginación sin saltos numéricos; footer: email gmail + branding de plataforma en 182 páginas.
- Info: `postMessage(..., "*")` solo relevante en preview de Studio; SW `CACHE_NAME` no deriva del `revision` del deployment-manifest.

## Verificado OK en esta pasada (además de lo positivo de la #1)

| Área | Resultado |
|---|---|
| Lighthouse | TBT **0 ms** en las 14 corridas; perf desktop 93–100; a11y 100; BP 100; SEO 100 salvo noindex intencionales (69) |
| JSON-LD | 356 bloques parseados con parser real: 0 errores, 0 Product incompletos, 0 desvíos de precio vs `catalog-index.json` |
| Imágenes | 4.798 descriptores `srcset` + 2.399 ratios verificados contra dims binarias reales: **0 mentiras** (CLS contenido) |
| Grafo interno | 0 huérfanos; todo a ≤3 clics; inlink mínimo 2/producto; distribución sana |
| Higiene | UTF-8 estricto 0 errores / 0 BOM; 0 IDs duplicados; 0 saltos de heading; 0 títulos duplicados |
| Seguridad | 0 `innerHTML`/`eval`/`document.write`; `postMessage` valida `g.source===parent`; **10 payloads XSS × 2 endpoints: 0 ejecución/0 reflejo**; 880 `_blank` 100% con `noopener`; 0 beacons/tracking; hashes del deployment-manifest 6/6 |
| Flujos | Cantidad min=1/max=99 con clamps y subtotal exacto; carrito huérfano/fake → "Ya no disponible" + excluido del checkout (anti-manipulación OK); búsqueda ignora acentos/mayúsculas, parciales OK |
| No-JS | Spec cumplida: catálogo visible con precios sin JS en home/categoría/producto; búsqueda sin JS = limitación documentada del fork (C8) |
| Firefox | 0 errores de consola en 6 páginas, 0 imágenes rotas, SW activo |

## Limitaciones de la auditoría #2

- WebKit no ejecutable local (mismatch de revisión de playwright-core vs `webkit-2203`): **iOS Safari sin verificación directa** — riesgo residual.
- Checkout en Firefox no re-verificado (artefacto de test: el drawer auto-abre y el backdrop intercepta el click del header; en Chromium el flujo completo está verificado).
- Lighthouse sobre 404 corrido contra `/404.html` (LH no audita status 404). SEO 69 en buscar/carrito/404 = `noindex` esperado, no defecto.
- Un request fallido en Firefox a una URL de paginación sin origen identificado (probable heurística de prefetch; no reprodujo en Chromium; sin impacto).

## Prioridad de acción combinada (#1 + #2)

1. **`_headers`: CSP×Trusted-Types (P0 #1) + Cache-Control con detach CF (A2-P1)** — mismo archivo, mismo commit. Es lo que bloquea SW y caching en el host real.
2. **Imágenes: WebP para fotos + fallbacks livianos + preload con imagesrcset (P0 #2, P1 #5 de #1 + A2-P1 banner)** — mayor ganancia de peso/LCP (home 4,5 MB → ~600 KB; categorías móvil 8,1 s → ~2 s).
3. **CSS unificado (P1 #3)** y **variantes 480/1200 (P1 #4)**.
4. **WhatsApp: compactar mensaje (A2-P1)** antes de campaña de adquisición B2B.
5. SEO fino: og:image dims (A2-P2), priceValidUntil dinámico (A2-P2), X-Robots-Tag pages.dev (A2-P2), re-export antes de 2026-12-31.
6. Contenido: imagen de Papelería y Varios, texto de entrega, ocultar selector "Única", pulido móvil (A2-P2/P3).

---

## Resolución 2026-09-02 (rama auditoria-rm-fixes)

Cierre de ambas auditorías dentro del producto (exporter/Studio/runtime): el
sitio se regenera desde la tienda, no hay post-proceso de la exportación. Los
commits citados pertenecen a la rama `auditoria-rm-fixes`; la deuda aceptada y
el backlog nuevo quedaron registrados en `docs/TECHNICAL_DEBT.md`, el detalle
de usuario en `CHANGELOG.md` (2026-09-03) y la receta real de imágenes en el
`README.md`.

| Hallazgo | Resolución | Estado |
| --- | --- | --- |
| #1 P0 · CSP rompe el Service Worker | `_headers` sin `require-trusted-types-for`/`trusted-types` (`b9bcb686`); paridad idempotente en `_worker.js` (`b8812358`, `56c2baab`); verificador Cloudflare del Studio alineado (`87c0a8d3`). El SW vuelve a registrarse en el host que procesa `_headers`. | Resuelto |
| #2 P0 · fotos PNG sin conversión a WebP | Alfa real en el worker: escaneo del canal alfa (no el contenedor); fotos PNG opacas → fallback JPG + variantes WebP; AVIF aceptado como entrada; migración automática al abrir/guardar la tienda (receta `responsive-alpha-v2`) (`ec75220d`). | Resuelto |
| #3 P1 · CSS duplicada byte a byte | Una sola CSS pública cuando home y resto comparten bytes (bug del guard por ruta); el caso divergente sigue soportado (`fddd29fe`). | Resuelto |
| #4 P1 · pipeline sin 480/1200 | Decisión 2026-08-29: la receta pública sigue en 2 candidatos (768 + máxima ≤1800); no se generan 480/1200. El preload del LCP espeja el `<picture>` por `media` y elimina la doble descarga del banner móvil (`904af642`, `0744b668`). README actualizado a la receta real. | Aceptado como deuda |
| #5 P1 · fallbacks PNG de tamaño completo | Con alfa real, el `src` de las fotos es el fallback JPG y las variantes son WebP; los PNG completos dejan de viajar como `src` de `<img>` (`ec75220d`). | Resuelto |
| #6 P2 · runtime cache del SW sin límites | Allowlist del runtime cache: `/assets/`, índices JSON y `/offline/` (`1d2dcc79`). | Resuelto |
| #7 P2 · precache sin la CSS de home | El precache incluye la CSS de home cuando diverge de la del resto (`9e843b97`); con la CSS unificada el caso desaparece. | Resuelto |
| #8 P2 · íconos y favicon sobredimensionados | Íconos PNG cuantizados a paleta vía fflate, derivados del logo de la tienda cuando existe (icon-512 de 787 KB → ~349 B en sólido), manifest con `id`/`description`/`purpose` any+maskable, favicon sin copia duplicada y gate <60 KB (`c60b601f`, `e9104a67`). | Resuelto |
| #9 P2 · pattern de teléfono inválido | `pattern="[\d\+\(\)\- ]{8,}"` válido en modo `v` en drawer legacy, drawer V2 y checkout `/compra/` (`98807f07`). | Resuelto |
| #10 P2 · reglas muertas en `_headers` y `_redirects` | Regla de `/video-sitemap.xml` condicional a tiendas con videos (`b9bcb686`). `_redirects` vacío se mantiene por decisión argumentada. | Resuelto (headers) · Wontfix (_redirects) |
| #11 P2 · `/offline/` sin noindex | `offline/index.html` emite robots `noindex` (`c60b601f`). | Resuelto |
| #12 P2 · ruido de metadatos | `og:updated_time` eliminado, sin `Access-Control-Allow-Origin: *` global, HSTS con `includeSubDomains`, `img-src`/`media-src` sin `http:` (`b9bcb686`, `87c0a8d3`). | Resuelto |
| #13 P2 · duplicación inline menor | Doble fetch de `catalog-index.json` en página de producto eliminado (guard en la invalidación del memo). `data-solara-copy` inline se mantiene por decisión (~2 KiB gz por página, evita un fetch y flash de textos). | Resuelto (doble fetch) · Wontfix (data-solara-copy) |
| #14 P2 · ajuste fino de metas | Títulos de páginas acotados a ≤60 caracteres con `fitTitle` (límite de palabra, marca intacta) (`ac88f26a`). Las descripciones cortas (<70) dependen del contenido cargado por la tienda. | Resuelto (títulos) · Acción del dueño (descripciones) |
| A2-P1 · Cache-Control roto en Cloudflare Pages | Detach `! Cache-Control` por regla en `_headers` y `_worker.js` con headers de seguridad y Cache-Control por ruta idempotentes; paridad total testeada para advanced mode, donde CF no procesa `_headers` (`b9bcb686`, `b8812358`, `56c2baab`). | Resuelto |
| A2-P1 · LCP móvil de categorías + doble descarga del banner | Preload del LCP partido por `media` espejando el `<picture>` (`904af642`, `0744b668`) más WebP/JPG del pipeline de alfa real para el banner (`ec75220d`). | Resuelto |
| A2-P1 · mensaje de WhatsApp supera el límite | Mensaje compacto: dedupe de líneas, sin SKU, variante visible salvo unic[oa], tope de 25 ítems con aviso visible en el drawer, total real y builder único drawer/página; URL ≤4000 verificada con 30 ítems ×2 unidades (`98807f07`, `dc8e15bf`). | Resuelto |
| A2-P2 · og:image con dimensiones mal declaradas | Dimensiones reales en `og:image` y `og.jpg` 1200×630 (cover, q0.82) por imagen única vía `ExportOptions.socialImageCrops` (`0744b668`). | Resuelto |
| A2-P2 · `priceValidUntil` hardcodeado | Resuelto en el exporter: deriva de `updatedAt` + 90 días UTC (`1304d034`, `packages/exporter/src/structured-data.ts`). El sitio publicado sigue sirviendo `2026-12-31` hasta la re-exportación. | Resuelto (exporter) · Acción del dueño (re-export) |
| A2-P2 · modo oscuro declarado pero desactivado | CSS dark muerta eliminada (decisión F4, -1,4 KiB), `color-scheme` siempre light y budgets re-medidos; `data-theme` queda emitido pero inerte hasta el retiro T15 (`673a728a`, `d46b7138`, `a90ffaa3`, `868be5ec`). | Resuelto (claim removido) |
| A2-P2 · contenido/UX de severidad media-alta | Placeholder de tema para categorías sin imagen en el bento y selector "Única" oculto en productos mono-variante, resueltos en el producto (`77c9a0fc`, `dc8e15bf`). La imagen de "Papelería y Varios" y el texto de "Entrega: A coordinar" son contenido de la tienda. | Resuelto (producto) · Acción del dueño (contenido) |
| A2-P2 · falta X-Robots-Tag para `*.pages.dev` | Emitido por `_worker.js` (no vía dashboard), sumando el header sólo cuando falta (`b8812358`). | Resuelto |
| A2-P3 · a11y/UX de producto | aria-label del carrito con los tokens exactos del texto visible más el espacio en el markup (axe `label-content-name-mismatch` resuelto, gate E2E `axe-site.spec.ts` con `@axe-core/playwright`) (`70592d9d`, `77c9a0fc`); CLS de `/buscar/` ≈ 0 con 8 skeleton cards de estructura real y shimmer con reduced-motion (`77c9a0fc`); contador "Mostrando 48 de M" y `document.title` con la query; hamburguesa con hit-area ≥44px y clamp de hero móvil más compacto (`ac88f26a`); paginación numérica con elipses y `aria-current`; `CACHE_NAME` derivado del `revision` del deployment-manifest (`1d2dcc79`). El gate numérico de CLS quedó en backlog. | Resuelto (backlog: gate CLS) |
| A2-P3 · contenido/UX del dueño | Acordeones de envíos/cambios cerrados en ficha, CTA secundario del hero, barra de aviso que corta texto, filtros colapsados por defecto y footer (email gmail, branding de plataforma): contenido/copy de la tienda, sin cambio de producto en la rama. `postMessage(..., "*")` sólo aplica al preview del Studio, no al sitio público. | Acción del dueño · No aplica (preview del Studio) |

Backlog nuevo registrado en `docs/TECHNICAL_DEBT.md`: gate numérico de CLS para
`/buscar/` en el spec E2E de performance, mapear `/favicon.ico` en el preview y
parallelismo de `generateSocialCrops`.
