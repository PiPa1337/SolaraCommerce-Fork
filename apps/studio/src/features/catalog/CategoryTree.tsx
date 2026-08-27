/** Árbol de categorías colapsable con cantidades directas/heredadas y reubicación segura. */
import { CaretRight, PencilSimple, Plus, TreeStructure } from "@phosphor-icons/react";
import type { DomainCommand } from "@solara/core";
import {
  type Category,
  type Collection,
  getCategoryDescendants,
  getCategoryProductIds,
  type StoreProjectV1,
} from "@solara/project-schema";
import type { Dispatch, SetStateAction } from "react";
import { useMemo, useState } from "react";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { Button, EmptyState, Field, InlineError } from "../../components/Ui";
import { slugify } from "../../lib/slugify";

export function categoryTree(project: StoreProjectV1): Category[] {
  const roots = project.categories.filter((category) => category.parentId === undefined);
  const childrenByParent = new Map<string, Category[]>();
  project.categories.forEach((category) => {
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
  roots.forEach(visit);
  return ordered;
}

export function categoryLabel(category: Category): string {
  return category.parentId ? `  ${category.title}` : category.title;
}

const now = () => new Date().toISOString();

type TaxonomyKind = "category" | "collection";

type TaxonomyDraft = {
  kind: TaxonomyKind;
  id?: string;
  title: string;
  slug: string;
  description: string;
  parentId: string;
};

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function emptyTaxonomyDraft(kind: TaxonomyKind): TaxonomyDraft {
  return { kind, title: "", slug: "", description: "", parentId: "" };
}

interface CategoryTreeProps {
  project: StoreProjectV1;
  collapsedCategoryIds: Set<string>;
  setCollapsedCategoryIds: Dispatch<SetStateAction<Set<string>>>;
  reparentCategoryId: string;
  setReparentCategoryId: Dispatch<SetStateAction<string>>;
  reparentParentId: string;
  setReparentParentId: Dispatch<SetStateAction<string>>;
  onCommand(command: DomainCommand): void;
}

export function CategoryTree({
  project,
  collapsedCategoryIds,
  setCollapsedCategoryIds,
  reparentCategoryId,
  setReparentCategoryId,
  reparentParentId,
  setReparentParentId,
  onCommand,
}: CategoryTreeProps) {
  const orderedCategories = categoryTree(project);
  const categoryChildren = useMemo(() => {
    const children = new Map<string, Category[]>();
    project.categories.forEach((category) => {
      if (!category.parentId) return;
      children.set(category.parentId, [...(children.get(category.parentId) ?? []), category]);
    });
    return children;
  }, [project.categories]);
  const categoryDepths = useMemo(() => {
    const depths = new Map<string, number>();
    const visit = (category: Category, depth: number) => {
      depths.set(category.id, depth);
      for (const child of categoryChildren.get(category.id) ?? []) visit(child, depth + 1);
    };
    for (const category of project.categories) {
      if (category.parentId === undefined) visit(category, 0);
    }
    return depths;
  }, [categoryChildren, project.categories]);
  const visibleCategories = useMemo(
    () =>
      orderedCategories.filter((category) => {
        let parentId = category.parentId;
        while (parentId) {
          if (collapsedCategoryIds.has(parentId)) return false;
          parentId = project.categories.find((item) => item.id === parentId)?.parentId;
        }
        return true;
      }),
    [collapsedCategoryIds, orderedCategories, project.categories],
  );
  const selectedReparentCategory = project.categories.find(
    (category) => category.id === reparentCategoryId,
  );
  const selectedReparentHasChildren = selectedReparentCategory
    ? (categoryChildren.get(selectedReparentCategory.id)?.length ?? 0) > 0
    : false;
  const blockedParentIds = new Set(
    selectedReparentCategory
      ? [
          selectedReparentCategory.id,
          ...getCategoryDescendants(project, selectedReparentCategory.id).map(
            (category) => category.id,
          ),
        ]
      : [],
  );
  const reparentParents = project.categories.filter(
    (category) => !blockedParentIds.has(category.id),
  );
  const [pendingReparent, setPendingReparent] = useState<{
    category: Category;
    parentId: string;
  } | null>(null);
  const [taxonomyDraft, setTaxonomyDraft] = useState<TaxonomyDraft | null>(null);
  const [taxonomyError, setTaxonomyError] = useState("");

  const editCategory = (category: Category) => {
    setTaxonomyError("");
    setTaxonomyDraft({
      kind: "category",
      id: category.id,
      title: category.title,
      slug: category.slug,
      description: category.description,
      parentId: category.parentId ?? "",
    });
  };

  const editCollection = (collection: Collection) => {
    setTaxonomyError("");
    setTaxonomyDraft({
      kind: "collection",
      id: collection.id,
      title: collection.title,
      slug: collection.slug,
      description: collection.description,
      parentId: "",
    });
  };

  const submitTaxonomy = () => {
    if (!taxonomyDraft) return;
    setTaxonomyError("");
    const title = taxonomyDraft.title.trim();
    const slug = (taxonomyDraft.slug.trim() || slugify(title)).toLowerCase();
    if (!title) {
      setTaxonomyError("Escribí un nombre para continuar.");
      return;
    }
    if (!SLUG_PATTERN.test(slug)) {
      setTaxonomyError("El slug solo admite minúsculas, números y guiones.");
      return;
    }
    const siblings = taxonomyDraft.kind === "category" ? project.categories : project.collections;
    if (siblings.some((item) => item.slug === slug && item.id !== taxonomyDraft.id)) {
      setTaxonomyError("Ya existe otra categoría o colección con ese slug.");
      return;
    }

    try {
      if (taxonomyDraft.kind === "category") {
        if (taxonomyDraft.id) {
          onCommand({
            type: "category.update",
            categoryId: taxonomyDraft.id as Category["id"],
            changes: {
              slug: slug as Category["slug"],
              title,
              description: taxonomyDraft.description.trim(),
            },
            at: now(),
          });
        } else {
          onCommand({
            type: "category.create",
            category: {
              id: `category-${crypto.randomUUID()}` as Category["id"],
              slug: slug as Category["slug"],
              title,
              description: taxonomyDraft.description.trim(),
              status: "active",
              ...(taxonomyDraft.parentId
                ? { parentId: taxonomyDraft.parentId as Category["id"] }
                : {}),
              productIds: [],
            },
            at: now(),
          });
        }
      } else if (taxonomyDraft.id) {
        onCommand({
          type: "collection.update",
          collectionId: taxonomyDraft.id as Collection["id"],
          changes: {
            slug: slug as Collection["slug"],
            title,
            description: taxonomyDraft.description.trim(),
          },
          at: now(),
        });
      } else {
        onCommand({
          type: "collection.create",
          collection: {
            id: `collection-${crypto.randomUUID()}` as Collection["id"],
            slug: slug as Collection["slug"],
            title,
            description: taxonomyDraft.description.trim(),
            status: "active",
            productIds: [],
          },
          at: now(),
        });
      }
      setTaxonomyDraft(null);
    } catch (reason) {
      setTaxonomyError(reason instanceof Error ? reason.message : "No se pudo guardar.");
    }
  };

  return (
    <section className="category-tree-panel" aria-label="Árbol de categorías">
      <header>
        <div>
          <span className="eyebrow">Organización</span>
          <h2>Categorías</h2>
          <p>Las categorías padre agregan automáticamente los productos de sus hijas.</p>
        </div>
        <div className="category-tree-actions">
          <Button
            size="sm"
            icon={Plus}
            onClick={() => {
              setTaxonomyError("");
              setTaxonomyDraft(emptyTaxonomyDraft("category"));
            }}
          >
            Categoría
          </Button>
          <Button
            size="sm"
            icon={Plus}
            onClick={() => {
              setTaxonomyError("");
              setTaxonomyDraft(emptyTaxonomyDraft("collection"));
            }}
          >
            Colección
          </Button>
        </div>
      </header>
      {orderedCategories.length === 0 ? (
        <EmptyState
          icon={TreeStructure}
          title="No hay categorías"
          body="Creá una categoría desde acá o importá el catálogo; después podés reubicarla y asignarle productos."
        />
      ) : (
        <ul className="category-tree" aria-label="Categorías ordenadas">
          {visibleCategories.map((category) => {
            const directCount = project.products.filter((product) =>
              product.categoryIds.includes(category.id),
            ).length;
            const totalCount = getCategoryProductIds(project, category.id).length;
            const hasChildren = (categoryChildren.get(category.id)?.length ?? 0) > 0;
            const expanded = !collapsedCategoryIds.has(category.id);
            return (
              <li key={category.id} data-depth={categoryDepths.get(category.id) ?? 0}>
                <div className="category-tree-name">
                  {hasChildren ? (
                    <button
                      className="category-tree-toggle"
                      type="button"
                      aria-label={`${expanded ? "Contraer" : "Expandir"} ${category.title}`}
                      aria-expanded={expanded}
                      onClick={() =>
                        setCollapsedCategoryIds((current) => {
                          const next = new Set(current);
                          if (next.has(category.id)) next.delete(category.id);
                          else next.add(category.id);
                          return next;
                        })
                      }
                    >
                      <CaretRight
                        aria-hidden
                        size={14}
                        style={{ transform: expanded ? "rotate(90deg)" : undefined }}
                      />
                    </button>
                  ) : (
                    <span className="category-tree-spacer" aria-hidden />
                  )}
                  <strong>{category.title}</strong>
                  <button
                    className="category-tree-edit"
                    type="button"
                    aria-label={`Editar ${category.title}`}
                    onClick={() => editCategory(category)}
                  >
                    <PencilSimple aria-hidden size={14} />
                  </button>
                </div>
                <span>
                  {directCount} directos · {totalCount} totales
                </span>
              </li>
            );
          })}
        </ul>
      )}

      <section className="taxonomy-collections" aria-label="Colecciones">
        <div className="taxonomy-collections__header">
          <div>
            <span className="eyebrow">Agrupaciones</span>
            <h3>Colecciones</h3>
          </div>
          <span>{project.collections.length} configuradas</span>
        </div>
        {project.collections.length > 0 ? (
          <ul className="taxonomy-collections__list">
            {project.collections.map((collection) => (
              <li key={collection.id}>
                <div>
                  <strong>{collection.title}</strong>
                  <small>{collection.productIds.length} productos directos</small>
                </div>
                <Button size="sm" variant="quiet" onClick={() => editCollection(collection)}>
                  Editar
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="taxonomy-collections__empty">
            Creá una colección para agrupar productos sin duplicar categorías.
          </p>
        )}
      </section>

      {taxonomyDraft ? (
        <section className="taxonomy-editor" aria-label="Editar organización">
          <div className="taxonomy-editor__header">
            <div>
              <span className="eyebrow">Editor nativo</span>
              <h3>
                {taxonomyDraft.id ? "Editar" : "Nueva"}{" "}
                {taxonomyDraft.kind === "category" ? "categoría" : "colección"}
              </h3>
            </div>
            <Button variant="quiet" size="sm" onClick={() => setTaxonomyDraft(null)}>
              Cancelar
            </Button>
          </div>
          {taxonomyError ? <InlineError>{taxonomyError}</InlineError> : null}
          <div className="form-grid">
            <Field label="Nombre">
              <input
                value={taxonomyDraft.title}
                onChange={(event) =>
                  setTaxonomyDraft((current) =>
                    current ? { ...current, title: event.target.value } : current,
                  )
                }
              />
            </Field>
            <Field label="Slug" hint="Minúsculas, números y guiones.">
              <input
                value={taxonomyDraft.slug}
                onChange={(event) =>
                  setTaxonomyDraft((current) =>
                    current ? { ...current, slug: event.target.value } : current,
                  )
                }
              />
            </Field>
          </div>
          <Field label="Descripción">
            <textarea
              rows={2}
              value={taxonomyDraft.description}
              onChange={(event) =>
                setTaxonomyDraft((current) =>
                  current ? { ...current, description: event.target.value } : current,
                )
              }
            />
          </Field>
          {taxonomyDraft.kind === "category" && !taxonomyDraft.id ? (
            <Field label="Categoría padre" hint="Solo se permiten dos niveles de profundidad.">
              <select
                value={taxonomyDraft.parentId}
                onChange={(event) =>
                  setTaxonomyDraft((current) =>
                    current ? { ...current, parentId: event.target.value } : current,
                  )
                }
              >
                <option value="">Sin padre (raíz)</option>
                {project.categories
                  .filter((category) => category.parentId === undefined)
                  .map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.title}
                    </option>
                  ))}
              </select>
            </Field>
          ) : null}
          <div className="taxonomy-editor__actions">
            <Button variant="primary" onClick={submitTaxonomy}>
              {taxonomyDraft.id ? "Guardar cambios" : "Crear"}
            </Button>
          </div>
        </section>
      ) : null}
      <div className="category-reparent">
        <Field label="Categoría a reubicar">
          <select
            value={reparentCategoryId}
            onChange={(event) => {
              setReparentCategoryId(event.target.value);
              setReparentParentId("");
            }}
          >
            <option value="">Seleccionar categoría</option>
            {orderedCategories.map((category) => (
              <option key={category.id} value={category.id}>
                {categoryLabel(category)}
              </option>
            ))}
          </select>
        </Field>
        <Field
          label="Nuevo padre"
          {...(selectedReparentHasChildren
            ? { hint: "Esta categoría tiene subcategorías y debe permanecer como raíz." }
            : {})}
        >
          <select
            value={reparentParentId}
            onChange={(event) => setReparentParentId(event.target.value)}
            disabled={!selectedReparentCategory}
          >
            <option value="">Sin padre (raíz)</option>
            {reparentParents
              .filter(
                (category) =>
                  category.parentId === undefined &&
                  category.id !== selectedReparentCategory?.parentId,
              )
              .map((category) => (
                <option
                  key={category.id}
                  value={category.id}
                  disabled={selectedReparentHasChildren}
                >
                  {categoryLabel(category)}
                </option>
              ))}
          </select>
        </Field>
        <Button
          disabled={!selectedReparentCategory || selectedReparentHasChildren}
          onClick={() => {
            if (!selectedReparentCategory) return;
            setPendingReparent({
              category: selectedReparentCategory,
              parentId: reparentParentId,
            });
          }}
        >
          Reubicar categoría
        </Button>
      </div>

      {pendingReparent ? (
        <ConfirmDialog
          title="Reubicar categoría"
          body={`¿Reubicar ${pendingReparent.category.title} bajo ${
            pendingReparent.parentId
              ? (project.categories.find((category) => category.id === pendingReparent.parentId)
                  ?.title ?? "raíz")
              : "raíz"
          }?`}
          confirmLabel="Reubicar"
          cancelLabel="Cancelar"
          onConfirm={() => {
            const target = pendingReparent;
            setPendingReparent(null);
            const targetHasChildren = (categoryChildren.get(target.category.id)?.length ?? 0) > 0;
            if (targetHasChildren && target.parentId) return;
            onCommand({
              type: "category.reparent",
              categoryId: target.category.id,
              ...(target.parentId ? { parentId: target.parentId as Category["id"] } : {}),
              at: now(),
            });
          }}
          onCancel={() => setPendingReparent(null)}
        />
      ) : null}
    </section>
  );
}
