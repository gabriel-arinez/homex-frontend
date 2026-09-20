# FE00 — Baseline seguro, herramientas y convenciones

## Punto de partida

- Rama: `feat/fe00-baseline`.
- Base: `db969c0` sobre `main`.
- Node de referencia: `24.12.0` mediante `.nvmrc`.
- Gestor único: npm con `package-lock.json`.

## Cambios aplicados

- Se eliminaron el contador y la prueba/contenido de demostración de Create Vue.
- Se creó la estructura mínima `app`, `modules`, `shared`, `generated` y `tests`.
- Los aliases `@/` se resuelven desde Vite, TypeScript y Vitest.
- `VITE_API_BASE_URL` tiene ejemplo y validación central; todavía no se realizan llamadas HTTP.
- Se separaron los comandos de verificación (`lint:check`, `format:check`) de los de corrección.
- Se creó CI de jobs independientes para instalación, tipos, lint, formato, pruebas y build.
- Se reescribió el README para HOMEX.

## Dependencias

No se añadieron dependencias. En particular, no se instaló UI framework, Axios,
charts, autenticación, OpenAPI ni librerías NLP.

## Validación local

- `npm ci`: correcto.
- `npm run type-check`: correcto.
- `npm run lint:check`: correcto.
- `npm run format:check`: correcto.
- `npm run test:unit -- --run`: 2 pruebas correctas.
- `npm run build`: correcto.
- `git diff --check`: correcto.

## Riesgos y bloqueos

- La CI remota requiere commit y push para su verificación; FE01 no debe empezar
  hasta que el workflow de esta rama esté verde.
- El contrato OpenAPI y el cliente HTTP se incorporan en FE02, conforme al plan.
