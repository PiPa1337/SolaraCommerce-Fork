# Fase activa: catálogo local-first confiable

## Objetivo

Garantizar que el catálogo, las operaciones masivas, la importación CSV y el
autosave preservan siempre un proyecto válido y el último cambio confirmado.

## Alcance

- Integridad semántica de IDs, slugs, referencias, asignaciones y fechas.
- Comandos atómicos y reemplazo completo del catálogo con undo/redo.
- Editor de productos y todas sus variantes.
- Acciones masivas de estado, precios, categorías, colecciones y tags.
- Tabla paginada con 25, 50 o 100 filas.
- Selección independiente de página y resultados filtrados.
- Importación CSV con resumen, confirmación y cancelación sin cambios.
- Autosave serializado con debounce, coalescing, reintento y `flush()`.
- Tests de IndexedDB mediante `fake-indexeddb`.

## Contratos

- `StoreProjectV1` mantiene `schemaVersion: 1` y la misma forma serializada.
- `Product.categoryIds` y `Product.collectionIds` son la fuente canónica.
- Los índices inversos de categorías y colecciones son derivados.
- `DomainCommand` suma únicamente `products.replaceAll`.
- `ModuleDefinition`, ZIP público, `.solara.zip` y columnas CSV no cambian.

## Verificación

- `corepack pnpm check`
- `corepack pnpm build`
- `corepack pnpm benchmark:export`
- `corepack pnpm test:e2e`

Los E2E cubren edición y persistencia de variantes, cancelación y confirmación
de CSV, 1.000 productos, selección entre páginas y undo/redo.

## No objetivos

No se modifican módulos, constructor, recursos, SEO, Merchant, storefront,
animaciones ni formatos de exportación. Recuperación avanzada, alertas de cuota,
merge CSV, virtualización, backend y sincronización permanecen fuera de alcance.
