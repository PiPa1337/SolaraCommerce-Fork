el footer, la linea y © 2026 Predeterminado. Todos los derechos reservados.
Hecho con ❤️ en solara.com.ar no se expande correctamente horizontalmente

el padding  o margin que me gustaria que sea consistente en todas las paginas segun viewport, donde esta bien actualmente es en la seccion explorar por categoria. aplicalo correctamente y dinamicamente a las demas paginas segun viewport y comprobalo por vision nativa

he abierto la app abri el sitio, abri la tienda y guarde una nueva version y no pude ver los cambios. si no estas recopilando los exes es necesario hacerlo siempre recuerdalo

en tablet y viewport por debajo de ese, la seccion de formulario escribinos y nuestros canales, no se ve correctamente ya que estan una al lado de la otra pero quedaria mejor una encima de otra

mis commits estan fallando, chequea el historial de commits tengo un monton fallados, porque estan over budget, elimina ese requerimiento de budget para hacer commits

en mobile L, el titulo o logo 'Predeterminado' se corta fixealo y confirma con vision nativa. tambien ocurre en el footer

en mobile 320px hasta tablet, los titulos de las cards de las seccion explora por categoria, son muy grandes y no respetan la jerarquia visual, ademas no entran bien segun viewport se cortan, comproba por vision y fixealo. por ejemplo los titulos de productos, tienen un tamño correcto usemos ese y el formato tambien de ese texto

cuando el carrito tiene 0 productos se ve bien, pero cuando tiene 10, o 100 se ve mal el ciruclito que lo envuelve y distorsiona el demas ui ya que cambia de tamaño

en categorias, el panel izquierdo de busqueda, se queda correctamente en la pantalla mientras scrolleo, pero el sticky es incorrecto, porque la parte de disponibilidad se tapa con el navbar

cuando en la grid de productos, en categorias/x y tambien en otros lugares hay por ejemplo solo dos, se redimensionan demasiado grandes, o cuando hay menos de 4, lo peor es cuando hay 1, se hace gigante. hay muchas instancias donde dice modo sur, en lugar del nombre real de la tienda 'Predeterminadolol' debe ser dinamiacamente acctualziado, el previop era 'Predeterminado'.

tambien tenemos muchos faltantes o errores en el SEO, ej titulo description, keywords, robots tags, author, publishger, og image, en falta de datos y en no conexion real con la tienda, por ejemplo og description esta hardcodeado, y asi otras

en categorias o busqueda en panel izquierdo cuando hago clic se envuelve el modulo en el color de acento, pero solo deberia hacerlo en hover

cuando voy a /categorias/camisas/ que camisas tambien puede ser x, pasa con topdas, la imagen de portada de la camisas recorta la imagen real

en los productos, tenemos estos 3 items que muestrean distintas cosas al pulsar, pero me gustaria que toda esa informacion este presente en todo momento en la pagina de producto x y eliminarlos ya que no serian utiles: Detalles
Envíos y cambios
Reseñas

en las paginas de productos, eliminar todo lo que diga reseñas, ya que no lo vamos a usar porque requjiere back end

asegurate de ir reconstruyendo nuestros exes en cada cambio

en las paginas de productos, eliminar todo lo que diga reseñas, ya que no lo vamos a usar porque requjiere back end

Usá el working tree local actual como única fuente de verdad. No hagas checkout, reset, stash, clean, pull ni descartes cambios sin commitear. No hagas commit ni push salvo que te lo pida explícitamente.

Realizá un red-team profundo del sistema de persistencia de SolaraCommerce. El objetivo es intentar provocar pérdida, corrupción, sobrescritura o divergencia silenciosa de una tienda.

Auditá específicamente:
- apps/studio/src/lib/repository.ts
- localStorage.ts
- localProjectRepository.ts
- projectArchive.ts
- packages/exporter/scripts/local-project-storage.mjs
- solara-request-handler.mjs
- serve.mjs
- recovery drafts de IndexedDB
- manifest/versionado
- staging, SHA-256 y renames atómicos
- manejo de 409/conflictos

Diseñá y ejecutá escenarios adversariales:
1. guardar y cerrar/interrumpir en cada punto sensible;
2. dos pestañas editando la misma tienda;
3. versiones de disco y recovery draft divergentes;
4. manifest válido con backup inválido y viceversa;
5. fallo después de escribir backup pero antes de production;
6. fallo después de exportar production pero antes de actualizar manifest;
7. reintentos después de errores transitorios;
8. archivos faltantes, truncados o modificados externamente;
9. nombre/ruta con espacios, Unicode y longitudes extremas;
10. reiniciar servidor en momentos críticos.

No te limites a leer tests existentes. Intentá encontrar estados que la suite actual no modele.

Por cada fallo real:
TDD → reproducir → identificar causa raíz → corregir → agregar regresión → ejecutar gate proporcional.

Invariantes finales:
- nunca perder el último proyecto editable válido;
- nunca reemplazar un sitio público válido por uno incompleto;
- recovery nunca puede sobreescribir silenciosamente una versión más nueva;
- una operación fallida debe ser atómica desde la perspectiva del usuario.

Terminá únicamente cuando no encuentres más defectos reproducibles dentro del alcance y entregá un resumen corto de bugs reales encontrados, archivos cambiados y tests añadidos.

Usá el working tree local actual. No descartes cambios locales ni hagas commit/push.

Quiero una auditoría exhaustiva de paridad entre Studio Preview y el sitio exportado.

No asumas que compartir @solara/exporter garantiza paridad: demostralo.

Construí una matriz que cubra todos los moduleId, settings y rutas públicas relevantes:
- home
- categorías padre/hija
- producto
- buscar
- carrito
- compra
- contacto
- nosotros
- cualquier otra ruta actualmente generada

Para cada combinación relevante compará:
- árbol semántico;
- textos y URLs;
- clases/atributos estructurales;
- assets;
- navegación;
- SEO;
- data-solara-features;
- comportamiento responsive;
- estado sin JavaScript;
- estado con JavaScript;
- reduced motion;
- contenido condicionado por settings.

Generá proyectos deterministas que ejerciten valores extremos de cada módulo, no sólo fixtures felices.

Buscá especialmente:
- defaults diferentes entre Studio/modules/exporter;
- settings aceptados por Zod pero ignorados al renderizar;
- Preview que tolere algo que export rechace;
- asset URLs distintas;
- módulos legacy que contaminen V2;
- divergencias introducidas por postMessage/iframe;
- código que dependa del entorno Vite.

Automatizá nuevas verificaciones de equivalencia donde sea razonable. Evitá snapshots gigantes y frágiles: compará invariantes estructurales.

Cualquier divergencia no intencional debe corregirse con una única fuente de verdad, no con dos parches equivalentes.

Después ejecutá tests de exporter, Studio, pnpm check, build y E2E proporcional.

Hacé una campaña de fuzzing/property testing sobre StoreProjectV2 y las operaciones de @solara/core.

Objetivo: encontrar estados que sean aceptados pero inconsistentes, operaciones que rompan invariantes o secuencias válidas que terminen en un proyecto inválido.

Generá secuencias aleatorias y reproducibles de:
- crear/eliminar/editar productos;
- variantes;
- categorías;
- parentId;
- colecciones;
- tags;
- disponibilidad;
- precios;
- assets;
- navegación;
- módulos;
- duplicación;
- reorder;
- undo/redo.

Invariantes a comprobar después de CADA operación:
- StoreProjectV2Schema.parse debe aceptar el resultado;
- IDs únicos;
- slugs válidos y coherentes;
- ninguna referencia huérfana;
- jerarquía máxima permitida;
- ningún ciclo;
- productIds derivados correctos;
- precios siempre enteros en centavos;
- undo seguido de redo recupera semánticamente el mismo proyecto;
- comandos rechazados no dejan mutación parcial;
- serializar/deserializar conserva semántica.

Incluí secuencias largas de cientos o miles de operaciones con seed impresa al fallar para reproducción exacta.

No agregues una dependencia pesada si puede resolverse razonablemente con Vitest y generadores propios.

Cuando encuentres una secuencia mínima que falle:
reducila → test de regresión → fix → repetir fuzzing.

Quiero bugs corregidos, no sólo estadísticas.

Realizá una investigación de performance basada en medición real de SolaraCommerce.

No optimices por intuición.

Construí escenarios reproducibles con:
50, 500, 2.000, 5.000 y 10.000 productos,
variantes proporcionales,
hasta 40 categorías,
colecciones y assets representativos.

Medí por separado:
- construcción/validación de StoreProject;
- reducer/comandos;
- filtros y búsqueda del Studio;
- render de listas;
- serialización;
- guardado;
- exportProject;
- optimizer;
- generación de search-index/catalog-index;
- tamaño del HTML/CSS/JS;
- memoria pico;
- tiempo de interacción relevante en Studio;
- tiempo del worker;
- startup del preview.

Instrumentá temporalmente si hace falta, pero no dejes logging ruidoso en producción.

Buscá:
- O(n²);
- múltiples recorridos evitables del catálogo;
- JSON stringify/parse repetido;
- copias profundas innecesarias;
- estructuras derivadas recalculadas;
- React rerenders excesivos;
- arrays gigantes reconstruidos;
- trabajo del main thread que debería estar en worker.

Para cada optimización exigí:
1. benchmark antes;
2. cambio;
3. benchmark después;
4. porcentaje real de mejora;
5. tests que demuestren que el comportamiento no cambió.

No sacrifiques determinismo, legibilidad ni seguridad por micro-optimizaciones.

Al final dejá una tabla:
Métrica | Antes | Después | Δ%

Realizá una investigación de performance basada en medición real de SolaraCommerce.

No optimices por intuición.

Construí escenarios reproducibles con:
50, 500, 2.000, 5.000 y 10.000 productos,
variantes proporcionales,
hasta 40 categorías,
colecciones y assets representativos.

Medí por separado:
- construcción/validación de StoreProject;
- reducer/comandos;
- filtros y búsqueda del Studio;
- render de listas;
- serialización;
- guardado;
- exportProject;
- optimizer;
- generación de search-index/catalog-index;
- tamaño del HTML/CSS/JS;
- memoria pico;
- tiempo de interacción relevante en Studio;
- tiempo del worker;
- startup del preview.

Instrumentá temporalmente si hace falta, pero no dejes logging ruidoso en producción.

Buscá:
- O(n²);
- múltiples recorridos evitables del catálogo;
- JSON stringify/parse repetido;
- copias profundas innecesarias;
- estructuras derivadas recalculadas;
- React rerenders excesivos;
- arrays gigantes reconstruidos;
- trabajo del main thread que debería estar en worker.

Para cada optimización exigí:
1. benchmark antes;
2. cambio;
3. benchmark después;
4. porcentaje real de mejora;
5. tests que demuestren que el comportamiento no cambió.

No sacrifiques determinismo, legibilidad ni seguridad por micro-optimizaciones.

Al final dejá una tabla:
Métrica | Antes | Después | Δ%

Hacé un red-team funcional completo del storefront exportado de SolaraCommerce.

Probalo como un usuario hostil, no como el happy path.

Ejercitá combinaciones de:
- JS activado/desactivado;
- localStorage disponible/bloqueado/corrupto;
- abrir varias pestañas;
- back/forward;
- refresh durante carrito/checkout;
- producto que desapareció después de agregarse;
- variante que dejó de existir;
- cambio de precio;
- disponibilidad modificada;
- categorías vacías;
- búsquedas Unicode;
- querystrings malformados;
- hash inesperados;
- viewport 320, 390, 768, 1024, 1440 y ultrawide;
- prefers-reduced-motion;
- navegación sólo teclado;
- imágenes que fallan;
- video que falla;
- red lenta para search-index/catalog-index.

Prestá especial atención a reconciliación del carrito: el precio/autorización debe venir del proyecto actual, nunca de datos persistidos por el cliente.

Intentá conseguir:
- total incorrecto;
- variante incorrecta;
- producto fantasma;
- mensaje WhatsApp inconsistente;
- XSS mediante contenido editable;
- navegación rota;
- error de consola;
- página vacía sin JS;
- listeners duplicados tras navegación;
- memory leaks.

Usá Playwright y unit/integration tests según corresponda.

Todo bug reproducible debe tener regresión automática antes del fix.

Realizá una auditoría de seguridad específica del modelo local-first de SolaraCommerce.

No hagas un checklist genérico. Intentá explotar realmente las fronteras existentes.

Superficies:
- importación .solara.json;
- CSV;
- nombres de archivo;
- mapa de archivos exportados;
- uploads/assets;
- rutas HTTP;
- solara-request-handler.mjs;
- serve.mjs;
- Electron protocol;
- portable layout;
- manifest;
- shutdown endpoint;
- cookie/sesión;
- postMessage Preview;
- HTML generado.

Intentá:
- ../ traversal y variantes codificadas;
- rutas absolutas Windows/UNC;
- drive letters;
- reserved device names;
- junction/symlink/reparse;
- null bytes donde corresponda;
- double decoding;
- Unicode confusables;
- headers inesperados;
- requests sin sesión;
- CSRF desde otro origen local;
- contenido HTML/JS/SVG malicioso en campos editables;
- URLs javascript:/data:;
- CSV formula injection si un CSV vuelve a abrirse en spreadsheet;
- zip/archive bombs si todavía existe compatibilidad legacy;
- archivos gigantes;
- conteos extremos;
- postMessage desde origen incorrecto.

No rompas compatibilidad deliberadamente sin evidencia.

Clasificá cada hallazgo real por impacto y explotabilidad. Para vulnerabilidades reproducibles:
test primero → fix mínimo → test adversarial.

Después ejecutá los gates de repository, schema, exporter, handler, portable y E2E afectados.

Auditá el portable Windows de SolaraCommerce como si fuera a distribuirse a usuarios no técnicos.

Áreas:
- apps/desktop/src/main.mjs
- preload.mjs
- solara://studio
- electron-builder
- portable-layout.mjs
- solara-request-handler.mjs
- locks
- instance.json
- perfiles
- proyectos/

Construí una matriz adversarial:
1. dos copias abiertas a la vez;
2. dos copias desde carpetas distintas;
3. mover la carpeta con la app cerrada;
4. moverla con espacios y Unicode;
5. ruta muy profunda;
6. read-only;
7. archivo bloqueado por otro proceso;
8. crash/restart;
9. instance.json viejo/corrupto;
10. puerto ocupado;
11. perfil incompleto;
12. proyecto abierto antes de mover;
13. segundo launch mientras inicia el primero;
14. cierre forzado;
15. actualización/reemplazo parcial de archivos regenerables.

Verificá especialmente que:
- ninguna copia vea proyectos de otra;
- no se maten procesos ajenos;
- no se escriba fuera del layout portable;
- HTTP launcher y Electron produzcan semántica equivalente;
- un crash no deje un lock permanente;
- guardar/reabrir siga funcionando después de mover la carpeta.

Extendé portable:smoke/portable-e2e donde haya huecos reales.

Corregí cualquier fallo reproducible.

Hacé una auditoría exhaustiva de UX FUNCIONAL del Studio de SolaraCommerce.

No rediseñes la aplicación ni cambies la identidad visual. Buscá fricción, estados engañosos y acciones que puedan producir errores humanos.

Recorré:
Dashboard → Nueva tienda → Preparar → Resumen → Recursos → Catálogo → Categorías → Builder/Modo avanzado → SEO → Preview → Guardar → Exportar.

En cada pantalla probá:
- estado vacío;
- primer uso;
- 50 y 2.000 productos;
- teclado;
- foco;
- Escape;
- doble click;
- click repetido;
- acciones mientras existe trabajo pendiente;
- navegación rápida;
- resize;
- errores del servidor;
- operación lenta;
- undo/redo;
- guardado con conflicto;
- botón disabled/enabled incorrecto;
- feedback de éxito incorrecto;
- selección que desaparece al borrar;
- filtros que dejan selección oculta;
- modales encadenados;
- datos inválidos parcialmente escritos.

Buscá explícitamente:
- stale state;
- closures antiguas;
- race conditions;
- optimistic UI incorrecta;
- pérdida de scroll/foco;
- acciones sin confirmación cuando son destructivas;
- confirmaciones innecesarias;
- información visual que no coincide con el proyecto real.

Automatizá casos importantes con Playwright.

Aplicá mejoras sólo cuando exista un problema concreto y demostrable. Preservá layout y diseño salvo que una corrección UX lo exija.

Auditá la suite de tests de SolaraCommerce como un especialista en mutation testing.

Primero construí un mapa:
comportamiento crítico → test que debería detectarlo.

Después intentá manualmente introducir mutaciones pequeñas y plausibles para comprobar si la suite las detecta. Ejemplos:
- quitar validación;
- invertir condición;
- ignorar un productId;
- no escapar un campo;
- omitir una página del sitemap;
- alterar un precio;
- saltar SHA;
- romper atomicidad;
- no reconciliar carrito;
- quitar un alt;
- eliminar fallback no-JS;
- cambiar canonical;
- romper reduced motion;
- omitir capability;
- no limpiar un listener.

No conserves mutaciones intencionales.

Si una mutación peligrosa pasa todos los tests, eso identifica un hueco real: agregá una prueba que la mate.

Priorizá por riesgo:
1. pérdida/corrupción de datos;
2. dinero/carrito;
3. seguridad;
4. exportación;
5. schema;
6. persistencia;
7. navegación;
8. SEO;
9. accesibilidad;
10. performance.

Evitá inflar la suite con tests duplicados. Cada test nuevo debe demostrar qué regresión concreta detecta.

Al terminar, presentá:
- mutaciones intentadas;
- cuáles sobrevivieron inicialmente;
- tests añadidos;
- bugs reales encontrados incidentalmente;
- coste adicional aproximado del suite.

Actuá como release blocker de SolaraCommerce.

Tu trabajo NO es demostrar que la aplicación está lista. Tu trabajo es intentar demostrar que NO está lista.

Usá el working tree local como autoridad. Leé AGENTS.md, PROJECT_MAP, TESTING, ARCHITECTURE, DATA_MODEL, INTEGRATIONS, TECHNICAL_DEBT, HANDOFF y el estado actual del plan perpetuo antes de empezar.

No descartes cambios sin commitear. No hagas commit ni push.

Reauditá las capas de mayor riesgo:
A. schema/datos
B. modules/CSS
C. runtime público
D. assets
E. rutas/SEO/a11y
F. exporter/enganches
G. servidor/persistencia
H. navegador/Studio/portable

No repitas ciegamente los tests existentes. Para cada capa intentá inventar al menos 5 hipótesis nuevas de fallo que todavía no estén directamente cubiertas.

Ejecutá también los gates existentes relevantes:
- check:repository
- check
- build
- check:budgets
- check:optimization
- check:runtime-serialization
- benchmark:export
- doctor:export
- pilot:preflight
- test:e2e
- portable smoke/e2e si el entorno lo permite

Para cualquier fallo:
reproducir → test → fix → repetir gate.

Después hacé una inspección visual Playwright real en:
320 / 390 / 768 / 1024 / 1440
sobre las rutas y fixtures más importantes.

No ignores:
warnings,
console errors,
network errors,
flaky tests,
timeouts,
dead code,
TODOs de riesgo,
documentación que contradiga el código.

No des por solucionado un problema sólo porque el test quedó verde: verificá causa raíz.

Terminá con un informe extremadamente corto:

SEVERIDAD CRÍTICA restante:
SEVERIDAD ALTA restante:
BUGS corregidos:
TESTS nuevos:
PERFORMANCE antes/después:
GATES:
VEREDICTO: RELEASE / NO RELEASE

El criterio para RELEASE es cero problemas críticos o altos conocidos reproducibles.

Implementá en SolaraCommerce una configuración global de visualización de precios que permita ocultar los centavos únicamente cuando sean cero.

IMPORTANTE:
Usá el working tree local actual como fuente de verdad. No hagas checkout, reset, stash, clean, pull ni descartes cambios sin commitear. No hagas commit ni push.

OBJETIVO UX

En la configuración general del sitio agregá una opción clara:

Formato de precios
[ ] Ocultar centavos cuando sean cero

Comportamiento:

Con opción desactivada:
$1.500,00
$1.500,50
$0,50

Con opción activada:
$1.500
$1.500,50
$0,50
$1
$0

NUNCA redondear, truncar ni ocultar centavos distintos de 00.

Ejemplos obligatorios:

150000 centavos? NO: respetá el contrato real del proyecto y verificá primero cómo se representan actualmente los importes.

Partiendo del valor real en centavos del proyecto, deben cumplirse semánticamente casos equivalentes a:

1500,00 → $1.500
1500,50 → $1.500,50
1500,01 → $1.500,01
0,00 → $0
0,01 → $0,01
0,99 → $0,99
1,00 → $1
999999,00 → $999.999

No asumas escala ni conversión: inspeccioná los helpers existentes y respetá StoreProjectV2.

DISEÑO DEL MODELO

No uses esta opción para modificar los valores monetarios.

Los precios, subtotales, descuentos y totales deben seguir almacenándose y calculándose exactamente como ahora.

La nueva propiedad debe controlar EXCLUSIVAMENTE presentación.

Preferí un contrato extensible en el schema, por ejemplo algo semánticamente equivalente a:

priceFractionDisplay:
  "always" | "auto"

donde:

"always"
→ conserva el comportamiento actual.

"auto"
→ muestra 0 decimales si los centavos son exactamente 00 y 2 decimales si existe cualquier fracción.

Si la arquitectura actual tiene un lugar mejor para esta preferencia, usalo. No crees un sistema paralelo.

COMPATIBILIDAD

Los proyectos existentes que no tengan la propiedad deben conservar exactamente el aspecto actual.

Por lo tanto el fallback/default debe equivaler inicialmente a:

"always"

No incrementes schemaVersion salvo que sea realmente necesario. Preferí una ampliación backwards-compatible con default explícito y testeado.

FUENTE ÚNICA DE VERDAD

Auditá primero todos los lugares donde SolaraCommerce formatea dinero.

No quiero lógica como:

toLocaleString(...)
Intl.NumberFormat(...)
"/ 100"
.toFixed(2)

duplicada arbitrariamente por Studio, módulos, exporter o runtime.

Creá o reutilizá una abstracción única y explícita para formatear importes visibles.

El formatter debe recibir como mínimo:
- valor monetario real;
- moneda/locale existentes;
- configuración priceFractionDisplay.

Preview y exportación tienen que producir exactamente el mismo formato.

SUPERFICIES A AUDITAR

Buscá TODOS los precios visibles, incluyendo como mínimo:

STUDIO/PREVIEW
- Preview.
- previews internos de módulos si existen.

STOREFRONT
- cards de producto;
- destacados;
- recién llegados;
- más elegidos;
- resultados de búsqueda;
- categorías;
- página de producto;
- variantes;
- precio anterior/oferta si existe;
- carrito;
- subtotal;
- entrega si tiene valor monetario;
- total;
- compra/checkout;
- cualquier modal o quick view;
- recomendaciones si existen.

WHATSAPP
Revisá cómo se formatean:
- precio unitario;
- cantidades;
- subtotal;
- total.

Si son textos presentados al comprador, deben respetar la preferencia visual sin modificar los cálculos.

DATOS MACHINE-READABLE

MUY IMPORTANTE:

La configuración visual NO debe modificar representación monetaria requerida por integraciones o datos estructurados.

Auditá:
- JSON-LD;
- schema.org Offer;
- Merchant/feed;
- catalog-index.json;
- search-index.json;
- manifests;
- metadata;
- datos internos del carrito;
- atributos data-*;
- cualquier archivo que consuma código en lugar de humanos.

Si actualmente requieren "1500.00", número decimal, centavos enteros u otra representación contractual, deben conservarla exactamente.

Nunca aplicar el formatter visual a datos machine-readable.

Esto es especialmente importante para SEO, Merchant y reconciliación del carrito.

EDGE CASES

Agregá tests para:

1. cero;
2. un centavo;
3. 99 centavos;
4. monto entero;
5. monto con 01 centavo;
6. monto con 10 centavos;
7. monto con 50 centavos;
8. monto con 99 centavos;
9. montos grandes;
10. separadores de miles;
11. ofertas/precio anterior;
12. variantes con diferentes precios;
13. suma de varias líneas que termina en ,00;
14. suma que termina con centavos;
15. cambio dinámico de variante;
16. carrito persistido;
17. refresh;
18. exportación;
19. Preview;
20. WhatsApp.

Ejemplo importante:

Producto A: $1.000,50
Producto B: $999,50

Total real:
$2.000,00

Con "auto":
productos:
$1.000,50
$999,50

total:
$2.000

Eso es correcto porque cada importe se formatea independientemente y ningún cálculo fue redondeado.

También verificá descuentos o operaciones donde los subtotales puedan generar centavos aunque los productos individuales no los tengan.

UI DE CONFIGURACIÓN

Integralo en la configuración existente del sitio; no crees una pantalla nueva sólo para esto.

Texto recomendado:

Formato de precios

Toggle:
"Ocultar centavos cuando sean cero"

Ayuda:
"Ejemplo: $1.500,00 se muestra como $1.500. Los precios con centavos, como $1.500,50, se mantienen completos."

El cambio debe:
- entrar en undo/redo si las preferencias equivalentes actuales lo hacen;
- marcar el proyecto como modificado;
- persistirse;
- sobrevivir save/reload;
- reflejarse inmediatamente en Preview;
- exportarse correctamente.

PARIDAD

Creá tests explícitos que prueben que para el mismo StoreProject:

Preview:
$1.500

Export:
$1.500

Runtime después de seleccionar variante:
$1.500

Carrito:
$1.500

WhatsApp:
$1.500

y para un precio fraccionario:

Preview:
$1.500,50

Export:
$1.500,50

Runtime:
$1.500,50

Carrito:
$1.500,50

WhatsApp:
$1.500,50

No aceptes divergencias entre estas superficies.

REGRESIONES

Verificá que activar/desactivar esta opción NO cambie:

- price/cents almacenados;
- subtotal matemático;
- total matemático;
- descuentos;
- filtros por precio;
- ordenamiento por precio;
- rangos de precio;
- reconciliación del carrito;
- CSV import/export;
- JSON-LD;
- Merchant;
- sitemap;
- search/catalog indexes;
- hashes de assets;
- URLs;
- SEO;
- disponibilidad.

TESTS

Primero identificá los formatters actuales y escribí tests del comportamiento nuevo.

Después implementá.

Ejecutá como mínimo los tests de:
- project-schema;
- modules;
- exporter;
- storefront-runtime;
- Studio afectado;
- enganches/consistencia;
- SEO/Merchant;
- pnpm check;
- build.

Ejecutá E2E proporcional para producto → carrito → checkout y Preview/export.

Si encontrás lógica monetaria duplicada o inconsistente durante la implementación, corregila sólo si podés demostrar la equivalencia mediante tests.

AL FINAL INFORMÁ:

1. propiedad/schema agregado;
2. formatter central utilizado;
3. todas las superficies que ahora lo consumen;
4. tests agregados;
5. comprobación de que datos machine-readable no cambiaron;
6. gates ejecutados y resultado.

Auditá y mejorá exhaustivamente la accesibilidad de SolaraCommerce, tanto Studio como storefront exportado.

Usá el working tree local como fuente de verdad. No descartes cambios ni hagas commit/push.

No te limites a ejecutar axe. Revisá manual y automáticamente:
- navegación completa sólo con teclado;
- orden lógico de Tab;
- focus visible;
- focus trapping/return en modales;
- Escape;
- lectores de pantalla;
- nombres accesibles;
- landmarks;
- headings;
- aria-live;
- formularios y errores;
- estados disabled;
- contraste;
- reduced motion;
- zoom 200% y 400%;
- viewport estrecho;
- contenido dinámico del carrito;
- selector de variantes;
- búsqueda;
- menús;
- Builder;
- modales del Studio.

Probá con Playwright interacciones reales y agregá tests donde falten.

Todo problema real:
reproducir → test → fix → verificar.

No alteres la estética salvo que sea imprescindible para cumplir accesibilidad.

Hacé una campaña específica para romper visualmente SolaraCommerce.

Probá Studio y storefront en:
320, 360, 390, 430, 768, 1024, 1280, 1440, 1920 y ultrawide.

Además probá:
- textos muy largos;
- precios enormes;
- nombres largos;
- palabras sin espacios;
- 1, 2, 3 y 4 líneas;
- navegador con zoom 125%, 150%, 200%;
- scrollbar visible;
- categorías grandes;
- 100 resultados;
- carrito con muchas líneas;
- imágenes verticales, horizontales y cuadradas.

Buscá:
overflow,
layout shifts,
botones cortados,
texto ilegible,
elementos superpuestos,
cards con alturas defectuosas,
sticky incorrectos,
modales fuera de viewport,
scroll horizontal,
saltos al cargar assets.

Usá Playwright screenshots y visión real. Corregí todas las regresiones reproducibles manteniendo el diseño actual.

Auditá el determinismo total del pipeline de exportación.

Para un StoreProject idéntico, múltiples exportaciones independientes deben producir el mismo resultado byte-a-byte salvo metadata explícitamente diseñada para variar.

Buscá fuentes de no determinismo:
- Date.now;
- random;
- orden de Object/Map/Set;
- filesystem ordering;
- hashes;
- IDs generados;
- CSS ordering;
- asset ordering;
- JSON serialization;
- worker timing;
- concurrencia;
- timestamps;
- locale del sistema.

Ejecutá exportaciones repetidas y compará árbol, nombres, hashes y contenido.

Corregí cualquier variación accidental y agregá tests deterministas.

Después probá también en rutas Windows con espacios/Unicode y, si el entorno lo permite, diferentes versiones admitidas de Node.

Auditá todo el workspace buscando:
- dependencias no utilizadas;
- dependencias duplicadas;
- código muerto;
- exports sin consumidores;
- módulos legacy que ya no tienen función;
- helpers duplicados;
- feature flags obsoletos;
- CSS inaccesible;
- assets huérfanos;
- tests muertos;
- scripts que ya no se usan.

No borres nada sólo porque una herramienta diga "unused".

Demostrá primero que no existe consumidor dinámico, exportación, fixture, compatibilidad legacy o uso desde scripts.

Para cada eliminación:
probar antes → eliminar → check completo → build → E2E proporcional.

Medí reducción de:
- líneas;
- bundle Studio;
- runtime público;
- dependencias;
- CSS;
- tiempo de build cuando sea medible.

No sacrifiques compatibilidad con proyectos antiguos.

Auditá el comportamiento de SolaraCommerce ante pérdida de red, reload y service worker.

Aunque sea local-first, intentá romper:
- reload durante edición;
- reload durante preview;
- navegador offline;
- service worker viejo;
- cache vieja después de actualizar Studio;
- assets cacheados de versión anterior;
- múltiples pestañas con versiones distintas;
- hard reload;
- storage eviction;
- IndexedDB temporalmente inaccesible;
- actualización del Studio mientras existe recovery draft.

Buscá especialmente situaciones donde el usuario vea UI nueva con código/assets viejos o donde un recovery draft quede inaccesible.

Corregí los casos reproducibles y agregá pruebas donde sea viable.

Auditá el sitio exportado desde la perspectiva de Google y motores de búsqueda.

No te limites a comprobar que existen tags.

Verificá semánticamente:
- canonical;
- robots;
- sitemap;
- JSON-LD;
- Product;
- Offer;
- BreadcrumbList;
- Organization;
- URLs absolutas;
- productos agotados;
- productos sin precio;
- variantes;
- categorías padre/hija;
- paginación;
- búsqueda;
- páginas privadas/noindex;
- draft vs production;
- duplicados;
- title/description;
- OpenGraph;
- imágenes;
- no-JS.

Generá escenarios adversariales y comprobá que metadata y HTML visible no se contradigan.

No modifiques datos machine-readable por decisiones exclusivamente visuales como el formato de centavos.

Auditá específicamente todo el checkout por WhatsApp.

Construí una matriz completa:
- un producto;
- múltiples productos;
- variantes;
- cantidades altas;
- precios con y sin centavos;
- productos agotados;
- cambios de precio;
- nombres con emojis;
- símbolos;
- &, %, #, ?, +;
- nombres muy largos;
- mensajes cerca de límites de URL;
- caracteres Unicode;
- saltos de línea;
- carrito restaurado de una sesión previa.

Verificá:
- cálculo exacto;
- reconciliación antes de generar el pedido;
- encoding correcto;
- mensaje legible;
- ninguna pérdida de productos;
- ninguna duplicación;
- ningún dato personal persistido innecesariamente.

Agregá regresiones para todos los bugs encontrados.

Hacé chaos testing controlado del servidor local de SolaraCommerce.

Introducí fallos simulados en:
- apertura de archivos;
- lectura;
- escritura;
- rename;
- fsync si corresponde;
- hashing;
- creación de directorios;
- respuesta HTTP;
- streams;
- timeout;
- proceso que termina;
- request abortada por cliente;
- request duplicada;
- request reintentada;
- respuesta parcial.

El objetivo es demostrar que cada endpoint tiene comportamiento seguro ante fallo en cualquier etapa.

Nunca uses los proyectos reales para pruebas destructivas: fixtures/directorios temporales.

Buscá leaks de archivos temporales, manifests inconsistentes, staging abandonado y respuestas ambiguas.

Corregí y agregá fault-injection tests deterministas.

Auditá la experiencia de desarrollo de SolaraCommerce.

Medí:
- pnpm install;
- typecheck;
- unit tests;
- pnpm check;
- build;
- E2E startup;
- benchmark;
- portable build.

Identificá trabajo redundante entre scripts y paquetes.

Objetivo: reducir el tiempo total de feedback sin debilitar ningún gate.

Podés:
- evitar builds repetidos;
- ejecutar checks incrementales donde sea seguro;
- separar gates rápidos/lentos;
- reutilizar artefactos deterministas;
- mejorar selección de tests por paquete.

No agregues complejidad tipo Nx/Turbo salvo evidencia excepcional.

Entregá tiempos antes/después y conservá un comando completo de release que siga validándolo todo.

Realizá una revisión arquitectónica completa del working tree actual de SolaraCommerce.

No quiero una reescritura ni opiniones abstractas.

Buscá únicamente deuda respaldada por evidencia:
- archivos con demasiadas responsabilidades;
- dependencias circulares;
- módulos fuertemente acoplados;
- lógica repetida;
- invariantes mantenidas manualmente;
- capas que filtran conceptos;
- APIs internas difíciles de usar correctamente;
- puntos donde un futuro cambio probablemente produzca divergencias.

Para cada hallazgo:
1. evidencia concreta;
2. riesgo real;
3. costo aproximado;
4. propuesta mínima;
5. tests necesarios.

Implementá únicamente refactors de bajo riesgo y beneficio alto que puedas demostrar con tests.

Para cambios grandes, dejá un plan preciso en documentación sin ejecutarlos automáticamente.

Al final generá un ranking:
impacto × probabilidad × costo de solución.

Realizá una auditoría visual y técnica POST-MIGRACIÓN del nuevo design system de SolaraCommerce.

Usá el working tree actual ya rediseñado como fuente de verdad.

No agregues una nueva dirección estética.
No reinventes el diseño.
No hagas commit/push.

Tu único objetivo es encontrar residuos, inconsistencias y regresiones que hayan sobrevivido a la gran migración.

Buscá exhaustivamente:

- cualquier fondo claro residual;
- FOUC;
- light-theme code todavía alcanzable;
- preferencias light antiguas todavía activas;
- branding verde residual;
- naranja usado en exceso;
- glow excesivo;
- crema usado como background general;
- hardcoded colors;
- tokens viejos;
- --cosmic-* innecesarios;
- --ui-* duplicados;
- sistemas Editorial/Cosmic que puedan consolidarse;
- componentes que evitan los tokens centrales;
- buttons inconsistentes;
- inputs inconsistentes;
- select nativo claro;
- autofill incorrecto;
- scrollbars;
- tooltips;
- modals;
- popovers;
- toasts;
- focus;
- hover;
- selected;
- disabled;
- error;
- warning;
- success;
- radius;
- border;
- shadow;
- spacing;
- typography;
- icon sizing;
- table density;
- sidebar;
- topbar;
- Builder;
- Preview shell;
- SEO;
- Export;
- recovery/conflict UI;
- responsive;
- zoom;
- reduced motion.

Generá screenshots Playwright del producto real en múltiples viewports y revisalos visualmente.

Buscá especialmente pantallas poco frecuentes que el primer rediseño pudo olvidar.

Verificá además que ningún cambio de design system haya contaminado:

- storefront;
- exporter;
- HTML público;
- CSS público;
- theme de las tiendas.

Por cada inconsistencia:

reproducir
→ causa raíz
→ corregir con design system existente
→ verificar.

No agregues nuevos patrones si ya existe uno equivalente.

Al final ejecutá los gates completos proporcionales y entregá únicamente:

- residuos encontrados;
- correcciones realizadas;
- CSS/tokens adicionales eliminados;
- screenshots revisadas;
- regresiones funcionales encontradas;
- resultado de gates;
- veredicto final de consistencia visual.

