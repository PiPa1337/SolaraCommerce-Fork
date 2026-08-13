# Storefront Editorial V2

`catalog-modern-v2` es una familia visual reversible para tiendas que ya usan
los módulos Catalog Modern. Mantiene `schemaVersion: 2`, el catálogo, las
secciones, SEO, carrito y checkout; cambia la composición y los estados visuales.

## Activación

1. Abrir la tienda en Studio.
2. Entrar en **Tema**.
3. En **Familia visual**, elegir **Editorial V2**.
4. Revisar Preview en escritorio y móvil y guardar cuando el resultado sea el
   esperado.

La selección **Catálogo clásico V1** revierte la presentación sin migrar ni
eliminar datos. Las tiendas legacy que no usan Catalog Modern no reciben este
selector porque sus módulos no comparten este contrato visual.

## Diferencias intencionales

| Superficie | V1 | Editorial V2 |
| --- | --- | --- |
| Contenedor | compacto | editorial amplio, hasta 1760 px |
| Home | grilla comercial clásica | hero asimétrico, media 4:5 y ritmo abierto |
| Categoría | filtros en panel | rail desktop y sheet móvil sin scroll lateral |
| Producto | detalle compacto | galería 4:5 y resumen sticky en desktop |
| Carrito | drawer lateral | drawer de 520 px y sheet móvil |
| Checkout | formulario lineal | formulario + resumen lateral; flujo apilado móvil |
| Motion | transiciones base | appear progresivo, stagger, hover interno y header compacto |

El contenido permanece visible sin JavaScript. `prefers-reduced-motion` deja
todos los elementos en su estado final y elimina las transiciones espaciales.

## Gates actuales

- Preview y exportación comparten renderer.
- 1920x968 y 390x844 sin overflow horizontal en home, categoría, PDP, carrito y checkout.
- navegación por teclado, foco visible, nombres accesibles e IDs únicos;
- fallback de compra directa y navegación móvil sin JavaScript;
- canonical, Open Graph, sitemap y `noindex` de rutas transaccionales;
- benchmark de exportación de 2.000 productos bajo 30 segundos y 48 MiB;
- presupuesto público V2: CSS crudo hasta 104 KiB y runtime JS hasta 53 KiB.

La matriz Firefox/WebKit sigue siendo un gate de release y debe ejecutarse con
Node 22. No debe presentarse como validada desde un entorno Node 24.

## Evidencia visual

Las referencias aceptadas y sus reglas viven en
[`design-references/catalog-modern-v2/README.md`](design-references/catalog-modern-v2/README.md).
No se copian capacidades ficticias de esas imágenes al producto.
