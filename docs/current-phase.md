# Fase activa

## Objetivo

Cerrar la candidata local de v1: proyecto validado, Studio, catálogo, módulos,
preview, carrito, WhatsApp, SEO, movimiento accesible y ZIP reproducible.

## Contratos congelados

- `StoreProjectV1Schema` es el límite de persistencia.
- `DomainCommand` es el límite de edición y undo/redo.
- `ModuleDefinition` es el límite de render visual.
- `ExportSnapshot` es el límite del exportador.

## Verificación

- Typecheck y Vitest por paquete durante el trabajo.
- Build completo y Playwright Chromium al cerrar la integración.
- Benchmark explícito con 1.000 productos fuera del bucle unitario.
- Lighthouse y matriz multi-browser quedan como gate de release, no como bucle
  local.

## Límite actual

La fase 8 requiere un dominio, Search Console y una cuenta Merchant reales. No se
simula localmente. El checkout exclusivo por WhatsApp se presenta como riesgo de
aprobación y no se oculta con reglas especiales.
