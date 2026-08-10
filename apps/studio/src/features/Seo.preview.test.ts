import { referenceStore } from "@solara/project-schema/fixture";
import { describe, expect, it } from "vitest";
import { homepageSeoPreview } from "./Seo";

const GLOBAL_TITLE = "Título global de la tienda";
const GLOBAL_DESCRIPTION = "Descripción global de la tienda.";
const PAGE_TITLE = "Título exclusivo del Home";
const PAGE_DESCRIPTION = "Descripción exclusiva del Home.";

function withSeo(
  pages: Array<Partial<(typeof referenceStore.pages)[number]>>,
  seo: Partial<typeof referenceStore.seo>,
) {
  return {
    ...referenceStore,
    seo: { ...referenceStore.seo, ...seo },
    pages,
  } as typeof referenceStore;
}

describe("homepageSeoPreview: contrato con el exporter (ruta /)", () => {
  it("la página editable de Home manda sobre el seo global", () => {
    const project = withSeo(
      referenceStore.pages.map((page) =>
        page.kind === "home"
          ? { ...page, seoTitle: PAGE_TITLE, seoDescription: PAGE_DESCRIPTION }
          : page,
      ),
      { title: GLOBAL_TITLE, description: GLOBAL_DESCRIPTION },
    );
    expect(homepageSeoPreview(project)).toEqual({
      title: PAGE_TITLE,
      description: PAGE_DESCRIPTION,
    });
  });

  it("editar el seo global NO altera el preview cuando la página de Home tiene seo propio", () => {
    const project = withSeo(
      referenceStore.pages.map((page) =>
        page.kind === "home" ? { ...page, seoTitle: PAGE_TITLE } : page,
      ),
      { title: GLOBAL_TITLE },
    );
    expect(homepageSeoPreview(project).title).toBe(PAGE_TITLE);
  });

  it("la página de About no participa del preview de Home", () => {
    const project = withSeo(
      referenceStore.pages.map((page) => {
        if (page.kind === "about") {
          return {
            ...page,
            seoTitle: "Título de Nosotros",
            seoDescription: "Descripción de Nosotros.",
          };
        }
        if (page.kind === "home") {
          const { seoTitle: _homeTitle, seoDescription: _homeDescription, ...home } = page;
          return home;
        }
        return page;
      }),
      { title: GLOBAL_TITLE, description: GLOBAL_DESCRIPTION },
    );
    expect(homepageSeoPreview(project)).toEqual({
      title: GLOBAL_TITLE,
      description: GLOBAL_DESCRIPTION,
    });
  });

  it("sin página de Home cae al seo global", () => {
    expect(
      homepageSeoPreview(withSeo([], { title: GLOBAL_TITLE, description: GLOBAL_DESCRIPTION })),
    ).toEqual({
      title: GLOBAL_TITLE,
      description: GLOBAL_DESCRIPTION,
    });
  });

  it("con el seo global vacío cae a la identidad", () => {
    const project = withSeo([], { title: "", description: "" });
    expect(homepageSeoPreview(project)).toEqual({
      title: referenceStore.identity.brandName,
      description: referenceStore.identity.description,
    });
  });
});
