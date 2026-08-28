/**
 * Bridge de seguridad para el Live Canvas.
 *
 * El iframe envía mensajes con session + nonce; el padre valida origen lógico
 * (event.source === iframe), sesión activa, nonce pendiente y schema del
 * mensaje antes de aceptar una selección. Los IDs de edición deben existir en
 * el manifest del preview actual.
 */

export interface CanvasSelectionMessage {
  type: "solara-canvas-select";
  session: string;
  nonce: string;
  editId: string;
  rect: { x: number; y: number; width: number; height: number };
  sectionId: string;
  /** Presente cuando el binding es repeater-item. */
  itemId?: string;
  moduleId?: string;
  entityId?: string;
  bindingKind?: string;
}

export type CanvasBridgeInbound = CanvasSelectionMessage;

export interface CanvasManifestEntryLike {
  editId: string;
  sectionId: string;
  fieldKey: string;
  kind?: string;
  itemFieldKey?: string;
  sourceKind?: string;
  entityId?: string;
  entityField?: string;
  label?: string;
  multiline?: boolean;
  maxLength?: number;
  itemIds?: readonly string[];
  moduleId?: string;
}

export interface CanvasBridgeOptions {
  activeSession: string;
  manifestEntries: readonly CanvasManifestEntryLike[];
  /** Nonces emitidos por el padre y aún no consumidos. */
  pendingNonces: ReadonlySet<string>;
  consumeNonce(nonce: string): void;
}

export interface ValidatedSelection {
  editId: string;
  sectionId: string;
  itemId?: string;
  rect: CanvasSelectionMessage["rect"];
  kind?: string;
  sourceKind?: string;
  entityId?: string;
  entityField?: string;
  fieldKey?: string;
  itemFieldKey?: string;
  label?: string;
  multiline?: boolean;
  maxLength?: number;
  moduleId?: string;
}

export function parseCanvasMessage(data: unknown): CanvasBridgeInbound | undefined {
  if (typeof data !== "object" || data === null) return undefined;
  const candidate = data as Record<string, unknown>;
  if (candidate.type !== "solara-canvas-select") return undefined;
  const { session, nonce, editId, rect, sectionId } = candidate as Record<string, unknown>;
  if (
    typeof session !== "string" ||
    typeof nonce !== "string" ||
    session.length > 200 ||
    nonce.length > 200
  )
    return undefined;
  if (typeof editId !== "string" || editId.length === 0 || editId.length > 200) return undefined;
  if (typeof sectionId !== "string" || sectionId.length === 0 || sectionId.length > 200)
    return undefined;
  const itemId = candidate.itemId;
  const moduleId = candidate.moduleId;
  const entityId = candidate.entityId;
  const bindingKind = candidate.bindingKind;
  if (
    itemId !== undefined &&
    (typeof itemId !== "string" || itemId.length === 0 || itemId.length > 200)
  )
    return undefined;
  if (
    (moduleId !== undefined &&
      (typeof moduleId !== "string" || moduleId.length === 0 || moduleId.length > 160)) ||
    (entityId !== undefined &&
      (typeof entityId !== "string" || entityId.length === 0 || entityId.length > 160)) ||
    (bindingKind !== undefined &&
      (typeof bindingKind !== "string" || bindingKind.length === 0 || bindingKind.length > 80))
  )
    return undefined;
  if (typeof rect !== "object" || rect === null) return undefined;
  const r = rect as Record<string, unknown>;
  const x = Number(r.x);
  const y = Number(r.y);
  const width = Number(r.width);
  const height = Number(r.height);
  if (
    ![x, y, width, height].every((value) => Number.isFinite(value)) ||
    width < 0 ||
    height < 0 ||
    width > 10000 ||
    height > 10000 ||
    Math.abs(x) > 100000 ||
    Math.abs(y) > 100000
  )
    return undefined;
  return {
    type: "solara-canvas-select",
    session,
    nonce,
    editId,
    sectionId,
    ...(itemId === undefined ? {} : { itemId }),
    ...(moduleId === undefined ? {} : { moduleId }),
    ...(entityId === undefined ? {} : { entityId }),
    ...(bindingKind === undefined ? {} : { bindingKind }),
    rect: { x, y, width, height },
  };
}

export function validateCanvasSelection(
  message: CanvasBridgeInbound,
  options: CanvasBridgeOptions,
): ValidatedSelection | undefined {
  if (message.session !== options.activeSession) return undefined;
  if (!options.pendingNonces.has(message.nonce)) return undefined;
  const entry = options.manifestEntries.find((candidate) => candidate.editId === message.editId);
  if (!entry) return undefined;
  if (entry.sectionId !== message.sectionId) return undefined;
  if (
    entry.kind === "image" &&
    message.bindingKind !== undefined &&
    message.bindingKind !== "image"
  ) {
    return undefined;
  }
  if (entry.kind !== "image" && message.bindingKind === "image") {
    return undefined;
  }
  if (entry.moduleId !== undefined && message.moduleId !== entry.moduleId) return undefined;
  if (entry.entityId !== undefined && message.entityId !== entry.entityId) return undefined;
  if (message.itemId !== undefined && entry.itemFieldKey === undefined) return undefined;
  if (message.itemId !== undefined && entry.itemIds && !entry.itemIds.includes(message.itemId)) {
    return undefined;
  }
  options.consumeNonce(message.nonce);
  return {
    editId: message.editId,
    sectionId: message.sectionId,
    ...(entry.kind === undefined ? {} : { kind: entry.kind }),
    ...(entry.sourceKind === undefined ? {} : { sourceKind: entry.sourceKind }),
    ...(entry.entityId === undefined ? {} : { entityId: entry.entityId }),
    ...(entry.entityField === undefined ? {} : { entityField: entry.entityField }),
    ...(entry.fieldKey === undefined ? {} : { fieldKey: entry.fieldKey }),
    ...(entry.itemFieldKey === undefined ? {} : { itemFieldKey: entry.itemFieldKey }),
    ...(entry.label === undefined ? {} : { label: entry.label }),
    ...(entry.multiline === undefined ? {} : { multiline: entry.multiline }),
    ...(entry.maxLength === undefined ? {} : { maxLength: entry.maxLength }),
    ...(entry.moduleId === undefined ? {} : { moduleId: entry.moduleId }),
    ...(message.itemId === undefined ? {} : { itemId: message.itemId }),
    rect: message.rect,
  };
}

export function makeCanvasNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

/** Script inyectado en el iframe del editor: escucha Ctrl y envía la selección. */
export function canvasBridgeScript(session: string, nonce: string): string {
  return `<script data-solara-canvas-bridge>
(() => {
  const session = ${JSON.stringify(session)};
  let activeNonce = ${JSON.stringify(nonce)};
  let ctrlActive = false;
  let explicitActive = false;
  const inspectionActive = () => ctrlActive || explicitActive;
  const send = (element) => {
    const editId = element.getAttribute("data-canvas-edit") ?? element.getAttribute("data-canvas-image") ?? "";
    const section = element.closest("[data-solara-section]");
    if (!editId || !section) return;
    const itemId = element.getAttribute("data-canvas-item");
    const module = section.closest("[data-solara-module]");
    const entityId = element.getAttribute("data-canvas-entity-id");
    const bindingKind = element.hasAttribute("data-canvas-image") ? "image" : "text";
    const rect = element.getBoundingClientRect();
    parent.postMessage({
      type: "solara-canvas-select",
      session,
      nonce: activeNonce,
      editId,
      sectionId: section.getAttribute("data-solara-section") ?? "",
      ...(itemId ? { itemId } : {}),
      ...(module?.getAttribute("data-solara-module") ? { moduleId: module.getAttribute("data-solara-module") } : {}),
      ...(entityId ? { entityId } : {}),
      bindingKind,
      rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
    }, "*");
  };
  window.addEventListener("keydown", (event) => {
    if (event.key === "Control") ctrlActive = true;
  });
  window.addEventListener("keyup", (event) => {
    if (event.key === "Control") ctrlActive = false;
  });
  window.addEventListener("blur", () => { ctrlActive = false; });
  window.addEventListener("message", (event) => {
    if (!event.data || typeof event.data !== "object") return;
    const message = event.data;
    if (message.type === "solara-canvas-nonce" && typeof message.nonce === "string" && message.nonce.length > 0 && message.nonce.length <= 200) {
      activeNonce = message.nonce;
      return;
    }
    if (message.type === "solara-canvas-mode" && typeof message.enabled === "boolean") {
      explicitActive = message.enabled;
      if (!explicitActive) {
        pendingTarget = null;
        overlay.style.display = "none";
        label.style.display = "none";
      }
    }
  });
  // Overlay de hover: un único elemento reposicionado con rAF; sin trabajo
  // por mousemove más allá de guardar coordenadas.
  const overlay = document.createElement("div");
  overlay.setAttribute("data-canvas-overlay", "");
  overlay.style.cssText = "position:fixed;pointer-events:none;z-index:2147483000;display:none;border:2px solid #2563eb;border-radius:2px;background:rgba(37,99,235,.08);";
  document.body.appendChild(overlay);
  const label = document.createElement("div");
  label.setAttribute("data-canvas-overlay-label", "");
  label.style.cssText = "position:fixed;pointer-events:none;z-index:2147483001;display:none;font:600 11px/1.4 system-ui,sans-serif;background:#2563eb;color:#fff;padding:2px 6px;border-radius:2px;";
  document.body.appendChild(label);
  // Un binding puede estar dentro de un enlace (por ejemplo, el título de una
  // card). Chromium puede reportar el enlace como event.target aunque el clic
  // haya caído sobre el descendiente instrumentado; en ese caso resolvemos el
  // binding visible por coordenadas y elegimos el más específico.
  const editableAtPoint = (event) => {
    const source = event.target;
    const direct = source instanceof Element ? source.closest("[data-canvas-edit], [data-canvas-image]") : null;
    if (direct) return direct;
    const hitStack = document.elementsFromPoint(event.clientX, event.clientY);
    for (const element of hitStack) {
      const candidate = element.closest?.("[data-canvas-edit], [data-canvas-image]");
      if (candidate) return candidate;
    }
    let best = null;
    let bestArea = Number.POSITIVE_INFINITY;
    document.querySelectorAll("[data-canvas-edit], [data-canvas-image]").forEach((candidate) => {
      const rect = candidate.getBoundingClientRect();
      if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) return;
      const area = rect.width * rect.height;
      if (area > 0 && area < bestArea) {
        best = candidate;
        bestArea = area;
      }
    });
    return best;
  };
  let pending = null;
  let pendingTarget = null;
  const paint = () => {
    pending = null;
    const target = pendingTarget;
    if (!target) { overlay.style.display = "none"; label.style.display = "none"; return; }
    const rect = target.getBoundingClientRect();
    overlay.style.display = "block";
    overlay.style.left = rect.x + "px";
    overlay.style.top = rect.y + "px";
    overlay.style.width = rect.width + "px";
    overlay.style.height = rect.height + "px";
    const editId = target.getAttribute("data-canvas-edit") ?? target.getAttribute("data-canvas-image") ?? "";
    label.textContent = editId.replace(/^ce-[^-]+-/, "").replace(/-/g, " ");
    label.style.display = "block";
    label.style.left = rect.x + "px";
    label.style.top = (rect.y - 18) + "px";
  };
  document.addEventListener("mousemove", (event) => {
    if (!inspectionActive()) { if (pendingTarget || overlay.style.display === "block") { pendingTarget = null; if (pending === null) pending = requestAnimationFrame(() => { pending = null; overlay.style.display = "none"; label.style.display = "none"; }); } return; }
    const target = editableAtPoint(event);
    if (target === pendingTarget) return;
    pendingTarget = target;
    if (pending === null) pending = requestAnimationFrame(paint);
  }, { passive: true });
  document.addEventListener("click", (event) => {
    if (!inspectionActive() && !event.ctrlKey && !event.metaKey) return;
    const editable = editableAtPoint(event);
    if (!editable) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    send(editable);
  }, true);
})();
</script>`;
}
