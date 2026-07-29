export type AutosaveState = "saved" | "pending" | "saving" | "error";

type Listener = (state: AutosaveState) => void;

export class AutosaveQueue<Value> {
  private pending: Value | undefined;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private draining: Promise<void> | undefined;
  private state: AutosaveState = "saved";
  private readonly listeners = new Set<Listener>();

  constructor(
    private readonly save: (value: Value) => Promise<void>,
    private readonly delayMs = 550,
  ) {}

  get currentState(): AutosaveState {
    return this.state;
  }

  get hasUnsavedChanges(): boolean {
    return this.pending !== undefined || this.draining !== undefined || this.state === "error";
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    listener(this.state);
    return () => this.listeners.delete(listener);
  }

  schedule(value: Value): void {
    this.pending = value;
    this.setState("pending");
    if (this.draining !== undefined) return;
    this.clearTimer();
    this.timer = setTimeout(() => {
      this.timer = undefined;
      void this.drain().catch(() => undefined);
    }, this.delayMs);
  }

  async flush(): Promise<void> {
    this.clearTimer();
    await this.drain();
  }

  dispose(): void {
    this.clearTimer();
    this.listeners.clear();
  }

  private drain(): Promise<void> {
    if (this.draining !== undefined) return this.draining;
    if (this.pending === undefined) {
      return this.state === "error"
        ? Promise.reject(new Error("No hay un snapshot pendiente para reintentar."))
        : Promise.resolve();
    }

    this.draining = this.runDrain().finally(() => {
      this.draining = undefined;
    });
    return this.draining;
  }

  private async runDrain(): Promise<void> {
    while (this.pending !== undefined) {
      const snapshot = this.pending;
      this.pending = undefined;
      this.setState("saving");
      try {
        await this.save(snapshot);
      } catch (error) {
        this.pending ??= snapshot;
        this.setState("error");
        throw error;
      }
    }
    this.setState("saved");
  }

  private setState(state: AutosaveState): void {
    this.state = state;
    for (const listener of this.listeners) listener(state);
  }

  private clearTimer(): void {
    if (this.timer === undefined) return;
    clearTimeout(this.timer);
    this.timer = undefined;
  }
}
