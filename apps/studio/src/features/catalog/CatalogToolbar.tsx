/** Toolbar del catálogo: búsqueda, filtro, acciones masivas y paginación. */
import { CaretLeft, CaretRight, CheckSquare, MagnifyingGlass } from "@phosphor-icons/react";
import type { DomainCommand } from "@solara/core";
import type { Product, StoreProjectV1 } from "@solara/project-schema";
import type { PaginationState, Row, RowSelectionState, Table } from "@tanstack/react-table";
import type { Dispatch, SetStateAction } from "react";
import { Button, Field } from "../../components/Ui";
import { categoryLabel, categoryTree } from "./CategoryTree";

const now = () => new Date().toISOString();

interface CatalogToolbarProps {
  project: StoreProjectV1;
  table: Table<Product>;
  filteredRows: Row<Product>[];
  hasProducts: boolean;
  selectedIds: Product["id"][];
  filter: string;
  setFilter: Dispatch<SetStateAction<string>>;
  categoryFilterId: string;
  setCategoryFilterId: Dispatch<SetStateAction<string>>;
  setPagination: Dispatch<SetStateAction<PaginationState>>;
  setSelection: Dispatch<SetStateAction<RowSelectionState>>;
  status: Product["status"];
  setStatus: Dispatch<SetStateAction<Product["status"]>>;
  priceKind: "percentage" | "amount";
  setPriceKind: Dispatch<SetStateAction<"percentage" | "amount">>;
  priceAdjustment: string;
  setPriceAdjustment: Dispatch<SetStateAction<string>>;
  categoryIds: string[];
  setCategoryIds: Dispatch<SetStateAction<string[]>>;
  collectionIds: string[];
  setCollectionIds: Dispatch<SetStateAction<string[]>>;
  tags: string;
  setTags: Dispatch<SetStateAction<string>>;
  onCommand(command: DomainCommand): void;
  applyPriceAdjustment(): void;
  applyTags(type: "products.addTags" | "products.removeTags"): void;
}

export function CatalogToolbar({
  project,
  table,
  filteredRows,
  hasProducts,
  selectedIds,
  filter,
  setFilter,
  categoryFilterId,
  setCategoryFilterId,
  setPagination,
  setSelection,
  status,
  setStatus,
  priceKind,
  setPriceKind,
  priceAdjustment,
  setPriceAdjustment,
  categoryIds,
  setCategoryIds,
  collectionIds,
  setCollectionIds,
  tags,
  setTags,
  onCommand,
  applyPriceAdjustment,
  applyTags,
}: CatalogToolbarProps) {
  const orderedCategories = categoryTree(project);
  return (
    <>
      <div className="catalog-toolbar">
        <label className="search-box">
          <MagnifyingGlass aria-hidden size={18} />
          <span className="visually-hidden">Buscar productos</span>
          <input
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            placeholder="Buscar por producto, marca o estado"
          />
        </label>
        <label className="catalog-category-filter">
          <span>Filtrar categoría</span>
          <select
            value={categoryFilterId}
            onChange={(event) => {
              setCategoryFilterId(event.target.value);
              setPagination((current) => ({ ...current, pageIndex: 0 }));
            }}
          >
            <option value="">Todas las categorías</option>
            {orderedCategories.map((category) => (
              <option value={category.id} key={category.id}>
                {categoryLabel(category)}
              </option>
            ))}
          </select>
        </label>
        <div className="selection-summary">
          <span>{selectedIds.length} seleccionados</span>
          {filteredRows.length > 0 ? (
            <Button
              data-testid="select-filtered-products"
              variant="quiet"
              onClick={() =>
                setSelection((current) => ({
                  ...current,
                  ...Object.fromEntries(filteredRows.map((row) => [row.id, true])),
                }))
              }
            >
              Seleccionar {filteredRows.length} filtrados
            </Button>
          ) : null}
          {selectedIds.length > 0 ? (
            <Button variant="quiet" onClick={() => setSelection({})}>
              Limpiar
            </Button>
          ) : null}
        </div>
      </div>

      {selectedIds.length > 0 ? (
        <section className="bulk-panel" aria-label="Acciones masivas">
          <header>
            <CheckSquare aria-hidden size={20} />
            <strong>{selectedIds.length} productos seleccionados</strong>
          </header>
          <div className="bulk-grid">
            <div className="bulk-action">
              <Field label="Estado">
                <select
                  value={status}
                  onChange={(event) => setStatus(event.target.value as Product["status"])}
                >
                  <option value="active">Activo</option>
                  <option value="hidden">Oculto</option>
                  <option value="archived">Archivado</option>
                </select>
              </Field>
              <Button
                data-testid="apply-bulk-status"
                onClick={() =>
                  onCommand({
                    type: "products.setStatus",
                    productIds: selectedIds,
                    status,
                    at: now(),
                  })
                }
              >
                Aplicar estado
              </Button>
            </div>

            <div className="bulk-action">
              <Field label="Ajuste">
                <select
                  value={priceKind}
                  onChange={(event) => setPriceKind(event.target.value as "percentage" | "amount")}
                >
                  <option value="percentage">Porcentaje</option>
                  <option value="amount">Centavos</option>
                </select>
              </Field>
              <Field label={priceKind === "percentage" ? "Valor %" : "Centavos"}>
                <input
                  type="number"
                  value={priceAdjustment}
                  onChange={(event) => setPriceAdjustment(event.target.value)}
                  step={priceKind === "percentage" ? "0.1" : "1"}
                />
              </Field>
              <Button onClick={applyPriceAdjustment}>Ajustar precios</Button>
            </div>

            <div className="bulk-action">
              <Field label="Categorías">
                <select
                  multiple
                  size={Math.min(4, Math.max(2, project.categories.length))}
                  value={categoryIds}
                  onChange={(event) =>
                    setCategoryIds(
                      Array.from(event.target.selectedOptions, (option) => option.value),
                    )
                  }
                >
                  {orderedCategories.map((category) => (
                    <option value={category.id} key={category.id}>
                      {categoryLabel(category)}
                    </option>
                  ))}
                </select>
              </Field>
              <Button
                onClick={() =>
                  onCommand({
                    type: "products.setCategories",
                    productIds: selectedIds,
                    categoryIds: project.categories
                      .filter((category) => categoryIds.includes(category.id))
                      .map((category) => category.id),
                    at: now(),
                  })
                }
              >
                Establecer categorías
              </Button>
            </div>

            <div className="bulk-action">
              <Field label="Colecciones">
                <select
                  multiple
                  size={Math.min(4, Math.max(2, project.collections.length))}
                  value={collectionIds}
                  onChange={(event) =>
                    setCollectionIds(
                      Array.from(event.target.selectedOptions, (option) => option.value),
                    )
                  }
                >
                  {project.collections.map((collection) => (
                    <option value={collection.id} key={collection.id}>
                      {collection.title}
                    </option>
                  ))}
                </select>
              </Field>
              <Button
                onClick={() =>
                  onCommand({
                    type: "products.setCollections",
                    productIds: selectedIds,
                    collectionIds: project.collections
                      .filter((collection) => collectionIds.includes(collection.id))
                      .map((collection) => collection.id),
                    at: now(),
                  })
                }
              >
                Establecer colecciones
              </Button>
            </div>

            <div className="bulk-action bulk-action--tags">
              <Field label="Tags" hint="Separados por comas.">
                <input value={tags} onChange={(event) => setTags(event.target.value)} />
              </Field>
              <Button onClick={() => applyTags("products.addTags")}>Agregar tags</Button>
              <Button variant="quiet" onClick={() => applyTags("products.removeTags")}>
                Quitar tags
              </Button>
            </div>
          </div>
        </section>
      ) : null}

      {hasProducts ? (
        <nav className="table-pagination" aria-label="Paginación del catálogo">
          <span>
            Página {table.getState().pagination.pageIndex + 1} de{" "}
            {Math.max(1, table.getPageCount())}
          </span>
          <Field label="Filas">
            <select
              value={table.getState().pagination.pageSize}
              onChange={(event) => table.setPageSize(Number(event.target.value))}
            >
              {[25, 50, 100].map((pageSize) => (
                <option value={pageSize} key={pageSize}>
                  {pageSize}
                </option>
              ))}
            </select>
          </Field>
          <div>
            <Button
              data-testid="next-catalog-page"
              variant="quiet"
              icon={CaretLeft}
              disabled={!table.getCanPreviousPage()}
              onClick={() => table.previousPage()}
            >
              Anterior
            </Button>
            <Button
              variant="quiet"
              icon={CaretRight}
              disabled={!table.getCanNextPage()}
              onClick={() => table.nextPage()}
            >
              Siguiente
            </Button>
          </div>
        </nav>
      ) : null}
    </>
  );
}
