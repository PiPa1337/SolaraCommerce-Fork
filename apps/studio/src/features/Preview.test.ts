import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";
import { addPreviewNavigationBridge } from "./Preview";

class FakeElement {
  readonly attributes: Set<string>;
  target = "";

  constructor(
    readonly href: string,
    attributes: string[] = [],
  ) {
    this.attributes = new Set(attributes);
  }

  closest() {
    return this;
  }

  getAttribute(name: string) {
    return name === "href" ? this.href : null;
  }

  hasAttribute(name: string) {
    return this.attributes.has(name);
  }
}

class FakeAnchor extends FakeElement {}

function dispatchPreviewClick(anchor: FakeAnchor) {
  let listener: ((event: { target: FakeElement; preventDefault: () => void }) => void) | undefined;
  const messages: unknown[] = [];
  const state = {
    dataset: { key: "solara-cart:fixture", session: "preview-session" },
    textContent: "[]",
  };
  const document = {
    addEventListener: (
      _type: string,
      callback: (event: { target: FakeElement; preventDefault: () => void }) => void,
    ) => {
      listener = callback;
    },
    getElementById: () => state,
  };
  const bridgeScript = addPreviewNavigationBridge("<body></body>");
  const script = bridgeScript.match(
    /<script data-solara-preview-navigation>[\s\S]*?<\/script>/,
  )?.[0];
  if (!script) throw new Error("No se encontró el script de navegación del Preview.");

  runInNewContext(script.replace(/^<script[^>]*>/, "").replace(/<\/script>$/, ""), {
    document,
    Element: FakeElement,
    HTMLAnchorElement: FakeAnchor,
    parent: { postMessage: (message: unknown) => messages.push(message) },
  });

  let prevented = false;
  listener?.({
    target: anchor,
    preventDefault: () => {
      prevented = true;
    },
  });
  return { messages, prevented };
}

describe("puente de navegación del Preview", () => {
  it("deja que el runtime abra el carrito desde el enlace Abrir carrito", () => {
    const result = dispatchPreviewClick(new FakeAnchor("/carrito/", ["data-open-cart"]));

    expect(result.prevented).toBe(false);
    expect(result.messages).toEqual([]);
  });

  it("mantiene la navegación interna del Preview para los demás enlaces", () => {
    const result = dispatchPreviewClick(new FakeAnchor("/buscar/"));

    expect(result.prevented).toBe(true);
    expect(result.messages).toEqual([
      {
        type: "solara-preview-cart-snapshot",
        key: "solara-cart:fixture",
        value: "[]",
        session: "preview-session",
      },
      {
        type: "solara-preview-navigate",
        path: "/buscar/",
        session: "preview-session",
      },
    ]);
  });
});
