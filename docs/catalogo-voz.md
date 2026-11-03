# Catálogo por voz

Disponible sólo en `ProductoForm` de creación con SILLA, PISO_FLOTANTE u OTRO
seleccionado. Reutiliza `AudioRecorder` y no añade acciones a listados, selectores
de productos ni líneas de proforma. Cambiar de categoría desmonta el contexto y
cancela su espera; la categoría nunca procede del NLP.

Grabar descripción → Detener → Procesar audio, o Subir audio → Procesar audio.
Revisar transcripción original y texto editable; si se edita, Reinterpretar texto
antes de aplicar. La propuesta muestra nombres de catálogos, evidencias y datos
sin reconocer. Aplicar al formulario sólo admite campos de la categoría y valores
presentes en los controles reales. Los conflictos con campos manuales requieren
confirmación. El SKU y stock nunca proceden del dictado. Guardar producto conserva
el flujo y las validaciones manuales originales.

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
