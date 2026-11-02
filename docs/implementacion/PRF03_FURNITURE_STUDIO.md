# Furniture Studio — Configurador de muebles a pedido

## Estado

Implementación frontend en rama de revisión. El resultado visual debe ser aceptado por el usuario antes de cerrar el apartado.

## Diseño y navegación

El configurador deja de vivir dentro de un `Modal fullscreen` y ocupa toda el área principal del shell HOMEX. El `ProformaEditorView` conserva el estado del borrador en memoria al alternar entre la proforma y el estudio técnico.

`MuebleStudio.vue` aporta encabezado independiente, botón «Volver a proforma», grabación o carga directa de audio y cinco apartados de navegación: general, estructura, accesorios, precio y revisión.

`EspecificacionForm.vue` mantiene la edición y serialización de `datos_tecnicos`, pero en modo `studio` muestra solamente el apartado elegido, un explorador jerárquico de componentes y una ficha final técnico-comercial. Se eliminó el resumen lateral redundante. El modo no-studio preserva las APIs del formulario usadas por pruebas y consumidores preexistentes.

## Invariantes funcionales

- La ficha **se incorpora localmente** a la proforma; el servidor únicamente recibe el guardado integral explícito de la proforma o su emisión.
- Registros, extensiones y claves desconocidas de `datos_tecnicos` se preservan al editar una sección.
- Los conjuntos y componentes conservan identificadores estables. Máximos: 10 conjuntos y 40 componentes, con la excepción de lectura histórica ya prevista por backend.
- No se cambia la autoridad de cálculos, permisos, validaciones, contratos OpenAPI ni servicios PRF-03/PRF-04.
- La captura asistida conserva transcripción original, revisión del texto y pendientes sin completar con unidades inventadas. En el Studio, una interpretación utilizable se mantiene como **propuesta pendiente** y lleva a la etapa Revisar; el vendedor debe aceptar explícitamente antes de reemplazar la ficha. Los consumidores anteriores conservan su contrato por defecto.
- El medidor de actividad del micrófono se alimenta de muestras acústicas reales mediante Web Audio cuando está disponible; de lo contrario, el estado y temporizador de grabación siguen operativos.
- Un intento de volver con una ficha modificada utiliza la confirmación de descarte existente.
- Los estados de los apartados reflejan los datos reales y no el mero paso por una pantalla; los errores se reúnen en Revisar y permiten regresar a editar.
- Los tipos, medidas y características se seleccionan por búsqueda con creación controlada; las características personalizadas permanecen locales cuando así lo establece el contrato.
- El cálculo estimado no muestra un importe cero ficticio si falta un precio. Los mensajes comerciales no mencionan tecnologías internas.
- La nueva interfaz utiliza tokens HOMEX y debe verificarse en claro/oscuro, portátil, tableta y móvil.

## Archivos principales

- `src/modules/proformas/components/MuebleStudio.vue`
- `src/modules/proformas/components/EspecificacionForm.vue`
- `src/modules/proformas/views/ProformaEditorView.vue`
- `src/modules/proformas/components/CapturaAsistida.vue` (flujo directo con revisión previa)
- `src/modules/proformas/components/MuebleOptionPicker.vue`
- `src/modules/capturas/components/AudioRecorder.vue`
- `src/modules/capturas/composables/useAudioRecorder.ts`

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
