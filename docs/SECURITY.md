# Seguridad del sitio exportado

El sitio público de SolaraCommerce es estático. No usa Pages Functions, secretos
ni un backend de pagos: el checkout abre WhatsApp y cada mensaje recibido debe
tratarse como información no confiable. El precio, stock, envío y pago se
confirman manualmente con la tienda; ningún total, checksum o referencia del
navegador constituye una prueba auténtica.

## Publicación en Cloudflare Pages

1. Exportá a una carpeta padre elegida en la app. La app crea una carpeta hija
   nueva con el modo y la fecha; subí únicamente esa carpeta hija.
2. No subas respaldos `.solara.json`, proyectos editables ni temporales.
3. Mantené Pages Functions ausentes. Los previews de Cloudflare son públicos por
   defecto: desactivalos o protegélos con Access y eliminá versiones antiguas.
4. Usá un dominio HTTPS y ejecutá el verificador de URL de Exportar después del
   despliegue. Si CORS o un Worker impide leer headers, el resultado queda como
   “no verificado”; usá los comandos `curl.exe` que muestra la app.

La exportación de producción incluye `_headers` con CSP, HSTS conservador,
`form-action`, `worker-src`, `manifest-src`, `font-src`, `nosniff`, anti-framing,
`sw.js` sin caché y recursos `/assets/` direccionados por contenido. El
`deployment-manifest.json` v1 identifica la revisión, las rutas runtime
hasheadas, hosts externos y hashes de archivos esenciales sin incluir datos
privados.

## Exposiciones deliberadas

`publicAiContext` permanece activado por defecto por compatibilidad. Antes de
exportar se advierte que publica contacto, políticas, SKUs, precios y productos
activos. Los medios HTTP/HTTPS externos se mantienen por compatibilidad, pero
cada host aparece como advertencia y puede recibir solicitudes de visitantes.

