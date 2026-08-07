import { ArrowDown, ArrowUp, Copy, Plus, Trash } from "@phosphor-icons/react";
import type { StoreProjectV1 } from "@solara/project-schema";
import { useId } from "react";
import { Button, Field, IconButton } from "../../components/Ui";

type HeroSlideDraft = {
  id: string;
  eyebrow: string;
  title: string;
  body: string;
  actionLabel: string;
  actionHref: string;
  imageId: string;
};

function slideValue(slide: unknown, key: keyof HeroSlideDraft): string {
  if (!slide || typeof slide !== "object") return "";
  const value = (slide as Record<string, unknown>)[key];
  return typeof value === "string" ? value : "";
}

function normalizeSlide(slide: unknown, index: number): HeroSlideDraft {
  return {
    id: slideValue(slide, "id") || `slide-${index + 1}`,
    eyebrow: slideValue(slide, "eyebrow"),
    title: slideValue(slide, "title"),
    body: slideValue(slide, "body"),
    actionLabel: slideValue(slide, "actionLabel") || "Ver colección",
    actionHref: slideValue(slide, "actionHref") || "/",
    imageId: slideValue(slide, "imageId"),
  };
}

export function HeroSlidesEditor({
  value,
  project,
  error,
  onChange,
}: {
  value: unknown;
  project: StoreProjectV1;
  error?: string;
  onChange(next: HeroSlideDraft[]): void;
}) {
  const titleId = useId();
  const slides = Array.isArray(value) ? value.map(normalizeSlide) : [];
  const updateSlide = (index: number, key: keyof HeroSlideDraft, next: string) => {
    onChange(
      slides.map((slide, slideIndex) => (slideIndex === index ? { ...slide, [key]: next } : slide)),
    );
  };
  const moveSlide = (index: number, delta: -1 | 1) => {
    const target = index + delta;
    if (target < 0 || target >= slides.length) return;
    const next = [...slides];
    const current = next[index];
    const sibling = next[target];
    if (!current || !sibling) return;
    next[index] = sibling;
    next[target] = current;
    onChange(next);
  };
  const addSlide = () =>
    onChange([
      ...slides,
      {
        id: `slide-${crypto.randomUUID()}`,
        eyebrow: "",
        title: "Nueva diapositiva",
        body: "",
        actionLabel: "Ver colección",
        actionHref: "/",
        imageId: "",
      },
    ]);

  return (
    <section className="slides-editor" aria-labelledby={titleId}>
      <h4 className="visually-hidden" id={titleId}>
        Editor visual de slides
      </h4>
      <div className="slides-editor__header">
        <div>
          <strong>Slides del carrusel</strong>
          <small>{slides.length} configurados</small>
        </div>
        <Button icon={Plus} onClick={addSlide}>
          Agregar slide
        </Button>
      </div>
      {error ? <small className="field-error">{error}</small> : null}
      {slides.length === 0 ? (
        <p className="inspector-note">Agregá al menos dos slides para activar el carrusel.</p>
      ) : (
        <div className="slides-editor__list">
          {slides.map((slide, index) => (
            <article className="slide-card" key={slide.id}>
              <header className="slide-card__header">
                <strong>Slide {index + 1}</strong>
                <div className="slide-card__actions">
                  <IconButton
                    icon={ArrowUp}
                    label="Mover slide arriba"
                    disabled={index === 0}
                    onClick={() => moveSlide(index, -1)}
                  />
                  <IconButton
                    icon={ArrowDown}
                    label="Mover slide abajo"
                    disabled={index === slides.length - 1}
                    onClick={() => moveSlide(index, 1)}
                  />
                  <IconButton
                    icon={Copy}
                    label="Duplicar slide"
                    onClick={() =>
                      onChange([
                        ...slides.slice(0, index + 1),
                        { ...slide, id: `slide-${crypto.randomUUID()}` },
                        ...slides.slice(index + 1),
                      ])
                    }
                  />
                  <IconButton
                    icon={Trash}
                    label="Eliminar slide"
                    onClick={() =>
                      onChange(slides.filter((_item, slideIndex) => slideIndex !== index))
                    }
                  />
                </div>
              </header>
              <Field label="Imagen">
                <select
                  value={slide.imageId}
                  aria-label={`Imagen del slide ${index + 1}`}
                  onChange={(event) => updateSlide(index, "imageId", event.target.value)}
                >
                  <option value="">Sin imagen</option>
                  {project.assets.map((asset) => (
                    <option key={asset.id} value={asset.id}>
                      {asset.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Antetítulo">
                <input
                  value={slide.eyebrow}
                  aria-label={`Antetítulo del slide ${index + 1}`}
                  onChange={(event) => updateSlide(index, "eyebrow", event.target.value)}
                />
              </Field>
              <Field label="Título">
                <input
                  value={slide.title}
                  aria-label={`Título del slide ${index + 1}`}
                  onChange={(event) => updateSlide(index, "title", event.target.value)}
                />
              </Field>
              <Field label="Texto">
                <textarea
                  value={slide.body}
                  rows={3}
                  aria-label={`Texto del slide ${index + 1}`}
                  onChange={(event) => updateSlide(index, "body", event.target.value)}
                />
              </Field>
              <div className="inspector-split">
                <Field label="Texto del CTA">
                  <input
                    value={slide.actionLabel}
                    aria-label={`Texto del CTA del slide ${index + 1}`}
                    onChange={(event) => updateSlide(index, "actionLabel", event.target.value)}
                  />
                </Field>
                <Field label="Destino del CTA">
                  <input
                    type="url"
                    value={slide.actionHref}
                    aria-label={`Destino del CTA del slide ${index + 1}`}
                    onChange={(event) => updateSlide(index, "actionHref", event.target.value)}
                  />
                </Field>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
