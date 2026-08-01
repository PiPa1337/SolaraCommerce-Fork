import { Copy, Plus, Trash, X } from "@phosphor-icons/react";
import {
  type Category,
  type Collection,
  type Product,
  ProductSchema,
  type Variant,
} from "@solara/project-schema";
import { useEffect, useId, useRef, useState } from "react";
import { Button, Field, IconButton, InlineError } from "../../components/Ui";

interface ProductEditorProps {
  product: Product;
  categories: Category[];
  collections: Collection[];
  existingSlugs: string[];
  mode: "create" | "edit";
  onCancel(): void;
  onSave(product: Product): void;
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
  const titleId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    dialog.showModal();
    return () => dialog.close();
  }, []);

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

  const save = () => {
    setError("");
    try {
      const normalizedSlug = draft.slug.trim();
      if (existingSlugs.includes(normalizedSlug)) {
        throw new Error(`Ya existe otro producto con el slug "${normalizedSlug}".`);
      }
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

  return (
    <dialog
      ref={dialogRef}
      className="product-dialog"
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        onCancel();
      }}
    >
      <div className="product-dialog__header">
        <div>
          <span>{mode === "create" ? "Nuevo producto" : "Editar producto"}</span>
          <h2 id={titleId}>{draft.title || "Producto sin nombre"}</h2>
        </div>
        <IconButton icon={X} label="Cerrar editor" onClick={onCancel} />
      </div>

      <div className="product-dialog__body">
        {error ? <InlineError>{error}</InlineError> : null}

        <fieldset className="editor-group">
          <legend>Información comercial</legend>
          <div className="form-grid">
            <Field label="Título">
              <input
                value={draft.title}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, title: event.target.value }))
                }
              />
            </Field>
            <Field label="Slug" hint="Minúsculas, números y guiones.">
              <input
                value={draft.slug}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    slug: event.target.value as Product["slug"],
                  }))
                }
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

        <fieldset className="editor-group">
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

        <fieldset className="editor-group">
          <legend>Variantes</legend>
          <div className="variant-list">
            {draft.variants.map((variant, index) => (
              <article className="variant-editor" key={variant.id}>
                <header>
                  <strong>Variante {index + 1}</strong>
                  <div>
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
                  <Field label="Nombre">
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
                  <Field label="Opciones" hint="Ejemplo: Color=Azul, Talle=M">
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
                  <Field label="Precio en centavos">
                    <input
                      type="number"
                      min={0}
                      step={1}
                      value={variant.price}
                      onChange={(event) =>
                        updateVariant(variant.id, (current) => ({
                          ...current,
                          price: Number(event.target.value) as Variant["price"],
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
            ))}
          </div>
          <Button icon={Plus} onClick={() => addVariant()}>
            Agregar variante
          </Button>
        </fieldset>
      </div>

      <div className="product-dialog__footer">
        <Button variant="quiet" onClick={onCancel}>
          Cancelar
        </Button>
        <Button variant="primary" onClick={save}>
          {mode === "create" ? "Crear producto" : "Guardar producto"}
        </Button>
      </div>
    </dialog>
  );
}
