# Reporte Live Canvas — cobertura

Fecha: 2026-08-27. Estado: cobertura declarativa ampliada; release aún parcial.

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
- `editor-metadata.test.ts`: 9/9; `canvasBridge.test.ts`: 9/9.
- `ProjectMutationRegistry`: 8/8; smoke directo sin retries: 129/129;
  `live-canvas.spec.ts`: 2/2.

## Pendiente

La suite E2E histórica completa todavía mezcla expectativas anteriores sobre
la demo, el checklist y nombres de chunks; la corrida sin retries se detuvo con
fallos reproducibles y no se declara verde. Node 22 y rollout sobre tiendas
reales siguen fuera de alcance/autorización.
