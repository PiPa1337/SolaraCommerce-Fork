import { referenceStore } from "@solara/project-schema/fixture";
import { describe, expect, it } from "vitest";
import { escapeHtml, renderImage, safeAssetUrl, safeUrl, sanitizeRichText } from "./index";

describe("HTML safety", () => {
  it("escapes text and attributes", () => {
    expect(escapeHtml(`<img src=x onerror="alert('x')">`)).toBe(
      "&lt;img src=x onerror=&quot;alert(&#39;x&#39;)&quot;&gt;",
    );
  });

  it("keeps the rich text subset and removes executable markup", () => {
    const input =
      '<p onclick="bad()">Texto <strong>seguro</strong><script>alert(1)</script><a href="javascript:bad()">link</a><img src=x onerror=bad()></p>';
    expect(sanitizeRichText(input)).toBe(
      '<p>Texto <strong>seguro</strong><a href="#">link</a></p>',
    );
  });

  it("allows explicit safe URLs only", () => {
    expect(safeUrl("/productos/manta/")).toBe("/productos/manta/");
    expect(safeUrl("https://example.com/a")).toBe("https://example.com/a");
    expect(safeUrl("//evil.example/a")).toBe("#");
    expect(safeUrl("data:text/html,bad")).toBe("#");
    expect(safeAssetUrl("blob:https://studio.local/image-id")).toBe(
      "blob:https://studio.local/image-id",
    );
    expect(safeAssetUrl("data:text/html,bad")).toBe("");
  });

  it("renderiza imágenes responsive con prioridad y atributos escapados", () => {
    const asset = referenceStore.assets[0];
    if (!asset) throw new Error("Fixture incompleto");
    const project = {
      ...referenceStore,
      assets: [
        {
          ...asset,
          responsiveSources: [
            { width: 480, source: "data:image/webp;base64,AA==" },
            { width: 960, source: "/assets/fixture-960.jpg" },
          ],
        },
        ...referenceStore.assets.slice(1),
      ],
    };
    const html = renderImage(project, asset.id, {
      loading: "eager",
      fetchPriority: "high",
      decoding: "async",
      sizes: "(max-width: 720px) 100vw, 50vw",
      fallbackAlt: 'Imagen "principal"',
    });

    expect(html).toContain('loading="eager"');
    expect(html).toContain('fetchpriority="high"');
    expect(html).toContain('decoding="async"');
    expect(html).toContain('sizes="(max-width: 720px) 100vw, 50vw"');
    expect(html).toContain('<source type="image/webp"');
    expect(html).toContain('<source type="image/jpeg"');
    expect(html).not.toContain("<script");
  });
});
