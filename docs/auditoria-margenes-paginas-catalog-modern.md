# Auditoría de márgenes y padding - páginas Catalog Modern

Fecha: 2026-09-07

## Alcance

Revisión inicial de las 3 páginas principales del storefront:

- Home (`pageType: home`)
- Categoría (`pageType: category`)
- Producto (`catalog-product-detail`)

Las medidas se obtuvieron desde las reglas CSS del renderer compartido (`packages/modules/src/styles.ts`). Todavía no son mediciones de píxel del navegador; son los valores declarados que deben compararse con una captura/render real.

## Contenedor global

Selector:

```css
[data-solara-store] .solara-container
```

Medida:

- Ancho: `min(calc(100% - 2rem), var(--solara-container))`
- Margen horizontal: `auto`
- Padding lateral efectivo mínimo: `1rem` por lado

Estado: compartido entre páginas.

## Página Home

Componentes detectados:

| Componente | Margen | Padding |
|---|---:|---:|
| Hero / intro | variable | `clamp(4rem, 10vw, 8rem)` arriba, `clamp(3rem, 7vw, 6rem)` abajo |
| Secciones catálogo | variable | `clamp(3rem, 8vw, 7rem)` vertical |
| Contacto home | variable | `1.5rem 0` |

Observación:

La separación vertical usa valores fluidos con `clamp`, por lo que no tiene una distancia fija.

## Página Categoría

Componentes detectados:

| Componente | Margen | Padding |
|---|---:|---:|
| Intro categoría | `margin-top: .75rem` en título relacionado | `clamp(4rem, 10vw, 8rem)` arriba |
| Grilla productos | depende del contenedor | depende del módulo |
| Paginación | `margin-top: .8rem` | `0.5rem 0.75rem` elementos internos |

Observación:

Usa el mismo contenedor global que Home.

## Página Producto

Componentes detectados:

| Componente | Margen | Padding |
|---|---:|---:|
| Detalle producto | variable | depende del shell del módulo |
| Galería | `margin: 0` en corrección móvil | `0` |
| Relacionados | `margin-top: 3rem` en título | `padding-inline: 1.25rem` |

Observación:

El producto comparte estructura base pero tiene reglas específicas.

## Comparación preliminar

| Área | Home | Categoría | Producto |
|---|---|---|---|
| Contenedor horizontal | Igual | Igual | Igual |
| Padding lateral base | `1rem` mínimo | `1rem` mínimo | `1rem` mínimo |
| Separación vertical | Fluid | Fluid | Mixta |
| Sistema consistente | Sí | Sí | Parcial |

## Pendiente

Medir con navegador:

- bounding boxes reales (`getBoundingClientRect`)
- distancia entre secciones renderizadas
- padding computado final
- diferencias desktop/tablet/mobile

Esto permitirá comparar el CSS declarado contra el resultado visual real.

## Medición real del renderer (1440x900)

Fecha de medición: 2026-09-07

Se realizó una medición con navegador sobre el HTML generado por `renderPreviewHtml` usando Playwright. La lectura usa `getBoundingClientRect()` y `getComputedStyle()`.

### Resultado

| Página | Contenedor | Padding | Margen | Estado |
|---|---|---|---|---|
| Home | No apareció `.solara-container`; usa módulos a ancho completo | 0px en sections externas | 0px en sections externas | Estructura distinta |
| Categoría | `.solara-container` x=100, ancho=1240 | 16px lateral, 128px superior/inferior | 0px | Renderizó página de error por ruta no encontrada |
| Producto | `.solara-container` x=100, ancho=1240 | 16px lateral, 128px superior/inferior | 0px | Renderizó página de error por ruta no encontrada |

### Elementos compartidos detectados

| Elemento | Medida |
|---|---:|
| Barra superior | 44px alto |
| Header | 80px alto |
| Carrito flotante | 400px ancho, x=1482 fuera del viewport de 1440px |
| Panel checkout oculto | padding izquierdo 8px, derecho 16px |

### Hallazgo

La comparación todavía no es válida entre las tres páginas porque las rutas usadas para categoría y producto no generaron sus plantillas reales. La Home sí cargó Catalog Modern completo. Hay que medir con rutas válidas del `pages` generado para obtener los módulos reales de categoría y producto.
