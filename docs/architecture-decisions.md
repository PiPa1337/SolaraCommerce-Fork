# Registro de decisiones

## ADR-001: monolito modular

Se usa un workspace pnpm sin orquestador adicional. Los paquetes separan contratos
y pruebas, pero la aplicación se construye y distribuye como una unidad.

## ADR-002: schema como fuente única

`StoreProjectV1Schema` define tipos, validación, persistencia, importación y
exportación. Todo cambio incompatible requiere una migración probada.

## ADR-003: HTML estático Light DOM

El renderer usado por preview también produce el sitio público. JavaScript agrega
carrito, variantes y movimiento, pero no es necesario para descubrir contenido.

## ADR-004: módulos precompilados

Los módulos oficiales se compilan con Studio. Un módulo recibe contexto validado y
devuelve HTML seguro, CSS aislado por atributo raíz y assets conocidos.

## ADR-005: regeneración determinista

La exportación completa se regenera desde un snapshot inmutable. Se considerará
caché incremental sólo si 1.000 productos tardan más de cinco segundos sin contar
procesamiento de imágenes.

## ADR-006: movimiento progresivo

Las zonas animables pertenecen al contrato del módulo. Se usan CSS, Web Animations
API e IntersectionObserver, con estado final visible por defecto y reducción de
movimiento obligatoria.
