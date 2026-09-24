# FE02 — API, OpenAPI, autenticación, permisos y routing

## Estado

FE02 está publicada en `feat/fe02-auth-api` sobre el cierre de FE01. El commit funcional
`30eadeca07d234e7cbfed5546c216c38f7020588` integró autenticación, contrato OpenAPI,
identidad/capacidades y routing.

La primera ejecución remota, GitHub Actions `36037810110`, detectó un problema de configuración
del entorno de CI: `VITE_API_BASE_URL` no estaba definido para Vitest ni para el build usado por
Playwright. El código de la fase no debe depender de `.env.example` durante CI. La corrección de
cierre define explícitamente `VITE_API_BASE_URL=http://localhost:8000` en el workflow y separa las
capturas de regresión de FE01 de su evidencia histórica.

El cierre formal exige una ejecución remota completamente verde después de estas correcciones.

## Contrato fijado

- Backend: `b4a9b35bd1ca60559299cd8943b6712b955fb9c2`.
- Snapshot: `contracts/backend-openapi.yaml`.
- Referencia inmutable: `contracts/backend-ref.txt`.
- Tokens: `POST /api/v1/auth/token/` y `POST /api/v1/auth/token/refresh/`.
- Identidad autenticada: `GET /api/v1/auth/me/`.
- Respuesta de identidad: `id`, `username`, `display_name` y `capabilities`.
- Capacidades consumidas: `comercial.operar` y `comercial.administrar`.

Los tipos de `src/generated/api` se generan desde el snapshot y no se editan manualmente.
`contract:check` vuelve a generar el cliente en un directorio temporal, lo formatea y compara el
conjunto y contenido de los archivos para detectar drift.

## Dependencias y estrategia de sesión

- `@hey-api/openapi-ts@0.99.0` genera tipos compatibles con TypeScript 6.
- `msw@2.15.0` controla el backend en pruebas de integración.
- SimpleJWT entrega bearer tokens en el cuerpo; por ello se conservan en `sessionStorage` sólo
  durante la pestaña, nunca se escriben en logs y se eliminan en logout o cuando falla la sesión.
- El refresh se coordina en una única promesa y cada solicitud puede repetirse una sola vez, lo que
  evita carreras y bucles infinitos ante respuestas 401.

## Implementación

- wrapper HTTP central con URL base validada, JSON, bearer token, timeout, errores por campo y
  normalización de fallos HTTP, red, timeout y respuesta inválida;
- login seguido obligatoriamente por `GET /auth/me/`;
- restauración mediante refresh seguida por una nueva consulta a `GET /auth/me/`;
- identidad visual tomada de `display_name` y `username`; el frontend ya no deriva identidad del
  JWT ni muestra identidades locales;
- autorización UX basada exclusivamente en `capabilities` entregadas por backend;
- `comercial.operar` habilita el resumen y navegación operativa comercial;
- `comercial.administrar` habilita las entradas administrativas de catálogo y stock;
- una cuenta autenticada con `capabilities=[]` conserva identidad, pero no accede a rutas ni
  navegación comercial;
- navegación filtrada y guards de autenticación/capacidad;
- un `401` autenticado invalida la sesión y redirige al login; `403` y `404` tienen vistas dedicadas;
- rutas lazy para login, resumen y errores;
- logout que limpia tokens, identidad y capacidades;
- MSW para login, identidad, refresh, 401, 403, capacidades vacías y fallo de red;
- Playwright para login/logout, identidad real, navegación autorizada, restauración, 404 y cuenta
  sin capacidades, además de todas las regresiones responsive y Axe de FE01.

No existe inferencia de rol desde `username`, etiquetas visuales ni matrices locales de roles.
La lista de capacidades conocidas sirve únicamente como contrato tipado de operaciones que el
backend puede conceder.

## Evidencia local

- type-check: correcto;
- lint Oxlint + ESLint: correcto;
- format check: correcto;
- unit/component/integration: `18 passed`;
- contract drift: cero;
- build productivo: correcto;
- Playwright: `13 passed`;
- regresiones responsive/Axe FE01: verdes y sus capturas temporales se escriben en `test-results/playwright/evidence/fe01-regression/`, sin sobrescribir evidencia histórica;
- skips obligatorios: cero;
- auditoría npm completa con severidad alta: cero vulnerabilidades; `js-yaml` queda fijado en `4.3.2` para corregir la vulnerabilidad transitiva del generador OpenAPI.

## CI y cierre formal

El workflow ejecuta instalación reproducible, type-check, lint, formato, pruebas unitarias y de
integración, build, Playwright, contract drift y auditoría completa de dependencias.

La ejecución `36037810110` del commit funcional inicial quedó roja en `unit-component` y
`e2e` porque el runner no tenía `VITE_API_BASE_URL`; los demás jobs quedaron verdes. Esta
corrección resuelve la causa verificada en los logs remotos y evita que las regresiones FE02
modifiquen los PNG históricos de FE01.

FE02 se declarará formalmente cerrada cuando el nuevo commit de corrección tenga CI remoto
completamente verde.
