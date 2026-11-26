# PROGRESS — Purchase Receipt (GRN)

| | |
|---|---|
| Spec | [`SPEC.md`](./SPEC.md) · imported 2026-11-26 |
| Plan | [`IMPLEMENTATION-PLAN.md`](./IMPLEMENTATION-PLAN.md) |
| Last updated | 2026-11-26 |
| Current phase | Phase 0 — Discovery and decisions |
| Tasks done | 0 / 18 |
| Gates passed | 0 / 4 |

## How to use this file

Resume protocol (every session): 1) read the AGENTS.md files and SPEC sections 1 to 3. 2) read this file. 3) continue at **Next action**.
Tick a task only when its "done when" is true and evidence is in the Verification log. Update counts and Next action with each change. Never silently change SPEC.md; record deviations below.
Legend: `[ ]` todo · `[~]` in progress · `[x]` done · `[!]` blocked · `[-]` not applicable (say why)

## Next action

> **P0-01** — Phase 0 services mapped (D2 to D6). Next: contracts, schema and migration 0024 (purchase_receipts, purchase_receipt_lines), then the server module modelled on `inventory-adjustment`.

## Status board

| Phase | Title | Gate | Status |
|---|---|---|---|
| 0 | Discovery and decisions | G0 | not started |
| 1 | Build | G1 | not started |
| 2 | Web and copy | G2 | not started |
| 3 | Hardening and acceptance | G3 | not started |

## Decision log

| ID | Decision | Status | Owner response · date |
|---|---|---|---|
| D1 | Transaction-capable DB driver is available before posting use cases are built | resolved | main has real transactions (audit #13, Neon WebSocket pool); repositories call `db.transaction` and services accept `tx` | 2026-11-26 |
| D2 | Stock movement type for a posted receipt is `purchase` (from the system supplier location to a `receive`-intent location); source type `purchase_receipt`. No new movement type needed | decided | `packages/contracts/src/stock-movement/rules.ts`, `STOCK_MOVEMENT_TYPES` | 2026-11-26 |
| D3 | Cost layers are created by the receipt service through `inventoryCostingService.createCostLayer` after `stockMovementService.post`, one per accepted line, as `inventory-adjustment` does. `stock-movement` does not create layers itself | decided | `inventory-costing.service.ts`, `inventory-adjustment.deps.ts` | 2026-11-26 |
| D4 | Journal: `accountingService.postBusinessEvent` with event `goods_receipt` (Dr INVENTORY_ASSET, Cr GOODS_RECEIVED_NOT_INVOICED). Mapping keys already exist. Idempotent through the journal source type and id | decided | `accounting/posting-templates.ts`, `PostBusinessEventSchema` | 2026-11-26 |
| D5 | No AP / Vendor Bill module exists in the repo. The "Create supplier bill" handoff (P1-07) is deferred: the receipt exposes `billStatus = AWAITING_BILL` and the checkbox is shown disabled with copy, until the AP module lands | decided (agent default, please confirm) | `apps/server/src/api/modules` has no vendor-bill | 2026-11-26 |
| D6 | Purchase order dependency: PO module is merged to dev and main (v0.2.0) and prod migrations 0022 and 0023 are applied. PO PROGRESS gates are still 0/4 (journey integration test and e2e open). Build continues on the user's instruction | decided | user confirmation relayed 2026-11-26 | 2026-11-26 |

## Deviations

- Vendor Bill handoff (SPEC section 6, P1-07) is deferred because no AP module exists (D5).

## Verification log

| Date | Task | Command | Result |
|---|---|---|---|
