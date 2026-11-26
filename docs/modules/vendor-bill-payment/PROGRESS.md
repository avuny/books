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
| 0 | Discovery and decisions | G0 | not started |
| 1 | Build | G1 | not started |
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
| D6 | Receipt `billStatus` AWAITING_BILL moves to PARTIALLY_BILLED / BILLED from the sum of posted bill allocations per receipt line | open, build in M1 | Derived, not toggled. |

## Deviations

None.

## Verification log

| Date | Task | Command | Result |
|---|---|---|---|
