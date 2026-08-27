# Reporte Quality Forge visual

Fecha: 2026-08-27. Estado: verificado en Chromium.

`quality-forge-visual.spec.ts` cubre 7 viewports (1920, 1440, 1280, 1024, 768,
390 y 320), cinco paletas oficiales, reduced motion, no-JavaScript, foco y
overflow. El spec V2 completo pasó 41/41 y el smoke crítico 129/129.

Las capturas generadas por barridos visuales son artefactos ignorados. La matriz
Firefox/WebKit y la certificación Node 22 quedan sin ejecutar en este host.
