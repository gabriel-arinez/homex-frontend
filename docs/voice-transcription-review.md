# Review speech before commercial interpretation

Catalog products and custom furniture now share the same staged workflow in their existing side drawer. Existing form data stays unchanged until **Aplicar propuesta**.

## Seller workflow

1. Record up to four minutes, or select an audio file (up to five minutes and 20 MB).
2. Listen to the audio; discard/repeat it or select **Transcribir audio**. This request sets `solo_transcribir: true`: the backend runs ASR without NLP.
3. Review and edit the transcript, including quantities, dimensions, prices and names. The original ASR transcript remains available as audit evidence.
4. Select **Procesar texto**. Only the edited text goes to NLP, linked through `captura_origen`; the audio is not retranscribed.
5. Review extracted attributes and real candidate evidence. Accepted, unresolved and rejected spans are shown only when their exact offsets and literal text match the submitted transcript.
6. Select **Aplicar propuesta** to update the structured form once. Free transcript editing is then hidden. Continue with the structured fields, correcting or confirming field observations before saving.

## Input and asynchronous guarantees

- Recordings shorter than two seconds are rejected locally; the backend also measures decoded audio. Upload metadata checks are advisory when the browser cannot decode a format; server validation remains authoritative.
- A probable-silence notice is advisory, never a hard low-volume rejection.
- Text must contain at least one letter and remain within the backend's 20,000-character contract. Commercial sufficiency belongs to NLP, not a frontend keyword heuristic.
- Editing text invalidates an older proposal and cancels its local waiter. Generation and abort guards prevent an obsolete response from being applied.
- The polling window is 22 minutes, longer than the CPU worker's default hard deadline. A browser timeout does not cancel the backend job.
- ASR originals and corrected text remain in backend capture records. Hiding the editor after application does not delete audit evidence.
- There is one catalog application event (`applied`). The parent never extracts prices or colors with its own regular expressions.

## Verification

The feature log is `odd/tasks/voice-hitl-review.md`. Unit tests cover staged requests, explicit confirmation, abstention, stale responses, input bounds, literal span matching and field review. Long decoded WAV validation is distinct from real CPU Whisper inference: report the latter separately when no real model/audio fixture is available.

## Final verification evidence

The original implementation passed 338 unit tests and 110 browser tests. The corrective audit passed 369 unit tests and 114 browser tests; one existing attachment-freezing E2E remains explicitly skipped. Lint, typecheck, production build and generated OpenAPI contract checks passed. Browser tests use controlled API fixtures; backend/API and installed NLP artifact tests run separately against disposable PostgreSQL.

A real cached Whisper-small model also processed 240.0 seconds of locally synthesized Spanish speech using CPU/int8 and four threads, without network access. ASR took 42.32 seconds and produced 2,807 characters over 29 timestamped segments, with the final segment ending at 239.28 seconds. The ASR-only backend stage made no NLP or commercial writes; a subsequent explicit text request ran NLP without repeating ASR and preserved the complete transcript/origin link.

This demonstrates long-audio pipeline continuity, not perfect recognition or human-microphone accuracy: the synthetic closing word “Cierre” was recognized as “Sierra”, among other ASR errors. Those errors remain editable before interpretation. Remote CI was not triggered; its applicable checks were run locally.

## Corrective audit

Reinterpreting edited text keeps one stable original audio capture ID rather than chaining successive interpretation IDs. Each text execution still has its own capture/result. The original ASR transcript and edited execution text remain distinct.

Starting a recording or opening the file chooser immediately invalidates the previous proposal. Applying requires the exact currently interpreted text and current operation generation, with no recording, microphone request, audio preparation, transcription or interpretation in progress. Cancelling preserves valid prior text/form data but never automatically restores an old proposal. A transcript obtained before a terminal validation error remains editable when available.

The server accepts WAV, MP3, M4A, OGG and WebM natively. AAC, Opus, MP4 and FLAC uploads are converted to WAV in browsers capable of decoding them. Unsupported conversion is rejected before submission with a clear compatible-format alternative; there is no silent fallback to an extension rejected by the server. Full decoded duration must remain between 2 and 300 seconds. PCM size is checked before allocation and must remain under20MB; large decompressed stereo files are rejected explicitly rather than silently downsampled or truncated.

Proposal review uses commercial attribute groups, real option names and contextual pending indicators instead of technical JSON. Missing/null attributes are not invented. Exact transcript-evidence highlighting and explicit reinterpret/apply controls remain unchanged. See [field-resolution audit notes](voice-hitl-corrections.md) for the form-level resolution rules.
