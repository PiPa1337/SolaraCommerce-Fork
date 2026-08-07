/** Mantiene CSV fuera del hilo del editor cuando el catálogo es grande. */
import {
  type CatalogCsvContext,
  catalogCsvColumns,
  exportCatalogCsv,
  exportProductsCsv,
  importCatalogCsv,
  importProductsCsv,
  parseCatalogCsvRecords,
} from "@solara/core";
import type { Product, StoreProjectV1 } from "@solara/project-schema";

export interface CsvRowError {
  row: number;
  message: string;
}

type CsvRequest =
  | {
      id: string;
      type: "import";
      csv: string;
      context?: CatalogCsvContext;
    }
  | {
      id: string;
      type: "diagnose";
      csv: string;
      context?: CatalogCsvContext;
    }
  | { id: string; type: "export"; products: Product[] }
  | {
      id: string;
      type: "export-commercial";
      project: Pick<StoreProjectV1, "products" | "categories" | "collections">;
    };

const isCommercialCsv = (csv: string): boolean =>
  csv.includes("producto_id,variante_id,slug,titulo");

function encodeCsvCell(value: string): string {
  if (/[",\r\n]/.test(value)) return `"${value.replaceAll('"', '""')}"`;
  return value;
}

/** Reporta los errores de importación por fila sin descartar el resto del archivo. */
function diagnoseCsv(csv: string, context?: CatalogCsvContext): CsvRowError[] {
  const commercial = isCommercialCsv(csv);
  const importAll = () =>
    commercial && context ? importCatalogCsv(csv, context) : importProductsCsv(csv);

  try {
    importAll();
    return [];
  } catch {
    // El importe completo falló; se busca cuáles filas lo causan.
  }

  if (!commercial || !context) {
    return [fullImportError(importAll)];
  }

  let records: ReturnType<typeof parseCatalogCsvRecords>;
  try {
    records = parseCatalogCsvRecords(csv);
  } catch (reason) {
    return [
      {
        row: 1,
        message: reason instanceof Error ? reason.message : "El encabezado del CSV es inválido.",
      },
    ];
  }

  const header = catalogCsvColumns.map(encodeCsvCell).join(",");
  const errors: CsvRowError[] = [];
  records.forEach((record, index) => {
    const row = index + 2;
    const line = catalogCsvColumns.map((column) => encodeCsvCell(record[column])).join(",");
    try {
      importCatalogCsv(`${header}\r\n${line}\r\n`, context);
    } catch (reason) {
      const message =
        reason instanceof Error ? reason.message : "La fila no pudo convertirse en producto.";
      errors.push({ row, message: message.replace(/(?:, fila| en la fila) \d+/g, "").trim() });
    }
  });
  if (errors.length > 0) return errors;
  return [fullImportError(importAll)];
}

function fullImportError(importAll: () => unknown): CsvRowError {
  try {
    importAll();
    return { row: 1, message: "El CSV no pudo importarse." };
  } catch (reason) {
    const message = reason instanceof Error ? reason.message : "No se pudo procesar el CSV.";
    const match = /fila (\d+)/i.exec(message);
    return { row: match ? Number(match[1]) : 1, message };
  }
}

self.onmessage = (event: MessageEvent<CsvRequest>) => {
  try {
    const result =
      event.data.type === "diagnose"
        ? diagnoseCsv(event.data.csv, event.data.context)
        : event.data.type === "import"
          ? event.data.context && isCommercialCsv(event.data.csv)
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
