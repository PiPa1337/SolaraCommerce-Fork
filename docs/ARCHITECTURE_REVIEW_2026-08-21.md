# Revision Arquitectonica 2026-08-21

Working tree unica fuente. Medicion real sin opiniones abstractas.

## Resumen ejecutivo
13 deudas con evidencia concreta. God-files ~5863L y money duplicado 4 sitios riesgo Preview != Export != Runtime != WhatsApp. 2 refactors bajo riesgo ejecutados (R1 runtime inner->exported, R2 module-sdk->money.ts). Resto planificado con costo/tests. Ranking prioriza money (score 40.5) y split exporter.

## Metodo
- LOC Get-Content Measure-Object y findstr simbolos.
- Deps package.json workspaces.
- Duplicacion formatMoney/formatPrice/productIds/WeakMap/search/internalHref.
- Invariantes superRefine 1322 y synchronizeAssignments 161.

## Deudas con evidencia

### A1 exporter/src/index.ts 2796L 62 funcs god
Evidencia 62 funcs. Riesgo triple superficie. Costo alto split 4 modulos 3-4d. Propuesta fachada. Tests determinism.

### A2 Studio.tsx 1112L 15 useEffect god shell
Riesgo stale/409 focus trap. Costo medio hooks 1-2d.

### A3 storefront-runtime 1955L god runtime
Cart+WhatsApp+money+boot 1200L. Costo medio split.

### B1 Exporter 6 deps acoplamiento estrecho
Costo bajo madge gate 2h.

### B2 Theme leaking
Costo medio centralizar ThemeSchema.

### C1 Money x4 P0 duplica Intl
1 project-schema/money.ts formatPrice canonico, 2 module-sdk formatMoney, 3 storefront-runtime formatMoney, 4 inner formatMoneyRuntime. Exporter wrapper delega bien. Riesgo alta prob/alto impacto dinero. Costo bajo 1h IMPLEMENTADO.

### C2 Search dup
Copia con parity test.

### C3 Asset WeakMap vs linear
Bajo.

### C4 URL dual internalHref vs assetHref
Medio.

### D1 productIds manual
superRefine vs synchronizeAssignments. Alto silencioso. Plan centralizar.

### D2 priceFraction vs machine-readable
Offer .toFixed(2) sin test auto. Medio-Alto SEO.

### D3 schemaVersion literales
Bajo.

### E1 DomainCommand.at string
Medio.

### E2 History snapshots sin limite
Medio.

### F1 Preview transport
Medio.

## Refactors ejecutados

### R1 Runtime inner -> exported
storefront-runtime RUNTIME_HELPERS + formatMoneyRuntime delega a formatMoney(cents,currency,locale,display). Elimina 1 duplicacion, paridad cart/WhatsApp/export. Tests price-format 9 casos.

### R2 module-sdk -> money.ts
import formatPrice y delega. Elimina 2a duplicacion. Tests money.test paralelos.

## Plan grandes (no ejecutados)
- P1 Split exporter 3d
- P2 Hooks Studio 1.5d
- P3 Centralizar productIds + limitar History 1d
- P4 Unificar URLs 0.5d

## Ranking impacto x prob / costo
| Rank | Hallazgo | Imp | Prob | Costo | Score | Estado |
| 1 | C1 Money | 9 | 9 | 2 | 40.5 | DONE R1+R2 |
| 2 | B1 Circular | 6 | 5 | 2 | 15 | TODO |
| 3 | E1 Command | 5 | 5 | 2 | 12.5 | TODO |
| 4 | D1 productIds | 8 | 7 | 5 | 11.2 | Plan |
| 5 | D2 machine | 7 | 3 | 2 | 10.5 | Test |
| 6 | A1 God exporter | 9 | 8 | 7 | 10.3 | Plan |
| 7 | C2 Search | 5 | 6 | 3 | 10 | Keep |
| 8 | A2 Studio | 7 | 7 | 5 | 9.8 | Plan |
| 9 | C4 URL | 6 | 6 | 4 | 9 | Plan |
|10 | A3 Runtime | 6 | 6 | 5 | 7.2 | Plan |
|11 | C3 Asset | 4 | 3 | 2 | 6 | Backlog |
|12 | E2 History | 5 | 4 | 4 | 5 | Backlog |
|13 | B2 Theme | 6 | 4 | 5 | 4.8 | Backlog |

## Gates
- check:fast y test workspace verdes tras R1+R2
- determinism y parity verdes

