# Fase 10 en curso: piloto real controlado

## Objetivo

Publicar una sola tienda production en un dominio HTTPS, verificar el recorrido
de indexación y Merchant en servicios reales y registrar límites del checkout
por WhatsApp sin cambiar el schema ni agregar módulos durante la observación.

## Fases anteriores cerradas

- Fase 8: recuperación, CSP, budgets y stress de 1.000 productos.
- Fase 9: release candidate, matriz de navegadores, auditoría de accesibilidad,
  Lighthouse, manifiesto y exportación de referencia.

## Preflight implementado

- `pilot:preflight` comprueba que production no tenga errores críticos, que cada
  oferta del snapshot aparezca una vez en Merchant, que sitemap, JSON-LD,
  canonical, robots y headers estén presentes y que el ZIP sea reproducible.
- `pilot-checklist.md` contiene los pasos externos que no se pueden simular
  localmente: dominio, HTTPS, Search Console, Merchant Center y diagnóstico de
  Rich Results.

## Contratos preservados

- No cambian `StoreProjectV1`, `schemaVersion`, `DomainCommand`,
  `ModuleDefinition`, IDs ni formatos `.solara.zip` y `site.zip`.
- No se agregan dependencias de runtime ni servicios externos.
- El checkout, WhatsApp, SEO, Merchant, preview, undo/redo y exportación
  mantienen el comportamiento de las fases anteriores.

## Verificación de fase

- `corepack pnpm check`
- `corepack pnpm build`
- `corepack pnpm check:budgets`
- `corepack pnpm benchmark:export`
- `corepack pnpm pilot:preflight`

La publicación real requiere el dominio y las credenciales del usuario. No se
automatiza desde este repositorio para evitar enviar datos a una cuenta o
dominio no autorizados.

## Próximo paso manual

Elegir el dominio y hosting, publicar `.release/site.zip`, ejecutar el checklist
y devolver los diagnósticos observados. Después se congela `schemaVersion: 1` y
se decide si la limitación de WhatsApp impide la aprobación Merchant.
