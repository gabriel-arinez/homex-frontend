# Scoped commercial proposal review

Legacy capture review consumes the optional read-only configurator projection from the selected persisted NLP attempt. Explicit unit prices and component-scoped technical data now reach the editable review form instead of being discarded. This is still a proposal: no capture is automatically confirmed, approved or applied to stock.

## Review behavior

- `proyeccion_configurador` reuses the assisted configurator DTO. The original legacy capture fields remain available; responses without metadata keep the historical manual-review fallback.
- The technical JSON retains component dimensions, materials and source relationships. Only projected main-product dimensions populate the legacy main-dimension correction.
- Main-dimension `{valor, unidad}` records become identical `value unit` strings in both duplicate correction representations. This preserves the backend's contradiction guard without assigning component measures globally.
- Component thickness/accessories are not copied into global correction fields. Technical data is JSON-cloned before normalization; Vue reactive proxies are not passed to `structuredClone`.
- Only explicit `comercial.precio_unitario` fills unit price. Negotiated totals and missing units remain visible pending warnings; no division, rounding or unit inference is used to invent inputs.
- `proyeccion_error` is shown explicitly. A malformed historical result is not advertised as a successful structured recovery.

## Verification

Three focused UI regressions cover component scope/explicit price, negotiated total abstention and explicit projection error. Existing no-metadata tests retain the manual workflow. The real-stack regression `scoped text proposal retains component measures and explicit unit price through HITL` uses new controlled wording through public text capture and confirmation, including the unchanged BORRADOR boundary.

Run against an isolated prepared backend and the exact pinned consumer wheel:

```bash
VITE_API_BASE_URL=http://localhost:8000 npm run test:unit -- --run src/tests/fe06/capturas-hitl.spec.ts
npm run type-check
npm run lint:check
npm run contract:check
HOMEX_INTEGRATION_API_URL=http://127.0.0.1:8000 npm run test:integration -- src/tests/integration/fe08-real.spec.ts --grep 'scoped text proposal'
```

Prepare only disposable local integration data; never run fixture scripts on production. Full test/CI outcomes are recorded separately for the exact committed revisions. Development-corpus playback and synthetic TTS are not independent human acoustic validation.

Risk: item 3 (shared capture review and an additive consumed API projection).
