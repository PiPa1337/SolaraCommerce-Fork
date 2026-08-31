import { test } from "vitest";
import { generatePerformanceFixture } from "../packages/core/src/performance";
import { exportProject } from "../packages/exporter/src/index";

test("audit repetido 2000", () => {
  const project = generatePerformanceFixture(2000);
  project.commerceTemplates.designFamily = "catalog-modern-v2";
  const result = exportProject(project, { mode: "production" });
  const prodEntries = [...result.files.entries()].filter(([p]) => p.startsWith("productos/"));
  const htmls = prodEntries.map(([, v]) => String(v));
  // comparar dos productos para medir shell repetido (LCS aproximado via longitud comun)
  const a = htmls[0],
    b = htmls[1];
  let common = 0;
  // cuenta bytes iguales en posiciones iguales hasta primer diff grande (aprox)
  const min = Math.min(a.length, b.length);
  for (let i = 0; i < min; i++)
    if (a[i] === b[i]) common++;
    else break;
  // mide prefijo comun + sufijo comun
  let suffix = 0;
  for (let i = 1; i < min; i++)
    if (a[a.length - i] === b[b.length - i]) suffix++;
    else break;
  console.log(
    "producto HTML len",
    a.length,
    b.length,
    "prefijo comun",
    common,
    "sufijo comun",
    suffix,
    "unico aprox",
    a.length - common - suffix,
  );
  // tamaño ai-context y catalog-index ya visto
  console.log("ai-context", Buffer.byteLength(String(result.files.get("ai-context.json")), "utf8"));
  console.log(
    "catalog-index",
    Buffer.byteLength(String(result.files.get("catalog-index.json")), "utf8"),
  );
  console.log(
    "search-index",
    Buffer.byteLength(String(result.files.get("search-index.json")), "utf8"),
  );
});
