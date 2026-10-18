# PRF-01 — Especificación integral frontend: fundamentos de la experiencia comercial HOMEX

**Estado:** ocho puntos PRF-01.1–PRF-01.8 definidos y aprobados; aún no implementados ni verificados como fase.  
**Repositorio:** homex-frontend. **Rama de referencia:** `main`.  
**Línea base inspeccionada:** `b67b64c8e35d824cc64032bd471ba51f425d1df9` (16-10-2026 UTC). Revalidar en el checkout de Codex.  
**Documento complementario autoritativo:** `gabriel-arinez/homex-backend/docs/implementacion/PRF_01_BACKEND.md` (commit `9761b1de0ccef37efbe0c02a2dbbfa327822e525`).

## 1. Intención de negocio e interpretación obligatoria

HOMEX debe disminuir el tiempo y esfuerzo para elaborar cotizaciones y convertirlas en información comercial y de taller confiable. No construir otro sistema: aprovechar AP3–AP6.1 y mejorar la interfaz utilizada realmente por el vendedor.

**PRF-01 no es toda la «mesa de cotización».** Es su cimiento: jerarquía visual, aprovechamiento del espacio, formularios, lenguaje comercial, validación preventiva, estados y mensajes, presentación íntegra de datos y ausencia de regresiones. No anticipar sin autorización PRF-02 (catálogo), PRF-03 (muebles a medida), PRF-04 (captura/NLP/HITL), PRF-05 (cliente y formalización) ni PRF-06 (gestión documental e integración). El flujo comercial integrado se completará mediante esas fases futuras.

Prioridades ordenadas: (1) reglas comerciales y datos, (2) velocidad de respuesta y simplicidad, (3) accesibilidad y operación sin fricción, (4) coherencia visual. La estética no justifica más pasos, librerías pesadas o lógica duplicada.

## 2. Diagnóstico confirmado del código antes de implementar

El frontend utiliza Vue 3 + TypeScript, Vite, Vue Router, Pinia, componentes internos y estilos con variables CSS. Los componentes y rutas existentes se reutilizan; no migrar a Tailwind, otro framework ni un nuevo kit gráfico sólo para PRF-01.

Puntos de entrada y zonas sensibles:

- `src/modules/proformas/views/ProformaEditorView.vue`: editor integral de cuatro apartados (Productos, Cliente, Condiciones, Revisar), guardado local, borrador y emisión; acciones de líneas y vista previa.
- `src/modules/proformas/views/ProformasListView.vue` y `ProformaDetailView.vue`: catálogo de proformas, acceso a editor, estados y acciones posteriores; conservar funcionalidades.
- `src/modules/proformas/components/DetalleForm.vue`, `ProductoSelector.vue`, `EspecificacionForm.vue`, `ClienteSelector.vue`, `AdjuntosDetalle.vue`.
- `src/modules/proformas/services/editorLocal.ts` y `proformasService.ts`: almacenamiento contextual, deshacer, integración de solicitudes.
- `src/modules/clientes/components/ClienteFormFields.vue` y `src/modules/productos/`: formulario contextual y preservación al salir a crear un producto.
- `src/shared/ui/`, composables compartidos, tokens CSS y diseño de layout.
- `src/tests/ap3/proforma-editor.spec.ts`, `src/tests/fe04/ap6-correcciones.spec.ts`, `src/tests/e2e/fe04-proformas.spec.ts`, `src/tests/e2e/fe06-capturas-hitl.spec.ts` y `src/tests/e2e/fe01-responsive.spec.ts`.
- `contracts/backend-openapi.yaml` y `src/generated/api/`: snapshot contractual y tipos generados, nunca mutar manualmente.
- Documentación previa: `docs/implementacion/AP3_EDITOR_PROFORMAS.md`, `AP6_EDITOR_COMERCIAL.md`, `FE01_DESIGN_SYSTEM.md` y `FE03_5_USABILIDAD_NIELSEN.md`. Contrastarlas con código actual.

**Brechas de presentación observadas para revisar sin prejuzgar cambios:** la vista preliminar del editor usa `Number(valor || 0)`, susceptible de hacer indistinguible una entrada pendiente de un cero; el resumen puede mostrar identificador de cliente en vez de una denominación comercial; los importes locales no son autoritativos; el editor concentra pasos, modales y tarjetas con disposición limitada. Estas son señales de trabajo, **no permiso para reescribir el contrato**. Confirmar los escenarios en pruebas.

## 3. PRF-01.1 — Fundamentos visuales y línea base

**Objetivo:** experiencia clara y consistente, sin cambio de arquitectura.

- Registrar antes de modificar: capturas y comportamiento de vistas afectadas en escritorio, tableta, móvil, modo claro/oscuro, textos largos, muchas líneas, vacíos, errores y operaciones en curso.
- Revisar jerarquía: cabecera de proforma, estado persistido, acciones, contenido principal, ayuda contextual, resumen y totales; organizar para que el vendedor encuentre lo importante sin saltos innecesarios.
- Reutilizar componentes y tokens existentes (tipografía, escalas, espacios, bordes, estados y contraste); cambios generales a `src/shared/ui` sólo si benefician a sus consumidores sin romperlos.
- No presentar el sistema como JSON, identificadores internos, estructuras de API ni referencias a PostgreSQL.
- No alterar endpoints, rutas, estados, permisos, escritura o documentos al mejorar presentación.
- Aceptación: consistencia entre listado/editor/detalle y pantallas relacionadas sin degradar accesibilidad ni introducir navegación artificial.

## 4. PRF-01.2 — Responsividad, densidad y aprovechamiento del espacio

**Objetivo:** aprovechar de verdad el escritorio y conservar una experiencia operable al reducir el viewport.

- Revisar contenedores globales del layout: evitar ancho máximo estrecho impuesto al editor en monitores amplios; mantener legibilidad y jerarquía sin aumentar artificialmente huecos.
- En escritorio, distribuir formularios, líneas y revisión usando columnas adaptables cuando aporte eficiencia. Una lista larga no debe forzar tarjetas excesivamente altas si una disposición más compacta y accesible funciona.
- En tableta, reorganizar columnas sin solapamientos. En móvil, apilar campos, mantener acciones alcanzables y evitar desplazamiento horizontal del documento.
- Navegación de etapas, títulos largos, tablas, selects, estados y pie de acciones deben acomodarse sin cortar controles ni tapar contenido por cabeceras/footers sticky.
- Probar anchos al menos 360, 390, 768, 1024 y 1440 px, así como zoom y escalado de texto relevantes. No codificar valores rígidos donde existan alternativas fluidas.
- Los diálogos existentes deben poder abrirse y cerrarse por teclado; foco, desplazamiento, overlay y recuperación de la interacción quedan intactos.
- No incorporar librerías de grillas, virtualización o animación sin medir necesidad; preservar tiempo de interacción y peticiones.

## 5. PRF-01.3 — Sistema consistente de formularios

**Objetivo:** escribir y corregir rápido, con campos reconocibles y reglas visibles.

- Priorizar `TextField`, `Select` y componentes internos con etiqueta persistente visible, ayuda corta, obligatorio/opcional contextual, estado disabled real, error cercano y asociación accesible por `aria-describedby`, `aria-invalid` y foco.
- Ordenar campos según secuencia mental del vendedor; agrupar datos comerciales relacionados. No sacrificar datos existentes ni inventar campos.
- Mantener los valores editados al navegar entre apartados, corregir errores, cerrar un conflicto o realizar creación contextual autorizada de producto.
- Validar formato conforme a tipo: cantidades, precio unitario, descuento, moneda, validez, porcentaje, clientes y opciones de catálogo; aplicar precisión y unidad que fija el backend.
- Los campos opcionales quedan distinguibles de datos todavía pendientes. Los placeholders jamás reemplazan etiquetas ni validaciones.
- Formularios extensos requieren agrupación lógica y guías breves; evitar popups innecesarios. No convertir la ficha técnica en un objeto JSON obligatorio para el vendedor.
- Los errores concretos del backend deben mapearse al campo correcto cuando exista clave reconocible, con un resumen general para errores no vinculados a campos.

## 6. PRF-01.4 — Lenguaje comercial directo y consistente

- Usar terminología comprensible: proforma/cotización, producto, mueble a medida, ficha técnica, precio unitario, descuento, cantidad, cliente, condiciones, borrador, emitir, pendiente, total estimado, total confirmado.
- Mantener etiquetas coherentes en editor, listado y detalle. No renombrar códigos de estado/API, enum, serializadores ni claves para modificar palabras visibles.
- Explicar el efecto de acciones sensibles antes de ejecutarlas, evitando lenguaje técnico, ambigüedad y mensajes alarmistas.
- No mostrar `null`, `undefined`, `NaN`, IDs de cliente como si fueran su nombre, «JSON válido» como instrucción primaria al vendedor, detalles de PostgreSQL, trazas o códigos HTTP sin traducción funcional.
- Cuando una funcionalidad todavía no automatiza un proceso, no prometerlo: compartir resumen es una copia manual, no un envío por WhatsApp.
- Para datos complejos, la UI presenta etiquetas humanas, componentes y atributos legibles; conservar el valor estructurado en memoria y payload.
- No traducir mensajes de error de forma que oculten su causa o resulten engañosos.

## 7. PRF-01.5 — Validaciones preventivas esenciales

Aplicar prevención en el punto de entrada y nuevamente antes de un guardado/emisión cuando corresponda, **sin reclamar autoridad del backend**.

| Dato/acción           | Comportamiento UX esperado                                                                                                                             |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Nueva línea comercial | No incorporar una línea nueva al borrador local con cantidad inválida o sin precio unitario numérico **mayor que cero**; explicar el campo específico. |
| Descuento             | Cero es válido. Rechazar negativos, formatos inválidos o cifras fuera de la regla vigente, sin aplicar un descuento automáticamente.                   |
| Cantidad y unidad     | Respetar unidad vinculada a variante de stock; M2 fraccional según contrato, otras unidades enteras según regla actual. Sin conversiones imaginadas.   |
| Borrador              | Permitir dejar pendientes cliente o condiciones que no son obligatorios en ese estado, sin confundirlo con una línea nueva inválida.                   |
| Emisión               | Exigir cliente válido, líneas y campos de emisión que el contrato requiera; mostrar los pendientes, no sólo desactivar el botón sin explicación.       |
| Cliente nuevo         | Respetar identidad de personas y, en personas jurídicas, razón social y contacto según validación vigente.                                             |
| Catálogo              | No introducir variante duplicada en la misma proforma; guiar hacia la línea existente. Familia pendiente ≠ variante que reserva stock.                 |
| Histórico             | Proteger `TOTAL_NEGOCIADO` y valores heredados sin reconversión; mostrar lectura y restricciones pertinentes.                                          |
| Guardado              | Validaciones locales no habilitan saltar errores 400/409, permisos o cálculos del servidor.                                                            |

No forzar la creación anticipada de una proforma al abrir el formulario ni la selección inmediata de un cliente; no inventar precio si falta, ni presentar 0 como precio provisional por defecto.

## 8. PRF-01.6 — Estados vacíos, acciones, mensajes y recuperación

- Estados sin líneas, sin cliente, listas vacías, búsqueda sin resultados y carga fallida: mensajes claros + siguiente acción real, manteniendo filtros y contexto.
- Estado de guardado distinguible: editando localmente, con cambios sin guardar, guardando, borrador guardado, emitida y conflicto. No etiquetar como «guardado» antes de confirmación de servidor.
- Jerarquía de acciones: primarias (continuar o acción comercial principal) y secundarias (editar, copiar, cancelar, volver) sin confundir guardado con emisión; mantener botones correctos según estado y permiso.
- Doble clic o solicitud pendiente no debe producir dos escrituras: respetar bloqueo de envío e idempotencia. Botones processing deben ser funcionales y accesibles.
- Eliminación local de una línea: notificar que aún no está persistida y permitir `Deshacer`; evitar interpretar deshacer como restauración servidor si ya se guardó.
- Un fallo de red/validación no borra entradas; errores por campo, mensaje global y reintento coherentes. El conflicto `409` informa la concurrencia y mantiene contenido local; descartar para recargar sólo por acción explícita.
- Las confirmaciones o salidas con datos sucios deben preservar protección; la navegación contextual autorizada conserva borrador y vuelve sin eliminar texto.
- Modal y backdrop: al cerrar o cancelar una operación, restaurar foco e interacción de la página. Si cerrar causaría pérdida de edición local no persistida, prevenir o informar claramente. Sin modales anidados que bloqueen el trabajo.
- Mensajes anunciables por tecnologías asistivas; no depender únicamente del color.

## 9. PRF-01.7 — Consistencia de información comercial

**Regla principal:** representar el valor real y su procedencia. No confundir ausencia, invalidez, cero, estado provisional y persistencia confirmada.

| Caso                               | Representación requerida                                                                                  |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Precio unitario no informado       | «Precio pendiente»/campo requerido en vez de Bs 0,00; no sumar una línea indefinida como si fuera válida. |
| Precio unitario 0 para nueva línea | Valor inválido con explicación; nunca aceptar como precio de venta correcto.                              |
| Descuento explícito 0              | Dato válido, no es «pendiente».                                                                           |
| Cliente no elegido                 | «Cliente pendiente»; no mostrar `Cliente #id` como denominación cuando hay nombre disponible.             |
| Cliente en creación local          | Identificar que no fue registrado todavía; no sugerir cliente persistido.                                 |
| «A elección»                       | Opción comercial indicada expresamente; diferente de «No especificado»/campo vacío.                       |
| Familia pendiente                  | Mostrar como pendiente de concretar, sin afirmar existencia de stock reservado.                           |
| Línea histórica `TOTAL_NEGOCIADO`  | Mostrar el importe pactado sin dividirlo, reconstruir precio ni convertir el modo.                        |
| Previsualización                   | Señalar inequívocamente «estimación local» cuando corresponda; no presentarla como total confirmado.      |
| Resultado guardado                 | Mostrar la cifra que devuelve el backend/PostgreSQL y la moneda real, no inferir a partir de JavaScript.  |
| Errores/red/409                    | Conservar y diferenciar cambios locales vs versión guardada; nunca fusionar silenciosamente.              |
| Datos técnicos                     | Conservar información conocida y claves adicionales, incluso si no se editan desde el formulario actual.  |

Revisar especialmente el cálculo local en `ProformaEditorView.vue` que usa `Number(... || 0)` y `Math.max`: la UI debe distinguir líneas pendientes y resultados estimativos de cifras guardadas. No implementar una segunda autoridad de cálculo; si el total no es confiable o está incompleto, declararlo en vez de inventar uno.

Los datos estructurados se muestran con lenguaje humano y sin pérdida de información persistida; la presentación de ficha por componentes, materiales, acabados y dimensiones puede ser legible sin cambiar `datos_tecnicos` ni el contrato NLP.

## 10. PRF-01.8 — Protección del comportamiento existente

**Invariantes que bloquean la aceptación si se rompen:**

1. Entrar/salir del editor y cambiar de etapa **no genera POST/PUT** de proforma; escribir es explícito.
2. `Guardar borrador` y `Emitir proforma` continúan usando el contrato integral y `clave_idempotencia`; no duplicar solicitudes.
3. `revision_esperada` se envía para edición; ante `409` no reemplazar automáticamente el contenido local.
4. El borrador conserva líneas, fichas y valores al corregir, navegar internamente, gestionar errores y crear un producto de forma contextual.
5. Permisos y estados siguen gobernando edición, envío, aprobación y acceso de otros vendedores; mantener enlaces del editor al detalle/adjuntos/acciones existentes.
6. Nuevo catálogo utiliza la unidad de stock; variante duplicada debe enfocar la existente y no crear una nueva línea.
7. Históricos `TOTAL_NEGOCIADO`, `CAJA`, promociones, unidad M2 y descuentos no cambian semántica.
8. La ficha `datos_tecnicos` conserva atributos de raíz y por componente desconocidos; no asignar componentes inferidos desde NLP como si fueran confirmados por una persona.
9. El backend es autoridad de importes finales, aprobación, stock, pedidos y cancelaciones. La UI no declara éxito ficticio ni fabrica reservas.
10. HITL mantiene separación entre transcripción/evidencia IA y correcciones humanas; no modificar contrato externo NLP v1.
11. Creación contextual de producto y acceso a adjuntos después del primer guardado permanecen utilizables.
12. No afectar orden de trabajo, documentos PDF, movimientos de inventario ni pantallas relacionadas.

## 11. Diseño técnico y alcance por archivo

La siguiente es una **ruta de investigación y adaptación**, no una orden de modificar todos los archivos:

| Ubicación                                                                      | Revisión/intervención permitida                                                                                                                |
| ------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/modules/proformas/views/ProformaEditorView.vue`                           | Layout responsive, mensajes, visualización estado/provisional, bloqueo preventivo y claridad de acciones conservando flujo y persistencia.     |
| `src/modules/proformas/views/ProformasListView.vue`                            | Consistencia de filtros, estados, columna de cliente y acciones; preservar paginación y búsqueda.                                              |
| `src/modules/proformas/views/ProformaDetailView.vue`                           | Coherencia de etiquetas/estados y acceso a acciones; no cambiar reglas comerciales.                                                            |
| `src/modules/proformas/components/DetalleForm.vue`                             | Validaciones de precio/cantidad/descuento y ayudas; respetar productos, unidades y modo histórico.                                             |
| `src/modules/proformas/components/EspecificacionForm.vue`                      | Claridad visual y representación de campos, con preservación exacta del JSON abierto. Reorganización profunda de muebles corresponde a PRF-03. |
| `src/modules/proformas/components/ClienteSelector.vue`, `ProductoSelector.vue` | UX de selección, búsqueda, duplicados y vacíos sin alterar consulta/paginación. Rediseño integral del catálogo corresponde a PRF-02.           |
| `src/modules/clientes/components/ClienteFormFields.vue`                        | Etiquetas, ayuda y errores requeridos para la creación contextual.                                                                             |
| `src/shared/ui/` y estilos globales                                            | Sólo mejoras coherentes, accesibles y sin regresión en otros módulos.                                                                          |
| `src/tests/`                                                                   | Ampliar pruebas de componentes, UX, casos límite, accesibilidad y E2E focales.                                                                 |

Se debe preservar Vue, TypeScript, Router, Pinia, cliente generado y variables CSS existentes. No incorporar Tailwind, UI kits ni dependencias de producción salvo necesidad demostrada con medición y justificación aprobada. Priorizar cambios simples con menor carga del bundle y menor número de requests.

## 12. Secuencia de ejecución para Codex (sin reinterpretar el alcance)

**F1 — Línea base verificable.** Obtener `git status`, branch y HEAD de frontend y backend; leer ambas especificaciones y archivos reales; registrar resultados previos de lint, tipos, build, Vitest, Playwright focal y contratos, e identificar fallos preexistentes. No tocar trabajo ajeno ni usar comandos Git destructivos.

**F2 — Matriz de trazabilidad.** Para cada PRF-01.1 a .8: comportamiento actual, brecha comprobada, archivo o componente, solución mínima y pruebas objetivo. No generar una nueva fase funcional ni redefinir criterios ya aprobados.

**F3 — Implementación incremental.** Reutilizar sistema visual; trabajar primero estructura/responsividad/formularios; después lenguaje/validaciones/estados y finalmente coherencia de valores; mantener pruebas focales verdes entre pasos. No introducir persistencia implícita.

**F4 — Coordinación backend.** Contrastarlo con `PRF_01_BACKEND.md`. Si backend ya cumple, **no cambiar código backend**; si falla un caso probado, corregir con regresión mínima y contratos sincronizados. Nunca crear migraciones, endpoints o nuevas reglas sin necesidad justificada.

**F5 — Verificación previa a entrega.** Ejecutar los gates reales de cada repositorio, E2E en los viewports definidos, temas claro/oscuro, teclado, modal, zoom, importes pendientes, escritura, 409, duplicados, históricos, fichas técnicas y los recorridos adyacentes. Comparar con línea base rendimiento/interacciones con método reproducible; investigar degradaciones.

**F6 — Revisión y publicación controlada.** Examinar `git diff` y pruebas. Conservar las ramas y el flujo PR/CI que utilicen los repositorios; **no publicar a producción ni tocar Deploy/NLP**. Dejar cambios trazables, reportar commits y CI. Un gate rojo no se resuelve ocultando el test. No declarar PRF-01 cerrada sin auditoría y aceptación.

## 13. Matriz de verificación frontend obligatoria

| ID   | Caso que hay que probar                                                                                              |
| ---- | -------------------------------------------------------------------------------------------------------------------- |
| F-01 | Móvil 360/390, tableta 768 y escritorio 1024/1440: sin scroll horizontal ni botones tapados.                         |
| F-02 | Formulario navegable por teclado, foco visible, campos accesibles, errores y ayudas asociados; temas claros/oscuros. |
| F-03 | Abrir editor y pasar por las cuatro etapas: ningún POST/PUT automático, contenido local conservado.                  |
| F-04 | Crear línea con precio ausente/0/negativo/formato no válido: mensaje junto a campo, sin incorporación inválida.      |
| F-05 | Nueva línea positiva válida con descuento cero; cantidad M2 fraccional y otras unidades enteras según reglas.        |
| F-06 | Duplicar variante de catálogo: no crea segunda línea, enfoca la existente.                                           |
| F-07 | Agregar/editar/eliminar línea y `Deshacer` antes de guardar; duplicar mueble con ficha independiente.                |
| F-08 | Ficha técnica con claves raíz y atributos por componente extra: edición no elimina datos ajenos.                     |
| F-09 | Borrador sin cliente y luego emisión: primero permitido, segundo bloqueado hasta completar requisitos.               |
| F-10 | Empresa y persona natural: validaciones visibles y alineadas con backend.                                            |
| F-11 | Guardar/emisión exitosa: estado persistido, numeral, navegación y acciones de detalle/adjuntos correctas.            |
| F-12 | Errores 400/403/404/409, timeout o desconexión: información local intacta, sin éxito aparente.                       |
| F-13 | Doble clic y reintento: bloqueo UI e idempotencia, sin duplicación.                                                  |
| F-14 | Precio pendiente no aparece como Bs 0,00; descuento cero sí aparece válido; total local marcado estimado.            |
| F-15 | Histórico `TOTAL_NEGOCIADO` sin conversión ni recalcular; moneda y cantidades fieles.                                |
| F-16 | Familia pendiente y «A elección» diferenciadas de variante/stock y «No especificado».                                |
| F-17 | Cierre de modal y vuelta a la página: foco y controles operables; salidas con cambios sucios protegidas.             |
| F-18 | Crear producto desde el editor y regresar: no perder datos del borrador ni crear una proforma involuntaria.          |
| F-19 | Listado/detalle: filtros, búsqueda, paginación, acciones por estado y permisos sin regresión.                        |
| F-20 | Confirmación HITL, acceso a documentos, pedido, inventario y adjuntos: regresión de navegación/contrato.             |

## 14. Gates y evidencia (usar scripts existentes)

Ejecutar desde la raíz del frontend con dependencias instaladas:

- `npm run type-check`
- `npm run lint:check`
- `npm run format:check`
- `npm run build`
- `npm run contract:check`
- `npm run test:unit -- --run`
- `npm run test:e2e`, o suite Playwright focal más la regresión completa en el cierre, con servidores reales/mocks según configuración actual.
- `npm run test:integration` cuando el entorno frontend/backend esté configurado.
- `npm run test:a11y` y `npm run test:release` cuando su entorno sea aplicable.
- `git diff --check` y verificación explícita de no cambios en el contrato generado sin sincronización backend.

Antes de afirmar resultados de Playwright, instalar el navegador y preparar servicios según la guía del repo; distinguir fallos de entorno, preexistentes y regresiones introducidas. Comparar capturas base en 360, 390, 768, 1024, 1440; comprobar zoom/text scaling, interacción de diálogos, foco y scroll. Medir costes de render/interacción/carga antes y después en condiciones comparables; sin presupuestos de milisegundos inventados ni promesas de mejora sin evidencia.

## 15. Formato exigido de cierre para Codex

1. Estado inicial exacto de **ambos** repos y SHAs utilizados; rama, limpieza y resultados base.
2. Matriz **PRF-01.1 → PRF-01.8** con decisión implementada, archivos afectados, pruebas y resultado.
3. Detalle de cambio backend: **sin cambios justificados** o defectos reproducidos y parche mínimo con test; conservar OpenAPI actualizado si aplica.
4. Capturas comparativas reales (no simuladas) y pruebas de viewport/accesibilidad, así como observaciones de rendimiento.
5. Logs resumidos de comandos y CI, fallos preexistentes, nuevos, y pasos exactos para reproducirlos.
6. Diff y commits/PRs por repositorio, con coordinación de HEADs si se alteran contratos.
7. Lista separada de mejoras detectadas **fuera de PRF-01**, sin implementarlas ni mezclar fases.
8. Confirmación explícita de que no se cambió código NLP ni Deploy ni se promovió a producción; no se modificaron reglas ni datos históricos.
9. **No declarar aceptación final automática:** tras Codex habrá auditoría independiente y visto bueno del usuario.

### Regla final de aceptación

Un PRF-01 exitoso no es solamente más bonito: el vendedor debe identificar, capturar, revisar y guardar más fácilmente la información, sin demora perceptible adicional, sin representar valores falsos y **sin perder ninguna propiedad de negocio ya implementada**. La ampliación de catálogo, el rediseño de muebles a medida, la integración profunda del micrófono/NLP y la formalización integral quedan para las fases siguientes.

## 16. Cierre de implementación

### Trazabilidad PRF-01.1–PRF-01.8

| Punto    | Implementación                                                                                                                                                  | Verificación                                              |
| -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| PRF-01.1 | El editor prioriza contexto, estado de edición, contenido comercial y acciones; el total provisional se identifica como estimación local.                       | Playwright del flujo y capturas 390/1440.                 |
| PRF-01.2 | La composición existente se conserva sin dependencias ni requests adicionales y responde en móvil, tableta y escritorio.                                        | Viewports 360, 390, 768, 1024 y 1440; temas claro/oscuro. |
| PRF-01.3 | Los campos de línea reutilizan `TextField`, ayudas y errores asociados mediante `aria-invalid`/`aria-describedby`.                                              | Vitest de formulario y suite a11y Playwright.             |
| PRF-01.4 | La revisión muestra el nombre comercial del cliente y evita identificadores internos; los mensajes distinguen edición, guardado y conflicto.                    | E2E PRF-01 y regresiones FE04.                            |
| PRF-01.5 | Se impiden precio ausente, cero, negativo o inválido; M2 admite decimal, las demás unidades exigen entero y descuento cero sigue válido.                        | Vitest parametrizado y E2E de prevención.                 |
| PRF-01.6 | El modal protege cambios sucios, conserva valores si se cancela el descarte y expone pendientes de emisión y errores por campo.                                 | E2E de cierre, errores y recuperación 409.                |
| PRF-01.7 | Precio pendiente no se presenta como cero; descuento cero se declara válido; `TOTAL_NEGOCIADO` conserva el importe exacto; un total incompleto queda pendiente. | Pruebas puras de presentación comercial y E2E.            |
| PRF-01.8 | Se preservan guardado explícito, idempotencia, `revision_esperada`, datos técnicos abiertos, históricos y autoridad PostgreSQL.                                 | Suite completa frontend y regresión PostgreSQL backend.   |

### Evidencia visual

La evidencia es generada por Playwright sobre el build productivo:

- `docs/implementacion/evidencias/prf01/proforma-mobile-light.png`: 390 px, tema claro.
- `docs/implementacion/evidencias/prf01/proforma-desktop-dark.png`: 1440 px, tema oscuro.

La referencia anterior se conserva en `docs/implementacion/evidencias/fe04/`. No se introdujeron bibliotecas visuales, dependencias de producción ni solicitudes de red adicionales.

### Autoridad backend coordinada

La auditoría reprodujo que una línea nueva `PRECIO_UNITARIO` podía llegar con precio ausente o cero. El backend valida ahora el mismo requisito tanto en serializer como en servicio; PostgreSQL continúa calculando importes y los históricos `TOTAL_NEGOCIADO` permanecen legibles sin conversión. El contrato OpenAPI estructural no cambió.

### Resultado de gates

Línea base frontend: `6b3bd7d316bc374e41a13670985a4ecef4dd84c7`. Backend coordinado: `2d63ac00baf55d4b5d9eafc4347c471bc2eaadf3`. Resultados locales:

- unitarias/componentes/integración MSW: **104 passed**;
- Playwright funcional, responsive, visual y a11y: **73 passed**;
- type-check, Oxlint, ESLint, Prettier, contrato y build: correctos;
- `npm audit --audit-level=high`: **0 vulnerabilidades**;
- OpenAPI y TypeScript generado: sin drift.

La porción diferida del editor pasó de 18 469 a 20 910 bytes sin comprimir y de 6 645 a 7 349 bytes con gzip (**+704 bytes gzip**). No cambió el chunk inicial, no hay dependencias nuevas y la implementación no añade solicitudes de red.

Los commits y ejecuciones remotas se registran al finalizar los PR. La aceptación de esta implementación continúa sujeta a auditoría independiente y visto bueno del usuario, según la regla de esta especificación.
