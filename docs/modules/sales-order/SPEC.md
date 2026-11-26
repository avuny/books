# Sales Order & Inventory Reservation Module — Implementation Specification

**Status:** Companion specification to the Purchasing modules.
**Audience:** Engineering, product, QA, warehouse, and sales stakeholders.
**Scope:** Sales Order lifecycle, form/UI, pricing snapshots, inventory reservations, and integration contracts.
**Out of scope:** Delivery Note / outbound stock movement, Sales Invoice, Customer Payment; see the companion specifications.

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

This specification belongs to the Sales Order module only. It owns `sales_orders` and `sales_order_lines`, and is the source document for inventory reservation. It does not own Sales Delivery, Sales Invoice, or Customer Payment schemas; those are specified in `SALES-DELIVERY-SPEC.md` and `SALES-INVOICE-PAYMENTS-SPEC.md` respectively.

The modules communicate through IDs and explicit service use-cases. They must not directly mutate one another's tables outside the owning module's transactional service boundary.

## 1. Goals and non-goals

Build a clear Sales Order workflow for non-accountant users while preserving inventory availability, customer commitments, pricing snapshots, and safe reservation behavior. Confirmation must reserve stock, not issue stock and not create accounting entries.

The module must support draft creation, generated document numbers, Party-backed customer selection, shared payment terms, generic reusable line items, warehouse/location/batch-aware reservation, partial reservation/backorder policies, cancellation, controlled amendments, and an order detail view that shows fulfillment and billing progress from related modules.

The first release does not require CRM opportunities, advanced promotions/rebates, wave picking, route optimization, recurring orders, consignment, drop-shipping, or custom credit-limit automation beyond an explicit organization policy.

## 3. Lifecycle and status model

### 3.1 Do not use one status for every sales workflow

A Sales Order's commercial lifecycle, fulfillment, invoicing, and payment are independent. Payment status belongs to Sales Invoices / Customer Payments, not the SO itself.

Suggested lifecycle enum:

```ts
export const SALES_ORDER_STATUSES = [
  "DRAFT",
  "CONFIRMED",
  "CLOSED",
  "CANCELLED",
] as const;
```

Suggested derived summary dimensions:

- **SO lifecycle:** `DRAFT`, `CONFIRMED`, `CLOSED`, `CANCELLED`.
- **Reservation summary:** `NOT_RESERVED`, `PARTIALLY_RESERVED`, `RESERVED`, `PARTIALLY_CONSUMED`, `RELEASED`.
- **Fulfillment summary:** `NOT_DELIVERED`, `PARTIALLY_DELIVERED`, `DELIVERED`.
- **Billing summary:** `UNINVOICED`, `PARTIALLY_INVOICED`, `INVOICED`.
- **Payment summary:** `UNPAID`, `PARTIALLY_PAID`, `PAID` (derived from related Sales Invoices; display-only on SO).

Do not persist every derived summary unless there is a measured performance need. If cached, update it only from posting services and make it reconcilable to child documents.

### 3.2 Sales Order lifecycle transitions

| Action | Preconditions | Result | Inventory projection | GL |
|---|---|---|---|---|
| Save Draft | Draft-valid form; no posting | `DRAFT` | No change | No journal |
| Confirm | Draft; active customer; valid priced lines; stock policy satisfied | `CONFIRMED` | Create reservation; increase `reservedQty` by allocated quantities | No journal |
| Record Sales Delivery | Confirmed SO; quantity is reserved or explicitly allowed as unreserved/backorder fulfillment | Delivery posted; fulfillment summary recalculated | Consume reservation and decrease source location `onHandQty`; stock movement created | COGS / Inventory at configured control-transfer point |
| Close | No remaining delivery commitment, or user explicitly closes/cancels remaining lines with reason | `CLOSED` | Release remaining active reservations | No journal by default |
| Cancel | Draft, or confirmed with no delivery; otherwise cancel only remaining unfulfilled quantity | `CANCELLED` or remain confirmed with cancelled line quantity | Release remaining active reservations | No journal by default |

Never allow a client to directly patch an SO from `DRAFT` to `CONFIRMED` without executing the reservation service.

### 3.3 Intermediate status derivation

All quantities must be normalized to the item's base unit and captured using the conversion factor in effect at confirmation.

Per SO line, keep or derive:

```text
orderedBaseQty
cancelledBaseQty
reservedBaseQty       // quantity currently/ever allocated; exact definition must be consistent
pickedBaseQty         // optional if warehouse picking is implemented
 deliveredBaseQty     // cumulative posted delivery quantity
invoicedBaseQty       // quantity allocated to posted Sales Invoice lines
```

Prefer separate immutable child documents / reservation allocations as the source of historical truth. Header/line counters may be maintained as transactional projections for performance.

Derived quantities:

```text
openToDeliverBaseQty = orderedBaseQty
                     - cancelledBaseQty
                     - deliveredBaseQty

activeReservedBaseQty = sum(allocation.reservedQty
                           - allocation.consumedQty
                           - allocation.releasedQty)

unreservedOpenBaseQty = max(0, openToDeliverBaseQty - activeReservedBaseQty)

uninvoicedDeliveredBaseQty = deliveredBaseQty - invoicedBaseQty
```

Enforce non-negative quantities and prevent over-delivery / over-invoicing unless a specific authorized overage policy exists.

Suggested fulfillment summary precedence:

1. `DRAFT` if the SO is draft.
2. `CANCELLED` if fully cancelled before any delivery.
3. `CLOSED` if explicitly closed and no open delivery quantity remains.
4. `DELIVERED` if all non-cancelled order quantity has been delivered.
5. `PARTIALLY_DELIVERED` if some, but not all, quantity has been delivered.
6. `NOT_DELIVERED` otherwise.

A confirmed SO may be partly reserved while not yet delivered. Show reservation and delivery quantities separately.

### 3.4 Partial operations are first-class

Support:

- One SO line reserved across multiple locations and/or batches.
- One SO line delivered through multiple Delivery Notes.
- One Delivery Note containing lines from multiple SO lines if the business flow needs consolidation (v1 may keep one SO per Delivery Note for simpler traceability).
- Multiple Delivery Notes for one SO.
- Multiple Sales Invoices for one SO and invoices covering one or multiple posted deliveries (if invoice allocation supports it).
- One Customer Payment allocated to multiple invoices.
- Partial payments and outstanding balances.
- Partial cancellation and reservation release.

Never assume one SO = one Delivery Note = one Sales Invoice = one Customer Payment.

---

## 4. Sales Order form specification

### 4.1 Header fields

| Field | Required | UI | Default / behavior |
|---|---:|---|---|
| `number` | Yes in persisted record | Read-only text with copy affordance | Server-generated `SO-...`; preview shown when form opens. |
| `partyId` | Yes to confirm; draft requirement follows app policy | Async combobox | Search active customers in current organization. Include view icon and “Create customer” action. |
| `date` | Yes | Reusable date picker | Organization-local current date. |
| `requestedDeliveryDate` | Recommended | Reusable date picker | Defaults to organization-local today or a configured default lead-time date. Product decision: default today only if consistent with the requested PO form behavior. |
| `paymentTermId` | Recommended | Select / combobox | Customer default term, otherwise organization default, otherwise “Due on receipt”. |
| `warehouseId` | Recommended | Select | Default fulfillment warehouse copied to stock lines; line may override if multi-warehouse fulfillment is supported. |
| `currency` | Yes | Customer / organization default | Snapshot currency and exchange-rate policy; do not silently change after confirmation. |
| `billingAddress` | If customer has multiple addresses | Customer address selector | Snapshot the selected address on confirmation / invoice. |
| `shippingAddress` | Recommended for physical goods | Customer address selector | Defaults to customer default shipping address; snapshot on confirmation. |
| `customerReference` | No | Text | Customer's PO / reference number. |
| `salespersonId` | Optional | Select | Only if salesperson module exists. |
| `notes` | No | Textarea | Internal notes; customer-facing terms/notes should be a separate field. |

The requested delivery date is a customer request, not proof that delivery occurred. The actual delivery date belongs to the Sales Delivery document.

### 4.2 SO number preview and allocation

- Show a preview such as `SO-000123` on create form.
- Allocate the authoritative number on the server during the create transaction using the shared organization-scoped document sequence service.
- Enforce `UNIQUE (org_id, number)`.
- Preview is advisory and may differ if another request consumes a number first.
- Never generate an authoritative number in the browser.
- If the generic numbering service supports document prefixes, register `SO` there rather than creating a second sequence implementation.

### 4.3 Customer async combobox

The customer picker should:

- Search by customer name, code, phone, email, tax number, and supported search keys.
- Be async, debounced, paginated, organization-scoped, and active-only by default.
- Show customer code and a helpful secondary label in search results.
- Include a **view** icon to open customer details without losing form state.
- Include a **Create customer** action; after a successful create, select the returned customer ID.
- Load customer default payment term, currency, addresses, tax profile, and price-list defaults where those modules exist.
- Warn if the customer is inactive / on credit hold; enforce permission and credit policy server-side.
- Reject cross-organization customer IDs at API and database boundaries.

### 4.4 Date fields

Reuse the `DatePickerField` proposed in the Purchasing specification. Do not create a second, sales-specific date picker.

- Store date-only values as `YYYY-MM-DD`.
- Calculate defaults using organization-local timezone, not `new Date().toISOString().slice(0, 10)`.
- Keep order date, requested delivery date, actual shipment date, actual delivery date, and invoice date semantically distinct.

### 4.5 Payment terms

Reuse the shared `payment_terms` table and contract module defined in the Purchasing specification. Do not create `customer_payment_terms` as a duplicate table.

- Apply a customer's default payment term when selecting the customer.
- Allow an authorized user to choose another active term.
- Snapshot term name, method, and days on the Sales Order when confirmed.
- The actual Sales Invoice due date is calculated from the **invoice date**, not SO date or delivery date.
- Respect special calendar terms such as due on receipt, Net 15/30/45/60, end of month, and end of next month.

### 4.6 Form actions

Provide two actions below the line items, consistent with the Inventory Adjustment and Purchase Order forms:

1. **Save as Draft** — save editable order, no reservation, no Stock Movement, and no journal entry.
2. **Save and Confirm** — show a confirmation dialog explaining that confirmation will reserve available stock for this customer. On acceptance, confirm the SO and create reservation allocations atomically.

The confirmation dialog should show a reservation summary by item:

| Item | Ordered | Available before confirmation | To reserve | Backorder |
|---|---:|---:|---:|---:|
| Item A | 10 | 8 | 8 | 2 |

Use the configured reservation policy to decide whether a shortage blocks confirmation or creates a partial reservation / backorder. Do not silently promise stock that is not physically available.

---

## 5. Sales Order line items

### 5.1 Recommended fields

| Field | Required | Notes |
|---|---:|---|
| `itemId` | Yes for product lines | Async item selector. Service lines may be supported when revenue account mapping exists. |
| `descriptionSnapshot` | Recommended | Item description captured at order confirmation; editable per-line description if permitted. |
| `warehouseId` | Yes for stock lines | Inherit SO default; may vary per line if supported. |
| `locationId` | Yes for stock lines | Location from which the goods will be fulfilled. Must be stockable and allowed for the warehouse. |
| `unitId` | Yes | Selling unit of measure. |
| `baseUnitFactorSnapshot` | Yes | Conversion factor captured at confirmation. |
| `orderedQty` | Yes, > 0 | Quantity in selected selling unit. |
| `orderedBaseQty` | Yes | Normalized base quantity used by reservation and delivery. |
| `unitPrice` | Yes for taxable/revenue product lines | Selling price, not purchase cost. |
| `discountRate` / `discountAmount` | Optional | Use the same shared discount calculation conventions as purchasing. |
| `taxCodeId` | Depends on tax module | Tax code / rate snapshot must be resolved by the tax service. |
| `netAmount` | Derived | Quantity × price less discounts, before tax. |
| `taxAmount` | Derived | Calculated by tax service. |
| `grossAmount` | Derived | Net + tax. |
| `deliveredBaseQty` | Derived / transactional projection | Must reconcile with posted Sales Delivery lines. |
| `invoicedBaseQty` | Derived / transactional projection | Must reconcile with invoice allocations. |
| `cancelledBaseQty` | Optional | Only for explicit partial cancellation. |
| `notes` | No | Internal line note. |

**Do not put purchase cost in `unitPrice`.** The SO unit price is the customer's selling price. Actual COGS is derived from inventory cost layers consumed during outbound fulfillment. If the UI shows estimated margin, treat it as informational and do not use it as the accounting cost basis.

### 5.2 Item selection behavior

When an item is selected:

- Populate item description, sales unit, conversion factor, default selling price where configured, tax code, and tracking policy.
- Load valid units and warehouse/location options.
- Show `onHandQty`, `reservedQty`, `availableQty`, and optionally expected inbound (`onOrderQty`, `inTransitQty`) as informational values.
- Calculate `availableQty = onHandQty - reservedQty` for the selected stockable location (or aggregate across authorized fulfillment locations where the reservation service supports it).
- Never add `onOrderQty` or supplier `inTransitQty` to physically available stock. Future supply may be shown as forecast but is not reservable in v1.
- For batch-tracked items, allow the reservation service to allocate eligible batches using the configured allocation policy (FIFO/FEFO/manual). Do not require the user to choose a batch on the SO unless the customer requires a specific lot.
- Changing the item must clear incompatible unit, tax, warehouse/location, and any manually selected batch.
- The server must re-read and lock inventory rows during confirmation; UI availability is only a preview.

### 5.3 Price and discount behavior

- SO line price is the agreed selling price.
- Capture currency, price, discount, tax code, and relevant descriptions at confirmation so later changes to item/customer masters do not rewrite the order.
- Price overrides require the appropriate permission and optional reason.
- Recalculate line and document totals on the server; never trust client totals.
- Sales Invoice is the financial source document for the actual amount charged. If invoice price differs from the SO price, require an authorized variance path and preserve both values.
- COGS must come from actual cost-layer allocations, not SO selling price or a manually entered purchase price.

---

## 6. Generic reusable `LineItems` component

Use the same generic component planned in the Purchasing specification. Sales Order support is another consumer, not a reason to fork the component.

The shared UI block owns only generic field-array behavior:

- Add / remove line rows.
- Stable React Hook Form field-array keys.
- Empty state and line header / footer layout.
- Optional shared item selector adapter.
- Caller-provided line fields, row footer, and totals slots.
- Typed index, line, and disabled context.

The block must not know about sales reservations, purchase costs, sales prices, tax posting, stock movement, or API endpoints.

Sales Order form supplies:

- Item picker.
- Warehouse / location.
- Unit.
- Ordered quantity.
- Selling unit price.
- Discount and tax fields.
- Optional availability / reservation preview in the row footer.

Purchase Order form supplies purchase-specific fields; Inventory Adjustment supplies counted quantity and adjustment direction. Keep one generic line-array primitive with domain-specific renderers.

Example domain data type (illustrative only):

```ts
export type SalesOrderLineFormValue = {
  itemId: string;
  description: string;
  warehouseId: string;
  locationId: string;
  unitId: string;
  quantity: string;
  unitPrice: string;
  discountRate: string;
  taxCodeId: string;
  notes: string;
};
```

Do not use `any` as the public component contract. Use React Hook Form generics (`Control<TValues>`, `FieldArrayPath<TValues>`, `Path<TValues>`) and typed render contexts. Preserve current Inventory Adjustment behavior with regression tests before migrating PO and SO forms.

---

## 7. Inventory reservation design (central sales behavior)

### 7.1 Reuse the existing reservation tables

The provided schema already has the key primitives required for Sales Order reservation:

- `inventory_reservations`
- `inventory_reservation_allocations`
- `inventory_items.reservedQty`
- `inventory_item_batches.reservedQty`

Do not add a second Sales Order-specific reservation table.

On SO confirmation, create one `inventory_reservations` header:

```text
sourceType = "SALES_ORDER"
sourceId   = salesOrder.id
sourceRef  = salesOrder.number
status     = ACTIVE
```

Create one or more `inventory_reservation_allocations` per SO line, depending on how the reservation is spread across locations and batches:

```text
sourceLineId            = salesOrderLine.id
itemId                  = salesOrderLine.itemId
inventoryItemId         = selected InventoryItem.id
inventoryItemBatchId    = selected batch balance ID, when batch tracked
reservedQty             = allocated base quantity
consumedQty             = 0
releasedQty             = 0
```

The reservation schema's polymorphic `sourceType` / `sourceId` and `sourceLineId` ownership cannot be proven with ordinary FKs. The Sales Order service must validate that the reservation belongs to the same SO and that every allocation line belongs to that SO.

### 7.2 Quantity effects on confirmation

For each allocation quantity:

```text
inventory_items.reservedQty += allocatedQty
```

For batch-tracked inventory:

```text
inventory_item_batches.reservedQty += allocatedQty
```

No changes on confirmation to:

```text
onHandQty
onOrderQty
inTransitQty
```

No Stock Movement and no journal entry are created by Sales Order confirmation.

Available stock is a derived value:

```text
availableQty = onHandQty - reservedQty
```

Do not store a duplicate `availableQty` unless an existing inventory design explicitly does so.

### 7.3 Reservation policies

Implement an explicit organization-level policy or an explicit confirm command option. Do not infer backorder behavior from a UI checkbox alone.

Recommended v1 policy options:

- `REQUIRE_FULL_RESERVATION`: confirmation fails if all stock lines cannot be fully reserved.
- `ALLOW_PARTIAL_RESERVATION`: reserve available quantities and leave the remainder as backorder / unreserved demand.
- `ALLOW_BACKORDER_WITHOUT_RESERVATION`: confirm commercial demand even when no physical stock is available; do not increase `reservedQty` for missing stock.

Recommended default: `REQUIRE_FULL_RESERVATION` for a simple inventory ERP. If the product expects users to accept orders despite shortages, use `ALLOW_PARTIAL_RESERVATION` and clearly show the unreserved/backorder quantity.

Non-stock and service lines do not create inventory reservations.

### 7.4 Allocation policy

For non-batch-tracked stock, allocate from the selected location or from permitted locations in the selected warehouse.

For batch-tracked stock:

- Only allocate batches permitted for sale (not expired, recalled, quarantined, blocked, or otherwise unavailable).
- Apply the organization item allocation policy (FEFO is normally appropriate for expiry-managed lots; FIFO may be used when no expiry policy exists).
- Lock parent inventory rows and relevant batch rows in a stable deterministic order to avoid deadlocks.
- Update parent and child reserved quantity projections atomically.
- Enforce parent/child aggregate equality for batch-tracked items.
- If a user chooses a specific batch, validate its available quantity and eligibility on the server.

### 7.5 Confirming the SO safely

The confirmation operation must execute in one database transaction:

1. Load and lock the SO header and lines.
2. Verify status is `DRAFT` and organization/customer references are valid.
3. Validate quantities, UOM conversion snapshots, price, tax inputs, warehouses, and locations.
4. Lock candidate `inventory_items` and `inventory_item_batches` in deterministic order.
5. Recalculate live availability.
6. Apply reservation policy; reject or create partial allocations as configured.
7. Insert `inventory_reservations` and allocation rows.
8. Increment `reservedQty` projections by exact allocated quantities.
9. Set SO status to `CONFIRMED`, `confirmedAt`, `confirmedBy`.
10. Commit.

Any failure rolls back both reservation allocations and SO confirmation. Use an idempotency key or state precondition so retries cannot create duplicate reservations.

### 7.6 Changing or cancelling a confirmed SO

- Do not silently edit confirmed stock-affecting lines.
- For v1, allow edits to notes and non-stock metadata only. To change item, quantity, warehouse, location, or unit, use an authorized amendment workflow that adjusts reservations atomically, or cancel and recreate if no fulfillment has occurred.
- When order quantity decreases, release the excess active reservation before changing the quantity.
- When order quantity increases, attempt a new reservation under the configured policy.
- On cancellation, increment each allocation's `releasedQty` by its remaining active quantity and decrement `InventoryItem.reservedQty` / batch `reservedQty` by the same quantity.
- Keep allocation rows as history. Do not delete them.
- Close the reservation header only when all allocation active quantities are zero.

Active allocation quantity:

```text
activeQty = reservedQty - consumedQty - releasedQty
```

Must never be negative.

---

## 8. Database design owned by this module

The following is logical Drizzle guidance, not a drop-in migration. Follow the repository's existing `pk()`, `quantity()`, `money()`, `currency()`, `timestamps()`, tenant composite-FK, enum, and index conventions.

### 8.1 Existing tables to reuse

| Existing table/service | Sales Order use |
|---|---|
| Party module | Customer identity; persist `party_id`; no new customer master |
| `inventory_items` | Read `onHandQty` and `reservedQty`; do not change `onHandQty` or `onOrderQty` on confirmation |
| `inventory_item_batches` | Batch-level on-hand and reserved quantities |
| `inventory_reservations` | One reservation header per SO using `sourceType = SALES_ORDER` |
| `inventory_reservation_allocations` | Allocations by SO line, item, location and optional batch |
| Shared payment terms | Reuse purchasing payment-term records and calculation rules |
| `items`, `warehouses`, `warehouse_locations`, `batches` | Item and stock dimensions |
| Document numbering / contracts | SO numbering and public constants |

Do not add duplicate reservation tables, stock quantity ledgers, customers, UOMs, currencies, or payment terms if existing equivalents are available.

### 8.2 `sales_orders` logical fields

```text
sales_orders
- id, org_id, number (org-unique)
- party_id (FK to Party; customer-capable Party required)
- order_date, requested_delivery_date
- payment_term_id and immutable payment-term snapshots
- currency and exchange-rate snapshot (if applicable)
- default_warehouse_id (optional)
- customer_reference
- customer_name_snapshot, billing_address_snapshot, shipping_address_snapshot
- subtotal, discount_total, tax_total, grand_total
- status: DRAFT | CONFIRMED | CLOSED | CANCELLED
- confirmed_at/by, closed_at/by, cancelled_at/by
- note, created_by, timestamps
```

Document totals are server-calculated and stored using exact monetary helpers. The SO number preview is informational; the persisted number is allocated by the server.

### 8.3 `sales_order_lines` logical fields

```text
sales_order_lines
- id, org_id, sales_order_id, line_no
- item_id (nullable only for explicitly supported service/charge lines)
- description_snapshot
- warehouse_id, location_id, unit_id
- base_unit_factor_snapshot
- ordered_qty, ordered_base_qty
- reserved_base_qty (optional reconciled projection)
- delivered_base_qty (optional reconciled projection)
- invoiced_base_qty (optional reconciled projection)
- cancelled_base_qty
- unit_price, discount fields, tax_code_id / tax snapshot
- net_amount, tax_amount, gross_amount, notes, timestamps
```

Use exact decimal quantity and money types. Any cached reservation/delivery/invoice counters must be updated in the same transaction as the owning event and reconciled against child documents.

### 8.4 Constraints and indexes

- Tenant-scoped composite FKs to Party, items, warehouse/location, units, tax/payment-term references as appropriate.
- Unique `(org_id, number)` and `(org_id, id)` where composite child references require it.
- `ON DELETE RESTRICT` for historical references.
- Index `(org_id, party_id, order_date)`, `(org_id, status, order_date)`, and child `(org_id, sales_order_id, line_no)`.
- Keep posted/confirmed commercial snapshots and audit metadata; use amendment events rather than silently rewriting committed quantities/prices.

## 9. API and service boundaries

The client must not update reservation projections directly. All business actions call application use-cases.

### 9.1 Sales Order use-cases

- `GET /sales-orders/number-preview`
- `POST /sales-orders` — create draft.
- `GET /sales-orders` and `GET /sales-orders/:id` — list/detail. Detail may read related delivery, invoice, and payment summaries but does not own those records.
- `PATCH /sales-orders/:id` — draft-only edit.
- `POST /sales-orders/:id/confirm` — validate and reserve atomically.
- `POST /sales-orders/:id/cancel` — cancel allowed remaining quantity and release active reservations.
- `POST /sales-orders/:id/close` — close remaining demand and release reservations with a reason.
- `POST /sales-orders/:id/amend` — controlled amendment if supported.

### 9.2 Reservation service integration

Reuse the existing reservation service and its concurrency controls. Conceptual operations: `reserveForSource({ sourceType: SALES_ORDER, sourceId, lines, policy })`, `releaseReservation(...)`, `consumeReservation(...)` (called by Delivery module), and `closeReservationIfExhausted(...)`. Align names with the repository.

### 9.3 Transaction boundary

SO confirmation must commit SO state, reservation header, allocation rows, parent/batch `reservedQty` projections, snapshots, and audit metadata in one database transaction. A failure must leave all unchanged. Idempotency must prevent a retry from reserving twice.

## 10. UI composition and copy

### 10.1 Sales Order form

Header: generated SO number preview; Customer async combobox using Party search with view/create actions; order date (organization-local today); requested delivery date; shared payment terms; default warehouse; customer reference.

Line items: item async combobox; warehouse/location; unit; quantity; selling unit price; discount; tax; line total; stock availability/reservation estimate; notes. Totals: subtotal, discounts, tax, grand total.

Actions: **Save as Draft** and **Save and Confirm**. The second action opens a confirmation dialog.

### 10.2 Confirmation dialog

**Confirm Sales Order?**

“Confirming this order will reserve available products for this customer. Reserved products cannot be promised to another order unless this order is changed or cancelled.”

Show requested, reserved, and unreserved/backorder quantities with warehouse/location breakdown. Button: **Confirm and reserve stock**. Do not claim reservation succeeded until the server confirms.

### 10.3 SO detail progress

Display independent sections for order, reservation, delivery, invoicing, and payment. Example: 100 ordered; 80 reserved; 30 delivered; $300 invoiced; $100 paid; $200 outstanding. Do not use a single “Paid” or “Received” status to represent the SO.

### 16.1 Draft validation

- Number is server-generated and unique within organization.
- Customer must belong to the organization if selected.
- At least one meaningful line is required to confirm.
- Stock line item must be active and sellable.
- Quantity > 0; unit must be valid for item; conversion factor > 0.
- Unit price and discount must be within configured limits.
- Warehouse and location must belong to organization and be compatible.
- Currency, tax code, and payment term must be valid and active.
- Date-only values must be valid ISO dates.
- Service/non-stock lines may not create inventory reservations.

### 16.2 Confirmation validation

- SO must be `DRAFT`.
- Customer must be active and not blocked under applicable policy.
- Recalculate price, discounts, tax inputs, and totals on server.
- Revalidate stock and reservation availability under row locks.
- Apply the configured full/partial/backorder policy.
- Validate batches and expiration / quarantine restrictions.
- Store UOM, item description, price, discount, tax, and payment-term snapshots.
- No stock movement or journal is generated by confirmation.

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

### 17.2 Confirmed SO cancellation

- If no delivery has occurred, release all active reservation quantities and cancel the SO.
- If some quantity has been delivered, do not reverse the delivered portion by cancelling the SO. Cancel only the remaining unfulfilled quantity and release its reservation.
- Preserve original order and reservation history.

## 13. Reporting and reconciliation owned by the SO module

- Sales Orders by status, customer Party, salesperson, order date, and requested delivery date.
- Open order quantity, reserved quantity, unreserved/backorder quantity, and age of open demand.
- Reservation allocations by item, warehouse, location, batch, and SO.
- SO confirmed/delivered/invoiced summaries reconciled to posted child documents.

Reconciliation requirements: SO line reserved quantity must reconcile with active reservation allocations; parent/batch `reservedQty` must reconcile to active allocation totals; delivered and invoiced counters must reconcile to posted Delivery/Invoice source allocations.

## 14. Testing and acceptance criteria

- SO number preview is shown; server-issued number is unique and authoritative.
- Customer picker searches Party records with customer capability and supports view/create.
- Dates use organization-local date semantics without UTC day shifts.
- Generic `LineItems` supports sales-specific price, discount, tax, and stock-availability renderers without breaking Inventory Adjustment or Purchasing.
- Save Draft creates no reservation and no journal.
- Confirm creates exactly one reservation and exact allocations; increments `reservedQty` only; leaves `onHandQty` and `onOrderQty` unchanged.
- Full and partial reservation policies behave as configured; batch parent/child projections reconcile.
- Concurrent confirmations cannot reserve the same stock twice. Retries do not duplicate reservation or quantity effects.
- Cancellation releases only unconsumed active reservations; delivered quantity is not erased.
- Every read/write is organization-scoped and authorization is enforced server-side.

## 15. Implementation sequence

1. Audit Party, numbering, payment terms, UOM, item, warehouse/location, and reservation services.
2. Add contracts/enums/schemas for SO lifecycle and reservation source type.
3. Refactor generic `LineItems` only with regression tests for Inventory Adjustment and Purchasing.
4. Implement SO tables, form, draft create/edit, list/detail.
5. Integrate reservation service and atomic confirm/cancel/close use-cases.
6. Add reconciliation and concurrency tests.
7. Integrate Delivery, Invoice, and Payment progress as read-only related-document summaries when those modules land.

## 16. Repository checks before implementation

Verify Party's customer-capability model and address/tax/default-term fields; existing reservation service atomicity; batch allocation rules; `sourceType` constants; shared payment-term semantics; numbering conventions; and generic LineItems render-slot capabilities. Do not infer behavior from table names alone.

## 17. Relationship to companion Sales modules

- `SALES-DELIVERY-SPEC.md` owns outbound Delivery Notes, Stock Movements, reservation consumption, cost-layer allocation, and COGS at control transfer.
- `SALES-INVOICE-PAYMENTS-SPEC.md` owns Sales Invoices, Accounts Receivable, customer payments/advances, allocations, and cash/bank accounting.
- The Sales Order module creates the source demand and reservation. It must not directly write stock movements, invoices, payment documents, or journal entries.
