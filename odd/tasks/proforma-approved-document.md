# Approved proforma document

Implement the approved HOMEX Letter PDF without changing commercial calculations or historical data. Both repositories: `feat/perfeccionamiento-documento-pdf`.
Delivery: commits and push to existing origins, explicitly authorized; no PR creation. Runner: pytest, Vitest, vue-tsc, Ruff, Poppler. Forecast: 1,200–1,800 authored changed lines; cohesive work units, no artificial size reductions.

## Specs

### S1 — Institutional composition

"Formato físico: **Carta vertical (8,5 × 11 pulgadas)**."
"VISTA PREVIA — NO EMITIDA"
"El número debe proceder del campo real de la proforma. No inventar consecutivos, sufijos ni referencias."
"Respetar la fecha realmente registrada y el significado comercial del estado documental."
"23 de octubre de 2026"
"DATOS DEL CLIENTE" / "TIPO DE DOCUMENTO" / "Proforma - Cotización"
"Únicamente el nombre del cliente o el nombre de la empresa."
"Utilizar los datos reales de la proforma y respetar sus snapshots cuando corresponda."
"Debajo de los recuadros DATOS DEL CLIENTE y TIPO DE DOCUMENTO, antes del detalle de productos."
"Conservación de mayúsculas y minúsculas originales."
Preserve existing HOMEX identity, slogan and footer; equal compact client/document boxes; optional 13–14pt title with no reserved gap.

### S2 — Technical integrity (presentation revised by S8–S12)

Preserve complete commercial technical content, original values/units, zeroes, quantities of one, unknown legitimate fields, all sets/components and their associations. Original continuous image/spec columns and the combined accessories/observations heading are superseded by the user's new independent-zone requirements in S8–S12; no placeholder or fixed empty image column remains. Proven duplicate source dictation may be hidden only without losing unique technical information (S10).

### S3 — Persisted economics and optional closing sections

"Cantidad — Precio unitario — Subtotal"
"Atención especial al modo `TOTAL_NEGOCIADO`."
"No debes representar un importe negociado como si fuera un precio unitario convencional cuando esa equivalencia sea incorrecta."
"Obtener el importe del subtotal real persistido para esa línea de detalle."
"Si existe un descuento distinto de cero, mostrarlo en esa misma franja de forma clara y compacta."
"No crear descuentos globales." / "El PDF no debe recalcular el total."
"TOTAL COTIZADO" / "Bs 7.300,00"
"El total ya se encuentra almacenado en la base de datos y debe mostrarse directamente desde: `proforma.total`"
"OBSERVACIONES DE LA PROFORMA"
"Inmediatamente debajo del TOTAL COTIZADO."
"Respetando párrafos." / "Respetando saltos de línea."
"CONDICIONES COMERCIALES"
"ANTICIPO REQUERIDO" / "PLAZO DE ENTREGA" / "VALIDEZ DE LA OFERTA"
"Cada condición se muestra únicamente cuando su dato existe."
"No incluir descripciones secundarias debajo de los valores."
Persisted totals remain unchanged even if inconsistent; document rather than repair. Preserve quantity precision and actual BOB/USD currency. Zero-valued conditions remain visible. No empty observation/condition headings.

### S4 — Authenticated and customer signatures

"El vendedor mostrado debe ser el usuario que tiene la sesión activa al momento de solicitar o generar el documento."
"No aceptes un `usuario_id` arbitrario del cliente para decidir quién firma."
"No uses `proforma.vendedor` como origen de la firma."
"Firma autorizada" / "Depto. de ventas" (bold)
"Firma del cliente" (bold, revised by S13)
"Para empresa: persona responsable/representante, nunca sustituir automáticamente por la razón social."
"No inventes representantes."
"No cambiar la asignación comercial original de la proforma en la base de datos para solucionar este requisito."
"Espacio libre real para firma manuscrita, aproximadamente 25–30 mm."
"Las dos firmas deben mantenerse juntas."
Use verified backend actor only; preserve route authorization; prevent cross-session Blob, stale response, HTTP/browser cache reuse. Company contact name is nombres/apellidos (validated by existing customer validation); snapshots take precedence. Missing representative stays blank rather than fabricated.

### S5 — Pagination and visual proof

"No separar el encabezado de un ítem del comienzo de sus especificaciones."
"No dejar una franja económica aislada cuando pueda mantenerse unida al contenido final del producto."
"No utilizar `KeepTogether` indiscriminadamente sobre una ficha demasiado extensa."
"No producir errores de ReportLab como `LayoutError`."
"Conservar la estructura visual de dos columnas."
"No duplicar la imagen sin una necesidad real."
"No generar páginas completamente vacías."
"Debes verificar visualmente, al menos, un caso sencillo y uno complejo de varias páginas."
No clipping, overlap, orphan sections, blank pages, lost content or footer collision. Fixtures only: A executive desk (1,60 × 0,80 × 0,70 m) and separate credenza (1,50 × 0,65 × 0,45 m), full board/drawers/doors/locks/rails/handles/PVC details; B L desk 140 × 140 cm, 73 cm height, MDP/steel SHAFT/MINIFIX/coatings/cabling and separate 33 × 40 × 63 rolling four-drawer cabinet with full lock explanation. "La explicación del sistema de cerraduras no debe reducirse a «cierre simultáneo»." Never seed real quotes. Test no-unit measures, long observations, special symbols, more than three dimensions and multi-page technical paragraphs.

### S6 — Delivery

"Visor PDF funcional." / "Descarga funcional." / "Impresión funcional."
"Pruebas backend satisfactorias." / "Pruebas frontend satisfactorias."
"Validación visual satisfactoria." / "Sin regresiones conocidas."
"Cambios confirmados y publicados en las ramas indicadas."
Report every failed/unavailable check honestly. No unrelated modifications, migrations, data repairs or business-rule changes.

## Current revision specs

### S7 — Real changes, pending edits and PDF freshness

> 1. El mensaje debe aparecer únicamente si existen modificaciones reales respecto a la última versión guardada, o ediciones pendientes de incorporar.
> 2. Debe explicar que el PDF refleja los datos guardados en el servidor, no la información todavía pendiente.
> 3. Debe indicar claramente cómo actualizarlo.
> 4. El vendedor debe poder guardar sus cambios y volver a generar el PDF.
> 5. Después de guardar satisfactoriamente, el aviso debe desaparecer.
> 6. Si hay errores de validación, no debe desaparecer prematuramente.
> 7. Si el usuario revierte todos los cambios, debe desaparecer sin obligarlo a guardar algo que no cambió.
> 8. Al actualizar el documento, debe invalidarse el PDF anterior para evitar mostrar información desactualizada.

### S8 — Institutional title and three-zone item header

> 9. Conservar el encabezado institucional HOMEX, su marca, número, fecha y estado.
> 10. Mantener las dos cajas independientes, de igual tamaño, para cliente y tipo de documento.
> 11. Mostrar únicamente el nombre del cliente o empresa en la caja izquierda.
> 12. Mostrar `Proforma - Cotización` en la derecha.
> 13. Conservar el título personalizado debajo de ambas cajas solo cuando tenga contenido.
> 14. Eliminar definitivamente el texto fijo `DETALLE DE PRODUCTOS Y ESPECIFICACIONES TÉCNICAS`, exista o no un título personalizado.
> 15. Si no hay título, comenzar directamente con el primer ítem, respetando un pequeño espacio visual.
> 16. Mantener la fecha en español y la etiqueta `Emisión:` correspondiente.
> 17. Dividirlo visualmente en tres zonas: número del ítem, nombre del producto y categoría.
> 18. Incorporar un separador vertical entre número y nombre.
> 19. Incorporar otro separador discreto antes de la categoría `Mueble a medida`.
> 20. Utilizar separadores visibles incluso al imprimir en blanco y negro.
> 21. Mantener el número destacado, pero sin depender exclusivamente del rojo para diferenciarlo.
> 22. Ajustar automáticamente el texto de nombres largos, sin truncarlos ni superponerlos sobre la categoría.
> 23. Permitir que el encabezado aumente de altura cuando sea necesario.
> 24. No repetir innecesariamente el nombre del producto dentro de sus especificaciones.

### S9 — Image-aware GENERAL and dynamic grids

> 25. Si existe una imagen válida, mostrar una sola imagen principal.
> 26. Mantener sus proporciones originales y evitar deformaciones.
> 27. Centrarla horizontal y verticalmente dentro de la zona superior que comparte con GENERAL.
> 28. No colocar texto superpuesto sobre la imagen.
> 29. Si no existe imagen, no mostrar absolutamente ningún placeholder, ni el logotipo con la leyenda «Sin imagen disponible».
> 30. Al no existir imagen, GENERAL debe expandirse automáticamente hasta ocupar todo el ancho útil.
> 31. No mantener reservada una columna izquierda vacía.
> 32. La ausencia de imagen no debe modificar la cantidad o integridad de las especificaciones.
> 33. Mostrar `GENERAL` en rojo institucional, con tamaño moderado y peso semibold.
> 34. Mostrar el tipo real de mueble cuando exista.
> 35. Crear un subtítulo `DIMENSIONES` únicamente cuando existan dimensiones.
> 36. Presentar las dimensiones en una cuadrícula de tres columnas.
> 37. Permitir un número ilimitado de dimensiones: 1, 2, 3, 4, 5, 6 o más.
> 38. Añadir filas automáticamente según la cantidad registrada, sin posiciones predeterminadas.
> 39. Mantener las celdas alineadas, aprovechando todo el ancho de la zona disponible.
> 40. Cada dimensión debe conservar nombre, valor y unidad.
> 41. Permitir que una etiqueta o un valor largo ajuste sus líneas y aumente la altura de la celda.
> 42. No recortar valores ni reducir excesivamente la fuente para forzarlos a entrar.
> 43. Crear el subtítulo `CARACTERÍSTICAS` únicamente cuando existan características.
> 44. Presentarlas en una cuadrícula de dos columnas, siguiendo tu segundo boceto.
> 45. Admitir cantidades variables de características, agregando filas automáticamente.
> 46. Conservar todos sus valores y unidades.

### S10 — Source-description integrity and operational metadata

> 47. No mostrar la etiqueta `Descripción original`.
> 48. No reproducir el dictado completo como un párrafo adicional cuando las especificaciones ya se encuentran organizadas.
> 49. Conservar el texto original en la base de datos si forma parte del registro o de su trazabilidad.
> 50. Verificar que toda información técnica relevante de esa descripción esté representada en los campos estructurados o en observaciones correspondientes.
> 51. Si existe información técnica única que no se trasladó a ningún campo, no descartarla silenciosamente. Debe corregirse la estructuración de datos o mostrarse como información técnica adicional, sin utilizar el bloque redundante de «Descripción original».
> 52. Identificar y excluir metadatos internos que no aportan información comercial o técnica al cliente.
> 53. En particular, investigar `Tipo entrada: texto`, que aparece en tus capturas y parece describir el origen o modalidad de captura de datos, no una característica del mueble.
> 54. No mostrar identificadores internos como `uid` o `conjunto_uid`.
> 55. No mostrar estructuras JSON crudas.
> 56. No excluir campos técnicos desconocidos simplemente porque su nombre no esté previsto en una lista fija.

### S11 — Structural sets, independent components, accessories and observations

> 52. Mostrar `ESTRUCTURA` en rojo, solamente cuando exista información estructural.
> 53. Evitar dos encabezados consecutivos que parezcan indicar lo mismo.
> 54. Diferenciar visualmente el título de sección, el conjunto y el componente.
> 55. Mostrar los conjuntos en una cuadrícula dinámica de dos columnas, aprovechando todo el ancho del documento.
> 56. Si hay más de dos conjuntos, crear automáticamente las filas adicionales.
> 57. Si existe un único conjunto, permitirle aprovechar el ancho disponible en lugar de dejar una columna vacía.
> 58. Cada conjunto debe tener su nombre claramente identificable.
> 59. Debajo, incluir todos sus componentes, cantidades y especificaciones.
> 60. Conservar las dimensiones que pertenecen a cada conjunto dentro de ese conjunto.
> 61. Respetar la asociación entre conjuntos y componentes mediante sus identificadores internos.
> 62. Mostrar también componentes independientes que no pertenezcan a ningún conjunto.
> 63. Permitir que el contenido de cada conjunto crezca verticalmente.
> 64. Utilizar viñetas, nombres en negrita y atributos claramente diferenciados.
> 65. Evitar cuadros con alturas fijas que puedan truncar componentes extensos.
> 66. Mostrar `ACCESORIOS` en rojo únicamente cuando existan accesorios registrados.
> 67. Distribuirlos en dos columnas, como indica tu primer boceto.
> 68. Añadir filas conforme aparezcan más accesorios.
> 69. Mantener cada accesorio relacionado con su conjunto o componente cuando corresponda.
> 70. Permitir descripciones extensas, no solamente nombres cortos.
> 71. Mostrar `OBSERVACIONES DEL MUEBLE` como apartado independiente únicamente si existen observaciones técnicas.
> 72. Presentar las observaciones a ancho completo, en un bloque limpio y adaptable.
> 73. Conservar todos los párrafos, detalles y saltos de línea.
> 74. No reducir las especificaciones técnicas a frases genéricas.
> 75. No mostrar ninguna de las dos secciones si sus datos respectivos están vacíos.

### S12 — Independent zones and pagination

> 81. El bloque superior debe acomodar imagen y GENERAL cuando exista fotografía.
> 82. ESTRUCTURA, ACCESORIOS y OBSERVACIONES podrán ocupar el ancho completo debajo de ese bloque superior, como muestran tus bocetos.
> 83. Cuando no haya fotografía, toda la ficha debe utilizar una única zona de ancho completo, con sus cuadrículas internas.
> 84. Las columnas de una misma fila deben comenzar alineadas.
> 85. Los recuadros deben adaptar su altura al contenido, no a una dimensión predeterminada.
> 86. Los encabezados de sección deben permanecer unidos al comienzo de su contenido.
> 87. No dejar un subtítulo aislado al final de una página.
> 88. No dividir innecesariamente un conjunto corto entre dos páginas.
> 89. Si un conjunto es demasiado extenso, permitir una continuación legible sin eliminar componentes.
> 90. Evitar los grandes espacios vacíos que se observan cuando la siguiente sección podría haberse aprovechado mejor.
> 91. No colocar información técnica en zonas no previstas.
> 92. Mantener intactos márgenes, pie institucional y numeración.
> 93. Evitar que las filas o tarjetas sobrepasen el ancho útil de una hoja carta.
> 94. No producir páginas vacías ni errores `LayoutError`.
> 95. Comprobar todos estos comportamientos mediante PDF de varias páginas, no solo con pruebas de texto.

### S13 — Persisted economics, conditions and authenticated signatures

> 96. Mantener `Cantidad`, `Precio unitario` y `Subtotal`.
> 97. Mostrar descuento solamente cuando sea distinto de cero.
> 98. Colocar Subtotal en el extremo derecho real del documento, incluyendo su importe alineado a la derecha.
> 99. Conservar precios y subtotales persistidos.
> 100.  Respetar los casos de importe total negociado sin convertirlos incorrectamente en precio unitario.
> 101.  Permitir ajuste de texto cuando la unidad o etiqueta económica sea extensa.
> 102.  Conservar una sola fila `TOTAL COTIZADO`, utilizando `proforma.total`.
> 103.  Mostrar el importe destacado y alineado a la derecha.
> 104.  No añadir subtotales generales, impuestos o ajustes globales.
> 105.  Mostrar `OBSERVACIONES DE LA PROFORMA` debajo del total solo si existen.
> 106.  No modificar ni resumir dichas observaciones.
> 107.  Mantener los recuadros de `ANTICIPO REQUERIDO`, `PLAZO DE ENTREGA` y `VALIDEZ DE LA OFERTA`.
> 108.  Mostrar únicamente etiqueta y valor.
> 109.  Mostrar solo las condiciones registradas, sin recuadros vacíos.
> 110.  Conservar su ubicación después de las observaciones de la proforma, no antes de los productos, aunque aparezca así en una ilustración anterior.
> 111.  Mantener dos firmas horizontales.
> 112.  A la izquierda, utilizar el nombre del vendedor que tiene la sesión autenticada al generar el PDF, no el vendedor original de la proforma.
> 113.  Debajo, en negrita: `Firma autorizada`.
> 114.  Debajo, también en negrita: `Depto. de ventas`.
> 115.  A la derecha, mostrar el nombre de la persona que firma por el cliente; si es empresa, el responsable registrado.
> 116.  Debajo, mostrar Firma del cliente, ahora también en negrita.
> 117.  Conservar el espacio necesario para firma manuscrita y mantener ambas firmas juntas en una página.

### S14 — Product-card visual fidelity to the supplied sketches

> “veo cambios, sin embargo hay que mejorar el diseño, te proporcionare un boceto, tienes que hacer la implementación lo mas fiel posible a el boceto, elimina apartados que no se muestren en el, respeta colores, estructura, margenes redondeados, espaciado, ajuste de texto automatico para todo, etc[Image #1][Image #2], ordenalo bien, añade uno que otro colos con la finalidad de no romper la paleta de colores”

> “si conserva todo lo demas, concentrate en la ficha del producto, te proporcionare imagnes de como es que se ve el pdf actual [Image #1][Image #2]. procede con la implementación, no te interrumpas”

Scope is the product card only; retain institutional header, quote total, quote observations, conditions and signatures exactly as approved. Authoritative sketches: `/tmp/codex-clipboard-LsglkU.png` (complete item) and `/tmp/codex-clipboard-Vhx07y.png` (GENERAL detail); current-output evidence: `/tmp/codex-clipboard-WLn6tI.png` (meeting table), `/tmp/codex-clipboard-BBf9dF.png` (shelf). These attachments are references, not production data to seed.

Match rounded outer card and rounded light item header; red item number and red technical section labels; subtle grey dividers/borders and dark readable text, restrained palette. GENERAL shares upper area with one real photo only when present; no-photo GENERAL full width. DIMENSIONES cells3columns; CARACTERÍSTICAS cells2columns; subtle rounded cell borders/background, automatic height and wrapping. Structural sets/components and accessories have two-column rounded panels, single set full-width, technical observations a full-width rounded block. Consistent gutters, inner padding and section spacing; item economics integrated in the outer card (not the old heavy detached financial table). Keep actual discount/negotiated semantics and right-aligned Subtotal. No fixed heights, truncated values, overlap or large unnecessary gaps; long panels split and retain heading/content links on Letter pages. No invented empty dimension fields/dashes from the generic sketch, no printed “3 COLUMNAS”/“2 COLUMNAS” explanatory design annotations, no absent-photo placeholder.

No separate “Información técnica adicional” section is shown in the sketches. Do not print duplicate raw capture dictation about dimensions/materials/prices. Preserve truly unique technical source details under the existing OBSERVACIONES DEL MUEBLE rather than dropping them or inventing another section. Data remains unchanged; current persisted line economics override obsolete source commercial narration. Relationship-aware proof is required before suppressing technical facts (e.g. missing shelf thickness18mm must remain, but a table's fully structured matching dimensions/components/accessories should not be restated as raw dictation). Unknown source facts remain verbatim and attached to their context. This refines S10, without authorizing lossy summarization or business-rule changes.

## Tasks

- T1 [S4,S6] inline; complete; backend `c33d34d`; secure requester signature and private/no-store response, 5 isolated intermediate-unit tests passed. Risk item 2.
- T2 [S2,S5] inline; complete; backend `f9d14b1`; lossless hierarchy, split right-column compositor, cases A/B, source/unit tests. Risk items 3 and 5.
- T3 [S1,S3,S4,S5] inline; complete; backend `f9d14b1`; approved composition, persisted economics, dynamic closing and signatures; all final sample pages inspected.
- T4 [S4,S6] inline; complete; frontend `7792846`; synchronous actor-scoped Blob invalidation, no-store fetch, unit and real-browser PDF tests passed. Risk item 2.
- T5 [S1–S6] delegated verification; complete; no change-caused blockers; backend 529 tests, frontend 300 tests, build/typecheck, Ruff, font wheel inclusion, browser render/download/print all passed. Parent spot check: 14 backend actor/design tests passed.
- T6 [S6] inline; complete; backend `f9d14b1` and frontend `7792846` published on both authorized branches; remote HEAD equality confirmed. This task document is recorded in a final documentation-only commit. No PR or deployment requested.

- T7 [S7] delegated; complete, frontend b83d3b0, focused18/full306/typecheck/build passed; frontend real-change notice, pending-editor save path and PDF invalidation. Parallel writer reason: independent frontend behavior and backend composition units, disjoint files. Risk item 3 (shared editor persistence).
- T8 [S8–S13] delegated; complete, backend95b777d+825a9cd, final focused29/full545/Ruff passed; backend independent PDF zones and non-lossy technical projection, tests/docs. Parallel writer reason: independent backend unit; isolated worktree based on main with the existing authorized feature snapshot staged as baseline. Risk item 3 (shared renderer and catalogue behavior).
- T9 [S7–S13] delegated verification; complete, no change-caused blockers; focused + full suites, independent shared-behavior audit, browser flow, image/no-image and multi-page visual QA.
- T10 [S6,S7–S13] inline; complete, backend825a9cd/frontendb83d3b0 pushed and remote equality verified; parent-owned commits, push same authorized branches, verify remote equality, cleanup temporary test state.

- T11 [S14] delegated; complete, backend59a4071, focused37/full553/Ruff passed; bounded backend product-card sketch styling, text-flow/source integrity and tests/docs. Writer reason: long-session context backstop; no claim of runtime telemetry. Narrow backend worktree and parent-owned integration. Risk item3 (shared renderer/catalogue projection).
- T12 [S14,S7–S13] delegated verification; complete, no change-caused blockers; independent shared-behavior audit, full suites/browser, parent visual comparison with both sketches.
- T13 [S14] inline; complete, backend59a4071/frontend9a74e58 pushed and remote equality verified; final fixture, coherent commits and same-branch publication, memory mirror and scratch cleanup.

## Log

- L1 Original request opening, verbatim: "Tu tarea es implementar integralmente el diseño aprobado del documento **PROFORMA – COTIZACIÓN** del sistema HOMEX, aplicando de forma estricta las especificaciones que se detallan a continuación."
- L2 User authorization, verbatim: "si, procede con la implementación y por favor, no te interrupas hasta terminar todo"
- L3 Initial diagnosis found assigned-seller signatures, dense item matrix and lossy technical flattening; preserve unrelated backend celerybeat-schedule.db.
- L4 RDD globally OFF throughout. Existing authorized feature branches and Git origins retained; no PR or deployment requested.

- L5 Initial test-first evidence: five backend and two frontend regressions RED, then focused tests/typecheck/lint GREEN.
- L6 Development DB role lacks CREATEDB. All database proof uses disposable loopback PostgreSQL clusters, never production or development data.
- L7 Initial oversized KeepTogether moved the first card off page1; prefix moved inside the splittable card. Source content was not shortened.
- L8 Unicode DejaVu fonts/license bundled and wheel inclusion verified; shared renderer/auth/packaging risks independently verified.

- L9 Initial full proof: backend529, frontend300, production build, browser PDF flow, Ruff and font packaging passed.
- L10 Scratch frontend needs documented localhost API origin and real in-root dependency copy; symlink/missing-origin failures resolved without source changes.
- L11 Browser proof compares downloaded bytes with displayed PDF and dispatches print to original iframe with one request. Initial representative pages visually inspected.
- L12 Initial backend authentication c33d34d and rendering f9d14b1 were separate coherent units; no size-only minification or content/test removal.

- L13 Initial code publication verified backendf9d14b1/frontend7792846, then frontend documentation7e42582. Both pushes fast-forward; prior statuses are history.

- L14 Revision request (2026-11-10), verbatim:

continua trabajando en la misma rama, no te interrumpas hasta terminar. Procede a resolver los siguientes requisitos:

## 3. Requisitos funcionales y visuales completos

### A. Aviso de cambios sin guardar

En `ProformaEditorView.vue` confirmé que actualmente el aviso depende de `dirty`, mientras que el botón de guardado utiliza una comprobación distinta, `hasRealChanges`.

Requisitos:

1. El mensaje debe aparecer únicamente si existen modificaciones reales respecto a la última versión guardada, o ediciones pendientes de incorporar.
2. Debe explicar que el PDF refleja los datos guardados en el servidor, no la información todavía pendiente.
3. Debe indicar claramente cómo actualizarlo.
4. El vendedor debe poder guardar sus cambios y volver a generar el PDF.
5. Después de guardar satisfactoriamente, el aviso debe desaparecer.
6. Si hay errores de validación, no debe desaparecer prematuramente.
7. Si el usuario revierte todos los cambios, debe desaparecer sin obligarlo a guardar algo que no cambió.
8. Al actualizar el documento, debe invalidarse el PDF anterior para evitar mostrar información desactualizada.

No recomiendo eliminar por completo la advertencia: evita que el vendedor descargue una cotización desactualizada sin darse cuenta.

### B. Encabezado y título

9. Conservar el encabezado institucional HOMEX, su marca, número, fecha y estado.
10. Mantener las dos cajas independientes, de igual tamaño, para cliente y tipo de documento.
11. Mostrar únicamente el nombre del cliente o empresa en la caja izquierda.
12. Mostrar `Proforma - Cotización` en la derecha.
13. Conservar el título personalizado debajo de ambas cajas solo cuando tenga contenido.
14. Eliminar definitivamente el texto fijo `DETALLE DE PRODUCTOS Y ESPECIFICACIONES TÉCNICAS`, exista o no un título personalizado.
15. Si no hay título, comenzar directamente con el primer ítem, respetando un pequeño espacio visual.
16. Mantener la fecha en español y la etiqueta `Emisión:` correspondiente.

### C. Encabezado individual del producto

17. Dividirlo visualmente en tres zonas: número del ítem, nombre del producto y categoría.
18. Incorporar un separador vertical entre número y nombre.
19. Incorporar otro separador discreto antes de la categoría `Mueble a medida`.
20. Utilizar separadores visibles incluso al imprimir en blanco y negro.
21. Mantener el número destacado, pero sin depender exclusivamente del rojo para diferenciarlo.
22. Ajustar automáticamente el texto de nombres largos, sin truncarlos ni superponerlos sobre la categoría.
23. Permitir que el encabezado aumente de altura cuando sea necesario.
24. No repetir innecesariamente el nombre del producto dentro de sus especificaciones.

### D. Comportamiento de la imagen

25. Si existe una imagen válida, mostrar una sola imagen principal.
26. Mantener sus proporciones originales y evitar deformaciones.
27. Centrarla horizontal y verticalmente dentro de la zona superior que comparte con GENERAL.
28. No colocar texto superpuesto sobre la imagen.
29. Si no existe imagen, no mostrar absolutamente ningún placeholder, ni el logotipo con la leyenda «Sin imagen disponible».
30. Al no existir imagen, GENERAL debe expandirse automáticamente hasta ocupar todo el ancho útil.
31. No mantener reservada una columna izquierda vacía.
32. La ausencia de imagen no debe modificar la cantidad o integridad de las especificaciones.

En el código actual, `pdf.py` crea `ProductPlaceholder()` cuando no encuentra una imagen, y `ProductCard` mantiene un ancho izquierdo fijo de 50 mm. Ambas decisiones deben modificarse para cumplir este requisito.

### E. GENERAL: dimensiones y características

33. Mostrar `GENERAL` en rojo institucional, con tamaño moderado y peso semibold.
34. Mostrar el tipo real de mueble cuando exista.
35. Crear un subtítulo `DIMENSIONES` únicamente cuando existan dimensiones.
36. Presentar las dimensiones en una cuadrícula de tres columnas.
37. Permitir un número ilimitado de dimensiones: 1, 2, 3, 4, 5, 6 o más.
38. Añadir filas automáticamente según la cantidad registrada, sin posiciones predeterminadas.
39. Mantener las celdas alineadas, aprovechando todo el ancho de la zona disponible.
40. Cada dimensión debe conservar nombre, valor y unidad.
41. Permitir que una etiqueta o un valor largo ajuste sus líneas y aumente la altura de la celda.
42. No recortar valores ni reducir excesivamente la fuente para forzarlos a entrar.
43. Crear el subtítulo `CARACTERÍSTICAS` únicamente cuando existan características.
44. Presentarlas en una cuadrícula de dos columnas, siguiendo tu segundo boceto.
45. Admitir cantidades variables de características, agregando filas automáticamente.
46. Conservar todos sus valores y unidades.

### F. Eliminar la descripción original visible

47. No mostrar la etiqueta `Descripción original`.
48. No reproducir el dictado completo como un párrafo adicional cuando las especificaciones ya se encuentran organizadas.
49. Conservar el texto original en la base de datos si forma parte del registro o de su trazabilidad.
50. Verificar que toda información técnica relevante de esa descripción esté representada en los campos estructurados o en observaciones correspondientes.
51. Si existe información técnica única que no se trasladó a ningún campo, no descartarla silenciosamente. Debe corregirse la estructuración de datos o mostrarse como información técnica adicional, sin utilizar el bloque redundante de «Descripción original».

Esto es esencial: eliminar una descripción duplicada visualmente no autoriza a perder sus especificaciones.

En tus capturas, la descripción vuelve a mencionar medidas, materiales y precios que ya aparecen en otros bloques. Esa repetición es precisamente lo que debemos corregir.

### G. ESTRUCTURA: conjuntos y componentes

52. Mostrar `ESTRUCTURA` en rojo, solamente cuando exista información estructural.
53. Evitar dos encabezados consecutivos que parezcan indicar lo mismo.
54. Diferenciar visualmente el título de sección, el conjunto y el componente.
55. Mostrar los conjuntos en una cuadrícula dinámica de dos columnas, aprovechando todo el ancho del documento.
56. Si hay más de dos conjuntos, crear automáticamente las filas adicionales.
57. Si existe un único conjunto, permitirle aprovechar el ancho disponible en lugar de dejar una columna vacía.
58. Cada conjunto debe tener su nombre claramente identificable.
59. Debajo, incluir todos sus componentes, cantidades y especificaciones.
60. Conservar las dimensiones que pertenecen a cada conjunto dentro de ese conjunto.
61. Respetar la asociación entre conjuntos y componentes mediante sus identificadores internos.
62. Mostrar también componentes independientes que no pertenezcan a ningún conjunto.
63. Permitir que el contenido de cada conjunto crezca verticalmente.
64. Utilizar viñetas, nombres en negrita y atributos claramente diferenciados.
65. Evitar cuadros con alturas fijas que puedan truncar componentes extensos.

Por qué aparece ESTRUCTURA dos veces: en el código actual, `pdf_technical.py` genera el título de sección `ESTRUCTURA` y después presenta el nombre registrado del componente. Si ese componente también se llama «Estructura», visualmente parece una duplicación.

No es necesario borrar ese componente. Debemos corregir su jerarquía, por ejemplo mostrando Componente: Estructura dentro del conjunto correspondiente, con un tratamiento tipográfico distinto del encabezado rojo.

### H. ACCESORIOS y OBSERVACIONES DEL MUEBLE

Tus nuevos bocetos separan ambos apartados, y considero que es una mejora frente al encabezado combinado anterior.

66. Mostrar `ACCESORIOS` en rojo únicamente cuando existan accesorios registrados.
67. Distribuirlos en dos columnas, como indica tu primer boceto.
68. Añadir filas conforme aparezcan más accesorios.
69. Mantener cada accesorio relacionado con su conjunto o componente cuando corresponda.
70. Permitir descripciones extensas, no solamente nombres cortos.
71. Mostrar `OBSERVACIONES DEL MUEBLE` como apartado independiente únicamente si existen observaciones técnicas.
72. Presentar las observaciones a ancho completo, en un bloque limpio y adaptable.
73. Conservar todos los párrafos, detalles y saltos de línea.
74. No reducir las especificaciones técnicas a frases genéricas.
75. No mostrar ninguna de las dos secciones si sus datos respectivos están vacíos.

En resumen, las subsecciones serían:

GENERAL → ESTRUCTURA → ACCESORIOS → OBSERVACIONES DEL MUEBLE

Cada una es condicional.

### I. Información que no debe imprimirse

76. Identificar y excluir metadatos internos que no aportan información comercial o técnica al cliente.
77. En particular, investigar `Tipo entrada: texto`, que aparece en tus capturas y parece describir el origen o modalidad de captura de datos, no una característica del mueble.
78. No mostrar identificadores internos como `uid` o `conjunto_uid`.
79. No mostrar estructuras JSON crudas.
80. No excluir campos técnicos desconocidos simplemente porque su nombre no esté previsto en una lista fija.

La regla es: ocultar metadatos operativos, nunca especificaciones comerciales legítimas.

## 4. Requisitos de distribución y paginación

Esta parte merece tanta atención como el diseño porque actualmente el contenido se fragmenta de manera poco natural.

81. El bloque superior debe acomodar imagen y GENERAL cuando exista fotografía.
82. ESTRUCTURA, ACCESORIOS y OBSERVACIONES podrán ocupar el ancho completo debajo de ese bloque superior, como muestran tus bocetos.
83. Cuando no haya fotografía, toda la ficha debe utilizar una única zona de ancho completo, con sus cuadrículas internas.
84. Las columnas de una misma fila deben comenzar alineadas.
85. Los recuadros deben adaptar su altura al contenido, no a una dimensión predeterminada.
86. Los encabezados de sección deben permanecer unidos al comienzo de su contenido.
87. No dejar un subtítulo aislado al final de una página.
88. No dividir innecesariamente un conjunto corto entre dos páginas.
89. Si un conjunto es demasiado extenso, permitir una continuación legible sin eliminar componentes.
90. Evitar los grandes espacios vacíos que se observan cuando la siguiente sección podría haberse aprovechado mejor.
91. No colocar información técnica en zonas no previstas.
92. Mantener intactos márgenes, pie institucional y numeración.
93. Evitar que las filas o tarjetas sobrepasen el ancho útil de una hoja carta.
94. No producir páginas vacías ni errores `LayoutError`.
95. Comprobar todos estos comportamientos mediante PDF de varias páginas, no solo con pruebas de texto.

Cambio arquitectónico importante: `ProductCard` actualmente fue diseñado para una columna de imagen fija y una columna técnica continua. Para conseguir exactamente tu nuevo diseño, deberá admitir zonas de composición independientes y anchos dinámicos, conservando la paginación.

## 5. Franja económica, total, condiciones y firmas

Estos apartados ya estaban aprobados. Solamente incorporaría las nuevas correcciones y conservaría el resto.

### Franja económica de cada ítem

96. Mantener `Cantidad`, `Precio unitario` y `Subtotal`.
97. Mostrar descuento solamente cuando sea distinto de cero.
98. Colocar Subtotal en el extremo derecho real del documento, incluyendo su importe alineado a la derecha.
99. Conservar precios y subtotales persistidos.
100.  Respetar los casos de importe total negociado sin convertirlos incorrectamente en precio unitario.
101.  Permitir ajuste de texto cuando la unidad o etiqueta económica sea extensa.

### Total y observaciones generales

102. Conservar una sola fila `TOTAL COTIZADO`, utilizando `proforma.total`.
103. Mostrar el importe destacado y alineado a la derecha.
104. No añadir subtotales generales, impuestos o ajustes globales.
105. Mostrar `OBSERVACIONES DE LA PROFORMA` debajo del total solo si existen.
106. No modificar ni resumir dichas observaciones.

### Condiciones comerciales

107. Mantener los recuadros de `ANTICIPO REQUERIDO`, `PLAZO DE ENTREGA` y `VALIDEZ DE LA OFERTA`.
108. Mostrar únicamente etiqueta y valor.
109. Mostrar solo las condiciones registradas, sin recuadros vacíos.
110. Conservar su ubicación después de las observaciones de la proforma, no antes de los productos, aunque aparezca así en una ilustración anterior.

### Firmas

111. Mantener dos firmas horizontales.
112. A la izquierda, utilizar el nombre del vendedor que tiene la sesión autenticada al generar el PDF, no el vendedor original de la proforma.
113. Debajo, en negrita: `Firma autorizada`.
114. Debajo, también en negrita: `Depto. de ventas`.
115. A la derecha, mostrar el nombre de la persona que firma por el cliente; si es empresa, el responsable registrado.
116. Debajo, mostrar Firma del cliente, ahora también en negrita.
117. Conservar el espacio necesario para firma manuscrita y mantener ambas firmas juntas en una página.

- L15 Verified diagnosis: warning uses dirty rather than actual currentContent comparison; modal pending edits tracked separately, and successful editor persistence does not invalidate its old PDF. tipo_entrada is capture/catalogue operational metadata. No source-description coverage helper found; do not infer that raw source contains no unique technical facts. Prior layout sections/pagination remain historical, replaced only by S7–S13 above. RDD remains off.

- L16 T7 implementation: warning compares real outer content and exposed read-only line/furniture draft equality; edit→revert clears warning without persistence, while validation failures retain it. Successful fill() invalidates prior Blob and regenerates only for an open viewer. A parent challenge reproduced two modal-revert failures; bounded correction added existing clonarTecnica/tecnicaIgual comparisons and preserved submit/save/navigation APIs. Approved additional narrow surfaces: DetalleForm.vue, EspecificacionForm.vue, MuebleStudio.vue. Focused suite 18 passed, typecheck and focused lint/format passed.
- L17 T8 implementation: independent upper photo/GENERAL zone; no placeholder or reserved photo column without image; full-width structural set2col grids, accessories2col grids and separate observations. Dimensions3col and characteristics2col grids; 3-zone grey-separated item header; no fixed detail heading; date Emisión:, right-edge Subtotal, bold customer signature. A parent challenge reproduced source-clause association loss; bounded correction preserves context after any unmatched source clause, and only deduplicates whole retained source contexts across fields. Focused backend28 passed; Ruff checks pass.
- L18 Parent integration: accepted only declared writer surfaces, reapplied isolated backend working diff relative to staged f9d14b1 feature baseline, explicitly copied new pdf_source.py and test_pdf_zones.py. Added new pure test file to normal pytest discovery. Regenerated frontend PDF test fixture. RDD is still off. Delegated assessment: frontend high via named item3; backend informational assessment unavailable due existing untracked inventory (celerybeat database plus new files), so risk was not lowered; independent verification still required for item3 and test-discovery item5. No native review started.
- L19 Parent own focused spot checks: backend28 tests and frontend18 tests passed. Visual inspection: simple photo scene1page; complex A/B and no-photo2pages, adaptive no-title scene2pages with seven dimensions, five characteristics, three sets, independent component, actual furniture type, long item name and zero dimension. Extreme22page layout contact sheet has no blank pages; final independent checks pending.

- L20 Independent revision verification: full backend544 passed; full frontend306 passed across56 files; production build/vue-tsc, Ruff and real-PDF browser scenario passed. No change-caused blockers. Nonfatal diagnostics: nine test JWT key-length warnings and jsdom canvas limitations. Parent visual QA supplies full-size acceptance; no separate duplicate visual ceremony.
- L21 Bounded differential proof: identical stdout JSON for BOB/USD formatting and customer snapshots; same two public invalid-edit/snapshot-invariance tests pass in both backend baseline and candidate. Existing frontend create/save/conflict case passes on both versions; excluded new cases account for different skipped counts in that targeted selector only. No unchanged-behavior discrepancy. Parent final spot check: backend28 passed.
- L22 Delivery remains the existing branches, no PR/deployment. Revision is sliced by deliverable behavior: one frontend warning/freshness unit with real-child regression tests; one cohesive backend adaptive-zone/source-integrity unit with tests/docs. Backend layout/projection/pagination cannot be usefully split into independently functioning subunits merely to satisfy a line heuristic; no test/content reductions or minification.

- L23 Final approved-closing preservation check reproduced red technical styling leaking into the unchanged quote-observation/conditions headings. A narrow parent correction separates TechnicalSection from existing Section, with RED observed then a new regression test GREEN. Independent recheck: targeted style test1passed, full backend545passed, Ruff passed, browser test1passed. Frontend full306/build remains valid (no frontend source change since verification). Parent re-rendered final A/adaptive samples and inspected corrected closing colors. A sample-generation attempt omitted DJANGO_SETTINGS_MODULE and failed without writing output; rerun with explicit disposable test settings succeeded.

- L24 Revision publication confirmed on both authorized feat/perfeccionamiento-documento-pdf branches: backend825a9cd5e5a41087534c2ea165f39504dba2e395, frontend codeb83d3b0fef0b7c2f938d1149a296658bceeec3f4. Fast-forward pushes; no force push, PR or deployment. Final documentation/fixture commit follows on the same frontend branch. Final synthetic PDF fixture uses approved case-A name/data and quantity1 with coherent test-only7500−200=7300 amounts, without generic mock-description/technical-note text; both pages visually inspected and browser test passed against that final fixture. No live quotation was changed.

- L25 Sketch revision request verbatim (2026-11-10): “veo cambios, sin embargo hay que mejorar el diseño, te proporcionare un boceto, tienes que hacer la implementación lo mas fiel posible a el boceto, elimina apartados que no se muestren en el, respeta colores, estructura, margenes redondeados, espaciado, ajuste de texto automatico para todo, etc[Image #1][Image #2], ordenalo bien, añade uno que otro colos con la finalidad de no romper la paleta de colores”. Parent clarified whether removal is limited to the product card.
- L26 Scope confirmation verbatim: “si conserva todo lo demas, concentrate en la ficha del producto, te proporcionare imagnes de como es que se ve el pdf actual [Image #1][Image #2]. procede con la implementación, no te interrumpas”. Four user attachment paths recorded in S14. No work outside product-card presentation/source projection, tests and final PDF fixture. Existing frontend warning and all non-item commercial sections unchanged.

- L27 Sketch implementation applied only within declared backend surfaces; new test_pdf_sketch.py explicitly included in default discovery. Parent focused37 tests passed and visually compared meeting/shelf/7dimension/5characteristic/two-set cards against both sketches. Rounded outer/header/cells/panels, softer labels, integrated economics and red number now present. Matching source narration is suppressed only by exact relationship/unit grammar; shelf missing18mm remains verbatim in furniture observations. Native assessment unavailable due untracked inventory; risk not lowered, independent item3+5 verification follows with RDD off. Earlier routine logs L3–L13 consolidated without removing user requests or proof milestones.

- L28 Sketch independent proof: backend553, frontend306/56files, Ruff full lint/371files format check, build/vue-tsc and real-PDF browser1test passed. Eight new sketch tests discovered. Initial concurrent disposable-DB jobs collided; canceled invalid run and sequential rerun passed. Bounded baseline/candidate helper JSON identical; same two invalid-edit/snapshot tests2/2 pass in both. Nested heading/page-foot runtime probes did not reproduce a ProductCard orphan. Parent visually inspected all representative pages and ten-page stress contact sheet; only card styling/source projection changed, outside-card sections preserved. One cohesive backend unit couples rounded padding/splitting/source-note placement with its regression tests, exceeding the line guide without artificial splitting/minification; no PR requested.

- L29 Sketch publication confirmed: backend59a40716c47b40163b6899cdcad42a338658c2f2; frontend fixture/proof9a74e582e37eaa6005e69ece6b55cc695b7e6e21, both on the authorized feature branch with remote/local equality. Final fixture bytes equal the independently browser-tested copy. Parent final focused37tests passed. Closing documentation follows on the same branch. No real quote data, history, business rules, frontend application behavior, outside-card design, PR or deployment changed.

- L30 Header cards visual refinement: replaced monolithic rectangular client/document table with two independent RoundedPanel boxes (radius=5, border=#dedede, background=#fafafa, padding=8) separated by an 8pt gap, matching the approved visual proposal (`uploaded_media_1794332682176.png`). Label updated to slate-500 (`#64748b`), values in bold slate-900 (`#0f172a`). All backend tests (37/37) and full frontend suite (241/241, 7/7 module) plus type-check passed. Fixture proforma-approved.pdf refreshed.
