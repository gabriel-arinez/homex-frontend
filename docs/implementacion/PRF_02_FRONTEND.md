# PRF-02 — Especificación definitiva FRONTEND: catálogo y líneas de cotización HOMEX

**Estado funcional:** PRF-02.1–PRF-02.7 DEFINIDOS Y APROBADOS por el usuario (18-10-2026).  
**Estado de ejecución:** especificación; **NO** acredita implementación ni pruebas ejecutadas.  
**Baseline verificada al redactar:** frontend `main` `f8994b0aa4df215c5422f47190257f93914443b1`; backend `main` `ce45a08f490b209d2091886272e891f02e0f6639`. Revalidar SHAs antes de codificar.  
**Documento par obligatorio:** `homex-backend/docs/implementacion/PRF_02_BACKEND.md`.  
**Precedente:** `docs/implementacion/PRF_01_FRONTEND.md`; acuerdos de AP3, AP4, AP5, AP6 y AP6.1.  
**Ámbito:** experiencia de productos de catálogo y su incorporación a proformas, reutilizando Vue 3 + TypeScript + Vue Router + Pinia + cliente OpenAPI y sistema visual existente.

> **Mandato:** implementar fielmente las siete decisiones aprobadas. No iniciar nuevas rondas de definición ni sustituir requisitos por interpretaciones de Codex. Antes de editar: inspeccionar la realidad de ambos repositorios, dependencias, estado Git, tests y contrato actualizado. Documentar diferencias posteriores al baseline y adaptar conservando el objetivo aprobado. Ningún punto se considera implementado por estar documentado.

## 0. Principios innegociables

1. La proforma es **un único borrador comercial**, con líneas de silla, piso, otros y muebles a pedido en una lista común; cambiar de categoría no crea otra proforma.
2. **Dos caminos de incorporación:** «Producto de catálogo» y «Mueble a pedido». El de catálogo muestra Sillas, Pisos y Otros, búsqueda directa por SKU/nombre y filtros por categoría. Mueble a pedido va al formulario manual completo, _no_ al maestro `Producto` ni a un catálogo de muebles inventado. Detalle de ese formulario: PRF-03. Voz/NLP: PRF-04, opcional y siempre revisable.
3. Los productos maestros se consultan y seleccionan, **nunca se editan accidentalmente al negociar**. Solo `comercial.administrar` crea/modifica maestros. La línea comercial y el maestro tienen persistencia y permisos diferentes.
4. Seleccionar un producto abre el **formulario comercial completo**; jamás insertar automáticamente cantidad 1/precio catálogo ni ejecutar POST/PUT de proforma. La incorporación solo actualiza el borrador local hasta «Guardar borrador»/«Emitir».
5. Cada SKU es variante real con precio, unidad y stock propios; una familia agrupa y habilita «Variante pendiente», pero no es SKU, no reserva stock ni autoriza aprobar. No inventar variantes ni mostrar una familia como si tuviera precio/stock individual.
6. La disponibilidad es **referencial**, nunca reserva. PostgreSQL y backend deciden aprobación, stock, importes guardados y consecuencias en pedido/ventas. Promoción vigente ya está en `precio_vigente`: no descontar dos veces.
7. **Unidades:** SILLA=PIEZA; PISO_FLOTANTE nuevo=M2 con decimales hasta precisión real; OTRO=PIEZA/JUEGO/BARRA; muebles a pedido=PIEZA/JUEGO según dominio. `CAJA` histórica se respeta, **no se convierte** ni se usa en nuevas líneas de piso.
8. `precio_unitario` BOB se propone a partir del precio vigente del SKU cuando aplica; en USD se introduce explícitamente, sin conversión automática. Cantidad positiva; precio unitario nuevo >0; descuento >=0, importe monetario **sobre la línea entera**, <= bruto; cero es válido. Toda moneda visual coincide con la proforma.
9. No sobrescribir automáticamente precio negociado, cantidad, descuento, nombre/observaciones útiles ni datos técnicos al cambiar/resolver SKU o volver de mantener catálogo. Snapshot de promoción y precio de referencia no sustituyen la negociación.
10. No alterar históricos `TOTAL_NEGOCIADO`, `CAJA`, líneas aprobadas, cliente/snapshots, fichas técnicas, pedidos, OT, documentos y captura ya existente. No asumir que producto maestro tiene snapshot histórico completo en línea.
11. Respetar `clave_idempotencia`, `revision_esperada`, errores 400/403/404/409, permisos y control del editor multi-pestaña. No permitir que fallos de red destruyan el trabajo local. Un único editor temporal activo por vendedor.
12. No introducir Tailwind, nueva SPA, estado global paralelo, nuevas dependencias de producción o refactorización transversal sin necesidad medida y justificada. No tocar NLP/Deploy ni publicar producción en PRF-02.

## 1. Baseline y brechas concretas constatadas

| Área/código actual                                                | Estado real (baseline)                                                                                                               | Trabajo PRF-02                                                                                                    |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------- |
| `src/modules/proformas/views/ProformaEditorView.vue`              | Editor cuatro pasos Productos/Cliente/Condiciones/Revisar; guarda integral; tarjetas con botones; solo última eliminación reversible | Orquestar dos caminos, catálogo contextual, lista compacta, detalle lectura, menú, stack undo, ida/vuelta estable |
| `src/modules/proformas/components/DetalleForm.vue`                | Formulario genérico con selección textual, productos/familias y precio vigente                                                       | Formulario comercial de SKU/familia predefinidos, read-only maestro, evitar sobrescritura negociada               |
| `src/modules/proformas/components/ProductoSelector.vue`           | Select paginado/búsqueda activos, no catálogo visual                                                                                 | Reutilizar consulta en nueva vista contextual, sin romper consumidores legados                                    |
| `src/modules/productos/views/ProductosListView.vue`               | Catálogo administrativo grid/list y SearchField, filtros activos y paginación                                                        | Reutilizar primitivas visuales; no redirigir al vendedor a la lista administrativa para seleccionar               |
| `src/modules/productos/components/ProductoForm.vue`               | Maestro de categorías, silla/piso y JSON visible para silla                                                                          | Preselección contextual; controles comerciales legibles para especificaciones JSON manteniendo datos desconocidos |
| `src/modules/productos/views/ProductoCreateView.vue`              | `returnTo/draft/productoCreado` y upload posterior a alta                                                                            | Pasar categoría; retorno fiable y explícito en el contexto comercial                                              |
| `src/modules/productos/views/ProductoDetailView.vue`              | Edición protegida por `If-Match`, sin retorno contextual equivalente                                                                 | Editar maestro desde cotización y regresar conservando estado                                                     |
| `src/modules/proformas/services/editorLocal.ts`                   | Clonación JSON, una eliminación por vez, token `sessionStorage` para retorno puntual                                                 | Stack undo, contexto completo, identidad/expiración, recuperación temporal segura                                 |
| `src/modules/proformas/services/presentacionComercial.ts`         | Total estimado con validación de datos                                                                                               | Mantener previsualización fiel y separada de total servidor; precisión/invalidación según contrato                |
| `src/modules/proformas/views/ProformaDetailView.vue`              | Advierte familia pendiente en detalle persistido                                                                                     | Consistencia visual y acceso a resolver variante desde editor, sin abrir escritura por estados                    |
| `apps/catalogo/api/views.py` + `ProductoFiltrosListadoSerializer` | Solo activo/categoría/familia, `search` en SKU/nombre                                                                                | Coordinar nuevos filtros backend _antes_ de usar como reales                                                      |
| `apps/catalogo/api/serializers.py`                                | SKU, datos de silla/piso, familia, precio, promoción, unidad, disponibilidad                                                         | Usar datos existentes sin inventar atributos o números                                                            |
| `apps/proformas/services.py`/triggers                             | Familia pendiente válida y bloqueo en aprobación, unicidad SKU, precios/históricos                                                   | Conservar contrato; corregir únicamente brechas probadas                                                          |

No confundir la presencia de tests de AP5/PRF-01 con prueba de PRF-02. Las rutas y pantallas nuevas no se implementaron en este baseline.

## 2. PRF-02.1 — Inicio y rutas operativas

- En paso **Productos**, acción evidente «Añadir ítem», con elecciones **Producto de catálogo** / **Mueble a pedido**. El primer camino ofrece Sillas, Pisos y Otros, con búsqueda global SKU/nombre. El segundo abre sin intermedios el formulario de creación de mueble a pedido **completo y manual**, respetando la ficha estructurada actual; el diseño de campos/IA futura corresponde a PRF-03/04.
- Catálogo contextual **dentro de la experiencia de proforma**: no convertir la vista administrativa de Productos en el selector de proformas. Compartir servicios, `ProductImage`, `FilterBar`, `SearchField`, `ActiveFilters`, paginación y convenciones.
- Al seleccionar SKU existente: ir al formulario comercial; al confirmar, regresar a lista de Productos y poder incorporar más. Al cancelar, volver a resultados con filtros, página/scroll y borrador conservados.
- SKU ya presente: no permitir segunda línea; enfocar línea existente y ofrecer «Ir a línea»/editar. No descartar borradores de formulario sin confirmación.
- Los cambios de ruta internos/categorías/no guardar de línea **nunca** persisten la proforma. Revisión libre, guardado/emisión mantienen comportamiento aprobado PRF-01 y acuerdo previo de revisión obligatoria actualizada antes de emitir; no rediseñar formalización en PRF-02.

## 3. PRF-02.2 — Catálogo visual contextual y filtros

### 3.1 Interfaz

- Navegación contextual «Proforma › Añadir producto › Categoría». Selector de categoría, búsqueda SKU/nombre global, resultado contado, alternancia cuadrícula/lista, filtros visibles, chips activos y vaciado, carga/error/resultado vacío. Vista responsive: lateral desktop, panel plegable móvil, sin desbordes.
- Tarjeta por **SKU real**, con fotografía o fallback, nombre, SKU, familia opcional, 2–3 atributos pertinentes, unidad de stock, precio de referencia BOB, promoción vigente cuando aplique y disponibilidad **referencial**, sin afirmar «reservado». Primaria «Seleccionar para cotizar», secundaria «Ver ficha»; crear/editar maestro solo como acciones secundarias autorizadas.
- Familia organiza/filtra sin ocultar SKU ni fusionar variantes con stock/precio distintos. Si no hay familia, el SKU sigue siendo seleccionable. Cero stock no bloquea preparar proforma, pero informa adecuadamente. Cero de lista **no** se adopta como venta válida.
- Controles: búsqueda con debounce medido, bloqueo de respuestas obsoletas, filtro servidor antes de paginar, reset página al cambiar filtro/categoría, estados sin resultados, fetch cancelable/identificado, soporte teclado, foco/scroll.
- Conservar el catálogo administrativo con filtros activos/inactivos; el contextual usualmente muestra activos. No permitir cotizar productos inactivos nuevos.

### 3.2 Matriz de filtros requerida

| Contexto                        | Filtros                                                       |
| ------------------------------- | ------------------------------------------------------------- |
| Global                          | SKU/nombre, categoría, familia                                |
| SILLA                           | Familia, marca, modelo, color primario                        |
| PISO_FLOTANTE                   | Familia, marca, tipo, material, diseño, acabado, espesor (mm) |
| OTRO                            | Familia, SKU/nombre, unidad                                   |
| Selección de variante pendiente | Familia y categoría actual, solo variantes compatibles        |

Backend añade filtros mediante API pública, parámetros documentados y tipos OpenAPI. Solo ofrecer opciones fundamentadas en valores reales; no inventar filtro «color de piso» (el modelo no lo tiene). Modelo puede usar texto validado, espesor decimal; respetar exactitud/semántica de los campos según backend. Ningún filtro local reemplaza filtrado servidor.

## 4. PRF-02.3 — Formulario comercial de línea de catálogo

- Después de elegir SKU abrir un **formulario comercial completo** en el contexto operativo, no un modal estrecho ni el formulario maestro. En edición también abrir formulario completo, nunca campos inline ni panel lateral de edición.
- **Bloque maestro solo lectura:** imagen, nombre/SKU, categoría, familia, marca/modelo/color o atributos del piso pertinentes, unidad, precio lista/vigente, promoción y disponibilidad. Distinguir los datos actuales del maestro de los importes de la proforma.
- **Campos de línea:** cantidad positiva, unidad derivada **bloqueada**, precio unitario cotizado editable en moneda vigente, descuento monetario **total de línea** editable, nombre/descripcion comercial según contrato y observaciones de la línea (no inventar campo backend nuevo; reutilizar `descripcion` o especificar cambio coordinado solo si indispensable). Subtotal/descuento/total **estimados** de solo lectura.
- Tipo de línea derivado de categoría de SKU; no obligar a seleccionar manualmente `tipo_item` si SKU ya se eligió. Nuevas líneas `PRECIO_UNITARIO`. Los registros `TOTAL_NEGOCIADO` históricos no se convierten ni editan como si fueran nuevos unitarios.
- BOB: proponer el `precio_vigente` solo al iniciar **nueva** línea; promoción ya incluida, descuento adicional empieza 0. USD: precio escrito por humano, sin conversión de BOB. Si moneda cambia con líneas existentes, exigir revisión explícita de todos los precios, impedir que cambie solo símbolo; coordinar con PRF-05 sin deshacer el acuerdo.
- Cambiar SKU o resolver pendiente **NO** sobrescribe precio, descuento/cantidad/observaciones ya negociados; mostrar comparación y permitir «Usar precio de catálogo» solo mediante acción expresa.
- Bloquear entrada de nueva línea sin precio >0, cantidad inválida o descuento excedente, con errores por campo. Duplicado SKU enfoca anterior. Cerrar con cambios protege del descarte. Añadir línea modifica **solo borrador local**; vuelta a lista inmediatamente.
- Stock cero/insuficiente: advertencia informativa, no reserva; aprobación puede fallar por stock más tarde. Datos desactivados históricos conservan lectura.

## 5. PRF-02.4 — Familias, variantes pendientes y resolución

- Familia activa permite cotizar una línea «Variante pendiente» en `BORRADOR`/`EN_REVISION`, sin `producto_id` ni SKU falso, sin stock/reserva. Para pendiente debe conocerse la **categoría del recorrido**, familia, nombre/descripcion, unidad, cantidad, precio >0, descuento válido. SILLA PIEZA, PISO M2, OTRO unidad a elección PIEZA/JUEGO/BARRA. Familia sola no tiene categoría/unidad propias: no inferirlas sin validación.
- No usar automáticamente precio de un SKU arbitrario. Advertencia en lista, detalle, paso Revisar y documento emitido mínimo coordinado con backend.
- Acción «Seleccionar variante» desde línea pendiente: filtrar variantes **reales activas** de familia y categoría, mostrar atributos, stock/precio por SKU; seleccionar y **actualizar la misma línea** conservando `id/localId`, cantidad cuando compatible, precio negociado, descuento, descripción/observaciones y demás datos. Si unidad no coincide, bloquear conversión automática y exigir corrección explícita antes de guardar. Nombre oficial propuesto con confirmación visible sin pisar descripción redactada.
- No aprobar proforma con pendiente; frontend muestra lista concreta de pendientes con acceso directo y backend/PostgreSQL conserva bloqueo. Emisión en revisión sí admite pendientes (con todos los demás requisitos).
- Unicidad por SKU: si dos pendientes se resuelven al mismo SKU, no fusionar automáticamente cantidades/precios/descuentos; redirigir a resolución humana sin pérdida. Dos pendientes de una misma familia pueden mantenerse para variantes distintas.
- Proteger promociones y snapshots de precio según política backend; no aplicar descuentos dos veces. Sin migración estructural por comodidad.

## 6. PRF-02.5 — Lista unificada, detalle, menú y operaciones

- En **Productos** todas las líneas en **lista compacta** (no tarjetas gigantes): nombre, resumen de tipo/SKU o «Variante pendiente», cantidad+unidad, precio/descuento relevante y total; importes provisionales señalados. Responde 360/390/768/1024/1440.
- Clic en cuerpo de ítem abre **modal completo SOLO LECTURA**: maestro actual distinguido de datos negociados, descripción completa, todos atributos aplicables, ficha de mueble si existe, unidad, cantidad, precio, descuento, total y condición pendiente. NO abrir formulario al pulsar el ítem.
- Botón `⋮` por ítem abre menú flotante rectangular pegado al botón, sin desplazar filas, con flip en bordes, teclado/Escape/foco; **Editar, Duplicar mueble solo si MUEBLE_MEDIDA, Eliminar**. Ver detalle NO va en menú, pues clic sobre línea abre lectura. Las acciones autorizadas también al pie del modal lector. Clic `⋮` no abre modal.
- **Editar** siempre abre formulario completo, sin inline. Para línea de SKU, comerciales editables; para mueble, ficha completa (alcance extendido PRF-03). No dejar que un cambio técnico convierta/borre fichas sin intención.
- **Duplicar mueble:** abrir «Duplicar mueble» con copia profunda independiente, no insertarla hasta confirmar. Si ningún dato difiere, mostrar aviso y no crear línea; si realmente idénticos, incrementar cantidad original de manera explícita. No ofrecer duplicación para catálogo.
- **Eliminar:** retirar temporalmente, guardado integral después confirma. Implementar historial/pila de **múltiples** eliminaciones y deshacer en orden correcto recuperando `id`, `localId`, ficha, precios y posición. No papelera persistida. Si falla guardado/409, conservar posibilidad de deshacer; al guardar con éxito limpiar historial.
- Suma de líneas en pantalla: estimación total hasta servidor; descuento 0 válido; `TOTAL_NEGOCIADO` histórico íntegro. No inventar campo de orden persistente ni drag-drop si modelo no lo soporta.
- Paso **Revisar** aprobado en acuerdo anterior: todos los datos directamente visibles, con especificaciones y condiciones, revisión **actualizada** obligatoria antes de emitir, «Guardar borrador» independiente; cambios comerciales invalidan revisión anterior. No convertir la revisión en un modal de detalle por línea.

## 7. PRF-02.6 — Alta/edición maestra contextual con retorno seguro

- Crear/editar maestro exclusivamente `comercial.administrar`; vendedores sin permiso solo seleccionan SKU existentes o pendientes permitidas y solicitan mantenimiento fuera de alcance PRF-02. No implementar un sistema de solicitudes no aprobado.
- Desde contexto Sillas, Pisos, Otros: abrir `ProductoCreateView.vue` con categoría correcta preseleccionada (SILLA/PIEZA, PISO_FLOTANTE/M2, OTRO unidad seleccionable válida). Formulario reutilizado y configurable, sin tres APIs, sin forzar JSON textual como herramienta principal de silla: representar `especificaciones` con controles comprensibles y extras que preserven claves desconocidas, respetando JSON del backend.
- Manual completo siempre disponible. La futura sugerencia por voz queda exclusivamente a PRF-04 y requerirá revisión humana.
- Crear producto **sí** persiste maestro; no persiste proforma, no registra stock y no incorpora línea automáticamente. Tras alta exitosa, volver al contexto guardado, seleccionar SKU nuevo y abrir formulario comercial con cantidad/precio/descuento previamente introducidos cuando existan. Si imagen falla después de alta, producto queda creado y se informa.
- Cancelar alta, con o sin edición en formulario, protege datos y regresa a proforma íntegra. No repetir creación de resultado incierto sin consultar SKU existente.
- «Editar ficha de catálogo» (secundaria, admin) navega a mantenimiento de maestro con retorno contextual y `If-Match`/409; categoría/unidad no se mutan. Regresar al mismo borrador y filtros sin modificar precio/condiciones negociadas. Si el producto pasa a inactivo, no seleccionarlo automáticamente como variante nueva.
- Estado contextual a preservar: identificación de cotización/usuario, cabecera/cliente/prospecto/condiciones, todos los ítems/fichas, cambios sin guardar, `id/localId`, historial deshacer, ruta de origen, categoría/filtros/página/scroll, formulario parcial, edición en curso, `revision_esperada` e idempotencia. Distinguir ida/vuelta puntual de recuperación automática ante refresh/cierre (acuerdos anteriores).
- Protección de identidad y multi-pestaña: un solo editor temporal por vendedor; datos locales scoped a usuario/dispositivo, caducidad/limpieza coherente, logout/cambio cuenta no filtra borradores, ausencia de almacenamiento muestra recuperación limitada honestamente. No guardar audio/credenciales/tokens en snapshots; `returnTo` solo destinos internos seguros. Evitar restaurar versión obsoleta sobre cambio guardado/409.
- No eliminar productos maestros al cancelar cotización ni crear proforma oficial al entrar a Productos.

## 8. PRF-02.7 — Integración, calidad y límites

### 8.1 Rutas completas obligatorias

1. Cotización nueva → Catálogo → Sillas → SKU → formulario → lista, sin POST de proforma.
2. Lo mismo para Pisos (M2 decimal) y Otros (PIEZA/JUEGO/BARRA).
3. Búsqueda SKU directa, filtros específicos **backend**, chips/paginación/vistas grid-list, loading/error/empty, cambio rápido sin respuestas obsoletas.
4. Tres categorías y mueble a pedido en **un borrador**; añadir y editar; navegar por pasos y volver; conservar datos.
5. Producto duplicado → enfocar existente sin duplicar.
6. Familia pendiente → guardar borrador → emitir EN_REVISION con aviso → resolver hacia SKU compatible → conservar línea y precio → bloquear aprobación mientras esté pendiente.
7. Crear silla/piso/otro y editar maestro durante cotización; cancelar/guardar; permisos administrativos; volver con formulario y borrador completos; fallo imagen y 409 sin pérdidas.
8. Fila → modal lectura; `⋮` → menú sin activar modal; editar completo, duplicación mueble confirmada, eliminar varias y deshacer.
9. BOB/promoción/descuento adicional vs USD manual, cambio de moneda sin conversión, histórico `CAJA`/`TOTAL_NEGOCIADO`.
10. Guardar/emitir explícitamente con idempotencia y revisión; falla API/red 400/409 preserva local; confirmar total desde backend.
11. Intenciones de aprobación con pendiente/stock insuficiente siguen rechazadas por PostgreSQL; seleccionar no toca stock.
12. No regresiones en clientes, documentos, adjuntos, pedidos, movimientos ni integración de captura existente.

### 8.2 Superficies a intervenir (orientativas, no listas cerradas)

- `src/modules/proformas/views/ProformaEditorView.vue`, `ProformaDetailView.vue`, `components/DetalleForm.vue`, `ProductoSelector.vue`, `services/editorLocal.ts`, `presentacionComercial.ts`, `proformasService.ts`.
- `src/modules/productos/views/ProductosListView.vue`, `ProductoCreateView.vue`, `ProductoDetailView.vue`, `components/ProductoForm.vue`, `ProductImage.vue`, `services/productosService.ts`.
- Componentes nuevos _acotados_ para catálogo contextual, tarjeta SKU, filtros, detalle lectura y menú `⋮`. Reutilizar UI compartida donde tenga sentido y no romper consumidor anterior.
- `contracts/backend-openapi.yaml`, `src/generated/api/` solo vía procedimiento generado/sincronizado con backend cuando contrato cambie.

### 8.3 Pruebas y gates

- Vitest unit/component para: filtro, estado, precio/moneda/promos, qty M2 vs PIEZA/JUEGO/BARRA, familias, SKU duplicate, conservación de IDs, snapshots, varias eliminaciones/undo, editor multi-tab, draft recovery, race conditions, modal/menú y distinción maestro/línea.
- Playwright E2E para escenarios 8.1 con mocks controlados **y pruebas de integración reales** contra versión compatible backend/PostgreSQL. Asegurar que integración PRF-02 ejecute el par **real de commits nuevos**; los jobs con SHA histórico fijado no bastan para demostrar compatibilidad de PRF-02.
- A11y teclado/semántica/foco/restauración/Escape, overlay sin bloqueo residual; responsive 360,390,768,1024,1440; claro/oscuro; capturas y trazas de errores.
- Perf: baseline de consultas API por página, tamaño de imágenes y tiempo render; no afirmar mejoras no medidas; vigilar agregaciones de disponibilidad/demanda por SKU. Sin service de búsqueda ni caché nuevo salvo evidencia.
- Gates: `npm ci`; `npm run type-check`; `npm run lint:check`; `npm run format:check`; `npm run test:unit -- --run`; `npm run build`; `npm run contract:check`; `npm run test:e2e`; `npm run test:a11y`; integración/release si entorno configurado. No reportar PASS sin ejecutar. Mantener suite anterior verde.
- Validar backend con `uv run python manage.py check`, `uv run python manage.py makemigrations --check --dry-run`, `uv run pytest -ra`, esquema OpenAPI y tests PostgreSQL; referencia en documento backend.

## 9. Orden de implementación para Codex

1. **Preflight:** revisar `main` de cuatro repos si relevante, sobre todo frontend/backend; estado de ramas/worktrees, baseline, contratos, tests, migraciones y reglas reales. No destruir cambios ni editar `main` a ciegas. Identificar riesgos; no iniciar fase nueva.
2. **Contrato coordinado:** junto al backend, acordar nombres exactos de filtros y respuestas; extender endpoint de catálogo y OpenAPI si necesarios. Generar tipos frontend a partir del schema, nunca editar tipos generados manualmente.
3. **Flujo visual:** entrada Catálogo/Mueble a pedido, navegación por categorías, catálogo de SKU visual, filtros, selección SKU y familia pendiente, formulario comercial con condiciones correctas.
4. **Lista y retorno:** filas compactas, detalle lectura, menú acciones, eliminación/undo múltiple, ediciones completas, mantenimiento maestro contextual, recuperación segura.
5. **Regresiones, QA y documentación:** pruebas focales por subflujo; al final suite completa/frontend+backend+PostgreSQL, accesibilidad/viewport, análisis de diff, documentación de brechas corregidas, integración PR/CI.
6. **Entrega:** resumen por cada PRF-02.1–02.7, archivos afectados, evidencias concretas, comandos/test con resultados reales, SHAs/PR/CI, riesgos no cerrados. Solicitar auditoría independiente y visto bueno antes de declarar implementación aceptada.

## 10. Reglas de entrega

- **Ninguna alteración funcional** de NLP, Deploy, pagos, almacenes, reservas, inventario, aprobación/pedidos, OT o emisión de PDF salvo la identificación mínima de pendientes expresamente aprobada y coordinada con backend. PRF-03/04/05/06 permanecen fuera de rediseño en esta entrega.
- Cambios de backend únicamente por brecha contractual aprobada/reproducida, con test que capture el caso y sin alterar datos históricos; si se añade migración, nueva y compatible, nunca reescribir anteriores.
- No comandos Git destructivos (`reset --hard`, `clean -fd`, force push) sin autorización. Usar ramas/PR/CI del proyecto.
- **El cierre es de dos etapas:** Codex implementa y prueba; luego revisión independiente y aceptación del usuario. Este documento no declara implementación.

## 11. Matriz resumida de trazabilidad

| PRF  | Entrega                                                | Evidencia mínima                                            |
| ---- | ------------------------------------------------------ | ----------------------------------------------------------- |
| 02.1 | Dos caminos y navegación contextual                    | E2E de entrada/cancelación/retorno                          |
| 02.2 | Catálogo SKU visual, filtros servidor y responsive     | API test filtros, E2E catálogo/filtros/paginación, capturas |
| 02.3 | Formulario comercial SKU y precio/moneda/unidad/promos | Unit + E2E precios, descuentos y cero stock                 |
| 02.4 | Familia pendiente y resolución sobre misma línea       | PostgreSQL + E2E pendiente/emisión/bloqueo/compatibilidad   |
| 02.5 | Lista/lectura/menú/editar/duplicar/undo múltiple       | Component+E2E identidad y accesibilidad                     |
| 02.6 | Crear/editar maestros contextual con recuperación      | E2E permisos, cancelación, retorno, 409 y sesiones          |
| 02.7 | Compatibilidad, seguridad, rendimiento y no regresión  | Tests integrados, contratos, CI, capturas, auditoría        |

**Resultado exigido:** el vendedor puede preparar una única cotización de catálogo con variantes concretas o pendientes, administrar líneas y regresar de mantenimiento maestro **sin pérdida de trabajo, sin duplicaciones y sin operaciones de proforma implícitas**. La autoridad comercial y transaccional sigue en backend/PostgreSQL.
