# Diseño: Dónde vive la data real (portable vs repo)

Fecha: 2026-09-02
Estado: aprobado en conversación, pendiente de implementación

## Problema

El usuario trabaja siempre con la distribución portable
(`.release/portable/SolaraCommerce-Portable/`), pero los agentes confunden dónde
buscar: revisan el código fuente y el `proyectos/` del repo en lugar de la data
real de la portable. Además, si la IA prueba código en modo desarrollo, las
tiendas de prueba quedan en el `proyectos/` del checkout y `desktop:package`
(crear-portable-distribution.mjs, paso 2) las copia dentro de la portable,
contaminando la data real del usuario.

## Modelo de trabajo acordado

- El usuario **siempre** opera la portable para trabajar. Sus tiendas, respaldos
  y sitios viven únicamente en
  `.release/portable/SolaraCommerce-Portable/proyectos/` (perfil y logs en
  `.solara-runtime/`). Esa carpeta no está en Git y es la única copia de la data.
- La **IA puede usar la app que prefiera** (portable o modo dev `pnpm dev` /
  `Abrir SolaraCommerce.cmd`) para probar y depurar código. Sólo el usuario
  trabaja con la portable.
- El `proyectos/` del repo es la **zona de pruebas de la IA**: puede contener
  tiendas de prueba transitorias generadas en modo dev. La data real del usuario
  nunca vive ahí ni viaja a la portable.
- Escribir tiendas de la portable: canal del agente (`SolaraCommerce-Agent.cmd`,
  JSONL/MCP) o cambiar código + rebuild (`desktop:build`, `desktop:package`).
  Nunca editar a mano `.solara.json`, manifests ni staging de la portable. La
  lectura directa para inspección está permitida.
- Antes de regenerar o limpiar la portable, verificar que se preserva
  `proyectos/` de la portable; nunca borrar la carpeta a mano.

Nota: el `proyectos/` del repo no se puede eliminar: es el destino de
persistencia del modo desarrollo (`scripts/store-factory.mjs` fija
`projectsRoot` a `<checkout>/proyectos`).

## Cambios

### 1. `AGENTS.md`

Nueva sección propia "Dónde vive la data real", inmediatamente después de
"Reglas no negociables", con las reglas del modelo de trabajo acordado,
redactada como instrucciones operativas para agentes:

- data del usuario sólo en la portable (ruta exacta, no en Git);
- la IA elige libremente la app para probar código;
- `proyectos/` del repo = zona de pruebas de la IA, sin data real;
- escrituras de la portable por canal del agente o rebuild; lectura directa OK;
- no borrar la portable a mano; verificar preservación de `proyectos/` al
  regenerar.

### 2. Marcador físico `proyectos/LEEME.md` (comprometido)

Archivo breve en el `proyectos/` del repo que cualquier agente encuentra al
explorar: explica que ese `proyectos/` es zona de pruebas de la IA (modo dev),
que la data real del usuario vive en la portable y que las reglas están en
`AGENTS.md`.

`.gitignore` cambia `proyectos/` por `proyectos/*` más la negación
`!proyectos/LEEME.md` (la negación no funciona si se ignora el directorio
entero).

### 3. `scripts/create-portable-distribution.mjs`

Eliminar el paso 2 ("Copiar las tiendas del repo" en el empaquetado): el
`proyectos/` del repo no debe fluir automáticamente a la portable. Con el modelo
acordado la copia automática ya no tiene propósito y es la vía por la que las
tiendas de prueba contaminarían la data real. Si algún día hace falta sembrar la
portable con una tienda específica, se copia a mano.

Esto elimina también la necesidad del filtro de `LEEME.md` previsto
inicialmente.

### 4. `docs/PORTABILITY.md`

Nota breve en la sección "Cómo crear la carpeta portable": en el checkout de
desarrollo `proyectos/` queda como zona de pruebas de la IA y no se copia
automáticamente a la portable; la data real del usuario vive en la copia
portable.

## Verificación

- `corepack pnpm check:quick` y `corepack pnpm test:e2e:smoke`.
- Confirmar que `check:repository` acepta el `proyectos/LEEME.md` comprometido.
- Confirmar que `portable:smoke` sigue pasando sin el paso 2 de copia (la
  portable nueva arranca con `proyectos/` vacío y las tiendas preservadas del
  portable anterior se mantienen intactas: el paso 3 de preservación no cambia).
- `git diff --check` y `corepack pnpm check:repository` antes de entregar.

## Fuera de alcance

- Cambios de rutas del app (`store-factory.mjs`, `serve.mjs`): el `proyectos/`
  del repo sigue siendo necesario para modo dev.
- Union/symlink entre ambos `proyectos/` (el storage handler rechaza enlaces
  simbólicos; fragilidad con Git y empaquetado).
- Guardarraíles adicionales (avisos en `desktop:package`, comando
  `pnpm portable:path`): se evalúan más adelante si la documentación no alcanza.
