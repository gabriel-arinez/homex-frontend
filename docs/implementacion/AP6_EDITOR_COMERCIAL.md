# AP6 — Editor comercial y seguridad de taller

El cliente fue regenerado desde el OpenAPI AP6 del backend. Las cantidades viajan como cadenas
decimales para evitar `float`; `M2` admite cuatro decimales y las demás unidades usan paso entero.

El editor crea líneas únicamente con `PRECIO_UNITARIO`, deja visible el descuento opcional y nunca
permite editar subtotales/totales. Los históricos `TOTAL_NEGOCIADO` se muestran sin recalcular. Para
catálogo se puede escoger una variante real o una familia pendiente; esta última advierte que no
reserva stock y deberá resolverse antes de aprobación. Repeticiones y conflictos siguen siendo
autoridad del backend.

`BORRADOR` y `EN_REVISION` son editables; `NO_CONCRETADA` sólo puede reabrirse hacia `EN_REVISION` y
`APROBADA` queda en lectura. Los códigos legados continúan representándose. Las alternativas se
crean como proformas separadas.

La navegación de órdenes acepta cualquiera de `comercial.operar` o `taller.operar`. El jefe de
taller obtiene del backend catálogo resumido y ficha completa sólo para muebles; el frontend no
reconstruye precios, totales ni detalles ocultos. En HITL el total NLP se conserva como evidencia,
pero el vendedor debe ingresar el unitario comercial: no existe división/redondeo automático.

## Cierre de hallazgos de revisión

- Al seleccionar un producto de catálogo, la unidad se fija a su `unidad_stock` y el selector
  queda bloqueado para impedir una venta por una unidad distinta a la del inventario. La
  validación definitiva permanece en PostgreSQL.
- La ficha de mueble del editor trabaja con `schema_version: 2`: componentes independientes
  para mesón, estructura, cajonera, etc.; material, espesor, color, dimensiones y acabado para
  cada uno, con descripción original, accesorios incluidos y advertencias separados. Los
  campos pendientes se pueden declarar «a elección», sin inventar información.
- Una ficha existente puede editarse con PATCH mientras la proforma siga editable.
  Las aprobadas no habilitan edición. Los documentos de OT incluyen todas las líneas y
  muestran detalles técnicos sólo si el backend reconoce el rol de jefe de taller.
- `Enviar` sólo aparece en `BORRADOR`; una proforma `EN_REVISION` conserva edición
  sin proponer un segundo envío rechazado.
- Pruebas de componente y Playwright ejercitan el editor V2, la edición y el bloqueo
  de unidades asociadas al stock.
