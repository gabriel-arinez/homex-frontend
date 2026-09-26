# FE06 — Captura por voz, NLP y HITL

## Estado

**Fase cerrada, publicada y verificada remotamente para el contrato backend publicado.**

- Rama: `feat/fe06-capturas-hitl`.
- Base frontend: `6b8cf675740c8c545d934b0284b967ecd655ecc1`.
- Backend verificado: `96e5afd0c3bd0e5c75ddd5469313ac2e79cdad7e`.
- Contrato NLP: `homex-nlp 0.1.0`, schema `1.0`, `RULES_ONLY`.

## Flujo implementado

- entrada a Capturas desde el grupo Inteligencia;
- creación por texto o audio;
- UUID generado mediante `crypto.randomUUID()` y conservado durante el envío;
- audio multipart sin fijar manualmente `Content-Type`;
- MediaRecorder con detección de soporte;
- permiso solicitado únicamente al iniciar grabación;
- estados solicitando, grabando, listo, denegado, no soportado y error;
- contador de grabación, detener, cancelar y descartar;
- cierre de tracks al detener, cancelar o desmontar;
- el navegador no persiste audio, Blob ni Base64;
- respuesta `202` navega a la captura aceptada;
- polling cada dos segundos sólo mientras la captura no sea terminal;
- estados `PENDIENTE`, `PROCESANDO`, `COMPLETADA` y `ERROR`;
- representación de `REQUIRES_REVIEW`, `NO_PROPOSAL` y error a partir del contrato disponible;
- transcripción y propuesta original separadas del formulario humano;
- corrección de nombre, cantidad, colores, especificaciones JSON V1 y observaciones;
- selección de catálogos públicos para tipo, unidad y tipo de mueble;
- `PRECIO_UNITARIO` y `TOTAL_NEGOCIADO` enviados con exclusión mutua;
- confirmación con `intento_id` e `item_ia_id`, sin reenviar el original IA;
- confirmación final bloqueada cuando la captura ya está confirmada o incorporada;
- mensaje explícito de que HITL no aprueba la proforma;
- errores `400/409/415` visibles sin éxito aparente;
- rutas protegidas por `comercial.operar`.

## Audio efímero

El frontend mantiene el Blob exclusivamente en memoria hasta el POST. Al cancelar o abandonar la vista detiene todas las pistas. No ofrece reproducción histórica ni intenta recuperar audio después de refrescar. Django recibe el archivo y controla ASR, retención temporal y eliminación.

## Evidencia y Unicode

Se implementó `pythonSpanToUtf16()` y su regresión con emoji para convertir offsets Python a índices DOM sin alterar el texto u offsets persistidos.

El `CapturaRevision` vigente no publica `resultado_raw`, candidatos, spans ni advertencias. Por ello la pantalla muestra la transcripción y proyección `item_ia`, pero no fabrica resaltados, warnings ni scores. La utilidad queda preparada para cuando OpenAPI exponga evidencia verificable.

## Límites contractuales

- no existe `GET /capturas/`; la portada permite iniciar una captura o continuar por ID conocido, pero no simula historial;
- no existe endpoint de reintento técnico; un error orienta a crear otra captura;
- no existe WebSocket; se usa polling controlado;
- no existe endpoint histórico de audio;
- no se expone evidencia detallada ni códigos de advertencia;
- no se muestra confianza porque no hay score contractual.

## Nielsen H1–H10

| Heurística | Aplicación                                                          | Evidencia      |
| ---------- | ------------------------------------------------------------------- | -------------- |
| H1         | estados de grabación, envío, procesamiento y confirmación visibles  | Unit + E2E     |
| H2         | lenguaje de dictado, revisión, proforma y total negociado           | Revisión + E2E |
| H3         | cancelar grabación y descartar antes del envío                      | Unit           |
| H4         | PageHeader, Card, Button, Select y diálogos compartidos             | Snapshot       |
| H5         | exclusión texto/audio, confirmación única y botones processing      | Unit + E2E     |
| H6         | transcripción, original IA y corrección visibles juntos             | E2E            |
| H7         | flujo directo alta → polling → revisión                             | E2E            |
| H8         | sin score, WebSocket, historial o controles ficticios               | Unit           |
| H9         | permiso denegado, unsupported, 409, NO_PROPOSAL y ERROR accionables | Unit + E2E     |
| H10        | ayuda sobre audio temporal, UUID, JSON y autoridad humana           | Revisión       |

## Pruebas

Cobertura específica:

- MediaRecorder ausente;
- micrófono denegado;
- cancelación y tracks detenidos;
- multipart y header automático;
- POST `202`;
- conflicto idempotente `409`;
- estados de procesamiento;
- `REQUIRES_REVIEW`, `NO_PROPOSAL` y `ERROR`;
- propuesta parcial editable;
- offset Unicode con emoji;
- original IA no enviado por navegador;
- total negociado exacto;
- captura incorporada/confirmada;
- confirmación no aprueba proforma;
- 360, 390, 768, 1024 y 1440 px;
- Axe y ausencia de overflow global.

## Validación local

- unit/component/integration: **59 passed**;
- Playwright: **61 passed**;
- a11y: **22 escenarios**;
- type-check, lint, format y build: verdes;
- contract drift: verde;
- auditoría: 0 vulnerabilidades;
- `git diff --check`: limpio.

## Evidencia remota

Implementación funcional publicada:

- commit: `92ba0947b5be15576b81b63e7dfb4e9d92dcc3be`;
- GitHub Actions: run `36246137184`;
- resultado: **10/10 jobs verdes**.

Jobs validados:

- `install`;
- `type-check`;
- `lint`;
- `format`;
- `unit-component`;
- `build`;
- `e2e`;
- `a11y`;
- `contract-drift`;
- `dependency-audit`.

Resultados remotos:

- unit/component/integration: **59 passed**;
- Playwright E2E: **61 passed**;
- accesibilidad: **22 passed**;
- auditoría de dependencias: **0 vulnerabilidades**.

Con la CI remota completamente verde, FE06 queda formalmente cerrada y lista para fusionarse a `main`.
