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
  padding: 0.75rem 1.1rem;
  text-decoration: none;
  white-space: nowrap;
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
[data-solara-store] .solara-category-children a {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.75rem;
  min-height: 44px;
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
  text-decoration: none;
  text-underline-offset: 0.45rem;
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
[data-solara-module="editorial-product-grid"] .solara-product-copy h3 {
  font-size: 1.2rem;
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
};

export const MODULE_STYLES = `${STORE_BASE_STYLES}\n${Object.values(MODULE_STYLE_BLOCKS).join(
  "\n",
)}`;
