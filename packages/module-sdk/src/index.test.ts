import { referenceStore } from "@solara/project-schema/fixture";
import { describe, expect, it } from "vitest";
import {
  escapeHtml,
  internalHref,
  moduleRoot,
  renderImage,
  renderVideo,
  safeAssetUrl,
  safeHtml,
  safeUrl,
  sanitizeRichText,
} from "./index";

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

  it("internalHref prefiJa rutas internas con la subcarpeta de baseUrl", () => {
    const withFolder = { ...referenceStore, baseUrl: "https://casa-luma.example/tienda/" };
    expect(internalHref(withFolder, "/productos/manta/")).toBe("/tienda/productos/manta/");
    expect(internalHref(withFolder, "/")).toBe("/tienda/");
    expect(internalHref(referenceStore, "/productos/manta/")).toBe("/productos/manta/");
    expect(internalHref(withFolder, "https://otro.example/x")).toBe("https://otro.example/x");
    expect(internalHref(withFolder, "#solara-main")).toBe("#solara-main");
    expect(internalHref(withFolder, "//evil.example/a")).toBe("#");
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

  it("sirve la variante intermedia en tablet/mobile y la máxima en desktop", () => {
    const asset = referenceStore.assets[0];
    if (!asset) throw new Error("Fixture incompleto");
    const project = {
      ...referenceStore,
      assets: [
        {
          ...asset,
          source: "/assets/foto-1800.webp",
          fallbackSource: "/assets/foto-fallback.jpg",
          width: 1800,
          height: 1200,
          responsiveSources: [
            { width: 320, source: "/assets/foto-320.webp" },
            { width: 480, source: "/assets/foto-480.webp" },
            { width: 640, source: "/assets/foto-640.webp" },
            { width: 768, source: "/assets/foto-768.webp" },
            { width: 1024, source: "/assets/foto-1024.webp" },
            { width: 1280, source: "/assets/foto-1280.webp" },
            { width: 1600, source: "/assets/foto-1600.webp" },
            { width: 1800, source: "/assets/foto-1800.webp" },
          ],
        },
        ...referenceStore.assets.slice(1),
      ],
    };

    const html = renderImage(project, asset.id);

    expect(html).toContain(
      '<source type="image/webp" media="(max-width: 1023px)" srcset="/assets/foto-768.webp 768w"',
    );
    expect(html).toContain('<source type="image/webp" srcset="/assets/foto-1800.webp 1800w"');
    expect(html).not.toContain("foto-320.webp");
    expect(html).not.toContain("foto-1024.webp");
  });

  it("sirve la fuente máxima en media responsive cuando la imagen se recorta con cover", () => {
    const asset = referenceStore.assets[0];
    if (!asset) throw new Error("Fixture incompleto");
    const project = {
      ...referenceStore,
      assets: [
        {
          ...asset,
          source: "/assets/foto-1800.webp",
          width: 1800,
          height: 1200,
          responsiveSources: [{ width: 768, source: "/assets/foto-768.webp" }],
        },
        ...referenceStore.assets.slice(1),
      ],
    };

    const html = renderImage(project, asset.id, { responsiveMode: "cover" });

    expect(html).toContain(
      '<source type="image/webp" media="(max-width: 1023px)" srcset="/assets/foto-768.webp 768w, /assets/foto-1800.webp 1800w"',
    );
  });

  it("conserva AVIF en el MIME de picture cuando la ruta lo declara", () => {
    const asset = referenceStore.assets[0];
    if (!asset) throw new Error("Fixture incompleto");
    const project = {
      ...referenceStore,
      assets: [
        {
          ...asset,
          mimeType: "image/avif",
          source: "/assets/foto-1800.avif",
          width: 1800,
          responsiveSources: [{ width: 768, source: "/assets/foto-768.avif" }],
        },
        ...referenceStore.assets.slice(1),
      ],
    };

    const html = renderImage(project, asset.id);

    expect(html).toContain(
      '<source type="image/avif" media="(max-width: 1023px)" srcset="/assets/foto-768.avif 768w"',
    );
    expect(html).toContain('<source type="image/avif" srcset="/assets/foto-1800.avif 1800w"');
  });

  it("prioriza WebP y conserva fallback cuando no hay variantes responsive", () => {
    const asset = referenceStore.assets[0];
    if (!asset) throw new Error("Fixture incompleto");
    const project = {
      ...referenceStore,
      assets: [
        {
          ...asset,
          mimeType: "image/webp" as const,
          source: "data:image/webp;base64,AA==",
          fallbackSource: "data:image/jpeg;base64,AQ==",
          responsiveSources: [],
        },
        ...referenceStore.assets.slice(1),
      ],
    };
    const html = renderImage(project, asset.id);

    expect(html).toContain('<source type="image/webp"');
    expect(html).toContain('src="data:image/jpeg;base64,AQ=="');
  });

  it("incluye captions VTT en los videos exportados", () => {
    const project = structuredClone(referenceStore);
    const video = {
      kind: "video",
      id: "video-caption-test",
      name: "Campaña de temporada",
      alt: "Modelos con prendas de la nueva colección",
      mimeType: "video/mp4",
      source: "data:video/mp4;base64,AAAA",
      width: 720,
      height: 1280,
      durationSeconds: 8,
      hash: "video-caption-hash",
    } as (typeof project.videos)[number];
    project.videos = [video];

    const html = renderVideo(project, video.id);

    expect(html).toContain('<track kind="captions" srclang="es" label="Español"');
    expect(html).toContain("data:text/vtt;charset=utf-8,");
    expect(html).toContain(encodeURIComponent("WEBVTT"));
  });

  it("expone controles de movimiento declarativos en el root", () => {
    const section = referenceStore.sections[0];
    if (!section) throw new Error("Fixture incompleto");
    const html = moduleRoot("test-motion", section, safeHtml("<p>Contenido</p>"));

    expect(html).toContain('data-motion-root="true"');
    expect(html).toContain(`data-motion-intensity="${section.motion.intensity / 10}"`);
    expect(html).toContain(`data-motion-entry="${section.motion.entryPoint}"`);
  });
});
