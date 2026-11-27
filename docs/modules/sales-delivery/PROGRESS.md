# PROGRESS — Sales Delivery

| | |
|---|---|
| Spec | [`SPEC.md`](./SPEC.md) · imported 2026-11-26 |
| Plan | [`IMPLEMENTATION-PLAN.md`](./IMPLEMENTATION-PLAN.md) |
| Last updated | 2026-11-27 |
| Current phase | Phase 2 — Web built, e2e pending |
| Tasks done | 0 / 17 |
| Gates passed | 0 / 4 |

## How to use this file

Resume protocol (every session): 1) read the AGENTS.md files and SPEC sections 1 to 3. 2) read this file. 3) continue at **Next action**.
Tick a task only when its "done when" is true and evidence is in the Verification log. Update counts and Next action with each change. Never silently change SPEC.md; record deviations below.
Legend: `[ ]` todo · `[~]` in progress · `[x]` done · `[!]` blocked · `[-]` not applicable (say why)

## Next action

> **E2E and invoice handoff** — add a web e2e spec for create, post and reverse. Then the invoice handoff (SPEC P1-06) with the sales-invoice-payment module.

## Status board

| Phase | Title | Gate | Status |
|---|---|---|---|
| 0 | Discovery and decisions | G0 | not started |
| 1 | Build (backend) | G1 | done, web pending |
| 2 | Web and copy | G2 | panel done (order page), e2e pending |
| 3 | Hardening and acceptance | G3 | not started |

## Decision log

| ID | Decision | Status | Owner response · date |
|---|---|---|---|
| D2 | COGS is recognised at the posted delivery (SPEC default control-transfer policy). No configurable policy and no in-transit location in v1 | decided | agent, 2026-11-27 |
| D3 | Stock movement type is the existing `sale`. No `outboundInTransitQty` | decided | agent, 2026-11-27 |
| D4 | Delivery lines default to the order line's unit and location. Batches are never chosen on the delivery: the order's reservation allocations (FEFO) decide them, and any unreserved remainder is taken from free stock (never from another order's reservation) | decided | agent, 2026-11-27 |
| D5 | Posting needs FIFO cost layers covering the quantity, else COST_UNAVAILABLE. Journal is Dr COGS / Cr Inventory at the cost taken from layers | decided | agent, 2026-11-27 |
| D6 | Reversal restores cost layers at the original cost and reverses the journal. The reservation is not restored (returned goods become free stock) | decided | agent, 2026-11-27 |
| D7 | Invoice-linked reversal guard and the draft-invoice handoff are deferred to the sales-invoice-payment milestone | deferred | agent, 2026-11-27 |
| D8 | No global deliveries list or details page yet. Deliveries are managed from a panel on the order details page (create prefilled with open quantities, post, reverse with reason) | decided | agent, 2026-11-27 |
| D1 | Transaction-capable DB driver is available before posting use cases are built | open | see `../SAAS-SPEC-FIXES-PLAN.md` D1 |

## Deviations

None.

## Verification log

| Date | Task | Command | Result |
|---|---|---|---|
| 2026-11-27 | Backend | `pnpm test src/api/modules/sales-delivery src/api/modules/sales-order` (apps/server), `tsc --noEmit` | 52 unit tests pass, typecheck clean. Integration runs in CI only (no local Postgres) |
| 2026-11-27 | Web | `pnpm typecheck`, vitest sales-order-module (apps/web) | typecheck clean, build-delivery tests pass |
