# Matriz de validación visual Catalog Modern

Esta matriz conecta las referencias congeladas con los recorridos que deben
revisarse antes de una publicación. No es un snapshot pixel-perfect: se valida
jerarquía, densidad, contenido real, accesibilidad y comportamiento responsive.

| Vista | Referencia | Estructura mínima | Desktop | Mobile | Estado verificable |
| --- | --- | --- | --- | --- | --- |
| Home | `home-desktop.png`, `home-mobile.png` | Promo, navbar, hero, marcas, grillas, categorías, confianza, CTA y footer | 4 columnas de producto | 2 columnas de producto | HTML completo sin JS, CTA visible, sin overflow |
| Categoría | `category-desktop.png` | Breadcrumb, filtros, toolbar, grilla y paginación | Sidebar y 3 columnas | Drawer/accordion y 2 columnas | Filtros no alteran URLs rastreables |
| Producto | `product-desktop.png`, `product-mobile.png` | Galería, precio, opciones, cantidad, compra, políticas, reseñas y relacionados | Galería + resumen en dos áreas | Galería apilada y controles táctiles | Variante directa, precio y disponibilidad coherentes |
| Carrito | `cart-mobile.png` | Líneas, cantidades, subtotal, entrega a coordinar y total estimado | Panel estable | Una columna sin desborde | Persistencia local y WhatsApp determinista |
| Preview Studio | Referencias públicas reutilizadas | Mismo árbol semántico que la exportación | Marcos desktop/tablet | Marco mobile | Sin `src` temporal, imágenes cargadas antes de inspección |

## Puntos de control comunes

- Contenedor máximo aproximado de 1.240 px y márgenes fluidos.
- Superficie blanca cálida, tinta negra, gris de media y color de estado sólo
  cuando comunica disponibilidad, error o valoración.
- Tipografía display pesada y texto de interfaz legible, sin descargar recursos
  remotos durante el primer paint.
- Touch targets de al menos 44 px, foco visible y navegación por teclado.
- Imágenes con `width`, `height`, `srcset`, `sizes`, `alt` y reserva de espacio.
- Movimiento reducido muestra el estado final; ningún contenido depende de
  JavaScript para ser visible o rastreable.
- La demo de escala y la plantilla limpia deben compartir esta matriz; la
  plantilla limpia no puede mostrar el nombre ni el catálogo de la demo.
