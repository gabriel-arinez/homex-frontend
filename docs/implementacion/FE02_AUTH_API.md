# FE02 — API, OpenAPI, autenticación, permisos y routing

## Estado

La implementación local de FE02 está completa en `feat/fe02-auth-api`, creada desde
`feat/fe01-design-system` conservando todo el trabajo previo. El cierre remoto queda condicionado
al commit/push que realizará el responsable del repositorio y a que el workflow resultante termine
verde; esta fase no contiene commits creados automáticamente.

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
- navegación filtrada, guards de autenticación/capacidad y vistas 401/403/404;
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
- regresiones responsive/Axe FE01: verdes;
- skips obligatorios: cero;
- auditoría npm completa con severidad alta: cero vulnerabilidades; `js-yaml` queda fijado en\n `4.3.2` para corregir la vulnerabilidad transitiva del generador OpenAPI.

## CI y cierre formal

El workflow ejecuta instalación reproducible, type-check, lint, formato, pruebas unitarias y de
integración, build, Playwright, contract drift y auditoría completa de dependencias. Como esta
entrega debe mostrarse antes de crear commit o push, todavía no existe una ejecución remota para
`feat/fe02-auth-api`. FE02 se declarará formalmente cerrada cuando el responsable publique estos
cambios y GitHub Actions termine completamente verde.
