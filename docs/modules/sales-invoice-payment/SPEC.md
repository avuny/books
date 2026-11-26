# Sales Invoices & Customer Payments Module — Implementation Specification

**Status:** Companion specification to `SALES-ORDER-SPEC.md` and `SALES-DELIVERY-SPEC.md`.
**Audience:** Engineering, accounting, AR, sales operations, and QA.
**Scope:** Sales Invoice, Accounts Receivable, customer payment receipts, payment allocation, customer advances/on-account receipts, credit notes, and related journal posting.
**Out of scope:** Sales Order/reservation and outbound stock movement/COGS; see the companion modules.

## Shared integration contract

### Existing Party module is the customer master (mandatory)

This module must reuse the already implemented Party module. Do not create `customers`, `customer_profiles`, or duplicate customer identity tables merely to support Sales.

- Persist the Party primary key as `party_id` on Sales Orders, Sales Deliveries, Sales Invoices, and Customer Payments.
- The UI label remains **Customer**. The async combobox must query Party records eligible to act as customers, and support view/create flows using the existing Party UI/API.
- At the service boundary, validate that the referenced Party belongs to the active organization, is active, and is permitted to act as a customer according to the Party module's existing role/capability model. Do not invent a new role table if Party already has one.
- Copy the customer-facing name, billing/shipping addresses, tax identifiers, contact details, and other legally relevant values onto documents as immutable snapshots at the appropriate document/posting boundary. Historical documents must not change when the Party record changes.
- Customer defaults (payment terms, currency, addresses, tax profile, credit limit/hold if supported) should be read from Party's existing extension/metadata model. Add only missing customer-specific fields to the existing Party model; do not create a parallel customer master.

### Shared infrastructure

Reuse the existing organization-scoped document numbering, contracts package, payment terms, currency/money helpers, item/UOM/tax configuration, Stock Movement Service, inventory reservation service, inventory valuation/cost-layer service, journal-entry service, and audit conventions. The Sales modules own their business documents; they do not own or duplicate these shared ledgers/services.

### Scope split and ownership

This specification belongs to the Sales Finance module. It owns Sales Invoices, Customer Payments, Customer Payment Allocations, and applicable credit-note/advance workflows. It reads Sales Order and Sales Delivery source documents but does not own stock movements, reservations, cost layers, or COGS.

The modules communicate through IDs and explicit use-cases. Financial posting must use the existing Journal Entry service and immutable source references.

## 1. Goals and naming

The Sales Invoice is the customer-facing financial document that records what the customer is charged. Posting it normally recognizes Accounts Receivable, revenue, and applicable output tax under the configured revenue/tax policy. A Customer Payment (also called Payment Received or Customer Receipt in UI copy) records money received from the customer and allocates it to one or more invoices, or explicitly records an advance/on-account amount.

Recommended terms: **Sales Invoice**, **Customer Payment** (UI alternative: **Payment Received**), and **Credit Note**. Do not call a Customer Payment a Sales Receipt unless that term is already established in the application's finance vocabulary.

## 9. Sales Invoice specification

### 9.1 Purpose and terminology

A Sales Invoice is the customer-facing financial document. Posting it normally recognizes Accounts Receivable and sales revenue / output tax according to the accounting and tax policy.

Do not call a Sales Invoice a Payment. Do not mark the Sales Order paid when an invoice is created.

### 9.2 Creating an invoice from delivery

Recommended default UX: when posting a Sales Delivery, provide a default-checked option:

**Create customer invoice after delivery**  
“Create a draft invoice for the products delivered. You can review the invoice and record payment now or later.”

When checked:

1. Post Sales Delivery and its stock effects.
2. Create a linked **Draft Sales Invoice** from eligible delivered lines and their commercial snapshots.
3. Redirect the user to the draft invoice (or show a clear “Open invoice” action if navigation would interrupt a multi-delivery workflow).
4. Let the user verify invoice number, invoice date, tax, discounts, totals, payment terms, and due date.
5. User posts the invoice; only then does it affect AR / revenue / tax.
6. Offer payment options: **Pay later**, **Already received in full**, or **Partially received**. A real Customer Payment is created if a payment option is selected.

If user unchecks it, leave delivered-but-uninvoiced quantities visible on SO and Delivery screens, with a **Create Sales Invoice** action.

This default is a UX convenience, not a rule that all accounting revenue must be recognized on invoice creation. Revenue recognition must follow the configured accounting policy and applicable standards.

### 9.3 Invoice fields

Header:

- `orgId`, `number`, `partyId`, optional `salesOrderId`
- `invoiceDate`, `dueDate`
- `paymentTermId` and immutable payment-term snapshots
- `currency`, exchange-rate snapshot if required
- billing address / tax registration snapshot
- `customerInvoiceReference` or internal reference as needed
- `status` (`DRAFT`, `POSTED`, and reversal / credit-note lifecycle)
- `postedAt`, `postedBy`
- `journalEntryId` (unique source reference in journal table)
- `note`, terms, createdBy, timestamps

Line:

- `salesInvoiceId`, `lineNo`
- optional `salesOrderLineId`
- optional `salesDeliveryLineId` or a many-to-many invoice allocation table
- `itemId` (nullable for service/charge line if supported)
- description snapshot
- quantity and unit snapshot
- unit price
- discount values
- tax code/rate snapshot
- net amount, tax amount, gross amount
- revenue account mapping snapshot/reference (or resolve from posting profile)

Support multiple invoices for one SO and invoices covering several deliveries only if there is a clear line-allocation model. Do not use a single `salesOrderId` header FK as the only matching mechanism when invoices can cover multiple SOs or deliveries. For v1, restricting one invoice to one SO is simpler and acceptable, but multiple partial invoices per SO must work.

### 9.4 Invoice posting and accounts receivable

For a $1,000 net sale with $150 output tax (illustrative only), a normal invoice posting is:

```text
Dr Accounts Receivable             1,150
    Cr Sales Revenue                      1,000
    Cr Output VAT Payable                   150
```

The invoice increases customer Accounts Receivable. It does not increase physical inventory and must not create a second outbound Stock Movement.

Account mapping is configured per organization / item category / tax code. Never hardcode GL account IDs in the form or line item component.

### 9.5 Invoice before delivery / customer advances

Do not assume invoices are always issued after delivery. Some businesses invoice deposits, subscriptions, services, or goods before dispatch.

For v1 stock-goods sales, the recommended default is to create invoices from posted delivered quantities. If pre-delivery invoicing is allowed:

- Determine whether the amount is a customer advance / contract liability or whether revenue is actually recognized under the applicable policy.
- A prepayment invoice must not cause stock to leave inventory.
- A posted advance/deposit invoice may debit AR and credit Customer Advances / Contract Liability (plus applicable tax according to local tax rules), rather than immediately crediting Sales Revenue.
- On delivery / performance, reclassify the applicable advance to revenue and recognize COGS when control transfers.
- Keep local tax timing configurable; tax point may differ from revenue-recognition timing.

Do not silently post a normal sales-revenue invoice before delivery if the performance obligation has not been satisfied.

### 9.6 Payment terms and due date

Use the shared `payment_terms` model from Purchasing. Compute due date from invoice date:

- Due on receipt: invoice date.
- Net N: invoice date + N calendar days.
- End of month: last day of invoice month.
- End of next month: last day of following month.
- Other supported terms: use the method-specific calculation.

Persist calculated `dueDate`. Later payment-term master edits must not rewrite posted invoices. Authorized due-date overrides require an audit reason.

---

## 11. Customer Payment specification

### 11.1 Purpose

A Customer Payment is the receipt of money from a customer. It is distinct from a Sales Invoice and Sales Order.

Recommended table names:

- `customer_payments`
- `customer_payment_allocations`

Reuse existing cash/bank accounts, payment methods, and bank reconciliation modules where available.

### 11.2 Payment form fields

- Customer.
- Payment number (server-generated, e.g. `CP-...` or `RCPT-...`; select one prefix convention).
- Payment date (organization-local today by default).
- Amount and currency.
- Deposit-to account (cash / bank).
- Payment method (cash, bank transfer, card, cheque, etc. from shared payment methods).
- Transaction/reference number (optional but recommended for bank/card/cheque).
- Memo / notes.
- Invoice allocations (optional for customer advances / unapplied receipts).

### 11.3 Payment allocations

- One payment can be allocated to multiple invoices for the same customer and currency (unless explicit FX handling exists).
- One invoice can be paid by multiple Customer Payments.
- Allocation amount must be positive and cannot exceed the payment's unallocated amount or invoice's outstanding balance, except for separately modeled customer credit / overpayment.
- Do not allocate a payment to another customer's invoice.
- Keep unapplied amount visible as customer credit / on-account payment according to accounting policy.

### 11.4 Payment status calculation

For a Sales Invoice:

```text
outstandingAmount = invoiceGrossAmount - allocatedPostedPayments - appliedCredits

if outstandingAmount == invoiceGrossAmount: UNPAID
else if outstandingAmount > 0: PARTIALLY_PAID
else: PAID (or OVERPAID / CUSTOMER_CREDIT if permitted)
```

Use exact integer minor-unit arithmetic (`BigInt`) for money. Account for credit notes, write-offs, exchange differences, and rounding in the final implementation.

### 11.5 Posting a Customer Payment

One transaction must:

1. Lock payment and target invoices.
2. Validate customer, currency, active bank/cash account, date, and allocations.
3. Insert payment allocation rows.
4. Create a balanced journal entry: Dr Cash/Bank; Cr Accounts Receivable for allocated amount, and/or Cr Customer Advances for unapplied / advance amount depending on policy.
5. Set payment to `POSTED`, `postedAt`, `postedBy`.
6. Update invoice payment summaries / caches if used.

The journal source should be unique, e.g. `sourceType = "CUSTOMER_PAYMENT"`, `sourceId = customerPayment.id`.

---

### 10.1 Account types to configure

At minimum, configure / map:

| Account | Type | Purpose |
|---|---|---|
| Inventory | Asset | Value of goods held by the company. |
| Cost of Goods Sold (COGS) | Expense | Cost basis of goods sold / control transferred. |
| Sales Revenue | Income | Revenue from products / services. |
| Sales Returns / Allowances | Contra-income | Customer returns, refunds, and price allowances where applicable. |
| Accounts Receivable | Asset | Amount customers owe on posted invoices. |
| Output VAT / Sales Tax Payable | Liability | Tax collected / owed to tax authority. |
| Customer Advances / Contract Liability | Liability | Amount received or invoiced before the related performance obligation is satisfied, when applicable. |
| Cash / Bank | Asset | Customer payment destination. |
| Inventory Write-off / Damage | Expense | Damaged goods or approved inventory loss if separately required. |

Use existing `accounts` and posting-profile conventions. The list above is conceptual; map actual account IDs through organization configuration, item groups, tax setup, and posting profiles.

### 10.4 Invoice posting: AR, revenue, and tax

For a typical delivered goods invoice:

```text
Dr Accounts Receivable       [gross invoice total]
    Cr Sales Revenue              [net taxable + non-taxable revenue]
    Cr Output VAT                 [tax total]
```

If discounts are presented separately, use the configured contra-revenue / discount account or reduce the net sales revenue according to the chart-of-accounts policy.

**Do not credit Inventory on invoice posting** if the stock movement already recognized COGS / Inventory at delivery. That would double-count inventory reduction.

**Do not debit COGS on invoice posting** if COGS was recognized at delivery. Keep the inventory and revenue event postings separate where their trigger events differ.

### 10.5 Customer Payment

For a $1,150 payment received against a posted invoice:

```text
Dr Cash / Bank               1,150
    Cr Accounts Receivable        1,150
```

A Customer Payment must be a business document with one or more allocations to invoices. Do not set `invoice.status = PAID` directly from a UI toggle.

### 10.6 Customer advance / payment before invoice

If the customer pays before the Sales Invoice exists, record a Customer Payment / Customer Advance against the customer without an invoice allocation:

```text
Dr Cash / Bank               500
    Cr Customer Advances          500
```

When a qualifying invoice is posted and the advance is applied:

```text
Dr Customer Advances         500
    Cr Accounts Receivable        500
```

Exact tax treatment and whether advances are recorded through a receipt, deposit invoice, or liability account depends on the jurisdiction and policy. Keep this workflow explicit and configurable; never silently apply an unallocated payment to arbitrary invoices.

### 10.8 Example end-to-end journal set

Assume: selling price $1,000 net, output tax $150, cost-layer value $600, customer pays immediately.

1. Confirm SO: no journal.
2. Post Delivery / control transfer:

```text
Dr COGS                       600
    Cr Inventory                   600
```

3. Post Sales Invoice:

```text
Dr Accounts Receivable      1,150
    Cr Sales Revenue              1,000
    Cr Output VAT                  150
```

4. Record Customer Payment:

```text
Dr Bank                     1,150
    Cr Accounts Receivable       1,150
```

Final balances from this example:

- Inventory decreases by $600.
- COGS increases by $600.
- Sales Revenue increases by $1,000.
- Output VAT Payable increases by $150.
- Accounts Receivable returns to zero after payment.
- Bank increases by $1,150.

---

## 4. Database design owned by this module

Logical schema guidance only. Use existing Drizzle helpers, organization-composite references, immutable posted documents, integer minor-unit journal values, and source idempotency conventions.

### 4.1 Existing tables and services to reuse

- Party module: customer identity as `party_id`; never create a second customers table.
- `sales_orders` / `sales_order_lines`: commercial source and ordered pricing snapshots.
- `sales_deliveries` / `sales_delivery_lines`: eligible delivered quantities and references.
- Shared `payment_terms`: customer-specific defaults read from Party; invoice snapshots terms and due date.
- `accounts`, `journal_entries`, `journal_entry_lines`: AR, revenue, output tax, advances, cash/bank journals.
- Shared tax, currency, payment method, document numbering, bank/cash, and accounting period services.

### 4.2 `sales_invoices` logical fields

```text
sales_invoices
- id, org_id, number (org-unique), party_id
- sales_order_id (nullable if invoice can cover multiple SOs)
- invoice_date, due_date, payment_term_id
- payment-term name/method/days snapshots
- currency and exchange-rate snapshot (if applicable)
- customer name, billing address, tax registration snapshots
- subtotal, discount_total, tax_total, gross_total
- outstanding_amount (optional reconciled cache)
- status: DRAFT | POSTED | VOID/REVERSED (follow project convention)
- journal_entry_id or unique journal source lookup
- posted_at/by, created_by, note, timestamps

sales_invoice_lines
- id, org_id, sales_invoice_id, line_no
- sales_order_line_id (optional), item_id (optional for service lines)
- description_snapshot, unit_id, quantity, base_quantity (when applicable)
- unit_price, discount fields, tax_code_id / tax snapshot
- net_amount, tax_amount, gross_amount
- revenue account/posting-profile reference or snapshot
- timestamps
```

For invoice lines sourced from one or more Delivery lines, use `sales_invoice_line_delivery_allocations` (invoice_line_id, delivery_line_id, allocated_base_qty, allocated_net_amount) or an equivalent existing allocation model. Lock and validate eligible uninvoiced quantity transactionally; do not rely on client counters. V1 may restrict one invoice to one SO, but must support multiple partial invoices against the same SO.

### 4.3 `customer_payments` and allocations logical fields

```text
customer_payments
- id, org_id, number (org-unique), party_id
- payment_date, currency, amount
- payment_method_id, deposit_account_id (cash/bank)
- external_reference, status: DRAFT | POSTED | REVERSED
- journal_entry_id or unique journal source lookup
- posted_at/by, note, created_by, timestamps

customer_payment_allocations
- id, org_id, customer_payment_id
- sales_invoice_id (nullable only for explicit advance/on-account amount)
- allocated_amount, timestamps
```

One Customer Payment can allocate to multiple invoices for the same Party and currency. One invoice can be settled by multiple payments. An unallocated amount must remain explicitly classified as customer advance/on-account credit; it must not disappear as an unexplained difference.

### 4.4 Constraints and indexes

- Composite tenant FKs for Party, invoice, order, delivery, payment method, deposit account, journal entry, and source allocation records.
- Unique `(org_id, number)` for invoice/payment document numbers.
- Index invoices by `(org_id, party_id, invoice_date)`, `(org_id, status, due_date)`; payments by `(org_id, party_id, payment_date)`; allocations by invoice and payment.
- `ON DELETE RESTRICT` for financial history. Posted bills/payments/credit notes cannot be updated or deleted.
- Money uses exact integer minor units for journals; allocation sums use BigInt.

## 5. API and service boundaries

### 5.1 Sales Invoices

- `POST /sales-deliveries/:id/invoice-draft` — create a draft from eligible delivered lines.
- `POST /sales-orders/:id/invoices/draft` — create a partial draft from delivered/uninvoiced quantities where supported.
- `POST /sales-invoices` — manual draft for allowed service/advance workflows.
- `GET /sales-invoices`, `GET /sales-invoices/:id`.
- `PATCH /sales-invoices/:id` — draft-only edit.
- `POST /sales-invoices/:id/post` — validate and post AR/revenue/tax or advance liability.
- `POST /sales-invoices/:id/credit-note` — create linked credit note; never rewrite posted invoice.

### 5.2 Customer Payments

- `POST /customer-payments` — create draft receipt/payment document.
- `GET /customer-payments`, `GET /customer-payments/:id`.
- `PATCH /customer-payments/:id` — draft-only edit.
- `POST /customer-payments/:id/post` — post bank/cash, AR/advances and allocation records.
- `POST /customer-payments/:id/reverse` — linked reversal subject to bank reconciliation controls.

### 5.3 Transaction boundary

Invoice posting must atomically commit invoice status, source allocations, calculated outstanding balance, tax/revenue/AR journal, and audit fields. Customer Payment posting must atomically commit payment status, invoice allocations, advance/unapplied classification, bank/AR or advances journal, and audit fields. Both use `journal_entries` source idempotency (`sourceType`, `sourceId`). Do not change inventory quantities or post COGS from these endpoints.

## 6. User experience for non-accountants

### 6.1 Create invoice after Delivery

After posting a Sales Delivery, offer a default-checked option: **Create customer invoice after delivery**. Explanation: “Create a draft invoice for the products delivered. You can review it and record payment now or later.” When checked, the Delivery module requests a draft from this module and redirects to it or provides an Open Invoice action. The draft is prefilled from accepted delivered quantities and commercial snapshots. It still requires invoice number/date/tax review and explicit posting.

### 6.2 Invoice payment choices

When posting/completing an invoice, present: **Pay later**, **Already received in full**, or **Partially received**. If full/partial is selected, create a real Customer Payment draft or posted payment according to the application's confirmation design. Require payment date, amount, deposit account, method, and reference where applicable. Never mark an invoice paid through a boolean or direct status update.

### 6.3 Customer Payment terminology

Use **Customer Payment** internally and preferably in navigation. A plain-language UI label such as **Payment Received** may be clearer. On the Customer/Party detail screen, show posted invoices, payments, unapplied advances, and outstanding balance separately.

### 16.4 Invoice validation

- Invoice must be draft to edit or post.
- Customer and currency must match source SO / delivery where linked.
- Invoice quantity cannot exceed eligible uninvoiced source quantity unless an explicit non-delivery invoice policy is used.
- Recalculate tax and totals on server.
- Due date must be calculated from invoice date and selected payment term.
- Accounts and tax codes must be active and postable.
- Journal must balance and accounting period must be open.
- Posted invoice cannot be edited/deleted; corrections use credit notes / reversal procedures.

### 16.5 Customer Payment validation

- Payment amount > 0.
- Payment customer, currency, and invoice customers must match.
- Deposit account must be active and accept posting.
- Sum of allocations cannot exceed payment amount.
- Allocation cannot exceed invoice remaining balance unless customer credit / overpayment is explicitly supported.
- Payment date must be in an open accounting period.
- Posted payment is immutable and corrected through a reversal / refund process.

### 16.6 Security and permissions

Suggested granular permissions:

- `sales.orders.read`, `sales.orders.create`, `sales.orders.update_draft`, `sales.orders.confirm`, `sales.orders.cancel`, `sales.orders.close`.
- `sales.deliveries.read`, `sales.deliveries.create`, `sales.deliveries.post`, `sales.deliveries.reverse`.
- `sales.invoices.read`, `sales.invoices.create`, `sales.invoices.post`, `sales.invoices.credit_note`.
- `sales.payments.read`, `sales.payments.create`, `sales.payments.post`, `sales.payments.reverse`.
- `inventory.reservations.read` and any override permission for unreserved fulfillment / negative stock.

The backend must enforce permissions. Hiding a button is not authorization.

---

### 17.1 Draft documents

Draft SOs, Deliveries, Invoices, and Payments may be edited/deleted according to ordinary draft rules. No posted stock or GL effect exists.

### 17.4 Sales Credit Note

A posted Sales Invoice correction uses a **Credit Note** (or linked reversal where full cancellation is allowed):

```text
Dr Sales Returns / Allowances or Sales Revenue reversal
Dr Output VAT Payable reversal (where applicable)
    Cr Accounts Receivable
```

For a refund paid back to the customer:

```text
Dr Customer Refund / Accounts Payable (policy-specific)
    Cr Bank / Cash
```

For goods physically returned and accepted into inventory, separately recognize inventory and COGS reversal using the return valuation workflow. A credit note alone must not increase `onHandQty`.

### 17.5 Payment reversal / refund

- Do not delete a posted Customer Payment.
- Reverse through the accounting/bank workflow, respecting bank reconciliation locks.
- Unallocate or reverse invoice allocations consistently.
- A refund is a separate money-out transaction, not a negative Customer Payment unless the accounting model explicitly represents it that way.

---

## 8. Reporting and reconciliation

- Sales Invoices by customer Party, status, date, due date, tax code, and amount.
- Accounts Receivable aging based on posted invoices less posted payments and credit notes.
- Customer statements and customer balance by Party.
- Customer Payments by date, method, cash/bank account, and allocation status.
- Unapplied customer receipts / advances and overpayments.
- Delivered-but-uninvoiced quantities/value.

Reconciliation: AR control account must equal the customer subledger; invoice gross less posted allocations and credit notes must equal outstanding balance; Customer Payment allocations plus unapplied amount must equal posted payment amount; each posted invoice/payment/credit note must have one balanced journal entry; no invoice/payment event may create a stock movement or duplicate COGS.

## 9. Testing and acceptance criteria

- Draft invoice has no GL effect. Posting a standard Sales Invoice debits AR and credits revenue/output tax according to mapping.
- Invoice posting does not alter `onHandQty`, `reservedQty`, stock movements, cost layers, or COGS.
- Default invoice-from-delivery workflow uses eligible delivered/uninvoiced quantities and prevents over-invoicing under concurrent requests.
- Payment term and due date are snapshotted; later term edits do not rewrite posted invoice.
- Pay Later leaves invoice outstanding. Full and partial receipt paths create genuine Customer Payment documents and journal entries.
- One payment can allocate to multiple invoices; multiple payments can settle one invoice. Party and currency mismatches are rejected.
- Advance/on-account receipts are explicitly posted to Customer Advances, then applied by a separate allocation/reclassification flow.
- Credit notes reverse AR/revenue/tax appropriately and do not change inventory unless a separate return receipt is posted.
- Payment reversals preserve history and respect bank reconciliation locks.
- AR subledger reconciles to control account; retries are idempotent; closed periods reject posting.

## 10. Decisions to preserve

1. Sales Invoice and Customer Payment are separate business documents.
2. Invoice posting creates AR and revenue/tax (or an advance/contract-liability treatment where required); it does not move stock.
3. Customer Payment posting debits cash/bank and credits AR for allocated amounts; unapplied advances credit Customer Advances.
4. Paid status is derived from posted allocations, not manually toggled.
5. Reuse Party, payment terms, tax, accounts, journal-entry, document-numbering, bank/cash, and payment-method infrastructure.
6. Posted financial documents are immutable; corrections use Credit Notes, payment reversals, and refunds.
7. Inventory/COGS remains the Delivery/Valuation module's responsibility.

## 11. Implementation sequence

1. Audit Party customer capability/default fields, invoice tax rules, payment terms, AR control account, payment methods, cash/bank accounts, and journal service.
2. Add Sales Invoice/Customer Payment contracts, enums, and numbering prefixes.
3. Create invoice tables and source allocation model; implement draft-from-Delivery.
4. Implement invoice posting, AR/revenue/tax, advance invoice treatment if required.
5. Create payment and allocation tables; implement full/partial/multi-invoice payment posting.
6. Implement customer advances, credit notes, payment reversal/refunds.
7. Add AR reports, customer statements, reconciliation jobs, and end-to-end tests.

## 12. Repository checks before implementation

Verify Party's customer capability model and customer defaults; existing tax calculation and legal invoice numbering; AR control-account configuration; existing shared payment model (incoming vs outgoing); payment methods and cash/bank account restrictions; customer advance policy; credit note/reversal conventions; bank reconciliation locks; and closed-period enforcement. Do not assume accounting/tax timing from generic Sales Order statuses.

## 13. Relationship to companion Sales modules

- `SALES-ORDER-SPEC.md` owns Sales Orders and stock reservations.
- `SALES-DELIVERY-SPEC.md` owns outbound Delivery Notes, stock movements, reservation consumption, inventory costing, and COGS.
- This module owns Sales Invoices, AR, Customer Payments, advances, and credit notes. Delivery may request draft invoice creation, but cannot create or post invoice/payment ledger rows directly.
