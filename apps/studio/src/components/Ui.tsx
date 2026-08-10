import type { Icon } from "@phosphor-icons/react";
import { WarningCircle } from "@phosphor-icons/react";
import {
  type ButtonHTMLAttributes,
  cloneElement,
  forwardRef,
  type HTMLAttributes,
  isValidElement,
  type ReactNode,
  useId,
} from "react";
import { Tooltip } from "./primitives";

export function IconButton({
  icon: IconComponent,
  label,
  tooltip,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  icon: Icon;
  label: string;
  /** Tooltip visual (primitiva Tooltip con data-tip); `title` sigue como fallback. */
  tooltip?: string;
}) {
  const button = (
    <button
      className="icon-button"
      type="button"
      data-testid="ui-icon-button"
      aria-label={label}
      title={label}
      {...props}
    >
      <IconComponent aria-hidden size={18} weight="regular" />
    </button>
  );
  return tooltip ? <Tooltip tip={tooltip}>{button}</Tooltip> : button;
}

export const Button = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & {
    icon?: Icon;
    variant?: "primary" | "secondary" | "quiet" | "danger";
    size?: "sm" | "md";
    loading?: boolean;
  }
>(function Button(
  {
    icon: IconComponent,
    children,
    variant = "secondary",
    size = "md",
    loading = false,
    disabled,
    ...props
  },
  ref,
) {
  return (
    <button
      ref={ref}
      className={`button button--${variant} button--${size}${loading ? " button--loading" : ""}`}
      type="button"
      data-testid="ui-button"
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? (
        <span className="spinner" aria-hidden />
      ) : IconComponent ? (
        <IconComponent aria-hidden size={17} weight="regular" />
      ) : null}
      <span>{children}</span>
    </button>
  );
});

export function EmptyState({
  icon: IconComponent,
  title,
  body,
  action,
}: {
  icon: Icon;
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty-state" data-testid="ui-empty-state">
      <IconComponent aria-hidden size={30} weight="regular" />
      <h3>{title}</h3>
      <p>{body}</p>
      {action}
    </div>
  );
}

export function InlineError({ children }: { children: ReactNode }) {
  return (
    <div className="inline-error" role="alert" data-testid="ui-inline-error">
      <WarningCircle aria-hidden size={18} />
      <span>{children}</span>
    </div>
  );
}

export function Field({
  label,
  hint,
  error,
  children,
  className = "",
}: {
  label: string;
  hint?: string;
  /** Mensaje de error inline: borde danger, texto y aria-describedby. */
  error?: string;
  children: ReactNode;
  className?: string;
}) {
  const labelId = useId();
  const hintId = useId();
  const errorId = useId();
  const isNativeControl =
    isValidElement<Record<string, unknown>>(children) &&
    typeof children.type === "string" &&
    ["input", "select", "textarea"].includes(children.type);
  const patches: Record<string, string | boolean> = {};
  if (isNativeControl) {
    if (
      children.props["aria-label"] === undefined &&
      children.props["aria-labelledby"] === undefined
    ) {
      patches["aria-labelledby"] = labelId;
    }
    if (error) {
      patches["aria-describedby"] = errorId;
      patches["aria-invalid"] = true;
    } else if (hint) {
      patches["aria-describedby"] = hintId;
    }
  }
  const labeledChild =
    isNativeControl && Object.keys(patches).length > 0 ? cloneElement(children, patches) : children;

  return (
    <fieldset
      className={`field ${error ? "field--error" : ""} ${className}`}
      aria-invalid={error ? true : undefined}
    >
      <legend id={labelId}>{label}</legend>
      {labeledChild}
      {hint ? <small id={hintId}>{hint}</small> : null}
      {error ? (
        <small id={errorId} className="field-error" role="alert" data-testid="ui-field-error">
          {error}
        </small>
      ) : null}
    </fieldset>
  );
}

export function SectionHeader({
  title,
  description,
  actions,
  ...props
}: HTMLAttributes<HTMLElement> & { title: string; description?: string; actions?: ReactNode }) {
  return (
    <header className="section-header" {...props}>
      <div>
        <h2>{title}</h2>
        {description ? <p>{description}</p> : null}
      </div>
      {actions ? <div className="section-actions">{actions}</div> : null}
    </header>
  );
}

export function Skeleton({ lines = 4 }: { lines?: number }) {
  return (
    <output className="skeleton" aria-label="Cargando">
      {Array.from({ length: lines }, (_, index) => (
        <span
          key={`skeleton-${92 - index * 12}`}
          style={{ width: `${Math.max(42, 92 - index * 12)}%` }}
        />
      ))}
    </output>
  );
}
