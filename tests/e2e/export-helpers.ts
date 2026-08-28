/** Helpers for assertions against the hashed public runtime emitted by exporter. */
export function readHashedStorefrontCss(files: ReadonlyMap<string, string | Uint8Array>): string {
  const paths = [...files.keys()].filter((path) =>
    /^assets\/storefront\.[a-f0-9]+\.css$/.test(path),
  );
  if (paths.length !== 1) {
    throw new Error(
      `Se esperaba un único CSS storefront hasheado; se encontraron ${paths.length}.`,
    );
  }
  const file = files.get(paths[0]);
  if (file === undefined) throw new Error(`Falta el archivo exportado ${paths[0]}.`);
  return typeof file === "string" ? file : new TextDecoder().decode(file);
}
