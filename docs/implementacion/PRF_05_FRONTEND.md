# HOMEX — PRF-05: especificación técnica frontend Vue

**Estado:** instrucciones técnicas para implementar la definición funcional aprobada de PRF-05.1–PRF-05.5. No representa implementación terminada. Contrato obligatorio `PRF_05_CONTRATO_COMPARTIDO.md` idéntico al de backend.

**Baseline inspeccionada:** `main@89a74aa6d1b7e3308e5b6e3265ac18b7e788b078` el 21-10-2026. Verificar HEAD, migraciones/contratos y la implementación PRF-04 que aún se está perfeccionando antes de cambiar código. No sobrescribir ni desmontar su integración de voz.

## 1. Diagnóstico comprobado y módulos existentes

- `src/modules/proformas/views/ProformaEditorView.vue` implementa cuatro pasos `Productos`, `Cliente`, `Condiciones`, `Revisar`. La escritura ocurre por `persist(false|true)`, que usa `proformasService.saveIntegral` o `updateIntegral`. `lineas`, `draftingFurniture`, `nuevoCliente`, `header`, `persisted` y `dirty` gobiernan la edición local. Navegar no debe crear datos.
- El editor muestra `clienteMode=pendiente|existente|nuevo`, selector y formulario contextual; `src/modules/proformas/components/ClienteSelector.vue` busca en backend y pagina. `ClienteFormFields.vue` ya distingue PERSONA/EMPRESA con contacto.
- `Condiciones` tiene seis controles mezclados en `form-grid`. `priceReviewRequired` compara moneda actual y `reviewedCurrency`; `confirmCurrencyReview` marca revisada la moneda, pero una confirmación antigua puede quedar vigente tras editar precios/descuentos. `money()` formatea en moneda activa, sin conversión. Perfeccionar la validez de esa confirmación.
- `Revisar` muestra tres tarjetas y resumen abreviado; no incorpora ficha técnica completa ni desglose suficientemente claro de descuentos/subtotal. `src/modules/proformas/services/presentacionComercial.ts` devuelve `null` si un total es indeterminado, distingue `TOTAL_NEGOCIADO`.
- `src/modules/proformas/services/muebleTecnico.ts` conserva `datos_tecnicos` abierto de PRF-03, con conjuntos, componentes, accesorios y atributos. La revisión debe aprovecharlo sin transformarlo ni mezclar cantidades internas con cantidad comercial.
- `persist(true)` está disponible desde cualquier paso, sin confirmación específica y presenta «Proforma emitida para revisión» incluso ante PUT válido de `EN_REVISION` que no transicionó. Corregir: CTA solo en Revisar, modal contextual, estado verificado y mensajes basados en respuesta.
- `src/modules/proformas/views/ProformaDetailView.vue` mantiene envío desde detalle, aprobación posterior, descarga de PDF y gestión de adjuntos. Conservar estas funciones; aprobación de pedido, stock y documentos quedan fuera de PRF-05.
- `src/modules/proformas/services/editorLocal.ts` almacena snapshot contextual con identidad/TTL y protege retorno de catálogo. Integrar borrador PRF-04, metadatos de captura y revisiones de cliente/moneda sin perderlos.
- `src/modules/proformas/services/proformasService.ts` ya consume rutas integrales y servicios de cliente; contratos tipados de `src/generated/api/` derivan de `contracts/backend-openapi.yaml` y deben regenerarse, nunca editarse directamente.

## 2. PRF-05.1 — Selección, alta y pendiente de cliente

Objetivo: permitir trabajar en la misma pantalla `Cliente` con tres modos claramente distinguibles, sin navegaciones adicionales ni asistente de pasos:

**Cliente existente.** Selector con búsqueda remota por nombres/apellidos/razón social/celular, resultados paginados y carga de más; cada opción distingue clientes homónimos mediante empresa y/o celular **solo si están presentes y son visibles al actor**. Una vez elegido, mostrar tarjeta resumen con tipo, nombre/razón social, contacto y celular si existen, acción `Cambiar cliente`, y advertencia clara si está inactivo/histórico cuando la relación persistida lo permita; nunca permitir usar nuevo cliente inactivo.

**Cliente nuevo.** Reusar `ClienteFormFields.vue` y validación de empresa/persona: PERSONA nombres+apellidos; EMPRESA empresa y nombres+apellidos del contacto; celular, dirección y observaciones opcionales. Mostrar identificación «Todavía no registrado» y no crear cliente al teclear ni al cambiar sección. El POST/PUT integral creará el cliente junto a la proforma solo tras guardar/emitir. No agregar CI, NIT, correo, contactos múltiples ni modificar datos de ficha maestra desde aquí.

**Cliente pendiente.** Mostrar texto claro: se puede guardar borrador y seguir editando, pero se debe seleccionar/registrar cliente antes de emitir. No confundir pendiente con cliente «prospecto» persistido ni con valor predeterminado inválido.

**Detección de posibles duplicados (sugerencias, no bloqueo).** Al registrar cliente nuevo, usar búsqueda remota existente acotada al vendedor y resultados paginados: si hay coincidencias razonables por empresa, nombre/contacto o celular, mostrar opcionalmente «Posibles clientes existentes» con acción de selección; no enumerar datos de otras cuentas ni aplicar un criterio rígido de identidad. Manejar loading/errores/resultado obsoleto y no hacer petición por cada pulsación sin control. Ante coincidencia no impedir continuar el alta; no introducir unicidad de nombre o teléfono como regla de negocio.

**Preservación de edición.** Cambiar origen existente/nuevo/pendiente nunca pierde productos, especificaciones, condiciones ni capturas PRF-04. Si una acción descartaría texto propio del modo cliente previo, prevenir pérdida silenciosa mediante preservación local o confirmación específica; no inventar merge automático de cliente existente y nuevo. Al volver desde otras secciones conservar la selección; si respuesta asíncrona de búsqueda antigua llega tarde, ignorarla. Error 400 anidado `cliente_nuevo.*` se muestra por campo, 409 preserva todos los valores, errores de permiso no muestran existencia de clientes ajenos.

## 3. PRF-05.2 — Condiciones: diseño y semántica final aprobados

**Distribución obligatoria sin subtítulos/contenedores extra:**

- **Fila 1 (100%)**: `Título de la proforma`.
- **Fila 2 (dos columnas 50/50)**: `Moneda` | `Adelanto requerido (%)`.
- **Fila 3 (dos columnas 50/50)**: `Plazo de entrega` | `Validez de la oferta (días)`.
- **Fila 4 (100%)**: `Observaciones comerciales`, `textarea` multilínea.

Responsive: en <=768 px, o cuando el contenido lo requiera, apilar en el **mismo orden**: título, moneda, adelanto, plazo, validez, observaciones. Permitir etiquetas persistentes, ayuda corta bajo campo y error adyacente; sin overflow o sticky que tape acciones. Reutilizar TextField, Select y Textarea compartidos (o equivalente ya existente), sin modificar su contrato para otros módulos.

**Validación local alineada con backend:** título opcional <=250; moneda BOB/USD; adelanto 0..100 con máximo 2 decimales, cero válido; plazo texto libre opcional <=100; validez entero >=1 opcional; observaciones libres y multilineales. No establecer valores obligatorios o defaults negociados arbitrarios. Formatear ceros/null/vacío de manera distinta y respetar cadenas decimales al crear payload.

**Moneda (regla crítica de seguridad comercial):** al cambiar moneda con cualquier línea existente, mostrar inmediatamente debajo de segunda fila advertencia contextual «No se convierten automáticamente precios ni descuentos» y dirigir a `Productos` para revisar todos los importes. Hasta revisión explícita, bloquear `Guardar borrador/Guardar cambios` y `Emitir` y no representar un total en la moneda nueva como monetariamente fiable. La revisión se vincula a una firma local determinista de moneda + contenido monetario relevante de las líneas, incluyendo tipo de cálculo, cantidades, precios, descuentos, importe negociado e identidad de línea; cambiar la moneda de nuevo o editar precios/descuentos posteriormente debe **invalidar** la confirmación anterior si corresponde. No permitir superar esta protección simplemente alternando secciones, volviendo del catálogo contextual o restaurando snapshots antiguos. No efectuar conversiones automáticas. Dejar intactos los históricos `TOTAL_NEGOCIADO` y `CAJA`, nunca derivar unitario de importe negociado.

**Adelanto referencial:** bajo el campo, mostrar «Adelanto referencial: ...» cuando `porcentaje_adelanto` sea válido, `totalEstimadoCompleto` sea confiable y la revisión monetaria esté vigente. Multiplicar % × total estimado solo para visualización, respetando precisión de moneda y etiquetar «referencial»; no registrar pago ni reducir total. Si total indeterminado, línea incompleta o moneda pendiente, mostrar «Pendiente de calcular» o no mostrar dinero. Adelanto 0 es válido, no se confunde con campo ausente.

**Ayudas:** plazo es texto libre con ejemplo «20 días hábiles», validez en días numéricos sin fecha inferida; título es identificador comercial; observaciones no son notas técnicas de mueble. Mantener campos sin truncamiento, sin guardado automático y con protección `dirty` al navegar.

## 4. PRF-05.3 — Revisión comercial integral, legible y fiel

La sección `Revisar` es de **solo lectura**, se actualiza desde las estructuras locales actuales de `ProformaEditorView.vue` sin consulta/persistencia obligatoria; no convertirla en nuevo formulario ni pantalla/PDF aparte.

Orden visual aprobado:

1. **Encabezado:** HOMEX, título (o «Cotización comercial» si vacío), estado expresado de forma real (nueva sin guardar, borrador guardado o en revisión) y moneda. Número solo cuando exista resultado persistido.
2. **Cliente:** nombre o razón social, nombres/apellidos del contacto, celular si existe, y distinción «nuevo todavía no guardado» frente a cliente persistido o pendiente. Acción `Corregir en Cliente`.
3. **Productos cotizados:** tabla responsive o presentación equivalente con nombre/tipo, descripción cuando existe, cantidad y unidad, precio unitario cotizado y descuento, total por línea. Mostrar variante/familia pendiente sin insinuar reserva de stock; históricos `TOTAL_NEGOCIADO` como importe negociado, no «precio unitario» calculado. Acción `Corregir en Productos` y, donde sea viable, `Editar este ítem`.
4. **Especificaciones técnicas bajo demanda:** para cada mueble a medida botón `Ver especificaciones`/`Ocultar` desplegable con dimensiones/unidades, características generales, grupos/conjuntos, componentes y cantidades internas, materiales, espesores, acabados, colores, accesorios, atributos dinámicos, observaciones. La presentación es humana, nunca JSON crudo; mantener información abierta/desconocida en payload aunque alguna clave no tenga control visual. Mostrar los datos incorporados y corregidos mediante PRF-04 exactamente igual a datos manuales.
5. **Resumen económico:** subtotal, descuentos totalizados, total estimado o confirmado, moneda real. Solo calcular estimación si todas las líneas son válidas; precio pendiente NO es Bs 0. Descuento cero explícito válido; si no hay total calculable, decir «Pendiente». No mostrar importe «guardado por PostgreSQL» cuando hay cambios locales sin guardar; mostrar por separado el último confirmado cuando corresponde. Mientras moneda no revisada, no expresar monto «estimado en USD» si números provenían de BOB.
6. **Condiciones comerciales:** moneda, adelanto %, importe referencial si corresponde, plazo, validez y observaciones, diferenciando vacío de «a elección». Acción `Corregir en Condiciones`.
7. **Pendientes de emisión:** lista accionable de requisitos faltantes, con salto al apartado/campo correcto; no bloquear borrador por opcionales.

Estilos: visual compacto y responsive, cuatro bloques claros sin tarjetas anidadas repetitivas; tarjetas de resumen pueden desaparecer o consolidarse si duplican la misma información. Técnico complejo plegado por defecto; al desplegarlo, semántica `button aria-expanded`, foco/teclado y sin reordenar datos. No consultar al catálogo para modificar precios históricos o snapshots. El resumen `Copiar` debe reflejar fielmente el estado visible, indicar carácter manual y no adjuntar automáticamente documentos/voz.

Los cálculos informativos reutilizan `presentacionComercial.ts`, ampliándolo solo para desglose fiable y redondeo local consistente; PostgreSQL sigue siendo autoridad. No crear una segunda regla comercial ni incorporar descuento general inexistente. Los campos desconocidos del `datos_tecnicos` deben preservarse mediante la lógica PRF-03 existente.

## 5. PRF-05.4 — Guardar, confirmar y emitir con estados reales

**Botones y ubicación:**

- Nueva proforma: `Guardar borrador` disponible sin cliente, si líneas presentes cumplen reglas actuales; `Emitir proforma` solamente en último paso `Revisar` y habilitado con requisitos completos.
- `BORRADOR` persistido: `Guardar cambios` como acción secundaria persistente; `Emitir proforma` únicamente en `Revisar`.
- `EN_REVISION` persistida editable: `Guardar cambios` (envía `emitir=false`) y `Volver al detalle`, sin botón `Emitir` ni mensaje de «emitida» por una actualización ordinaria. Los estados finales usan vista de detalle existente, sin mutaciones desde este editor.
- «Continuar», acceso directo a pestañas, expandir ficha o abrir un modal no escribe ni asigna número.

**Modal único de confirmación** al hacer clic en `Emitir proforma`, **solo después** de validaciones preventivas. Mostrar cliente legible, número de líneas, total etiquetado «Estimado» o «Confirmado» según procedencia, y texto de destino `EN_REVISION`; explicar que no se aprueba ni crea pedido y tampoco se envía documento. Acciones «Volver a revisar» (cierra sin petición) y «Confirmar emisión». No checkbox adicional.

**Proteger obsolescencia del modal:** capturar snapshot/firma de payload local + `revision_esperada` vigente al abrir modal; si cambia cualquier dato comercial, el cliente, los ítems/condiciones, el estado de PRF-04 o la versión, cerrar/invalidar confirmación y requerir una nueva. No confiar en la validez de `canEmit` solo durante render del botón. El servidor revalida todas las reglas y el estado.

**Guardado:** una operación integral explícita por confirmación; bloquear pulsación doble y polling tardío; conservar UUID idempotente ante retry del mismo payload, no generar otra clave si se desconoce si servidor recibió el primero. Si se produjo timeout ambiguo, consultar GET/resultado autoritativo antes de decidir reenvío; no crear segunda proforma ni afirmar emisión por respuesta de red perdida. No reutilizar una clave con payload diferente.

**Éxito:** solo declarar «Proforma emitida correctamente» si el servidor devolvió estado `EN_REVISION` y número real; entonces recuperar/actualizar estado local y navegar al detalle persistido. Nunca «emitida» si PUT sobre `EN_REVISION` simplemente guardó modificaciones. Error 400/403/404/409 exhibe detalle y posición; preservar datos locales, sin reload automático; para 409 permitir recuperar versión y decidir explícitamente qué cambios se conservarán. Si hay cambio de moneda sin revisión, bloquear tanto guardado como emisión (decisión PRF-05.2).

**Compatibilidad:** `ProformaDetailView.vue` mantiene `/enviar/` para BORRADOR, `/aprobar/` para EN_REVISION y gestión de adjuntos/PDF. La aprobación dispara pedido/stock mediante backend/PostgreSQL, NO el editor PRF-05. Respetar permisos y aislamientos; no añadir nuevos pasos de aprobación ni cobros, envíos o alertas.

## 6. Gestión de estado, integración PRF-04 y UX

- Mantener `lineas` como borrador local y `persisted` como último estado servidor. Evitar rehidratar con GET que destruya cambios tras error; restaurar snapshots/contexto autorizados sin conservar revisión de moneda caducada. Reactividad de componentes Vue debe reconstruirse correctamente cuando PRF-04 reemplaza el mueble en creación, sin mutar silenciosamente datos de otros ítems.
- Reutilizar contrato de `proformasService.saveIntegral/updateIntegral` y `clientService` existente; si PRF-04 introdujo `captura_asistida_id` en línea local, conservarlo por navegación, revisión, guardar, replay y editar según contrato de PRF-04. No convertir metadatos de captura en `datos_tecnicos`, no confirmar IA por otra ruta ni alterar el flujo HITL legado.
- Confirmar que cliente nuevo persiste solo en guardado integral; guardar con `emitir=false` permite cliente pendiente, emitir no. No ocultar warnings útiles de captura o campos técnicos no verificados, pero tampoco inventar requisitos de emisión ajenos al backend.
- Errores `cliente_nuevo.*`, `detalles[i].*`, `revision_esperada` y condiciones se asignan al apartado/ítem/campo correcto. Avisos del modal/guardado accesibles; Escape y cancelación devuelven foco; no animaciones que oculten datos críticos.
- No incorporar componentes gigantes de vista previa, dependencias pesadas, capturas de PDF/DOM para previsualización ni autoguardado por navegar. Optimizar render de muchas líneas y textos largos.

## 7. PRF-05.5 — Pruebas mínimas frontend + recorrido real

Ampliar pruebas existentes y añadir módulos focales `src/tests/prf05/` sin duplicar suites completas:

- `src/tests/ap3/proforma-editor.spec.ts`: navegación sin escrituras, nueva proforma cliente pendiente, conservación de estado, creación contextual, guardado único y 409.
- `src/tests/ap4/clientes.spec.ts` y componente `ClienteSelector`: búsqueda paginada, nombres similares, desambiguación, concurrencia de respuestas tardías, duplicados sugeridos no bloqueantes, usuario ajeno no visible, cliente nuevo y alternancia de modos sin perder datos.
- `src/tests/prf05/condiciones.spec.ts`: layout de cuatro filas y apilado, validez opcional/número inválido, adelanto 0/50/100, total no fiable, cambio de BOB/USD sin conversión, confirmación asociada al fingerprint, re-invalidación por descuento/precio alterado, recuperar snapshot.
- `src/tests/prf05/revision.spec.ts`: 2+ líneas (mueble con cajonera de varios componentes, silla, variante/familia pendiente), cantidades comerciales/internas distintas, atributos extra, etiquetas humanas, desplegables, subtotal y descuento, totales `null`, `TOTAL_NEGOCIADO` histórico, datos de PRF-04 corregidos, snapshot persistido frente a local, copia de resumen manual.
- `src/tests/prf05/emision.spec.ts`: CTA solo Revisar, BORRADOR/EN_REVISION diferenciados, modal cancelar→cero POST/PUT, confirmar→una solicitud `emitir=true`, envío doble no repite, modificar tras abrir modal invalida confirmación, estado retornado distinto no finge éxito, éxito EN_REVISION navega, errores 400/409 conservan cambios, timeout ambiguo recuperación correcta.
- `src/tests/e2e/fe04-proformas.spec.ts` y/o `prf05-proformas.spec.ts`: flujo crear con cliente existente → condiciones → revisar → emitir → GET real; cliente nuevo integrado; borrador pendiente que se completa; edición en revisión sin reemisión; volver desde revisión para corregir precio y condiciones; fallo 409; integridad de precios, descuentos, históricos y fichas PRF-03/04.
- `a11y` responsive: 360, 390, 768, 1024, 1440 px; claro/oscuro, foco restaurado, modal teclado, textos largos, anchos reducidos, sin overflow, etiquetas/errores/sr announcements. Verificar fila 1 título, fila 2 moneda+adelanto, fila 3 plazo+validez, fila 4 observaciones, apilado móvil en ese orden.
- **E2E real**, no solo MSW: iniciar frontend contra backend Django/PostgreSQL y comprobar GET, POST, PUT y efectos reales (persistencia de cliente, proforma, estados, no pedido ni stock en emisión). Comparar OpenAPI y tipos generados.

Los escenarios no deben omitir precio positivo de nueva línea, cero válido de descuento y adelanto, m2 fraccional/PIEZA entera, promociones del catálogo, límites del configurador 10 conjuntos/40 componentes, datos históricos y rechazo de cliente ajeno.

## 8. Gates y evidencia final

Secuencia propuesta: `T0` diagnóstico actualizado, `T1` cliente, `T2` condiciones, `T3` revisión, `T4` emisión, `T5` integración real + regresiones. Para cada entrega: diagnóstico reproducible → cambio mínimo → pruebas → diff → autorización de siguiente; no declarar completada una entrega con verificación crítica pendiente.

Ejecutar desde frontend: `npm ci`, `npm run type-check`, `npm run lint:check`, `npm run format:check`, `npm run test:unit -- --run` (confirmar sintaxis vigente), `npm run build`, `npm run test:e2e`, `npm run test:a11y`, `npm run contract:check`, `npm run test:integration` y los jobs reales de `.github/workflows/ci.yml`, más comprobación de `git diff --check`. Validar backend POST/PUT y pruebas PostgreSQL del documento `PRF_05_BACKEND.md`. No ejecutar cambios de producción.

Si hay drift de contrato backend, actualizar snapshot OpenAPI y ejecutar `npm run api:generate`, nunca editar `src/generated/api/` manualmente. Si alguna auditoría de dependencia, build o gate CI falla, informar con logs y corregir lo imprescindible para dejar el repositorio verificable, evitando refactors ajenos.

**Informe final obligatorio:** matriz de PRF-05.1–05.5 → cambios (o justificación sin cambio) → tests → resultados, capturas/evidencia de revisión/confirmación a anchos aprobados, commits por repo, PRs, verificación CI y comandos locales reproducibles. No confundir especificación aprobada con implementación realizada.

**Fuera de alcance:** PRF-06 documental y gestión posterior, modificaciones en seguridad PostgreSQL de stock o aprobación, nuevas integraciones de mensajería/cobro/tipos de cambio, reescritura del motor NLP. PRF-04 se integra mediante contrato vigente sin perder su evidencia ni información técnica.
