# Diseño: catálogo completo en `/buscar/` para "Ver todos los productos"

Fecha: 2026-09-04
Estado: aprobado en sesión de brainstorming
Alcance: `packages/storefront-runtime`, `packages/exporter`, `packages/modules`

## Problema

El link "Ver todos los productos" (`publicCopy.navigation.viewAll`) apunta a
`/buscar/`, pero esa página con query vacío muestra el grid vacío: el runtime
sólo renderiza resultados cuando existe `?q=`. El usuario percibe que el link
"miente" y cae en una página de búsqueda sin contenido.

Causa raíz: no existe una página de catálogo completo; `/buscar/` con query
vacío es el único destino posible y hoy no puebla resultados.

## Decisión de diseño

Reutilizar `/buscar/` (sin rutas nuevas): cuando no hay `?q=`, el runtime hace
el mismo fetch a `search-index.json` y renderiza el catálogo completo paginado
client-side. Con `?q=` el comportamiento actual no cambia.

- Presentación minimal: h1 y copys de la página no cambian ("Buscar productos").
  Sólo se llena el grid y se agrega paginación.
- PageSize = `commerceTemplates.category.productsPerPage` (default 24, max 48).
- Cero cambios en `StoreProjectV2`, `publicCopy` ni migraciones.

## Comportamiento

1. Click en "Ver todos los productos" → `/buscar/` sin query → grid con la
   página 1 del catálogo y controles `‹ Página 1 de N ›`.
2. Filtros y orden existentes operan sobre **todas** las entradas (no sólo la
   página visible); la paginación es una ventana sobre el conjunto filtrado y
   ordenado.
3. Estado de página en la URL: `/buscar/?pagina=2` mediante `replaceState`
   (sin entradas de historial por página; back desde un producto vuelve a la
   página donde estaba el usuario porque la URL siempre refleja la página
   actual).
4. Deep-link: `/buscar/?pagina=5` renderiza directo la página 5.
5. `?q=` tiene precedencia: modo búsqueda actual (ranking top 48, sin
   paginación), `pagina` se ignora.
6. Sin JS: grid vacío (limitación C8 ya documentada, sin regresión).

## Cambios por paquete

### `packages/storefront-runtime/src/index.ts`

- En el bloque de búsqueda (rama `else` cuando no hay query): fetch a
  `search-index.json`, validación con `validSearchEntry` y render de todas las
  cards con el mismo markup del modo query (`.solara-search-result` con
  `data-product-card`, precio, disponibilidad, tags, opciones).
- La paginación vive DENTRO de `render()` del handler `[data-category-sort]`:
  después de filtrar y ordenar, si el grid tiene `data-products-per-page`,
  aplica la ventana de la página actual sobre `sorted` (visible en DOM) y deja
  el resto con `hidden`. Fuera de ese atributo, comportamiento intacto.
- Re-render de filtros/orden: clamp de página si el conjunto filtrado reduce
  totalPages; 0 resultados → `filterEmpty` visible y controles de paginación
  ocultos.
- Controles: `<nav aria-label>` (copy `export.pagination`) con `<button>`
  disabled (no `<a>` sin href) para anterior/siguiente (copys `export.previous`
  / `export.next`) e indicador "Página X de Y" (`export.pageOf`). Copys ya
  embebidos en `data-solara-copy` para `pageType: "search"` (rama default de
  `runtimeCopy` incluye `export`).
- Al cambiar de página: `replaceState` con `?pagina=N`, foco al indicador de
  página, scroll al inicio del grid respetando `prefers-reduced-motion`, y el
  count (aria-live) anuncia el cambio.
- Count: con pageSize presente, "N de M productos" refleja el conjunto
  filtrado completo (no la ventana); la posición la comunica la paginación.
- Parseo de `pagina`: entero ≥ 1; inválido o fuera de rango → clamp a [1,
  totalPages] (inválido puro → 1).
- Fallback: si falta `data-products-per-page` (export viejo mixto), usar 24.
- Noindex dinámico: también setear `noindex,follow` cuando hay `?pagina=` (hoy
  sólo lo hace `?q=`).

### `packages/exporter/src/index.ts`

- Página de búsqueda (~línea 2257): agregar `data-products-per-page` al
  contenedor de resultados (valor de `commerceTemplates.category.productsPerPage`).
- Agregar `data-category-total` al count de búsqueda para coherencia con
  categorías (runtime ya lo usa como total).
- Sin cambios de copys, h1, robots estáticos (la página sigue noindex,follow)
  ni JSON-LD.

### `packages/modules/src/catalog-modern.ts`

- Fix fallback: `catalogSearchHref` con búsqueda deshabilitada devuelve hoy
  `/categorias/` (ruta inexistente, 404 latente). Nuevo fallback: primera
  categoría raíz visible (`!category.parentId && category.status !== "hidden"`,
  mismo criterio que `emptyCartHref` del exporter en index.ts:2268), o `/` si
  no hay ninguna.
- Los hrefs `/buscar/` del mega menú y del bento ya están gateados por
  `searchEnabled`: sin cambios.

## Rendimiento

- `search-index.json` ya viaja completo para búsquedas: sin cambio de red.
- Imágenes lazy; el JSON no crece.
- `render()` re-apendea todas las cards por keystroke (min/max price): con
  catálogos grandes crece el costo DOM. Sin debounce inicial (YAGNI); follow-up
  documentado.
- Sin cap duro de productos (contradice "ver todos"); monitorear con
  `catalogScaleStore` (50 productos) y benchmark de export.

## Accesibilidad y contratos

- Botones reales con estado disabled, nav etiquetada, indicador con
  `aria-current` y announcements por el count aria-live.
- Foco visible y gestión de foco tras paginar; teclado navegable.
- Runtime serializado crece ~1-2 KB: verificar budget del string y benchmark.
- Exportes ya publicados no cambian (HTML inmutable); runtime nuevo con HTML
  sin el atributo usa el fallback 24.
- Búsqueda deshabilitada: visita directa a `/buscar/` puede seguir poblando si
  existen los hooks; los links internos van a la primera categoría.
- Diseño legacy: el bloque se activa sólo si existen `#solara-search-input` y
  `[data-search-results]`; degrada en silencio.

## Testing

- E2E nuevo (search habilitada): click "Ver todos" → grid poblado con
  `productsPerPage` cards, indicador "Página 1 de N", botón siguiente →
  `?pagina=2`, deep-link directo, filtro re-pagina y clampa, 0 resultados
  oculta paginación.
- E2E búsqueda deshabilitada: "Ver todos" apunta y aterriza en la primera
  categoría raíz visible; sin categorías → `/`.
- Test existente `tests/e2e/catalog-modern.spec.ts:371` (href `/buscar/` con
  search habilitada) debe seguir pasando.
- Unit/exporter: atributos `data-products-per-page` y `data-category-total`
  presentes en `/buscar/`; snapshot del fallback de `catalogSearchHref`.

## Documentación

- `docs/FULL_REFERENCE.md`: documentar `?pagina=` en la tabla de rutas.
- `CHANGELOG.md`: entrada de la mejora.
- `docs/TECHNICAL_DEBT.md`: actualizar la fila del fallback `/categorias/`
  (resuelto) y registrar el follow-up de debounce.

## Fuera de alcance

- Página dedicada de catálogo (`/productos/`), paginación server-side para
  búsqueda, cambios de copys/h1, SSR del query sin backend (C8), debounce del
  render.
