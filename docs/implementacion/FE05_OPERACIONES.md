# FE05 — Pedidos, órdenes de trabajo, recibos y notas

## Estado

**Implementación local completada para el contrato backend publicado.**

Rama: `refactor/fe05-operaciones`.

Punto de partida: `main` en `9374c2f73b5496dc79fd70dbb250ac4f645f8ec5`.

Contrato backend fijado: `9fac22ecc4f471237e6611b5a226532ab2a037ab`.

## Implementación

- listado y detalle de pedidos;
- nombres comerciales de estados resueltos desde `ESTADO_PEDIDO`;
- cambio de estado enviado como código y validado por backend;
- cancelación explícita con confirmación y recarga de autoridad;
- conservación del mensaje comercial después de errores 400/409;
- emisión de recibo desde pedido `CONFIRMADO`;
- medios de pago obtenidos desde `TIPO_PAGO`;
- campos de cheque visibles sólo para el medio correspondiente;
- decimales enviados como cadenas, sin recalcular saldo en Vue;
- emisión de nota exclusivamente cuando el estado conocido es `LISTO_ENTREGA`;
- listados y detalles de órdenes de trabajo, recibos y notas de entrega;
- anulación `EMITIDO → ANULADO`, sin edición ni DELETE;
- navegación y rutas protegidas por `comercial.operar`;
- responsive, teclado y accesibilidad en 360, 390, 768, 1024 y 1440 px;
- ningún porcentaje de progreso inventado.

## Límites contractuales verificados

El OpenAPI fijado no publica endpoints de movimientos de stock ni recursos de visualización/descarga para proforma, OT, recibo o nota. Tampoco publica líneas dentro de `OrdenTrabajo`. FE05 no crea rutas, botones, DTO ni llamadas ficticias para esas capacidades. Se incorporarán cuando `homex-backend` las publique y el snapshot contractual sea aprobado.

Las listas FE05 vigentes son arrays sin parámetros de búsqueda, filtros ni paginación. El frontend no simula paginación de servidor. El filtro visual de pedido trabaja únicamente sobre la colección autorizada que entrega el endpoint actual.

## Reglas comerciales preservadas

- Vue no calcula stock, saldo, acumulado, transición válida ni reversa;
- cancelar puede ser rechazado cuando existe un recibo `EMITIDO`;
- un recibo erróneo se anula y conserva evidencia;
- no existe DELETE de recibos;
- la nota no se crea al aprobar la proforma;
- una nota corresponde al pedido completo;
- el backend continúa como autoridad ante concurrencia y conflictos.

## Matriz Nielsen

| Heurística | Aplicación                                                        | Evidencia            |
| ---------- | ----------------------------------------------------------------- | -------------------- |
| H1         | loading, processing, éxito y error visibles                       | Unit + E2E           |
| H2         | estados y pagos con nombres de catálogo                           | MSW + E2E            |
| H3         | confirmación de cancelación, anulación y nota                     | Componentes + E2E    |
| H4         | patrones compartidos de tablas, cards y diálogos                  | Snapshot + regresión |
| H5         | acciones contextuales por estado conocido y doble envío bloqueado | Unit                 |
| H6         | pedido, proforma, saldo y estado permanecen visibles              | E2E                  |
| H7         | navegación directa entre documentos relacionados                  | E2E                  |
| H8         | sin porcentajes, documentos ni acciones inexistentes              | Unit + E2E           |
| H9         | 400/409 explican el bloqueo y recargan autoridad                  | Unit                 |
| H10        | textos breves explican cancelación, anulación y nota              | Revisión versionada  |

## Validación local

- TypeScript: verde;
- Oxlint + ESLint: verde;
- Prettier: verde;
- unit/component/integration: **47 passed**;
- Playwright: **51 escenarios**;
- gate a11y: **17 escenarios**;
- build: verde;
- contract drift: verde;
- auditoría de dependencias: sin vulnerabilidades reportadas;
- `git diff --check`: limpio.

## Evidencia remota

Commit final y GitHub Actions quedan pendientes de publicación; el usuario administra commits y push.
