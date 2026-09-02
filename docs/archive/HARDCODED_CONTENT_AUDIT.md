# Auditoría de contenido hardcodeado

Este documento define cómo detectar datos de una tienda que no deben quedar
embebidos en el producto. La fuente de verdad del storefront es el proyecto
`StoreProjectV2`: identidad, catálogo, assets, páginas, SEO, políticas,
`publicCopy` y settings de cada sección.

## Clasificación

- **Dato de tienda:** marca, slug, contacto, productos, categorías, imágenes,
  SEO, políticas y saludo de WhatsApp.
- **Copy público:** textos visibles para visitantes. El copy global vive en
  `project.publicCopy`; el copy específico de una sección vive en
  `StoreSection.settings`.
- **Plataforma:** la atribución de Solara y sus enlaces son deliberadamente
  fijos.
- **Contrato técnico:** `schemaVersion: 2`, IDs persistidos, rutas, aliases,
  sentinelas y capabilities. No se reemplazan con un search-and-replace.
- **Fixture/test:** datos deterministas que prueban escala, exportación o
  WhatsApp. Deben ser neutros en lo visible y nunca ser defaults de creación.

## Superficies revisadas

1. `packages/project-schema`: schema, defaults, seeds, fixtures y normalización.
2. `apps/studio/src`: mensajes del editor, creación de tiendas y controles de
   contenido global.
3. `packages/modules`: defaults y fallbacks de módulos públicos.
4. `packages/exporter`: HTML, metadata, JSON-LD, rutas y atributos del runtime.
5. `packages/storefront-runtime`: textos que se generan después de una acción.
6. `scripts`, `tests` y documentación: datos de prueba, contratos y referencias
   históricas.

## Gate

`scripts/check-hardcoded-content.mjs` ejecuta una búsqueda reproducible sobre
los archivos versionados. Reporta cada hallazgo con archivo, línea, categoría y
acción. En modo estricto falla si nombres, contactos, dominios o saludos demo
aparecen en código activo sin una entrada exacta en
`scripts/hardcoded-content-allowlist.json`.

La allowlist sólo admite literales puntuales con motivo. No se permiten
excepciones por carpeta completa. Los tests de salida también deben comprobar
que una tienda limpia y dos tiendas con identidades distintas no comparten
contenido.

El scanner incluye archivos tracked y nuevos archivos no ignorados, pero
clasifica como evidencia —no como filtración pública— los tests, fixtures,
documentación y la propia allowlist. En código activo sólo se permiten
contratos explícitos: IDs o nombres de migración, sentinelas de configuración,
prefijos de assets históricos y valores deterministas que nunca se copian al
seed limpio.

La revisión inicial cubrió estas decisiones:

| Hallazgo | Fuente válida | Tratamiento |
| --- | --- | --- |
| Marca, contacto, saludo o dominio de una tienda | identidad, `whatsapp`, SEO y `publicCopy` | eliminar fallback específico; personalizar desde el proyecto |
| CTA, labels y estados compartidos | `publicCopy` | editar desde `Contenido global` y transportar al HTML/runtime |
| Copy propio del hero, contacto o about V2 | `StoreSection.settings` | mantener en el inspector del módulo |
| `schemaVersion`, IDs persistidos, aliases y sentinelas | contrato técnico | conservar y documentar; no reemplazar con search-and-replace |
| Catálogo determinista de 50 productos y 16 categorías | `catalogScaleStore` | conservar estructura y neutralizar identidad visible |
| `Hecho con Solara` | plataforma | mantener fijo por decisión de producto |

Para validar aislamiento se usan el test de normalización de `publicCopy`, el
test de dos proyectos limpios de `catalog-modern-template.test.ts` y las
pruebas de preview/exportación del exporter. Si se agrega una nueva excepción,
debe indicar archivo, literal y motivo en la allowlist, además de una prueba
que demuestre que no llega a una tienda limpia.

## Regla de mantenimiento

Antes de agregar un texto visible, decidir si pertenece a settings de sección,
`publicCopy`, identidad/SEO/políticas o a la plataforma. Si no se puede señalar
una de esas fuentes, el cambio no está listo para commit.
