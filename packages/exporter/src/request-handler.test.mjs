import { createReadStream } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable } from "node:stream";
import { describe, expect, it, vi } from "vitest";
import { createSolaraRequestHandler } from "../scripts/solara-request-handler.mjs";

vi.mock("node:fs", async (importActual) => {
  const actual = await importActual();
  return { ...actual, createReadStream: vi.fn(actual.createReadStream) };
});

const projectId = "store-open-folder";
const shutdownCookieName = "solara_shutdown";

function projectJson() {
  return JSON.stringify({
    format: "solara-project",
    version: 2,
    projectId,
    exportedAt: "2026-08-07T10:00:00.000Z",
    project: { schemaVersion: 2, id: projectId, name: "Prueba", slug: "prueba" },
  });
}

function request(method, pathname, headers = {}, body) {
  return {
    method,
    pathname,
    headers,
    body,
    ...(body
      ? {
          [Symbol.asyncIterator]: () => Readable.from([Buffer.from(body)])[Symbol.asyncIterator](),
        }
      : {}),
  };
}

async function createProject(handler) {
  const storage = handler.storage;
  const transaction = await storage.beginSave({
    projectId,
    name: "Prueba",
    slug: "prueba",
    projectUpdatedAt: "2026-08-07T10:00:00.000Z",
    expectedVersion: null,
  });
  await storage.upload(
    transaction.transactionId,
    "project",
    Readable.from([Buffer.from(projectJson())]),
  );
  return storage.commit(transaction.transactionId);
}

describe("handler: abrir carpeta de una tienda", () => {
  it("abre la carpeta de una tienda existente con la cookie de sesión", async () => {
    const root = await mkdtemp(join(tmpdir(), "solara-handler-folder-"));
    try {
      const openFolderInExplorer = vi.fn(() => true);
      const handler = createSolaraRequestHandler({
        applicationRoot: root,
        shutdownToken: "token-test",
        openFolderInExplorer,
        onShutdown: () => {},
      });
      await createProject(handler);
      const response = await handler.handle(
        request("POST", `/__solara/storage/projects/${projectId}/open-folder`, {
          cookie: `${shutdownCookieName}=token-test`,
        }),
      );
      expect(response.status).toBe(200);
      expect(openFolderInExplorer).toHaveBeenCalledOnce();
      const body = JSON.parse(response.body);
      expect(body.ok).toBe(true);
      expect(body.folder).toMatch(/^prueba--[a-f0-9]{8}$/);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("responde 404 para tiendas inexistentes y 403 sin sesión", async () => {
    const root = await mkdtemp(join(tmpdir(), "solara-handler-folder-"));
    try {
      const handler = createSolaraRequestHandler({
        applicationRoot: root,
        shutdownToken: "token-test",
        openFolderInExplorer: vi.fn(() => true),
        onShutdown: () => {},
      });
      const missing = await handler.handle(
        request("POST", "/__solara/storage/projects/tienda-ausente/open-folder", {
          cookie: `${shutdownCookieName}=token-test`,
        }),
      );
      expect(missing.status).toBe(404);
      const unauthorized = await handler.handle(
        request("POST", `/__solara/storage/projects/${projectId}/open-folder`),
      );
      expect(unauthorized.status).toBe(403);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});

describe("handler: abrir el sitio público", () => {
  async function saveWithSite(storage, version, content) {
    const transaction = await storage.beginSave({
      projectId,
      name: "Prueba",
      slug: "prueba",
      projectUpdatedAt: `2026-08-07T1${version}:00:00.000Z`,
      expectedVersion: version === 1 ? null : version - 1,
    });
    await storage.upload(
      transaction.transactionId,
      "project",
      Readable.from([Buffer.from(projectJson())]),
    );
    await storage.upload(
      transaction.transactionId,
      "site",
      Readable.from([
        Buffer.from(
          JSON.stringify([
            { path: "index.html", encoding: "utf8", data: `<main>${content}</main>` },
          ]),
        ),
      ]),
    );
    return storage.commit(transaction.transactionId);
  }

  it("renueva el servidor del sitio tras un guardado con sitio nuevo", async () => {
    const root = await mkdtemp(join(tmpdir(), "solara-handler-site-"));
    let handler;
    try {
      handler = createSolaraRequestHandler({
        applicationRoot: root,
        shutdownToken: "token-test",
        onShutdown: () => {},
      });
      await saveWithSite(handler.storage, 1, "v1");
      const open1 = await handler.handle(
        request("POST", `/__solara/storage/projects/${projectId}/open-site`, {
          cookie: `${shutdownCookieName}=token-test`,
        }),
      );
      expect(open1.status).toBe(200);
      const url1 = JSON.parse(open1.body).url;
      await expect((await fetch(`${url1}/index.html`)).text()).resolves.toContain("v1");

      await saveWithSite(handler.storage, 2, "v2");
      const open2 = await handler.handle(
        request("POST", `/__solara/storage/projects/${projectId}/open-site`, {
          cookie: `${shutdownCookieName}=token-test`,
        }),
      );
      expect(open2.status).toBe(200);
      const url2 = JSON.parse(open2.body).url;
      await expect((await fetch(`${url2}/index.html`)).text()).resolves.toContain("v2");
    } finally {
      await handler?.close();
      await rm(root, { recursive: true, force: true });
    }
  });

  it("conserva el sitio que un preview abierto sigue sirviendo tras un guardado", async () => {
    const root = await mkdtemp(join(tmpdir(), "solara-handler-protected-"));
    let handler;
    try {
      handler = createSolaraRequestHandler({
        applicationRoot: root,
        shutdownToken: "token-test",
        onShutdown: () => {},
      });
      await saveWithSite(handler.storage, 1, "v1");
      const open1 = await handler.handle(
        request("POST", `/__solara/storage/projects/${projectId}/open-site`, {
          cookie: `${shutdownCookieName}=token-test`,
        }),
      );
      expect(open1.status).toBe(200);
      const url1 = JSON.parse(open1.body).url;
      await expect((await fetch(`${url1}/index.html`)).text()).resolves.toContain("v1");

      // El guardado pasa por la ruta de commit del handler, que protege
      // las keys que los servidores cacheados siguen sirviendo.
      const transaction = await handler.storage.beginSave({
        projectId,
        name: "Prueba",
        slug: "prueba",
        projectUpdatedAt: "2026-08-07T12:00:00.000Z",
        expectedVersion: 1,
      });
      await handler.storage.upload(
        transaction.transactionId,
        "project",
        Readable.from([Buffer.from(projectJson())]),
      );
      await handler.storage.upload(
        transaction.transactionId,
        "site",
        Readable.from([
          Buffer.from(
            JSON.stringify([{ path: "index.html", encoding: "utf8", data: "<main>v2</main>" }]),
          ),
        ]),
      );
      const commitResponse = await handler.handle(
        request("POST", `/__solara/storage/saves/${transaction.transactionId}/commit`, {
          cookie: `${shutdownCookieName}=token-test`,
        }),
      );
      expect(commitResponse.status).toBe(200);

      // El preview abierto sigue funcionando aunque la poda borró las
      // keys que ningún servidor cacheado protege.
      await expect((await fetch(`${url1}/index.html`)).text()).resolves.toContain("v1");

      // open-site de nuevo: cierra el server viejo y sirve la key nueva.
      const open2 = await handler.handle(
        request("POST", `/__solara/storage/projects/${projectId}/open-site`, {
          cookie: `${shutdownCookieName}=token-test`,
        }),
      );
      expect(open2.status).toBe(200);
      const url2 = JSON.parse(open2.body).url;
      await expect((await fetch(`${url2}/index.html`)).text()).resolves.toContain("v2");
      await expect(fetch(`${url1}/index.html`)).rejects.toThrow();
    } finally {
      await handler?.close();
      await rm(root, { recursive: true, force: true });
    }
  });

  it("no tumba el servidor si el archivo desaparece al servirlo", async () => {
    const root = await mkdtemp(join(tmpdir(), "solara-handler-stream-"));
    let handler;
    try {
      handler = createSolaraRequestHandler({
        applicationRoot: root,
        shutdownToken: "token-test",
        onShutdown: () => {},
      });
      await saveWithSite(handler.storage, 1, "v1");
      const open1 = await handler.handle(
        request("POST", `/__solara/storage/projects/${projectId}/open-site`, {
          cookie: `${shutdownCookieName}=token-test`,
        }),
      );
      const url1 = JSON.parse(open1.body).url;
      await expect((await fetch(`${url1}/index.html`)).text()).resolves.toContain("v1");

      // La próxima lectura falla como si el directorio hubiera sido
      // podado entre el stat y el stream: la respuesta puede ser 404 o
      // un socket cortado, pero nunca puede caer el servidor local.
      const broken = new Readable({ read() {} });
      vi.mocked(createReadStream).mockImplementationOnce(() => {
        queueMicrotask(() =>
          broken.emit("error", Object.assign(new Error("archivo borrado"), { code: "ENOENT" })),
        );
        return broken;
      });
      const outcome = await fetch(`${url1}/index.html`)
        .then((response) => response.status)
        .catch(() => 0);
      expect([0, 404, 500]).toContain(outcome);

      // El servidor local sigue respondiendo al almacenamiento.
      const status = await handler.handle(
        request("GET", "/__solara/storage/status", {
          cookie: `${shutdownCookieName}=token-test`,
        }),
      );
      expect(status.status).toBe(200);
    } finally {
      await handler?.close();
      await rm(root, { recursive: true, force: true });
    }
  });
});
