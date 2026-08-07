import type { RegisteredModule } from "@solara/modules";
import type { StoreProjectV1 } from "@solara/project-schema";
import { useEffect, useState } from "react";
import { Field } from "../../components/Ui";
import { HeroSlidesEditor } from "./HeroSlidesEditor";
import { RepeaterEditor } from "./RepeaterEditor";

export function SettingsInspector({
  values,
  fields,
  schema,
  project,
  onChange,
}: {
  values: Record<string, unknown>;
  fields: RegisteredModule["settingsFields"];
  schema: RegisteredModule["settingsSchema"] | undefined;
  project: StoreProjectV1;
  onChange(values: Record<string, unknown>): void;
}) {
  const [draft, setDraft] = useState(values);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [rawArrays, setRawArrays] = useState<Record<string, string>>({});

  useEffect(() => {
    setDraft(values);
    setErrors({});
    setRawArrays({});
  }, [values]);

  if (fields.length === 0) {
    return <p className="inspector-note">Este módulo no requiere configuración.</p>;
  }

  const setValue = (key: string, next: unknown) => {
    const candidate = { ...draft, [key]: next };
    setDraft(candidate);
    if (!schema) return;
    const result = schema.safeParse(candidate);
    if (result.success) {
      setErrors({});
      setRawArrays((current) => {
        const next = { ...current };
        delete next[key];
        return next;
      });
      onChange(result.data as Record<string, unknown>);
      return;
    }
    setErrors(
      Object.fromEntries(
        result.error.issues.map((issue) => [String(issue.path[0] ?? key), issue.message]),
      ),
    );
  };

  return (
    <div className="settings-fields">
      {fields.map((field) => {
        const value = draft[field.key];
        const error = errors[field.key];
        const hint = error ?? field.description;
        if (field.type === "boolean") {
          return (
            <div key={field.key}>
              <label className="check-field">
                <input
                  type="checkbox"
                  checked={Boolean(value)}
                  onChange={(event) => setValue(field.key, event.target.checked)}
                />
                {field.label}
              </label>
              {error ? <small className="field-error">{error}</small> : null}
            </div>
          );
        }
        if (field.type === "number") {
          return (
            <Field label={field.label} {...(error ? { hint: error } : {})} key={field.key}>
              <input
                type="number"
                value={String(value ?? "")}
                min={field.min}
                max={field.max}
                step={field.step}
                aria-invalid={Boolean(error)}
                onChange={(event) => setValue(field.key, Number(event.target.value))}
              />
            </Field>
          );
        }
        if (field.type === "asset") {
          const acceptsVideo = field.key.toLowerCase().includes("video");
          return (
            <Field label={field.label} {...(error ? { hint: error } : {})} key={field.key}>
              <select
                value={String(value ?? "")}
                aria-invalid={Boolean(error)}
                onChange={(event) => setValue(field.key, event.target.value)}
              >
                <option value="">Sin imagen</option>
                {!acceptsVideo
                  ? project.assets.map((asset) => (
                      <option key={asset.id} value={asset.id}>
                        {asset.name}
                      </option>
                    ))
                  : null}
                {acceptsVideo && project.videos.length > 0 ? (
                  <optgroup label="Videos">
                    {project.videos.map((video) => (
                      <option key={video.id} value={video.id}>
                        {video.name}
                      </option>
                    ))}
                  </optgroup>
                ) : null}
              </select>
            </Field>
          );
        }
        if (field.type === "select") {
          return (
            <Field label={field.label} {...(error ? { hint: error } : {})} key={field.key}>
              <select
                value={String(value ?? "")}
                aria-invalid={Boolean(error)}
                onChange={(event) => setValue(field.key, event.target.value)}
              >
                {field.options.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </Field>
          );
        }
        if (field.type === "array") {
          if (field.key === "slides") {
            return (
              <HeroSlidesEditor
                key={field.key}
                value={value}
                project={project}
                {...(error ? { error } : {})}
                onChange={(next) => setValue(field.key, next)}
              />
            );
          }
          return (
            <Field label={field.label} {...(hint ? { hint } : {})} key={field.key}>
              <textarea
                value={rawArrays[field.key] ?? JSON.stringify(value ?? [], null, 2)}
                rows={6}
                aria-invalid={Boolean(error)}
                onChange={(event) => {
                  try {
                    const parsed = JSON.parse(event.target.value);
                    setValue(field.key, parsed);
                  } catch {
                    setDraft((current) => ({ ...current, [field.key]: event.target.value }));
                    setRawArrays((current) => ({ ...current, [field.key]: event.target.value }));
                    setErrors((current) => ({ ...current, [field.key]: "JSON inválido." }));
                  }
                }}
              />
            </Field>
          );
        }
        if (field.type === "repeater") {
          return (
            <RepeaterEditor
              key={field.key}
              label={field.label}
              value={value}
              fields={field.fields}
              {...(field.minItems === undefined ? {} : { minItems: field.minItems })}
              {...(field.maxItems === undefined ? {} : { maxItems: field.maxItems })}
              {...(field.itemLabelKey === undefined ? {} : { itemLabelKey: field.itemLabelKey })}
              {...(error === undefined ? {} : { error })}
              project={project}
              onChange={(next) => setValue(field.key, next)}
            />
          );
        }
        const text = String(value ?? "");
        return (
          <Field
            label={field.label}
            {...(hint ? { hint } : {})}
            key={field.key}
            className={error ? "field--error" : ""}
          >
            {field.type === "rich-text" ? (
              <textarea
                value={text}
                rows={4}
                placeholder={field.placeholder}
                aria-invalid={Boolean(error)}
                onChange={(event) => setValue(field.key, event.target.value)}
              />
            ) : (
              <input
                type={field.type === "url" ? "url" : "text"}
                value={text}
                placeholder={field.placeholder}
                aria-invalid={Boolean(error)}
                onChange={(event) => setValue(field.key, event.target.value)}
              />
            )}
          </Field>
        );
      })}
    </div>
  );
}
