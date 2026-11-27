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
| 1 | Build | G1 | in progress: M1 (bill backend), M2 (payment backend) and M3 (web) and M4 (reports) built, prod smoke after release |
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
| D14 | Quick purchase receipt ("Receive and pay" in the receive dialog) runs in the web client as separate requests: create and post receipt, bill from receipt and post, vendor payment create and post, with client-side undo (reverse or delete) when a step fails. A single server endpoint was tried in v0.6.0 and removed: Cloudflare Workers stop one request that makes too many database calls ("Too many subrequests"), which left half-done results on prod. Lesson: keep each request under the Worker subrequest limit; do not compose several posting services in one request | closed | Found by the v0.6.0 prod smoke. The sales receipt (D15, sales-invoice-payment) composes 4 steps in one request and worked in prod, but it is closer to the limit than other endpoints. |

### M1 log (2026-11-26)

Contracts (`vendor-bill`, en/ar, permissions via registry), schema `vendor_bills` + `vendor_bill_lines` (migration 0028 (one combined bill + payment migration; renumbered on merge with inventory-transfer 0027), also adds a unique (org_id, id) on `purchase_receipt_lines` for the composite FK), server module with 8 routes (`/vendorBill/organizations/{orgId}/vendor-bills[...]`: create, create from receipt, list, get, update, delete, post, reverse), service unit tests (8), route integration test (CI only), receipt `billStatus` derivation and reverse guard.
Not yet done: web screens (M3), payments and outstanding balance (M2), reverse guard when payments exist (M2), AP aging and reconciliation (M4), production smoke (M4).

### M2 log (2026-11-26)

Contracts `vendor-payment` (constants, errors, schemas, rules, en/ar, permissions), schema `vendor_payments` + `vendor_payment_allocations` (migration 0028, combined with the bill tables), server module with 7 routes (`/vendorPayment/organizations/{orgId}/vendor-payments[...]`: create, list, get, update, delete, post, reverse), 6 service tests, route integration test (CI only). Posting uses the existing `supplier_payment` event (Dr AP, Cr cash or bank by method). Bills now carry paidAmount / outstandingAmount / paymentStatus and cannot be reversed while a posted payment is applied.
Not yet done: web screens and the Pay later / Already paid / Partially paid flow (M3), AP aging, supplier statement, GRNI/AP reconciliation, prod smoke (M4).

### M3 log (2026-11-26)

Web feature `vendor-bill-module`: bill list (status tabs), bill details (lines, totals, paid/outstanding, post, reverse, delete), vendor payments list (post, reverse, delete), receipts panel gets "Create bill" on posted receipts that are not fully billed (dialog: supplier invoice number, invoice date, optional due date, then opens the draft bill). Posting a draft bill opens the Pay later / Already paid / Partially paid dialog: it posts the bill, then creates and posts one payment for the chosen amount (full total or typed partial). A posted bill with an outstanding amount has "Record payment". Sidebar entries (purchases group): Vendor bills, Vendor payments. en and ar strings under `ui` in the vendor-bill locale. Amount rule in `build-payment.ts` (tested).
Known gaps: no bill edit screen yet (draft lines cannot be edited in the UI; API supports it), no web e2e spec, no manual Arabic/RTL pass. AP aging, supplier statement, GRNI/AP reconciliation and prod smoke are M4.

### M4 log (2026-11-26)

Reports on the vendor-bill routes (read:vendor-bill): `GET /vendorBill/organizations/{orgId}/ap-reports/aging`, `.../supplier-statement?partyId&from&to`, `.../reconciliation`. Pure rules in contracts (`vendor-bill/reports.ts`: aging buckets by days past due, statement running balance, reconcile difference; 7 tests). Aging is outstanding on posted bills today (total less posted allocations), grouped by supplier and currency. Statement lists posted bills and posted payments with an opening balance before `from`. Reconciliation compares the Accounts Payable ledger (credits less debits over POSTED and REVERSED entries, so a reversal nets its original) with the sum of bill outstanding, and GRNI ledger with posted receipt value less value cleared by posted bills. Any difference is shown, not hidden. Web: "AP reports" page at `/vendor-bills/reports` (aging table with a Statement dialog per supplier, reconciliation table), en/ar.
Decisions: D14 aging has no back-dated as-of (outstanding is derived from current posted allocations), so it is always today. D15 no supplier exposure summary yet (AP + open GRNI), no payments-by-method report, no overdue-bills filter: follow-ups.
Open: prod smoke of the full bill and payment journey and the reconciliation numbers happens after the vendor work is released to main (dev only today).
