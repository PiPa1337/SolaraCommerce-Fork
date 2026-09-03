/**
 * Declaraciones del códec JSON acotado (implementación en json-stream.mjs).
 * Con proyectos cuyos recursos embebidos superan el límite de cadena de V8
 * (~536.870.888 caracteres), JSON.stringify/JSON.parse del documento entero
 * lanza `RangeError: Invalid string length`. Estas funciones trabajan por
 * trozos: `writeJsonChunks` produce exactamente el texto de
 * `JSON.stringify(value, null, 2)` y `parseJsonBytesChunked` es equivalente a
 * `JSON.parse` sobre los bytes decodificados.
 */

/**
 * @param indent Igual que el tercer parámetro de JSON.stringify:
 *   `2` (default) produce pretty-print de 2 espacios; `null` produce compacto.
 */
export declare function writeJsonChunks(
  value: unknown,
  push: (chunk: string) => void,
  indent?: string | number | null,
): void;

export declare function stringifyJsonToBytes(
  value: unknown,
  indent?: string | number | null,
): Uint8Array;

export declare function parseJsonBytesChunked(bytes: Uint8Array): unknown;
