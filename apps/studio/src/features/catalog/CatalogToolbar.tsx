/** Toolbar del catálogo: búsqueda, filtro, columnas configurables, vista y paginación. */
import { Columns, List, MagnifyingGlass, SquaresFour } from "@phosphor-icons/react";
import type { Product, StoreProjectV1 } from "@solara/project-schema";
import type { PaginationState, Row, RowSelectionState, Table } from "@tanstack/react-table";
import { type Dispatch, type SetStateAction, useEffect, useRef, useState } from "react";
import { Pagination, SegmentedControl } from "../../components/primitives";
import { Button } from "../../components/Ui";
import { catalogColumns } from "../../lib/catalogTableModel";
import { categoryLabel, categoryTree } from "./CategoryTree";

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
  visibleColumns: Record<string, boolean>;
  onToggleColumn(id: string): void;
  view: "table" | "cards";
  onViewChange(view: "table" | "cards"): void;
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
  visibleColumns,
  onToggleColumn,
  view,
  onViewChange,
}: CatalogToolbarProps) {
  const orderedCategories = categoryTree(project);
  const [columnsOpen, setColumnsOpen] = useState(false);
  const columnsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!columnsOpen) return;
    const closeOnOutside = (event: PointerEvent) => {
      if (columnsRef.current && !columnsRef.current.contains(event.target as Node)) {
        setColumnsOpen(false);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setColumnsOpen(false);
    };
    document.addEventListener("pointerdown", closeOnOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [columnsOpen]);

  return (
    <>
      <div className="catalog-toolbar">
        <label className="search-box">
          <MagnifyingGlass aria-hidden size={18} />
          <span className="visually-hidden">Buscar productos</span>
          <input
            value={filter}
            onChange={(event) => {
              setFilter(event.target.value);
              setPagination((current) => ({ ...current, pageIndex: 0 }));
            }}
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
        <div className="catalog-toolbar-end">
          <SegmentedControl
            size="sm"
            label="Vista del catálogo"
            value={view}
            onChange={onViewChange}
            options={[
              { value: "table", label: "Lista", icon: List },
              { value: "cards", label: "Tarjetas", icon: SquaresFour },
            ]}
          />
          <div className="catalog-columns" ref={columnsRef}>
            <Button
              size="sm"
              variant="quiet"
              icon={Columns}
              aria-expanded={columnsOpen}
              aria-haspopup="true"
              data-testid="ui-columns-toggle"
              onClick={() => setColumnsOpen((open) => !open)}
            >
              Columnas
            </Button>
            {columnsOpen ? (
              <fieldset className="catalog-columns__popover" data-testid="ui-columns-popover">
                <legend className="visually-hidden">Columnas visibles</legend>
                {catalogColumns.map((column) => (
                  <label className="catalog-columns__option" key={column.id}>
                    <input
                      type="checkbox"
                      checked={Boolean(visibleColumns[column.id])}
                      data-testid={`ui-column-toggle-${column.id}`}
                      onChange={() => onToggleColumn(column.id)}
                    />
                    <span>{column.label}</span>
                  </label>
                ))}
              </fieldset>
            ) : null}
          </div>
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
      </div>

      {hasProducts ? (
        <Pagination
          page={table.getState().pagination.pageIndex + 1}
          totalPages={Math.max(1, table.getPageCount())}
          onChange={(page) => setPagination((current) => ({ ...current, pageIndex: page - 1 }))}
          pageSize={table.getState().pagination.pageSize}
          onPageSizeChange={(pageSize) => table.setPageSize(pageSize)}
          pageSizeOptions={[25, 50, 100]}
          totalItems={filteredRows.length}
        />
      ) : null}
    </>
  );
}
