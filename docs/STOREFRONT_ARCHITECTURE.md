# Arquitectura visual del storefront

Este documento describe cómo se construye el CSS del sitio exportado, qué
módulos generan cada sección y qué convenciones de diseño seguir.

## Fuente del CSS

Todo el CSS del storefront se genera en un solo archivo:
`packages/modules/src/styles.ts`. Exporta `STORE_BASE_STYLES` (base) y
`MODULE_STYLE_BLOCKS` (por módulo). El exporter los combina en
`assets/storefront.css` vía `minifyCss()`.

El CSS usa el prefijo `[data-solara-store]` para aislar estilos. La familia
V2 añade la clase `.cm.v2` (~830 selectores). V1 legacy usa `.catalog-modern`.

## Variables del tema (inyectadas por el exporter)

```css
:root {
  --solara-background: ${colors.background};
  --solara-surface: ${colors.surface};
  --solara-text: ${colors.text};
  --solara-muted: ${colors.muted};
  --solara-accent: ${colors.accent};
  --solara-accent-alt: ${accentAltColor};
  --solara-border: ${colors.border};
  --solara-font-display: ${typography.display};
  --solara-font-body: ${typography.body};
  --solara-type-scale: ${typography.scale};
  --solara-line-height-tight: ${typography.lineHeightTight};
  --solara-line-height-body: ${typography.lineHeightBody};
  --solara-letter-spacing-display: ${typography.letterSpacingDisplay};
  --solara-font-weight-display: ${typography.fontWeightDisplay};
  --solara-font-weight-body: ${typography.fontWeightBody};
  --solara-space-scale: ${spacingScale};
  --solara-section-y: ${spacing.sectionY};
  --solara-card-gap: ${spacing.cardGap};
  --solara-radius: ${radius}px;
  --solara-container: ${container}px;
  --solara-border-width: ${borders.width};
  --solara-border-style: ${borders.style};
  --solara-shadow-card: ${shadows.card};
  --solara-shadow-elevated: ${shadows.elevated};
  --solara-shadow-overlay: ${shadows.overlay};
  --solara-motion-fast: ${motion.durationFast};
  --solara-motion-normal: ${motion.durationNormal};
  --solara-motion-easing: ${motion.easing};
}
```

Estas variables provienen del tema configurado en Studio (ThemeEditor). El
usuario cambia colores, tipografía y geometría sin tocar CSS; los presets y
otros clientes del schema también pueden configurar bordes, sombras y motion.
El acento alternativo alimenta acciones secundarias como el botón de WhatsApp;
si un respaldo antiguo no lo tiene, se deriva de los colores del mismo tema.

## Módulos por página

| Página | Módulos |
| --- | --- |
| Home | catalog-header, announcement-bar, catalog-hero, catalog-brand-strip, catalog-category-bento, catalog-product-grid ×N, catalog-testimonials, home contact-form + channels, catalog-newsletter-cta, catalog-footer |
| Categoría | catalog-header, category-hero, modernCategoryFilters + product-grid, catalog-footer |
| Producto | catalog-header, product-detail (galería + variantes + tabs), related-products, catalog-footer |
| Colección | catalog-header, collection-grid, catalog-footer |
| Búsqueda | catalog-header, search-results-grid, catalog-footer |
| Carrito | catalog-header, solara-cart-page, cart-drawer, catalog-footer |
| Checkout | catalog-header, checkout-form-v2 (fields + order-panel), catalog-footer |
| Contacto | catalog-header, contact-hero, form, channels, whatsapp-cta, purchase-info, faq, location, catalog-footer |
| Nosotros | catalog-header, about-hero, history, principles, editorial-image, process, manifesto, experience, team, stats, products-cta, catalog-footer |
| Legal (404) | catalog-header, error-hero o policy-page, catalog-footer |

## Breakpoints activos

| Breakpoint | Uso principal |
| --- | --- |
| max-width: 450px | Móvil chico: grillas 1 col, hero compacto |
| max-width: 640px | Móvil: salud compacta, stats apilados |
| max-width: 767px | Tablet portrait: nav móvil, drawer sheet |
| max-width: 900px | Grillas 2 col, filtros colapsados |
| max-width: 1023px | Pre-tablet landscape |
| max-width: 1024px | Tablet landscape: checkout apilado |
| max-width: 1100px | Contenedor reducido |
| max-width: 1199px | Pre-desktop: search 3 col |
| min-width: 1366px | Desktop grande: contenedor amplio |
| prefers-reduced-motion | Desactiva animaciones espaciales |

Los specs en `tests/e2e/__vision__/storefront-deep-vision.spec.ts` capturan
19 viewports que cubren todos estos breakpoints.

## Escala de espaciado (rem — respeta type-scale)

.25 / .5 / .75 / 1 / 1.25 / 1.5 / 2 / 2.5 / 3 / 4 rem

No introducir valores intermedios (.35/.55/.7/etc). El guard de budgets y los
specs geométricos detectan divergencias.
