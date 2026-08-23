# Fase actual

## Estado (2026-08-22)

El proyecto pasó tres auditorías sistemáticas que cerraron la deuda técnica
crítica y establecieron guardianes automáticos permanentes.

### Lo que está sólido

- **Storefront V2**: 11 rutas × 19 viewports sin overflow, gaps en escala rem,
  imágenes WebP responsive automáticas, checkout con feedback de carrito vacío.
- **Studio**: dark-only, jerarquía tipográfica clara, tabular-nums, hover
  visible, salud compacta móvil.
- **Guardianes automáticos**: alignment.spec.ts + storefront-alignment.spec.ts
  (geometría real), __bugs__/ (5 specs adversariales), check:image-budget.mjs.
- **CI**: Windows (gates completos) + Linux portabilidad + specs adversariales.

### Predeterminado como plantilla placeholder

La tienda Predeterminado es una **base generadora**: 5 productos genéricos
("Producto 1"..."Producto 5"), 2 categorías, textos instructivos en hero y
secciones. El usuario abre, reemplaza placeholders y publica. Sin contenido
demo que borrar. Seed: `"placeholder"` en el schema Zod.

### Pendiente conocido

- LCP del hero depende del peso de imagen que suba el usuario (el pipeline
  optimiza pero no puede reducir un PNG de 10MB a <100KB mágicamente).
- Specs unitarios del exporter inestables bajo carga paralela (timeout 5s,
  documentado en TECHNICAL_DEBT.md).
- Jerarquía tipográfica en páginas legales (privacidad/términos) es funcional
  pero básica.
