# Respaldo y recuperación

## Qué se debe respaldar

Cada tienda vive en IndexedDB dentro del perfil del navegador. No existe una
copia remota automática. Desde `Exportar`, descargar periódicamente
`{tienda}.solara.zip`; ese archivo contiene el proyecto editable y es distinto
del `site.zip` público.

Crear un respaldo antes de:

- actualizar el schema o la aplicación;
- importar un CSV grande;
- ejecutar una edición masiva;
- reemplazar muchas imágenes;
- limpiar datos del navegador.

Guardar al menos una copia fuera del dispositivo.

## Recuperación normal

1. Abrir una tienda o crear una vacía.
2. Ir a `Exportar`.
3. Elegir `Importar respaldo`.
4. Seleccionar el archivo `.solara.zip`.
5. Verificar nombre, productos, secciones e imágenes antes de continuar.
6. Generar un nuevo respaldo para confirmar el ciclo completo.

La importación valida la versión y el schema antes de reemplazar el proyecto
abierto. Un ZIP público no puede importarse como proyecto editable.

## Archivo corrupto o incompatible

No sobrescribir el último respaldo válido. Conservar el archivo rechazado y
registrar el mensaje exacto. Probar primero una copia anterior en un perfil de
navegador separado. Si la versión del proyecto es posterior a la soportada,
actualizar Studio antes de reintentar; no editar el JSON interno a mano.

## Cuota local

Imágenes y variantes responsive consumen la mayor parte del almacenamiento. Si
el navegador informa falta de cuota, exportar el respaldo, eliminar recursos no
usados desde la tienda y reintentar. No limpiar IndexedDB ni los datos del sitio
hasta haber comprobado que el `.solara.zip` puede volver a importarse.
