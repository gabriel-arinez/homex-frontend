# FE05 — Pedidos, órdenes de trabajo, stock, recibos, notas y documentos

## Estado

**Implementación funcional completada / validación remota final en curso.**

Rama: `refactor/fe05-operaciones`.

Punto de partida: `main` en
`9374c2f73b5496dc79fd70dbb250ac4f645f8ec5`.

Contrato backend FE05 fijado en:

`7f1d06abc768e272e1f9f630619bff105b7bb75e`

Rama backend correspondiente:

`feat/fe05-contrato-operaciones`.

## Implementación

### Pedidos

- listado y detalle;
- estados obtenidos desde `ESTADO_PEDIDO`;
- transición enviada por código semántico;
- cancelación explícita con confirmación;
- conservación de errores comerciales `400/409` después de refrescar la autoridad;
- emisión contextual de recibo;
- emisión contextual de nota de entrega;
- ningún cálculo de stock, saldo o transición realizado en Vue.

### Órdenes de trabajo

- listado y detalle;
- estado y estado de saldo leídos directamente de
  `estado_info` / `estado_saldo_info`;
- líneas reales de la proforma aprobada incluidas en el detalle;
- sin porcentajes de avance inventados;
- descarga del documento generado por backend.

### Movimientos de stock

Ruta:

`/movimientos-stock`

Consume exclusivamente:

`GET /api/v1/movimientos-stock/`

Incluye:

- búsqueda por SKU, producto u observación;
- filtro por tipo de movimiento;
- filtro por pedido;
- filtro por producto;
- rango de fechas;
- paginación del servidor;
- nombre semántico del tipo de movimiento;
- producto y SKU;
- cantidad positiva/negativa según el movimiento real.

El frontend no publica operaciones de alta, modificación o eliminación de
movimientos. `VENTA`, `REVERSA_VENTA`, `CARGA_INICIAL` y demás efectos
siguen bajo autoridad del backend/PostgreSQL.

### Recibos

- listado y detalle;
- medios de pago desde `TIPO_PAGO`;
- emisión desde pedido `CONFIRMADO`;
- campos de cheque sólo cuando corresponde;
- importes enviados como cadenas decimales;
- anulación `EMITIDO → ANULADO`;
- sin DELETE ni edición de evidencia;
- descarga del documento real.

### Notas de entrega

- listado y detalle;
- emisión sólo desde pedido `LISTO_ENTREGA`;
- una nota representa el pedido completo;
- descarga del documento real.

### Documentos

El frontend consume los cuatro endpoints publicados:

- `GET /api/v1/proformas/{id}/documento/`;
- `GET /api/v1/ordenes-trabajo/{id}/documento/`;
- `GET /api/v1/recibos/{id}/documento/`;
- `GET /api/v1/notas-entrega/{id}/documento/`.

Las respuestas se descargan como `Blob`; Vue no reconstruye ni falsifica el
contenido documental.

## Contrato y autoridad

FE05 utiliza el snapshot de OpenAPI versionado en:

- `contracts/backend-openapi.yaml`;
- `contracts/backend-ref.txt`.

Los DTO TypeScript de `src/generated/api/` fueron regenerados desde ese
contrato.

Reglas preservadas:

- backend/PostgreSQL es autoridad de stock;
- backend valida transiciones de pedido;
- backend calcula acumulado y saldo;
- backend controla sobrepago;
- backend genera reversas;
- backend controla unicidad y momento de emisión de nota;
- frontend no simula estados, movimientos, porcentajes ni documentos.

## Permisos

Todas las rutas FE05 se protegen con:

`comercial.operar`

Esto sólo controla navegación/UX. La autorización definitiva permanece en los
querysets, permisos y servicios del backend.

## Responsive y accesibilidad

Cobertura objetivo y verificada por la suite FE05:

- 360 px;
- 390 px;
- 768 px;
- 1024 px;
- 1440 px.

Se reutilizan los componentes accesibles del design system y el gate Axe.

## Regresión específica

La cobertura FE05 comprueba, entre otros puntos:

- código semántico al cambiar estado;
- conflicto de cancelación con recibo emitido;
- refresco de autoridad después de error;
- nota sólo en `LISTO_ENTREGA`;
- anulación de recibo sin DELETE;
- importes decimales sin cálculo local;
- movimientos de stock sólo lectura;
- filtros reales del endpoint de movimientos;
- OT con líneas persistidas;
- descarga de documento de OT;
- navegación de los módulos operativos;
- ausencia de porcentajes inventados.

## Validación

Los resultados definitivos se registran únicamente después de que el HEAD final
de la rama complete todos los jobs de GitHub Actions:

- lint;
- format;
- type-check;
- build;
- unit/component/integration;
- E2E;
- a11y;
- contract-drift;
- dependency-audit.

No se considera FE05 cerrada con un gate remoto rojo.
