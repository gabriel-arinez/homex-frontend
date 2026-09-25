# FE01 — Design system, temas y shell

## Estado

Implementación local completa en `feat/fe01-design-system`, basada en FE00 actualizado por
fast-forward hasta `28e2472`.

## Entregado

- tokens semánticos light/dark y geometría compartida;
- Inter variable empaquetada localmente y Lucide para Vue;
- tema inicial según preferencia del sistema, persistencia y aplicación previa al montaje para
  evitar el flash de tema incorrecto;
- sidebar expandido/compacto con preferencia persistente;
- drawer móvil con cierre por Escape, control de foco y devolución del foco;
- layout sin topbar global;
- `PageHeader` con disparador móvil y acciones contextuales;
- todos los componentes base exigidos por §23;
- estados loading, empty, error y forbidden;
- tabla que cambia a fichas en móvil y toolbar de filtros responsive;
- documentación de uso en `docs/design-system.md`.

## Accesibilidad y responsive

Los controles tienen foco visible, labels reales, errores asociados, targets de 44 px y estados que
no dependen sólo del color. Dialog y drawer gestionan teclado y foco.

FE01 incorpora validación real de navegador mediante Playwright + Chromium y Axe. El gate E2E
comprueba los viewports obligatorios de 360, 390, 768, 1024 y 1440 px, ausencia de overflow
horizontal global, accesibilidad sin violaciones serias/críticas, funcionamiento del drawer móvil,
compactación del sidebar en desktop y ausencia de bloqueo de acciones en tablet.

Durante esta validación se corrigieron problemas reales detectados únicamente en navegador:

- contraste insuficiente de textos secundarios del sidebar;
- sidebar compacto que no liberaba espacio del contenido;
- capa del sidebar de tablet que interceptaba acciones;
- landmark semántico de navegación;
- tooltip accesible del sidebar compacto.

## Dependencias

- `@fontsource-variable/inter`;
- `@lucide/vue`;
- `axe-core` como dependencia de desarrollo;
- `@playwright/test` para validación E2E real;
- `@axe-core/playwright` para accesibilidad en navegador.

No se añadió framework visual, Tailwind, Axios ni librería de gráficas.

## Evidencia responsive

Las capturas generadas con Chromium se conservan en:

- `docs/implementacion/evidencias/fe01/resumen-360.png`;
- `docs/implementacion/evidencias/fe01/resumen-390.png`;
- `docs/implementacion/evidencias/fe01/resumen-768.png`;
- `docs/implementacion/evidencias/fe01/resumen-1024.png`;
- `docs/implementacion/evidencias/fe01/resumen-1440.png`;
- `docs/implementacion/evidencias/fe01/resumen-dark-390.png`;
- `docs/implementacion/evidencias/fe01/resumen-dark-1440.png`.

## Gates locales

Se ejecutan:

- `npm ci`;
- `npm run type-check`;
- `npm run lint:check`;
- `npm run format:check`;
- `npm run test:unit -- --run`;
- `npm run build`;
- `npm run test:e2e`.

El gate E2E de FE01 contiene 10 pruebas y quedó localmente validado, cubriendo:

- 360 px;
- 390 px;
- 768 px;
- 1024 px;
- 1440 px;
- drawer móvil;
- compactación del sidebar en desktop;
- tooltip accesible;
- ausencia de overflow horizontal;
- Axe sin violaciones serias/críticas;
- comportamiento del sidebar en tablet;
- tema oscuro en 390 px y 1440 px;
- accesibilidad y ausencia de overflow también en dark mode.

## CI

El workflow incorpora un job `e2e` que:

- instala Chromium mediante Playwright;
- ejecuta los tests contra el build de producción;
- ejecuta las validaciones responsive y de accesibilidad;
- conserva traces y screenshots de diagnóstico cuando existe un fallo.

La evidencia CI remota definitiva se obtiene después de publicar estos cambios en la rama.
