# Consolidación de roles y contenido por rol (ADMIN, ENCARGADO_TIENDA, JEFE_TALLER)

Objetivo: adaptar el frontend a los tres roles definitivos (`ADMIN`, `ENCARGADO_TIENDA`, `JEFE_TALLER`), sincronizar el contrato OpenAPI con `cliente_resumen` y `proforma_titulo` en órdenes de trabajo, corregir las 5 brechas de navegación y permisos, e implementar las tres vistas operativas del dashboard (`ResumenView`).
Rama: `feat/consolidacion-roles-contenido`.
Especificación canónica: `homex-backend/odd/tasks/consolidacion-roles-contenido.md`.

## Tasks

- [x] T1 — S1, S2 — inline — Sincronizar `contracts/backend-openapi.yaml` y tipos generados `src/generated/api`.
- [x] T2 — S3 — inline — Implementar resolución de rol y ruta inicial en `useSessionStore`, guardas en `router`, rol visible en `AppSidebar`, retorno en `ForbiddenView`, correcciones en `OrdenesTrabajoListView`, `OrdenTrabajoDetailView`, `WorkOrderActionsMenu`, `ProductoDetailView` y dashboards por rol en `ResumenView` con pruebas.
