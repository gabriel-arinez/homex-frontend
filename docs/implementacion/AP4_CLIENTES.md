# AP4 — Gestión consolidada de clientes

## Resultado

El módulo permite listar, buscar, filtrar por estado y tipo, registrar, consultar, editar, desactivar y reactivar los clientes accesibles al vendedor. Todas las colecciones usan filtros y paginación del servidor.

## Experiencia y componentes

- `ClienteFormFields` representa PERSONA y EMPRESA a partir del catálogo público `TIPO_CLIENTE`; no utiliza IDs hardcodeados.
- La alta independiente adapta la identidad, muestra errores por campo, bloquea dobles envíos y abre la ficha creada sólo tras una respuesta exitosa.
- AP3 reutiliza el mismo componente sin alterar su transacción integral, recorrido ni idempotencia.
- El listado conserva búsqueda, estado, tipo y página en la URL, y muestra la etiqueta pública del tipo.
- El detalle distingue razón social y contacto, representa campos opcionales y ofrece edición contextual.
- El tipo se presenta como inmutable. La desactivación/reactivación es una acción confirmada y separada de la edición general.
- Alta y edición protegen cambios locales frente a navegación accidental.

La autorización sigue dependiendo exclusivamente de `comercial.operar` y de las respuestas del backend. La interfaz no intenta ampliar el alcance de la cartera ni reconstruir snapshots.

## Contrato

El snapshot OpenAPI corresponde al backend AP4 y los tipos TypeScript se regeneraron. `Cliente.tipo_cliente_info` reemplaza la presentación numérica. El frontend no altera reglas comerciales ni calcula autoridad histórica.

## Evidencia local

- TypeScript, ESLint/Oxlint y formato: correctos.
- Vitest: 85 pruebas correctas, incluidas 3 nuevas de AP4.
- Build productivo y contract drift: correctos.
- Playwright: 70 pruebas correctas; cubre alta de empresa en móvil, navegación al detalle, ausencia de overflow y Axe, además de las regresiones existentes. La primera ejecución paralela agotó recursos locales; la repetición completa con un worker pasó 70/70.

No se rediseñaron catálogo, dashboard o sidebar; no se adelantó AP5 ni se modificó despliegue.
