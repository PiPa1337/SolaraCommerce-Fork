import { mkdirSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { resolve } from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { test } from "@playwright/test";
import { exportProject } from "@solara/exporter";
import { catalogModernStore } from "@solara/project-schema/catalog-modern-fixture";
import { referenceStore } from "@solara/project-schema/fixture";

const projects = {
  reference: referenceStore,
  catalogModern: catalogModernStore,
} as const;

function routesFor(project: (typeof projects)[keyof typeof projects]): string[] {
  const exported = exportProject(project, { mode: "production" });
  const product = [...exported.files.keys()].find((path) =>
    /^productos\/[^/]+\/index\.html$/.test(path),
  );
  const category = [...exported.files.keys()].find((path) =>
    /^categorias\/[^/]+\/index\.html$/.test(path),
  );
  return [
    "/",
    product ? `/${product.slice(0, -"index.html".length)}` : "/productos/",
    category ? `/${category.slice(0, -"index.html".length)}` : "/categorias/",
    "/carrito/",
    "/compra/",
    "/buscar/",
  ];
}

test("A1: axe sobre las rutas del sitio exportado (reference y catalogModern)", async ({
  page,
}) => {
  let exported = exportProject(referenceStore, { mode: "production" });
  const server = createServer((request, response) => {
    const url = new URL(request.url ?? "/", "http://127.0.0.1");
    const requested = decodeURIComponent(url.pathname).replace(/^\/+/, "");
    const path =
      requested === ""
        ? "index.html"
        : requested.endsWith("/")
          ? `${requested}index.html`
          : requested;
    const content = exported.files.get(path);
    if (content === undefined) {
      response.writeHead(404).end("Not found");
      return;
    }
    const extension = path.split(".").pop();
    const contentType =
      extension === "html"
        ? "text/html; charset=utf-8"
        : extension === "css"
          ? "text/css; charset=utf-8"
          : extension === "js"
            ? "text/javascript; charset=utf-8"
            : "application/octet-stream";
    response.writeHead(200, { "Content-Type": contentType }).end(content);
  });
  await new Promise((resolveListen) => server.listen(0, "127.0.0.1", resolveListen));
  const address = server.address();
  const serverUrl = `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}`;
  try {
    const findings: Array<{
      fixture: string;
      route: string;
      impact: string;
      id: string;
      target: string;
    }> = [];
    for (const [fixtureName, project] of Object.entries(projects)) {
      exported = exportProject(project, { mode: "production" });
      const fixtureRoutes = routesFor(project);
      for (const route of fixtureRoutes) {
        await page.goto(`${serverUrl}${route}`, { waitUntil: "networkidle" });
        const results = await new AxeBuilder({ page }).analyze();
        for (const violation of results.violations) {
          findings.push({
            fixture: fixtureName,
            route,
            impact: violation.impact ?? "unknown",
            id: violation.id,
            target: violation.nodes[0]?.target.join(" ") ?? "",
          });
        }
      }
    }
    mkdirSync("test-results/qa-axe", { recursive: true });
    writeFileSync(
      resolve("test-results/qa-axe/findings.json"),
      `${JSON.stringify(findings, null, 2)}\n`,
      "utf8",
    );
    const counts = findings.reduce<Record<string, number>>((acc, f) => {
      acc[f.impact] = (acc[f.impact] ?? 0) + 1;
      return acc;
    }, {});
    console.log("A1 axe:", JSON.stringify(counts));
    for (const f of findings.slice(0, 8))
      console.log(" ", f.fixture, f.route, f.impact, f.id, f.target);
  } finally {
    await new Promise((resolveClose) => server.close(() => resolveClose()));
  }
});
