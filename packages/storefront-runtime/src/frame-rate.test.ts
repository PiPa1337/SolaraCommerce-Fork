import { describe, expect, it } from "vitest";
import { type FrameRateCapTarget, installFrameRateCap, MAX_APP_FPS } from "./frame-rate";

function fakeFrameRateTarget(): {
  target: FrameRateCapTarget;
  advance: (timestamp: number) => void;
} {
  let nextNativeHandle = 1;
  let nextTimerHandle = 1;
  const nativeCallbacks = new Map<number, FrameRequestCallback>();
  const timers = new Map<number, () => void>();
  const target: FrameRateCapTarget = {
    requestAnimationFrame: (callback) => {
      const handle = nextNativeHandle;
      nextNativeHandle += 1;
      nativeCallbacks.set(handle, callback);
      return handle;
    },
    cancelAnimationFrame: (handle) => {
      nativeCallbacks.delete(handle);
    },
    setTimeout: (handler) => {
      const handle = nextTimerHandle;
      nextTimerHandle += 1;
      timers.set(handle, handler);
      return handle;
    },
    clearTimeout: (handle) => {
      timers.delete(handle);
    },
  };

  return {
    target,
    advance: (timestamp) => {
      const callbacks = [...nativeCallbacks.values()];
      nativeCallbacks.clear();
      callbacks.forEach((callback) => {
        callback(timestamp);
      });
      const scheduledTimers = [...timers.values()];
      timers.clear();
      scheduledTimers.forEach((callback) => {
        callback();
      });
    },
  };
}

describe("cap de FPS del runtime", () => {
  it("limita un loop de 240 Hz a un máximo de 140 callbacks por segundo", () => {
    const fake = fakeFrameRateTarget();
    installFrameRateCap(fake.target, MAX_APP_FPS);
    let calls = 0;
    const tick = (timestamp: number) => {
      calls += 1;
      if (timestamp < 1_000) fake.target.requestAnimationFrame(tick);
    };
    fake.target.requestAnimationFrame(tick);

    for (let frame = 0; frame <= 240; frame += 1) {
      fake.advance((frame * 1_000) / 240);
    }

    expect(calls).toBeGreaterThan(0);
    expect(calls).toBeLessThanOrEqual(MAX_APP_FPS + 1);
  });

  it("no mantiene un frame nativo después de cancelar el último callback", () => {
    const fake = fakeFrameRateTarget();
    installFrameRateCap(fake.target, MAX_APP_FPS);
    let calls = 0;
    const handle = fake.target.requestAnimationFrame(() => {
      calls += 1;
    });
    fake.target.cancelAnimationFrame(handle);
    fake.advance(1_000);

    expect(calls).toBe(0);
  });
});
