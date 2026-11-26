# Proposal: batches under the hood

Status: proposal only. Nothing here is implemented except step 1. Needs the owner's approval before steps 2 to 4.

## Request (Khaled, 2026-11-26)
- Expiry tracking must not demand a visible "batch tracking" option (the checkbox was removed from the item form).
- Even items without expiry should use batches internally: a new batch per purchase receipt and per opening stock, and stock leaving (transfer, sale) draws from the oldest batch first.

## Today
- `items.is_batch_tracked`. Stock movements require a batch on every line of a batch-tracked item and none on others (`stock-movement.service.ts`). Balances live in `inventory_items` and `inventory_item_batches`. FIFO cost layers carry an optional `inventoryItemBatchId`.
- The web create form no longer shows the batch checkbox; creating an item with expiry failed the form rule. Step 1 (done) makes inventory-tracked items batch tracked automatically in the form and drops the batch condition from the web expiry rule. The server rule still says expiry needs batch tracking, which now always holds for tracked items.
- Purchase receipt (done): a receipt line of a batch-tracked item with no chosen batch creates batch `<receipt number>-<line>` (manufactured date = receipt date only for expiry-tracked items, expiry from the item's default shelf life).
- Opening stock already creates batches (`BAT-<date>-<rand>`).

## Proposed steps
1. (done) Web: no batch checkbox; inventory-tracked means batch tracked; expiry needs inventory tracking only. Receipt auto-creates a batch.
2. Server rule: set `is_batch_tracked = is_inventory_tracked` on create and update; drop the separate field from the contract later. Existing items with `is_batch_tracked = false` and stock need a backfill: create one batch per item (`LEGACY-<item>`), assign all `inventory_items` quantity to it in `inventory_item_batches`, and attach existing stock movement lines and cost layers to it. This touches existing prod stock rows and is the risky part.
3. Issue allocation: when an outbound line (transfer, adjustment out, sale) has no batch, the stock movement service splits it across batches oldest first (by received date, or by expiry first for expiry-tracked items: FEFO). A line is split into one line per batch, so each line has one batch.
4. Costing: FIFO layers already allocate oldest first. Batch order and layer order can differ (a batch can have several layers). Proposal: keep costing as is (layer based), and let batches only decide which physical lot leaves. Total cost of an issue is unchanged by this change.

## Risks and open questions
- Backfill (step 2) rewrites balances for every existing stock item. Needs a dry run on a copy and a prod approval, and a rollback script.
- Splitting lines changes how many movement lines an issue produces. Reports and reversal code that assume one line per requested line must be checked.
- Quarantine and blocked batches must be skipped by auto allocation.
- Negative stock: items that allow negative stock have no batch to draw from; use an "unbatched" bucket or the newest batch (decision needed).
- Choose FEFO vs FIFO for items with expiry (recommended: FEFO).

## Status (feat/batches-always-on)

Built: allocation rule (`allocateBatches`, FEFO for expiry-tracked, FIFO otherwise, one line per batch, shortfall fails), auto-allocation of unbatched issues in the stock-movement service, `is_batch_tracked` follows `is_inventory_tracked` on create and update.

Backfill: `packages/db/scripts/backfill-legacy-batches/` (`backfill.sql`, `rollback.sql`, `report.sql`, `run.ts` with `dry-run | apply | rollback`). Checked on pglite with fixtures: counts, no on-hand mismatch, re-run is a no-op, rollback restores the exact prior state. NOT run on production; needs the owner's OK. Run `dry-run` against prod first and read the report.
