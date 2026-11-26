# Commerce modules — master implementation plan (purchasing and sales)

Version 1.0 · 2026-11-26. Covers six modules whose specs were imported from the owner's Drive. Each has `SPEC.md`, `IMPLEMENTATION-PLAN.md`, `PROGRESS.md`, `TEST-PLAN.md` in `docs/modules/<name>/`.

Specs cross-reference each other by their original Drive file names. Mapping:

| Name used inside specs | Folder |
|---|---|
| PURCHASE-ORDER-SPEC.md | `purchase-order/` |
| PURCHASE-RECEIPT-SPEC.md | `purchase-receipt/` |
| VENDOR-BILL-PAYMENTS-SPEC.md | `vendor-bill-payment/` |
| SALES-ORDER-SPEC.md | `sales-order/` |
| SALES-DELIVERY-SPEC.md | `sales-delivery/` |
| SALES-INVOICE-PAYMENTS-SPEC.md | `sales-invoice-payment/` |
| SPEC.md (combined purchasing) | `purchasing/OVERVIEW-SPEC.md` |

## Stage 0 — Foundations (before any module)

| ID | Task | Done when |
|---|---|---|
| C0-01 | Fix audit blockers B0 to B4 (`docs/audits/2026-11-26-app-audit.md`): deploy vars, atomic org and item create, batch tracking default, per-location stock | Regression tests named in TESTING-PLAN section 5 pass |
| C0-02 | Real DB transactions (SaaS fixes plan D1, Phase 2) | A posting use case can roll back; test proves it |
| C0-03 | Money rule confirmed: bigint minor units, strings in DTOs (D2) | Recorded in SAAS-OVERVIEW decisions |
| C0-04 | Shared pieces: document numbering service, payment terms (max 20 per org), reusable `LineItems` and `DatePickerField` blocks, `inventory_items.inTransitQty` and reservation projections | Inventory Adjustment still passes its tests after the LineItems refactor |
| C0-05 | Smoke test and wrangler vars check (TESTING-PLAN section 6) | `deploy.yml` smoke job green |
| C0-06 | Cross-cutting test suites: tenancy, permission matrix (TESTING-PLAN section 3) | Suites run in CI |

## Stage 1 — Purchasing, in order

1. `purchase-order` (PO, supplier shipments, payment terms)
2. `purchase-receipt` (GRN, stock movement, cost layers, GRNI accrual)
3. `vendor-bill-payment` (AP, matching, payments)

## Stage 2 — Sales, in order

1. `sales-order` (reservations)
2. `sales-delivery` (stock out, COGS)
3. `sales-invoice-payment` (AR, receipts, credit notes)

Stages 1 and 2 can run in parallel after Stage 0 if two agents split them, because they share only the Stage 0 pieces. Within a stage, order is strict.

## Stage 3 — Reports and accounting UI

AR/AP aging, statements, stock valuation, chart of accounts and journal UI (replaces the dead Accounting sidebar link).

## Rules for every module

Follow `docs/TESTING-PLAN.md` section 4 and `docs/FEATURE-TRACKING.md`. Update `docs/features/REGISTRY.md` when a status changes. One feature branch per module, branched from `dev`; merging to main is the owner's call.
