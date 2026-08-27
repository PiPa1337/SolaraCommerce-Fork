/**
 * Superficie Canvas sobre el núcleo único de mutaciones.
 *
 * El canvas nunca muta el DOM como fuente de verdad: cada confirmación del
 * usuario produce una ProjectMutation tipada que pasa por applyMutation, igual
 * que el sidebar y el canal IA. El harness es headless para tests; la UI del
 * popover se conecta en la fase del motor de interacción.
 */
import { applyMutation, createMutationRegistry, type ProjectMutation } from "@solara/core";
import type { StoreProjectV1 } from "@solara/project-schema";

export interface CanvasEditTarget {
  sectionId: string;
  fieldKey: string;
}

export function commitCanvasField(
  project: StoreProjectV1,
  target: CanvasEditTarget,
  value: unknown,
  options?: { at?: string },
): StoreProjectV1 {
  const mutation: ProjectMutation = {
    type: "section.field.update",
    sectionId: target.sectionId,
    fieldKey: target.fieldKey,
    value,
  };
  return applyMutation(
    project,
    createMutationRegistry(),
    mutation,
    { kind: "canvas", sessionId: "harness" },
    options,
  ).project;
}
