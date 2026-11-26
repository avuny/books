# Sales Delivery / Delivery Note Module — Implementation Specification

**Status:** Companion specification to `SALES-ORDER-SPEC.md`.
**Audience:** Engineering, warehouse, QA, accounting, and sales operations.
**Scope:** Drafting/posting outbound deliveries, consuming Sales Order reservations, creating Stock Movements, reducing on-hand stock, allocating inventory cost layers, and recognizing COGS at the configured transfer-of-control event.
**Out of scope:** Sales Order creation/reservation policy (see `SALES-ORDER-SPEC.md`), Sales Invoice and Customer Payment (see `SALES-INVOICE-PAYMENTS-SPEC.md`).

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

This specification belongs to the Sales Delivery module. It owns `sales_deliveries` and `sales_delivery_lines`, and is the source of truth for outbound delivery/dispatch events. It consumes Sales Order reservations through the shared Reservation Service and creates Stock Movements through the Stock Movement Service. It does not own Sales Orders, Sales Invoices, Customer Payments, stock ledgers, valuation layers, or journal tables.

The modules communicate through IDs and explicit service use-cases. The Delivery module must not directly write reservation or inventory projection tables except through their owning services.

## 1. Goals and document boundaries

A Sales Delivery (also called Delivery Note or Dispatch Note) records what the company physically dispatches/handovers to a customer against one or more confirmed Sales Order lines. Posting a Delivery is the outbound stock event; it consumes reservations, creates a Stock Movement, reduces warehouse `onHandQty`, and consumes inventory cost layers. If control transfers at this event under the configured accounting policy, it also recognizes COGS and derecognizes Inventory.

The document is not a Sales Invoice and is not a Customer Payment. It must support partial deliveries, multiple deliveries per SO, batches, multiple locations, rejected/short-picked quantities, optional carrier/tracking details, and immutable posted history.

## 8. Sales Delivery / Delivery Note specification

### 8.1 Purpose

A Sales Delivery records the actual quantity picked / dispatched / handed over to the customer. It is the inventory execution document. It is not the Sales Invoice and does not itself record customer payment.

Recommended naming:

- UI: **Sales Delivery** or **Delivery Note**.
- Tables: `sales_deliveries`, `sales_delivery_lines`.
- Number prefix: `DN-...` or `SD-...`; choose one globally consistent prefix policy. `DN` is familiar for Delivery Note.

### 8.2 Delivery fields

Header:

- `orgId`
- `number`
- `salesOrderId`
- `partyId` (snapshot / FK)
- `deliveryDate`
- `warehouseId` if one warehouse per delivery
- `shippingAddressSnapshot`
- `carrier` / `trackingNumber` (optional)
- `customerReference` (optional)
- `status` (`DRAFT`, `POSTED`, `REVERSED` or use reversal relation)
- `postedAt`, `postedBy`, `createdBy`
- `stockMovementId` (unique link to the generated movement)
- `journalEntryId` only if delivery/control transfer creates an accounting event
- `note`

Line:

- `salesDeliveryId`, `lineNo`
- `salesOrderLineId`
- `itemId`, `descriptionSnapshot`
- `fromWarehouseId`, `fromLocationId`
- `unitId`, `baseUnitFactorSnapshot`
- `quantity`, `baseQuantity`
- `batchId` when batch tracked
- reservation allocation reference(s), or a join allocation table if a line consumes multiple reservation allocations
- notes

For batch-tracked products, create one delivery line per batch allocation (or use a delivery-line-batch child table). Do not put multiple batches into one movement line because `stock_movement_lines` accepts one `batchId` per line.

### 8.3 Creating a draft delivery

- Start from a confirmed SO using an action such as **Create Delivery**.
- Prefill open quantities, warehouse/location, and item details.
- Allow the warehouse user to enter actual picked/delivered quantities.
- Prevent delivery quantities above the remaining order quantity and active reservation, unless an authorized unreserved-fulfillment policy explicitly allows it.
- For batch-tracked items, capture actual batch/lot at pick/dispatch if it was not predetermined by reservation.
- Draft delivery has no stock, cost, or GL effect.

### 8.4 Posting a delivery

Posting must happen through one transaction and through existing domain services:

1. Lock Delivery, SO, SO lines, active reservation allocations, inventory projection rows, and cost layers.
2. Validate customer, SO state, line ownership, open quantity, UOM conversion, location, batch status, and delivery quantity.
3. Resolve the exact reservation allocation(s) consumed by each delivery line.
4. Create a Stock Movement with a sales-delivery movement type (add the enum constant to `@avuny/contracts` if not present).
5. For each movement line, set `sourceType = "SALES_DELIVERY"`, `sourceId = salesDelivery.id`, and `sourceRef = delivery.number`.
6. Create each outbound movement line from the stockable warehouse location to the configured customer / external system location. Use base-unit positive quantity; source and destination must differ.
7. Through Stock Movement Service, decrement source `onHandQty` by delivered quantity. The system must ensure the quantity is available and must not create a negative on-hand balance unless explicitly allowed by existing inventory policy.
8. Decrement source `reservedQty` by the quantity consumed. Increment reservation allocation `consumedQty` by the same quantity. Parent and batch projections must be updated atomically.
9. Consume FIFO / FEFO cost layers according to the item's valuation policy. Insert `inventory_cost_allocations` for every movement-line / cost-layer pair.
10. Update SO line delivered counters and delivery summaries.
11. Post COGS / Inventory journal when this event is the configured transfer-of-control point (see §10).
12. Mark delivery `POSTED`; link Stock Movement and relevant journal; set `postedAt` / `postedBy`.
13. Commit.

A retry must not create duplicate movement lines, cost allocations, journal entries, reservation consumption, or SO delivered quantities. Use the unique source reference pattern already used by `stock_movements` and `journal_entries`.

### 8.5 Reservation behavior during partial delivery

Suppose a line ordered 10 and reserved 10 is delivered in two documents:

```text
SO ordered:              10
Initial active reserve:  10
Delivery DN-001:          4
After DN-001:
  onHandQty:             -4
  reservedQty:           -4
  allocation consumed:   +4
  allocation active:      6

Delivery DN-002:          6
After DN-002:
  onHandQty:             -6
  reservedQty:           -6
  allocation consumed:   +6
  allocation active:      0
```

The example shows deltas, not absolute inventory balances. A partial delivery consumes only the quantity delivered; remaining active reservation stays reserved for the next delivery unless the user explicitly releases it.

If a delivery quantity is less than reserved and the user chooses “release undelivered balance”, increment allocation `releasedQty` and decrement cached `reservedQty` by that released quantity.

### 8.6 Partial delivery, shortage, and substitutions

- A partial delivery is allowed; the remaining quantity stays open and reserved (unless released).
- If a batch is unavailable/damaged after reservation, release the affected allocation and reserve another eligible batch/location within the same transaction, or leave it as unreserved backorder.
- Product substitutions require a separate authorized SO amendment / substitute-line mechanism. Do not silently change `itemId` on a posted delivery.
- Rejected or returned-to-warehouse picked goods should not be posted as delivered; they remain stock or use a warehouse transfer/put-away workflow.

### 8.7 Shipment in transit (optional operational extension)

The current `inventory_items` schema has no `outboundInTransitQty`. Do not add an outbound in-transit field just to mirror Purchasing unless the product needs that projection.

For v1, define posting a Sales Delivery as the event that goods leave the company's stockable warehouse and pass the agreed ownership/control point. Use the customer external system location as the movement destination; on-hand stock in the warehouse decreases.

If the company needs to track goods that left the warehouse but are still owned by the company:

- Add an explicit stockable **Outbound Transit** system location (or an equivalent supported location intent).
- Move stock from warehouse to outbound transit on dispatch; the stock remains in company inventory, not available for sale.
- Move stock from outbound transit to the customer external location on confirmed delivery / transfer of control.
- Recognize COGS at the configured control-transfer event, not automatically at the first physical movement.
- Do not also decrement total company inventory on dispatch if it is still recorded in the outbound transit stock location.

This is a deliberate optional extension. Do not create a duplicate `outboundInTransitQty` cache and a transit-location stock ledger that can disagree.

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

### 10.3 Delivery / control transfer: COGS and Inventory

For a perpetual inventory system, when control of goods transfers and inventory is derecognized, post:

```text
Dr Cost of Goods Sold        [actual cost-layer allocation value]
    Cr Inventory                  [same value]
```

The cost is derived from `inventory_cost_layers` and `inventory_cost_allocations`, not from SO sales price.

For each outbound stock movement line:

- Consume cost layers according to the organization's inventory valuation policy (the supplied schema comments describe FIFO).
- Create `inventory_cost_allocations` with `outgoingMovementLineId`, `costLayerId`, `allocatedQty`, and `allocatedValue`.
- Decrease layer `remainingQty` and `remainingValue` atomically.
- Aggregate allocated values by currency / accounting period for the COGS journal.
- Handle rounding at the currency minor-unit boundary using the existing accounting money helpers.

If the company uses weighted average cost rather than FIFO, implement through the existing valuation service rather than bypassing the cost-layer architecture.

### 10.7 Timing of revenue recognition and inventory derecognition

A Sales Order confirmation is not revenue. A warehouse pick is not automatically revenue. A Sales Invoice is not universally the revenue-recognition trigger.

For v1, define an organization accounting policy for when control transfers (for example, delivery to the customer or carrier dispatch under the applicable contract). The posting event must be explicit and consistent:

- If control transfers at delivery: recognize COGS / Inventory at the posted delivery event.
- If control transfers at dispatch: recognize COGS / Inventory at dispatch.
- If goods remain company-owned while in transit: transfer them to an outbound transit stock location and recognize COGS only when control passes.

Revenue is recognized when the performance obligation is satisfied under the applicable accounting rules. For ordinary shipped goods, this may often align with delivery/control transfer, but tax invoicing and revenue timing can differ. The implementation must support a configured posting policy and not infer accounting treatment from a generic SO status.

## 3. Inventory and stock movement integration

### 3.1 Existing schema to reuse

Use the existing `stock_movements`, `stock_movement_lines`, `inventory_items`, `inventory_item_batches`, `inventory_reservations`, `inventory_reservation_allocations`, `inventory_cost_layers`, `inventory_cost_allocations`, `items`, `batches`, `warehouses`, and `warehouse_locations`. Do not create a second stock ledger or delivery-specific inventory balance table.

### 3.2 Outbound movement semantics

- Use the existing Stock Movement Service; add `SALES_DELIVERY` as a movement/source type only if an equivalent outbound delivery type does not already exist.
- Each posted delivery creates one immutable Stock Movement with `sourceType = SALES_DELIVERY`, `sourceId = salesDelivery.id`, and `sourceRef = delivery.number`.
- Each movement line uses a positive base-unit quantity, the actual batch if tracked, and explicit source stockable location plus customer/external system destination location.
- The stock movement history must not FK to mutable `inventory_items` row IDs; it references stable item, batch, and location identities as in the existing schema.
- For non-stockable/service lines, do not create stock movement or cost allocation.

### 3.3 Transit policy

Do not add an `outboundInTransitQty` cache merely to mirror purchasing. For v1, posting delivery is the physical issue/control-transfer event and moves stock to the customer/external system location. If the company must retain ownership during transit, use a typed stockable **Outbound Transit** system location and perform two explicit movements (warehouse → transit, then transit → customer). Recognize COGS at the configured control-transfer event. Never double-count transit inventory in both a location balance and a separate cache.

## 4. Posting transaction and idempotency

Posting a Delivery must execute the following in one transaction (or one orchestrated transactional unit):

1. Lock the Delivery, source Sales Order and lines, active reservation allocations, inventory projection rows, and affected cost layers.
2. Verify Party is the same customer-capable Party on the Sales Order and Delivery.
3. Validate the delivery quantities against remaining SO quantity and active reservations, except where an authorized unreserved fulfillment policy explicitly permits it.
4. Create the Stock Movement header and lines using the canonical Stock Movement Service.
5. Decrease warehouse `onHandQty` and `reservedQty` by the exact shipped quantity; increase reservation allocation `consumedQty`. Parent and batch projections change atomically.
6. If a reserved quantity is not delivered and the user explicitly releases it, increase allocation `releasedQty` and decrease cached `reservedQty` by that released quantity. Otherwise leave it reserved for a later delivery.
7. Consume inventory cost layers under the configured valuation method and create `inventory_cost_allocations` for each movement-line/layer pair.
8. If this Delivery is the configured transfer-of-control event, post balanced `Dr COGS / Cr Inventory` using the allocated cost value. If control transfers later, do not post COGS yet; transfer stock to the appropriate owned transit location and post COGS on the later control-transfer event.
9. Update SO delivered counters/progress through the SO module's application service or an explicitly shared domain event contract.
10. Mark Delivery `POSTED`, store movement/journal references or source lookups, and set `postedAt` / `postedBy`.

All steps must commit or roll back together. A retry must not create duplicate Stock Movements, cost allocations, journal entries, reservation consumption, or SO delivered quantity. Use the unique source indexes already present in stock movement and journal tables.

## 5. Database design owned by this module

Logical schema only; adapt to existing Drizzle helpers and composite tenant FK conventions.

### 5.1 Existing tables to reuse

- Party module for customer identity (`party_id`); no customer master table.
- `sales_orders` / `sales_order_lines` as the source commercial commitment.
- `inventory_reservations` / `inventory_reservation_allocations` for allocation and consumption.
- `stock_movements` / `stock_movement_lines` for immutable physical issue history.
- `inventory_items` / `inventory_item_batches` for mutable quantity projections.
- `inventory_cost_layers` / `inventory_cost_allocations` for valuation.
- `journal_entries` / `journal_entry_lines` and `accounts` for COGS posting.

### 5.2 `sales_deliveries` logical fields

```text
sales_deliveries
- id, org_id, number (org-unique)
- sales_order_id, party_id
- delivery_date, warehouse_id (optional if per-line warehouse)
- shipping_address_snapshot
- carrier, tracking_number, external_reference (optional)
- status: DRAFT | POSTED | REVERSED (or linked reversal document convention)
- note, created_by, posted_at/by
- stock_movement_id (unique where stored) or canonical source lookup
- cogs_journal_entry_id (optional when delivery is control-transfer event)
- timestamps

sales_delivery_lines
- id, org_id, sales_delivery_id, line_no
- sales_order_line_id, item_id, description_snapshot
- from_warehouse_id, from_location_id, unit_id
- base_unit_factor_snapshot, quantity, base_quantity
- batch_id (nullable only for non-batch-tracked item)
- notes, timestamps

sales_delivery_line_reservation_allocations (recommended if one delivery line consumes multiple allocations)
- id, org_id, sales_delivery_line_id, reservation_allocation_id
- consumed_base_qty, timestamps
```

If exact reservation allocation consumption can be deterministically derived and the service stores source line/lot links elsewhere, reuse that model instead of adding the join table. The relationship must remain auditable.

### 5.3 Constraints and indexes

- Composite FKs enforce same-organization Delivery, SO, SO line, Party, item, batch, warehouse, and location references.
- Unique `(org_id, number)`; indexes `(org_id, sales_order_id, delivery_date)`, `(org_id, party_id, delivery_date)`, `(org_id, status, delivery_date)`.
- `line_no >= 1`, quantities positive, and batch belongs to exact item/org.
- Posted documents are immutable; historical references use `ON DELETE RESTRICT`.
- Delivery source is unique for its stock movement; movement posting is idempotent.

## 6. API and service boundaries

- `POST /sales-orders/:id/deliveries` — create draft from remaining deliverable SO lines.
- `GET /sales-deliveries` / `GET /sales-deliveries/:id` — list/detail.
- `PATCH /sales-deliveries/:id` — draft-only edit.
- `POST /sales-deliveries/:id/post` — consume reservation, create Stock Movement, consume cost layers, and post COGS if appropriate.
- `POST /sales-deliveries/:id/reverse` — linked reversal under stock/accounting controls.

Use the existing Reservation Service methods for `consumeReservation` and `releaseReservation`, and the Stock Movement and Valuation services for outbound movement and cost allocation. Do not directly update stock projection, reservation or layer rows from the UI or route handler.

### Transaction boundary

Delivery status, Stock Movement, on-hand/reserved projections, reservation consumption/release, cost-layer balances, cost allocations, COGS journal (when triggered), SO delivery progress, and audit metadata must commit atomically. Invoice creation is a separate downstream action and must not be part of the stock issue transaction unless the application explicitly uses a reliable transactional outbox/orchestration pattern.

## 7. UI composition and non-accountant copy

**Create Delivery** from the Sales Order. Prefill open quantities and reserved locations/batches. User can adjust actual picked/shipped quantities, record short picks/rejections, and enter carrier/tracking details. Clearly distinguish `Picked`, `Dispatched`, and `Delivered` only if the business tracks those as separate operational events; do not create statuses with no real event behind them.

Suggested posting explanation: **Post Delivery** — “This records the products sent to the customer, updates stock, and records their cost.”

After posting, show a default-checked option / clear action: **Create customer invoice after delivery** — “Create a draft invoice for the products delivered. You can review it and record payment now or later.” The Delivery module may request the Invoice module to create a draft, but the invoice module owns the document and all AR/revenue posting. If unchecked, show delivered-but-uninvoiced quantity/value and a Create Sales Invoice action.

### 16.3 Delivery validation

- Delivery must be draft and linked to a confirmed SO.
- Delivery line must refer to a line on the same SO and organization.
- Quantity > 0 and not above remaining deliverable quantity.
- Consume active reservation allocations unless unreserved fulfillment is explicitly permitted.
- Item, batch, warehouse, and location must be valid and eligible.
- Prevent negative stock according to existing inventory policy.
- Revalidate reservation / on-hand / cost-layer quantities under locks.
- Posted delivery and linked Stock Movement cannot be edited or deleted.

### 16.6 Security and permissions

Suggested granular permissions:

- `sales.orders.read`, `sales.orders.create`, `sales.orders.update_draft`, `sales.orders.confirm`, `sales.orders.cancel`, `sales.orders.close`.
- `sales.deliveries.read`, `sales.deliveries.create`, `sales.deliveries.post`, `sales.deliveries.reverse`.
- `sales.invoices.read`, `sales.invoices.create`, `sales.invoices.post`, `sales.invoices.credit_note`.
- `sales.payments.read`, `sales.payments.create`, `sales.payments.post`, `sales.payments.reverse`.
- `inventory.reservations.read` and any override permission for unreserved fulfillment / negative stock.

The backend must enforce permissions. Hiding a button is not authorization.

---

### 17.3 Delivery reversal

A posted delivery is immutable. A reversal must:

- Create a linked reversing Stock Movement with opposite direction (or the existing Stock Movement Service's canonical reversal representation).
- Restore returned goods to an appropriate receiving / inspection location, not automatically to sellable stock if they require inspection.
- Restore inventory value using the established reversal valuation policy; do not invent a new cost.
- Reverse / adjust COGS through a balanced reversing journal if the goods are physically returned and control returns to the company.
- Restore or close reservation only if the SO remains open and the returned quantity is to be re-allocated; do not automatically reserve returned goods for a cancelled order.
- Keep original Delivery, Stock Movement, cost allocations, and journal entries readable.

A customer return after delivery should normally be a separate **Sales Return / Return Receipt** document, not merely a reversal of the historic Delivery. It must record returned condition and disposition (restock, quarantine, scrap, repair).

## 9. Reporting and reconciliation

- Deliveries by status, customer Party, date, warehouse, carrier, and Sales Order.
- Open-to-deliver quantities, partial deliveries, short picks, and backorders.
- Shipped/delivered-but-not-invoiced quantities and values.
- Outbound movement audit by item, warehouse, location, batch, and SO.
- COGS by delivery and reconciliation to cost-layer allocations.

Reconcile every posted Delivery line to its Stock Movement line; reservation consumption to exact allocation quantities; parent/batch on-hand and reserved projections to stock/reservation ledgers; costed movement lines to cost allocations; and COGS journal totals to allocated value whenever Delivery is the control-transfer event.

## 10. Testing and acceptance criteria

- Draft Delivery has no stock or GL effect.
- Partial delivery consumes only delivered reservation quantity; remainder stays reserved unless explicitly released.
- Posting decreases `onHandQty` and `reservedQty` by the exact base quantity; batch child and parent totals reconcile.
- Delivery line can consume from multiple location/batch allocations with explicit provenance.
- Negative stock and over-delivery rules are enforced under row locks.
- Every posted stock movement has a unique `SALES_DELIVERY` source identity. Retries do not duplicate movement, reservation consumption, allocations, or journals.
- Cost layers are consumed in the configured order; allocation quantities equal movement quantities and allocation value drives COGS.
- Transit ownership policy is respected; no double count between an outbound transit location and a transit cache.
- Delivery reversal/return preserves the original movement and journal history.
- Party/org, permission, period-close, and audit checks are enforced.

## 11. Implementation sequence

1. Audit Stock Movement type/location rules, Reservation Service, Valuation Service, and control-transfer policy.
2. Add Delivery contracts/enums, document number prefix, and source constants.
3. Create Delivery tables and draft-from-SO use-case.
4. Implement posting through reservation, stock movement, and valuation services in one transaction.
5. Add COGS posting at the configured control-transfer event.
6. Add optional draft invoice handoff to the Invoice module.
7. Implement reversals/returns and stock/COGS reconciliation tests.

## 12. Decisions to preserve

1. Delivery Note is an outbound inventory document, not an invoice or payment.
2. Reservation is consumed only for quantity actually delivered.
3. `onHandQty` and `reservedQty` decrease together on posted stock issue; do not increase/decrease `onOrderQty`.
4. Use the existing Stock Movement, reservation, cost-layer, cost-allocation, and journal services.
5. COGS comes from allocated inventory cost, never the Sales Order selling price.
6. A Sales Invoice must not create another stock movement or reduce inventory again.
7. Posted operational/accounting events are immutable; correct via linked reversal or Sales Return / Return Receipt.

## 13. Repository checks before implementation

Verify customer/external system location semantics, allowed movement types, reservation allocation consumption APIs, batch and UOM conversion rules, valuation method and FIFO/average implementation, COGS account posting profiles, exact transfer-of-control policy, and whether delivery dispatch and customer handover are one or separate real-world events.

## 14. Relationship to companion Sales modules

- `SALES-ORDER-SPEC.md` owns the Sales Order and reservation demand. This module consumes its reservation allocations and updates fulfillment progress through the SO module contract.
- `SALES-INVOICE-PAYMENTS-SPEC.md` owns Sales Invoices, AR, Customer Payments, and customer advances. This module may request a draft invoice after posting, but does not write invoice or payment tables.
