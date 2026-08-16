import { expect, test } from "vitest";
import { exportProject } from "../packages/exporter/src/index";
import { catalogModernStore } from "../packages/project-schema/src/catalog-modern-fixture";
import { referenceStore } from "../packages/project-schema/src/fixture";

test("P5-4: duplicacion de selectores en el CSS V2 post-iteracion del usuario", () => {
  const result = exportProject(catalogModernStore, { mode: "production" });
  const css = String(result.files.get("assets/storefront.css") ?? "");
  const v2 = css.slice(css.indexOf(".cm.v2"));
  const rules = [...v2.matchAll(/([^{}]+)\{/g)].map((m) => m[1].trim());
  const counts = new Map<string, number>();
  for (const rule of rules) counts.set(rule, (counts.get(rule) ?? 0) + 1);
  const dups = [...counts.entries()].filter(
    ([selector, count]) => count > 1 && selector !== "from" && selector !== "to",
  );
  const dupBytes = dups.reduce((acc, [selector, count]) => acc + selector.length * (count - 1), 0);
  console.log(`P5-4: ${dups.length} selectores repetidos | bytes: ${dupBytes}`);
  expect(dupBytes).toBeLessThanOrEqual(300);
});

test("P5-7: videos de los fixtures con poster y tamano razonable", () => {
  const withVideo = structuredClone(referenceStore) as typeof referenceStore;
  withVideo.videos = [
    {
      id: "video-test",
      kind: "video",
      name: "Hero",
      source: "data:video/mp4;base64,AAAA",
      mimeType: "video/mp4",
      width: 1920,
      height: 1080,
      hash: "video-test",
      posterAssetId: "asset-manta",
      durationSeconds: 12,
    },
  ];
  const hero = withVideo.sections.find(
    (section) => section.moduleId === "hero-media" && section.slot === "hero",
  );
  if (hero) {
    hero.settings = {
      ...hero.settings,
      mode: "video",
      videoAssetId: "video-test",
      posterAssetId: "asset-manta",
    };
  }
  const result = exportProject(withVideo, { mode: "production" });
  const html = String(result.files.get("index.html"));
  expect(html).toContain("<video");
  expect(result.audit.filter((issue) => issue.code === "video.poster")).toHaveLength(0);
  expect(result.audit.filter((issue) => issue.code === "video.duration")).toHaveLength(0);
});
