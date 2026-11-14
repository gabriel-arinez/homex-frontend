# Lossless legacy capture review boundaries

The review form must preserve the same main-product dimensions in the human
correction and technical JSON. Backend confirmation rejects contradictions
between these representations; that check is not weakened.

- Existing strings and simple `{valor, unidad}` objects retain their established
  legacy string representation. Finite numeric `valor` with an explicit text
  unit is also supported.
- Objects with metadata and incomplete/unknown representations remain intact in
  both JSON fields. No unit is assigned, metadata removed or source object mutated.
  Producer warnings remain visible; retaining JSON is not resolving ambiguity.
- The legacy confirmation DTO accepts only V1 axes with string values. Rich or
  unresolved dimension JSON is retained visibly but blocks both the button and
  submit handler until the operator explicitly resolves both representations.
  Metadata must be preserved as attributes when resolving; no automatic relocation
  or unit inference is performed. Retaining unknown JSON is not a promise that the
  current confirmation endpoint accepts it.
- Component dimensions and attributes remain scoped and untouched.
- A projected discount is visible but cannot be confirmed through this legacy
  endpoint, whose contract has no discount field. Confirmation is disabled and
  the submit handler also refuses it. Resolve it in a compatible commercial
  workflow; do not silently omit it or add an unsupported payload field.
- Current backend serializers emit projection/null and projection-error/false
  fields even for historical capture records. Supporting older server versions
  is a separate compatibility policy, not grounds to weaken the current schema.

Both CI consumer checkouts use the same explicit `integration_peer_ref` override
or default to backend `a4c9cfc25077ba11e281e52cf1e993ea2e145538`.

## Verification

```sh
VITE_API_BASE_URL=http://localhost:8000 npm run test:unit -- --run src/tests/fe06/reviewProjection.spec.ts src/tests/fe06/capturas-hitl.spec.ts
VITE_API_BASE_URL=http://localhost:8000 npm run check:all
npm run build-only
npm run contract:check
```

The focused tests observed seven failures before the change and all 23 passed
afterward. The existing string/component and null-discount review paths remain
covered. The seven new automatic comments were classified before source edits;
classification is not a claim of acoustic correctness or commercial precision.

Risk: items 3/5 (shared proposal normalization and exact-peer CI configuration).

## Structured observations

When a structured projection exists, its nullable observations initialize the
review and its confirmation payload. The legacy materialized observations are
used only without a projection. Both representations originate from the same
value in the ordinary fresh pipeline, but they are independently persisted and
the current public response permits divergence. Controlled API and UI regressions
cover differing values, nulls, equal values and no-projection fallback. Original
NLP evidence/materialized rows are not overwritten by this review initialization.
