# Handoff de SolaraCommerce

> Histórico archivado. Este archivo se usó una sola vez como traspaso puntual y ya no se mantiene.
> El detalle completo queda en el historial de git (`git show HEAD:HANDOFF.md` previo a este commit).

## Estado actual
SolaraCommerce es un estudio local-first (Catalog Modern V2) que edita identidad/productos/categorías/assets/SEO, hace preview y exporta sitio estático a `proyectos/<tienda>/sitios/`. Checkout vía WhatsApp. Ver `README.md` y `docs/product-spec.md`.

## Fuente de verdad
- `AGENTS.md` — reglas operativas
- `docs/ARCHITECTURE.md` + `docs/PROJECT_MAP.md` — arquitectura y mapa de extensión
- `docs/DATA_MODEL.md` — `StoreProjectV2` / `schemaVersion: 2`
- `docs/TESTING.md` — gates
- `docs/TECHNICAL_DEBT.md` — riesgos abiertos

Para historia detallada ver `CHANGELOG.md` y `git log`.

## Decisión vigente: plantilla protegida y rollouts

`store-modo-sur-demo` es una plantilla visible de sólo lectura. Las tiendas
nuevas se clonan con IDs y assets independientes. Los cambios de renderer se
distribuyen mediante reconstrucción de sitios; los cambios persistidos usan
migraciones tipadas con preview, conflictos, backups y rollback. El canal nativo
expone `templates.*` y `rollouts.*` con scopes separados; no usar parches JSON ni
escritura arbitraria para modificar la base.
