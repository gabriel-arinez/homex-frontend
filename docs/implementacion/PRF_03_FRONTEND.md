# PRF-03 — Especificación definitiva FRONTEND: configurador integral manual de muebles a pedido (HOMEX)

**Estado funcional:** PRF-03.1–PRF-03.6 APROBADOS por el usuario (18-10-2026). **Estado de ejecución:** solo especificación, NO acredita funcionalidad desplegada ni pruebas.
**Baseline contrastada:** frontend main 5e5975c18a28ac7214395f4144a761cea8f4bf85; backend main a6eee1180b345a3b4b2ebf100a5682cf2efddc4f. Reexaminar HEAD antes de la ejecución.
**Documento par obligatorio:** homex-backend/docs/implementacion/PRF_03_BACKEND.md.
**Precedentes:** PRF_01_FRONTEND.md, PRF_02_FRONTEND.md, AP6_EDITOR_COMERCIAL.md, editor, services y componentes actuales de proformas, cliente TypeScript generado y contratos integrales.
**Fuente de ejemplos:** corpus «PROFORMAS(2).txt» proporcionado en conversación; no es fixture almacenado en el repositorio.

> PRF-03 introduce la experiencia manual completa de Mueble a pedido. Nunca crear una proforma diferente por cambiar de tipo de producto, convertir componentes en productos maestros ni escribir JSON como requisito del vendedor. PRF-04 tratará voz/NLP; PRF-06 diseño de documentos.

## 0. Realidad frontend y brecha concreta

- src/modules/proformas/views/ProformaEditorView.vue contiene borrador local, acciones comerciales, duplicación de muebles, modales separados para línea y especificación, guardado integral y recuperación/confirmación. Reutilizar sin desmantelar garantías PRF-01/02.
- src/modules/proformas/components/DetalleForm.vue valida nombre, cantidad, precio unitario, descuento, moneda/unidad y entrega DetalleProformaWritable.
- src/modules/proformas/components/EspecificacionForm.vue presenta tipo de mueble y componentes básicos, pero solicita campos JSON de «Otros atributos» y «Características generales». No constituye la experiencia manual aprobada.
- src/modules/proformas/services/proformasService.ts dispone de options(TIPO_MUEBLE), saveIntegral, updateIntegral y operaciones de detalle/especificación. Los endpoints actuales de catálogo no permiten crear nuevos tipos de mueble por vendedor ni proporcionan el diccionario técnico especializado.
- En la vista lector del editor se imprime JSON técnico; sustituirlo para muebles por una representación legible de grupos/componentes/accesorios, preservando acceso a datos históricos desconocidos.
- PRF-02 ha modificado la experiencia de catálogo. Abrir el trabajo sobre el HEAD real y respetar la lista compacta, revisión, identidad local, manejo de 409, editor único y memoria de navegación.

## 1. PRF-03.1 — Recorrido integral, sin asistente rígido

1. Desde Productos del editor de UNA proforma elegir «Mueble a pedido»; abrir **página completa de configuración manual**, no modal estrecho ni editor JSON. La creación inicia borrador local del nuevo mueble.
2. La pantalla reúne, con apartados navegables libremente: Identificación / Dimensiones generales / Conjuntos y componentes / Accesorios y observaciones / Datos comerciales / Revisar. El vendedor puede volver y avanzar sin pasos obligatorios cuando el contenido sea opcional.
3. CREAR, EDITAR y DUPLICAR emplean el mismo configurador integral; editar abre los datos completos y conserva IDs; duplicar clona profundamente sin escribir la nueva línea hasta confirmarla.
4. Confirmar «Agregar mueble a la proforma» solo actualiza lista local del editor, NO realiza POST/PUT de proforma. El único guardado en servidor sigue siendo «Guardar borrador» o la acción expresa de emisión del editor comercial, según PRF-01/02.
5. Cancelar o abandonar con cambios muestra guardia; navegación interna entre secciones no marca pérdida. El borrador técnico forma parte del mecanismo de recuperación local del editor, con identidad de usuario y protección multi-pestaña. No almacenar audio ni secretos.

### Diseño de cabecera contextual

Mantener cabecera compacta que indique nombre provisional, acción (nuevo/editar/duplicar), estado «Sin guardar», retorno a proforma y acceso a revisión. Navegación secundaria por apartados; barra de progreso opcional, pero NO convertir los apartados opcionales en barreras. En escritorio cabecera y navegación visibles; móvil navegación plegable con foco correcto.

## 2. PRF-03.2 — Identificación y medidas generales

- Nombre comercial visible/obligatorio, selector de TIPO_MUEBLE opcional; NO presentar «Descripción comercial general» ni «Solicitud original del cliente» como duplicados artificiales. Reutilizar DetalleProforma.descripcion solo si el vendedor la necesita para una descripción comercial, sin obligar a copiar el texto original. El campo técnico descripcion_original es evidencia histórica/NLP, no una segunda captura manual obligatoria.
- Tipo de mueble: combobox con búsqueda. Si no existe, opción contextual «+ Crear [nombre]», permitida a cualquier vendedor autorizado a cotizar. Enviar al endpoint **restringido solo a TIPO_MUEBLE** definido en PRF_03_BACKEND.md; ante coincidencia exacta/similar mostrar coincidencias para seleccionar, no agregar clones. Tras creación real, refrescar y seleccionar ID recibido sin perder formulario. Nunca pedir «comercial.administrar», ni usar endpoints genéricos de maestro.
- Dimensiones generales SIEMPRE sugeridas y visibles: **Ancho, Alto y Profundidad**, con unidad por campo. Son opcionales: un valor no informado permanece vacío, no cero. Botón «+ Añadir medida» busca campos como Largo, Diámetro, Lado 1/Lado 2, Altura total, ancho de mesón; se muestran solo al añadirlos. No convertir automáticamente 140x140 en «ancho 140» si la fuente no asigna ejes.
- Atributos generales dinámicos (p.ej. Configuración/Forma = En L) mediante mismo selector de definiciones, con valores ingresados por el vendedor. Distinción entre campo escogido (definición de catálogo) y valor redactado específico (JSON de ficha).
- Color general, si se conoce, no se adjudica silenciosamente a cada componente; «Según diseño»/«A elección» son valores válidos.

### Buscador dinámico: decisión visual vinculante

- **Buscador contextual por apartado/componente**, no una única barra en la cabecera o el pie de toda la página.
- En el componente ACTIVO se posiciona junto al bloque de características; queda **sticky durante el scroll del editor activo** cuando sea útil, sin tapar campos, cabecera ni teclado virtual. Al seleccionar una característica, aparece **inmediatamente en ese componente** y el buscador sigue accesible para repetir sin subir/bajar.
- Orden alfabético de opciones, búsqueda reactiva por nombre, sinónimos y normalización de tildes/caso/espacios; resultados con categoría/alias y selección por teclado. Sugerencias contextuales por tipo de componente: «cajonera» -> cajones, cierre, apertura, espesores; «estructura metálica» -> tratamiento, acabado, paso de cables, fijación. Son SUGERENCIAS DE CAMPOS VACÍOS, nunca inferencias de materiales o atributos.
- Selector no despliega de inicio el universo de opciones. Muestra sugerencias pertinentes y resultado filtrado bajo demanda. Evitar duplicar el mismo atributo dentro de la misma tarjeta; permitir mismo tipo de atributo en otras partes del mueble.
- Si no existe campo, admitir **atributo personalizado local** nombre+valor, sin crear definición global automáticamente. No depender de JSON textual. No solicitar privilegios de catálogo general.

## 3. PRF-03.3 — Componentes y conjuntos

### Componentes sin conjuntos

- Un mueble sencillo puede tener 0 conjuntos, con lista plana de componentes. Botón «+ Añadir componente» crea tarjeta expandible individual, no un modal independiente. Campos habituales: Nombre, Cantidad dentro de cada mueble, Material, Espesor, Color, Dimensiones particulares; buscador para características restantes (tapacanto, revestimiento, rieles, cierre, fijación, etc.).
- Nombre del componente obligatorio si se crea; material, espesor, color y medidas son opcionales. Cantidad interna sugerida inicialmente 1 si razonable para nuevo componente, **editable y vaciable**, no trasladarla a DetalleProforma.cantidad ni asumir como hecho en fichas importadas. Mostrar resumen legible al plegar, mantener valores durante alternancia.
- Permitir Editar (misma tarjeta), Duplicar (copia profunda), Quitar con opción Deshacer, Subir/Bajar por controles accesibles sin exigir drag-drop. Ninguna operación persiste antes de confirmar/guardar proforma.

### Conjuntos opcionales

- «+ Añadir conjunto» crea una agrupación de **un nivel**, con nombre libre y lista de componentes. «Conjunto principal» y «Conjunto complementario» son ejemplos, NO opciones de tipo obligatorias. Se pueden crear varios conjuntos descriptivos; no hay conjuntos dentro de conjuntos.
- Cada conjunto tiene botón interno «+ Añadir componente». El botón global añade a la lista sin conjunto (cuando exista) o al conjunto activo de forma explícitamente indicada, y el vendedor puede «Mover a conjunto» de una tarjeta existente sin perder atributos.
- **No abrir otro conjunto mientras exista uno vacío** (sin componentes). Enviar bloqueado hasta eliminar o llenar conjunto. **No abrir otro componente mientras exista uno sin nombre**; se puede quitar el vacío sin obligar a inventar datos.
- Límites iniciales aprobados: **10 conjuntos por mueble, 40 componentes en TOTAL** (sumando todos los grupos y piezas sin grupo). Reutilizar límites devueltos por backend o contrato compartido; no divergir del servidor. Indicador discreto como «2/10 conjuntos» y «4/40 componentes»; al llegar al máximo, deshabilitar añadir con explicación. Los números son protección inicial, configurables en un punto único.
- Reordenamiento/movimiento mantiene UID de componente y su ficha técnica; borrar un conjunto con componentes debe pedir decidir mover sus piezas a «Sin conjunto» u otra agrupación, o cancelar (NO eliminación implícita de sus componentes).

### Cantidades distintas

- «Cantidad por mueble» NO es «Cantidad cotizada». Ejemplo: 6 veladores comerciales con 2 cajones cada uno; o 1 JUEGO de sillones con 2 laterales, 2 centrales y 6 almohadones. No calcular/desglosar ni modificar el precio comercial automáticamente.
- Si el dato original describe «2 divisiones por puerta» y «4 puertas», conservar la dependencia textual si no hay una representación inequívoca; no multiplicar ni asignar números fabricados.
- Las medidas de cada parte son independientes de las globales. Una secuencia de valores cuyo eje no está identificado («33x40x63 cm») se conserva tal como está o se aclara en observaciones; no se invierte ni autocompleta.

### Almacenamiento

Usar el JSON aditivo convenido en PRF_03_BACKEND.md: datos_tecnicos.conjuntos[] con uid/nombre, componentes[] con uid, conjunto_uid opcional, cantidad_interna, básicos y atributos[]. Los campos históricos se conservan aunque no se representen por un control nuevo. No pedir «schema_version». Campos extra JSON anteriores no se pierden al editar material, color o mover de conjunto.

## 4. PRF-03.4 — Accesorios y observaciones

- Apartado «Accesorios incluidos» bajo componentes: lista editable de descripciones de texto, una fila por accesorio, «+ Añadir accesorio», quitar/deshacer; impedir otro vacío simultáneo. Mostrar cantidad incluida en la descripción si aparece (p.ej. «6 almohadones de 0,45 x 0,45 m»).
- Componentes como cajonera, mesón o estructura no deben duplicar herrajes que ya se describen en «Características del componente». El vendedor decide dónde describir el dato concreto; no copia automática entre campos.
- Campo permanente «Observaciones» de texto libre para faltantes, ambigüedad, alternativas por decidir y excepciones. No bloquear la proforma por falta de medidas opcionales ni por «A elección».
- Mostrar y preservar advertencias históricas/pedidos de confirmación bajo una subsección contextual de información pendiente, sin inventar otro campo obligatorio ni borrar datos_tecnicos.advertencias. Preservar asimismo descripcion_original oculto del flujo manual cuando exista, sin obligar a reescribirlo.
- Evitar una línea comercial adicional, SKU, stock, producción automática o precio por accesorio.

## 5. PRF-03.5 — Datos comerciales, revisión y confirmación

El bloque comercial es parte del MISMO configurador: cantidad comercial + unidad PIEZA/JUEGO + precio unitario negociado + descuento **monetario total de línea** + total estimado de solo lectura en moneda de la proforma. Nada de subtotal creado desde atributos; conservar reglas PRF-02 para moneda, descuento, históricos, estimación vs autoridad PostgreSQL.

### Revisar mueble (antes de incorporar)

- Vista de lectura por apartados: identificación/tipo, dimensiones generales, color/atributos globales, conjuntos expandibles, todos los componentes y sus valores, accesorios, advertencias/observaciones, cantidad/unidad/precio/descuento/total estimado. No imprimir JSON crudo como experiencia principal.
- Mostrar explícitamente «Dato no especificado» únicamente cuando aporte comprensión y sin sobrecargar; no inventar números. Desde cada sección «Editar» vuelve al lugar/campo en el configurador sin perder scroll/foco ni borrador.
- Distinguir errores bloqueantes de pendientes informativos:
  - Bloquear: nombre comercial vacío, cantidad inválida, unidad distinta de PIEZA/JUEGO, precio unitario de nuevo ítem <=0, descuento inválido, componente con nombre vacío, grupo sin componentes/nombre, límite 10/40 excedido, campo dinámico añadido sin valor final ni retirado.
  - Permitir: componentes o grupos opcionales ausentes, falta de dimensiones no informadas, color «A elección», observaciones sin resolver, advertencias heredadas preservadas.
- Presentar mensajes por campo y resumen enlazado al error; no resetear formulario ni borrar estado.
- «Agregar mueble a la proforma» confirma **solo línea local**. Regresa a Productos con su fila compacta, sin POST/PUT de proforma. «Guardar borrador»/«Emitir» del editor conserva flujo y review guard existente.

### Editar y duplicar

- Editar vuelve al configurador completo, conserva id/localId y ficha profunda; guardar reemplaza únicamente la línea local existente.
- Duplicar abre configuración clonada profunda e independiente. Comparar todo lo visible y subyacente: DetalleProforma + tipo_mueble + datos_tecnicos + observaciones, no solo campos de DetalleForm. Una variación de espesor, atributo, conjunto o accesorio hace a la copia distinta.
- Si realmente idéntica, advertir y ofrecer aumentar cantidad de línea original con confirmación expresa; no insertar clon. Si difiere, agregar nueva línea local con ID nuevo, sin reapuntar la original.
- Cancelar con cambios alerta; deshacer de componentes y eliminaciones de líneas son ámbitos distintos. No romper el historial de varias eliminaciones/undo acordado PRF-02 ni fichas de otras líneas.
- Proforma APROBADA y fichas bloqueadas: mostrar modo solo lectura, sin botones que intenten violar la DB.

## 6. Flujo completo real de la fuente

### Caso A — VELADOR 2 CAJONES (líneas 95–97 del corpus)

1. Nombre VELADOR 2 CAJONES; dimensiones globales 0,45 m ancho, 0,45 m profundidad, 0,60 m alto.
2. Componente «Cuerpo» como agrupación organizativa sugerida, material melamina 18 mm, tapacanto PVC. Componente «Cajones» cantidad 2, rieles telescópicos. Color según diseño.
3. Sin conjuntos obligatorios ni accesorios inventados.
4. Comercial: 6 PIEZA, Bs 750, total estimado Bs 4.500. La cantidad interna 2 no sustituye el 6 de la línea.

### Caso B — ESCRITORIO EN «L» CON CAJONERA RODANTE (líneas 149–150)

1. Tipo mueble opcional seleccionado del catálogo, o creado con permisos restringidos. Configuración/Forma «En L». Medidas informadas 140x140 cm y altura 73 cm; no mapear arbitrariamente cada lado al ancho/profundidad.
2. Conjunto «Escritorio»: tapa superior MDP 25 mm con revestimiento melamina y tapacanto PVC fusionado; estructura acero SHAFT con tratamiento anticorrosivo, pintura epoxi, paso de cables y MINIFIX; paneles frontales MDP 18 mm, revestimiento/tapacanto/fijación.
3. Conjunto «Cajonera rodante»: componente 33x40x63 cm sin ejes identificados, MDP, tapa 25 mm/laterales 18 mm, cuatro cajones, cavidades sin jaladores y traba con llave. Zapatas regulables como accesorios incluidos.
4. Observaciones conservan literalmente «Profundidad en mesada en 60,50» y alternativa de dos cerraduras por pares o cierre de cuatro cajones; no decidirlas. Color general olmo con blanco sin adjudicarlo automáticamente a cada panel.
5. Comercial: 2 PIEZA, Bs 2.500 por unidad, total estimado Bs 5.000; un solo detalle + ficha.

### Caso C — MESA SALA DE REUNIONES (líneas 1–2)

- Diámetro 2,00 m, altura total 0,75 m; tablero melamina 25 mm, patas y estructura perfil metálico 50x50x1 mm; colores «A elección».
- Accesorios: caja eléctrica con 2 USB, 2 HDMI y 2 tomacorrientes, topes de goma. No atribuir número de cajas si fuente no lo dice.
- Comercial: 2 PIEZA x Bs 7.300 = Bs 14.600.

### Caso D — SILLONES SALA DE ESPERA MODULAR (líneas 17–18)

- 1 JUEGO a Bs 12.000; conjunto de 2 sillones laterales (izquierdo/derecho) + 2 centrales. 6 almohadones 0,45x0,45 m. Materiales/tapizado/rellenos del conjunto según original, no adjudicarlos automáticamente a una subpieza concreta.
- Cantidades internas y agrupaciones opcionales no crean cinco líneas comerciales.

### Caso E — VITRINA TIPO 6 (líneas 161–162)

- 8 PIEZA x Bs 29.800 = Bs 238.400. Dimensiones 3,40 m ancho x 0,60 m profundidad x 2,30 m alto; estructura metálica, melamina 18 mm, repisas/divisiones engrosadas a 36 mm, vidrio templado 8 mm, puertas corredizas/chapa frontal.
- Registrar componentes con dimensiones/atributos verdaderos y observaciones donde el texto no desglose cantidades.

Todos los casos son para pruebas y explicación del flujo; nunca insertar automáticamente sus valores al iniciar una cotización vacía.

## 7. Gestión de estado y protección antirregresión

- Modelos de estado tipados de Vue/TS; adaptación de/especificacion backend centralizada y testeada; conservar referencias, arreglos y objetos extra desconocidos (deep clone y deep merge responsable). Separar UID técnico de ID/ localId comerciales.
- Datos comerciales y especificación forman una unidad lógica de edición sin POST técnico intermedio. Al volver de crear TIPO_MUEBLE se preservan nombre, medidas, atributos, conjuntos, partes, accesorios, importes, estado local, contexto cliente, moneda, ruta y recuperación vigente.
- No dejar que SELECT de tipo, búsqueda de atributo o botones de expandir disparen guardados remotos. Evitar múltiples POST por doble clic en nuevo tipo (bloquear en vuelo; servidor idempotente/único).
- Guardias de salida/navegación, recuperación local por usuario, escenarios de refresh/reload y 409; no reemplazar cambios locales por respuesta obsoleta; conservar propietario, revisión y lineas ya existentes.
- Mantener lista compacta y lectura detallada de PRF-02. Clic en línea abre lectura; menú ⋮ mantiene editar, duplicar mueble y eliminar; edición abre página completa; no introducir acciones sin conexión real.
- Reutilizar componentes visuales, tokens, validación y API cliente, no construir un design system paralelo. Errores 401/403/404/409 correctos, feedback accesible y vuelta segura.

## 8. Accesibilidad y diseño responsive

- Desktop: bloques plegables con resumen, contexto claro, buscador sticky **solo para el componente activo**, sin tapar navegación ni campos. Scroll independiente únicamente si es necesario; no convertir cada componente en un contenedor estrecho.
- Móvil/tableta: controles de ancho completo, campo de búsqueda próximo al elemento, sticky adaptado o comportamiento alternativo no superpuesto al teclado; zonas táctiles suficientes, no overflow horizontal.
- Focus visible, orden de tabulación lógico, Escape/cierre de búsqueda, Enter/opciones accesibles, anuncios de añadido/eliminado/error, mensajes asociados, accesibilidad de reordenar sin arrastre, restaurar foco tras eliminar/undo.
- Evitar grandes listas desplegables de campos. Ordenar por nombre, filtrar por palabras similares/sinónimos, categoría y sugerencias por contexto. No ocultar campos ya llenados por cambios de búsqueda.

## 9. Pruebas PRF-03.6 y evidencias

| Módulo | Aceptación requerida |
|---|---|
| Entrada | «Mueble a pedido» abre configurador completo; sin micrófono; volver sin pérdidas |
| Dinámicos | búsqueda alfabética + alias, atributo local, sin duplicar, sticky sin scroll excesivo |
| Medidas | opcionales, campo adicional, unidades y literal ambiguo no convertidos |
| Conjuntos | 0–10 conjuntos, 0–40 componentes globales, no nuevos vacíos, mover sin pérdida |
| Componentes | cantidad interna, detalles, expandir, duplicar independiente, reordenar, quitar/deshacer |
| Accesorios | textos no vacíos, un vacío simultáneo, observaciones/advertencias se conservan |
| Comercial | PIEZA/JUEGO, precio/moneda/descuento, total estimado, sin POST al confirmar local |
| Edición | id/localId estables, JSON desconocido preservado, tipos creados sin borrar draft |
| Duplicación | detectar diferencia en SOLO atributo técnico, copia real independiente, idéntico avisa |
| Resiliencia | cierre sin guardar, cambio de ruta, refresh, fallo de red, 409, multi-pestaña |
| Regresiones | catálogo PRF-02, lista/modales, otros tipos, aprobadas, PDF, documentos, NLP |
| Corpus | cinco casos reales de sección 6, captura + revisión + guardado + reapertura |

Ejecutar Vitest/unit/component para composables y adaptadores; E2E Playwright/Cypress según harness real y backend PostgreSQL según CI actual; TypeScript/generación cliente, lint/formato/build y accesibilidad con tamaños 360/390/768/1024/1440. Guardar evidencia de resultados, no solo capturas de diseño.

## 10. Secuencia de implementación para Codex

1. Verificar HEAD y avances reales de PRF-02; inspeccionar rutas, editor, formulario técnico, servicios, cliente generado, reglas de sesión, tests y design system. Comparar con baseline antes de editar.
2. Acordar/implementar primero contrato backend para GET atributos, POST tipo y JSON técnico validado; regenerar OpenAPI/TS, **sin inventar endpoints** ni asumir shapes.
3. Construir adaptador técnico de lectura/escritura con roundtrip de legado, clonación profunda y preservación de extras; probar antes de montar UI.
4. Integrar ruta de configurador integral y su estado local en editor PRF-02, manteniendo ida/vuelta, create/edit/duplicate.
5. Implementar campos generales, buscador sticky contextual, conjuntos/componentes, accesorios y observaciones; validación por campos.
6. Incorporar revisión completa, edición y duplicación con comparación técnica profunda y confirmación local.
7. Ejecutar suites, E2E cinco casos, accesibilidad/responsive, checks de contrato y CI con backend real. Corregir defectos antes de solicitar aceptación; entregar diff, commits, PRs y comandos exactos de verificación.

**Resultado exigido:** cualquier vendedor autorizado configura y cotiza muebles reales manualmente, sin JSON visible, sin datos inferidos, con un único detalle+ficha y sin pérdida de contexto ni regresiones de PRF-02. La aprobación funcional de PRF-03 NO equivale a aceptación de su implementación.
