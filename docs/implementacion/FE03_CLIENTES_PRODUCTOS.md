# FE03 — Clientes y catálogo visual de productos

## Estado

Implementación local completa en `feat/fe03-clientes-productos`, creada desde FE02 cerrada en
`f6fb16da40901767cbb87d495a908e083c902046`. El contrato backend permanece fijado en
`b4a9b35bd1ca60559299cd8943b6712b955fb9c2` y no presenta drift.

## Contrato respetado

FE03 consume exclusivamente los DTO generados y estos endpoints:

- `GET /api/v1/clientes/` y `GET/PATCH /api/v1/clientes/{id}/`;
- `GET /api/v1/catalogo/productos/` y `GET/PATCH /api/v1/catalogo/productos/{id}/`;
- listados de sillas, pisos y descuentos para enriquecer la presentación visual.

El OpenAPI actual devuelve arreglos completos y declara `query?: never`: no admite todavía
búsqueda, filtros ni paginación del servidor. Por ello estas operaciones se aplican localmente al
arreglo recibido y se reflejan en query params de Vue, sin enviar parámetros inventados. Cuando el
backend publique parámetros reales, esta capa debe migrar a paginación de servidor.

El contrato tampoco expone un endpoint de valores estructurales para seleccionar
`tipo_cliente`, `categoria` o `unidad_stock`. FE03 permite editar registros existentes conservando
esas relaciones, pero no presenta altas que obliguen a inventar IDs de catálogo.

## Clientes

- listado responsive con estado, contacto y enlace accesible al detalle;
- búsqueda por los campos realmente disponibles: nombre, empresa, celular y dirección;
- filtro activo/inactivo y paginación;
- estados loading, error, vacío y sin resultados;
- detalle con datos contractuales;
- edición para `comercial.administrar`;
- validaciones por campo y errores 403 procedentes del backend;
- el tipo estructural se muestra como referencia, sin inventar una etiqueta no publicada.

## Productos

- cuadrícula comercial y lista administrativa;
- búsqueda por SKU, nombre y presentación;
- filtros por presentación real derivada de silla/piso y por estado;
- paginación y query params;
- detalle y edición de SKU, nombre, precio de lista, observaciones y estado para
  `comercial.administrar`;
- stock, demanda pendiente y disponibilidad referencial siempre de sólo lectura;
- `precio_vigente` mostrado como autoridad backend;
- promociones activas detectadas por vigencia contractual, sin recalcular importes;
- presentación de silla por modelo y de piso por `m2_por_caja` cuando existe.

## Imágenes

`ProductImage` consume únicamente `Producto.imagen_principal`:

- toma URLs exclusivamente de `variantes`;
- ordena anchos y construye `srcset`;
- configura `sizes` para grid y detalle responsive;
- utiliza la variante menor como `src` y nunca solicita `original` normalmente;
- reserva proporción con las dimensiones publicadas;
- usa `loading="lazy"` en catálogo y carga prioritaria sólo en detalle;
- fallback estable para ausencia, URL inválida o fallo de carga;
- contraste validado en temas claro y oscuro.

No existe SDK, credencial, bucket, key ni construcción de URL de Cloudflare R2/AWS en el bundle.

## Autorización

Las rutas `/clientes`, `/clientes/:id`, `/productos` y `/productos/:id` exigen
`comercial.operar`. Las acciones de edición se muestran únicamente con
`comercial.administrar`. El backend continúa validando cada operación y sus respuestas 401/403 se
procesan en el cliente HTTP común.

## Pruebas

Cobertura añadida:

- búsqueda, filtro, paginación y estado vacío de clientes;
- edición sin campos autoritativos de stock;
- 403 y errores server-side por campo;
- presentación y promoción sin recálculo;
- imagen con variantes, `srcset`, ausencia de original y fallback roto;
- rutas y navegación real;
- clientes y productos a 360, 390, 768, 1024 y 1440 px;
- ausencia de overflow global;
- Axe sin fallos serios/críticos;
- tema oscuro del catálogo;
- regresiones completas FE01 y FE02.

## Evidencia local

- type-check: correcto;
- lint Oxlint + ESLint: correcto;
- formato: correcto;
- unit/component/integration: `23 passed`;
- contract drift: cero;
- build productivo: correcto;
- Playwright: `19 passed`;
- auditoría completa: cero vulnerabilidades;
- `git diff --check`: limpio.

## Cierre remoto

No se creó commit ni push automáticamente. FE03 queda lista localmente y se declarará cerrada
formalmente cuando estos cambios se publiquen y los nueve jobs de GitHub Actions terminen verdes.
