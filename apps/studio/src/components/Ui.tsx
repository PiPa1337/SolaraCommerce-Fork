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

export function IconButton({
  icon: IconComponent,
  label,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { icon: Icon; label: string }) {
  return (
    <button className="icon-button" type="button" aria-label={label} title={label} {...props}>
      <IconComponent aria-hidden size={18} weight="regular" />
    </button>
  );
}

export const Button = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & {
    icon?: Icon;
    variant?: "primary" | "secondary" | "quiet" | "danger";
  }
>(function Button({ icon: IconComponent, children, variant = "secondary", ...props }, ref) {
  return (
    <button ref={ref} className={`button button--${variant}`} type="button" {...props}>
      {IconComponent ? <IconComponent aria-hidden size={17} weight="regular" /> : null}
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
    <div className="empty-state">
      <IconComponent aria-hidden size={30} weight="regular" />
      <h3>{title}</h3>
      <p>{body}</p>
      {action}
    </div>
  );
}

export function InlineError({ children }: { children: ReactNode }) {
  return (
    <div className="inline-error" role="alert">
      <WarningCircle aria-hidden size={18} />
      <span>{children}</span>
    </div>
  );
}

export function Field({
  label,
  hint,
  children,
  className = "",
}: {
  label: string;
  hint?: string;
  children: ReactNode;
  className?: string;
}) {
  const labelId = useId();
  const labeledChild =
    isValidElement<{ "aria-label"?: string; "aria-labelledby"?: string }>(children) &&
    typeof children.type === "string" &&
    ["input", "select", "textarea"].includes(children.type) &&
    children.props["aria-label"] === undefined &&
    children.props["aria-labelledby"] === undefined
      ? cloneElement(children, { "aria-labelledby": labelId })
      : children;

  return (
    <fieldset className={`field ${className}`}>
      <legend id={labelId}>{label}</legend>
      {labeledChild}
      {hint ? <small>{hint}</small> : null}
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
          key={`skeleton-${Math.max(42, 92 - index * 12)}`}
          style={{ width: `${Math.max(42, 92 - index * 12)}%` }}
        />
      ))}
    </output>
  );
}
