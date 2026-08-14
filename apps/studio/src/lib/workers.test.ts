import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type Listener = (event: MessageEvent) => void;

class FakeWorker {
  url: string;
  messageListeners: Listener[] = [];
  errorListeners: Listener[] = [];
  posted: unknown[] = [];

  constructor(url: string | URL) {
    this.url = String(url);
  }

  addEventListener(type: string, listener: Listener): void {
    if (type === "message") this.messageListeners.push(listener);
    if (type === "error") this.errorListeners.push(listener);
  }

  removeEventListener(type: string, listener: Listener): void {
    if (type === "message") {
      this.messageListeners = this.messageListeners.filter((entry) => entry !== listener);
    }
    if (type === "error") {
      this.errorListeners = this.errorListeners.filter((entry) => entry !== listener);
    }
  }

  postMessage(message: unknown): void {
    this.posted.push(message);
  }

  fail(message = "worker roto"): void {
    for (const listener of [...this.errorListeners]) {
      listener({ message } as unknown as MessageEvent);
    }
  }

  respond(payload: unknown): void {
    for (const listener of [...this.messageListeners]) listener({ data: payload } as MessageEvent);
  }
}

describe("requestWorker con reintento", () => {
  let instances: FakeWorker[];
  let workers: typeof import("./workers");

  beforeEach(async () => {
    instances = [];
    vi.stubGlobal(
      "Worker",
      class extends FakeWorker {
        constructor(url: string | URL, options?: WorkerOptions) {
          super(url);
          void options;
          instances.push(this);
        }
      },
    );
    vi.resetModules();
    workers = await import("./workers");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("reintenta una vez con un worker nuevo cuando el actual muere", async () => {
    const promise = workers.importCsvInWorker("a,b\n1,2");
    const first = instances.find((instance) => instance.url.includes("csv.worker"));
    if (!first) throw new Error("primer worker csv no creado");
    const firstId = (first.posted[0] as { id: string }).id;

    first.fail();
    await new Promise((resolve) => setTimeout(resolve, 0));

    const csvInstances = instances.filter((instance) => instance.url.includes("csv.worker"));
    expect(csvInstances).toHaveLength(2);
    const second = csvInstances[1];
    if (!second) throw new Error("worker de reintento csv no creado");
    const secondId = (second.posted[0] as { id: string }).id;
    expect(secondId).toBe(firstId);

    second.respond({ id: secondId, ok: true, result: [] });
    await expect(promise).resolves.toEqual([]);
  });

  it("rechaza con diagnóstico cuando el reintento también falla", async () => {
    const promise = workers.importCsvInWorker("a,b\n1,2");
    const first = instances.find((instance) => instance.url.includes("csv.worker"));
    if (!first) throw new Error("primer worker csv no creado");
    first.fail();
    await new Promise((resolve) => setTimeout(resolve, 0));
    const csvInstances = instances.filter((instance) => instance.url.includes("csv.worker"));
    expect(csvInstances).toHaveLength(2);
    csvInstances[1]?.fail("crash duro");
    await expect(promise).rejects.toThrow(/reintento falló.*crash duro/);
  });

  it("propaga el error de negocio cuando el reintento responde", async () => {
    const promise = workers.readProjectArchiveInWorker({
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
    } as unknown as File);
    await new Promise((resolve) => setTimeout(resolve, 0));
    const first = instances.find((instance) => instance.url.includes("export.worker"));
    if (!first) throw new Error("primer worker export no creado");
    first.fail();
    await new Promise((resolve) => setTimeout(resolve, 0));
    const exportInstances = instances.filter((instance) => instance.url.includes("export.worker"));
    expect(exportInstances).toHaveLength(2);
    const second = exportInstances[1];
    if (!second) throw new Error("worker de reintento export no creado");
    const secondId = (second.posted[0] as { id: string }).id;
    second.respond({ id: secondId, ok: false, error: "respaldo corrupto" });
    await expect(promise).rejects.toThrow("respaldo corrupto");
  });
});
