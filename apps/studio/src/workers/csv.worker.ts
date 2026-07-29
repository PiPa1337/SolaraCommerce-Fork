import { exportProductsCsv, importProductsCsv } from "@solara/core";
import type { Product } from "@solara/project-schema";

type CsvRequest =
  | { id: string; type: "import"; csv: string }
  | { id: string; type: "export"; products: Product[] };

self.onmessage = (event: MessageEvent<CsvRequest>) => {
  try {
    const result =
      event.data.type === "import"
        ? importProductsCsv(event.data.csv)
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
