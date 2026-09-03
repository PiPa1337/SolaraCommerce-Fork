import { referenceStore } from "@solara/project-schema/fixture";
import { describe, expect, it } from "vitest";
import { applyWorkerPolicies, buildCfWorkerSource } from "./cf-worker";
import { exportProject } from "./index";

const CANONICAL_ORIGIN = "https://tienda-ejemplo.com";

const CSP_ESPERADA =
  "default-src 'self'; img-src 'self' data: https:; script-src 'self'; style-src 'self'; style-src-attr 'unsafe-inline'; connect-src 'self'; media-src 'self' data: https:; font-src 'self' data:; manifest-src 'self'; worker-src 'self'; form-action 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'";

type WorkerModule = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response>;
};

function evaluateWorkerSource(source: string): WorkerModule {
  const factory = new Function(`${source.replace("export default", "return")}`);
  const handler = factory() as WorkerModule | undefined;
  if (!handler || typeof handler.fetch !== "function") {
    throw new Error("El source del worker no expone fetch");
  }
  return handler;
}

function assetResponse(headers?: Record<string, string>): Response {
  return new Response("<html>ok</html>", { status: 200, headers });
}

function mockEnv(response: Response): {
  env: { ASSETS: { fetch: (request: Request) => Promise<Response> } };
  calls: () => number;
} {
  let calls = 0;
  return {
    env: {
      ASSETS: {
        fetch: async () => {
          calls += 1;
          return new Response(response.body, response);
        },
      },
    },
    calls: () => calls,
  };
}

async function runDirect(url: string, headers?: Record<string, string>): Promise<Response> {
  return applyWorkerPolicies(new URL(url), assetResponse(headers), CANONICAL_ORIGIN);
}

async function runEmitted(url: string, headers?: Record<string, string>): Promise<Response> {
  const handler = evaluateWorkerSource(buildCfWorkerSource({ canonicalOrigin: CANONICAL_ORIGIN }));
  const { env } = mockEnv(assetResponse(headers));
  return handler.fetch(new Request(url), env, undefined);
}

async function observable(response: Response | Promise<Response>): Promise<{
  status: number;
  location: string | undefined;
  headers: [string, string][];
  body: string;
}> {
  const resolved = await response;
  return {
    status: resolved.status,
    location: resolved.headers.get("Location") ?? undefined,
    headers: [...resolved.headers.entries()].sort(([a], [b]) => (a < b ? -1 : 1)),
    body: await resolved.text(),
  };
}

async function expectParity(url: string, headers?: Record<string, string>): Promise<Response> {
  const direct = await observable(runDirect(url, headers));
  const emitted = await observable(runEmitted(url, headers));
  expect(emitted).toEqual(direct);
  return runDirect(url, headers);
}

function cacheControlRulesFromHeadersFile(content: string): Array<{ path: string; value: string }> {
  const rules: Array<{ path: string; value: string }> = [];
  let path: string | undefined;
  for (const rawLine of content.split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#") || line.startsWith("! ")) continue;
    const separator = line.indexOf(":");
    if (separator < 0) {
      path = line;
      continue;
    }
    const name = line.slice(0, separator).trim();
    const value = line.slice(separator + 1).trim();
    if (name.toLowerCase() === "cache-control" && path) rules.push({ path, value });
  }
  return rules;
}

function probeForPattern(pattern: string): string {
  if (pattern === "/*") return "/";
  if (pattern.endsWith("/*")) return `${pattern.slice(0, -2)}/storefront.test.css`;
  return pattern;
}

describe("cf-worker", () => {
  it("(a) host pages.dev agrega X-Robots-Tag: noindex cuando falta", async () => {
    const direct = await expectParity("https://tenda.pages.dev/");
    expect(direct.headers.get("X-Robots-Tag")).toBe("noindex");
  });

  it("(b) host pages.dev no duplica X-Robots-Tag existente", async () => {
    const direct = await expectParity("https://tenda.pages.dev/", {
      "X-Robots-Tag": "noindex",
    });
    expect(direct.headers.get("X-Robots-Tag")).toBe("noindex");
    const variants = [...direct.headers.entries()].filter(
      ([name]) => name.toLowerCase() === "x-robots-tag",
    );
    expect(variants).toHaveLength(1);
  });

  it("(c) host www responde 301 hacia el apex conservando path y query", async () => {
    const direct = await expectParity("https://www.tienda-ejemplo.com/path?q=1&x=2");
    expect(direct.status).toBe(301);
    expect(direct.headers.get("Location")).toBe("https://tienda-ejemplo.com/path?q=1&x=2");
    const handler = evaluateWorkerSource(
      buildCfWorkerSource({ canonicalOrigin: CANONICAL_ORIGIN }),
    );
    const { env, calls } = mockEnv(assetResponse());
    const emitted = await handler.fetch(
      new Request("https://www.tienda-ejemplo.com/path?q=1"),
      env,
      undefined,
    );
    expect(emitted.status).toBe(301);
    expect(emitted.headers.get("Location")).toBe("https://tienda-ejemplo.com/path?q=1");
    expect(calls()).toBe(0);
  });

  it("(d) no agrega una segunda CSP cuando ya existe", async () => {
    const direct = await expectParity("https://tienda-ejemplo.com/", {
      "Content-Security-Policy": "frame-ancestors 'none'",
    });
    expect(direct.headers.get("Content-Security-Policy")).toBe("frame-ancestors 'none'");
  });

  it("(e) agrega la CSP esperada cuando falta", async () => {
    const direct = await expectParity("https://tienda-ejemplo.com/");
    expect(direct.headers.get("Content-Security-Policy")).toBe(CSP_ESPERADA);
  });

  it("(f) host canónico con todos los headers ya aplicados queda intacto", async () => {
    const headers = {
      "Content-Security-Policy": CSP_ESPERADA,
      "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
      "Referrer-Policy": "strict-origin-when-cross-origin",
      "Cache-Control": "public, max-age=0, must-revalidate, stale-while-revalidate=86400",
      "X-Robots-Tag": "noindex",
    };
    const original = await observable(assetResponse(headers));
    const direct = await observable(await runDirect("https://tienda-ejemplo.com/", headers));
    const emitted = await observable(await runEmitted("https://tienda-ejemplo.com/", headers));
    expect(direct).toEqual(original);
    expect(emitted).toEqual(original);
  });

  it("aplica Cache-Control por ruta con idempotencia", async () => {
    const casos: Array<[string, string]> = [
      ["/assets/storefront.abc123.css", "public, max-age=31536000, immutable"],
      ["/sw.js", "no-cache"],
      ["/sitemap.xml", "public, max-age=3600, must-revalidate"],
      ["/feed.xml", "public, max-age=900, must-revalidate"],
      ["/", "public, max-age=0, must-revalidate, stale-while-revalidate=86400"],
    ];
    for (const [path, expected] of casos) {
      const direct = await expectParity(`https://tienda-ejemplo.com${path}`);
      expect(direct.headers.get("Cache-Control")).toBe(expected);
    }
    const intacta = await expectParity("https://tienda-ejemplo.com/assets/storefront.js", {
      "Cache-Control": "private, no-store",
    });
    expect(intacta.headers.get("Cache-Control")).toBe("private, no-store");
  });

  it("agrega headers de seguridad tambien en el host canonico", async () => {
    const direct = await expectParity("https://tienda-ejemplo.com/");
    expect(direct.headers.get("Strict-Transport-Security")).toBe(
      "max-age=31536000; includeSubDomains",
    );
    expect(direct.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(direct.headers.get("X-Frame-Options")).toBe("DENY");
    expect(direct.headers.get("Referrer-Policy")).toBe("strict-origin-when-cross-origin");
    expect(direct.headers.get("X-Robots-Tag")).toBeNull();
  });

  it("conserva status, cuerpo y headers previos del asset", async () => {
    await expectParity("https://tienda-ejemplo.com/");
    const obs = await observable(runDirect("https://tienda-ejemplo.com/"));
    expect(obs.body).toBe("<html>ok</html>");
  });

  it("responde 500 sin binding ASSETS o si ASSETS.fetch falla", async () => {
    const handler = evaluateWorkerSource(
      buildCfWorkerSource({ canonicalOrigin: CANONICAL_ORIGIN }),
    );
    const sinBinding = await handler.fetch(
      new Request("https://tienda-ejemplo.com/"),
      {},
      undefined,
    );
    expect(sinBinding.status).toBe(500);
    const fallo = await handler.fetch(
      new Request("https://tienda-ejemplo.com/"),
      {
        ASSETS: {
          fetch: async () => {
            throw new Error("boom");
          },
        },
      },
      undefined,
    );
    expect(fallo.status).toBe(500);
  });

  it("emite _worker.js solo en production y pasa la allowlist del mapa publico", () => {
    const production = exportProject(referenceStore, { mode: "production" });
    const worker = production.files.get("_worker.js");
    expect(typeof worker).toBe("string");
    const source = String(worker);
    expect(source).toContain("export default");
    expect(source).toContain("env.ASSETS.fetch");
    expect(source).toContain("X-Robots-Tag");
    expect(source).toContain("noindex");
    expect(source).toContain(JSON.stringify(new URL(referenceStore.baseUrl).hostname));
    expect(source).not.toMatch(/^import\s/m);
    const manifest = JSON.parse(String(production.files.get("deployment-manifest.json"))) as {
      essentialFileHashes: Record<string, string>;
    };
    expect(manifest.essentialFileHashes["_worker.js"]).toMatch(/^[a-f0-9]{64}$/);
    const draft = exportProject(referenceStore, { mode: "draft" });
    expect(draft.files.has("_worker.js")).toBe(false);
  });

  it("buildCfWorkerSource es determinista y rechaza origin invalido", () => {
    const first = buildCfWorkerSource({ canonicalOrigin: CANONICAL_ORIGIN });
    const second = buildCfWorkerSource({ canonicalOrigin: "https://tienda-ejemplo.com/" });
    expect(second).toBe(first);
    expect(buildCfWorkerSource({ canonicalOrigin: "https://otro.com" })).toContain(
      JSON.stringify("otro.com"),
    );
    expect(() => buildCfWorkerSource({ canonicalOrigin: "no-es-url" })).toThrow();
  });

  it("el mapa de Cache-Control del worker coincide con el _headers emitido", async () => {
    const production = exportProject(referenceStore, { mode: "production" });
    const rules = cacheControlRulesFromHeadersFile(String(production.files.get("_headers")));
    expect(rules.length).toBeGreaterThan(5);
    const handler = evaluateWorkerSource(String(production.files.get("_worker.js")));
    const { env } = mockEnv(assetResponse());
    for (const rule of rules) {
      const probe = probeForPattern(rule.path);
      const response = await handler.fetch(
        new Request(`${new URL(referenceStore.baseUrl).origin}${probe}`),
        env,
        undefined,
      );
      expect(response.headers.get("Cache-Control"), `ruta ${probe}`).toBe(rule.value);
    }
  });
});
