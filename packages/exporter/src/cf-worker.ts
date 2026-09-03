const WORKER_SECURITY_HEADERS: Record<string, string> = {
  "Content-Security-Policy":
    "default-src 'self'; img-src 'self' data: https:; script-src 'self'; style-src 'self'; style-src-attr 'unsafe-inline'; connect-src 'self'; media-src 'self' data: https:; font-src 'self' data:; manifest-src 'self'; worker-src 'self'; form-action 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'",
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
  "Cross-Origin-Opener-Policy": "same-origin",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  "Access-Control-Expose-Headers":
    "Content-Security-Policy, Strict-Transport-Security, X-Content-Type-Options, X-Frame-Options, Cache-Control, Referrer-Policy, Permissions-Policy",
};

const WORKER_ROUTE_HEADERS: Record<string, Record<string, string>> = {
  "/sitemap.xml": { "Cache-Control": "public, max-age=3600, must-revalidate" },
  "/image-sitemap.xml": { "Cache-Control": "public, max-age=3600, must-revalidate" },
  "/video-sitemap.xml": { "Cache-Control": "public, max-age=3600, must-revalidate" },
  "/google-merchant.xml": {
    "Cache-Control": "public, max-age=900, must-revalidate",
    "Content-Type": "application/xml; charset=utf-8",
  },
  "/ai-context.json": { "Cache-Control": "public, max-age=900, must-revalidate" },
  "/llms.txt": { "Cache-Control": "public, max-age=900, must-revalidate" },
  "/llms-full.txt": { "Cache-Control": "public, max-age=900, must-revalidate" },
  "/search-index.json": { "Cache-Control": "public, max-age=900, must-revalidate" },
  "/catalog-index.json": { "Cache-Control": "public, max-age=900, must-revalidate" },
  "/sw.js": { "Cache-Control": "no-cache" },
  "/manifest.webmanifest": { "Cache-Control": "public, max-age=3600, must-revalidate" },
  "/feed.xml": {
    "Cache-Control": "public, max-age=900, must-revalidate",
    "Content-Type": "application/rss+xml; charset=utf-8",
  },
};

const WORKER_ROUTE_HEADERS_PREFIX: Array<readonly [string, Record<string, string>]> = [
  ["/assets/", { "Cache-Control": "public, max-age=31536000, immutable" }],
];

const WORKER_DEFAULT_HEADERS: Record<string, string> = {
  "Cache-Control": "public, max-age=0, must-revalidate, stale-while-revalidate=86400",
};

function canonicalHostOf(canonicalOrigin: string): string {
  let host: string;
  try {
    host = new URL(canonicalOrigin).hostname.toLowerCase();
  } catch {
    throw new Error(`canonicalOrigin inválido: ${canonicalOrigin}`);
  }
  if (!host) throw new Error(`canonicalOrigin inválido: ${canonicalOrigin}`);
  return host;
}

function workerRouteHeadersFor(pathname: string): Record<string, string> {
  for (const [prefix, headers] of WORKER_ROUTE_HEADERS_PREFIX) {
    if (pathname.startsWith(prefix)) return headers;
  }
  return WORKER_ROUTE_HEADERS[pathname] ?? WORKER_DEFAULT_HEADERS;
}

export function applyWorkerPolicies(
  url: URL,
  response: Response,
  canonicalOrigin: string,
): Response {
  const host = url.hostname.toLowerCase();
  const canonicalHost = canonicalHostOf(canonicalOrigin);
  if (host === `www.${canonicalHost}`) {
    return new Response(null, {
      status: 301,
      headers: { Location: `https://${canonicalHost}${url.pathname}${url.search}` },
    });
  }
  const clone = new Response(response.body, response);
  if (host.endsWith(".pages.dev") && !clone.headers.has("X-Robots-Tag")) {
    clone.headers.set("X-Robots-Tag", "noindex");
  }
  for (const [name, value] of Object.entries(WORKER_SECURITY_HEADERS)) {
    if (!clone.headers.has(name)) clone.headers.set(name, value);
  }
  for (const [name, value] of Object.entries(workerRouteHeadersFor(url.pathname))) {
    if (!clone.headers.has(name)) clone.headers.set(name, value);
  }
  return clone;
}

export function buildCfWorkerSource({ canonicalOrigin }: { canonicalOrigin: string }): string {
  const canonicalHost = canonicalHostOf(canonicalOrigin);
  return `const CANONICAL_HOST = ${JSON.stringify(canonicalHost)};
const SECURITY_HEADERS = ${JSON.stringify(WORKER_SECURITY_HEADERS)};
const ROUTE_HEADERS_EXACT = ${JSON.stringify(WORKER_ROUTE_HEADERS)};
const ROUTE_HEADERS_PREFIX = ${JSON.stringify(WORKER_ROUTE_HEADERS_PREFIX)};
const DEFAULT_HEADERS = ${JSON.stringify(WORKER_DEFAULT_HEADERS)};
function routeHeadersFor(pathname) {
  for (const [prefix, headers] of ROUTE_HEADERS_PREFIX) {
    if (pathname.startsWith(prefix)) return headers;
  }
  const exact = ROUTE_HEADERS_EXACT[pathname];
  return typeof exact === "object" && exact !== null ? exact : DEFAULT_HEADERS;
}
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const host = url.hostname.toLowerCase();
    if (host === "www." + CANONICAL_HOST) {
      return new Response(null, {
        status: 301,
        headers: { Location: "https://" + CANONICAL_HOST + url.pathname + url.search },
      });
    }
    let response;
    try {
      if (!env || !env.ASSETS || typeof env.ASSETS.fetch !== "function") {
        throw new Error("falta el binding ASSETS");
      }
      response = await env.ASSETS.fetch(request);
    } catch (error) {
      return new Response("Error interno\\n", {
        status: 500,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      });
    }
    const clone = new Response(response.body, response);
    if (host.endsWith(".pages.dev") && !clone.headers.has("X-Robots-Tag")) {
      clone.headers.set("X-Robots-Tag", "noindex");
    }
    for (const name of Object.keys(SECURITY_HEADERS)) {
      if (!clone.headers.has(name)) clone.headers.set(name, SECURITY_HEADERS[name]);
    }
    const routeHeaders = routeHeadersFor(url.pathname);
    for (const name of Object.keys(routeHeaders)) {
      if (!clone.headers.has(name)) clone.headers.set(name, routeHeaders[name]);
    }
    return clone;
  },
};
`;
}
