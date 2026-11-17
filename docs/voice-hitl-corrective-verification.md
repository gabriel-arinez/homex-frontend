# Definitive ASR, NLP and HITL verification

The requested correction is complete on the existing `feat/voice-hitl-review` branches. The staged architecture and previous commits are preserved. No PR, package publication, push or main merge was performed.

## Verified seller flow

**Valid audio → automatic ASR → editable transcript → explicit Procesar texto → structured proposal → explicit Aplicar propuesta → structured form only.**

ASR does not run NLP. Editing/reinterpreting text does not repeat Whisper. Recording, conversion and processing invalidate old proposals immediately; only the current text/generation can be applied. Applying removes free transcription from normal editing without deleting server evidence.

## Corrections and principal files

| Finding                                               | Correction / main files                                                                                                                                                                                                                                       |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Explicit names bypassed commercial validation         | `homex-nlp/src/homex_nlp/catalog.py`: prefix-independent rejection, real attribute values, primary-product category contradictions, open-vocabulary new names. Related nouns do not falsely change the primary category.                                      |
| Audio required another transcription click            | `StagedVoiceCapture.vue`, `AudioReview.vue`: automatic ASR after valid recording/file preparation, independent playback, explicit retry, empty-ASR explanation, cancellation/generation protection.                                                           |
| Accepted attributes missed commercial review          | Typed backend `field_reviews`, `ProductoForm.vue`, `EspecificacionForm.vue`: source warning/evidence/field linkage, contextual reasons, suggested/pending/confirmed/corrected/discarded states and critical-only blocking.                                    |
| Creation actions and dynamic fields were unreviewable | `fieldVoiceReview.ts`, `EspecificacionForm.vue`: input/select/textarea and action controls; section/focus navigation, populated-dimension creation, component UID stability and real resolution/reversion checks. Existing pending validators are reused.     |
| Repeated saves duplicated or lost decisions           | Shared audit helpers preserve latest-state idempotence and distinct B→C→B transitions. Nested specifications, accepted-only evidence, raw null originals and actual serialized final values are recorded.                                                     |
| Browser metadata was not authoritative                | Backend `apps/capturas/revision_voz.py`, catalog serializers/model/migration and proforma services validate ownership, context, immutable attempt/origin, source values, actual evidence, history and saved values. Historical decisions cannot be rewritten. |
| Real clicks silently failed                           | Equivalent directive updates no longer replace a confirmation button between pointerdown and click. Actual control references are checked so dynamic replacements still rebind.                                                                               |
| Valid manual operations became invalid with audit     | Backend final-value projection includes notes and category fields. Catalog zero-price policy and supported inch dimensions remain compatible with manual operations; furniture positivity rules remain intact.                                                |
| Resolved warnings remained visible                    | Populated textarea review works; legacy duplicate strings are removed only when tied to the same real field reason. The voice-only blocking alert clears after the final critical resolution; unrelated information remains.                                  |

The existing 2-second minimum, 240-second microphone maximum, 300-second upload maximum, 20 MB limit, mobile-to-WAV conversion and coherent text limits remain covered. No price/color interpretation regex was reintroduced into the form.

## Final executed checks

| Component / scope                                          | Final observed result                                                                        |
| ---------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| NLP full source suite                                      | **1,185 passed**                                                                             |
| NLP full suite against actual installed .28 wheel          | **1,185 passed**                                                                             |
| Backend full suite after final normalization               | **704 passed, zero skips**                                                                   |
| Frontend unit/component suite                              | **397 passed, 67 files**                                                                     |
| Mocked browser suite, including accessibility              | **115 passed, zero skips**                                                                   |
| Real local ASR/API/Redis/Celery/browser integration        | **8 passed**: SILLA/PISO_FLOTANTE/OTRO upload and recording, furniture save and cancellation |
| Independent NLP regression subset                          | **197 passed**                                                                               |
| Independent backend public API/audit/legacy/package subset | **78 passed**, plus final refreshed **23 audit tests passed**                                |
| Parent focused checks                                      | NLP **197**, backend audit **23**, frontend **33** passed                                    |

Applicable lint, formatting, typecheck, production build, offline lock, Django system/migration checks, extraction schemas, OpenAPI drift and frontend type generation/checks pass. The frontend OpenAPI snapshot is byte-identical to the backend export. Full checks ran after source normalization; later changes only record documentation/evidence.

Frontend commands include `npm run test:unit -- --run`, `lint:check`, `format:check`, `type-check`, `build`, `contract:check` and `test:e2e`. Mocked browser runs use an explicit local API origin; Vitest runs without that override. Live tests use isolated synthetic PostgreSQL, Redis, workers, API and cached CPU Whisper, not production services or ambient credentials.

### Regression and critical-review evidence

- Matched historical NLP baseline: **24 expected failures / 20 passes** in 44 selected final tests, including explicit greetings, category contradictions and exact microphone-test phrases. Current cases pass; brief legitimate and novel names remain valid.
- Matched historical backend plus its actual .27 wheel: the forged-pending regression accepted HTTP 201 and persisted a proforma; the final implementation rejects it atomically. A mismatched-runtime setup attempt was excluded from RED evidence.
- Specific frontend RED → GREEN tests cover automatic ASR, empty ASR, transition history, nested/boolean attributes, rejected candidate IDs, notes, missing originals, trimmed final values, stable pointer controls, negotiated-price null and resolved legacy warnings.
- Real integration exposed issues synthetic clicks missed: blur-driven DOM replacement, UI-empty versus source-null audit values, and missing stored notes during validation. These were corrected, not bypassed with forced DOM clicks.
- Stale integration fixtures assumed automatic NLP/application, permanent original-description cards and short fake recordings. They now use explicit stages, actual WAV duration and valid partial-ASR outcomes without requiring invented optional attributes. The historically skipped attachment test is re-enabled using current Studio/gallery fixtures; no gallery production behavior changed.

### Four-minute CPU proof and visual evidence

The final installed `.28` public `homex-asr` CLI decoded a **240.000-second**, mono 16 kHz synthetic WAV offline on cached CPU/int8 Whisper in **26.53 seconds**: **638 characters, 9 segments**, including late audio. Whisper timestamps are approximate (last segment 241.0 seconds); decoded duration is independently 240.0 seconds. This run executed ASR only.

- [Sanitized benchmark result and fixture checksum](evidence/voice-hitl-asr-240s.json)
- [Proposal before application](evidence/voice-hitl-before-apply.png)
- [Structured form after application and confirmation](evidence/voice-hitl-after-apply.png)

Both screenshot states were visually inspected. Free transcription is absent after application, price is confirmed, and neither the duplicate price warning nor the obsolete voice-blocking alert remains. Full-page captures reflect the current scroll position of fixed navigation; they are voice-flow evidence, not a global navigation redesign.

## Package compatibility and change control

New local package: **homex-nlp 0.1.28**.

Wheel: `homex_nlp-0.1.28-py3-none-any.whl`.

SHA256: `abf68e16979c9cdf64eff534051798cec3a12b9d27672fd0f9fcd4805e825fea`.

Canonical builds use `SOURCE_DATE_EPOCH=0`; wheel/sdist reproducibility was checked. Vendor, checksum file, lock, adapter guard, operational pins, metadata and installed bytes agree. Operational verification checked 35 installed files; independent comparison checked all 27 packaged Python files. Historical .25/.26/.27 artifacts remain unchanged.

Source work-unit commits:

| Repository | Corrective commits                                                                            |
| ---------- | --------------------------------------------------------------------------------------------- |
| NLP        | `50216e5` — commercial names/category coherence and .28                                       |
| Backend    | `dd21735` — trusted review history/package/schema; `3d6d728` — supported manual measure units |
| Frontend   | `5bafb69` — automatic ASR; field/audit commit recorded in the final task log                  |

Worktrees: frontend workspace, `../.worktrees/voice-backend`, `../.worktrees/voice-nlp`. All remain on `feat/voice-hitl-review`. Local source/test commits deliberately keep coupled shared-form/audit behavior together; PR slicing remains deferred because PRs were explicitly prohibited. The complete request, task status and commit evidence are in `odd/tasks/voice-hitl-review.md`.

## Limits, not hidden passes

- No physical microphone/human field-speech accuracy or WER assessment was performed. Browser MediaRecorder and ASR used synthetic fixtures; codec tests also exercise clear pre-upload rejection where a browser lacks decoding support.
- Remote CI was not triggered. Applicable checks ran locally; no package or model download was needed for the cached ASR verification.
- The sole OpenAPI `CategoryEnum` naming warning reproduces at baseline and has no validation errors. No new related failures, skips or known functional blockers remain.

Risk: items **1/2/3/4/5** — persisted audit, ownership/provenance, additive shared contracts, async/pointer ordering and coordinated package integration. Regression, independent, real-stack and final frozen-source checks cover these surfaces.
