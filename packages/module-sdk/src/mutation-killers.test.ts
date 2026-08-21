import { describe, expect, it } from "vitest";
import { escapeAttribute, escapeHtml, safeUrl, sanitizeRichText } from "./index";

describe("mutation-killers: module-sdk / seguridad", () => {
  it("escapeHtml escapa & < > \" ' ", () => {
    expect(escapeHtml("&<>\"'")).toBe("&amp;&lt;&gt;&quot;&#39;");
    expect(escapeAttribute('a"b')).toContain("&quot;");
    // mutación quitar un reemplazo dejaría caracter sin escapar
  });
  it("safeUrl bloquea javascript: con whitespace y case", () => {
    expect(safeUrl("   javascript:alert(1)")).toBe("#");
    expect(safeUrl("\t\nJavascript:alert(1)")).toBe("#");
    expect(safeUrl("JaVaScRiPt:alert(1)")).toBe("#");
    expect(safeUrl("javascript :alert(1)")).toBe("#"); // espacio antes de :
    // mutación quitar trim fallaría
  });
  it("safeUrl permite http/https/mailto/tel y relativos seguros", () => {
    expect(safeUrl("https://example.com")).toBe("https://example.com");
    expect(safeUrl("mailto:hola@example.com")).toBe("mailto:hola@example.com");
    expect(safeUrl("tel:+5491112345678")).toBe("tel:+5491112345678");
    expect(safeUrl("/categorias/remeras/")).toBe("/categorias/remeras/");
    expect(safeUrl("#anchor")).toBe("#anchor");
  });
  it("safeUrl bloquea data: no imagen y vbscript:", () => {
    expect(safeUrl("data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==")).toBe("#");
    expect(safeUrl("vbscript:msgbox(1)")).toBe("#");
    expect(safeUrl("file:///etc/passwd")).toBe("#");
  });
  it("sanitizeRichText elimina script/svg/on* y javascript href", () => {
    expect(sanitizeRichText("<p>Hola</p><script>alert(1)</script>")).not.toContain("<script");
    expect(sanitizeRichText('<svg onload="alert(1)">x</svg>')).not.toContain("svg");
    expect(sanitizeRichText('<p onclick="alert(1)">x</p>')).toBe("<p>x</p>");
    expect(sanitizeRichText('<a href="javascript:alert(1)">x</a>')).not.toContain("javascript:");
    expect(sanitizeRichText('<a href="  javascript:alert(1)">x</a>')).not.toContain("javascript:");
  });
  it("sanitizeRichText conserva tags permitidos y escapa texto", () => {
    expect(sanitizeRichText("<p><strong>ok</strong> & <em>more</em></p>")).toContain(
      "<strong>ok</strong>",
    );
    expect(sanitizeRichText("a & b < c")).toContain("a &amp; b &lt; c");
  });
  it("sanitizeRichText neutraliza href externo con target blank seguro", () => {
    const html = String(sanitizeRichText('<a href="https://example.com">ext</a>'));
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer"');
    const internal = String(sanitizeRichText('<a href="/categorias/x/">int</a>'));
    expect(internal).not.toContain('target="_blank"');
  });
});
