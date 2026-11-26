# PROGRESS — Vendor Bill & Vendor Payment

| | |
|---|---|
| Spec | [`SPEC.md`](./SPEC.md) · imported 2026-11-26 |
| Plan | [`IMPLEMENTATION-PLAN.md`](./IMPLEMENTATION-PLAN.md) |
| Last updated | 2026-11-26 |
| Current phase | Phase 1 — Build, slice M1 (vendor bill backend) |
| Tasks done | 0 / 18 |
| Gates passed | 0 / 4 |

## How to use this file

Resume protocol (every session): 1) read the AGENTS.md files and SPEC sections 1 to 3. 2) read this file. 3) continue at **Next action**.
Tick a task only when its "done when" is true and evidence is in the Verification log. Update counts and Next action with each change. Never silently change SPEC.md; record deviations below.
Legend: `[ ]` todo · `[~]` in progress · `[x]` done · `[!]` blocked · `[-]` not applicable (say why)

## Next action

> **M1** — contracts (constants, errors, schemas, locales), `vendor_bills`/`vendor_bill_lines`/`vendor_bill_line_receipt_allocations` schema + migration, repository, service (draft CRUD, create from receipt, post, reverse), tests. Branch `feat/vendor-bill`.

## Status board

| Phase | Title | Gate | Status |
|---|---|---|---|
| 0 | Discovery and decisions | G0 | done 2026-11-26 |
| 1 | Build | G1 | in progress: M1 (bill backend) and M2 (payment backend) done, web next |
| 2 | Web and copy | G2 | not started |
| 3 | Hardening and acceptance | G3 | not started |

## Decision log

| ID | Decision | Status | Owner response · date |
|---|---|---|---|
| D1 | Transaction-capable DB driver is available before posting use cases are built | closed | Receipt posting already runs stock, layers and journal in one transaction (purchase-receipt.service.ts). Same pattern here. 2026-11-26 |
| D2 | Posting reuses the accounting business events, no accounting change | closed | `supplier_invoice` (Dr GRNI received, Dr/Cr PPV for the difference, Dr Input Tax, Cr AP) and `supplier_payment` (Dr AP, Cr cash or bank) exist in `packages/contracts/src/accounting` (posting-templates.ts, schemas.ts). Idempotent by (event, sourceId). 2026-11-26 |
| D3 | Cash/bank account on a payment is chosen by method (cash or bank), not by a free ledger account id | closed (deviation from SPEC 7 `cashBankAccountId`) | The accounting event resolves the account from the method through the org's account settings. A per-payment account choice needs a new event field; deferred, tracked as a follow-up. 2026-11-26 |
| D4 | Due date = existing `computeDueDate(invoiceDate, term)` in `packages/contracts/src/payment-term/rules.ts`; the bill stores term snapshots | closed | P1-02 is reuse only. 2026-11-26 |
| D5 | Money is integer minor units (bigint in DB, strings in contracts), rates in basis points | closed | Same as PO and receipt. 2026-11-26 |
| D6 | Receipt `billStatus` AWAITING_BILL moves to PARTIALLY_BILLED / BILLED from the posted billed quantity per receipt line | closed (M1) | Derived in the receipt mapper from posted bill lines, never stored. Reversing a receipt with a posted bill is blocked (PURCHASE_RECEIPT_ALREADY_BILLED). |
| D7 | M1 bills goods lines matched to receipt lines only; no free-form expense/service lines | closed (deviation from SPEC 9.2) | The existing `supplier_invoice` event has no expense account. Expense bills need a new accounting event. Follow-up. |
| D8 | A bill line references one receipt line directly; no `vendor_bill_line_receipt_allocations` table | closed (deviation from SPEC 9.2) | One line to one receipt line makes the allocation table redundant. A line can bill part of a receipt line; several bills can bill the same line. |
| D9 | Bill line carries `netAmountMinor` as printed on the supplier invoice, not unit price x qty | closed | Avoids rounding differences with the supplier's paper. Variance = invoiced net - received value (GRNI), posted by the `supplier_invoice` event. |
| D10 | Duplicate supplier invoice number is blocked per supplier among non-reversed bills (partial unique index) | closed | Drafts count, so a clash shows up at entry time. |

## Deviations

None.

## Verification log

| Date | Task | Command | Result |
|---|---|---|---|
| D11 | A payment's amount is the sum of its allocations to posted bills; no unapplied advance or supplier credit in M2 | closed (scope cut) | Keeps AP subledger = sum of bill outstanding. Advances need a supplier-credit concept. Follow-up. |
| D12 | Overpaying a bill is blocked per bill under a row lock on the bills (FOR UPDATE) at post time | closed | Outstanding = bill total - posted allocations, derived. Bill DTO exposes paidAmount, outstandingAmount, paymentStatus. |
| D13 | A bill with a posted payment cannot be reversed (VENDOR_BILL_HAS_PAYMENTS); reverse the payment first | closed | |

### M1 log (2026-11-26)

Contracts (`vendor-bill`, en/ar, permissions via registry), schema `vendor_bills` + `vendor_bill_lines` (migration 0027, also adds a unique (org_id, id) on `purchase_receipt_lines` for the composite FK), server module with 8 routes (`/vendorBill/organizations/{orgId}/vendor-bills[...]`: create, create from receipt, list, get, update, delete, post, reverse), service unit tests (8), route integration test (CI only), receipt `billStatus` derivation and reverse guard.
Not yet done: web screens (M3), payments and outstanding balance (M2), reverse guard when payments exist (M2), AP aging and reconciliation (M4), production smoke (M4).

### M2 log (2026-11-26)

Contracts `vendor-payment` (constants, errors, schemas, rules, en/ar, permissions), schema `vendor_payments` + `vendor_payment_allocations` (migration 0028), server module with 7 routes (`/vendorPayment/organizations/{orgId}/vendor-payments[...]`: create, list, get, update, delete, post, reverse), 6 service tests, route integration test (CI only). Posting uses the existing `supplier_payment` event (Dr AP, Cr cash or bank by method). Bills now carry paidAmount / outstandingAmount / paymentStatus and cannot be reversed while a posted payment is applied.
Not yet done: web screens and the Pay later / Already paid / Partially paid flow (M3), AP aging, supplier statement, GRNI/AP reconciliation, prod smoke (M4).
