# Staged production (WIP): how v1 grows into it

Answer to Q1: yes, it can be both. v1 ships single-step assembly. The design below makes full production orders (issue materials in steps, work in progress, finish in parts) an extension, not a rewrite. Nothing here is in v1 scope. Only the small hooks in section 7 are added to v1.

Status: proposed. Companion to [`README.md`](./README.md) and [`../assembly-order/SPEC.md`](../assembly-order/SPEC.md). Legend as in the specs: CURRENT is in code today, PROPOSED is recommended, OPEN is undecided.

## 1. Core idea

Single-step assembly is a staged order that does three things in one transaction:

1. Issue components (stock leaves the component locations).
2. Add additional cost.
3. Finish (the output arrives, one cost layer is created).

PROPOSED: write the v1 service as three internal operations (`issue`, `addCost`, `finish`) and let `post` call all three in one transaction. Staged production later exposes the same three operations as separate endpoints and calls them at different times. The cost math, batch rules and validation are written once.

## 2. One document, two modes

- Same `assembly_orders` table, same BOM, same cost types, same lines.
- New column `mode`: `SINGLE_STEP` (v1, default, the only value accepted) or `STAGED` (phase 2).
- A single-step order never shows an in-progress state. A staged order does.

## 3. Status model

| v1 | Staged (phase 2) |
|---|---|
| DRAFT, POSTED, REVERSED, CANCELLED | DRAFT, RELEASED, IN_PROGRESS, COMPLETED, CLOSED, CANCELLED |

- RELEASED: planned, no stock moved. IN_PROGRESS: at least one issue or receipt posted. COMPLETED: planned output received. CLOSED: leftover WIP settled, no more posting.
- PROPOSED: add the new enum values in the phase 2 migration, not now (unused states are untested states). Keep status changes in one table driven function so adding states touches one place.
- Reversal works per posting event in staged mode (reverse the last receipt, return an issue), not per order.

## 4. Stock movements

CURRENT: `assembly_consume` and `assembly_produce` exist in the movement types.

| Event | Movement | From | To | Source type, source id |
|---|---|---|---|---|
| v1 consume | assembly_consume | components | PRODUCTION (counterparty) | `assembly_order_consume`, order id |
| v1 produce | assembly_produce | PRODUCTION | output location | `assembly_order_produce`, order id |
| Staged issue | assembly_consume | components | WIP location (stockable) | `assembly_order_issue`, event id |
| Staged return of unused material | assembly_produce | WIP location | component location | `assembly_order_wip_return`, event id |
| Staged receipt (finish, partial allowed) | assembly_produce | WIP location | output location | `assembly_order_receipt`, event id |

- No new movement types are needed. Only source types are new. The unique source index is `(org, source_type, source_id)`, so staged events use a per event id as source id (many issues per order). v1 keeps the order id as source id and does not conflict.
- A new location purpose `wip` per warehouse: stockable, not pickable, not receivable by sales or purchasing (same flags style as `production`, `warehouse-location/constants.ts`). PROPOSED: the order form picks the WIP location only for staged orders. OPEN to verify in phase 0: whether adding a purpose needs a DB enum migration, and that the engine's side rules allow a stockable location on the WIP side of these types.
- Because PRODUCTION is a counterparty with no balance, v1 shows no WIP quantity anywhere. Staged mode does, which is the point.

## 5. Costing in staged mode

PROPOSED (option B, order level accumulator): each issue consumes component cost layers with `consumeFifo` exactly like v1 and adds the value to `wip_value_minor` on the order. The WIP location holds quantity only, no cost layers. Each receipt takes its share of the accumulated value and creates one output cost layer.

- Share per receipt = accumulated WIP value x received qty / planned output qty, integer math. The last receipt takes the exact remainder so nothing is lost or created by rounding.
- Returned material gets a new layer at the issue cost (or restores the original allocation when it is the same batch, using `restoreAllocationsOfLine`).
- Additional cost lines can be entered at any step and add to the accumulator.
- Why not carry layers into WIP (option A, `deriveLayer` like transfers): it keeps layer identity but makes the finish step consume WIP layers and gets complicated with partial receipts. OPEN: revisit if the owner wants per component cost visible inside WIP.
- Scrap: lost output quantity stays in the cost of what is received (normal loss) by default. OPEN: abnormal scrap to an expense account needs a new mapping key `ASSEMBLY_SCRAP_LOSS`.

## 6. Accounting in staged mode

CURRENT: one `INVENTORY_ASSET` account for all stock. v1 posts only Dr Inventory, Cr `ASSEMBLY_COST_ABSORBED` for additional cost.

PROPOSED for staged:

| Event | Journal |
|---|---|
| Issue to WIP | Dr `WIP_ASSET`, Cr `INVENTORY_ASSET` (material value) |
| Additional cost | Dr `WIP_ASSET`, Cr `ASSEMBLY_COST_ABSORBED` |
| Receipt | Dr `INVENTORY_ASSET`, Cr `WIP_ASSET` (share of accumulated value) |
| Return from WIP | Dr `INVENTORY_ASSET`, Cr `WIP_ASSET` |

- New mapping key `WIP_ASSET` (current asset account, code chosen with the same next free code rule as 5600). Needed only in phase 2.
- In staged mode the additional cost debit moves from Inventory to WIP. The credit account stays the same, so v1 data and reports stay valid.
- The WIP account balance must equal the sum of open staged orders' `wip_value_minor`. This becomes a reconciliation invariant (I7).
- Each event journal uses its own source id (event id) and the same zero line rule (never post zero).
- Standard costing and variance accounts stay out of scope. They can layer on top later.

## 7. What v1 adds now (small, cheap hooks)

1. `assembly_orders.mode` column (default `SINGLE_STEP`, service rejects other values).
2. `posting_seq` (int, v1 always 1) on `assembly_order_consumptions`, so staged can store many issues per order.
3. Service structure: `issue`, `addCost`, `finish` as internal functions, with the PRODUCTION location resolved through one function (staged swaps it for the WIP location).
4. Reports and the trace endpoint read from `assembly_order_consumptions` and the output rows, never from stock movement lookups by order id. Then staged events appear without changing reports.
5. Status transitions in one table driven function.
6. Locale keys and UI status badges built from the status list, not hard coded to four values.

Not added now: extra enum values, the WIP location purpose, the WIP mapping key, receipts and event tables, scrap fields.

## 8. What phase 2 adds

- Migration: status values, `wip` purpose, `WIP_ASSET` key, `assembly_order_events` and `assembly_order_receipts` (v1 output results are copied over as a one row receipt per POSTED order), `wip_value_minor`, `received_base_qty` on the output.
- Endpoints: `release`, `issue`, `return`, `add-cost`, `receive` (partial allowed), `close`. UI: progress bar per component and output, a WIP view.
- Rules: over-issue and over-receipt limits (OPEN, default: no over-receipt), close settles leftover WIP by returning or scrapping.
- Concurrency: every event locks the order row first (same order as v1), then balances.
- Disassembly fits the same operations in reverse roles.

## 9. Risks

- Option B means WIP quantity has no cost layers. A bug in the accumulator is a hidden cost error, so invariant I7 and a per order check (issued value = received value + returned value + open WIP) must run in tests from the first staged event.
- Adding a location purpose or enum values touches shared enums. Check the migration tooling for adding enum values inside a transaction.
- Staged mode multiplies partial states users can create. Keep v1 behaviour untouched and gate staged mode behind its own permission actions.
