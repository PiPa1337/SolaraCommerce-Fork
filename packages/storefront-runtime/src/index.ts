/**
 * Mejora progresiva del storefront: carrito local, variantes, búsqueda, menú,
 * movimiento y WhatsApp. Se activa por capacidades presentes en el HTML y debe
 * dejar contenido y navegación utilizables cuando JavaScript falla.
 */
import type { Product, StoreProjectV1, Variant } from "@solara/project-schema";
import {
  levenshtein,
  matchToken,
  normalizeSearchTokens,
  type SearchEntryTokens,
  scoreEntry,
  type TokenMatch,
} from "./search";

interface SearchApi {
  normalizeSearchTokens: (value: string) => string[];
  levenshtein: (a: string, b: string) => number;
  matchToken: (term: string, token: string) => TokenMatch;
  scoreEntry: (queryTerms: readonly string[], entry: SearchEntryTokens) => number;
}

export interface CartLine {
  productId: string;
  variantId: string;
  title: string;
  variantTitle: string;
  sku: string;
  unitPrice: number;
  quantity: number;
  imageUrl?: string;
}

export interface StoredCartLine extends CartLine {
  imageWidth?: number;
  imageHeight?: number;
  available?: boolean;
}

export interface CatalogIndexEntry {
  productId: string;
  variantId: string;
  title: string;
  variantTitle: string;
  sku: string;
  price: number;
  available: boolean;
  imageUrl?: string;
  imageWidth?: number;
  imageHeight?: number;
}

/**
 * Reconciles stored cart lines against the current catalog index. Lines whose
 * variant no longer exists are kept but marked unavailable so the buyer can
 * see and remove them; found lines get fresh identity, price and availability.
 */
export function reconcileCartLines(
  cart: StoredCartLine[],
  catalog: CatalogIndexEntry[],
): StoredCartLine[] {
  const byVariant = new Map(catalog.map((entry) => [entry.variantId, entry]));
  return cart.map((line) => {
    const current = byVariant.get(line.variantId);
    if (!current) return { ...line, available: false };
    return {
      ...line,
      productId: current.productId,
      title: current.title,
      variantTitle: current.variantTitle,
      sku: current.sku,
      unitPrice: current.price,
      ...(current.imageUrl ? { imageUrl: current.imageUrl } : {}),
      ...(current.imageWidth ? { imageWidth: current.imageWidth } : {}),
      ...(current.imageHeight ? { imageHeight: current.imageHeight } : {}),
      available: current.available,
    };
  });
}

export function parseCart(stored: unknown): StoredCartLine[] {
  if (!Array.isArray(stored)) return [];
  return stored.filter(
    (line): line is StoredCartLine =>
      typeof line === "object" &&
      line !== null &&
      typeof (line as StoredCartLine).variantId === "string" &&
      (line as StoredCartLine).variantId.length > 0 &&
      typeof (line as StoredCartLine).title === "string" &&
      typeof (line as StoredCartLine).variantTitle === "string" &&
      typeof (line as StoredCartLine).sku === "string" &&
      typeof (line as StoredCartLine).unitPrice === "number" &&
      Number.isFinite((line as StoredCartLine).unitPrice) &&
      typeof (line as StoredCartLine).quantity === "number" &&
      Number.isFinite((line as StoredCartLine).quantity) &&
      (line as StoredCartLine).quantity >= 1 &&
      (line as StoredCartLine).quantity <= 99 &&
      ((line as StoredCartLine).imageUrl === undefined ||
        typeof (line as StoredCartLine).imageUrl === "string"),
  );
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

/**
 * Formats a stable customer/order message from reconciled cart lines; callers
 * should never pass prices read only from localStorage.
 */
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
  const declaredRuntimeFeatures = root.dataset.solaraRuntimeFeatures;
  const runtimeFeatures = new Set(
    (declaredRuntimeFeatures === undefined
      ? "cart,checkout,product,category,search,hero,motion,variants,filters,video"
      : declaredRuntimeFeatures
    )
      .split(",")
      .filter(Boolean),
  );
  const hasFeature = (feature: string): boolean => runtimeFeatures.has(feature);

  const readStoredCart = (): StoredCartLine[] => {
    try {
      const stored = JSON.parse(localStorage.getItem(storageKey) ?? "[]") as unknown;
      if (!Array.isArray(stored)) {
        localStorage.removeItem(storageKey);
        return [];
      }
      return parseCart(stored);
    } catch {
      try {
        localStorage.removeItem(storageKey);
      } catch {}
      return [];
    }
  };

  let cart = hasFeature("cart") || hasFeature("checkout") ? readStoredCart() : [];
  let lastCartTrigger: HTMLElement | null = null;
  let paused = false;
  const heroAutoplayControls: Array<{ stop: () => void; start: () => void }> = [];

  const initialAddLabels = new Map<HTMLElement, string>();
  document.querySelectorAll<HTMLElement>("[data-add-to-cart]").forEach((button) => {
    initialAddLabels.set(button, button.textContent?.trim() || "Agregar al carrito");
  });

  const pageType = document.querySelector<HTMLElement>("[data-solara-store]")?.dataset.pageType;

  const renderCart = (): void => {
    const active = document.activeElement;
    const focusedQuantity =
      active instanceof HTMLElement && active.matches("[data-cart-quantity]")
        ? active.dataset.cartQuantity
        : undefined;
    try {
      localStorage.setItem(storageKey, JSON.stringify(cart));
    } catch {}
    const count = cart.reduce((sum, line) => sum + line.quantity, 0);
    document.querySelectorAll<HTMLElement>("[data-cart-count]").forEach((element) => {
      element.textContent = String(count);
    });
    document.querySelectorAll<HTMLElement>("[data-solara-cart-open]").forEach((element) => {
      const label = element.dataset.cartLabel ?? "Carrito";
      element.setAttribute(
        "aria-label",
        count === 0 ? `${label} vacío` : `${label}, ${count} productos`,
      );
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
                ${line.imageUrl ? `<img src="${escapeAttribute(line.imageUrl)}" alt=""${line.imageWidth ? ` width="${line.imageWidth}"` : ""}${line.imageHeight ? ` height="${line.imageHeight}"` : ""} loading="lazy">` : ""}
                <div>
                <strong>${escapeText(line.title)}</strong>
                <small>${escapeText(line.variantTitle)}</small>
                ${line.available === false ? '<small class="solara-cart-line-warning">Ya no disponible</small>' : ""}
                </div>
              </div>
              <label>
                <span class="sr-only">Cantidad de ${escapeText(line.title)}</span>
                <input data-cart-quantity="${escapeAttribute(line.variantId)}" type="number" min="1" max="99" value="${line.quantity}"${line.available === false ? " disabled" : ""}>
              </label>
              <button type="button" data-cart-remove="${escapeAttribute(line.variantId)}" aria-label="Eliminar ${escapeAttribute(line.title)}">Eliminar</button>
              <span>${money.format((line.unitPrice * line.quantity) / 100)}</span>
            </article>`,
        )
        .join("");
    });

    const total = cart.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0);
    document.querySelectorAll<HTMLElement>("[data-cart-subtotal]").forEach((element) => {
      element.setAttribute("aria-live", "polite");
      element.textContent = money.format(total / 100);
    });
    document.querySelectorAll<HTMLElement>("[data-cart-total]").forEach((element) => {
      element.setAttribute("aria-live", "polite");
      element.textContent = money.format(total / 100);
    });
    if (focusedQuantity !== undefined) {
      document
        .querySelector<HTMLElement>(`[data-cart-quantity="${CSS.escape(focusedQuantity)}"]`)
        ?.focus();
    }
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

  const syncCartToggleExpanded = (expanded: boolean): void => {
    document.querySelectorAll<HTMLElement>("[data-solara-cart-open]").forEach((toggle) => {
      toggle.setAttribute("aria-expanded", String(expanded));
    });
  };

  let freshCatalog: Promise<boolean> | null = null;

  const applyCatalog = (catalog: CatalogIndexEntry[]): void => {
    cart = reconcileCartLines(cart, catalog);
    renderCart();
  };

  const reconcileCart = (): Promise<boolean> => {
    if (paused) return Promise.resolve(false);
    if (freshCatalog) return freshCatalog;
    freshCatalog = fetch("/catalog-index.json")
      .then((response) => {
        if (!response.ok) throw new Error("No se pudo cargar el catálogo actual.");
        return response.json() as Promise<CatalogIndexEntry[]>;
      })
      .then((catalog) => {
        applyCatalog(catalog);
        return true;
      })
      .catch(() => false);
    return freshCatalog;
  };

  const pageSiblingsOf = (drawer: HTMLElement): Element[] => {
    const root = drawer.closest("[data-solara-module]");
    if (!root?.parentElement) return [];
    return [...root.parentElement.children].filter((child) => child !== root);
  };

  const openCart = (): void => {
    const drawer = document.querySelector<HTMLElement>("[data-cart-drawer]");
    if (!drawer) return;
    syncCartToggleExpanded(true);
    void reconcileCart();
    lastCartTrigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
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
    for (const s of pageSiblingsOf(drawer)) s.setAttribute("inert", "");
    window.setTimeout(() => {
      drawer
        .querySelector<HTMLElement>(
          'button, input, select, textarea, a, [tabindex]:not([tabindex="-1"])',
        )
        ?.focus();
    }, 0);
  };

  const closeCart = (): void => {
    const drawer = document.querySelector<HTMLElement>("[data-cart-drawer]");
    if (!drawer) return;
    syncCartToggleExpanded(false);
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
    for (const s of pageSiblingsOf(drawer)) s.removeAttribute("inert");
    if (lastCartTrigger?.isConnected) lastCartTrigger.focus();
    lastCartTrigger = null;
  };

  const selectedVariant = (productRoot: HTMLElement): HTMLElement | null => {
    const select = productRoot.querySelector<HTMLSelectElement>("[data-variant-select]");
    const id = select?.value ?? productRoot.dataset.defaultVariant;
    return id
      ? productRoot.querySelector<HTMLElement>(`[data-variant-data="${CSS.escape(id)}"]`)
      : null;
  };

  const selectGalleryImage = (productRoot: HTMLElement, imageId?: string): void => {
    const figures = Array.from(
      productRoot.querySelectorAll<HTMLElement>("[data-gallery-image-id]"),
    );
    if (figures.length === 0) return;
    const target =
      figures.find((figure) => figure.dataset.galleryImageId === imageId) ?? figures[0];
    figures.forEach((figure) => {
      figure.dataset.galleryActive = String(figure === target);
    });
    productRoot.querySelectorAll<HTMLElement>("[data-gallery-thumb]").forEach((thumb) => {
      thumb.setAttribute(
        "aria-current",
        String(thumb.dataset.galleryThumb === target?.dataset.galleryImageId),
      );
    });
  };

  const syncVariant = (productRoot: HTMLElement): void => {
    const variant = selectedVariant(productRoot);
    if (!variant) return;
    const price = Number(variant.dataset.price ?? "0");
    const available = variant.dataset.available === "true";
    const button = productRoot.querySelector<HTMLButtonElement>("[data-add-to-cart]");
    const priceElement = productRoot.querySelector<HTMLElement>("[data-product-price]");
    const compareElement = productRoot.querySelector<HTMLElement>("[data-product-compare]");
    const skuElement = productRoot.querySelector<HTMLElement>("[data-product-sku]");
    const availabilityElement = productRoot.querySelector<HTMLElement>(
      "[data-product-availability]",
    );
    productRoot.querySelectorAll<HTMLButtonElement>("[data-variant-option]").forEach((option) => {
      option.setAttribute(
        "aria-pressed",
        String(option.dataset.variantId === variant.dataset.variantId),
      );
    });
    selectGalleryImage(productRoot, variant.dataset.imageId);
    if (priceElement) priceElement.textContent = money.format(price / 100);
    if (skuElement) skuElement.textContent = variant.dataset.sku ?? "";
    if (availabilityElement) availabilityElement.textContent = available ? "Disponible" : "Agotado";
    if (compareElement) {
      const compareAt = Number(variant.dataset.compareAt ?? "0");
      compareElement.textContent = compareAt > 0 ? money.format(compareAt / 100) : "";
      compareElement.hidden = !(compareAt > price);
    }
    if (button) {
      button.disabled = !available;
      button.textContent = available
        ? (initialAddLabels.get(button) ?? "Agregar al carrito")
        : "Sin stock";
    }
  };

  const syncProductTabs = (root: HTMLElement, active: string): void => {
    root.querySelectorAll<HTMLElement>("[data-product-tab-panel]").forEach((panel) => {
      panel.hidden = panel.dataset.productTabPanel !== active;
    });
    root.querySelectorAll<HTMLButtonElement>("[data-product-tab]").forEach((tab) => {
      tab.setAttribute("aria-selected", String(tab.dataset.productTab === active));
    });
  };

  if (hasFeature("product")) {
    document.querySelectorAll<HTMLElement>("[data-product-tabs]").forEach((root) => {
      const firstTab = root.querySelector<HTMLButtonElement>("[data-product-tab]");
      if (!firstTab) return;
      syncProductTabs(root, firstTab.dataset.productTab ?? "details");
      const tabs = Array.from(root.querySelectorAll<HTMLButtonElement>("[data-product-tab]"));
      tabs.forEach((tab) => {
        tab.addEventListener("click", () => {
          syncProductTabs(root, tab.dataset.productTab ?? "details");
        });
        tab.addEventListener("keydown", (event) => {
          if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
          event.preventDefault();
          const index = tabs.indexOf(tab);
          const nextIndex =
            event.key === "ArrowRight"
              ? (index + 1) % tabs.length
              : (index - 1 + tabs.length) % tabs.length;
          tabs[nextIndex]?.focus();
        });
      });
    });
  }

  document.addEventListener("change", (event) => {
    if (!hasFeature("product") && !hasFeature("cart")) return;
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
      const input = target as HTMLInputElement;
      const previous = cart.find((line) => line.variantId === variantId);
      if (!previous) return;
      const raw = input.value.trim();
      const parsed = Number(raw);
      if (raw === "" || !Number.isFinite(parsed) || parsed <= 0) {
        input.value = String(previous.quantity);
        return;
      }
      const quantity = Math.min(99, Math.trunc(parsed));
      cart = cart.map((line) => (line.variantId === variantId ? { ...line, quantity } : line));
      renderCart();
    }
  });

  const addProductToCart = (productRoot: HTMLElement | null): void => {
    const variant = productRoot ? selectedVariant(productRoot) : null;
    if (!productRoot || !variant || variant.dataset.available !== "true") return;

    const variantId = variant.dataset.variantId ?? "";
    const quantityInput = productRoot.querySelector<HTMLInputElement>('input[name="quantity"]');
    const quantity = Math.max(1, Math.min(99, Math.trunc(Number(quantityInput?.value ?? "1"))));
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
        ...(variant.dataset.imageUrl ? { imageUrl: variant.dataset.imageUrl } : {}),
        ...(variant.dataset.imageWidth ? { imageWidth: Number(variant.dataset.imageWidth) } : {}),
        ...(variant.dataset.imageHeight
          ? { imageHeight: Number(variant.dataset.imageHeight) }
          : {}),
        available: true,
      });
    }
    renderCart();
    openCart();
  };

  document.addEventListener("click", (event) => {
    if (!hasFeature("product") && !hasFeature("cart")) return;
    const target = event.target;
    if (!(target instanceof Element)) return;

    const galleryThumb = target.closest<HTMLElement>("[data-gallery-thumb]");
    if (galleryThumb) {
      const productRoot = galleryThumb.closest<HTMLElement>("[data-product]");
      if (productRoot) selectGalleryImage(productRoot, galleryThumb.dataset.galleryThumb);
      return;
    }

    const variantOption = target.closest<HTMLButtonElement>("[data-variant-option]");
    if (variantOption && !variantOption.disabled) {
      const productRoot = variantOption.closest<HTMLElement>("[data-product]");
      const select = productRoot?.querySelector<HTMLSelectElement>("[data-variant-select]");
      const variantId = variantOption.dataset.variantId;
      if (productRoot && select && variantId) {
        select.value = variantId;
        select.dispatchEvent(new Event("change", { bubbles: true }));
      }
      return;
    }

    const addButton = target.closest<HTMLElement>(
      "[data-add-to-cart],[data-testimonials-prev],[data-testimonials-next]",
    );
    if (addButton) {
      if (addButton.matches("[data-testimonials-prev],[data-testimonials-next]")) {
        const track = addButton
          .closest<HTMLElement>(".catalog-testimonials-section")
          ?.querySelector<HTMLElement>(".catalog-testimonials-track");
        if (track)
          track.scrollLeft += addButton.matches("[data-testimonials-prev]")
            ? -track.clientWidth
            : track.clientWidth;
        return;
      }
      event.preventDefault();
      addProductToCart(addButton.closest<HTMLElement>("[data-product]"));
    }

    if (target.closest("[data-open-cart]")) openCart();

    if (target.closest("[data-close-cart]")) {
      closeCart();
    }

    const removeButton = target.closest<HTMLElement>("[data-cart-remove]");
    if (removeButton) {
      const variantId = removeButton.dataset.cartRemove;
      cart = cart.filter((line) => line.variantId !== variantId);
      renderCart();
    }
  });

  document.querySelectorAll<HTMLFormElement>("[data-solara-add-form]").forEach((form) => {
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      if (!hasFeature("product") && !hasFeature("cart")) return;
      addProductToCart(form.closest<HTMLElement>("[data-product]"));
    });
  });

  document.addEventListener("keydown", (event) => {
    if (!hasFeature("cart") && !hasFeature("checkout")) return;
    const drawer = document.querySelector<HTMLElement>("[data-cart-drawer]");
    const drawerOpen =
      drawer instanceof HTMLDialogElement ? drawer.open : drawer?.dataset.open === "true";
    if (!drawer || !drawerOpen) return;
    if (event.key === "Escape") {
      event.preventDefault();
      closeCart();
      return;
    }
    if (event.key !== "Tab") return;
    const focusable = Array.from(
      drawer.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])',
      ),
    ).filter((element) => !element.hidden && element.getAttribute("aria-hidden") !== "true");
    if (focusable.length === 0) {
      event.preventDefault();
      drawer.focus();
      return;
    }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
  });

  document.querySelectorAll<HTMLFormElement>("[data-checkout-form]").forEach((form) => {
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      if (cart.length === 0 || !form.reportValidity()) return;
      void reconcileCart().then(() => {
        if (cart.length === 0) return;
        const unavailable = cart.filter((line) => line.available === false);
        if (unavailable.length > 0) {
          const preview = form.querySelector<HTMLElement>("[data-order-preview]");
          if (preview) {
            preview.textContent =
              "Retirá los productos no disponibles del carrito antes de enviar el pedido.";
            preview.setAttribute("role", "alert");
          }
          return;
        }

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
  });

  if (pageType === "cart" || pageType === "checkout") void reconcileCart();

  const updateChromeHeight = (): void => {
    if (paused) return;
    const chrome = Array.from(
      document.querySelectorAll<HTMLElement>(
        '[data-solara-module="announcement-bar"], [data-solara-module="editorial-header"]',
      ),
    ).reduce((total, element) => total + element.getBoundingClientRect().height, 0);
    root.style.setProperty("--solara-chrome-height", `${Math.ceil(chrome)}px`);
  };
  let chromeObserver: ResizeObserver | null = null;
  const connectChromeObserver = (): void => {
    if (!("ResizeObserver" in window)) return;
    const observer = new ResizeObserver(updateChromeHeight);
    document
      .querySelectorAll<HTMLElement>(
        '[data-solara-module="announcement-bar"], [data-solara-module="editorial-header"]',
      )
      .forEach((element) => {
        observer.observe(element);
      });
    chromeObserver = observer;
  };
  updateChromeHeight();
  connectChromeObserver();

  document
    .querySelectorAll<HTMLButtonElement>("[data-catalog-announcement-close]")
    .forEach((button) => {
      button.addEventListener("click", () => {
        const announcement = button.closest<HTMLElement>(
          '[data-solara-module="catalog-announcement"]',
        );
        if (!announcement) return;
        announcement.hidden = true;
        updateChromeHeight();
      });
    });

  const headers = Array.from(
    document.querySelectorAll<HTMLElement>('[data-solara-module="editorial-header"]'),
  );
  const sentinel = document.createElement("span");
  let headerObserver: IntersectionObserver | null = null;
  const connectHeaderObserver = (): void => {
    if (headers.length === 0 || !("IntersectionObserver" in window)) return;
    const observer = new IntersectionObserver(([entry]) => {
      const scrolled = entry ? !entry.isIntersecting : false;
      headers.forEach((header) => {
        header.dataset.scrolled = String(scrolled);
      });
    });
    observer.observe(sentinel);
    headerObserver = observer;
  };
  const hasIntersectionObserver = "IntersectionObserver" in window;
  if (headers.length > 0) {
    sentinel.dataset.solaraScrollSentinel = "true";
    sentinel.setAttribute("aria-hidden", "true");
    sentinel.style.cssText =
      "position:absolute;top:0;left:0;width:1px;height:1px;pointer-events:none;opacity:0";
    if (hasIntersectionObserver) {
      document.body.prepend(sentinel);
      connectHeaderObserver();
    } else {
      const syncScrolled = (): void => {
        const scrolled = document.documentElement.scrollTop > 0;
        headers.forEach((header) => {
          header.dataset.scrolled = String(scrolled);
        });
      };
      window.addEventListener("scroll", syncScrolled, { passive: true });
      syncScrolled();
    }
  }

  document
    .querySelectorAll<HTMLDetailsElement>(
      '[data-solara-module="editorial-header"] .solara-mobile-nav, [data-solara-module="editorial-header"] .solara-nav-dropdown',
    )
    .forEach((menu) => {
      const trigger = menu.querySelector<HTMLElement>(":scope > summary");
      const focusable = (): HTMLElement[] =>
        Array.from(
          menu.querySelectorAll<HTMLElement>(
            'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
          ),
        ).filter((element) => !element.hidden && element.getClientRects().length > 0);
      menu.addEventListener("keydown", (event) => {
        if (!menu.open) return;
        if (event.key === "Escape") {
          event.preventDefault();
          menu.open = false;
          trigger?.focus();
          return;
        }
        if (event.key !== "Tab") return;
        const items = focusable();
        if (items.length === 0) return;
        const first = items[0];
        const last = items[items.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      });
      menu.addEventListener("toggle", () => {
        if (menu.open) {
          focusable()[0]?.focus();
        }
      });
      menu.addEventListener("click", (event) => {
        if (!(event.target instanceof Element) || !event.target.closest("a")) return;
        menu.open = false;
      });
    });

  const modernMenu =
    document.querySelector<HTMLElement>("[data-catalog-mobile-menu]") ??
    document.querySelector<HTMLElement>("#catalog-mobile-menu");
  const modernMenuOpen = document.querySelector<HTMLButtonElement>("[data-catalog-menu-open]");
  const modernMenuClose = modernMenu?.querySelector<HTMLButtonElement>("[data-catalog-menu-close]");
  const modernMenuFocusable = (): HTMLElement[] =>
    modernMenu
      ? Array.from(
          modernMenu.querySelectorAll<HTMLElement>(
            'a[href], button:not([disabled]), input:not([disabled]), summary, select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
          ),
        ).filter((element) => !element.hidden && element.getClientRects().length > 0)
      : [];
  const modernMenuSiblings = (): HTMLElement[] =>
    modernMenu?.parentElement
      ? Array.from(modernMenu.parentElement.children).filter(
          (child): child is HTMLElement => child !== modernMenu,
        )
      : [];
  const closeModernMenu = (): void => {
    if (!modernMenu) return;
    modernMenu.hidden = true;
    modernMenu.setAttribute("inert", "");
    modernMenu.setAttribute("aria-hidden", "true");
    modernMenuSiblings().forEach((sibling) => {
      sibling.removeAttribute("inert");
    });
    modernMenuOpen?.setAttribute("aria-expanded", "false");
    document.documentElement.classList.remove("catalog-mobile-menu-open");
    modernMenuOpen?.focus();
  };
  modernMenuOpen?.addEventListener("click", () => {
    if (!modernMenu) return;
    modernMenu.hidden = false;
    modernMenu.removeAttribute("inert");
    modernMenu.setAttribute("aria-hidden", "false");
    modernMenuSiblings().forEach((sibling) => {
      sibling.setAttribute("inert", "");
    });
    modernMenuOpen.setAttribute("aria-expanded", "true");
    document.documentElement.classList.add("catalog-mobile-menu-open");
    modernMenuClose?.focus();
  });
  modernMenuClose?.addEventListener("click", closeModernMenu);
  modernMenu?.addEventListener("click", (event) => {
    if (event.target instanceof Element && event.target.closest("a")) closeModernMenu();
  });
  modernMenu?.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      closeModernMenu();
      return;
    }
    if (event.key !== "Tab") return;
    const focusable = modernMenuFocusable();
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
  });
  modernMenu?.querySelectorAll<HTMLDetailsElement>("details").forEach((details) => {
    details.addEventListener("toggle", () => {
      details
        .querySelector<HTMLElement>(":scope > summary")
        ?.setAttribute("aria-expanded", String(details.open));
    });
  });

  const modernNavMenu = document.querySelector<HTMLDetailsElement>(
    '[data-solara-module="catalog-header"] .catalog-nav-menu',
  );
  const modernNavSummary = modernNavMenu?.querySelector<HTMLElement>(":scope > summary");
  modernNavMenu?.addEventListener("toggle", () => {
    modernNavSummary?.setAttribute("aria-expanded", String(modernNavMenu.open));
  });
  modernNavMenu?.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    event.preventDefault();
    modernNavMenu.open = false;
    modernNavSummary?.focus();
  });
  document.addEventListener("click", (event) => {
    if (!modernNavMenu?.open || !(event.target instanceof Node)) return;
    if (!modernNavMenu.contains(event.target)) modernNavMenu.open = false;
  });

  const modernSearchDialog = document.querySelector<HTMLDialogElement>(
    "[data-catalog-search-dialog]",
  );
  const modernSearchOpeners = Array.from(
    document.querySelectorAll<HTMLButtonElement>("[data-catalog-search-open]"),
  );
  const modernSearchInput =
    modernSearchDialog?.querySelector<HTMLInputElement>("#catalog-search-input");
  let lastModernSearchTrigger: HTMLButtonElement | null = null;
  const closeModernSearch = (): void => {
    if (!modernSearchDialog) return;
    if (modernSearchDialog.open) modernSearchDialog.close();
    modernSearchOpeners.forEach((opener) => {
      opener.setAttribute("aria-expanded", "false");
    });
    document.documentElement.classList.remove("catalog-search-open");
    lastModernSearchTrigger?.focus();
  };
  modernSearchOpeners.forEach((opener) => {
    opener.addEventListener("click", () => {
      if (!modernSearchDialog) return;
      lastModernSearchTrigger = opener;
      modernSearchOpeners.forEach((item) => {
        item.setAttribute("aria-expanded", "false");
      });
      opener.setAttribute("aria-expanded", "true");
      if (typeof modernSearchDialog.showModal === "function") {
        if (!modernSearchDialog.open) modernSearchDialog.showModal();
      } else {
        modernSearchDialog.setAttribute("open", "true");
      }
      document.documentElement.classList.add("catalog-search-open");
      window.requestAnimationFrame(() => modernSearchInput?.focus());
    });
  });
  modernSearchDialog
    ?.querySelector<HTMLButtonElement>("[data-catalog-search-close]")
    ?.addEventListener("click", closeModernSearch);
  modernSearchDialog?.addEventListener("click", (event) => {
    if (event.target === modernSearchDialog) closeModernSearch();
  });
  modernSearchDialog?.addEventListener("cancel", (event) => {
    event.preventDefault();
    closeModernSearch();
  });
  modernSearchDialog?.addEventListener("close", () => {
    modernSearchOpeners.forEach((opener) => {
      opener.setAttribute("aria-expanded", "false");
    });
    document.documentElement.classList.remove("catalog-search-open");
  });

  document
    .querySelectorAll<HTMLElement>('[data-solara-module="catalog-hero"] .catalog-hero-inner')
    .forEach((hero) => {
      const slides = Array.from(
        hero.querySelectorAll<HTMLElement>("[data-catalog-hero-slide-panel]"),
      );
      if (slides.length < 2) return;
      const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const copy = hero.querySelector<HTMLElement>(".catalog-hero-copy");
      const title = copy?.querySelector<HTMLElement>("h1");
      const body = copy?.querySelector<HTMLElement>(".catalog-hero-body");
      const action = copy?.querySelector<HTMLAnchorElement>(".catalog-primary-action");
      let active = 0;
      let timer = 0;
      const setSlide = (index: number): void => {
        active = (index + slides.length) % slides.length;
        slides.forEach((slide, slideIndex) => {
          const selected = slideIndex === active;
          slide.hidden = !selected;
          slide.setAttribute("aria-hidden", String(!selected));
          hero
            .querySelector(`[data-catalog-hero-slide="${slideIndex}"]`)
            ?.setAttribute("aria-selected", String(selected));
        });
        const selected = slides[active];
        if (!selected) return;
        if (title) title.textContent = selected.dataset.title ?? "";
        if (body) body.textContent = selected.dataset.body ?? "";
        if (action) {
          action.textContent = selected.dataset.actionLabel ?? "Ver colección";
          action.href = selected.dataset.actionHref ?? "/";
        }
      };
      const stop = (): void => {
        if (timer) window.clearInterval(timer);
        timer = 0;
      };
      const start = (): void => {
        stop();
        if (reduceMotion || hero.dataset.autoplay !== "true") return;
        timer = window.setInterval(
          () => setSlide(active + 1),
          Number(hero.dataset.interval ?? "6000"),
        );
      };
      hero.querySelectorAll<HTMLElement>("[data-catalog-hero-slide]").forEach((indicator) => {
        indicator.addEventListener("click", () => {
          setSlide(Number(indicator.dataset.catalogHeroSlide ?? "0"));
          stop();
        });
      });
      hero.addEventListener("pointerenter", stop);
      hero.addEventListener("focusin", stop);
      heroAutoplayControls.push({ stop, start });
      setSlide(0);
      start();
    });

  document.querySelectorAll<HTMLElement>("[data-hero-mode]").forEach((hero) => {
    const video = hero.querySelector<HTMLVideoElement>("video");
    const toggle = hero.querySelector<HTMLButtonElement>("[data-hero-video-toggle]");
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const saveData = Boolean(
      (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData,
    );
    if (video && (reduceMotion || saveData)) {
      video.pause();
      video.removeAttribute("autoplay");
      video.preload = "none";
    }
    toggle?.addEventListener("click", () => {
      if (!video) return;
      if (video.paused) {
        void video.play();
        toggle.textContent = "Pausar video";
        toggle.setAttribute("aria-pressed", "false");
      } else {
        video.pause();
        toggle.textContent = "Reanudar video";
        toggle.setAttribute("aria-pressed", "true");
      }
    });

    const panels = Array.from(hero.querySelectorAll<HTMLElement>("[data-hero-slide-panel]"));
    if (panels.length === 0) return;
    const copy = hero.querySelector<HTMLElement>(".solara-hero-media-copy");
    const eyebrow = copy?.querySelector<HTMLElement>(".solara-eyebrow");
    const heading = copy?.querySelector<HTMLElement>("h1");
    const body = copy?.querySelector<HTMLElement>(".solara-hero-body");
    const action = copy?.querySelector<HTMLAnchorElement>(".solara-primary-action");
    let activeIndex = 0;
    let timer = 0;
    let interactionPaused = false;
    const setSlide = (nextIndex: number): void => {
      activeIndex = (nextIndex + panels.length) % panels.length;
      panels.forEach((panel, index) => {
        panel.setAttribute("data-hero-active", String(index === activeIndex));
        panel.setAttribute("aria-hidden", String(index !== activeIndex));
      });
      const panel = panels[activeIndex];
      if (!panel) return;
      const nextEyebrow = panel.dataset.heroEyebrow ?? "";
      if (eyebrow) {
        eyebrow.textContent = nextEyebrow;
        eyebrow.hidden = !nextEyebrow;
      }
      if (heading) heading.textContent = panel.dataset.heroTitle ?? "";
      if (body) body.textContent = panel.dataset.heroBody ?? "";
      if (action) {
        action.textContent = panel.dataset.heroActionLabel ?? "Ver colección";
        action.href = panel.dataset.heroActionHref ?? "/";
      }
      hero.querySelectorAll<HTMLElement>("[data-hero-slide]").forEach((indicator) => {
        indicator.setAttribute(
          "aria-selected",
          indicator.dataset.heroSlide === String(activeIndex) ? "true" : "false",
        );
      });
    };
    setSlide(0);
    const stopAutoplay = (): void => {
      if (timer !== 0) window.clearInterval(timer);
      timer = 0;
    };
    const startAutoplay = (): void => {
      stopAutoplay();
      if (reduceMotion || hero.dataset.heroAutoplay !== "true" || panels.length < 2) return;
      timer = window.setInterval(
        () => setSlide(activeIndex + 1),
        Number(hero.dataset.heroInterval ?? "6000"),
      );
    };
    hero.querySelector<HTMLElement>("[data-hero-prev]")?.addEventListener("click", () => {
      setSlide(activeIndex - 1);
      interactionPaused = true;
      stopAutoplay();
    });
    hero.querySelector<HTMLElement>("[data-hero-next]")?.addEventListener("click", () => {
      setSlide(activeIndex + 1);
      interactionPaused = true;
      stopAutoplay();
    });
    hero.querySelectorAll<HTMLElement>("[data-hero-slide]").forEach((indicator) => {
      indicator.addEventListener("click", () => {
        setSlide(Number(indicator.dataset.heroSlide ?? "0"));
        interactionPaused = true;
        stopAutoplay();
      });
    });
    hero.addEventListener("pointerenter", stopAutoplay);
    hero.addEventListener("focusin", stopAutoplay);
    hero.addEventListener("pointerdown", () => {
      interactionPaused = true;
      stopAutoplay();
    });
    hero.addEventListener("pointerleave", () => {
      if (!interactionPaused) startAutoplay();
    });
    document.addEventListener(
      "visibilitychange",
      () => (document.hidden ? stopAutoplay() : interactionPaused ? undefined : startAutoplay()),
      { passive: true },
    );
    heroAutoplayControls.push({
      stop: stopAutoplay,
      start: () => {
        if (!interactionPaused) startAutoplay();
      },
    });
    startAutoplay();
  });

  const searchInput = document.querySelector<HTMLInputElement>("#solara-search-input");
  const searchResults = document.querySelector<HTMLElement>("[data-search-results]");
  if (searchInput && searchResults) {
    const searchApi = (
      globalThis as typeof globalThis & {
        __solaraSearchHelpers: SearchApi;
      }
    ).__solaraSearchHelpers;
    type SearchEntryWithTokens = {
      title: string;
      brand: string;
      description: string;
      tags?: string[];
      categoryIds?: string[];
      collectionIds?: string[];
      categoryNames?: string[];
      collectionNames?: string[];
      path: string;
      imageUrl?: string;
      imageWidth?: number;
      imageHeight?: number;
      priceMin: number;
      available: boolean;
      tokens?: SearchEntryTokens;
    };
    const suggestCorrection = (
      terms: string[],
      entries: SearchEntryWithTokens[],
    ): string | undefined => {
      let best: { term: string; distance: number } | undefined;
      for (const term of terms) {
        if (term.length < 3) continue;
        for (const entry of entries) {
          const candidates = [
            ...(entry.tokens?.title ?? searchApi.normalizeSearchTokens(entry.title)),
            ...(entry.tokens?.brand ?? searchApi.normalizeSearchTokens(entry.brand)),
          ];
          for (const token of candidates) {
            const distance = searchApi.levenshtein(term, token);
            if (distance <= 2 && (!best || distance < best.distance)) {
              best = { term: token, distance };
            }
          }
        }
      }
      return best?.term;
    };
    const query = new URLSearchParams(window.location.search).get("q") ?? "";
    searchInput.value = query;
    if (query) {
      document.querySelector('meta[name="robots"]')?.setAttribute("content", "noindex,follow");
      const terms = searchApi.normalizeSearchTokens(query);
      if (!terms.length || terms.some((t) => t.length < 2)) {
        searchResults.innerHTML = "<p>Escribí al menos 2 caracteres para buscar.</p>";
      } else {
        const controller = new AbortController();
        searchResults.innerHTML = "<p>Cargando resultados…</p>";
        fetch("/search-index.json", { signal: controller.signal })
          .then((response) => {
            if (!response.ok) throw new Error("No se pudo cargar el índice de búsqueda.");
            return response.json() as Promise<SearchEntryWithTokens[]>;
          })
          .then((entries) => {
            const ranked = entries
              .map((entry) => ({
                entry,
                score: searchApi.scoreEntry(
                  terms,
                  entry.tokens ?? {
                    title: searchApi.normalizeSearchTokens(entry.title),
                    brand: searchApi.normalizeSearchTokens(entry.brand),
                    tags: searchApi.normalizeSearchTokens((entry.tags ?? []).join(" ")),
                    categories: searchApi.normalizeSearchTokens(
                      `${(entry.categoryIds ?? []).join(" ")} ${(entry.collectionIds ?? []).join(" ")} ${(entry.categoryNames ?? []).join(" ")} ${(entry.collectionNames ?? []).join(" ")}`,
                    ),
                    description: searchApi.normalizeSearchTokens(entry.description),
                  },
                ),
              }))
              .filter((item) => item.score > 0)
              .sort(
                (left, right) =>
                  right.score - left.score ||
                  Number(right.entry.available) - Number(left.entry.available) ||
                  left.entry.title.localeCompare(right.entry.title),
              );
            if (ranked.length === 0) {
              const suggestion = suggestCorrection(terms, entries);
              if (suggestion) {
                const url = `/buscar/?q=${encodeURIComponent(suggestion)}`;
                searchResults.innerHTML = `<p class="solara-search-summary">No encontramos resultados para “${escapeText(query)}”. ¿Quisiste decir <a href="${escapeAttribute(url)}">${escapeText(suggestion)}</a>?</p>`;
                return;
              }
              searchResults.innerHTML = "<p>No encontramos productos para esa búsqueda.</p>";
              return;
            }
            const shown = ranked.slice(0, 48);
            const cutNotice =
              ranked.length > 48
                ? `<p class="solara-search-summary">Mostrando 48 de ${ranked.length} resultados. Refiná tu búsqueda…</p>`
                : "";
            searchResults.innerHTML = `<p class="solara-search-summary">Resultados para “${escapeText(query)}”</p>${cutNotice}<div class="solara-search-results-grid">${shown
              .map(
                ({ entry }) =>
                  `<article class="solara-search-result"><a href="${escapeAttribute(entry.path)}">${entry.imageUrl ? `<img src="${escapeAttribute(entry.imageUrl)}" alt="${escapeAttribute(entry.title)}" width="${entry.imageWidth ?? 1}" height="${entry.imageHeight ?? 1}" loading="lazy">` : ""}<div><h2>${escapeText(entry.title)}</h2><p>${escapeText(entry.brand)}</p><strong>${money.format(entry.priceMin / 100)}</strong></div></a></article>`,
              )
              .join("")}</div>`;
          })
          .catch(() => {
            searchResults.innerHTML =
              '<p role="alert">No se pudo cargar la búsqueda. Intentá nuevamente.</p>';
          });
        window.addEventListener("pagehide", () => controller.abort(), { once: true });
      }
    }
  }

  searchInput?.addEventListener("keydown", (event) => {
    if (event.key !== "ArrowDown") return;
    const firstResult = searchResults?.querySelector<HTMLElement>(".solara-search-result a");
    if (!firstResult) return;
    event.preventDefault();
    firstResult.focus();
  });
  searchResults?.addEventListener("keydown", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement) || !target.matches(".solara-search-result a")) return;
    const links = Array.from(
      searchResults.querySelectorAll<HTMLElement>(".solara-search-result a"),
    );
    const currentIndex = links.indexOf(target);
    if (event.key === "ArrowDown" && links[currentIndex + 1]) {
      event.preventDefault();
      links[currentIndex + 1]?.focus();
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      (links[currentIndex - 1] ?? searchInput)?.focus();
    } else if (event.key === "Escape") {
      event.preventDefault();
      searchInput?.focus();
    }
  });

  document.querySelectorAll<HTMLSelectElement>("[data-category-sort]").forEach((sort) => {
    if (!hasFeature("category")) return;
    const scope = sort.closest<HTMLElement>("main");
    const grid = scope?.querySelector<HTMLElement>("[data-category-grid]");
    const availableOnly = scope?.querySelector<HTMLInputElement>("[data-category-available]");
    const tagFilter = scope?.querySelector<HTMLSelectElement>("[data-category-tag]");
    const minPrice = scope?.querySelector<HTMLInputElement>("[data-category-min-price]");
    const maxPrice = scope?.querySelector<HTMLInputElement>("[data-category-max-price]");
    const optionFilters = Array.from(
      scope?.querySelectorAll<HTMLSelectElement>("[data-category-option]") ?? [],
    );
    const resultCount = scope?.querySelector<HTMLElement>("[data-category-result-count]");
    resultCount?.setAttribute("aria-live", "polite");
    if (!grid) return;
    const cards = Array.from(grid.querySelectorAll<HTMLElement>("[data-product-card]"));
    const filterEmpty = document.createElement("p");
    filterEmpty.className = "solara-empty-state";
    filterEmpty.textContent = "No hay productos que coincidan con estos filtros.";
    filterEmpty.hidden = true;
    grid.insertAdjacentElement("afterend", filterEmpty);
    const render = (): void => {
      const visible = cards.filter((card) => {
        const price = Number(card.dataset.productPrice ?? "0");
        const min = Number(minPrice?.value ?? "") * 100;
        const max = Number(maxPrice?.value ?? "") * 100;
        const selectedTag = tagFilter?.value.trim().toLocaleLowerCase("es-AR") ?? "";
        const tags =
          `${card.dataset.productTags ?? ""} ${card.dataset.productVariants ?? ""}`.toLocaleLowerCase(
            "es-AR",
          );
        const options = (card.dataset.productOptions ?? "")
          .split("|")
          .map((value) => value.trim().toLocaleLowerCase("es-AR"));
        const selectedOptionsMatch = optionFilters.every((filter) => {
          const value = filter.value.trim().toLocaleLowerCase("es-AR");
          const key = filter.dataset.categoryOptionKey?.trim().toLocaleLowerCase("es-AR");
          return !value || !key || options.includes(`${key}=${value}`);
        });
        return (
          (!availableOnly?.checked || card.dataset.productAvailable === "true") &&
          (!selectedTag || tags.includes(selectedTag)) &&
          selectedOptionsMatch &&
          (!minPrice?.value || price >= min) &&
          (!maxPrice?.value || price <= max)
        );
      });
      const sorted = [...visible];
      if (sort.value === "price-asc" || sort.value === "price-desc") {
        sorted.sort((left, right) => {
          const difference = Number(left.dataset.productPrice) - Number(right.dataset.productPrice);
          return sort.value === "price-asc" ? difference : -difference;
        });
      } else if (sort.value === "name") {
        sorted.sort((left, right) =>
          (left.dataset.productTitle ?? "").localeCompare(right.dataset.productTitle ?? ""),
        );
      }
      sorted.forEach((card) => {
        grid.append(card);
      });
      cards.forEach((card) => {
        card.hidden = !visible.includes(card);
      });
      filterEmpty.hidden = visible.length > 0;
      if (resultCount) {
        const total = resultCount.getAttribute("data-category-total") ?? String(visible.length);
        resultCount.textContent = `${visible.length} de ${total} productos`;
      }
    };
    sort.addEventListener("change", render);
    availableOnly?.addEventListener("change", render);
    tagFilter?.addEventListener("change", render);
    optionFilters.forEach((filter) => {
      filter.addEventListener("change", render);
    });
    minPrice?.addEventListener("input", render);
    maxPrice?.addEventListener("input", render);
  });

  const queryVariant = new URLSearchParams(window.location.search).get("variant");
  if (queryVariant && hasFeature("variants")) {
    document.querySelectorAll<HTMLSelectElement>("[data-variant-select]").forEach((select) => {
      if (Array.from(select.options).some((option) => option.value === queryVariant)) {
        select.value = queryVariant;
        const productRoot = select.closest<HTMLElement>("[data-product]");
        if (productRoot) syncVariant(productRoot);
      }
    });
  }

  document.querySelectorAll<HTMLElement>(".catalog-testimonials-section").forEach((s) => {
    const track = s.querySelector<HTMLElement>(".catalog-testimonials-track");
    const buttons = s.querySelectorAll<HTMLButtonElement>(".catalog-testimonials-controls button");
    if (!track) return;
    const sync = () => {
      const max = track.scrollWidth - track.clientWidth;
      buttons.forEach((button, i) => {
        button.disabled = i ? track.scrollLeft >= max : !track.scrollLeft || !max;
      });
    };
    track.addEventListener("scroll", sync, { passive: true });
    window.addEventListener("resize", sync);
    sync();
  });

  const motionRoots = hasFeature("motion")
    ? Array.from(document.querySelectorAll<HTMLElement>("[data-motion-root]")).filter(
        (element) => element.dataset.motionPreset !== "none",
      )
    : [];
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let motionObserver: IntersectionObserver | null = null;
  const connectMotion = (): void => {
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
      motionObserver = observer;
    }
  };
  if (!reduceMotion && "IntersectionObserver" in window) {
    connectMotion();
  } else {
    motionRoots.forEach((element) => {
      element.dataset.motionVisible = "true";
    });
  }

  if (hasFeature("cart") || hasFeature("checkout")) {
    renderCart();
    syncCartToggleExpanded(false);
  }
  if (hasFeature("variants")) {
    document.querySelectorAll<HTMLElement>("[data-product]").forEach(syncVariant);
  }

  const pauseRuntime = (): void => {
    if (paused) return;
    paused = true;
    motionObserver?.disconnect();
    motionObserver = null;
    headerObserver?.disconnect();
    headerObserver = null;
    chromeObserver?.disconnect();
    chromeObserver = null;
    heroAutoplayControls.forEach((control) => {
      control.stop();
    });
  };

  const resumeRuntime = (): void => {
    if (!paused) return;
    paused = false;
    connectMotion();
    connectHeaderObserver();
    connectChromeObserver();
    heroAutoplayControls.forEach((control) => {
      control.start();
    });
    if (hasFeature("variants")) {
      document.querySelectorAll<HTMLElement>("[data-product]").forEach(syncVariant);
    }
    if (pageType === "cart" || pageType === "checkout") {
      freshCatalog = null;
      void reconcileCart();
    }
  };

  const onVisibility = (): void => {
    if (document.hidden) pauseRuntime();
    else resumeRuntime();
  };
  document.addEventListener("visibilitychange", onVisibility, { passive: true });
  window.addEventListener("message", (event) => {
    if (event.source !== window.parent) return;
    const type = (event.data as { type?: unknown } | undefined)?.type;
    if (type === "solara-pause") pauseRuntime();
    else if (type === "solara-resume") resumeRuntime();
  });
  if (document.hidden) pauseRuntime();
}

const SEARCH_HELPERS: ReadonlyArray<readonly [string, (...args: never[]) => unknown]> = [
  ["normalizeSearchTokens", normalizeSearchTokens],
  ["levenshtein", levenshtein],
  ["matchToken", matchToken],
  ["scoreEntry", scoreEntry],
];

const RUNTIME_HELPERS: ReadonlyArray<readonly [string, (...args: never[]) => unknown]> = [
  ...SEARCH_HELPERS,
  ["parseCart", parseCart],
  ["reconcileCartLines", reconcileCartLines],
];

export const STOREFRONT_RUNTIME_JS = `${RUNTIME_HELPERS.map(
  ([name, fn]) => `const ${name} = ${fn.toString()};`,
).join("\n")}
globalThis.__solaraSearchHelpers = { ${SEARCH_HELPERS.map(([name]) => name).join(", ")} };
(${storefrontBoot.toString()})();`;

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
  grid-template-columns: minmax(0, 1fr) 4rem auto auto;
  align-items: center;
  gap: 1rem;
  padding-block: 1rem;
  border-bottom: 1px solid var(--solara-border);
}

.solara-cart-line button {
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--solara-muted);
  cursor: pointer;
  font-size: 0.78rem;
  text-decoration: underline;
}

.solara-cart-line button:hover {
  color: var(--solara-text);
}

.solara-cart-line > div:first-child {
  display: grid;
  grid-template-columns: 3.4rem minmax(0, 1fr);
  align-items: center;
  gap: 0.7rem;
}

.solara-cart-line > div:first-child > img {
  width: 3.4rem;
  height: 4.2rem;
  object-fit: cover;
  background: var(--solara-surface);
}

.solara-cart-line small {
  display: block;
  color: var(--solara-muted);
}

.solara-cart-line-warning {
  color: #9a3f2f !important;
  font-weight: 650;
}

.solara-cart-line input {
  width: 100%;
  min-height: 2.5rem;
}

@media (max-width: 520px) {
  .solara-cart-line {
    grid-template-columns: minmax(0, 1fr) 4rem;
  }

  .solara-cart-line > button,
  .solara-cart-line > span:last-child {
    grid-column: 2;
    justify-self: end;
  }
}

/* Progressive motion: content remains visible while the observer is idle or unavailable. */
[data-motion-root][data-motion-visible="true"][data-motion-preset="fade"] [data-motion-zone] {
  animation: solara-motion-fade var(--motion-duration, 600ms) var(--motion-easing, cubic-bezier(.16, 1, .3, 1)) var(--motion-delay, 0ms) backwards;
}

[data-motion-root][data-motion-visible="true"][data-motion-preset="fade-up"] [data-motion-zone] {
  animation: solara-motion-fade-up var(--motion-duration, 600ms) var(--motion-easing, cubic-bezier(.16, 1, .3, 1)) var(--motion-delay, 0ms) backwards;
}

[data-motion-root][data-motion-visible="true"][data-motion-preset="slide"] [data-motion-zone] {
  --motion-slide-x: calc(var(--motion-distance, 24px) * var(--motion-intensity, 1));
  --motion-slide-y: 0px;
  animation: solara-motion-slide var(--motion-duration, 600ms) var(--motion-easing, cubic-bezier(.16, 1, .3, 1)) var(--motion-delay, 0ms) backwards;
}

[data-motion-root][data-motion-visible="true"][data-motion-preset="slide"][data-motion-direction="left"] [data-motion-zone] {
  --motion-slide-x: calc(var(--motion-distance, 24px) * var(--motion-intensity, 1) * -1);
}

[data-motion-root][data-motion-visible="true"][data-motion-preset="slide"][data-motion-direction="right"] [data-motion-zone] {
  --motion-slide-x: calc(var(--motion-distance, 24px) * var(--motion-intensity, 1));
}

[data-motion-root][data-motion-visible="true"][data-motion-preset="slide"][data-motion-direction="up"] [data-motion-zone] {
  --motion-slide-x: 0px;
  --motion-slide-y: calc(var(--motion-distance, 24px) * var(--motion-intensity, 1));
}

[data-motion-root][data-motion-visible="true"][data-motion-preset="slide"][data-motion-direction="down"] [data-motion-zone] {
  --motion-slide-x: 0px;
  --motion-slide-y: calc(var(--motion-distance, 24px) * var(--motion-intensity, 1) * -1);
}

[data-motion-root][data-motion-visible="true"][data-motion-preset="scale"] [data-motion-zone] {
  animation: solara-motion-scale var(--motion-duration, 600ms) var(--motion-easing, cubic-bezier(.16, 1, .3, 1)) var(--motion-delay, 0ms) backwards;
}

[data-motion-root][data-motion-visible="true"][data-motion-preset="stagger"] [data-motion-zone] > * {
  animation: solara-motion-fade-up var(--motion-duration, 600ms) var(--motion-easing, cubic-bezier(.16, 1, .3, 1)) backwards;
}

[data-motion-root][data-motion-preset="stagger"][data-motion-visible="true"] [data-motion-zone] > :nth-child(2) { animation-delay: var(--motion-stagger, 80ms); }
[data-motion-root][data-motion-preset="stagger"][data-motion-visible="true"] [data-motion-zone] > :nth-child(3) { animation-delay: calc(var(--motion-stagger, 80ms) * 2); }
[data-motion-root][data-motion-preset="stagger"][data-motion-visible="true"] [data-motion-zone] > :nth-child(4) { animation-delay: calc(var(--motion-stagger, 80ms) * 3); }
[data-motion-root][data-motion-preset="stagger"][data-motion-visible="true"] [data-motion-zone] > :nth-child(n+5) { animation-delay: calc(var(--motion-stagger, 80ms) * 4); }

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
  [data-motion-root][data-motion-preset="parallax"] [data-motion-zone] {
    transform: none;
  }

  [data-motion-root][data-motion-preset="scroll-progress"] {
    transform-origin: left center;
    transform: scaleX(1);
  }
}

[data-motion-root][data-motion-preset="layer-stack"] {
  position: relative;
}

[data-motion-root][data-motion-preset="layer-stack"] [data-motion-zone] {
  position: sticky;
  top: var(--layer-top, 5rem);
  z-index: 1;
}

[data-motion-root][data-motion-preset="layer-stack"] [data-motion-zone] > * {
  position: relative;
  z-index: 1;
}

@keyframes solara-parallax {
  from { transform: translate3d(0, -2%, 0) scale(1.03); }
  to { transform: translate3d(0, 2%, 0) scale(1.03); }
}

@keyframes solara-motion-fade {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes solara-motion-fade-up {
  from { opacity: 0; transform: translate3d(0, calc(var(--motion-distance, 24px) * var(--motion-intensity, 1)), 0); }
  to { opacity: 1; transform: none; }
}

/* slide respeta data-motion-direction; fade-up conserva su subida vertical (direction no aplica ahí). */
@keyframes solara-motion-slide {
  from { opacity: 0; transform: translate3d(var(--motion-slide-x, 24px), var(--motion-slide-y, 0px), 0); }
  to { opacity: 1; transform: none; }
}

@keyframes solara-motion-scale {
  from { opacity: 0; transform: scale(calc(1 - (0.03 * var(--motion-intensity, 1)))); }
  to { opacity: 1; transform: none; }
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
