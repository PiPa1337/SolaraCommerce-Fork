/**
 * Tests diferenciales: el códec acotado debe producir exactamente el mismo
 * texto que `JSON.stringify(value, null, 2)` y parsear exactamente igual que
 * `JSON.parse`. La razón de existir es el límite de cadena de V8
 * (~536.870.888 caracteres) que tumba guardado/lectura de proyectos con
 * recursos embebidos enormes.
 */
import { catalogModernStore } from "@solara/project-schema/catalog-modern-fixture";
import { describe, expect, it } from "vitest";
import { parseJsonBytesChunked, stringifyJsonToBytes, writeJsonChunks } from "./json-stream.mjs";

function writeToString(value: unknown, indent: string | number | null = 2): string {
  const chunks: string[] = [];
  writeJsonChunks(value, (chunk) => chunks.push(chunk), indent);
  return chunks.join("");
}

describe("writeJsonChunks", () => {
  const corpus: Array<{ name: string; value: unknown }> = [
    { name: "objeto anidado", value: { a: 1, b: { c: [1, 2, { d: "x" }] }, e: null, f: true } },
    { name: "array con anidados", value: [1, "dos", [3, { cuatro: 4 }], null, false] },
    {
      name: "escapes",
      value: { texto: 'con "comillas", \\barra\\, \n salto, \t tab, ─ unicode ☂' },
    },
    { name: "números", value: [0, -0, 1.5, -12.75, 1e21, 1e-7, 123456.789, -3] },
    { name: "contenedores vacíos", value: { obj: {}, arr: [], nested: { deep: [[], {}] } } },
    { name: "propiedades undefined", value: { a: undefined, b: 2, c: [undefined, 1] } },
    { name: "claves raras", value: { "": 1, "con espacio": 2, 'con"comilla': 3, "0": 4, "☃": 5 } },
    { name: "strings control", value: "\u0000\u0001\u001f\u007f áéíóú" },
    { name: "suplentes", value: "😀𠜎" },
    { name: "raíz scalar", value: 42 },
    { name: "raíz string", value: "hola" },
    { name: "raíz null", value: null },
  ];

  for (const entry of corpus) {
    it(`coincide con JSON.stringify: ${entry.name}`, () => {
      expect(writeToString(entry.value)).toBe(JSON.stringify(entry.value, null, 2));
      expect(writeToString(entry.value, null)).toBe(JSON.stringify(entry.value));
      expect(writeToString(entry.value, 0)).toBe(JSON.stringify(entry.value, null, 0));
    });
  }

  it("serializa la fixture completa igual que el JSON nativo", () => {
    expect(writeToString(catalogModernStore)).toBe(JSON.stringify(catalogModernStore, null, 2));
  });

  it("rechaza BigInt como JSON.stringify", () => {
    expect(() => writeToString({ a: 1n })).toThrow(TypeError);
  });

  it("stringifyJsonToBytes produce UTF-8 equivalente", () => {
    const bytes = stringifyJsonToBytes({ texto: "áéíóú ☂", n: 3 });
    expect(new TextDecoder().decode(bytes)).toBe(
      JSON.stringify({ texto: "áéíóú ☂", n: 3 }, null, 2),
    );
  });
});

describe("parseJsonBytesChunked", () => {
  const corpus: Array<{ name: string; value: unknown }> = [
    { name: "objeto anidado", value: { a: 1, b: { c: [1, 2, { d: "x" }] }, e: null, f: true } },
    { name: "escapes completos", value: 'con "comillas", \\barra\\, \b\f\n\r\t, ☂, 😀' },
    { name: "escapes unicode", value: "á\u00e9\u00EDc\u0000\u001f" },
    { name: "números", value: [0, -0, 1.5, -12.75, 1e21, 1e-7, 3, -3, 1.5e300] },
    { name: "claves duplicadas", value: JSON.parse('{"a":1,"a":2}') },
    { name: "claves raras", value: JSON.parse('{"":1,"con espacio":2,"con\\"comilla":3}') },
    { name: "espacios varios", value: JSON.parse('  {\t"a" : [ 1 ,\r\n2 ] }\n ') },
    { name: "suplentes", value: "😀𠜎" },
  ];

  for (const entry of corpus) {
    it(`coincide con JSON.parse: ${entry.name}`, () => {
      const text = JSON.stringify(entry.value);
      const parsed = parseJsonBytesChunked(new TextEncoder().encode(text));
      // El punto de referencia es JSON.parse del mismo texto (valores como -0
      // no sobreviven a su propia serialización).
      expect(parsed).toEqual(JSON.parse(text));
    });
  }

  it("parsea la fixture completa desde bytes", () => {
    const bytes = stringifyJsonToBytes(catalogModernStore);
    expect(parseJsonBytesChunked(bytes)).toEqual(catalogModernStore);
  });

  it("rechaza entrada corrupta como JSON.parse", () => {
    const cases = [
      "",
      "{",
      "[1,",
      '{"a"}',
      '{"a":}',
      "[1 2]",
      '"sin cerrar',
      "tru",
      "01x",
      '{"a":1}x',
    ];
    for (const text of cases) {
      expect(() => parseJsonBytesChunked(new TextEncoder().encode(text)), text).toThrow();
    }
  });

  it("rechaza caracteres de control crudos en cadenas", () => {
    expect(() => parseJsonBytesChunked(new TextEncoder().encode('"a\nb"'))).toThrow();
  });

  it("soporta varios trozos de decodificación con multibyte en el borde", () => {
    const text = JSON.stringify({ texto: "áéíóú☂😀".repeat(4000), n: 1 });
    const bytes = new TextEncoder().encode(text);
    const parsed = parseJsonBytesChunked(bytes);
    expect(parsed).toEqual(JSON.parse(text));
  });

  it("serializa y parsea un proyecto que supera el límite de cadena de V8", () => {
    const payload = "A".repeat(1_000_000);
    const source = `data:image/png;base64,${payload}`;
    const assets = Array.from({ length: 560 }, (_, index) => ({
      kind: "image",
      id: `asset-oversize-${index}`,
      source,
      fallbackSource: source,
      responsiveSources: [
        { width: 480, source },
        { width: 1800, source },
      ],
    }));
    const envelope = { format: "solara-project", version: 2, projectId: "store-x", assets };

    const bytes = stringifyJsonToBytes(envelope);
    expect(bytes.byteLength).toBeGreaterThan(536_870_888);

    const parsed = parseJsonBytesChunked(bytes) as typeof envelope;
    expect(parsed.projectId).toBe("store-x");
    expect(parsed.assets).toHaveLength(560);
    expect(parsed.assets[559]?.source).toBe(source);
  }, 600_000);
});
