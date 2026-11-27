# PROGRESS — Sales Invoice & Customer Payment

| | |
|---|---|
| Spec | [`SPEC.md`](./SPEC.md) · imported 2026-11-26 |
| Plan | [`IMPLEMENTATION-PLAN.md`](./IMPLEMENTATION-PLAN.md) |
| Last updated | 2026-11-26 |
| Current phase | Phase 0 — Discovery and decisions |
| Tasks done | 0 / 17 |
| Gates passed | 0 / 4 |

## How to use this file

Resume protocol (every session): 1) read the AGENTS.md files and SPEC sections 1 to 3. 2) read this file. 3) continue at **Next action**.
Tick a task only when its "done when" is true and evidence is in the Verification log. Update counts and Next action with each change. Never silently change SPEC.md; record deviations below.
Legend: `[ ]` todo · `[~]` in progress · `[x]` done · `[!]` blocked · `[-]` not applicable (say why)

## Next action

> **M4 web** (sales-invoice pages, "create invoice after delivery" on delivery post), then **M5** customer payment (allocations, advances, reversal), then **M6** credit notes, AR aging, customer statement.

## Status board

| Phase | Title | Gate | Status |
|---|---|---|---|
| 0 | Discovery and decisions | G0 | done (specs read; milestone plan M4 to M6) |
| 1 | Build | G1 | in progress: M4 sales-invoice backend done (migration 0031); M5, M6 todo |
| 2 | Web and copy | G2 | not started |
| 3 | Hardening and acceptance | G3 | not started |

## Decision log

| ID | Decision | Status | Owner response · date |
|---|---|---|---|
| D1 | Transaction-capable DB driver is available before posting use cases are built | open | see `../SAAS-SPEC-FIXES-PLAN.md` D1 |
| D2 | Invoice lines name a delivery line and a quantity. Price, discount and tax rate come from the sales order line, pro-rated by base quantity (`prorateAmount`, half up). Tiny rounding dust across partial invoices is accepted | decided | agent, M4 |
| D3 | One sales order per invoice; several partial invoices per order. The party is the order's party | decided | agent, M4 |
| D4 | Post books Dr AR, Cr Revenue, Cr Output VAT through `sale_revenue` (settlement receivable). Stock and COGS stay with the delivery | decided | agent, M4 |
| D5 | Invoice stores a customer name snapshot and payment-term snapshots. An address snapshot is deferred until print/PDF needs it | decided | agent, M4 |
| D6 | Reversing a delivery that a posted invoice bills is refused (`SALES_DELIVERY_ALREADY_INVOICED`); reversing an invoice with posted payments is refused (`SALES_INVOICE_HAS_PAYMENTS`, stubbed until M5) | decided | agent, M4 |
| D7 | Pre-delivery (advance) invoices are deferred; invoices need a posted delivery | decided | agent, M4 |
| D8 | Costing coordination: weighted average costing (PRs #55, #56) is built by another agent. The sales chain does not touch costing engine code. Settled W decisions: WAC pool per item org-wide; one average per item, not per batch; negative stock blocked for WAC and FIFO (needs a prod below-zero data check first); supplier price differences go to a purchase price variance account; one inventory account for now, per-category accounts later as a small module before assembly | decided | owner via parent, 2026-11-27 |
| D9 | When the costing engine merges: plan a task to move sales-delivery's `salesCostingAdapter` onto it with identical COGS journals. Before any release, rerun the AGENTS.md pre-release migration check against fresh main (migration numbers and stock-engine collisions) | planned | agent |

## Deviations

None.

## Verification log

| Date | Task | Command | Result |
|---|---|---|---|
