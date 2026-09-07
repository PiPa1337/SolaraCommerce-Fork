import { writeFileSync } from 'node:fs';
import { renderPreviewHtml } from './packages/exporter/src/index.ts';
import { catalogModernStore } from '@solara/project-schema/catalog-modern-fixture';
writeFileSync('.tmp-margin-home.html', renderPreviewHtml(catalogModernStore, 'draft', '/'));
writeFileSync('.tmp-margin-category.html', renderPreviewHtml(catalogModernStore, 'draft', '/categoria/remeras/'));
writeFileSync('.tmp-margin-product.html', renderPreviewHtml(catalogModernStore, 'draft', '/producto/remera-basica/'));
console.log('written');
