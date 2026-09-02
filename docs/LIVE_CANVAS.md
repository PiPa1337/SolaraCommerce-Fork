# Live Canvas

Edición directa de contenido desde el preview, sin tocar el DOM como fuente de
verdad y sin metadata en el sitio exportado.

## Estado de esta entrega (2026-08-27)

Implementado y verificado: contrato editor-only en el SDK, bindings declarativos
para Catalog Modern, About V2, Contact V2 y la familia legacy, manifest
determinista con entidades de producto/categoría/colección/asset, bridge con
sesión/nonce anti-replay, edición de texto, rich text sanitizado, links,
imágenes, alt, precio entero y repeaters por ID. El padre aplica todo mediante
`ProjectMutationRegistry`, con undo/redo y persistencia de Studio. El smoke
directo pasó 129/129 con `--retries=0`; el spec de Live Canvas pasó 2/2 sin
reintentos.

Pendiente de certificación: una matriz E2E completa alineada con el contrato
actual de plantilla protegida y checklist, la prueba release bajo Node 24.x y el
rollout autorizado sobre tiendas reales.

## Arquitectura

- **Bindings declarativos**: cada módulo declara `canvasBindings` (id, label,
  kind, source, capabilities) en su `ModuleDefinition`. Los helpers
  `canvasTextAttributes` / `canvasImageAttributes` /
  `canvasRepeaterItemAttributes` emiten `data-canvas-*` **sólo** cuando el
  render context trae `canvas` (preview del editor).
- **Manifest editor-only**: `buildCanvasManifest` (exporter) devuelve las
  entries editables, las entidades reales y la cobertura por módulo, incluidos
  los IDs sintéticos de PDP y páginas de categoría/colección. `renderPreviewHtml`
  devuelve `{ html, canvasManifest }` sólo en editor; `exportProject` nunca
  incluye metadata del canvas.
- **Bridge seguro**: el iframe envía `{ type, session, nonce, editId,
  sectionId, itemId?, rect }`. El padre valida `event.source`, sesión activa,
  nonce (consume sólo después del manifest → anti-replay), schema y editId
  contra el manifest.
- **Mutaciones por el núcleo único**: cada edición produce
  `section.field.update` o `section.repeater.item.update` y pasa por
  `applyMutation` (`@solara/core`) → `StoreProjectV2Schema.parse` →
  historial/undo/redo → autosave. Canvas, sidebar y canal IA producen el mismo
  snapshot byte a byte (verificado con timestamp inyectado).

## Interacción

- Ctrl mantiene inspección (overlay rAF dentro del iframe); Ctrl+clic fija.
- Popover accesible en el padre con el valor real del proyecto; Escape cancela,
  Aplicar confirma. Coordenadas compensadas por zoom (50/75/100).
- Imágenes: selector de assets existentes. Repeaters: edición por itemId
  estable.
- Plantilla protegida: Predeterminado se puede inspeccionar pero no editar; el
  editor ofrece crear una tienda desde la plantilla. Las tiendas nuevas nacen
  con placeholders y se auditan como clean hasta reemplazarlos.

## Cobertura

Los módulos Catalog Modern, About V2, Contact V2 y legacy declaran bindings para
settings, repeaters y media donde el contenido es editable. Las entidades
reales se expanden por ID en el manifest: productos, categorías, colecciones,
assets e identidad; el PDP y las páginas generadas usan IDs sintéticos estables.
Los elementos derivados (por ejemplo, conteos, precios calculados, carrito y
iconos puramente decorativos) no se presentan como editables.
