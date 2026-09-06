# Almacenamiento comercial protegido

Este `proyectos/` es el almacenamiento persistente usado por
`Abrir SolaraCommerce.cmd`. Puede contener tiendas reales, respaldos y sitios
exportados y es la fuente comercial de verdad confirmada en disco.

No borrar, limpiar, reemplazar ni usar esta carpeta para fixtures o pruebas.
Los tests deben trabajar en directorios temporales. Cualquier reemplazo de este
árbol debe pasar por staging + rollback + verificación de hashes según
[`../docs/DATA_STORAGE_SAFETY.md`](../docs/DATA_STORAGE_SAFETY.md).

Git, `.release/`, `dist/` y `.solara-runtime/` no reemplazan un respaldo de esta
carpeta.
