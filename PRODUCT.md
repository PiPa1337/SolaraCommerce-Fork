# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Una persona que crea y administra varias tiendas de ecommerce desde un entorno
local. Edita identidad, textos, imágenes, productos, categorías, navegación,
tema y SEO, y revisa el resultado antes de guardarlo o exportarlo.

## Product Purpose

SolaraCommerce es un estudio local-first para crear y mantener tiendas Catalog
Modern editables, revisar su Preview y exportar un sitio estático reproducible.
El checkout prepara un pedido y lo abre en WhatsApp; el producto no depende de
un backend remoto ni de pagos online.

## Positioning

La propuesta combina edición guiada y avanzada, Preview y exportación pública a
partir del mismo proyecto validado. La persistencia local administrada conserva
versiones y recuperación, mientras que el sitio publicado sigue siendo HTML,
CSS y JavaScript estático.

## Operating Context

El desarrollo y la operación local usan Windows, Node 24.x, pnpm y un servidor de
loopback iniciado por `Abrir SolaraCommerce.cmd`. `proyectos/` contiene las
tiendas confirmadas en disco. Studio, el agente nativo y la exportación comparten
el contrato `StoreProjectV2`, pero cada flujo conserva sus límites operativos.

## Capabilities and Constraints

- `StoreProjectV2Schema` es la autoridad persistida y `schemaVersion` permanece
  en `2` hasta una migración explícita.
- Preview y sitio público usan el mismo renderer de `@solara/exporter`.
- Catalog Modern V2 es la familia nueva; V1 se conserva por compatibilidad.
- Los precios son enteros en centavos y los IDs derivados se recalculan mediante
  el dominio o los helpers del schema.
- El HTML inicial debe seguir siendo útil sin JavaScript; teclado, foco visible,
  reduced motion y responsive son requisitos funcionales.
- `proyectos/`, backups, migraciones y datos de usuario no son caché descartable.
- El runtime público y sus presupuestos son contratos; no agregar dependencias de
  runtime sólo para mejorar una pantalla del editor.

## Brand Commitments

El nombre del producto es SolaraCommerce. La voz visible y los datos comerciales
pertenecen a cada tienda administrada; el agente no debe inventar marcas,
testimonios, métricas, logos ni claims para completar una interfaz.

## Evidence on Hand

La evidencia del producto está en `AGENTS.md`, `docs/ARCHITECTURE.md`,
`docs/PROJECT_MAP.md`, `docs/TESTING.md`, el schema y las implementaciones de
Studio, módulos, exporter y storefront runtime. No hay evidencia universal de
clientes, métricas comerciales o logos externos que pueda asumirse como real.

## Product Principles

- Un proyecto validado es la unidad común entre editor, Preview, exportación y
  persistencia.
- La operación local debe ser reversible, versionada y explícita.
- La UI debe seguir siendo comprensible, accesible y útil en los tres modos
  responsive contratados.
- Las mejoras visuales preservan producto, contenido, comportamiento y contratos
  salvo que la tarea autorice cambiarlos.

## Accessibility & Inclusion

Conservar navegación por teclado, nombres accesibles, foco visible, reduced
motion, contenido sin JavaScript y ausencia de overflow horizontal en la matriz
responsive definida por `docs/TESTING.md`.
