# Zona de pruebas de la IA

Este `proyectos/` del checkout **no** contiene la data real del usuario: aquí
sólo quedan tiendas de prueba transitorias generadas al ejecutar la app en modo
desarrollo (`pnpm dev` o `Abrir SolaraCommerce.cmd` sin `.exe`).

La data real del usuario vive únicamente en la carpeta portable:

```text
.release/portable/SolaraCommerce-Portable/proyectos/
```

`desktop:package` no copia este `proyectos/` a la portable. Reglas completas en
[`../AGENTS.md`](../AGENTS.md) (sección "Dónde vive la data real").
