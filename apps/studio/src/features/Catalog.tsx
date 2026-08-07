/**
 * Administración de productos, variantes y categorías. La UI transforma las
 * acciones del usuario en DomainCommand y deja al core recalcular índices y
 * validar jerarquías; el CSV pesado se procesa en Web Worker.
 */
import {
  ArrowDown,
  ArrowUp,
  DownloadSimple,
  Package,
  PencilSimple,
  Plus,
  UploadSimple,
} from "@phosphor-icons/react";
import { type DomainCommand, reduceProject } from "@solara/core";
import {
  type Category,
  getCategoryProductIds,
  type Product,
  type StoreProjectV1,
  StoreProjectV1Schema,
} from "@solara/project-schema";
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
import { Button, EmptyState, InlineError, SectionHeader } from "../components/Ui";
import { buildCatalogPackagePlan, type CatalogPackagePlan } from "../lib/catalogPackage";
import { formatCurrency } from "../lib/format";
import { downloadBlob } from "../lib/projectArchive";
import { exportCommercialCsvInWorker, exportCsvInWorker, importCsvInWorker } from "../lib/workers";
import { CatalogToolbar } from "./catalog/CatalogToolbar";
import { CategoryTree } from "./catalog/CategoryTree";
import { ProductEditor } from "./catalog/ProductEditor";

declare module "react" {
  interface InputHTMLAttributes<T> {
    webkitdirectory?: string;
  }
}

interface CatalogProps {
  project: StoreProjectV1;
  onCommand(command: DomainCommand): void;
  onChange(project: StoreProjectV1): void;
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
type BusyState = "import" | "package" | "export" | "";

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

export function Catalog({ project, onCommand, onChange }: CatalogProps) {
  const [selection, setSelection] = useState<RowSelectionState>({});
  const [sorting, setSorting] = useState<SortingState>([]);
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 50 });
  const [filter, setFilter] = useState("");
  const [status, setStatus] = useState<Product["status"]>("active");
  const [priceKind, setPriceKind] = useState<"percentage" | "amount">("percentage");
  const [priceAdjustment, setPriceAdjustment] = useState("10");
  const [categoryIds, setCategoryIds] = useState<string[]>([]);
  const [categoryFilterId, setCategoryFilterId] = useState("");
  const [collapsedCategoryIds, setCollapsedCategoryIds] = useState<Set<string>>(new Set());
  const [reparentCategoryId, setReparentCategoryId] = useState("");
  const [reparentParentId, setReparentParentId] = useState("");
  const [collectionIds, setCollectionIds] = useState<string[]>([]);
  const [tags, setTags] = useState("");
  const [editor, setEditor] = useState<EditorState>();
  const [pendingImport, setPendingImport] = useState<ImportSummary>();
  const [pendingPackage, setPendingPackage] = useState<CatalogPackagePlan>();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<BusyState>("");
  const importRef = useRef<HTMLInputElement>(null);
  const importReviewTitleId = useId();
  const packageInputId = useId();
  const packageReviewTitleId = useId();

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

  const categoryFilteredProducts = useMemo(() => {
    if (!categoryFilterId) return project.products;
    const productIds = new Set(getCategoryProductIds(project, categoryFilterId as Category["id"]));
    return project.products.filter((product) => productIds.has(product.id));
  }, [categoryFilterId, project]);

  const table = useReactTable({
    data: categoryFilteredProducts,
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
      const products = await importCsvInWorker(await file.text(), {
        categories: project.categories,
        collections: project.collections,
        assets: project.assets.map((asset) => ({ id: asset.id })),
      });
      setPendingImport(summarizeImport(file.name, project.products, products));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudo importar el CSV.");
    } finally {
      setBusy("");
    }
  };

  const importPackage = async (files: File[]) => {
    setBusy("package");
    setError("");
    setPendingPackage(undefined);
    try {
      setPendingPackage(await buildCatalogPackagePlan(files, project));
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "No se pudo leer la carpeta del catálogo.",
      );
    } finally {
      setBusy("");
    }
  };

  const applyPackage = () => {
    if (!pendingPackage) return;
    try {
      const at = now();
      const candidate = StoreProjectV1Schema.parse({
        ...project,
        assets: pendingPackage.assets,
        updatedAt: at,
      });
      const next = reduceProject(candidate, {
        type: "catalog.applyImport",
        products: pendingPackage.products,
        categories: pendingPackage.categories,
        collections: pendingPackage.collections,
        at,
      });
      onChange(next);
      setPendingPackage(undefined);
      setSelection({});
      setPagination((current) => ({ ...current, pageIndex: 0 }));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudo aplicar el catálogo.");
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

  const exportCommercialCsv = async () => {
    setBusy("export");
    setError("");
    try {
      const csv = await exportCommercialCsvInWorker(project);
      downloadBlob(csv, `${project.slug}-catalogo-comercial.csv`, "text/csv;charset=utf-8");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudo exportar el CSV comercial.");
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
            <input
              className="visually-hidden"
              id={packageInputId}
              type="file"
              webkitdirectory="true"
              multiple
              onChange={(event) => {
                const files = Array.from(event.target.files ?? []);
                if (files.length > 0) void importPackage(files);
                event.target.value = "";
              }}
            />
            <Button
              icon={UploadSimple}
              onClick={() => document.getElementById(packageInputId)?.click()}
              disabled={Boolean(busy)}
            >
              {busy === "package" ? "Leyendo carpeta" : "Importar carpeta + imágenes"}
            </Button>
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
              icon={DownloadSimple}
              onClick={() => void exportCommercialCsv()}
              disabled={Boolean(busy)}
            >
              {busy === "export" ? "Generando" : "CSV comercial"}
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

      {pendingPackage ? (
        <section
          className="import-review catalog-package-review"
          aria-labelledby={packageReviewTitleId}
        >
          <div>
            <span>Revisión de catálogo e imágenes</span>
            <h3 id={packageReviewTitleId}>{pendingPackage.summary.filename}</h3>
            <p>El proyecto no cambiará hasta que confirmes la fusión.</p>
          </div>
          <dl>
            <div>
              <dt>Productos nuevos</dt>
              <dd>{pendingPackage.summary.productsAdded}</dd>
            </div>
            <div>
              <dt>Productos actualizados</dt>
              <dd>{pendingPackage.summary.productsUpdated}</dd>
            </div>
            <div>
              <dt>Categorías nuevas</dt>
              <dd>{pendingPackage.summary.categoriesAdded}</dd>
            </div>
            <div>
              <dt>Imágenes procesadas</dt>
              <dd>{pendingPackage.summary.imagesAdded}</dd>
            </div>
            <div>
              <dt>Imágenes reutilizadas</dt>
              <dd>{pendingPackage.summary.imagesReused}</dd>
            </div>
          </dl>
          {pendingPackage.summary.unmatchedImages.length > 0 ? (
            <InlineError>
              No se encontraron: {pendingPackage.summary.unmatchedImages.join(", ")}
            </InlineError>
          ) : null}
          <div className="import-review__actions">
            <Button variant="quiet" onClick={() => setPendingPackage(undefined)}>
              Cancelar
            </Button>
            <Button variant="primary" onClick={applyPackage}>
              Agregar y actualizar
            </Button>
          </div>
        </section>
      ) : null}

      <CatalogToolbar
        project={project}
        table={table}
        filteredRows={filteredRows}
        selectedIds={selectedIds}
        filter={filter}
        setFilter={setFilter}
        categoryFilterId={categoryFilterId}
        setCategoryFilterId={setCategoryFilterId}
        setPagination={setPagination}
        setSelection={setSelection}
        status={status}
        setStatus={setStatus}
        priceKind={priceKind}
        setPriceKind={setPriceKind}
        priceAdjustment={priceAdjustment}
        setPriceAdjustment={setPriceAdjustment}
        categoryIds={categoryIds}
        setCategoryIds={setCategoryIds}
        collectionIds={collectionIds}
        setCollectionIds={setCollectionIds}
        tags={tags}
        setTags={setTags}
        onCommand={onCommand}
        applyPriceAdjustment={applyPriceAdjustment}
        applyTags={applyTags}
      />

      <CategoryTree
        project={project}
        collapsedCategoryIds={collapsedCategoryIds}
        setCollapsedCategoryIds={setCollapsedCategoryIds}
        reparentCategoryId={reparentCategoryId}
        setReparentCategoryId={setReparentCategoryId}
        reparentParentId={reparentParentId}
        setReparentParentId={setReparentParentId}
        onCommand={onCommand}
      />

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
      )}

      {editor ? (
        <ProductEditor
          product={editor.product}
          mode={editor.mode}
          categories={project.categories}
          collections={project.collections}
          assets={project.assets}
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
