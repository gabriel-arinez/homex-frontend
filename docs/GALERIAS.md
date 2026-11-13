# Galerías de catálogo y muebles a pedido

El vendedor puede crear productos y gestionar las imágenes de sus productos. El administrador mantiene supervisión global. Las referencias privadas pertenecen a una línea de proforma; el jefe de taller puede consultarlas cuando existe una orden de trabajo.

## Comprobación local

Requiere Node 24 y el backend actualizado con sus migraciones aplicadas.

```bash
cd /home/gabriel/HOMEX/homex-backend
.venv/bin/python manage.py migrate
.venv/bin/python manage.py runserver 127.0.0.1:8000
```

En otra terminal:

```bash
cd /home/gabriel/HOMEX/homex-frontend
npm ci
VITE_API_BASE_URL=http://127.0.0.1:8000 npm run dev -- --host 127.0.0.1
```

Configura `CORS_ALLOWED_ORIGINS=http://127.0.0.1:5173` en el backend. Inicia sesión como vendedor: **Productos → Nuevo producto** admite imágenes opcionales, varias fotografías, portada y orden independientes. Al guardar, entra de nuevo en la ficha y comprueba el visor y sus miniaturas. Para editar datos comerciales usa **Editar datos comerciales**; la galería también permite gestionarlas directamente desde la ficha.

En **Proformas → Nueva proforma → Añadir ítem → Mueble a pedido**, el cuarto paso es **Imágenes**. Confirma la carga o avanza para cargar las imágenes pendientes. **Revisar** muestra portada y contador. Añade el mueble y guarda el borrador; vuelve a entrar para verificar sus referencias. La duplicación copia los archivos con nuevas identidades y permite eliminar una línea sin afectar a la otra.

El editor conserva la sesión y las identidades de las galerías en JSON de `sessionStorage`. Las vistas previas pendientes usan IndexedDB. Los archivos confirmados se almacenan en el backend. El guardado integral procesa las cargas pendientes antes de confirmar el éxito. Si una carga falla, conserva los archivos restantes y permite reintentar.

## Verificaciones

```bash
cd /home/gabriel/HOMEX/homex-frontend
npm run lint:check
npm run type-check
npm run build
npm run contract:check
npm run test:unit -- --run
npm run test:e2e
```

La prueba con backend real requiere una base de integración desechable, migrada, con las cuentas y catálogos sembrados:

```bash
cd /home/gabriel/HOMEX/homex-backend
.venv/bin/python /home/gabriel/HOMEX/homex-frontend/scripts/seed-fe08-backend.py
# En este backend habilitar CORS para http://127.0.0.1:4174.
cd /home/gabriel/HOMEX/homex-frontend
HOMEX_INTEGRATION_API_URL=http://127.0.0.1:8000 npm run test:integration -- galerias-real.spec.ts
```

El sembrado crea cuentas de prueba conocidas: úsalo sólo en la base desechable. La prueba entra como `gallery-e2e-seller`, sin permisos de administrador; verifica catálogo a 360/1280px y restauración/vinculación de imágenes de un mueble.

## Contrato vigente del recorrido F09

La proforma utiliza el editor unificado: después de enviarla a revisión conserva
la ruta `/proformas/{id}/editar`. La acción principal es **Aprobar**; el diálogo
mantiene **Aprobar y crear pedido** como confirmación explícita. La prueba FE08
conserva las verificaciones de pedido, recibo, bloqueo de cancelación, nota de
entrega y devolución de stock.

En una línea de mueble, **Revisar** abre la especificación existente. Después de
modificar su galería se usa **Guardar mueble**; **Agregar mueble a la proforma**
corresponde a una línea nueva o duplicada. La prueba de galería conserva la
comprobación de portada, duplicación, eliminación y persistencia tras recargar.
Al duplicar desde la revisión se abre **General** antes de cambiar el nombre.
La confirmación del pedido se identifica por su enlace **Consultar pedido**,
para distinguir el aviso persistente de la notificación temporal duplicada.

El gate de integración fija el backend `9c2661a95a142d57782772956a70e7fac382fc64`,
que consume el wheel `homex-nlp==0.1.24`; no utiliza fuentes NLP por `PYTHONPATH`.
`integration_peer_ref` permite seleccionar otra revisión explícita sin cambiar
la referencia predeterminada.

Para repetir las comprobaciones, utilizar únicamente una base PostgreSQL y un
backend de integración descartables, migrados y preparados con
`scripts/preparar_integracion_frontend_f09.py` del backend. Configurar CORS para
`http://127.0.0.1:4174` y ejecutar desde el frontend:

```bash
HOMEX_INTEGRATION_API_URL=http://127.0.0.1:8000 npm run test:integration -- \
  src/tests/integration/fe08-real.spec.ts src/tests/integration/galerias-real.spec.ts \
  --grep 'recorrido comercial completo|Galería real de mueble'
VITE_API_BASE_URL=http://localhost:8000 npm run test:e2e -- \
  src/tests/e2e/fe04-proformas.spec.ts --grep '@a11y PRF04 acciones directas'
```

El primer comando crea datos comerciales de prueba: nunca debe apuntar a una
base productiva. El segundo usa respuestas HTTP simuladas. El gate completo de
CI ejecuta además ASR, worker real, todas las categorías y comprobaciones de
persistencia; estos dos comandos focalizados no lo sustituyen.

El caso de audio FE08 comprueba la línea restaurada en **Productos** y después
el estado persistido `BORRADOR` en **Revisar**, incluida su etiqueta visible.
No presupone que la antigua vista de detalle siga disponible tras recargar.
