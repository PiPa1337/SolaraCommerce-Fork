import { describe, expect, it } from "vitest";
import { escapeHtml, safeAssetUrl, safeUrl, sanitizeRichText } from "./index";

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
});
