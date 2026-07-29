# Checklist del piloto real

## Antes de publicar

- Usar exportación `production` con dominio HTTPS definitivo.
- Resolver todos los errores críticos del panel SEO.
- Comprobar títulos, descripciones, canonical, alt, precios y disponibilidad.
- Revisar políticas de entrega, devoluciones, contacto y privacidad.
- Ejecutar `check`, `build`, Playwright, benchmark, Lighthouse y la matriz de
  navegadores de release.

## Publicación

1. Publicar un único `site.zip` sin modificar sus archivos.
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
