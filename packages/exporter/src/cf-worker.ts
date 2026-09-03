const WORKER_SECURITY_HEADERS: Record<string, string> = {
  "Content-Security-Policy":
    "default-src 'self'; img-src 'self' data: https:; script-src 'self'; style-src 'self'; style-src-attr 'unsafe-inline'; connect-src 'self'; media-src 'self' data: https:; font-src 'self' data:; manifest-src 'self'; worker-src 'self'; form-action 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'",
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "strict-origin-when-cross-origin",
};

const WORKER_CACHE_CONTROL_EXACT: Record<string, string> = {
  "/sitemap.xml": "public, max-age=3600, must-revalidate",
  "/image-sitemap.xml": "public, max-age=3600, must-revalidate",
  "/video-sitemap.xml": "public, max-age=3600, must-revalidate",
  "/google-merchant.xml": "public, max-age=900, must-revalidate",
  "/ai-context.json": "public, max-age=900, must-revalidate",
  "/llms.txt": "public, max-age=900, must-revalidate",
  "/llms-full.txt": "public, max-age=900, must-revalidate",
  "/search-index.json": "public, max-age=900, must-revalidate",
  "/catalog-index.json": "public, max-age=900, must-revalidate",
  "/sw.js": "no-cache",
  "/manifest.webmanifest": "public, max-age=3600, must-revalidate",
  "/feed.xml": "public, max-age=900, must-revalidate",
};

const WORKER_CACHE_CONTROL_PREFIX: Array<readonly [string, string]> = [
  ["/assets/", "public, max-age=31536000, immutable"],
];

const WORKER_CACHE_CONTROL_DEFAULT =
  "public, max-age=0, must-revalidate, stale-while-revalidate=86400";

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

function workerCacheControlFor(pathname: string): string {
  for (const [prefix, value] of WORKER_CACHE_CONTROL_PREFIX) {
    if (pathname.startsWith(prefix)) return value;
  }
  return WORKER_CACHE_CONTROL_EXACT[pathname] ?? WORKER_CACHE_CONTROL_DEFAULT;
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
  if (!clone.headers.has("Cache-Control")) {
    clone.headers.set("Cache-Control", workerCacheControlFor(url.pathname));
  }
  return clone;
}

export function buildCfWorkerSource({ canonicalOrigin }: { canonicalOrigin: string }): string {
  const canonicalHost = canonicalHostOf(canonicalOrigin);
  return `const CANONICAL_HOST = ${JSON.stringify(canonicalHost)};
const SECURITY_HEADERS = ${JSON.stringify(WORKER_SECURITY_HEADERS)};
const CACHE_CONTROL_EXACT = ${JSON.stringify(WORKER_CACHE_CONTROL_EXACT)};
const CACHE_CONTROL_PREFIX = ${JSON.stringify(WORKER_CACHE_CONTROL_PREFIX)};
const CACHE_CONTROL_DEFAULT = ${JSON.stringify(WORKER_CACHE_CONTROL_DEFAULT)};
function cacheControlFor(pathname) {
  for (const [prefix, value] of CACHE_CONTROL_PREFIX) {
    if (pathname.startsWith(prefix)) return value;
  }
  const exact = CACHE_CONTROL_EXACT[pathname];
  return typeof exact === "string" ? exact : CACHE_CONTROL_DEFAULT;
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
    if (!clone.headers.has("Cache-Control")) {
      clone.headers.set("Cache-Control", cacheControlFor(url.pathname));
    }
    return clone;
  },
};
`;
}
