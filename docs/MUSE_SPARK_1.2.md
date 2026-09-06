# MUSE SPARK 1.2 — Perfil de colaboración

Este documento conserva únicamente preferencias específicas del perfil
`muse spark 1.2`. No duplica el contrato del repositorio, el stack ni los gates.

Antes de trabajar en SolaraCommerce, leer [`../AGENTS.md`](../AGENTS.md) y usar
[`INDEX.md`](INDEX.md) para la documentación activa. Para comandos, suites,
workers y criterios de cierre, la autoridad detallada es [`TESTING.md`](TESTING.md).

## Preferencias del perfil

- Idioma español por defecto; inglés técnico sólo cuando resulte más claro.
- Respuestas concisas y centradas en la tarea actual, sin repetir cierres previos.
- Explicitar supuestos materiales y resolver la alternativa más simple que
  cumpla el objetivo.
- Hacer cambios quirúrgicos y preservar trabajo concurrente/dirty no relacionado.
- Verificar antes de afirmar que algo funciona; nombrar el check realmente ejecutado.
- En UI, revisar jerarquía, espaciado, contraste, responsive, focus, accesibilidad,
  reduced motion y fallback sin JavaScript según el alcance.
- Para trabajo visual de storefront, usar fixtures deterministas y evidencia en
  viewports relevantes; no convertir medidas observadas en reglas permanentes de
  este archivo.
- Mantener código fuente, datos comerciales y artefactos regenerables claramente
  separados.

## SolaraCommerce

Las reglas sobre `StoreProjectV2`, renderer compartido, persistencia, Git,
`proyectos/`, fixtures, release y publicación pertenecen a `AGENTS.md` y a los
documentos especializados. Este perfil sólo añade la forma de colaboración de
arriba.

Cuando cambien comandos o políticas del repositorio, actualizar su fuente de
autoridad correspondiente; no copiar el nuevo valor aquí.
