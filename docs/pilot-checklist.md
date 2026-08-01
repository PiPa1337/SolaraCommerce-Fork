# Checklist del piloto real

## Antes de publicar

- Ejecutar desde Node 22:

  ```bash
  corepack pnpm install --frozen-lockfile
  corepack pnpm check
  corepack pnpm build
  corepack pnpm check:budgets
  corepack pnpm benchmark:export
  corepack pnpm pilot:preflight
  corepack pnpm reference:export
  ```

  Para validar una tienda real desde su respaldo editable, usar
  `SOLARA_PILOT_PROJECT_ARCHIVE=ruta/a/tienda.solara.zip corepack pnpm
  pilot:preflight`. Sin esa variable el comando usa el fixture de referencia.

- Usar exportación `production` con dominio HTTPS definitivo.
- Resolver todos los errores críticos del panel SEO.
- Comprobar títulos, descripciones, canonical, alt, precios y disponibilidad.
- Revisar políticas de entrega, devoluciones, contacto y privacidad.
- Ejecutar el release candidate completo, incluyendo la matriz de navegadores y
  Lighthouse, antes de publicar.

## Publicación

1. Exportar la tienda elegida en modo `production` desde Studio y publicar un
   único `site.zip` sin modificar sus archivos. `.release/site.zip` del
   preflight sólo es el fixture de referencia.
2. Verificar el dominio en Search Console.
3. Enviar `/sitemap.xml` e inspeccionar home, categoría, producto y variante.
4. Crear una subcuenta Merchant para el dominio.
5. Conectar `/google-merchant.xml`.
6. Comparar productos, variantes, precios y stock entre HTML, JSON-LD y feed.
7. Registrar diagnósticos de Merchant y Rich Results sin introducir excepciones
   por producto.

## Seguimiento

Revisar cobertura, Core Web Vitals, rich results y diagnósticos Merchant durante
el piloto. No agregar módulos ni cambiar el schema hasta resolver los problemas
observados y documentar la decisión.

## Restricción comercial conocida

El pedido termina en WhatsApp y no constituye un checkout convencional dentro
del sitio. Google Merchant puede rechazar esta experiencia. El panel SEO lo
reporta como advertencia y el piloto debe validar el caso real; no se garantiza
la aprobación.
