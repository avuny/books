# Inventory costing: current architecture analysis

| | |
|---|---|
| Date | 2026-11-27 |
| Base | `main` at `7798f09` |
| Purpose | Ground truth for the Weighted Average Costing (WAC) spec and the cost integrity rule. Read before [`SPEC.md`](./SPEC.md). |
| Method | Read the code and schema. Nothing was run, built or tested. Where a fact comes from a comment and not from code, it says so. |

Paths are relative to the repo root. Line numbers are not given because `main` moves fast.

## 1. Summary

1. Costing today is FIFO only, and it is **not part of the stock engine**. The stock movement service moves quantities. Each calling module adds cost layers after it posts. Any module that forgets (inventory adjustment) leaves quantity with no cost.
2. `weighted_average` exists as an enum value on items and nowhere else. Every costing path assumes FIFO layers.
3. Cost is created in three places only: opening stock, purchase receipt and inventory transfer. Sales, sales returns and purchase returns are not built yet, so there is no cost-out path to a customer.
4. Several existing behaviours break the new rule "every stock-in has a valid cost": opening stock with no cost becomes zero, positive adjustments have no cost at all, adjustment losses never use up layers, and transfers ignore uncovered quantity. Section 10 lists them with the fix each needs.
5. The accounting side has one inventory account for all stock. The templates for COGS, returns and adjustments exist, but nothing feeds them a real cost yet (the adjustment posts amount 0).

## 2. Modules and who owns what

| Area | Where | Role in costing |
|---|---|---|
| Items | `packages/db/src/schema/item/item.ts`, `apps/server/src/api/modules/item/` | `inventory_valuation_method` enum (`fifo`, `weighted_average`, default `fifo`), `cost_price` (a default price, not a valuation), `allow_negative_stock`, `is_batch_tracked`, `is_expiry_tracked`. Method and tracking flags are locked once stock exists (`item.rules.ts` `changedLockedFields`). |
| Stock movements | `apps/server/src/api/modules/stock-movement/`, `packages/db/src/schema/inventory/stock-movement.ts` | Ledger of quantity. One header, many lines. Types: opening, purchase, purchase_return, sale, sale_return, transfer, adjustment, assembly_consume, assembly_produce. No cost columns. |
| Inventory items | `packages/db/src/schema/inventory/inventory-item.ts` | Quantity balance per (item, location). Batch child rows per (inventory item, batch). No value. |
| Cost layers | `packages/db/src/schema/inventory/inventory-costing.ts`, `inventory-costing/` module | FIFO layers per inventory item (so per location) and optional batch. Allocations record what each outgoing line took. |
| Batches | `batch` module | Lots with status and expiry. Cost layers can point at an inventory item batch row. |
| Accounting | `packages/contracts/src/accounting/`, `accounting` module | Posting templates by business event. Mapping keys to accounts. |
| Documents | `purchase-receipt`, `inventory-transfer`, `inventory-adjustment`, item opening stock | The only posters of stock today. |

Not built yet (docs only): sales order, sales delivery, sales invoice, purchase return, supplier return flows. The `sale`, `sale_return` and `purchase_return` movement types exist in the enum and in the sides table but no module posts them.

## 3. How a stock posting works

`stock-movement.service.ts` `commit` (one transaction owned by the caller):

1. Checks items (active, stock tracked).
2. For outbound lines of batch tracked items with no batch, splits across batches (FEFO for expiry items, FIFO otherwise). The mapping from request line to split lines is lost, which matters for costing (see assembly docs).
3. Checks batch status and expiry rules.
4. Checks each real location accepts the posting (stockable, pickable or receivable).
5. Locks every balance row the posting touches in one sorted order (deadlock guard for opposite transfers).
6. Checks enough stock where stock leaves. Items with `allowNegativeStock` may go negative, except at the transit location.
7. Inserts the header (unique `(org, source_type, source_id)` for non reversal rows), then lines, then applies balance deltas.

Facts that matter for costing:

- The engine accepts `postedAt` from the caller (opening stock and callers can backdate). The ledger time and the cost order are therefore not guaranteed to match.
- Reversal posts a new movement with from and to swapped, uses the "adjust" intent so it works on blocked locations, and still refuses to take stock below zero (unless the item allows negative stock).
- The engine returns the created lines with ids. Cost code uses those line ids as the source of layers and allocations.
- There is no cost parameter on a line and no cost check. A posting with stock-in and no cost succeeds.

## 4. FIFO implementation (what exists)

Schema (`inventory-costing.ts`):

- `inventory_cost_layers`: one layer per inbound line per pool (inventory item, optional batch). Columns: received qty and value, remaining qty and value, currency, `received_at`, `origin_cost_layer_id` (set on transfer derived layers). Checks: remaining within bounds, values non negative. Value is `bigint` minor units, quantity is numeric(18,6).
- `inventory_cost_allocations`: one row per (outgoing line, layer) with qty and value. The schema comment says append only. The code deletes rows when it restores (`restoreAllocationsOfLine` calls `deleteAllocation`).

Service (`inventory-costing.service.ts`), all integer math in millionths with `BigInt`:

- `createCostLayer`, `recordAllocation`, `consumeFifo`, `consumeLayersOfSourceLine`, `deriveLayer`, `restoreAllocationsOfLine`.
- `valueOfTake(remainingValue, remainingQty, take)`: the whole remainder takes the exact remaining value, otherwise `floor(value * take / qty)`. Nothing is lost at the end of a layer. This is the rounding pattern the WAC design reuses.
- `consumeFifo` returns `uncoveredQty` for quantity no layer covers. It does not fail. Each caller decides.
- `findFifoLayers` orders by `received_at, id`, filters `remaining_qty > 0`, takes `FOR UPDATE` when a transaction is given. With no batch it takes layers of all batches of that inventory item.

Gaps (code, not comments):

- The schema comment says reversing an outbound movement "restores value through a new derived cost layer". The code restores the original layers instead.
- Layers belong to one inventory item, so FIFO is per location. A transfer consumes source layers and creates derived layers at the destination (keeping `received_at` so age survives).
- There is no revaluation, no landed cost update of layers and no layer for stock added by adjustments.

## 5. Callers of costing today

| Flow | File | Cost in | Cost out | Reversal |
|---|---|---|---|---|
| Opening stock | `item/item-opening-stock.ts` | Layer per line. Value is `quantity x cost`. The contract field `cost` is optional and `item-opening-stock.rules.ts` does `line.cost ?? "0"`. If the inventory item row is not found the layer is silently skipped (`continue`). Journal: Dr Inventory, Cr Opening Balance Equity. | n/a | none |
| Purchase receipt | `purchase-receipt/` (`deps.ts` `costLayerAdapter`) | Layer per accepted line at the receipt line value. `received_at` is the receipt date at 00:00 UTC, not the movement time. Journal `goods_receipt`: Dr Inventory, Cr GRNI, skipped when total is 0. | n/a | Blocked if any layer was touched (`remaining != received`). Otherwise reverses the movement and consumes the layer with an allocation on the reversal line, then reverses the journal. |
| Inventory transfer | `inventory-transfer/deps.ts` `costingAdapter` | Derived layers at the destination or at transit | `consumeFifo` at the source. The returned `uncoveredQty` is ignored, so uncovered quantity moves with no derived layer and its value is lost from the cost record. | Restores source allocations and consumes derived layers. |
| Inventory adjustment | `inventory-adjustment/inventory-adjustment.service.ts` | **None.** No layer for a gain. Lines have no cost field. | **None.** A loss reduces on hand but never consumes layers. | Cancel is only for drafts. A confirmed adjustment has no undo. |
| Assembly (planned) | `docs/modules/assembly-order/SPEC.md` | New output layer | `consumeFifo` per component | Reverse while output untouched |

Result for adjustments: after a loss, quantity on hand is lower than the quantity left in layers. The layers still hold value for stock that is gone. A later sale or transfer can consume a layer that no longer has physical stock behind it.

## 6. Locations, warehouses and batches

- Locations: a warehouse has locations with purposes. System locations carry no stock (supplier, customer, adjustment, production). `transit` is a system warehouse location that does carry stock. The stock engine treats `production` as a counterparty. The costing code reads nothing about locations except to find the inventory item row.
- `inventory_items` is per (item, location). Cost layers hang on it, so the cost pool today is **per location**.
- Batches: layers can carry `inventory_item_batch_id`. Batch tracked items consume by batch when the caller names a batch. Two receipts into the same batch create two layers (one per receipt line).
- Batch status gates: issue needs `available`. Receive allows `available` or `quarantined`.

## 7. Documents that will need costing

| Document | State | Cost behaviour needed |
|---|---|---|
| Purchase receipt | built | cost from the receipt line value |
| Purchase return, supplier return | planned (purchase-receipt SPEC section 12) | issue at the cost basis the method defines, and the price difference to a variance account |
| Sales delivery | planned (`docs/modules/sales-delivery/SPEC.md`) | issue at method cost, COGS journal from the allocated value. The "weighted average" paragraph of that SPEC says weighted average must go through the existing valuation service. |
| Sales return | planned | receive at the cost of the original sale (inherit) |
| Transfer | built | cost neutral between locations |
| Adjustment | built | gain needs a confirmed cost, loss issues at method cost |
| Opening stock | built | cost required |
| Assembly | planned | consume at method cost, produce at the rolled up cost |

## 8. Accounting and journals

- Mapping keys are a DB enum. `INVENTORY_ASSET` is one account (code 1140, ASSET). Other relevant keys: `COST_OF_GOODS_SOLD` (5100), `INVENTORY_VALUATION_ADJUSTMENT` (5400), `PURCHASE_PRICE_VARIANCE` (5500), `INVENTORY_SHRINKAGE`, `INVENTORY_WRITE_OFF`, `GOODS_RECEIVED_NOT_INVOICED`, `OPENING_BALANCE_EQUITY`. Each key has an allowed account type list in `chart-of-accounts.ts`.
- The chart supports contra accounts: a definition can set `normalBalance` against the type default (comment in `chart-of-accounts.ts`). A credit-normal EXPENSE account for manufacturing cost absorbed is therefore expressible.
- Templates in `posting-templates.ts`: `goods_receipt`, `supplier_invoice` (with PPV), `purchase_invoice`, `supplier_return`, `landed_cost`, `sale_revenue`, `sale_cost` (Dr COGS, Cr Inventory), `sale_return_revenue`, `sale_return_inventory`, `inventory_adjustment` (shortage, damage, value_decrease, value_increase). Each takes an amount the caller supplies. None of them knows about layers.
- `landed_cost` is a template only. No server module posts it, so landed cost never reaches valuation.
- The adjustment confirm posts `inventory_adjustment` with `amountMinor: "0"` and ignores a failed result (`acctResult.success ? id : null`). A zero line is dropped by the template, so no journal is created in practice.
- The purchase receipt journal is posted only when the receipt total is above zero. A zero cost receipt creates a zero value layer and no journal.
- There is no per-category inventory account. All stock sits in 1140.

## 9. Transactions, concurrency, rounding

- Production uses a real database transaction (Neon WebSocket pool, `packages/db/src/client.ts`). The local proxy used in tests passes statements through with no rollback. `docs/TESTING.md` still describes the older behaviour. Rollback cannot be proven by row assertions in local tests.
- Locking order today: stock balance rows (sorted by key) then, in costing, cost layer rows `FOR UPDATE` in FIFO order. Documents lock their own row first.
- Quantity: numeric(18,6), handled as strings and millionths. Money: bigint minor units, `number` mode in drizzle (safe to 9e15 minor units; costing code converts to `BigInt` for math).
- Currency: layers store a currency per layer. Nothing converts. Mixed currencies in one pool are not prevented by the schema.

## 10. Findings that violate or limit the new rules

Numbered for reference in the SPEC.

| # | Finding | Why it matters | SPEC fix |
|---|---|---|---|
| F1 | Costing is a convention of callers, not of the stock engine | A caller can post stock-in with no cost | Central rule, R1 to R4 |
| F2 | Opening stock: missing `cost` becomes 0 silently. Layer creation is skipped if the inventory item row is not found | Missing cost and a real zero are indistinguishable. Value can be lost | R3, R5, R9, backfill review flags |
| F3 | Adjustments: gains have no cost and no layer, losses do not consume layers, journal amount is 0 and failure is ignored | On hand and layers drift apart. No GL effect for shrinkage | R9, R38, R39 |
| F4 | Transfer ignores `uncoveredQty` | Value can vanish silently on transfer of uncosted stock | R6 |
| F5 | `weighted_average` is unimplemented but selectable. The item form allows it. | Items on WAC are costed as FIFO by whatever path happens to run | R10 to R14, R35, R36 |
| F6 | `received_at` for receipts is the document date at midnight UTC. Movement time is separate. | FIFO order and a future WAC order can disagree with posting order | R21, SPEC section 6.4 |
| F7 | Allocation rows are deleted on restore (comment says append only) | Audit trail of costing is lost | R26, entries are append only |
| F8 | Pools are per location in FIFO | WAC needs a decision: per location or global | SPEC section 6 and open question W1 |
| F9 | Locked valuation method is enforced in the item rules, but no migration path exists | Cannot move FIFO items to WAC later | R35, R36 conversion |
| F10 | Landed cost template is unused | Capitalized freight never reaches valuation | out of scope, hook R16 |
| F11 | No reconciliation between stock quantity, cost records and the Inventory account | Drift stays hidden | SPEC section 10, I1 to I8 |
| F12 | One inventory account for all stock | The Q4 decision ("raw materials credited from their respective inventory accounts, finished goods debited") needs more than one account | Open question W6, assembly SPEC |

## 11. What the new design must keep

- One stock ledger, one costing engine, one journal path. No second set of balances.
- Money in bigint minor units, quantity numeric with 6 decimals, org id on every row with composite FKs.
- Existing FIFO items keep working unchanged until the owner decides to convert them.
- Every write is idempotent by source and safe under concurrency, and validation happens before the first write.
