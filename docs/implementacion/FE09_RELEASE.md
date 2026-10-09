# FE09 — Etapa de release

## Estado

**IMPLEMENTACIÓN FRONTEND COMPLETA; VALIDACIÓN PRODUCTIVA CONDICIONADA A D07 Y CIERRE DEFINITIVO AL PILOTO.**

FE09 prepara un artefacto estático reproducible y comprueba la integración contractual sin asumir
las responsabilidades de imagen, reverse proxy, TLS, headers, despliegue o rollback de
`homex-deploy`.

Referencias fijadas:

- base frontend: `deba1de244395dbdcb266f03026630b403768d71`;
- Backend F10: `bc375894036d30cefbc8cdf7c512315aaf1ab971`;
- NLP F10: `79efeaf6a8ca738eb3abce414850f973b1962fd8`;
- deploy D06: `fb9c321324cfc621ac07cc42fdeb1e3257a968ab`;
- versión del paquete frontend: `0.1.0`.

La evidencia estructurada está en `docs/release-fe09-v0.1.0.json`.

## Build y dependencias

`package-lock.json`, Node `24.12.0` en CI y `npm ci` fijan el entorno. `npm run release:check`
construye dos veces en directorios limpios y compara ruta, tamaño y SHA-256 de cada archivo. También
exige:

- `index.html` y assets versionados por hash;
- cero source maps;
- bundle total menor a 3 MB como guardrail de regresión;
- única variable pública de aplicación: `VITE_API_BASE_URL`;
- ausencia de indicadores de secretos, DSN, claves privadas o credenciales cloud;
- URL HTTP(S) limitada al origen, sin rutas, credenciales, query ni fragmentos;
- presencia del origen configurado en ambos bundles construidos.

Se retiró `vite-plugin-vue-devtools` del build y se actualizó la configuración ESLint a
`typescript-eslint` directa. Los overrides transitivos corrigen los avisos de seguridad vigentes.
La auditoría termina con cero vulnerabilidades.

## Contrato Backend F10

El snapshot `contracts/backend-openapi.yaml` y los tipos generados provienen del commit fusionado de
Backend F10. `scripts/verify-backend-f10.mjs` abre ese commit exacto y compara el OpenAPI normalizado con la misma configuración de formato; no confía en una rama flotante ni exige cambiar la rama de trabajo local del backend.

El job de integración real también se actualizó a Backend F10. El frontend no interpreta readiness,
stock, totales, permisos, NLP ni estados comerciales por su cuenta.

## Compatibilidad y diseño responsivo

La regresión funcional existente continúa cubriendo escritorio y móvil para autenticación,
catálogo, clientes, proformas, operaciones, documentos, voz y HITL. FE09 añade un smoke de release
sobre:

- Chromium desktop;
- Firefox desktop;
- WebKit desktop;
- Chromium tablet;
- WebKit móvil.

Cada proyecto comprueba el shell público, controles de login, ausencia de desbordamiento horizontal,
restauración de sesión y recarga directa de una ruta Vue. El fallback SPA y la caché HTTP siguen
siendo responsabilidad y prueba de `homex-deploy`.

## Flujos críticos y resiliencia

Las suites FE02–FE08 conservan cobertura de autenticación, autorización por capacidades, catálogo,
proformas, idempotencia de captura, audio, propuesta NLP, HITL, pedidos, OT, stock, recibos, notas,
documentos, media y fallos 400/401/403/404/409/500/red/timeout.

El cliente comparte una sola promesa durante refresh de sesión y repite una solicitud autenticada
una vez. No aplica reintentos automáticos a mutaciones comerciales: evita duplicados y deja la
idempotencia autoritativa al backend. Las vistas que ofrecen recuperación lo hacen mediante acciones
explícitas y recargan la autoridad del servidor.

## Frontera con deploy y D07

FE09 entrega fuentes, lockfile, snapshot contractual, configuración pública y gates del bundle.
`homex-deploy` conserva:

- Dockerfile e imagen estática;
- manifiesto inmutable, tag y digest;
- Nginx, fallback SPA, compresión, caché, CSP y headers;
- HTTPS y acceso privado;
- health externo, migración, rollback y recuperación.

D07 debe fijar el SHA final de esta rama tras su integración, reconstruir la imagen, ejecutar el
smoke en PC/tablet/móvil autorizados y aportar evidencia de acceso, media, worker, backup y rollback.
FE09 no modifica producción ni el manifiesto deploy.

## Comandos de validación

```bash
npm ci
npm run type-check
npm run lint:check
npm run format:check
npm run test:unit -- --run
npm run contract:check
npm run build
VITE_API_BASE_URL=https://homex.internal npm run release:check
npm run backend:check -- ../homex-backend
npm run test:e2e
npm run test:a11y
npm run test:release
npm audit --audit-level=high
```

La integración real completa permanece en el job `integration-real`; usa PostgreSQL, Redis,
Backend F10, Celery, ASR local, NLP y Playwright.

## Evidencia local

Evidencia de la implementación inicial. Los gates del HEAD corregido se verifican en CI antes
de integrar.

| Gate                                | Resultado                                                      |
| ----------------------------------- | -------------------------------------------------------------- |
| type-check / lint / format          | aprobado en CI inicial; revalidación requerida                                     |
| unit/component/integration          | aprobado en CI inicial; revalidación requerida                                     |
| contrato Backend F10 / OpenAPI      | aprobado en CI inicial; revalidación requerida                                     |
| build / reproducibilidad / secretos | 96 archivos, 515124 bytes, dos builds idénticos, 0 source maps |
| E2E / a11y / navegadores de release | 68 / 23 / 10 verdes                                            |
| auditoría                           | 0 vulnerabilidades                                             |

## Condición de cierre

La implementación FE09 puede integrarse cuando CI quede completamente verde. La validación
productiva queda condicionada a D07; el cierre definitivo de FE09 requiere el piloto posterior con
usuarios reales definido por el plan maestro.

## Evidencia remota del PR

La implementación fue publicada en `feat/fe09-release` con el commit
`ffd1a3c27b4ec039760baddfd9649af4f4c3f100` y abierta como PR
[#13](https://github.com/gabriel-arinez/homex-frontend/pull/13).

Ambos workflows iniciales finalizaron correctamente (12 jobs en el workflow de PR):

- [push 37975993776](https://github.com/gabriel-arinez/homex-frontend/actions/runs/37975993776);
- [pull request 37976032352](https://github.com/gabriel-arinez/homex-frontend/actions/runs/37976032352).

Además de los gates locales, CI confirmó la integración real Vue → Backend F10 → PostgreSQL →
Redis → Celery → ASR/NLP → HITL, incluida la persistencia comercial y eliminación del audio
temporal. GitHub informa avisos de mantenimiento futuro para las versiones de actions y la imagen
`ubuntu-latest`; no son fallos de aplicación ni del gate de release y deben actualizarse antes de
que el runner retire su compatibilidad actual.

## Ajustes de auditoría FE09

Se rechazaron rutas en `VITE_API_BASE_URL` tanto en la aplicación como en el gate de release.
El validador de distribución comprueba además que el origen configurado quedó embebido en ambos
bundles. El smoke de Playwright continúa aislado con un origen HTTP local; no pretende demostrar
configuración ni TLS productivos. Esa frontera queda validada en el bundle release de CI y se
ensayará extremo a extremo en D07. Los resultados de esta revisión se acreditan con los checks
del HEAD del PR, no con las ejecuciones históricas anteriores.
