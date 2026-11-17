# Voice capture with human review

Current objective: definitive ASR/NLP/HITL corrections implemented and independently verified; delivery completed with clean-worktree readback. Original implementation remains below as history. No PRs, publication or main merges.
Branches: existing feat/voice-hitl-review in each repository; earlier commits retained. Delivery: local corrective work units; PR strategy deferred because PRs are explicitly prohibited. Runners: pytest, Vitest, Playwright, lint, typecheck, build.

## Specs

S1. «evitar que expresiones sin significado comercial generen propuestas de productos.» Preserve legitimate new product names and justified abstentions; positive, negative, regression tests.
S2. «Transcripción: al finalizar, se ejecuta únicamente el ASR. Todavía no se ejecuta NLP.» Both catalog and custom furniture use editable text, explicit «Procesar texto», then explicit «Aplicar propuesta». No form mutations before confirmation; preserve original and corrected transcript, reject stale results, retain text on abstention.
S3. «Una vez que el vendedor pulse «Aplicar propuesta» y los datos se incorporen al formulario, ocultar el apartado de transcripción libre.» Retain technical evidence, remove duplicate permanent voice-description cards.
S4. «Utilizar los spans y evidencias reales del NLP, sin generar asociaciones visuales inventadas.» Recognized/pending/discarded spans; field-level attention, reasons, navigation, suggested/reviewed/edited states; resolve observations on correction/confirmation. Block unresolved critical commercial conflicts, not informative warnings. Both forms.
S5. «Establecer una duración mínima de grabación de **2 segundos**, verificándola también en el backend.» Preview/repeat/discard before ASR; equivalent upload validation; probable silence warning without rejecting quiet speech; clear empty/corrupt/incompatible/limit errors.
S6. «Rechazar transcripciones vacías, compuestas únicamente por espacios o sin contenido textual procesable.» Coherent frontend/backend maximum and counter, preserve legitimate short «silla plegable»; commercially insufficient text abstains in NLP and remains editable.
S7. «Cambiar el máximo de grabación por micrófono de **180 a 240 segundos**.» One constant for timers/messages/tests; retain 300-second uploads and 20 MB; CPU Whisper-compatible asynchronous timeouts and long audio verification.
S8. «Eliminar las heurísticas regex de `ProductoForm.vue` que extraen precios o colores independientemente del NLP.» One explicit application event, no duplicate apply/applied handling; commercial interpretation in NLP, definitive validations in backend; unrelated behavior unchanged.
S9. «Ejecutar las pruebas, lint, typecheck, build y CI correspondientes. Corregir cualquier regresión detectada.» Verify the complete staged workflow, edits, invalid/long/insufficient inputs, valid/incomplete/absent proposals, text hiding/audit retention, review resolution, cancellation/stale protection, long/upload/silent audio, OpenAPI integration and NLP regressions. No PR or main merge.

### Corrective audit requirements (2026-11-16)

C1. «después de tres o más correcciones y reinterpretaciones, todas mantienen la referencia al mismo audio original y el texto correspondiente a cada ejecución, sin perder trazabilidad.» Stable ASR origin, distinct immutable ASR/corrected inputs/results, no repeated Whisper, ownership/session/permission/idempotency preserved.
C2. «únicamente puede aplicarse una propuesta vinculada al texto revisado y a la operación actualmente vigente.» Invalidate at recording/file selection start, block during all busy states, stale response protection, safe cancellation/retry/audio changes without resurrecting obsolete proposals.
C3. «los formatos anunciados en la interfaz funcionan correctamente o se rechazan antes del envío con una explicación clara.» Restore existing mobile-to-WAV conversion, enforce decoded minimum2s/maximum300s and20MB before/after conversion; no silent fallback or truncation.
C4. «cada advertencia crítica dispone de una forma clara de resolución y desaparece del estado pendiente únicamente cuando queda efectivamente resuelta o descartada mediante una acción válida.» Map ESPESOR_SIN_COMPONENTE, MISSING_UNIT, MISSING_AXIS, DIMENSIONES_NUEVAS, CONFLICTING_VALUES and commercial quantity/price/component observations to real controls; navigation, contextual indicators, actual validation, valid explicit discard, critical-only save blocking and preserve still-applicable warnings after apply.
C5. «el NLP distingue entre palabras que anuncian información comercial y valores comerciales realmente reconocidos.» Negative cases: «hola buenas», «un mueble precio», «mueble color», «probando marca», «hola producto», «uno dos tres». Preserve «silla plegable» and properly introduced novel names; no invented commercial data; abstention keeps editable text.
C6. «el vendedor puede comprender y comprobar la propuesta sin interpretar estructuras JSON.» Replace visible JSON with module-specific real extracted product/quantity/dimensions/material/components/accessories/prices or catalog name/category/brand/model/features/price; differentiate pending attributes, retain exact spans, text correction/reinterpret/apply; hide free text after apply.
C7. «Trabajar exclusivamente sobre las ramas `feat/voice-hitl-review` existentes.» Preserve prior commits/published artifacts, corrective commits only, no unrelated changes/PR/main merge; rerun affected/full tests, E2E/accessibility, lint/format/typecheck/build/OpenAPI and actual package compatibility. Update this same feature log and finish clean. Final report: corrections/files, tests/results, regressions/fixes, compatibility, commits/branches, real limitations.

### Definitive corrective requirements (2026-11-16)

D1. «Verificar la validez comercial del contenido incluso cuando se utilizan prefijos como `producto:`, `nombre:` o `nombre comercial:`.» All exact negative/positive examples in L-final, category contradictions and legitimate new names.
D2. «Cuando un atributo requiera revisión comercial, señalar directamente su campo, aunque su evidencia tenga decisión `ACCEPTED`.» «sugerido, pendiente, confirmado, corregido y descartado». Real evidence and critical-only blocking.
D3. «No limitar el resaltado a `input`, `select` y `textarea` cuando existan controles interactivos relevantes.» Functional typed resolutions, stable dynamic links, real validation and reopen on reversal.
D4. «guardar repetidamente una ficha sin nuevas decisiones no debe generar duplicaciones, y cada corrección o descarte debe mantener su relación con la evidencia correspondiente.» Server provenance/permission/shape/coherence validation and preserved history.
D5. «se inicia automáticamente el ASR» «No ejecutar NLP todavía.» Explicit «Procesar texto» and «Aplicar propuesta»; playback, cancellation/stale/duplicate safety, hidden text after apply. Supersedes earlier manual ASR confirmation.
D6. «Que los cambios no afecten a las capturas históricas ni a los flujos legados compatibles.» Preventive directly related scenarios specified verbatim in L-final.
D7. «cada defecto identificado está corregido, que su prueba de regresión falla con el comportamiento antiguo y pasa con el nuevo». Full final suites, static checks, contracts, actual new artifact, a11y, historical E2E skip investigation; exact scope in L-final.
D8. «Actualizar `docs/voice-hitl-corrective-verification.md`» Corrective local commits, preserved history/artifacts, clean worktrees, no PR/publish/main merge; exact delivery in L-final.

## Tasks

T1 | S1,S6 | delegated: independent NLP commercial-validation unit | implemented; independently checked | b52e979, 814aac4
T2 | S2,S5,S6,S7,S9 | delegated: independent additive backend ASR contract and validations | implemented; independently checked | dd4bc1a, 95e654b
T3 | S2-S8 | inline: frontend consumes additive contract after staging | verified | 57cbcb8, 2b3c099
T4 | S9 | independent verification: items 3/4/5 | verified; existing E2E skip documented | source commits above; evidence closeout

R1 | C1-C3,C6 | inline: shared capture controller/audio/presentation | verified; source-bound controller/audio/commercial presentation | feef4de
R2 | C4 | delegated: disjoint HITL unit | verified; actual value resolution and source-bound human audit | 5fd9956
R3 | C1,C3,C5,C7 | delegated: invariant/artifact corrections | verified; source/installed NLP1137 and backend681 pass | cb15f7e (NLP), b3019f9 (backend)
R4 | C7 | independent high-risk verification and final local CI | verified; existing skip and offline ASR-install limitation documented | corrective source commits above

U1 | D5,D6,D7 | inline parent auto-ASR and browser regressions | verified | 5bafb69; Risk4. Automatic capture-to-ASR only, editable text, explicit NLP/application.
U2 | D2,D3,D4,D6,D7 | delegated parallel disjoint frontend HITL unit; parent scoped independent/live/visual corrections | verified | 74a1e49; Risk1/3/4. Field resolution, stable controls, canonical provenance and transition history.
U3 | D1,D2,D3,D4,D6,D7 | delegated independent NLP/backend unit; parent manual-policy parity corrections | verified | 50216e5, dd21735, 3d6d728; Risk1/2/3/5. New .28 artifact, trusted audit, preserved manual rules.
U4 | D6,D7,D8 | delegated independent frozen-source verification, parent spot/visual checks | verified; cleanup complete | evidence 74a1e49; RDD remains disabled.

## Log

L1. User authorized all seven phases, fresh branches from main, verifiable phase commits, and explicitly prohibited PRs and merging to main. «NO TE INTERRUMPAS, TERMINA TODAS LAS FASES.» Exact acceptance: «El vendedor debe poder **grabar, revisar y corregir la transcripción antes del NLP; interpretar el texto, revisar la propuesta y aplicarla de forma explícita; y, a partir de ese momento, trabajar únicamente sobre el formulario estructurado**, con los campos que requieren atención claramente identificados.»
L2. Baselines: NLP 702d22b; backend 0b4299a; frontend 914ed58. Original NLP has unrelated untracked .atl/, preserved. Backend/NLP use isolated worktrees /tmp/homex-backend-voice and /tmp/homex-nlp-voice. Frontend local feature branch. RDD off by explicit global preference, do not enable.
L3. Forecast exceeds 400 authored lines across repositories; retain cohesive phase commits and defer any PR chain decision until final human review, respecting explicit no-PR scope. Risk: item 3 (API contracts) and item 4 (asynchronous stale-result protection). No remote operations authorized or needed.

L4. NLP commercial validation now rejects greetings, numeric chatter and bare generic furniture. Explicit unknown names such as `nombre: Credenza Nórdica` remain eligible without a closed vocabulary. Test-first failures reproduced; full NLP 1,104 passed. Packaged local 0.1.26; released 0.1.25 unchanged.
L5. Backend additive `solo_transcribir` runs ASR only; terminal transcription and corrected-text requests retain capture-origin audit, real candidates and warnings. Decoded minimum 2 seconds, Unicode textual input and 20,000-character limit, CPU worker soft/hard deadlines 1,200/1,260 seconds. New wheel SHA256 a1d4d00e79d924a8c53cdb038b64b639b243611f6241a8d48618ae983c76d5d3. Full backend 668 passed; focused 53; research 60; lint, format, migration drift, OpenAPI drift, build, wheel/checksum identity and offline lock checks passed. Independent scratch verification: backend 53 and NLP 78 passed, no reproduced blockers. Parent spot-check backend integration 16 passed.
L6. Frontend shares a staged Drawer component across both forms: audio preview and optional silence notice; explicit ASR; editable text with original evidence and counter; explicit NLP; exact literal Unicode span highlights; explicit single application event; free text hidden afterward. Removed ProductForm price/color regex and permanent source-transcription cards. Field review states attach to actual controls and critical unresolved observations block save. Microphone maximum 240 seconds, uploads 300 seconds/20 MB, polling 22 minutes. Writer focused 18 tests, lint and typecheck passed; scratch verifier static/build/contract checks passed. Initial scratch full tests/browser lacked required VITE_API_BASE_URL and cannot establish regressions; rechecking with documented local mock origin. Test options mock corrected to read the real ?concepto query.
L7. Actual 240-second speech inference is unverified: cached Whisper-small exists, but there is no repository speech fixture and no local TTS executable. Decoded real WAV boundaries 1/2/240/300 seconds were tested; those do not prove transcription accuracy or long CPU inference. No private audio, remote CI, network publishing, PR or main merge performed.

L8. Frontend final independent checks passed: 61 Vitest files/338 tests; Playwright 110 passed, one existing explicitly skipped attachment-freezing test (fe04-proformas.spec.ts:756); lint, typecheck, production build and OpenAPI generated-contract check passed. The scratch required an explicit public local mock origin and a real dependency copy (symlinked pdfjs workers were outside Vite's root). Both environment failures were resolved, not classified as product regressions. Targeted correction fixed accessible labels by placing field-status notes outside labels and gave the hidden file input an accessible name; observed RED then GREEN, and all four responsive/Axe blocker cases passed. Parent spot-check staged/field/missing-unit tests: 7 passed.
L9. Supersedes L7's missing-fixture limitation: the installed eSpeak shared library can synthesize Spanish even without a CLI. A generated exact 240.0-second commercial fixture ran through actual cached Whisper-small CPU/int8 (four threads), real backend ASR-only completion, and a subsequent explicit text-only NLP request. ASR 42.32s, 2,807 characters, 29 segments; last segment 229.68–239.28s retained final lot/quantity/price. NLP 0.088s, no ASR rerun, full original/corrected trace retained; no commercial writes in the ASR stage. Recognition errors (including Cierre→Sierra) remain visible for correction; this is not proof of human microphone accuracy.
L10. Final fallback probes found marker-only chatter (hola precio/probando color/hola marca) still invented names. Final NLP correction replaces loose marker-word sufficiency with real extraction evidence and explicit/product identity; counted novel names with commercial data remain valid. Full NLP 1,107 passed. Final wheel SHA256 8b29f4b46eae4d8b33007dad76c18913b7dbc1d65309c5f0272f69f1d357c6e0, full backend 671 passed (9 test-secret warnings), focused 56 passed; offline lock/checksums/operational installed-byte identity and lint/format passed. Released 0.1.25 and existing commits unchanged; final blocker-only independent artifact check pending.
L11. Source commits: NLP b52e979 + 814aac4; backend dd4bc1a plus final artifact fix pending; frontend 57cbcb8 + 2b3c099. Coherent replacement of both legacy capture components, their callers and regression tests exceeds the advisory 400-line heuristic; splitting its state transition/application logic across independently runnable commits would leave contradictory workflows. No code, tests, whitespace or documentation were removed merely to meet a size budget. PR slicing remains deferred until the requested final human review.

L12. Final blocker-only independent backend recheck: 19 integration tests passed; actual installed package files match final wheel byte-for-byte. Parent reran the same 19 tests successfully and repeated text-only interpretation of the complete 2,807-character long ASR transcript using the final wheel, with ASR construction patched to fail if called: COMPLETADA, full text/origin retained, no repeated ASR. Final backend artifact commit 95e654b.
L13. Verification evidence is committed in backend docs/evidence/voice-hitl-review.json and both workflow documents. Browser/static/full-unit checks apply to exact final frontend source; actual long-ASR proof uses synthetic speech and the final ASR module bytes are identical to the benchmark. Remote CI, physical microphone recording, publishing, PR creation and main merges were not performed. The sole skipped E2E was already skipped before this work and was not introduced by this feature.

L14. User authorized corrective intervention only: «No rehacer la arquitectura ni repetir las fases anteriores.» Preserve «Audio → ASR → Transcripción editable → NLP → Revisión de propuesta → Aplicación al formulario.» Audit requirements C1-C7 above extend rather than replace prior requirements. Existing commits must stay intact, only corrective commits, no published version overwrites or PR/main merge. Runtime directories /tmp/homex-*-voice no longer exist, but existing branches/commits remain. Recovered each existing branch into durable isolated worktrees under /home/gabriel/HOMEX/.worktrees/voice-backend and voice-nlp; original main checkouts and unrelated NLP .atl/ preserved. Correction baselines: frontend4ab7b70, backend66bbf13, NLP28ebf03. RDD remains globally off.
L15. Verified initial defects: shared controller overwrites captureId on each text response; start/discard does not immediately clear prior result and apply guards only processing; frontend advertises AAC/Opus/MP4/FLAC while backend extension whitelist accepts WAV/MP3/M4A/OGG/WebM; existing conversion silently returns original if Web Audio missing. Parallel route: parent shared flow/audio/presentation, bounded HITL writer on forms/resolution helpers, bounded service writer on NLP/backend. No overlapping edit surfaces. Forecast exceeds400 lines; preserve existing no-PR/deferred delivery strategy and coherent corrective commits rather than rewrite architecture.

L16. Corrective implementation: controller now retains one originCaptureId after ASR; only text-only sessions choose their initial text root. Every selection/recording start cancels prior generation and proposal; application requires exact current text+generation and no busy/audio-preparation state. Late microphone cancellation is scoped to its own recorder instance. Original/corrected text survives terminal validation errors when available. Mobile AAC/Opus/MP4/FLAC uses existing full WAV encoder with decoded2–300s validation and preallocation20MB guard; missing codec/WebAudio rejects before send, never silently falls back. Commercial grouped presentation replaces visible JSON, uses catalog option names, omits empty fields and retains real evidence highlights.
L17. HITL writer observed and corrected invalid quantity resolution, silent component deletion, missing control focus, thickness-confirmation action displacement and Vue proxy cloning errors. Actual corrections/reversion drive validity; explicit human discard requires reason and additive revision_humana_voz metadata preserves original pending evidence, capture ID and separate decisions. Restore requires matching trusted NLP capture ID and pending snapshot; no-ID/fresh-ID state cannot reuse old discards. Existing additive validator and fusion helpers verified compatible. Writer focused36 tests, typecheck/scoped lint/format passed; full verification pending. Root observed RED4 controller cases, RED mobile conversion/size bounds and RED ASR-error text preservation, then own focused green. Read-only native assessment retained high risk/unassessable due current untracked files; RDD remains off, no native lifecycle started.

### L18 — User corrective request (verbatim, 2026-11-16)

```text
# HOMEX — Correcciones finales del flujo de captura por voz y HITL

Realizar una intervención correctiva sobre la implementación existente en `feat/voice-hitl-review` de los tres repositorios HOMEX.

**No rehacer la arquitectura ni repetir las fases anteriores.** Conservar el flujo ya implementado:

Audio → ASR → Transcripción editable → NLP → Revisión de propuesta → Aplicación al formulario.

Resolver los siguientes hallazgos de auditoría y comprobar que no se introduzcan regresiones.

## 1. Corregir la trazabilidad de transcripciones y reinterpretaciones (P1)

Actualmente, las reinterpretaciones sucesivas pueden vincularse a una captura de texto anterior en lugar de conservar como origen la grabación ASR inicial.

Tareas:

1. Mantener un identificador estable de la captura de audio original durante todo el proceso.
2. Garantizar que todas las reinterpretaciones de texto estén vinculadas a esa captura original, aunque el vendedor procese el texto varias veces.
3. Diferenciar correctamente:
   - Transcripción original generada por ASR.
   - Texto corregido por el vendedor.
   - Resultados de cada interpretación NLP.
4. Verificar que ninguna reinterpretación ejecute nuevamente Whisper.
5. Conservar los controles de propiedad, sesión, permisos e idempotencia del Backend.

**Criterio de aceptación:** después de tres o más correcciones y reinterpretaciones, todas mantienen la referencia al mismo audio original y el texto correspondiente a cada ejecución, sin perder trazabilidad.

## 2. Evitar la aplicación de propuestas antiguas (P1)

Se detectó que una propuesta anterior puede permanecer disponible cuando comienza una nueva grabación o selección de audio.

Tareas:

1. Invalidar inmediatamente la posibilidad de aplicar una propuesta anterior al iniciar una nueva captura.
2. Bloquear «Aplicar propuesta» mientras exista una grabación, transcripción o interpretación en curso.
3. Evitar que respuestas asíncronas antiguas sobrescriban el texto, la propuesta o los campos correspondientes a una operación más reciente.
4. Gestionar correctamente cancelaciones, reintentos, cambios de audio y errores.
5. Si el vendedor cancela una nueva captura, conservar de forma segura los datos válidos anteriores cuando corresponda, sin reactivar propuestas obsoletas automáticamente.

**Criterio de aceptación:** únicamente puede aplicarse una propuesta vinculada al texto revisado y a la operación actualmente vigente.

## 3. Corregir la compatibilidad de archivos de audio (P1)

El Frontend admite extensiones móviles que el Backend podría rechazar después de haberse eliminado parte de la conversión a WAV.

Tareas:

1. Revisar los formatos realmente admitidos por Frontend, Backend y el decodificador ASR.
2. Restaurar la conversión necesaria para formatos móviles compatibles, reutilizando los mecanismos existentes cuando sea posible.
3. Evitar que el selector permita enviar formatos que posteriormente serán rechazados sin explicación.
4. Mantener las validaciones de duración mínima de 2 segundos, máximo de subida de 300 segundos y tamaño de 20 MB.
5. Comprobar que la conversión no provoque archivos excesivos, pérdida de contenido ni errores silenciosos.

**Criterio de aceptación:** los formatos anunciados en la interfaz funcionan correctamente o se rechazan antes del envío con una explicación clara.

## 4. Completar la señalización y resolución de pendientes HITL (P1)

La auditoría encontró advertencias que no están correctamente asociadas a campos del formulario, además de diferencias entre confirmación visual y resolución real.

Tareas:

1. Revisar el mapeo de advertencias hacia los campos reales de Muebles a Medida y Catálogo.
2. Incorporar los casos pendientes, especialmente:
   - `ESPESOR_SIN_COMPONENTE`
   - `MISSING_UNIT`
   - `MISSING_AXIS`
   - `DIMENSIONES_NUEVAS`
   - `CONFLICTING_VALUES`
   - Pendientes comerciales de cantidades, precios y componentes.
3. Cuando exista una observación asociada a un campo, mostrar un indicador visual contextual: borde, subrayado, icono y mensaje explicativo.
4. Garantizar que «Revisar campo» dirija al apartado y control correctos.
5. Sincronizar las acciones de corregir, confirmar o descartar con el estado real de los pendientes.
6. No considerar resuelto un pendiente únicamente porque el vendedor pulsó un botón visual.
7. Bloquear el guardado exclusivamente cuando existan pendientes críticos sin resolver, sin impedir operaciones manuales válidas.
8. Conservar las advertencias que sigan vigentes después de aplicar la propuesta al formulario.

**Criterio de aceptación:** cada advertencia crítica dispone de una forma clara de resolución y desaparece del estado pendiente únicamente cuando queda efectivamente resuelta o descartada mediante una acción válida.

## 5. Reforzar la validación semántica del NLP (P2)

Se identificaron condiciones que pueden considerar suficiente una descripción genérica acompañada únicamente de palabras como «precio», «color» o «marca», sin contener atributos comerciales reales.

Tareas:

1. Revisar las reglas de suficiencia comercial para Catálogo y Muebles a Medida.
2. No aceptar palabras indicadoras de atributos como si fueran valores comerciales válidos.
3. Incorporar pruebas con expresiones como:
   - «hola buenas»
   - «un mueble precio»
   - «mueble color»
   - «probando marca»
   - «hola producto»
   - «uno dos tres»
4. Preservar descripciones legítimas, aunque sean breves, como «silla plegable», y nombres comerciales nuevos correctamente introducidos.
5. Ante información insuficiente, devolver ausencia de propuesta y una advertencia clara, conservando el texto editable para corregirlo.
6. No inventar cantidades, precios, dimensiones ni atributos para completar propuestas.

**Criterio de aceptación:** el NLP distingue entre palabras que anuncian información comercial y valores comerciales realmente reconocidos.

## 6. Mejorar la presentación de propuestas NLP (P2)

La propuesta se muestra actualmente mediante una representación JSON técnica, poco adecuada para el vendedor.

Tareas:

1. Sustituir el JSON visible por una presentación comercial clara y estructurada.
2. Organizar los atributos reconocidos según el módulo:
   - Muebles a Medida: producto, cantidad, medidas, materiales, componentes, accesorios y precios.
   - Catálogo: nombre, categoría, marca, modelo, características y precio.
3. Mostrar únicamente los atributos realmente extraídos, diferenciando los que requieren revisión.
4. Mantener los resaltados semánticos de la transcripción y la relación con sus evidencias reales.
5. Conservar las opciones para corregir el texto, reinterpretar y aplicar la propuesta.
6. Después de aplicar, mantener oculto el texto libre del ASR y continuar la revisión únicamente desde los campos estructurados del formulario.

**Criterio de aceptación:** el vendedor puede comprender y comprobar la propuesta sin interpretar estructuras JSON.

## 7. Pruebas y verificación final

Después de las correcciones:

1. Ejecutar las pruebas unitarias, de integración y regresión de los repositorios modificados.
2. Comprobar reinterpretaciones sucesivas, cancelaciones, respuestas antiguas y cambios de grabación.
3. Verificar formatos móviles, límites de audio y procesamiento ASR sin ejecuciones NLP anticipadas.
4. Comprobar visualmente y mediante pruebas automatizadas la asociación y resolución de pendientes HITL.
5. Verificar textos comerciales inválidos y válidos mediante casos positivos y negativos.
6. Ejecutar lint, formato, typecheck, build y validaciones OpenAPI correspondientes.
7. Comprobar la compatibilidad entre NLP, Backend y Frontend, incluyendo la versión y los artefactos reales del paquete.
8. Mantener aprobadas las pruebas existentes, incluidas las comprobaciones E2E y accesibilidad afectadas.
9. Resolver cualquier regresión antes de dar por terminada la intervención.

## 8. Entrega y control de cambios

- Trabajar exclusivamente sobre las ramas `feat/voice-hitl-review` existentes.
- Mantener intactos los commits anteriores y añadir commits correctivos identificables.
- No sobrescribir versiones publicadas del paquete NLP.
- No modificar funcionalidades ajenas al alcance de esta auditoría.
- No crear PR ni fusionar a `main`.
- Conservar los repositorios sin cambios pendientes al finalizar.
- Actualizar `odd/tasks/voice-hitl-review.md` con las correcciones y verificaciones.

### Informe final requerido

Presentar:

1. Hallazgos corregidos y archivos principales modificados.
2. Pruebas añadidas y resultados obtenidos por repositorio.
3. Regresiones detectadas y soluciones.
4. Verificación de compatibilidad entre los tres componentes.
5. Commits finales y estado de las ramas.
6. Cualquier limitación real que permanezca pendiente.

**Objetivo final:** garantizar que el vendedor pueda grabar, corregir, interpretar y aplicar información comercial de manera segura, con trazabilidad completa, sin propuestas obsoletas y con todas las observaciones críticas claramente identificadas y resolubles desde el formulario.
```

L19. Compatibility regression found by the unchanged backend full suite: ASR canonicalization must not rewrite legacy immediate text-only lineage. Corrected both services and controller to use a stable real ASR ID when one exists, otherwise the previous text interpretation ID. Root observed RED then GREEN; backend did not weaken the existing test. Final frozen canonical NLP0.1.27 wheel SHA2563ec32eaa5624bbb80c6609096f65249f15d4f5a4ecf5c788a2fdd60ddc64c08a uses SOURCE_DATE_EPOCH=0, reproducible wheel/sdist, source32/installed35 files verified, old .25/.26 intact. Full backend681 and source+installed NLP1137 pass; compatibility112, historical/three-plus chain7, canonical identity26, research60, applicable lint/format/schema/OpenAPI/build/checksum/lock checks pass. Independent service verification pending; no source edits after freeze.
L20. Final frontend independent verification:65 files/369 unit tests, full Playwright114 passed/1 existing attachment-freezing skip, focused mobile+staged browser5 passed; lint/format/typecheck/build/generated-contract checks pass. Real AAC/Opus/MP4/FLAC synthetic fixtures exercise browser WAV conversion or explicit rejection before upload. Parent visually inspected grouped proposal screenshot with actual price/evidence/pending label and no JSON; corrected screenshot step scrolls the Drawer into view. Published event contracts unchanged. No new ASR benchmark or physical microphone recording was performed for this correction-only intervention; ASR logic unchanged. Fresh offline worker-extra installation lacks cached ctranslate2, but existing cached ASR environment imports work; no downloads attempted.

L21. Independent service verifier found no blockers:92 backend API/legacy/identity tests and219 NLP semantic/consumer tests passed in fresh isolated state against actual installed0.1.27; old .25/.26 artifacts and sidecars match baseline exactly. Parent repeated the same backend92 and four frontend corrective files29 tests successfully. Independent final frontend full Playwright rerun against exact final controller/test bytes:114 passed/1 existing skip, no new failures. Static checks/369unit tests all pass. Parent compared ASR subpackage modules and historical artifacts directly; no ASR implementation changes.
L22. Corrective source commits, preserving every prior commit: frontend feef4de (stable ASR/current-operation guard, mobile format validation and commercial presentation),5fd9956 (real HITL validation/resolution/navigation and source-bound audit); NLP cb15f7e (semantic sufficiency/version0.1.27); backend b3019f9 (canonical real-ASR provenance, preserved text-only contract and actual0.1.27 consumer). Existing global RDD remains off; read-only risk assessment is informational and no receipt/native review approval is claimed. No remote CI/push/PR/main merge. Durable feature worktrees are now ../.worktrees/voice-backend and ../.worktrees/voice-nlp relative to frontend, not the historical /tmp paths.

### L-final — definitive user correction (2026-11-16)

# HOMEX — Corrección definitiva y cierre técnico del flujo ASR, NLP y HITL

Realizar una última intervención correctiva sobre las ramas existentes `feat/voice-hitl-review` de `homex-nlp`, `homex-backend` y `homex-frontend`.

La auditoría anterior confirmó que la arquitectura principal funciona, pero identificó defectos residuales de validación comercial, observaciones por campo, trazabilidad HITL y automatización de la transcripción.

**Objetivo:** resolver integralmente estos problemas, incluyendo casos límite relacionados, para evitar nuevas rondas de correcciones sobre los mismos comportamientos.

No rehacer la arquitectura, no modificar los commits anteriores ni realizar cambios ajenos al alcance. Localizar los worktrees correctos de cada repositorio y trabajar exclusivamente sobre las ramas existentes.

## 1. Corregir definitivamente la validación comercial del NLP

La última auditoría comprobó que expresiones como `producto: hola buenas` todavía pueden convertirse en nombres comerciales válidos porque el NLP confía excesivamente en los prefijos explícitos.

**Correcciones requeridas:**

1. Verificar la validez comercial del contenido incluso cuando se utilizan prefijos como `producto:`, `nombre:` o `nombre comercial:`.
2. Rechazar saludos, pruebas, frases incoherentes y marcadores de atributos sin valores reales, independientemente de cómo estén introducidos.
3. Comprobar la coherencia entre el nombre extraído y la categoría seleccionada:
   - SILLA: detectar nombres claramente incompatibles con esta categoría.
   - PISO_FLOTANTE: detectar productos inequívocamente ajenos a pisos y accesorios relacionados.
   - OTRO: permitir nombres comerciales diversos sin imponer vocabularios excesivamente restrictivos.
4. Ante contradicciones claras de categoría, evitar la aceptación automática del nombre y generar una advertencia comprensible.
5. Conservar la aceptación de productos nuevos y nombres legítimos que no estén incluidos en un léxico cerrado.
6. Mantener las abstenciones cuando no exista evidencia comercial suficiente, sin inventar atributos.

**Casos mínimos de regresión:**

- `hola buenas`
- `producto: hola buenas`
- `nombre: probando`
- `nombre comercial: uno dos tres`
- `hola producto`
- `mueble precio`
- `mueble color`
- `silla plegable` en SILLA y PISO_FLOTANTE
- Nombres comerciales nuevos y legítimos.
- Descripciones completas con dimensiones, materiales, cantidades y precios.

Los casos inválidos no deben producir propuestas artificiales. Los casos válidos deben conservar su interpretación anterior.

## 2. Completar la asociación de advertencias con campos comerciales

Actualmente algunas advertencias del NLP no se convierten en pendientes específicos dentro de los formularios.

Por ejemplo, una extracción válida de precio puede contener una advertencia de revisión comercial, pero el campo solamente aparece como sugerido.

**Correcciones requeridas:**

1. Revisar conjuntamente `ProductoForm.vue`, `EspecificacionForm.vue`, `fieldVoiceReview.ts`, `pendientesAsistencia.ts` y los contratos del Backend.
2. Establecer una correspondencia consistente entre:
   - Atributo extraído.
   - Evidencia NLP.
   - Advertencia.
   - Campo del formulario.
   - Estado de revisión.
3. Cuando un atributo requiera revisión comercial, señalar directamente su campo, aunque su evidencia tenga decisión `ACCEPTED`.
4. Incorporar indicadores contextuales visibles y discretos: borde o subrayado, icono y explicación del motivo.
5. Distinguir claramente los estados **sugerido, pendiente, confirmado, corregido y descartado**.
6. Evitar advertencias duplicadas, contradictorias o que permanezcan abiertas después de resolverse.
7. Actualizar inmediatamente los indicadores cuando el vendedor modifica un valor, lo confirma o revierte una corrección.
8. Impedir el guardado si permanecen pendientes críticos sin resolver. Las advertencias informativas no deben bloquear operaciones válidas.

**Criterio de aceptación:** si el NLP advierte sobre un precio, medida, material, cantidad o componente, el vendedor identifica exactamente qué campo debe revisar y puede resolver la observación desde ese mismo formulario.

## 3. Corregir navegación, resaltados y acciones de resolución HITL

La auditoría encontró casos donde las advertencias se vinculan a acciones o destinos que no corresponden a controles resaltables.

**Correcciones requeridas:**

1. Revisar todas las resoluciones tipadas del Backend, especialmente `ESPESOR_SIN_COMPONENTE`, `MISSING_UNIT`, `MISSING_AXIS`, `DIMENSIONES_NUEVAS` y `CONFLICTING_VALUES`.
2. Garantizar que cada pendiente crítico tenga una acción concreta para resolverlo.
3. Permitir que «Revisar campo» navegue y enfoque correctamente el control correspondiente.
4. Cuando la solución requiera crear una medida, componente o atributo, resaltar también el control o botón que permite realizar esa acción.
5. No limitar el resaltado a `input`, `select` y `textarea` cuando existan controles interactivos relevantes.
6. Mantener correctamente el vínculo de las advertencias con componentes dinámicos, aunque estos se agreguen, eliminen o reordenen.
7. No considerar resuelta una advertencia únicamente por pulsar «Confirmar»: comprobar que exista un valor válido o una resolución explícita.
8. Permitir descartar una propuesta con motivo justificado cuando el tipo de pendiente lo permita, sin convertir el descarte en una forma de saltarse validaciones comerciales obligatorias.
9. Verificar que una observación vuelva a abrirse si el usuario revierte una corrección que la había resuelto.

**Criterio de aceptación:** ninguna advertencia crítica debe quedar sin un mecanismo funcional y comprensible de resolución.

## 4. Fortalecer la trazabilidad y evitar registros duplicados

Se identificó que `revision_humana_voz` puede incorporar reiteradamente decisiones previamente registradas cuando un mismo formulario se guarda varias veces.

**Correcciones requeridas:**

1. Evitar duplicar confirmaciones, correcciones y descartes de una misma interpretación.
2. Utilizar identificadores estables para relacionar cada decisión con la captura, interpretación, evidencia y campo correspondiente.
3. Conservar los motivos de descarte, los valores originales y los valores finalmente confirmados cuando corresponda.
4. Garantizar que nuevas correcciones no sobrescriban indebidamente decisiones históricas.
5. Validar en Backend la estructura, los permisos y la coherencia de los datos de revisión enviados por Frontend.
6. No confiar exclusivamente en el JSON construido por el navegador como evidencia de auditoría.
7. Comprobar idempotencia, guardados repetidos, reintentos y modificaciones posteriores sin generar registros inconsistentes.

**Criterio de aceptación:** guardar repetidamente una ficha sin nuevas decisiones no debe generar duplicaciones, y cada corrección o descarte debe mantener su relación con la evidencia correspondiente.

## 5. Automatizar la transcripción inmediatamente después del audio

**Este es un requisito funcional importante que debe quedar exactamente como se describe.**

Actualmente se requiere pulsar «Transcribir audio» después de finalizar una grabación o seleccionar un archivo. El comportamiento deseado es diferente.

**Flujo definitivo:**

1. El vendedor graba o selecciona un archivo de audio.
2. Al finalizar la grabación o completar la selección y validación del archivo, **se inicia automáticamente el ASR**, sin requerir un botón adicional.
3. Mientras se procesa, mostrar un estado de transcripción comprensible.
4. Al terminar, presentar inmediatamente el texto reconocido dentro del Drawer, con la puntuación y normalización disponibles.
5. Permitir al vendedor editar palabras, números, cantidades, medidas, precios o especificaciones.
6. **No ejecutar NLP todavía.**
7. Ejecutar NLP únicamente cuando el vendedor pulse «Procesar texto».
8. Mostrar la propuesta estructurada y sus observaciones.
9. Aplicarla al formulario únicamente después de pulsar «Aplicar propuesta».
10. Una vez aplicada, ocultar la transcripción libre y continuar la revisión en los campos estructurados.

Mantener la posibilidad de reproducir el audio cuando esté disponible, sin imponer una confirmación adicional que retrase la transcripción automática.

Revisar especialmente cancelaciones, errores, cambios de archivo, grabaciones sucesivas, solicitudes duplicadas y respuestas asíncronas antiguas.

**Criterio de aceptación:** finalizar una grabación válida debe llevar automáticamente a la transcripción editable, pero nunca a una interpretación NLP automática ni a una modificación prematura del formulario.

## 6. Auditoría preventiva de los flujos relacionados

No limitarse a corregir literalmente los cinco puntos anteriores. Revisar también los comportamientos directamente relacionados para detectar fallos que podrían reaparecer después de las modificaciones.

Comprobar:

1. Que todas las reinterpretaciones mantengan el identificador ASR original.
2. Que cancelar o iniciar una nueva captura invalide las propuestas antiguas.
3. Que los formularios no pierdan datos previamente introducidos.
4. Que una propuesta vacía o inválida nunca pueda aplicarse.
5. Que los atributos aceptados, pendientes y descartados mantengan correspondencia con las evidencias reales.
6. Que los formatos móviles, la conversión a WAV y los límites de audio continúen funcionando.
7. Que los módulos de Catálogo y Muebles a Medida utilicen criterios coherentes de revisión, sin alterar sus reglas comerciales particulares.
8. Que la interfaz muestre mensajes claros cuando el NLP no consiga generar una propuesta.
9. Que la aplicación de una propuesta no deje transcripciones libres duplicadas en el formulario.
10. Que los cambios no afecten a las capturas históricas ni a los flujos legados compatibles.

Corregir cualquier defecto comprobable de este mismo alcance antes de declarar finalizada la intervención.

## 7. Pruebas exhaustivas y criterios de cierre

Ampliar las pruebas existentes y ejecutar una verificación integral después de todas las correcciones.

**NLP:**

- Pruebas positivas y negativas de nombres explícitos, nombres nuevos y coherencia de categoría.
- Regresiones de muebles, catálogo, dimensiones, precios y rectificaciones.
- Comprobación de abstenciones y ausencia de atributos inventados.

**Backend:**

- Separación efectiva ASR/NLP.
- Trazabilidad de reinterpretaciones y revisiones.
- Permisos, idempotencia, validaciones de datos y registros repetidos.
- Compatibilidad del paquete NLP instalado y contratos OpenAPI.

**Frontend:**

- Transcripción automática al finalizar grabaciones o seleccionar archivos válidos.
- Edición de texto previa al NLP.
- Propuestas y respuestas obsoletas.
- Señalización, navegación y resolución de advertencias.
- Guardado, corrección, reversión y descarte.
- Compatibilidad de audio y funcionamiento de ambos formularios.

**Verificación integral:**

1. Ejecutar las suites unitarias, integración y E2E correspondientes.
2. Incluir pruebas de accesibilidad para los nuevos estados y controles visuales.
3. Ejecutar lint, formato, typecheck y build.
4. Comprobar OpenAPI y generación de tipos del Frontend.
5. Verificar los contratos entre los tres repositorios.
6. Si cambia el NLP, generar una nueva versión y su artefacto, actualizar el Backend y comprobar checksum, lockfile y paquete realmente instalado.
7. No modificar ni sobrescribir artefactos de versiones anteriores.
8. Revisar el E2E históricamente omitido y determinar si puede habilitarse; documentar su causa si continúa omitido.
9. Comprobar los escenarios completos con datos válidos, inválidos y parcialmente corregidos.
10. Repetir las verificaciones después de la última modificación, no solamente durante el desarrollo.

**No cerrar el trabajo con pruebas fallidas o problemas conocidos relacionados con estas correcciones.**

## 8. Entrega final

- Mantener las modificaciones en `feat/voice-hitl-review` de cada repositorio.
- Crear commits correctivos identificables, conservando el historial anterior.
- Actualizar `docs/voice-hitl-corrective-verification.md` y los registros técnicos correspondientes.
- Documentar los escenarios efectivamente comprobados, las pruebas ejecutadas y sus resultados.
- Incluir los commits finales, versiones, checksums y estado de los worktrees.
- Diferenciar las verificaciones realizadas de las que no pudieron ejecutarse.
- No crear PR, publicar paquetes ni fusionar a `main` sin autorización.

### Condición para considerar terminada la intervención

Antes de finalizar, realizar una revisión crítica de los propios cambios como si se tratara de una auditoría independiente.

Comprobar expresamente que **cada defecto identificado está corregido, que su prueba de regresión falla con el comportamiento antiguo y pasa con el nuevo, y que la solución no provoca un problema equivalente en otro módulo o etapa del flujo**.

No basta con que las suites existentes pasen: los escenarios problemáticos señalados deben quedar cubiertos por pruebas específicas.

El objetivo es entregar las tres ramas funcionalmente completas, compatibles entre sí y listas para una revisión final previa a los PR, sin dejar correcciones parciales ni problemas conocidos dentro de este alcance.

Plan: ~900–1500 authored lines in coherent corrective units. Existing local branches only, PR slicing deferred because prohibited. Parallel independent frontend HITL and NLP/backend units, parent owns auto-ASR and git. Earlier manual ASR confirmation superseded by D5.

Definitive correction evidence (in progress): U1 automatic-ASR regressions initially RED 5/6, empty-ASR RED 1/8, current GREEN 9/9; related staged tests GREEN 35, real-codec browser/Axe GREEN 5. U2 writer RED 8/22 against baseline, current pre-review unit suite GREEN 387; attachment-freezing E2E re-enabled using current fixtures only. Independent frontend sweep: unit 387, browser 115 (zero skips), type/build/contract/ESLint passed; found three D4 blockers (B→C→B transition loss, missing nested catalog audit, rejected candidate IDs) plus lint/format issues. One parent correction batch: new regression RED 3/7 then GREEN 16 including ASR9, full lint/format GREEN; limited independent recheck/final suites pending. Original-value restoration on edit/reload verified present. Real integration specs updated from obsolete auto-NLP/apply assumptions to explicit staged flow; live disposable-stack verification pending. Final NLP candidate 0.1.28 has additional exact microphone-test phrase negatives; authoritative final artifact/source/installed/backend results pending writer handoff. No completion claimed yet.

Definitive closure evidence: NLP source/installed 1185 each; backend final704; frontend397 unit/115 browser (zero skips); independent API78 plus final audit23, NLP197; parent197/23/33. Real local audio integration8 and offline CPU240s ASR26.53s (638 chars/9 segments); final display-only snapshot recheck recorded in main report. Specific RED→GREEN added for null UI sentinels, raw/serialized values including booleans and whitespace, pointer/blur identity, legacy warnings, stored notes and valid zero-price/inch policies. The old backend with its actual .27 wheel accepted a forged pending (HTTP201), a valid behavioral RED. Actual authoring exceeded forecast because trusted history/validation and cross-module regressions are coupled; no tests omitted or code compressed. No PR/publish/push/main merge. Detailed results, artifact SHA and visual/ASR evidence: docs/voice-hitl-corrective-verification.md and docs/evidence/. All source work units and closure checks are complete; owned services, PostgreSQL and disposable scratch were stopped/removed. Durable sanitized evidence is committed; original checkouts/caches were not cleaned or modified. Final branch/main and clean-tree readback accompany the delivery metadata commit.

Final exact-source closure: independent frontend397/115 plus all static/build/contracts passed; real-audio rerun8/8 passed in4.1m on the matching source hashes, and refreshed audit23/23 passed. Baseline-only OpenAPI naming warning remains informational. Physical microphone/field WER and remote CI were not executed; MediaRecorder, local workers and offline CPU Whisper were real. ASR240s evidence is current, not the prior benchmark. No related failed/skipped check or known functional blocker remains. Source commits: frontend5bafb69/74a1e49, backenddd21735/3d6d728, NLP50216e5. No PR, publication, push or main merge.
