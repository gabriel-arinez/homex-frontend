# FE03 — Clientes y catálogo visual de productos

## Estado

**FE03 funcionalmente cerrada y validada.**

La implementación vive en `feat/fe03-clientes-productos`. La primera versión de la fase se creó
mientras el backend terminaba el contrato de listados, por lo que fue necesario sincronizarla antes
del cierre. El frontend queda fijado al backend:

`adb949268277da4361f37c96b786c5cdd0265750`

El snapshot `contracts/backend-openapi.yaml` y los tipos de `src/generated/api/` corresponden a
ese contrato y el gate de contract drift queda verde.

## Contrato consumido

FE03 usa únicamente contratos publicados por backend:

- `GET /api/v1/clientes/`;
- `GET/PATCH /api/v1/clientes/{id}/`;
- `GET /api/v1/catalogo/productos/`;
- `GET/PATCH /api/v1/catalogo/productos/{id}/`.

Los listados ya no descargan colecciones completas para filtrarlas en Vue. El frontend envía los
parámetros soportados por OpenAPI y consume el envelope paginado
`count/next/previous/results`.

Clientes usa:

- `search`;
- `activo`;
- `page`;
- `page_size`.

Productos usa:

- `search`;
- `activo`;
- `page`;
- `page_size`.

El contrato también admite `tipo_cliente` y `categoria`, pero el backend todavía no publica un
catálogo de opciones/etiquetas estructurales para construir selectores seguros. FE03 no inventa IDs
ni mapeos semánticos en Vue.

## Clientes

- listado responsive y paginado por servidor;
- búsqueda y filtro de estado realizados por backend;
- estado de carga, error, vacío y sin resultados;
- detalle;
- edición de los clientes accesibles al vendedor, respetando que el backend aplica
  `EsVendedor` y aislamiento por propietario;
- errores de validación por campo y 403 conservados;
- `tipo_cliente` se muestra como referencia registrada cuando no existe etiqueta pública;
- no se implementa alta que requiera inventar valores estructurales no descubribles.

## Productos

- vista cuadrícula y lista;
- búsqueda y filtro de estado por servidor;
- paginación real;
- detalle;
- edición comercial sólo con `comercial.administrar`, alineada con backend;
- `precio_vigente`, stock, demanda pendiente y disponibilidad referencial se muestran como
  valores autoritativos del backend;
- stock y disponibilidad permanecen de sólo lectura;
- no se infieren promociones en el navegador: el contrato actual no expone metadatos públicos
  suficientes para etiquetar una promoción vigente;
- no se consultan `/catalogo/sillas/`, `/catalogo/pisos/` ni `/catalogo/descuentos/` desde el
  flujo de vendedor, porque esos ViewSets son administrativos;
- categoría y unidad se muestran mediante sus identificadores registrados hasta que exista un
  contrato público de etiquetas.

## Imágenes

`ProductImage` consume únicamente `Producto.imagen_principal`:

- construye `srcset` con variantes WebP;
- usa `sizes` responsive;
- usa la variante menor como `src`;
- no descarga el original como recurso normal del catálogo;
- usa lazy loading donde corresponde;
- mantiene fallback para ausencia, URL inválida y fallo de carga;
- no expone SDK, credenciales, bucket ni claves R2.

## Autorización

Las rutas de clientes y productos requieren `comercial.operar`.

La UX sigue la autorización efectiva del backend:

- un vendedor puede consultar y editar los clientes dentro de su queryset autorizado;
- la edición de producto requiere `comercial.administrar`;
- los endpoints administrativos auxiliares del catálogo no se usan para construir la vista de un
  vendedor;
- 401/403 continúan procesándose mediante el cliente HTTP compartido.

Los tests E2E modelan explícitamente un vendedor con sólo `comercial.operar` y responden 403 en
los endpoints administrativos de sillas, pisos y descuentos; además verifican que la pantalla de
productos no los llame.

## Accesibilidad y responsive

FE03 mantiene operación en 360, 390, 768, 1024 y 1440 px, sin overflow global y con Axe sin
violaciones serious/critical en los escenarios cubiertos.

También se corrigió el contraste del botón de reintento de `ErrorState` para que los estados de
error sean utilizables en tema oscuro.

## Pruebas y evidencia remota

Commit funcional corregido y validado:

`240e7580f0e6e2f368a39c3043659111162bed68`

GitHub Actions:

`36098476262` — **success**

Resultado:

- install: verde;
- type-check: verde;
- lint: verde;
- format: verde;
- unit/component/integration: `23 passed`;
- contract drift: verde;
- build: verde;
- Playwright: `20 passed`;
- dependency audit: cero vulnerabilidades reportadas.

La suite incluye regresiones de FE01 y FE02 además de las pruebas propias de FE03.

## Decisiones de cierre

FE03 no hardcodea catálogos estructurales ni reutiliza endpoints administrativos para suplir
información que el contrato de vendedor no publica. Las altas o filtros que necesiten opciones
estructurales con etiquetas quedan condicionados a un contrato backend explícito y descubrible.

Con listados paginados reales, permisos alineados, imagen definitiva, contrato generado y CI
remoto verde, FE03 queda lista para integración posterior a `main`.
