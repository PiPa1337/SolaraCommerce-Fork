# Fase 8 completada: hardening y release candidate

## Objetivo

Endurecer Studio y el storefront frente a datos corruptos, respaldos
incompatibles, políticas de seguridad y regresiones de bundle sin cambiar los
contratos persistidos ni el formato público.

## Entregado

- La lista de tiendas valida cada registro con `StoreProjectV1Schema` y separa
  proyectos recuperables de registros incompatibles.
- Studio muestra los registros que requieren recuperación, conserva el original
  y permite importar un respaldo `.solara.zip` compatible desde el dashboard.
- La apertura de una tienda corrupta y la lectura de un ZIP inválido devuelven
  mensajes accionables sin sobrescribir datos.
- La importación valida ZIP, manifest, versión y proyecto antes de persistirlo.
- La pantalla de Recursos informa el uso de cuota local y permite limpiar sólo
  la caché regenerable de imágenes.
- El exportador publica `_headers` con CSP, Referrer-Policy, permisos mínimos y
  protección contra framing; `style-src-attr` queda limitado a las variables de
  movimiento declarativas del storefront.
- `check:budgets` mide el gzip de los bundles iniciales de Studio y bloquea el
  gate si supera 260 KiB de JavaScript o 100 KiB de CSS.
- El benchmark determinista conserva el stress test de 1.000 productos.

## Contratos preservados

- No cambian `StoreProjectV1`, `schemaVersion`, `DomainCommand`,
  `ModuleDefinition`, IDs ni formatos `.solara.zip` y `site.zip`.
- No se agregan dependencias de runtime ni servicios externos.
- El checkout, WhatsApp, SEO, Merchant, preview, undo/redo y exportación
  mantienen el comportamiento de las fases anteriores.

## Verificación de cierre

- `corepack pnpm check`
- `corepack pnpm build`
- `corepack pnpm check:budgets`
- `corepack pnpm benchmark:export`
- `corepack pnpm test:e2e` (17/17 Chromium)

## Próxima fase

Release candidate reproducible: matriz opcional de navegadores, auditoría de
accesibilidad y Lighthouse, manifiesto de release, backups documentados y
pruebas finales antes del piloto real.
