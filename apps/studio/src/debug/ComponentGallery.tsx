/**
 * Galería de componentes del editor (T1.8).
 * Ruta oculta: /__studio/components — sólo el SPA del editor la reconoce;
 * no existe ruta real en el sitio público ni en el servidor.
 * Muestra todos los componentes de `components/Ui.tsx`, `primitives.tsx`,
 * `ConfirmDialog.tsx` y `Toast.tsx` con sus estados, la escala de iconos
 * normalizada (16 sm / 18 md / 20 lg / 24 xl) y los tokens `--ui-*`.
 */
import {
  ArrowLeft,
  ArrowRight,
  Bell,
  Check,
  FolderSimple,
  Image,
  List,
  MagnifyingGlass,
  Package,
  Plus,
  SquaresFour,
  Trash,
  WarningCircle,
} from "@phosphor-icons/react";
import { type ReactNode, useState } from "react";
import { ConfirmDialog } from "../components/ConfirmDialog";
import {
  Badge,
  Pagination,
  ProgressBar,
  SegmentedControl,
  StatusBadge,
  Toggle,
  Tooltip,
} from "../components/primitives";
import { ToastProvider, useToast } from "../components/Toast";
import {
  Button,
  EmptyState,
  Field,
  IconButton,
  InlineError,
  SectionHeader,
  Skeleton,
} from "../components/Ui";
import "./component-gallery.css";

const tokenRows = [
  { name: "--ui-surface", token: "var(--ui-surface)" },
  { name: "--ui-surface-raised", token: "var(--ui-surface-raised)" },
  { name: "--ui-border", token: "var(--ui-border)" },
  { name: "--ui-text", token: "var(--ui-text)" },
  { name: "--ui-text-muted", token: "var(--ui-text-muted)" },
  { name: "--ui-accent", token: "var(--ui-accent)" },
  { name: "--ui-danger", token: "var(--ui-danger)" },
  { name: "--ui-warning", token: "var(--ui-warning)" },
];

function TokenRow({ name, token }: { name: string; token: string }) {
  return (
    <div className="component-gallery__token-row">
      <span className="component-gallery__swatch" style={{ background: token }} aria-hidden />
      <code>{name}</code>
    </div>
  );
}

function Cell({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  return (
    <article className="component-gallery__cell">
      <h3>{title}</h3>
      {note ? <small>{note}</small> : null}
      <div className="component-gallery__demo">{children}</div>
    </article>
  );
}

function ToggleDemo() {
  const [checked, setChecked] = useState(true);
  return (
    <>
      <Toggle checked={checked} onChange={setChecked} label="Publicar" />
      <Toggle checked={false} onChange={() => undefined} label="Deshabilitado" disabled />
    </>
  );
}

function ProgressDemo() {
  return (
    <>
      <ProgressBar value={40} max={100} label="Exportando" />
      <ProgressBar indeterminate label="Procesando" />
    </>
  );
}

function PaginationDemo() {
  const [page, setPage] = useState(2);
  const [pageSize, setPageSize] = useState(10);
  return (
    <Pagination
      page={page}
      totalPages={12}
      onChange={setPage}
      pageSize={pageSize}
      onPageSizeChange={setPageSize}
      totalItems={120}
    />
  );
}

function SegmentedDemo() {
  const [view, setView] = useState<"grid" | "list">("grid");
  return (
    <SegmentedControl<"grid" | "list">
      value={view}
      onChange={setView}
      label="Vista"
      options={[
        { value: "grid", label: "Grilla", icon: SquaresFour },
        { value: "list", label: "Lista", icon: List },
      ]}
    />
  );
}

function ConfirmDemo() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="danger" icon={Trash} onClick={() => setOpen(true)}>
        Abrir confirmación
      </Button>
      {open ? (
        <ConfirmDialog
          title="Eliminar tienda"
          body="Se archiva la tienda y su sitio deja de publicarse. Esta acción puede deshacerse."
          confirmLabel="Eliminar"
          danger
          onConfirm={() => setOpen(false)}
          onCancel={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}

function ToastDemo() {
  const toast = useToast();
  return (
    <>
      <Button variant="primary" icon={Check} onClick={() => toast.success("Cambios guardados.")}>
        Éxito
      </Button>
      <Button
        variant="danger"
        icon={WarningCircle}
        onClick={() => toast.error("No se pudo guardar.")}
      >
        Error
      </Button>
      <Button variant="quiet" onClick={() => toast.info("Procesando el lote…")}>
        Info
      </Button>
    </>
  );
}

export function ComponentGallery() {
  return (
    <ToastProvider>
      <main className="component-gallery">
        <a className="component-gallery__back" href="/">
          <ArrowLeft aria-hidden size={16} /> Volver al dashboard
        </a>
        <div className="component-gallery__intro">
          <h1>Galería de componentes</h1>
          <p>
            Inventario visual del sistema de componentes del editor. Toda mejora visible se fija con{" "}
            <code>data-testid</code> con prefijo <code>ui-</code>.
          </p>
          <span className="component-gallery__route" aria-hidden>
            /__studio/components
          </span>
        </div>

        <section className="component-gallery__section" aria-label="Botones">
          <h2>Botones</h2>
          <p>Variantes, tamaños, estados loading/deshabilitado e iconos. Target mínimo 40px.</p>
          <div className="component-gallery__grid">
            <Cell title="Primary" note="Acción principal de cada pantalla">
              <Button variant="primary" icon={Plus}>
                Agregar producto
              </Button>
              <Button variant="primary" icon={Plus} disabled>
                Deshabilitado
              </Button>
              <Button variant="primary" loading>
                Guardando
              </Button>
            </Cell>
            <Cell title="Secondary" note="Variante por defecto">
              <Button variant="secondary" icon={FolderSimple}>
                Abrir carpeta
              </Button>
              <Button variant="secondary" disabled>
                Deshabilitado
              </Button>
              <Button variant="secondary" size="sm" icon={ArrowRight}>
                Compacto
              </Button>
            </Cell>
            <Cell title="Quiet" note="Acciones ligeras dentro de listas">
              <Button variant="quiet" icon={ArrowRight}>
                Ver más
              </Button>
              <Button variant="quiet" disabled>
                Deshabilitado
              </Button>
            </Cell>
            <Cell title="Danger" note="Acciones destructivas">
              <Button variant="danger" icon={Trash}>
                Eliminar
              </Button>
              <Button variant="danger" disabled>
                Deshabilitado
              </Button>
            </Cell>
            <Cell title="Sólo icono" note="IconButton: aria-label + title, tooltip opcional">
              <IconButton icon={Trash} label="Eliminar" />
              <IconButton icon={Trash} label="Eliminar" disabled />
              <IconButton
                icon={Bell}
                label="Notificaciones"
                tooltip="Abrir notificaciones"
                aria-pressed
              />
            </Cell>
          </div>
        </section>

        <section className="component-gallery__section" aria-label="Formularios">
          <h2>Formularios</h2>
          <p>Field usa fieldset/legend y asocia el control con aria-labelledby.</p>
          <div className="component-gallery__grid">
            <Cell title="Field + input" note="Con hint">
              <Field label="Nombre de la tienda" hint="Máximo 60 caracteres.">
                <input defaultValue="Predeterminado" />
              </Field>
            </Cell>
            <Cell title="Field con error" note="Borde danger + aria-describedby">
              <Field label="Precio" error="El precio debe ser un número entero mayor que cero.">
                <input defaultValue="-5" />
              </Field>
            </Cell>
            <Cell title="Field + select">
              <Field label="Estado">
                <select defaultValue="active">
                  <option value="active">Activa</option>
                  <option value="archived">Archivada</option>
                </select>
              </Field>
            </Cell>
            <Cell title="Input deshabilitado">
              <Field label="Base protegida">
                <input disabled defaultValue="Sólo lectura" />
              </Field>
            </Cell>
          </div>
        </section>

        <section className="component-gallery__section" aria-label="Retroalimentación">
          <h2>Retroalimentación</h2>
          <p>EmptyState, InlineError, Skeleton, Badge y StatusBadge con sus estados.</p>
          <div className="component-gallery__grid">
            <Cell title="EmptyState con acción" note="Testid ui-empty-state">
              <EmptyState
                icon={Package}
                title="El catálogo está vacío"
                body="Agregá el primer producto o importá un CSV con el formato de SolaraCommerce."
                action={
                  <Button variant="primary" icon={Plus}>
                    Agregar producto
                  </Button>
                }
              />
            </Cell>
            <Cell title="EmptyState sin acción" note="Sólo informativo">
              <EmptyState
                icon={Image}
                title="No hay imágenes"
                body="Cargá archivos JPG, PNG o WebP. Solara conserva una versión de respaldo por hash."
              />
            </Cell>
            <Cell title="InlineError" note="Role alert">
              <InlineError>No se pudo guardar: el slug ya existe.</InlineError>
            </Cell>
            <Cell title="Skeleton" note="Output aria-label Cargando">
              <Skeleton lines={3} />
              <Skeleton lines={5} />
            </Cell>
            <Cell title="Badge" note="Tonos semánticos">
              <Badge tone="neutral">Borrador</Badge>
              <Badge tone="accent">Nuevo</Badge>
              <Badge tone="success">Activa</Badge>
              <Badge tone="warning">Revisar</Badge>
              <Badge tone="danger">Crítico</Badge>
              <Badge tone="info">Info</Badge>
            </Cell>
            <Cell title="StatusBadge" note="Punto de color + etiqueta">
              <StatusBadge status="ok" label="Al día" />
              <StatusBadge status="warning" label="Sitio desactualizado" />
              <StatusBadge status="error" label="Error de auditoría" />
              <StatusBadge status="idle" label="Sin exportar" />
              <StatusBadge status="busy" label="Exportando" />
            </Cell>
          </div>
        </section>

        <section className="component-gallery__section" aria-label="Primitivas">
          <h2>Primitivas</h2>
          <p>Toggle, Tooltip, ProgressBar, Pagination y SegmentedControl (T1.3).</p>
          <div className="component-gallery__grid">
            <Cell title="Toggle" note="Role switch, sm/md">
              <ToggleDemo />
            </Cell>
            <Cell title="Tooltip" note="CSS nativo con data-tip">
              <Tooltip tip="Archiva la tienda y deja de publicar su sitio" position="top">
                <Button variant="quiet" icon={Trash}>
                  Archivar
                </Button>
              </Tooltip>
              <Tooltip tip="Guarda los cambios en disco" position="bottom">
                <Button variant="secondary" icon={Check}>
                  Guardar
                </Button>
              </Tooltip>
            </Cell>
            <Cell title="ProgressBar" note="aria-valuenow / indeterminate">
              <ProgressDemo />
            </Cell>
            <Cell title="Pagination" note="Con resumen y selector de filas">
              <PaginationDemo />
            </Cell>
            <Cell title="SegmentedControl" note="Grilla/lista con aria-pressed">
              <SegmentedDemo />
            </Cell>
            <Cell title="ConfirmDialog" note="Dialog nativo, Escape cancela, foco vuelve">
              <ConfirmDemo />
            </Cell>
          </div>
        </section>

        <section className="component-gallery__section" aria-label="Toast">
          <h2>Toast global</h2>
          <p>ToastProvider + useToast; éxito/info cierran a los 5s, error a los 8s.</p>
          <div className="component-gallery__grid">
            <Cell title="Disparar avisos" note="Role status / alert">
              <ToastDemo />
            </Cell>
          </div>
        </section>

        <section className="component-gallery__section" aria-label="Estructura">
          <h2>Estructura</h2>
          <p>SectionHeader con acciones y contador de resultados.</p>
          <div className="component-gallery__grid">
            <Cell title="SectionHeader" note="Con acciones">
              <SectionHeader
                title="Recursos"
                description="Las imágenes se corrigen, redimensionan y convierten fuera del hilo principal."
                actions={
                  <Button variant="primary" icon={Plus}>
                    Cargar imágenes
                  </Button>
                }
              />
            </Cell>
          </div>
        </section>

        <section className="component-gallery__section" aria-label="Iconos">
          <h2>Escala de iconos</h2>
          <p>Normalizada a 16 sm / 18 md / 20 lg / 24 xl. Los decorativos llevan aria-hidden.</p>
          <div className="component-gallery__grid">
            <Cell title="16 sm" note="Botones con texto">
              <Check aria-hidden size={16} />
              <MagnifyingGlass aria-hidden size={16} />
              <Plus aria-hidden size={16} />
            </Cell>
            <Cell title="18 md" note="IconButton e inline error">
              <Check aria-hidden size={18} />
              <WarningCircle aria-hidden size={18} />
              <Bell aria-hidden size={18} />
            </Cell>
            <Cell title="20 lg" note="Toolbars y columnas">
              <Check aria-hidden size={20} />
              <MagnifyingGlass aria-hidden size={20} />
              <FolderSimple aria-hidden size={20} />
            </Cell>
            <Cell title="24 xl" note="EmptyState y listas grandes">
              <Check aria-hidden size={24} />
              <Package aria-hidden size={24} />
              <Image aria-hidden size={24} />
            </Cell>
          </div>
        </section>

        <section className="component-gallery__section" aria-label="Tokens">
          <h2>Tokens --ui-*</h2>
          <p>Contrato de superficie, texto y semántica del editor (T1.6).</p>
          <div className="component-gallery__grid">
            <Cell title="Superficie y texto">
              {tokenRows.slice(0, 5).map((row) => (
                <TokenRow key={row.name} {...row} />
              ))}
            </Cell>
            <Cell title="Semántica">
              {tokenRows.slice(5).map((row) => (
                <TokenRow key={row.name} {...row} />
              ))}
            </Cell>
          </div>
        </section>
      </main>
    </ToastProvider>
  );
}
