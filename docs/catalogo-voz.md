# Catálogo por voz

Disponible sólo en `ProductoForm` de creación con SILLA, PISO_FLOTANTE u OTRO
seleccionado. Reutiliza `AudioRecorder` y no añade acciones a listados, selectores
de productos ni líneas de proforma. Cambiar de categoría desmonta el contexto y
cancela su espera; la categoría nunca procede del NLP.

Grabar o seleccionar audio → escuchar y confirmar **Transcribir audio** (solo ASR) →
revisar y corregir la transcripción → **Procesar texto** (solo NLP) → revisar atributos
y evidencias → **Aplicar propuesta**. Nunca se modifica el formulario antes de esa
confirmación. Después de aplicar, la transcripción deja de mostrarse como editor;
los pendientes se corrigen o confirman desde los campos estructurados. La evidencia
original y el texto corregido permanecen en los registros técnicos del backend.
El asistente se puede minimizar sin perder su borrador.

Los límites compartidos son 2–240 segundos para grabación, hasta 300 segundos y
20 MB para archivos, y 20.000 caracteres para texto. El SKU y stock nunca se
infieren del dictado. Las validaciones definitivas siguen siendo del backend.

Consulta [el contrato de revisión por etapas](voice-transcription-review.md).

El permiso `catalogo.crear_producto` habilita la ruta y el botón de creación.
Los permisos comerciales o de administración restantes no se infieren del mismo.

Verificación con navegador, API, PostgreSQL, Redis, Celery y Whisper reales:

```sh
HOMEX_CATALOGO_AUDIO_DIR=/ruta/a/audios \
HOMEX_CATALOGO_USERNAME=demo-encargado \
HOMEX_CATALOGO_PASSWORD=... \
npx playwright test --config playwright.catalogo.config.ts
```

El directorio requiere `silla.wav`, `piso.wav`, `otro.wav`. Las pruebas verifican
subida y MediaRecorder real con fuente de audio controlada, transcripción,
propuesta, ausencia de escrituras prematuras y guardado manual en cada categoría.
Por defecto apuntan al stack local `http://127.0.0.1:18080`; se puede cambiar con
`HOMEX_CATALOGO_BASE_URL`. La falta de credenciales o audios hace fallar las pruebas; no se omiten.

Ejemplos recomendados: «Nombre silla ergonómica. Color negro. Apoyo lumbar
regulable.»; «Nombre piso flotante. Modelo NA9118. Espesor ocho milímetros.»;
«Nombre zócalo. Descripción zócalo de alto tráfico. Unidad barra.». Revisar los
códigos alfanuméricos y completar manualmente campos que ASR no reconozca.

La integración completa usa `playwright.integration.config.ts` con PostgreSQL,
Redis y Celery reales. Ambos CI generan los WAV mediante
`backend/scripts/generar_audio_catalogo.py` (libespeak-ng, español, 135 palabras/minuto),
configuran `HOMEX_CATALOGO_AUDIO_DIR`, usuario y contraseña efímeros, y ejecutan
los once flujos. Cada caso de catálogo adjunta JSON de transcripción, propuesta,
inventario antes de guardar y producto guardado con stock cero. El reporte JSON
permite distinguir aprobadas, fallidas y omitidas. No usar credenciales reales.

El color secundario usa el mismo catálogo activo que el primario y la misma
confirmación de reemplazo. Los códigos o palabras mal transcritos requieren
corrección explícita y reinterpretación; el TTS no demuestra precisión con voz humana.

## Cierre de Productos y Proformas (noviembre de 2026)

- Micrófono: máximo 3 minutos de audio efectivo, pausa, reanudación, cancelación
  y cierre automático. El contador se detiene durante la pausa.
- Archivo: máximo 20 MB; duración máxima de 5 minutos, comprobada en el worker
  de ASR mediante decodificación. Si el navegador no puede leer la metadata
  del archivo, el servidor sigue siendo la autoridad.
- Los paneles de asistencia comercial en producto y mueble a pedido se pueden
  minimizar, conservando grabación y texto mientras permanezca abierto el editor.
- No guardar audio crudo en localStorage. Al abandonar el editor se libera el micrófono.
- La galería del mueble es opcional: vacía no significa "completada", y las
  subidas pendientes o fallidas nunca se indican como confirmadas.
- Tras cancelar la creación contextual de producto, regresar al catálogo con
  sus filtros, sin volver a abrir el formulario antiguo de líneas.
- Modales y botones siguen la paleta HOMEX; solo errores que requieren una
  acción permanente usan avisos persistentes. El resto usan toast contextual.
- Requisitos de cierre: lint, TypeScript, formato, build, unitarias, E2E,
  a11y e integración real con backend y worker verificados sin omisiones.
