# Estrategia de rediseño premium del dashboard

## Estado

Fase 1 - auditoría inicial. El trabajo visual debe permanecer aislado y reversible.

## Aislamiento propuesto

- Rama objetivo: `codex/dashboard-premium-redesign`.
- Si la creación de rama no está disponible por permisos del entorno Git, mantener cambios limitados a archivos nuevos de documentación y crear la rama antes de modificar componentes.
- No modificar modelos de negocio, persistencia, exportación ni flujos de tiendas durante la primera etapa.

## Auditoría inicial

### Arquitectura encontrada

- `apps/studio/src/App.tsx` funciona como shell principal: carga proyectos, persistencia, recuperación y monta el editor.
- `apps/studio/src/features/Studio.tsx` concentra la navegación del editor y el flujo de edición.
- `apps/studio/src/features/Dashboard.tsx` contiene la biblioteca de tiendas, creación, selección, duplicado, archivo, backups y comparación.
- Los estilos globales se separan en `base`, `components`, `dashboard` y `editorial`.

### Hallazgos UX/UI

1. El dashboard ya tiene capacidades avanzadas, pero la presentación está orientada a herramienta interna y necesita una jerarquía más cercana a SaaS comercial.
2. La pantalla inicial debe comunicar mejor estado de tienda, progreso y próximas acciones.
3. La navegación del editor necesita una agrupación más clara entre configuración, creación de contenido, catálogo y publicación.
4. Los componentes existentes permiten una evolución visual sin cambiar la lógica principal.
5. Hay que conservar estados de error, recuperación y persistencia como contratos funcionales.

## Dirección visual propuesta

- Producto SaaS premium con estética editorial limpia.
- Tipografía con mayor contraste entre títulos, acciones y metadatos.
- Superficies por capas, bordes suaves, sombras discretas y estados claros.
- Sistema único de botones, campos, tarjetas, feedback y navegación.
- Menos sensación de panel administrativo y más sensación de estudio creativo.

## Arquitectura UX propuesta

### Dashboard principal

- Cabecera con tienda activa, estado y acción principal.
- Resumen de progreso y salud del proyecto.
- Acciones frecuentes visibles.
- Biblioteca de tiendas con información más escaneable.

### Editor

- Navegación agrupada por intención del usuario.
- Acciones persistentes de guardar, preview y publicar.
- Feedback inmediato después de operaciones importantes.

## Fases siguientes

1. Crear propuesta visual de pantallas y componentes.
2. Implementar un shell visual alternativo con flag de activación.
3. Migrar componentes progresivamente sin tocar lógica.
4. Validar rutas, persistencia, exportación y responsive.

## Criterio de aceptación

- El diseño anterior puede restaurarse eliminando el override visual.
- Las funciones existentes mantienen el mismo comportamiento.
- No se modifican contratos persistidos ni datos de tiendas.
