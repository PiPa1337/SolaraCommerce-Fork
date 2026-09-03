import { catalogModernV2Store } from "@solara/project-schema/catalog-modern-v2-fixture";
import { describe, expect, it, vi } from "vitest";
import { normalizeLoadedProject } from "./localProjectRepository";

const createProjectArchiveInWorker = vi.fn(async (project: unknown) =>
  new TextEncoder().encode(
    JSON.stringify({
      projectId: (project as { id: string }).id,
      id: (project as { id: string }).id,
      project,
    }),
  ),
);
const readProjectArchiveBytesInWorker = vi.fn(async (bytes: Uint8Array) =>
  JSON.parse(new TextDecoder().decode(bytes)),
);
const exportSiteInWorker = vi.fn(async () => ({
  files: new Map<string, string | Uint8Array>([["index.html", "<html></html>"]]),
}));
const saveLocalProject = vi.fn(async () => ({
  projectId: "x",
  version: 2,
  status: "synced" as const,
  folder: "f",
  key: "k",
  projectPath: "p",
  site: null,
}));

vi.mock("./workers", () => ({
  createProjectArchiveInWorker: (...args: unknown[]) => createProjectArchiveInWorker(...args),
  readProjectArchiveBytesInWorker: (...args: unknown[]) => readProjectArchiveBytesInWorker(...args),
  exportSiteInWorker: (...args: unknown[]) => exportSiteInWorker(...args),
}));

vi.mock("./localStorage", () => ({
  listLocalProjects: vi.fn(),
  readLocalProject: vi.fn(),
  saveLocalProject: (...args: unknown[]) => saveLocalProject(...args),
}));

vi.mock("./repository", () => ({
  optimizeProjectAssets: vi.fn(async (project: unknown) => project),
  repairProjectMediaMetadata: vi.fn((project: unknown) => project),
  saveProject: vi.fn(),
}));

describe("carga de proyectos administrados", () => {
  it("restaura las secciones V2 de Nosotros y Contacto al abrir un respaldo antiguo", () => {
    const stored = structuredClone(catalogModernV2Store);
    stored.pages = stored.pages.map((page) =>
      page.kind === "about" || page.kind === "contact" ? { ...page, sections: [] } : page,
    );
    stored.sections = stored.sections.filter(
      (section) => !["contact-form", "contact-channels"].includes(section.moduleId),
    );

    const loaded = normalizeLoadedProject(stored);

    expect(loaded.pages.find((page) => page.kind === "about")?.sections).toHaveLength(10);
    expect(loaded.pages.find((page) => page.kind === "contact")?.sections).toHaveLength(7);
    expect(loaded.sections.map((section) => section.moduleId)).toContain("contact-form");
    expect(loaded.sections.map((section) => section.moduleId)).toContain("contact-channels");
    expect(loaded.sections).toHaveLength(stored.sections.length + 2);
  });
});

describe("persistProjectToDisk", () => {
  it("no re-exporta el sitio cuando el proyecto ya está sincronizado", async () => {
    const { persistProjectToDisk } = await import("./localProjectRepository");
    const project = structuredClone(catalogModernV2Store);

    const first = await persistProjectToDisk(project, 1);
    expect(first.siteError).toBeUndefined();
    expect(exportSiteInWorker).toHaveBeenCalledTimes(1);
    expect(saveLocalProject.mock.calls[0]?.[2]).toEqual(expect.any(String));

    saveLocalProject.mockClear();
    const second = await persistProjectToDisk(project, 2);
    expect(exportSiteInWorker).toHaveBeenCalledTimes(1);
    expect(saveLocalProject).toHaveBeenCalledTimes(1);
    expect(saveLocalProject.mock.calls[0]?.[2]).toBeUndefined();
    expect(second.siteError).toBeUndefined();
  });

  it("re-exporta el sitio cuando el contenido del proyecto cambió", async () => {
    const { persistProjectToDisk } = await import("./localProjectRepository");
    const project = structuredClone(catalogModernV2Store);

    await persistProjectToDisk(project, 1);
    saveLocalProject.mockClear();
    exportSiteInWorker.mockClear();

    const edited = { ...project, name: "Otro nombre" };
    await persistProjectToDisk(edited, 2);

    expect(exportSiteInWorker).toHaveBeenCalledTimes(1);
    expect(saveLocalProject.mock.calls[0]?.[2]).toEqual(expect.any(String));
  });
});
