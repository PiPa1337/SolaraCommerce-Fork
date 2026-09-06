# Almacenamiento comercial protegido

Este `proyectos/` es el almacenamiento persistente usado por
`Abrir SolaraCommerce.cmd`. Durante y después de la migración desde la portable
puede contener tiendas reales, respaldos y sitios exportados.

No borrar, limpiar, reemplazar ni usar esta carpeta para fixtures o pruebas.
Los tests deben trabajar en directorios temporales. Cualquier reemplazo de este
árbol debe pasar por staging + rollback + verificación de hashes según
[`../futuraeliminaciondeportable.md`](../futuraeliminaciondeportable.md).

`desktop:package` no copia este almacenamiento a la distribución portable.
Una distribución empaquetada futura mantiene sus propios datos aislados y
regenerables; nunca reemplaza ni supera a este `proyectos/` como fuente comercial
activa.
