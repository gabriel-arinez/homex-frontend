# Resolve voice observations in real fields

Voice observations remain separate from the NLP result. A correction resolves a pending observation only while the corresponding structured value remains valid. Reverting the value reopens the observation.

## Review path

1. Select **Revisar campo** to open the appropriate studio section and focus the actual dimension, component, general attribute, quantity or price control.
2. Complete the structured field. Missing general attributes are created through the existing attribute helper; component navigation selects the referenced piece by UID.
3. For an observation that does not apply, enter a reason and explicitly select **Descartar observación**. An invalid form still cannot be saved.

Thickness without an identified component requires an explicit compatible destination. Assigning it never overwrites a different thickness. Deleting a component does not silently resolve its observations.

## Evidence and persistence

Furniture uses the existing additive technical JSON and merge helpers. `revision_humana_voz` retains previous audit entries, the original pending list, and separate human decisions:

- `descartes`: original observation, index and nonempty human reason.
- `asignaciones_espesor`: original observation, index and selected component UID.

Each audit entry is bound to the real `captura_asistida_id` already carried by the line. Reopening restores decisions only for that trusted capture ID and the exact original pending list; missing or different IDs remain unreviewed. Changing the active capture clears local decisions. Thickness resolution also checks the current component value. This metadata records human review; it does not rewrite NLP decisions, warnings or evidence.

Catalog warnings remain visible after application as informational messages. Unresolved labeled evidence remains attached to its real control; confirmation requires a valid current value. Invalidating or reverting a correction restores pending attention. Original capture evidence remains unchanged.

Only unresolved critical observations block saving. Informational warnings remain visible without preventing otherwise valid manual entries.

## Verification

Public form/service tests cover dimension units and axes, dynamic attributes and component focus, quantities and prices, incompatible thickness assignment, explicit discard persistence/reopening, warning retention, valid manual saving, correction reversion, and accessible field-label preservation.
