import type { HistoryState } from "@solara/core";
import type { StoreProjectV1 } from "@solara/project-schema";

function withMonotonicPresent(history: HistoryState, next: HistoryState): HistoryState {
  if (next === history || next.present === history.present) return next;

  const currentTime = Date.parse(history.present.updatedAt);
  const nextTime = Date.parse(next.present.updatedAt);
  if (nextTime > currentTime) return next;

  return {
    ...next,
    present: {
      ...next.present,
      updatedAt: new Date(currentTime + 1).toISOString(),
    },
  };
}

/** Agrega un snapshot reversible sin permitir que el reloj del proyecto retroceda. */
export function pushHistorySnapshot(history: HistoryState, project: StoreProjectV1): HistoryState {
  if (project === history.present) return history;
  return withMonotonicPresent(history, {
    past: [...history.past, history.present],
    present: project,
    future: [],
  });
}

/** Ejecuta undo/redo y mantiene updatedAt monotónico aunque el snapshot sea antiguo. */
export function moveHistory(
  history: HistoryState,
  move: (history: HistoryState) => HistoryState,
): HistoryState {
  return withMonotonicPresent(history, move(history));
}
