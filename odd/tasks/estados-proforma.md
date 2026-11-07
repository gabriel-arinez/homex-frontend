# Flujo de estados de proforma

Objetivo: adaptar creación, anulación, vencimiento y acciones. Rama: feat/voz-panel-unificado-20261105. Pruebas: Vitest y pytest.

## Specs

### S1
“el plazo se cuenta desde la fecha de que se envia a revisión” fue sustituido por “tomemos esa fecha” de creación. “se venceria el 12” para una fecha calculada el 11: último día válido inclusivo.
### S2
“enviada, es un estado que no se utilizara”, “anulada si deberia de existir”, “rechazada no”, “vencida igual se queda”; “como inactivos, dejemoslos como inactivos, asi mejor no borramos nada”.
### S3
“se agregen a acciones botones para el cambio de estado cuando corresponda”; “el botón de guardar borrador debe de permanecer desabilitado hasta que realemnte hayan cambios”.

## Tasks

- T1 — S1,S2 — inline — implementado sin commit — migración aplicada por usuario; anulación, vencimiento automático y pruebas PostgreSQL.
- T2 — S2,S3 — inline — implementado sin commit — acciones en bandeja y ficha, fecha límite y guardado basado en cambios reales.
- T3 — S1-S3 — verificado con advertencias — pruebas, revisión independiente y PostgreSQL aislado; suite global y lint reportan fallas preexistentes.

## Log

- L1 — “procede con la implementación, adecua el proyecto a este nuevo flujo, no importa nada mas”.
- L2 — Fecha base de creación; el vencimiento ocurre el día siguiente al último día válido. Las acciones de estado deben respetar propiedad, permisos y restricciones de aprobación.
- L3 — Usuario: “como inactivos, dejemoslos como inactivos, asi mejor no borramos nada”. Migración 0013 desactiva solo los valores de catálogo ENVIADA y RECHAZADA sin eliminar registros; prueba unitaria y Ruff aprobados, revisor independiente no encontró bloqueos. No se ejecutó en base de datos; rollback no revierte el estado activo anterior. Falta implementación y prueba de vencimiento y anulación.

- L4 — Creado endpoint de anulación transaccional para BORRADOR/EN_REVISION y botón con confirmación en la ficha. Pruebas unitarias simuladas 2 pasaron, type-check y ESLint pasaron; revisor independiente verificó bloqueo de fila y control de propietario, pero faltan pruebas PostgreSQL, autorización por endpoint y concurrencia. La migración no se aplicó; el intento de montar una base PostgreSQL temporal fue rechazado por el ejecutor antes de iniciar. No se implementó vencimiento automático ni acciones directas en la bandeja.

- L5 — Usuario ejecutará la migración; no se debe aplicar a su base. Guardar borrador ahora compara los datos comerciales actuales con el último estado cargado/guardado y se deshabilita al revertir cambios. RED observado; 5 pruebas AP3, type-check y ESLint pasaron. Se actualizaron dos expectativas AP3 obsoletas que esperaban detalles eliminados del resumen en una entrega anterior.

- L6 — El usuario confirmó que aplicó la migración 0013 en la base de prueba (OK). Se añadió y probó la función pura fecha_limite/esta_vencida (último día inclusivo, plazo opcional); todavía no está conectada a transiciones, consultas ni tarea programada. 3 pruebas unitarias y Ruff pasaron.

- L7 — Se conectó la vigencia a tarea Celery Beat cada 60 segundos, con fecha de creación + plazo y último día inclusivo; guardas transaccionales bloquean operaciones posteriores al vencimiento incluso antes de la tarea. Se muestran fecha límite y acciones por estado con confirmación. Anulación y aprobación comparten bloqueo de fila. PostgreSQL aislado: pruebas de límites, concurrencia y propiedad; sin alterar la base del usuario. El funcionamiento periódico requiere Celery worker y Beat activos; documentado en docs/vigencia-proformas.md.
- L8 — Verificación: backend regresión independiente 29 pasadas y pruebas PostgreSQL enfocadas; frontend pruebas enfocadas, type-check, build y dos E2E pasaron; suite global frontend 273 pasaron y 1 falla previa en src/tests/prf04/asistidas.spec.ts:149. Lint global bloqueado por fallo previo en src/shared/media/GalleryPhoto.test.ts:6; lint focalizado pasó. Cambios sin commit en ambos repositorios. Risk: items 1, 2 y 4 (actualización de estados persistidos, permisos y concurrencia); revisión independiente sin bloqueos confirmados.
- L9 — Usuario: “procura que las nuevas acciones que añadiste tengan su icono”. Se añadieron iconos Lucide decorativos y coherentes a aprobar, no concretar, anular y reabrir en el menú y la ficha. RED observado; 3 pruebas de bandeja, TypeScript y ESLint focalizado pasaron. Risk: none.
