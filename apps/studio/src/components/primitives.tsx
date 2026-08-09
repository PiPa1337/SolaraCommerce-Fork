/**
 * Primitivas de UI del editor (T1.3): Toggle, Badge, StatusBadge, Tooltip,
 * ProgressBar, Pagination y SegmentedControl. Sin dependencias externas; el
 * tooltip usa CSS nativo con `data-tip` y el resto estados accesibles.
 */
import { ArrowLeft, ArrowRight, type Icon } from "@phosphor-icons/react";
import { type ReactNode, useId } from "react";
import { Button } from "./Ui";

/** Tooltip CSS puro: envuelve el contenido y expone `tip` vía `data-tip`.
 * `title` nativo se conserva como fallback para AT sin hover. */
export function Tooltip({
  tip,
  children,
  position = "top",
  className = "",
}: {
  tip: string;
  children: ReactNode;
  position?: "top" | "bottom" | "left" | "right";
  className?: string;
}) {
  return (
    <span className={`ui-tooltip ui-tooltip--${position} ${className}`} data-tip={tip} title={tip}>
      {children}
    </span>
  );
}

/** Switch accesible (botón con role="switch"); teclado y foco nativos. */
export function Toggle({
  checked,
  onChange,
  label,
  disabled = false,
  size = "md",
  className = "",
}: {
  checked: boolean;
  onChange(checked: boolean): void;
  label?: string;
  disabled?: boolean;
  size?: "sm" | "md";
  className?: string;
}) {
  const labelId = useId();
  return (
    <span className={`ui-toggle ui-toggle--${size} ${className}`} data-testid="ui-toggle">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-labelledby={label ? labelId : undefined}
        disabled={disabled}
        onClick={() => onChange(!checked)}
      >
        <span className="ui-toggle__track" aria-hidden>
          <span className="ui-toggle__thumb" />
        </span>
      </button>
      {label ? (
        <span className="ui-toggle__label" id={labelId}>
          {label}
        </span>
      ) : null}
    </span>
  );
}

export type BadgeTone = "neutral" | "accent" | "success" | "warning" | "danger" | "info";

/** Etiqueta compacta con tono semántico. */
export function Badge({
  tone = "neutral",
  children,
  className = "",
}: {
  tone?: BadgeTone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span className={`ui-badge ui-badge--${tone} ${className}`} data-testid="ui-badge">
      {children}
    </span>
  );
}

export type StatusTone = "ok" | "warning" | "error" | "idle" | "busy";

/** Estado con punto de color; compone Badge para un solo sistema visual. */
export function StatusBadge({
  status,
  label,
  className = "",
}: {
  status: StatusTone;
  label: string;
  className?: string;
}) {
  const toneMap: Record<StatusTone, BadgeTone> = {
    ok: "success",
    warning: "warning",
    error: "danger",
    idle: "neutral",
    busy: "neutral",
  };
  return (
    <Badge
      tone={toneMap[status]}
      className={`ui-status-badge ui-status-badge--${status} ${className}`}
    >
      <span className="ui-status-badge__dot" aria-hidden />
      <span className="ui-status-badge__label">{label}</span>
    </Badge>
  );
}

/** Barra de progreso con aria-valuenow; `indeterminate` para trabajos sin % . */
export function ProgressBar({
  value = 0,
  max = 100,
  label,
  indeterminate = false,
  size = "md",
  className = "",
}: {
  value?: number;
  max?: number;
  label?: string;
  indeterminate?: boolean;
  size?: "sm" | "md";
  className?: string;
}) {
  const clamped = Math.min(max, Math.max(0, value));
  const percent = max > 0 ? Math.round((clamped / max) * 100) : 0;
  return (
    <div
      className={`ui-progress ui-progress--${size}${indeterminate ? " ui-progress--indeterminate" : ""} ${className}`}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={indeterminate ? undefined : clamped}
      aria-label={label}
      data-testid="ui-progress"
    >
      <div
        className="ui-progress__fill"
        style={indeterminate ? undefined : { width: `${percent}%` }}
      />
    </div>
  );
}

/** Paginación reutilizable (catálogo, preview); mantiene el rango de páginas. */
export function Pagination({
  page,
  totalPages,
  onChange,
  pageSize,
  onPageSizeChange,
  pageSizeOptions = [10, 25, 50],
  totalItems,
  disabled = false,
  className = "",
}: {
  page: number;
  totalPages: number;
  onChange(page: number): void;
  pageSize?: number;
  onPageSizeChange?(pageSize: number): void;
  pageSizeOptions?: number[];
  totalItems?: number;
  disabled?: boolean;
  className?: string;
}) {
  const perPage = pageSize ?? 10;
  const first = totalItems !== undefined && totalItems > 0 ? (page - 1) * perPage + 1 : 0;
  const last = totalItems !== undefined ? Math.min(page * perPage, totalItems) : 0;
  const go = (target: number) => {
    if (!disabled && target >= 1 && target <= totalPages && target !== page) onChange(target);
  };
  const entries: Array<number | "ellipsis-start" | "ellipsis-end"> = [];
  if (totalPages <= 7) {
    for (let index = 1; index <= totalPages; index += 1) entries.push(index);
  } else {
    entries.push(1);
    const start = Math.max(2, page - 1);
    const end = Math.min(totalPages - 1, page + 1);
    if (start > 2) entries.push("ellipsis-start");
    for (let index = start; index <= end; index += 1) entries.push(index);
    if (end < totalPages - 1) entries.push("ellipsis-end");
    entries.push(totalPages);
  }
  return (
    <nav
      className={`ui-pagination ${className}`}
      aria-label="Paginación"
      data-testid="ui-pagination"
    >
      {totalItems !== undefined ? (
        <span className="ui-pagination__summary">
          {totalItems === 0 ? "0 resultados" : `${first}–${last} de ${totalItems}`}
        </span>
      ) : null}
      <div className="ui-pagination__controls">
        <Button
          variant="secondary"
          size="sm"
          icon={ArrowLeft}
          disabled={disabled || page <= 1}
          onClick={() => go(page - 1)}
        >
          Anterior
        </Button>
        <fieldset className="ui-pagination__pages" aria-label="Páginas">
          {entries.map((entry) =>
            entry === "ellipsis-start" || entry === "ellipsis-end" ? (
              <span className="ui-pagination__ellipsis" key={entry} aria-hidden>
                …
              </span>
            ) : (
              <button
                type="button"
                className={`ui-pagination__page${entry === page ? " ui-pagination__page--active" : ""}`}
                aria-current={entry === page ? "page" : undefined}
                disabled={disabled}
                onClick={() => go(entry)}
                key={entry}
              >
                {entry}
              </button>
            ),
          )}
        </fieldset>
        <Button
          variant="secondary"
          size="sm"
          icon={ArrowRight}
          disabled={disabled || page >= totalPages}
          onClick={() => go(page + 1)}
        >
          Siguiente
        </Button>
      </div>
      {onPageSizeChange && pageSize !== undefined ? (
        <label className="ui-pagination__size">
          <span>Filas</span>
          <select
            value={pageSize}
            disabled={disabled}
            aria-label="Filas por página"
            onChange={(event) => onPageSizeChange(Number(event.target.value))}
          >
            {pageSizeOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
      ) : null}
    </nav>
  );
}

/** Control segmentado (grilla/lista, vistas); botones con aria-pressed. */
export function SegmentedControl<T extends string>({
  value,
  options,
  onChange,
  label,
  disabled = false,
  size = "md",
  className = "",
}: {
  value: T;
  options: Array<{ value: T; label: string; icon?: Icon; disabled?: boolean }>;
  onChange(value: T): void;
  label: string;
  disabled?: boolean;
  size?: "sm" | "md";
  className?: string;
}) {
  return (
    <fieldset
      className={`ui-segmented ui-segmented--${size} ${className}`}
      aria-label={label}
      data-testid="ui-segmented"
    >
      {options.map((option) => {
        const IconComponent = option.icon;
        const selected = option.value === value;
        return (
          <button
            type="button"
            className={`ui-segmented__option${selected ? " ui-segmented__option--active" : ""}`}
            aria-pressed={selected}
            disabled={disabled || option.disabled}
            onClick={() => onChange(option.value)}
            key={option.value}
          >
            {IconComponent ? <IconComponent aria-hidden size={16} weight="regular" /> : null}
            {option.label}
          </button>
        );
      })}
    </fieldset>
  );
}
