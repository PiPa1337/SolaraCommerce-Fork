import { describe, expect, it, vi } from "vitest";
import { AutosaveQueue } from "./autosave";

function deferred() {
  let resolve: (value?: void | PromiseLike<void>) => void = () => undefined;
  let reject: (reason?: unknown) => void = () => undefined;
  const promise = new Promise<void>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

describe("AutosaveQueue", () => {
  it("coalesce una ráfaga y persiste solamente el snapshot más reciente", async () => {
    vi.useFakeTimers();
    const saved: number[] = [];
    const queue = new AutosaveQueue<number>(async (value) => {
      saved.push(value);
    }, 550);

    for (let value = 1; value <= 20; value += 1) queue.schedule(value);
    await vi.advanceTimersByTimeAsync(550);

    expect(saved).toEqual([20]);
    expect(queue.currentState).toBe("saved");
    vi.useRealTimers();
  });

  it("serializa escrituras y conserva el cambio que llega durante una escritura", async () => {
    const first = deferred();
    const saved: number[] = [];
    const queue = new AutosaveQueue<number>(async (value) => {
      saved.push(value);
      if (value === 1) await first.promise;
    }, 0);

    queue.schedule(1);
    const flushing = queue.flush();
    queue.schedule(2);
    queue.schedule(3);
    expect(saved).toEqual([1]);

    first.resolve();
    await flushing;
    expect(saved).toEqual([1, 3]);
    expect(queue.currentState).toBe("saved");
  });

  it("flush persiste inmediatamente antes de navegar", async () => {
    vi.useFakeTimers();
    const saved: string[] = [];
    const queue = new AutosaveQueue<string>(async (value) => {
      saved.push(value);
    }, 10_000);

    queue.schedule("último");
    await queue.flush();

    expect(saved).toEqual(["último"]);
    expect(vi.getTimerCount()).toBe(0);
    vi.useRealTimers();
  });

  it("una escritura fallida no informa que el proyecto fue guardado", async () => {
    const states: string[] = [];
    let shouldFail = true;
    const queue = new AutosaveQueue<string>(async () => {
      if (shouldFail) throw new Error("Cuota agotada");
    }, 0);
    queue.subscribe((state) => states.push(state));

    queue.schedule("snapshot");
    await expect(queue.flush()).rejects.toThrow("Cuota agotada");
    expect(queue.currentState).toBe("error");
    expect(queue.hasUnsavedChanges).toBe(true);

    shouldFail = false;
    await queue.flush();
    expect(queue.currentState).toBe("saved");
    expect(states).toContain("error");
  });

  it("en reposo no programa timers: sólo corre cuando hay cambios pendientes", async () => {
    vi.useFakeTimers();
    const saved: number[] = [];
    const queue = new AutosaveQueue<number>(async (value) => {
      saved.push(value);
    }, 550);

    expect(vi.getTimerCount()).toBe(0);

    queue.schedule(1);
    expect(vi.getTimerCount()).toBe(1);

    await vi.advanceTimersByTimeAsync(550);
    expect(saved).toEqual([1]);
    expect(vi.getTimerCount()).toBe(0);

    await vi.advanceTimersByTimeAsync(60_000);
    expect(saved).toEqual([1]);
    expect(vi.getTimerCount()).toBe(0);
    vi.useRealTimers();
  });

  it("dispose cancela el timer pendiente y no vuelve a guardar", async () => {
    vi.useFakeTimers();
    const saved: number[] = [];
    const queue = new AutosaveQueue<number>(async (value) => {
      saved.push(value);
    }, 550);

    queue.schedule(1);
    queue.dispose();
    expect(vi.getTimerCount()).toBe(0);

    await vi.advanceTimersByTimeAsync(60_000);
    expect(saved).toEqual([]);
    vi.useRealTimers();
  });

  it("un fallo no reprograma el timer: no hay reintento en bucle en reposo", async () => {
    vi.useFakeTimers();
    const attempts: number[] = [];
    const queue = new AutosaveQueue<number>(async () => {
      attempts.push(1);
      throw new Error("Cuota agotada");
    }, 550);

    queue.schedule(1);
    await expect(queue.flush()).rejects.toThrow("Cuota agotada");
    expect(queue.currentState).toBe("error");
    expect(vi.getTimerCount()).toBe(0);

    await vi.advanceTimersByTimeAsync(60_000);
    expect(attempts).toEqual([1]);
    expect(vi.getTimerCount()).toBe(0);
    vi.useRealTimers();
  });
});
