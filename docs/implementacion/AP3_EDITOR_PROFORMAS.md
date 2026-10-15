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
