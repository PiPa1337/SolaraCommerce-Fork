import { beforeAll, describe, expect, it } from "vitest";

interface SentCsv {
  id: string;
  ok: boolean;
  result?: unknown;
  error?: string;
}

interface WorkerStub {
  onmessage: ((event: { data: unknown }) => void) | undefined;
  postMessage: (message: unknown, transfer?: Transferable[]) => void;
}

let send: (data: unknown) => SentCsv | undefined;

beforeAll(async () => {
  const stub: WorkerStub = {
    onmessage: undefined,
    postMessage: () => undefined,
  };
  (globalThis as Record<string, unknown>).self = stub;
  // El worker no exporta nada; se carga por efecto y se usa su onmessage.
  await import("./csv.worker");
  if (!stub.onmessage) throw new Error("El worker no registró onmessage.");
  const handler = stub.onmessage;
  send = (data) => {
    let response: SentCsv | undefined;
    stub.postMessage = (message) => {
      response = message as SentCsv;
    };
    handler({ data });
    return response;
  };
});

const header =
  "producto_id,variante_id,slug,titulo,descripcion,marca,estado,categorias,colecciones,etiquetas,imagenes,variante,sku,opciones,precio_centavos,precio_anterior_centavos,disponible,estado_stock,gtin,mpn,imagen_variante,creado_en,actualizado_en";

const productsHeader =
  "product_id,slug,title,description,rich_description,status,brand,category_ids,collection_ids,tags,image_ids,variant_id,variant_title,sku,option_values,price_cents,compare_at_price_cents,available,stock_status,gtin,mpn,variant_image_id,created_at,updated_at";

const fecha = "2026-08-07T10:00:00.000Z";

function row(values: string[]): string {
  return values.join(",");
}

const context = { categories: [], collections: [], assets: [] };

function filaComercial(
  productoId: string,
  varianteId: string,
  slug: string,
  titulo: string,
  marca: string,
): string[] {
  return [
    productoId,
    varianteId,
    slug,
    titulo,
    "",
    marca,
    "active",
    "",
    "",
    "",
    "",
    "Única",
    `${slug}-sku`,
    "",
    "125000",
    "",
    "true",
    "in_stock",
    "",
    "",
    "",
    fecha,
    fecha,
  ];
}

describe("CSV con slugs duplicados", () => {
  const csv = [
    header,
    row(filaComercial("p-1", "v-1", "taza-buena", "Taza buena", "Marca A")),
    row(filaComercial("p-2", "v-2", "taza-buena", "Taza buena", "Marca B")),
  ].join("\r\n");

  it("rechaza el importe con error y sin productos (sin dispatch)", () => {
    const response = send({ id: "1", type: "import", csv, context });
    expect(response?.ok).toBe(false);
    expect(response?.error).toContain("taza-buena");
    expect(response?.result).toBeUndefined();
  });

  it("diagnostica el conflicto por fila", () => {
    const response = send({ id: "2", type: "diagnose", csv, context });
    expect(response?.ok).toBe(true);
    const errors = response?.result as Array<{ row: number; message: string }>;
    expect(errors).toHaveLength(2);
    expect(errors.map((entry) => entry.row).sort()).toEqual([2, 3]);
    expect(errors[0]?.message).toContain("taza-buena");
    expect(errors[0]?.message).toContain("filas 2 y 3");
  });
});

describe("CSV con variantes duplicadas", () => {
  const csv = [
    header,
    row(filaComercial("p-3", "v-3", "taza-tres", "Taza tres", "Marca C")),
    row(filaComercial("p-3", "v-3", "taza-tres", "Taza tres", "Marca C")),
  ].join("\r\n");

  it("diagnostica el conflicto por fila", () => {
    const response = send({ id: "3", type: "diagnose", csv, context });
    expect(response?.ok).toBe(true);
    const errors = response?.result as Array<{ row: number; message: string }>;
    expect(errors).toHaveLength(2);
    expect(errors.map((entry) => entry.row).sort()).toEqual([2, 3]);
    expect(errors[0]?.message).toContain("v-3");
  });
});

describe("CSV válido con variantes de un mismo producto", () => {
  const csv = [
    header,
    row(filaComercial("p-4", "v-4", "taza-cuatro", "Taza cuatro", "Marca D")),
    row(filaComercial("p-4", "v-5", "taza-cuatro", "Taza cuatro", "Marca D")),
  ].join("\r\n");

  it("importa sin errores", () => {
    const response = send({ id: "4", type: "import", csv, context });
    expect(response?.ok).toBe(true);
    const products = response?.result as Array<{
      id: string;
      slug: string;
      variants: unknown[];
    }>;
    expect(products).toHaveLength(1);
    expect(products[0]?.variants).toHaveLength(2);
  });
});

describe("CSV de productos (formato simple) con slugs duplicados", () => {
  const csv = [
    productsHeader,
    row([
      "p-1",
      "taza-azul",
      "Taza azul",
      "Desc",
      "",
      "active",
      "",
      "[]",
      "[]",
      "[]",
      "[]",
      "v-1",
      "Única",
      "SKU-1",
      "{}",
      "12500",
      "",
      "true",
      "in_stock",
      "",
      "",
      "",
      fecha,
      fecha,
    ]),
    row([
      "p-2",
      "taza-azul",
      "Taza azul",
      "Desc",
      "",
      "active",
      "",
      "[]",
      "[]",
      "[]",
      "[]",
      "v-2",
      "Única",
      "SKU-2",
      "{}",
      "12500",
      "",
      "true",
      "in_stock",
      "",
      "",
      "",
      fecha,
      fecha,
    ]),
  ].join("\r\n");

  it("diagnostica el conflicto por fila", () => {
    const response = send({ id: "5", type: "diagnose", csv });
    expect(response?.ok).toBe(true);
    const errors = response?.result as Array<{ row: number; message: string }>;
    expect(errors.map((entry) => entry.row).sort()).toEqual([2, 3]);
    expect(errors[0]?.message).toContain("taza-azul");
  });
});
