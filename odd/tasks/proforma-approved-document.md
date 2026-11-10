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

### S2 — Complete technical content

"DETALLE DE PRODUCTOS Y ESPECIFICACIONES TÉCNICAS"
"El cuerpo de cada ficha debe estar compuesto por **exactamente dos columnas visuales**."
"Columna izquierda: imagen del producto."
"Columna derecha: especificaciones técnicas."
"RESTRICCIÓN ABSOLUTA: no debe colocarse ninguna especificación, atributo, descripción ni observación debajo de la imagen."
"GENERAL" / "ESTRUCTURA" / "ACCESORIOS Y OBSERVACIONES DEL MUEBLE"
"SE DEBE MOSTRAR EL 100 % DE LA INFORMACIÓN TÉCNICA Y COMERCIAL REALMENTE REGISTRADA PARA CADA MUEBLE."
"Si un campo existe y contiene información, **debe mostrarse completo**."
"Si no existe, está vacío o no corresponde al producto, **no se muestra su etiqueta ni se reserva espacio**."
"Si un campo contiene el valor numérico cero y ese cero es un dato válido, no debe desaparecer por una comprobación incorrecta de falsedad."
"Mostrar todos los conjuntos registrados." / "Mostrar todos los componentes registrados."
"Mostrar componentes sin conjunto cuando el modelo permita componentes independientes."
"Respetar el orden significativo registrado."
"Las medidas pertenecientes a un conjunto deben permanecer dentro de ese conjunto."
"No perder atributos desconocidos que contengan información técnica comercial válida."
"No realizar deduplicaciones destructivas." / "No inventar unidades."
"No descartar cantidades iguales a uno." / "No alterar nombres comerciales."
"No alterar textos registrados." / "No mostrar representaciones JSON crudas en el documento."
"Escapar correctamente caracteres especiales." / "Preservar tildes, símbolos, unidades y saltos de línea."
Catalog products retain description, attributes, real category, photo and economic fields without fabricated furniture structure. Dimension chips wrap without limiting count. Main image preserves aspect ratio, centered on the accompanying right-column fragment; institutional placeholder if absent.

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
"Firma del cliente" (normal)
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

## Tasks

- T1 [S4,S6] inline; complete; backend `c33d34d`; secure requester signature and private/no-store response, 5 isolated intermediate-unit tests passed. Risk item 2.
- T2 [S2,S5] inline; complete; backend `f9d14b1`; lossless hierarchy, split right-column compositor, cases A/B, source/unit tests. Risk items 3 and 5.
- T3 [S1,S3,S4,S5] inline; complete; backend `f9d14b1`; approved composition, persisted economics, dynamic closing and signatures; all final sample pages inspected.
- T4 [S4,S6] inline; complete; frontend `7792846`; synchronous actor-scoped Blob invalidation, no-store fetch, unit and real-browser PDF tests passed. Risk item 2.
- T5 [S1–S6] delegated verification; complete; no change-caused blockers; backend 529 tests, frontend 300 tests, build/typecheck, Ruff, font wheel inclusion, browser render/download/print all passed. Parent spot check: 14 backend actor/design tests passed.
- T6 [S6] inline; complete; backend `f9d14b1` and frontend `7792846` published on both authorized branches; remote HEAD equality confirmed. This task document is recorded in a final documentation-only commit. No PR or deployment requested.

## Log

- L1 Original request opening, verbatim: "Tu tarea es implementar integralmente el diseño aprobado del documento **PROFORMA – COTIZACIÓN** del sistema HOMEX, aplicando de forma estricta las especificaciones que se detallan a continuación."
- L2 User authorization, verbatim: "si, procede con la implementación y por favor, no te interrupas hasta terminar todo"
- L3 Diagnostic: frontend clean; preserve backend untracked celerybeat-schedule.db. Endpoint get_object enforces existing visibility. PDF currently uses assigned seller, dense matrix, technical formatter loses zero/quantity-one/unknown fields/set associations. Persisted monetary totals exist. Both origins and existing feature branches confirmed; user authorizes configured Git credential for publication. No SSH/environment credential discovery.
- L4 RDD explicitly OFF globally in both repositories; do not start native review or alter switch. Parent writes inline: no parallel independent writer units; separate verification only for named security/shared behavior risk. No PR requested or created; delivery is commits on the existing explicitly selected branches, avoiding unsolicited chain branches.

- L5 RED: initial five pure backend contract tests failed on missing actor API/old rendering; frontend two new session-isolation regressions failed (2 existing passed). GREEN: backend focused 18 passed, frontend viewer/composable 7 passed; typecheck and focused lint pass. Additional integrity/geometry/service tests added before final audit.
- L6 Database test setup initially failed because the development role cannot create a test database. Resolved without touching that role or its data: disposable local PostgreSQL 16 cluster under system temp, port 55439, with test-only trust authentication bound to loopback.
- L7 Visual QA found oversized KeepTogether behavior moving the first item and title onto another page. The prefix now belongs to the splittable first card. Complex A reduced from three to two pages without dropping content; extended B retains full lock explanations over three pages. Signature spacing remains 27 mm, with a 5 mm preceding gap.
- L8 Fonts are bundled with their license and declared package data, so rendering does not depend on server font installation. Final independent verification includes packaging resource inclusion (risk item 5), authenticated identity (item 2), and unchanged public contracts/shared behavior (item 3).

- L9 Independent verifier covered S1–S6 in isolated baseline/candidate copies. Backend full suite: 529 passed; Ruff check and format check passed. Frontend full suite: 56 files / 300 tests passed with the documented localhost API origin and dependencies resolved within the isolated workspace. Production build/typecheck passed. Font wheel includes both TTFs and license. No change-caused blockers.
- L10 Initial scratch frontend attempts failed because its omitted .env lacked the API test origin and a dependency symlink escaped Vite's PDF-worker transform root. Baseline had the same failures. Final rerun with safe VITE_API_BASE_URL=http://localhost:8000 and a real dependency copy passed every test without source changes; browser scenario passed with a mocked loopback origin. No unresolved environmental failures.
- L11 Real browser regression renders the generated two-page PDF, checks identical downloaded bytes, dispatches print to the original Blob iframe, and confirms only one PDF request across all three operations. Parent final backend actor/design spot check: 14 passed. Final visual samples: simple 1 page, A 2 pages, extended B 3 pages; every page inspected, no blank/orphan first page or split signatures.
- L12 Delivery slicing: authentication was isolated in backend c33d34d (128 additions/39 deletions; its own isolated five tests passed). Approved rendering is one cohesive backend replacement f9d14b1 (1,130 additions/746 deletions, excluding two binary fonts); splitting its compositor, hierarchy and regression fixtures would leave a nonfunctional intermediate renderer. The size guide was not used to remove tests/content or minify code. No PR creation or unsolicited chain branches are part of the authorized publication.

- L13 Publication confirmed: backend origin feature branch = f9d14b11df42b6ac4a5a841eb3ee4b4abdf908f8; frontend code origin branch = 7792846c23c1c9753ad554bb16a5bb54a684df03. Both pushes were fast-forward and used only the explicitly authorized configured Git credential. Backend unrelated untracked celerybeat-schedule.db remains untouched. Final documentation-only commit records this evidence and will be pushed to the same frontend branch. RDD remains disabled/unmanaged; no review transaction, PR, migration, production data update, or deployment was performed.
