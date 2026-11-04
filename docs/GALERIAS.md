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
