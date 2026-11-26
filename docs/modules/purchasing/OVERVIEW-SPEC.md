# Purchasing & Procurement Module — Implementation Specification

**Status:** Proposed implementation specification  
**Audience:** Engineering, product, QA, and accounting stakeholders  
**Scope:** Purchase Orders, supplier shipments / in-transit tracking, Purchase Receipts (GRNs), Vendor Bills, Vendor Payments, inventory projections, stock movements, and automatic journal posting.

---

## 1. Goals

Build a purchasing workflow that is understandable to non-accountants while preserving correct inventory and double-entry accounting behavior.

The system must support:

1. Creating and confirming Purchase Orders (POs).
2. Generating PO numbers automatically and displaying the preview in the form.
3. Selecting an existing vendor through an asynchronous combobox, viewing the vendor, or creating a vendor without leaving the PO workflow.
4. Reusable date-picker fields in `@workspace/ui/blocks/form`.
5. Organization-scoped payment terms, including seeded system terms and user-created terms, with a maximum of 20 terms per organization.
6. Generic reusable line items that can serve Inventory Adjustments, Purchase Orders, and future Sales Orders.
7. Partial and multiple supplier shipments.
8. Partial and multiple Purchase Receipts.
9. Accurate `onOrderQty`, `inTransitQty`, and `onHandQty` projections.
10. Stock movement creation when a Purchase Receipt is posted.
11. GRNI accrual journal entries on receipt and Accounts Payable recognition when a Vendor Bill is posted.
12. Optional draft Vendor Bill creation after a Purchase Receipt, enabled by default.
13. Recording full, partial, or later Vendor Bill payments.
14. Immutable posted inventory and accounting history, corrected through reversals rather than destructive edits.
15. Tenant isolation, auditability, idempotency, and safe concurrent posting.

### 1.1 Non-goals for the first release

Unless already supported elsewhere in the ERP, the following are not required for the first release:

- Advanced landed-cost allocation across multiple receipts.
- Supplier price catalogs and automatic price negotiation.
- Purchase requisitions and multi-level approval matrices beyond the existing approval infrastructure.
- Electronic supplier invoicing integrations.
- Complex Incoterms automation. The first release uses receipt-based inventory ownership recognition; see §8.6.
- Vendor prepayments made before a bill. These can be added later using a supplier-advance account and payment allocation workflow.
- Automated evaluated-receipt-settlement (ERS) posting. Auto-created bills remain drafts for user review.

---

## 2. Key domain concepts

Keep these as separate business documents. They represent different facts and must not be collapsed into one entity or one status field.

| Document | Business question | Primary effect |
|---|---|---|
| **Purchase Order** | What did we agree to buy? | Creates an expected-supply commitment (`onOrderQty`) when confirmed. No inventory or AP journal by default. |
| **Purchase Shipment** | What has the supplier dispatched? | Reclassifies expected quantity from `onOrderQty` to `inTransitQty`. Does not create a GL entry under the default receipt-based ownership policy. |
| **Purchase Receipt / GRN** | What physically arrived and was accepted? | Creates a Stock Movement, increases `onHandQty`, reduces `inTransitQty` (or `onOrderQty` for direct receipt), creates cost layers, and posts Inventory / GRNI. |
| **Vendor Bill / Supplier Invoice** | What amount has the supplier invoiced? | Clears matched GRNI, recognizes taxes / variances, and increases Accounts Payable. |
| **Vendor Payment** | What money did we send to the supplier? | Posts a payment and reduces Accounts Payable through bill allocations. |

**Terminology:** Use **Vendor Bill** in the application UI for the AP document. Store the supplier's external invoice number separately as `supplierInvoiceNumber`. “Supplier Invoice” can be used as explanatory copy or a search synonym. Use **Vendor Payment** for money paid to a supplier; avoid a generic `paid` flag or a PO-level payment status.

### 2.1 Core UX principle

A non-accountant should not need to understand GRNI or journal entries. The UI should explain the next business action:

- “Receive Products” creates a Purchase Receipt.
- By default, the receipt flow also creates a **draft Vendor Bill** for review.
- The user chooses whether the supplier is to be paid later, has already been paid, or has been partially paid.
- The system still records the separate receipt, bill, and payment transactions internally.

Do not silently mark a bill as paid. A real Vendor Payment record and journal entry are required.

---

## 3. Lifecycle and status model

### 3.1 Do not use one status for every workflow

A PO's approval, fulfillment, billing, and payment progress are independent dimensions. The PO must not be marked `PAID` because payment belongs to Vendor Bills and Vendor Payments.

Recommended PO header status:

```ts
export const PURCHASE_ORDER_STATUSES = [
  "DRAFT",
  "CONFIRMED",
  "PARTIALLY_SHIPPED",
  "IN_TRANSIT",
  "PARTIALLY_RECEIVED",
  "RECEIVED",
  "CLOSED",
  "CANCELLED",
] as const;
```

The exact header fulfillment status should be calculated from line/document quantities. `DRAFT`, `CONFIRMED`, `CLOSED`, and `CANCELLED` are explicit lifecycle states; intermediate shipping/receiving states are derived summaries. Do not let clients arbitrarily patch a PO status.

Recommended independent status dimensions:

- **PO lifecycle:** draft / confirmed / closed / cancelled.
- **Fulfillment summary:** not shipped / partially shipped / in transit / partially received / received.
- **Billing summary:** uninvoiced / partially invoiced / invoiced (derived from receipt-to-bill allocations).
- **Payment summary:** unpaid / partially paid / paid (derived from related Vendor Bills; display-only on PO).

A PO can therefore be `PARTIALLY_RECEIVED`, `PARTIALLY_INVOICED`, and have bills that are `PARTIALLY_PAID` at the same time.

### 3.2 PO lifecycle transitions

| Action | Preconditions | Result | Inventory projection | GL |
|---|---|---|---|---|
| Save Draft | Valid draft form; vendor and line validation per draft rules | `DRAFT` | No change | No journal |
| Confirm | Draft; vendor active; at least one valid line; required fields complete | `CONFIRMED` | Add ordered base quantity to `onOrderQty` | No journal by default |
| Record Shipment | Confirmed PO; shipment quantities do not exceed unshipped quantities | Fulfillment summary recalculated | `onOrderQty -= shipped`; `inTransitQty += shipped` | No journal under default policy |
| Post Purchase Receipt | Valid receipt; quantities do not exceed shipped quantity, except explicit direct-receipt flow | Fulfillment summary recalculated | `inTransitQty -= received`; `onHandQty += accepted`; direct receipt can reduce `onOrderQty` instead | Inventory / GRNI journal for accepted inventory |
| Close | No unresolved shipment/receipt quantities; remaining unshipped quantities explicitly cancelled/closed with reason | `CLOSED` | Release remaining `onOrderQty` if explicitly closed as unfulfilled | No journal by default |
| Cancel | Draft, or confirmed with no shipped/received activity; otherwise use line-level cancellation / return procedures | `CANCELLED` | Release outstanding `onOrderQty` | No journal by default |

### 3.3 Intermediate status derivation

For each PO line, quantities are expressed in the item's base unit:

```text
orderedBaseQty
cancelledBaseQty
shippedBaseQty
receivedBaseQty       // physically delivered, including rejected quantity
acceptedBaseQty       // accepted into inventory
invoicedBaseQty       // quantity matched to supplier bill(s)
```

Derived quantities:

```text
unshippedBaseQty = orderedBaseQty
                 - cancelledBaseQty
                 - shippedBaseQty

inTransitBaseQty = shippedBaseQty - receivedBaseQty

unreceivedBaseQty = orderedBaseQty
                  - cancelledBaseQty
                  - receivedBaseQty

unbilledAcceptedBaseQty = acceptedBaseQty - invoicedBaseQty
```

All derived values must be non-negative. The service must prevent over-shipment, over-receipt, and over-invoicing except where a separately authorized overage policy explicitly allows it.

Suggested fulfillment summary precedence:

1. `DRAFT` if PO lifecycle is draft.
2. `CANCELLED` if fully cancelled before any posted fulfillment.
3. `CLOSED` if explicitly closed and no open fulfillment quantity remains.
4. `RECEIVED` if every non-cancelled ordered quantity has been physically received (accepted or rejected with a recorded disposition).
5. `PARTIALLY_RECEIVED` if some quantity has been received but remaining ordered quantity exists.
6. `IN_TRANSIT` if shipped quantity is outstanding and nothing has yet been received.
7. `PARTIALLY_SHIPPED` if some quantity has shipped while some confirmed quantity remains unshipped.
8. Otherwise `CONFIRMED`.

The header is only a summary. Show line-level counters and shipment/receipt documents for the exact state.

### 3.4 Partial operations are first-class

The system must support:

- One PO line shipped in multiple shipments.
- One shipment received in multiple Purchase Receipts if operationally required.
- Multiple receipt documents for one PO.
- Multiple Vendor Bills for one PO and one or multiple receipts.
- One Vendor Bill matched to several receipts.
- Partial bill payments and one payment allocated across several bills.

Never assume one PO = one shipment = one receipt = one bill = one payment.

---

## 4. Purchase Order form specification

### 4.1 Header fields

| Field | Required | UI | Default / behavior |
|---|---:|---|---|
| `number` | Yes | Read-only text with copy affordance | Server-generated `PO-...`; preview is shown when form opens. Final value allocated by server on save. |
| `vendorId` | Yes to confirm; optionally required for draft depending on existing draft policy | Async combobox | Search active vendors within current organization. Include view icon and “Create vendor” action. |
| `date` | Yes | Reusable date picker | Organization-local current date. |
| `expectedDeliveryDate` | Recommended | Reusable date picker | Defaults to the organization-local current date as requested; user may change or clear if delivery date is unknown. |
| `paymentTermId` | Recommended | Select / combobox | Vendor default term, otherwise organization default, otherwise “Due on receipt”. |
| `warehouseId` | Depends on line-location model | Select | Optional header default copied to lines; each line may override destination location. |
| `supplierReference` | No | Text | Optional quote / supplier reference. |
| `notes` | No | Textarea | Internal purchasing notes. |
| `currency` | Yes | Select or vendor default, potentially read-only after first confirmation | Vendor / organization default. Do not silently change currency after confirmation. |

The PO number is mandatory in persisted records but must never be typed or supplied as authoritative input by the client.

### 4.2 PO number preview and allocation

- Display a preview such as `PO-000123` in the create form.
- Add a server endpoint such as `GET /purchase-orders/number-preview` if the UI needs a preview before saving.
- Preview values are advisory; another request may consume the same sequence value.
- Allocate the authoritative number server-side during the create transaction using an organization-scoped sequence service and row locking / atomic sequence update.
- Enforce `UNIQUE (org_id, number)`.
- Never generate authoritative document numbers with `Date.now()`, client counters, or `toISOString()` fragments.
- Sequence gaps are acceptable. Do not promise gapless numbering.
- If an existing generic document-number service exists, extend/reuse it rather than adding a competing sequence implementation.

### 4.3 Vendor async combobox

The vendor field must:

- Search by vendor name, code, tax number, email, and other supported search keys.
- Be asynchronous, debounced, paginated, organization-scoped, and limited to active vendors by default.
- Show vendor code and a useful secondary description in results.
- Provide a **view** icon that opens the selected vendor detail page without losing the PO form state.
- Provide a **Create vendor** action that opens a dialog/drawer, creates the vendor, and selects the returned vendor ID after successful creation.
- Preserve selection when options are refreshed.
- Handle no results, loading, request error, and inactive vendor states.
- Prevent cross-organization vendor IDs at the API and database layers.

### 4.4 Dates and reusable form blocks

Create a reusable `DatePickerField` in `@workspace/ui/blocks/form` that integrates the shared date-picker component with React Hook Form.

Requirements:

- Accept `control`, `name`, `copy`, `disabled`, `minDate`, `maxDate`, `clearable`, and relevant display props.
- Work with ISO date-only values (`YYYY-MM-DD`) rather than timestamps.
- Do not convert date-only values through UTC in a way that can shift the displayed calendar day.
- Respect the organization's configured timezone when calculating “today”.
- Use the same component in Purchase Orders, Purchase Receipts, Vendor Bills, and other forms.
- Keep UI copy and localization outside the reusable primitive.

**Implementation warning:** Avoid `new Date().toISOString().slice(0, 10)` for organization-local defaults; UTC can produce yesterday/tomorrow for some timezones. Prefer a server-provided organization-local `today` value or a shared timezone-aware date utility.

### 4.5 Payment terms field

- Render active terms for the current organization.
- If the vendor has a default payment term, preselect it.
- Include a “Manage payment terms” affordance only where the user has permission.
- Save the selected `paymentTermId` on the PO.
- Snapshot term name, calculation method, and days on the PO when confirmed so later edits to a reusable term do not rewrite historical document meaning.

### 4.6 Form actions

Two primary actions are required:

1. **Save as Draft** — saves editable PO data; no inventory projection change, stock movement, or journal entry.
2. **Save and Confirm** — opens a confirmation dialog showing vendor, line count, ordered quantity/value, destination warehouse(s), expected date, and a clear explanation: “Confirming this order adds the quantities to On Order. It does not increase physical stock or record a supplier bill.” On confirmation, save and confirm atomically.

If form data is invalid, show field-level errors. Prevent double submission. Both actions are disabled while pending.

### 4.7 Suggested form copy

- Number: “Automatically generated”
- Expected delivery: “When do you expect the supplier to deliver?”
- Payment terms: “When is the supplier payment due after the invoice date?”
- Confirm dialog: “Confirm purchase order?”
- Confirm dialog explanation: “This records the quantities as On Order. Inventory increases only when the goods are received.”

---

## 5. Purchase Order line items

### 5.1 Line fields

A PO line is commercial intent, not yet a stock movement. Recommended fields:

| Field | Required | Notes |
|---|---:|---|
| `itemId` | Yes for stock / product lines | Async item picker. For v1, support inventory items; service/non-stock lines may be enabled when account mapping is ready. |
| `description` | Optional / item default | Persist a description snapshot for historical documents. |
| `warehouseId` | Yes for stock lines | Can inherit PO default warehouse. |
| `locationId` | Yes for stock lines | Expected receipt location; must be a valid receiving/stockable location. |
| `unitId` | Yes | Purchasing unit of measure. |
| `orderedQty` | Yes, > 0 | User-entered quantity in selected unit. |
| `baseUnitFactor` | Yes | Snapshot conversion factor at confirmation. |
| `orderedBaseQty` | Yes | Persisted / calculated base-unit quantity used by inventory projections. |
| `unitPrice` | Yes for priced lines | Preserve sufficient decimal precision; avoid premature rounding of unit costs. |
| `discountRate` / `discountAmount` | Optional | Use whichever discount model is supported consistently by sales/purchasing. |
| `taxCodeId` | Depends on tax module | Tax applied to the supplier invoice may differ; bill must store actual supplier invoice tax. |
| `lineNetAmount` | Derived | Store or calculate consistently using the ERP's money convention. |
| `notes` | Optional | Line-level note. |
| `expectedDeliveryDate` | Optional | Defaults from PO header; useful for split deliveries. |

Do not ask for a batch ID on the PO unless the supplier has provided a known batch/lot before receipt. Batch/serial capture normally occurs on the Purchase Receipt.

### 5.2 Item selection behavior

When an item is selected:

- Populate item description, purchase unit, conversion factor, and default purchase price where available.
- Load allowed units and destination location options.
- Load the item's batch/serial tracking policy.
- Display current `onHandQty`, `onOrderQty`, `inTransitQty`, and available quantity as informational values if the UI has this data.
- Never let the client-provided quantity projection become authoritative; server-side posting re-reads/locks the relevant rows.
- Changing the item must clear incompatible unit, batch, tax, and location selections.

### 5.3 Price behavior

- PO line unit price is the agreed estimated purchase price.
- Use PO price as the expected receipt cost unless the costing policy says otherwise.
- The Vendor Bill is the authoritative supplier-invoiced amount.
- Price discrepancies are handled at bill posting through a purchase price variance / inventory cost adjustment policy.
- For items using FIFO, the Purchase Receipt creates a cost layer using the configured receipt valuation amount.
- Persist currency and conversion/rate snapshots where multi-currency purchasing is supported.

---

## 6. Generic reusable LineItems component

The existing `LineItems` block is a good starting point, but it should be made domain-neutral before adding PO and later Sales Order forms.

### 6.1 Responsibility boundary

The shared block owns only generic line-array UI behavior:

- Render a field-array collection.
- Add/remove rows.
- Display title, empty state, add/remove labels, and row layout.
- Render a reusable async item selector where appropriate.
- Provide typed `index`, `field`, and `disabled` context to caller renderers.
- Render caller-provided fields and row footer.
- Preserve React Hook Form field-array keys and avoid index/key instability.

The shared block must not know about:

- Inventory adjustment direction or counted quantity semantics.
- Purchase unit price, purchase totals, or PO status.
- Sales price, margin, tax policy, or sales availability.
- API calls, navigation, authorization, translations, or accounting.

### 6.2 Proposed API shape (illustrative)

Keep the component typed using React Hook Form generics. Exact names can follow existing code conventions.

```ts
type LineItemsRenderContext<TLine> = {
  index: number;
  line: TLine;
  disabled: boolean;
};

type LineItemsProps<TValues, TLine> = {
  control: Control<TValues>;
  name: FieldArrayPath<TValues>;
  blankLine: TLine;
  copy: {
    title: string;
    addLine: string;
    removeLine: string;
    noLines: string;
    item?: string;
  };
  disabled?: boolean;
  renderMainField?: (ctx: LineItemsRenderContext<TLine>) => ReactNode;
  renderFields?: (ctx: LineItemsRenderContext<TLine>) => ReactNode;
  renderRowFooter?: (ctx: LineItemsRenderContext<TLine>) => ReactNode;
};
```

If the item picker is shared, expose it as an optional generic slot/adapter (`renderItemField` or `itemFieldConfig`) rather than forcing every domain line to have exactly the same item lookup behavior.

### 6.3 Migration plan

1. Refactor the current Inventory Adjustment usage without changing behavior.
2. Keep adjustment-specific fields (`locationId`, `unitId`, `batchId`, `countedQuantity`, notes) in the adjustment form's `renderFields`.
3. Add PO-specific fields (`locationId`, `unitId`, `orderedQty`, `unitPrice`, discounts, tax) in the PO form's `renderFields`.
4. Add Sales Order-specific fields later without changing the generic primitive.
5. Avoid `any` in the public component contract. If a narrow type escape is temporarily required internally, isolate it and add type tests.
6. Add component tests for adding/removing lines, stable keys, disabled state, and validation integration.

---

## 7. Payment Terms

### 7.1 Data model and behavior

Payment Terms are organization-scoped reusable records. The user-facing create form needs at least:

- Name
- Number of days (for day-based terms)

However, “Due end of month” cannot be represented correctly by a day count alone. Include a calculation method so special calendar terms work correctly.

Suggested methods:

```ts
export const PAYMENT_TERM_METHODS = [
  "DUE_ON_RECEIPT",
  "NET_DAYS",
  "END_OF_MONTH",
  "END_OF_NEXT_MONTH",
  "DAYS_AFTER_END_OF_MONTH",
] as const;
```

Suggested seeded system terms (names may be localized in UI):

| Code | Name | Method | Days |
|---|---|---|---:|
| `DUE_ON_RECEIPT` | Due on receipt | `DUE_ON_RECEIPT` | 0 |
| `NET_15` | Net 15 | `NET_DAYS` | 15 |
| `NET_30` | Net 30 | `NET_DAYS` | 30 |
| `NET_45` | Net 45 | `NET_DAYS` | 45 |
| `NET_60` | Net 60 | `NET_DAYS` | 60 |
| `EOM` | Due end of month | `END_OF_MONTH` | 0 |
| `NEXT_EOM` | Due end of next month | `END_OF_NEXT_MONTH` | 0 |

Custom terms in v1 can use `NET_DAYS` with a user-entered name and a non-negative integer day count. If custom calendar methods are enabled later, expose the method explicitly.

### 7.2 Maximum terms per organization

- Define the limit in `@avuny/contracts`, not as a UI-only magic number.
- Proposed constant: `PAYMENT_TERMS_MAX_PER_ORG = 20`.
- This specification interprets “maximum 20 terms per organization” literally: system-seeded terms count toward the total of 20. If product intent is 20 custom terms in addition to the system terms, change the constant/policy before implementation.
- Enforce the limit in the service transaction, not only in the frontend. Lock an organization-scoped terms/sequence row (or use an equivalent safe serialization strategy) before checking count and inserting, so two concurrent creates cannot exceed the cap.
- Do not hard-delete a term referenced by a PO or bill. Mark it inactive; historical snapshots remain readable.

### 7.3 Contracts constants

Example contract exports (names can be aligned with existing package conventions):

```ts
export const PAYMENT_TERMS_MAX_PER_ORG = 20;
export const PAYMENT_TERM_NAME_MAX_LENGTH = 80;
export const PAYMENT_TERM_DAYS_MAX = 3650;
export const PAYMENT_TERM_METHODS = [
  "DUE_ON_RECEIPT",
  "NET_DAYS",
  "END_OF_MONTH",
  "END_OF_NEXT_MONTH",
  "DAYS_AFTER_END_OF_MONTH",
] as const;

export const SYSTEM_PAYMENT_TERMS = [
  { code: "DUE_ON_RECEIPT", name: "Due on receipt", method: "DUE_ON_RECEIPT", days: 0 },
  { code: "NET_15", name: "Net 15", method: "NET_DAYS", days: 15 },
  { code: "NET_30", name: "Net 30", method: "NET_DAYS", days: 30 },
  { code: "NET_45", name: "Net 45", method: "NET_DAYS", days: 45 },
  { code: "NET_60", name: "Net 60", method: "NET_DAYS", days: 60 },
  { code: "EOM", name: "Due end of month", method: "END_OF_MONTH", days: 0 },
  { code: "NEXT_EOM", name: "Due end of next month", method: "END_OF_NEXT_MONTH", days: 0 },
] as const;
```

The Zod schema and inferred TS types should be exported from a purchasing/payment-terms contract module. API and UI must import the same constants.

### 7.4 Due date calculation

Calculate Vendor Bill due date from the **supplier invoice date**, not PO date or receipt date:

- `DUE_ON_RECEIPT`: invoice date.
- `NET_DAYS`: invoice date + configured number of calendar days.
- `END_OF_MONTH`: last calendar day of invoice month.
- `END_OF_NEXT_MONTH`: last calendar day of following month.
- `DAYS_AFTER_END_OF_MONTH`: end of invoice month + configured days.

Persist the computed `dueDate` on the Vendor Bill. A later edit to a payment-term master must not rewrite existing bill due dates. Allow an authorized override on a Vendor Bill with an audit note.

---

## 8. Inventory quantity and stock movement design

### 8.1 Required schema gap: `inTransitQty`

The provided `inventory_items` and `inventory_item_batches` tables have `onHandQty`, `reservedQty`, and `onOrderQty`, but no `inTransitQty`.

If the intended UI and domain model require the projection transition:

```text
Confirmed PO:  onOrderQty += quantity
Supplier ship: onOrderQty -= quantity; inTransitQty += quantity
Receipt:       inTransitQty -= quantity; onHandQty += accepted quantity
```

then add `inTransitQty` to the inventory projection. It must not be represented only as an untracked UI calculation if the product requirement is to query it directly from `inventory_items`.

Recommended additions:

```ts
inTransitQty: quantity("in_transit_qty").notNull().default("0")
```

Add this to `inventory_items`. Consider adding it to `inventory_item_batches` only if the product will reliably assign a batch/lot at shipment. A PO often does not know the supplier's batch until goods arrive, so batch-level inbound quantities may be unknown. In v1, keep `onOrderQty` / `inTransitQty` authoritative at the aggregate `inventory_items` level; capture batch identity and update batch `onHandQty` when receiving. Document this difference rather than pretending batch-level inbound data is complete.

Add non-negative checks and update the table comments / reconciliation tests. Rows may now be created when a PO is confirmed, before physical stock exists.

### 8.2 Quantity semantics

Use the following exact semantics:

- `onHandQty`: physically accepted stock in the specified stockable location. For batch-tracked items, it must continue to equal the sum of child batch `onHandQty` values.
- `reservedQty`: quantity reserved for confirmed downstream demand. Existing invariant remains.
- `onOrderQty`: confirmed purchase quantity not yet dispatched by the supplier.
- `inTransitQty`: dispatched purchase quantity not yet recorded as received.
- `availableQty`: derived as `onHandQty - reservedQty` (and later subtract blocked/quality-hold stock if that feature is implemented).
- `expectedIncomingQty`: derived as `onOrderQty + inTransitQty`.

Do not double-count `onOrderQty` and `inTransitQty`; they are mutually exclusive stages of outstanding supply.

At any point for one PO line, ignoring explicit cancellations and returns:

```text
orderedBaseQty = unshippedBaseQty + inTransitBaseQty + receivedBaseQty
```

At inventory projection level, the contribution from all active POs is:

```text
onOrderQty   = sum(confirmed not-yet-shipped quantities)
inTransitQty = sum(shipped not-yet-received quantities)
```

### 8.3 Destination dimension

`inventory_items` is keyed by `(orgId, itemId, locationId)` and includes a warehouse. Therefore each PO stock line must identify its intended receipt warehouse/location, either directly or via a PO default copied onto the line.

- On confirmation, increment the matching destination `inventory_items.onOrderQty`.
- On shipment, decrement that same destination row's `onOrderQty` and increment `inTransitQty`.
- On receipt, decrement the in-transit projection for the same destination and increment the receiving location's `onHandQty`.
- If a receipt is redirected to a different location, move the `inTransitQty` from the expected destination projection to the actual destination as part of one transaction.
- For a destination with no existing `inventory_items` row, create a zero-quantity row before updating it.

### 8.4 Projection updates must be atomic and idempotent

The following must commit or roll back together:

- Source document state / posted timestamp.
- PO line quantity counters.
- Inventory projection updates.
- Stock Movement header and lines (where the event requires one).
- Inventory Cost Layers (for costed accepted receipts).
- Journal Entry header and lines (where the event requires one).
- Audit fields.

Use row locks or atomic conditional updates to prevent two users from shipping/receiving the same remaining quantity concurrently. Use source unique indexes and idempotency keys for retries. Never trust a client-calculated remaining quantity.

### 8.5 Stock movements

The provided `stock_movements` and `stock_movement_lines` design is appropriate as the immutable movement ledger. Continue to create Stock Movements through the Stock Movement Service, not directly from PO form code.

For a posted Purchase Receipt:

- Create one `stock_movements` header with a purchase-receipt movement type (add a type to the shared contracts enum if not already present).
- Set `sourceType` to a stable source constant such as `PURCHASE_RECEIPT` and `sourceId` to the receipt ID.
- Set `sourceRef` to the receipt number.
- Create one line per accepted item/batch quantity, from a supplier/in-transit system location to the actual destination warehouse location.
- Use the item's base-unit quantity in `stock_movement_lines.quantity`.
- Create the `inventory_cost_layers` row(s) using the created movement line IDs.
- Do not directly mutate stock counts outside the Stock Movement Service.

The provided Stock Movement line schema requires explicit `fromLocationId` and `toLocationId`. Use the existing system-location pattern mentioned in the schema comments for external parties / in-transit. Do not invent nullable locations or bypass the FK.

For shipment tracking, create a `PurchaseShipment` document and either:

1. Create a corresponding stock movement from a supplier system location to an in-transit system location, and extend Stock Movement Service semantics to update `inTransitQty`; or
2. Keep shipment as a procurement event that updates the `inTransitQty` projection without a Stock Movement, if stock movements are intentionally reserved for on-hand physical stock changes.

**Preferred implementation:** use explicit PurchaseShipment records as the shipment audit trail and implement a dedicated, tested in-transit projection operation. Add a stock movement for shipment only if the existing movement taxonomy treats supplier-to-transit movement as a stock movement. Do not create two ledgers that both independently change the same quantity.

For direct delivery (goods arrive without a prior PurchaseShipment), the Purchase Receipt may consume unshipped quantity directly: decrement `onOrderQty`, increment `onHandQty`, and create the inbound Stock Movement. Record the shipment as an implicit/direct receipt only if audit policy requires it.

### 8.6 Ownership and accounting policy for in-transit goods

For v1, use a **receipt-based ownership recognition policy**:

- Shipment changes operational quantities (`onOrderQty` → `inTransitQty`).
- Shipment does not create Inventory / GRNI accounting by default.
- Posting the accepted Purchase Receipt recognizes inventory and GRNI.

This is an explicit v1 accounting assumption, not a universal accounting rule. If contract terms / applicable accounting policy transfer control to the buyer at dispatch, an Inventory-in-Transit asset and corresponding accrual may be needed at shipment. That requires a separately configured accounting policy and must not be inferred from a generic `IN_TRANSIT` status.

---

## 9. Purchase Shipment specification

A shipment record is required to support multiple partial dispatches and audit the event that moves quantity from `onOrderQty` to `inTransitQty`.

### 9.1 Header fields

- `id`, `orgId`
- `number` (server-generated `PS-...` or agreed prefix)
- `purchaseOrderId`
- `vendorId` (redundant snapshot / validated against PO)
- `shipmentDate`
- `carrier` (optional)
- `trackingNumber` (optional)
- `supplierDeliveryReference` (optional)
- `status`: `DRAFT`, `POSTED`, `VOIDED`
- `postedAt`, `postedBy`, `createdBy`, timestamps

### 9.2 Line fields

- `purchaseOrderLineId`
- `itemId` snapshot / validated against PO line
- `shippedQty` in entered unit and/or base unit
- unit and conversion-factor snapshot
- optional known supplier batch/lot reference
- optional note

### 9.3 Posting behavior

On shipment posting:

1. Lock PO and affected PO lines / inventory projection rows.
2. Validate PO is confirmed and not closed/cancelled.
3. Validate each shipped base quantity is positive and does not exceed line `unshippedBaseQty`.
4. Increase `shippedBaseQty` / update shipment aggregates.
5. Decrease destination `inventory_items.onOrderQty`.
6. Increase destination `inventory_items.inTransitQty`.
7. Mark shipment `POSTED`, set posting audit fields.
8. Recalculate PO fulfillment summary.
9. Commit atomically.

No GL journal is posted under the default receipt-based ownership policy.

### 9.4 Shipment reversal

A posted shipment is not edited or deleted. Void/correct it by a controlled reversal that:

- creates the required reversal audit record;
- restores `onOrderQty` and reduces `inTransitQty` only for quantity that has not already been received;
- refuses to reverse quantities already consumed by a Purchase Receipt unless the receipt is first reversed through its own valid process;
- recalculates PO status.

---

## 10. Purchase Receipt / Goods Receipt Note specification

### 10.1 Purpose

A Purchase Receipt records what physically arrived, what was accepted, and where accepted goods were placed. It is the authoritative source for increasing physical on-hand stock from purchasing.

### 10.2 Header fields

- `id`, `orgId`
- `number` (`PR-...`, generated server-side)
- `purchaseOrderId`
- `vendorId` (validated against PO)
- `receiptDate` (organization-local date)
- `warehouseId` if one warehouse per receipt; otherwise line-level warehouse only
- supplier delivery note / packing slip reference
- `notes`
- `status`: `DRAFT`, `POSTED`, `REVERSED` / `VOIDED` according to shared document conventions
- `stockMovementId` (nullable until posted; FK if relationships are modeled directly)
- `journalEntryId` (nullable until posted, or resolve through source type/id)
- `postedAt`, `postedBy`, `createdBy`, timestamps

### 10.3 Line fields

- `purchaseOrderLineId`
- `itemId`
- `warehouseId`, `locationId`
- `unitId` and conversion-factor snapshot
- `receivedQty` (physical delivered quantity)
- `acceptedQty` (quantity admitted to inventory)
- `rejectedQty` (must reconcile: received = accepted + rejected, subject to explicit inspection/hold workflow)
- base-unit equivalents
- `batchId` or batch creation data for batch-tracked items
- serial numbers for serial-tracked items if supported
- PO unit cost snapshot / receipt valuation amount
- notes / rejection reason

For batch-tracked items, require a valid batch on receipt and create or resolve the batch through the Batch Service. For serial-tracked items, capture unique serials and validate count equals accepted quantity when required.

### 10.4 Posting behavior

On posting a Purchase Receipt:

1. Lock the PO, PO lines, shipment/receipt quantity aggregates, and relevant inventory projections.
2. Validate the PO is confirmed and not closed/cancelled.
3. Validate received quantities do not exceed outstanding in-transit quantities, unless this is an explicit direct-receipt case.
4. Validate `receivedQty = acceptedQty + rejectedQty` where inspection is completed.
5. For normal shipped quantities, decrement `inTransitQty` by physically received quantity.
6. For direct receipt quantities, decrement `onOrderQty` by the direct received quantity.
7. Increase `onHandQty` only by accepted quantity. Rejected quantity must follow a recorded disposition: supplier return, quarantine/blocked stock, or another explicit process. Do not add rejected stock to available quantity.
8. Create the Stock Movement through the Stock Movement Service for stock accepted into the destination location. If the rejected goods are physically held in a quarantine location, represent that with the appropriate location / blocked-stock design rather than silently dropping the quantity.
9. For costed inventory, create Inventory Cost Layer(s) linked to the stock movement lines. Do not create a cost layer for non-stock / service lines.
10. Create and post the GRNI journal entry for accepted inventory value (see §12).
11. Set receipt status to `POSTED`, store posting metadata and document links.
12. Recalculate PO received quantities and fulfillment status.
13. Commit everything in one database transaction.

### 10.5 Draft / post behavior

- Saving a receipt draft changes no inventory projection and posts no journal.
- Posting a receipt is the inventory and accounting event.
- A posted receipt is immutable. Corrections are made through reversal / return transactions.
- If a receipt is posted and then reversed, reverse the stock movement, cost layer effects, and journal through linked reversal records. Do not delete the original receipt or original journal.

### 10.6 Default “Create Vendor Bill” option

When a user posts a Purchase Receipt, show a checkbox enabled by default:

**Create supplier bill after receiving**  
“Record the supplier's invoice so the amount you owe is tracked. You can also record a payment if you have already paid the supplier.”

Supporting copy when unchecked:

“Uncheck this if you have not received the supplier's invoice yet. You can create the bill later.”

Behavior:

- The checkbox does not change the inventory receipt transaction itself.
- Post the Purchase Receipt first.
- If checked, create a linked **Draft Vendor Bill** from accepted / billable receipt lines and redirect to the bill detail/edit screen.
- Do not auto-post the Vendor Bill. The user must enter/verify supplier invoice number, invoice date, actual taxes, charges, and total before posting.
- If unchecked, leave the receipt in an “Awaiting supplier bill” state in the purchasing workspace and expose a “Create Vendor Bill” action.
- If auto-created bill creation fails, do not roll back an already committed physical receipt unless both operations have been deliberately designed as one atomic unit. Preferred behavior: receipt remains posted; show a recoverable bill-creation error and allow retry with idempotency protection.

---

## 11. Vendor and Vendor Bill specifications

### 11.1 Vendor master

The provided schema does not include a vendor table. If one does not already exist, introduce an organization-scoped `vendors` table.

Suggested fields:

- `id`, `orgId`
- `vendorCode` (generated or manually assigned; unique per organization)
- `displayName` (required)
- `legalName` (optional)
- `taxRegistrationNumber` (optional; uniqueness policy depends on jurisdiction)
- `email`, `phone`
- billing and remittance addresses
- `currency` / default purchase currency
- `defaultPaymentTermId`
- `accountsPayableAccountId` (optional override; otherwise organization/vendor posting profile)
- `isActive`
- notes and timestamps

Use composite organization-scoped unique/FK patterns consistent with the supplied schema. Vendor creation must be permission-controlled and searchable through the async combobox.

### 11.2 Vendor Bill header

If no AP document tables exist, introduce `vendor_bills` with:

- `id`, `orgId`
- `number` (ERP-generated bill number, e.g. `BILL-...`)
- `vendorId`
- `purchaseOrderId` nullable (a bill may combine receipts or cover non-PO purchases)
- `supplierInvoiceNumber` (supplier's own invoice reference)
- `invoiceDate`
- `postingDate`
- `dueDate`
- `paymentTermId` nullable, plus payment-term snapshots (`termNameSnapshot`, `termMethodSnapshot`, `termDaysSnapshot`)
- `currency`, exchange-rate snapshot if applicable
- subtotal, discounts, tax, charges, total, amount paid / outstanding as derived or reconciled projections
- `status`: `DRAFT`, `POSTED`, `VOIDED` / reversal-based status according to accounting conventions
- `journalEntryId` nullable or resolve by source type/id
- notes, created/posted audit fields, timestamps

Enforce uniqueness of supplier invoice numbers per vendor where product/accounting policy requires it (consider case-folding and nullable values). Do not necessarily enforce global uniqueness across all vendors.

### 11.3 Vendor Bill lines and receipt matching

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

### 11.4 Create Bill from Receipt behavior

When created from a Purchase Receipt:

- Prepopulate vendor, currency, PO reference, receipt reference, item/description, accepted quantity, purchase unit, expected unit price, and applicable term.
- Copy the PO payment term unless the vendor / invoice explicitly provides a different approved term.
- Default invoice date to today or receipt date according to product decision; make it visible and editable.
- Compute due date from invoice date and payment term.
- Leave supplier invoice number blank and require it before posting unless local policy permits otherwise.
- Allow partial billing (less than received quantity).
- Show unbilled accepted quantity per receipt line.
- Do not assume PO price is the supplier's final invoiced price; allow controlled changes and variance handling.

### 11.5 Vendor Bill posting

Posting the Vendor Bill:

1. Verify vendor, dates, currency, totals, taxes, and duplicate supplier invoice rules.
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

## 12. Accounting design and journal entries

The supplied `journalEntries` and `journalEntryLines` tables provide a strong basis for this workflow.

### 12.1 Use the existing journal-entry invariants

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

### 12.2 Purchase Order confirmation

Default:

```text
No journal entry.
```

Confirmation creates a purchasing commitment and updates `onOrderQty`; it does not mean inventory has been received or that an AP invoice exists. If budget encumbrance accounting is later implemented, it must be a separate, explicitly configured budget ledger or journal policy.

### 12.3 Supplier shipment / in transit

Default receipt-based ownership policy:

```text
No journal entry.
```

Only the operational projection changes:

```text
onOrderQty   -= shippedBaseQty
inTransitQty += shippedBaseQty
```

If a future accounting policy recognizes ownership on dispatch, implement a separate `Inventory in Transit` account flow. Never infer this from the shipment status alone.

### 12.4 Purchase Receipt posting

For accepted stock value of 600:

```text
Dr Inventory Asset              600
    Cr Goods Received Not Invoiced (GRNI)   600
```

- Inventory account comes from the item's inventory posting profile / item category / organization accounting configuration.
- GRNI account comes from purchasing/accounting configuration.
- The value must be derived from the receipt valuation/costing service and match the created cost layers under the selected costing policy.
- Use the PO unit cost as the expected value only where the costing policy specifies it.
- Do not hardcode account IDs or account names in the purchasing module.
- Do not post a journal for non-stock/service receipt lines unless their accounting policy requires one.

### 12.5 Vendor Bill posting

For an exact $600 bill matching $600 GRNI, excluding tax:

```text
Dr GRNI                         600
    Cr Accounts Payable                  600
```

With taxes / charges / variance, add the relevant debit lines and credit AP for the actual gross invoice amount. Debits must equal credits.

### 12.6 Vendor Payment posting

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

### 12.7 Accounts and posting configuration

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

## 13. Vendor Payments

### 13.1 Naming and entity design

Use **Vendor Payment** as the document name. A vendor payment is separate from a bill and separate from the PO.

Suggested `vendor_payments` header:

- `id`, `orgId`
- `number` (generated `VP-...`)
- `vendorId`
- `paymentDate`
- `paymentMethod` (cash, bank transfer, cheque, card, etc. based on supported enum)
- `cashBankAccountId` (FK to allowed cash/bank ledger account)
- `currency`, exchange-rate snapshot if needed
- `amount`
- `referenceNumber` / bank transaction reference
- `status`: `DRAFT`, `POSTED`, `VOIDED` / reversal-based lifecycle
- `journalEntryId` nullable or source lookup
- audit fields and timestamps

Use `vendor_payment_allocations` to allocate one payment to one or more bills:

- `orgId`
- `vendorPaymentId`
- `vendorBillId`
- `allocatedAmount`
- timestamps

Validate payment vendor and currency match each bill unless an explicit cross-currency settlement feature exists. Allocation total cannot exceed payment amount or bill outstanding balance. Unallocated cash should not be silently treated as paid. Future supplier advances require a separate explicit workflow/account.

### 13.2 Bill payment status

Compute from posted payments and reversals:

```text
outstandingAmount = postedBillGrossAmount - netPostedPaymentAllocations

UNPAID          if allocatedPaidAmount = 0
PARTIALLY_PAID  if 0 < allocatedPaidAmount < billGrossAmount
PAID            if outstandingAmount = 0
```

Use integer minor-unit arithmetic (`BigInt`) consistent with the existing accounting helpers. Consider credit notes, write-offs, and FX differences in a later extension; do not compare floating-point values.

### 13.3 Bill screen UX

After the user is redirected to the newly created Draft Vendor Bill, show:

**How would you like to settle this bill?**

- **Pay later** — post the bill; it remains unpaid.
- **Already paid in full** — post the bill, then create and post a Vendor Payment allocated to the full outstanding amount (with payment date, method, and cash/bank account).
- **Partially paid** — post the bill, then create a Vendor Payment for the entered amount and leave the remainder outstanding.

Require payment account and date when a payment is recorded. Do not offer a “mark as paid” action that changes only a status field.

If the payment is entered before the bill is posted, persist the intended payment details in the draft workflow and post the bill before posting the payment in the same controlled application flow. The final journal sequence must remain valid and auditable.

---

## 14. Proposed database tables and changes

The exact Drizzle naming conventions should follow the repository. The following is logical schema guidance, not a drop-in migration.

### 14.1 Existing tables to reuse

| Existing table | Purchasing use |
|---|---|
| `journal_entries` | Automated journals for receipt, bill, payment and reversals. |
| `journal_entry_lines` | Debit/credit lines. |
| `inventory_items` | Current quantity projection; add `inTransitQty`. |
| `inventory_item_batches` | Batch-level physical on-hand and reserved projections; capture accepted batch stock on receipt. |
| `stock_movements` | Immutable physical stock movement headers. |
| `stock_movement_lines` | Immutable physical quantity movement lines. |
| `inventory_cost_layers` | Receipt cost layers linked to stock movement line. |
| `inventory_cost_allocations` | Existing outbound costing support; no direct PO change. |
| `batches` | Resolve/create supplier lot on receipt. |
| `inventory_reservations` | Not used by PO confirmation; purchasing does not reserve stock for demand. |
| `accounts` | Inventory, GRNI, AP, tax, variance and bank ledger account references. |

### 14.2 New purchasing tables

At minimum, add:

1. `vendors` (only if no vendor/supplier master already exists).
2. `payment_terms`.
3. `purchase_orders`.
4. `purchase_order_lines`.
5. `purchase_shipments`.
6. `purchase_shipment_lines`.
7. `purchase_receipts`.
8. `purchase_receipt_lines`.
9. `vendor_bills`.
10. `vendor_bill_lines`.
11. `vendor_bill_line_receipt_allocations`.
12. `vendor_payments`.
13. `vendor_payment_allocations`.

Avoid creating duplicate vendor, tax, currency, UOM, document sequence, or payment method tables if equivalent shared modules already exist.

### 14.3 Common relational conventions

Use the same patterns as the provided tables:

- `orgId` on every tenant-owned table.
- Composite FKs containing `orgId` to prevent cross-tenant relationships.
- `unique (org_id, id)` targets where child composite FKs require them.
- `onDelete: restrict` for accounting / stock / historical references.
- Organization-scoped document-number unique indexes.
- Indexes for common organization/vendor/status/date/PO queries.
- `createdBy`, `postedBy`, `postedAt` where applicable.
- Append-only posted transaction history.
- Explicit status enums exported through `@avuny/contracts`.
- Use shared `pk()`, `quantity()`, `money()`, `currency()`, `timestamps()`, and `timestamptz()` helpers consistently.

### 14.4 PO header logical fields

```text
purchase_orders
- id
- org_id
- number
- vendor_id
- order_date
- expected_delivery_date
- payment_term_id
- payment_term_name_snapshot
- payment_term_method_snapshot
- payment_term_days_snapshot
- currency
- warehouse_id (optional header default)
- supplier_reference
- notes
- status
- confirmed_at / confirmed_by
- closed_at / closed_by
- cancelled_at / cancelled_by
- created_by
- timestamps
```

### 14.5 PO line logical fields

```text
purchase_order_lines
- id
- org_id
- purchase_order_id
- line_no
- item_id
- description_snapshot
- warehouse_id
- location_id
- unit_id
- base_unit_factor_snapshot
- ordered_qty
- ordered_base_qty
- shipped_base_qty
- received_base_qty
- accepted_base_qty
- rejected_base_qty
- invoiced_base_qty
- cancelled_base_qty
- unit_price
- discount fields
- tax_code_id (if supported)
- net amount / tax / gross estimate
- expected_delivery_date
- notes
- timestamps
```

Quantity counters are mutable projections for performance. They must be updated only by the purchasing posting services in the same transaction as the source event, and should be reconcilable against shipment, receipt, and bill allocation lines. If the repository prefers fully derived counters, calculate them from child documents instead; do not maintain two competing sources of truth.

### 14.6 Payment terms logical fields

```text
payment_terms
- id
- org_id
- code
- name
- method
- days
- is_system
- is_active
- sort_order
- created_by
- timestamps
```

Constraints:

- Unique `(org_id, code)`.
- `days >= 0` and `days <= PAYMENT_TERM_DAYS_MAX`.
- Name trimmed and length-bounded.
- System terms cannot be edited/deleted by ordinary users.
- Referenced terms cannot be hard-deleted.
- Per-organization term count is checked transactionally against `PAYMENT_TERMS_MAX_PER_ORG`.

### 14.7 Inventory projection migration

Add to `inventory_items`:

```ts
inTransitQty: quantity("in_transit_qty").notNull().default("0")
```

Add check:

```ts
check("ck_inventory_item_in_transit_non_negative", sql`${t.inTransitQty} >= 0`)
```

Update its table comment to explain that `onOrderQty` represents confirmed but not shipped purchasing quantity, and `inTransitQty` represents shipped but not received purchasing quantity. The rows may be created by PO confirmation even when `onHandQty = 0`.

Optional: add `inTransitQty` to `inventory_item_batches` only when the business can reliably identify a supplier batch before receipt. Do not require child batch `inTransitQty` to sum to the parent when the supplier has not yet supplied batch information.

---

## 15. API / service boundaries

The UI should call application use-cases. It must not update inventory rows or journal tables directly.

Suggested service boundaries:

- `VendorService`: create, update, search, view vendors.
- `PaymentTermService`: list, create, update/deactivate, seed system terms, enforce maximum.
- `PurchaseOrderService`: create draft, update draft, confirm, close, cancel, get detail/list.
- `PurchaseShipmentService`: create draft, update draft, post, reverse.
- `PurchaseReceiptService`: create draft, update draft, post, reverse, create linked draft bill.
- `VendorBillService`: create draft from receipt / PO / manual, update draft, post, reverse.
- `VendorPaymentService`: create draft, allocate, post, reverse.
- `StockMovementService`: create and post receipt movements; update inventory projections.
- `InventoryValuationService`: create receipt cost layers and apply variance/valuation policy.
- `AccountingPostingService`: resolve posting accounts and create balanced automated journals.

### 15.1 Suggested endpoints / commands

Route naming is illustrative; align with the application's API conventions.

```text
GET    /vendors/search
GET    /vendors/:id
POST   /vendors

GET    /payment-terms
POST   /payment-terms
PATCH  /payment-terms/:id

GET    /purchase-orders/number-preview
POST   /purchase-orders                  // create draft
PATCH  /purchase-orders/:id              // edit draft only
POST   /purchase-orders/:id/confirm
POST   /purchase-orders/:id/close
POST   /purchase-orders/:id/cancel
GET    /purchase-orders/:id

POST   /purchase-orders/:id/shipments    // create shipment draft
POST   /purchase-shipments/:id/post
POST   /purchase-shipments/:id/reverse

POST   /purchase-orders/:id/receipts     // create receipt draft
POST   /purchase-receipts/:id/post
POST   /purchase-receipts/:id/reverse
POST   /purchase-receipts/:id/create-vendor-bill

POST   /vendor-bills                    // manual/draft bill
POST   /vendor-bills/from-receipt
PATCH  /vendor-bills/:id                // draft only
POST   /vendor-bills/:id/post
POST   /vendor-bills/:id/reverse

POST   /vendor-payments
POST   /vendor-payments/:id/post
POST   /vendor-payments/:id/reverse
```

Use idempotency keys for post/confirm requests where client retries are possible. A repeated post request must return the already-posted result rather than duplicate stock, journal, or payment effects.

### 15.2 Authorization

Define permissions for at least:

- View/create/edit PO drafts.
- Confirm POs.
- Record supplier shipments.
- Create/post Purchase Receipts.
- Create/post Vendor Bills.
- Record/post Vendor Payments.
- Manage vendors.
- Manage payment terms.
- Reverse posted purchasing/accounting documents.

A user who can receive goods should not automatically be allowed to post payments or alter bank accounts. Enforce permissions in services/API, not only by hiding buttons.

---

## 16. UI composition and copy

### 16.1 PO form layout

**Document information**

- PO number (read-only generated preview)
- PO date
- Expected delivery date

**Supplier**

- Vendor async combobox
- View vendor icon
- Create vendor button
- Payment terms selector / manage action

**Order lines**

- Generic `LineItems` collection
- Item selector
- Destination warehouse/location
- Unit
- Quantity
- Purchase unit price
- Discount / tax fields if enabled
- Line total
- Notes

**Totals**

- Subtotal
- Discount
- Estimated tax
- Estimated order total
- Currency

**Footer**

- Save as Draft
- Save and Confirm (confirmation dialog)

### 16.2 Confirmation dialog copy

Title: **Confirm this purchase order?**

Body: “Confirming this order records the quantities as On Order. It does not increase physical stock. Stock increases when the goods are received.”

Show vendor, order total, line count, expected delivery date, and destination warehouse(s).

Actions: “Back to edit” and “Confirm purchase order”.

### 16.3 Receipt-to-bill checkbox copy

Checkbox, checked by default:

**Create supplier bill after receiving**

“Record the supplier's invoice so the amount you owe is tracked. You can also record a payment if you have already paid the supplier.”

Unchecked helper text:

“Uncheck this if you have not received the supplier's invoice yet. You can create the bill later.”

### 16.4 Bill payment choices

On the Draft Vendor Bill screen:

- **Pay later** — “Record the bill now and pay it later.”
- **Already paid in full** — ask payment date, payment method, and cash/bank account.
- **Partially paid** — ask amount paid, date, method, and cash/bank account; show remaining balance.

The payment UI should only appear after the user has reviewed the invoice details. The bill must be posted before the payment journal is posted.

### 16.5 PO details screen

Show distinct sections:

- Ordered quantities.
- Shipped / in-transit quantities.
- Received / accepted / rejected quantities.
- Invoiced quantities and linked Vendor Bills.
- Related Vendor Payments (through bills).
- Activity / audit timeline.

Do not show a single “Paid” PO status. Show a derived supplier financial summary such as “Bills outstanding” separately from fulfillment.

---

## 17. Validation and business rules

### 17.1 Draft PO validation

- PO number is server-generated.
- Vendor ID must belong to the current organization if supplied.
- Dates must be valid date-only strings.
- At least one valid line is required to confirm; draft behavior may allow an empty initial form if existing form patterns require it, but saving an empty draft should be an explicit product decision.
- Each line item belongs to the organization.
- Quantity must be positive for persisted lines.
- Unit belongs to item and conversion factor is valid.
- Destination warehouse/location belongs to organization and is eligible for purchasing receipts.
- Unit price and totals fit the accounting money bounds.
- Currency is valid and consistent across the PO.

### 17.2 Confirm validation

- PO is currently `DRAFT`.
- Vendor is active.
- At least one valid stock/service line exists.
- Required dates, term, currency, warehouse/location and price fields are present according to line type.
- Payment term belongs to organization and is active.
- No duplicate line identity restrictions are violated, if such restrictions exist.
- Confirm operation and `onOrderQty` updates are atomic.

### 17.3 Shipment validation

- PO is confirmed and not closed/cancelled.
- Shipment line belongs to the PO.
- Shipped quantity is positive and in the correct unit.
- Cumulative shipped quantity cannot exceed ordered quantity minus cancelled quantity.
- Inventory `onOrderQty` cannot become negative.
- Inventory `inTransitQty` updates in the same transaction.

### 17.4 Receipt validation

- PO is confirmed and not closed/cancelled.
- Receipt line references a PO line from the same PO and organization.
- Cumulative received quantity cannot exceed shipped quantity, except explicit direct receipts.
- Received quantity is positive.
- Accepted + rejected equals received when inspection is completed.
- Accepted quantity has valid location and batch/serial data as required.
- Inventory `inTransitQty` / `onOrderQty` cannot become negative.
- Cost valuation and accounting mappings are available before posting.
- Receipt posting is idempotent.

### 17.5 Bill validation

- Vendor belongs to organization and matches PO/receipt vendor.
- Supplier invoice number follows duplicate-check policy.
- Invoice date and due date are valid.
- Currency is valid and exchange rate is supplied where applicable.
- Matched quantities do not exceed accepted, unbilled receipt quantities.
- Bill totals reconcile with lines, discount, taxes, and charges.
- AP, GRNI, tax, and variance accounts are configured.
- Bill posting is idempotent and balanced.

### 17.6 Payment validation

- Bill is posted and has an outstanding balance.
- Vendor matches the allocated bill.
- Payment amount is positive.
- Allocations do not exceed payment amount or bill outstanding amount.
- Cash/bank account is active, postable, and configured for payment use.
- Payment date is in an open accounting period.
- Payment journal is balanced and idempotent.

---

## 18. Reversals, returns, and corrections

The supplied inventory and accounting schemas already use reversal records. Purchasing must follow the same rule.

- Never delete a posted Purchase Receipt, Stock Movement, Inventory Cost Layer, Vendor Bill, Vendor Payment, or Journal Entry.
- Reversals must reference the original posted source and be permitted only once.
- A receipt reversal must reverse both quantity and value and update PO receipt counters safely.
- If received goods have already been consumed/sold/transferred, a simple reversal may be invalid. Use a Purchase Return / supplier return workflow rather than forcing inventory negative.
- A Vendor Bill correction should use a Vendor Credit Note / credit memo or reversal pattern; do not delete a posted AP document.
- A payment reversal must reverse bank/AP entries and unwind allocations without altering the original payment record.
- All reversals need a reason, user, timestamp, and links to original source documents.

A dedicated Purchase Return document is recommended as a later feature. It should create an outbound Stock Movement to a supplier system location and the appropriate GRNI/AP or supplier-credit accounting effects.

---

## 19. Reporting and reconciliation

Required views / reports:

1. Open Purchase Orders.
2. Purchase Orders by fulfillment status.
3. Expected deliveries / overdue deliveries.
4. On Order and In Transit by item, warehouse, and location.
5. Purchase Receipts awaiting Vendor Bills.
6. Vendor Bills awaiting payment.
7. Vendor AP aging based only on posted Vendor Bills and due dates.
8. Received-not-invoiced (GRNI) balance.
9. Supplier statement / vendor activity.
10. PO-to-receipt-to-bill matching exceptions.

Do not mix GRNI into standard AP invoice aging. Display it separately and optionally show an aggregate “supplier exposure” figure:

```text
Supplier exposure = posted AP outstanding + open GRNI
```

Clearly label this as an exposure summary, not the Accounts Payable control balance.

Reconciliation jobs/tests should compare:

- `inventory_items.onOrderQty` against outstanding confirmed/unshipped PO line quantities.
- `inventory_items.inTransitQty` against shipped/not-received PO line quantities.
- `inventory_items.onHandQty` against the stock movement ledger (and batch-child sums for batch-tracked items).
- GRNI GL balance against posted receipt accruals less matched bill allocations and reversals.
- AP control account against posted Vendor Bills less posted payment allocations, credit notes, and reversals.
- Cost layer remaining quantities/value against stock movement and cost allocation history.

---

## 20. Testing plan and acceptance criteria

### 20.1 PO form tests

- Number preview appears and is read-only.
- Server allocates a unique PO number even with concurrent creates.
- Organization-local date defaults are correct around UTC midnight.
- Expected delivery defaults to today and can be edited/cleared according to policy.
- Vendor async search, view, create-and-select, loading, empty, and error states work.
- Payment term defaults from vendor and can be changed.
- Payment term list is organization-scoped.
- At most 20 terms can exist per organization; concurrent creates cannot exceed the cap.
- Save as Draft has no inventory or GL effect.
- Save and Confirm uses confirmation dialog and increments `onOrderQty` exactly once.

### 20.2 Line item tests

- Generic LineItems supports Adjustment and PO line types without business-specific coupling.
- Add/remove preserves values and stable keys.
- Item change resets incompatible dependent fields.
- Unit conversion to base quantity is correct.
- Price precision and line totals are correct.
- Batch-tracked items require batch capture at receipt, not necessarily PO creation.

### 20.3 Quantity lifecycle tests

Example: 100 units ordered, 40 shipped, 25 received, then 75 received.

Initial:

```text
onHandQty=10, onOrderQty=0, inTransitQty=0
```

After PO confirmation:

```text
onHandQty=10, onOrderQty=100, inTransitQty=0
```

After shipment of 40:

```text
onHandQty=10, onOrderQty=60, inTransitQty=40
```

After receipt of 25:

```text
onHandQty=35, onOrderQty=60, inTransitQty=15
```

After shipment of remaining 60:

```text
onHandQty=35, onOrderQty=0, inTransitQty=75
```

After receipt of remaining 75:

```text
onHandQty=110, onOrderQty=0, inTransitQty=0
```

Also test direct receipt without a shipment: `onOrderQty` decreases by direct received quantity and `onHandQty` increases by accepted quantity; `inTransitQty` remains unchanged.

Test partial, rejected, duplicate, concurrent, and reversed operations.

### 20.4 Accounting tests

- PO draft / confirmation: no journal by default.
- Shipment: no journal under receipt-based ownership policy.
- Receipt: debit Inventory / credit GRNI for accepted valuation only.
- Bill: debit GRNI, applicable tax/variance accounts, credit AP for invoice gross amount.
- Payment: debit AP, credit Cash/Bank.
- Full payment results in zero bill outstanding balance.
- Partial payment leaves correct balance.
- Duplicate API retries create no duplicate stock movement, cost layer, or journal.
- All automated entries balance using integer minor units.
- Posted entries and lines cannot be mutated/deleted.
- Reversals restore balances and preserve source history.
- Missing account mappings block posting with actionable errors.

### 20.5 End-to-end non-accountant workflow

1. User creates a PO and selects a vendor.
2. User adds two items and saves/ confirms.
3. On Order quantities increase; on-hand quantities do not.
4. User records a partial shipment.
5. On Order decreases and In Transit increases.
6. User receives goods through a Purchase Receipt.
7. The Stock Movement is created and On Hand increases.
8. Inventory / GRNI journal is posted.
9. The default-checked “Create supplier bill after receiving” action creates a draft Vendor Bill and navigates to it.
10. User enters supplier invoice details and chooses “Already paid in full” or “Pay later”.
11. Vendor Bill posting increases AP; if paid, Vendor Payment posting clears AP and credits the selected bank/cash account.
12. PO shows fulfillment, billing, and linked payment summaries independently.

---

## 21. Implementation sequence

Recommended delivery order:

### Phase 1 — Contracts and shared UI foundations

- Add purchasing/payment-term constants, enums, Zod schemas, and input/output types in `@avuny/contracts`.
- Add generic LineItems refactor with current Inventory Adjustment behavior preserved.
- Add reusable `DatePickerField`.
- Add or reuse vendor async combobox and vendor create/view integration.

### Phase 2 — Master data and PO

- Implement vendors if absent.
- Implement seeded organization payment terms and custom-term management.
- Add PO tables, numbering, create/edit draft, confirmation dialog, confirmation service, and `onOrderQty` updates.
- Add PO detail/list screens and quantity summary.

### Phase 3 — Shipment and inventory projection

- Add `inTransitQty` migration.
- Implement Purchase Shipment header/lines and shipment posting.
- Implement concurrency, idempotency, and reconciliation tests.

### Phase 4 — Purchase Receipt and valuation

- Implement receipt header/lines and partial receiving.
- Integrate Batch Service and Stock Movement Service.
- Integrate Inventory Cost Layers.
- Post Inventory / GRNI journal entries using accounting posting profiles.
- Implement receipt reversal / return constraints.

### Phase 5 — Vendor Bills

- Implement Vendor Bill tables and receipt allocation table.
- Implement create-from-receipt draft flow.
- Implement payment terms due-date calculation and invoice matching.
- Post GRNI / tax / variance / AP journals.

### Phase 6 — Vendor Payments

- Implement payment header and allocations.
- Implement pay later / paid in full / partial payment UX.
- Post AP / Cash-Bank journal entries.
- Implement payment reversal.

### Phase 7 — Reporting and production hardening

- GRNI/AP reconciliation.
- Supplier exposure and aging reports.
- Audit timeline and permission matrix.
- Load/concurrency tests, migration verification, and operational monitoring.

---

## 22. Decisions to preserve during implementation

1. **PO confirmation is not goods receipt.** It affects `onOrderQty`, not `onHandQty`, and normally creates no GL journal.
2. **Shipment is a separate event.** It moves quantity from `onOrderQty` to `inTransitQty`; default v1 policy does not post GL at shipment.
3. **Purchase Receipt is the physical stock event.** Posting it creates a Stock Movement, increases `onHandQty`, decreases in-transit (or on-order for direct receipts), creates cost layers, and posts Inventory / GRNI.
4. **Vendor Bill is the AP event.** Posting it clears the matched GRNI accrual and increases Accounts Payable. It must not increase inventory again.
5. **Vendor Payment is the settlement event.** Posting it debits AP and credits bank/cash. A paid flag without a payment transaction is invalid.
6. **The receipt flow defaults to creating a draft Vendor Bill.** This helps non-accountants discover the required invoice step without auto-posting unverified invoice data.
7. **Payment terms belong in a reusable organization-scoped table.** Due-on-receipt, Net 15/30/45/60, and end-of-month terms are seeded; the 20-term limit is enforced server-side and defined in contracts.
8. **The PO number is generated by the server.** The form displays a preview; the saved value is authoritative and unique per organization.
9. **LineItems is generic UI infrastructure.** Domain forms supply their own fields and business behavior.
10. **Posted stock and accounting documents are immutable.** Correct them through traceable reversals or returns.

---

## 23. Open implementation checks against the current repository

Before writing migrations, inspect the repository for existing equivalents and align rather than duplicate:

- Is there already a `vendors` / `suppliers` table and service?
- Is there an existing generic document-number sequence service?
- Are there existing tax codes, currencies, UOM conversion tables, item purchase prices, and posting profiles?
- Does the stock movement enum already include purchase receipt / supplier receipt types?
- How are system locations represented in `warehouseLocations`?
- Does the accounting module already define GRNI, AP control, input VAT, inventory, variance, and cash/bank account mapping?
- Is there already a Vendor Bill / AP invoice or payment module?
- What is the repository's established approach to posting dates, closed accounting periods, audit fields, and reversals?
- Does the stock movement service create cost layers today, or should the receipt use a separate valuation service?

Do not assume the snippets supplied in this specification are the entire database. Reuse any existing canonical module and preserve its established invariants.
