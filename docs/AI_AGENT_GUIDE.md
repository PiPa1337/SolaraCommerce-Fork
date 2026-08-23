# Guía para agentes de IA de SolaraCommerce

Esta guía describe el canal nativo para crear y mantener tiendas sin editar
archivos a mano, sin escribir HTML/JavaScript y sin depender de la interfaz
visual. El agente opera sobre la misma aplicación portable y sobre el mismo
contrato `StoreProjectV2` que Studio.

## Inicio

Una distribución portable contiene `SolaraCommerce.exe`,
`SolaraCommerce-Agent.cmd`, `proyectos/`, `.solara-runtime/` y la carpeta
opcional `agent-inbox/`. El launcher inicia el ejecutable con
`--solara-agent --jsonl`; no abre una ventana, no inicia HTTP y reserva
`stdout` exclusivamente para respuestas JSONL. Los diagnósticos quedan en
`.solara-runtime/logs/main.log`.

`SolaraCommerce-Agent.cmd` usa JSONL por defecto. Para MCP, ejecutar
`SolaraCommerce-Agent.cmd --mcp`; implementa `initialize`, `ping`, `tools/list`
y `tools/call`. MCP y JSONL exponen las mismas operaciones.

## Ciclo obligatorio

1. Llamar `health`.
2. Llamar `stores.list`.
3. Llamar `stores.get` con `include: "summary"`.
4. Para una tienda existente, obtener `include: "catalog"` sólo si hacen falta
   IDs concretos y conservar la `version` recibida.
5. Crear un `plans.create` con operaciones explícitas.
6. Revisar el resumen del plan.
7. Ejecutar `plans.commit` sólo si el plan coincide con la intención del usuario.
8. Volver a `stores.get` y comprobar versión, conteos y estado.

Crear un plan no escribe. El commit vuelve a leer la versión, valida schema e
índices, exporta el sitio y publica una transacción atómica mediante el mismo
storage nativo de Studio.

## JSONL

Cada línea es un objeto JSON:

```json
{"id":1,"method":"health"}
```

Una respuesta exitosa tiene esta forma:

```json
{"protocol":"solara-agent","version":1,"id":1,"ok":true,"result":{"writable":true,"schemaVersion":2}}
```

Una respuesta fallida conserva un código accionable:

```json
{"protocol":"solara-agent","version":1,"id":2,"ok":false,"error":{"code":"VERSION_CONFLICT","message":"La tienda cambió desde la creación del plan; generá uno nuevo."}}
```

No parsear texto humano del proceso. `stdout` es protocol-only.

## Crear una tienda limpia

Una tienda nueva debe comenzar con `store.create`. La plantilla usa
`seed: "clean"`: no copia productos ni categorías de Predeterminado.

```json
{
  "id": "crear-1",
  "method": "plans.create",
  "params": {
    "idempotencyKey": "crear-lunaria-2026-01",
    "operations": [
      {"type":"store.create","storeId":"store-lunaria","name":"Lunaria Cerámica","brandName":"Lunaria","slug":"lunaria-ceramica","email":"hola@lunaria.example","phone":"5491122334455"},
      {"type":"category.create","categoryId":"category-tazas","slug":"tazas","title":"Tazas","description":"Piezas para todos los días."},
      {"type":"product.create","productId":"product-taza-luna","slug":"taza-luna","title":"Taza Luna","description":"Taza esmaltada hecha a mano.","priceCents":185000,"sku":"LUN-TZA-001","categoryIds":["category-tazas"],"tags":["cerámica","hecho a mano"]}
    ]
  }
}
```

El precio siempre es un entero en centavos ARS: `185000` significa `$1.850,00`.
Nunca enviar floats. Luego enviar el `planId` devuelto:

```json
{"id":"commit-1","method":"plans.commit","params":{"planId":"PLAN_ID_DEVUELTO","idempotencyKey":"crear-lunaria-2026-01"}}
```

Si la tienda recién creada todavía no puede exportarse a producción por falta
de contenido, el respaldo editable se conserva y la respuesta indica
`site-outdated`, `exportWarning` y la auditoría de draft. No fabricar datos para
ocultar esa advertencia.

## Tienda existente y protección

Las tiendas existentes requieren `storeId` y `baseVersion`:

```json
{"method":"plans.create","params":{"storeId":"store-lunaria","baseVersion":3,"operations":[{"type":"store.updateIdentity","changes":{"description":"Objetos cerámicos para rituales cotidianos."}},{"type":"product.setStatus","productId":"product-taza-luna","status":"active"}]}}
```

Predeterminado y cualquier proyecto cuyo origen no sea `seed: "clean"` queda
protegido por defecto. Se puede leer, pero intentar modificarlo devuelve
`PROTECTED_STORE`. Para trabajar sobre una referencia, crear otra tienda y
mantener intacto el proyecto original.

## Operaciones permitidas

El conjunto es cerrado: `store.create`, `store.updateIdentity`,
`store.updateSeo`, `category.create`, `collection.create`, `product.create`,
`product.update`, `product.setStatus` y `asset.attach`.

No existen `project.patch`, `file.write`, `html.inject`, `javascript.inject`,
`eval`, comandos shell ni mutaciones de componentes arbitrarios. El renderer y
la salida pública siguen perteneciendo a la aplicación.

## Imágenes

Para imágenes pequeñas, usar `assets.stage` con base64 y MIME:

```json
{"method":"assets.stage","params":{"name":"taza-luna.png","alt":"Taza Luna de cerámica azul","mimeType":"image/png","source":{"kind":"base64","data":"iVBORw0KGgo..."}}}
```

Para archivos grandes, copiar la imagen a `agent-inbox/` dentro del portable y
enviar sólo el nombre:

```json
{"method":"assets.stage","params":{"name":"hero.webp","mimeType":"image/webp","source":{"kind":"inbox","filename":"hero.webp"}}}
```

El host valida tamaño, firma binaria, MIME, SHA-256 y dimensiones reales de PNG,
JPEG, WebP o GIF. Staging no modifica una tienda. La respuesta devuelve
`assetId`; usarlo en el mismo plan:

```json
{"type":"asset.attach","assetId":"ASSET_ID","target":"product","productId":"product-taza-luna"}
```

También existen `identity.logo`, `seo.favicon` y `seo.social`. El staging vive
en memoria del proceso; si el proceso se cierra antes del commit, repetirlo.

## Errores y reintentos

- `VERSION_CONFLICT`: descartar el plan, leer la nueva versión y crear otro.
- `PROTECTED_STORE`: no insistir; trabajar sobre una tienda nueva.
- `PLAN_NOT_FOUND`: el proceso se reinició o el plan ya se consumió; crear otro.
- `ASSET_SIGNATURE_INVALID`, `ASSET_DIMENSIONS_INVALID` o `ASSET_USE_INBOX`:
  corregir el archivo o cambiar el transporte sin desactivar validaciones.
- Usar una `idempotencyKey` estable por intención. Repetir el commit con ella
  devuelve el recibo anterior y no crea otra versión.

La persistencia final conserva envelope `.solara.json`, SHA-256, manifest,
versiones, locks por tienda y rename atómico. El agente nunca escribe
directamente dentro de `proyectos/`, `actual/`, `respaldos/` o `sitios/`.

## Disciplina de una IA autónoma

Declarar antes de empezar la tienda objetivo, versión base y resultado observable.
Mantener la bitácora `intención → request → respuesta → evidencia posterior →
pendiente`. No inventar productos, precios, imágenes, números de WhatsApp ni
tokens SEO. No copiar el catálogo de Predeterminado para acelerar una tienda.
Un `plans.create` no demuestra persistencia: sólo `plans.commit` seguido de
`stores.get` confirma el cambio.

El contrato formal está en [`agent-protocol-v1.schema.json`](agent-protocol-v1.schema.json).
El runtime se divide en `packages/agent-contracts`, `packages/agent-control`,
`packages/agent-sdk` y `apps/desktop/src/agent-host.mjs`.
