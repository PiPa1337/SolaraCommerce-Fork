import type { RegisteredModule } from "@solara/modules";
import type { StoreProjectV1 } from "@solara/project-schema";
import type { ChangeEvent } from "react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Button, Field, InlineError } from "../../components/Ui";
import { hashFile } from "../../lib/workers";
import { HeroSlidesEditor } from "./HeroSlidesEditor";
import { RepeaterEditor } from "./RepeaterEditor";
import {
  applyVideoPoster,
  applyVideoToSection,
  buildVideoAsset,
  sectionSettingsWithVideo,
} from "./videoUpload";

function formatIssuePaths(issues: Array<{ path: readonly PropertyKey[] }>): string {
  return [...new Set(issues.map((issue) => issue.path.join(".") || "settings"))].join(", ");
}

function splitSchemaIssues(
  issues: readonly { path: readonly PropertyKey[]; message: string }[],
  fallbackKey?: string,
): {
  topLevel: Record<string, string>;
  nested: Record<string, string>;
} {
  const topLevel: Record<string, string> = {};
  const nested: Record<string, string> = {};

  for (const issue of issues) {
    const root =
      typeof issue.path[0] === "string" && issue.path[0]
        ? issue.path[0]
        : (fallbackKey ?? "settings");
    topLevel[root] ??= issue.message;

    const index = issue.path[1];
    const field = issue.path[2];
    if (
      typeof issue.path[0] === "string" &&
      typeof index === "number" &&
      typeof field === "string"
    ) {
      nested[`${issue.path[0]}.${index}.${field}`] ??= issue.message;
    }
  }

  return { topLevel, nested };
}

export function SettingsInspector({
  values,
  fields,
  schema,
  project,
  onChange,
  onProjectChange,
  sectionId,
  moduleId,
}: {
  values: Record<string, unknown>;
  fields: RegisteredModule["settingsFields"];
  schema: RegisteredModule["settingsSchema"] | undefined;
  project: StoreProjectV1;
  onChange(values: Record<string, unknown>): void;
  onProjectChange?(project: StoreProjectV1): void;
  sectionId?: string;
  moduleId?: string;
}) {
  const [draft, setDraft] = useState(values);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [nestedErrors, setNestedErrors] = useState<Record<string, string>>({});
  const [rawArrays, setRawArrays] = useState<Record<string, string>>({});
  const [videoUploadBusy, setVideoUploadBusy] = useState(false);
  const [videoUploadError, setVideoUploadError] = useState("");
  const videoInputRef = useRef<HTMLInputElement>(null);
  const pendingVideoFieldRef = useRef("");
  const errorIdPrefix = useId();

  useEffect(() => {
    setDraft(values);
    setErrors({});
    setNestedErrors({});
    setRawArrays({});
  }, [values]);

  /**
   * Errores de esquema del borrador actual: sólo cuando el usuario desvió el
   * draft de los valores confirmados (que ya son válidos). Si el proyecto
   * cargó con settings inválidos, el error lo reporta Builder con el estado
   * confirmado y el panel sigue disponible para corregirlo.
   */
  const draftError = useMemo(() => {
    if (!schema || draft === values) return "";
    const result = schema.safeParse(draft);
    return result.success ? "" : formatIssuePaths(result.error.issues);
  }, [draft, schema, values]);

  if (fields.length === 0) {
    return <p className="inspector-note">Este módulo no requiere configuración.</p>;
  }

  const handleVideoFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    const fieldKey = pendingVideoFieldRef.current;
    if (!file || !fieldKey || !onProjectChange) return;
    setVideoUploadBusy(true);
    setVideoUploadError("");
    try {
      const hash = await hashFile(file);
      const existing = project.videos.find((video) => video.hash === hash);
      if (existing) {
        // El video ya está en el proyecto: se refresca el poster (primer
        // frame) si la extracción produce uno, se apunta el campo y el
        // modo/poster se alinean — todo en una sola actualización.
        const rebuilt = await buildVideoAsset(file, { hash });
        const nextSettings = sectionSettingsWithVideo(draft, fieldKey, existing.id);
        setDraft(nextSettings);
        if (schema) {
          const result = schema.safeParse(nextSettings);
          if (result.success) onChange(result.data);
        }
        if (rebuilt.posterImage) {
          const withPoster = applyVideoPoster(project, existing.id, rebuilt.posterImage);
          onProjectChange({
            ...withPoster,
            sections: withPoster.sections.map((section) =>
              section.id === sectionId ? { ...section, settings: nextSettings } : section,
            ),
            updatedAt: new Date().toISOString(),
          });
        }
        return;
      }
      const video = await buildVideoAsset(file, { hash });
      if (sectionId) {
        // Atómico: el proyecto nuevo trae el video (y su poster automático) Y
        // el setting de la sección en una sola actualización para que el parse
        // nunca vea un estado intermedio inválido. Si la sección tiene un
        // setting `mode`, pasa a "video" para que el render use el video.
        const nextSettings = sectionSettingsWithVideo(draft, fieldKey, video.video.id);
        const nextProject = applyVideoToSection(
          project,
          sectionId,
          nextSettings,
          fieldKey,
          video.video,
          video.posterImage,
        );
        setDraft(nextSettings);
        onProjectChange(nextProject);
      } else {
        onProjectChange({
          ...project,
          videos: [...project.videos, video.video],
          ...(video.posterImage ? { assets: [...project.assets, video.posterImage] } : {}),
          updatedAt: new Date().toISOString(),
        });
        setValue(fieldKey, video.video.id);
      }
    } catch (reason) {
      setVideoUploadError(reason instanceof Error ? reason.message : "No se pudo subir el video.");
    } finally {
      setVideoUploadBusy(false);
    }
  };

  const setValue = (key: string, next: unknown) => {
    const candidate = { ...draft, [key]: next };
    setDraft(candidate);
    if (!schema) return;
    const result = schema.safeParse(candidate);
    if (result.success) {
      setErrors({});
      setNestedErrors({});
      setRawArrays((current) => {
        const next = { ...current };
        delete next[key];
        return next;
      });
      onChange(result.data as Record<string, unknown>);
      return;
    }
    const mapped = splitSchemaIssues(result.error.issues, key);
    setErrors(mapped.topLevel);
    setNestedErrors(mapped.nested);
  };

  return (
    <div className="settings-fields">
      {draftError ? (
        <div data-testid="ui-schema-errors">
          <InlineError>
            Errores de configuración en: {draftError}. Corregí los campos marcados para aplicar los
            cambios.
          </InlineError>
        </div>
      ) : null}
      {fields.map((field) => {
        const value = draft[field.key];
        const error = errors[field.key];
        const feedback = error ? { error } : field.description ? { hint: field.description } : {};
        if (field.type === "boolean") {
          const errorId = `${errorIdPrefix}-${field.key.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
          return (
            <div key={field.key}>
              <label className="check-field">
                <input
                  type="checkbox"
                  checked={Boolean(value)}
                  aria-invalid={Boolean(error)}
                  {...(error ? { "aria-describedby": errorId } : {})}
                  onChange={(event) => setValue(field.key, event.target.checked)}
                />
                {field.label}
              </label>
              {error ? (
                <small
                  id={errorId}
                  className="field-error"
                  role="alert"
                  data-testid="ui-field-error"
                >
                  {error}
                </small>
              ) : null}
            </div>
          );
        }
        if (field.type === "number") {
          return (
            <Field label={field.label} {...feedback} key={field.key}>
              <input
                type="number"
                value={String(value ?? "")}
                min={field.min}
                max={field.max}
                step={field.step}
                aria-invalid={Boolean(error)}
                onChange={(event) =>
                  setValue(
                    field.key,
                    event.target.value.trim() === "" ? "" : Number(event.target.value),
                  )
                }
              />
            </Field>
          );
        }
        if (field.type === "asset") {
          const acceptsVideo = field.key.toLowerCase().includes("video");
          return (
            <Field label={field.label} {...feedback} key={field.key}>
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
              {acceptsVideo && onProjectChange ? (
                <div className="inspector-video-upload">
                  <input
                    ref={videoInputRef}
                    type="file"
                    accept="video/mp4,video/webm"
                    hidden
                    onChange={handleVideoFile}
                  />
                  <Button
                    variant="quiet"
                    onClick={() => {
                      pendingVideoFieldRef.current = field.key;
                      setVideoUploadError("");
                      videoInputRef.current?.click();
                    }}
                    disabled={videoUploadBusy}
                  >
                    {videoUploadBusy ? "Subiendo video..." : "Subir video"}
                  </Button>
                  {videoUploadError ? <InlineError>{videoUploadError}</InlineError> : null}
                </div>
              ) : null}
            </Field>
          );
        }
        if (field.type === "select") {
          // El hero V2 es media 9:16 sólo video: el editor no ofrece imagen ni
          // carrusel (el schema conserva los valores para compatibilidad).
          const modeOptions =
            field.key === "mode" &&
            moduleId === "catalog-hero" &&
            project.commerceTemplates.designFamily === "catalog-modern-v2"
              ? (field.options ?? []).filter((option) => option.value === "video")
              : field.options;
          return (
            <Field label={field.label} {...feedback} key={field.key}>
              <select
                value={String(value ?? "")}
                aria-invalid={Boolean(error)}
                onChange={(event) => setValue(field.key, event.target.value)}
              >
                {modeOptions.map((option) => (
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
                fieldPath={field.key}
                fieldErrors={nestedErrors}
                {...(error ? { error } : {})}
                onChange={(next) => setValue(field.key, next)}
              />
            );
          }
          return (
            <Field label={field.label} {...feedback} key={field.key}>
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
                    setNestedErrors({});
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
              fieldPath={field.key}
              fieldErrors={nestedErrors}
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
            {...feedback}
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
