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
      } catch {
        // Storage can be unavailable in private browsing contexts.
      }
      return [];
    }
  };

  let cart = parseCart();

  const pageType = document.querySelector<HTMLElement>("[data-solara-store]")?.dataset.pageType;

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
                ${line.imageUrl ? `<img src="${escapeAttribute(line.imageUrl)}" alt="" loading="lazy">` : ""}
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

  const headers = Array.from(
    document.querySelectorAll<HTMLElement>('[data-solara-module="editorial-header"]'),
  );
  if (headers.length > 0) {
    const updateHeaderState = (): void => {
      const scrolled = window.scrollY > 8;
      headers.forEach((header) => {
        header.dataset.scrolled = String(scrolled);
      });
    };
    updateHeaderState();
    window.addEventListener("scroll", updateHeaderState, { passive: true });
  }

  document
    .querySelectorAll<HTMLDetailsElement>(
      '[data-solara-module="editorial-header"] .solara-mobile-nav, [data-solara-module="editorial-header"] .solara-nav-dropdown',
    )
    .forEach((menu) => {
      const trigger = menu.querySelector<HTMLElement>(":scope > summary");
      menu.addEventListener("keydown", (event) => {
        if (event.key !== "Escape" || !menu.open) return;
        event.preventDefault();
        menu.open = false;
        trigger?.focus();
      });
      menu.addEventListener("toggle", () => {
        if (menu.open) {
          menu.querySelector<HTMLElement>("nav a, ul a")?.focus();
        }
      });
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
    const setSlide = (nextIndex: number): void => {
      activeIndex = (nextIndex + panels.length) % panels.length;
      panels.forEach((panel, index) => {
        panel.setAttribute("data-hero-active", String(index === activeIndex));
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
      stopAutoplay();
    });
    hero.querySelector<HTMLElement>("[data-hero-next]")?.addEventListener("click", () => {
      setSlide(activeIndex + 1);
      stopAutoplay();
    });
    hero.querySelectorAll<HTMLElement>("[data-hero-slide]").forEach((indicator) => {
      indicator.addEventListener("click", () => {
        setSlide(Number(indicator.dataset.heroSlide ?? "0"));
        stopAutoplay();
      });
    });
    hero.addEventListener("pointerenter", stopAutoplay);
    hero.addEventListener("focusin", stopAutoplay);
    hero.addEventListener("pointerleave", startAutoplay);
    document.addEventListener(
      "visibilitychange",
      () => (document.hidden ? stopAutoplay() : startAutoplay()),
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
  const searchInput = document.querySelector<HTMLInputElement>("#solara-search-input");
  const searchResults = document.querySelector<HTMLElement>("[data-search-results]");
  if (searchInput && searchResults) {
    const query = new URLSearchParams(window.location.search).get("q") ?? "";
    searchInput.value = query;
    if (query) {
      document.querySelector('meta[name="robots"]')?.setAttribute("content", "noindex,follow");
      const terms = normalizeSearch(query);
      if (terms.join(" ").length < 2) {
        searchResults.innerHTML = "<p>Escribí al menos 2 caracteres para buscar.</p>";
        return;
      }
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
              path: string;
              imageUrl?: string;
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
                `${(entry.categoryIds ?? []).join(" ")} ${(entry.collectionIds ?? []).join(" ")}`,
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
          searchResults.innerHTML = `<div class="solara-search-results-grid">${ranked
            .slice(0, 48)
            .map(
              ({ entry }) =>
                `<article class="solara-search-result"><a href="${escapeAttribute(entry.path)}">${entry.imageUrl ? `<img src="${escapeAttribute(entry.imageUrl)}" alt="" loading="lazy">` : ""}<div><h2>${escapeText(entry.title)}</h2><p>${escapeText(entry.brand)}</p><strong>${money.format(entry.priceMin / 100)}</strong></div></a></article>`,
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

  document.querySelectorAll<HTMLSelectElement>("[data-category-sort]").forEach((sort) => {
    const scope = sort.closest<HTMLElement>("main");
    const grid = scope?.querySelector<HTMLElement>("[data-category-grid]");
    const availableOnly = scope?.querySelector<HTMLInputElement>("[data-category-available]");
    const resultCount = scope?.querySelector<HTMLElement>("[data-category-result-count]");
    if (!grid) return;
    const cards = Array.from(grid.querySelectorAll<HTMLElement>("[data-product-card]"));
    const render = (): void => {
      const visible = cards.filter(
        (card) => !availableOnly?.checked || card.dataset.productAvailable === "true",
      );
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
      if (resultCount) resultCount.textContent = `${visible.length} productos`;
    };
    sort.addEventListener("change", render);
    availableOnly?.addEventListener("change", render);
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
