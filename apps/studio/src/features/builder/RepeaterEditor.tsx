import type { RepeaterItemField } from "@solara/modules";
import type { StoreProjectV1 } from "@solara/project-schema";
import { Field } from "../../components/Ui";
import { defaultRepeaterItem } from "./repeaterDefaults";

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
  const defaults = () => defaultRepeaterItem(fields, project, itemLabelKey);
  const update = (index: number, key: string, next: unknown) =>
    onChange(
      items.map((item, itemIndex) => (itemIndex === index ? { ...item, [key]: next } : item)),
    );
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
  return (
    <fieldset className="repeater-editor">
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
              >
                ↑
              </button>
              <button
                type="button"
                onClick={() => move(index, 1)}
                disabled={index === items.length - 1}
                aria-label="Bajar elemento"
              >
                ↓
              </button>
              <button
                type="button"
                onClick={() => onChange(items.filter((_, itemIndex) => itemIndex !== index))}
                disabled={items.length <= (minItems ?? 0)}
                aria-label="Eliminar elemento"
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
      >
        Agregar elemento
      </button>
      {error ? <small className="field-error">{error}</small> : null}
    </fieldset>
  );
}
