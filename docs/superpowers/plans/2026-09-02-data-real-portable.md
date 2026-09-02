# Dónde vive la data real (portable vs repo) — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hacer explícito y aplicar el contrato "la data real del usuario vive sólo en la portable" en documentación, marcador físico y empaquetado.

**Architecture:** Cambio de contrato documental + un cambio en el script de empaquetado. `AGENTS.md` (que todo agente lee) define el modelo; un `proyectos/LEEME.md` comprometido señala la zona de pruebas en el punto exacto donde los agentes buscan; `create-portable-distribution.mjs` deja de copiar el `proyectos/` del repo a la portable para que las tiendas de prueba nunca contaminen la data real. La preservación de tiendas del portable anterior no cambia.

**Tech Stack:** Markdown, `.gitignore` de Git, script Node ESM (`node:mjs`), Vitest para el test unitario existente, Corepack pnpm 10.15.1 sobre Node 24.x.

## Global Constraints

- Node 24.x vía Corepack; todos los comandos con `corepack pnpm`.
- Toda la documentación nueva en español.
- No commitear `proyectos/` con tiendas, `.release/`, `.solara-runtime/`, binarios, `dist/` ni reportes. Única excepción nueva: `proyectos/LEEME.md`.
- No tocar el schema (`StoreProjectV2`), rutas del app ni `scripts/store-factory.mjs` (fuera de alcance).
- Commits breves y descriptivos en español; push a `origin/main` sólo después de superar los gates.
- Antes de `desktop:package`, `SolaraCommerce.exe` debe estar cerrado (barrera de rename en `create-portable-distribution.mjs:114`).

---

### Task 1: Contrato documentado — AGENTS.md, LEEME.md, .gitignore, PORTABILITY.md

**Files:**
- Modify: `AGENTS.md` (sección nueva antes de `## Stack y arquitectura resumida`)
- Create: `proyectos/LEEME.md`
- Modify: `.gitignore:10`
- Modify: `docs/PORTABILITY.md:69-71`

**Interfaces:**
- Consumes: nada.
- Produces: la sección "Dónde vive la data real" en `AGENTS.md` (referenciada por `proyectos/LEEME.md` y por `docs/PORTABILITY.md`); `proyectos/LEEME.md` rastreable por Git.

- [ ] **Step 1: Editar `.gitignore` para permitir el marcador**

Reemplazar la línea `proyectos/` por un patrón que ignore el contenido pero no el marcador (la negación no funciona si se ignora el directorio entero):

```gitignore
proyectos/*
!proyectos/LEEME.md
```

- [ ] **Step 2: Crear `proyectos/LEEME.md`**

```markdown
# Zona de pruebas de la IA

Este `proyectos/` del checkout **no** contiene la data real del usuario: aquí
sólo quedan tiendas de prueba transitorias generadas al ejecutar la app en modo
desarrollo (`pnpm dev` o `Abrir SolaraCommerce.cmd` sin `.exe`).

La data real del usuario vive únicamente en la carpeta portable:

```text
.release/portable/SolaraCommerce-Portable/proyectos/
```

`desktop:package` no copia este `proyectos/` a la portable. Reglas completas en
[`../AGENTS.md`](../AGENTS.md) (sección "Dónde vive la data real").
```

- [ ] **Step 3: Verificar que Git ve el marcador y sigue ignorando tiendas**

Run: `git check-ignore proyectos/LEEME.md; if ($LASTEXITCODE -ne 0) { "OK: no ignorado" }`
Expected: `OK: no ignorado` (exit 1 de check-ignore = el archivo NO está ignorado).

Run: `git status --short proyectos`
Expected: `?? proyectos/LEEME.md` y ninguna tienda listada.

- [ ] **Step 4: Insertar la sección en `AGENTS.md`**

Editar `AGENTS.md`: localizar `## Stack y arquitectura resumida` e insertar justo antes:

```markdown
## Dónde vive la data real

- El usuario siempre trabaja con la distribución portable: sus tiendas, respaldos
  y sitios viven únicamente en
  `.release/portable/SolaraCommerce-Portable/proyectos/` (perfil y logs en
  `.solara-runtime/`). Esa carpeta no está en Git y es la única copia de la data.
- La IA puede usar la app que prefiera (portable o modo dev `pnpm dev` /
  `Abrir SolaraCommerce.cmd`) para probar y depurar código; sólo el usuario
  opera la portable para trabajar.
- El `proyectos/` del repo es la zona de pruebas de la IA (modo dev): puede
  contener tiendas de prueba transitorias. La data real del usuario nunca vive
  ahí ni viaja a la portable: `desktop:package` no copia `proyectos/` del repo.
- Inspeccionar la portable: lectura directa permitida. Escribir tiendas: canal
  del agente (`SolaraCommerce-Agent.cmd`, JSONL/MCP) o cambiar código y
  reconstruir (`desktop:build`, `desktop:package`). Nunca editar a mano
  `.solara.json`, manifests ni staging de la portable.
- Antes de regenerar o limpiar la portable, verificar que se preserva
  `proyectos/`; nunca borrar la carpeta a mano.

```

- [ ] **Step 5: Actualizar `docs/PORTABILITY.md`**

Reemplazar el párrafo (líneas 69-71):

```markdown
`desktop:package` genera una carpeta `win-unpacked`, la convierte en la carpeta
portable final y copia `proyectos/` si existe en el checkout. `.release/` está
ignorado por Git. `portable:clean` elimina únicamente esa salida generada.
```

por:

```markdown
`desktop:package` genera una carpeta `win-unpacked`, la convierte en la carpeta
portable final y preserva `proyectos/` y `.solara-runtime/` del portable
anterior. El `proyectos/` del checkout no se copia: es la zona de pruebas de la
IA en modo desarrollo (ver `AGENTS.md`); la data real del usuario vive en la
copia portable. `.release/` está ignorado por Git. `portable:clean` elimina
únicamente esa salida generada.
```

- [ ] **Step 6: Gates de la tarea**

Run: `corepack pnpm check:repository`
Expected: PASS (el marcador comprometido es aceptado y los enlaces relativos del `LEEME.md` resuelven).

Run: `git diff --check`
Expected: sin salida (sin whitespace errors).

- [ ] **Step 7: Commit**

```bash
git add AGENTS.md docs/PORTABILITY.md .gitignore proyectos/LEEME.md
git commit -m "docs: la data real del usuario vive sólo en la portable"
```

---

### Task 2: Eliminar la copia automática repo → portable en el empaquetado

**Files:**
- Modify: `scripts/create-portable-distribution.mjs:1-10` (comentario de cabecera) y `:199-228` (pasos 2-4)

**Interfaces:**
- Consumes: `shouldKeepPortableStore(preservedStore, repoStore)` (existente, exportada, con tests en `scripts/create-portable-distribution.test.mjs`; ya maneja destino inexistente en `create-portable-distribution.mjs:60`).
- Produces: mismo contrato de CLI (`node scripts/create-portable-distribution.mjs`), sin cambios de firma.

Nota TDD: no se agrega un test unitario nuevo porque el paso 2 eliminado es flujo de nivel superior del script (no importable) y refactorizarlo sólo para esto viola YAGNI. La lógica preservada (`shouldKeepPortableStore`, `inspectStore`) conserva sus tests, y el comportamiento completo se verifica en Task 3 con `desktop:package` + `portable:smoke` + inspección del `proyectos/` resultante.

- [ ] **Step 1: Actualizar el comentario de cabecera**

Reemplazar las líneas 1-10:

```js
/**
 * Convierte el directorio `win-unpacked` de electron-builder en una carpeta
 * portable estable. Sólo copia datos de `proyectos/` si ya existen; los builds
 * y el runtime permanecen fuera del repositorio gracias a `.gitignore`.
 *
 * Preserva el estado del portable anterior: las tiendas guardadas por la app
 * (versión de manifest más nueva que la del repo) y `.solara-runtime/` se
 * conservan a través de cada rebuild. Así un `desktop:package` nunca vuelve a
 * perder guardados del usuario.
 */
```

por:

```js
/**
 * Convierte el directorio `win-unpacked` de electron-builder en una carpeta
 * portable estable. El `proyectos/` del checkout no se copia: es la zona de
 * pruebas de la IA en modo desarrollo; la data real del usuario vive en la
 * propia carpeta portable. Los builds y el runtime permanecen fuera del
 * repositorio gracias a `.gitignore`.
 *
 * Preserva el estado del portable anterior: las tiendas guardadas por la app
 * y `.solara-runtime/` se conservan a través de cada rebuild. Así un
 * `desktop:package` nunca vuelve a perder guardados del usuario.
 */
```

- [ ] **Step 2: Eliminar el paso 2 de copia y renumerar**

Reemplazar (líneas 199-205):

```js
  // 2. Copiar las tiendas del repo.
  const sourceProjects = resolve(root, "proyectos");
  if (existsSync(sourceProjects)) {
    await cp(sourceProjects, join(destination, "proyectos"), { recursive: true, force: true });
  }

  // 3. Reemplazar por las versiones más nuevas guardadas en el portable.
```

por:

```js
  // 2. Restaurar las tiendas preservadas del portable anterior: la data real
  // del usuario vive sólo en la portable; el proyectos/ del repo (zona de
  // pruebas de la IA) nunca viaja a la distribución.
```

Y reemplazar:

```js
  // 4. Restaurar el perfil/runtime del portable.
```

por:

```js
  // 3. Restaurar el perfil/runtime del portable.
```

(Los imports `cp`, `resolve` y `existsSync` siguen en uso en el resto del script; no tocar imports.)

- [ ] **Step 3: Verificar sintaxis y tests existentes**

Run: `node --check scripts/create-portable-distribution.mjs`
Expected: exit 0, sin salida.

Run: `corepack pnpm vitest run scripts/create-portable-distribution.test.mjs`
Expected: todos los tests de `shouldKeepPortableStore` PASS.

- [ ] **Step 4: Gates de la tarea y commit**

Run: `corepack pnpm check:repository` y `git diff --check`
Expected: PASS / sin salida.

```bash
git add scripts/create-portable-distribution.mjs
git commit -m "packaging: no copiar el proyectos/ del repo a la portable"
```

---

### Task 3: Rebuild portable, verificación conductual, CHANGELOG y gates finales

**Files:**
- Modify: `CHANGELOG.md` (entrada nueva al tope)

**Interfaces:**
- Consumes: cambios de Task 1 y Task 2 ya commiteados.
- Produces: portable regenerada con el empaquetado nuevo y entrada de changelog.

- [ ] **Step 1: Confirmar que la app portable está cerrada**

Run: `Get-Process SolaraCommerce -ErrorAction SilentlyContinue`
Expected: vacío. Si aparece un proceso, pedír al usuario que cierre la app antes de continuar.

- [ ] **Step 2: Reconstruir los ejecutables**

```bash
corepack pnpm build
corepack pnpm desktop:build
corepack pnpm desktop:package
```

Expected: los tres comandos terminan sin error; `desktop:package` imprime `Distribución portable creada en .release\portable\SolaraCommerce-Portable`.

- [ ] **Step 3: Verificación conductual del contrato**

Run: `Get-ChildItem ".release\portable\SolaraCommerce-Portable\proyectos" | Select-Object -ExpandProperty Name`
Expected: exactamente las tiendas preservadas del portable anterior (`demo-catalogo-jerarquico--ecb19169`, `rm-descartables--704e2877`). NO debe aparecer `LEEME.md` ni tiendas de prueba nuevas.

Run: `corepack pnpm portable:smoke`
Expected: PASS (la copia aislada arranca con `proyectos/` presente).

- [ ] **Step 4: Entrada de CHANGELOG**

Insertar al tope de `CHANGELOG.md`:

```markdown
### Contrato de datos: la portable es la única ubicación de la data real (2026-09-02)

- **Causa**: los agentes confundían dónde buscar la data: inspeccionaban el código y el `proyectos/` del repo en lugar de la carpeta portable donde el usuario trabaja, y el paso 2 de `create-portable-distribution.mjs` copiaba el `proyectos/` del checkout (tiendas de prueba de la IA en modo dev) dentro de la portable, con riesgo de contaminar la data real.
- **Fix**: nueva sección "Dónde vive la data real" en `AGENTS.md` (data del usuario sólo en `.release/portable/SolaraCommerce-Portable/proyectos/`; la IA elige la app para probar código; escrituras de tiendas por canal del agente o rebuild), marcador `proyectos/LEEME.md` comprometido con excepción en `.gitignore`, nota en `docs/PORTABILITY.md` y eliminación de la copia automática repo → portable en el empaquetado (las tiendas preservadas del portable anterior se restauran igual; verificado con `portable:smoke`).

```

- [ ] **Step 5: Gates finales**

```bash
corepack pnpm check:quick
corepack pnpm test:e2e:smoke
```

Expected: ambos PASS.

Run: `git diff --check` y `corepack pnpm check:repository`
Expected: limpio.

- [ ] **Step 6: Commit y push**

```bash
git add CHANGELOG.md
git commit -m "docs: changelog del contrato de data real"
git status
```

Verificar que `git status` no muestre archivos de `proyectos/` (salvo `LEEME.md` ya commiteado), `.release/` ni runtime; luego:

```bash
git push origin main
```
