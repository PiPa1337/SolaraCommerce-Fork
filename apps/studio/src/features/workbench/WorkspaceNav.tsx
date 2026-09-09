import { type ReactNode, useId, useState } from "react";

export interface WorkspaceGroup {
  id: string;
  label: string;
  content: ReactNode;
}

/** Keep all forms mounted so switching groups never discards draft input or validation. */
export function WorkspaceGroups({ label, groups }: { label: string; groups: WorkspaceGroup[] }) {
  const [active, setActive] = useState(groups[0]?.id ?? "");
  const prefix = useId();
  return (
    <div className="workspace-groups">
      <nav className="workspace-local-nav" aria-label={label}>
        {groups.map((group) => (
          <button
            key={group.id}
            type="button"
            aria-current={active === group.id ? "location" : undefined}
            aria-controls={`${prefix}-${group.id}`}
            onClick={() => {
              setActive(group.id);
              const target = document.getElementById(`${prefix}-${group.id}`);
              target?.scrollIntoView({ block: "start", behavior: "instant" });
              target?.focus({ preventScroll: true });
            }}
          >
            {group.label}
          </button>
        ))}
      </nav>
      {groups.map((group) => (
        <section
          key={group.id}
          id={`${prefix}-${group.id}`}
          tabIndex={-1}
          className="workspace-group"
          aria-label={group.label}
        >
          <h3 className="workspace-group-title">{group.label}</h3>
          {group.content}
        </section>
      ))}
    </div>
  );
}
