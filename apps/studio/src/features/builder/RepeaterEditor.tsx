import type { RepeaterItemField } from "@solara/modules";
import type { StoreProjectV1 } from "@solara/project-schema";
import { useId, useRef, useState } from "react";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { Field } from "../../components/Ui";
import { defaultRepeaterItem } from "./repeaterDefaults";

type PendingRepeaterDelete = {
  index: number;
  label: string;
};

export function RepeaterEditor({
  label,
  value,
  fields,
  minItems,
  maxItems,
  itemLabelKey,
  error,
  project,
  onChange,
}: {
  label: string;
  value: unknown;
  fields: readonly RepeaterItemField[];
  minItems?: number;
  maxItems?: number;
  itemLabelKey?: string;
  error?: string;
  project: StoreProjectV1;
  onChange(next: unknown[]): void;
}) {
  const items = Array.isArray(value)
    ? value.filter((item): item is Record<string, unknown> =>
        Boolean(item && typeof item === "object"),
      )
    : [];
  const editorId = useId();
  const editorRef = useRef<HTMLFieldSetElement>(null);
  const [pendingDelete, setPendingDelete] = useState<PendingRepeaterDelete | null>(null);
  const defaults = () => defaultRepeaterItem(fields, project, itemLabelKey);
  const update = (index: number, key: string, next: unknown) =>
    onChange(
      items.map((item, itemIndex) => (itemIndex === index ? { ...item, [key]: next } : item)),
    );
  const duplicate = (index: number) => {
    const current = items[index];
    if (!current) return;
    onChange([
      ...items.slice(0, index + 1),
      { ...current, id: `item-${crypto.randomUUID()}` },
      ...items.slice(index + 1),
    ]);
  };
  const move = (index: number, delta: -1 | 1) => {
    const target = index + delta;
    if (target < 0 || target >= items.length) return;
    const next = [...items];
    const current = next[index];
    const sibling = next[target];
    if (!current || !sibling) return;
    next[index] = sibling;
    next[target] = current;
    onChange(next);
  };
  const removeItem = (index: number) => {
    if (index < 0 || index >= items.length) return;
    const nextFocusIndex = items[index + 1] ? index : index - 1;
    onChange(items.filter((_, itemIndex) => itemIndex !== index));
    requestAnimationFrame(() => {
      const focusTarget =
        nextFocusIndex >= 0
          ? editorRef.current?.querySelector<HTMLElement>(
              `[data-repeater-delete-index="${nextFocusIndex}"]`,
            )
          : null;
      (
        focusTarget ?? editorRef.current?.querySelector<HTMLElement>("[data-repeater-add]")
      )?.focus();
    });
  };
  return (
    <fieldset className="repeater-editor" ref={editorRef} data-repeater-id={editorId}>
      <legend>{label}</legend>
      {items.map((item, index) => (
        <article className="repeater-editor__item" key={String(item.id ?? index)}>
          <header>
            <strong>
              {String((itemLabelKey && item[itemLabelKey]) || `${label} ${index + 1}`)}
            </strong>
            <div>
              <button
                type="button"
                onClick={() => move(index, -1)}
                disabled={index === 0}
                aria-label="Subir elemento"
                aria-description={`${label} ${index + 1} de ${items.length}`}
              >
                ↑
              </button>
              <button
                type="button"
                onClick={() => move(index, 1)}
                disabled={index === items.length - 1}
                aria-label="Bajar elemento"
                aria-description={`${label} ${index + 1} de ${items.length}`}
              >
                ↓
              </button>
              <button
                type="button"
                onClick={() => duplicate(index)}
                disabled={maxItems !== undefined && items.length >= maxItems}
                aria-label="Duplicar elemento"
                aria-description={`${label} ${index + 1} de ${items.length}`}
              >
                Duplicar
              </button>
              <button
                type="button"
                onClick={() =>
                  setPendingDelete({
                    index,
                    label: String((itemLabelKey && item[itemLabelKey]) || `${label} ${index + 1}`),
                  })
                }
                disabled={items.length <= (minItems ?? 0)}
                aria-label="Eliminar elemento"
                aria-description={`${label} ${index + 1} de ${items.length}`}
                data-repeater-delete-index={index}
              >
                Eliminar
              </button>
            </div>
          </header>
          {fields.map((field) => {
            const current = item[field.key];
            if (field.type === "boolean") {
              return (
                <label className="check-field" key={field.key}>
                  <input
                    type="checkbox"
                    checked={Boolean(current)}
                    onChange={(event) => update(index, field.key, event.target.checked)}
                  />
                  {field.label}
                </label>
              );
            }
            if (field.type === "asset") {
              return (
                <Field label={field.label} key={field.key}>
                  <select
                    value={String(current ?? "")}
                    onChange={(event) => update(index, field.key, event.target.value)}
                  >
                    <option value="">Sin asset</option>
                    {project.assets.map((asset) => (
                      <option key={asset.id} value={asset.id}>
                        {asset.name}
                      </option>
                    ))}
                  </select>
                </Field>
              );
            }
            if (field.type === "select") {
              return (
                <Field label={field.label} key={field.key}>
                  <select
                    value={String(current ?? "")}
                    onChange={(event) => update(index, field.key, event.target.value)}
                  >
                    {field.options?.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </Field>
              );
            }
            return (
              <Field label={field.label} key={field.key}>
                <input
                  type={field.type === "number" ? "number" : field.type === "url" ? "url" : "text"}
                  value={String(current ?? "")}
                  min={field.min}
                  max={field.max}
                  step={field.step}
                  onChange={(event) =>
                    update(
                      index,
                      field.key,
                      field.type === "number"
                        ? event.target.value.trim() === ""
                          ? ""
                          : Number(event.target.value)
                        : event.target.value,
                    )
                  }
                />
              </Field>
            );
          })}
        </article>
      ))}
      <button
        type="button"
        className="secondary-button"
        onClick={() => onChange([...items, defaults()])}
        disabled={maxItems !== undefined && items.length >= maxItems}
        data-repeater-add
      >
        Agregar elemento
      </button>
      {error ? <small className="field-error">{error}</small> : null}
      {pendingDelete ? (
        <ConfirmDialog
          title="Eliminar elemento"
          body={
            <>
              Se eliminará «{pendingDelete.label}» y todos sus campos del editor. Podés cancelar
              ahora si no querés cambiar el borrador.
            </>
          }
          confirmLabel="Eliminar elemento"
          danger
          onConfirm={() => {
            const index = pendingDelete.index;
            setPendingDelete(null);
            requestAnimationFrame(() => removeItem(index));
          }}
          onCancel={() => setPendingDelete(null)}
        />
      ) : null}
    </fieldset>
  );
}
