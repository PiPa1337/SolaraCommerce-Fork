# Release candidate

La validación cotidiana usa sólo Chromium para mantener el bucle corto. El
release candidate ejecuta la misma suite sobre Chromium, Firefox y WebKit en un
workflow separado, manual o disparado por tags `v*`.

## Gate reproducible

Desde un checkout limpio:

```bash
corepack pnpm install --frozen-lockfile
corepack pnpm check
corepack pnpm build
corepack pnpm check:budgets
corepack pnpm benchmark:export
corepack pnpm playwright:install:release
corepack pnpm test:e2e:release
corepack pnpm reference:export
corepack pnpm release:manifest
```

El comando exige Node 22, igual que CI. Studio se valida en Chromium (la
combinación oficialmente soportada en v1); el storefront se repite en Firefox y
WebKit para cubrir Safari y Firefox sin convertir el procesamiento local de
imágenes en un requisito de esos navegadores.

`release:manifest` escribe `.release/release-manifest.json`, que no se versiona.
`reference:export` también deja `.release/site.zip` para revisar o publicar sin
modificar sus archivos. El manifiesto incluye versión, schema, commit, Node,
pnpm y los artefactos esperados; no incluye secretos ni datos de clientes.

## Lighthouse

Lighthouse se ejecuta sobre un `site.zip` de producción ya servido, no sobre el
editor local. Para mantener el runtime y la instalación base pequeños, el CLI
de Lighthouse no es una dependencia de Studio. En el equipo de release:

```bash
corepack pnpm reference:export
node packages/exporter/scripts/serve.mjs .release/reference-site 4174
# En otra terminal:
corepack pnpm dlx @lhci/cli@0.15.1 autorun --config=.lighthouserc.json
```

El archivo `.lighthouserc.json` fija las páginas críticas y los mínimos de
Performance, Accessibility, Best Practices y SEO. Si el hosting requiere un
dominio real, reemplazar únicamente la URL de colección; no alterar el HTML
generado para maquillar el resultado.

## Artefactos y fallos

El workflow conserva el manifiesto, el reporte HTML, traces y resultados durante
14 días. Un fallo de Firefox o WebKit bloquea el release candidate aunque
Chromium pase; se corrige la causa antes de publicar el piloto.
