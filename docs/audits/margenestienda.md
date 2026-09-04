# Auditoría de márgenes reales — sitio exportado RM Descartables

> **EDICIÓN FINAL** (`docs/audits/margenestienda.md`, aprobada por el usuario).
> 4 rondas de investigación: (1) código + mediciones deterministas, (2) visión con capturas, (3) estados dinámicos/overlays, (4) internos de componentes y verificación de extremos.

- **Tienda:** `rm-descartables--704e2877` (portable: `.release/portable/SolaraCommerce-Portable/proyectos/`)
- **Sitio analizado:** `sitios/rm-descartables-2026-09-03T02-10-36-730Z-v000061` (v000061, export del 2026-09-03 02:10 UTC, la última versión)
- **Familia de diseño:** `catalog-modern-v2` (clases activas en el HTML: `solara-page catalog-modern catalog-modern-v2 cm v2`, `data-design-family="catalog-modern-v2"`)
- **Fecha de auditoría:** 2026-09-03
- **Método:** (1) extracción posicional de reglas CSS con contexto de `@media` y orden de cascada; (2) medición determinista con Chromium headless + `getComputedStyle`/`getBoundingClientRect` sobre ~120 elementos en 10 páginas × múltiples viewports; (3) análisis visual de 17 capturas full-page por subagente de visión, contrastado contra los números; (4) medición de posiciones x/y para gaps de grillas y ritmo vertical. Todo read-only: no se modificó ningún archivo del sitio, la portable ni el repo. Las capturas quedaron en `%TEMP%\opencode\_qa\`.

---

## 1. Inventario de páginas: 182 en 9 tipos + 404

| # | Tipo de página | Cantidad | Inspección realizada |
|---|---|---|---|
| 1 | `/` (home) | 1 | Código + capturas 1440/768/390 |
| 2 | `/productos/<slug>/` | **166** | 1 muestra ×3 viewports (plantilla única verificada) |
| 3 | `/categorias/<slug>/` | 6 | `bolsas` ×3 viewports |
| 4 | `/categorias/<slug>/pagina/N/` | 4 | `pagina/2` desktop (idéntica a categoría) |
| 5 | `/buscar/` | 1 | ×3 viewports |
| 6 | `/carrito/` | 1 | ×3 viewports |
| 7 | `/privacidad/` | 1 | ×2 viewports |
| 8 | `/terminos/` | 1 | ×2 viewports (misma plantilla legal) |
| 9 | `/offline/` (fallback del service worker) | 1 | Código + desktop |
| — | `/404.html` | 1 | ×2 viewports |

Los 182 `index.html` comparten **un único CSS**: `assets/storefront.e396f7d1529fc1f1.css` ≡ `storefront-home.e396f7d1529fc1f1.css` (211.679 bytes, contenido idéntico verificado). No hay CSS externo por página. Los bloques `<style>` inline solo ocultan el link de búsqueda (`catalog-search-link{display:none}`) y, en producto, muestran el botón fallback del carrito — no tocan contenedores ni insets.

El JS público es `assets/storefront.f095c111fb17350d.js` (40 KB).

## 2. Arquitectura del sistema de márgenes (código)

### 2.1 Variables raíz (generadas desde el theme de la tienda)

| Variable | Valor en esta tienda | Origen |
|---|---|---|
| `--solara-container` | `1760px` | `theme.container: 1760` |
| `--solara-padding-x` | `1rem` | `theme.spacing?.containerPaddingX ?? "1rem"` |
| `--solara-space-scale` | `1` | `theme.spacingScale: 1` |
| `--solara-section-y` | `clamp(3rem, 6vw, 6rem)` | default (no definido en el theme) |
| `--solara-card-gap` | `clamp(1rem, 2vw, 2rem)` | default |
| `--catalog-v2-wide` | `var(--solara-container, 1760px)` | styles.ts v2 |
| `--catalog-v2-space` | `var(--solara-space-scale, 1)` = 1 | styles.ts v2 |

Fuente de la generación: `packages/exporter/src/index.ts:806-808` (defaults) y `:851-856` (inyección en `:root`). Base box-sizing `* { box-sizing: border-box }` en `:890`; regla `.solara-container` base en `:902`.

### 2.2 Fórmula horizontal v2

Todas las secciones usan `width: min(calc(100% − G), var(--catalog-v2-wide))` centrado con `margin-inline:auto` → **el aire por lado = G/2** (el rem del calc es el aire *total*, no por lado).

Cascada final por viewport:

| Viewport | G | Aire por lado | Alcance |
|---|---|---|---|
| >1808px | cap 1760px | **(vw−1760)/2** (80px en 1920; 400px en 2560) | todas las secciones |
| ≥768px | 3rem | **24px** | header, hero, secciones, newsletter, footer, product-detail/tabs/reviews, mains con container |
| ≤767px | 1.5rem | **12px** | todo lo anterior |
| ≤339px | 0.75rem | **6px** | solo el grid del módulo de productos (`[data-solara-module="catalog-product-grid"]>.catalog-product-grid-section`) |

Excepciones: hero del home en móvil es **full-bleed (0px)**; barra de anuncio **full-bleed** siempre; `main` del home y de producto no lleva `.solara-container` (secciones auto-insetadas); los mains de categoría/buscar/carrito/legales/404 **conservan** `padding-inline:1rem` del `.solara-container` base → contenido a **40px** (desktop/tablet) y **28px** (móvil).

Fuente de las reglas v2: `packages/modules/src/styles.ts` desde la línea 2701 (template `"catalog-modern-v2"`): gutters 3rem en `:2749/2836/3035/3475/3483/4185/4192/5113/5270/5276/5538`, 1.5rem en `:3090/3846/3917/4003/4637/4645/4815/5161/5341/5349`, 0.75rem en `:4179`.

## 3. Márgenes horizontales medidos (aire izquierdo = derecho, simétrico en todos los casos)

| Elemento | 1440 | 768 | 390 | 1920 | 2560 | 339 |
|---|---|---|---|---|---|---|
| Anuncio (barra superior) | 0 (full-bleed) | 0 | 0 | 0 | 0 | 0 |
| Header (`.catalog-header-inner`) | 24 | 24 | 12 | 80 | 400 (cap) | 12 |
| Hero home | 24 | 24 | **0 (full-bleed)** | 80 | 400 | — |
| Grid productos home | 24 | 24 | 12 | 80 | 400 | **6** |
| Newsletter (tarjeta oscura) | 24 | 24 | 12 | 80 | 400 | 12 |
| Footer | 24 | 24 | 12 | 80 | 400 | 12 |
| Ficha producto (`.catalog-product-detail`) | 24 | 24 | 12 | 80 | 400 | — |
| Galería producto móvil | — | — | 12 (figura 13, borde 1px) | — | — | — |
| **Main categoría/buscar/carrito/legales/404 (contenido efectivo)** | **40** | **40** | **28** | — | — | — |
| Intro legal (columna máx 832px centrada) | 304 | — | 28 | — | — | — |
| **Relacionados ("También puede interesarte")** | **56** | — | **44** | — | — | — |
| Offline (body padding) | 32 | — | — | — | — | — |

Detalle de la doble anidación de relacionados (verificado aritméticamente): `main` full-width → `div.solara-container` (w = vw−32, +16 de padding interno) → sección del grid con `width:min(calc(100% − 3rem), …)` → 16+16+24 = **56px** en desktop; 16+16+12 = **44px** en móvil.

## 4. Ritmo vertical (medido y con regla atribuida)

| Elemento | Desktop 1440 | Tablet 768 | Mobile 390 | 1920/2560 | Regla que gana |
|---|---|---|---|---|---|
| Anuncio (alto) | 36px | 36 | 48 (texto 2 líneas) | 36 | v2 `min-height:36px`; padding interno fijo **48px lateral** incluso en móvil |
| Header (alto) | 76px → **60px scrolleado** | 76 | **64** | 76 | v2; `[data-scrolled]` lo aplica el runtime JS |
| Secciones (`padding-block`) | **86.4px** (6vw) | 48 (floor 3rem) | 48 | **96px** (cap 6rem) | regla final v2 `padding-block:var(--solara-section-y,…)` (invalida la de 4.6vw) |
| Newsletter margen inferior / padding | 47.5 / 32px | 25.3 / 20 | 20.8 / 18.4 | 52.8 / 32 | `clamp(1.3rem,3.3vw,3.3rem)` / `clamp(1.15rem,2.6vw,2rem)` |
| Footer padding-top / bottom | 66.2 / 32px | 35.3 / 32 | 32 / 32 | 73.6 (cap 4.6rem) / 32 | `clamp(2rem,4.6vw,4.6rem)` / 2rem |
| Hero-copy home (padding interno) | asimétrico ~48/60/34/56 | reducido | 4.5rem·1.25rem·2.25rem (≤450: 3.5rem·0.75rem·1.5rem) | — | v2 clamp por lado |
| Hero móvil alto | — | — | 688px (cap 43rem de la fórmula 82svh) | — | v2 `min-height:clamp(35.5rem, min(82svh, 100vw·16/9), 43rem)` |
| Producto: detalle interno | gap 2-4rem, padding-block 4vw=57.6px, info sticky top 24px | gap 3rem | columna única, gap 1.25rem, galería 4:3 máx 300px | — | v2 |
| Categoría: layout | sidebar **270px**, **gap real 16px** | 190-230px | 1 columna | — | `gap:calc(1rem*v2-space)` final (invalida el clamp 4vw=57.6px) |
| Categoría: toolbar | min-height 54px, margin-bottom 28px | — | — | — | v2 |
| Legales: intro padding | 64px (cap 4rem) | — | 40px (floor 2.5rem) | — | `clamp(2.5rem,5vw,4rem)` |
| 404 padding-block | 128px | — | 128px | — | base |
| Breadcrumbs | padding-top 24px | 24 | 24 | — | base |
| Contacto home (form↔canales) | gap horizontal 72px (5vw) | — | gap vertical 40px (2.5rem) | 80px (cap 5rem) | v2 |

**Ritmo del home (posiciones y reales):** anuncio 36 → header 76 → hero → bento → grid → newsletter → contacto → footer, **todos con 0px de gap entre módulos**; el aire vertical proviene exclusivamente de los paddings de sección (86.4/96px) y del margin-bottom del newsletter (47.5px).

## 5. Grillas de productos (gaps reales medidos por posición x/y)

| Grilla | Columnas | Gap col / fila real | Regla que gana |
|---|---|---|---|
| Home destacados, 1440 | 5 (255px c/u) | **28.8px** / 28.8 | `gap:calc(var(--solara-card-gap)·v2-space)` → `clamp(1rem,2vw,2rem)`@1440 |
| Home destacados, 390 | 2 (175px) | **16px** / ~16 | misma regla, floor 1rem (invalida el `2rem .7rem`) |
| Home destacados, 2560 | 5 (326px) | **32px** (cap 2rem) | ídem |
| Categoría, 1440 (junto a sidebar) | 4 (247px) | 28.8 / 28.8 | ídem (invalida el `2rem 1.5rem`) |
| Relacionados, 1440 | 4 (310px) | 28.8 / 28.8 | ídem |
| Relacionados, 390 | 2 (143px) | 16 | ídem |

## 6. Overlays medidos (con interacción real)

| Overlay | Desktop 1440 | 600–767px | ≤599px |
|---|---|---|---|
| Cart drawer (`.catalog-cart-drawer`) | panel fijo derecho **520px**, padding **40px** (cap 2.5rem de `clamp(1.5rem,3vw,2.5rem)`) | `width:min(520px, 100%−3rem)` → deja 24px de aire | **fullscreen** (100dvh), padding **16px** |
| Menú móvil (`.catalog-mobile-menu__panel`) | — | — | fullscreen 390×844, padding 0 (el padding interno lo llevan los elementos) |

## 7. Trazabilidad al código fuente del repo

| Valor medido | Archivo fuente | Referencia |
|---|---|---|
| `--solara-container: 1760px`, `--solara-padding-x: 1rem`, `--solara-section-y`, `--solara-card-gap` | `packages/exporter/src/index.ts` | defaults `:806-808`, inyección `:851-856`, regla `.solara-container` con `padding-inline` `:902` |
| Markup `<main class="solara-container …">` (origen del +16px) | `packages/exporter/src/index.ts` | categoría `:1945`, buscar `:2257`, carrito `:2284`, legales `:2325/:2629`, 404 `:2641` |
| Todas las reglas `.cm.v2` (gutters 3rem/1.5rem/0.75rem, header 76→60, drawer 520, secciones, grillas) | `packages/modules/src/styles.ts` | template `"catalog-modern-v2"` desde `:2701` |
| Theme real de la tienda (container 1760, spacingScale 1, colores, tipografía) | portable `…/rm-descartables--704e2877/actual/rm-descartables-2026-09-03T02-10-36-730Z-v000061.solara.json` | bloque `"theme"` `:312-339` |

**Configurabilidad por tienda sin tocar código:** `theme.container`, `theme.spacingScale`, `theme.spacing.containerPaddingX` (¡controla el +16px de P1!), `theme.spacing.sectionY`, `theme.spacing.cardGap`. Esta tienda usa defaults en spacing.

## 8. Hallazgos

| # | Hallazgo | Severidad | Detalle |
|---|---|---|---|
| **P1** | Desalineación vertical de 16px en categoría, buscar, carrito, privacidad, términos y 404: el contenido arranca a 40/28px mientras header y footer están a 24/12px (dos líneas verticales que no coinciden, visible en capturas) | Media (estética) | Herencia de `padding-inline:1rem` del `.solara-container` base que v2 no anula en esos mains. El `:has()` de ≥1200px que lo anula no matchea (el módulo del grid no es hijo directo de main en categoría, verificado en DOM). Fix posible: `theme.spacing.containerPaddingX: "0px"` por tienda, o anular el padding en `styles.ts` v2 para `main.solara-container[class*="-page"]` |
| **P6** | Relacionados en producto con doble anidación: **56px/lado desktop y 44px/lado móvil** vs 24/12 del resto → tres líneas verticales distintas en la página de producto (24/24/56) | Media (estética) | Cadena: main → `.solara-container` (16+16) → sección con gutter 3rem/1.5rem |
| P2 | Hero home móvil full-bleed (0px) con copy a 20px interno | Info (diseño v2 intencional) | `width:100%`, `min-height:82svh` |
| P3 | Anuncio con padding lateral fijo 48px incluso en 390px → deja 294px útiles y el texto pasa a 2 líneas (alto 48px vs 36px) | Baja | `.catalog-announcement-inner { padding:.375rem 3rem }` base sin override móvil en v2 |
| P4 | Cart drawer desktop 520px con padding 40px; entre 600-767px deja 24px de aire; ≤599px fullscreen | Info | v2 `:130297/147614/149425/149660` |
| P5 | Reglas/vars muertas por cascada (4): padding de secciones 4.6vw, gap de grillas 2.4vw, gap de categoría-layout 4vw — invalidadas por reglas posteriores (`--solara-section-y`, `--solara-card-gap`, `1rem·v2-space`) — y la variable `--catalog-v2-reading` definida en styles.ts `:2717` con **0 usos** en el CSS compilado | Baja (deuda CSS) | Posiciones 114538/127721 vs 198182/200858 en el CSS compilado; var muerta verificada por búsqueda (0 matches de `var(--catalog-v2-reading`) |
| **P7** | Mega menú desktop desalineado: panel a 16px/lado (w=1408) con padding interno 56px → contenido a 72px del borde, vs logo a 24px y vs secciones a 24px. El panel además es 16px más ancho que el header (1408 vs 1392) | Media (estética) | Regla base `.catalog-mega-menu { width:min(container,100vw−2rem) }` que v2 no actualizó al gutter de 3rem |
| **P8** | Paginación de categoría centrada respecto del **main completo** (centro 720px) y no de la grilla de productos (centro 863px) → visualmente corrida ~143px a la izquierda de la columna de resultados | Baja (estética) | `a[rel=prev]` x=558 y `a[rel=next]` x=788 (pagina/2, 1440); el grupo prev/actual/next centra en 719.5 = centro del main (40..1400) |
| P9 | Padding vertical del hero **fluido por altura de viewport** (`svh`): top `clamp(1.5rem,4svh,3.5rem)`, bottom `clamp(.75rem,1.25svh,2rem)` → 36/12px a 900px de alto, 41/13px a 1024px | Info (diseño) | El aire interior del hero cambia con la altura de la ventana, no solo con el ancho |
| — | Refutaciones a la visión (la medición manda): la galería de producto móvil **no** es full-bleed (12px de aire, figura con borde 1px); la tarjeta oscura del newsletter **no** toca bordes (24px; lo full-width es su wrapper invisible) | — | — |

**Calidad:** 0 overflows horizontales en 320/390/768/1440/1920/2560, 0 errores de consola, 0 requests fallidos en todas las corridas. Sin asimetrías laterales detectadas. Targets táctiles de header/paginación de 44px.

## 9. Comportamiento dinámico

- El runtime agrega `[data-scrolled="true"]` al scrollear → header **76px→65px real** (min-height 60; la altura final la impone el contenido del brand), sticky en y=0, con blur + sombra. Verificado con scroll real a 400px.
- Dark mode: el theme declara `colorMode:"light"` → el root lleva `data-color-mode="light"` → **las reglas `prefers-color-scheme:dark` nunca aplican** en esta tienda (los margen no cambian).
- `prefers-reduced-motion` no altera márgenes.
- `--solara-chrome-height:116px` (generado en exporter `:857`) queda desalineado del chrome real v2 (36+76=112) — valor legacy sin efecto observado.

## 10. Ronda 3 — estados con interacción real (Playwright: clicks, scroll, carrito, búsqueda)

### 10.1 Mega menú desktop (navegación del header, 1440, abierto)

| Métrica | Valor medido | Comentario |
|---|---|---|
| Panel `.catalog-mega-menu` | x=16, w=**1408** (16px/lado) | Regla base `width:min(container, 100vw−2rem)` — v2 no la sobrescribe |
| Padding interno | **56px lateral** / 48 arriba / 24 abajo | `clamp(2rem,4vw,3.5rem)` etc. |
| Contenido real del panel | arranca a **72px** del borde | vs logo del header a 24px → **tercera línea vertical en desktop (P7)** |

### 10.2 Carrito con producto (página `/carrito/`, ítem agregado desde ficha)

| Métrica | 1440 | 390 |
|---|---|---|
| `.solara-cart-page-grid` | x=40 (P1 aplica), w=1360, padding-block 32/115.2px | x=**28** (P1 aplica), w=334, padding-block 24/64 |
| Líneas `[data-cart-lines]` | w=896, línea con padding-block **20px** | w=334, apilado sobre el resumen |
| Resumen `.solara-cart-summary` | x=1016, w=384, **gap línea↔resumen 80px**, padding-left interno 57.6px | x=28, w=334, padding-top 32 |

El botón "Agregar" (`button.catalog-product-add[data-add-to-cart]`) abre el **drawer**, no navega: el carrito persiste (localStorage) y la página `/carrito/` lo muestra al entrar.

### 10.3 Drawer del carrito con ítem

- Desktop: panel 520px padding 40px → líneas a 48px del borde del panel (w=406).
- Móvil (fullscreen): padding 16px + padding interno del panel (pl 8) → líneas a **24px** del borde.
- **El checkout vive dentro del drawer** (`form.catalog-checkout-form#catalog-drawer-checkout`, `data-solara-checkout`): no existe página `/checkout/` — el flujo termina en WhatsApp desde el drawer y desde `/carrito/`.

### 10.4 Búsqueda con resultados (`/buscar/?q=bandeja`)

- Usa el **mismo layout de categoría**: sidebar 270px + gap 16px → resultados x=326 (w=1074) ✓ coherente con la página de categoría (P1 incluido: x=40 en el contenido).
- Form de búsqueda: max-width 1152px (72rem), x=40.
- Grilla de resultados: **5 columnas de 199px, gap ≈20px (1.25rem)** — distinto del gap de la categoría (28.8px): los resultados de búsqueda usan la plantilla de 5 columnas con gap propio.
- Empty state (sin resultados): padding-block 32px.

### 10.5 Comparación con la familia v1 (sitio demo exportado, `catalog-modern` v1)

| Aspecto | v1 (demo v000009) | v2 (esta tienda) |
|---|---|---|
| Gutter de secciones | `calc(100% − 2rem)` → **16px/lado** | 3rem → **24px/lado** |
| Cart drawer | 440px | 520px |
| Sidebar categoría | `minmax(190px,230px)` + gap 1.5-3rem | 270px fijo + gap real 16px |

### 10.6 Ausencias en esta tienda (CSS presente, HTML no renderizado)

Sin tabs ni reseñas de producto, sin WhatsApp flotante, sin páginas de checkout/contacto/nosotros (`navigation.showContact/showAbout: false`). Las reglas de `.catalog-product-tabs`, `.catalog-product-reviews`, `.solara-contact-page`, `.solara-about-page` y `.solara-checkout-page` están en el CSS pero quedan latentes.

## 11. Ronda 4 — internos de componentes y verificación final

### 11.1 Header, internos

| Elemento | 1440 | 768 | 390 |
|---|---|---|---|
| Brand (logo/texto) | x=24, 192×64 (gutter izquierdo ✓) | 192×64 | x=68, 128×43 (tras botón menú) |
| Nav desktop | x=965, w=154 (links 44px alto) | w=137 | oculto (menú móvil) |
| Acciones (búsqueda+carrito) | x=1161, w=255, terminan en vw−24 ✓ | w=149 | x=281, w=97, terminan en vw−12 ✓ |
| Gap nav↔acciones | 42px (clamp 3vw≈43) | — | — |
| Botón menú móvil | — | — | 44×44 (target táctil ✓) |
| Botón carrito | 86×44 | 86×44 | 42×44 |

### 11.2 Tarjeta de producto (internos)

- Estructura: `a.catalog-product-media` cuadrada 1:1 (255×255 en 1440; 175 en 390; borde 1px) + `div.catalog-product-card-copy` pegado debajo (sin gap): copy 118px de alto en desktop (incl. padding-top 12px de `.catalog-product-card-copy`), 85px en móvil. Sin padding lateral interno (el texto usa el ancho de la tarjeta).

### 11.3 Bento de categorías (home)

- Desktop 1440: **4 columnas de 339px, gap 12px** (0.75rem·v2-space, verificado: 24→375→726→1077), filas con alturas variables (grid dense).
- Móvil 390: 2 columnas de 179px, **gap 8px** (0.5rem).
- Tablet 768: 3 columnas de 232px, gap 12px.

### 11.4 Footer, internos

| Métrica | 1440 | 768 | 390 |
|---|---|---|---|
| Columnas | brand 336px + 4×232px, gaps **32px** | brand full + 2×348px | 1 columna apilada (≤560), gaps 24px |
| Brand block | padding-left **24px** + borde izquierdo accent 2px | pl 14.4px | pl 14.4px (clamp 0.9rem) |
| Botón WhatsApp | 256×44, x=50 (24 borde+padding +2) | ídem | ídem |
| Meta inferior | full-width del contenedor (1392) | 720 | 366 |

### 11.5 Grilla de productos del home — columnas reales por viewport

| Viewport | Columnas | Ancho tarjeta | Gap |
|---|---|---|---|
| 2560 | 5 | 326.4px | 32px (cap 2rem) |
| 1440 | 5 | 255.4px | 28.8px (2vw) |
| 768 | 3 | 229.7px | 15.4px |
| 390 | 2 | 175px | 16px (floor 1rem) |

(La fórmula compilada `repeat(auto-fill,minmax(min(100%/5,20rem),1fr))` produce esta escalera real; lo reportado es lo medido.)

### 11.6 Paginación (categoría con páginas)

- Botones prev/next: 83-93px de ancho × **44px alto**, padding 12.8/8px, borde 1px; la página actual ocupa el centro del grupo.
- Grupo centrado sobre el **main completo** (40..1400 → centro 720), no sobre la grilla de resultados (centro 863) → P8.

### 11.7 Legales (`.solara-legal-article`, presente en privacidad y términos)

- Columna de lectura **736px (46rem)** a x=40 (P1 aplica), padding-block **56px arriba / 80px abajo** (`clamp(2rem,5vw,3.5rem)` / `clamp(3rem,6vw,5rem)`).

### 11.8 Hero — padding interno real

| Viewport | padding-left/right | padding-top | padding-bottom | Origen |
|---|---|---|---|---|
| 1440×900 | 43.2px (3vw) | **36px** (4svh) | **12px** (1.25svh) | variante editorial v2, fluida por ALTURA |
| 768×1024 | 20px (2.5vw, regla ≤1199) | 40.96px (4svh) | 12.8px (1.25svh) | ídem |
| 390×844 | 12px (≤450: 0.75rem) | 56px (3.5rem) | 24px (1.5rem) | regla ≤450 |

### 11.9 Verificación de extremos finales

- **320px (producto):** overflow horizontal = **0**; la regla ≤339 del grid de relacionados se verifica empíricamente (grid a 6px/lado dentro de su cadena de anidación: x=38).
- **Módulos no usados en esta tienda** (reglas latentes): brand-strip, testimonials — el home no los incluye.

## 12. Resumen ejecutivo

El sistema de márgenes del sitio exportado es **consistente y reproducible**: un solo CSS compartido para las 182 páginas; fórmula v2 de gutter total (24px/lado desktop-tablet, 12px/lado móvil, 6px en ≤339px para el grid, cap 1760px — verificado hasta 2560px y a 320px sin overflow); ritmo vertical por clamps fluidos con 0px de gap entre módulos del home; grillas de producto con escalera real 5/3/2/5 columnas y gap 2vw (28.8px) / 1rem (16px); componentes internos alineados a sus contenedores (header, cards 1:1, bento 12px, footer 32px, paginación 44px, legales 46rem). El padding vertical del hero es fluido por altura (`svh`).

**Hallazgos a decidir (todos estéticos, fixes triviales vía theme `containerPaddingX` o una regla en `styles.ts`):**
- **P1** — container pages 16px más adentro que header/footer (40/28 vs 24/12).
- **P6** — relacionados con doble anidación (56/44px vs 24/12).
- **P7** — mega menú a 16px/lado + padding 56 → contenido a 72px, y panel más ancho que el header.
- **P8** — paginación centrada sobre el main, no sobre la grilla de productos (~143px corrida).
- **P3/P9** — observaciones de diseño (anuncio con 48px laterales fijos en móvil; hero fluido por `svh`).
- **P5** — deuda CSS: 3 reglas muertas + 1 variable sin uso (`--catalog-v2-reading`).

La auditoría queda cerrada en esta edición final.
