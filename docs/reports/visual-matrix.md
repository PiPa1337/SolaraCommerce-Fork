# Reporte Quality Forge visual

Fecha: 2026-08-28. Estado: verificado en Chromium.

`quality-forge-visual.spec.ts` cubre 10 viewports y 10 rutas, además de
paletas, reduced motion, no-JavaScript, foco y overflow. La matriz visual focal
pasó 27 pruebas; la auditoría profunda pasó 19 y la familia de visual-break
pasó 53/53 aislada. Axe pasó 1/1 sin violaciones. El full E2E final pasó
985/988, con 3 omitidas explícitamente.

Las rutas independientes de About y Contact retiradas en V2 se esperan como
404; no son regresiones. La familia visual tuvo timeouts bajo contención a 8/4
workers, pero no reprodujo el problema en aislamiento ni en el full final a 2
workers.

Las capturas generadas por barridos visuales son artefactos ignorados. La matriz
Firefox/WebKit y la certificación Node 22 quedan sin ejecutar en este host.
