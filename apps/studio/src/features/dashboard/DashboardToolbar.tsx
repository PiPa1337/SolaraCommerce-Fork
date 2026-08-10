import { Funnel, GridFour, List, MagnifyingGlass, SortAscending, X } from "@phosphor-icons/react";
import type { RefObject } from "react";
import { IconButton } from "../../components/Ui";
import type { DashboardSort, DashboardStatusFilter } from "../../lib/dashboardModel";

const statusLabels: Record<DashboardStatusFilter, string> = {
  all: "Todas",
  active: "Activas",
  archived: "Archivadas",
};

export interface DashboardToolbarProps {
  query: string;
  statusFilter: DashboardStatusFilter;
  sort: DashboardSort;
  view: "grid" | "list";
  searchRef: RefObject<HTMLInputElement | null>;
  onQueryChange(query: string): void;
  onStatusFilterChange(filter: DashboardStatusFilter): void;
  onSortChange(sort: DashboardSort): void;
  onViewChange(view: "grid" | "list"): void;
}

export function DashboardToolbar({
  query,
  statusFilter,
  sort,
  view,
  searchRef,
  onQueryChange,
  onStatusFilterChange,
  onSortChange,
  onViewChange,
}: DashboardToolbarProps) {
  return (
    <div className="dashboard-cosmic-toolbar">
      <label className="dashboard-cosmic-search">
        <MagnifyingGlass aria-hidden size={18} />
        <span className="visually-hidden">Buscar tienda</span>
        <input
          ref={searchRef}
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Buscar tienda..."
          aria-label="Buscar tienda"
          title="Atajo: /"
          type="search"
        />
        {query ? (
          <IconButton
            icon={X}
            label="Limpiar búsqueda"
            onClick={() => {
              onQueryChange("");
              requestAnimationFrame(() => searchRef.current?.focus());
            }}
          />
        ) : null}
      </label>
      <label className="dashboard-cosmic-select">
        <Funnel aria-hidden size={16} />
        <span className="visually-hidden">Estado</span>
        <select
          value={statusFilter}
          onChange={(event) => onStatusFilterChange(event.target.value as DashboardStatusFilter)}
        >
          {(Object.keys(statusLabels) as DashboardStatusFilter[]).map((status) => (
            <option key={status} value={status}>
              Estado: {statusLabels[status]}
            </option>
          ))}
        </select>
      </label>
      <label className="dashboard-cosmic-select">
        <SortAscending aria-hidden size={16} />
        <span className="visually-hidden">Ordenar</span>
        <select
          value={sort}
          onChange={(event) => onSortChange(event.target.value as DashboardSort)}
        >
          <option value="updated">Última modificación</option>
          <option value="name">Nombre A-Z</option>
          <option value="products">Más productos</option>
        </select>
      </label>
      <fieldset className="dashboard-cosmic-view-toggle">
        <legend className="visually-hidden">Vista de proyectos</legend>
        <IconButton
          icon={GridFour}
          label="Vista en grilla"
          aria-pressed={view === "grid"}
          onClick={() => onViewChange("grid")}
        />
        <IconButton
          icon={List}
          label="Vista en lista"
          aria-pressed={view === "list"}
          onClick={() => onViewChange("list")}
        />
      </fieldset>
    </div>
  );
}
