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

function assetResponse(
  headers?: Record<string, string>,
  body: string | null = "<html>ok</html>",
): Response {
  return new Response(body, { status: 200, headers });
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

async function runDirect(
  url: string,
  headers?: Record<string, string>,
  body: string | null = "<html>ok</html>",
): Promise<Response> {
  return applyWorkerPolicies(new URL(url), assetResponse(headers, body), CANONICAL_ORIGIN);
}

async function runEmitted(
  url: string,
  headers?: Record<string, string>,
  body: string | null = "<html>ok</html>",
): Promise<Response> {
  const handler = evaluateWorkerSource(buildCfWorkerSource({ canonicalOrigin: CANONICAL_ORIGIN }));
  const { env } = mockEnv(assetResponse(headers, body));
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

async function expectParity(
  url: string,
  headers?: Record<string, string>,
  body: string | null = "<html>ok</html>",
): Promise<Response> {
  const direct = await observable(runDirect(url, headers, body));
  const emitted = await observable(runEmitted(url, headers, body));
  expect(emitted).toEqual(direct);
  return runDirect(url, headers, body);
}

type HeadersBlock = { pattern: string; headers: Array<[string, string]> };

function headersBlocksFromHeadersFile(content: string): HeadersBlock[] {
  const blocks: HeadersBlock[] = [];
  let current: HeadersBlock | undefined;
  for (const rawLine of content.split("\n")) {
    const line = rawLine.trim();
    if (!line) {
      current = undefined;
      continue;
    }
    if (line.startsWith("#")) continue;
    if (line.startsWith("!")) continue;
    const separator = line.indexOf(":");
    if (separator < 0) {
      current = { pattern: line, headers: [] };
      blocks.push(current);
      continue;
    }
    if (!current) throw new Error(`header fuera de bloque en _headers: ${line}`);
    current.headers.push([
      line.slice(0, separator).trim().toLowerCase(),
      line.slice(separator + 1).trim(),
    ]);
  }
  return blocks;
}

function headersBlockMatches(pattern: string, path: string): boolean {
  if (pattern === "/*") return true;
  if (pattern.endsWith("/*")) return path.startsWith(pattern.slice(0, -1));
  return pattern === path;
}

function effectiveHeadersFor(blocks: HeadersBlock[], path: string): Map<string, string> {
  const effective = new Map<string, string>();
  for (const block of blocks) {
    if (!headersBlockMatches(block.pattern, path)) continue;
    for (const [name, value] of block.headers) effective.set(name, value);
  }
  return effective;
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
      "Cross-Origin-Opener-Policy": "same-origin",
      "Referrer-Policy": "strict-origin-when-cross-origin",
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
      "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
      "Access-Control-Expose-Headers":
        "Content-Security-Policy, Strict-Transport-Security, X-Content-Type-Options, X-Frame-Options, Cache-Control, Referrer-Policy, Permissions-Policy",
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
    expect(direct.headers.get("Cross-Origin-Opener-Policy")).toBe("same-origin");
    expect(direct.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(direct.headers.get("X-Frame-Options")).toBe("DENY");
    expect(direct.headers.get("Referrer-Policy")).toBe("strict-origin-when-cross-origin");
    expect(direct.headers.get("Permissions-Policy")).toBe(
      "camera=(), microphone=(), geolocation=()",
    );
    expect(direct.headers.get("Access-Control-Expose-Headers")).toBe(
      "Content-Security-Policy, Strict-Transport-Security, X-Content-Type-Options, X-Frame-Options, Cache-Control, Referrer-Policy, Permissions-Policy",
    );
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

  it("el worker emitido replica exactamente todos los headers del _headers emitido", async () => {
    const production = exportProject(referenceStore, { mode: "production" });
    const blocks = headersBlocksFromHeadersFile(String(production.files.get("_headers")));
    expect(blocks.length).toBeGreaterThan(5);
    const handler = evaluateWorkerSource(String(production.files.get("_worker.js")));
    const { env } = mockEnv(assetResponse(undefined, null));
    const origin = new URL(referenceStore.baseUrl).origin;
    for (const block of blocks) {
      const probe = probeForPattern(block.pattern);
      const esperados = effectiveHeadersFor(blocks, probe);
      expect(esperados.size, `headers esperados para ${probe}`).toBeGreaterThan(5);
      const response = await handler.fetch(new Request(`${origin}${probe}`), env, undefined);
      const obtenidos = new Map(response.headers.entries());
      expect([...obtenidos.keys()].sort(), `set de headers en ${probe}`).toEqual(
        [...esperados.keys()].sort(),
      );
      for (const [name, value] of esperados) {
        expect(obtenidos.get(name), `${probe} → ${name}`).toBe(value);
      }
    }
  });

  it("agrega Content-Type explícito en /google-merchant.xml y /feed.xml cuando falta", async () => {
    const casos = [
      ["/google-merchant.xml", "application/xml; charset=utf-8"],
      ["/feed.xml", "application/rss+xml; charset=utf-8"],
    ] as const;
    for (const [path, esperado] of casos) {
      const direct = await expectParity(`https://tienda-ejemplo.com${path}`, undefined, null);
      expect(direct.headers.get("Content-Type")).toBe(esperado);
    }
  });

  it("no pisa un Content-Type ya presente en las rutas de feeds", async () => {
    const casos = [
      ["/google-merchant.xml", "application/xml"],
      ["/feed.xml", "text/xml; charset=utf-8"],
    ] as const;
    for (const [path, existente] of casos) {
      const direct = await expectParity(`https://tienda-ejemplo.com${path}`, {
        "Content-Type": existente,
      });
      expect(direct.headers.get("Content-Type")).toBe(existente);
    }
  });
});
