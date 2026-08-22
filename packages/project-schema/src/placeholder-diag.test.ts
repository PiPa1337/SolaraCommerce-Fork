import { writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildCatalogModernProject } from "./catalog-modern-template";

const p = buildCatalogModernProject({ seed: "placeholder" });

describe("diagnostico placeholder", () => {
  it("dump completo para revision manual", () => {
    const dump = {
      identity: p.identity,
      whatsapp: p.whatsapp,
      seo: p.seo,
      navigation: p.navigation,
      policies: p.policies,
      siteShell: p.siteShell,
      collections: p.collections.map((c) => ({ id: c.id, slug: c.slug, title: c.title })),
      productTitles: p.products.map((p2) => p2.title),
      categoryTitles: p.categories.map((c) => c.title),
      assetSources: p.assets.map((a) => a.source.slice(0, 50)),
      sectionTexts: p.sections.flatMap((s) => {
        const texts: string[] = [];
        JSON.stringify(s.settings, (k, v) => {
          if (typeof v === "string" && v.length > 3) texts.push(v);
          return v;
        });
        return texts;
      }),
    };
    writeFileSync("../../placeholder-dump.json", JSON.stringify(dump, null, 2));
    expect(p.products).toHaveLength(5);
  });
});
