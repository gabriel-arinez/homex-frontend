# PRF-04: cierre frontend

Base auditada: `47203dac634f142ba1c3d0732978fd0f62ea0966` (PR draft #40).
Rama: `codex/prf04-cierre`. Worktree independiente: `homex-frontend-prf04`.

## Auditoría del flujo

1. `asistidasService` envía audio por multipart y texto corregido por JSON; consulta `ResultadoAsistida` por HTTP sin transformar pendientes ni transcripción.
2. `useCapturaAsistida` consulta hasta respuesta terminal. Sólo entrega propuestas `REQUIRES_REVIEW` con `PRF04_2`; conserva las demás respuestas para mostrar la transcripción. Cancelación/generaciones impiden aplicar respuestas obsoletas.
3. `CapturaAsistida` confirma antes de reemplazar un formulario modificado, conserva ASR original durante reinterpretaciones y encadena `captura_origen`. No emite `applied` para respuestas terminales inválidas.
4. `aplicarCaptura` valida también estado y versión, mapea antes de cambiar el borrador y asigna los pendientes del resultado HTTP. Un error del mapper conserva el borrador anterior.
5. `mapearCapturaAsistida` usa IDs de catálogo, conserva cantidades por ámbito y rechaza esquema técnico incompatible. Precio ausente permanece vacío; descuento nulo conserva el valor neutral aprobado. El cálculo de total negociado existente sólo usa datos estructurados y cuenta con regresiones propias.
6. `pendienteResuelto` requiere valor positivo y unidad admitida del mismo eje; alto/profundidad completos no resuelven ancho. Sin resolución estructurada el aviso se conserva.
7. `EspecificacionForm` tenía un aviso global sin asociación al selector. Además, un eje ausente recibía `cm` por defecto incluso si existía un pendiente de dimensión: al introducir el valor podía desaparecer el aviso sin elegir unidad.

## Correcciones

- Aviso global destacado y anunciado con `aria-live`; acción de teclado para enfocar el selector correspondiente.
- Aviso contextual junto a la unidad con `aria-describedby` y `aria-invalid`; desaparece sólo al completar el eje y reaparece al borrar la unidad.
- No asignar `cm` por defecto a un eje ausente con pendiente estructurado. Se mantiene la serialización consistente con ese estado inicial.
- Defensa adicional de estado/versión en el punto de aplicación del editor.
- Contraste del rótulo del configurador corregido tras fallo real de axe (3.91:1).

## Reproducción y alcance de las pruebas

`src/tests/fixtures/captura24.ts` es un equivalente **sintético**, no una exportación de la captura real: ancho 120 sin unidad, alto 75 cm, profundidad 60 cm y `MISSING_UNIT` para ancho. La lista anidada está vacía para demostrar que se propaga la lista HTTP de primer nivel.

Las dos regresiones de formulario fallan contra el componente del commit base y pasan con la corrección: asociación accesible ausente y unidad `cm` indebida cuando falta el eje. Se comprueban valor, foco, resolución y reaparición del pendiente.

La regresión Chromium recorre HTTP interceptado → composable → captura → editor real → mapper → pendientes → formulario, en 360, 768 y 1440 px. Comprueba confirmación, nombre/cantidad/precio, alto/profundidad, aviso contextual, edición manual, transcripción original y conservación del borrador ante `NO_PROPOSAL`, `ERROR` y `PRF04_1`. Verifica ausencia de escrituras de proforma, overflow horizontal y violaciones axe serias/críticas del configurador. Otra regresión verifica cancelar reemplazo y devolver foco.

Resultados: suite unitaria completa 31 archivos / 159 pruebas; suite PRF04 9 archivos / 30 pruebas; Chromium PRF04 4 pruebas. Type-check, lint, build y verificación del contrato aprobados. Capturas revisadas visualmente en `docs/evidencias/prf04-cierre/`.

No se contactó el laboratorio para estas pruebas: el navegador intercepta HTTP y Vitest usa MSW/mocks. No se modificaron backend, NLP, base de datos, contratos ni procesos del laboratorio. Esta evidencia verifica frontend con respuestas deterministas; no sustituye una nueva grabación ASR real.

## Comandos de verificación

```bash
npm ci
VITE_API_BASE_URL=http://localhost:8000 npm run test:unit -- --run --maxWorkers=2
VITE_API_BASE_URL=http://localhost:8000 npx vitest run src/tests/prf04 --maxWorkers=2
npm run type-check
npm run lint:check
npm run build
npm run contract:check
VITE_API_BASE_URL=http://127.0.0.1:4173 npx playwright test src/tests/e2e/fe04-proformas.spec.ts --grep PRF04
git diff --check
```

El servidor de preview de Playwright usa el puerto 4173 y se cierra al terminar. Los orígenes de las pruebas se usan exclusivamente para respuestas simuladas.
