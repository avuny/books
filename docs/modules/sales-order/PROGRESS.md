# PROGRESS — Sales Order & Reservation

| | |
|---|---|
| Spec | [`SPEC.md`](./SPEC.md) · imported 2026-11-26 |
| Plan | [`IMPLEMENTATION-PLAN.md`](./IMPLEMENTATION-PLAN.md) |
| Last updated | 2026-11-26 |
| Current phase | Phase 2 — Web (UI built, CI pending) |
| Tasks done | 0 / 17 |
| Gates passed | 0 / 4 |

## How to use this file

Resume protocol (every session): 1) read the AGENTS.md files and SPEC sections 1 to 3. 2) read this file. 3) continue at **Next action**.
Tick a task only when its "done when" is true and evidence is in the Verification log. Update counts and Next action with each change. Never silently change SPEC.md; record deviations below.
Legend: `[ ]` todo · `[~]` in progress · `[x]` done · `[!]` blocked · `[-]` not applicable (say why)

## Next action

> Web e2e spec, then hand off to sales-delivery.

## Status board

| Phase | Title | Gate | Status |
|---|---|---|---|
| 0 | Discovery and decisions | G0 | done |
| 1 | Build | G1 | server done, CI pending |
| 2 | Web and copy | G2 | not started |
| 3 | Hardening and acceptance | G3 | not started |

## Decision log

| ID | Decision | Status | Owner response · date |
|---|---|---|---|
| D1 | Transaction-capable DB driver is available before posting use cases are built | open | see `../SAAS-SPEC-FIXES-PLAN.md` D1 |

## Implementation notes (M1, server)

- Statuses: DRAFT, CONFIRMED, CLOSED, CANCELLED. Line counters: reserved, delivered, invoiced, cancelled.
- Reservation policies on confirm: REQUIRE_FULL_RESERVATION (default), ALLOW_PARTIAL_RESERVATION (needs some stock on every line), ALLOW_BACKORDER_WITHOUT_RESERVATION (no stock needed). Shortfall returns INSUFFICIENT_STOCK.
- Shared port `apps/server/src/api/modules/inventory-reservation`: reserve/release inside a caller transaction, row locks in stable order, FEFO for batch items (available, not expired), parent and batch reserved_qty kept equal, allocation rows never deleted. Delivery will consume reservations through it.
- Cancel and close release the open reservation and set cancelled counters. Cancel is refused once anything is delivered (reads delivered counters until the delivery module exists).
- Customer must have an active CUSTOMER party role.
- DB checks: delivered + cancelled <= ordered, reserved + cancelled <= ordered. Migration 0029.
- Reservation port has no DB-level test locally (no Postgres); covered by CI integration tests.

## Implementation notes (M2, web)

- `apps/web/src/features/sales-order-module` is cloned from purchase-order without shipments, receipts and payment-term pages. Routes under `/organization/$orgId/sales-orders`.
- Customer picker uses party role CUSTOMER. Line columns show reserved, delivered and unreserved quantities.
- Confirm opens a dialog with the reservation policy select (default REQUIRE_FULL_RESERVATION). Create-and-confirm uses the default policy.
- UI locale sections live in the contracts sales-order locales (en/ar).
- Not done: web e2e spec; reservation summary after confirm (the line table shows reserved vs unreserved).
- `pnpm sync:i18n` also added the missing inventory-transfer namespace (drift from the earlier release).

## Deviations

None.

## Verification log

| Date | Task | Command | Result |
|---|---|---|---|
