/**
 * Códec JSON acotado en memoria para proyectos grandes.
 *
 * El JSON nativo (`JSON.stringify` / `JSON.parse`) materializa el documento
 * completo como UNA cadena: con proyectos cuyos recursos embebidos superan el
 * límite de cadena de V8 (~536.870.888 caracteres) lanza
 * `RangeError: Invalid string length` y tumba guardado, lectura y auditoría.
 *
 * Este módulo serializa y parsea en trozos acotados:
 * - `writeJsonChunks` produce exactamente el mismo texto que
 *   `JSON.stringify(value, null, 2)`, pieza por pieza.
 * - `parseJsonBytesChunked` decodifica UTF-8 por ventanas y materializa cada
 *   valor JSON individual sin construir nunca la cadena del documento entero.
 *
 * Es JavaScript plano (.mjs) a propósito: el servidor local y el shell
 * Electron lo importan con la versión de Node embebida, sin transformar TS.
 *
 * Limitación documentada: no soporta `toJSON()` ni wrappers (Date, Number);
 * los datos del proyecto son objetos planos validados por Zod.
 * Divergencias aceptadas: TextDecoder descarta BOM (JSON.parse lo rechaza) y
 * el corte de profundidad usa un límite propio en vez del stack real.
 */

const DECODE_WINDOW_CHARS = 4 * 1024 * 1024;
const BUFFER_COMPACT_CHARS = 1024 * 1024;
const MAX_JSON_DEPTH = 2000;

/**
 * @param {unknown} value
 * @param {(chunk: string) => void} push
 * @param {string | number | null} [indent]
 * @returns {void}
 */
export function writeJsonChunks(value, push, indent = 2) {
  const padding =
    typeof indent === "number"
      ? " ".repeat(Math.max(0, Math.min(indent, 10)))
      : indent === undefined || indent === null
        ? ""
        : String(indent).slice(0, 10);
  writeValue(value, push, padding, 0);
}

/**
 * @param {string} padding
 * @param {number} depth
 * @param {(chunk: string) => void} push
 * @returns {void}
 */
function newLine(padding, depth, push) {
  if (padding) push(`\n${padding.repeat(depth)}`);
}

/**
 * @param {unknown} value
 * @param {(chunk: string) => void} push
 * @param {string} padding
 * @param {number} depth
 * @returns {void}
 */
function writeValue(value, push, padding, depth) {
  if (depth > MAX_JSON_DEPTH) {
    throw new RangeError("Se superó la profundidad máxima al serializar JSON.");
  }
  if (value === null) {
    push("null");
    return;
  }
  switch (typeof value) {
    case "string":
    case "number":
      // JSON.stringify por valor individual: cada cadena acotada, escapes fieles.
      push(JSON.stringify(value));
      return;
    case "boolean":
      push(value ? "true" : "false");
      return;
    case "bigint":
      throw new TypeError("No se puede serializar BigInt como JSON.");
    case "object": {
      if (Array.isArray(value)) {
        if (value.length === 0) {
          push("[]");
          return;
        }
        push("[");
        const itemDepth = depth + 1;
        for (let index = 0; index < value.length; index += 1) {
          if (index > 0) push(",");
          newLine(padding, itemDepth, push);
          const item = value[index];
          // JSON.stringify convierte undefined, funciones y symbols a null
          // dentro de arrays (a diferencia de los objetos, donde los omite).
          if (item === undefined || typeof item === "function" || typeof item === "symbol") {
            push("null");
          } else {
            writeValue(item, push, padding, itemDepth);
          }
        }
        newLine(padding, depth, push);
        push("]");
        return;
      }
      const entries = Object.entries(/** @type {Record<string, unknown>} */ (value)).filter(
        (entry) => {
          const item = entry[1];
          if (item === undefined) return false;
          const kind = typeof item;
          return kind !== "function" && kind !== "symbol";
        },
      );
      if (entries.length === 0) {
        push("{}");
        return;
      }
      push("{");
      const entryDepth = depth + 1;
      for (let index = 0; index < entries.length; index += 1) {
        const entry = entries[index];
        if (index > 0) push(",");
        newLine(padding, entryDepth, push);
        push(`${JSON.stringify(entry[0])}:`);
        if (padding) push(" ");
        writeValue(entry[1], push, padding, entryDepth);
      }
      newLine(padding, depth, push);
      push("}");
      return;
    }
    default:
      // function / symbol en la raíz: JSON.stringify devuelve undefined.
      push("undefined");
  }
}

/**
 * Serializa a bytes UTF-8 sin construir el documento como cadena única.
 *
 * @param {unknown} value
 * @param {string | number | null} [indent]
 * @returns {Uint8Array}
 */
export function stringifyJsonToBytes(value, indent = 2) {
  const chunks = [];
  writeJsonChunks(value, (chunk) => chunks.push(chunk), indent);
  const encoder = new TextEncoder();
  const encoded = chunks.map((chunk) => encoder.encode(chunk));
  let total = 0;
  for (const part of encoded) total += part.byteLength;
  const output = new Uint8Array(total);
  let offset = 0;
  for (const part of encoded) {
    output.set(part, offset);
    offset += part.byteLength;
  }
  return output;
}

/**
 * Lector de bytes UTF-8 con ventana de decodificación acotada. Todas las
 * operaciones de texto (`peek`, `slice`) son relativas a la posición actual.
 *
 * @param {Uint8Array} bytes
 * @returns {{
 *   available(): number;
 *   peek(offset?: number): string | undefined;
 *   advance(count: number): void;
 *   reserve(count: number): void;
 *   slice(start: number, end: number): string;
 *   compact(): void;
 *   consumedBytes(): number;
 * }}
 */
function createByteReader(bytes) {
  const decoder = new TextDecoder("utf-8");
  let buffer = "";
  let position = 0;
  let nextOffset = 0;

  /**
   * @param {number} count
   * @returns {void}
   */
  function reserve(count) {
    while (buffer.length - position < count && nextOffset < bytes.length) {
      const end = Math.min(nextOffset + DECODE_WINDOW_CHARS * 2, bytes.length);
      buffer += decoder.decode(bytes.subarray(nextOffset, end), { stream: true });
      nextOffset = end;
    }
  }

  return {
    available: () => buffer.length - position,
    /**
     * @param {number} [offset]
     * @returns {string | undefined}
     */
    peek(offset = 0) {
      reserve(offset + 1);
      return buffer[position + offset];
    },
    /**
     * @param {number} count
     * @returns {void}
     */
    advance(count) {
      position += count;
    },
    reserve,
    /**
     * Relativo a la posición de lectura, igual que peek/advance.
     *
     * @param {number} start
     * @param {number} end
     * @returns {string}
     */
    slice(start, end) {
      return buffer.slice(position + start, position + end);
    },
    /**
     * @returns {void}
     */
    compact() {
      if (position >= BUFFER_COMPACT_CHARS) {
        buffer = buffer.slice(position);
        position = 0;
      }
    },
    consumedBytes: () => nextOffset,
  };
}

/**
 * Parse de JSON en bytes sin materializar el documento como cadena única.
 *
 * @param {Uint8Array} bytes
 * @returns {unknown}
 */
export function parseJsonBytesChunked(bytes) {
  const reader = createByteReader(bytes);
  let depth = 0;

  /**
   * @returns {void}
   */
  function skipWhitespace() {
    for (;;) {
      const char = reader.peek();
      if (char === " " || char === "\t" || char === "\n" || char === "\r") {
        reader.advance(1);
        reader.compact();
        continue;
      }
      return;
    }
  }

  /**
   * @param {string} message
   * @returns {never}
   */
  function fail(message) {
    throw new SyntaxError(`${message} (byte ~${reader.consumedBytes()})`);
  }

  /**
   * El caller verificó que el primer carácter es `"` y lo consumió.
   *
   * @returns {string}
   */
  function readString() {
    if (reader.peek() !== "\\") {
      let cursor = 0;
      for (;;) {
        const char = reader.peek(cursor);
        if (char === undefined) fail("JSON incompleto: falta cerrar una cadena");
        if (char === '"') {
          const value = reader.slice(0, cursor);
          reader.advance(cursor + 1);
          return value;
        }
        if (char === "\\") {
          return readStringSlow(0, cursor);
        }
        // Caracteres de control crudos son inválidos en JSON.
        if (char < " ") fail("Carácter de control sin escapar dentro de una cadena");
        cursor += 1;
      }
    }
    return readStringSlow(0, 0);
  }

  /**
   * Lectura con escapes: acumula segmentos literales y resuelve `\/bfnrt` y
   * `\uXXXX`. Los pares suplentes se conservan tal cual (semántica
   * JSON.parse: un `\uD800` suelto produce el suplente solo).
   *
   * @param {number} literalStart
   * @param {number} literalLength
   * @returns {string}
   */
  function readStringSlow(literalStart, literalLength) {
    const pieces = [];
    if (literalLength > 0) pieces.push(reader.slice(literalStart, literalStart + literalLength));
    reader.advance(literalLength);
    for (;;) {
      const char = reader.peek();
      if (char === undefined) fail("JSON incompleto: falta cerrar una cadena");
      if (char === '"') {
        reader.advance(1);
        return pieces.join("");
      }
      if (char === "\\") {
        reader.advance(1);
        const marker = reader.peek();
        reader.advance(1);
        switch (marker) {
          case '"':
            pieces.push('"');
            break;
          case "\\":
            pieces.push("\\");
            break;
          case "/":
            pieces.push("/");
            break;
          case "b":
            pieces.push("\b");
            break;
          case "f":
            pieces.push("\f");
            break;
          case "n":
            pieces.push("\n");
            break;
          case "r":
            pieces.push("\r");
            break;
          case "t":
            pieces.push("\t");
            break;
          case "u": {
            reader.reserve(4);
            const hex = reader.slice(0, 4);
            if (hex.length < 4 || !/^[0-9a-fA-F]{4}$/.test(hex)) {
              fail("Escape \\u inválido");
            }
            reader.advance(4);
            pieces.push(String.fromCharCode(Number.parseInt(hex, 16)));
            break;
          }
          default:
            fail("Escape inválido dentro de una cadena");
        }
        reader.compact();
        continue;
      }
      if (char < " ") fail("Carácter de control sin escapar dentro de una cadena");
      // Segmento literal contiguo: se copia en bloque hasta el próximo `\`
      // o `"` para no iterar carácter por carácter los payloads grandes.
      let cursor = 1;
      for (;;) {
        const next = reader.peek(cursor);
        if (next === undefined || next === '"' || next === "\\" || next < " ") break;
        cursor += 1;
      }
      pieces.push(reader.slice(0, cursor));
      reader.advance(cursor);
      reader.compact();
    }
  }

  /**
   * @returns {number}
   */
  function readNumber() {
    reader.reserve(64);
    let cursor = 0;
    /**
     * @param {string} match
     * @returns {boolean}
     */
    const take = (match) => {
      if (reader.peek(cursor) === match) {
        cursor += 1;
        return true;
      }
      return false;
    };
    take("-");
    const first = reader.peek(cursor);
    if (first === undefined || first < "0" || first > "9") fail("Número inválido");
    if (first === "0") {
      cursor += 1;
    } else {
      while (/[0-9]/.test(reader.peek(cursor) ?? "")) cursor += 1;
    }
    if (take(".")) {
      if (!/[0-9]/.test(reader.peek(cursor) ?? "")) fail("Número inválido: falta el decimal");
      while (/[0-9]/.test(reader.peek(cursor) ?? "")) cursor += 1;
    }
    const exponent = reader.peek(cursor);
    if (exponent === "e" || exponent === "E") {
      cursor += 1;
      const sign = reader.peek(cursor);
      if (sign === "+" || sign === "-") cursor += 1;
      if (!/[0-9]/.test(reader.peek(cursor) ?? "")) fail("Número inválido: exponente sin dígitos");
      while (/[0-9]/.test(reader.peek(cursor) ?? "")) cursor += 1;
    }
    const text = reader.slice(0, cursor);
    reader.advance(cursor);
    return Number(text);
  }

  /**
   * @param {string} word
   * @returns {void}
   */
  function readLiteral(word) {
    reader.reserve(word.length);
    if (reader.slice(0, word.length) !== word) fail(`Literal inválido, se esperaba "${word}"`);
    reader.advance(word.length);
  }

  /**
   * @returns {unknown}
   */
  function readValue() {
    depth += 1;
    if (depth > MAX_JSON_DEPTH) fail("Se superó la profundidad máxima de anidación JSON");
    try {
      skipWhitespace();
      const char = reader.peek();
      if (char === undefined) fail("JSON incompleto: no se encontró un valor");
      switch (char) {
        case "{":
          return readObject();
        case "[":
          return readArray();
        case '"':
          reader.advance(1);
          return readString();
        case "t":
          readLiteral("true");
          return true;
        case "f":
          readLiteral("false");
          return false;
        case "n":
          readLiteral("null");
          return null;
        case "-":
        case "0":
        case "1":
        case "2":
        case "3":
        case "4":
        case "5":
        case "6":
        case "7":
        case "8":
        case "9":
          return readNumber();
        default:
          fail("Token inesperado al leer un valor JSON");
      }
    } finally {
      depth -= 1;
    }
  }

  /**
   * @returns {Record<string, unknown>}
   */
  function readObject() {
    reader.advance(1); // `{`
    const result = {};
    skipWhitespace();
    if (reader.peek() === "}") {
      reader.advance(1);
      return result;
    }
    for (;;) {
      skipWhitespace();
      if (reader.peek() !== '"') fail("Se esperaba una clave de objeto");
      reader.advance(1);
      const key = readString();
      skipWhitespace();
      if (reader.peek() !== ":") fail("Se esperaba ':' después de la clave");
      reader.advance(1);
      result[key] = readValue();
      skipWhitespace();
      const separator = reader.peek();
      if (separator === ",") {
        reader.advance(1);
        continue;
      }
      if (separator === "}") {
        reader.advance(1);
        return result;
      }
      fail("Se esperaba ',' o '}' en un objeto");
    }
  }

  /**
   * @returns {unknown[]}
   */
  function readArray() {
    reader.advance(1); // `[`
    const result = [];
    skipWhitespace();
    if (reader.peek() === "]") {
      reader.advance(1);
      return result;
    }
    for (;;) {
      result.push(readValue());
      skipWhitespace();
      const separator = reader.peek();
      if (separator === ",") {
        reader.advance(1);
        continue;
      }
      if (separator === "]") {
        reader.advance(1);
        return result;
      }
      fail("Se esperaba ',' o ']' en un array");
    }
  }

  const value = readValue();
  skipWhitespace();
  if (reader.peek() !== undefined) fail("Datos inesperados después del valor JSON raíz");
  return value;
}
