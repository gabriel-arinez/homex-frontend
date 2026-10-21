# HOMEX — PRF-04: especificación técnica frontend Vue

**Estado:** propuesta técnica para revisión; no implementada. Norma: `PRF_04_CONTRATO_COMPARTIDO.md`, decisiones aprobadas PRF-04.1–04.5 y PRF-03 vigente.

**Baseline:** `homex-frontend/main@5bfc772df0aa2430d909b87fbcb22e6bde03461b`, verificado 21-10-2026.

## 1. Hallazgos reales y adaptación necesaria

- `src/modules/proformas/views/ProformaEditorView.vue`: `draftingFurniture` representa **nueva línea local**; `lineas` agrupa el borrador; `saveSpec` incorpora a `lineas` y `persist(false/true)` invoca `/proformas/integral/`. `openSpec` edita una línea existente; no activar voz ahí.
- `src/modules/proformas/components/EspecificacionForm.vue`: formulario visual PRF-03 integral; inicializa `base`, `form`, `comercial`, `medidas`, `conjuntos`, `componentes` y `atributosGenerales` al **montarse**. Actualizar solamente `props` después del NLP podría mezclar contenido viejo: implementar reemplazo atómico con nueva instancia `key`/generación o función de rehidratación íntegra probada.
- `src/modules/proformas/services/muebleTecnico.ts`: tipos dinámicos, clonación/validación, 10 conjuntos/40 componentes, conservación de claves históricas. No escribir `schema_version` en `datos_tecnicos`.
- `src/modules/capturas/{components/AudioRecorder.vue,composables/useAudioRecorder.ts}`: grabación MediaRecorder ya funciona y elimina tracks al cancelar/desmontar. Reutilizarlo, evitando duplicaciones.
- `src/modules/capturas/{views/CapturaCreateView.vue,CapturaDetailView.vue}`: flujo antiguo exige ID de proforma, utiliza campos JSON y confirma creando línea comercial; no reutilizar estas pantallas como interfaz del nuevo flujo.
- `src/modules/capturas/services/capturasService.ts`: actualmente `createAudio` exige `proforma` y `confirm()` escribe comercialmente. Añadir métodos tipados de asistidas contra **OpenAPI nuevo**, sin cambiar compatibilidad anterior.
- `src/modules/proformas/services/editorLocal.ts`: snapshots del borrador y `sessionStorage` existentes; proteger la restauración contextual, datos de otros ítems y el control `dirty`.

## 2. Recorrido de usuario definitivo (PRF-04.1/04.4)

1. Desde **Productos → Añadir ítem → Mueble a pedido** abrir el mismo configurador PRF-03 con `draftingFurniture`. Micrófono/botón «Dictar especificaciones» visible durante toda **creación** de línea nueva. En edición de una línea ya incorporada, no mostrarlo o dejarlo deshabilitado con explicación breve.
2. Si el mueble nuevo **no** tiene cambios del vendedor, iniciar grabación sin diálogo.
3. Si existen cambios reales en identificación, ficha o datos comerciales, mostrar **un único modal**: «La captura por voz reemplazará toda la información de este mueble. No afectará los demás ítems de la proforma.» Acciones «Cancelar» y «Continuar con voz». El modal no borra contenido.
4. Reutilizar `AudioRecorder` para grabar/detener/cancelar; incluir estados accesibles y alternativa de continuar manual si micrófono denegado, ausente o fallido. No guardar audio en `localStorage` ni `sessionStorage`.
5. Enviar a `/capturas/asistidas/` con clave idempotente, `sesion_borrador`, contexto moneda y `proforma` solo cuando exista. Procesar asíncronamente/polling como la infraestructura actual, limpiar polling y cancelar UI al desmontar. No llamar a `/capturas/{id}/confirmar/`.
6. Durante procesamiento conservar el mueble anterior **sin tocarlo**. Deshabilitar modificaciones simultáneas que puedan colisionar, dejar visibles estados «Procesando…», cancelación/abandono y manejo de error. **No** bloquear navegación de otras secciones de proforma innecesariamente; aplicar protección de cambios sin guardar habitual.
7. Solo ante resultado válido de **un** mueble y proyección PRF-03 tipada, reemplazar **íntegra y atómicamente** los campos del mueble en preparación. Los anteriores no sobreviven por ser no vacíos. Opcionales no reconocidos quedan vacíos o en valores iniciales **claramente distinguidos de extracción IA**. Reactivar edición normal.
8. Mostrar transcripción original en bloque «Ver transcripción» desplegable (no sustituye al formulario). Permitir corrección textual opcional y nueva interpretación como **nueva captura**, conservando la evidencia de la anterior. No exigir edición del texto antes de aceptar.
9. Alertas mínimas junto a campos o dentro de «Información pendiente»: solo problemas verificables con acción posible, por ejemplo falta de unidad o material sin componente inequívoco. El campo `43 cm` correcto no tendrá bordes/porcentajes. Las correcciones pertinentes eliminan las advertencias resueltas.
10. Permitir modificar libremente componentes, conjuntos, campos comerciales y accesorios dentro de PRF-03. Usar el botón PRF-03 existente para **«Agregar mueble a la proforma»**, únicamente operación local. **No** incluir un botón extra de «Confirmar IA».
11. Solo al pulsar «Guardar borrador»/«Emitir proforma», enviar integral con `captura_asistida_id` de la propuesta efectiva y datos corregidos. El backend valida y vincula. Si se reemplaza otra vez por voz, usar **la última captura válida realmente aplicada**, nunca una anterior.
12. Si el usuario cierra, cancela, falla ASR/NLP/red o `NO_PROPOSAL`, conservar íntegro su borrador. Cualquier respuesta tardía de una generación obsoleta se ignora sin aplicar un reemplazo.

## 3. Diseño de estado de UI y sustitución atómica

Representar un nuevo mueble como `FurnitureDraft` (campos comerciales+especificación) y un sobre independiente `VoiceCaptureState`:

- `mode`: `idle | confirm_replace | recording | processing | ready | error`;
- `activeGeneration` único por cada intento (y `AbortController` si corresponde; detener polling); `captureId`, `attemptId` y `source` solo para la propuesta actualmente aplicada;
- `originalTranscript` y `problems` en estado de asistencia, no dentro de la línea hasta que corresponda serializar `descripcion_original`/advertencias;
- bandera de cambios **reales** del vendedor; distinguir valores iniciales (cantidad visual 1, descuento 0, selector de unidad) de interacciones que modificaron datos;
- `renderVersion`/`formInstanceKey` para reconstruir `EspecificacionForm` desde una nueva **foto completa** del borrador, nunca fusiones parciales por `Object.assign` con estado reactivo previo;
- un `capture_asistida_id` asociado a la línea **local** que realmente viene de propuesta y aún no fue guardada. No conservar metadata en `datos_tecnicos`.

**Regla de carrera:** si `resultado.generation !== activeGeneration`, si el usuario descartó el borrador o si cambió su sesión/moneda/contexto, **no** aplicar respuesta. No se modificará el estado comercial por callbacks asíncronos tardíos.

**Edición:** después de incorporar la línea a `lineas`, editarla por el configurador **manual**; conservar su asociación de origen asistido como metadata para el futuro guardado integral, aunque cambien valores. No volver a habilitar grabación para esa línea. Los otros ítems no se modifican.

## 4. Mapeo UI y validaciones

Crear adaptador tipado/reutilizable, por ejemplo `src/modules/proformas/services/capturaAsistidaMapper.ts`, que reciba **solo** el DTO nuevo del backend generado por OpenAPI y construya la forma `EspecificacionMuebleWritable + DetalleIntegralWritable` del PRF-03.

- Separar `detalle.cantidad` de `componentes[].cantidad_interna`; una cantidad de accesorio no sustituye ninguna de estas.
- `PIEZA`/`JUEGO` seleccionar vía catálogo `UNIDAD_MEDIDA` real por código, sin confiar en un ID inventado; usar precio y descuento como cadenas decimales precisas.
- `caracteristicas_generales.dimensiones` representa `{ valor, unidad }` solo cuando ambas se conocen; no transformar `140x140` a ancho/profundidad sin evidencia. Medidas adicionales y ámbitos de componente deben conservarse.
- Tipo de mueble/atributo catálogo: resolver por ID/código existente recibido/autorizado; término sin match inequívoco queda como campo local o pendiente sin alta automática.
- Generar UID opacos únicos para conjuntos/componentes en la proyección **si no provienen ya de identificadores válidos**, sin reutilizar IDs de líneas existentes ni romper vínculos `conjunto_uid`.
- Mantener `accesorios` como strings separados, `observaciones`/`advertencias` compatibles con reglas PRF-03. No duplicar herrajes internos como accesorios.
- Un resultado `NO_PROPOSAL`, de múltiples muebles, inválido o con contrato desconocido no se aplica, aunque HTTP haya devuelto 200.
- Respetar validaciones PRF-03 existentes: precio unitario nuevo >0, cantidad entera >0, 10/40, atributo añadido completo o retirado, grupo no vacío y moneda coherente. NLP incompleto no debe añadir un ítem incompleto; el vendedor termina campos obligatorios manualmente.
- El estado `dirty`, salida de pantalla, cambios de moneda y guardado concurrente siguen protegidos como en PRF-03. No sobrescribir la ficha histórica ni las claves desconocidas al reabrir líneas anteriores.

## 5. Ubicación de controles y accesibilidad

- Entrada de voz en la zona visible de cabecera/identificación del configurador, manteniendo navegación PRF-03 de apartados y campos. Durante creación la acción no desaparece tras dictar.
- Modal de sustitución **solo ante cambios**: foco inicial, retorno de foco al cancelar y teclado Escape con comportamiento seguro; accesible en móvil/escritorio, sin controles innecesarios.
- Estado grabando/procesando mediante `role=status`, errores `role=alert`; `aria-label` claro para detener/cancelar, micrófono no disponible y resultados.
- Transcripción oculta inicialmente tras «Ver transcripción», expandible, no pantalla alternativa; edición textual cuando se solicite.
- No porcentaje/confianza; advertencias de dato específico solamente. No pedir la misma confirmación dos veces.
- Responder adecuadamente en 360/390/768/1024/1440 px, claro/oscuro; evitar scroll/foco perdido tras reemplazo completo del formulario.

## 6. Pruebas frontend obligatorias

**Vitest:** mapper de DTO real; `6 PIEZA` vs 2 cajones; colores por ámbito; componentes con espesores distintos; casos ambiguos; `NO_PROPOSAL`; catálogos faltantes; campos opcionales; UID/vínculos; precio total sin unitario; 10/40; advertencias resueltas.

**Componentes:** micrófono solo en crear; formulario limpio sin modal; datos previos con modal; cancelar modal conserva todos; cancelar grabación conserva; fallo worker/red conserva; captura correcta **reemplaza 100 %** de los valores previos y reinicializa reactive state; nueva captura descarta metadata de la vieja; edición manual posterior no reactiva micrófono; línea guardada no editada por voz; otras líneas conservadas.

**Asincronía:** dos grabaciones sucesivas con respuesta invertida, cancelación mientras processing, navegación/cambio de sesión, expiración y corte de red; nunca reemplazo tardío ni doble incorporación.

**E2E Playwright:** nuevo borrador sin `id` → dictado → editor completo → agregar local → confirmar cero POST comercial → guardar integral → reabrir ficha; proforma existente editable; error o rechazo preserva borrador; sin permisos; micrófono rechazado; accesibilidad y responsive. Al menos una ejecución con backend PostgreSQL+worker+ASR/NLP reales de prueba; mocks solo para suites unitarias/UI.

## 7. Archivos y comandos de verificación

Posibles: `src/modules/proformas/{views/ProformaEditorView.vue,components/EspecificacionForm.vue,services/muebleTecnico.ts}`, un mapper y composable asistida nuevos; reutilizar `src/modules/capturas/components/AudioRecorder.vue`/`useAudioRecorder.ts`, ampliar `capturasService.ts`, sincronizar `contracts/backend-openapi.yaml` y `src/generated/api`. No crear un segundo configurador ni sustituir pantallas históricas sin decisión expresa.

Verificaciones **tras implementación**, en repo frontend:

```bash
npm ci
npm run api:generate
npm run contract:check
npm run type-check
npm run lint:check
npm run format:check
npm run test:unit -- --run
npm run build
npm run test:e2e
# Requiere stack PostgreSQL/Redis/Celery/API/NLP configurado y audio de prueba real:
npm run test:integration
git diff --check
```

Tests E2E/integración exigen servicios/fixtures; no declarar resultado verde si no se ejecutaron. Validar CI de frontend y compatibilidad con commit **final** de backend, además de revisión cruzada post-merge.

## 8. Entregables

**T4:** interfaz asistida sobre PRF-03, modal/reemplazo sin escrituras, integración de DTO y manejo de fallos. **T5:** payload integral con asociación de captura y preservación de metadatos al editar manualmente línea local. **T6:** Playwright real, accesibilidad, build, CI, pruebas de regresión PRF-01/02/03. Presentar PR/commit y pruebas reproducibles; no afirmar funcionalidad lista sin `GET`/`POST` contractual backend integrado.
