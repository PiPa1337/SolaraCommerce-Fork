import {
  type CatalogCsvContext,
  exportCatalogCsv,
  exportProductsCsv,
  importCatalogCsv,
  importProductsCsv,
} from "@solara/core";
import type { Product, StoreProjectV1 } from "@solara/project-schema";

type CsvRequest =
  | {
      id: string;
      type: "import";
      csv: string;
      context?: CatalogCsvContext;
    }
  | { id: string; type: "export"; products: Product[] }
  | {
      id: string;
      type: "export-commercial";
      project: Pick<StoreProjectV1, "products" | "categories" | "collections">;
    };

self.onmessage = (event: MessageEvent<CsvRequest>) => {
  try {
    const result =
      event.data.type === "import"
        ? event.data.context && event.data.csv.includes("producto_id,variante_id,slug,titulo")
          ? importCatalogCsv(event.data.csv, event.data.context)
          : importProductsCsv(event.data.csv)
        : event.data.type === "export-commercial"
          ? exportCatalogCsv(event.data.project)
          : exportProductsCsv(event.data.products);
    self.postMessage({ id: event.data.id, ok: true, result });
  } catch (error) {
    self.postMessage({
      id: event.data.id,
      ok: false,
      error: error instanceof Error ? error.message : "No se pudo procesar el CSV.",
    });
  }
};
