# FE03.5 — Refactor de usabilidad según las heurísticas de Nielsen

## Estado

**Implementación completada y validada en CI.**

Rama de trabajo: `refactor/fe03-5-usabilidad-nielsen`.

Punto de partida: `main` en `2a3930a7a72c3c4920494da75c8a221c96987a5c`.

La fase modifica únicamente la experiencia ya disponible en FE00–FE03. No incorpora proformas, pedidos, captura NLP, endpoints, roles, estados ni reglas comerciales nuevas. El snapshot OpenAPI y los tipos generados no fueron modificados.

## Hallazgos y cambios

| Hallazgo anterior                                                                                    | Riesgo                                                     | Resultado                                                                                                                                     |
| ---------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Un botón cambiaba de texto durante el guardado, pero no comunicaba `aria-busy` de forma consistente. | Doble envío y estado ambiguo.                              | `Button` incorpora estado `processing`, indicador visible, nombre de operación y bloqueo nativo. Login y formularios comerciales lo utilizan. |
| La navegación mostraba rutas de fases futuras que terminaban en 404.                                 | Falsa expectativa y acciones imposibles.                   | Sidebar limitado a Resumen, Clientes y Productos, las rutas realmente implementadas.                                                          |
| Los filtros sólo estaban representados dentro de sus controles.                                      | El vendedor debía recordar qué restringía los resultados.  | `ActiveFilters` muestra búsqueda/estado, permite retirar uno o limpiar todos. La URL continúa sincronizada.                                   |
| Una carga fallida en detalle no ofrecía recuperación.                                                | Callejón sin salida.                                       | Clientes y productos ofrecen reintento explícito; los listados conservan el mismo patrón.                                                     |
| Cancelar edición descartaba silenciosamente valores.                                                 | Pérdida accidental de datos.                               | Diálogo compartido de confirmación; cancelar el diálogo conserva el formulario y confirmar restaura datos del servidor.                       |
| El shell no ofrecía salto al contenido.                                                              | Navegación repetitiva por teclado.                         | Enlace “Saltar al contenido principal” visible al recibir foco.                                                                               |
| Skeleton sólo tenía un nombre accesible estático.                                                    | Estado de carga poco claro para tecnologías de asistencia. | Estado `role=status`, `aria-live` y `aria-busy`.                                                                                              |
| Búsqueda sin acción directa para limpiarla.                                                          | Paso redundante, especialmente en móvil.                   | Botón contextual “Limpiar…” con nombre accesible.                                                                                             |
| Ayuda y error de campo no compartían un contrato de descripción.                                     | Contexto ambiguo.                                          | `TextField` admite `hint`; ayuda/error quedan asociados con `aria-describedby` sin eliminar el valor.                                         |

## Matriz H1–H10

| Heurística              | Escenario y riesgo                                                                          | Cambio aplicado                                                                                   | Evidencia automatizada/manual                                                          | Resultado                                                                                     |
| ----------------------- | ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| H1 — Estado visible     | Login y guardado parecían depender sólo del texto.                                          | `processing`, spinner, `aria-busy`, bloqueo y estados de carga anunciados.                        | Unit: doble acción bloqueada. E2E y Axe en rutas auditadas.                            | Corregido y probado.                                                                          |
| H2 — Mundo real         | IDs estructurales aparecen donde el contrato no entrega etiquetas.                          | Se mantiene lenguaje HOMEX y unidades comerciales; no se inventan mapeos.                         | Revisión de Clientes/Productos; contrato sin drift.                                    | Riesgo aceptado, no crítico: categoría, unidad y tipo de cliente requieren etiquetas backend. |
| H3 — Control y libertad | Cancelar edición perdía cambios; drawer debía cerrar y devolver foco.                       | Confirmación de descarte; Modal/drawer cierran con Escape y retornan foco.                        | Unit de confirmación; E2E móvil de Escape y foco.                                      | Corregido y probado.                                                                          |
| H4 — Consistencia       | Procesamiento, errores y filtros tenían soluciones locales.                                 | Componentes compartidos `Button`, `TextField`, `ActiveFilters`, `ErrorState` y `LoadingSkeleton`. | Tests de componentes y regresiones FE01–FE03.                                          | Corregido y probado.                                                                          |
| H5 — Prevención         | Sidebar ofrecía módulos inexistentes y acciones podían repetirse.                           | Se ocultan módulos futuros; controles processing deshabilitados; cancelación confirmada.          | Unit de processing; E2E verifica ausencia de Proformas/Pedidos.                        | Corregido y probado.                                                                          |
| H6 — Reconocimiento     | Filtros aplicados no se veían como conjunto.                                                | Chips con etiqueta semántica y limpieza individual/global.                                        | Unit + E2E de filtro visible y removible.                                              | Corregido y probado.                                                                          |
| H7 — Eficiencia         | Teclado recorría navegación antes del contenido y limpiar búsqueda requería edición manual. | Skip link, Escape/retorno de foco y botón de limpieza.                                            | E2E teclado; revisión manual responsive.                                               | Corregido y probado.                                                                          |
| H8 — Minimalismo        | Navegación adelantaba siete áreas aún no disponibles.                                       | Sidebar muestra sólo destinos funcionales; jerarquía y acciones existentes se conservan.          | Snapshot actualizado y evidencias light/dark.                                          | Corregido y probado.                                                                          |
| H9 — Diagnóstico        | Detalles con error de carga no tenían salida; error recuperable debía conservar contexto.   | Mensaje del backend y reintento seguro; formularios mantienen valores y errores por campo.        | MSW existente para 400/401/403/red; E2E 404 y 500 con reintento; unit de conservación. | Corregido y probado. `409` no aplica a los contratos consumidos por FE00–FE03.                |
| H10 — Ayuda             | Conceptos y campos no siempre podían asociar ayuda breve.                                   | `TextField.hint`, nombres accesibles y nota autoritativa de stock/precio conservada.              | Unit de `aria-describedby`; revisión Axe.                                              | Corregido y probado.                                                                          |

No quedan hallazgos críticos abiertos.

## Errores y recuperación cubiertos

- `400`: errores por campo del backend, valor del formulario conservado;
- `401`: credenciales, expiración, refresh y cierre de sesión;
- `403`: permiso real conservado, sin simular éxito;
- `404`: vista de ruta inexistente;
- `409`: no forma parte de los endpoints consumidos hasta FE03;
- `500`: estado accionable y reintento manual sin duplicar mutaciones;
- red: error normalizado por el cliente compartido.

## Responsive, tema, teclado y accesibilidad

Se validaron clientes y productos en 360, 390, 768, 1024 y 1440 px, sin overflow horizontal global. Axe no reportó violaciones `serious` o `critical` en los escenarios FE03.5. La navegación móvil fue comprobada con teclado, Escape y retorno del foco. Se validaron tema claro y oscuro.

Evidencia visual versionada:

- `docs/implementacion/evidencias/fe03-5/clientes-mobile-light.png`;
- `docs/implementacion/evidencias/fe03-5/productos-desktop-dark.png`.

Las ejecuciones posteriores guardan artefactos temporales en `test-results/playwright/evidence/fe03-5/` y no sobrescriben la evidencia histórica.

## Validación automatizada

- type-check: verde;
- lint (Oxlint + ESLint): verde;
- format check: verde;
- unit/component/integration: **30 pruebas verdes**;
- E2E completo: **31 pruebas verdes**;
- gate a11y independiente: **7 pruebas verdes**;
- contract drift: verde;
- build productivo: verde;
- auditoría de dependencias: 0 vulnerabilidades.

## Riesgos aceptados

1. El contrato FE03 entrega IDs para tipo de cliente, categoría y unidad sin etiquetas públicas. La interfaz los identifica como referencias registradas; no hardcodea catálogos ni consulta endpoints administrativos.
2. Los endpoints FE00–FE03 no publican conflictos `409`. Se mantiene el tratamiento genérico del cliente HTTP para futuras fases y no se fabrica un escenario contractual inexistente.

## Evidencia remota

Commit funcional validado: `d1355c85d7d1f8afc024ded518951fe73f1649a1`.

GitHub Actions: run `36158259858`, **10/10 jobs verdes**. Incluye 30 unit/component, 31 E2E, 7 a11y, type-check, lint, format, build, contract drift y dependency audit.
