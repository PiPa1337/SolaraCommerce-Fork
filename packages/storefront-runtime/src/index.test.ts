import { referenceStore } from "@solara/project-schema/fixture";
import { describe, expect, it } from "vitest";
import {
  buildCartLine,
  buildWhatsAppMessage,
  buildWhatsAppUrl,
  formatMoney,
  minifyJsSource,
  parseCart,
  reconcileCartLines,
  STOREFRONT_RUNTIME_CSS,
  STOREFRONT_RUNTIME_JS,
} from "./index";

describe("storefront runtime", () => {
  it("genera un mensaje determinista con variante y SKU", () => {
    const product = referenceStore.products[0];
    const variant = product?.variants[0];
    if (!product || !variant) throw new Error("Fixture incompleto");

    const message = buildWhatsAppMessage(referenceStore, [buildCartLine(product, variant, 2)], {
      name: "Malena Ortiz",
      phone: "11 5555 0142",
      address: "Av. Forest 842, CABA",
      notes: "Entregar por la tarde",
    });

    expect(message).toContain("2 x Manta Bruma (Musgo) [ML-BRU-MUS]");
    expect(message).toContain(formatMoney(15_700_000));
    expect(message).toContain("Malena Ortiz");
  });

  it("codifica el enlace de WhatsApp", () => {
    const url = buildWhatsAppUrl("+54 9 11 2345-6789", "Pedido\nManta");
    expect(url).toBe("https://wa.me/5491123456789?text=Pedido%0AManta");
  });

  it("usa observadores sin listeners táctiles ni scrollY para el estado de scroll", () => {
    expect(STOREFRONT_RUNTIME_JS).not.toContain("scrollY");
    expect(STOREFRONT_RUNTIME_JS).not.toContain('addEventListener("wheel"');
    expect(STOREFRONT_RUNTIME_JS).not.toContain('addEventListener("touchstart"');
    expect(STOREFRONT_RUNTIME_JS).toContain("IntersectionObserver");
  });

  it("declara motion progresivo sin bloquear el HTML inicial", () => {
    expect(STOREFRONT_RUNTIME_CSS).toContain("--motion-intensity");
    expect(STOREFRONT_RUNTIME_CSS).toContain("prefers-reduced-motion");
    expect(STOREFRONT_RUNTIME_CSS).toContain("@keyframes solara-motion-fade-up");
    expect(STOREFRONT_RUNTIME_CSS).not.toContain(
      'html[data-motion-ready="true"] [data-motion-root]:not',
    );
    expect(STOREFRONT_RUNTIME_JS).toContain("motionEntry");
  });

  it("incluye comportamiento accesible para el popup de búsqueda", () => {
    expect(STOREFRONT_RUNTIME_JS).toContain("data-catalog-search-dialog");
    expect(STOREFRONT_RUNTIME_JS).toContain("data-catalog-search-open");
    expect(STOREFRONT_RUNTIME_JS).toContain("showModal");
    expect(STOREFRONT_RUNTIME_JS).toContain("data-catalog-search-close");
    expect(STOREFRONT_RUNTIME_JS).toContain("catalog-search-open");
  });

  it("conecta los controles de testimonios con su fila desplazable", () => {
    expect(STOREFRONT_RUNTIME_JS).toContain("data-testimonials-prev");
    expect(STOREFRONT_RUNTIME_JS).toContain("data-testimonials-next");
    expect(STOREFRONT_RUNTIME_JS).toContain("scrollLeft");
  });

  it("serializa los helpers de búsqueda dentro del runtime público", () => {
    expect(STOREFRONT_RUNTIME_JS).toContain("function levenshtein");
    expect(STOREFRONT_RUNTIME_JS).toContain("function scoreEntry");
    expect(STOREFRONT_RUNTIME_JS).toContain("function normalizeSearchTokens");
    expect(STOREFRONT_RUNTIME_JS).not.toContain("const matchToken = function matchToken");
    expect(STOREFRONT_RUNTIME_JS).toContain("storefrontBoot");
  });

  it("compacta el fuente de los helpers sin alterar strings ni comportamiento", () => {
    const compact = minifyJsSource(parseCart.toString());
    expect(compact.length).toBeLessThan(parseCart.toString().length);
    expect(compact).not.toContain("  ");
    const evaluated = new Function(`return (${compact})`)() as typeof parseCart;
    const sample = [
      { variantId: "v1", title: "T", variantTitle: "V", sku: "S", unitPrice: 100, quantity: 2 },
      { variantId: "v2", title: "T", variantTitle: "V", sku: "S", unitPrice: 100, quantity: 0 },
    ];
    expect(evaluated(sample)).toEqual(parseCart(sample));
    expect(evaluated("no es array")).toEqual([]);
    const withCatalog = minifyJsSource(reconcileCartLines.toString());
    expect(withCatalog).not.toContain("\n");
  });

  it("expone los helpers de búsqueda por un nombre canónico estable", () => {
    // La cadena debe definir bindings con nombre fijo (sobreviven minificación y
    // transpilación CJS) y el boot debe accederlos vía globalThis, nunca a
    // través de referencias de módulo que se reescriben al serializar.
    expect(STOREFRONT_RUNTIME_JS).toContain(
      "const normalizeSearchTokens = function normalizeSearchTokens",
    );
    expect(STOREFRONT_RUNTIME_JS).toContain("const scoreEntry = function scoreEntry");
    expect(STOREFRONT_RUNTIME_JS).toContain(
      "globalThis.__solaraSearchHelpers = { normalizeSearchTokens, levenshtein, scoreEntry }",
    );
    expect(STOREFRONT_RUNTIME_JS).toContain("searchApi.normalizeSearchTokens");
    expect(STOREFRONT_RUNTIME_JS).toContain("searchApi.scoreEntry");
    expect(STOREFRONT_RUNTIME_JS).not.toContain("__solaraSearchHelpers.__solaraSearchHelpers");
  });

  it("convierte el CTA del carrito en una salida útil cuando está vacío", () => {
    expect(STOREFRONT_RUNTIME_JS).toContain("data-cart-cta");
    expect(STOREFRONT_RUNTIME_JS).toContain("i !== +!!count");
  });

  it("mantiene el runtime por debajo de 56 KB crudos", () => {
    // Medición real al 2026-08-14: runtime JS 55.845 B en bytes crudos (sin gzip);
    // el techo subió de 53 a 56 KiB por el parallax de cursor del hero V2.
    expect(Buffer.byteLength(STOREFRONT_RUNTIME_JS, "utf8")).toBeLessThanOrEqual(56 * 1024);
  });
});

describe("parallax de cursor del hero V2 (connectHeroParallax)", () => {
  it("serializa el handler con guards de pointer fino, viewport y reduced motion", () => {
    expect(STOREFRONT_RUNTIME_JS).toContain("connectHeroParallax");
    expect(STOREFRONT_RUNTIME_JS).toContain('"[data-hero-media]"');
    expect(STOREFRONT_RUNTIME_JS).toContain('"(pointer: fine)"');
    expect(STOREFRONT_RUNTIME_JS).toContain('"(min-width: 768px)"');
    expect(STOREFRONT_RUNTIME_JS).toContain("translate3d");
    expect(STOREFRONT_RUNTIME_JS).toContain('addEventListener("pointermove"');
    expect(STOREFRONT_RUNTIME_JS).toContain("willChange");
    expect(STOREFRONT_RUNTIME_JS).toContain("IntersectionObserver");
  });

  it("no introduce scroll ni entrada táctil en el parallax", () => {
    expect(STOREFRONT_RUNTIME_JS).not.toContain("scrollY");
    expect(STOREFRONT_RUNTIME_JS).not.toContain('addEventListener("wheel"');
    expect(STOREFRONT_RUNTIME_JS).not.toContain('addEventListener("touchstart"');
  });
});

describe("fill-mode de los presets de motion", () => {
  const runtime = STOREFRONT_RUNTIME_CSS;
  const motionShorthand = (keyframe: string, delay = true) =>
    `animation: ${keyframe} var(--motion-duration, 600ms) var(--motion-easing, cubic-bezier(.16, 1, .3, 1))${
      delay ? " var(--motion-delay, 0ms)" : ""
    } backwards;`;

  it("los presets de entrada usan backwards y no congelan el hover", () => {
    const entrance = new Map<string, string>([
      ["fade", motionShorthand("solara-motion-fade")],
      ["fade-up", motionShorthand("solara-motion-fade-up")],
      ["slide", motionShorthand("solara-motion-slide")],
      ["scale", motionShorthand("solara-motion-scale")],
      // La regla de stagger no lleva delay en el shorthand.
      ["stagger", motionShorthand("solara-motion-fade-up", false)],
    ]);
    for (const [preset, rule] of entrance) {
      expect(runtime, `preset de entrada ${preset}`).toContain(rule);
    }
  });

  it("los presets scroll-driven conservan both", () => {
    expect(runtime).toContain("animation: solara-parallax linear both;");
    expect(runtime).toContain("animation: solara-progress linear both;");
  });

  it("deja both sólo en las reglas scroll-driven", () => {
    expect(runtime.match(/\bboth\b/g)?.length).toBe(2);
  });
});

describe("carrito robusto y checkout con precios frescos (C2/C3/C5/C9 + SF-B4/B5/B10)", () => {
  it("parseCart descarta líneas corruptas sin lanzar (C3)", () => {
    const lines = parseCart([
      {
        variantId: "v1",
        quantity: 2,
        title: "Manta Bruma",
        variantTitle: "Musgo",
        sku: "ML-BRU-MUS",
        unitPrice: 100,
      },
      { variantId: "v2", quantity: 1 },
      { variantId: "v3", quantity: 0 },
      { variantId: "v4", quantity: "dos" },
      "basura",
      null,
    ]);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toEqual(
      expect.objectContaining({ variantId: "v1", quantity: 2, title: "Manta Bruma" }),
    );
  });

  it("intercepta el submit del form de agregar para no recargar el carrito (C2)", () => {
    expect(STOREFRONT_RUNTIME_JS).toContain("data-solara-add-form");
    expect(STOREFRONT_RUNTIME_JS).toContain('addEventListener("submit"');
  });

  it("sincroniza aria-expanded del toggle de carrito al abrir y cerrar (C5)", () => {
    expect(STOREFRONT_RUNTIME_JS).toContain("data-solara-cart-open");
    expect(STOREFRONT_RUNTIME_JS).toContain("syncCartToggleExpanded");
  });

  it("anuncia los totales del carrito con aria-live (SF-B10)", () => {
    expect(STOREFRONT_RUNTIME_JS).toContain('setAttribute("aria-live", "polite")');
  });

  it("conserva el label de acción custom del módulo en syncVariant (SF-B5)", () => {
    expect(STOREFRONT_RUNTIME_JS).toContain("initialAddLabels");
    expect(STOREFRONT_RUNTIME_JS).toContain('"Sin stock"');
  });

  it("restaura la cantidad previa cuando el input queda vacío o en cero (C9)", () => {
    expect(STOREFRONT_RUNTIME_JS).toContain("value = String(previous.quantity)");
  });

  it("reconcilia el carrito compartido al abrir el drawer y al enviar (SF-B4)", () => {
    expect(STOREFRONT_RUNTIME_JS).toContain("reconcileCart");
    expect(STOREFRONT_RUNTIME_JS).toContain("catalog-index.json");
  });

  it("refresca el carrito persistido antes de agregar desde una página restaurada", () => {
    expect(STOREFRONT_RUNTIME_JS).toContain("if (!embed) cart = readStoredCart();");
  });

  it("usa el almacenamiento compartido en el preview portable", () => {
    expect(STOREFRONT_RUNTIME_JS).toContain('location.protocol[0] !== "s"');
    expect(STOREFRONT_RUNTIME_JS).toContain("if (!embed) cart = readStoredCart();");
  });
});

describe("carrito sin líneas fantasma y conteos honestos (F-04, SF-B7, SF-B8, C6, NG-4)", () => {
  it("reconcilia sin descartar: la línea sin variante en el catálogo queda marcada no disponible (F-04)", () => {
    const line = {
      productId: "p1",
      variantId: "v-retirada",
      title: "Manta Bruma",
      variantTitle: "Musgo",
      sku: "ML-BRU-MUS",
      unitPrice: 157000,
      quantity: 2,
    };
    const reconciled = reconcileCartLines(
      [line],
      [
        {
          productId: "p2",
          variantId: "v-activa",
          title: "Manta Luna",
          variantTitle: "Sombra",
          sku: "ML-BRU-LUN",
          price: 165000,
          available: true,
        },
      ],
    );
    expect(reconciled).toHaveLength(1);
    expect(reconciled[0]).toEqual(
      expect.objectContaining({ variantId: "v-retirada", available: false, quantity: 2 }),
    );
    const refreshed = reconcileCartLines(
      [{ ...line, variantId: "v-activa" }],
      [
        {
          productId: "p2",
          variantId: "v-activa",
          title: "Manta Luna",
          variantTitle: "Sombra",
          sku: "ML-BRU-LUN",
          price: 165000,
          available: true,
        },
      ],
    );
    expect(refreshed[0]).toEqual(
      expect.objectContaining({ variantId: "v-activa", available: true, unitPrice: 165000 }),
    );
    expect(STOREFRONT_RUNTIME_JS).toContain("Ya no disponible");
    expect(STOREFRONT_RUNTIME_JS).not.toContain("line.variantId in byVariant");
  });

  it("el conteo de categoría usa data-category-total sin pisar el total (SF-B8)", () => {
    expect(STOREFRONT_RUNTIME_JS).toContain('getAttribute("data-category-total")');
    expect(STOREFRONT_RUNTIME_JS).toContain(`de \${total} productos`);
  });

  it("la búsqueda avisa cuando el ranking se corta en 48 resultados (SF-B7)", () => {
    expect(STOREFRONT_RUNTIME_JS).toContain("Mostrando 48 de ");
    expect(STOREFRONT_RUNTIME_JS).toContain("Refiná tu búsqueda");
    expect(STOREFRONT_RUNTIME_JS).toContain("slice(0, 48)");
  });

  it("la trampa del drawer atiende carrito o checkout (C6)", () => {
    expect(STOREFRONT_RUNTIME_JS).toContain(
      'if (!hasFeature("cart") && !hasFeature("checkout")) return;',
    );
  });

  it("el input de cantidad del drawer arranca en 1 (NG-4)", () => {
    expect(STOREFRONT_RUNTIME_JS).toContain('type="number" min="1" max="99"');
  });

  it("el menú móvil inertea a sus hermanos al abrir y los libera al cerrar (SF-B13)", () => {
    expect(STOREFRONT_RUNTIME_JS).toContain("modernMenuSiblings");
    expect(STOREFRONT_RUNTIME_JS).toContain('sibling.setAttribute("inert", "")');
    expect(STOREFRONT_RUNTIME_JS).toContain('sibling.removeAttribute("inert")');
  });
});

describe("motion direction de slide (SF-B6)", () => {
  it("slide respeta up, down y right además de left", () => {
    expect(STOREFRONT_RUNTIME_CSS).toContain('[data-motion-direction="up"]');
    expect(STOREFRONT_RUNTIME_CSS).toContain('[data-motion-direction="down"]');
    expect(STOREFRONT_RUNTIME_CSS).toContain('[data-motion-direction="right"]');
    expect(STOREFRONT_RUNTIME_CSS).toContain("--motion-slide-y");
  });

  it("fade-up conserva su movimiento vertical propio", () => {
    expect(STOREFRONT_RUNTIME_CSS).toContain("@keyframes solara-motion-fade-up");
  });
});

describe("pausa y reanudación del runtime (contrato A3↔A4)", () => {
  it("se pausa y reanuda con mensajes postMessage del padre", () => {
    expect(STOREFRONT_RUNTIME_JS).toContain('"solara-pause"');
    expect(STOREFRONT_RUNTIME_JS).toContain('"solara-resume"');
    expect(STOREFRONT_RUNTIME_JS).toContain('addEventListener("message"');
    expect(STOREFRONT_RUNTIME_JS).toContain("event.source !== parent");
  });

  it("pausa el trabajo con la visibilidad del documento con un listener pasivo", () => {
    expect(STOREFRONT_RUNTIME_JS).toContain(
      'addEventListener("visibilitychange", onVisibility, { passive: true })',
    );
  });

  it("difiere el fetch del índice de búsqueda cuando el runtime está pausado", () => {
    expect(STOREFRONT_RUNTIME_JS).toContain("deferredSearch");
    expect(STOREFRONT_RUNTIME_JS).toContain('fetch("/search-index.json"');
  });

  it("registra los listeners de scroll como pasivos", () => {
    const registration = STOREFRONT_RUNTIME_JS.match(/addEventListener\("scroll",[^;]*\)/)?.[0];
    expect(registration).toBeDefined();
    expect(registration).toContain("{ passive: true }");
  });

  it("re-sincroniza variantes y carrito al reanudar", () => {
    expect(STOREFRONT_RUNTIME_JS).toContain("connectMotion()");
    expect(STOREFRONT_RUNTIME_JS).toContain("freshCatalog = null");
  });

  it("vincula la escritura del carrito embebido a la sesion activa del preview", () => {
    expect(STOREFRONT_RUNTIME_JS).toContain("previewCartSession");
    expect(STOREFRONT_RUNTIME_JS).toContain("session: previewCartSession");
  });

  it("mueve testimonios con scroll suave y expone el estado disabled", () => {
    expect(STOREFRONT_RUNTIME_JS).toContain("scrollBy({");
    expect(STOREFRONT_RUNTIME_JS).toContain(
      'behavior: matchMedia("(prefers-reduced-motion: reduce)")',
    );
    expect(STOREFRONT_RUNTIME_JS).toContain('setAttribute("aria-disabled"');
  });

  it("declara sizes compactos para la grilla de resultados de búsqueda", () => {
    expect(STOREFRONT_RUNTIME_JS).toContain(
      'sizes="(max-width: 767px) 46vw, (max-width: 1199px) 18rem, 13rem"',
    );
  });
});

describe("carrito y checkout del drawer (A29)", () => {
  it("refleja el conteo en el badge y en el aria-label del trigger", () => {
    expect(STOREFRONT_RUNTIME_JS).toContain("element.textContent = String(count)");
    expect(STOREFRONT_RUNTIME_JS).toContain(`\`\${label} vacío\``);
    expect(STOREFRONT_RUNTIME_JS).toContain(`\`\${label}, \${count} productos\``);
  });

  it("cierra el drawer con Escape y devuelve el foco al trigger", () => {
    expect(STOREFRONT_RUNTIME_JS).toContain('event.key === "Escape"');
    expect(STOREFRONT_RUNTIME_JS).toContain("trigger ?? document.activeElement");
    expect(STOREFRONT_RUNTIME_JS).toContain("lastCartTrigger?.focus()");
    expect(STOREFRONT_RUNTIME_JS).toContain("syncCartToggleExpanded(false)");
  });

  it("permite seguir comprando desde el drawer sin perder el carrito", () => {
    expect(STOREFRONT_RUNTIME_JS).toContain('target.closest("[data-close-cart]")');
    expect(STOREFRONT_RUNTIME_JS).toContain("renderCart()");
  });

  it("quita líneas por data-cart-remove y persiste el carrito", () => {
    expect(STOREFRONT_RUNTIME_JS).toContain(
      `data-cart-remove="\${escapeAttribute(line.variantId)}"`,
    );
    expect(STOREFRONT_RUNTIME_JS).toContain(
      "cart = cart.filter((line) => line.variantId !== variantId)",
    );
  });

  it("bloquea el checkout con role=alert y conserva la línea no disponible", () => {
    expect(STOREFRONT_RUNTIME_JS).toContain(
      "Retirá los productos no disponibles del carrito antes de enviar el pedido.",
    );
    expect(STOREFRONT_RUNTIME_JS).toContain('setAttribute("role", "alert")');
    expect(STOREFRONT_RUNTIME_JS).toContain(
      "if (cart.length === 0 || !form.reportValidity()) return;",
    );
  });

  it("construye la URL wa.me con teléfono normalizado y totales en centavos", () => {
    expect(STOREFRONT_RUNTIME_JS).toContain(
      `\`https://wa.me/\${phone.replace(/\\D/g, "")}?text=\${encodeURIComponent(message)}\``,
    );
    expect(STOREFRONT_RUNTIME_JS).toContain(`Total estimado: \${money.format(total / 100)}`);
    expect(STOREFRONT_RUNTIME_JS).toContain(
      "Entiendo que precio, disponibilidad, envío y pago se confirman",
    );
  });

  it("acota la cantidad editada y el agregado a 1–99", () => {
    expect(STOREFRONT_RUNTIME_JS).toContain("const quantity = Math.min(99, Math.trunc(parsed));");
    expect(STOREFRONT_RUNTIME_JS).toContain(
      'Math.max(1, Math.min(99, Math.trunc(Number(quantityInput?.value ?? "1"))))',
    );
  });
});

describe("fixmes del barrido A29 (index.ts)", () => {
  it("el drawer de carrito inertea a los hermanos al abrir y los libera al cerrar", () => {
    expect(STOREFRONT_RUNTIME_JS.match(/pageSiblingsOf\(drawer\)/g)?.length).toBe(2);
    expect(STOREFRONT_RUNTIME_JS).toContain('s.setAttribute("inert", "")');
    expect(STOREFRONT_RUNTIME_JS).toContain('s.removeAttribute("inert")');
  });

  it("la búsqueda guarda por término: un término de 1 carácter corta el query", () => {
    expect(STOREFRONT_RUNTIME_JS).toContain("terms.some((t) => t.length < 2)");
  });

  it("el conteo de categoría anuncia con aria-live al filtrar", () => {
    expect(STOREFRONT_RUNTIME_JS).toContain('resultCount?.setAttribute("aria-live", "polite")');
  });

  it("en /buscar/ el binding usa el input visible de la página, no el del diálogo", () => {
    expect(STOREFRONT_RUNTIME_JS).toContain('document.querySelector("#solara-search-input")');
    expect(STOREFRONT_RUNTIME_JS).not.toContain('"#catalog-search-input, #solara-search-input"');
  });
});
