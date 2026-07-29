export const STORE_BASE_STYLES = `
[data-solara-store] {
  color: var(--solara-text);
  background: var(--solara-background);
  font-family: var(--solara-font-body);
  line-height: 1.5;
}
[data-solara-store][data-color-mode="dark"] {
  --solara-background: #151917;
  --solara-surface: #202622;
  --solara-text: #edf1ef;
  --solara-muted: #aeb9b3;
  --solara-border: #3a443e;
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
  font-weight: 620;
  letter-spacing: -0.035em;
  line-height: 1.02;
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
[data-solara-store] .solara-primary-action:active,
[data-solara-store] .solara-secondary-action:active,
[data-solara-store] button:active {
  transform: translateY(1px);
}
@media (prefers-color-scheme: dark) {
  [data-solara-store][data-color-mode="auto"] {
    --solara-background: #151917;
    --solara-surface: #202622;
    --solara-text: #edf1ef;
    --solara-muted: #aeb9b3;
    --solara-border: #3a443e;
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
  font-size: 0.82rem;
  gap: 1rem;
  justify-content: center;
  margin: 0 auto;
  max-width: var(--solara-container);
  min-height: 36px;
  padding: 0.4rem 1rem;
}
[data-solara-module="announcement-bar"] a {
  font-weight: 700;
}
`,
  "editorial-header": `
[data-solara-module="editorial-header"] {
  background: color-mix(in srgb, var(--solara-background), transparent 4%);
  border-bottom: 1px solid var(--solara-border);
  position: relative;
  z-index: 10;
}
[data-solara-module="editorial-header"] .solara-header {
  align-items: center;
  display: grid;
  gap: 1.2rem;
  grid-template-columns: minmax(8rem, 1fr) auto auto;
  margin: 0 auto;
  max-width: var(--solara-container);
  min-height: 72px;
  padding: 0 1.25rem;
}
[data-solara-module="editorial-header"] .solara-brand {
  font-family: var(--solara-font-display);
  font-size: 1.25rem;
  font-weight: 720;
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
}
[data-solara-module="editorial-header"] .solara-desktop-nav a:hover {
  color: var(--solara-text);
}
[data-solara-module="editorial-header"] .solara-cart-trigger {
  background: var(--solara-text);
  border: 0;
  border-radius: var(--solara-radius);
  color: var(--solara-background);
  cursor: pointer;
  min-height: 42px;
  padding: 0.55rem 0.9rem;
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
  }
  [data-solara-module="editorial-header"] .solara-cart-trigger {
    grid-column: 2;
    grid-row: 1;
  }
}
`,
  "split-hero": `
[data-solara-module="split-hero"] {
  padding: calc(2rem * var(--solara-space)) 1.25rem;
}
[data-solara-module="split-hero"] .solara-split-hero {
  align-items: stretch;
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1.2fr);
  margin: 0 auto;
  max-width: var(--solara-container);
  min-height: min(760px, calc(100dvh - 130px));
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
  padding: clamp(2rem, 3vw, 2.5rem);
}
[data-solara-module="split-hero"] .solara-eyebrow {
  color: var(--solara-muted);
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.14em;
  margin-bottom: 1.4rem;
  text-transform: uppercase;
}
[data-solara-module="split-hero"] h1 {
  font-size: clamp(2.8rem, 4.2vw, 4.5rem);
  max-width: 17ch;
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
  border-radius: var(--solara-radius);
  min-height: 28rem;
  overflow: hidden;
}
[data-solara-module="split-hero"] .solara-hero-image {
  height: 100%;
  object-fit: cover;
  width: 100%;
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
  [data-solara-module="split-hero"] .solara-hero-copy {
    padding: 3rem 0.4rem;
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
  padding: clamp(3rem, 8vw, 7rem) 1.25rem 2rem;
}
[data-solara-module="editorial-hero"] .solara-editorial-hero {
  display: grid;
  gap: clamp(2rem, 5vw, 5rem);
  margin: 0 auto;
  max-width: var(--solara-container);
}
[data-solara-module="editorial-hero"] .solara-editorial-head {
  align-items: end;
  display: grid;
  gap: 1.5rem;
  grid-template-columns: minmax(0, 1fr) minmax(16rem, 0.32fr);
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
  font-size: clamp(3.4rem, 8vw, 8rem);
  max-width: 10ch;
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
  border-radius: var(--solara-radius);
  height: clamp(28rem, 66vw, 52rem);
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
  [data-solara-module="editorial-hero"] .solara-editorial-head {
    align-items: start;
    grid-template-columns: 1fr;
  }
  [data-solara-module="editorial-hero"] h1 {
    font-size: clamp(3rem, 15vw, 5rem);
  }
  [data-solara-module="editorial-hero"] figure {
    height: 58vh;
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
  margin-bottom: 2.5rem;
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
  font-size: 1.5rem;
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
  margin-bottom: 2.5rem;
}
[data-solara-module="editorial-product-grid"] .solara-editorial-products {
  display: grid;
  gap: clamp(2rem, 4vw, 4rem) clamp(1rem, 2.5vw, 2.5rem);
  grid-template-columns: repeat(3, minmax(0, 1fr));
}
[data-solara-module="editorial-product-grid"] .solara-product-card:nth-child(5n + 1) {
  grid-column: span 2;
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
  [data-solara-module="editorial-product-grid"] .solara-product-copy {
    display: grid;
  }
}
`,
  "compact-product-grid": `
[data-solara-module="compact-product-grid"] {
  padding: clamp(3rem, 7vw, 6rem) 1.25rem;
}
[data-solara-module="compact-product-grid"] .solara-section-shell {
  margin: 0 auto;
  max-width: var(--solara-container);
}
[data-solara-module="compact-product-grid"] h2 {
  font-size: clamp(2rem, 4vw, 3.5rem);
  margin-bottom: 2rem;
}
[data-solara-module="compact-product-grid"] .solara-compact-products {
  display: grid;
  gap: 2.25rem 1rem;
  grid-template-columns: repeat(4, minmax(0, 1fr));
}
[data-solara-module="compact-product-grid"] .solara-product-media {
  aspect-ratio: 4 / 5;
  background: var(--solara-surface);
  border-radius: var(--solara-radius);
  display: block;
  overflow: hidden;
}
[data-solara-module="compact-product-grid"] .solara-product-image {
  height: 100%;
  object-fit: cover;
  width: 100%;
}
[data-solara-module="compact-product-grid"] .solara-product-copy {
  display: grid;
  gap: 0.45rem;
  margin-top: 0.8rem;
}
[data-solara-module="compact-product-grid"] .solara-product-copy h3 {
  font-size: 1rem;
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
}
@media (max-width: 920px) {
  [data-solara-module="compact-product-grid"] .solara-compact-products {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}
@media (max-width: 640px) {
  [data-solara-module="compact-product-grid"] {
    padding: 3rem 1rem;
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
[data-solara-module="product-detail"] .solara-product-detail > figure {
  background: var(--solara-surface);
  border-radius: var(--solara-radius);
  overflow: hidden;
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
}
[data-solara-module="product-detail"] h1 {
  font-size: clamp(2.7rem, 5vw, 5rem);
  margin-top: 0.6rem;
}
[data-solara-module="product-detail"] .solara-detail-price {
  font-size: 1.25rem;
  font-weight: 700;
  margin-top: 1.5rem;
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
  background: var(--solara-background);
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
[data-solara-module="product-detail"] .solara-delivery-note {
  color: var(--solara-muted);
  font-size: 0.85rem;
  margin-top: 1rem;
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
  grid-template-columns: 1fr 1fr;
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
  border-radius: var(--solara-radius);
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
  padding: 1.2rem clamp(1rem, 3vw, 2.5rem);
}
[data-solara-module="trust-strip"] article:first-child {
  border-left: 0;
  padding-left: 0;
}
[data-solara-module="trust-strip"] h3 {
  font-size: 1.2rem;
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
  background: rgb(15 18 16 / 0.54);
  inset: 0;
  position: fixed;
  z-index: 40;
}
[data-solara-module="cart-drawer"] .solara-cart-drawer {
  background: var(--solara-background);
  box-shadow: -18px 0 70px rgb(18 32 25 / 0.22);
  display: grid;
  gap: 1.5rem;
  grid-template-rows: auto minmax(0, 1fr) auto auto;
  height: 100dvh;
  max-width: 30rem;
  overflow-y: auto;
  padding: 1.25rem;
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
  font-size: 1.7rem;
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
  background: var(--solara-background);
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
@media (prefers-reduced-motion: reduce) {
  [data-solara-module="cart-drawer"] .solara-cart-drawer {
    transition: none;
  }
}
`,
  "editorial-footer": `
[data-solara-module="editorial-footer"] {
  background: var(--solara-surface);
  border-top: 1px solid var(--solara-border);
  padding: clamp(3rem, 7vw, 6rem) 1.25rem 2rem;
}
[data-solara-module="editorial-footer"] .solara-footer {
  display: grid;
  gap: 3rem;
  grid-template-columns: minmax(16rem, 1.4fr) 0.8fr 0.8fr;
  margin: 0 auto;
  max-width: var(--solara-container);
}
[data-solara-module="editorial-footer"] .solara-brand {
  font-family: var(--solara-font-display);
  font-size: clamp(2rem, 5vw, 4.5rem);
  font-weight: 700;
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
};

export const MODULE_STYLES = `${STORE_BASE_STYLES}\n${Object.values(MODULE_STYLE_BLOCKS).join(
  "\n",
)}`;
