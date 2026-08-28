# Reporte Live Canvas — cobertura

Fecha: 2026-08-28. Estado: verificado localmente; la certificación release aún es parcial.

## Verificado

- `@solara/modules`: Catalog Modern, About V2, Contact V2 y legacy declaran
  `canvasBindings` para settings, repeaters y media.
- Entidades: identidad, productos, categorías, colecciones y assets se
  expanden en el manifest con IDs estables; el PDP generado también queda
  cubierto.
- Hero: título, eyebrow, body, CTA, media y slides; repeaters de categorías,
  beneficios, testimonios, contacto y assets conservan su `itemId`.
- `buildCanvasManifest` es determinista y `renderPreviewHtml` devuelve HTML +
  manifest sólo en modo editor.
- `editor-metadata.test.ts`: 9/9; `canvasBridge.test.ts`: 9/9; el registro
  compartido de mutaciones y sus suites focales permanecen verdes.
- `live-canvas-coverage.spec.ts`: 12/12; smoke directo sin retries: 129/129.
- Full E2E: 985/988 pasaron, 3 quedaron omitidos por contrato explícito, 0
  fallaron, con `--retries=0` y 2 workers.

## Pendiente

Node 22, Firefox/WebKit, la matriz OS de disco/permisos/reinicio y el rollout
sobre tiendas reales siguen fuera del host o de la autorización disponible.
Las timeouts observadas con 8/4 workers en la familia visual se clasificaron
como flake/contención de infraestructura: la familia aislada pasó 53/53 y el
full final a 2 workers quedó verde.
