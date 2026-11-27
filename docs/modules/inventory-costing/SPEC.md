# Inventory Costing: Weighted Average Cost and Cost Integrity, Implementation Specification

| | |
|---|---|
| Version | 1.0 · 2026-11-27 |
| Status | proposed (for owner review, nothing implemented) |
| Owner | Product owner |
| Depends on | stock-movement, inventory-costing (FIFO), item, warehouse and warehouse-location, batch, accounting, role (permissions), activity-log |
| Read first | [`ANALYSIS.md`](./ANALYSIS.md) (current code, findings F1 to F12) |
| Blocks | assembly modules ([`../assembly/README.md`](../assembly/README.md)). Manufacturing starts only after this spec is implemented and tested. |

Legend: **[CURRENT]** exists in code, **[PROPOSED]** recommended, **[OPEN]** needs an owner decision (section 15, W numbers).

## 0. Reading order for agents

`AGENTS.md` files, `ANALYSIS.md`, this file sections 1 to 4 and 9, then the section for the current phase (section 12). Resume from `PROGRESS.md`. Do not start phase 2 or later before the owner answers the questions marked "needed before phase 1" in section 15.

## 1. Goals and non-goals

Goals:

1. **Cost integrity.** Every stock-in has a valid, explicit cost. A missing cost blocks the posting. A real zero cost is allowed only when stated. This is enforced in the backend by the stock engine, not by forms.
2. **Perpetual moving weighted average cost** for items whose valuation method is `weighted_average`, computed in one central engine that every workflow uses (receipts, issues, adjustments, transfers, returns, opening stock, assembly).
3. Keep FIFO working as it does, with its gaps closed (section 4, R6).
4. Exact money: no value created or lost by rounding. The stock value always equals the sum of the cost records, and both reconcile to the Inventory account.
5. Safe under concurrency, retries, reversals and backdated documents, with a full audit trail.
6. A clear path to move an item from FIFO to weighted average.

Non-goals (this spec):

- Standard costing, landed cost allocation, cost revaluation screens, multi currency valuation (one organization currency in v1).
- Per category inventory accounts (open question W6, but the design leaves room).
- Sales, purchase return and assembly documents themselves. They use the engine, their own specs describe them.
- Restating history. A cost is fixed when its stock movement posts.

## 2. Domain model and boundaries

### 2.1 One engine, two strategies

```text
document modules (receipt, transfer, adjustment, opening, sales, assembly, returns)
        |  post stock movement WITH cost input for value-in lines
        v
stock-movement service  (quantity ledger, locks, balances)
        |  same transaction, after balances are applied
        v
valuation engine (new, in the inventory-costing module)
   |-- FIFO strategy  (existing layers, allocations)
   |-- WAC strategy   (new pools and entries)
        v
returns cost of every value-out line to the caller (for COGS, adjustment journals, assembly roll up)
```

- The valuation engine is a port of the stock movement service. `post` and `reverse` call it inside the same database transaction. A module cannot post stock without costing because costing is part of the posting.
- The item's `inventory_valuation_method` chooses the strategy per item. [CURRENT field]
- Callers stop calling `createCostLayer`, `consumeFifo` and friends directly. Those functions stay as the FIFO strategy internals.

### 2.2 Value-in and value-out lines

A line changes company stock value when exactly one side is a counterparty location (supplier, customer, adjustment, production) and the other side is a real stockable location or transit.

| Line type | Value effect | Examples |
|---|---|---|
| Value-in | adds qty and value to the item's cost record | purchase, opening, sale return, adjustment gain, assembly produce, reversal of any value-out |
| Value-out | removes qty and the method's cost | sale, purchase return, adjustment loss, assembly consume, reversal of any value-in |
| Internal move | no value change | transfer between locations or warehouses, to and from transit |

The resolved sides already exist in `stock-movement/rules.ts` (`resolveSides`). The engine derives the class from them, so a caller cannot label a line.

### 2.3 What this module owns and must not touch

Owns: pools, entries, layers (FIFO), the cost input contract, the valuation reports. Must not: change quantity balances (stock engine), post journals itself for documents it does not own, or read `items.cost_price`.

## 3. Lifecycle

Cost records are append only. There are no statuses. A pool has a state: `empty` (qty 0 and value 0) or `holding` (qty above 0). Negative states do not exist in v1 (R19).

An item's valuation method has this life: `fifo` or `weighted_average` while it has no stock, locked while it has stock or cost records, changed only by the conversion operation (R34 to R36).

## 4. Business rules

Tests reference these ids.

### 4.1 Cost integrity (all methods)

- R1. Every value-in line needs a **cost determination** before the posting can write anything. If it is missing or invalid the whole posting fails with `STOCK_MOVEMENT_COST_REQUIRED` (or `COST_INVALID`). Nothing is written.
- R2. A cost determination has one `source`:
  - `DOCUMENT`: the value comes from the source document line (for example a receipt line value). The calling module supplies `totalValueMinor`.
  - `INHERITED`: the value is copied from the cost of a source transaction (a sale return takes the cost of the original sale line, a reversal takes the cost of the movement it reverses, assembly produce takes the rolled up cost of its consumed components). The caller supplies `sourceEntryId` (WAC) or `sourceLayerIds` (FIFO) and the engine computes the value. The caller cannot override the number.
  - `USER`: the user typed a unit cost.
  - `CONFIRMED_PROPOSAL`: the system proposed a cost (current average, last receipt cost) and the user confirmed it. The proposal value is stored next to the final value.
- R3. **Missing is not zero.** The cost input has no default. `unitCost` or `totalValueMinor` is required. The value 0 is accepted only with `zeroCost: true` and a reason from a fixed list (`SAMPLE`, `PROMOTION`, `FREE_ISSUE`, `OTHER`). Zero cost records carry `is_zero_cost = true` and appear in a report. An `INHERITED` zero is allowed when the source was a stated zero.
- R4. The rule applies to every workflow that adds stock: opening stock, purchase receipt, sale return, positive adjustment, assembly produce, reversal of an outbound movement, and any future type. The check lives in the stock engine so a new module cannot skip it.
- R5. **No silent fallback.** `items.cost_price`, selling price, the last price of anything and "zero" are never used automatically. The costing code must not import or read `cost_price` (a test greps for it). The UI may propose a value from an existing valuation (the pool average, the last receipt cost). The proposal needs the user's confirmation and goes through R2 as `CONFIRMED_PROPOSAL`.
- R6. **Value-out must be fully costed.** The engine computes the cost of every value-out line and returns it. If the cost cannot be determined for the whole quantity (FIFO layers cover less than the quantity, no pool, pool quantity below the quantity) the posting fails with `COST_UNDETERMINED`. Callers cannot ignore an uncovered quantity. This fixes the transfer behaviour in ANALYSIS F4.
- R7. One currency per organization in v1 (the base currency). Entries and layers store it. A different currency fails with `COST_CURRENCY_MISMATCH`.
- R8. Values are integer minor units, at least 0 for value-in, at most 9,000,000,000,000,000. Quantities keep 6 decimals. Unit cost is a derived display value and is never the source of truth.
- R9. The existing stock-in workflows change as follows. The same rules apply to FIFO and WAC items.

| Workflow | Cost source after this change |
|---|---|
| Purchase receipt | `DOCUMENT` (receipt line value). Zero lines need the zero reason. |
| Opening stock | `USER`. The `cost` field becomes required. A line with no cost is rejected. The silent skip when the inventory row is missing becomes an error. |
| Positive adjustment | `USER` or `CONFIRMED_PROPOSAL`. Adjustment lines get cost fields. A gain with no cost is rejected. |
| Sale return | `INHERITED` from the sale line. A return with no linked sale line needs `USER` or `CONFIRMED_PROPOSAL`. |
| Assembly produce | `INHERITED` (sum of consume values plus additional cost, per the assembly spec). |
| Transfer in, transit settle | internal move, no new cost |
| Reversal of an outbound movement | `INHERITED` from the original issue |

### 4.2 Weighted average calculation

- R10. **Pool scope (default, W1):** one pool per item per organization. It holds all locations, warehouses, batches and transit stock of that item. Section 6 compares the alternatives.
- R11. **Receipt** of `q` units with value `v` (minor units): `pool.qty += q`, `pool.value += v`. The new average is `pool.value / pool.qty`. Nothing is rounded: value is added as an integer.
- R12. **Issue** of `q` units, only if `q <= pool.qty` (R19): 
  - if `q == pool.qty`: issue value = `pool.value` (the pool empties exactly);
  - otherwise issue value = round half up of `pool.value x q / pool.qty`, computed with `BigInt` on millionths (section 6.3).
  - then `pool.qty -= q` and `pool.value -= issue value`.
- R13. After every entry: `pool.value >= 0`; `pool.qty == 0` implies `pool.value == 0`; `pool.qty > 0` allows value 0 only when every receipt in the pool was a stated zero cost or inherited zero.
- R14. The average cost is derived (`value / qty`). A cached `avg_unit_cost` (numeric 30,10) is kept for display and for proposals. It is never an input to a calculation.
- R15. Entries are **append only**. Each has a strictly increasing `seq` per pool (assigned under the pool lock) and stores `qty_after` and `value_after`, so any point in time can be replayed and audited.
- R16. A **revaluation** entry (quantity 0, value change) is part of the model for later use (landed cost, supplier price correction). It needs `pool.qty > 0`, a reason, an accounting counter entry in the same transaction, and `value_after >= 0`. Not built in phase 1 to 6.
- R17. Rounding is the only place a unit cost matters. The rule "last unit takes the remainder" (R12) guarantees `sum of issue values + remaining value == sum of receipt values`. There is no rounding account and no rounding drift.
- R18. Receipt value for a document line is `round half up(qty x unit cost)` in minor units, done once when the document line is saved. The saved value is the truth, not the unit cost.

### 4.3 Negative stock

- R19. In v1 a weighted average item **cannot go negative**, even if `allow_negative_stock` is true. A value-out line above `pool.qty` fails with `COST_NEGATIVE_STOCK_NOT_SUPPORTED`. For FIFO items the existing behaviour stays (negative quantity allowed by item flag, uncovered quantity now fails by R6, which also blocks negative issue for FIFO items, see W3).
- R20. Design for a later phase if the owner wants negative stock on WAC items (W3): a negative issue is costed at `last_unit_cost` (the average before the pool reached zero) and the pool carries negative qty and negative value. A receipt that brings the pool back above zero is split: the part that covers the negative quantity settles at the receipt's cost, and the difference to the booked value posts to COGS as a negative stock settlement variance (Dr or Cr COGS, Cr or Dr Inventory); the rest enters the pool normally. Not part of phase 1 to 6.

### 4.4 Backdating

- R21. **Cost order is posting order.** The valuation sequence is `seq`, assigned when the movement posts. A document dated in the past is costed at the pool state at that moment. Earlier entries are never restated.
- R22. Entries store `effective_at` (the document or movement date) and `is_backdated` (true when `effective_at` is more than one calendar day earlier than the posting time, organization timezone). Reports show the flag.
- R23. The journal of a backdated document uses the document date and must fall in an open accounting period (existing accounting rule). A closed period blocks the posting.
- R24. "Valuation as of date D" reads entries with `effective_at <= D` ordered by `seq`. It is exact when no backdated entries exist for that item and flagged otherwise (section 10).
- R25. Optional org setting `reject_backdated_costed_postings` (default off, W4): reject costed postings dated before the last costed entry of the same pool.

### 4.5 Reversals and cancellations

- R26. Cost entries and layers are never edited or deleted. A reversal creates new entries linked by `reverses_entry_id`. (FIFO restore keeps its current behaviour in phase 1 but moves to append only in phase 3, W7.)
- R27. **Reverse a value-in** (receipt, assembly produce, sale return, adjustment gain) is allowed only if all of these hold:
  1. no value-out entry with a higher `seq` exists on the pool,
  2. `pool.qty >= entry.qty`,
  3. the stock engine finds the stock still at the location and batch.
  It removes exactly the entry's quantity and value, not the current average. Otherwise it fails with `COST_REVERSAL_BLOCKED_STOCK_USED` and the user must use a return, a disassembly or an adjustment. Later receipts do not block it (they only add value).
- R28. **Reverse a value-out** (sale, adjustment loss, assembly consume) restores the original quantity and the original issue value (`INHERITED`). It is always allowed by cost rules (the stock engine and the document rules decide the rest).
- R29. Document cancellation of a draft writes no entries. A confirmed adjustment has no undo today. A future "reverse adjustment" follows R27 and R28.
- R30. Every reversal is idempotent: a unique key on `reverses_entry_id` and on the movement line stops a second reversal.

### 4.6 Returns and transfers

- R31. **Sale return:** value-in `INHERITED` from the original sale line's issue entry: `value = original value x returned qty / original qty` (round half up, the last return of that line takes the remainder; returned quantity is tracked by summing entries that point at the original). A return with no sale line needs `USER` or `CONFIRMED_PROPOSAL`.
- R32. **Supplier (purchase) return:** value-out at the method cost. The credit note value can differ from the average cost. The difference posts to Purchase Price Variance (W5). Needs a change to the `supplier_return` template (section 9).
- R33. **Transfer** (WAC, global pool): internal move, no entries, pool unchanged. The transfer module calls the engine, which no-ops for WAC items and keeps the FIFO derive logic for FIFO items. A transit loss that is closed as a shortage is a value-out at the pool average (and a journal, the part of the transfer SPEC that was skipped).
- R34. **Transfer of uncosted FIFO stock** fails by R6.

### 4.7 Changing the valuation method

- R35. The method is locked while the item has stock or any cost record (existing item rule plus cost records). The only way to change it is the conversion operation (R36).
- R36. **FIFO to WAC conversion** (permission `inventory_costing.convert`): one transaction, all of the item's stock locked.
  1. Reconcile: the sum of on hand quantities (real locations and transit) must equal the sum of remaining layer quantity. If not, fail with `COST_CONVERSION_DRIFT` and return the per location difference (caused by the adjustment findings F3). The user fixes it with costed adjustments first.
  2. Create the pool with `qty = sum remaining qty` and `value = sum remaining value`.
  3. Write a `CONVERSION` entry. Close the layers (set remaining to 0 through allocations of kind `CONVERSION`, not deletion).
  4. Flip the method. No journal: total value does not change.
- R37. WAC to FIFO conversion is not offered in v1.

### 4.8 Accounting, concurrency and tests

- R38. The journal amount of a value-out document is the exact value the engine returned (sum of its entries or allocations). Examples: `sale_cost` costMinor, `inventory_adjustment` amountMinor, supplier return inventory credit, assembly consume.
- R39. A journal failure throws and rolls the whole posting back. No code path ignores a failed journal (ANALYSIS F3).
- R40. A value-in journal that has amount 0 is skipped, and the cost record still exists (a stated zero).
- R41. **Lock order**, everywhere: (1) the document row, (2) stock balance rows sorted by key (existing), (3) cost pool rows sorted by pool id, (4) FIFO layers in FIFO order. A code comment and a test enforce it. Two postings on the same item serialize on the pool row.
- R42. Costing runs in the same transaction as the movement. If costing fails after balances are applied, the code throws so the production transaction rolls back. Local tests cannot observe rollback (ANALYSIS section 9), so every check that can fail runs before the first write where possible.
- R43. Idempotency: a movement line has at most one cost entry (WAC) or layer (FIFO) for value-in, and a repeated post is stopped by the source uniqueness of the stock movement.
- R44. Reconciliation invariants (section 10) run in tests and in a scheduled check.

## 5. Database design

Money `bigint` minor units (`money()`), quantity `numeric(18,6)` (`quantity()`), `org_id` on every row, composite FKs. Next free migration number after the current last (`0029` at the time of writing, check at build time).

### 5.1 New tables

```text
inventory_cost_pools
- id, org_id
- item_id                    FK (org_id, item_id) restrict
- scope_warehouse_id         nullable, FK (org_id, warehouse_id). null = organization wide (v1)
- currency                   char(3)
- on_hand_qty                quantity, check >= 0
- total_value                money, check >= 0, and (on_hand_qty > 0 or total_value = 0)
- avg_unit_cost              numeric(30,10), cached display value
- last_unit_cost             numeric(30,10), average before the pool last emptied (used in W3 design)
- seq                        bigint, last entry number
- created_at, updated_at
- unique (org_id, item_id) where scope_warehouse_id is null
- unique (org_id, item_id, scope_warehouse_id) where scope_warehouse_id is not null

inventory_cost_entries      (append only)
- id, org_id, pool_id        FK (org_id, pool_id)
- item_id
- movement_line_id           FK (org_id, id) to stock_movement_lines, unique (org_id, movement_line_id)
                             nullable only for CONVERSION and REVALUATION
- kind                       enum: RECEIPT, ISSUE, REVERSAL_IN, REVERSAL_OUT, REVALUATION, CONVERSION
- qty_delta                  numeric(18,6), signed
- value_delta                bigint, signed
- qty_after, value_after     snapshot after this entry
- unit_cost                  numeric(30,10), display value of this entry
- seq                        bigint, unique (org_id, pool_id, seq)
- cost_source                enum: DOCUMENT, USER, INHERITED, CONFIRMED_PROPOSAL, METHOD (issues), CONVERSION
- is_zero_cost               boolean
- zero_cost_reason           text, required when is_zero_cost and source is not INHERITED
- proposed_value_minor       bigint nullable (CONFIRMED_PROPOSAL)
- source_entry_id            nullable FK (inherit link: sale return to the sale issue)
- reverses_entry_id          nullable unique FK
- currency, effective_at, is_backdated
- created_at, created_by
```

### 5.2 Changes to existing tables

| Table | Change |
|---|---|
| `inventory_cost_layers` | add `cost_source` (nullable: legacy rows), `is_zero_cost` boolean default false, `needs_review` boolean default false (set by the backfill for received value 0) |
| `inventory_cost_allocations` | add `kind` (`ISSUE` default, `CONVERSION`) |
| `inventory_adjustment_lines` | add `unit_cost` (nullable numeric), `cost_source`, `is_zero_cost`, `zero_cost_reason`, `proposed_unit_cost`. Required for lines with a positive difference. |
| `stock_movement_lines` | none. Cost lives next to the movement, not on it. |
| item opening stock | contract change only: `cost` required (or `zeroCost` with reason) |
| stock movement error codes | new codes (section 7.3) |

### 5.3 Constraints that the schema cannot express

The cost determination exists for every value-in line (cross table), pool quantity equals the sum of entry deltas, pool quantity equals the sum of `inventory_items.on_hand_qty` of the item, and sums by currency. These are enforced by the engine and checked by the reconciliation tests.

### 5.4 Backfill

- Existing layers with `received_value = 0`: `needs_review = true`. Existing layers keep `cost_source = null` (legacy). No value changes. Report in section 10.
- No pools exist until an item is converted or a new WAC item gets stock.
- Existing items whose method is already `weighted_average` and that already hold stock (FIFO behaviour today): listed in a one off report. They need conversion (R36) with the same drift check before the engine accepts postings for them. Until then postings for those items fail with `COST_METHOD_NOT_READY`. [OPEN W8]

## 6. Design decisions in detail

### 6.1 Pool scope: global vs per location

| | Global per item (recommended) | Per warehouse | Per location (like FIFO today) |
|---|---|---|---|
| Transfers | no cost entries, trivial, transit is cost neutral | value must move with the stock, in transit holds value | same, more rows |
| GL | one Inventory account, so no GL difference | no difference unless accounts per warehouse | no difference |
| Cost accuracy | one blended cost per item | cost can differ by warehouse | cost differs by bin, usually noise |
| Locking | one hot row per item | one per item and warehouse | many |
| Complexity | lowest | medium | highest |
| Fit | single company, one currency | multi site with real local cost differences | rarely useful |

The schema keeps `scope_warehouse_id` so per warehouse is a later setting, not a rewrite. An organization chooses the scope once and it is locked after the first costed WAC entry (W1).

### 6.2 Batch tracked items

Batches carry expiry and status, not cost. With WAC, all batches of an item share the pool average. Costs per batch (lot costing) are not offered (W2). Batch genealogy for assembly stays in the assembly tables. FIFO items keep consuming layers by batch as today.

### 6.3 Exact arithmetic

All math uses `BigInt` on millionths of a unit, as the FIFO code does (`toMicro`, `fromMicro`). Issue value:

```text
poolMicro = toMicro(pool.qty)
qMicro    = toMicro(q)
if qMicro == poolMicro: value = pool.value
else: value = (2 * pool.value * qMicro + poolMicro) / (2 * poolMicro)   // floor division on BigInt, round half up
```

The new pool value is exact by subtraction. The unit cost display is `value / qty` rounded to 10 decimals. A property test checks `sum(receipts) == sum(issues) + remaining` after random sequences.

### 6.4 Document date versus cost order

Document dates (receipt date at 00:00 UTC for receipts, user dates for opening stock) set `effective_at` and the GL date. They do not reorder cost entries. FIFO keeps using `received_at` for its order (current behaviour). The mix is intentional: FIFO needs age, WAC needs sequence (R21).

### 6.5 Why not store the average and recompute

The average is a ratio. Storing quantity and value (integers) and deriving the average means no precision is lost and the last issue always zeroes the pool exactly. A stored average would drift by rounding after many movements.

## 7. Contracts and API

Contracts in `packages/contracts/src/inventory-costing/` (constants, errors, schemas, rules with the pure math, locales en and ar). Server: extend `modules/inventory-costing/` (service, repository, strategies, routes). The stock movement contract gets the cost input.

### 7.1 Cost input (stock movement `post`)

```ts
type CostInput =
  | { source: "DOCUMENT"; totalValueMinor: string; zeroCost?: ZeroCost }
  | { source: "USER"; unitCost: string; zeroCost?: ZeroCost }
  | { source: "CONFIRMED_PROPOSAL"; unitCost: string; proposedUnitCost: string }
  | { source: "INHERITED"; sourceEntryId?: string; sourceLayerIds?: string[] }
type ZeroCost = { reason: "SAMPLE" | "PROMOTION" | "FREE_ISSUE" | "OTHER" }
```

Required on value-in lines, rejected on other lines. The engine returns the cost of every value-out line (`valueMinor`, `entryId` or allocation ids) in the response so callers use the exact number for journals.

### 7.2 Endpoints

| Method and path | Permission | Notes |
|---|---|---|
| `GET /inventory-costing/pools?itemId=` | read | Quantity, value, average of an item. |
| `GET /inventory-costing/entries` | read | Cost ledger (stock card with cost). Filters: item, date, kind, backdated, zero cost. |
| `GET /inventory-costing/proposal?itemId=` | read | Proposals only: pool average and last receipt cost. Never applied automatically. |
| `GET /inventory-costing/valuation?asOf=&warehouseId=` | read | Valuation report (section 10). |
| `GET /inventory-costing/reconciliation` | read | Invariants I1 to I7 with differences. |
| `GET /inventory-costing/review` | read | Legacy zero value layers needing review, zero cost entries. |
| `POST /items/:id/convert-valuation-method` | convert | R36. Body: target method, confirm flag. Returns drift report on failure. |
| Existing endpoints | unchanged paths | Opening stock, adjustment create and update take the new cost fields. |

### 7.3 Error codes (UPPER_SNAKE, each with locale keys)

`STOCK_MOVEMENT_COST_REQUIRED`, `COST_INVALID`, `COST_ZERO_REASON_REQUIRED`, `COST_UNDETERMINED`, `COST_NEGATIVE_STOCK_NOT_SUPPORTED`, `COST_CURRENCY_MISMATCH`, `COST_REVERSAL_BLOCKED_STOCK_USED`, `COST_SOURCE_NOT_FOUND`, `COST_SOURCE_EXCEEDED` (return above original), `COST_METHOD_NOT_READY`, `COST_METHOD_LOCKED`, `COST_CONVERSION_DRIFT`, `COST_POOL_INCONSISTENT` (an invariant failed, abort and alert). Engine errors travel as values through the stock movement `Result` and map to 422 or 409 in the route error maps.

### 7.4 Idempotency

Posting and reversal are idempotent by the unique source of the stock movement and by the unique keys on entries (R30, R43). Conversion is idempotent by the item's method flag (second call returns the current state).

## 8. UI

- **Item form and details:** valuation method selector stays, with a warning that it cannot be changed once stock exists. Details show quantity, stock value, average cost, last receipt cost, and a link to the cost ledger. Convert button for users with the permission and a drift report dialog.
- **Opening stock lines and adjustment gain lines:** cost column is required. A "No cost (free item)" checkbox opens the reason select (R3). A "Use current average" helper fills a proposal that the user confirms (`CONFIRMED_PROPOSAL`). The form never submits an empty cost as zero.
- **Adjustment loss lines:** show the cost that will be written off (from the engine preview), read only.
- **Stock movement history and stock card:** unit cost and value columns, flags for zero cost, backdated and legacy review.
- **Valuation and reconciliation pages:** simple tables with filters and a difference column that is empty when everything matches.
- **Errors:** every code above has a plain explanation in en and ar, for example "This stock has no cost. Enter a cost or confirm the suggested one." Stock used blocks reversal: "Some of this stock was already sold or used. Use a return or an adjustment instead."
- RTL: numeric inputs left to right, tables checked in both directions. `sync:i18n:check` clean.

## 9. Accounting and inventory effects

### 9.1 Journal by event (one Inventory account today)

| Event | Journal | Amount comes from |
|---|---|---|
| Opening stock | Dr Inventory, Cr Opening Balance Equity | `USER` value |
| Purchase receipt | Dr Inventory, Cr GRNI | receipt line value (unchanged) |
| Supplier invoice | Dr GRNI, Dr or Cr PPV, Cr AP | unchanged. The price difference is not added to the pool (W5). |
| Positive adjustment | Dr Inventory, Cr Inventory Valuation Adjustment (template `value_increase`) | confirmed cost x quantity |
| Negative adjustment | Dr Shrinkage or Write Off, Cr Inventory | engine issue value (fixes the amount 0 bug) |
| Sale delivery | Dr COGS, Cr Inventory (`sale_cost`) | sum of issue values |
| Sale return | Dr Inventory or Write Off, Cr COGS (`sale_return_inventory`) | inherited value |
| Supplier return | Dr AP, Cr Inventory (engine issue value), difference to PPV | needs a template change: inventory credit and AP debit become two amounts |
| Transfer | none | internal move |
| Assembly | see assembly SPEC | consume issue values, produce inherited value |
| Conversion | none | total value unchanged |

### 9.2 Reconciliation to the ledger

`Inventory account balance = sum(pool.total_value) + sum(FIFO layer remaining_value)` for stock items. Under per category accounts (W6) the same equation holds per account. A mismatch is a defect and shows on the reconciliation endpoint.

### 9.3 Q4 interaction

Assembly additional cost still posts to the Manufacturing Cost Absorbed account (assembly SPEC). The Q4 wording "raw materials credited from their respective inventory accounts, finished goods debited" needs more than one inventory account. See W6.

## 10. Reporting and reconciliation

Reports: valuation (item, warehouse, as of date, method), cost ledger, zero cost entries, backdated entries, legacy review list, stock value versus Inventory account.

Invariants, run as tests and as a scheduled check, each returns the offending ids:

- I1. For every item: `pool.on_hand_qty = sum(inventory_items.on_hand_qty)` over real locations and transit (WAC), and FIFO layers remaining qty equal on hand per inventory item.
- I2. `pool.total_value = sum(entry.value_delta)` and `pool.on_hand_qty = sum(entry.qty_delta)`.
- I3. Every entry satisfies `value_after >= 0` and (`qty_after = 0` implies `value_after = 0`), and `seq` has no gaps.
- I4. Every value-in movement line has exactly one entry or layer with a `cost_source` (except legacy rows).
- I5. Every value-out line has entries or allocations whose value equals the journal amount of its document.
- I6. For a reversed entry: the pair nets to zero in quantity, and in value when no other entry came between.
- I7. Inventory account balance equals the total stock value (section 9.2).
- I8. No `cost_price` read in costing code (static test).

## 11. Acceptance criteria

Each maps to a test in [`TEST-PLAN.md`](./TEST-PLAN.md).

1. AC1. Every value-in posting fails with `STOCK_MOVEMENT_COST_REQUIRED` when the cost is missing, for every workflow in R9, with no write.
2. AC2. A stated zero cost posts, is flagged, and needs a reason. An omitted cost never becomes zero.
3. AC3. No code path uses `cost_price` or any silent fallback. A proposal needs confirmation.
4. AC4. WAC receipt and issue follow R11 and R12 exactly, including the worked examples in section 13.
5. AC5. Sum of issued values plus remaining value equals sum of received values for random sequences (no drift).
6. AC6. A WAC item cannot go negative (R19). FIFO uncovered quantity fails (R6), including in transfers.
7. AC7. Transfers between locations and through transit leave the pool unchanged, FIFO transfers keep their layers.
8. AC8. Reversals follow R27 and R28, are blocked when stock was used, and are idempotent.
9. AC9. Sale return inherits the sale cost, cannot exceed the original quantity, and the last return takes the remainder.
10. AC10. Backdated documents are costed in posting order, flagged, and blocked by closed periods.
11. AC11. Concurrent issues and receipts on one item serialize and never create a negative pool or a drift.
12. AC12. Negative adjustment posts a real journal amount, and a journal failure aborts the posting.
13. AC13. Conversion FIFO to WAC works when stock and layers match, fails with a drift report otherwise, and changes no GL balance.
14. AC14. Existing FIFO flows (opening, receipt, transfer, reversals) still pass their current tests.
15. AC15. Reconciliation I1 to I8 hold after every scenario.
16. AC16. Tenant isolation, permission matrix, locale parity.
17. AC17. Legacy backfill flags zero value layers and changes no value.

## 12. Implementation tasks

Each phase is its own PR with its own gate. Details and ids in [`PROGRESS.md`](./PROGRESS.md).

| Phase | Content | Gate |
|---|---|---|
| 0 | Owner answers W1 to W9. Run the repository checks in section 14. | Decisions logged. |
| 1 | Pure math and contracts: millions arithmetic, issue value, cost input schemas, error codes, locales. Schema and migration (pools, entries, layer and adjustment columns, backfill flags). No behaviour change. | Math property tests green. Migration tested on a copy. |
| 2 | Valuation engine with the FIFO strategy behind the new port. Stock movement `post` and `reverse` call it. Existing callers (opening, receipt, transfer) pass cost inputs. R6 for transfers. Opening cost required. | All existing FIFO tests green. New AC1, AC2, AC6 (FIFO part). |
| 3 | WAC strategy: receipt, issue, reversal, returns inheritance, transfer no-op, concurrency. | AC4, AC5, AC8, AC9, AC11. |
| 4 | Adjustments: cost fields, gain cost required, loss uses engine, real journal, failure aborts. | AC12. |
| 5 | Conversion operation, backfill report, method readiness. | AC13, AC17. |
| 6 | Reports, reconciliation endpoint and scheduled check, invariants. | AC15. |
| 7 | Web: item, opening stock, adjustment forms, cost ledger, valuation and reconciliation pages. | e2e main journey and a denied journey. |
| 8 | Hardening, docs, REGISTRY and FEATURE-TRACKING, post-deploy smoke. | Done criteria in TEST-PLAN. |

Manufacturing (assembly modules) starts after phase 6 and uses the engine API only.

## 13. Worked examples

All amounts in minor units.

1. **Plain average.** Receive 10 at 100 each (value 1,000), receive 5 at 130 each (value 650). Pool: 15 units, value 1,650, average 110. Sell 4: value = 1,650 x 4 / 15 = 440. Pool: 11 units, 1,210. Sell 11: quantity equals the pool, so value is 1,210. Pool empty, value 0. Total issued 1,650, equal to total received.
2. **Rounding.** Pool 3 units, value 100. Issue 1: 100 x 1 / 3 = 33.33, so 33. Pool 2 units, 67. Issue 1: 67 / 2 = 33.5, half up 34. Pool 1 unit, 33. Issue 1: remainder 33. Issued 33 + 34 + 33 = 100, nothing lost.
3. **Reversal allowed.** Receive 10 at 100 (R1), receive 10 at 120 (R2). Reverse R2 while no issue happened after it: pool goes back to 10 units, 1,000.
4. **Reversal blocked.** Receive 10 at 100 (R1). Sell 4 (value 400). Reverse R1 fails: a value-out entry exists after it. Use a supplier return or an adjustment.
5. **Sale return.** Sale of 4 units booked at 440 total. Customer returns 1: inherited value 110, returns 3 later: remainder 330. Pool average moves with the value.
6. **Zero cost.** A free sample of 10 units arrives with `zeroCost` reason `SAMPLE`. The pool takes 10 units at value 0, which lowers the average of the pool. It is flagged in the review report. If the cost field is empty the posting fails.

## 14. Repository checks before implementation

### 14.1 Done in this analysis

See ANALYSIS.md sections 3 to 10 (each claim there comes from code read on `main`).

### 14.2 To verify in phase 0

1. Whether any production data exists for `weighted_average` items with stock, and how many layers have value 0 (query on a copy).
2. How many opening stock lines were saved with no cost (they have value 0).
3. The sides table in `stock-movement/rules.ts`: confirm the value-in and value-out classification for every type and that transit counts as stock.
4. Whether the database test setup can run a real transaction with row locks (needed for AC11). If not, plan a CI job with a real Postgres.
5. How `postBusinessEvent` validates a new `supplier_return` shape and how the account mapping validates new keys (allowed account type map in `chart-of-accounts.ts`).
6. The role defaults file and registry for the `inventory_costing` resource.
7. Unit conversions on item prices: the cost input is per base unit. Confirm every entry path converts to base before costing.
8. Behaviour of the item form for the valuation method selector when stock exists.

## 15. Decisions for the owner

Needed before phase 1: W1, W2, W3, W5, W6. Others can wait for their phase.

| # | Question | Default used in this spec |
|---|---|---|
| W1 | Weighted average pool scope: one per item for the organization, per warehouse, or per location? | One per item for the organization (section 6.1). Locked after first use. |
| W2 | Batch tracked items on WAC: one average per item, or one per batch? | One per item. |
| W3 | May an item go negative (when the item allows negative stock)? Today FIFO items can. R6 makes an uncovered FIFO issue fail, so it changes that behaviour too. | No in v1 for WAC and FIFO. The settlement design is in R20 for later. |
| W4 | Backdated documents: cost at posting order and flag (default), restate history, or reject? | Posting order and flag. Optional strict switch (R25). |
| W5 | Supplier invoice price differences: post to Purchase Price Variance (default), or revalue stock still on hand? | PPV. Revaluation can come with landed cost. |
| W6 | One Inventory account (today) or accounts per item category (raw materials, finished goods)? Q4 wording suggests several. | Keep one for the WAC work. Design per category accounts as a separate small module before the assembly phase 5. |
| W7 | Legacy layers with value 0 (opening stock with no cost): report only, or force a review before the engine goes live? | Report only, flagged `needs_review`. |
| W8 | Items already set to weighted average with stock: convert them with the drift check (default) or block them until fixed? | Convert with drift check. |
| W9 | Which proposal fills a gain adjustment: current pool average (default) or last receipt cost? | Current pool average. |

## 16. Decisions to preserve

- Cost integrity lives in the stock engine. A module cannot post stock-in without a stated cost.
- Missing cost is an error. Zero is allowed only when stated with a reason.
- `cost_price` is never a costing input.
- Money is exact integer value. The average is derived. The last unit takes the remainder.
- Cost order is posting order. Backdating flags, never restates.
- WAC reversals are limited by "no later value-out". Other cases use returns or disassembly.
- One engine, two strategies. Assembly, sales, returns and adjustments use the engine API and never their own costing math.
