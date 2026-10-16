# AP5 — Catálogo comercial y presentación de proformas

## Catálogo

El módulo Productos consume el contrato unificado del backend. Un administrador comercial puede registrar y editar datos generales, ficha de silla o piso y promoción. El stock no aparece como campo editable. El listado y el detalle presentan categoría, familia, unidad, promoción, precio vigente, stock, demanda pendiente, disponibilidad e imagen mediante etiquetas públicas del servidor.

La imagen opcional se carga sólo después de que el alta transaccional termina, usando el endpoint de media existente. Si la carga de imagen falla, el producto permanece válidamente creado y el error se comunica; no existe almacenamiento paralelo en el navegador.

## Integración con AP3

Desde el formulario de una línea de catálogo, `Crear producto` se muestra únicamente con `comercial.administrar`. El editor serializa temporalmente en `sessionStorage` todos sus datos locales y el paso activo. El alta o la cancelación regresan a la misma URL y restauran ese estado sin ejecutar el POST/PUT integral. Tras un alta exitosa se abre el formulario de línea con el nuevo producto seleccionado.

La copia temporal se elimina al restaurarla. No contiene tokens ni persiste en el backend. El aviso de salida normal sigue protegiendo los demás cambios no guardados.

## Líneas y presentación

- editar usa siempre el formulario completo;
- sólo un mueble a medida ofrece duplicación, mediante clonación profunda e identidad local nueva;
- eliminar antes del PUT permite una restauración local íntegra;
- los ítems de catálogo duplicados continúan enfocando la línea existente;
- el paso Revisar muestra una vista comercial obtenida del estado local, sin reservar stock, numerar, emitir ni guardar;
- el resumen se copia como texto para distribución manual, sin integración con WhatsApp;
- el detalle persistido descarga el nuevo PDF bajo demanda.

## Autoridad y exclusiones

Los totales mostrados antes de guardar se identifican como estimados. PostgreSQL calcula el resultado definitivo. La interfaz no decide promociones vigentes, permisos, stock ni aprobación. No se añadieron envíos automáticos, enlaces públicos, grupos de alternativas o conversiones de cajas/barras.

## Validación local

- TypeScript, ESLint/Oxlint y Prettier: correctos;
- Vitest: 93 pruebas;
- Playwright funcional y visual: 70 pruebas;
- accesibilidad Playwright/Axe: 23 pruebas;
- contrato OpenAPI regenerado: sin deriva;
- build productivo: correcto;
- auditoría de dependencias: 0 vulnerabilidades.

Las pruebas usan `VITE_API_BASE_URL=http://localhost:8000`, el mismo contrato explícito de CI. La evidencia remota y los SHA de merge se verifican en las ejecuciones de CI posteriores al merge.

## Auditoría correctiva AP5

El editor usa copias JSON de los datos comerciales para manejar proxies Vue sin `DataCloneError`. Conserva también la línea aún no guardada al crear un producto contextual (descripción, cantidad, precio y descuento), tanto al crear como al cancelar la creación.

Las líneas `TOTAL_NEGOCIADO` se identifican expresamente en vista previa y texto compartible. El catálogo mantiene el estado real de promociones inactivas; editar los datos del producto no las reactiva.

La ficha comercial de productos escucha cambios de ID y descarta resultados asíncronos obsoletos. Confirma navegación con cambios pendientes y muestra un conflicto 409 sin perder el formulario. Los PATCH envían `If-Match` con la `revision` recibida del backend.

Las pruebas específicas deben incluir componentes montados con datos reactivos y rutas reales, los campos que todavía no forman parte de líneas persistidas y edición de promociones inactivas. La documentación técnica y matriz de H01–H11 se conservan también en el repositorio backend. Esta fase correctiva no despliega producción.
