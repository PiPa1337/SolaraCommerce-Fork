/**
 * Lighthouse ligero: checks estaticos sobre el HTML generado.
 * Sin Chrome headless. Score = checks pasados / total x 100.
 */

export interface LighthouseCheck {
  name: string;
  passed: boolean;
  detail: string;
}

export interface LighthouseLiteResult {
  score: number;
  checks: LighthouseCheck[];
}

function check(name: string, passed: boolean, detail: string): LighthouseCheck {
  return { name, passed, detail };
}

export function runLighthouseLite(html: string): LighthouseLiteResult {
  const checks: LighthouseCheck[] = [];

  // Meta viewport
  const hasViewport = html.includes('meta name="viewport"');
  checks.push(check("viewport", hasViewport, hasViewport ? "OK" : "Falta meta viewport"));

  // Title length
  const titleMatch = html.match(/<title>([^<]+)<\/title>/);
  const titleLen = titleMatch?.[1]?.length ?? 0;
  checks.push(
    check(
      "title-length",
      titleLen >= 30 && titleLen <= 60,
      `${titleLen} caracteres (recomendado 30-60)`,
    ),
  );

  // Meta description length
  const descMatch = html.match(/meta name="description" content="([^"]*)"/);
  const descLen = descMatch?.[1]?.length ?? 0;
  checks.push(
    check(
      "description-length",
      descLen >= 70 && descLen <= 160,
      `${descLen} caracteres (recomendado 70-160)`,
    ),
  );

  // H1 unico
  const h1Count = (html.match(/<h1[ >]/g) ?? []).length;
  checks.push(check("h1-unique", h1Count === 1, `${h1Count} elementos h1`));

  // Images con alt
  const imgs = html.match(/<img[^>]*>/g) ?? [];
  const imgsWithoutAlt = imgs.filter((img) => !img.includes("alt=")).length;
  checks.push(
    check(
      "images-alt",
      imgsWithoutAlt === 0,
      imgs.length > 0 ? `${imgs.length - imgsWithoutAlt}/${imgs.length} con alt` : "sin imagenes",
    ),
  );

  // Links sin javascript:
  const jsLinks = (html.match(/href="javascript:/g) ?? []).length;
  checks.push(check("no-js-links", jsLinks === 0, `${jsLinks} links javascript:`));

  // Canonical presente
  const hasCanonical = html.includes('rel="canonical"');
  checks.push(check("canonical", hasCanonical, hasCanonical ? "OK" : "Falta canonical"));

  // Robots meta
  const hasRobots = html.includes('meta name="robots"');
  checks.push(check("robots-meta", hasRobots, hasRobots ? "OK" : "Falta robots"));

  // OG tags basicos
  const ogCount = ["og:title", "og:description", "og:image"].filter((tag) =>
    html.includes(`property="${tag}"`),
  ).length;
  checks.push(check("og-tags", ogCount === 3, `${ogCount}/3 tags OG`));

  // JSON-LD presente y parseable
  let jsonLdOk = false;
  try {
    const ldMatch = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
    if (ldMatch) {
      JSON.parse(ldMatch[1] ?? "{}");
      jsonLdOk = true;
    }
  } catch {
    /* invalid JSON-LD */
  }
  checks.push(check("json-ld", jsonLdOk, jsonLdOk ? "Parseable" : "Ausente o invalido"));

  const passedCount = checks.filter((c) => c.passed).length;
  const score = Math.round((passedCount / checks.length) * 100);

  return { score, checks };
}
