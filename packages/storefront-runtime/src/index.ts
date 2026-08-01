import type { Product, StoreProjectV1, Variant } from "@solara/project-schema";

export interface CartLine {
  productId: string;
  variantId: string;
  title: string;
  variantTitle: string;
  sku: string;
  unitPrice: number;
  quantity: number;
}

export interface CustomerDetails {
  name: string;
  phone: string;
  address: string;
  notes: string;
}

export function formatMoney(cents: number, currency = "ARS", locale = "es-AR"): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(cents / 100);
}

export function buildCartLine(product: Product, variant: Variant, quantity = 1): CartLine {
  return {
    productId: product.id,
    variantId: variant.id,
    title: product.title,
    variantTitle: variant.title,
    sku: variant.sku,
    unitPrice: variant.price,
    quantity,
  };
}

export function buildWhatsAppMessage(
  project: Pick<StoreProjectV1, "currency" | "locale" | "whatsapp">,
  lines: CartLine[],
  customer: CustomerDetails,
): string {
  const items = lines.map((line) => {
    const sku = project.whatsapp.includeSku && line.sku ? ` [${line.sku}]` : "";
    const lineTotal = formatMoney(line.unitPrice * line.quantity, project.currency, project.locale);
    return `- ${line.quantity} x ${line.title} (${line.variantTitle})${sku}: ${lineTotal}`;
  });
  const total = lines.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0);

  return [
    project.whatsapp.greeting.trim(),
    "",
    ...items,
    "",
    `Total estimado: ${formatMoney(total, project.currency, project.locale)}`,
    "",
    `Nombre: ${customer.name.trim()}`,
    `Teléfono: ${customer.phone.trim()}`,
    `Entrega: ${customer.address.trim()}`,
    customer.notes.trim() ? `Notas: ${customer.notes.trim()}` : "",
    "",
    "Entiendo que precio, disponibilidad, envío y pago se confirman por este medio.",
  ]
    .filter((line, index, all) => line !== "" || all[index - 1] !== "")
    .join("\n")
    .trim();
}

export function buildWhatsAppUrl(phone: string, message: string): string {
  return `https://wa.me/${phone.replace(/\D/g, "")}?text=${encodeURIComponent(message)}`;
}

function storefrontBoot(): void {
  type BrowserCartLine = {
    productId: string;
    variantId: string;
    title: string;
    variantTitle: string;
    sku: string;
    unitPrice: number;
    quantity: number;
  };

  const root = document.documentElement;
  const storeId = root.dataset.storeId ?? "solara";
  const currency = root.dataset.currency ?? "ARS";
  const locale = root.lang || "es-AR";
  const phone = root.dataset.whatsapp ?? "";
  const greeting = root.dataset.whatsappGreeting ?? "Hola, quiero hacer este pedido:";
  const includeSku = root.dataset.whatsappIncludeSku !== "false";
  const storageKey = `solara-cart:${storeId}`;
  const money = new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  });

  const parseCart = (): BrowserCartLine[] => {
    try {
      const stored = JSON.parse(localStorage.getItem(storageKey) ?? "[]") as unknown;
      return Array.isArray(stored)
        ? stored.filter(
            (line): line is BrowserCartLine =>
              typeof line === "object" &&
              line !== null &&
              typeof (line as BrowserCartLine).variantId === "string" &&
              typeof (line as BrowserCartLine).quantity === "number",
          )
        : [];
    } catch {
      return [];
    }
  };

  let cart = parseCart();

  const renderCart = (): void => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(cart));
    } catch {
      // The cart remains usable in memory when storage is blocked or full.
    }
    const count = cart.reduce((sum, line) => sum + line.quantity, 0);
    document.querySelectorAll<HTMLElement>("[data-cart-count]").forEach((element) => {
      element.textContent = String(count);
    });

    document.querySelectorAll<HTMLElement>("[data-cart-lines]").forEach((container) => {
      if (cart.length === 0) {
        container.innerHTML =
          '<p class="solara-cart-empty">Tu carrito está vacío. Elegí una pieza para comenzar.</p>';
        return;
      }

      container.innerHTML = cart
        .map(
          (line) => `
            <article class="solara-cart-line">
              <div>
                <strong>${escapeText(line.title)}</strong>
                <small>${escapeText(line.variantTitle)}</small>
              </div>
              <label>
                <span class="sr-only">Cantidad de ${escapeText(line.title)}</span>
                <input data-cart-quantity="${escapeAttribute(line.variantId)}" type="number" min="0" max="99" value="${line.quantity}">
              </label>
              <span>${money.format((line.unitPrice * line.quantity) / 100)}</span>
            </article>`,
        )
        .join("");
    });

    const total = cart.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0);
    document.querySelectorAll<HTMLElement>("[data-cart-total]").forEach((element) => {
      element.textContent = money.format(total / 100);
    });
  };

  const escapeText = (value: string): string =>
    value.replace(
      /[&<>"']/g,
      (character) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#039;",
        })[character] ?? character,
    );

  const escapeAttribute = escapeText;

  const openCart = (): void => {
    const drawer = document.querySelector<HTMLElement>("[data-cart-drawer]");
    if (!drawer) return;
    if (drawer instanceof HTMLDialogElement) {
      if (!drawer.open) drawer.showModal();
    } else {
      drawer.dataset.open = "true";
      drawer.removeAttribute("inert");
      drawer.setAttribute("aria-hidden", "false");
      document
        .querySelectorAll<HTMLElement>("[data-close-cart].solara-cart-backdrop")
        .forEach((backdrop) => {
          backdrop.hidden = false;
        });
    }
  };

  const closeCart = (): void => {
    const drawer = document.querySelector<HTMLElement>("[data-cart-drawer]");
    if (!drawer) return;
    if (drawer instanceof HTMLDialogElement) {
      drawer.close();
    } else {
      delete drawer.dataset.open;
      drawer.setAttribute("inert", "");
      drawer.setAttribute("aria-hidden", "true");
      document
        .querySelectorAll<HTMLElement>("[data-close-cart].solara-cart-backdrop")
        .forEach((backdrop) => {
          backdrop.hidden = true;
        });
    }
  };

  const selectedVariant = (productRoot: HTMLElement): HTMLElement | null => {
    const select = productRoot.querySelector<HTMLSelectElement>("[data-variant-select]");
    const id = select?.value ?? productRoot.dataset.defaultVariant;
    return id
      ? productRoot.querySelector<HTMLElement>(`[data-variant-data="${CSS.escape(id)}"]`)
      : null;
  };

  const syncVariant = (productRoot: HTMLElement): void => {
    const variant = selectedVariant(productRoot);
    if (!variant) return;
    const price = Number(variant.dataset.price ?? "0");
    const available = variant.dataset.available === "true";
    const button = productRoot.querySelector<HTMLButtonElement>("[data-add-to-cart]");
    const priceElement = productRoot.querySelector<HTMLElement>("[data-product-price]");
    if (priceElement) priceElement.textContent = money.format(price / 100);
    if (button) {
      button.disabled = !available;
      button.textContent = available ? "Agregar al carrito" : "Sin stock";
    }
  };

  document.addEventListener("change", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;

    if (target.matches("[data-variant-select]")) {
      const productRoot = target.closest<HTMLElement>("[data-product]");
      if (productRoot) {
        syncVariant(productRoot);
        const variantId = (target as HTMLSelectElement).value;
        const url = new URL(window.location.href);
        url.searchParams.set("variant", variantId);
        history.replaceState(null, "", url);
      }
    }

    if (target.matches("[data-cart-quantity]")) {
      const variantId = target.dataset.cartQuantity;
      const quantity = Math.max(0, Math.min(99, Number((target as HTMLInputElement).value)));
      cart = cart
        .map((line) => (line.variantId === variantId ? { ...line, quantity } : line))
        .filter((line) => line.quantity > 0);
      renderCart();
    }
  });

  document.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;

    const addButton = target.closest<HTMLElement>("[data-add-to-cart]");
    if (addButton) {
      event.preventDefault();
      const productRoot = addButton.closest<HTMLElement>("[data-product]");
      const variant = productRoot ? selectedVariant(productRoot) : null;
      if (!productRoot || !variant || variant.dataset.available !== "true") return;

      const variantId = variant.dataset.variantId ?? "";
      const quantityInput = productRoot.querySelector<HTMLInputElement>('input[name="quantity"]');
      const quantity = Math.max(1, Math.min(99, Number(quantityInput?.value ?? "1")));
      const existing = cart.find((line) => line.variantId === variantId);
      if (existing) {
        existing.quantity = Math.min(99, existing.quantity + quantity);
      } else {
        cart.push({
          productId: productRoot.dataset.productId ?? "",
          variantId,
          title: productRoot.dataset.productTitle ?? "",
          variantTitle: variant.dataset.variantTitle ?? "",
          sku: variant.dataset.sku ?? "",
          unitPrice: Number(variant.dataset.price ?? "0"),
          quantity,
        });
      }
      renderCart();
      openCart();
    }

    if (target.closest("[data-open-cart]")) openCart();

    if (target.closest("[data-close-cart]")) {
      closeCart();
    }
  });

  document.querySelectorAll<HTMLFormElement>("[data-checkout-form]").forEach((form) => {
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      if (cart.length === 0 || !form.reportValidity()) return;

      const data = new FormData(form);
      const itemLines = cart.map((line) => {
        const sku = includeSku && line.sku ? ` [${line.sku}]` : "";
        const total = money.format((line.unitPrice * line.quantity) / 100);
        return `- ${line.quantity} x ${line.title} (${line.variantTitle})${sku}: ${total}`;
      });
      const total = cart.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0);
      const notes = String(data.get("notes") ?? "").trim();
      const message = [
        greeting.trim(),
        "",
        ...itemLines,
        "",
        `Total estimado: ${money.format(total / 100)}`,
        "",
        `Nombre: ${String(data.get("name") ?? "").trim()}`,
        `Teléfono: ${String(data.get("phone") ?? "").trim()}`,
        `Entrega: ${String(data.get("address") ?? "").trim()}`,
        notes ? `Notas: ${notes}` : "",
        "",
        "Entiendo que precio, disponibilidad, envío y pago se confirman por este medio.",
      ]
        .filter((line, index, all) => line !== "" || all[index - 1] !== "")
        .join("\n")
        .trim();

      const url = `https://wa.me/${phone.replace(/\D/g, "")}?text=${encodeURIComponent(message)}`;
      const preview = form.querySelector<HTMLElement>("[data-order-preview]");
      const link = form.querySelector<HTMLAnchorElement>("[data-whatsapp-link]");
      if (preview) preview.textContent = message;
      if (link) {
        link.href = url;
        link.hidden = false;
        link.focus();
      }
    });
  });

  const queryVariant = new URLSearchParams(window.location.search).get("variant");
  if (queryVariant) {
    document.querySelectorAll<HTMLSelectElement>("[data-variant-select]").forEach((select) => {
      if (Array.from(select.options).some((option) => option.value === queryVariant)) {
        select.value = queryVariant;
        const productRoot = select.closest<HTMLElement>("[data-product]");
        if (productRoot) syncVariant(productRoot);
      }
    });
  }

  const motionRoots = Array.from(
    document.querySelectorAll<HTMLElement>("[data-motion-root]"),
  ).filter((element) => element.dataset.motionPreset !== "none");
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!reduceMotion && "IntersectionObserver" in window) {
    root.dataset.motionReady = "true";
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const element = entry.target as HTMLElement;
          const entryPoint = Number(element.dataset.motionEntry ?? "0.18");
          const triggerLine = window.innerHeight * (1 - Math.max(0, Math.min(1, entryPoint)));
          if (entry.isIntersecting && entry.boundingClientRect.top <= triggerLine) {
            element.dataset.motionVisible = "true";
            if (element.dataset.motionOnce !== "false") observer.unobserve(element);
          } else if (element.dataset.motionOnce === "false") {
            delete element.dataset.motionVisible;
          }
        });
      },
      { threshold: [0, 0.01] },
    );
    motionRoots.forEach((element) => {
      observer.observe(element);
    });
  } else {
    motionRoots.forEach((element) => {
      element.dataset.motionVisible = "true";
    });
  }

  const progressRoots = motionRoots.filter((element) =>
    ["parallax", "scroll-progress"].includes(element.dataset.motionPreset ?? ""),
  );
  if (!reduceMotion && progressRoots.length > 0) {
    let progressFrame = 0;
    const updateProgress = (): void => {
      progressFrame = 0;
      const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
      progressRoots.forEach((element) => {
        const rect = element.getBoundingClientRect();
        const progress = Math.max(
          0,
          Math.min(1, (viewportHeight - rect.top) / Math.max(1, viewportHeight + rect.height)),
        );
        element.style.setProperty("--motion-progress", progress.toFixed(4));
        if (element.dataset.motionPreset === "parallax") {
          const distance = Number(element.dataset.motionDistance ?? "24");
          const intensity = Number(element.dataset.motionIntensity ?? "1");
          element.style.setProperty(
            "--motion-parallax-y",
            `${((0.5 - progress) * distance * intensity).toFixed(2)}px`,
          );
        }
      });
    };
    const scheduleProgress = (): void => {
      if (progressFrame !== 0) return;
      progressFrame = window.requestAnimationFrame(updateProgress);
    };
    window.addEventListener("scroll", scheduleProgress, { passive: true });
    window.addEventListener("resize", scheduleProgress, { passive: true });
    scheduleProgress();
  }

  renderCart();
  document.querySelectorAll<HTMLElement>("[data-product]").forEach(syncVariant);
}

export const STOREFRONT_RUNTIME_JS = `(${storefrontBoot.toString()})();`;

export const STOREFRONT_RUNTIME_CSS = `
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

[data-cart-drawer] {
  width: min(31rem, 100%);
  max-width: none;
  height: 100dvh;
  max-height: 100dvh;
  margin: 0 0 0 auto;
  border: 0;
  color: var(--solara-text);
  background: var(--solara-background);
  box-shadow: -24px 0 64px rgb(18 25 21 / 0.14);
}

[data-cart-drawer]::backdrop {
  background: rgb(16 24 20 / 0.42);
}

.solara-cart-line {
  display: grid;
  grid-template-columns: 1fr 4rem auto;
  align-items: center;
  gap: 1rem;
  padding-block: 1rem;
  border-bottom: 1px solid var(--solara-border);
}

.solara-cart-line small {
  display: block;
  color: var(--solara-muted);
}

.solara-cart-line input {
  width: 100%;
  min-height: 2.5rem;
}

html[data-motion-ready="true"] [data-motion-root]:not([data-motion-preset="none"]):not([data-motion-visible="true"]) [data-motion-zone] {
  opacity: 0;
}

html[data-motion-ready="true"] [data-motion-root][data-motion-preset="fade-up"]:not([data-motion-visible="true"]) [data-motion-zone],
html[data-motion-ready="true"] [data-motion-root][data-motion-preset="stagger"]:not([data-motion-visible="true"]) [data-motion-zone] > * {
  transform: translate3d(0, calc(var(--motion-distance, 24px) * var(--motion-intensity, 1)), 0);
}

html[data-motion-ready="true"] [data-motion-root][data-motion-preset="stagger"]:not([data-motion-visible="true"]) [data-motion-zone] > * {
  opacity: 0;
}

html[data-motion-ready="true"] [data-motion-root][data-motion-preset="slide"]:not([data-motion-visible="true"]) [data-motion-zone] {
  transform: translate3d(calc(var(--motion-distance, 24px) * var(--motion-intensity, 1)), 0, 0);
}

html[data-motion-ready="true"] [data-motion-root][data-motion-preset="slide"][data-motion-direction="left"]:not([data-motion-visible="true"]) [data-motion-zone] {
  transform: translate3d(calc(var(--motion-distance, 24px) * var(--motion-intensity, 1) * -1), 0, 0);
}

html[data-motion-ready="true"] [data-motion-root][data-motion-preset="slide"][data-motion-direction="up"]:not([data-motion-visible="true"]) [data-motion-zone] {
  transform: translate3d(0, calc(var(--motion-distance, 24px) * var(--motion-intensity, 1)), 0);
}

html[data-motion-ready="true"] [data-motion-root][data-motion-preset="slide"][data-motion-direction="down"]:not([data-motion-visible="true"]) [data-motion-zone] {
  transform: translate3d(0, calc(var(--motion-distance, 24px) * var(--motion-intensity, 1) * -1), 0);
}

html[data-motion-ready="true"] [data-motion-root][data-motion-preset="scale"]:not([data-motion-visible="true"]) [data-motion-zone] {
  transform: scale(calc(1 - (0.03 * var(--motion-intensity, 1))));
}

[data-motion-root][data-motion-visible="true"] [data-motion-zone] {
  opacity: 1;
  transform: none;
  transition:
    opacity var(--motion-duration, 600ms) var(--motion-easing, cubic-bezier(.16, 1, .3, 1)) var(--motion-delay, 0ms),
    transform var(--motion-duration, 600ms) var(--motion-easing, cubic-bezier(.16, 1, .3, 1)) var(--motion-delay, 0ms);
}

[data-motion-root][data-motion-preset="stagger"][data-motion-visible="true"] [data-motion-zone] > * {
  opacity: 1;
  transform: none;
  transition:
    opacity var(--motion-duration, 600ms) var(--motion-easing, cubic-bezier(.16, 1, .3, 1)),
    transform var(--motion-duration, 600ms) var(--motion-easing, cubic-bezier(.16, 1, .3, 1));
}

[data-motion-root][data-motion-preset="stagger"][data-motion-visible="true"] [data-motion-zone] > :nth-child(2) { transition-delay: calc(var(--motion-delay, 0ms) + var(--motion-stagger, 80ms)); }
[data-motion-root][data-motion-preset="stagger"][data-motion-visible="true"] [data-motion-zone] > :nth-child(3) { transition-delay: calc(var(--motion-delay, 0ms) + var(--motion-stagger, 80ms) + var(--motion-stagger, 80ms)); }
[data-motion-root][data-motion-preset="stagger"][data-motion-visible="true"] [data-motion-zone] > :nth-child(4) { transition-delay: calc(var(--motion-delay, 0ms) + var(--motion-stagger, 80ms) + var(--motion-stagger, 80ms) + var(--motion-stagger, 80ms)); }
[data-motion-root][data-motion-preset="stagger"][data-motion-visible="true"] [data-motion-zone] > :nth-child(n+5) { transition-delay: calc(var(--motion-delay, 0ms) + var(--motion-stagger, 80ms) + var(--motion-stagger, 80ms) + var(--motion-stagger, 80ms) + var(--motion-stagger, 80ms)); }

@supports (animation-timeline: view()) {
  [data-motion-root][data-motion-preset="parallax"] [data-motion-zone] {
    animation: solara-parallax linear both;
    animation-timeline: view();
    animation-range: entry -10% exit 110%;
  }

  [data-motion-root][data-motion-preset="scroll-progress"] {
    transform-origin: left center;
    animation: solara-progress linear both;
    animation-timeline: view();
    animation-range: entry 0% cover 100%;
  }
}

@supports not (animation-timeline: view()) {
  [data-motion-root][data-motion-preset="parallax"][data-motion-visible="true"] [data-motion-zone] {
    transform: translate3d(0, var(--motion-parallax-y, 0px), 0);
  }

  [data-motion-root][data-motion-preset="scroll-progress"] {
    transform-origin: left center;
    transform: scaleX(var(--motion-progress, 1));
  }
}

[data-motion-root][data-motion-preset="layer-stack"] {
  position: sticky;
  top: var(--layer-top, 5rem);
}

@keyframes solara-parallax {
  from { transform: translate3d(0, -2%, 0) scale(1.03); }
  to { transform: translate3d(0, 2%, 0) scale(1.03); }
}

@keyframes solara-progress {
  from { transform: scaleX(0); }
  to { transform: scaleX(1); }
}

@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    scroll-behavior: auto !important;
    animation-duration: 0.001ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.001ms !important;
  }

  [data-motion-root],
  [data-motion-root] [data-motion-zone],
  [data-motion-root] [data-motion-zone] > * {
    opacity: 1 !important;
    transform: none !important;
  }
}

@media (max-width: 767px) {
  [data-motion-root][data-motion-preset="parallax"],
  [data-motion-root][data-motion-preset="layer-stack"] {
    position: static;
    animation: none;
    transform: none;
  }

  [data-motion-root][data-motion-preset="parallax"] [data-motion-zone] {
    transform: none;
  }
}
`;
