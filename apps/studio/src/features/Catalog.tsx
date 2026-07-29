import {
  ArrowDown,
  ArrowUp,
  CaretLeft,
  CaretRight,
  CheckSquare,
  DownloadSimple,
  MagnifyingGlass,
  Package,
  PencilSimple,
  Plus,
  UploadSimple,
} from "@phosphor-icons/react";
import { type DomainCommand, reduceProject } from "@solara/core";
import type { Product, StoreProjectV1 } from "@solara/project-schema";
import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  type PaginationState,
  type RowSelectionState,
  type SortingState,
  useReactTable,
} from "@tanstack/react-table";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Button, EmptyState, Field, InlineError, SectionHeader } from "../components/Ui";
import { formatCurrency } from "../lib/format";
import { downloadBlob } from "../lib/projectArchive";
import { exportCsvInWorker, importCsvInWorker } from "../lib/workers";
import { ProductEditor } from "./catalog/ProductEditor";

interface CatalogProps {
  project: StoreProjectV1;
  onCommand(command: DomainCommand): void;
}

interface ImportSummary {
  filename: string;
  products: Product[];
  added: number;
  modified: number;
  unchanged: number;
  removed: number;
}

type EditorState = { mode: "create" | "edit"; product: Product } | undefined;
type BusyState = "import" | "export" | "";

const now = () => new Date().toISOString();

function blankProduct(project: StoreProjectV1): Product {
  const stamp = now();
  const id = `product-${crypto.randomUUID()}`;
  return {
    id: id as Product["id"],
    slug: `producto-${id.slice(-8)}` as Product["slug"],
    title: "Nuevo producto",
    description: "",
    status: "hidden",
    brand: project.identity.brandName,
    categoryIds: [],
    collectionIds: [],
    tags: [],
    imageIds: [],
    variants: [
      {
        id: `variant-${crypto.randomUUID()}` as Product["variants"][number]["id"],
        sku: "",
        title: "Única",
        optionValues: {},
        price: 0 as Product["variants"][number]["price"],
        available: true,
        stockStatus: "in_stock",
      },
    ],
    createdAt: stamp,
    updatedAt: stamp,
  };
}

function summarizeImport(
  filename: string,
  current: readonly Product[],
  incoming: Product[],
): ImportSummary {
  const currentById = new Map(current.map((product) => [product.id, product]));
  const incomingIds = new Set(incoming.map((product) => product.id));
  let added = 0;
  let modified = 0;
  let unchanged = 0;

  for (const product of incoming) {
    const existing = currentById.get(product.id);
    if (!existing) added += 1;
    else if (JSON.stringify(existing) === JSON.stringify(product)) unchanged += 1;
    else modified += 1;
  }

  return {
    filename,
    products: incoming,
    added,
    modified,
    unchanged,
    removed: current.filter((product) => !incomingIds.has(product.id)).length,
  };
}

export function Catalog({ project, onCommand }: CatalogProps) {
  const [selection, setSelection] = useState<RowSelectionState>({});
  const [sorting, setSorting] = useState<SortingState>([]);
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 50 });
  const [filter, setFilter] = useState("");
  const [status, setStatus] = useState<Product["status"]>("active");
  const [priceKind, setPriceKind] = useState<"percentage" | "amount">("percentage");
  const [priceAdjustment, setPriceAdjustment] = useState("10");
  const [categoryIds, setCategoryIds] = useState<string[]>([]);
  const [collectionIds, setCollectionIds] = useState<string[]>([]);
  const [tags, setTags] = useState("");
  const [editor, setEditor] = useState<EditorState>();
  const [pendingImport, setPendingImport] = useState<ImportSummary>();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<BusyState>("");
  const importRef = useRef<HTMLInputElement>(null);
  const importReviewTitleId = useId();

  useEffect(() => {
    const validIds = new Set<string>(project.products.map((product) => product.id));
    setSelection((current) => {
      const entries = Object.entries(current).filter(
        ([id, selected]) => selected && validIds.has(id),
      );
      if (entries.length === Object.keys(current).length) return current;
      return Object.fromEntries(entries);
    });
  }, [project.products]);

  const columns = useMemo<ColumnDef<Product>[]>(
    () => [
      {
        id: "select",
        header: ({ table }) => (
          <input
            type="checkbox"
            aria-label="Seleccionar productos de esta página"
            checked={table.getIsAllPageRowsSelected()}
            ref={(element) => {
              if (element) element.indeterminate = table.getIsSomePageRowsSelected();
            }}
            onChange={table.getToggleAllPageRowsSelectedHandler()}
          />
        ),
        cell: ({ row }) => (
          <input
            type="checkbox"
            aria-label={`Seleccionar ${row.original.title}`}
            checked={row.getIsSelected()}
            disabled={!row.getCanSelect()}
            onChange={row.getToggleSelectedHandler()}
          />
        ),
        enableSorting: false,
      },
      {
        accessorKey: "title",
        header: "Producto",
        cell: ({ row }) => (
          <input
            className="table-inline"
            aria-label={`Nombre de ${row.original.title}`}
            defaultValue={row.original.title}
            key={`${row.original.id}-${row.original.updatedAt}`}
            onBlur={(event) => {
              const title = event.target.value.trim();
              if (title && title !== row.original.title) {
                onCommand({
                  type: "product.update",
                  productId: row.original.id,
                  changes: { title },
                  at: now(),
                });
              }
            }}
          />
        ),
      },
      {
        accessorKey: "brand",
        header: "Marca",
        cell: ({ row }) => (
          <input
            className="table-inline"
            aria-label={`Marca de ${row.original.title}`}
            defaultValue={row.original.brand}
            key={`${row.original.id}-${row.original.updatedAt}-brand`}
            onBlur={(event) => {
              const brand = event.target.value.trim();
              if (brand !== row.original.brand) {
                onCommand({
                  type: "product.update",
                  productId: row.original.id,
                  changes: { brand },
                  at: now(),
                });
              }
            }}
          />
        ),
      },
      {
        id: "price",
        accessorFn: (product) => product.variants[0]?.price ?? 0,
        header: "Precio",
        cell: ({ row }) => {
          const first = row.original.variants[0];
          if (!first) return null;
          return (
            <div className="price-cell">
              <span>{formatCurrency(first.price)}</span>
              <input
                aria-label={`Precio en centavos de ${row.original.title}`}
                type="number"
                min={0}
                step={1}
                defaultValue={first.price}
                key={`${first.id}-${first.price}`}
                onBlur={(event) => {
                  const price = Number(event.target.value);
                  if (Number.isSafeInteger(price) && price >= 0 && price !== first.price) {
                    onCommand({
                      type: "product.update",
                      productId: row.original.id,
                      changes: {
                        variants: row.original.variants.map((variant, index) =>
                          index === 0
                            ? {
                                ...variant,
                                price: price as Product["variants"][number]["price"],
                              }
                            : variant,
                        ),
                      },
                      at: now(),
                    });
                  }
                }}
              />
            </div>
          );
        },
      },
      {
        accessorKey: "status",
        header: "Estado",
        cell: ({ row }) => (
          <span className={`status-label status-label--${row.original.status}`}>
            {row.original.status === "active"
              ? "Activo"
              : row.original.status === "hidden"
                ? "Oculto"
                : "Archivado"}
          </span>
        ),
      },
      {
        id: "variants",
        header: "Variantes",
        accessorFn: (product) => product.variants.length,
      },
      {
        id: "actions",
        header: "Acciones",
        enableSorting: false,
        cell: ({ row }) => (
          <Button
            variant="quiet"
            icon={PencilSimple}
            onClick={() => setEditor({ mode: "edit", product: structuredClone(row.original) })}
          >
            Editar
          </Button>
        ),
      },
    ],
    [onCommand],
  );

  const table = useReactTable({
    data: project.products,
    columns,
    state: { rowSelection: selection, sorting, globalFilter: filter, pagination },
    onRowSelectionChange: setSelection,
    onSortingChange: setSorting,
    onGlobalFilterChange: setFilter,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getRowId: (product) => product.id,
    enableRowSelection: true,
    autoResetPageIndex: false,
  });

  const selectedIds = Object.entries(selection)
    .filter(([, selected]) => selected)
    .map(([id]) => id as Product["id"]);
  const filteredRows = table.getFilteredRowModel().rows;

  const importCsv = async (file: File) => {
    setBusy("import");
    setError("");
    setPendingImport(undefined);
    try {
      const products = await importCsvInWorker(await file.text());
      reduceProject(project, {
        type: "products.replaceAll",
        products,
        at: now(),
      });
      setPendingImport(summarizeImport(file.name, project.products, products));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudo importar el CSV.");
    } finally {
      setBusy("");
    }
  };

  const exportCsv = async () => {
    setBusy("export");
    setError("");
    try {
      const csv = await exportCsvInWorker(project.products);
      downloadBlob(csv, `${project.slug}-productos.csv`, "text/csv;charset=utf-8");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudo exportar el CSV.");
    } finally {
      setBusy("");
    }
  };

  const applyPriceAdjustment = () => {
    const numeric = Number(priceAdjustment);
    const adjustment =
      priceKind === "amount"
        ? { type: "amount" as const, cents: numeric }
        : { type: "percentage" as const, basisPoints: Math.round(numeric * 100) };
    const value = adjustment.type === "amount" ? adjustment.cents : adjustment.basisPoints;
    if (!Number.isSafeInteger(value)) {
      setError("El ajuste debe producir una cantidad entera de centavos o puntos básicos.");
      return;
    }
    onCommand({
      type: "products.adjustPrices",
      productIds: selectedIds,
      adjustment,
      at: now(),
    });
  };

  const applyTags = (type: "products.addTags" | "products.removeTags") => {
    const normalized = tags
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean);
    if (normalized.length === 0) return;
    onCommand({ type, productIds: selectedIds, tags: normalized, at: now() });
  };

  return (
    <section className="workspace-section">
      <SectionHeader
        title="Catálogo"
        description={`${project.products.length} productos y ${project.products.reduce((total, item) => total + item.variants.length, 0)} variantes.`}
        actions={
          <>
            <input
              className="visually-hidden"
              ref={importRef}
              type="file"
              accept=".csv,text/csv"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void importCsv(file);
                event.target.value = "";
              }}
            />
            <Button
              icon={UploadSimple}
              onClick={() => importRef.current?.click()}
              disabled={Boolean(busy)}
            >
              {busy === "import" ? "Procesando" : "Importar CSV"}
            </Button>
            <Button icon={DownloadSimple} onClick={() => void exportCsv()} disabled={Boolean(busy)}>
              {busy === "export" ? "Generando" : "Exportar CSV"}
            </Button>
            <Button
              variant="primary"
              icon={Plus}
              onClick={() => setEditor({ mode: "create", product: blankProduct(project) })}
            >
              Agregar producto
            </Button>
          </>
        }
      />

      {error ? <InlineError>{error}</InlineError> : null}

      {pendingImport ? (
        <section className="import-review" aria-labelledby={importReviewTitleId}>
          <div>
            <span>Revisión de importación</span>
            <h3 id={importReviewTitleId}>{pendingImport.filename}</h3>
            <p>El catálogo no cambiará hasta que confirmes esta operación.</p>
          </div>
          <dl>
            <div>
              <dt>Nuevos</dt>
              <dd>{pendingImport.added}</dd>
            </div>
            <div>
              <dt>Modificados</dt>
              <dd>{pendingImport.modified}</dd>
            </div>
            <div>
              <dt>Sin cambios</dt>
              <dd>{pendingImport.unchanged}</dd>
            </div>
            <div data-warning={pendingImport.removed > 0}>
              <dt>Se eliminarán</dt>
              <dd>{pendingImport.removed}</dd>
            </div>
          </dl>
          <div className="import-review__actions">
            <Button variant="quiet" onClick={() => setPendingImport(undefined)}>
              Cancelar
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                onCommand({
                  type: "products.replaceAll",
                  products: pendingImport.products,
                  at: now(),
                });
                setPendingImport(undefined);
                setSelection({});
                setPagination((current) => ({ ...current, pageIndex: 0 }));
              }}
            >
              Reemplazar catálogo
            </Button>
          </div>
        </section>
      ) : null}

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
        <div className="selection-summary">
          <span>{selectedIds.length} seleccionados</span>
          {filteredRows.length > 0 ? (
            <Button
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
                  {project.categories.map((category) => (
                    <option value={category.id} key={category.id}>
                      {category.title}
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

      {project.products.length === 0 ? (
        <EmptyState
          icon={Package}
          title="El catálogo está vacío"
          body="Agregá el primer producto o importá un CSV con el formato de SolaraCommerce."
          action={
            <Button
              variant="primary"
              icon={Plus}
              onClick={() => setEditor({ mode: "create", product: blankProduct(project) })}
            >
              Agregar producto
            </Button>
          }
        />
      ) : (
        <>
          <div className="table-shell">
            <table>
              <thead>
                {table.getHeaderGroups().map((headerGroup) => (
                  <tr key={headerGroup.id}>
                    {headerGroup.headers.map((header) => (
                      <th key={header.id}>
                        {header.isPlaceholder ? null : header.column.getCanSort() ? (
                          <button
                            className="table-sort"
                            type="button"
                            onClick={header.column.getToggleSortingHandler()}
                          >
                            {flexRender(header.column.columnDef.header, header.getContext())}
                            {header.column.getIsSorted() === "asc" ? (
                              <ArrowUp aria-label="Orden ascendente" size={14} />
                            ) : header.column.getIsSorted() === "desc" ? (
                              <ArrowDown aria-label="Orden descendente" size={14} />
                            ) : null}
                          </button>
                        ) : (
                          flexRender(header.column.columnDef.header, header.getContext())
                        )}
                      </th>
                    ))}
                  </tr>
                ))}
              </thead>
              <tbody>
                {table.getRowModel().rows.map((row) => (
                  <tr key={row.id} data-selected={row.getIsSelected()}>
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))}
                {table.getRowModel().rows.length === 0 ? (
                  <tr>
                    <td colSpan={columns.length} className="table-empty">
                      No hay productos que coincidan con la búsqueda.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>

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
        </>
      )}

      {editor ? (
        <ProductEditor
          product={editor.product}
          mode={editor.mode}
          categories={project.categories}
          collections={project.collections}
          existingSlugs={project.products
            .filter((product) => product.id !== editor.product.id)
            .map((product) => product.slug)}
          onCancel={() => setEditor(undefined)}
          onSave={(product) => {
            if (editor.mode === "create") {
              onCommand({ type: "product.create", product, at: now() });
            } else {
              onCommand({
                type: "product.update",
                productId: product.id,
                changes: {
                  slug: product.slug,
                  title: product.title,
                  description: product.description,
                  richDescription: product.richDescription,
                  status: product.status,
                  brand: product.brand,
                  categoryIds: product.categoryIds,
                  collectionIds: product.collectionIds,
                  tags: product.tags,
                  imageIds: product.imageIds,
                  variants: product.variants,
                },
                at: now(),
              });
            }
            setEditor(undefined);
          }}
        />
      ) : null}
    </section>
  );
}
