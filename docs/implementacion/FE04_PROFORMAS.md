# FE04 — Proformas manuales

## Estado

**Implementación local completada y validada.**

Rama: `refactor/fe04-proformas-manuales`.

Punto de partida: `main` en `25cfedaa9f3914dd0aab17edf098067cc8414844`.

Contrato backend fijado: `9fac22ecc4f471237e6611b5a226532ab2a037ab`.

El snapshot OpenAPI fue reemplazado por el contrato aprobado de FE04, los tipos se regeneraron y el gate de drift quedó incorporado. No se modificaron reglas comerciales ni se inventaron IDs estructurales.

## Funcionalidad implementada

### Listado y creación

- listado paginado por backend;
- búsqueda por número, título o cliente;
- filtro mediante opciones públicas de `ESTADO_PROFORMA`;
- filtros visibles y removibles;
- estados loading, vacío, sin resultados, error y reintento;
- creación contextual desde Proformas;
- selección de cliente real o prospecto;
- BOB/USD enviados como código contractual, sin conversión del navegador.

### Detalle comercial

- resumen semántico mediante `estado_info`, `moneda_info` y `cliente_resumen`;
- edición de cabecera exclusivamente en `BORRADOR`;
- selección pública de `TIPO_ITEM`, `UNIDAD_MEDIDA` y `TIPO_MUEBLE`;
- líneas de catálogo y muebles a medida;
- edición de líneas;
- especificaciones V1 flexibles, sin imponer perfiles de mueble no definidos;
- valores totales, descuentos y promociones tomados siempre de la respuesta backend;
- `PRECIO_UNITARIO` conserva el precio por unidad;
- `TOTAL_NEGOCIADO` muestra y envía el importe exacto como autoridad de la línea;
- promoción aplicada visible mediante snapshots antes/ahora;
- controles congelados fuera de `BORRADOR`;
- envío con confirmación;
- aprobación de la propia proforma mediante el endpoint autorizado, sin capacidad ficticia adicional;
- resultado del pedido confirmado comunicado con feedback persistente;
- conflictos `409` refrescan la entidad y conservan el mensaje accionable;
- no existe acción de “desaprobar” ni cancelación inventada: después de aprobar, la cancelación pertenece al pedido en FE05.

### Imágenes por detalle

- sólo muebles a medida muestran el gestor de referencias;
- selección múltiple JPEG/PNG/WebP;
- rechazo temprano de MIME no permitido;
- previews con `blob:` únicamente en memoria;
- revocación de Object URL al confirmar o desmontar;
- subida individual `multipart/form-data` sin fijar manualmente `Content-Type`;
- estado pendiente/subiendo/error;
- sustitución de preview por `ArchivoAdjunto.url` persistida;
- listado y descarga mediante URL pública;
- eliminación con confirmación sólo mientras la proforma es editable;
- errores 400/403/409 del backend permanecen visibles;
- no se persiste Blob/Base64, key, bucket ni información de R2.

## Autoridad y precisión monetaria

El frontend no multiplica ni recalcula totales autoritativos. El caso de regresión `cantidad=3`, `importe_negociado=100.00` se representa como Bs 100,00. El precio unitario aproximado no se usa para modificar el total. Todos los valores se mantienen como cadenas decimales al cruzar el contrato y sólo se convierten para formato visual.

BOB y USD se muestran con su moneda contractual. No existe conversión ni tipo de cambio en Vue.

## Permisos y aislamiento

- las tres rutas FE04 requieren `comercial.operar`;
- un usuario sin capacidad es enviado a Forbidden aunque fuerce la URL;
- no se infieren roles desde username;
- el recurso comercial de otro vendedor se representa como `404` según el queryset backend;
- las operaciones de media ajena conservan `403` según su contrato específico;
- la aprobación usa el permiso real del vendedor y no una capacidad inventada.

## Matriz Nielsen H1–H10

| Heurística              | Aplicación FE04                                                                                                                               | Evidencia                             | Resultado            |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- | -------------------- |
| H1 — Estado visible     | Loading, guardado, subida, transición, éxito y error comunican estado; botones processing evitan doble acción.                                | Unit + E2E de ciclo completo y media. | Corregido y probado. |
| H2 — Mundo real         | Nombres públicos de estados, monedas, tipos y unidades; lenguaje “total negociado”, “enviar” y “aprobar”.                                     | Contrato generado y UI E2E.           | Cumplida.            |
| H3 — Control y libertad | Modales cancelables, retorno de foco heredado, confirmación de envío/aprobación/eliminación y navegación Volver.                              | Componentes compartidos + E2E.        | Cumplida.            |
| H4 — Consistencia       | Reutiliza PageHeader, Card, Button, Modal, ConfirmDialog, filtros, tablas y estados FE03.5.                                                   | Snapshot/regresión completa.          | Cumplida.            |
| H5 — Prevención         | Acciones ocultas o deshabilitadas por estado conocido; MIME restringido; campos numéricos con mínimos/pasos; backend continúa como autoridad. | Unit total exacto + E2E freeze/media. | Cumplida.            |
| H6 — Reconocimiento     | Estado, moneda, cliente, modo, unidad, promociones, totales y filtros permanecen visibles.                                                    | E2E y evidencias visuales.            | Cumplida.            |
| H7 — Eficiencia         | Alta directa, edición contextual, catálogos cargados una vez y flujos operables por teclado.                                                  | E2E responsive/Axe.                   | Cumplida.            |
| H8 — Minimalismo        | Nueva proforma sólo aparece en su módulo; acciones cambian con el estado; la especificación se presenta sólo para muebles.                    | Revisión manual + E2E.                | Cumplida.            |
| H9 — Recuperación       | 400/403/404/409 mantienen explicación; 409 recarga autoridad sin borrar el mensaje; errores de upload permiten reintento.                     | Unit 409 + E2E stock/tamaño/permisos. | Cumplida.            |
| H10 — Ayuda             | Hints explican total negociado, precio unitario, JSON flexible, previews y autoridad backend.                                                 | Unit de componentes + Axe.            | Cumplida.            |

No quedan hallazgos críticos abiertos.

## Pruebas FE04

Cobertura específica:

- listado, búsqueda, filtros y paginación contractual;
- creación de borrador;
- edición de cabecera y líneas;
- total negociado exacto 3 por 100;
- especificación de mueble;
- envío y freeze;
- aprobación y pedido confirmado;
- stock insuficiente/doble aprobación mediante 409 sin éxito aparente;
- multipart real y ausencia de `Content-Type` manual;
- preview efímera y revocación;
- archivo válido, MIME inválido y tamaño rechazado por backend;
- URL pública sin sesión;
- eliminación oculta/bloqueada por estado;
- media ajena 403;
- proforma ajena 404;
- usuario sin capacidad y URL forzada;
- 360, 390, 768, 1024 y 1440 px;
- light/dark, overflow global y Axe.

## Evidencia visual

- `docs/implementacion/evidencias/fe04/proforma-mobile-light.png`;
- `docs/implementacion/evidencias/fe04/proforma-desktop-dark.png`.

Las regresiones futuras escriben en `test-results/playwright/evidence/fe04/`.

## Validación local final

- TypeScript: verde;
- Oxlint + ESLint: verde;
- Prettier: verde;
- unit/component/integration: **37 passed**;
- Playwright completo: **41 passed**;
- gate a11y independiente: **12 passed**;
- build productivo: verde;
- contract drift: verde;
- auditoría de dependencias: **0 vulnerabilidades**;
- `git diff --check`: limpio.

## Riesgos y límites

- El backend no publica eliminación de líneas; FE04 permite agregarlas y editarlas, sin inventar DELETE.
- El backend sólo publica creación de especificación; una especificación existente se muestra en lectura y no se ofrece actualización inexistente.
- No existe cancelación de proforma. Tras la aprobación, cualquier cancelación se realiza sobre Pedido en FE05.

## Evidencia remota

Commit final y GitHub Actions quedan pendientes de publicación; el usuario administra commits y push.
