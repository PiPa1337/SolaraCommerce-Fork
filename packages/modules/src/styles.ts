export const STORE_BASE_STYLES = `
[data-solara-store] {
  color: var(--solara-text);
  background: var(--solara-background);
  font-family: var(--solara-font-body);
  font-size: calc(1rem * var(--solara-type-scale, 1));
  line-height: 1.58;
  min-width: 0;
}
.solara-skip-link {
  position: fixed;
  z-index: 50;
  top: 0.5rem;
  left: 0.5rem;
  padding: 0.6rem 0.8rem;
  transform: translateY(-160%);
  background: var(--solara-text);
  color: var(--solara-background);
}
.solara-skip-link:focus {
  transform: translateY(0);
}
[data-solara-store][data-color-mode="dark"] {
  --solara-background: #1d1e19;
  --solara-surface: #292a23;
  --solara-text: #f3eee4;
  --solara-muted: #b8b2a5;
  --solara-border: #47483d;
}
[data-solara-store] *,
[data-solara-store] *::before,
[data-solara-store] *::after {
  box-sizing: border-box;
}
[data-solara-store] img {
  display: block;
  max-width: 100%;
}
[data-solara-store] a {
  color: inherit;
  text-underline-offset: 0.2em;
}
[data-solara-store] button,
[data-solara-store] input,
[data-solara-store] select,
[data-solara-store] textarea {
  color: inherit;
  font: inherit;
}
[data-solara-store] button,
[data-solara-store] a {
  transition:
    background-color 180ms ease,
    border-color 180ms ease,
    color 180ms ease,
    opacity 180ms ease,
    transform 180ms ease;
}
[data-solara-store] button:disabled,
[data-solara-store] input:disabled,
[data-solara-store] select:disabled,
[data-solara-store] textarea:disabled {
  cursor: not-allowed;
  opacity: 0.48;
}
[data-solara-store] button,
[data-solara-store] summary,
[data-solara-store] a {
  -webkit-tap-highlight-color: transparent;
}
[data-solara-store] :focus-visible {
  outline: 3px solid color-mix(in srgb, var(--solara-accent), white 28%);
  outline-offset: 3px;
}
[data-solara-store] h1,
[data-solara-store] h2,
[data-solara-store] h3,
[data-solara-store] p,
[data-solara-store] figure {
  margin: 0;
}
[data-solara-store] h1,
[data-solara-store] h2,
[data-solara-store] h3 {
  font-family: var(--solara-font-display);
  font-weight: 500;
  letter-spacing: -0.045em;
  line-height: 0.98;
  text-wrap: balance;
}
[data-solara-store] .solara-primary-action,
[data-solara-store] .solara-secondary-action {
  align-items: center;
  border: 1px solid transparent;
  border-radius: var(--solara-radius);
  display: inline-flex;
  font-weight: 650;
  justify-content: center;
  min-height: 48px;
  overflow-wrap: anywhere;
  padding: 0.75rem 1.1rem;
  text-align: center;
  text-decoration: none;
}
[data-solara-store] .solara-primary-action {
  background: var(--solara-accent);
  color: var(--solara-accent-text);
}
[data-solara-store] .solara-secondary-action {
  border-color: var(--solara-border);
}
[data-solara-store] .solara-primary-action:hover {
  filter: brightness(0.94);
  transform: translateY(-1px);
}
[data-solara-store] .solara-secondary-action:hover {
  background: var(--solara-surface);
  border-color: var(--solara-muted);
}
[data-solara-store] .solara-primary-action:active,
[data-solara-store] .solara-secondary-action:active,
[data-solara-store] button:active {
  transform: translateY(1px);
}
[data-solara-store] .solara-container {
  width: min(calc(100% - 2rem), var(--solara-container));
  margin-inline: auto;
}
[data-solara-store] .solara-page-intro {
  max-width: 60rem;
  padding: clamp(4rem, 10vw, 8rem) 0 clamp(3rem, 7vw, 6rem);
}
[data-solara-store] .solara-page-intro h1 {
  max-width: 12ch;
  margin-top: 0.7rem;
  font-size: clamp(3rem, 8vw, 8rem);
}
[data-solara-store] .solara-page-intro > p:last-child {
  max-width: 42ch;
  margin-top: 1.4rem;
  color: var(--solara-muted);
  font-size: 1.12rem;
}
[data-solara-store] .solara-breadcrumbs {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  padding-top: 1.5rem;
  color: var(--solara-muted);
  font-size: 0.8rem;
}
[data-solara-store] .solara-breadcrumbs a:hover {
  color: var(--solara-accent);
}
[data-solara-store] .solara-story-grid,
[data-solara-store] .solara-contact-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: clamp(2rem, 8vw, 9rem);
  padding: clamp(3rem, 8vw, 7rem) 0;
  border-top: 1px solid var(--solara-border);
}
[data-solara-store] .solara-story-grid h2,
[data-solara-store] .solara-contact-grid h2 {
  max-width: 14ch;
  font-size: clamp(2rem, 4vw, 4rem);
}
[data-solara-store] .solara-story-grid p,
[data-solara-store] .solara-contact-grid p {
  max-width: 48ch;
  margin-top: 1rem;
  color: var(--solara-muted);
}
[data-solara-store] .solara-story-grid .solara-secondary-action,
[data-solara-store] .solara-contact-grid .solara-primary-action {
  margin-top: 1.5rem;
}
[data-solara-store] .solara-values-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 1px;
  margin: 0 0 clamp(4rem, 10vw, 9rem);
  border-block: 1px solid var(--solara-border);
}
[data-solara-store] .solara-values-grid article {
  min-height: 12rem;
  padding: 1.5rem 0;
  border-right: 1px solid var(--solara-border);
}
[data-solara-store] .solara-values-grid article:last-child {
  border-right: 0;
}
[data-solara-store] .solara-values-grid h2 {
  font-size: 1.55rem;
}
[data-solara-store] .solara-values-grid p {
  margin-top: 0.8rem;
  color: var(--solara-muted);
}
[data-solara-store] .solara-contact-details {
  display: grid;
  gap: 1px;
  border-block: 1px solid var(--solara-border);
}
[data-solara-store] .solara-contact-details > * {
  display: grid;
  gap: 0.3rem;
  padding: 1.1rem 0;
  border-bottom: 1px solid var(--solara-border);
  text-decoration: none;
}
[data-solara-store] .solara-contact-details > *:last-child {
  border-bottom: 0;
}
[data-solara-store] .solara-contact-details span {
  color: var(--solara-muted);
  font-size: 0.75rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}
[data-solara-store] .solara-contact-details a:hover strong {
  color: var(--solara-accent);
}
[data-solara-store] .solara-search-form {
  display: grid;
  gap: 0.6rem;
  max-width: 48rem;
  padding-bottom: clamp(3rem, 8vw, 7rem);
}
[data-solara-store] .solara-search-form > div {
  display: flex;
  gap: 0.7rem;
}
[data-solara-store] .solara-search-form input,
[data-solara-store] .solara-checkout-form input,
[data-solara-store] .solara-checkout-form textarea {
  min-height: 3.1rem;
  width: 100%;
  padding: 0.7rem 0.85rem;
  border: 1px solid var(--solara-border);
  border-radius: var(--solara-radius);
  background: var(--solara-surface);
}
[data-solara-store] .solara-search-results {
  min-height: 14rem;
  padding-block: 2rem 6rem;
  border-top: 1px solid var(--solara-border);
}
[data-solara-store] .solara-search-results-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 1.5rem;
}
[data-solara-store] .solara-search-result a {
  display: grid;
  gap: 0.8rem;
  text-decoration: none;
}
[data-solara-store] .solara-search-result img {
  width: 100%;
  aspect-ratio: 4 / 5;
  object-fit: cover;
  background: var(--solara-surface);
}
[data-solara-store] .solara-search-result h2 {
  font-size: 1.35rem;
  overflow-wrap: anywhere;
}
[data-solara-store] .solara-search-result p {
  color: var(--solara-muted);
}
[data-solara-store] .solara-search-result a:hover h2 {
  color: var(--solara-accent);
}
[data-solara-store] .solara-cart-page-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(16rem, 0.34fr);
  gap: clamp(2rem, 7vw, 7rem);
}
[data-solara-store] .solara-cart-page-grid {
  padding-block: 2rem 7rem;
}
[data-solara-store] .solara-cart-page-grid aside {
  align-self: start;
  display: grid;
  gap: 0.8rem;
  padding-top: 1rem;
  border-top: 1px solid var(--solara-border);
}
[data-solara-store] .solara-cart-page-grid aside strong {
  font-family: var(--solara-font-display);
  font-size: 2rem;
}
[data-solara-store] .solara-pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  margin: 2.5rem auto 6rem;
}
[data-solara-store] .solara-pagination a,
[data-solara-store] .solara-pagination span {
  min-width: 2.75rem;
  min-height: 2.75rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--solara-border);
  border-radius: var(--solara-radius);
  text-decoration: none;
}
[data-solara-store] .solara-pagination a:hover {
  border-color: var(--solara-accent);
  color: var(--solara-accent);
}
[data-solara-store] .solara-pagination span[aria-current="page"] {
  border-color: var(--solara-accent);
  background: var(--solara-accent);
  color: var(--solara-accent-text);
}
[data-solara-store] .solara-checkout-form {
  display: grid;
  gap: 0.65rem;
  max-width: 38rem;
  padding-bottom: 7rem;
}
[data-solara-store] .solara-checkout-form textarea {
  min-height: 7rem;
  resize: vertical;
}
[data-solara-store] .solara-checkout-form button,
[data-solara-store] .solara-checkout-form a {
  width: fit-content;
  margin-top: 0.8rem;
}
[data-solara-store] [data-whatsapp-link][hidden] {
  display: none !important;
}
[data-solara-store] .solara-checkout-form pre {
  max-width: 100%;
  margin: 1.4rem 0 0;
  padding: 1rem;
  overflow: auto;
  background: var(--solara-surface);
  white-space: pre-wrap;
}
[data-solara-store] .solara-category-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  margin: 2rem 0 1.25rem;
  padding-block: 0.85rem;
  border-block: 1px solid var(--solara-border);
  color: var(--solara-muted);
  font-size: 0.88rem;
}
[data-solara-store] .solara-category-hero {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(14rem, 0.42fr);
  align-items: end;
  gap: 2rem;
  padding-top: 3rem;
}
[data-solara-store] .solara-category-hero h1,
[data-solara-store] .solara-category-hero p {
  grid-column: 1;
}
[data-solara-store] .solara-category-hero h1 {
  margin-bottom: 0;
}
[data-solara-store] .solara-category-hero p {
  margin-top: 0.5rem;
  color: var(--solara-muted);
}
[data-solara-store] .solara-category-hero img {
  grid-column: 2;
  grid-row: 1 / span 2;
  width: 100%;
  aspect-ratio: 4 / 3;
  object-fit: cover;
}
[data-solara-store] .solara-category-children {
  margin-top: 2rem;
  padding: 1rem 0;
  border-block: 1px solid var(--solara-border);
}
[data-solara-store] .solara-category-children h2 {
  margin: 0 0 0.85rem;
  font-size: 0.78rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}
[data-solara-store] .solara-category-children ul {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.6rem;
  list-style: none;
  margin: 0;
  padding: 0;
}
[data-solara-store] .solara-category-children li {
  min-width: 0;
}
[data-solara-store] .solara-category-children a {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.75rem;
  min-height: 44px;
  min-width: 0;
  overflow-wrap: break-word;
  padding: 0.65rem 0.75rem;
  border: 1px solid var(--solara-border);
  color: var(--solara-text);
  text-decoration: none;
}
[data-solara-store] .solara-category-children a:hover {
  border-color: var(--solara-accent);
  color: var(--solara-accent);
}
[data-solara-store] .solara-category-children small {
  color: var(--solara-muted);
  white-space: nowrap;
}
[data-solara-store] .solara-error-page {
  min-height: 60svh;
  padding-block: 8rem;
}
[data-solara-store] .solara-related-products {
  border-top: 1px solid var(--solara-border);
}
[data-solara-store] .solara-related-products > .solara-container > h2 {
  margin-top: 3rem;
  padding-inline: 1.25rem;
}
[data-solara-store] .solara-category-toolbar > details {
  margin-left: auto;
}
[data-solara-store] .solara-category-toolbar details > div,
[data-solara-store] .solara-category-toolbar details > label {
  display: block;
  padding-top: 0.65rem;
}
[data-solara-store] .solara-category-toolbar details > div {
  display: grid;
  gap: 0.55rem;
  min-width: min(18rem, 80vw);
}
[data-solara-store] .solara-category-toolbar details input,
[data-solara-store] .solara-category-toolbar details select {
  max-width: 8rem;
  min-height: 2rem;
  margin-left: 0.3rem;
  border: 1px solid var(--solara-border);
  border-radius: var(--solara-radius);
  background: var(--solara-surface);
  color: var(--solara-text);
}
[data-solara-store] .solara-category-toolbar select {
  min-height: 2.4rem;
  margin-left: 0.35rem;
  padding: 0.35rem 0.55rem;
  border: 1px solid var(--solara-border);
  border-radius: var(--solara-radius);
  background: var(--solara-surface);
  color: var(--solara-text);
}
@media (max-width: 767px) {
  [data-solara-store] .solara-story-grid,
  [data-solara-store] .solara-contact-grid,
  [data-solara-store] .solara-search-results-grid,
  [data-solara-store] .solara-cart-page-grid {
    grid-template-columns: 1fr;
  }
  [data-solara-store] .solara-values-grid {
    grid-template-columns: 1fr;
  }
  [data-solara-store] .solara-values-grid article {
    min-height: auto;
    border-right: 0;
    border-bottom: 1px solid var(--solara-border);
  }
  [data-solara-store] .solara-values-grid article:last-child {
    border-bottom: 0;
  }
  [data-solara-store] .solara-search-form > div {
    display: grid;
  }
  [data-solara-store] .solara-category-toolbar {
    align-items: stretch;
    flex-wrap: wrap;
  }
  [data-solara-store] .solara-category-hero {
    grid-template-columns: 1fr;
    gap: 1rem;
  }
  [data-solara-store] .solara-category-hero img {
    grid-column: 1;
    grid-row: auto;
  }
  [data-solara-store] .solara-category-children ul {
    grid-template-columns: 1fr;
  }
  [data-solara-store] .solara-category-toolbar > details {
    margin-left: 0;
  }
  [data-solara-store] .solara-search-results-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  [data-solara-store] .solara-search-form .solara-primary-action {
    width: 100%;
  }
}
@media (prefers-color-scheme: dark) {
  [data-solara-store][data-color-mode="auto"] {
    --solara-background: #1d1e19;
    --solara-surface: #292a23;
    --solara-text: #f3eee4;
    --solara-muted: #b8b2a5;
    --solara-border: #47483d;
  }
}
@media (prefers-reduced-motion: reduce) {
  [data-solara-store] *,
  [data-solara-store] *::before,
  [data-solara-store] *::after {
    scroll-behavior: auto !important;
    transition-duration: 0.01ms !important;
  }
}
[data-solara-store] .solara-cart-page [data-cart-lines] .solara-cart-empty {
  color: var(--solara-muted);
  padding: 2rem 0;
}
`;

export const MODULE_STYLE_BLOCKS: Readonly<Record<string, string>> = {
  "announcement-bar": `
[data-solara-module="announcement-bar"] {
  background: var(--solara-accent);
  color: var(--solara-accent-text);
}
[data-solara-module="announcement-bar"] .solara-announcement {
  align-items: center;
  display: flex;
  font-size: 0.72rem;
  font-weight: 650;
  gap: 1rem;
  justify-content: center;
  margin: 0 auto;
  max-width: var(--solara-container);
  min-height: 36px;
  overflow-wrap: anywhere;
  padding: 0.4rem 1rem;
  letter-spacing: 0.11em;
  text-transform: uppercase;
}
[data-solara-module="announcement-bar"] a {
  font-weight: 700;
}
`,
  "editorial-header": `
[data-solara-module="editorial-header"] {
  background: color-mix(in srgb, var(--solara-background), transparent 2%);
  border-bottom: 1px solid var(--solara-border);
  position: sticky;
  top: 0;
  z-index: 10;
}
[data-solara-module="editorial-header"][data-scrolled="true"] {
  background: var(--solara-background);
}
[data-solara-module="editorial-header"] .solara-header {
  align-items: center;
  display: grid;
  gap: 1.2rem;
  grid-template-columns: minmax(8rem, 1fr) auto auto;
  margin: 0 auto;
  max-width: var(--solara-container);
  min-height: 80px;
  padding: 0 1.25rem;
}
[data-solara-module="editorial-header"] .solara-brand {
  font-family: var(--solara-font-display);
  font-size: 1.45rem;
  font-weight: 500;
  letter-spacing: -0.04em;
  text-decoration: none;
}
[data-solara-module="editorial-header"] .solara-logo {
  height: 34px;
  object-fit: contain;
  object-position: left center;
  width: auto;
}
[data-solara-module="editorial-header"] .solara-desktop-nav {
  display: flex;
  gap: 1.4rem;
  white-space: nowrap;
}
[data-solara-module="editorial-header"] .solara-desktop-nav a {
  color: var(--solara-muted);
  font-size: 0.9rem;
  min-width: 0;
  overflow: hidden;
  text-decoration: none;
  text-overflow: ellipsis;
  text-underline-offset: 0.45rem;
  white-space: nowrap;
}
[data-solara-module="editorial-header"] .solara-desktop-nav a:hover {
  color: var(--solara-text);
  text-decoration: underline;
}
[data-solara-module="editorial-header"] .solara-cart-trigger {
  background: var(--solara-text);
  border: 0;
  border-radius: var(--solara-radius);
  color: var(--solara-background);
  cursor: pointer;
  min-height: 42px;
  padding: 0.55rem 1rem;
  white-space: nowrap;
}
[data-solara-module="editorial-header"] .solara-mobile-nav {
  display: none;
}
@media (max-width: 767px) {
  [data-solara-module="editorial-header"] .solara-header {
    grid-template-columns: 1fr auto auto;
    min-height: 64px;
    padding: 0 1rem;
  }
  [data-solara-module="editorial-header"] .solara-desktop-nav {
    display: none;
  }
  [data-solara-module="editorial-header"] .solara-mobile-nav {
    display: block;
    grid-column: 3;
    grid-row: 1;
  }
[data-solara-module="editorial-header"] .solara-mobile-nav summary {
    cursor: pointer;
    font-weight: 650;
    list-style: none;
    min-height: 42px;
    padding: 0.6rem 0;
  }
  [data-solara-module="editorial-header"] .solara-mobile-nav nav {
    background: var(--solara-background);
    border: 1px solid var(--solara-border);
    border-radius: var(--solara-radius);
    display: grid;
    gap: 0.8rem;
    padding: 1rem;
    position: absolute;
    right: 1rem;
    top: 58px;
    width: min(18rem, calc(100vw - 2rem));
    box-shadow: 0 18px 48px rgb(37 39 31 / 0.16);
  }
  [data-solara-module="editorial-header"] .solara-nav-dropdown--wide > ul {
    grid-template-columns: 1fr;
    min-width: 0;
  }
  [data-solara-module="editorial-header"] .solara-cart-trigger {
    grid-column: 2;
    grid-row: 1;
  }
}
[data-solara-module="editorial-header"] .solara-header {
  grid-template-columns: auto minmax(0, 1fr) auto;
  min-height: 72px;
  padding-inline: max(1rem, calc((100% - var(--solara-container)) / 2));
}
[data-solara-module="editorial-header"] .solara-desktop-nav {
  align-items: center;
  justify-content: center;
  gap: clamp(0.75rem, 2vw, 1.8rem);
}
[data-solara-module="editorial-header"] .solara-desktop-nav > a,
[data-solara-module="editorial-header"] .solara-nav-dropdown summary {
  color: var(--solara-text);
  cursor: pointer;
  font-size: 0.82rem;
  list-style: none;
}
[data-solara-module="editorial-header"] .solara-nav-dropdown {
  position: relative;
}
[data-solara-module="editorial-header"] .solara-nav-dropdown > ul {
  position: absolute;
  top: calc(100% + 0.8rem);
  left: -1rem;
  z-index: 20;
  display: grid;
  min-width: 13rem;
  gap: 0.25rem;
  margin: 0;
  padding: 0.7rem;
  border: 1px solid var(--solara-border);
  background: var(--solara-background);
  box-shadow: 0 18px 48px rgb(37 39 31 / 0.15);
  list-style: none;
}
[data-solara-module="editorial-header"] .solara-nav-dropdown--wide > ul {
  grid-template-columns: repeat(2, minmax(12rem, 1fr));
  min-width: min(30rem, 70vw);
}
[data-solara-module="editorial-header"] .solara-nav-dropdown ul ul {
  display: grid;
  gap: 0.2rem;
  margin: 0.2rem 0 0;
  padding: 0.5rem 0 0.5rem 0.8rem;
  border-left: 1px solid var(--solara-border);
  list-style: none;
}
[data-solara-module="editorial-header"] .solara-nav-dropdown li a {
  display: block;
  padding: 0.4rem;
  text-decoration: none;
}
[data-solara-module="editorial-header"] .solara-nav-dropdown li a:hover {
  background: var(--solara-surface);
  color: var(--solara-accent);
}
[data-solara-module="editorial-header"] .solara-header-actions {
  display: flex;
  align-items: center;
  justify-content: end;
  gap: 0.7rem;
}
[data-solara-module="editorial-header"] .solara-search-trigger {
  text-decoration: none;
}
[data-solara-module="editorial-header"] .solara-search-trigger:hover {
  color: var(--solara-accent);
}
[data-solara-module="editorial-header"] .solara-brand {
  display: block;
  min-width: 0;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
@media (max-width: 767px) {
  [data-solara-module="editorial-header"] .solara-header {
    grid-template-columns: auto 1fr auto;
    padding-inline: 1rem;
  }
  [data-solara-module="editorial-header"] .solara-mobile-nav {
    grid-column: 1;
    grid-row: 1;
    justify-self: start;
  }
  [data-solara-module="editorial-header"] .solara-brand {
    grid-column: 2;
    grid-row: 1;
    justify-self: center;
  }
  [data-solara-module="editorial-header"] .solara-header-actions {
    grid-column: 3;
    grid-row: 1;
  }
  [data-solara-module="editorial-header"] .solara-header-actions {
    gap: 0.45rem;
  }
  [data-solara-module="editorial-header"] .solara-header-actions .solara-search-trigger {
    font-size: 0.78rem;
  }
  [data-solara-module="editorial-header"] .solara-cart-trigger {
    min-height: 40px;
    padding-inline: 0.55rem;
    font-size: 0;
  }
  [data-solara-module="editorial-header"] .solara-cart-trigger span {
    font-size: 0.8rem;
  }
  [data-solara-module="editorial-header"] .solara-nav-dropdown--wide > ul {
    grid-template-columns: 1fr;
    min-width: 0;
  }
}
`,
  "split-hero": `
[data-solara-module="split-hero"] {
  padding: 0;
}
[data-solara-module="split-hero"] .solara-split-hero {
  align-items: stretch;
  display: grid;
  grid-template-columns: minmax(18rem, 0.82fr) minmax(0, 1.18fr);
  margin: 0 auto;
  max-width: var(--solara-container);
  min-height: min(760px, calc(100dvh - 130px));
}
[data-solara-module="split-hero"] .solara-split-hero--right .solara-hero-copy {
  grid-column: 1;
}
[data-solara-module="split-hero"] .solara-split-hero--right .solara-hero-media {
  grid-column: 2;
  grid-row: 1;
}
[data-solara-module="split-hero"] .solara-split-hero--left .solara-hero-copy {
  grid-column: 2;
}
[data-solara-module="split-hero"] .solara-split-hero--left .solara-hero-media {
  grid-column: 1;
  grid-row: 1;
}
[data-solara-module="split-hero"] .solara-hero-copy {
  align-items: flex-start;
  display: flex;
  flex-direction: column;
  justify-content: center;
  background: var(--solara-surface);
  padding: clamp(2.5rem, 5vw, 5.5rem);
}
[data-solara-module="split-hero"] .solara-eyebrow {
  color: var(--solara-muted);
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.14em;
  margin-bottom: clamp(2rem, 4vw, 4rem);
  text-transform: uppercase;
}
[data-solara-module="split-hero"] h1 {
  font-size: clamp(3rem, 5.2vw, 5.6rem);
  max-width: 10ch;
}
[data-solara-module="split-hero"] .solara-hero-body {
  color: var(--solara-muted);
  font-size: clamp(1rem, 1.5vw, 1.25rem);
  margin-top: 1.5rem;
  max-width: 36ch;
}
[data-solara-module="split-hero"] .solara-primary-action {
  margin-top: 2rem;
}
[data-solara-module="split-hero"] .solara-hero-media {
  background: var(--solara-surface);
  border-radius: 0;
  min-height: 28rem;
  overflow: hidden;
}
[data-solara-module="split-hero"] .solara-hero-image {
  height: 100%;
  object-fit: cover;
  transition: transform 700ms cubic-bezier(0.16, 1, 0.3, 1);
  width: 100%;
}
[data-solara-module="split-hero"] .solara-split-hero:hover .solara-hero-image {
  transform: scale(1.012);
}
@media (max-width: 767px) {
  [data-solara-module="split-hero"] {
    padding: 1rem;
  }
  [data-solara-module="split-hero"] .solara-split-hero {
    grid-template-columns: 1fr;
    min-height: auto;
  }
  [data-solara-module="split-hero"] .solara-split-hero--left .solara-hero-copy,
  [data-solara-module="split-hero"] .solara-split-hero--left .solara-hero-media {
    grid-column: 1;
  }
  [data-solara-module="split-hero"] .solara-split-hero--left .solara-hero-media {
    grid-row: auto;
  }
  [data-solara-module="split-hero"] .solara-split-hero--right .solara-hero-copy,
  [data-solara-module="split-hero"] .solara-split-hero--right .solara-hero-media {
    grid-column: 1;
    grid-row: auto;
  }
  [data-solara-module="split-hero"] .solara-hero-copy {
    padding: 3rem 1.5rem 3.5rem;
  }
  [data-solara-module="split-hero"] h1 {
    font-size: clamp(2.5rem, 13vw, 4.2rem);
  }
  [data-solara-module="split-hero"] .solara-hero-media {
    min-height: 54vh;
  }
}
`,
  "editorial-hero": `
[data-solara-module="editorial-hero"] {
  padding: clamp(4rem, 10vw, 9rem) 1.25rem clamp(2rem, 4vw, 4rem);
}
[data-solara-module="editorial-hero"] .solara-editorial-hero {
  align-items: center;
  display: grid;
  gap: clamp(2rem, 5vw, 5rem);
  grid-template-columns: minmax(0, 1fr) minmax(18rem, 0.72fr);
  margin: 0 auto;
  max-width: var(--solara-container);
}
[data-solara-module="editorial-hero"] .solara-editorial-hero--left .solara-editorial-head {
  grid-column: 2;
  grid-row: 1;
}
[data-solara-module="editorial-hero"] .solara-editorial-hero--left .solara-hero-media {
  grid-column: 1;
  grid-row: 1;
}
[data-solara-module="editorial-hero"] .solara-editorial-hero--right .solara-editorial-head {
  grid-column: 1;
  grid-row: 1;
}
[data-solara-module="editorial-hero"] .solara-editorial-hero--right .solara-hero-media {
  grid-column: 2;
  grid-row: 1;
}
[data-solara-module="editorial-hero"] .solara-editorial-head {
  align-items: end;
  display: grid;
  gap: 2rem clamp(2rem, 8vw, 9rem);
  grid-template-columns: minmax(0, 1fr) minmax(17rem, 0.28fr);
}
[data-solara-module="editorial-hero"] .solara-eyebrow {
  color: var(--solara-muted);
  font-size: 0.75rem;
  font-weight: 700;
  grid-column: 1 / -1;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}
[data-solara-module="editorial-hero"] h1 {
  font-size: clamp(4rem, 10vw, 10.5rem);
  max-width: 9ch;
}
[data-solara-module="editorial-hero"] .solara-editorial-head > p:not(.solara-eyebrow) {
  color: var(--solara-muted);
  font-size: 1.08rem;
  max-width: 32ch;
}
[data-solara-module="editorial-hero"] .solara-primary-action {
  justify-self: start;
}
[data-solara-module="editorial-hero"] figure {
  height: clamp(30rem, 58vw, 50rem);
  margin-left: clamp(0rem, 8vw, 9rem);
  overflow: hidden;
}
[data-solara-module="editorial-hero"] .solara-hero-image {
  height: 100%;
  object-fit: cover;
  width: 100%;
}
@media (max-width: 767px) {
  [data-solara-module="editorial-hero"] {
    padding: 3rem 1rem 1rem;
  }
  [data-solara-module="editorial-hero"] .solara-editorial-hero {
    grid-template-columns: 1fr;
  }
  [data-solara-module="editorial-hero"] .solara-editorial-head {
    align-items: start;
    grid-template-columns: 1fr;
  }
  [data-solara-module="editorial-hero"] h1 {
    font-size: clamp(3rem, 15vw, 5rem);
  }
  [data-solara-module="editorial-hero"] figure {
    height: 58vh;
    margin-left: 0;
  }
  [data-solara-module="editorial-hero"] .solara-editorial-hero--left .solara-editorial-head,
  [data-solara-module="editorial-hero"] .solara-editorial-hero--right .solara-editorial-head,
  [data-solara-module="editorial-hero"] .solara-editorial-hero--left .solara-hero-media,
  [data-solara-module="editorial-hero"] .solara-editorial-hero--right .solara-hero-media {
    grid-column: 1;
    grid-row: auto;
  }
}
`,
  "collection-grid": `
[data-solara-module="collection-grid"] {
  padding: clamp(4rem, 9vw, 8rem) 1.25rem;
}
[data-solara-module="collection-grid"] .solara-section-shell {
  margin: 0 auto;
  max-width: var(--solara-container);
}
[data-solara-module="collection-grid"] h2 {
  font-size: clamp(2rem, 4vw, 3.8rem);
  margin-bottom: clamp(2.5rem, 5vw, 4.5rem);
  max-width: 14ch;
}
[data-solara-module="collection-grid"] .solara-collection-grid {
  display: grid;
  gap: clamp(1rem, 2vw, 2rem);
  grid-template-columns: 1.15fr 0.85fr;
}
[data-solara-module="collection-grid"] .solara-collection-card:nth-child(3n) {
  grid-column: 1 / -1;
}
[data-solara-module="collection-grid"] .solara-collection-card a {
  display: grid;
  gap: 1rem;
  text-decoration: none;
}
[data-solara-module="collection-grid"] .solara-collection-card figure {
  aspect-ratio: 5 / 4;
  background: var(--solara-surface);
  border-radius: var(--solara-radius);
  overflow: hidden;
}
[data-solara-module="collection-grid"] .solara-collection-card:nth-child(3n) figure {
  aspect-ratio: 16 / 7;
}
[data-solara-module="collection-grid"] .solara-collection-image {
  height: 100%;
  object-fit: cover;
  transition: transform 500ms cubic-bezier(0.16, 1, 0.3, 1);
  width: 100%;
}
[data-solara-module="collection-grid"] .solara-collection-card a:hover .solara-collection-image {
  transform: scale(1.025);
}
[data-solara-module="collection-grid"] .solara-collection-card div {
  display: grid;
  gap: 0.4rem;
}
[data-solara-module="collection-grid"] .solara-collection-card h3 {
  font-size: clamp(1.45rem, 2.2vw, 2rem);
}
[data-solara-module="collection-grid"] .solara-collection-card p {
  color: var(--solara-muted);
  max-width: 48ch;
}
@media (max-width: 767px) {
  [data-solara-module="collection-grid"] {
    padding: 4rem 1rem;
  }
  [data-solara-module="collection-grid"] .solara-collection-grid {
    grid-template-columns: 1fr;
  }
  [data-solara-module="collection-grid"] .solara-collection-card:nth-child(3n) {
    grid-column: auto;
  }
  [data-solara-module="collection-grid"] .solara-collection-card:nth-child(3n) figure {
    aspect-ratio: 5 / 4;
  }
}
`,
  "editorial-product-grid": `
[data-solara-module="editorial-product-grid"] {
  padding: clamp(4rem, 8vw, 7rem) 1.25rem;
}
[data-solara-module="editorial-product-grid"] .solara-section-shell {
  margin: 0 auto;
  max-width: var(--solara-container);
}
[data-solara-module="editorial-product-grid"] h2 {
  font-size: clamp(2rem, 4vw, 3.8rem);
  margin-bottom: clamp(2.5rem, 5vw, 4.5rem);
}
[data-solara-module="editorial-product-grid"] .solara-empty-state {
  color: var(--solara-muted);
  margin: 2.5rem 0;
}
[data-solara-module="editorial-product-grid"] [data-category-grid] + .solara-empty-state {
  color: var(--solara-muted);
  margin: 0;
  padding: 2rem 0;
}
[data-solara-module="editorial-product-grid"] .solara-editorial-products {
  display: grid;
  gap: clamp(2rem, 4vw, 4rem) clamp(1rem, 2.5vw, 2.5rem);
  align-items: start;
  grid-template-columns: repeat(12, minmax(0, 1fr));
}
[data-solara-module="editorial-product-grid"] .solara-product-card:nth-child(5n + 1) {
  grid-column: span 7;
}
[data-solara-module="editorial-product-grid"] .solara-product-card {
  grid-column: span 5;
}
[data-solara-module="editorial-product-grid"] .solara-product-card:nth-child(5n + 3),
[data-solara-module="editorial-product-grid"] .solara-product-card:nth-child(5n + 4) {
  grid-column: span 6;
}
[data-solara-module="editorial-product-grid"] .solara-product-media {
  aspect-ratio: 4 / 5;
  background: var(--solara-surface);
  border-radius: var(--solara-radius);
  display: block;
  overflow: hidden;
}
[data-solara-module="editorial-product-grid"] .solara-product-image {
  height: 100%;
  object-fit: cover;
  transition: transform 500ms cubic-bezier(0.16, 1, 0.3, 1);
  width: 100%;
}
[data-solara-module="editorial-product-grid"] .solara-product-media:hover .solara-product-image {
  transform: scale(1.025);
}
[data-solara-module="editorial-product-grid"] .solara-product-copy {
  align-items: start;
  display: flex;
  gap: 1rem;
  justify-content: space-between;
  margin-top: 1rem;
}
[data-solara-module="editorial-product-grid"] .solara-product-copy > div {
  min-width: 0;
}
[data-solara-module="editorial-product-grid"] .solara-product-copy h3 {
  font-size: 1.2rem;
  display: -webkit-box;
  overflow: hidden;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}
[data-solara-module="editorial-product-grid"] .solara-product-copy h3 a {
  text-decoration: none;
}
[data-solara-module="editorial-product-grid"] .solara-product-brand,
[data-solara-module="editorial-product-grid"] .solara-product-description,
[data-solara-module="editorial-product-grid"] .solara-product-status {
  color: var(--solara-muted);
  font-size: 0.82rem;
}
[data-solara-module="editorial-product-grid"] .solara-product-description {
  margin-top: 0.7rem;
  max-width: 42ch;
}
[data-solara-module="editorial-product-grid"] .solara-product-status {
  margin-top: 0.5rem;
}
[data-solara-module="editorial-product-grid"] .solara-product-price {
  flex: 0 0 auto;
  font-weight: 650;
}
@media (max-width: 767px) {
  [data-solara-module="editorial-product-grid"] {
    padding: 4rem 1rem;
  }
  [data-solara-module="editorial-product-grid"] .solara-editorial-products {
    grid-template-columns: 1fr 1fr;
  }
[data-solara-module="editorial-product-grid"] .solara-product-card:nth-child(5n + 1) {
    grid-column: 1 / -1;
  }
  [data-solara-module="editorial-product-grid"] .solara-product-card,
  [data-solara-module="editorial-product-grid"] .solara-product-card:nth-child(5n + 3),
  [data-solara-module="editorial-product-grid"] .solara-product-card:nth-child(5n + 4) {
    grid-column: span 1;
  }
  [data-solara-module="editorial-product-grid"] .solara-product-copy {
    display: grid;
  }
}
`,
  "compact-product-grid": `
[data-solara-module="compact-product-grid"] {
  border-top: 1px solid var(--solara-border);
  padding: clamp(3rem, 5vw, 5rem) 1.25rem;
}
[data-solara-module="compact-product-grid"] .solara-section-shell {
  margin: 0 auto;
  max-width: var(--solara-container);
}
[data-solara-module="compact-product-grid"] h2 {
  font-size: clamp(1.8rem, 3vw, 3rem);
  margin-bottom: clamp(1.5rem, 3vw, 2.5rem);
}
[data-solara-module="compact-product-grid"] .solara-compact-products {
  display: grid;
  gap: clamp(1.5rem, 2.4vw, 2.25rem) clamp(0.8rem, 1.7vw, 1.5rem);
  grid-template-columns: repeat(4, minmax(0, 1fr));
}
[data-solara-module="compact-product-grid"] .solara-product-media {
  aspect-ratio: 1 / 1;
  background: var(--solara-surface);
  border-radius: var(--solara-radius);
  display: block;
  overflow: hidden;
}
[data-solara-module="compact-product-grid"] .solara-product-image {
  height: 100%;
  object-fit: cover;
  transition: transform 320ms cubic-bezier(0.16, 1, 0.3, 1), opacity 180ms ease;
  width: 100%;
}
[data-solara-module="compact-product-grid"] .solara-product-media:hover .solara-product-image {
  opacity: 0.94;
  transform: scale(1.02);
}
[data-solara-module="compact-product-grid"] .solara-product-copy {
  display: grid;
  gap: 0.45rem;
  margin-top: 0.8rem;
}
[data-solara-module="compact-product-grid"] .solara-product-copy h3 {
  font-size: clamp(0.92rem, 1.2vw, 1.08rem);
  line-height: 1.15;
  display: -webkit-box;
  overflow: hidden;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}
[data-solara-module="compact-product-grid"] .solara-product-copy h3 a {
  text-decoration: none;
}
[data-solara-module="compact-product-grid"] .solara-product-brand,
[data-solara-module="compact-product-grid"] .solara-product-description,
[data-solara-module="compact-product-grid"] .solara-product-status {
  color: var(--solara-muted);
  font-size: 0.78rem;
}
[data-solara-module="compact-product-grid"] .solara-product-description {
  display: none;
}
[data-solara-module="compact-product-grid"] .solara-product-price {
  font-weight: 650;
  font-variant-numeric: tabular-nums;
}
[data-solara-module="compact-product-grid"] .solara-empty-state {
  color: var(--solara-muted);
  margin: 2.5rem 0;
}
[data-solara-module="compact-product-grid"] [data-category-grid] + .solara-empty-state {
  color: var(--solara-muted);
  margin: 0;
  padding: 2rem 0;
}
@media (max-width: 1100px) {
  [data-solara-module="compact-product-grid"] .solara-compact-products {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}
@media (max-width: 640px) {
  [data-solara-module="compact-product-grid"] {
    padding: 2.75rem 1rem;
  }
  [data-solara-module="compact-product-grid"] .solara-compact-products {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
`,
  "product-detail": `
[data-solara-module="product-detail"] {
  padding: clamp(2rem, 6vw, 6rem) 1.25rem;
}
[data-solara-module="product-detail"] .solara-product-detail {
  align-items: start;
  display: grid;
  gap: clamp(2rem, 6vw, 7rem);
  grid-template-columns: minmax(0, 1.15fr) minmax(20rem, 0.85fr);
  margin: 0 auto;
  max-width: var(--solara-container);
}
[data-solara-module="product-detail"] .solara-product-gallery {
  background: var(--solara-surface);
  border-radius: calc(var(--solara-radius) * 2);
  overflow: hidden;
}
[data-solara-module="product-detail"] .solara-product-gallery-main {
  aspect-ratio: 4 / 5;
  position: relative;
}
[data-solara-module="product-detail"] .solara-product-gallery-main figure {
  inset: 0;
  margin: 0;
  position: absolute;
  opacity: 0;
  pointer-events: none;
  transition: opacity 220ms ease;
}
[data-solara-module="product-detail"] .solara-product-gallery-main figure[data-gallery-active="true"] {
  opacity: 1;
  pointer-events: auto;
}
[data-solara-module="product-detail"] .solara-product-gallery-image {
  height: 100%;
  object-fit: cover;
  width: 100%;
}
[data-solara-module="product-detail"] .solara-product-gallery-thumbs {
  display: flex;
  gap: 0.5rem;
  overflow-x: auto;
  padding: 0.7rem;
}
[data-solara-module="product-detail"] .solara-product-gallery-thumbs button {
  flex: 0 0 4.5rem;
  padding: 0;
  border: 1px solid transparent;
  border-radius: var(--solara-radius);
  background: transparent;
  cursor: pointer;
  overflow: hidden;
}
[data-solara-module="product-detail"] .solara-product-gallery-thumbs button[aria-current="true"] {
  border-color: var(--solara-accent);
}
[data-solara-module="product-detail"] .solara-product-gallery-thumb {
  aspect-ratio: 1;
  height: auto;
  object-fit: cover;
  width: 100%;
}
[data-solara-module="product-detail"] .solara-product-image {
  height: auto;
  width: 100%;
}
[data-solara-module="product-detail"] .solara-product-info {
  padding-top: 1rem;
  position: sticky;
  top: 2rem;
}
[data-solara-module="product-detail"] .solara-product-brand {
  color: var(--solara-muted);
  font-size: 0.82rem;
  font-weight: 650;
  letter-spacing: 0.11em;
  text-transform: uppercase;
}
[data-solara-module="product-detail"] h1 {
  font-size: clamp(2.7rem, 5vw, 5rem);
  margin-top: 0.6rem;
}
[data-solara-module="product-detail"] .solara-detail-price {
  font-size: 1.25rem;
  font-weight: 700;
  margin-top: 1.5rem;
  font-variant-numeric: tabular-nums;
}
[data-solara-module="product-detail"] .solara-detail-price del {
  color: var(--solara-muted);
  font-size: 0.95rem;
  font-weight: 400;
  margin-left: 0.5rem;
}
[data-solara-module="product-detail"] .solara-rich-text {
  color: var(--solara-muted);
  margin-top: 1.5rem;
  max-width: 60ch;
}
[data-solara-module="product-detail"] form {
  display: grid;
  gap: 0.7rem;
  margin-top: 2rem;
}
[data-solara-module="product-detail"] form label {
  font-size: 0.84rem;
  font-weight: 650;
  margin-top: 0.4rem;
}
[data-solara-module="product-detail"] form input,
[data-solara-module="product-detail"] form select {
  background: color-mix(in srgb, var(--solara-background), var(--solara-surface) 24%);
  border: 1px solid var(--solara-border);
  border-radius: var(--solara-radius);
  min-height: 48px;
  padding: 0.7rem 0.8rem;
}
[data-solara-module="product-detail"] form button {
  background: var(--solara-accent);
  border: 0;
  border-radius: var(--solara-radius);
  color: var(--solara-accent-text);
  cursor: pointer;
  font-weight: 700;
  margin-top: 0.75rem;
  min-height: 52px;
}
[data-solara-module="product-detail"] form button:hover {
  filter: brightness(0.94);
  transform: translateY(-1px);
}
[data-solara-module="product-detail"] .solara-add-fallback {
  align-items: center;
  background: var(--solara-accent);
  border-radius: var(--solara-radius);
  color: var(--solara-accent-text);
  display: none;
  font-weight: 700;
  justify-content: center;
  margin-top: 0.75rem;
  min-height: 52px;
  text-decoration: none;
}
[data-solara-module="product-detail"] .solara-variant-links {
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem;
  margin-top: 0.85rem;
}
[data-solara-module="product-detail"] .solara-variant-links a {
  border-bottom: 1px solid var(--solara-border);
  color: var(--solara-muted);
  font-size: 0.78rem;
  padding: 0.2rem 0;
  text-decoration: none;
}
[data-solara-module="product-detail"] .solara-variant-links a:hover {
  border-color: var(--solara-text);
  color: var(--solara-text);
}
[data-solara-module="product-detail"] .solara-delivery-note {
  color: var(--solara-muted);
  font-size: 0.85rem;
  margin-top: 1rem;
}
[data-solara-module="product-detail"] .solara-product-specs {
  display: grid;
  gap: 0.45rem;
  margin-top: 1.5rem;
  padding-block: 1rem;
  border-block: 1px solid var(--solara-border);
}
[data-solara-module="product-detail"] .solara-product-specs div {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
}
[data-solara-module="product-detail"] .solara-product-specs dt {
  color: var(--solara-muted);
}
[data-solara-module="product-detail"] .solara-product-specs dd {
  margin: 0;
  font-variant-numeric: tabular-nums;
}
[data-solara-module="product-detail"] .solara-product-policies {
  display: grid;
  gap: 0.5rem;
  margin-top: 1rem;
}
[data-solara-module="product-detail"] .solara-product-policies details {
  padding-block: 0.6rem;
  border-bottom: 1px solid var(--solara-border);
}
[data-solara-module="product-detail"] .solara-product-policies summary {
  cursor: pointer;
  font-weight: 650;
}
[data-solara-module="product-detail"] .solara-product-policies p {
  max-width: 52ch;
  margin-top: 0.6rem;
  color: var(--solara-muted);
  font-size: 0.88rem;
}
[data-solara-module="product-detail"] .solara-empty-state {
  margin: 4rem auto;
  max-width: var(--solara-container);
  padding: 0 1rem;
}
@media (max-width: 767px) {
  [data-solara-module="product-detail"] {
    padding: 1rem;
  }
  [data-solara-module="product-detail"] .solara-product-detail {
    gap: 2rem;
    grid-template-columns: 1fr;
  }
  [data-solara-module="product-detail"] .solara-product-info {
    padding: 0 0 2rem;
    position: static;
  }
  [data-solara-module="product-detail"] .solara-product-gallery-main {
    aspect-ratio: 1 / 1.12;
  }
}
`,
  "image-text-content": `
[data-solara-module="image-text-content"] {
  padding: clamp(4rem, 10vw, 9rem) 1.25rem;
}
[data-solara-module="image-text-content"] .solara-image-text {
  align-items: center;
  display: grid;
  gap: clamp(2rem, 7vw, 8rem);
  grid-template-columns: minmax(0, 1.1fr) minmax(18rem, 0.9fr);
  margin: 0 auto;
  max-width: var(--solara-container);
}
[data-solara-module="image-text-content"] .solara-image-text--right figure {
  grid-column: 2;
}
[data-solara-module="image-text-content"] .solara-image-text--right > div {
  grid-column: 1;
  grid-row: 1;
}
[data-solara-module="image-text-content"] figure {
  background: var(--solara-surface);
  border-radius: calc(var(--solara-radius) * 2);
  min-height: 32rem;
  overflow: hidden;
}
[data-solara-module="image-text-content"] .solara-content-image {
  height: 100%;
  object-fit: cover;
  width: 100%;
}
[data-solara-module="image-text-content"] h2 {
  font-size: clamp(2.4rem, 5vw, 5rem);
  max-width: 12ch;
}
[data-solara-module="image-text-content"] .solara-rich-text {
  color: var(--solara-muted);
  margin-top: 1.5rem;
  max-width: 56ch;
  line-height: 1.75;
}
[data-solara-module="image-text-content"] .solara-rich-text > * + * {
  margin-top: 1rem;
}
[data-solara-module="image-text-content"] .solara-secondary-action {
  margin-top: 1.75rem;
}
@media (max-width: 767px) {
  [data-solara-module="image-text-content"] {
    padding: 4rem 1rem;
  }
  [data-solara-module="image-text-content"] .solara-image-text {
    grid-template-columns: 1fr;
  }
  [data-solara-module="image-text-content"] .solara-image-text--right figure,
  [data-solara-module="image-text-content"] .solara-image-text--right > div {
    grid-column: auto;
    grid-row: auto;
  }
  [data-solara-module="image-text-content"] figure {
    min-height: 50vh;
  }
}
`,
  "trust-strip": `
[data-solara-module="trust-strip"] {
  background: color-mix(in srgb, var(--solara-surface), var(--solara-background) 58%);
  border-top: 1px solid var(--solara-border);
  padding: clamp(4rem, 8vw, 7rem) 1.25rem;
}
[data-solara-module="trust-strip"] .solara-trust {
  margin: 0 auto;
  max-width: var(--solara-container);
}
[data-solara-module="trust-strip"] h2 {
  font-size: clamp(2rem, 4vw, 3.6rem);
  margin-bottom: 2.5rem;
}
[data-solara-module="trust-strip"] .solara-trust-grid {
  display: grid;
  gap: 1px;
  grid-template-columns: 1.4fr 0.8fr 0.8fr;
}
[data-solara-module="trust-strip"] article {
  border-left: 1px solid var(--solara-border);
  min-height: 11rem;
  padding: 0.25rem clamp(1rem, 3vw, 2.5rem) 1.2rem;
}
[data-solara-module="trust-strip"] article:first-child {
  border-left: 0;
  padding-left: 0;
}
[data-solara-module="trust-strip"] h3 {
  font-size: 1.35rem;
}
[data-solara-module="trust-strip"] article p {
  color: var(--solara-muted);
  margin-top: 0.8rem;
  max-width: 32ch;
}
@media (max-width: 767px) {
  [data-solara-module="trust-strip"] {
    padding: 4rem 1rem;
  }
  [data-solara-module="trust-strip"] .solara-trust-grid {
    gap: 1.5rem;
    grid-template-columns: 1fr;
  }
  [data-solara-module="trust-strip"] article,
  [data-solara-module="trust-strip"] article:first-child {
    border-left: 0;
    border-top: 1px solid var(--solara-border);
    min-height: auto;
    padding: 1.5rem 0 0;
  }
}
`,
  "cart-drawer": `
[data-solara-module="cart-drawer"] .solara-cart-backdrop {
  background: rgb(29 30 25 / 0.62);
  backdrop-filter: blur(2px);
  inset: 0;
  position: fixed;
  z-index: 40;
}
[data-solara-module="cart-drawer"] .solara-cart-drawer {
  background: var(--solara-background);
  border-left: 1px solid var(--solara-border);
  box-shadow: -24px 0 80px rgb(38 35 27 / 0.24);
  display: grid;
  gap: 1.5rem;
  grid-template-rows: auto minmax(0, 1fr) auto auto;
  height: 100dvh;
  max-width: 30rem;
  overflow-y: auto;
  padding: clamp(1.25rem, 3vw, 2rem);
  position: fixed;
  right: 0;
  top: 0;
  transform: translateX(105%);
  transition: transform 260ms cubic-bezier(0.16, 1, 0.3, 1);
  width: 100%;
  z-index: 50;
}
[data-solara-module="cart-drawer"] .solara-cart-drawer[data-open="true"] {
  transform: translateX(0);
}
[data-solara-module="cart-drawer"] .solara-cart-drawer > header {
  align-items: center;
  border-bottom: 1px solid var(--solara-border);
  display: flex;
  justify-content: space-between;
  padding-bottom: 1rem;
}
[data-solara-module="cart-drawer"] .solara-cart-drawer > header h2 {
  font-size: 2rem;
}
[data-solara-module="cart-drawer"] .solara-cart-drawer > header button {
  background: transparent;
  border: 1px solid var(--solara-border);
  border-radius: var(--solara-radius);
  cursor: pointer;
  min-height: 42px;
  padding: 0.5rem 0.8rem;
}
[data-solara-module="cart-drawer"] .solara-empty-state {
  color: var(--solara-muted);
  padding: 2rem 0;
}
[data-solara-module="cart-drawer"] .solara-cart-empty {
  color: var(--solara-muted);
  padding: 2rem 0;
}
[data-solara-module="cart-drawer"] .solara-cart-total {
  align-items: center;
  border-top: 1px solid var(--solara-border);
  display: flex;
  font-size: 1.1rem;
  justify-content: space-between;
  padding-top: 1rem;
}
[data-solara-module="cart-drawer"] form {
  display: grid;
  gap: 0.55rem;
}
[data-solara-module="cart-drawer"] form label {
  font-size: 0.82rem;
  font-weight: 650;
  margin-top: 0.35rem;
}
[data-solara-module="cart-drawer"] form input,
[data-solara-module="cart-drawer"] form textarea {
  background: color-mix(in srgb, var(--solara-background), var(--solara-surface) 24%);
  border: 1px solid var(--solara-border);
  border-radius: var(--solara-radius);
  min-height: 46px;
  padding: 0.7rem 0.8rem;
}
[data-solara-module="cart-drawer"] form textarea {
  min-height: 76px;
  resize: vertical;
}
[data-solara-module="cart-drawer"] form button {
  background: var(--solara-accent);
  border: 0;
  border-radius: var(--solara-radius);
  color: var(--solara-accent-text);
  cursor: pointer;
  font-weight: 700;
  margin-top: 0.75rem;
  min-height: 52px;
}
[data-solara-module="cart-drawer"] form button:hover {
  filter: brightness(0.94);
}
@media print {
  [data-solara-module="cart-drawer"] .solara-cart-backdrop,
  [data-solara-module="cart-drawer"] [data-cart-drawer] {
    display: none !important;
  }
}
@media (prefers-reduced-motion: reduce) {
  [data-solara-module="cart-drawer"] .solara-cart-drawer {
    transition: none;
  }
}
`,
  "editorial-footer": `
[data-solara-module="editorial-footer"] {
  background: color-mix(in srgb, var(--solara-surface), var(--solara-background) 22%);
  border-top: 1px solid var(--solara-border);
  padding: clamp(3rem, 7vw, 6rem) 1.25rem 2rem;
}
[data-solara-module="editorial-footer"] .solara-footer {
  display: grid;
  gap: clamp(3rem, 7vw, 8rem);
  grid-template-columns: minmax(18rem, 1.6fr) 0.7fr 0.7fr;
  margin: 0 auto;
  max-width: var(--solara-container);
}
[data-solara-module="editorial-footer"] .solara-brand {
  font-family: var(--solara-font-display);
  font-size: clamp(2rem, 5vw, 4.5rem);
  font-weight: 500;
  letter-spacing: -0.05em;
  max-width: 100%;
  overflow-wrap: anywhere;
  text-decoration: none;
}
[data-solara-module="editorial-footer"] .solara-logo {
  height: 48px;
  object-fit: contain;
  object-position: left center;
  width: auto;
}
[data-solara-module="editorial-footer"] .solara-footer > div p {
  color: var(--solara-muted);
  margin-top: 1rem;
  max-width: 46ch;
}
[data-solara-module="editorial-footer"] nav,
[data-solara-module="editorial-footer"] address {
  align-content: start;
  display: grid;
  font-style: normal;
  gap: 0.8rem;
}
[data-solara-module="editorial-footer"] nav a,
[data-solara-module="editorial-footer"] address a {
  text-decoration: none;
}
[data-solara-module="editorial-footer"] nav a:hover,
[data-solara-module="editorial-footer"] address a:hover {
  color: var(--solara-accent);
}
[data-solara-module="editorial-footer"] address span {
  color: var(--solara-muted);
}
[data-solara-module="editorial-footer"] .solara-footer > * {
  min-width: 0;
}
[data-solara-module="editorial-footer"] .solara-footer p,
[data-solara-module="editorial-footer"] .solara-footer a,
[data-solara-module="editorial-footer"] .solara-footer address span,
[data-solara-module="editorial-footer"] .solara-footer small {
  overflow-wrap: anywhere;
}
[data-solara-module="editorial-footer"] small {
  color: var(--solara-muted);
  grid-column: 1 / -1;
}
@media (max-width: 767px) {
  [data-solara-module="editorial-footer"] {
    padding: 4rem 1rem 2rem;
  }
  [data-solara-module="editorial-footer"] .solara-footer {
    grid-template-columns: 1fr;
  }
  [data-solara-module="editorial-footer"] small {
    grid-column: auto;
  }
}
`,
  "hero-media": `
[data-solara-module="hero-media"] {
  position: relative;
  min-height: calc(100svh - var(--solara-chrome-height, 116px));
  overflow: clip;
}
[data-solara-module="hero-media"] .solara-hero-media-shell {
  position: relative;
  display: grid;
  min-height: inherit;
  isolation: isolate;
  background: var(--solara-surface);
}
[data-solara-module="hero-media"] .solara-hero-media-backdrop,
[data-solara-module="hero-media"] .solara-hero-media-backdrop img,
[data-solara-module="hero-media"] .solara-hero-media-backdrop video {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}
[data-solara-module="hero-media"] .solara-hero-media-poster {
  z-index: 0;
}
[data-solara-module="hero-media"] .solara-hero-media-video {
  z-index: 1;
}
[data-solara-module="hero-media"] .solara-hero-media-backdrop img,
[data-solara-module="hero-media"] .solara-hero-media-backdrop video {
  object-fit: cover;
}
[data-solara-module="hero-media"] .solara-hero-media-backdrop::after {
  position: absolute;
  inset: 0;
  background: linear-gradient(90deg, rgb(22 31 25 / 0.72), rgb(22 31 25 / 0.08) 64%, transparent);
  content: "";
  pointer-events: none;
}
[data-solara-module="hero-media"] .solara-hero-slide-panel {
  position: absolute;
  inset: 0;
  opacity: 0;
  visibility: hidden;
  transition: opacity 500ms ease;
}
[data-solara-module="hero-media"] .solara-hero-slide-panel[data-hero-active="true"] {
  opacity: 1;
  visibility: visible;
}
[data-solara-module="hero-media"] .solara-hero-media-shell--overlay-light .solara-hero-media-backdrop::after {
  background: linear-gradient(90deg, rgb(255 251 241 / 0.76), rgb(255 251 241 / 0.14) 64%, transparent);
}
[data-solara-module="hero-media"] .solara-hero-media-shell--overlay-none .solara-hero-media-backdrop::after {
  display: none;
}
[data-solara-module="hero-media"] .solara-hero-media-copy {
  z-index: 1;
  align-self: center;
  width: min(100% - 2rem, var(--solara-container));
  margin: 0 auto;
  padding: clamp(4rem, 10vw, 9rem) 0;
  color: var(--solara-accent-text);
}
[data-solara-module="hero-media"] .solara-hero-media-shell--overlay-light .solara-hero-media-copy {
  color: var(--solara-text);
}
[data-solara-module="hero-media"] .solara-hero-media-shell--center .solara-hero-media-copy {
  text-align: center;
}
[data-solara-module="hero-media"] .solara-hero-media-copy h1 {
  max-width: 14ch;
  font-size: clamp(3rem, 6.4vw, 6.8rem);
}
[data-solara-module="hero-media"] .solara-hero-media-shell--center .solara-hero-media-copy h1 {
  margin-inline: auto;
}
[data-solara-module="hero-media"] .solara-hero-body {
  max-width: 38ch;
  margin-top: 1.25rem;
  font-size: clamp(1rem, 1.6vw, 1.3rem);
}
[data-solara-module="hero-media"] .solara-hero-media-shell--center .solara-hero-body {
  margin-inline: auto;
}
[data-solara-module="hero-media"] .solara-primary-action {
  margin-top: 2rem;
  background: var(--solara-accent-text);
  color: var(--solara-text);
}
[data-solara-module="hero-media"] .solara-hero-video-toggle,
[data-solara-module="hero-media"] .solara-hero-controls {
  position: absolute;
  z-index: 2;
  bottom: 1.25rem;
}
[data-solara-module="hero-media"] .solara-hero-video-toggle {
  right: 1.25rem;
  min-height: 44px;
  padding: 0.6rem 0.85rem;
  border: 1px solid rgb(255 255 255 / 0.56);
  border-radius: var(--solara-radius);
  background: rgb(20 28 23 / 0.52);
  color: white;
  cursor: pointer;
}
[data-solara-module="hero-media"] .solara-hero-controls {
  left: max(1rem, calc((100% - var(--solara-container)) / 2));
  display: flex;
  align-items: center;
  gap: 0.55rem;
}
[data-solara-module="hero-media"] .solara-hero-controls button {
  min-height: 40px;
  padding: 0.5rem 0.65rem;
  border: 1px solid rgb(255 255 255 / 0.54);
  border-radius: var(--solara-radius);
  background: rgb(20 28 23 / 0.44);
  color: white;
  cursor: pointer;
}
[data-solara-module="hero-media"] .solara-hero-indicators {
  display: flex;
  gap: 0.35rem;
  margin-left: 0.35rem;
}
[data-solara-module="hero-media"] .solara-hero-indicators button {
  position: relative;
  width: 2.5rem;
  min-height: 44px;
  padding: 0;
  border: 0;
  background: transparent;
}
[data-solara-module="hero-media"] .solara-hero-indicators button::after {
  position: absolute;
  inset: calc(50% - 2px) 0 auto;
  height: 4px;
  border-radius: 999px;
  background: rgb(255 255 255 / 0.48);
  content: "";
}
[data-solara-module="hero-media"] .solara-hero-indicators button[aria-selected="true"] {
  background: transparent;
}
[data-solara-module="hero-media"] .solara-hero-indicators button[aria-selected="true"]::after {
  background: white;
}
@media (max-width: 767px) {
  [data-solara-module="hero-media"] {
    min-height: calc(100svh - var(--solara-chrome-height, 96px));
  }
  [data-solara-module="hero-media"] .solara-hero-media-copy {
    align-self: end;
    padding: 5rem 0 6rem;
  }
  [data-solara-module="hero-media"] .solara-hero-media-copy h1 {
    max-width: 12ch;
    font-size: clamp(2.8rem, 14vw, 5rem);
  }
  [data-solara-module="hero-media"] .solara-hero-controls {
    left: 1rem;
  }
}
@media (prefers-reduced-motion: reduce) {
  [data-solara-module="hero-media"] .solara-hero-media-video {
    display: none;
  }
}
`,
  "catalog-modern": `
[data-solara-store].catalog-modern {
  --catalog-ink: var(--solara-text, #0b0b0c);
  --catalog-paper: var(--solara-background, #fcfcfb);
  --catalog-surface: var(--solara-surface, #f0f0ee);
  --catalog-muted: var(--solara-muted, #696966);
  --catalog-border: var(--solara-border, #dededa);
  --catalog-sale: #d94a55;
  --catalog-rating: #d99a12;
  background: var(--catalog-paper);
  color: var(--catalog-ink);
  font-family: var(--solara-font-body, "Archivo", "Arial Narrow", "Helvetica Neue", Arial, sans-serif);
}
[data-solara-store].catalog-modern a { color: inherit; }
[data-solara-store].catalog-modern .sr-only {
  position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0,0,0,0); white-space: nowrap; border: 0;
}
[data-solara-store].catalog-modern .catalog-announcement-inner {
  position: relative; display: flex; align-items: center; justify-content: center; gap: .6rem; min-height: 32px; padding: .35rem 3rem; background: var(--catalog-ink); color: white; font-size: .72rem; text-align: center; overflow-wrap: anywhere;
}
[data-solara-store].catalog-modern .catalog-announcement-inner a { text-decoration: underline; text-underline-offset: .2em; }
[data-solara-store].catalog-modern .catalog-announcement-inner button { position: absolute; right: 1rem; width: 28px; height: 28px; padding: 0; border: 0; background: transparent; color: inherit; font-size: 1.2rem; line-height: 1; cursor: pointer; }
[data-solara-store].catalog-modern .catalog-header-inner {
  position: relative; display: grid; grid-template-columns: minmax(10rem, 1fr) auto minmax(16rem, 1fr); align-items: center; gap: clamp(1.25rem, 3vw, 3rem); width: min(calc(100% - 2rem), var(--solara-container)); min-height: 80px; margin-inline: auto; border-bottom: 1px solid var(--catalog-border); -webkit-user-select: none; user-select: none;
}
[data-solara-store].catalog-modern .catalog-brand { display: inline-flex; align-items: center; min-width: 0; max-width: 100%; color: var(--catalog-ink); font-family: var(--solara-font-display, Georgia, "Times New Roman", serif); font-size: clamp(1.65rem, 2.5vw, 2.15rem); font-weight: 500; letter-spacing: -.06em; text-decoration: none; }
[data-solara-store].catalog-modern .catalog-brand .solara-wordmark { max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
[data-solara-store].catalog-modern .catalog-wordmark { font-weight: 900; }
[data-solara-store].catalog-modern .catalog-desktop-nav { display: flex; align-items: center; justify-content: center; gap: clamp(.9rem, 2vw, 1.8rem); min-width: 0; font-size: .94rem; }
[data-solara-store].catalog-modern .catalog-desktop-nav > a,
[data-solara-store].catalog-modern .catalog-desktop-nav summary,
[data-solara-store].catalog-modern .catalog-nav-empty { display: inline-flex; align-items: center; min-height: 44px; min-width: 0; max-width: 100%; padding: .55rem 0; text-decoration: none; overflow-wrap: anywhere; cursor: pointer; -webkit-user-select: none; user-select: none; }
[data-solara-store].catalog-modern .catalog-desktop-nav > a:hover,
[data-solara-store].catalog-modern .catalog-desktop-nav summary:hover,
[data-solara-store].catalog-modern .catalog-nav-empty:hover { color: var(--catalog-muted); }
[data-solara-store].catalog-modern .catalog-desktop-nav > a:focus-visible,
[data-solara-store].catalog-modern .catalog-desktop-nav summary:focus-visible,
[data-solara-store].catalog-modern .catalog-nav-empty:focus-visible,
[data-solara-store].catalog-modern .catalog-search-link:focus-visible,
[data-solara-store].catalog-modern .catalog-cart-link:focus-visible { outline: 2px solid var(--catalog-ink); outline-offset: 4px; }
[data-solara-store].catalog-modern .catalog-nav-menu { position: static; }
[data-solara-store].catalog-modern .catalog-nav-menu summary { list-style: none; font-weight: 700; }
[data-solara-store].catalog-modern .catalog-nav-menu summary::-webkit-details-marker { display: none; }
[data-solara-store].catalog-modern .catalog-nav-chevron { display: inline-grid; place-items: center; flex: 0 0 auto; width: 1.1rem; height: 1.1rem; margin-left: .35rem; color: var(--catalog-muted); font-size: .85rem; line-height: 1; transition: transform 180ms ease; }
[data-solara-store].catalog-modern .catalog-nav-chevron svg { width: .9rem; height: .9rem; fill: none; stroke: currentcolor; stroke-linecap: round; stroke-linejoin: round; stroke-width: 1.8; }
[data-solara-store].catalog-modern .catalog-nav-chevron--forward { transform: none !important; }
[data-solara-store].catalog-modern .catalog-nav-menu[open] > summary .catalog-nav-chevron { transform: rotate(180deg); }
[data-solara-store].catalog-modern .catalog-mega-menu { position: absolute; z-index: 20; top: calc(100% + .85rem); left: 50%; width: min(var(--solara-container), calc(100vw - 2rem)); max-height: min(72vh, 640px); overflow: auto; transform: translateX(-50%); padding: clamp(2rem, 4vw, 3rem) clamp(1.5rem, 4vw, 3.5rem) 1.5rem; border: 1px solid var(--catalog-border); border-radius: 0 0 var(--solara-radius) var(--solara-radius); background: var(--catalog-paper); box-shadow: 0 24px 70px rgb(11 11 12 / .14); -webkit-user-select: none; user-select: none; }
[data-solara-store].catalog-modern .catalog-mega-menu__groups { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); grid-auto-rows: max-content; align-items: start; gap: calc(2.15rem * var(--solara-space-scale, 1)) calc(2.5rem * var(--solara-space-scale, 1)); margin: 0; padding: 0; list-style: none; }
[data-solara-store].catalog-modern .catalog-mega-group { min-width: 0; padding-inline-start: 1.5rem; border-inline-start: 1px solid var(--catalog-border); }
[data-solara-store].catalog-modern .catalog-mega-group__link { display: block; color: var(--catalog-ink); font-size: 1rem; font-weight: 700; text-decoration: none; }
[data-solara-store].catalog-modern .catalog-mega-group__link::after { display: none; }
[data-solara-store].catalog-modern .catalog-mega-group__link:hover,
[data-solara-store].catalog-modern .catalog-mega-group__link:focus-visible { color: var(--catalog-muted); }
[data-solara-store].catalog-modern .catalog-mega-group__link:focus-visible,
[data-solara-store].catalog-modern .catalog-mega-group__children a:focus-visible { outline: 2px solid var(--catalog-ink); outline-offset: 2px; border-radius: 6px; }
[data-solara-store].catalog-modern .catalog-mega-group__children { display: grid; gap: .3rem; margin: .55rem 0 0; padding: 0; list-style: none; }
[data-solara-store].catalog-modern .catalog-mega-group__children a { display: block; min-height: 2.25rem; padding: .35rem 0; color: var(--catalog-muted); font-size: .9rem; font-weight: 500; text-decoration: none; }
[data-solara-store].catalog-modern .catalog-mega-group__children a:hover { color: var(--catalog-ink); text-decoration: underline; text-underline-offset: .25em; }
[data-solara-store].catalog-modern .catalog-mega-menu__all { display: inline-flex; align-items: center; gap: .55rem; margin-top: 2rem; padding-top: 1.25rem; border-top: 1px solid var(--catalog-border); color: var(--catalog-ink); font-size: .9rem; text-decoration: underline; text-underline-offset: .25em; }
[data-solara-store].catalog-modern .catalog-header-actions { display: flex; align-items: center; justify-content: end; gap: .65rem; min-width: 0; }
[data-solara-store].catalog-modern .catalog-search-link,
[data-solara-store].catalog-modern .catalog-cart-link { display: inline-flex; align-items: center; gap: .35rem; min-height: 44px; border: 0; background: transparent; font-size: .82rem; text-decoration: none; cursor: pointer; -webkit-user-select: none; user-select: none; }
[data-solara-store].catalog-modern .catalog-search-link { width: min(18rem, 100%); max-width: 18rem; padding: .55rem 1rem; border: 1px solid var(--catalog-border); border-radius: 999px; background: var(--catalog-surface); color: var(--catalog-muted); overflow: hidden; }
[data-solara-store].catalog-modern .catalog-search-link span:last-child { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
[data-solara-store].catalog-modern .catalog-search-noscript { display: none; }
[data-solara-store].catalog-modern .catalog-search-dialog { width: min(34rem, calc(100% - 2rem)); margin: auto; padding: 0; border: 1px solid var(--catalog-border); border-radius: var(--solara-radius); background: var(--catalog-paper); color: var(--catalog-ink); box-shadow: 0 24px 80px rgb(11 11 12 / .2); }
[data-solara-store].catalog-modern .catalog-search-dialog::backdrop { background: rgb(11 11 12 / .5); }
[data-solara-store].catalog-modern .catalog-search-dialog-form { display: grid; gap: 1rem; padding: clamp(1.25rem, 4vw, 2rem); }
[data-solara-store].catalog-modern .catalog-search-dialog-heading { display: flex; align-items: start; justify-content: space-between; gap: 1rem; }
[data-solara-store].catalog-modern .catalog-search-dialog-heading h2 { font-size: clamp(1.7rem, 4vw, 2.5rem); font-weight: 900; letter-spacing: -.055em; line-height: .98; overflow-wrap: anywhere; }
[data-solara-store].catalog-modern .catalog-search-dialog-heading button { min-height: 44px; padding: .55rem .8rem; border: 1px solid var(--catalog-border); border-radius: 999px; background: transparent; color: inherit; cursor: pointer; }
[data-solara-store].catalog-modern .catalog-search-dialog-form label { color: var(--catalog-muted); font-size: .8rem; }
[data-solara-store].catalog-modern .catalog-search-dialog-controls { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: .65rem; }
[data-solara-store].catalog-modern .catalog-search-dialog-controls input { min-height: 48px; padding: .7rem .85rem; border: 1px solid var(--catalog-border); border-radius: 999px; background: var(--catalog-surface); color: var(--catalog-ink); }
:root.catalog-search-open { overflow: hidden; }
[data-solara-store].catalog-modern .catalog-cart-link strong { display: inline-grid; place-items: center; min-width: 1.25rem; min-height: 1.25rem; padding-inline: .25rem; border-radius: 999px; background: var(--catalog-ink); color: white; font-size: .7rem; }
[data-solara-store].catalog-modern .catalog-mobile-menu-button,
[data-solara-store].catalog-modern .catalog-mobile-menu { display: none; }
[data-solara-store].catalog-modern .catalog-mobile-nav-icon { display: inline-grid; place-items: center; flex: 0 0 1.7rem; width: 1.7rem; height: 1.7rem; color: var(--catalog-ink); }
[data-solara-store].catalog-modern .catalog-mobile-nav-icon svg { width: 1.45rem; height: 1.45rem; fill: none; stroke: currentcolor; stroke-linecap: round; stroke-linejoin: round; stroke-width: 1.6; }
:root.catalog-mobile-menu-open { overflow: hidden; }
[data-solara-store].catalog-modern .catalog-hero-inner { display: grid; grid-template-columns: minmax(0, .9fr) minmax(0, 1.1fr); align-items: stretch; width: min(calc(100% - 2rem), var(--solara-container)); min-height: min(680px, calc(100svh - 104px)); margin: 1.5rem auto 0; overflow: hidden; border-radius: var(--solara-radius); background: var(--catalog-surface); }
[data-solara-store].catalog-modern .catalog-hero-copy { display: flex; flex-direction: column; justify-content: center; padding: clamp(2rem, 5vw, 5rem); }
[data-solara-store].catalog-modern .catalog-eyebrow { margin-bottom: 1rem; color: var(--catalog-muted); font-size: .75rem; font-weight: 700; letter-spacing: .14em; text-transform: uppercase; }
[data-solara-store].catalog-modern .catalog-hero-copy h1 { max-width: 11ch; font-size: calc(clamp(3.2rem, 6vw, 6.5rem) * var(--solara-type-scale, 1)); font-weight: 900; letter-spacing: -.055em; line-height: .95; text-wrap: balance; overflow-wrap: break-word; }
[data-solara-store].catalog-modern .catalog-hero-copy > p:not(.catalog-eyebrow) { max-width: 32ch; margin-top: 1.25rem; color: var(--catalog-muted); }
[data-solara-store].catalog-modern .catalog-hero-actions { display: flex; flex-wrap: wrap; gap: calc(.65rem * var(--solara-space-scale, 1)); margin-top: 1.5rem; }
[data-solara-store].catalog-modern .catalog-primary-action,
[data-solara-store].catalog-modern .catalog-secondary-action,
[data-solara-store].catalog-modern .catalog-newsletter-action,
[data-solara-store].catalog-modern .solara-primary-action { display: inline-flex; align-items: center; justify-content: center; min-height: 48px; overflow-wrap: anywhere; padding: .75rem 1.25rem; border-radius: var(--solara-radius); font-weight: 700; text-align: center; text-decoration: none; }
[data-solara-store].catalog-modern .catalog-primary-action { background: var(--solara-accent); color: var(--solara-accent-text); }
[data-solara-store].catalog-modern .solara-primary-action { background: var(--solara-accent); color: var(--solara-accent-text); }
[data-solara-store].catalog-modern .catalog-secondary-action { border: 1px solid var(--catalog-border); background: transparent; }
[data-solara-store].catalog-modern .catalog-primary-action:hover,
[data-solara-store].catalog-modern .catalog-newsletter-action:hover { transform: translateY(-1px); background: color-mix(in srgb, var(--solara-accent, #0b0b0c), white 12%); }
[data-solara-store].catalog-modern .catalog-secondary-action:hover { background: white; border-color: var(--catalog-ink); }
[data-solara-store].catalog-modern .catalog-hero-stats { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 0; margin-top: 2.5rem; }
[data-solara-store].catalog-modern .catalog-hero-stats div { display: grid; grid-template-rows: auto minmax(2.5em, auto); align-content: start; min-width: 0; min-height: 4.6rem; padding: .1rem 1rem 0 0; border-right: 1px solid var(--catalog-border); }
[data-solara-store].catalog-modern .catalog-hero-stats div + div { padding-left: 1rem; }
[data-solara-store].catalog-modern .catalog-hero-stats div:last-child { border-right: 0; }
[data-solara-store].catalog-modern .catalog-hero-stats dt { font-variant-numeric: tabular-nums; font-size: clamp(1.1rem, 2.2vw, 1.55rem); font-weight: 900; letter-spacing: -.04em; line-height: 1.05; white-space: nowrap; }
[data-solara-store].catalog-modern .catalog-hero-stats dd { max-width: 12ch; margin: .35rem 0 0; color: var(--catalog-muted); font-size: .72rem; line-height: 1.25; }
[data-solara-store].catalog-modern .catalog-hero-media { min-height: 100%; background: var(--catalog-surface); }
[data-solara-store].catalog-modern .catalog-hero-image,
[data-solara-store].catalog-modern .catalog-hero-video { width: 100%; height: 100%; min-height: 100%; object-fit: cover; }
[data-solara-store].catalog-modern .catalog-hero-slide-stage,
[data-solara-store].catalog-modern .catalog-hero-slide-stage figure { height: 100%; min-height: 100%; margin: 0; }
[data-solara-store].catalog-modern .catalog-hero-slide-stage figure[hidden] { display: none; }
[data-solara-store].catalog-modern .catalog-hero-controls { grid-column: 2; display: flex; gap: .35rem; align-self: end; justify-content: center; margin: -3rem 0 1rem; z-index: 1; }
[data-solara-store].catalog-modern .catalog-hero-controls button { width: 44px; height: 6px; padding: 0; border: 0; border-radius: 999px; background: rgb(255 255 255 / .55); }
[data-solara-store].catalog-modern .catalog-hero-controls button[aria-selected="true"] { background: white; }
[data-solara-store].catalog-modern .catalog-brand-strip-inner { width: min(calc(100% - 2rem), var(--solara-container)); margin: 1rem auto 0; padding: 1.25rem 0; border-block: 1px solid var(--catalog-border); }
[data-solara-store].catalog-modern .catalog-brand-strip-inner h2 { color: var(--catalog-muted); font-size: .7rem; letter-spacing: .14em; text-align: center; text-transform: uppercase; }
[data-solara-store].catalog-modern .catalog-brand-strip-inner ul { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 1rem; align-items: center; margin: 1rem 0 0; padding: 0; list-style: none; font-size: clamp(1rem, 2vw, 1.4rem); font-weight: 800; text-align: center; }
[data-solara-store].catalog-modern .catalog-brand-strip-inner li { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%; }
[data-solara-store].catalog-modern .catalog-product-grid-section,
[data-solara-store].catalog-modern .catalog-category-bento-section,
[data-solara-store].catalog-modern .catalog-testimonials-section { width: min(calc(100% - 2rem), var(--solara-container)); margin: 0 auto; padding: clamp(3.5rem, 7vw, 7rem) 0; }
[data-solara-store].catalog-modern .catalog-product-grid-section > header,
[data-solara-store].catalog-modern .catalog-testimonials-section > header { display: flex; align-items: end; justify-content: space-between; gap: 1rem; margin-bottom: 1.5rem; }
[data-solara-store].catalog-modern .catalog-product-grid-section h2,
[data-solara-store].catalog-modern .catalog-category-bento-section h2,
[data-solara-store].catalog-modern .catalog-testimonials-section h2 { min-width: 0; font-size: calc(clamp(2rem, 4vw, 3.4rem) * var(--solara-type-scale, 1)); font-weight: 900; letter-spacing: -.08em; overflow-wrap: anywhere; }
[data-solara-store].catalog-modern .catalog-view-all { border-bottom: 1px solid currentColor; font-size: .85rem; text-decoration: none; }
[data-solara-store].catalog-modern .catalog-product-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: calc(1.25rem * var(--solara-space-scale, 1)); }
[data-solara-store].catalog-modern .catalog-product-card { min-width: 0; }
[data-solara-store].catalog-modern .catalog-product-media { display: block; overflow: hidden; aspect-ratio: 1; border-radius: var(--solara-radius); background: var(--catalog-surface); }
[data-solara-store].catalog-modern .catalog-product-card-image { width: 100%; height: 100%; object-fit: cover; transition: transform 280ms cubic-bezier(.16,1,.3,1); }
[data-solara-store].catalog-modern .catalog-product-card:hover .catalog-product-card-image { transform: scale(1.02); }
[data-solara-store].catalog-modern .catalog-product-card-copy { padding-top: .75rem; min-width: 0; }
[data-solara-store].catalog-modern .catalog-product-category { min-height: 1em; color: var(--catalog-muted); font-size: .72rem; font-weight: 700; letter-spacing: .08em; line-height: 1.25; text-transform: uppercase; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
[data-solara-store].catalog-modern .catalog-product-card h3 { min-height: 2.3em; margin-top: .3rem; font-size: 1rem; font-weight: 700; line-height: 1.15; display: -webkit-box; overflow: hidden; overflow-wrap: anywhere; -webkit-box-orient: vertical; -webkit-line-clamp: 2; }
[data-solara-store].catalog-modern .catalog-product-card h3 a { text-decoration: none; }
[data-solara-store].catalog-modern .catalog-product-card h3 a:hover { text-decoration: underline; text-underline-offset: .16em; }
[data-solara-store].catalog-modern .catalog-product-rating { margin-top: .35rem; color: var(--catalog-rating); font-size: .82rem; letter-spacing: .08em; }
[data-solara-store].catalog-modern .catalog-product-rating span { margin-left: .35rem; color: var(--catalog-muted); font-size: .72rem; letter-spacing: 0; }
[data-solara-store].catalog-modern .catalog-product-price { display: flex; flex-wrap: wrap; align-items: center; gap: .35rem; margin-top: .35rem; font-size: .95rem; }
[data-solara-store].catalog-modern .catalog-product-price strong { font-weight: 800; }
[data-solara-store].catalog-modern .catalog-product-price del { color: var(--catalog-muted); }
[data-solara-store].catalog-modern .catalog-discount { padding: .18rem .4rem; border-radius: 999px; background: rgb(217 74 85 / .12); color: var(--catalog-sale); font-size: .68rem; font-weight: 700; }
[data-solara-store].catalog-modern .catalog-category-bento-section { margin-top: 1rem; padding: clamp(1.5rem, 3vw, 2.5rem); border-radius: var(--solara-radius); background: var(--catalog-surface); }
[data-solara-store].catalog-modern .catalog-category-bento-section > header { display: flex; flex-wrap: wrap; align-items: end; justify-content: space-between; gap: 1rem; }
[data-solara-store].catalog-modern .catalog-category-bento-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); grid-auto-flow: dense; grid-auto-rows: clamp(9rem, 10vw, 12rem); gap: calc(.75rem * var(--solara-space-scale, 1)); margin-top: 1.5rem; }
[data-solara-store].catalog-modern .catalog-category-bento-item { position: relative; display: flex; min-height: 0; overflow: hidden; grid-column: span 1; grid-row: span 1; border-radius: var(--solara-radius); background: white; text-decoration: none; }
[data-solara-store].catalog-modern .catalog-category-bento-item--wide { grid-column: span 2; grid-row: span 1; }
[data-solara-store].catalog-modern .catalog-category-bento-item--tall { grid-column: span 1; grid-row: span 2; }
[data-solara-store].catalog-modern .catalog-category-bento-item span { position: relative; z-index: 2; margin: 1.25rem; color: var(--catalog-ink); font-size: 1.25rem; font-weight: 800; min-width: 0; overflow-wrap: anywhere; }
[data-solara-store].catalog-modern .catalog-category-bento-item small { position: absolute; z-index: 2; right: 1rem; bottom: .9rem; padding: .3rem .55rem; border: 1px solid rgb(11 11 12 / .1); border-radius: 999px; background: rgb(252 252 251 / .92); box-shadow: 0 1px 2px rgb(11 11 12 / .08); color: var(--catalog-ink); font-size: .72rem; font-weight: 700; line-height: 1; }
[data-solara-store].catalog-modern .catalog-category-bento-item::after { position: absolute; z-index: 1; inset: 0; content: ""; background: linear-gradient(to top, rgb(11 11 12 / .16), transparent 42%); pointer-events: none; }
[data-solara-store].catalog-modern .catalog-category-bento-image { position: absolute; z-index: 0; inset: 0; width: 100%; height: 100%; object-fit: cover; opacity: .78; transition: transform 280ms cubic-bezier(.16,1,.3,1); }
[data-solara-store].catalog-modern .catalog-category-bento-item:hover .catalog-category-bento-image { transform: scale(1.02); }
[data-solara-store].catalog-modern .catalog-category-bento-all { border-bottom: 1px solid currentColor; font-size: .82rem; text-decoration: none; }
[data-solara-store].catalog-modern .catalog-testimonials-track { display: grid; grid-auto-flow: column; grid-auto-columns: minmax(280px, 1fr); gap: calc(.8rem * var(--solara-space-scale, 1)); overflow-x: auto; overscroll-behavior-inline: contain; scroll-snap-type: x proximity; padding-bottom: .5rem; }
[data-solara-store].catalog-modern .catalog-testimonial { min-height: 190px; padding: 1.25rem; border: 1px solid var(--catalog-border); border-radius: var(--solara-radius); scroll-snap-align: start; }
[data-solara-store].catalog-modern .catalog-testimonial-rating { color: var(--catalog-rating); letter-spacing: .08em; }
[data-solara-store].catalog-modern .catalog-testimonial h3 { margin-top: .9rem; font-size: 1rem; font-weight: 800; }
[data-solara-store].catalog-modern .catalog-testimonial-context { margin-top: .15rem; color: var(--catalog-muted); font-size: .75rem; }
[data-solara-store].catalog-modern .catalog-testimonial blockquote { margin-top: .75rem; color: var(--catalog-muted); font-size: .9rem; overflow-wrap: anywhere; }
[data-solara-store].catalog-modern .catalog-testimonials-controls { display: flex; gap: .35rem; }
[data-solara-store].catalog-modern .catalog-testimonials-controls button { width: 44px; height: 44px; border: 1px solid var(--catalog-border); border-radius: 999px; background: transparent; cursor: pointer; }
[data-solara-store].catalog-modern .catalog-testimonials-controls button:hover { border-color: var(--catalog-ink); }
[data-solara-store].catalog-modern .catalog-newsletter-inner { display: flex; align-items: center; justify-content: space-between; gap: calc(2rem * var(--solara-space-scale, 1)); width: min(calc(100% - 2rem), var(--solara-container)); margin: 0 auto clamp(2rem, 5vw, 5rem); padding: clamp(1.75rem, 4vw, 3rem); border-radius: var(--solara-radius); background: var(--catalog-ink); color: white; }
[data-solara-store].catalog-modern .catalog-newsletter-inner h2 { max-width: 16ch; font-size: calc(clamp(1.8rem, 4vw, 3rem) * var(--solara-type-scale, 1)); font-weight: 900; letter-spacing: -.08em; line-height: .95; }
[data-solara-store].catalog-modern .catalog-newsletter-inner p { max-width: 38ch; margin-top: .6rem; color: rgb(255 255 255 / .72); }
[data-solara-store].catalog-modern .catalog-newsletter-action { flex-shrink: 0; background: white; color: var(--catalog-ink); }
[data-solara-store].catalog-modern .catalog-footer-inner { display: grid; grid-template-columns: 1.5fr repeat(3, 1fr); gap: calc(2rem * var(--solara-space-scale, 1)); width: min(calc(100% - 2rem), var(--solara-container)); margin: 0 auto; padding: calc(3rem * var(--solara-space-scale, 1)) 0 calc(2rem * var(--solara-space-scale, 1)); border-top: 1px solid var(--catalog-border); }
[data-solara-store].catalog-modern .catalog-footer-inner > * { min-width: 0; }
[data-solara-store].catalog-modern .catalog-footer-inner nav a,
[data-solara-store].catalog-modern .catalog-footer-inner address,
[data-solara-store].catalog-modern .catalog-footer-brand p,
[data-solara-store].catalog-modern .catalog-footer-inner small { overflow-wrap: anywhere; }
[data-solara-store].catalog-modern .catalog-footer-inner nav { display: grid; align-content: start; gap: .45rem; font-size: .84rem; }
[data-solara-store].catalog-modern .catalog-footer-inner nav a { text-decoration: none; }
[data-solara-store].catalog-modern .catalog-footer-inner nav a:hover { text-decoration: underline; text-underline-offset: .16em; }
[data-solara-store].catalog-modern .catalog-footer-brand p { max-width: 28ch; margin-top: .8rem; color: var(--catalog-muted); font-size: .84rem; }
[data-solara-store].catalog-modern .catalog-footer-inner address { display: grid; align-content: start; gap: .45rem; font-style: normal; font-size: .84rem; }
[data-solara-store].catalog-modern .catalog-footer-inner small { grid-column: 1 / -1; padding-top: 1rem; border-top: 1px solid var(--catalog-border); color: var(--catalog-muted); }
[data-solara-store].catalog-modern .catalog-empty { grid-column: 1 / -1; padding: 2rem 0; color: var(--catalog-muted); }
[data-solara-store].catalog-modern .catalog-product-detail { width: min(calc(100% - 2rem), var(--solara-container)); margin: 0 auto; }
[data-solara-store].catalog-modern .catalog-product-detail-inner { display: grid; grid-template-columns: minmax(0, 1.1fr) minmax(320px, .9fr); gap: clamp(2rem, 5vw, 5rem); padding: clamp(2rem, 5vw, 4rem) 0 3rem; }
[data-solara-store].catalog-modern .catalog-product-gallery { display: grid; grid-template-columns: 5rem minmax(0, 1fr); gap: .8rem; align-content: start; }
[data-solara-store].catalog-modern .catalog-product-gallery-main { overflow: hidden; border-radius: var(--solara-radius); background: var(--catalog-surface); }
[data-solara-store].catalog-modern .catalog-product-gallery-main figure { display: none; aspect-ratio: 1 / 1.08; margin: 0; }
[data-solara-store].catalog-modern .catalog-product-gallery-main figure[data-gallery-active="true"] { display: block; }
[data-solara-store].catalog-modern .catalog-product-gallery-image { width: 100%; height: 100%; object-fit: cover; }
[data-solara-store].catalog-modern .catalog-product-gallery-thumbs { display: grid; align-content: start; gap: .55rem; }
[data-solara-store].catalog-modern .catalog-product-gallery-thumbs button { padding: 0; overflow: hidden; aspect-ratio: 1; border: 1px solid transparent; border-radius: 10px; background: var(--catalog-surface); cursor: pointer; }
[data-solara-store].catalog-modern .catalog-product-gallery-thumbs button[aria-current="true"] { border-color: var(--catalog-ink); }
[data-solara-store].catalog-modern .catalog-product-gallery-thumb { width: 100%; height: 100%; object-fit: cover; }
[data-solara-store].catalog-modern .catalog-product-info { align-self: start; padding-top: .5rem; }
[data-solara-store].catalog-modern .catalog-product-info h1 { max-width: 14ch; margin-top: .35rem; font-size: calc(clamp(2.25rem, 4.2vw, 4.7rem) * var(--solara-type-scale, 1)); font-weight: 900; letter-spacing: -.09em; line-height: .92; overflow-wrap: anywhere; }
[data-solara-store].catalog-modern .catalog-detail-price { display: flex; flex-wrap: wrap; align-items: baseline; gap: .65rem; margin-top: 1.15rem; font-size: 1.55rem; font-weight: 800; }
[data-solara-store].catalog-modern .catalog-detail-price del { color: var(--catalog-muted); font-size: 1rem; font-weight: 500; }
[data-solara-store].catalog-modern .catalog-product-info > .catalog-product-rating { margin-top: .8rem; }
[data-solara-store].catalog-modern .catalog-product-rating { color: var(--catalog-rating); letter-spacing: .08em; }
[data-solara-store].catalog-modern .catalog-product-rating span { margin-left: .45rem; color: var(--catalog-muted); font-size: .78rem; letter-spacing: 0; }
[data-solara-store].catalog-modern .catalog-rich-text { max-width: 48ch; margin-top: 1.25rem; color: var(--catalog-muted); }
[data-solara-store].catalog-modern .catalog-add-form { display: grid; gap: .55rem; margin-top: 1.6rem; padding-top: 1.25rem; border-top: 1px solid var(--catalog-border); }
[data-solara-store].catalog-modern .catalog-add-form label { font-size: .78rem; font-weight: 700; }
[data-solara-store].catalog-modern .catalog-add-form select,
[data-solara-store].catalog-modern .catalog-add-form input,
[data-solara-store].catalog-modern .catalog-checkout-form input,
[data-solara-store].catalog-modern .catalog-checkout-form textarea { width: 100%; min-height: 46px; padding: .7rem .8rem; border: 1px solid var(--catalog-border); border-radius: var(--solara-radius); background: var(--catalog-paper); color: var(--catalog-ink); }
[data-solara-store].catalog-modern .catalog-quantity-row { display: grid; grid-template-columns: 1fr 6rem; align-items: center; gap: .8rem; margin-top: .55rem; }
[data-solara-store].catalog-modern .catalog-product-add { min-height: 50px; margin-top: .55rem; border: 0; border-radius: var(--solara-radius); background: var(--solara-accent); color: var(--solara-accent-text); font-weight: 800; cursor: pointer; }
[data-solara-store].catalog-modern .catalog-product-add:disabled { cursor: not-allowed; opacity: .5; }
[data-solara-store].catalog-modern .catalog-add-fallback { align-items: center; display: none; justify-content: center; min-height: 50px; margin-top: .55rem; border-radius: var(--solara-radius); background: var(--solara-accent); color: var(--solara-accent-text); font-weight: 800; text-decoration: none; }
[data-solara-store].catalog-modern .catalog-variant-links { display: flex; flex-wrap: wrap; gap: .4rem; margin-top: .7rem; font-size: .75rem; }
[data-solara-store].catalog-modern .catalog-variant-links a { padding: .35rem .55rem; border-radius: 999px; background: var(--catalog-surface); text-decoration: none; }
[data-solara-store].catalog-modern .catalog-delivery-note { margin-top: 1.2rem; color: var(--catalog-muted); font-size: .8rem; }
[data-solara-store].catalog-modern .catalog-product-specs { display: grid; gap: .5rem; margin-top: 1.4rem; padding-top: 1rem; border-top: 1px solid var(--catalog-border); }
[data-solara-store].catalog-modern .catalog-product-specs div { display: flex; justify-content: space-between; gap: 1rem; font-size: .8rem; }
[data-solara-store].catalog-modern .catalog-product-specs dt { color: var(--catalog-muted); }
[data-solara-store].catalog-modern .catalog-product-specs dd { margin: 0; text-align: right; min-width: 0; overflow-wrap: anywhere; }
[data-solara-store].catalog-modern .catalog-product-policies { display: grid; margin-top: 1rem; border-top: 1px solid var(--catalog-border); }
[data-solara-store].catalog-modern .catalog-product-policies details { padding: .8rem 0; border-bottom: 1px solid var(--catalog-border); }
[data-solara-store].catalog-modern .catalog-product-policies summary { cursor: pointer; font-weight: 700; }
[data-solara-store].catalog-modern .catalog-product-policies p { margin-top: .6rem; color: var(--catalog-muted); font-size: .82rem; }
[data-solara-store].catalog-modern .catalog-variant-options { display: grid; gap: .8rem; margin-top: .45rem; }
[data-solara-store].catalog-modern .catalog-option-group { display: grid; gap: .45rem; margin: 0; padding: 0; border: 0; }
[data-solara-store].catalog-modern .catalog-option-group legend { font-size: .78rem; font-weight: 700; }
[data-solara-store].catalog-modern .catalog-option-group > div { display: flex; flex-wrap: wrap; gap: .45rem; }
[data-solara-store].catalog-modern .catalog-option-pill { min-height: 42px; padding: .55rem .8rem; border: 1px solid var(--catalog-border); border-radius: 999px; background: var(--catalog-paper); color: var(--catalog-ink); cursor: pointer; font: inherit; font-size: .78rem; max-width: 100%; overflow-wrap: anywhere; }
[data-solara-store].catalog-modern .catalog-option-pill:hover,
[data-solara-store].catalog-modern .catalog-option-pill[aria-pressed="true"] { border-color: var(--catalog-ink); background: var(--catalog-ink); color: white; }
[data-solara-store].catalog-modern .catalog-option-pill:disabled { cursor: not-allowed; opacity: .45; text-decoration: line-through; }
[data-solara-store].catalog-modern .catalog-search-link svg,
[data-solara-store].catalog-modern .catalog-mobile-menu-button svg { width: 1.05rem; height: 1.05rem; fill: none; stroke: currentcolor; stroke-linecap: round; stroke-linejoin: round; stroke-width: 1.8; }
[data-solara-store].catalog-modern .catalog-product-info select { min-height: 42px; }
[data-solara-store].catalog-modern .catalog-product-tabs { display: flex; gap: .35rem; width: min(calc(100% - 2rem), var(--solara-container)); margin: 1.4rem auto 0; border-bottom: 1px solid var(--catalog-border); overflow-x: auto; }
[data-solara-store].catalog-modern .catalog-product-tabs button { min-height: 44px; padding: .65rem .8rem; border: 0; border-bottom: 2px solid transparent; background: transparent; color: var(--catalog-muted); cursor: pointer; font: inherit; font-size: .78rem; font-weight: 700; white-space: nowrap; }
[data-solara-store].catalog-modern .catalog-product-tabs button:hover,
[data-solara-store].catalog-modern .catalog-product-tabs button[aria-selected="true"] { border-bottom-color: var(--catalog-ink); color: var(--catalog-ink); }
[data-solara-store].catalog-modern .catalog-product-tabs button:focus-visible { outline: 2px solid var(--catalog-ink); outline-offset: -2px; }
[data-solara-store].catalog-modern [data-product-tab-panel][hidden] { display: none; }
[data-solara-store].catalog-modern .catalog-product-reviews { width: min(calc(100% - 2rem), var(--solara-container)); margin: 0 auto; padding: 2rem 0 4rem; border-top: 1px solid var(--catalog-border); }
[data-solara-store].catalog-modern .catalog-product-reviews > header { display: flex; align-items: end; justify-content: space-between; gap: 1rem; }
[data-solara-store].catalog-modern .catalog-product-reviews h2 { max-width: 18ch; margin-top: .3rem; font-size: calc(clamp(1.8rem, 3vw, 3rem) * var(--solara-type-scale, 1)); font-weight: 900; letter-spacing: -.08em; line-height: .95; }
[data-solara-store].catalog-modern .catalog-review-average { color: var(--catalog-muted); font-size: .85rem; }
[data-solara-store].catalog-modern .catalog-review-average strong { color: var(--catalog-ink); font-size: 1.5rem; }
[data-solara-store].catalog-modern .catalog-review-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: calc(.8rem * var(--solara-space-scale, 1)); margin-top: 1.5rem; }
[data-solara-store].catalog-modern .catalog-review { min-height: 170px; padding: 1.25rem; border: 1px solid var(--catalog-border); border-radius: var(--solara-radius); }
[data-solara-store].catalog-modern .catalog-review h3 { margin-top: .7rem; font-size: 1rem; font-weight: 800; }
[data-solara-store].catalog-modern .catalog-review blockquote { margin: .65rem 0; color: var(--catalog-muted); font-size: .88rem; overflow-wrap: anywhere; }
[data-solara-store].catalog-modern .catalog-review small { color: var(--catalog-muted); font-size: .7rem; }
[data-solara-store].catalog-modern .catalog-cart-drawer { position: fixed; z-index: 50; inset: 0 0 0 auto; display: flex; width: min(440px, 100%); flex-direction: column; padding: 1.25rem; overflow-y: auto; transform: translateX(105%); background: var(--catalog-paper); box-shadow: -16px 0 50px rgb(11 11 12 / .14); transition: transform 260ms cubic-bezier(.16,1,.3,1); }
[data-solara-store].catalog-modern .catalog-cart-drawer[data-open="true"] { transform: translateX(0); }
[data-solara-store].catalog-modern .catalog-cart-drawer header { display: flex; align-items: center; justify-content: space-between; gap: 1rem; padding-bottom: 1rem; border-bottom: 1px solid var(--catalog-border); }
[data-solara-store].catalog-modern .catalog-cart-drawer header button { min-height: 44px; padding: .55rem .8rem; border: 1px solid var(--catalog-border); border-radius: 999px; background: transparent; cursor: pointer; }
[data-solara-store].catalog-modern .catalog-cart-backdrop { position: fixed; z-index: 49; inset: 0; background: rgb(11 11 12 / .42); }
[data-solara-store].catalog-modern .catalog-cart-items { display: grid; gap: calc(.7rem * var(--solara-space-scale, 1)); padding: 1rem 0; }
[data-solara-store].catalog-modern .catalog-cart-items .solara-cart-empty,
[data-solara-store].catalog-modern .solara-cart-page [data-cart-lines] .solara-cart-empty { padding: 2rem 0; color: var(--catalog-muted); }
[data-solara-store].catalog-modern .catalog-cart-items .solara-cart-line { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: .65rem; padding: .7rem 0; border-bottom: 1px solid var(--catalog-border); }
[data-solara-store].catalog-modern .catalog-cart-items .solara-cart-line > div:first-child,
[data-solara-store].catalog-modern .solara-cart-page-grid [data-cart-lines] .solara-cart-line > div:first-child { min-width: 0; }
[data-solara-store].catalog-modern .catalog-cart-items .solara-cart-line > div:first-child > div,
[data-solara-store].catalog-modern .solara-cart-page-grid [data-cart-lines] .solara-cart-line > div:first-child > div { min-width: 0; }
[data-solara-store].catalog-modern .catalog-cart-items .solara-cart-line strong,
[data-solara-store].catalog-modern .catalog-cart-items .solara-cart-line small,
[data-solara-store].catalog-modern .solara-cart-page-grid [data-cart-lines] .solara-cart-line strong,
[data-solara-store].catalog-modern .solara-cart-page-grid [data-cart-lines] .solara-cart-line small { display: block; overflow-wrap: anywhere; }
[data-solara-store].catalog-modern .solara-cart-line-warning { color: var(--catalog-sale); font-size: .7rem; font-weight: 700; margin-top: .15rem; }
[data-solara-store].catalog-modern .catalog-cart-items .solara-cart-line > div:first-child { display: grid; grid-template-columns: 3.5rem minmax(0, 1fr); gap: .65rem; align-items: center; }
[data-solara-store].catalog-modern .catalog-cart-items .solara-cart-line img { width: 3.5rem; height: 3.5rem; object-fit: cover; border-radius: 8px; background: var(--catalog-surface); }
[data-solara-store].catalog-modern .catalog-cart-items .solara-cart-line > span:last-child { grid-column: 2; grid-row: 1; font-weight: 800; }
[data-solara-store].catalog-modern .catalog-cart-items .solara-cart-line label { grid-column: 1; grid-row: 2; }
[data-solara-store].catalog-modern .catalog-cart-items .solara-cart-line input { width: 5rem; min-height: 36px; padding: .35rem; border: 1px solid var(--catalog-border); border-radius: 8px; }
[data-solara-store].catalog-modern .catalog-cart-items .solara-cart-line button { grid-column: 2; grid-row: 2; justify-self: end; border: 0; background: transparent; color: var(--catalog-sale); cursor: pointer; }
[data-solara-store].catalog-modern .catalog-cart-summary { display: grid; gap: .55rem; padding: 1rem 0; border-top: 1px solid var(--catalog-border); }
[data-solara-store].catalog-modern .catalog-cart-summary > p { display: flex; justify-content: space-between; gap: 1rem; margin: 0; color: var(--catalog-muted); font-size: .85rem; }
[data-solara-store].catalog-modern .catalog-cart-summary > p strong { color: var(--catalog-ink); }
[data-solara-store].catalog-modern .catalog-cart-total { padding-top: .7rem; border-top: 1px solid var(--catalog-border); font-size: 1.1rem; }
[data-solara-store].catalog-modern .catalog-checkout-form { display: grid; gap: .45rem; padding-top: .5rem; }
[data-solara-store].catalog-modern .catalog-checkout-form label { margin-top: .4rem; font-size: .78rem; font-weight: 700; }
[data-solara-store].catalog-modern .catalog-checkout-form textarea { min-height: 76px; resize: vertical; }
[data-solara-store].catalog-modern .catalog-checkout-form pre { white-space: pre-wrap; font-size: .75rem; }
[data-solara-store].catalog-modern .catalog-checkout-form [data-whatsapp-link] { margin-top: .4rem; font-weight: 700; }
[data-solara-store].catalog-modern .solara-category-page,
[data-solara-store].catalog-modern .solara-category-hero,
[data-solara-store].catalog-modern .solara-search-page,
[data-solara-store].catalog-modern .solara-cart-page,
[data-solara-store].catalog-modern .solara-checkout-page,
[data-solara-store].catalog-modern .solara-editorial-page { font-family: inherit; }
[data-solara-store].catalog-modern .solara-category-hero { display: grid; grid-template-columns: minmax(0, 1fr) minmax(280px, .42fr); align-items: end; gap: 2rem; padding: 3rem 0 1.5rem; }
[data-solara-store].catalog-modern .solara-category-hero h1,
[data-solara-store].catalog-modern .solara-page-intro h1,
[data-solara-store].catalog-modern .solara-cart-page h1,
[data-solara-store].catalog-modern .solara-checkout-page h1 { font-size: calc(clamp(2.8rem, 6vw, 5.5rem) * var(--solara-type-scale, 1)); font-weight: 900; letter-spacing: -.09em; line-height: .9; }
[data-solara-store].catalog-modern .solara-category-hero img { width: 100%; aspect-ratio: 16 / 7; object-fit: cover; border-radius: 16px; }
[data-solara-store].catalog-modern .solara-category-toolbar { display: flex; align-items: center; justify-content: space-between; gap: 1rem; margin: 1rem 0 1.5rem; padding: .8rem 0; border-block: 1px solid var(--catalog-border); }
[data-solara-store].catalog-modern .solara-category-toolbar select,
[data-solara-store].catalog-modern .solara-category-toolbar input { min-height: 38px; padding: .4rem .55rem; border: 1px solid var(--catalog-border); border-radius: 8px; background: var(--catalog-paper); }
[data-solara-store].catalog-modern .catalog-category-page { padding-bottom: clamp(2rem, 5vw, 5rem); }
[data-solara-store].catalog-modern .catalog-category-layout { display: grid; grid-template-columns: minmax(190px, 230px) minmax(0, 1fr); gap: clamp(1.5rem, 3vw, 3rem); align-items: start; }
[data-solara-store].catalog-modern .catalog-category-layout .solara-empty-state { grid-column: 1 / -1; padding: 2rem 0; color: var(--catalog-muted); }
[data-solara-store].catalog-modern .catalog-category-filters { position: sticky; top: 1rem; min-width: 0; padding: 1rem; border: 1px solid var(--catalog-border); border-radius: var(--solara-radius); background: var(--catalog-surface); }
[data-solara-store].catalog-modern .catalog-category-filters details > summary { display: none; cursor: pointer; font-weight: 800; list-style: none; }
[data-solara-store].catalog-modern .catalog-category-filters details > summary::-webkit-details-marker { display: none; }
[data-solara-store].catalog-modern .catalog-filter-groups { display: grid; gap: 1rem; }
[data-solara-store].catalog-modern .catalog-filter-groups fieldset { min-width: 0; margin: 0; padding: 0 0 1rem; border: 0; border-bottom: 1px solid var(--catalog-border); }
[data-solara-store].catalog-modern .catalog-filter-groups fieldset:last-child { padding-bottom: 0; border-bottom: 0; }
[data-solara-store].catalog-modern .catalog-filter-groups legend { margin-bottom: .55rem; font-size: .78rem; font-weight: 800; overflow-wrap: anywhere; }
[data-solara-store].catalog-modern .catalog-filter-groups label { display: flex; align-items: center; gap: .5rem; color: var(--catalog-muted); font-size: .78rem; min-width: 0; overflow-wrap: anywhere; }
[data-solara-store].catalog-modern .catalog-filter-groups input[type="checkbox"] { width: 1rem; height: 1rem; accent-color: var(--catalog-ink); }
[data-solara-store].catalog-modern .catalog-filter-groups select,
[data-solara-store].catalog-modern .catalog-filter-groups input[type="number"] { width: 100%; min-height: 38px; padding: .4rem .5rem; border: 1px solid var(--catalog-border); border-radius: 8px; background: var(--catalog-paper); color: var(--catalog-ink); }
[data-solara-store].catalog-modern .catalog-price-fields { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: .5rem; }
[data-solara-store].catalog-modern .catalog-price-fields label { display: grid; align-items: stretch; gap: .25rem; font-size: .68rem; }
[data-solara-store].catalog-modern .catalog-category-results { min-width: 0; }
[data-solara-store].catalog-modern .catalog-category-results .solara-category-toolbar { margin-top: 0; }
[data-solara-store].catalog-modern .catalog-category-results .catalog-product-grid-section { width: auto; margin: 0; padding: 0 0 1rem; }
[data-solara-store].catalog-modern .catalog-category-results .catalog-product-grid-section > header { margin-bottom: 1rem; }
[data-solara-store].catalog-modern .catalog-category-results .catalog-product-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 1.2rem .9rem; }
[data-solara-store].catalog-modern .catalog-category-results .catalog-product-card-copy { padding-top: .55rem; }
[data-solara-store].catalog-modern .catalog-category-results .catalog-product-card h3 { font-size: .92rem; }
[data-solara-store].catalog-modern .catalog-category-page > .solara-pagination { margin-top: 1rem; }
[data-solara-store].catalog-modern .catalog-category-page > .solara-pagination a { min-height: 44px; }
[data-solara-store].catalog-modern .solara-category-children { margin: .5rem 0 1.5rem; padding: 1rem; border-radius: var(--solara-radius); background: var(--catalog-surface); }
[data-solara-store].catalog-modern .solara-category-children ul { display: flex; flex-wrap: wrap; gap: .5rem; margin: .8rem 0 0; padding: 0; list-style: none; }
[data-solara-store].catalog-modern .solara-category-children a { display: grid; gap: .1rem; padding: .65rem .8rem; border: 1px solid var(--catalog-border); border-radius: var(--solara-radius); background: var(--catalog-paper); text-decoration: none; }
[data-solara-store].catalog-modern .solara-category-children small { color: var(--catalog-muted); }
[data-solara-store].catalog-modern .solara-pagination { display: flex; align-items: center; justify-content: center; gap: .8rem; margin: 2rem auto 3rem; }
[data-solara-store].catalog-modern .solara-pagination a { padding: .55rem .8rem; border: 1px solid var(--catalog-border); border-radius: 999px; text-decoration: none; }
[data-solara-store].catalog-modern .solara-search-page .solara-page-intro { max-width: 56rem; padding: clamp(2.5rem, 5vw, 4rem) 0 2.5rem; }
[data-solara-store].catalog-modern .solara-search-page .solara-page-intro h1 { max-width: 16ch; }
[data-solara-store].catalog-modern .solara-search-page-trigger { display: inline-flex; align-items: center; justify-content: center; width: fit-content; min-height: 44px; margin-top: 1.25rem; padding: .65rem 1rem; border: 1px solid var(--catalog-border); border-radius: 999px; background: transparent; color: var(--catalog-ink); cursor: pointer; }
[data-solara-store].catalog-modern .solara-search-form { display: flex; gap: .6rem; margin: 1.5rem 0 2rem; }
[data-solara-store].catalog-modern .solara-search-form input { flex: 1; min-height: 48px; padding: .7rem .8rem; border: 1px solid var(--catalog-border); border-radius: 999px; background: var(--catalog-paper); }
[data-solara-store].catalog-modern .solara-search-results { min-height: 10rem; padding-block: 1.5rem 4rem; }
[data-solara-store].catalog-modern .solara-search-summary { margin-bottom: 1rem; color: var(--catalog-muted); font-size: .9rem; }
[data-solara-store].catalog-modern .solara-editorial-page .solara-page-intro { max-width: 52rem; padding-top: clamp(2.5rem, 5vw, 4rem); padding-bottom: clamp(2.5rem, 5vw, 4rem); }
[data-solara-store].catalog-modern .solara-editorial-page .solara-page-intro h1 { max-width: 12ch; line-height: .95; text-wrap: balance; }
[data-solara-store].catalog-modern .solara-editorial-page .solara-story-grid { align-items: start; gap: clamp(2rem, 6vw, 6rem); padding-block: clamp(3rem, 6vw, 5rem); }
[data-solara-store].catalog-modern .solara-editorial-page .solara-story-grid > div { min-width: 0; }
[data-solara-store].catalog-modern .solara-editorial-page .solara-values-grid { margin-bottom: clamp(3rem, 7vw, 6rem); }
[data-solara-store].catalog-modern .solara-editorial-page .solara-values-grid article { min-width: 0; padding: 1.5rem 1.25rem 2rem; }
[data-solara-store].catalog-modern .solara-cart-page-grid { display: grid; grid-template-columns: minmax(0, 1fr) 280px; gap: 2rem; padding: 2rem 0 5rem; }
[data-solara-store].catalog-modern .solara-cart-page-grid > aside { align-self: start; padding: 1.25rem; border-radius: var(--solara-radius); background: var(--catalog-surface); }
[data-solara-store].catalog-modern .solara-cart-summary { display: grid; gap: .7rem; }
[data-solara-store].catalog-modern .solara-cart-summary > p { display: flex; justify-content: space-between; gap: 1rem; margin: 0; color: var(--catalog-muted); font-size: .85rem; }
[data-solara-store].catalog-modern .solara-cart-summary > p strong { color: var(--catalog-ink); }
[data-solara-store].catalog-modern .solara-cart-summary > p:nth-of-type(3) { padding-top: .75rem; border-top: 1px solid var(--catalog-border); font-size: 1rem; }
[data-solara-store].catalog-modern .solara-cart-page-grid > aside .solara-primary-action { width: 100%; }
[data-solara-store].catalog-modern .solara-cart-page-grid [data-cart-lines] .solara-cart-line { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: .6rem; padding: 1rem 0; border-bottom: 1px solid var(--catalog-border); }
@media (max-width: 1199px) {
  [data-solara-store].catalog-modern .catalog-desktop-nav { gap: .8rem; }
  [data-solara-store].catalog-modern .catalog-search-link span:last-child { display: none; }
  [data-solara-store].catalog-modern .catalog-product-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
}
@media (max-width: 767px) {
  [data-solara-store].catalog-modern .catalog-header-inner { grid-template-columns: auto 1fr auto; gap: .7rem; min-height: 64px; }
  [data-solara-store].catalog-modern .catalog-mobile-menu-button { display: inline-grid; place-items: center; width: 44px; height: 44px; border: 0; background: transparent; font-size: 1.15rem; -webkit-user-select: none; user-select: none; }
  [data-solara-store].catalog-modern .catalog-desktop-nav { display: none; }
  [data-solara-store].catalog-modern .catalog-header-actions { gap: .25rem; }
  [data-solara-store].catalog-modern .catalog-cart-link span { display: none; }
  [data-solara-store].catalog-modern .catalog-mobile-menu[hidden] { display: none; }
  [data-solara-store].catalog-modern .catalog-mobile-menu { position: fixed; z-index: 40; inset: .5rem; display: block; padding: 1.1rem 1.1rem 2rem; overflow: auto; border: 1px solid var(--catalog-border); border-radius: var(--solara-radius); background: var(--catalog-paper); box-shadow: 0 24px 70px rgb(11 11 12 / .2), 0 0 0 100vmax rgb(11 11 12 / .22); -webkit-user-select: none; user-select: none; }
  [data-solara-store].catalog-modern .catalog-mobile-menu__header { display: flex; align-items: center; justify-content: space-between; gap: 1rem; min-height: 3rem; }
  [data-solara-store].catalog-modern .catalog-mobile-brand { color: var(--catalog-ink); font-family: var(--solara-font-display, Georgia, "Times New Roman", serif); font-size: clamp(1.7rem, 8vw, 2.3rem); letter-spacing: -.06em; text-decoration: none; min-width: 0; overflow-wrap: anywhere; max-width: 100%; }
  [data-solara-store].catalog-modern .catalog-mobile-menu__close { display: inline-grid; place-items: center; width: 44px; height: 44px; padding: 0; border: 1px solid var(--catalog-border); border-radius: var(--solara-radius); background: var(--catalog-paper); color: var(--catalog-ink); cursor: pointer; }
  [data-solara-store].catalog-modern .catalog-mobile-menu__close svg { width: 1.5rem; height: 1.5rem; fill: none; stroke: currentcolor; stroke-linecap: round; stroke-linejoin: round; stroke-width: 1.7; }
  [data-solara-store].catalog-modern .catalog-mobile-menu__close:focus-visible,
  [data-solara-store].catalog-modern .catalog-mobile-menu-button:focus-visible { outline: 2px solid var(--catalog-ink); outline-offset: 4px; }
  [data-solara-store].catalog-modern .catalog-mobile-search { margin: 1.25rem 0 1rem; }
  [data-solara-store].catalog-modern .catalog-mobile-search__field { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; align-items: center; gap: .65rem; min-height: 52px; padding: 0 .8rem 0 1rem; border: 1px solid var(--catalog-border); border-radius: 999px; background: var(--catalog-surface); }
  [data-solara-store].catalog-modern .catalog-mobile-search__field > svg { width: 1.25rem; height: 1.25rem; fill: none; stroke: currentcolor; stroke-linecap: round; stroke-linejoin: round; stroke-width: 1.7; }
  [data-solara-store].catalog-modern .catalog-mobile-search__field input { min-width: 0; min-height: 48px; padding: 0; border: 0; outline: 0; background: transparent; color: var(--catalog-ink); font: inherit; }
  [data-solara-store].catalog-modern .catalog-mobile-search__field input::placeholder { color: var(--catalog-muted); }
  [data-solara-store].catalog-modern .catalog-mobile-search__field button { display: inline-grid; place-items: center; width: 36px; height: 36px; padding: 0; border: 0; border-radius: 50%; background: var(--solara-accent); color: var(--solara-accent-text); cursor: pointer; }
  [data-solara-store].catalog-modern .catalog-mobile-menu nav { display: grid; gap: 0; border-top: 1px solid var(--catalog-border); }
  [data-solara-store].catalog-modern .catalog-mobile-menu nav > .catalog-mobile-nav-link,
  [data-solara-store].catalog-modern .catalog-mobile-menu nav > .catalog-mobile-categories > summary { display: flex; align-items: center; gap: .75rem; min-height: 58px; padding: .75rem .25rem; border-bottom: 1px solid var(--catalog-border); color: var(--catalog-ink); font-size: 1rem; text-decoration: none; }
  [data-solara-store].catalog-modern .catalog-mobile-nav-link > span:nth-child(2),
  [data-solara-store].catalog-modern .catalog-mobile-categories > summary > span:nth-child(2),
  [data-solara-store].catalog-modern .catalog-mobile-category > summary > span:nth-child(2) { flex: 1; min-width: 0; }
  [data-solara-store].catalog-modern .catalog-mobile-menu nav > .catalog-mobile-nav-link:hover,
  [data-solara-store].catalog-modern .catalog-mobile-menu nav > .catalog-mobile-categories > summary:hover,
  [data-solara-store].catalog-modern .catalog-mobile-category > summary:hover { background: var(--catalog-surface); }
  [data-solara-store].catalog-modern .catalog-mobile-menu nav > .catalog-mobile-nav-link:focus-visible,
  [data-solara-store].catalog-modern .catalog-mobile-menu nav > .catalog-mobile-categories > summary:focus-visible,
  [data-solara-store].catalog-modern .catalog-mobile-category > summary:focus-visible,
  [data-solara-store].catalog-modern .catalog-mobile-category__children a:focus-visible { outline: 2px solid var(--catalog-ink); outline-offset: -2px; border-radius: 8px; }
  [data-solara-store].catalog-modern .catalog-mobile-categories { display: block; border-bottom: 1px solid var(--catalog-border); }
  [data-solara-store].catalog-modern .catalog-mobile-categories > summary,
  [data-solara-store].catalog-modern .catalog-mobile-category > summary { list-style: none; cursor: pointer; }
  [data-solara-store].catalog-modern .catalog-mobile-categories > summary::-webkit-details-marker,
  [data-solara-store].catalog-modern .catalog-mobile-category > summary::-webkit-details-marker { display: none; }
  [data-solara-store].catalog-modern .catalog-mobile-categories__panel { margin: .5rem 0 .75rem; padding: 0 .7rem; border: 1px solid var(--catalog-border); border-radius: 18px; background: var(--catalog-surface); }
  [data-solara-store].catalog-modern .catalog-mobile-category { border-bottom: 1px solid var(--catalog-border); }
  [data-solara-store].catalog-modern .catalog-mobile-category:last-child { border-bottom: 0; }
  [data-solara-store].catalog-modern .catalog-mobile-category > summary { display: flex; align-items: center; gap: .75rem; min-height: 54px; padding: .7rem .15rem; }
  [data-solara-store].catalog-modern .catalog-mobile-category-link { display: flex; align-items: center; gap: .75rem; min-height: 54px; padding: .7rem .15rem; border-bottom: 1px solid var(--catalog-border); color: var(--catalog-ink); font-size: .95rem; text-decoration: none; }
  [data-solara-store].catalog-modern .catalog-mobile-category-link:focus-visible { outline: 2px solid var(--catalog-ink); outline-offset: -2px; border-radius: 8px; }
  [data-solara-store].catalog-modern .catalog-mobile-category-link > span:nth-child(2) { flex: 1; min-width: 0; }
  [data-solara-store].catalog-modern .catalog-mobile-category__children { margin: 0; padding: 0 0 .35rem 2.45rem; list-style: none; }
  [data-solara-store].catalog-modern .catalog-mobile-category__children a { display: flex; align-items: center; min-height: 48px; padding: .65rem .25rem; border-top: 1px solid var(--catalog-border); color: var(--catalog-muted); font-size: .92rem; text-decoration: none; }
  [data-solara-store].catalog-modern .catalog-mobile-category__children a.catalog-mobile-category__parent { color: var(--catalog-ink); font-weight: 700; }
  [data-solara-store].catalog-modern .catalog-mobile-category__children a.catalog-mobile-category__parent::before { display: none; }
  [data-solara-store].catalog-modern .catalog-mobile-category__children a::before { margin-right: .65rem; color: var(--catalog-ink); content: "•"; }
  [data-solara-store].catalog-modern .catalog-mobile-category[open] > summary .catalog-nav-chevron,
  [data-solara-store].catalog-modern .catalog-mobile-categories[open] > summary .catalog-nav-chevron { transform: rotate(180deg); }
  [data-solara-store].catalog-modern .catalog-hero-inner { display: flex; flex-direction: column; min-height: calc(100svh - 96px); margin-top: .75rem; border-radius: var(--solara-radius); }
  [data-solara-store].catalog-modern .catalog-hero-copy { padding: 2rem 1.25rem 1.5rem; }
  [data-solara-store].catalog-modern .catalog-hero-copy h1 { max-width: 10ch; font-size: calc(clamp(2.7rem, 13vw, 4.5rem) * var(--solara-type-scale, 1)); line-height: .96; }
  [data-solara-store].catalog-modern .catalog-hero-copy > p:not(.catalog-eyebrow) { max-width: 34ch; }
  [data-solara-store].catalog-modern .catalog-hero-actions { display: grid; grid-template-columns: 1fr; }
  [data-solara-store].catalog-modern .catalog-primary-action,
  [data-solara-store].catalog-modern .catalog-secondary-action { width: 100%; }
  [data-solara-store].catalog-modern .catalog-hero-stats { margin-top: 1.6rem; }
  [data-solara-store].catalog-modern .catalog-hero-stats div { padding-right: .55rem; }
  [data-solara-store].catalog-modern .catalog-hero-stats div + div { padding-left: .55rem; }
  [data-solara-store].catalog-modern .catalog-hero-stats dt { font-size: clamp(.9rem, 4vw, 1.1rem); }
  [data-solara-store].catalog-modern .catalog-hero-stats dd { font-size: .66rem; }
  [data-solara-store].catalog-modern .catalog-hero-media { min-height: 45svh; }
  [data-solara-store].catalog-modern .catalog-hero-controls { grid-column: auto; margin: -2.5rem 0 .75rem; }
  [data-solara-store].catalog-modern .catalog-brand-strip-inner ul { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: .7rem; font-size: 1rem; }
  [data-solara-store].catalog-modern .catalog-product-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: calc(1.1rem * var(--solara-space-scale, 1)) calc(.65rem * var(--solara-space-scale, 1)); }
  [data-solara-store].catalog-modern .catalog-product-grid-section,
  [data-solara-store].catalog-modern .catalog-category-bento-section,
  [data-solara-store].catalog-modern .catalog-testimonials-section { width: min(calc(100% - 2rem), var(--solara-container)); padding: 3.25rem 0; }
  [data-solara-store].catalog-modern .catalog-product-grid-section > header,
  [data-solara-store].catalog-modern .catalog-testimonials-section > header { align-items: start; flex-direction: column; }
  [data-solara-store].catalog-modern .catalog-category-bento-section { padding: 1.25rem; }
  [data-solara-store].catalog-modern .catalog-category-bento-grid { grid-template-columns: 1fr; }
  [data-solara-store].catalog-modern .catalog-category-bento-item,
  [data-solara-store].catalog-modern .catalog-category-bento-item--feature,
  [data-solara-store].catalog-modern .catalog-category-bento-item--wide,
  [data-solara-store].catalog-modern .catalog-category-bento-item--tall { min-height: 160px; grid-column: 1; grid-row: auto; }
  [data-solara-store].catalog-modern .catalog-search-dialog-controls { grid-template-columns: 1fr; }
  [data-solara-store].catalog-modern .catalog-search-dialog-controls .catalog-primary-action { width: 100%; }
  [data-solara-store].catalog-modern .catalog-newsletter-inner { align-items: stretch; flex-direction: column; margin-bottom: 2rem; }
  [data-solara-store].catalog-modern .catalog-newsletter-action { width: 100%; }
  [data-solara-store].catalog-modern .catalog-footer-inner { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: calc(1.5rem * var(--solara-space-scale, 1)) calc(1rem * var(--solara-space-scale, 1)); padding-top: calc(2rem * var(--solara-space-scale, 1)); }
  [data-solara-store].catalog-modern .catalog-footer-brand,
  [data-solara-store].catalog-modern .catalog-footer-inner address { grid-column: 1 / -1; }
  [data-solara-store].catalog-modern .catalog-product-detail { width: min(calc(100% - 2rem), var(--solara-container)); }
  [data-solara-store].catalog-modern .catalog-product-detail-inner { display: flex; flex-direction: column; gap: 1.5rem; padding-top: 1.25rem; }
  [data-solara-store].catalog-modern .catalog-product-gallery { display: flex; flex-direction: column; }
  [data-solara-store].catalog-modern .catalog-product-gallery-main { order: 0; }
  [data-solara-store].catalog-modern .catalog-product-gallery-thumbs { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); order: 1; }
  [data-solara-store].catalog-modern .catalog-product-info h1 { max-width: 13ch; font-size: calc(clamp(2.2rem, 12vw, 4rem) * var(--solara-type-scale, 1)); }
  [data-solara-store].catalog-modern .catalog-product-reviews { width: min(calc(100% - 2rem), var(--solara-container)); }
  [data-solara-store].catalog-modern .catalog-product-reviews > header { align-items: start; flex-direction: column; }
  [data-solara-store].catalog-modern .catalog-review-grid { grid-template-columns: 1fr; }
  [data-solara-store].catalog-modern .solara-category-hero { display: flex; flex-direction: column; align-items: stretch; gap: 1rem; padding: 2rem 0 1rem; }
  [data-solara-store].catalog-modern .solara-category-hero h1,
  [data-solara-store].catalog-modern .solara-page-intro h1,
  [data-solara-store].catalog-modern .solara-cart-page h1,
  [data-solara-store].catalog-modern .solara-checkout-page h1 { font-size: calc(clamp(2.7rem, 14vw, 4.5rem) * var(--solara-type-scale, 1)); }
  [data-solara-store].catalog-modern .catalog-category-layout { grid-template-columns: 1fr; gap: 1rem; }
  [data-solara-store].catalog-modern .catalog-category-filters { position: static; padding: 0; border-radius: var(--solara-radius); }
  [data-solara-store].catalog-modern .catalog-category-filters details > summary { display: block; min-height: 44px; padding: .7rem .8rem; }
  [data-solara-store].catalog-modern .catalog-category-filters details[open] > summary { border-bottom: 1px solid var(--catalog-border); }
  [data-solara-store].catalog-modern .catalog-filter-groups { padding: 1rem .8rem; }
  [data-solara-store].catalog-modern .catalog-category-results .catalog-product-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: calc(1.1rem * var(--solara-space-scale, 1)) calc(.65rem * var(--solara-space-scale, 1)); }
  [data-solara-store].catalog-modern .solara-category-toolbar { align-items: stretch; flex-direction: column; }
  [data-solara-store].catalog-modern .solara-search-form { flex-direction: column; }
  [data-solara-store].catalog-modern .solara-search-page .solara-page-intro { padding-bottom: 1.5rem; }
  [data-solara-store].catalog-modern .solara-editorial-page .solara-page-intro h1 { max-width: 10ch; line-height: .98; }
  [data-solara-store].catalog-modern .solara-editorial-page .solara-story-grid { gap: 2.5rem; }
  [data-solara-store].catalog-modern .solara-editorial-page .solara-values-grid article { padding-inline: 0; }
  [data-solara-store].catalog-modern .solara-cart-page-grid { grid-template-columns: 1fr; padding-bottom: 3rem; }
}
@media print {
  [data-solara-store].catalog-modern [data-cart-drawer],
  [data-solara-store].catalog-modern .solara-cart-backdrop,
  [data-solara-store].catalog-modern .catalog-cart-backdrop,
  [data-solara-store].catalog-modern .catalog-mobile-menu,
  [data-solara-store].catalog-modern .catalog-mobile-menu-button,
  [data-solara-store].catalog-modern .catalog-search-dialog,
  [data-solara-store].catalog-modern .catalog-search-dialog::backdrop { display: none !important; }
  [data-solara-store].catalog-modern .catalog-mega-menu,
  [data-solara-store].catalog-modern .catalog-cart-drawer,
  [data-solara-store].catalog-modern .catalog-nav-chevron,
  [data-solara-store].catalog-modern .catalog-mobile-categories[open] > summary .catalog-nav-chevron { transform: none !important; }
}
@media (prefers-reduced-motion: reduce) {
  [data-solara-store].catalog-modern * { scroll-behavior: auto !important; transition-duration: 0.01ms !important; animation-duration: 0.01ms !important; }
  [data-solara-store].catalog-modern .catalog-hero-video { display: none; }
}
`,
  "catalog-modern-v2": `
.cm.v2 {
  --catalog-ink: var(--solara-text, #11110f);
  --catalog-paper: var(--solara-background, #f7f5f0);
  --catalog-surface: var(--solara-surface, #e9e5dd);
  --catalog-muted: var(--solara-muted, #6d6961);
  --catalog-border: var(--solara-border, #d8d2c7);
  --catalog-sale: #a63d2f;
  --catalog-rating: #8d6424;
  --catalog-v2-motion-response: 120ms;
  --catalog-v2-motion-control: 220ms;
  --catalog-v2-motion-component: 380ms;
  --catalog-v2-motion-editorial: 680ms;
  --catalog-v2-ease-out: cubic-bezier(.16, 1, .3, 1);
  --catalog-v2-wide: 1760px;
  --catalog-v2-reading: 720px;
  letter-spacing: -.006em;
}
.cm.v2 [data-solara-module="catalog-header"] {
  position: sticky;
  top: 0;
  z-index: 30;
  background: color-mix(in srgb, var(--catalog-paper), transparent 3%);
  transition: box-shadow var(--catalog-v2-motion-control) ease;
  animation: solara-motion-fade-up var(--catalog-v2-motion-component) var(--catalog-v2-ease-out) both;
}
.cm.v2 [data-solara-module="catalog-header"][data-scrolled="true"] {
  box-shadow: 0 12px 32px color-mix(in srgb, var(--catalog-ink), transparent 92%);
  backdrop-filter: blur(14px);
}
.cm.v2 [data-solara-module="catalog-hero"] {
  animation: solara-motion-fade-up var(--catalog-v2-motion-editorial) var(--catalog-v2-ease-out) 70ms both;
}
.cm.v2 .catalog-announcement-inner {
  min-height: 36px;
  background: var(--catalog-ink);
  font-size: .7rem;
  letter-spacing: .04em;
}
.cm.v2 .catalog-header-inner {
  width: min(calc(100% - 3rem), var(--catalog-v2-wide));
  min-height: 76px;
  border-color: color-mix(in srgb, var(--catalog-border), transparent 18%);
  transition: min-height var(--catalog-v2-motion-control) var(--catalog-v2-ease-out);
}
.cm.v2 [data-scrolled="true"] .catalog-header-inner {
  min-height: 60px;
}
.cm.v2 .catalog-brand {
  font-family: var(--solara-font-display, Georgia, "Times New Roman", serif);
  font-size: clamp(1.85rem, 2vw, 2.45rem);
  font-weight: 500;
  letter-spacing: -.075em;
  transition: font-size var(--catalog-v2-motion-control) var(--catalog-v2-ease-out);
}
.cm.v2 [data-scrolled="true"] .catalog-brand {
  font-size: 1.7rem;
}
.cm.v2 .catalog-desktop-nav {
  font-size: .82rem;
  letter-spacing: .015em;
}
.cm.v2 .catalog-desktop-nav > a,
.cm.v2 .catalog-desktop-nav summary {
  position: relative;
}
.cm.v2 .catalog-desktop-nav > a::after,
.cm.v2 .catalog-desktop-nav summary::after {
  position: absolute;
  right: 0;
  bottom: .38rem;
  left: 0;
  height: 1px;
  transform: scaleX(0);
  transform-origin: right;
  background: currentcolor;
  content: "";
  transition: transform var(--catalog-v2-motion-control) var(--catalog-v2-ease-out);
}
.cm.v2 .catalog-desktop-nav > a:hover::after,
.cm.v2 .catalog-desktop-nav summary:hover::after,
.cm.v2 .catalog-desktop-nav [aria-current="page"]::after {
  transform: scaleX(1);
  transform-origin: left;
}
.cm.v2 .catalog-search-link {
  border-radius: 2px;
  background: transparent;
}
.cm.v2 .catalog-hero-inner {
  grid-template-columns: minmax(20rem, .78fr) minmax(0, 1.22fr);
  width: min(calc(100% - 3rem), var(--catalog-v2-wide));
  height: 90svh;
  min-height: 0;
  margin-top: 1.25rem;
  overflow: hidden;
  isolation: isolate;
  border-radius: 0;
  background: transparent;
}
.cm.v2 .catalog-hero-copy {
  position: relative;
  z-index: 2;
  min-width: 0;
  padding: clamp(2rem, 3.4vw, 3.5rem) clamp(2rem, 3vw, 3.75rem) clamp(2rem, 3vw, 3rem) clamp(1rem, 3vw, 3.5rem);
}
.cm.v2 .catalog-eyebrow {
  margin-bottom: .85rem;
  color: var(--catalog-sale);
  font-size: .68rem;
  letter-spacing: .2em;
}
.cm.v2 .catalog-hero-copy h1 {
  max-width: 9.5ch;
  font-family: var(--solara-font-display, Georgia, "Times New Roman", serif);
  font-size: calc(clamp(4rem, 5.2vw, 6.4rem) * var(--solara-type-scale, 1));
  font-weight: 500;
  letter-spacing: -.065em;
  line-height: .88;
  overflow-wrap: break-word;
  word-break: normal;
  text-wrap: balance;
}
.cm.v2 .catalog-hero-copy > p:not(.catalog-eyebrow) {
  max-width: 38ch;
  margin-top: 1.15rem;
  font-size: clamp(.98rem, 1.1vw, 1.12rem);
  line-height: 1.62;
}
.cm.v2 .catalog-primary-action,
.cm.v2 .catalog-secondary-action,
.cm.v2 .catalog-newsletter-action,
.cm.v2 .solara-primary-action {
  min-height: 50px;
  border-radius: 2px;
  font-size: .78rem;
  letter-spacing: .035em;
  transition: transform var(--catalog-v2-motion-control) var(--catalog-v2-ease-out), box-shadow var(--catalog-v2-motion-control) var(--catalog-v2-ease-out), background-color var(--catalog-v2-motion-response) ease;
}
.cm.v2 .catalog-primary-action:hover,
.cm.v2 .catalog-newsletter-action:hover,
.cm.v2 .solara-primary-action:hover {
  transform: translateY(-3px);
  box-shadow: 0 14px 30px color-mix(in srgb, var(--catalog-ink), transparent 82%);
}
.cm.v2 .catalog-hero-media {
  min-height: 100%;
  overflow: hidden;
  border-radius: 2px;
}
.cm.v2 .catalog-hero-image,
.cm.v2 .catalog-hero-video {
  transform: scale(1.015);
  transition: transform 1.1s var(--catalog-v2-ease-out);
}
.cm.v2 .catalog-hero-inner:hover .catalog-hero-image,
.cm.v2 .catalog-hero-inner:hover .catalog-hero-video {
  transform: scale(1.045);
}
.cm.v2 .catalog-hero-stats {
  margin-top: clamp(1.25rem, 2vw, 2rem);
}
.cm.v2 .catalog-hero-stats dt {
  font-family: var(--solara-font-display, Georgia, "Times New Roman", serif);
  font-weight: 500;
}
.cm.v2 .catalog-brand-strip-inner,
.cm.v2 .catalog-product-grid-section,
.cm.v2 .catalog-category-bento-section,
.cm.v2 .catalog-testimonials-section,
.cm.v2 .catalog-footer-inner {
  width: min(calc(100% - 3rem), var(--catalog-v2-wide));
}
.cm.v2 .catalog-product-grid-section,
.cm.v2 .catalog-testimonials-section {
  padding-block: clamp(5rem, 10vw, 10rem);
}
.cm.v2 .catalog-product-grid-section h2,
.cm.v2 .catalog-category-bento-section h2,
.cm.v2 .catalog-testimonials-section h2 {
  max-width: 12ch;
  font-family: var(--solara-font-display, Georgia, "Times New Roman", serif);
  font-size: calc(clamp(2.8rem, 5.5vw, 6.5rem) * var(--solara-type-scale, 1));
  font-weight: 500;
  letter-spacing: -.075em;
  line-height: .9;
}
.cm.v2 .catalog-product-grid-section > header,
.cm.v2 .catalog-testimonials-section > header {
  margin-bottom: clamp(2rem, 4vw, 4rem);
}
.cm.v2 .catalog-product-grid {
  gap: clamp(1.5rem, 2.4vw, 3rem) clamp(.8rem, 1.4vw, 1.6rem);
  max-width: 1120px;
  margin: 0 auto;
}
.cm.v2 .catalog-product-card {
  transition: transform var(--catalog-v2-motion-component) var(--catalog-v2-ease-out);
}
.cm.v2 .catalog-product-card:hover,
.cm.v2 .catalog-product-card:focus-within {
  transform: translateY(-6px);
}
.cm.v2 .catalog-product-media {
  aspect-ratio: 4 / 5;
  border-radius: 0;
}
.cm.v2 .catalog-product-card-image {
  transition: transform var(--catalog-v2-motion-editorial) var(--catalog-v2-ease-out), filter var(--catalog-v2-motion-component) ease;
}
.cm.v2 .catalog-product-card:hover .catalog-product-card-image,
.cm.v2 .catalog-product-card:focus-within .catalog-product-card-image {
  transform: scale(1.055);
  filter: saturate(1.04) contrast(1.02);
}
.cm.v2 .catalog-product-card-copy {
  padding-top: 1rem;
}
.cm.v2 .catalog-product-card h3 {
  min-height: 0;
  font-family: var(--solara-font-body, Arial, sans-serif);
  font-size: .98rem;
  font-weight: 600;
  letter-spacing: -.02em;
}
.cm.v2 .catalog-view-all {
  position: relative;
  border-bottom: 0;
  padding-bottom: .2rem;
  font-size: .72rem;
  letter-spacing: .08em;
  text-transform: uppercase;
}
.cm.v2 .catalog-view-all::after {
  position: absolute;
  right: 0;
  bottom: 0;
  left: 0;
  height: 1px;
  transform: scaleX(.35);
  transform-origin: left;
  background: currentcolor;
  content: "";
  transition: transform var(--catalog-v2-motion-control) var(--catalog-v2-ease-out);
}
.cm.v2 .catalog-view-all:hover::after,
.cm.v2 .catalog-view-all:focus-visible::after {
  transform: scaleX(1);
}
.cm.v2 .catalog-category-bento-section {
  margin-top: 0;
  padding: clamp(4rem, 8vw, 8rem) clamp(1.5rem, 5vw, 5rem);
  border-radius: 0;
}
.cm.v2 .catalog-category-bento-item {
  overflow: hidden;
  border-radius: 0;
  transition: transform var(--catalog-v2-motion-component) var(--catalog-v2-ease-out), box-shadow var(--catalog-v2-motion-component) var(--catalog-v2-ease-out);
}
.cm.v2 .catalog-category-bento-grid {
  grid-auto-rows: clamp(10rem, 10vw, 12rem);
}
.cm.v2 .catalog-category-bento-item img {
  transition: transform var(--catalog-v2-motion-editorial) var(--catalog-v2-ease-out), filter var(--catalog-v2-motion-component) ease;
}
.cm.v2 .catalog-category-bento-item:hover,
.cm.v2 .catalog-category-bento-item:focus-visible {
  transform: translateY(-4px);
  box-shadow: 0 18px 36px color-mix(in srgb, var(--catalog-ink), transparent 86%);
}
.cm.v2 .catalog-category-bento-item:hover img,
.cm.v2 .catalog-category-bento-item:focus-visible img {
  transform: scale(1.06);
  filter: saturate(.82) contrast(1.06);
}
.cm.v2 .catalog-testimonial {
  border-radius: 0;
  background: color-mix(in srgb, var(--catalog-surface), transparent 34%);
}
.cm.v2 .catalog-footer-inner {
  padding-top: clamp(3rem, 7vw, 7rem);
}
.cm.v2 .solara-category-hero {
  grid-template-columns: minmax(0, 1.15fr) minmax(22rem, .45fr);
  gap: clamp(2rem, 5vw, 6rem);
  padding-top: clamp(4rem, 7vw, 7rem);
}
.cm.v2 .solara-category-hero h1,
.cm.v2 .solara-page-intro h1,
.cm.v2 .solara-cart-page h1,
.cm.v2 .solara-checkout-page h1 {
  max-width: 10ch;
  font-family: var(--solara-font-display, Georgia, "Times New Roman", serif);
  font-size: calc(clamp(4rem, 6.5vw, 8rem) * var(--solara-type-scale, 1));
  font-weight: 500;
  letter-spacing: -.075em;
  line-height: .88;
  overflow-wrap: normal;
}
.cm.v2 .solara-category-hero img { aspect-ratio: 5 / 3; }
.cm.v2 .solara-search-page .solara-page-intro { max-width: none; padding: clamp(3rem, 5vw, 5rem) 0 1.5rem; }
.cm.v2 .solara-search-page .solara-page-intro h1 { max-width: none; font-size: calc(clamp(3.5rem, 4.5vw, 5.75rem) * var(--solara-type-scale, 1)); line-height: .95; }
.cm.v2 .solara-search-page .solara-page-intro > p:not(.solara-eyebrow) { margin: 1rem 0 0; color: var(--catalog-muted); font-size: 1rem; line-height: 1.55; }
.cm.v2 .solara-search-form { display: grid; gap: .7rem; max-width: 72rem; margin: 2rem 0 0; padding-bottom: 0; }
.cm.v2 .solara-search-form > label { font-size: .72rem; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; }
.cm.v2 .solara-search-form > div { display: grid; grid-template-columns: minmax(0, 1fr) 8rem; gap: .65rem; }
.cm.v2 .solara-search-form input { min-height: 52px; padding-inline: 1rem; border-radius: 2px; background: transparent; }
.cm.v2 .solara-search-results { min-height: 18rem; padding-block: clamp(2.5rem, 5vw, 5rem); }
.cm.v2 .solara-search-results > p:only-child { max-width: 34rem; margin: 1rem auto; font-family: var(--solara-font-display, Georgia, "Times New Roman", serif); font-size: clamp(1.55rem, 2.5vw, 2.35rem); line-height: 1.15; text-align: center; }
.cm.v2 .solara-search-summary { margin: 0 0 1.75rem; font-size: 1rem; font-weight: 650; }
.cm.v2 .solara-search-results-grid { grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 3rem clamp(.8rem, 1.4vw, 1.6rem); max-width: 1120px; margin: 0 auto; }
.cm.v2 .solara-search-result { min-width: 0; overflow: hidden; }
.cm.v2 .solara-search-result a { gap: .75rem; }
.cm.v2 .solara-search-result img { transition: transform var(--catalog-v2-motion-editorial) var(--catalog-v2-ease-out), filter var(--catalog-v2-motion-component) ease; }
.cm.v2 .solara-search-result a:hover img { transform: scale(1.035); filter: saturate(1.04) contrast(1.02); }
.cm.v2 .solara-search-result a > div { display: flex; flex-direction: column; align-items: flex-start; gap: .25rem; }
.cm.v2 .solara-search-result h2 { font-family: var(--solara-font-body, Arial, sans-serif); font-size: .98rem; font-weight: 600; letter-spacing: -.02em; }
.cm.v2 .solara-search-result p { order: -1; font-size: .68rem; font-weight: 650; letter-spacing: .07em; text-transform: uppercase; }
.cm.v2 .solara-search-result strong { font-size: .92rem; font-weight: 500; }
.cm.v2 .catalog-category-layout {
  grid-template-columns: 270px minmax(0, 1fr);
  gap: clamp(2.5rem, 4vw, 5rem);
}
.cm.v2 .catalog-category-filters {
  padding: 1.25rem 0;
  border-width: 1px 0;
  border-radius: 0;
  background: transparent;
}
.cm.v2 .catalog-filter-groups fieldset {
  padding-bottom: 1.25rem;
}
.cm.v2 .catalog-filter-groups legend {
  font-size: .68rem;
  letter-spacing: .1em;
  text-transform: uppercase;
}
.cm.v2 .catalog-category-results .solara-category-toolbar {
  min-height: 54px;
  margin-bottom: 1.75rem;
}
.cm.v2 .catalog-category-results .catalog-product-grid {
  gap: clamp(2rem, 3vw, 4rem) clamp(1rem, 1.8vw, 2rem);
}
.cm.v2 .catalog-product-detail,
.cm.v2 .catalog-product-tabs,
.cm.v2 .catalog-product-reviews {
  width: min(calc(100% - clamp(1.5rem, 6vw, 8rem)), var(--catalog-v2-wide));
}
.cm.v2 .catalog-product-detail-inner {
  grid-template-columns: minmax(0, 1.35fr) minmax(420px, .65fr);
  gap: clamp(3rem, 6vw, 8rem);
  padding-block: clamp(3rem, 6vw, 6rem);
}
.cm.v2 .catalog-product-gallery {
  grid-template-columns: 5.5rem minmax(0, 1fr);
  gap: 1rem;
}
.cm.v2 .catalog-product-gallery-main,
.cm.v2 .catalog-product-gallery-thumbs button {
  border-radius: 0;
}
.cm.v2 .catalog-product-gallery-main {
  aspect-ratio: 4 / 5;
}
.cm.v2 .catalog-product-gallery-main figure {
  width: 100%;
  height: 100%;
  aspect-ratio: auto;
}
.cm.v2 .catalog-product-gallery-image {
  transition: transform var(--catalog-v2-motion-editorial) var(--catalog-v2-ease-out);
}
.cm.v2 .catalog-product-gallery-main:hover .catalog-product-gallery-image {
  transform: scale(1.025);
}
.cm.v2 .catalog-product-info {
  position: sticky;
  top: 1.5rem;
  padding-top: 1rem;
}
.cm.v2 .catalog-product-info h1 {
  max-width: 11ch;
  font-family: var(--solara-font-display, Georgia, "Times New Roman", serif);
  font-size: calc(clamp(3.4rem, 4.2vw, 5.5rem) * var(--solara-type-scale, 1));
  font-weight: 500;
  letter-spacing: -.075em;
  line-height: .88;
  overflow-wrap: normal;
}
.cm.v2 .catalog-detail-price {
  margin-top: 1.5rem;
  font-size: 1.4rem;
  font-weight: 650;
}
.cm.v2 .catalog-add-form {
  margin-top: 2rem;
  padding-top: 1.5rem;
}
.cm.v2 .catalog-option-pill,
.cm.v2 .catalog-product-info select,
.cm.v2 .catalog-product-tabs button {
  border-radius: 2px;
}
.cm.v2 .catalog-product-tabs {
  margin-top: 0;
}
.cm.v2 .catalog-cart-drawer {
  width: min(520px, 100%);
  padding: clamp(1.5rem, 3vw, 2.5rem);
  box-shadow: -24px 0 80px color-mix(in srgb, var(--catalog-ink), transparent 80%);
  transition: transform var(--catalog-v2-motion-component) var(--catalog-v2-ease-out);
}
.cm.v2 .catalog-cart-drawer[aria-hidden="true"] {
  visibility: hidden;
}
.cm.v2 .catalog-cart-drawer[data-open="true"] {
  visibility: visible;
}
.cm.v2 .catalog-cart-drawer header h2 {
  font-family: var(--solara-font-display, Georgia, "Times New Roman", serif);
  font-size: clamp(2.2rem, 4vw, 3.4rem);
  font-weight: 500;
  letter-spacing: -.065em;
}
.cm.v2 .catalog-cart-drawer header button {
  border-radius: 2px;
}
.cm.v2 .catalog-cart-items .solara-cart-line {
  grid-template-columns: minmax(0, 1fr) auto;
  gap: .75rem;
}
.cm.v2 .catalog-cart-items .solara-cart-line > div:first-child {
  min-width: 0;
}
.cm.v2 .catalog-cart-items .solara-cart-line > input {
  grid-column: 1;
  width: 5rem;
}
.cm.v2 .catalog-cart-items .solara-cart-line > button {
  grid-column: 2;
  justify-self: end;
}
.cm.v2 .catalog-cart-items .solara-cart-line > span:last-child {
  grid-column: 2;
  grid-row: 1;
  align-self: center;
  white-space: nowrap;
}
.cm.v2 .catalog-cart-backdrop {
  background: color-mix(in srgb, var(--catalog-ink), transparent 45%);
  backdrop-filter: blur(3px);
}
.cm.v2 .solara-cart-page > .solara-page-intro { max-width: none; padding: clamp(3rem, 5vw, 5rem) 0 1rem; }
.cm.v2 .solara-cart-page > .solara-page-intro h1 { max-width: none; font-size: calc(clamp(3.5rem, 4.5vw, 5.75rem) * var(--solara-type-scale, 1)); line-height: .95; }
.cm.v2 .solara-cart-page-grid { grid-template-columns: minmax(0, 1fr) clamp(22.5rem, 27vw, 26rem); gap: clamp(3rem, 6vw, 7rem); padding: 2rem 0 clamp(5rem, 8vw, 8rem); }
.cm.v2 .solara-cart-page-grid > aside { position: sticky; top: 2rem; padding: 1.25rem 0 1.5rem clamp(2rem, 4vw, 4rem); border-left: 1px solid var(--catalog-border); border-radius: 0; background: transparent; }
.cm.v2 .solara-cart-summary { gap: 1rem; }
.cm.v2 .solara-cart-summary > p { min-height: 2rem; align-items: center; font-size: .92rem; }
.cm.v2 .solara-cart-summary > p strong,
.cm.v2 .solara-cart-page-grid aside strong { max-width: 60%; color: var(--catalog-ink); font-family: var(--solara-font-body, Arial, sans-serif); font-size: 1rem; font-weight: 650; line-height: 1.35; text-align: right; }
.cm.v2 .solara-cart-summary > p:nth-of-type(3) { margin-top: .35rem; padding-top: 1rem; font-size: 1rem; }
.cm.v2 .solara-cart-summary > p:nth-of-type(3) strong { font-size: 1.35rem; }
.cm.v2 .solara-cart-page-grid > aside .solara-primary-action { margin-top: .5rem; }
.cm.v2 .solara-cart-page [data-cart-lines] .solara-cart-empty { max-width: 34rem; padding: 1.5rem 0; font-size: 1.05rem; line-height: 1.6; }
.cm.v2 .solara-cart-page-grid [data-cart-lines] .solara-cart-line { grid-template-columns: minmax(0, 1fr) 7rem auto; gap: 1rem; align-items: center; padding: 1.25rem 0; }
.cm.v2 .solara-cart-page-grid [data-cart-lines] .solara-cart-line > div:first-child { display: grid; grid-template-columns: 8rem minmax(0, 1fr); gap: 1rem; align-items: center; }
.cm.v2 .solara-cart-page-grid [data-cart-lines] .solara-cart-line img { width: 8rem; height: 10rem; object-fit: cover; border-radius: 0; }
.cm.v2 .solara-cart-page-grid [data-cart-lines] .solara-cart-line > label { grid-column: 2; grid-row: 1; }
.cm.v2 .solara-cart-page-grid [data-cart-lines] .solara-cart-line input { width: 100%; min-height: 44px; }
.cm.v2 .solara-cart-page-grid [data-cart-lines] .solara-cart-line > button { grid-column: 3; grid-row: 2; justify-self: end; }
.cm.v2 .solara-cart-page-grid [data-cart-lines] .solara-cart-line > span:last-child { grid-column: 3; grid-row: 1; font-family: var(--solara-font-body, Arial, sans-serif); font-weight: 650; white-space: nowrap; }
.cm.v2 .solara-error-hero { display: grid; grid-template-columns: minmax(0, .8fr) minmax(28rem, 1.2fr); min-height: min(520px, calc(100svh - 220px)); overflow: hidden; }
.cm.v2 .solara-error-copy { padding-block: 2rem; }
.cm.v2 .solara-error-copy h1 { margin-top: 1rem; font-size: calc(clamp(4rem, 5.5vw, 7rem) * var(--solara-type-scale, 1)); letter-spacing: -.07em; line-height: .92; }
.cm.v2 .solara-error-copy > p:not(.solara-eyebrow) { max-width: 36rem; margin-top: 1.5rem; color: var(--catalog-muted); font-size: 1.05rem; }
.cm.v2 .solara-error-code { color: color-mix(in srgb, var(--catalog-border), transparent 25%); font-family: var(--solara-font-display, Georgia, "Times New Roman", serif); font-size: clamp(18rem, 31vw, 36rem); letter-spacing: -.1em; line-height: .7; text-align: center; }
.cm.v2 .solara-error-actions { display: flex; flex-wrap: wrap; gap: .75rem; margin-top: 2rem; }
.cm.v2 .solara-checkout-page {
  padding-bottom: clamp(5rem, 9vw, 9rem);
}
.cm.v2 .solara-checkout-page > .solara-page-intro {
  max-width: 72rem;
  padding-top: clamp(3rem, 6vw, 6rem);
  padding-bottom: clamp(2rem, 4vw, 4rem);
}
.cm.v2 .solara-checkout-page h1 {
  max-width: none;
  font-size: calc(clamp(4rem, 5vw, 6.5rem) * var(--solara-type-scale, 1));
}
.cm.v2 .solara-checkout-form-v2 {
  grid-template-columns: minmax(0, 1fr) minmax(25rem, .78fr);
  align-items: start;
  gap: clamp(3rem, 6vw, 8rem);
  max-width: none;
  padding-top: clamp(1rem, 2vw, 2rem);
  padding-bottom: 0;
}
.cm.v2 .solara-checkout-fields {
  display: grid;
  gap: .65rem;
}
.cm.v2 .solara-checkout-fields label {
  margin-top: 1rem;
  font-size: .86rem;
  font-weight: 700;
}
.cm.v2 .solara-checkout-fields input,
.cm.v2 .solara-checkout-fields textarea {
  width: 100%;
  min-height: 54px;
  padding: .85rem 1rem;
  border: 1px solid var(--catalog-border);
  border-radius: 2px;
  background: transparent;
  color: var(--catalog-ink);
}
.cm.v2 .solara-checkout-fields textarea {
  min-height: 96px;
  resize: vertical;
}
.cm.v2 .solara-checkout-fields input:focus-visible,
.cm.v2 .solara-checkout-fields textarea:focus-visible {
  border-color: var(--catalog-sale);
  outline: 2px solid color-mix(in srgb, var(--catalog-sale), transparent 35%);
  outline-offset: 2px;
}
.cm.v2 .solara-checkout-fields .solara-primary-action {
  width: min(100%, 24rem);
  margin-top: 1.25rem;
}
.cm.v2 .solara-checkout-order-panel {
  position: sticky;
  top: 2rem;
  min-width: 0;
  padding: .5rem 0 2rem clamp(2rem, 4vw, 5rem);
  border-left: 1px solid var(--catalog-border);
}
.cm.v2 .solara-checkout-order-panel h2 {
  margin: .35rem 0 .75rem;
  font-family: var(--solara-font-display, Georgia, "Times New Roman", serif);
  font-size: calc(clamp(2.5rem, 4vw, 4.5rem) * var(--solara-type-scale, 1));
  font-weight: 500;
  letter-spacing: -.06em;
  line-height: .95;
}
.cm.v2 .solara-checkout-order-panel > p:not(.solara-eyebrow) {
  max-width: 34rem;
  color: var(--catalog-muted);
}
.cm.v2 .solara-checkout-order-panel pre {
  min-height: 10rem;
  margin: 2rem 0;
  padding: 1.25rem 0;
  overflow-wrap: anywhere;
  white-space: pre-wrap;
  border-block: 1px solid var(--catalog-border);
  color: var(--catalog-ink);
  font: inherit;
}
.cm.v2 .solara-checkout-order-panel pre:empty {
  display: none;
}
.cm.v2 .solara-checkout-order-panel [data-whatsapp-link]:not([hidden]) {
  display: inline-flex;
  width: 100%;
  min-height: 52px;
  align-items: center;
  justify-content: center;
}
@media (max-width: 1199px) {
  .cm.v2 .solara-search-results-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
  .cm.v2 .catalog-hero-inner {
    grid-template-columns: minmax(18rem, .86fr) minmax(0, 1.14fr);
    height: 90svh;
    min-height: 0;
  }
  .cm.v2 .catalog-hero-copy h1 {
    font-size: calc(clamp(3.6rem, 7vw, 5.5rem) * var(--solara-type-scale, 1));
  }
  .cm.v2 .catalog-category-bento-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .cm.v2 .catalog-product-detail-inner {
    grid-template-columns: minmax(0, 1fr);
    gap: 3rem;
  }
  .cm.v2 .catalog-product-info {
    position: static;
  }
}
@media (max-width: 767px) {
  .cm.v2 .catalog-header-inner,
  .cm.v2 .catalog-hero-inner,
  .cm.v2 .catalog-brand-strip-inner,
  .cm.v2 .catalog-product-grid-section,
  .cm.v2 .catalog-category-bento-section,
  .cm.v2 .catalog-testimonials-section,
  .cm.v2 .catalog-footer-inner {
    width: min(calc(100% - 1.5rem), var(--catalog-v2-wide));
  }
  .cm.v2 .catalog-hero-inner {
    display: flex;
    height: auto;
    min-height: 0;
    margin-top: .5rem;
  }
  .cm.v2 .catalog-hero-copy {
    min-height: 0;
    padding: 2.75rem 1rem 2rem;
  }
  .cm.v2 .catalog-hero-copy h1 {
    max-width: 8ch;
    font-size: calc(clamp(3.45rem, 15vw, 5.5rem) * var(--solara-type-scale, 1));
  }
  .cm.v2 .catalog-hero-media {
    min-height: 42svh;
  }
  .cm.v2 .catalog-product-grid-section,
  .cm.v2 .catalog-testimonials-section {
    padding-block: 5rem;
  }
  .cm.v2 .catalog-product-grid-section h2,
  .cm.v2 .catalog-category-bento-section h2,
  .cm.v2 .catalog-testimonials-section h2 {
    font-size: calc(clamp(3rem, 14vw, 5rem) * var(--solara-type-scale, 1));
  }
  .cm.v2 .catalog-product-grid {
    gap: 2rem .7rem;
  }
  .cm.v2 .catalog-product-card:hover {
    transform: none;
  }
  .cm.v2 .catalog-category-bento-section {
    padding: 4rem 1rem;
  }
  .cm.v2 .catalog-category-bento-item--tall {
    min-height: 160px;
    grid-column: 1;
    grid-row: auto;
  }
  .cm.v2 .catalog-filter-toggle:not([open]) + .catalog-filter-groups {
    display: none;
  }
  .cm.v2 .catalog-category-filters:has(details[open]) {
    position: fixed;
    z-index: 52;
    inset: auto 0 0;
    width: 100%;
    max-height: 88dvh;
    padding: 1rem 1rem calc(1.25rem + env(safe-area-inset-bottom));
    overflow-y: auto;
    border: 1px solid var(--catalog-border);
    border-bottom: 0;
    border-radius: 18px 18px 0 0;
    background: var(--catalog-paper);
    box-shadow: 0 -20px 70px color-mix(in srgb, var(--catalog-ink), transparent 68%), 0 0 0 100vmax color-mix(in srgb, var(--catalog-ink), transparent 50%);
  }
  .cm.v2 .catalog-product-detail,
  .cm.v2 .catalog-product-tabs,
  .cm.v2 .catalog-product-reviews {
    width: min(calc(100% - 1.5rem), var(--catalog-v2-wide));
  }
  .cm.v2 .catalog-product-info {
    position: static;
  }
  .cm.v2 .catalog-product-gallery-main figure {
    aspect-ratio: 4 / 5;
  }
  .cm.v2 .catalog-product-info h1 {
    max-width: 10ch;
    font-size: calc(clamp(3.1rem, 15vw, 5.5rem) * var(--solara-type-scale, 1));
  }
  .cm.v2 .solara-search-page .solara-page-intro { padding: 2.5rem 0 1.25rem; }
  .cm.v2 .solara-search-page .solara-page-intro h1,
  .cm.v2 .solara-cart-page > .solara-page-intro h1 { font-size: calc(clamp(3.15rem, 13.5vw, 4.25rem) * var(--solara-type-scale, 1)); line-height: .98; }
  .cm.v2 .solara-search-page .solara-page-intro > p:not(.solara-eyebrow) { margin-top: .85rem; }
  .cm.v2 .solara-search-form { margin-top: 1.75rem; }
  .cm.v2 .solara-search-form > div { grid-template-columns: minmax(0, 1fr); }
  .cm.v2 .solara-search-form .solara-primary-action { width: 100%; }
  .cm.v2 .solara-search-results { min-height: 14rem; padding-block: 2.5rem 4rem; }
  .cm.v2 .solara-search-results > p:only-child { margin-inline: 0; font-size: 1.55rem; text-align: left; }
  .cm.v2 .solara-search-results-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 2rem .7rem; }
  .cm.v2 .solara-cart-page > .solara-page-intro { padding: 2.5rem 0 1rem; }
  .cm.v2 .solara-cart-page-grid { grid-template-columns: minmax(0, 1fr); gap: 3rem; padding: 1.5rem 0 4rem; }
  .cm.v2 .solara-cart-page-grid > aside { position: static; padding: 2rem 0 0; border-left: 0; }
  .cm.v2 .solara-cart-summary > p strong,
  .cm.v2 .solara-cart-page-grid aside strong { max-width: 55%; font-size: 1rem; }
  .cm.v2 .solara-cart-summary > p:nth-of-type(3) strong { font-size: 1.25rem; }
  .cm.v2 .solara-cart-page-grid [data-cart-lines] .solara-cart-line { grid-template-columns: minmax(0, 1fr) auto; gap: .8rem 1rem; }
  .cm.v2 .solara-cart-page-grid [data-cart-lines] .solara-cart-line > div:first-child { grid-column: 1 / -1; grid-template-columns: 4.5rem minmax(0, 1fr); gap: .85rem; }
  .cm.v2 .solara-cart-page-grid [data-cart-lines] .solara-cart-line img { width: 4.5rem; height: 5.625rem; }
  .cm.v2 .solara-cart-page-grid [data-cart-lines] .solara-cart-line > label { grid-column: 1; grid-row: 2; width: 7rem; }
  .cm.v2 .solara-cart-page-grid [data-cart-lines] .solara-cart-line > button { grid-column: 2; grid-row: 3; }
  .cm.v2 .solara-cart-page-grid [data-cart-lines] .solara-cart-line > span:last-child { grid-column: 2; grid-row: 2; justify-self: end; }
  .cm.v2 .solara-error-hero { display: flex; min-height: 0; flex-direction: column; align-items: stretch; padding: 2rem 0 4rem; }
  .cm.v2 .solara-error-copy { padding-block: 1rem 0; }
  .cm.v2 .solara-error-copy h1 { font-size: calc(clamp(3.4rem, 14vw, 4.8rem) * var(--solara-type-scale, 1)); }
  .cm.v2 .solara-error-code { order: 2; margin: 2rem 0 .5rem; font-size: clamp(10rem, 48vw, 14rem); }
  .cm.v2 .solara-error-actions { display: grid; }
  .cm.v2 .solara-checkout-page h1 {
    max-width: 10ch;
    font-size: calc(clamp(3.25rem, 14vw, 5rem) * var(--solara-type-scale, 1));
  }
  .cm.v2 .solara-checkout-form-v2 {
    grid-template-columns: minmax(0, 1fr);
    gap: 3.5rem;
    padding-top: 2rem;
  }
  .cm.v2 .solara-checkout-fields .solara-primary-action {
    width: 100%;
  }
  .cm.v2 .solara-checkout-order-panel {
    position: static;
    padding: 3rem 0 0;
    border-top: 1px solid var(--catalog-border);
    border-left: 0;
  }
  .cm.v2 .catalog-cart-drawer {
    inset: auto 0 0;
    width: 100%;
    height: min(88dvh, 46rem);
    max-height: 88dvh;
    border-radius: 20px 20px 0 0;
    transform: translateY(105%);
  }
  .cm.v2 .catalog-cart-drawer[data-open="true"] {
    transform: translateY(0);
  }
}
@media (prefers-reduced-motion: reduce) {
  .cm.v2 [data-solara-module="catalog-header"],
  .cm.v2 [data-solara-module="catalog-hero"],
  .cm.v2 .catalog-product-card,
  .cm.v2 .catalog-product-card-image,
  .cm.v2 .catalog-category-bento-item img,
  .cm.v2 .catalog-hero-image,
  .cm.v2 .catalog-hero-video {
    animation: none !important;
    transform: none !important;
    transition: none !important;
  }
}
`,
};

export const MODULE_STYLES = `${STORE_BASE_STYLES}\n${Object.values(MODULE_STYLE_BLOCKS).join(
  "\n",
)}`;
