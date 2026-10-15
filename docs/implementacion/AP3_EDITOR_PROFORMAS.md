# AP3 — Editor integral de proformas

## Resultado

`Nueva proforma` abre ahora un editor local con los apartados Productos, Cliente, Condiciones y
Revisar. La navegación no persiste registros ni pierde los datos introducidos. Las únicas acciones
de escritura son `Guardar borrador` y `Emitir proforma`.

Las proformas `BORRADOR` y `EN_REVISION` se abren desde el listado en el mismo editor integral. Las
demás conservan la vista operativa de sólo lectura y las acciones posteriores existentes.

## Comportamiento

- Productos pueden agregarse antes del cliente.
- El formulario reutiliza selectores remotos, unidades AP6, precio unitario, descuento y familias
  pendientes.
- Los muebles conservan la ficha completa `datos_tecnicos`, incluidas claves JSON adicionales.
- Un cliente nuevo permanece local hasta el guardado y viaja en el payload transaccional.
- Revisar resume productos, cliente, condiciones y total estimado; PostgreSQL conserva autoridad
  sobre el total definitivo.
- Se bloquea el doble envío, se usa una UUID idempotente y un `409` recarga el estado vigente.
- `beforeunload` y el guard de Vue Router advierten sobre cambios sin guardar.
- El diseño responde en escritorio, tableta y móvil y mantiene navegación por teclado y regiones
  semánticas.

## Contrato

El snapshot OpenAPI y los tipos TypeScript incluyen `ProformaIntegralWritable`,
`DetalleIntegralWritable` y `ClienteNuevoProforma`. No se añadieron cálculos comerciales de
autoridad en Vue.

## Verificación

- Suite Vitest completa: 82 pruebas verdes.
- Playwright: 69 escenarios funcionales, responsive y de accesibilidad verdes (la regresión completa
  también se verificó por grupos con un solo worker para descartar saturación local del navegador).
- Pruebas AP3 focales: navegación sin POST, conservación de datos y escritura explícita única.
- TypeScript y build productivo verdes. Playwright, accesibilidad, lint, formato, contrato y
  auditoría se ejecutan como gates finales.

## Fuera de alcance

No se modifican AP4/AP5, catálogo, inventario, NLP ni infraestructura productiva.

## Correcciones de auditoría H03–H10

- Los guardados de proformas existentes envían `revision_esperada` obtenida
  del GET. Ante un 409, el editor conserva sus entradas, muestra el conflicto
  y ofrece una acción explícita para descartar el borrador local y recargar.
- La edición del importe `TOTAL_NEGOCIADO` histórico queda bloqueada en
  el formulario nuevo para evitar conversiones automáticas. La línea sigue
  apareciendo en la revisión y se envía al backend sin alterar su modo.
- Tras el primer guardado se muestra «Ver detalle, aprobar y gestionar
  adjuntos». El listado ofrece «Ver detalle y acciones» para borradores y
  proformas en revisión, sin perder acceso al editor integral.
- Los adjuntos existentes se gestionan desde la vista de detalle, después
  de guardar el primer borrador (no hay ID definitivo para una línea local).
- Para nuevos clientes empresariales la emisión exige razón social y
  nombres y apellidos del contacto, conforme a la validación PostgreSQL.
  Para personas naturales también exige nombres y apellidos.
- El evento de variante duplicada cierra el modal y enfoca la línea existente
  en lugar de convertir accidentalmente la selección en otra línea.
- La vista previa sigue siendo informativa; PostgreSQL conserva el total
  monetario definitivo.

Las pruebas del editor incluyen la conservación del texto local ante 409 y
los recorridos FE04 cubren el acceso a aprobación desde el editor.
