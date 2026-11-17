# Corrective voice/HITL audit

The existing staged Drawer architecture and prior commits are preserved. Corrections were made only on `feat/voice-hitl-review`; no PR, publishing or main merge was performed.

## Definitive automatic-ASR correction

Valid recording completion or validated file selection now starts ASR automatically in the shared Drawer. There is no additional transcription confirmation. Playback remains available separately from pending submission; retry is explicit only after a failure or cancellation. Empty ASR results explain the problem without enabling NLP or application.

NLP still requires **Procesar texto**, and form mutation still requires **Aplicar propuesta**. Generation, current-text and busy-state checks invalidate old proposals and ignore cancelled/stale requests. Applying hides the free transcript and playback editor while retaining server evidence.

Specific automatic-ASR tests observed RED before implementation and now pass all nine scenarios. Positive/negative staged component checks, mobile browser codecs and accessibility checks pass. Full cross-component closure evidence is recorded in the task log and completed with the human-review correction.

## Corrected behavior

| Finding                                          | Main implementation                                                                                                                                                                                |
| ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Successive interpretations changed audio origin  | `StagedVoiceCapture.vue` separates stable ASR identity from the last text-only interpretation; backend canonicalizes real ASR ancestry while preserving legacy text-only links.                    |
| Obsolete proposals remained actionable           | Immediate invalidation, exact text/generation apply guard, busy-state checks and instance-scoped cancellation.                                                                                     |
| Mobile extensions could fail server upload       | Existing WAV encoder restored for AAC/Opus/MP4/FLAC, decoded-duration and preallocation-size guards, explicit codec/browser errors before submission.                                              |
| Pending fields and visual confirmations diverged | `pendientesAsistencia.ts`, `EspecificacionForm.vue`, `ProductoForm.vue` and `fieldVoiceReview.ts` use actual valid values; navigation targets real controls; corrections/reversions update status. |
| Human discards lacked reliable identity          | Existing additive technical JSON stores original pending evidence, explicit reasons and assignment destinations, bound to the actual interpretation ID.                                            |
| Generic marker words created proposals           | NLP requires recognized commercial values or properly introduced identity, preserving legitimate brief/new names.                                                                                  |
| Technical JSON was seller-facing                 | `ProposalSummary.vue` displays commercial groups, real option labels, only present attributes and actual pending indicators.                                                                       |

## Previous correction verification (0.1.27)

| Component                                | Final result                  |
| ---------------------------------------- | ----------------------------- |
| NLP source and installed 0.1.27 artifact | 1,137 passed each             |
| Backend full suite                       | 681 passed                    |
| Frontend unit/component suite            | 369 passed                    |
| Browser suite                            | 114 passed, one existing skip |
| Independent backend / NLP checks         | 92 / 219 passed               |
| Parent backend / frontend spot checks    | 92 / 29 passed                |

Lint, formatting, typecheck, builds, schemas/OpenAPI drift, generated frontend contract, offline locks, reproducible artifact and installed-byte identity checks passed in their applicable project scopes. Mobile tests include real, locally generated synthetic tone files; they exercise conversion, not speech accuracy. Browser tests use controlled API fixtures. Backend tests use disposable PostgreSQL.

Regressions caught and corrected before delivery: ASR canonicalization initially changed legacy text-only links; Vue-proxied pending cloning raised `DataCloneError`; a generic confirmation action displaced explicit thickness assignment; the new summary initially assumed a complete technical fixture. Existing contract behavior and tests remain intact.

## Previous artifact compatibility (0.1.27)

Backend pins the new local `homex_nlp-0.1.27-py3-none-any.whl`, built with `SOURCE_DATE_EPOCH=0`. Runtime guard, locks, checksum gates and installed package files agree. The 0.1.25 and 0.1.26 wheels and checksum files are byte-identical to the correction baseline. OpenAPI shape is unchanged. Backend evidence: `docs/evidence/voice-hitl-corrective-review.json` in its feature worktree.

## Limits and remaining checks

- One preexisting attachment-freezing E2E is still explicitly skipped.
- No new physical microphone or actual-ASR benchmark was needed for the unchanged ASR implementation; prior synthetic long-audio evidence is retained, not represented as a new run.
- A clean offline worker-extra installation needs an uncached `ctranslate2` wheel. Existing cached ASR imports work; no download was attempted.
- Unscoped NLP Ruff findings under historical audit/docs paths reproduce at baseline; the applicable Makefile source/test/tool/training scope passes.
- Remote CI was not triggered; equivalent applicable checks ran locally.

The current feature worktrees are frontend's existing workspace, `../.worktrees/voice-backend` and `../.worktrees/voice-nlp`. Source changes are `feef4de`, `5fd9956`, `b3019f9` and `cb15f7e`; the shared task log records the full requirement and evidence history.
