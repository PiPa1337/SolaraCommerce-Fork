# Índice de documentación

Punto de entrada único para encontrar la doc activa en ≤2 saltos.
Los documentos históricos/auditorías cerradas viven en `docs/archive/`.

| Documento | Qué es | Cuándo consultarlo |
| --- | --- | --- |
| `AGENTS.md` (raíz) | Contrato operativo del repo | Antes de cualquier tarea |
| `ARCHITECTURE.md` | Capas, flujo de datos, ciclo de vida | Cambios de arquitectura o renderer |
| `PROJECT_MAP.md` | Mapa archivo → funcionalidad | Localizar dónde editar |
| `DATA_MODEL.md` | Contrato StoreProjectV2 y migraciones | Tocar schema o persistencia |
| `TESTING.md` | Gates, budgets y convenciones de test | Correr o agregar tests |
| `TECHNICAL_DEBT.md` | Deuda abierta/resuelta con evidencia | Antes de reportar un bug conocido |
| `INTEGRATIONS.md` | Servidor local, hash sha256, migración ZIP | Tocar persistencia o endpoints |
| `PORTABILITY.md` | Distribución portable Windows | Empaquetar o mover el portable |
| `STOREFRONT_V2.md` | Familia visual V2 y compatibilidad V1 | Trabajo de módulos/tema |
| `backup-and-recovery.md` | Respaldo `.solara.json` y recovery drafts | Flujos de guardado |
| `product-spec.md` | Spec de producto resumida | Contexto de negocio |
| `current-phase.md` | Fase actual del desarrollo | Orientación de sesión |
| `PERPETUAL_PLAN_APP_10X.md` | Plan QA perpetuo activo | Invocación "plan perpetuo" |
| `PERPETUAL_QA_BACKLOG.md` + `perpetual-state.json` | Backlog y estado del run perpetuo | Continuar el ciclo QA |
| `release-candidate.md` | Checklist de release | Cierre de versión |
| `pilot-checklist.md` | Checklist de export piloto | Validar exportaciones |
| `UI_SCALE.md` | Escala de espaciado y radios (editor + storefront) | Cambios visuales o CSS |
| `DEVELOPMENT.md` | Setup, estructura del monorepo, pipeline, comandos | Onboarding o referencia diaria |
| `STOREFRONT_ARCHITECTURE.md` | CSS del storefront: módulos, breakpoints, variables | Trabajo de estilos o módulos |
| `GUARDIANS.md` | Catálogo de specs guardianes (geométricos, adversariales, seguridad) | Antes de agregar tests o cambiar layout |

## Regla de archivo

Las auditorías puntuales y planes cerrados se mueven a `docs/archive/`
(ej: `PERPETUAL_PLAN_10X.md`, auditorías fechadas). No se borran: quedan
como referencia histórica fuera del nivel principal.
