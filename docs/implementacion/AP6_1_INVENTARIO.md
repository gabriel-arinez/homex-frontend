# AP6.1 — Inventario operativo

## Decisión

El frontend continúa representando el inventario calculado por Django/PostgreSQL. No calcula stock, demanda, disponibilidad, ventas ni reversas y no ofrece escritura directa de movimientos.

La auditoría confirmó que el flujo comercial ya usa las reglas AP6.0 para unidades y cantidades. La brecha demostrable estaba en el historial: la tabla mostraba una cantidad sin unidad, ocultaba el pedido de una reversa porque su vínculo es indirecto y no identificaba al responsable.

## Implementación

La vista `Movimientos de stock` consume el contrato OpenAPI actualizado y muestra:

- cantidad exacta acompañada por el nombre de su unidad;
- pedido relacionado tanto para ventas como para reversas;
- identificador del movimiento original cuando existe;
- responsable con identidad entregada por backend, o `Sistema` cuando no hay actor;
- observaciones y datos de producto ya existentes.

El filtro por pedido se envía al backend; Vue no reconstruye relaciones ni filtra localmente. El servicio sigue siendo de sólo lectura.

## Preservación

- no se añadió un formulario de ajuste administrativo sin contrato aprobado;
- no se infiere `CAJA → M2`;
- no se recalculan cantidades ni totales;
- no se modifican permisos ni estados comerciales;
- no se introduce una matriz de roles en Vue;
- OpenAPI y tipos TypeScript se generan desde el backend autoritativo.

## Pruebas

Se ampliaron los fixtures de integración y Playwright para verificar unidad, responsable y pedido.
Resultados locales antes de publicar la rama:

- unit/component/integration: **98 passed**;
- Playwright funcional y responsive: **70 passed**;
- accesibilidad: **23 passed**;
- compatibilidad de release Chromium/Firefox/WebKit: **10 passed**;
- build reproducible y bundle sin secretos/sourcemaps: correcto;
- type-check, lint y formato: correctos;
- build productivo: correcto;
- OpenAPI/tipos generados y contract drift: correctos;
- compatibilidad con el commit backend AP6.1: correcta;
- `npm audit --audit-level=high`: **0 vulnerabilidades**;
- `git diff --check`: limpio.

La evidencia CI remota se añadirá después de publicar el commit.

Esta fase no autoriza despliegue productivo ni promoción de D07 RC2.
