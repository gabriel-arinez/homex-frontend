# FE07 — Resumen operativo y métricas

## Estado

**Implementación local completada para el contrato backend publicado.**

- Rama: `feat/fe07-resumen-metricas`.
- Base frontend: `df4e93db7f0df167d1d72a71471ea564ca6fea01`.
- Contrato backend fijado: `96e5afd0c3bd0e5c75ddd5469313ac2e79cdad7e`.

## Objetivo implementado

El resumen provisional del design system fue sustituido por un dashboard operativo basado exclusivamente en conteos calculados por Django.

La vista incluye:

- KPI de proformas `BORRADOR`, `ENVIADA` y `APROBADA`;
- distribución por todos los estados activos publicados en `ESTADO_PROFORMA`;
- tabla textual equivalente siempre visible;
- total del conjunto de conteos consultados;
- fallos independientes por estado sin ocultar métricas sanas;
- estado con todos los conteos en cero;
- reintento general mediante “Actualizar”;
- accesos a Proformas, Pedidos y Capturas;
- identidad real del usuario autenticado;
- mismo contrato para vendedor y administrador, respetando el queryset backend;
- rutas y contenido protegidos por `comercial.operar`.

## Definición de la métrica

### Pregunta

¿Cuántas proformas visibles para la cuenta autenticada existen actualmente en cada estado comercial?

### Fuente

```http
GET /api/v1/catalogo/opciones/?concepto=ESTADO_PROFORMA
GET /api/v1/proformas/?estado=<CODIGO>&page=1&page_size=1
```

Se utiliza `count` de la respuesta paginada. El navegador no descarga todas las proformas ni agrega colecciones completas.

### Unidad

Cantidad de proformas.

### Período

Foto del estado actual al momento de la consulta. No representa evolución histórica, ventas del mes ni comparación con otro período.

### Alcance

El backend aplica autenticación, permisos y aislamiento por vendedor. El frontend no amplía el queryset ni mezcla datos de otros usuarios.

### Estado vacío

Todos los estados aparecen con conteo cero y total cero. No se interpreta como error.

### Error parcial

Cada estado se consulta de forma independiente. Si una consulta falla, se muestra “No disponible”, se comunica cuántos indicadores fallaron y se conservan los restantes.

## Decisión de visualización

No se instaló Chart.js ni otra dependencia. La única visualización requerida es una distribución categórica pequeña que se representa con barras CSS. Una tabla semántica contiene siempre los mismos valores, por lo que la información:

- funciona sin hover;
- es navegable con tecnologías de asistencia;
- permanece legible en móvil;
- no incorpora JavaScript gráfico en rutas ajenas al resumen;
- no aumenta el bundle con una librería innecesaria.

Las barras son decorativas y usan `aria-hidden`; la tabla es la fuente accesible.

## Métricas deliberadamente ausentes

El OpenAPI vigente no publica endpoints agregados para:

- tiempos medios MANUAL frente a NLP + HITL;
- precisión NLP por período;
- capturas pendientes de revisión;
- evolución histórica de ventas;
- entregas próximas;
- stock valorizado;
- comparaciones porcentuales.

FE07 no calcula estas métricas descargando tablas completas ni presenta valores simulados. Se incorporarán cuando backend defina endpoint, unidad, período y semántica.

## Nielsen H1–H10

| Heurística | Aplicación                                                  | Evidencia           |
| ---------- | ----------------------------------------------------------- | ------------------- |
| H1         | carga, actualización, error global y fallo parcial visibles | Unit + E2E          |
| H2         | nombres comerciales obtenidos del catálogo                  | MSW + E2E           |
| H3         | actualización manual sin perder valores sanos               | E2E                 |
| H4         | componentes, navegación y formatos existentes               | Regresión completa  |
| H5         | no se presentan cálculos ni comparaciones no autorizadas    | Unit                |
| H6         | valores numéricos y tabla siempre visibles                  | E2E + Axe           |
| H7         | accesos directos a tareas frecuentes                        | E2E                 |
| H8         | tres KPI y una sola distribución relevante                  | Revisión versionada |
| H9         | fallo parcial identifica datos no disponibles               | Unit + E2E          |
| H10        | descripción explica alcance actual y ausencia de período    | UI + documento      |

## Pruebas

Cobertura FE07:

- parámetros `estado`, `page=1` y `page_size=1`;
- conteos entregados por backend;
- fallback textual;
- todos los conteos en cero;
- fallo parcial;
- reintento;
- vendedor y administrador;
- usuario sin capacidad mediante guards existentes;
- ausencia de valores ficticios;
- light y dark;
- 360, 390, 768, 1024 y 1440 px;
- Axe;
- ausencia de overflow;
- valores disponibles sin hover.

## Validación local

- unit/component/integration: **64 passed**;
- Playwright: **66 passed**;
- a11y: **23 escenarios**;
- type-check: verde;
- lint: verde;
- format: verde;
- build: verde;
- contract drift: verde;
- auditoría: 0 vulnerabilidades;
- `git diff --check`: limpio.

## Evidencia remota

Commit, push, PR y GitHub Actions quedan pendientes de publicación; el usuario administra esos pasos.
