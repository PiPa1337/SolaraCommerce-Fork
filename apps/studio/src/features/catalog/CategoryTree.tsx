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
import { useMemo } from "react";
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
              <li key={category.id} data-depth={category.parentId ? "1" : "0"}>
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
        <Field label="Nuevo padre">
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
                <option key={category.id} value={category.id}>
                  {categoryLabel(category)}
                </option>
              ))}
          </select>
        </Field>
        <Button
          disabled={!selectedReparentCategory}
          onClick={() => {
            if (!selectedReparentCategory) return;
            const nextLabel = reparentParentId
              ? project.categories.find((category) => category.id === reparentParentId)?.title
              : "raíz";
            if (
              !window.confirm(
                `Reubicar ${selectedReparentCategory.title} bajo ${nextLabel ?? "raíz"}?`,
              )
            )
              return;
            onCommand({
              type: "category.reparent",
              categoryId: selectedReparentCategory.id,
              ...(reparentParentId ? { parentId: reparentParentId as Category["id"] } : {}),
              at: now(),
            });
          }}
        >
          Reubicar categoría
        </Button>
      </div>
    </section>
  );
}
