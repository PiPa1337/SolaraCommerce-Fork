/** Edición de producto y variantes; entrega snapshots validados al reducer del catálogo. */
import { ArrowDown, ArrowUp, Copy, Plus, Trash, X } from "@phosphor-icons/react";
import {
  type Category,
  type Collection,
  type ImageAsset,
  type Product,
  ProductSchema,
  type Variant,
} from "@solara/project-schema";
import { useEffect, useId, useRef, useState } from "react";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { Button, Field, IconButton, InlineError } from "../../components/Ui";

interface ProductEditorProps {
  product: Product;
  categories: Category[];
  collections: Collection[];
  assets: ImageAsset[];
  existingSlugs: string[];
  mode: "create" | "edit";
  onCancel(): void;
  onSave(product: Product): void;
}

type EditorStep = "details" | "media" | "organization" | "variants";

const editorSteps: Array<{ id: EditorStep; label: string }> = [
  { id: "details", label: "Datos" },
  { id: "media", label: "Imágenes" },
  { id: "organization", label: "Organización" },
  { id: "variants", label: "Variantes" },
];

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const STATUS_LABELS: Record<Product["status"], string> = {
  active: "Activo",
  hidden: "Oculto",
  archived: "Archivado",
};

/** Slug local desde el título: minúsculas, números y guiones (NFD quita acentos). */
function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

function formatCents(cents: number): string {
  return `$${cents.toLocaleString("es-AR")}`;
}

function slugErrorFor(slug: string, existingSlugs: string[]): string | undefined {
  if (!slug) return "Escribí un slug o se generará desde el título.";
  if (slug.length > 120) return "El slug no puede superar los 120 caracteres.";
  if (!SLUG_PATTERN.test(slug)) {
    return "Solo minúsculas, números y guiones (ejemplo: lampara-horizonte).";
  }
  if (existingSlugs.includes(slug)) return "Ya existe otro producto con este slug.";
  return undefined;
}

/** Índice de paso objetivo para navegación con teclado (flechas, Home/End). */
function stepTarget(index: number, key: string): number | undefined {
  if (key === "Home") return 0;
  if (key === "End") return editorSteps.length - 1;
  if (key === "ArrowRight") return Math.min(editorSteps.length - 1, index + 1);
  if (key === "ArrowLeft") return Math.max(0, index - 1);
  return undefined;
}

interface VariantFieldErrors {
  title: string | undefined;
  price: string | undefined;
  options: string | undefined;
}

interface DraftErrors {
  title: string | undefined;
  slugError: string | undefined;
  slugAvailable: boolean;
  variantErrors: VariantFieldErrors[];
}

/** Props de feedback del campo slug: error inline o estado "Disponible". */
function slugFieldFeedback(errors: DraftErrors): {
  hint: string;
  error?: string;
  className?: string;
} {
  if (errors.slugError) return { hint: "", error: errors.slugError };
  return {
    hint: errors.slugAvailable ? "Disponible" : "Minúsculas, números y guiones.",
    ...(errors.slugAvailable ? { className: "field--slug-available" } : {}),
  };
}

function validateDraft(
  draft: Product,
  optionValues: Record<string, string>,
  existingSlugs: string[],
): DraftErrors {
  const slug = draft.slug.trim();
  const slugError = slugErrorFor(slug, existingSlugs);
  const variantErrors = draft.variants.map((variant) => {
    const fieldErrors: VariantFieldErrors = {
      title: undefined,
      price: undefined,
      options: undefined,
    };
    if (!variant.title.trim()) fieldErrors.title = "Escribí un nombre para la variante.";
    if (!Number.isInteger(variant.price) || variant.price < 0) {
      fieldErrors.price = "El precio debe ser un número entero en centavos, mayor o igual a 0.";
    }
    try {
      parseOptions(optionValues[variant.id] ?? "");
    } catch (reason) {
      fieldErrors.options =
        reason instanceof Error ? reason.message : "Las opciones de la variante no son válidas.";
    }
    return fieldErrors;
  });
  return {
    title: draft.title.trim() ? undefined : "Escribí un título para el producto.",
    slugError,
    slugAvailable: slug !== "" && slugError === undefined,
    variantErrors,
  };
}

function optionsText(options: Record<string, string>): string {
  return Object.entries(options)
    .map(([name, value]) => `${name}=${value}`)
    .join(", ");
}

function parseOptions(value: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const item of value
    .split(",")
    .map((candidate) => candidate.trim())
    .filter(Boolean)) {
    const separator = item.indexOf("=");
    if (separator <= 0 || separator === item.length - 1) {
      throw new Error(`La opción "${item}" debe usar el formato Nombre=Valor.`);
    }
    const name = item.slice(0, separator).trim();
    const optionValue = item.slice(separator + 1).trim();
    if (name in result) throw new Error(`La opción "${name}" está repetida.`);
    result[name] = optionValue;
  }
  return result;
}

function setOptionalText(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed || undefined;
}

function orderedCategories(categories: Category[]): Category[] {
  const childrenByParent = new Map<string, Category[]>();
  categories.forEach((category) => {
    if (!category.parentId) return;
    childrenByParent.set(category.parentId, [
      ...(childrenByParent.get(category.parentId) ?? []),
      category,
    ]);
  });
  const ordered: Category[] = [];
  const visit = (category: Category): void => {
    ordered.push(category);
    (childrenByParent.get(category.id) ?? []).forEach(visit);
  };
  categories.filter((category) => !category.parentId).forEach(visit);
  return ordered;
}

export function ProductEditor({
  product,
  categories,
  collections,
  assets,
  existingSlugs,
  mode,
  onCancel,
  onSave,
}: ProductEditorProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [draft, setDraft] = useState<Product>(() => structuredClone(product));
  const [optionValues, setOptionValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      product.variants.map((variant) => [variant.id, optionsText(variant.optionValues)]),
    ),
  );
  const [tags, setTags] = useState(product.tags.join(", "));
  const [error, setError] = useState("");
  const [confirmClose, setConfirmClose] = useState(false);
  const [activeStep, setActiveStep] = useState<EditorStep>("details");
  const [slugTouched, setSlugTouched] = useState(
    mode === "edit" && product.slug !== slugify(product.title),
  );
  const stepRefs = useRef<Record<EditorStep, HTMLFieldSetElement | null>>({
    details: null,
    media: null,
    organization: null,
    variants: null,
  });
  const stepButtons = useRef<Array<HTMLButtonElement | null>>([]);
  const pristine = useRef({
    product: structuredClone(product),
    tags: product.tags.join(", "),
    optionValues: Object.fromEntries(
      product.variants.map((variant) => [variant.id, optionsText(variant.optionValues)]),
    ),
  });
  const titleId = useId();
  const stepIdPrefix = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    dialog.showModal();
    return () => dialog.close();
  }, []);

  const isDirty =
    JSON.stringify(draft) !== JSON.stringify(pristine.current.product) ||
    tags !== pristine.current.tags ||
    JSON.stringify(optionValues) !== JSON.stringify(pristine.current.optionValues);

  const errors = validateDraft(draft, optionValues, existingSlugs);

  const firstImage = assets.find((asset) => asset.id === draft.imageIds[0]);
  const minimumPrice =
    draft.variants.length > 0 ? Math.min(...draft.variants.map((variant) => variant.price)) : 0;

  const requestClose = () => {
    if (isDirty) {
      setConfirmClose(true);
      return;
    }
    onCancel();
  };

  const updateVariant = (id: string, update: (variant: Variant) => Variant) => {
    setDraft((current) => ({
      ...current,
      variants: current.variants.map((variant) => (variant.id === id ? update(variant) : variant)),
    }));
  };

  const addVariant = (source?: Variant) => {
    const id = `variant-${crypto.randomUUID()}` as Variant["id"];
    const variant: Variant = source
      ? { ...structuredClone(source), id, title: `${source.title} copia` }
      : {
          id,
          sku: "",
          title: "Nueva variante",
          optionValues: {},
          price: 0 as Variant["price"],
          available: true,
          stockStatus: "in_stock",
        };
    setDraft((current) => ({ ...current, variants: [...current.variants, variant] }));
    setOptionValues((current) => ({ ...current, [id]: optionsText(variant.optionValues) }));
  };

  const moveVariant = (id: string, direction: -1 | 1) => {
    setDraft((current) => {
      const index = current.variants.findIndex((variant) => variant.id === id);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= current.variants.length) return current;
      const variants = [...current.variants];
      const [moved] = variants.splice(index, 1);
      if (moved === undefined) return current;
      variants.splice(target, 0, moved);
      return { ...current, variants };
    });
  };

  const save = () => {
    setError("");
    if (
      errors.title !== undefined ||
      errors.slugError !== undefined ||
      errors.variantErrors.some(
        (variant) =>
          variant.title !== undefined ||
          variant.price !== undefined ||
          variant.options !== undefined,
      )
    ) {
      return;
    }
    try {
      const normalizedSlug = draft.slug.trim();
      const parsed = ProductSchema.parse({
        ...draft,
        slug: normalizedSlug,
        title: draft.title.trim(),
        brand: draft.brand.trim(),
        tags: [
          ...new Set(
            tags
              .split(",")
              .map((tag) => tag.trim())
              .filter(Boolean),
          ),
        ],
        variants: draft.variants.map((variant) => ({
          ...variant,
          title: variant.title.trim(),
          sku: variant.sku.trim(),
          optionValues: parseOptions(optionValues[variant.id] ?? ""),
          gtin: setOptionalText(variant.gtin ?? ""),
          mpn: setOptionalText(variant.mpn ?? ""),
        })),
      });
      onSave(parsed);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "El producto no es válido.");
    }
  };

  const goToStep = (step: EditorStep) => {
    setActiveStep(step);
    stepRefs.current[step]?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <dialog
      ref={dialogRef}
      className="product-dialog"
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        requestClose();
      }}
    >
      <div className="product-dialog__header">
        <div>
          <span>{mode === "create" ? "Nuevo producto" : "Editar producto"}</span>
          <h2 id={titleId}>{draft.title || "Producto sin nombre"}</h2>
        </div>
        <IconButton icon={X} label="Cerrar editor" onClick={requestClose} />
      </div>

      <div className="product-dialog__body">
        {error ? <InlineError>{error}</InlineError> : null}

        <nav className="product-editor-steps" aria-label="Pasos del producto">
          <span className="product-editor-steps__label">Edición guiada</span>
          <ol>
            {editorSteps.map((step, index) => (
              <li key={step.id}>
                <button
                  ref={(element) => {
                    stepButtons.current[index] = element;
                  }}
                  type="button"
                  className={activeStep === step.id ? "is-active" : undefined}
                  aria-current={activeStep === step.id ? "step" : undefined}
                  onClick={() => goToStep(step.id)}
                  onKeyDown={(event) => {
                    const target = stepTarget(index, event.key);
                    if (target === undefined) return;
                    const nextStep = editorSteps[target];
                    if (nextStep === undefined) return;
                    event.preventDefault();
                    goToStep(nextStep.id);
                    stepButtons.current[target]?.focus();
                  }}
                >
                  <span aria-hidden>{index + 1}</span>
                  {step.label}
                </button>
              </li>
            ))}
          </ol>
        </nav>

        <fieldset
          className="editor-group"
          id={`${stepIdPrefix}-details`}
          ref={(element) => {
            stepRefs.current.details = element;
          }}
        >
          <legend>Información comercial</legend>
          <div className="form-grid">
            <Field label="Título" {...(errors.title ? { error: errors.title } : {})}>
              <input
                maxLength={120}
                value={draft.title}
                onChange={(event) => {
                  const title = event.target.value;
                  setDraft((current) => {
                    const next = { ...current, title };
                    if (!slugTouched) {
                      next.slug = slugify(title) as Product["slug"];
                    }
                    return next;
                  });
                }}
              />
            </Field>
            <Field label="Slug" {...slugFieldFeedback(errors)}>
              <input
                value={draft.slug}
                onChange={(event) => {
                  setSlugTouched(true);
                  setDraft((current) => ({
                    ...current,
                    slug: event.target.value as Product["slug"],
                  }));
                }}
              />
            </Field>
            <Field label="Marca">
              <input
                value={draft.brand}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, brand: event.target.value }))
                }
              />
            </Field>
            <Field label="Estado">
              <select
                value={draft.status}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    status: event.target.value as Product["status"],
                  }))
                }
              >
                <option value="active">Activo</option>
                <option value="hidden">Oculto</option>
                <option value="archived">Archivado</option>
              </select>
            </Field>
            <Field label="Descripción" className="field--wide">
              <textarea
                rows={4}
                value={draft.description}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, description: event.target.value }))
                }
              />
            </Field>
            <Field label="Tags" hint="Separados por comas." className="field--wide">
              <input value={tags} onChange={(event) => setTags(event.target.value)} />
            </Field>
          </div>
        </fieldset>

        <fieldset
          className="editor-group"
          id={`${stepIdPrefix}-media`}
          ref={(element) => {
            stepRefs.current.media = element;
          }}
        >
          <legend>Imágenes del producto</legend>
          {assets.length === 0 ? (
            <p className="editor-empty-hint">
              Todavía no hay recursos cargados. Podés agregarlos desde Recursos o importar una
              carpeta.
            </p>
          ) : (
            <div className="product-asset-picker">
              {assets.map((asset) => (
                <label className="product-asset-option" key={asset.id}>
                  <input
                    type="checkbox"
                    checked={draft.imageIds.includes(asset.id)}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        imageIds: event.target.checked
                          ? [...current.imageIds, asset.id]
                          : current.imageIds.filter((id) => id !== asset.id),
                      }))
                    }
                  />
                  <img src={asset.source} alt="" width={asset.width} height={asset.height} />
                  <span>
                    <strong>{asset.name}</strong>
                    <small title={asset.alt || asset.name}>
                      {asset.alt || "Sin texto alternativo"}
                    </small>
                  </span>
                </label>
              ))}
            </div>
          )}
        </fieldset>

        <fieldset
          className="editor-group"
          id={`${stepIdPrefix}-organization`}
          ref={(element) => {
            stepRefs.current.organization = element;
          }}
        >
          <legend>Organización</legend>
          <div className="assignment-grid">
            <div>
              <strong>Categorías</strong>
              {orderedCategories(categories).map((category) => (
                <label className="check-field" key={category.id}>
                  <input
                    type="checkbox"
                    checked={draft.categoryIds.includes(category.id)}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        categoryIds: event.target.checked
                          ? [...current.categoryIds, category.id]
                          : current.categoryIds.filter((id) => id !== category.id),
                      }))
                    }
                  />
                  {category.parentId ? `↳ ${category.title}` : category.title}
                </label>
              ))}
            </div>
            <div>
              <strong>Colecciones</strong>
              {collections.map((collection) => (
                <label className="check-field" key={collection.id}>
                  <input
                    type="checkbox"
                    checked={draft.collectionIds.includes(collection.id)}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        collectionIds: event.target.checked
                          ? [...current.collectionIds, collection.id]
                          : current.collectionIds.filter((id) => id !== collection.id),
                      }))
                    }
                  />
                  {collection.title}
                </label>
              ))}
            </div>
          </div>
        </fieldset>

        <fieldset
          className="editor-group"
          id={`${stepIdPrefix}-variants`}
          ref={(element) => {
            stepRefs.current.variants = element;
          }}
        >
          <legend>Variantes</legend>
          <section className="product-mini-preview" data-testid="ui-product-mini-preview">
            <span className="product-mini-preview__label">Vista previa del producto</span>
            <div className="product-mini-preview__card">
              {firstImage ? (
                <img
                  src={firstImage.source}
                  alt=""
                  width={firstImage.width}
                  height={firstImage.height}
                />
              ) : (
                <span className="product-mini-preview__placeholder" aria-hidden>
                  Sin imagen
                </span>
              )}
              <div className="product-mini-preview__info">
                <strong title={draft.title.trim() || "Producto sin nombre"}>
                  {draft.title.trim() || "Producto sin nombre"}
                </strong>
                <span>Desde {formatCents(minimumPrice)}</span>
                <span
                  className={`product-mini-preview__status product-mini-preview__status--${draft.status}`}
                >
                  {STATUS_LABELS[draft.status]}
                </span>
              </div>
            </div>
          </section>
          <div className="variant-list">
            {draft.variants.map((variant, index) => {
              const variantError = errors.variantErrors[index] ?? {
                title: undefined,
                price: undefined,
                options: undefined,
              };
              return (
                <article className="variant-editor" key={variant.id}>
                  <header>
                    <strong>Variante {index + 1}</strong>
                    <div className="variant-editor__actions">
                      <IconButton
                        icon={ArrowUp}
                        label={`Subir ${variant.title}`}
                        disabled={index === 0}
                        onClick={() => moveVariant(variant.id, -1)}
                      />
                      <IconButton
                        icon={ArrowDown}
                        label={`Bajar ${variant.title}`}
                        disabled={index === draft.variants.length - 1}
                        onClick={() => moveVariant(variant.id, 1)}
                      />
                      <IconButton
                        icon={Copy}
                        label={`Duplicar ${variant.title}`}
                        onClick={() => addVariant(variant)}
                      />
                      <IconButton
                        icon={Trash}
                        label={`Eliminar ${variant.title}`}
                        disabled={draft.variants.length === 1}
                        onClick={() => {
                          setDraft((current) => ({
                            ...current,
                            variants: current.variants.filter(
                              (candidate) => candidate.id !== variant.id,
                            ),
                          }));
                          setOptionValues((current) => {
                            const next = { ...current };
                            delete next[variant.id];
                            return next;
                          });
                        }}
                      />
                    </div>
                  </header>
                  <div className="form-grid">
                    <Field
                      label="Nombre"
                      {...(variantError.title ? { error: variantError.title } : {})}
                    >
                      <input
                        value={variant.title}
                        onChange={(event) =>
                          updateVariant(variant.id, (current) => ({
                            ...current,
                            title: event.target.value,
                          }))
                        }
                      />
                    </Field>
                    <Field label="SKU">
                      <input
                        value={variant.sku}
                        onChange={(event) =>
                          updateVariant(variant.id, (current) => ({
                            ...current,
                            sku: event.target.value,
                          }))
                        }
                      />
                    </Field>
                    <Field
                      label="Opciones"
                      {...(variantError.options
                        ? { error: variantError.options }
                        : { hint: "Ejemplo: Color=Azul, Talle=M" })}
                    >
                      <input
                        value={optionValues[variant.id] ?? ""}
                        onChange={(event) =>
                          setOptionValues((current) => ({
                            ...current,
                            [variant.id]: event.target.value,
                          }))
                        }
                      />
                    </Field>
                    <Field
                      label="Precio en centavos"
                      {...(variantError.price ? { error: variantError.price } : {})}
                    >
                      <input
                        type="number"
                        min={0}
                        step={1}
                        value={variant.price}
                        onChange={(event) =>
                          updateVariant(variant.id, (current) => ({
                            ...current,
                            price:
                              event.target.value === ""
                                ? current.price
                                : (Number(event.target.value) as Variant["price"]),
                          }))
                        }
                      />
                    </Field>
                    <Field label="Precio anterior en centavos">
                      <input
                        type="number"
                        min={0}
                        step={1}
                        value={variant.compareAtPrice ?? ""}
                        onChange={(event) =>
                          updateVariant(variant.id, (current) => ({
                            ...current,
                            compareAtPrice:
                              event.target.value === ""
                                ? undefined
                                : (Number(event.target.value) as Variant["price"]),
                          }))
                        }
                      />
                    </Field>
                    <Field label="Stock">
                      <select
                        value={variant.stockStatus}
                        onChange={(event) =>
                          updateVariant(variant.id, (current) => ({
                            ...current,
                            stockStatus: event.target.value as Variant["stockStatus"],
                          }))
                        }
                      >
                        <option value="in_stock">Disponible</option>
                        <option value="out_of_stock">Agotado</option>
                        <option value="preorder">Preventa</option>
                      </select>
                    </Field>
                    <Field label="GTIN">
                      <input
                        value={variant.gtin ?? ""}
                        onChange={(event) =>
                          updateVariant(variant.id, (current) => ({
                            ...current,
                            gtin: event.target.value,
                          }))
                        }
                      />
                    </Field>
                    <Field label="MPN">
                      <input
                        value={variant.mpn ?? ""}
                        onChange={(event) =>
                          updateVariant(variant.id, (current) => ({
                            ...current,
                            mpn: event.target.value,
                          }))
                        }
                      />
                    </Field>
                    <Field label="Imagen de variante">
                      <select
                        value={variant.imageId ?? ""}
                        onChange={(event) =>
                          updateVariant(variant.id, (current) => ({
                            ...current,
                            imageId: event.target.value
                              ? (event.target.value as ImageAsset["id"])
                              : undefined,
                          }))
                        }
                      >
                        <option value="">Usar imagen principal</option>
                        {assets
                          .filter((asset) => draft.imageIds.includes(asset.id))
                          .map((asset) => (
                            <option value={asset.id} key={asset.id}>
                              {asset.name}
                            </option>
                          ))}
                      </select>
                    </Field>
                    <label className="check-field">
                      <input
                        type="checkbox"
                        checked={variant.available}
                        onChange={(event) =>
                          updateVariant(variant.id, (current) => ({
                            ...current,
                            available: event.target.checked,
                          }))
                        }
                      />
                      Disponible para vender
                    </label>
                  </div>
                </article>
              );
            })}
          </div>
          <Button icon={Plus} onClick={() => addVariant()}>
            Agregar variante
          </Button>
        </fieldset>
      </div>

      <div className="product-dialog__footer">
        <Button variant="quiet" onClick={requestClose}>
          Cancelar
        </Button>
        <Button variant="primary" onClick={save}>
          {mode === "create" ? "Crear producto" : "Guardar producto"}
        </Button>
      </div>

      {confirmClose ? (
        <ConfirmDialog
          title="Salir sin guardar"
          body="Hay cambios sin guardar en el producto. ¿Querés salir sin guardar?"
          confirmLabel="Salir sin guardar"
          cancelLabel="Seguir editando"
          danger
          onConfirm={() => {
            setConfirmClose(false);
            onCancel();
          }}
          onCancel={() => setConfirmClose(false)}
        />
      ) : null}
    </dialog>
  );
}
