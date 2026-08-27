# Reporte de migraciones y rollout global

Fecha: 2026-08-27. Estado: infraestructura verificada; corrida real pendiente.

Existe un registro por `migrationId`, preview determinista, rechazo de IDs
desconocidos, conflictos por tienda y rollback condicionado a la versión
esperada. `site-rebuild` conserva el proyecto editable y actualiza el sitio
por una transacción protegida.

No se ejecutó un rollout autorizado sobre todas las tiendas del usuario en esta
sesión. Por eso no se afirma que Predeterminado, activas y archivadas hayan sido
reconstruidas globalmente; sólo el canary/factory aislado, el selector por
`migrationId` y los tests del controlador están verificados.
