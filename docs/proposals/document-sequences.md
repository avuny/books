# Proposal: document_sequences table

**Problem.** Purchase order numbers are max-suffix + 1 with an insert retry on `number_taken`. Under load this retries, and gaps or reuse after deletes are possible. Every document module (SO, invoice, bill) will need the same thing.

**Change.** Add `document_sequences(organization_id, kind, year, next_value)` and one `nextDocumentNumber(orgId, kind)` helper using an atomic `UPDATE ... RETURNING`. Modules call it instead of scanning.

**Cost.** One migration and one shared helper. Existing numbers continue from the current max.
