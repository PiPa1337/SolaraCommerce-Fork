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

/** Divide el CSV en líneas respetando campos entre comillas con saltos internos. */
function splitCsvLines(csv: string): string[] {
  const lines: string[] = [];
  let buffer = "";
  let quoted = false;
  for (let index = 0; index < csv.length; index += 1) {
    const character = csv[index];
    if (character === '"') {
      if (quoted && csv[index + 1] === '"') {
        buffer += '""';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === "\n" && !quoted) {
      lines.push(buffer.replace(/\r$/, ""));
      buffer = "";
    } else {
      buffer += character;
    }
  }
  if (buffer.trim() !== "") lines.push(buffer.replace(/\r$/, ""));
  return lines;
}

interface CsvRowEntry {
  row: number;
  productId: string;
  slug: string;
  variantId: string;
}

/** Devuelve slug y variante de cada fila del archivo con su número de línea. */
function csvRowEntries(csv: string, commercial: boolean): CsvRowEntry[] {
  if (commercial) {
    return parseCatalogCsvRecords(csv).map((record, index) => ({
      row: index + 2,
      productId: record.producto_id || `product-${record.slug}`,
      slug: record.slug,
      variantId: record.variante_id,
    }));
  }
  const lines = splitCsvLines(csv);
  const header = lines[0];
  if (!header) return [];
  const entries: CsvRowEntry[] = [];
  lines.slice(1).forEach((line, index) => {
    if (line.trim() === "") return;
    try {
      const [product] = importProductsCsv(`${header}\r\n${line}`);
      if (!product) return;
      entries.push({
        row: index + 2,
        productId: product.id,
        slug: product.slug,
        variantId: product.variants[0]?.id ?? "",
      });
    } catch {
      // La fila tiene otro error; el diagnóstico principal lo reporta.
    }
  });
  return entries;
}

function formatRowList(rows: number[]): string {
  const sorted = [...new Set(rows)].sort((left, right) => left - right);
  if (sorted.length <= 1) return String(sorted[0] ?? "");
  return `${sorted.slice(0, -1).join(", ")} y ${sorted.at(-1)}`;
}

/**
 * Detecta slugs y variantes repetidos tras el parseo: un CSV que el schema
 * rechazaría con ZodError al reemplazar el catálogo se reporta por fila antes
 * de llegar al dominio, para no tumbar el editor ni perder el historial.
 */
function duplicateRowErrors(csv: string, commercial: boolean): CsvRowError[] {
  let entries: CsvRowEntry[];
  try {
    entries = csvRowEntries(csv, commercial);
  } catch {
    return [];
  }
  const errors: CsvRowError[] = [];
  const bySlug = new Map<string, CsvRowEntry[]>();
  const byVariant = new Map<string, CsvRowEntry[]>();
  for (const entry of entries) {
    const slugGroup = bySlug.get(entry.slug) ?? [];
    slugGroup.push(entry);
    bySlug.set(entry.slug, slugGroup);
    if (entry.variantId === "") continue;
    const variantGroup = byVariant.get(entry.variantId) ?? [];
    variantGroup.push(entry);
    byVariant.set(entry.variantId, variantGroup);
  }
  for (const [slug, group] of bySlug) {
    if (new Set(group.map((entry) => entry.productId)).size < 2) continue;
    const message = `El slug "${slug}" está repetido en las filas ${formatRowList(
      group.map((entry) => entry.row),
    )}.`;
    group.forEach((entry) => {
      errors.push({ row: entry.row, message });
    });
  }
  for (const [variantId, group] of byVariant) {
    if (group.length < 2) continue;
    const message = `La variante "${variantId}" está repetida en las filas ${formatRowList(
      group.map((entry) => entry.row),
    )}.`;
    group.forEach((entry) => {
      errors.push({ row: entry.row, message });
    });
  }
  return errors;
}

/** Importa el CSV y rechaza con error por fila si el archivo repite slugs o variantes. */
function importCsvRejectingDuplicates(csv: string, context?: CatalogCsvContext): Product[] {
  const commercial = isCommercialCsv(csv);
  const products = commercial && context ? importCatalogCsv(csv, context) : importProductsCsv(csv);
  const duplicates = duplicateRowErrors(csv, commercial);
  if (duplicates.length > 0) {
    throw new Error(duplicates.map((entry) => `Fila ${entry.row}: ${entry.message}`).join(" "));
  }
  return products;
}

/** Reporta los errores de importación por fila sin descartar el resto del archivo. */
function diagnoseCsv(csv: string, context?: CatalogCsvContext): CsvRowError[] {
  const commercial = isCommercialCsv(csv);

  try {
    importCsvRejectingDuplicates(csv, context);
    return [];
  } catch {
    // El importe completo falló; se busca cuáles filas lo causan.
  }

  const duplicates = duplicateRowErrors(csv, commercial);
  if (duplicates.length > 0) return duplicates;

  if (!commercial || !context) {
    return [fullImportError(() => importCsvRejectingDuplicates(csv, context))];
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
  return [fullImportError(() => importCsvRejectingDuplicates(csv, context))];
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
          ? importCsvRejectingDuplicates(event.data.csv, event.data.context)
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
