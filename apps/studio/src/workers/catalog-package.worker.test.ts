import { beforeAll, describe, expect, it } from "vitest";

interface SentPackage {
  id: string;
  ok: boolean;
  result?: { csv: string; images: Array<{ path: string; type: string; buffer: ArrayBuffer }> };
  error?: string;
}

interface WorkerStub {
  onmessage: ((event: { data: unknown }) => void) | undefined;
  postMessage: (message: unknown, transfer?: Transferable[]) => void;
}

let send: (data: unknown) => SentPackage | undefined;
let lastTransfer: () => Transferable[] | undefined;

function payload(
  path: string,
  bytes: Uint8Array | string,
  type = "",
): { path: string; type: string; buffer: ArrayBuffer } {
  const data = typeof bytes === "string" ? new TextEncoder().encode(bytes) : bytes;
  return { path, type, buffer: data.buffer as ArrayBuffer };
}

function request(files: Array<{ path: string; type: string; buffer: ArrayBuffer }>): unknown {
  return { id: "1", type: "catalog-package", files };
}

function withFiles(
  ...files: Array<{ path: string; type: string; buffer: ArrayBuffer }>
): SentPackage {
  const response = send(request(files));
  if (!response) throw new Error("El worker no respondió.");
  return response;
}

function bytes(...values: number[]): Uint8Array {
  return Uint8Array.from(values);
}

function throwOnError(response: SentPackage): SentPackage & { ok: true } {
  expect(response.ok, response.error).toBe(true);
  return response as SentPackage & { ok: true };
}

beforeAll(async () => {
  const stub: WorkerStub = {
    onmessage: undefined,
    postMessage: () => undefined,
  };
  (globalThis as Record<string, unknown>).self = stub;
  // El worker no exporta nada; se carga por efecto y se usa su onmessage.
  // @ts-expect-error: archivo de worker sin exports (script, no módulo).
  await import("./catalog-package.worker");
  if (!stub.onmessage) throw new Error("El worker no registró onmessage.");
  const handler = stub.onmessage;
  let capturedTransfer: Transferable[] | undefined;
  send = (data) => {
    let response: SentPackage | undefined;
    stub.postMessage = (message, transfer) => {
      response = message as SentPackage;
      capturedTransfer = transfer;
    };
    handler({ data });
    return response;
  };
  lastTransfer = () => capturedTransfer;
});

describe("carpeta comercial", () => {
  it("lee productos.csv e imágenes normalizando rutas", () => {
    const response = throwOnError(
      withFiles(
        payload("./productos.csv", "producto_id,variante_id,slug\r\n,,taza\n"),
        payload("imagenes\\taza.png", bytes(0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0)),
        payload("imagenes/foto.jpg", bytes(0xff, 0xd8, 0xff)),
        payload("imagenes/foto.webp", bytes(0x52, 0x49, 0x46, 0x46)),
      ),
    );
    expect(response.result?.csv).toBe("producto_id,variante_id,slug\r\n,,taza\n");
    expect(response.result?.images).toEqual([
      { path: "imagenes/taza.png", type: "image/png", buffer: expect.any(ArrayBuffer) },
      { path: "imagenes/foto.jpg", type: "image/jpeg", buffer: expect.any(ArrayBuffer) },
      { path: "imagenes/foto.webp", type: "image/webp", buffer: expect.any(ArrayBuffer) },
    ]);
    expect(lastTransfer()).toHaveLength(3);
  });

  it("acepta catalogo.csv como alternativa", () => {
    const response = throwOnError(withFiles(payload("catalogo.csv", "producto_id\r\n")));
    expect(response.result?.csv).toBe("producto_id\r\n");
  });

  it("rechaza una lista sin archivos", () => {
    const response = send({ id: "1", type: "catalog-package", files: "no-es-lista" });
    expect(response?.ok).toBe(false);
    expect(response?.error).toBe("La carpeta no contiene archivos.");
  });

  it("rechaza carpetas sin productos.csv", () => {
    expect(withFiles(payload("imagenes/taza.png", bytes(0))).error).toBe(
      "La carpeta debe contener productos.csv.",
    );
  });

  it("rechaza archivos no compatibles dentro de imagenes/", () => {
    expect(
      withFiles(payload("productos.csv", ""), payload("imagenes/nota.txt", "texto")).error,
    ).toBe("La carpeta contiene archivos no compatibles dentro de imagenes/.");
  });

  it("ignora archivos fuera de imagenes/", () => {
    const response = throwOnError(
      withFiles(payload("productos.csv", ""), payload("leeme.txt", "texto")),
    );
    expect(response.result?.images).toEqual([]);
  });

  it("rechaza rutas inseguras", () => {
    expect(withFiles(payload("productos.csv", ""), payload("../fuera.txt", "texto")).error).toBe(
      "La carpeta contiene una ruta de archivo insegura.",
    );
    expect(withFiles(payload("productos.csv", ""), payload("/absoluta.txt", "texto")).error).toBe(
      "La carpeta contiene una ruta de archivo insegura.",
    );
    expect(withFiles(payload("productos.csv", ""), payload("C:/ventana.txt", "texto")).error).toBe(
      "La carpeta contiene una ruta de archivo insegura.",
    );
  });

  it("rechaza más de 500 imágenes", () => {
    const files = [payload("productos.csv", "")];
    for (let index = 0; index < 501; index += 1) {
      files.push(payload(`imagenes/archivo-${index}.png`, bytes(0)));
    }
    expect(withFiles(...files).error).toBe("La carpeta supera el máximo de 500 imágenes.");
  });

  it("rechaza una imagen mayor a 20 MB", () => {
    const big = new ArrayBuffer(20 * 1024 * 1024 + 1);
    expect(
      withFiles(payload("productos.csv", ""), {
        path: "imagenes/grande.png",
        type: "image/png",
        buffer: big,
      }).error,
    ).toBe("Una imagen de la carpeta supera el límite de 20 MB.");
  });

  it("rechaza entradas que superan 250 MB en total", () => {
    const heavy = new ArrayBuffer(251 * 1024 * 1024);
    expect(withFiles({ path: "productos.csv", type: "text/csv", buffer: heavy }).error).toBe(
      "La carpeta supera el máximo de 250 MB.",
    );
  });
});
