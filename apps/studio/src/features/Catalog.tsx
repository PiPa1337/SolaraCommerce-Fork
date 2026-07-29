import {
  ArrowDown,
  ArrowUp,
  CheckSquare,
  DownloadSimple,
  MagnifyingGlass,
  Package,
  Plus,
  UploadSimple,
} from "@phosphor-icons/react";
import type { DomainCommand } from "@solara/core";
import type { Product, StoreProjectV1 } from "@solara/project-schema";
import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  type RowSelectionState,
  type SortingState,
  useReactTable,
} from "@tanstack/react-table";
import { useMemo, useRef, useState } from "react";
import { Button, EmptyState, Field, InlineError, SectionHeader } from "../components/Ui";
import { formatCurrency } from "../lib/format";
import { downloadBlob } from "../lib/projectArchive";
import { exportCsvInWorker, importCsvInWorker } from "../lib/workers";

interface CatalogProps {
  project: StoreProjectV1;
  onCommand(command: DomainCommand): void;
  onReplaceProducts(products: Product[]): void;
}

const now = () => new Date().toISOString();

export function Catalog({ project, onCommand, onReplaceProducts }: CatalogProps) {
  const [selection, setSelection] = useState<RowSelectionState>({});
  const [sorting, setSorting] = useState<SortingState>([]);
  const [filter, setFilter] = useState("");
  const [adjustment, setAdjustment] = useState("10");
  const [status, setStatus] = useState<Product["status"]>("active");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const importRef = useRef<HTMLInputElement>(null);

  const columns = useMemo<ColumnDef<Product>[]>(
    () => [
      {
        id: "select",
        header: ({ table }) => (
          <input
            type="checkbox"
            aria-label="Seleccionar productos visibles"
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
                step={100}
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
    ],
    [onCommand],
  );

  const table = useReactTable({
    data: project.products,
    columns,
    state: { rowSelection: selection, sorting, globalFilter: filter },
    onRowSelectionChange: setSelection,
    onSortingChange: setSorting,
    onGlobalFilterChange: setFilter,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getRowId: (product) => product.id,
    enableRowSelection: true,
  });

  const selectedIds = table.getSelectedRowModel().rows.map((row) => row.original.id);

  const createBlankProduct = () => {
    const stamp = now();
    const id = `product-${crypto.randomUUID()}`;
    onCommand({
      type: "product.create",
      at: stamp,
      product: {
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
      },
    });
  };

  const importCsv = async (file: File) => {
    setBusy(true);
    setError("");
    try {
      const products = await importCsvInWorker(await file.text());
      onReplaceProducts(products);
      setSelection({});
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudo importar el CSV.");
    } finally {
      setBusy(false);
    }
  };

  const exportCsv = async () => {
    setBusy(true);
    setError("");
    try {
      const csv = await exportCsvInWorker(project.products);
      downloadBlob(csv, `${project.slug}-productos.csv`, "text/csv;charset=utf-8");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudo exportar el CSV.");
    } finally {
      setBusy(false);
    }
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
            <Button icon={UploadSimple} onClick={() => importRef.current?.click()} disabled={busy}>
              Importar CSV
            </Button>
            <Button icon={DownloadSimple} onClick={() => void exportCsv()} disabled={busy}>
              Exportar CSV
            </Button>
            <Button variant="primary" icon={Plus} onClick={createBlankProduct}>
              Agregar producto
            </Button>
          </>
        }
      />

      {error ? <InlineError>{error}</InlineError> : null}

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
        <span>{selectedIds.length} seleccionados</span>
      </div>

      {selectedIds.length > 0 ? (
        <section className="bulk-bar" aria-label="Acciones masivas">
          <CheckSquare aria-hidden size={20} />
          <strong>{selectedIds.length} productos</strong>
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
          <Field label="Ajuste porcentual">
            <input
              type="number"
              value={adjustment}
              onChange={(event) => setAdjustment(event.target.value)}
              step="0.1"
            />
          </Field>
          <Button
            onClick={() => {
              const basisPoints = Math.round(Number(adjustment) * 100);
              if (!Number.isSafeInteger(basisPoints)) return;
              onCommand({
                type: "products.adjustPrices",
                productIds: selectedIds,
                adjustment: { type: "percentage", basisPoints },
                at: now(),
              });
            }}
          >
            Ajustar precios
          </Button>
        </section>
      ) : null}

      {project.products.length === 0 ? (
        <EmptyState
          icon={Package}
          title="El catálogo está vacío"
          body="Agregá el primer producto o importá un CSV con el formato de SolaraCommerce."
          action={
            <Button variant="primary" icon={Plus} onClick={createBlankProduct}>
              Agregar producto
            </Button>
          }
        />
      ) : (
        <div className="table-shell">
          <table>
            <thead>
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <th key={header.id}>
                      {header.isPlaceholder ? null : (
                        <button
                          className="table-sort"
                          type="button"
                          disabled={!header.column.getCanSort()}
                          onClick={header.column.getToggleSortingHandler()}
                        >
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          {header.column.getIsSorted() === "asc" ? (
                            <ArrowUp aria-label="Orden ascendente" size={14} />
                          ) : header.column.getIsSorted() === "desc" ? (
                            <ArrowDown aria-label="Orden descendente" size={14} />
                          ) : null}
                        </button>
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
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
