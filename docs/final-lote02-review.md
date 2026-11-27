# Review partial voice proposals without promoting inferred facts

The editable transcript accepts any processable Unicode-letter text up to 3000
characters. A short commercial identity can be processed and applied even when
price, dimensions, material or color have not been dictated. The former 20-word
counter and gate are removed under final-lote02 S2/S12. Audio minimum duration,
recording/upload limits, transcription timeout and ASR behavior are unchanged.

## Suggestion handling

| Evidence                                                       | Form behavior                                                                                                                                                                            |
| -------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Explicit root dimensions                                       | Applied to their stated axes.                                                                                                                                                            |
| Inferred dimension units                                       | Proposed value/unit appear in typed review messages; concrete fields remain empty until human entry.                                                                                     |
| Mixed explicit/inferred component measurements                 | Explicit fields stay populated. Inferred axes use an optional axis marker and remain pending until that specific axis has a positive value and valid unit; other axes cannot resolve it. |
| Shared-unit component gauges                                   | An explicit gauge stays populated; an additional inferred gauge requires manual ownership assignment or an audited correction, never an automatic overwrite.                             |
| Quantity-one ambiguous amount                                  | Full amount and arithmetic-equivalence explanation remain a review message, not an explicit unit/total mode or price origin.                                                             |
| Quantity greater than one with ambiguous amount                | Amount remains visible; no unit price is invented.                                                                                                                                       |
| Material roles and lexical interpretations                     | Review messages distinguish domain classification and proposed recovery from what was actually spoken.                                                                                   |
| Explicit primary/secondary color combination                   | Both role-named attributes are retained, alongside consistent legacy color slots; not a conflict.                                                                                        |
| Color to be selected, unknown colors and per-side distribution | Retained as pending review evidence without inventing colors or multiplying counts.                                                                                                      |

The existing configurator mapper and typed-pending form consumers are reused.
The existing optional `resolucion.valor` string carries a component axis marker;
legacy requests without it keep their prior behavior. No generated API contract,
catalog identifier or price-origin enum is expanded. Backend validation checks the
same axis marker when admitting human review decisions. Original candidate text and offsets remain available.
Accessory materials are not propagated to their furniture parent. Bounded service
clauses remain in observations rather than copying the entire transcript into
structured attributes.

## Verification

`voice-input-validation.spec.ts` covers short/Unicode input, rejected blank or
numeric/punctuation-only input, 3000-character boundaries and unchanged audio
limits. `final-inferred-review.spec.ts` processes the four minimal text cases
through the staged component with transport fixtures, checks typed inferred-unit
review remains pending until explicit entry, and verifies both legacy color roles.
Backend tests use the real isolated POST → pipeline → GET path. Real browser/API
verification and full-suite/distribution proof are owned by the parent feature.
