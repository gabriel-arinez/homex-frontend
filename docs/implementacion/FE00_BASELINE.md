# FE00 — Baseline seguro, herramientas y convenciones

## Estado de cierre

**Estado:** CERRADA  
**Rama:** `feat/fe00-baseline`  
**Base:** `db969c00b06fbdc22bd30937f40ebf8d0a045505` (`main`)  
**Commit inicial de implementación:** `340ff808d9d859b2be47f390e6cb0e5d0b4d5003`  
**Commit técnico auditado:** `2e635f4e13eab29e95165e47ed45d79dd45914ff`

FE00 deja el scaffold inicial convertido en una base reproducible, comprobable y preparada
para iniciar FE01 sin introducir todavía diseño visual ni dominio comercial.

## Baseline tecnológico

- Vue 3.
- TypeScript.
- Vite.
- Vue Router.
- Pinia.
- Vitest.
- Vue Test Utils.
- ESLint.
- Oxlint.
- Prettier.
- npm con `package-lock.json`.

Node:

- baseline reproducible mediante `.nvmrc`: `24.12.0`;
- CI: `24.12.0`;
- rango admitido por el proyecto: `>=24.12.0 <25`;
- validación local final realizada con Node `24.18.1`.

## Cambios aplicados

- Se eliminó el contenido de demostración de Create Vue.
- Se eliminó el store `counter`.
- Se eliminó la prueba demo basada en `You did it!`.
- `App.vue` quedó reducido al `RouterView`.
- Se creó la estructura mínima para:
  - `src/app`;
  - `src/modules`;
  - `src/shared`;
  - `src/generated`;
  - `src/tests`.
- El router tiene una única autoridad en `src/app/router`.
- Se eliminó el directorio legacy `src/router`.
- `main.ts` consume directamente `@/app/router`.
- Se configuró el alias `@/`.
- Se creó `.env.example`.
- Se definió y validó `VITE_API_BASE_URL`.
- Se tipó `VITE_API_BASE_URL` en `env.d.ts`.
- Los archivos `.env` reales quedan ignorados y `.env.example` permanece versionable.
- Se separaron pruebas de aplicación y configuración Vitest:
  - el TypeScript de aplicación excluye tests;
  - Vitest incluye `src/tests`, `__tests__`, `*.spec.ts` y `*.test.ts`;
  - ESLint aplica las reglas Vitest a esos mismos patrones.
- Se separaron comandos de comprobación y corrección:
  - `lint:check`;
  - `lint:fix`;
  - `format:check`;
  - `format`.
- Los comandos de CI no modifican archivos.
- Se creó CI con jobs independientes.
- Se reescribió README para HOMEX.
- `index.html` quedó con:
  - `lang="es-BO"`;
  - título `HOMEX`.

## Dependencias

FE00 no añadió dependencias.

En particular, no se incorporaron:

- framework UI;
- Tailwind;
- Vuetify;
- PrimeVue;
- Axios;
- OpenAPI tooling;
- autenticación;
- charts;
- Playwright;
- librerías NLP.

Estas dependencias permanecen reservadas para las fases definidas en el Plan Maestro.

## Validación local final

Se ejecutaron los gates obligatorios sobre las correcciones finales:

```bash
npm ci
npm run type-check
npm run lint:check
npm run format:check
npm run test:unit -- --run
npm run build
git diff --check
```
