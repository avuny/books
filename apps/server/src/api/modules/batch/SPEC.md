# Batch Module — Specification
> Update this file whenever a requirement changes: new error code, rule or behavior.
> Internal module: no HTTP routes yet. Other modules call the service.

## 1. Purpose
A batch (lot) is one production or supply lot of an item, identified by the number printed on the goods.
It carries the dates and the operational status that decide what may be done with its stock. The stock
movement lines and balances point at batches; nothing here holds quantities.

## 2. Domain Model
`batches`: id, org_id, item_id, batch_number, manufactured_on (date), expires_on (date), status, notes, timestamps.

| Status | Receive into | Issue (sale, assembly, return to supplier) | Move and adjust |
|---|---|---|---|
| available | yes | yes | yes |
| quarantined | yes | no | yes |
| blocked | no | no | yes |
| recalled | no | no | yes |

## 3. Business Rules & Policies
1. The batch number is trimmed and unique per item, case-insensitively (`ux_batch_org_item_number`).
2. Dates are real calendar days (YYYY-MM-DD); the expiry is not before the manufacturing date (`BATCH_DATES_INVALID`). The number is 1 to 100 characters (`BATCH_NUMBER_INVALID`).
3. `ensureBatches` finds or creates the batches of one item: the same number twice is one batch, contradicting details are a conflict (`BATCH_DETAILS_CONFLICT`), an existing batch is reused and never changed, and the item's batches are locked meanwhile. At most 1000 per call (`BATCH_TOO_MANY`); an unknown item is `BATCH_ITEM_NOT_FOUND`.
4. `changeStatus` needs a different status (`BATCH_STATUS_UNCHANGED`) and is audited (`batch.status_changed`) after commit. Stock already in the batch stays where it is.
5. Batches are never deleted. Whether an item is batch tracked is enforced by the stock movement service, not here.
6. Posting rules per status live in `batchAllowsIntent` (contracts) and are applied by the stock movement service for forward postings; reversals are exempt.
7. Composite FKs from stock rows use `(org_id, item_id, id)`, so a stock row cannot name another item's batch.

## 4. Error Codes
`BatchErrorCode` in contracts, with en/ar messages. HTTP mapping is added together with the routes.

## 5. Not here yet
Expiry handling (blocking expired stock, first-expiry-first-out picking, expiry alerts), serial numbers, supplier lot numbers, certificates, routes, permission keys (register `batch` in `modules/registry.ts` with the `status_changed` event when routes arrive).

## 6. File Structure
```
batch/
├── SPEC.md  index.ts  deps.ts  testing.ts
├── batch.types.ts  batch.mapper.ts  batch.repository.ts  batch.service.ts
└── batch.service.spec.ts
```
Contracts: `packages/contracts/src/batch/`. Database: `packages/db/src/schema/inventory/batch.ts`.
