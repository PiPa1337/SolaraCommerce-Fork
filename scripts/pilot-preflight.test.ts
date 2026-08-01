import { expect, test } from "vitest";
import { buildCommerceSnapshot, exportProject } from "../packages/exporter/src/index";
import { referenceStore } from "../packages/project-schema/src/fixture";

test("valida el paquete production antes del piloto real", () => {
  const snapshot = buildCommerceSnapshot(referenceStore);
  const result = exportProject(referenceStore, { mode: "production" });
  const home = String(result.files.get("index.html"));
  const product = String(result.files.get("productos/manta-bruma/index.html"));
  const sitemap = String(result.files.get("sitemap.xml"));
  const feed = String(result.files.get("google-merchant.xml"));
  const headers = String(result.files.get("_headers"));

  expect(result.audit.filter((issue) => issue.severity === "critical")).toEqual([]);
  expect(result.files.has("robots.txt")).toBe(true);
  expect(result.files.has("image-sitemap.xml")).toBe(true);
  expect(result.files.has("google-merchant.xml")).toBe(true);
  expect(home).not.toContain("noindex,nofollow");
  expect(home).toContain('<link rel="canonical"');
  expect(product).toContain('"@type":"ProductGroup"');
  expect(sitemap).toContain("/productos/manta-bruma/");
  expect(feed.match(/<item>/g)).toHaveLength(snapshot.offers.length);
  for (const offer of snapshot.offers) {
    expect(feed.split(`<g:id>${offer.variantId}</g:id>`)).toHaveLength(2);
  }
  expect(headers).toContain("Content-Security-Policy");

  const second = exportProject(referenceStore, { mode: "production" });
  expect(second.zip).toEqual(result.zip);
  console.log({ pages: result.files.size, offers: snapshot.offers.length });
});
