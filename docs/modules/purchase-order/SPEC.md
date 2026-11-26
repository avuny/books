# Purchase Order & Supplier Shipment Module — Implementation Specification

**Status:** Proposed implementation specification  
**Audience:** Engineering, product, QA, and accounting stakeholders  
**Module boundary:** Purchase Orders, supplier shipment records, payment-term selection/master data, expected-supply quantity projections, and confirmation/fulfillment summaries.  
**Depends on:** Existing Party module, Item/UOM module, Warehouse/Location module, shared document numbering, Inventory Projection / Stock Movement infrastructure, Accounting contracts, and shared UI form blocks.

> This is one of three purchasing specifications. Purchase Receipts are specified in `PURCHASE-RECEIPT-SPEC.md`. Vendor Bills and Vendor Payments (also called Purchase Payments) are specified in `VENDOR-BILL-PAYMENTS-SPEC.md`.

## 1. Goals and responsibilities

Build the purchasing commitment workflow. A Purchase Order records what the organization agrees to buy; it does not record physical receipt, supplier invoicing, or payment.

This module must:

1. Create, edit, confirm, close, and cancel Purchase Orders.
2. Show a server-generated PO number preview such as `PO-000123`.
3. Select a supplier using the existing Party module, not a new Vendor table.
4. Use reusable date-picker and generic line-item form blocks.
5. Support organization-scoped payment terms, seeded terms, custom terms, and a maximum of 20 terms per organization.
6. Increment `onOrderQty` on PO confirmation.
7. Track one or multiple supplier shipment events and move quantities from `onOrderQty` to `inTransitQty`.
8. Support partial shipments and partial downstream receipts without conflating the PO with receipt/bill/payment documents.
9. Preserve tenant isolation, auditability, idempotency, and safe concurrent posting.

### 1.1 Explicitly out of scope

- Physical `onHandQty` changes and stock movement posting. See `PURCHASE-RECEIPT-SPEC.md`.
- GRNI, Vendor Bill, Accounts Payable, Vendor Payment, or bank accounting. See `VENDOR-BILL-PAYMENTS-SPEC.md`.
- A separate `vendors` or `suppliers` master table. The existing Party module is canonical.

## 2. Domain model and boundaries

| Record | Meaning | Main effect |
|---|---|---|
| Purchase Order | Commercial purchasing commitment | On confirmation, increases `onOrderQty`; no on-hand or AP posting |
| Purchase Shipment | Supplier dispatch event | Reclassifies quantity from `onOrderQty` to `inTransitQty`; normally no GL journal under receipt-based ownership |
| Purchase Receipt | Physical goods received | Separate document; see receipt spec |
| Vendor Bill | Supplier invoice / AP document | Separate document; see bill/payment spec |
| Vendor Payment / Purchase Payment | Money paid to supplier | One payment concept, not two different modules; see bill/payment spec |

**Do not use a single PO status to represent approval, fulfillment, billing, and payment.** The PO module owns only the purchasing lifecycle and fulfillment summary. Billing/payment summaries are read-only derived information from related documents.

### 2.1 Existing Party module integration (mandatory)

The repository already has a Party module that represents both vendors/suppliers and customers. Reuse it:

- Persist `partyId` (or the repository's canonical Party FK name) on Purchase Orders, Shipments, Receipts, Bills, and Payments. In this specification, `partyId` means the supplier Party.
- Do not create `vendors`, `suppliers`, `vendor_contacts`, or a second supplier identity table.
- Configure the async picker as a Party picker filtered to parties allowed to act as suppliers/vendors.
- Use the existing Party detail route for the view icon and the existing Party create flow for “Create supplier”; after creation, select the returned Party ID.
- The service must validate the Party belongs to the current organization, is active, and has supplier/vendor capability according to the existing Party model. If the Party model uses roles instead of capability flags, use that established contract.
- Store document-specific legal name/address/tax snapshots only when required for audit or invoice rendering; do not duplicate Party master data as a competing source of truth.

### 2.2 Partial lifecycle is normal

One PO can have multiple shipments, multiple receipts, multiple bills, and multiple payments. The PO itself must not store a payment flag. The PO details screen may show derived totals and links to bills/payments, but the canonical payment status belongs to each Vendor Bill.

## 3. Purchase Order statuses and transitions

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
| Confirm | Draft; supplier Party active; at least one valid line; required fields complete | `CONFIRMED` | Add ordered base quantity to `onOrderQty` | No journal by default |
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
| `partyId` | Yes to confirm; optionally required for draft depending on existing draft policy | Async combobox | Search active supplier-capable Party records within the current organization. Include view icon and “Create supplier” action. |
| `date` | Yes | Reusable date picker | Organization-local current date. |
| `expectedDeliveryDate` | Recommended | Reusable date picker | Defaults to the organization-local current date as requested; user may change or clear if delivery date is unknown. |
| `paymentTermId` | Recommended | Select / combobox | Supplier Party default term, otherwise organization default, otherwise “Due on receipt”. |
| `warehouseId` | Depends on line-location model | Select | Optional header default copied to lines; each line may override destination location. |
| `supplierReference` | No | Text | Optional quote / supplier reference. |
| `notes` | No | Textarea | Internal purchasing notes. |
| `currency` | Yes | Select or vendor default, potentially read-only after first confirmation | Supplier Party / organization default. Do not silently change currency after confirmation. |

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

The supplier Party field (labelled Vendor or Supplier in the UI) must:

- Search by Party display name, code, tax number, email, and other supported search keys.
- Be asynchronous, debounced, paginated, organization-scoped, and limited to active supplier-capable Party records by default.
- Show vendor code and a useful secondary description in results.
- Provide a **view** icon that opens the selected Party detail page without losing the PO form state.
- Provide a **Create supplier** action that opens a dialog/drawer, creates the supplier Party, and selects the returned Party ID after successful creation.
- Preserve selection when options are refreshed.
- Handle no results, loading, request error, and inactive vendor states.
- Prevent cross-organization Party IDs at the API and database layers.

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

### Party field adaptation

The original vendor picker is implemented using the existing Party module. Its form value is `partyId`; its visible label can remain “Vendor” or “Supplier” for business users. The picker must support async search, view, and create-and-select without losing form state.

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

## 6. Generic reusable LineItems UI block

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

## 7. Payment Terms master data and use on Purchase Orders

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

Payment Terms are shared purchasing/AP reference data. The PO captures the selected term and a snapshot; the Vendor Bill spec defines how the bill uses that snapshot to calculate its due date. Do not duplicate the payment-term table in another module.

## 8. Inventory projection contract for purchase commitments

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

### Ownership boundary with the Purchase Receipt module

This module is responsible for confirmed not-yet-shipped quantity (`onOrderQty`) and shipment projection changes (`onOrderQty` to `inTransitQty`). The Purchase Receipt module owns accepted physical stock and the `onHandQty` stock movement. The receipt spec must implement the receiving side of the same quantity invariant.

## 9. Supplier Shipment document

A shipment record is required to support multiple partial dispatches and audit the event that moves quantity from `onOrderQty` to `inTransitQty`.

### 9.1 Header fields

- `id`, `orgId`
- `number` (server-generated `PS-...` or agreed prefix)
- `purchaseOrderId`
- `partyId` (redundant snapshot / validated against PO)
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

## 10. Accounting behavior

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

### Purchase Order confirmation

Default:

```text
No journal entry.
```

Confirmation creates a purchasing commitment and updates `onOrderQty`; it does not mean inventory has been received or that an AP invoice exists. If budget encumbrance accounting is later implemented, it must be a separate, explicitly configured budget ledger or journal policy.

### Supplier shipment / in transit

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

Supplier shipment accounting follows the default receipt-based ownership policy described in the receipt spec: shipment is operational tracking only, unless an explicitly configured accounting policy recognizes buyer control at dispatch.

## 11. Database design and migrations

### 11.1 Existing tables to reuse

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

Also reuse the existing Party table/service for supplier identity. Do not add a Vendor table.

### 11.2 Tables owned by this module

- `purchase_orders`
- `purchase_order_lines`
- `purchase_shipments`
- `purchase_shipment_lines`
- `payment_terms` (only if the repository does not already have an equivalent reusable table)

Purchase Receipt, Vendor Bill, and Vendor Payment tables are owned by their respective specs.

### 11.3 Shared tenant/database conventions

Use the same patterns as the provided tables:

- `orgId` on every tenant-owned table.
- Composite FKs containing `orgId` to prevent cross-tenant relationships.
- `unique (org_id, id)` targets where child composite FKs require them.
- `onDelete: restrict` for accounting / stock / historical references.
- Organization-scoped document-number unique indexes.
- Indexes for common organization/party/status/date/PO queries.
- `createdBy`, `postedBy`, `postedAt` where applicable.
- Append-only posted transaction history.
- Explicit status enums exported through `@avuny/contracts`.
- Use shared `pk()`, `quantity()`, `money()`, `currency()`, `timestamps()`, and `timestamptz()` helpers consistently.

### 11.4 Purchase Order header logical fields

```text
purchase_orders
- id
- org_id
- number
- party_id
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

#### PO line logical fields

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

Use `party_id` (or canonical Party FK naming) instead of `vendor_id`. The field refers to the existing supplier Party.

### 11.5 Payment term logical fields

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

### 11.6 Inventory projection migration

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

The migration is coordinated with the receipt module because supplier shipment/receipt posting is one end-to-end quantity lifecycle. Add `inTransitQty` at `inventory_items` level; do not add batch-level in-transit quantity unless the supplier lot is known before receiving and the product explicitly supports it.

## 12. API and service boundaries

### 12.1 Services

- `PurchaseOrderService`: create draft, update draft, confirm, close, cancel, list/detail.
- `PurchaseShipmentService`: create draft, update draft, post, reverse.
- `PaymentTermService`: list, create, update/deactivate, seed system terms, enforce the per-org maximum.
- Existing Party module: canonical Party creation/search/detail; configure supplier capability filters. Do not add a parallel Vendor/Supplier service.
- `InventoryProjectionService` or the established inventory service: apply PO confirmation and shipment projection deltas atomically.
- Shared `DocumentNumberService`: allocate PO / shipment numbers.

### 12.2 Suggested endpoints / commands

```text
GET    /purchase-orders/number-preview
POST   /purchase-orders
PATCH  /purchase-orders/:id
POST   /purchase-orders/:id/confirm
POST   /purchase-orders/:id/close
POST   /purchase-orders/:id/cancel
GET    /purchase-orders/:id

POST   /purchase-orders/:id/shipments
POST   /purchase-shipments/:id/post
POST   /purchase-shipments/:id/reverse

GET    /payment-terms
POST   /payment-terms
PATCH  /payment-terms/:id

# Reuse existing Party endpoints; supplier-filtered search is a Party query.
GET    /parties/search?capability=SUPPLIER
GET    /parties/:id
POST   /parties  # only through the existing Party module and permission model
```

### 12.3 Authorization

Define permissions for at least:

- View/create/edit PO drafts.
- Confirm POs.
- Record supplier shipments.
- Create/post Purchase Receipts.
- Create/post Vendor Bills.
- Record/post Vendor Payments.
- Manage Party records through the existing Party module.
- Manage payment terms.
- Reverse posted purchasing/accounting documents.

A user who can receive goods should not automatically be allowed to post payments or alter bank accounts. Enforce permissions in services/API, not only by hiding buttons.

---

## 13. PO UI composition and copy

### PO form layout

**Document information**

- PO number (read-only generated preview)
- PO date
- Expected delivery date

**Supplier**

- Vendor async combobox
- View vendor icon
- Create supplier button
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

### Confirmation dialog copy

Title: **Confirm this purchase order?**

Body: “Confirming this order records the quantities as On Order. It does not increase physical stock. Stock increases when the goods are received.”

Show vendor, order total, line count, expected delivery date, and destination warehouse(s).

Actions: “Back to edit” and “Confirm purchase order”.

### PO details screen

Show distinct sections:

- Ordered quantities.
- Shipped / in-transit quantities.
- Received / accepted / rejected quantities.
- Invoiced quantities and linked Vendor Bills.
- Related Vendor Payments (through bills).
- Activity / audit timeline.

Do not show a single “Paid” PO status. Show a derived supplier financial summary such as “Bills outstanding” separately from fulfillment.

---

## 14. Validation and business rules

### Draft PO validation

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

### Confirm validation

- PO is currently `DRAFT`.
- Vendor is active.
- At least one valid stock/service line exists.
- Required dates, term, currency, warehouse/location and price fields are present according to line type.
- Payment term belongs to organization and is active.
- No duplicate line identity restrictions are violated, if such restrictions exist.
- Confirm operation and `onOrderQty` updates are atomic.

### Shipment validation

- PO is confirmed and not closed/cancelled.
- Shipment line belongs to the PO.
- Shipped quantity is positive and in the correct unit.
- Cumulative shipped quantity cannot exceed ordered quantity minus cancelled quantity.
- Inventory `onOrderQty` cannot become negative.
- Inventory `inTransitQty` updates in the same transaction.

## 15. Reversals and corrections

- Draft PO / shipment records may be edited or discarded according to normal draft rules.
- A confirmed PO cancellation releases only the outstanding unshipped commitment; it must not erase shipment/receipt history.
- A posted shipment is immutable. Reverse it through a linked reversal that restores `onOrderQty` and reduces `inTransitQty` only for quantities not already received.
- Do not reverse a shipment quantity already consumed by a posted receipt until the receipt is validly reversed/returned.
- Preserve original documents, users, timestamps, reasons, and source references.

## 16. Reporting and reconciliation

Required PO views:

1. Open Purchase Orders.
2. Orders by lifecycle and fulfillment state.
3. Expected / overdue supplier deliveries.
4. `onOrderQty` and `inTransitQty` by item, warehouse, and location.
5. PO lines with remaining unshipped, in-transit, received, and unbilled quantities.
6. Links to related receipts, bills, and payments (read-only relationships; bill/payment state is owned by the AP module).

Reconcile:

- `inventory_items.onOrderQty` = sum of confirmed PO line quantities not yet shipped/cancelled/received by direct receipt.
- `inventory_items.inTransitQty` = sum of posted shipment quantities not yet received.
- PO line quantity counters against immutable Shipment and Receipt lines.
- Payment-term count per organization against `PAYMENT_TERMS_MAX_PER_ORG`.

## 17. Testing and acceptance criteria

### 17.1 PO form and Party integration tests

- PO number preview is read-only and final number allocated by server.
- Concurrent creates cannot duplicate organization-scoped PO numbers.
- Date defaults use organization-local today (not UTC date slicing).
- Supplier async picker searches only eligible Party records in the organization.
- View supplier opens the Party detail without losing form state.
- Create supplier uses the Party module and selects the created Party.
- No `vendors` table or duplicate supplier service is introduced.
- Payment term defaults from Party where supported, otherwise organization default / Due on receipt.
- Seeded and custom payment terms obey the max of 20 per organization under concurrent creates.
- Draft save does not affect inventory quantities or accounting.
- Save and Confirm requires a confirmation dialog and increments `onOrderQty` exactly once.

### 17.2 Quantity lifecycle tests

Use this example (base units): start `onHandQty=10`, `onOrderQty=0`, `inTransitQty=0`; order 100, ship 40, receive 25, ship 60, receive 75.

```text
After confirm:       onHand=10, onOrder=100, inTransit=0
After ship 40:       onHand=10, onOrder=60,  inTransit=40
After receive 25:    onHand=35, onOrder=60,  inTransit=15
After ship 60:       onHand=35, onOrder=0,   inTransit=75
After receive 75:    onHand=110,onOrder=0,   inTransit=0
```

Also test direct receipts, partial shipments, cancellations, reversal constraints, duplicate requests, concurrency, and batch-tracked items where the batch is not known until receipt.

## 18. Implementation sequence

1. Confirm Party module capability/role API and reuse it for supplier selection.
2. Add contracts for PO, shipment, and payment terms.
3. Refactor generic LineItems and add reusable DatePickerField while preserving Inventory Adjustment behavior.
4. Implement Payment Terms seeding, management, and max-count guard.
5. Implement PO schema, numbering, draft form, confirmation, and PO details.
6. Add `inventory_items.inTransitQty` migration coordinated with receipt module.
7. Implement supplier shipment drafts/posting/reversal and projection reconciliation.
8. Integrate Receipt and AP modules through stable document IDs and source references.

## 19. Decisions to preserve

- PO confirmation increases `onOrderQty`, never `onHandQty`.
- Supplier dispatch moves quantity from `onOrderQty` to `inTransitQty`.
- The receipt spec owns physical on-hand and stock movement posting.
- PO status is not a payment status.
- Payment Terms are reusable organization-scoped records with a 20-record cap including seeded system terms (unless product explicitly changes this policy).
- Use the existing Party module for vendors/suppliers; do not create vendor master tables.
- Posted shipment history is corrected through reversal, not mutation/deletion.

## 20. Repository checks before implementation

- Confirm canonical Party FK/table name and supplier capability/role representation.
- Confirm shared document-number service and prefixes.
- Confirm whether payment terms already exist in another module.
- Confirm location/system-location conventions and whether inventory projection service supports non-on-hand inbound quantity deltas.
- Confirm `inventory_items` composite keys and migration conventions.
- Confirm no existing PO/shipment module already owns these documents.
