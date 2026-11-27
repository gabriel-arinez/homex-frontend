# Validate reviewable monetary suggestions

The commercial form receives a quantity-one amount as a proposal, not an explicit
unit-price transcription. `PRECIO_AMBIGUO` stays critical until the existing
**Validar** control validates the positive current price. Editing it reopens review.

The existing voice audit records the trusted initial proposal and final value.
Unchanged amounts are `confirmado`; a different amount is `corregido`, including
when the operator presses **Validar** after editing. No commercial totals, discounts,
permissions, or master-data creation paths change.

Regression: `src/tests/prf04/residual-money-review.spec.ts` mounts the real form,
proves save is blocked before validation, and checks both audit states on save.
