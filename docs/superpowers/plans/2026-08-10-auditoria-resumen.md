# Auditoría total de la pestaña Resumen — 2026-08-10 — Implementation Plan

> **Ejecución:** Ola 1 = 8 agentes de caza (R1-R8); Ola 2 = 4 agentes de traza/paridad (P1-P4); Ola 3 = fixes por owner; cierre. Alcance heredado de la auditoría de Tema: **arreglar todo lo inútil** — cada control debe producir un efecto visible real en el preview Y en el sitio público exportado.

**Contrato de 4 capas:** funcional / auto-feedback / datos / **utilidad** (diff del sitio exportado antes/después + render).

**Inventario:** Overview.tsx (Identidad: nombre/razón social/descripción/email/teléfono/dirección · WhatsApp: número/saludo/includeSku · Dominio: URL pública/slug · Navegación pública: nombre del catálogo + enlaces + subenlaces · Páginas editoriales) + GuidedOverview.tsx (requisitos/progreso/Siguiente/Modo avanzado/upgrade).

**Candidatos de utilidad dudosa (confirmar con evidencia):** razón social/email/teléfono/dirección (¿consumidos por footer/JSON-LD?); navegación pública (¿los enlaces renderizan en el header del sitio moderno/legacy? ¿nombre del catálogo cambia algo? ¿subenlaces se despliegan?); descripción (¿llega a meta?); slug interno (¿afecta URLs?).

## OLA 1 — CAZA (8 agentes, un lote)

Cada agente: clicks reales (boot `studio-server.ts`, tab Resumen, tienda demo); por control: efecto real asertado, auto-feedback, datos, y **utilidad**: exportar el sitio ANTES/DESPUÉS (patrón `exported-store.spec.ts`) y comparar HTML/CSS; reporte `.superpowers/sdd/resumen-rN-report.md` (MATRIZ 4 capas); spec nuevo `tests/e2e/ui-resumen-rN.spec.ts`. Reglas habituales (index.lock reintentos, biome solo propio, 0 U+FFFD, no editar producción — Ola 3).

| Bin | Controles | Enfoque de utilidad |
|---|---|---|
| R1 | Identidad: nombre (validado), razón social, descripción, email (validado), teléfono, dirección | ¿cada campo llega al sitio exportado (footer/JSON-LD/contacto/meta)? campos huérfanos = hallazgo |
| R2 | WhatsApp: número (sentinel), saludo, toggle incluir SKU | wa.me + mensaje checkout: número/saludo/SKU aparecen en el sitio y en la URL del checkout |
| R3 | Dominio: URL pública (baseUrl) + slug interno | canonical/sitemap/JSON-LD usan la URL nueva; slug afecta el manifiesto/export |
| R4 | Navegación: enlaces (agregar/editar/eliminar/reordenar, destino validado) | ¿los enlaces renderizan en el header del sitio exportado moderno Y legacy? (verificar también nav.showNav/links) |
| R5 | Navegación: subenlaces + "Nombre del catálogo" | ¿subenlaces se despliegan en el header? ¿nombre del catálogo cambia algo en el sitio? |
| R6 | Páginas editoriales (secciones por página) | cambios en páginas → páginas exportadas (Home/About/Contacto) |
| R7 | Flujo guiado: requisitos, progreso, Siguiente, Modo avanzado | ¿los requisitos reflejan el proyecto real? ¿el progreso bloquea producción de verdad? |
| R8 | Upgrade ("Respaldar y adoptar cambios") + persistencia (recarga/guardar/respaldo) | templateVersion 1→2 persiste; cambios de plantilla visibles en el sitio; campos persisten |

## OLA 2 — TRAZA Y PARIDAD (4 agentes, un lote)

| Bin | Misión |
|---|---|
| P1 | Mapa campo→ruta del proyecto→consumo del exporter (identidad/whatsapp/dominio/navegación/páginas): campos sin consumidor = hallazgo con evidencia |
| P2 | Paridad preview↔sitio: mismos valores byte a byte para los campos del Resumen (renderPreviewHtml vs exportProject) |
| P3 | Matriz transversal de utilidad: control → efecto visible en el sitio MODERNO y LEGACY (algunos campos pueden funcionar solo en legacy) |
| P4 | Deep de navegación exportada: header/footer/dropdowns moderno+legacy; JSON-LD del negocio (LocalBusiness: teléfono/email/dirección); qué campos del Resumen faltan del sitio |

## OLA 3 — FIXES (ola por owner según hallazgos)

Alcance aprobado: conectar campos huérfanos al sitio (footer/JSON-LD/nav), navegación pública real en moderno/legacy, y cualquier dead control confirmado (conectar o eliminar). Specs `tests/e2e/ui-resumen-*.spec.ts` con aserciones preview↔sitio.

## CIERRE

Consolidar matriz 4-capas · gates (check, build, budgets, benchmark, test:e2e 575+, portable) · docs (deuda) · ejecutables · push. Verificación de simultaneidad ×5; redespachos en lote.
