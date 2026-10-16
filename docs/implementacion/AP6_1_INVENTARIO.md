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

## Complemento AP6.1 — cierre de auditoría independiente

Se mantiene la autoridad del backend para asociar pedidos al inventario:
sólo `REVERSA_VENTA` hereda el pedido de su movimiento original.
Un `AJUSTE` que utilice la venta como referencia sigue mostrándose
**sin pedido relacionado**.

La ampliación E2E distingue explícitamente:

- reversa de `M2` con cantidad decimal, pedido original y referencia;
- movimiento sin responsable, identificado como `Sistema`;
- ajuste referenciado sin pedido comercial heredado;
- producto de piso histórico con unidad `CAJA` intacta, sin convertir
  ni etiquetar la cantidad como `M2`.

La revocación `UPDATE(productos.stock)` y el disparador privilegiado
se implementan exclusivamente en backend/SQL. El frontend conserva su
comportamiento de lectura. Estas evidencias se ejecutan en entornos de
prueba; no autorizan promoción a producción.

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

Evidencia remota:

- commit funcional: `9fc5935bf4ab3cacafb84aece6667ba148f1114b`;
- commit coordinado actual: `f36da69dbab479e4c6248cfc1bf9960a241329c0`;
- backend contractual: `708e872c9fac6f1e947b389c5a6ceaf3de74e90a`;
- GitHub Actions PR run `38835325142`: **todos los jobs verdes**, incluida la integración real.

Los dos runs anteriores fallaron antes del checkout porque ECR respondió `toomanyrequests` al
inicializar PostgreSQL. El job quedó estabilizado usando las imágenes oficiales de Docker Hub que ya
emplea el backend; no cambió código ni comportamiento de HOMEX.

Esta fase no autoriza despliegue productivo ni promoción de D07 RC2.
