# Componentes del editor — referencia (T1.9, 2026-08-07)

Referencia de los componentes de UI del Studio (`apps/studio/src/components/`),
la escala de iconos, los tokens `--ui-*` y la galería de desarrollo. Parte del
plan [Editor UI/UX](../../../docs/superpowers/plans/2026-08-07-editor-uiux.md).

Convenciones transversales de toda mejora visible:

- **Testids:** prefijo `ui-` (`ui-button`, `ui-icon-button`, `ui-empty-state`,
  `ui-inline-error`, …).
- **Teclado y foco:** nunca se quita el outline; `:focus-visible` usa el ring
  del tema (`--ui-focus-ring`).
- **Targets:** botones ≥ 40px (44px en táctil); disabled/loading con estilo
  propio (`cursor: not-allowed` + `opacity: 0.48` global en base.css).
- **Iconos decorativos:** siempre con `aria-hidden`.

## Escala de iconos (T1.7)

| Tamaño | Uso |
| ------ | --- |
| 16 (`sm`) | Iconos dentro de botones con texto (`.button svg`) |
| 18 (`md`) | `IconButton`, `InlineError`, toolbars |
| 20 (`lg`) | Toolbars y columnas de tabla |
| 24 (`xl`) | `EmptyState`, listas grandes |

Normalización por CSS en `base/base.css` (`.button svg`, `.icon-button svg`,
`.empty-state > svg`): el tamaño real pintado queda fijado aunque el atributo
`size` del ícono difiera. Los botones sin texto (`IconButton`) siempre llevan
`aria-label` + `title`.

## Tokens `--ui-*` (T1.6)

Definidos en `:root` de `apps/studio/src/base/base.css` como alias del
contrato legacy (que no se renombra para no romper el resto de las secciones).
Siguen automáticamente al `prefers-color-scheme: dark` porque referencian las
variables legacy.

- Superficie: `--ui-bg`, `--ui-surface`, `--ui-surface-raised`,
  `--ui-surface-strong`
- Bordes: `--ui-border`, `--ui-border-strong`
- Texto: `--ui-text`, `--ui-text-muted`, `--ui-text-faint`
- Semántica: `--ui-accent`, `--ui-accent-hover`, `--ui-accent-soft`,
  `--ui-accent-contrast`, `--ui-danger`, `--ui-danger-soft`,
  `--ui-danger-contrast`, `--ui-warning`, `--ui-warning-soft`, `--ui-info`,
  `--ui-info-soft`
- Geometría: `--ui-radius` (6px), `--ui-radius-md` (16px),
  `--ui-radius-lg` (24px), `--ui-radius-full`
- Elevación: `--ui-shadow-sm`, `--ui-shadow-md`
- Foco: `--ui-focus-ring` (ring 3px del accent al 18 %)

Los componentes nuevos de las fases 1-3 consumen exclusivamente estos tokens;
los valores legacy de `base.css` se reemplazaron por referencias donde
aparecían literales (`#fff7f7` → `--ui-danger-contrast`, el ring de foco de
inputs y la sombra de `.global-error`).

## Componentes — `components/Ui.tsx`

### Button

Botón con variantes. Envuelve `<span>` al texto; los iconos se pasan con
`icon` y van con `aria-hidden`.

- Props: `variant?: "primary" | "secondary" | "quiet" | "danger"`
  (default `secondary`), `size?: "sm" | "md"` (default `md`),
  `loading?: boolean` (spinner inline + `aria-busy` + disabled),
  `icon?: Icon`, resto de `ButtonHTMLAttributes<HTMLButtonElement>`
  (`disabled`, `onClick`, …).
- Testid: `ui-button`.
- Estados: idle, hover, active (presión `scale(0.985)`), disabled
  (`not-allowed` + opacidad), loading, focus-visible (ring del tema).
- Uso: acciones de pantallas; `variant="primary"` para la acción principal.

### IconButton

Botón sólo icono con `aria-label` + `title` obligatorios.

- Props: `icon: Icon`, `label: string`, `tooltip?: string` (compone la
  primitiva `Tooltip`; `title` sigue como fallback), resto de atributos de
  botón.
- Testid: `ui-icon-button`.
- Estados: idle, hover, `aria-pressed="true"` (estado activo persistente),
  disabled.
- Uso: acciones compactas de listas y toolbars; nunca sin texto accesible.

### Field

Campo de formulario con `fieldset`/`legend`; asocia el control con
`aria-labelledby` automáticamente cuando es `input`, `select` o `textarea`
sin label propio. Con `error` agrega `aria-describedby`, `aria-invalid` y el
mensaje con `role="alert"`.

- Props: `label: string`, `hint?: string`, `error?: string`, `className?: string`,
  `children`.
- Testid: `ui-field-error` (mensaje de error).
- Uso: todos los formularios del editor (Resumen, ProductEditor, SEO,
  Export). Los formularios principales deben pasar `error` al validar
  (mínimo: Overview WhatsApp/URLs, ProductEditor precio/slug).

### EmptyState

Estado vacío de listas con icono, título, cuerpo y acción opcional.

- Props: `icon: Icon`, `title: string`, `body: string`, `action?: ReactNode`.
- Testid: `ui-empty-state`.
- Uso: catálogo sin productos, recursos sin imágenes, dashboard sin tiendas,
  inspector sin selección, búsqueda sin resultados. Toda lista vacía debe
  ofrecer una acción concreta cuando existe un destino (ver T1.5).

### InlineError

Error inline con `role="alert"`.

- Props: `children: ReactNode`.
- Testid: `ui-inline-error`.
- Uso: errores de operación (guardado, workers, validación).

### SectionHeader

Encabezado de sección con título, descripción y acciones.

- Props: `title: string`, `description?: string`, `actions?: ReactNode`,
  resto de `HTMLAttributes<HTMLElement>`.
- Uso: cabeceras de pestañas (Recursos, Catálogo, …).

### Skeleton

Esqueleto de carga con líneas de ancho decreciente; `role` de salida con
`aria-label="Cargando"` y animación `skeleton-pulse` que se anula bajo
`prefers-reduced-motion`.

- Props: `lines?: number` (default 4).
- Uso: pantalla de boot y apertura de tienda (Suspense de `App.tsx`).

## Primitivas — `components/primitives.tsx` (T1.3)

### Toggle

Switch accesible (`role="switch"`).

- Props: `checked: boolean`, `onChange(checked: boolean): void`,
  `label?: string`, `disabled?: boolean`, `size?: "sm" | "md"`,
  `className?: string`.
- Testid: `ui-toggle`.
- Estados: checked/unchecked, disabled, focus-visible.

### Badge

Etiqueta compacta con tono semántico.

- Props: `tone?: "neutral" | "accent" | "success" | "warning" | "danger" | "info"`,
  `children`, `className?`.
- Testid: `ui-badge`.

### StatusBadge

Estado con punto de color; compone `Badge`.

- Props: `status: "ok" | "warning" | "error" | "idle" | "busy"`,
  `label: string`, `className?`.
- Uso: estado de tienda, sitio desactualizado, errores de auditoría.

### Tooltip

Tooltip CSS nativo vía `data-tip`, sin librerías. Renderiza también `title`
nativo como fallback para AT sin hover.

- Props: `tip: string`, `children`, `position?: "top" | "bottom" | "left" | "right"`,
  `className?`.
- Uso: toolbars del editor (Studio, Preview) y `IconButton` compone esta
  primitiva vía `tooltip`. Para botones posicionados (`position: absolute`/
  `fixed`, p. ej. `.editor-pane-close` y `.studio-focus-exit`), la geometría
  se aplica al span contenedor (`.ui-tooltip.<clase>`) y el botón interno
  vuelve a `position: static`; el botón conserva la clase para los visuales.

### ProgressBar

Barra de progreso accesible.

- Props: `value?: number`, `max?: number`, `label?: string`,
  `indeterminate?: boolean`, `size?: "sm" | "md"`, `className?`.
- Testid: `ui-progress`.
- Uso: exportación y workers (`indeterminate` cuando no hay porcentaje).

### Pagination

Paginación reutilizable con resumen, rango con elipsis y selector de filas.

- Props: `page: number`, `totalPages: number`, `onChange(page: number): void`,
  `pageSize?`, `onPageSizeChange?(pageSize: number): void`,
  `pageSizeOptions?` (default `[10, 25, 50]`), `totalItems?`, `disabled?`,
  `className?`.
- Testid: `ui-pagination`.
- Uso: catálogo y preview.

### SegmentedControl

Control segmentado (grilla/lista).

- Props: `value: T`, `onChange(value: T): void`,
  `options: Array<{ value: T; label: string; icon?: Icon; disabled?: boolean }>`,
  `label: string`, `disabled?`, `size?: "sm" | "md"`, `className?`.
- Testid: `ui-segmented`.
- Uso: vista del dashboard y toolbars.

## Diálogo — `components/ConfirmDialog.tsx` (T1.3/T4.12)

`<dialog>` nativo con `showModal`, foco inicial (cancelar en destructivos),
Escape cancela, Enter confirma y foco de retorno al abridor. El padre debe
montarlo condicionalmente.

- Props: `title: string`, `body: ReactNode`, `confirmLabel?` (default
  "Confirmar"), `cancelLabel?` (default "Cancelar"), `danger?: boolean`,
  `busy?: boolean`, `onConfirm(): void`, `onCancel(): void`.
- Testid: `ui-confirm-dialog` (aceptar: `ui-confirm-accept`).
- Uso: archivar tienda, eliminar producto, descartar borrador, sobreescribir
  import y reemplazar respaldo.

## Toast — `components/Toast.tsx` (T1.4)

`ToastProvider` + `useToast()`. El host se monta una sola vez (en la galería y
en `App`); éxito/info cierran a los 5s y error a los 8s, con
`role="status"`/`role="alert"`.

- API: `success(message)`, `error(message)`, `info(message)`,
  `push(kind, message, duration?)`.
- Testid: `ui-toast`.
- Uso: reemplaza avisos ad-hoc (respaldo, duplicado, archivado, import CSV,
  export).

## Galería de componentes (T1.8)

Ruta oculta de desarrollo: `/__studio/components` (sólo el SPA del editor la
reconoce; no existe en el sitio público). Renderiza todos los componentes
disponibles con sus estados (botones, formularios, feedback, primitivas,
diálogo, toast), la escala de iconos y los tokens `--ui-*`.

- Archivo: `apps/studio/src/debug/ComponentGallery.tsx` (lazy import en
  `App.tsx`, no suma al bundle inicial).
- Verificación: navegación manual; no participa del smoke ni de
  `editor-console.spec.ts` (ruta distinta).
