# Furniture Studio — Configurador de muebles a pedido

## Estado
Implementación frontend en rama de revisión. El resultado visual debe ser aceptado por el usuario antes de cerrar el apartado.

## Diseño y navegación
El configurador deja de vivir dentro de un `Modal fullscreen` y ocupa toda el área principal del shell HOMEX. El `ProformaEditorView` conserva el estado del borrador en memoria al alternar entre la proforma y el estudio técnico.

`MuebleStudio.vue` aporta encabezado independiente, botón «Volver a proforma», captura por voz opcional y cinco apartados de navegación: general, estructura, accesorios, precio y revisión.

`EspecificacionForm.vue` mantiene la edición y serialización de `datos_tecnicos`, pero en modo `studio` muestra solamente el apartado elegido, un explorador de componentes y un resumen técnico-comercial contextual. El modo no-studio preserva las APIs del formulario usadas por pruebas y consumidores preexistentes.

## Invariantes funcionales
- La ficha **se incorpora localmente** a la proforma; el servidor únicamente recibe el guardado integral explícito de la proforma o su emisión.
- Registros, extensiones y claves desconocidas de `datos_tecnicos` se preservan al editar una sección.
- Los conjuntos y componentes conservan identificadores estables. Máximos: 10 conjuntos y 40 componentes, con la excepción de lectura histórica ya prevista por backend.
- No se cambia la autoridad de cálculos, permisos, validaciones, contratos OpenAPI ni servicios PRF-03/PRF-04.
- La captura asistida conserva transcripción original, revisión del texto, confirmación para reemplazar información y pendientes sin completar con unidades inventadas.
- Un intento de volver con una ficha modificada utiliza la confirmación de descarte existente.
- La nueva interfaz utiliza tokens HOMEX y debe verificarse en claro/oscuro, portátil, tableta y móvil.

## Archivos principales
- `src/modules/proformas/components/MuebleStudio.vue`
- `src/modules/proformas/components/EspecificacionForm.vue`
- `src/modules/proformas/views/ProformaEditorView.vue`
- `src/modules/proformas/components/CapturaAsistida.vue` (reutilizado)

## Verificaciones requeridas
```bash
npm ci
npm run type-check
npm run lint:check
npm run format:check
npm run build
npx vitest run src/tests/prf03 src/tests/prf04 src/tests/ap3
npx playwright test src/tests/e2e/fe04-proformas.spec.ts
```

No declarar verificación visual final únicamente porque el CI está verde.
