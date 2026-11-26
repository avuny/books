# Proposal: line-item endpoints

**Problem.** Purchase orders replace all lines on update (PUT with the full line array). Large orders and concurrent editors overwrite each other.

**Change.** Add `POST/PATCH/DELETE /purchaseOrder/{id}/lines/{lineId}` with draft-only checks and recomputed totals.

**Cost.** Six routes, service methods and tests. Not needed for v1.
