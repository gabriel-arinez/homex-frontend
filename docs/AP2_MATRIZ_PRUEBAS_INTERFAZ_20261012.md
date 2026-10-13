# AP2 — Pruebas de HTTP, UI e HITL (12/10/2026)

## Línea base

CI de `main` [38330085332](https://github.com/gabriel-arinez/homex-frontend/actions/runs/38330085332): **13/13 jobs correctos**; Vitest **72 passed en 11 archivos**. Playwright E2E, accesibilidad, contrato OpenAPI, release e integración real en jobs independientes. Los E2E de integración fijan explícitamente el backend F10; no sustituir silenciosamente por `main` ni promover RC2.

## Riesgos comprobados

- **Permiso 401/403:** `src/tests/fe08/ap2-http-regression.spec.ts` conserva estado HTTP, código y mensaje; no interpreta 403 como datos válidos.
- **Un error 409/500 reenvía un POST:** el mismo archivo cuenta peticiones MSW y exige **exactamente una** por intento.
- **Evidencia NER Unicode:** los offsets Python→UTF-16 conservan el rango y la cadena fuente con caracteres astrales y combinados.
- **Decimales y corrección humana:** `fe04/proformas.spec.ts` y `fe06/capturas-hitl.spec.ts` siguen protegiendo los contratos existentes.
- **Carga/error, responsive, accesibilidad y roles:** conservados los tests FE02–FE08, Playwright y el gate de integración real; los mocks no los reemplazan.

## Comprobación

```bash
npm ci
npm run test:unit -- --run
npm run type-check
npm run lint:check
npm run format:check
npm run test:e2e
npm run test:a11y
npm run contract:check
```

E2E requiere Playwright/Chromium instalado; `integration-real` requiere los servicios aislados descritos en `.github/workflows/ci.yml`.

## Brechas futuras (AP3–AP5)

Editor único, recuperación automática sin oferta, bloqueo de múltiples proformas locales, nuevos estados, revisión obligatoria, WhatsApp manual, doble sesión y persistencia temporal todavía deben probarse **tras** la implementación funcional aprobada. AP2 no falsea un PASS de estos escenarios.
