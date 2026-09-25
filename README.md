# HOMEX Frontend

Interfaz operativa de HOMEX construida con Vue 3, TypeScript, Vite, Vue Router y Pinia.
El frontend representa el dominio: PostgreSQL y el backend Django siguen siendo la autoridad
para permisos, stock, totales, estados y operaciones comerciales.

## Requisitos

- Node `24.12.x` (ver `.nvmrc`)
- npm y el `package-lock.json` versionado

## Inicio

```bash
cp .env.example .env.local
npm ci
npm run dev
```

`VITE_API_BASE_URL` debe ser una URL absoluta HTTP(S) del backend. FE00 no realiza llamadas
al backend todavía; la validación queda disponible para el adapter central de FE02.

## Comprobaciones

```bash
npm run type-check
npm run lint:check
npm run format:check
npm run test:unit -- --run
npm run build
```

Los comandos `lint:check` y `format:check` no modifican archivos. Las correcciones explícitas
son `npm run lint:fix` y `npm run format`.

## Estructura

- `src/app`: configuración e infraestructura de aplicación.
- `src/modules`: funcionalidades del dominio HOMEX.
- `src/shared`: recursos transversales.
- `src/generated/api`: tipos generados desde OpenAPI a partir de FE02.
- `src/tests`: pruebas reutilizables.

La planificación y el estado de fase están en `docs/`.
