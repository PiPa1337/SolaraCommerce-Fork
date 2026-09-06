# Reporte de chaos, seguridad y recuperación

Fecha: 2026-08-27. Estado: focal verificado.

- Exporter/storage: conflictos 409, locks, EPERM transitorio, ENOSPC, fsync,
  manifest inconsistente y rollback del sitio pasan en las suites focales.
- Canvas: sesión vieja, nonce inválido/reutilizado, `event.source`, editId
  desconocido, itemId no declarado y payload inválido son rechazados.
- Sanitización: texto/URL y CSV hostil pasan los mutation-killers existentes.
- Portable: dos copias, carpeta movida, perfil aislado, agent JSONL y nueva
  tienda pasan.

La simulación de volumen lleno/permisos OS y reinicio durante rollout sigue
reservada para el job Windows de release.
