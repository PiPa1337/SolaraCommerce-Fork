# Mapa de referencia de SolaraCommerce

Este archivo es un punto de navegación. No replica schemas, métricas, versiones,
conteos de tests ni snapshots de implementación porque esos datos cambian y su
duplicación produjo drift documental.

## Orden de autoridad

1. [`../AGENTS.md`](../AGENTS.md): contrato operativo y reglas del repositorio.
2. [`INDEX.md`](INDEX.md): índice de la documentación activa.
3. Código, schemas y tests ejecutables: autoridad sobre el comportamiento real.
4. Documentos especializados: explicación estable por dominio.
5. `docs/archive/`: evidencia histórica; no define el estado actual.

Si este mapa contradice una fuente superior, prevalece la fuente superior.

## Producto y arquitectura

- [`product-spec.md`](product-spec.md): alcance y comportamiento del producto.
- [`ARCHITECTURE.md`](ARCHITECTURE.md): capas y flujo de datos.
- [`PROJECT_MAP.md`](PROJECT_MAP.md): archivo o paquete a tocar por funcionalidad.
- [`DATA_MODEL.md`](DATA_MODEL.md): `StoreProjectV2`, invariantes y migraciones.
- [`STOREFRONT_ARCHITECTURE.md`](STOREFRONT_ARCHITECTURE.md): arquitectura visual y CSS público.
- [`STOREFRONT_V2.md`](STOREFRONT_V2.md): familia Catalog Modern y compatibilidad.

## Operación y persistencia

- [`LOCAL_OPERATION.md`](LOCAL_OPERATION.md): launcher, layout local y diagnóstico.
- [`DATA_STORAGE_SAFETY.md`](DATA_STORAGE_SAFETY.md): reemplazos/migraciones seguras de `proyectos/`.
- [`backup-and-recovery.md`](backup-and-recovery.md): respaldos y recuperación.
- [`INTEGRATIONS.md`](INTEGRATIONS.md): servidor local e integraciones.
- [`AI_AGENT_GUIDE.md`](AI_AGENT_GUIDE.md): canal JSONL/MCP del agente.

## Desarrollo y calidad

- [`DEVELOPMENT.md`](DEVELOPMENT.md): setup y flujo de desarrollo.
- [`TESTING.md`](TESTING.md): única referencia detallada de gates, suites, workers y release QA.
- [`GUARDIANS.md`](GUARDIANS.md): specs guardianes y cobertura adversarial.
- [`TECHNICAL_DEBT.md`](TECHNICAL_DEBT.md): deuda conocida y evidencia de resolución.
- [`release-candidate.md`](release-candidate.md): cierre de versión.
- [`pilot-checklist.md`](pilot-checklist.md): validación de un piloto/export real.

## Diseño y edición

- [`UI_SCALE.md`](UI_SCALE.md): escala visual compartida.
- [`LIVE_CANVAS.md`](LIVE_CANVAS.md): edición directa desde Preview.
- `design-references/`: decisiones y referencias visuales específicas.

Para localizar cualquier documento activo o histórico, empezá por
[`INDEX.md`](INDEX.md). Los planes y auditorías cerrados se conservan en
[`archive/`](archive/) como evidencia, sin convertirlos en contrato vigente.
