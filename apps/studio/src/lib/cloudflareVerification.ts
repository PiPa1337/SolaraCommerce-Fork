export type CloudflareCheckStatus = "pass" | "fail" | "unverified";

export interface CloudflareVerificationCheck {
  id: string;
  label: string;
  status: CloudflareCheckStatus;
  detail: string;
}

export interface CloudflareVerificationResult {
  status: CloudflareCheckStatus;
  url: string;
  revision?: string;
  checks: CloudflareVerificationCheck[];
  curlCommands: string[];
}

interface DeploymentManifestShape {
  version?: number;
  mode?: string;
  baseUrl?: string;
  revision?: string;
  runtime?: { css?: string; js?: string };
}

function check(
  id: string,
  label: string,
  status: CloudflareCheckStatus,
  detail: string,
): CloudflareVerificationCheck {
  return { id, label, status, detail };
}

function resolvePath(base: URL, path: string): URL {
  const prefix = base.pathname.endsWith("/") ? base.pathname : `${base.pathname}/`;
  if (prefix !== "/" && path.startsWith("/") && !path.startsWith(prefix)) {
    return new URL(`${prefix}${path.slice(1)}`, base.origin);
  }
  return new URL(path, base);
}

function curl(url: URL): string {
  return `curl.exe -sS -D - -o NUL "${url.href}"`;
}

export async function verifyCloudflareDeployment(
  input: string,
): Promise<CloudflareVerificationResult> {
  let base: URL;
  try {
    base = new URL(input.trim().endsWith("/") ? input.trim() : `${input.trim()}/`);
  } catch {
    return {
      status: "fail",
      url: input,
      checks: [check("url", "URL pública", "fail", "La URL no es válida.")],
      curlCommands: [],
    };
  }
  const checks: CloudflareVerificationCheck[] = [];
  const manifestUrl = resolvePath(base, "deployment-manifest.json");
  const htmlUrl = base;
  const curlCommands = [curl(manifestUrl), curl(htmlUrl)];
  if (base.protocol !== "https:") {
    checks.push(check("https", "Dominio HTTPS", "fail", "La URL pública debe usar HTTPS."));
  } else {
    checks.push(check("https", "Dominio HTTPS", "pass", "La URL usa HTTPS."));
  }

  let manifestResponse: Response;
  let manifest: DeploymentManifestShape;
  try {
    manifestResponse = await fetch(manifestUrl, { cache: "no-store" });
  } catch {
    checks.push(
      check(
        "manifest",
        "Manifest de despliegue",
        "unverified",
        "No se pudo leer por CORS o no está publicado; revisar con curl.exe.",
      ),
    );
    return { status: "unverified", url: base.href, checks, curlCommands };
  }
  if (!manifestResponse.ok) {
    checks.push(
      check(
        "manifest",
        "Manifest de despliegue",
        "fail",
        `El manifest no está publicado (HTTP ${manifestResponse.status}).`,
      ),
    );
    return { status: "fail", url: base.href, checks, curlCommands };
  }
  try {
    manifest = (await manifestResponse.json()) as DeploymentManifestShape;
  } catch {
    checks.push(
      check(
        "manifest",
        "Manifest de despliegue",
        "fail",
        "El manifest publicado no es JSON válido.",
      ),
    );
    return { status: "fail", url: base.href, checks, curlCommands };
  }
  checks.push(
    check(
      "manifest",
      "Manifest de despliegue",
      manifest.version === 1 && manifest.mode === "production" ? "pass" : "fail",
      manifest.version === 1 && manifest.mode === "production"
        ? "Manifest v1 de producción encontrado."
        : "Falta el manifest v1 de producción o corresponde a un borrador.",
    ),
  );

  const runtimeCss = manifest.runtime?.css;
  const runtimeJs = manifest.runtime?.js;
  const runtimePathsValid =
    typeof runtimeCss === "string" &&
    /^\/(?:.*\/)?assets\/storefront\.[a-f0-9]{8,64}\.css$/i.test(runtimeCss) &&
    typeof runtimeJs === "string" &&
    /^\/(?:.*\/)?assets\/storefront\.[a-f0-9]{8,64}\.js$/i.test(runtimeJs);
  checks.push(
    check(
      "runtime-paths",
      "Runtime direccionado por contenido",
      runtimePathsValid ? "pass" : "fail",
      runtimePathsValid
        ? `${runtimeCss} y ${runtimeJs}`
        : "Las rutas runtime no tienen hash seguro.",
    ),
  );
  const revision = typeof manifest.revision === "string" ? manifest.revision : undefined;
  if (!runtimePathsValid) {
    return {
      status: "fail",
      url: base.href,
      ...(revision ? { revision } : {}),
      checks,
      curlCommands,
    };
  }
  if (!runtimeCss || !runtimeJs) {
    return {
      status: "fail",
      url: base.href,
      ...(revision ? { revision } : {}),
      checks,
      curlCommands,
    };
  }

  const assetUrls = [resolvePath(base, runtimeCss), resolvePath(base, runtimeJs)];
  const [htmlResponse, cssResponse, jsResponse, swResponse] = await Promise.all(
    [htmlUrl, ...assetUrls, resolvePath(base, "sw.js")].map(async (url) => {
      try {
        return await fetch(url, { cache: "no-store" });
      } catch {
        return undefined;
      }
    }),
  );
  if (!htmlResponse || !cssResponse || !jsResponse || !swResponse) {
    checks.push(
      check(
        "cors",
        "CORS de verificación",
        "unverified",
        "El hosting no permitió leer todas las respuestas; revisar los comandos curl.exe mostrados.",
      ),
    );
    return {
      status: "unverified",
      url: base.href,
      ...(revision ? { revision } : {}),
      checks,
      curlCommands,
    };
  }
  checks.push(
    check(
      "runtime-files",
      "Archivos runtime publicados",
      cssResponse.ok && jsResponse.ok ? "pass" : "fail",
      `${cssResponse.status}/${jsResponse.status}`,
    ),
  );
  const headers = htmlResponse.headers;
  const csp = headers.get("content-security-policy") ?? "";
  checks.push(
    check(
      "csp",
      "CSP endurecida",
      csp.includes("frame-ancestors 'none'") &&
        !csp.includes("trusted-types") &&
        csp.includes("form-action 'self'") &&
        csp.includes("worker-src") &&
        csp.includes("manifest-src") &&
        csp.includes("font-src")
        ? "pass"
        : "fail",
      csp || "Falta Content-Security-Policy.",
    ),
  );
  const hsts = headers.get("strict-transport-security") ?? "";
  checks.push(
    check(
      "hsts",
      "HSTS",
      hsts.includes("max-age=") && hsts.includes("includeSubDomains") && !/preload/i.test(hsts)
        ? "pass"
        : "fail",
      hsts || "Falta Strict-Transport-Security.",
    ),
  );
  checks.push(
    check(
      "nosniff",
      "nosniff",
      (headers.get("x-content-type-options") ?? "").toLowerCase() === "nosniff" ? "pass" : "fail",
      headers.get("x-content-type-options") ?? "Falta X-Content-Type-Options.",
    ),
  );
  checks.push(
    check(
      "anti-frame",
      "Anti-framing",
      (headers.get("x-frame-options") ?? "").toUpperCase() === "DENY" ? "pass" : "fail",
      headers.get("x-frame-options") ?? "Falta X-Frame-Options.",
    ),
  );
  checks.push(
    check(
      "cache",
      "Caché hasheada",
      (cssResponse.headers.get("cache-control") ?? "").includes("immutable") &&
        (jsResponse.headers.get("cache-control") ?? "").includes("immutable")
        ? "pass"
        : "fail",
      `${cssResponse.headers.get("cache-control") ?? ""} | ${jsResponse.headers.get("cache-control") ?? ""}`,
    ),
  );
  checks.push(
    check(
      "sw-cache",
      "Service worker sin caché",
      (swResponse.headers.get("cache-control") ?? "").includes("no-cache") ? "pass" : "fail",
      swResponse.headers.get("cache-control") ?? "Falta Cache-Control: no-cache.",
    ),
  );
  const mapResponse = await fetch(resolvePath(base, `${runtimeJs}.map`), {
    cache: "no-store",
  }).catch(() => undefined);
  checks.push(
    check(
      "source-map",
      "Sin source map de producción",
      !mapResponse || mapResponse.status === 404 || mapResponse.status === 410 ? "pass" : "fail",
      !mapResponse || mapResponse.status >= 400
        ? "No se encontró mapa de fuente."
        : `Mapa accesible (${mapResponse.status}).`,
    ),
  );
  const status = checks.some((entry) => entry.status === "fail")
    ? "fail"
    : checks.some((entry) => entry.status === "unverified")
      ? "unverified"
      : "pass";
  return { status, url: base.href, ...(revision ? { revision } : {}), checks, curlCommands };
}
