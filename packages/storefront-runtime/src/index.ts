import type { Product, StoreProjectV1, Variant } from "@solara/project-schema";

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
    imageUrl?: string;
    imageWidth?: number;
    imageHeight?: number;
    available?: boolean;
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

  const parseCart = (): BrowserCartLine[] => {
    try {
      const stored = JSON.parse(localStorage.getItem(storageKey) ?? "[]") as unknown;
      if (!Array.isArray(stored)) {
        localStorage.removeItem(storageKey);
        return [];
      }
      return stored.filter(
        (line): line is BrowserCartLine =>
          typeof line === "object" &&
          line !== null &&
          typeof (line as BrowserCartLine).variantId === "string" &&
          (line as BrowserCartLine).variantId.length > 0 &&
          typeof (line as BrowserCartLine).quantity === "number" &&
          Number.isFinite((line as BrowserCartLine).quantity) &&
          (line as BrowserCartLine).quantity >= 1 &&
          (line as BrowserCartLine).quantity <= 99,
      );
    } catch {
      try {
        localStorage.removeItem(storageKey);
      } catch {}
      return [];
    }
  };

  let cart = hasFeature("cart") || hasFeature("checkout") ? parseCart() : [];
  let lastCartTrigger: HTMLElement | null = null;

  const pageType = document.querySelector<HTMLElement>("[data-solara-store]")?.dataset.pageType;

  const renderCart = (): void => {
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
                ${line.available === false ? '<small class="solara-cart-line-warning">Agotado</small>' : ""}
                </div>
              </div>
              <label>
                <span class="sr-only">Cantidad de ${escapeText(line.title)}</span>
                <input data-cart-quantity="${escapeAttribute(line.variantId)}" type="number" min="0" max="99" value="${line.quantity}"${line.available === false ? " disabled" : ""}>
              </label>
              <button type="button" data-cart-remove="${escapeAttribute(line.variantId)}" aria-label="Eliminar ${escapeAttribute(line.title)}">Eliminar</button>
              <span>${money.format((line.unitPrice * line.quantity) / 100)}</span>
            </article>`,
        )
        .join("");
    });

    const total = cart.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0);
    document.querySelectorAll<HTMLElement>("[data-cart-subtotal]").forEach((element) => {
      element.textContent = money.format(total / 100);
    });
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
      button.textContent = available ? "Agregar al carrito" : "Sin stock";
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
      const quantity = Math.max(0, Math.min(99, Number((target as HTMLInputElement).value)));
      cart = cart
        .map((line) => (line.variantId === variantId ? { ...line, quantity } : line))
        .filter((line) => line.quantity > 0);
      renderCart();
    }
  });

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

  document.addEventListener("keydown", (event) => {
    if (!hasFeature("cart")) return;
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
      const unavailable = cart.filter((line) => line.available === false);
      if (unavailable.length > 0) {
        const preview = form.querySelector<HTMLElement>("[data-order-preview]");
        if (preview) {
          preview.textContent =
            "Retirá los productos agotados del carrito antes de enviar el pedido.";
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

  if (pageType === "cart" || pageType === "checkout") {
    fetch("/catalog-index.json")
      .then((response) => {
        if (!response.ok) throw new Error("No se pudo cargar el catálogo actual.");
        return response.json() as Promise<
          Array<{
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
          }>
        >;
      })
      .then((catalog) => {
        const byVariant = new Map(catalog.map((entry) => [entry.variantId, entry]));
        const reconciled: BrowserCartLine[] = [];
        for (const line of cart) {
          const current = byVariant.get(line.variantId);
          if (!current) continue;
          reconciled.push({
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
          });
        }
        cart = reconciled;
        renderCart();
      })
      .catch(() => undefined);
  }

  const updateChromeHeight = (): void => {
    const chrome = Array.from(
      document.querySelectorAll<HTMLElement>(
        '[data-solara-module="announcement-bar"], [data-solara-module="editorial-header"]',
      ),
    ).reduce((total, element) => total + element.getBoundingClientRect().height, 0);
    root.style.setProperty("--solara-chrome-height", `${Math.ceil(chrome)}px`);
  };
  updateChromeHeight();
  if ("ResizeObserver" in window) {
    const chromeObserver = new ResizeObserver(updateChromeHeight);
    document
      .querySelectorAll<HTMLElement>(
        '[data-solara-module="announcement-bar"], [data-solara-module="editorial-header"]',
      )
      .forEach((element) => {
        chromeObserver.observe(element);
      });
  }

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
  if (headers.length > 0 && "IntersectionObserver" in window) {
    const sentinel = document.createElement("span");
    sentinel.dataset.solaraScrollSentinel = "true";
    sentinel.setAttribute("aria-hidden", "true");
    sentinel.style.cssText =
      "position:absolute;top:0;left:0;width:1px;height:1px;pointer-events:none;opacity:0";
    document.body.prepend(sentinel);
    const headerObserver = new IntersectionObserver(([entry]) => {
      const scrolled = entry ? !entry.isIntersecting : false;
      headers.forEach((header) => {
        header.dataset.scrolled = String(scrolled);
      });
    });
    headerObserver.observe(sentinel);
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
  const closeModernMenu = (): void => {
    if (!modernMenu) return;
    modernMenu.hidden = true;
    modernMenuOpen?.setAttribute("aria-expanded", "false");
    document.documentElement.classList.remove("catalog-mobile-menu-open");
    modernMenuOpen?.focus();
  };
  modernMenuOpen?.addEventListener("click", () => {
    if (!modernMenu) return;
    modernMenu.hidden = false;
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
    startAutoplay();
  });

  const normalizeSearch = (value: string): string[] =>
    value
      .toLocaleLowerCase("es-AR")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim()
      .split(/\s+/)
      .filter(Boolean);
  const searchInput = document.querySelector<HTMLInputElement>(
    "#catalog-search-input, #solara-search-input",
  );
  const searchResults = document.querySelector<HTMLElement>("[data-search-results]");
  if (searchInput && searchResults) {
    const query = new URLSearchParams(window.location.search).get("q") ?? "";
    searchInput.value = query;
    if (query) {
      document.querySelector('meta[name="robots"]')?.setAttribute("content", "noindex,follow");
      const terms = normalizeSearch(query);
      if (terms.join(" ").length < 2) {
        searchResults.innerHTML = "<p>Escribí al menos 2 caracteres para buscar.</p>";
      } else {
        const controller = new AbortController();
        searchResults.innerHTML = "<p>Cargando resultados…</p>";
        fetch("/search-index.json", { signal: controller.signal })
          .then((response) => {
            if (!response.ok) throw new Error("No se pudo cargar el índice de búsqueda.");
            return response.json() as Promise<
              Array<{
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
              }>
            >;
          })
          .then((entries) => {
            const ranked = entries
              .map((entry) => {
                const title = normalizeSearch(entry.title).join(" ");
                const brand = normalizeSearch(entry.brand).join(" ");
                const tags = normalizeSearch((entry.tags ?? []).join(" ")).join(" ");
                const categories = normalizeSearch(
                  `${(entry.categoryIds ?? []).join(" ")} ${(entry.collectionIds ?? []).join(" ")} ${(entry.categoryNames ?? []).join(" ")} ${(entry.collectionNames ?? []).join(" ")}`,
                ).join(" ");
                const description = normalizeSearch(entry.description).join(" ");
                const score = terms.reduce(
                  (total, term) =>
                    total +
                    (title.includes(term)
                      ? 6
                      : brand.includes(term)
                        ? 4
                        : tags.includes(term)
                          ? 3
                          : categories.includes(term)
                            ? 2
                            : description.includes(term)
                              ? 1
                              : 0),
                  0,
                );
                return { entry, score };
              })
              .filter((item) => item.score > 0)
              .sort(
                (left, right) =>
                  right.score - left.score || left.entry.title.localeCompare(right.entry.title),
              );
            if (ranked.length === 0) {
              searchResults.innerHTML = "<p>No encontramos productos para esa búsqueda.</p>";
              return;
            }
            searchResults.innerHTML = `<p class="solara-search-summary">Resultados para “${escapeText(query)}”</p><div class="solara-search-results-grid">${ranked
              .slice(0, 48)
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
      if (resultCount) resultCount.textContent = `${visible.length} productos`;
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

  const motionRoots = hasFeature("motion")
    ? Array.from(document.querySelectorAll<HTMLElement>("[data-motion-root]")).filter(
        (element) => element.dataset.motionPreset !== "none",
      )
    : [];
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

  if (hasFeature("cart") || hasFeature("checkout")) renderCart();
  if (hasFeature("variants")) {
    document.querySelectorAll<HTMLElement>("[data-product]").forEach(syncVariant);
  }
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
  animation: solara-motion-fade var(--motion-duration, 600ms) var(--motion-easing, cubic-bezier(.16, 1, .3, 1)) var(--motion-delay, 0ms) both;
}

[data-motion-root][data-motion-visible="true"][data-motion-preset="fade-up"] [data-motion-zone] {
  animation: solara-motion-fade-up var(--motion-duration, 600ms) var(--motion-easing, cubic-bezier(.16, 1, .3, 1)) var(--motion-delay, 0ms) both;
}

[data-motion-root][data-motion-visible="true"][data-motion-preset="slide"] [data-motion-zone] {
  --motion-slide-x: calc(var(--motion-distance, 24px) * var(--motion-intensity, 1));
  animation: solara-motion-slide var(--motion-duration, 600ms) var(--motion-easing, cubic-bezier(.16, 1, .3, 1)) var(--motion-delay, 0ms) both;
}

[data-motion-root][data-motion-visible="true"][data-motion-preset="slide"][data-motion-direction="left"] [data-motion-zone] {
  --motion-slide-x: calc(var(--motion-distance, 24px) * var(--motion-intensity, 1) * -1);
}

[data-motion-root][data-motion-visible="true"][data-motion-preset="scale"] [data-motion-zone] {
  animation: solara-motion-scale var(--motion-duration, 600ms) var(--motion-easing, cubic-bezier(.16, 1, .3, 1)) var(--motion-delay, 0ms) both;
}

[data-motion-root][data-motion-visible="true"][data-motion-preset="stagger"] [data-motion-zone] > * {
  animation: solara-motion-fade-up var(--motion-duration, 600ms) var(--motion-easing, cubic-bezier(.16, 1, .3, 1)) both;
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

@keyframes solara-motion-slide {
  from { opacity: 0; transform: translate3d(var(--motion-slide-x, 24px), 0, 0); }
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
