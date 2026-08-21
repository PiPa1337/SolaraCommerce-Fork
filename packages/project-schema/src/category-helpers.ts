/**
 * Helpers puros de jerarquía de categorías. Sin dependencias de Zod:
 * usados por el superRefine del schema y por los helpers públicos exportados.
 */
interface CategoryRelation {
  id: string;
  parentId?: string | undefined;
}

function categoryRelationsById(
  categories: readonly CategoryRelation[],
): Map<string, CategoryRelation> {
  return new Map(categories.map((category) => [category.id, category]));
}

export function categoryDescendantIds(
  categories: readonly CategoryRelation[],
  categoryId: string,
): string[] {
  const childrenByParent = new Map<string, string[]>();
  for (const category of categories) {
    if (!category.parentId) continue;
    const children = childrenByParent.get(category.parentId) ?? [];
    children.push(category.id);
    childrenByParent.set(category.parentId, children);
  }

  const descendants: string[] = [];
  const visited = new Set<string>([categoryId]);
  const visit = (parentId: string): void => {
    for (const childId of childrenByParent.get(parentId) ?? []) {
      if (visited.has(childId)) continue;
      visited.add(childId);
      descendants.push(childId);
      visit(childId);
    }
  };
  visit(categoryId);
  return descendants;
}

export function categoryAncestorIds(
  categories: readonly CategoryRelation[],
  categoryId: string,
): string[] {
  const byId = categoryRelationsById(categories);
  const ancestors: string[] = [];
  const seen = new Set<string>();
  let current = byId.get(categoryId)?.parentId;
  while (current) {
    if (seen.has(current)) break;
    seen.add(current);
    ancestors.unshift(current);
    current = byId.get(current)?.parentId;
  }
  return ancestors;
}

function categoryScopeIds(
  categories: readonly CategoryRelation[],
  categoryId: string,
): Set<string> {
  return new Set([categoryId, ...categoryDescendantIds(categories, categoryId)]);
}

export function categoryProductIds(
  categories: readonly CategoryRelation[],
  products: readonly { id: string; categoryIds: readonly string[] }[],
  categoryId: string,
): string[] {
  const scope = categoryScopeIds(categories, categoryId);
  return products
    .filter((product) => product.categoryIds.some((id) => scope.has(id)))
    .map((product) => product.id);
}
