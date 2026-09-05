/**
 * Lógica pura de galería mixta imagen/video, sin estado global.
 * ESPEJO de la función anidada en storefrontBoot (index.ts:selectGalleryImage):
 * mantener ambas idénticas. El boot no puede importarla porque se serializa
 * con fn.toString() y el bundler renombra los imports.
 * Cubierto por el test "serializa el selector mixto de galería".
 */
export function selectGalleryMedia(productRoot: HTMLElement, mediaId?: string): void {
  const figures = Array.from(
    productRoot.querySelectorAll<HTMLElement>("[data-gallery-media-id], [data-gallery-image-id]"),
  );
  if (figures.length === 0) return;
  const target =
    figures.find(
      (figure) =>
        figure.dataset.galleryMediaId === mediaId || figure.dataset.galleryImageId === mediaId,
    ) ?? figures[0];
  if (!target) return;
  figures.forEach((figure) => {
    const active = figure === target;
    figure.dataset.galleryActive = String(active);
    if (!active) {
      figure.querySelectorAll("video").forEach((video) => {
        try {
          video.pause();
        } catch {
          /* noop: jsdom o autoplay policy */
        }
      });
    }
  });
  productRoot.querySelectorAll<HTMLElement>("[data-gallery-thumb]").forEach((thumb) => {
    thumb.setAttribute(
      "aria-current",
      String(
        thumb.dataset.galleryThumb === target.dataset.galleryMediaId ||
          thumb.dataset.galleryThumb === target.dataset.galleryImageId,
      ),
    );
  });
}
