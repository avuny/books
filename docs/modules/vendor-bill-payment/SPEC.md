# Vendor Bills & Vendor Payments Module — Implementation Specification

**Status:** Proposed implementation specification  
**Audience:** Engineering, product, QA, and accounting stakeholders  
**Module boundary:** Supplier invoice capture, Vendor Bills / Accounts Payable, receipt-to-bill matching, outgoing supplier payments (also called Purchase Payments), payment allocations, and AP/bank accounting.  
**Depends on:** Existing Party module, Purchase Order & Purchase Receipt modules, Payment Terms, Tax module, Accounting / Journal Entry module, Cash & Bank accounts, shared numbering, and authorization infrastructure.

> This is the third of three purchasing specifications. Purchase Orders and supplier shipments are defined in `PURCHASE-ORDER-SPEC.md`. Physical Purchase Receipts are defined in `PURCHASE-RECEIPT-SPEC.md`.

## 1. Naming and module boundaries

Use these terms consistently:

| Term | Meaning |
|---|---|
| Supplier Invoice | The external document sent by the supplier |
| Vendor Bill | The AP transaction recorded in the ERP from the supplier invoice |
| Vendor Payment | Money paid by the organization to a supplier |
| Purchase Payment | Common alternate label for Vendor Payment; not a separate entity/module |
| Accounts Payable (AP) | The liability created when a Vendor Bill is posted |
| GRNI / GR-IR | Goods received but not invoiced; accrued at Purchase Receipt and cleared by matched Vendor Bill |

**Decision:** Implement one payment entity/service named `Vendor Payment` (document number prefix such as `VP-...`). The UI may use “Purchase Payment” as an alias if that matches product language, but do not create both `vendor_payments` and `purchase_payments` tables, APIs, statuses, or accounting flows.

## 2. Goals

The module must:

1. Create draft Vendor Bills manually or from one/multiple posted Purchase Receipts.
2. Match invoiced quantities/amounts to accepted received quantities and GRNI accruals.
3. Support partial invoices, multiple bills per PO/receipt, and one bill matched to multiple receipts.
4. Post the supplier liability to Accounts Payable when the Vendor Bill is posted.
5. Support payment terms and calculate the due date from the supplier invoice date.
6. Record Vendor Payments with allocations to one or multiple posted bills.
7. Support Pay later, Already paid in full, and Partially paid from the receipt-to-bill user journey.
8. Never increase on-hand inventory when a Vendor Bill is posted.
9. Never mark a bill paid without a posted Vendor Payment transaction.
10. Preserve posting immutability, reversal, idempotency, tenant isolation, and audit history.

## 3. Existing Party module integration

The repository already has one Party module for vendors/suppliers and customers:

- Use `partyId` (or the canonical Party FK name) on `vendor_bills` and `vendor_payments`.
- Do not create a `vendors` / `suppliers` table or duplicate contact/address/tax master data.
- Validate that the Party belongs to the current organization, is active, and is allowed to act as a supplier/vendor.
- Reuse Party search/detail/create flows. On bill/payment forms, display the Party name and allow navigation to its detail screen where appropriate.
- For printed/posted documents, persist the legal name/address/tax snapshots required by audit/local tax rules if the Party record may later change; do not use snapshots as a second editable Party master.

## 4. Vendor Bill lifecycle

Recommended status:

```ts
export const VENDOR_BILL_STATUSES = [
  "DRAFT",
  "POSTED",
  "REVERSED",
] as const;
```

Bill payment status is a separate derived value:

```ts
export const BILL_PAYMENT_STATUSES = [
  "UNPAID",
  "PARTIALLY_PAID",
  "PAID",
] as const;
```

Do not set the bill itself to `PAID` by editing a status column. Payment status is calculated from posted Vendor Payment allocations less reversals/credit adjustments. A posted bill is immutable; use a supplier credit note or reversal workflow for corrections.

## 5. Vendor Bill document specification

### 5.1 Header fields

If no AP document tables exist, introduce `vendor_bills` with:

- `id`, `orgId`
- `number` (ERP-generated bill number, e.g. `BILL-...`)
- `partyId`
- `purchaseOrderId` nullable (a bill may combine receipts or cover non-PO purchases)
- `supplierInvoiceNumber` (supplier's own invoice reference)
- `invoiceDate`
- `postingDate`
- `dueDate`
- `paymentTermId` nullable, plus payment-term snapshots (`termNameSnapshot`, `termMethodSnapshot`, `termDaysSnapshot`)
- `currency`, exchange-rate snapshot if applicable
- subtotal, discounts, tax, charges, total; paid/outstanding amounts are derived (or maintained only as reconciled projections)
- `status`: `DRAFT`, `POSTED`, `VOIDED` / reversal-based status according to accounting conventions
- `journalEntryId` nullable or resolve by source type/id
- notes, created/posted audit fields, timestamps

Enforce uniqueness of supplier invoice numbers per supplier Party where product/accounting policy requires it (consider case-folding and nullable values). Do not necessarily enforce global uniqueness across all vendors.

Use `partyId` for the supplier Party FK; do not introduce a separate `vendorId` relation. Keep both:

- ERP-generated `number` (for example `BILL-000123`).
- Supplier's external `supplierInvoiceNumber` (required before posting unless local policy allows otherwise).

A Bill may store `purchaseOrderId` as a convenient header reference when all matched receipt lines belong to one PO. If a supplier invoice spans multiple POs, leave that singular convenience FK null and derive PO relationships from the receipt-allocation lines; do not force a single PO FK as the only matching mechanism.

### 5.2 Vendor Bill lines and receipt matching

Bill lines should store item/description, quantity, unit, unit price, discounts, tax, net/tax/gross amounts, account/item mapping, and optional PO line reference.

A single bill can invoice quantities from several receipts, and a receipt can be billed in parts. Use an allocation table such as `vendor_bill_line_receipt_allocations`:

- `orgId`
- `vendorBillLineId`
- `purchaseReceiptLineId`
- `matchedBaseQty`
- `matchedNetAmount`
- timestamps

Validate cumulative allocated quantity never exceeds accepted, unbilled receipt quantity. Keep a bill line's link to PO line for reporting but use receipt allocation rows to clear the correct GRNI accruals.

For non-stock/service bills, allow direct expense / asset account lines if supported by the accounting module. They may not have a Purchase Receipt.

### 5.3 Create Bill from Purchase Receipt behavior

When created from a Purchase Receipt:

- Prepopulate vendor, currency, PO reference, receipt reference, item/description, accepted quantity, purchase unit, expected unit price, and applicable term.
- Copy the PO payment term unless the supplier Party / invoice explicitly provides a different approved term.
- Default invoice date to today or receipt date according to product decision; make it visible and editable.
- Compute due date from invoice date and payment term.
- Leave supplier invoice number blank and require it before posting unless local policy permits otherwise.
- Allow partial billing (less than received quantity).
- Show unbilled accepted quantity per receipt line.
- Do not assume PO price is the supplier's final invoiced price; allow controlled changes and variance handling.

### 5.4 Vendor Bill posting

Posting the Vendor Bill:

1. Verify supplier Party, dates, currency, totals, taxes, and duplicate supplier invoice rules.
2. Validate bill-to-receipt allocations and remaining unbilled quantities.
3. Match receipt values to the accrued GRNI amount.
4. Debit GRNI for the matched receipt value.
5. Post recoverable input VAT / tax asset where applicable.
6. Post price / quantity / tax variances to configured accounts according to the accounting policy.
7. Credit Accounts Payable for the gross supplier liability.
8. Create the journal entry and mark bill posted atomically.

Example, no tax and exact match:

```text
Dr GRNI                         1,000
    Cr Accounts Payable                 1,000
```

Example with $1,000 receipt value and $100 recoverable VAT (invoice gross $1,100):

```text
Dr GRNI                         1,000
Dr Input VAT                      100
    Cr Accounts Payable                 1,100
```

If the invoice differs from receipt cost, post the difference to the configured purchase price variance / inventory cost adjustment account. The specific accounting treatment can depend on the costing method and whether stock remains on hand; implement it in the accounting/costing service, not in UI code.

A Vendor Bill posting must not increase `onHandQty` or create a second Purchase Receipt.

---

## 6. Payment Terms and due date

Payment Terms are created and managed by the Purchase Order module as shared organization-scoped master data. This module consumes the selected term and its immutable snapshot:

- Copy the term selected on the PO into the Vendor Bill when generated from a receipt, unless the supplier invoice or an authorized user supplies a different valid term.
- For a non-PO bill, default from the supplier Party's default payment term if supported; otherwise use the organization's default or “Due on receipt”.
- Store `paymentTermId` plus term-name, method, and days snapshots where available.
- Calculate the due date from the supplier **invoice date**, not the PO date or receipt date.

Due-date calculation:

- `DUE_ON_RECEIPT`: invoice date.
- `NET_DAYS`: invoice date plus the configured number of calendar days.
- `END_OF_MONTH`: last calendar day of invoice month.
- `END_OF_NEXT_MONTH`: last calendar day of the following month.
- `DAYS_AFTER_END_OF_MONTH`: last calendar day of invoice month plus configured days.

Implement the calculation in a shared date-only utility and test month-end, leap-year, and timezone-boundary cases. Persist the calculated `dueDate` on the bill. Editing a payment-term master must not rewrite existing bill due dates. An authorized due-date override requires an audit note.

## 7. Vendor Payment (Purchase Payment) lifecycle

Use **Vendor Payment** as the document name. A vendor payment is separate from a bill and separate from the PO.

Suggested `vendor_payments` header:

- `id`, `orgId`
- `number` (generated `VP-...`)
- `partyId`
- `paymentDate`
- `paymentMethod` (cash, bank transfer, cheque, card, etc. based on supported enum)
- `cashBankAccountId` (FK to allowed cash/bank ledger account)
- `currency`, exchange-rate snapshot if needed
- `amount`
- `referenceNumber` / bank transaction reference
- `status`: `DRAFT`, `POSTED`, `REVERSED`
- `journalEntryId` nullable or source lookup
- audit fields and timestamps

Use `vendor_payment_allocations` to allocate one payment to one or more bills:

- `orgId`
- `vendorPaymentId`
- `vendorBillId`
- `allocatedAmount`
- timestamps

Validate payment supplier Party and currency match each bill unless an explicit cross-currency settlement feature exists. For v1, require the total allocations to equal the payment amount; each allocation must not exceed the target bill outstanding balance. Do not post unallocated cash as though it settled a bill. Future supplier advances require a separate explicit workflow and liability account.

Compute from posted payments and reversals:

```text
outstandingAmount = postedBillGrossAmount - netPostedPaymentAllocations

UNPAID          if allocatedPaidAmount = 0
PARTIALLY_PAID  if 0 < allocatedPaidAmount < billGrossAmount
PAID            if outstandingAmount = 0
```

Use integer minor-unit arithmetic (`BigInt`) consistent with the existing accounting helpers. Consider credit notes, write-offs, and FX differences in a later extension; do not compare floating-point values.

After the user is redirected to the newly created Draft Vendor Bill, show:

**How would you like to settle this bill?**

- **Pay later** — post the bill; it remains unpaid.
- **Already paid in full** — post the bill, then create and post a Vendor Payment allocated to the full outstanding amount (with payment date, method, and cash/bank account).
- **Partially paid** — post the bill, then create a Vendor Payment for the entered amount and leave the remainder outstanding.

Require payment account and date when a payment is recorded. Do not offer a “mark as paid” action that changes only a status field.

If the payment is entered before the bill is posted, persist the intended payment details in the draft workflow and post the bill before posting the payment in the same controlled application flow. The final journal sequence must remain valid and auditable.

---

A payment can be entered from the Vendor Bill screen or from a dedicated Vendor Payments screen. Both entry points must call the same Vendor Payment service and create the same `vendor_payments` record.

## 8. Accounting and journal entries

### Journal-entry invariants

Continue to follow these existing rules:

- Automated journal entries are created in `POSTED` state inside the same transaction as the source business event.
- `sourceType` and `sourceId` identify the source document and make automated posting idempotent through the existing unique index.
- Posted journal entries and lines are immutable.
- Errors are corrected with reversal entries using `reversalOfId`.
- Accounting service validates at least two lines, balanced debit/credit totals using `BigInt`, active/postable accounts, organization currency, and open accounting period.
- Never let an API client submit arbitrary journal lines for an automated purchasing posting.

Suggested stable source types:

```ts
PURCHASE_RECEIPT
VENDOR_BILL
VENDOR_PAYMENT
PURCHASE_RECEIPT_REVERSAL
VENDOR_BILL_REVERSAL
VENDOR_PAYMENT_REVERSAL
```

Use one source document ID for each journal event. If source type/id uniqueness is used, one posted receipt gets one receipt journal; a second partial receipt is a different receipt ID and therefore a separate journal.

### 8.1 Vendor Bill posting

For an exact $600 bill matching $600 GRNI, excluding tax:

```text
Dr GRNI                         600
    Cr Accounts Payable                  600
```

With taxes / charges / variance, add the relevant debit lines and credit AP for the actual gross invoice amount. Debits must equal credits.

### 8.2 Vendor Payment posting

For a full $600 payment:

```text
Dr Accounts Payable             600
    Cr Bank / Cash                       600
```

The payment must be allocated to one or more posted Vendor Bills. Bill payment status is derived from total valid allocations and reversals.

For a partial payment of $200 against a $600 bill:

```text
Dr Accounts Payable             200
    Cr Bank / Cash                       200
```

Outstanding balance remains $400.

### 8.3 Required account configuration

Do not assume all organizations use identical account IDs. Resolve accounts using a validated posting-profile / accounting-settings service. At minimum, the purchasing flow needs configured accounts for:

- Inventory asset (potentially per item category / item account mapping).
- GRNI / accrued purchases liability.
- Accounts Payable control account (or vendor-specific override where permitted).
- Recoverable input VAT / tax accounts.
- Purchase price variance / cost adjustment.
- Bank / cash accounts for Vendor Payments.
- Vendor advances if prepayments are later supported.

Fail posting with a clear setup error if required accounts are missing; do not silently skip a journal or post to an arbitrary account.

---

Examples (no tax, exact match):

**Purchase Receipt (owned by Receipt module):**

```text
Dr Inventory Asset
    Cr GRNI
```

**Vendor Bill posting:**

```text
Dr GRNI
    Cr Accounts Payable
```

**Vendor Payment posting:**

```text
Dr Accounts Payable
    Cr Bank / Cash
```

The Vendor Bill does not debit Inventory again and does not create a Stock Movement. The Vendor Payment does not change inventory or PO quantities.

## 9. Database design

### 9.1 Existing tables to reuse

- Existing Party table/service for supplier identity.
- `purchase_orders`, `purchase_order_lines`, `purchase_receipts`, and `purchase_receipt_lines` from the other purchasing specs.
- `journal_entries`, `journal_entry_lines`, and `accounts`.
- Existing tax-code, currency, cash/bank-account, payment-method, document-number, and accounting-period modules.
- `inventory_cost_layers` / valuation services only for variance handling; the AP module must not create receipt cost layers.

### 9.2 New tables owned by this module

```text
vendor_bills
- id
- org_id
- number                         // ERP-generated BILL-...
- party_id                       // supplier Party FK
- supplier_invoice_number        // external invoice number
- invoice_date
- posting_date
- due_date
- payment_term_id                // nullable FK to shared payment_terms
- payment_term_name_snapshot
- payment_term_method_snapshot
- payment_term_days_snapshot
- currency
- exchange_rate_snapshot         // when multi-currency is supported
- subtotal / discount / tax / charges / total
- status                         // DRAFT, POSTED, REVERSED
- journal_entry_id               // optional direct FK; sourceType/sourceId also identify it
- notes
- created_by / posted_by / posted_at
- timestamps

vendor_bill_lines
- id
- org_id
- vendor_bill_id
- line_no
- item_id                         // nullable for expense/service lines
- description_snapshot
- purchase_order_line_id          // nullable
- unit_id
- billed_qty
- base_unit_factor_snapshot
- billed_base_qty
- unit_price
- discount fields
- tax_code_id
- net_amount / tax_amount / gross_amount
- expense_or_asset_account_id     // for non-stock/service bills where applicable
- timestamps

vendor_bill_line_receipt_allocations
- id
- org_id
- vendor_bill_line_id
- purchase_receipt_line_id
- matched_base_qty
- matched_net_amount
- timestamps

vendor_payments
- id
- org_id
- number                         // generated VP-...
- party_id                       // supplier Party FK
- payment_date
- payment_method
- cash_bank_account_id
- currency
- exchange_rate_snapshot
- amount
- reference_number
- status                         // DRAFT, POSTED, REVERSED
- journal_entry_id
- notes
- created_by / posted_by / posted_at
- timestamps

vendor_payment_allocations
- id
- org_id
- vendor_payment_id
- vendor_bill_id
- allocated_amount
- timestamps
```

Use the repository's shared `pk()`, `money()`, `currency()`, `timestamps()`, organization-scoped composite FK, and unique document number conventions. Money must use integer minor units and `BigInt` in totals/reconciliation. Validate positive amounts and prevent allocations exceeding the payment or bill's outstanding amount.

### 9.3 Relationships and constraints

- One supplier Party has many Vendor Bills and Vendor Payments.
- One Purchase Receipt can be invoiced by multiple bill lines/allocations; one Vendor Bill can allocate across multiple receipt lines.
- One Vendor Payment can allocate across multiple Vendor Bills; one Vendor Bill can receive multiple payments.
- Vendor Bill and Vendor Payment Party must match the supplier Party on the related PO/receipt/bills.
- Supplier invoice duplicate policy should generally enforce uniqueness by `(org_id, party_id, normalized_supplier_invoice_number)` where supplier invoice number is present, while allowing legitimate nulls/drafts.
- Enforce organization-scoped number uniqueness and restrict deletion of posted/history-linked records.
- Validate cumulative matched receipt quantity does not exceed accepted and unbilled quantity. This aggregate rule needs transaction/locking logic; a simple row CHECK cannot enforce it.
- Validate payment allocations do not exceed payment amount or bill outstanding amount under concurrent posting.
- Do not store a manually editable `paid` boolean. If a balance projection is stored for performance, reconcile it against immutable posted allocations and reversals.

## 10. API and service boundaries

- `VendorBillService`: create manual draft, create from receipt, update draft, post, reverse, list/detail.
- `VendorPaymentService`: create draft, add/remove allocations, post, reverse, list/detail.
- `PartyService`: existing canonical Party search/detail; supplier capability validation.
- `PaymentTermService`: existing shared service from PO module.
- `AccountingPostingService`: resolve AP, GRNI, tax, variance, and bank/cash mappings and create balanced journals.
- `PurchaseReceiptService`: validate receipt allocation ownership and accepted unbilled quantities.

Suggested endpoints:

```text
POST   /vendor-bills
POST   /vendor-bills/from-receipt
GET    /vendor-bills/:id
PATCH  /vendor-bills/:id                 // DRAFT only
POST   /vendor-bills/:id/post
POST   /vendor-bills/:id/reverse

POST   /vendor-payments
GET    /vendor-payments/:id
PATCH  /vendor-payments/:id              // DRAFT only
POST   /vendor-payments/:id/post
POST   /vendor-payments/:id/reverse

GET    /parties/search?capability=SUPPLIER  # existing Party module
```

Do not add `/purchase-payments` as a second independent API. If product routing wants that wording, it can be an alias to the same Vendor Payment use case.

## 11. UI composition and non-accountant workflow

### 11.1 Vendor Bill form

- Show the supplier Party, ERP bill number, supplier invoice number, invoice date, due date, payment term, PO/receipt references, currency, lines, tax, charges, and totals.
- For a bill created from receipt, prefill accepted quantities and PO expected prices; show received / already billed / remaining unbilled quantities.
- Require the user to verify supplier invoice number, invoice date, invoice totals, taxes, and charges before posting.
- Use an explicit “Post Vendor Bill” action and confirmation where the app's accounting UX requires it.

### 11.2 Pay immediately or later

On the draft bill screen after the bill details are reviewed, show:

**How would you like to settle this bill?**

- **Pay later** — “Record the supplier bill now and pay it later.”
- **Already paid in full** — ask payment date, payment method, and cash/bank account.
- **Partially paid** — ask amount paid, date, method, and cash/bank account; show remaining balance.

This is a guided workflow, not a manual status change. The system must:

1. Validate and post the Vendor Bill first (AP increases).
2. If immediate/partial payment was selected, create and post a Vendor Payment allocated to the bill (AP decreases; bank/cash decreases).
3. Navigate to the Vendor Payment / confirmation result or back to the bill detail with payment recorded.
4. If payment posting fails after bill posting, keep the bill posted and report that the bill is saved but payment needs retry; use idempotency to avoid a duplicate bill/payment.

Payment details required: amount, date, method, cash/bank account, and optional transaction/reference number.

### 11.3 Vendor Payment form

- Supplier Party picker (or prefilled read-only Party when launched from a bill).
- Payment number, payment date, method, cash/bank account, currency, amount, reference.
- Open posted bills for that Party with bill number, invoice date, due date, total, already paid, outstanding, and amount-to-allocate.
- Support one payment allocated across several bills and multiple partial payments against one bill.
- In v1, require the entire payment amount to be allocated. Prepayments/vendor advances need a separate explicit workflow and account.

## 12. Validation and business rules

### 12.1 Bill validation

- Vendor belongs to organization and matches PO/receipt vendor.
- Supplier invoice number follows duplicate-check policy.
- Invoice date and due date are valid.
- Currency is valid and exchange rate is supplied where applicable.
- Matched quantities do not exceed accepted, unbilled receipt quantities.
- Bill totals reconcile with lines, discount, taxes, and charges.
- AP, GRNI, tax, and variance accounts are configured.
- Bill posting is idempotent and balanced.

### 12.2 Payment validation

- Bill is posted and has an outstanding balance.
- Vendor matches the allocated bill.
- Payment amount is positive.
- Allocations do not exceed payment amount or bill outstanding amount.
- Cash/bank account is active, postable, and configured for payment use.
- Payment date is in an open accounting period.
- Payment journal is balanced and idempotent.

---

Additional requirements:

- Invoice date and due date are date-only values; avoid UTC conversion day shifts.
- Supplier invoice number duplicate detection is scoped to supplier Party and organization.
- Use invoice gross amount for AP credit, with appropriate input VAT/expense/variance debits.
- The bill is posted before its associated payment is posted.
- A Vendor Payment can only allocate to posted bills for the same supplier Party and currency unless cross-currency settlement is explicitly supported.
- Allocate with locks/conditional updates so two concurrent payments cannot overpay one bill.

## 13. Reversals, credit notes, and corrections

- Posted Vendor Bills and Vendor Payments are immutable.
- Correct a bill through an authorized reversal or supplier credit note / credit memo workflow. Do not delete or rewrite the posted bill.
- A Vendor Payment reversal reverses the AP/bank journal and unwinds its allocations; preserve the original payment and allocation history.
- Reversing a bill with posted payments requires the payment allocations to be reversed/reallocated or an explicit credit/refund workflow first.
- Reversing a bill must not reverse its source Purchase Receipt or remove stock.
- Every correction records reason, actor, timestamp, and links to original and reversal documents.

## 14. Reporting and reconciliation

Required views/reports:

1. Vendor Bills by status, Party, invoice date, and due date.
2. AP aging based only on posted Vendor Bills and outstanding balances.
3. Bills awaiting payment / overdue bills.
4. Bills partially invoicing a receipt / receipts awaiting a bill.
5. Supplier statement and bill/payment activity.
6. Vendor Payments by date, method, cash/bank account, and Party.
7. Unallocated payment amounts (should normally be zero unless supported prepayment workflow).
8. GRNI balance separately from AP aging.
9. Supplier exposure summary: posted AP outstanding + open GRNI, clearly labelled as supplier exposure, not the AP control balance.

Reconcile:

- AP control account = posted Vendor Bill AP credits less posted Vendor Payment allocations, credit notes, write-offs, and reversals.
- Vendor Bill outstanding amounts = bill gross less net posted allocations/adjustments.
- GRNI = posted receipt accruals less receipt-matched Vendor Bill clearing and reversals.
- Cash/bank account = posted payment credits/debits and other account activity.
- Every automated journal is balanced and has a unique source type/source ID.

## 15. Testing and acceptance criteria

### 15.1 Vendor Bill tests

- Draft bill creation has no AP journal.
- A bill generated from receipt is linked to the correct supplier Party, PO, and receipt.
- Partial billing and multiple bills per receipt/PO work.
- One bill can match several receipts.
- Duplicate supplier invoice references are rejected according to policy.
- Posting exact-match bill clears GRNI and credits AP without changing on-hand inventory.
- VAT, charges, and price variances post to configured accounts and journal balances.
- Service/non-stock bill lines use expense/asset accounts and do not create stock movements or cost layers.

### 15.2 Vendor Payment tests

- Pay later posts the bill only; AP remains outstanding.
- Paid in full posts bill then payment; AP outstanding becomes zero.
- Partial payment reduces AP by amount paid and leaves the exact balance.
- One payment can allocate to several bills; a bill can be paid by multiple payments.
- A payment with an unallocated amount is rejected in v1 unless a dedicated supplier-advance workflow is implemented.
- Duplicate post/retry does not duplicate journal or allocation.
- Concurrent payment attempts cannot overpay the same bill.
- Reversal restores AP/bank balances and bill outstanding status correctly.

### 15.3 End-to-end receiving-to-payment journey

1. User posts a Purchase Receipt; Inventory / GRNI is posted by Receipt module.
2. Default-checked option creates a linked draft Vendor Bill and opens it.
3. User enters supplier invoice number/date, confirms amounts/taxes, and selects Pay later / Already paid in full / Partially paid.
4. Vendor Bill posts; GRNI clears and AP is recognized.
5. If paid immediately/partially, a Vendor Payment posts and allocates to the bill.
6. The PO shows related bills and derived outstanding supplier exposure; it is not assigned a manually edited `PAID` status.

## 16. Implementation sequence

1. Confirm Party module supplier capability and existing Party FK convention.
2. Reuse Payment Terms from the PO module; implement invoice-date due-date calculation.
3. Implement Vendor Bill schema, contracts, draft form, manual creation, and create-from-receipt integration.
4. Implement receipt allocation/matching and GRNI clearing.
5. Implement AP posting profiles, VAT/variance handling, and bill reversal/credit-note policy.
6. Implement Vendor Payment schema, allocations, form, posting, and reversal.
7. Integrate the Bill screen's Pay later / Already paid / Partially paid guided flow.
8. Add AP aging, supplier statement, GRNI/AP reconciliation, concurrency, and end-to-end tests.

## 17. Decisions to preserve

- Vendor Bill is the AP liability event; Vendor Payment is the settlement event.
- Vendor Payment and Purchase Payment are synonyms for one module/entity; do not create duplicate tables or accounting flows.
- Receipt posts Inventory / GRNI; bill posts GRNI / AP; payment posts AP / Bank/Cash.
- Bill posting must not increase `onHandQty`; payment must not change inventory.
- Bill payment status is derived from posted payment allocations, never manually toggled.
- Payment Terms are shared with the PO module and due dates are calculated from supplier invoice date.
- Existing Party module is the only supplier/customer master; use Party FK and supplier capability validation.
