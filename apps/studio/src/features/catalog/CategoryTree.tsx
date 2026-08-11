/** Árbol de categorías colapsable con cantidades directas/heredadas y reubicación segura. */
import { CaretRight, TreeStructure } from "@phosphor-icons/react";
import type { DomainCommand } from "@solara/core";
import {
  type Category,
  getCategoryDescendants,
  getCategoryProductIds,
  type StoreProjectV1,
} from "@solara/project-schema";
import type { Dispatch, SetStateAction } from "react";
import { useMemo, useState } from "react";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { Button, EmptyState, Field } from "../../components/Ui";

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

  return (
    <section className="category-tree-panel" aria-label="Árbol de categorías">
      <header>
        <div>
          <span className="eyebrow">Organización</span>
          <h2>Categorías</h2>
          <p>Las categorías padre agregan automáticamente los productos de sus hijas.</p>
        </div>
      </header>
      {orderedCategories.length === 0 ? (
        <EmptyState
          icon={TreeStructure}
          title="No hay categorías"
          body="Las categorías llegan con la plantilla de la tienda o se importan con el CSV del catálogo; después podés reubicarlas aquí."
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
                </div>
                <span>
                  {directCount} directos · {totalCount} totales
                </span>
              </li>
            );
          })}
        </ul>
      )}
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
