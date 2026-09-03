import { afterEach, describe, expect, it, vi } from "vitest";
import { verifyCloudflareDeployment } from "./cloudflareVerification";

const runtime = {
  css: "/assets/storefront.0123456789abcdef.css",
  js: "/assets/storefront.fedcba9876543210.js",
};

const secureHeaders = {
  "content-security-policy":
    "default-src 'self'; script-src 'self'; frame-ancestors 'none'; form-action 'self'; worker-src 'self'; manifest-src 'self'; font-src 'self'",
  "strict-transport-security": "max-age=31536000; includeSubDomains",
  "x-content-type-options": "nosniff",
  "x-frame-options": "DENY",
};

function installFetch(
  manifest: Record<string, unknown> | null,
  options: { csp?: boolean; blocked?: boolean; headerOverrides?: Record<string, string> } = {},
) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      if (options.blocked) throw new TypeError("Failed to fetch");
      const url = String(input);
      if (url.endsWith("/deployment-manifest.json")) {
        if (!manifest) return new Response("missing", { status: 404 });
        return Response.json(manifest);
      }
      const headers = new Headers({ ...secureHeaders, ...options.headerOverrides });
      if (options.csp === false) headers.delete("content-security-policy");
      if (url.endsWith("/sw.js")) headers.set("cache-control", "no-cache");
      else if (url.endsWith(".css") || url.endsWith(".js"))
        headers.set("cache-control", "public, immutable");
      if (url.endsWith(".map")) return new Response("missing", { status: 404 });
      return new Response("ok", { headers });
    }),
  );
}

afterEach(() => vi.unstubAllGlobals());

describe("verificador de publicación Cloudflare", () => {
  it("marca verde una producción completa también en subcarpeta", async () => {
    installFetch({ version: 1, mode: "production", revision: "rev-1", runtime });
    const result = await verifyCloudflareDeployment("https://example.test/tienda");
    expect(result.status).toBe("pass");
    expect(result.revision).toBe("rev-1");
  });

  it("rechaza CSP ausente, runtime viejo y borrador publicado", async () => {
    installFetch({ version: 1, mode: "production", runtime }, { csp: false });
    expect((await verifyCloudflareDeployment("https://example.test")).status).toBe("fail");

    installFetch({
      version: 1,
      mode: "production",
      runtime: { ...runtime, css: "/assets/storefront.css" },
    });
    expect((await verifyCloudflareDeployment("https://example.test")).status).toBe("fail");

    installFetch({ version: 1, mode: "draft", runtime });
    expect((await verifyCloudflareDeployment("https://example.test")).status).toBe("fail");
  });

  it("rechaza CSP con trusted-types y HSTS sin includeSubDomains", async () => {
    installFetch(
      { version: 1, mode: "production", runtime },
      {
        headerOverrides: {
          "content-security-policy":
            "default-src 'self'; script-src 'self'; frame-ancestors 'none'; form-action 'self'; worker-src 'self'; manifest-src 'self'; font-src 'self'; trusted-types 'none'",
          "strict-transport-security": "max-age=31536000",
        },
      },
    );
    const result = await verifyCloudflareDeployment("https://example.test");
    expect(result.checks.find((entry) => entry.id === "csp")?.status).toBe("fail");
    expect(result.checks.find((entry) => entry.id === "hsts")?.status).toBe("fail");
  });

  it("distingue manifest faltante de una verificación bloqueada por CORS", async () => {
    installFetch(null);
    expect((await verifyCloudflareDeployment("https://example.test")).status).toBe("fail");

    installFetch(null, { blocked: true });
    const result = await verifyCloudflareDeployment("https://example.test");
    expect(result.status).toBe("unverified");
    expect(result.curlCommands.length).toBeGreaterThan(0);
  });
});
