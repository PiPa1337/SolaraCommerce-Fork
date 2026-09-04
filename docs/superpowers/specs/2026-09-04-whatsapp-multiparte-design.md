# Diseño: checkout WhatsApp multiparte con subtotales

Fecha: 2026-09-04
Estado: aprobado en sesión de brainstorming + simulaciones ejecutadas
Alcance: `packages/storefront-runtime`

## Problema

El checkout del storefront termina en WhatsApp con `buildWhatsAppMessage`
(`packages/storefront-runtime/src/index.ts:395`). Ese builder:

- corta la lista en 25 renglones (`…y N productos mas`) usando sólo ~43% del
  presupuesto real de la URL `wa.me` (medido: 1673 de 3900 chars con 25 ítems);
- no muestra ningún precio por renglón: el vendedor recibe el total exacto
  pero **no sabe qué pide el cliente** en pedidos grandes.

Simulación ejecutada (catálogo estilo RM Descartables, 109–120 productos
distintos, cantidades 1–5, medición real con `encodeURIComponent`): el truncado
uniforme de títulos es ilegible (15 chars/renglón para meter 109) y el cap fijo
desperdicia presupuesto. La salida es multiparte.

## Decisión de diseño

Un renglón por línea de carrito (dedupeado por `productId`+`variantId`, **sin
agrupar variantes** — decisión explícita del dueño), cada uno con cantidad,
título, variante y **subtotal**, cortado en partes de hasta 50 renglones o
3900 chars de URL, lo que ocurra primero.

- Carrito chico (≤50 renglones y una sola parte bajo presupuesto): **un
  mensaje**, misma estructura que hoy + subtotales por línea. Sin headers de
  parte, sin ID, sin cambios visibles salvo los precios.
- Carrito grande: N mensajes secuenciales enviados con un botón por parte.
- El límite real de `wa.me` no está documentado (4096 es de la API Cloud, no
  del click-to-chat); el presupuesto es una **constante calibrable** y la
  completitud la garantizan las partes, no el presupuesto.

Cero cambios en `StoreProjectV2`, `schemaVersion` sigue en `2`, sin
migraciones. Copy inline es-AR (criterio de T6), sin tocar `publicCopy`.

## Formato de renglón (todas las partes)

`- {qty}x {Título}{ (variante)} = {subtotal}` con `formatMoney` y
`priceFractionDisplay` del proyecto:

- cantidad `1x` se omite (`- Papel aluminio 30m = $17.550`);
- variante `Única`/`Unica` se omite; variante que ya aparece como palabra
  completa en el título se omite (`\b`, case-insensitive: el talle `M` en
  `Remera` sí se muestra, `con tapa` en `Vaso ... con tapa` no); si no:
  `- 3x Vaso trago largo 220cc (x50) = $58.950`;
- SKU nunca aparece (aunque `includeSku` sea true, como hoy);
- títulos/variantes se sanitizan: collapse de whitespace (`\s+` → espacio),
  se eliminan `*` literales (protegen las negritas de WhatsApp) y se pliegan
  acentos latinos **excepto `ñ/Ñ`** (evita `año`→`ano`); datos del cliente
  (nombre, dirección, notas) se preservan verbatim con sus saltos de línea;
- subtotal = `unitPrice * quantity` en centavos enteros (nunca floats).

## Formato de partes

Primera parte (sólo ella lleva el saludo personalizado con la marca):

```text
*Pedido #A7F3 · Parte 1 de 3* — RM Descartables
Hola! Quiero hacer un pedido en RM Descartables

- 3x Vaso trago largo 220cc (x50) = $58.950
...

*Subtotal de esta parte: $1.882.000*
Sigue en la parte 2 →
```

Partes intermedias: mismo header numerado, sin saludo, con subtotal y
`Sigue en la parte N+1 →`. Última parte:

```text
*Pedido #A7F3 · Parte 3 de 3* — RM Descartables

...

*Total del pedido: $4.665.150*

Nombre: …
Teléfono: …
Entrega: …
Localidad: … (sólo si hay)
Código postal: … (sólo si hay)
Notas: … (sólo si hay)

El envío se coordina por este chat. {disclaimer}

✓ Fin del pedido (3/3)
```

- `#A7F3`: fingerprint djb2 de 4 hex del carrito (mismo en todas las partes;
  permite al vendedor agrupar y detectar mezclas si el carrito cambió).
- Los subtotales de parte suman el total exacto (verificación del vendedor).
- Datos del cliente, total y disclaimer **sólo** en la última parte.
- Negritas `*…*`: WhatsApp las renderiza como bold, costo 2 chars.
- Tope de 12 partes: si el carrito lo excede, la última parte vuelve al
  resumen `…y N productos más (incluidos en el total)` en vez de exigir
  clics absurdos.

## Flujo del drawer

1. Submit → `reconcileCart()` como hoy → `splitOrderParts()` → URLs por parte.
2. Botón submit reetiquetado: `Enviar parte N de M por WhatsApp`
   (`(final, con el total)` en la última). Estado con `role="status"`
   (aria-live) + nota visible sólo en multiparte:
   `El pedido se envía en M partes por WhatsApp. Estás en la parte N.
   El total viaja en la última parte.`
3. Al abrir WhatsApp se persiste `{ fp, sent: N, total: M, ts }` en
   `localStorage` (`solara-wa:<storeId>`, TTL 24 h). Al volver el foco a la
   pestaña se refrescan etiquetas sin avanzar solo (el avance ocurre al abrir).
4. Si el carrito cambió (fingerprint distinto) o venció el TTL: reset a parte
   1 con aviso `El carrito cambió: reenviá desde la parte 1`. Link discreto
   `Empezar de nuevo` para reinicio manual.
5. Botón secundario `Copiar pedido completo`: copia al portapapeles el mensaje
   íntegro (todos los renglones con subtotal + total + cliente) para pegar en
   otro canal; con fallback `execCommand` y anuncio del resultado. Reutiliza
   el mismo generador de texto.
6. Sin JS: link estático actual de un mensaje (sin regresión).

## Cambios por archivo

### `packages/storefront-runtime/src/index.ts`

- Extraer `isDefaultVariantTitle(v)` del regex inline actual (línea 416).
- Nuevo `sanitizeWhatsAppText(v)`: `String(v ?? "")` → sin `*` →
  collapse whitespace → trim.
- Nuevo `renderWhatsAppLine(line, money)`: renglón con subtotal (puro).
- Nuevo `orderFingerprint(lines): string`: djb2 → 4 hex mayúsculas (puro,
  exportado; serializado en el runtime para la clave de estado).
- `buildWhatsAppMessage` conserva firma y renderiza el mensaje **completo**
  (todas las líneas + precios + total + cliente, sin cap): lo usa el drawer
  cuando hay una sola parte y el botón de copiar. El budget lo garantiza
  `splitOrderParts`, no esta función.
- Nuevo `splitOrderParts(project, lines, customer): string[]`: dedupe como
  hoy, total en centavos, 1 parte si ≤50 renglones y URL ≤3900, si no chunk
  greedy con probe conservadora (`Parte 99 de 99`, subtotal `$99.999.999`).
  Constantes `3900` (URL) y `50`/`12` como literales con comentario.
- Drawer (`storefrontBoot`, bloque `[data-checkout-form]`): máquina de
  estados, reetiquetado, nota dinámica, `Empezar de nuevo`, botón copiar,
  `role="status"`, listener de `focus`.
- Registrar `splitOrderParts` y `orderFingerprint` en `RUNTIME_HELPERS`
  (renders serializados). Medido: +8,7 KB crudos (76,2 KiB); tope subido de
  68 a 80 KiB con margen ~4 KiB en `index.test.ts`,
  `scripts/storefront-runtime-budget.test.ts` y
  `scripts/public-storefront-budget.test.ts`, con justificación en comentarios
  (precedente: los topes se ajustan con medición documentada).

## Tests

Nuevo `whatsapp-multipart.test.ts` (falla antes, pasa después):

1. 3 líneas: 1 string; `- 2x A (V1) = $…`, línea qty-1 sin `1x`, `Única`
   oculta, subtotal exacto en centavos, total, cliente, disclaimer, URL ≤3900.
2. Sanitización: título con `\n` y `*` no rompe renglones ni negritas.
3. SKU ausente aunque `includeSku` sea true.
4. 60 líneas → 2 partes (50+10); headers `*Pedido #XXXX · Parte N de 2*`;
   subtotales suman el total; última parte con total/cliente/disclaimer +
   `✓ Fin del pedido (2/2)`; primeras sin bloque de cliente ni total;
   `Sigue en la parte 2 →` sólo en no-finales; URLs ≤3900 con teléfono real.
5. `orderFingerprint`: estable ante reorden; cambia ante cambio de cantidad.
6. Serializado: `STOREFRONT_RUNTIME_JS` contiene `splitOrderParts(`,
   `orderFingerprint(`, `Copiar pedido completo`, `Empezar de nuevo`.
7. Dedupe preservado: líneas idénticas se fusionan sumando cantidad.

Tests legacy a actualizar (contrato cambiado por diseño, no regresión):

- `whatsapp-checkout-audit.test.ts`: `1x Remera (M)` → nuevo formato sin
  `1x`; conteo `/- \d+x /` en "multiples productos"; tests de cap-25
  (30/50/100 ítems → 1 parte / multiparte con subtotales); texto de la nota;
  umbral URL ≤4000 → ≤3900.
- `price-format.test.ts`, `mutation-killers.test.ts`, `index.test.ts`:
  aserciones sobre renglones sin subtotal (`3x Producto Base (Variante
  Base)` pasa a incluir ` = $…`).

## Gates

`pnpm --filter @solara/storefront-runtime test` en verde, budget del runtime
en verde, `check:micro` + `test:e2e:smoke` post-cambio, full al cierre.
CHANGELOG en español. Branch `whatsapp-multiparte`.
