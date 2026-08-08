/**
 * Administración de productos, variantes y categorías. La UI transforma las
 * acciones del usuario en DomainCommand y deja al core recalcular índices y
 * validar jerarquías; el CSV pesado se procesa en Web Worker.
 */
import {
  ArrowDown,
  ArrowUp,
  CheckSquare,
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
  type Row,
  type RowSelectionState,
  type SortingState,
  useReactTable,
  type VisibilityState,
} from "@tanstack/react-table";
import { memo, useEffect, useId, useMemo, useRef, useState } from "react";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { Button, EmptyState, Field, InlineError, SectionHeader } from "../components/Ui";
import { buildCatalogPackagePlan, type CatalogPackagePlan } from "../lib/catalogPackage";
import {
  duplicateProduct,
  loadCatalogColumnVisibility,
  loadCatalogView,
  productCategoryTitles,
  productStockLabel,
  saveCatalogColumnVisibility,
  saveCatalogView,
} from "../lib/catalogTableModel";
import { formatCurrency, formatDate } from "../lib/format";
import { downloadBlob } from "../lib/projectArchive";
import {
  type CsvRowError,
  diagnoseCsvInWorker,
  exportCommercialCsvInWorker,
  exportCsvInWorker,
  importCsvInWorker,
} from "../lib/workers";
import { CatalogToolbar } from "./catalog/CatalogToolbar";
import { CategoryTree, categoryLabel, categoryTree } from "./catalog/CategoryTree";
import { ProductEditor } from "./catalog/ProductEditor";

declare module "react" {
  /* biome-ignore lint/correctness/noUnusedVariables: la fusión exige el nombre `T` de @types/react. */
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

const statusText = (status: Product["status"]) =>
  status === "active" ? "Activo" : status === "hidden" ? "Oculto" : "Archivado";

/** Precio inline (T4.4): Enter confirma, Escape cancela, blur confirma; los
 *  valores inválidos revierten con un aviso inline. */
function PriceCell({
  product,
  onCommand,
}: {
  product: Product;
  onCommand(command: DomainCommand): void;
}) {
  const first = product.variants[0];
  const [draft, setDraft] = useState(() => String(first?.price ?? 0));
  const [invalid, setInvalid] = useState(false);
  const errorId = useId();
  const timerRef = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(timerRef.current), []);

  if (!first) return null;

  const flashInvalid = () => {
    setInvalid(true);
    window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => setInvalid(false), 2500);
  };

  const parseDraft = () => {
    const text = draft.trim();
    if (text === "") return undefined;
    const price = Number(text);
    return Number.isSafeInteger(price) && price >= 0 ? price : undefined;
  };

  const commitPrice = (price: number) => {
    if (price === first.price) return;
    onCommand({
      type: "product.update",
      productId: product.id,
      changes: {
        variants: product.variants.map((variant, index) =>
          index === 0
            ? { ...variant, price: price as Product["variants"][number]["price"] }
            : variant,
        ),
      },
      at: now(),
    });
  };

  return (
    <div className={`price-cell${invalid ? " price-cell--invalid" : ""}`}>
      <span>{formatCurrency(first.price)}</span>
      <input
        aria-label={`Precio en centavos de ${product.title}`}
        type="number"
        min={0}
        step={1}
        value={draft}
        aria-invalid={invalid || undefined}
        aria-describedby={invalid ? errorId : undefined}
        data-testid="ui-price-edit"
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            const price = parseDraft();
            if (price === undefined) {
              flashInvalid();
            } else {
              commitPrice(price);
              event.currentTarget.blur();
            }
          } else if (event.key === "Escape") {
            setDraft(String(first.price));
            setInvalid(false);
          }
        }}
        onBlur={() => {
          const price = parseDraft();
          if (price === undefined) {
            setDraft(String(first.price));
            flashInvalid();
          } else {
            commitPrice(price);
          }
        }}
      />
      {invalid ? (
        <span
          id={errorId}
          className="catalog-price-error"
          role="alert"
          data-testid="ui-price-error"
        >
          Precio inválido: centavos enteros, 0 o más.
        </span>
      ) : null}
    </div>
  );
}

/** Estado inline (T4.4): un clic convierte la etiqueta en un select que
 *  confirma con el cambio y cancela con Escape o blur. */
function StatusCell({
  product,
  onCommand,
}: {
  product: Product;
  onCommand(command: DomainCommand): void;
}) {
  const [editing, setEditing] = useState(false);
  const selectRef = useRef<HTMLSelectElement>(null);

  useEffect(() => {
    if (editing) selectRef.current?.focus();
  }, [editing]);

  if (!editing) {
    return (
      <button
        type="button"
        className={`status-label status-label--${product.status}`}
        data-testid="ui-status-edit-trigger"
        onClick={() => setEditing(true)}
      >
        {statusText(product.status)}
      </button>
    );
  }

  return (
    <select
      ref={selectRef}
      className="catalog-status-select"
      aria-label={`Estado de ${product.title}`}
      data-testid="ui-status-edit"
      value={product.status}
      onChange={(event) => {
        const status = event.target.value as Product["status"];
        if (status !== product.status) {
          onCommand({
            type: "product.update",
            productId: product.id,
            changes: { status },
            at: now(),
          });
        }
        setEditing(false);
      }}
      onBlur={() => setEditing(false)}
      onKeyDown={(event) => {
        if (event.key === "Escape") setEditing(false);
      }}
    >
      <option value="active">Activo</option>
      <option value="hidden">Oculto</option>
      <option value="archived">Archivado</option>
    </select>
  );
}

/** Tarjeta de producto para la vista alterna (T4.4). */
function CatalogCard({
  product,
  image,
  onEdit,
}: {
  product: Product;
  image: { source: string; alt: string } | undefined;
  onEdit(): void;
}) {
  const first = product.variants[0];
  return (
    <article className="catalog-card" data-testid="ui-catalog-card">
      <div className="catalog-card__image">
        {image ? (
          <img src={image.source} alt={image.alt || product.title} loading="lazy" />
        ) : (
          <Package aria-hidden size={26} />
        )}
      </div>
      <div className="catalog-card__body">
        <h3 title={product.title}>{product.title}</h3>
        <div className="catalog-card__meta">
          <span className={`status-label status-label--${product.status}`}>
            {statusText(product.status)}
          </span>
          <span className="catalog-card__variants">
            {product.variants.length} {product.variants.length === 1 ? "variante" : "variantes"}
          </span>
        </div>
        {first ? <p className="catalog-card__price">{formatCurrency(first.price)}</p> : null}
      </div>
      <Button variant="quiet" icon={PencilSimple} onClick={onEdit}>
        Editar
      </Button>
    </article>
  );
}

/** Fila de tabla memoizada (T5.4): al cambiar la selección o filtrar, sólo
 *  se re-renderizan las filas cuyo estado propio cambió; las celdas leen el
 *  contexto fresco en cada render de la fila. */
const CatalogRow = memo(
  function CatalogRow({
    row,
    selected,
    columnVisibility: _columnVisibility,
  }: {
    row: Row<Product>;
    selected: boolean;
    columnVisibility: VisibilityState;
  }) {
    return (
      <tr data-selected={selected}>
        {row.getVisibleCells().map((cell) => (
          <td key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>
        ))}
      </tr>
    );
  },
  (prev, next) =>
    prev.row === next.row &&
    prev.selected === next.selected &&
    prev.columnVisibility === next.columnVisibility,
);

export function Catalog({ project, onCommand, onChange }: CatalogProps) {
  const [selection, setSelection] = useState<RowSelectionState>({});
  const [sorting, setSorting] = useState<SortingState>([]);
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 50 });
  const [filterDraft, setFilterDraft] = useState("");
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
  const [pendingArchiveIds, setPendingArchiveIds] = useState<Product["id"][] | null>(null);
  const [pendingImport, setPendingImport] = useState<ImportSummary>();
  const [pendingPackage, setPendingPackage] = useState<CatalogPackagePlan>();
  const [error, setError] = useState("");
  const [csvErrors, setCsvErrors] = useState<CsvRowError[]>([]);
  const [busy, setBusy] = useState<BusyState>("");
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(() =>
    loadCatalogColumnVisibility(project.id),
  );
  const [view, setView] = useState<"table" | "cards">(() => loadCatalogView(project.id));
  const importRef = useRef<HTMLInputElement>(null);
  const importReviewTitleId = useId();
  const packageInputId = useId();
  const packageReviewTitleId = useId();

  useEffect(() => {
    setColumnVisibility(loadCatalogColumnVisibility(project.id));
    setView(loadCatalogView(project.id));
  }, [project.id]);

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

  useEffect(() => {
    const timer = window.setTimeout(() => setFilter(filterDraft), 300);
    return () => window.clearTimeout(timer);
  }, [filterDraft]);

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
        id: "categories",
        accessorFn: (product) => productCategoryTitles(product, project),
        header: "Categorías",
        cell: ({ row }) => (
          <span className="table-muted-cell">{productCategoryTitles(row.original, project)}</span>
        ),
      },
      {
        id: "price",
        accessorFn: (product) => product.variants[0]?.price ?? 0,
        header: "Precio",
        sortDescFirst: false,
        cell: ({ row }) => {
          const first = row.original.variants[0];
          if (!first) return null;
          return (
            <PriceCell
              key={`${row.original.id}-${first.price}`}
              product={row.original}
              onCommand={onCommand}
            />
          );
        },
      },
      {
        accessorKey: "status",
        header: "Estado",
        cell: ({ row }) => <StatusCell product={row.original} onCommand={onCommand} />,
      },
      {
        id: "stock",
        accessorFn: productStockLabel,
        header: "Stock",
        cell: ({ row }) => (
          <span className="table-muted-cell">{productStockLabel(row.original)}</span>
        ),
      },
      {
        id: "variants",
        header: "Variantes",
        accessorFn: (product) => product.variants.length,
        sortDescFirst: false,
      },
      {
        id: "updated",
        accessorFn: (product) => product.updatedAt,
        header: "Actualizado",
        cell: ({ row }) => (
          <span className="table-muted-cell">{formatDate(row.original.updatedAt)}</span>
        ),
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
    [onCommand, project],
  );

  const categoryFilteredProducts = useMemo(() => {
    if (!categoryFilterId) return project.products;
    const productIds = new Set(getCategoryProductIds(project, categoryFilterId as Category["id"]));
    return project.products.filter((product) => productIds.has(product.id));
  }, [categoryFilterId, project]);

  const table = useReactTable({
    data: categoryFilteredProducts,
    columns,
    state: {
      rowSelection: selection,
      sorting,
      globalFilter: filter,
      pagination,
      columnVisibility,
    },
    onRowSelectionChange: setSelection,
    onSortingChange: setSorting,
    onGlobalFilterChange: setFilter,
    onPaginationChange: setPagination,
    onColumnVisibilityChange: setColumnVisibility,
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
  const hasProducts = project.products.length > 0;

  const toggleColumn = (id: string) => {
    setColumnVisibility((current) => {
      const next = { ...current, [id]: !current[id] };
      saveCatalogColumnVisibility(project.id, next);
      return next;
    });
  };

  const changeView = (next: "table" | "cards") => {
    setView(next);
    saveCatalogView(project.id, next);
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      const tagName = target.tagName;
      if (
        tagName === "INPUT" ||
        tagName === "SELECT" ||
        tagName === "TEXTAREA" ||
        tagName === "BUTTON" ||
        target.isContentEditable
      ) {
        return;
      }
      if (editor || selectedIds.length === 0) return;
      if (event.key === "e" || event.key === "E") {
        if (selectedIds.length === 1) {
          const product = project.products.find((candidate) => candidate.id === selectedIds[0]);
          if (product) {
            event.preventDefault();
            setEditor({ mode: "edit", product: structuredClone(product) });
          }
        }
        return;
      }
      if (event.key === "d" || event.key === "D") {
        event.preventDefault();
        const taken = new Set(project.products.map((product) => product.slug));
        selectedIds.forEach((productId) => {
          const product = project.products.find((candidate) => candidate.id === productId);
          if (product) {
            onCommand({
              type: "product.create",
              product: duplicateProduct(product, taken),
              at: now(),
            });
          }
        });
        return;
      }
      if (event.key === "Delete") {
        setPendingArchiveIds([...selectedIds]);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [editor, onCommand, project.products, selectedIds]);

  const importCsv = async (file: File) => {
    setBusy("import");
    setError("");
    setCsvErrors([]);
    setPendingImport(undefined);
    const context = {
      categories: project.categories,
      collections: project.collections,
      assets: project.assets.map((asset) => ({ id: asset.id })),
    };
    try {
      const csv = await file.text();
      const products = await importCsvInWorker(csv, context);
      setPendingImport(summarizeImport(file.name, project.products, products));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudo importar el CSV.");
      const csvText = await file.text();
      const errors = await diagnoseCsvInWorker(csvText, context).catch(() => []);
      setCsvErrors(errors);
    } finally {
      setBusy("");
    }
  };

  const importPackage = async (files: File[]) => {
    setBusy("package");
    setError("");
    setCsvErrors([]);
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
              data-testid="ui-csv-import"
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

      {error && csvErrors.length === 0 ? <InlineError>{error}</InlineError> : null}

      {csvErrors.length > 0 ? (
        <div className="csv-errors" data-testid="ui-csv-errors">
          <p className="csv-errors__title">
            El archivo no se pudo importar. Corregí las filas marcadas y volvé a cargarlo.
          </p>
          <ul>
            {csvErrors.map((entry) => (
              <li
                className="csv-error-item"
                data-testid="ui-csv-error"
                key={`${entry.row}-${entry.message}`}
              >
                <strong>Fila {entry.row}</strong>: {entry.message}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {busy === "import" || busy === "package" ? (
        <output className="catalog-progress" aria-live="polite" data-testid="ui-catalog-progress">
          {busy === "import" ? "Procesando CSV…" : "Leyendo carpeta e imágenes…"}
        </output>
      ) : null}

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

      <div className="catalog-layout">
        <CatalogToolbar
          project={project}
          table={table}
          filteredRows={filteredRows}
          hasProducts={hasProducts}
          selectedIds={selectedIds}
          filter={filterDraft}
          setFilter={setFilterDraft}
          categoryFilterId={categoryFilterId}
          setCategoryFilterId={setCategoryFilterId}
          setPagination={setPagination}
          setSelection={setSelection}
          visibleColumns={columnVisibility}
          onToggleColumn={toggleColumn}
          view={view}
          onViewChange={changeView}
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
        ) : view === "cards" ? (
          <div className="catalog-card-grid" data-testid="ui-catalog-cards">
            {table.getRowModel().rows.map((row) => (
              <CatalogCard
                key={row.id}
                product={row.original}
                image={project.assets.find((asset) => asset.id === row.original.imageIds[0])}
                onEdit={() => setEditor({ mode: "edit", product: structuredClone(row.original) })}
              />
            ))}
          </div>
        ) : (
          <div className="table-shell">
            <table>
              <thead>
                {table.getHeaderGroups().map((headerGroup) => (
                  <tr key={headerGroup.id}>
                    {headerGroup.headers.map((header) => (
                      <th
                        key={header.id}
                        aria-sort={
                          header.column.getIsSorted() === "asc"
                            ? "ascending"
                            : header.column.getIsSorted() === "desc"
                              ? "descending"
                              : undefined
                        }
                      >
                        {header.isPlaceholder ? null : header.column.getCanSort() ? (
                          <button
                            className="table-sort"
                            type="button"
                            onClick={header.column.getToggleSortingHandler()}
                          >
                            {flexRender(header.column.columnDef.header, header.getContext())}
                            {header.column.getIsSorted() === "asc" ? (
                              <ArrowUp aria-hidden size={14} />
                            ) : header.column.getIsSorted() === "desc" ? (
                              <ArrowDown aria-hidden size={14} />
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
                  <CatalogRow
                    key={row.id}
                    row={row}
                    selected={row.getIsSelected()}
                    columnVisibility={columnVisibility}
                  />
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

        {selectedIds.length > 0 ? (
          <section className="bulk-panel bulk-panel--sticky" aria-label="Acciones masivas">
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
                    onChange={(event) =>
                      setPriceKind(event.target.value as "percentage" | "amount")
                    }
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
                    {categoryTree(project).map((category) => (
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
      </div>

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

      {pendingArchiveIds !== null && pendingArchiveIds.length > 0 ? (
        <ConfirmDialog
          title="Archivar productos"
          body={
            pendingArchiveIds.length === 1
              ? "¿Archivar el producto seleccionado?"
              : `¿Archivar los ${pendingArchiveIds.length} productos seleccionados?`
          }
          confirmLabel="Archivar"
          cancelLabel="Cancelar"
          danger
          onConfirm={() => {
            const ids = pendingArchiveIds;
            setPendingArchiveIds(null);
            onCommand({
              type: "products.setStatus",
              productIds: ids,
              status: "archived",
              at: now(),
            });
          }}
          onCancel={() => setPendingArchiveIds(null)}
        />
      ) : null}
    </section>
  );
}
