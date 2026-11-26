# Purchase Receipt Module — Implementation Specification

**Status:** Proposed implementation specification  
**Audience:** Engineering, product, QA, warehouse, and accounting stakeholders  
**Module boundary:** Physical supplier receiving, Purchase Receipt / GRN documents, acceptance/rejection, Stock Movement integration, inventory valuation layers, and receipt accrual (Inventory / GRNI).  
**Depends on:** Purchase Order & Supplier Shipment module, existing Party / Item / Warehouse / Batch modules, Stock Movement Service, Inventory Cost Layers, and Accounting Posting Service.

> This is the second of three purchasing specifications. Purchase Orders and supplier shipments are defined in `PURCHASE-ORDER-SPEC.md`. Vendor Bills and Vendor Payments are defined in `VENDOR-BILL-PAYMENTS-SPEC.md`.

## 1. Goals and responsibilities

A Purchase Receipt (also called Goods Receipt Note / GRN) records what physically arrived from a supplier, what was accepted, what was rejected or quarantined, and where accepted goods were placed. It is the authoritative purchasing event that increases physical on-hand stock.

The module must:

1. Create a Purchase Receipt from a confirmed PO, supporting partial and multiple receipts.
2. Capture actual received, accepted, rejected, batch/serial, unit, location, and cost details.
3. Reduce `inTransitQty` (or `onOrderQty` for direct delivery without a shipment) and increase `onHandQty` only for accepted stock.
4. Create Stock Movement records through the existing Stock Movement Service.
5. Create inventory cost layers through the valuation service.
6. Post Inventory / GRNI accounting in the same transaction as receipt posting.
7. Offer a default-checked “Create supplier bill after receiving” option that creates a linked **draft** Vendor Bill and redirects the user; bill creation/posting/payment are owned by the AP module.
8. Preserve immutability, reversals, idempotency, concurrency safety, and auditability.

## 2. Domain boundaries and supplier identity

- A Purchase Receipt is not a Purchase Order, Vendor Bill, or Vendor Payment.
- A posted receipt confirms physical acceptance and creates inventory/accounting effects; it does not prove the supplier invoice is received or paid.
- Use the existing Party module. Persist or resolve the supplier using `partyId` (the supplier Party FK), validated against the linked PO. Do not create a Vendor/Supplier table.
- Use `purchaseOrderId` and `purchaseOrderLineId` as the primary links to the PO. A receipt may contain only lines from the referenced PO in v1.
- Receipt status is separate from PO fulfillment, bill status, and payment status.

## 3. Receipt lifecycle and quantity rules

Recommended receipt status:

```ts
export const PURCHASE_RECEIPT_STATUSES = [
  "DRAFT",
  "POSTED",
  "REVERSED",
] as const;
```

- `DRAFT`: editable; no quantity projection, Stock Movement, cost layer, or journal effect.
- `POSTED`: immutable physical receipt; Stock Movement, inventory projections, valuation layers, and Inventory / GRNI journal committed.
- `REVERSED`: original receipt remains visible; reversal is linked and corrects quantity/value through reversal records.

Partial receiving is represented by multiple receipt documents or multiple posted receipt lines, not by changing a posted receipt. PO fulfillment state is derived by the PO module from posted receipt quantities.

For each receipt line:

```text
receivedBaseQty = acceptedBaseQty + rejectedBaseQty
```

Once inspection is complete, all received quantity needs a disposition. Accepted quantity enters the appropriate stockable location. Rejected quantity must be returned, quarantined/blocked, or explicitly disposed; it must not silently disappear or become sellable stock.

## 4. Inventory projection and stock movement integration

### 4.1 Existing schema and required `inTransitQty`

The supplied `inventory_items` currently contains `onHandQty`, `reservedQty`, and `onOrderQty`, but not `inTransitQty`. The PO specification defines the schema migration. This receipt module consumes that new projection.

Exact meanings:

- `onHandQty`: physically accepted stock at a stockable location.
- `reservedQty`: demand already allocated to orders; not changed by purchasing receipt.
- `onOrderQty`: confirmed purchasing quantity not yet dispatched.
- `inTransitQty`: supplier-dispatched quantity not yet received.
- `availableQty`: derived from `onHandQty - reservedQty` (and any existing quality-hold/blocked logic).

Do not store `availableQty` as an independent projection if the existing inventory model derives it.

### 4.2 Posting quantity transitions

For shipped goods received at the planned destination:

```text
inTransitQty -= receivedBaseQty
onHandQty   += acceptedBaseQty
```

The physical in-transit amount decreases by the full physically received quantity, including rejected goods, because those goods are no longer in transit. Accepted goods increase stockable on-hand. Rejected goods must be represented in quarantine/blocked stock or supplier-return disposition according to the Warehouse module's existing design.

For a direct receipt without a previously posted shipment:

```text
onOrderQty -= receivedBaseQty
onHandQty  += acceptedBaseQty
```

Do not decrement `inTransitQty` for a direct receipt. The PO module must permit this only when remaining unshipped PO quantity covers the direct receipt.

If the actual receiving location differs from the PO's expected location, release the outstanding inbound quantity from the planned location and apply accepted on-hand quantity at the actual location in one transaction. Do not leave an in-transit projection behind at the old location.

### 4.3 Existing Stock Movement schema integration

The supplied tables are appropriate:

- `stock_movements`: one immutable physical event header.
- `stock_movement_lines`: positive base-unit quantity and explicit source/destination locations.
- `inventory_items`: mutable current quantity projection.
- `inventory_item_batches`: batch-specific physical quantity projection.
- `batches`: permanent batch master records.
- `inventory_cost_layers`: receipt valuation layers linked to movement lines.

Do not update inventory rows from the receipt form or directly insert stock movement rows from UI code. Call the Stock Movement Service.

### 4.4 Movement semantics

For each accepted quantity, create a `PURCHASE_RECEIPT` movement line from the existing supplier/in-transit system location to the actual stockable warehouse location. The `stock_movement_lines` schema requires non-null `fromLocationId` and `toLocationId`; use the established system-location pattern rather than nullable locations.

Supplier dispatch should not create a second physical stock movement unless the repository's movement taxonomy explicitly models virtual inbound stock. The PO module's `inTransitQty` projection and immutable PurchaseShipment records are the shipment audit trail in v1. Avoid two independent ledgers both changing the same quantity.

For rejected goods:

- If placed in a quarantine location, create the appropriate movement to that location and ensure availability excludes it according to existing warehouse rules.
- If rejected at the dock and immediately returned to the supplier, record a supplier return / rejection disposition and corresponding external movement or return document.
- Do not create a cost layer for rejected quantity that never enters inventory. If accounting policy requires a supplier claim/receivable, handle it through a separate claim/credit workflow.

### 4.5 Inventory cost layers

For accepted, costable inventory:

- Create one or more `inventory_cost_layers` through the valuation service, linked to the new Stock Movement line IDs.
- Preserve `receivedQty`, `remainingQty`, `receivedValue`, `remainingValue`, currency, `receivedAt`, and optional batch association.
- Use the configured costing policy. The PO price may be the expected receipt cost but must not be treated as the supplier invoice's final authoritative amount.
- For batch-tracked items, resolve/create the batch through the existing Batch Service and create/update `inventory_item_batches`.
- Do not create cost layers for service/non-stock receipt lines.
- Receipt valuation, cost layer value, and Inventory journal amount must reconcile under the selected costing policy.

### 4.6 Ownership and accounting policy for in-transit goods

V1 uses receipt-based ownership recognition:

- Shipment: reclassifies operational quantities from `onOrderQty` to `inTransitQty`, no GL journal.
- Purchase Receipt: recognizes accepted inventory and GRNI when goods are accepted/controlled at the receiving point.

If contract terms or the applicable accounting policy transfer control at dispatch, an Inventory-in-Transit asset and corresponding accrual may be necessary at shipment. This must be an explicit accounting policy, not inferred merely from status `IN_TRANSIT`.

## 5. Purchase Receipt document specification

### Purpose

A Purchase Receipt records what physically arrived, what was accepted, and where accepted goods were placed. It is the authoritative source for increasing physical on-hand stock from purchasing.

### Header fields

- `id`, `orgId`
- `number` (`PR-...`, generated server-side)
- `purchaseOrderId`
- `partyId` (validated against PO)
- `receiptDate` (organization-local date)
- `warehouseId` if one warehouse per receipt; otherwise line-level warehouse only
- supplier delivery note / packing slip reference
- `notes`
- `status`: `DRAFT`, `POSTED`, `REVERSED` / `VOIDED` according to shared document conventions
- `stockMovementId` (nullable until posted; FK if relationships are modeled directly)
- `journalEntryId` (nullable until posted, or resolve through source type/id)
- `postedAt`, `postedBy`, `createdBy`, timestamps

### Line fields

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

### Posting behavior

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

### Draft / post behavior

- Saving a receipt draft changes no inventory projection and posts no journal.
- Posting a receipt is the inventory and accounting event.
- A posted receipt is immutable. Corrections are made through reversal / return transactions.
- If a receipt is posted and then reversed, reverse the stock movement, cost layer effects, and journal through linked reversal records. Do not delete the original receipt or original journal.


## 6. Default Create Vendor Bill handoff

When the user posts a Purchase Receipt, show a checkbox that is checked by default:

**Create supplier bill after receiving**  
“Record the supplier's invoice so the amount you owe is tracked. You can also record a payment if you have already paid the supplier.”

When unchecked: “Uncheck this if you have not received the supplier's invoice yet. You can create the bill later.”

Behavior:

1. Validate and post the Purchase Receipt (inventory, movement, cost, GRNI) as one atomic business transaction.
2. If checked, call the Vendor Bill module to create a linked **Draft Vendor Bill** from billable accepted receipt lines.
3. Prefill supplier Party, PO/receipt references, item descriptions, accepted quantities, UOM, PO expected prices, currency, and payment-term snapshot.
4. Redirect to the draft Vendor Bill screen so the user can enter supplier invoice number/date, actual invoice amounts/taxes/charges, review matching, and choose Pay later / Already paid in full / Partially paid.
5. Do not auto-post the bill and do not auto-create a payment merely because the checkbox is checked.
6. If draft bill creation fails after receipt commit, keep the receipt posted, show a recoverable “Receipt saved; bill could not be created” message, and provide a retry action. Use an idempotency key or unique receipt-to-draft-bill rule so retry cannot create duplicate bills.
7. If unchecked, leave the receipt with an “Awaiting supplier bill” derived state and a Create Vendor Bill action.

The bill creation operation belongs to the AP module; the receipt module only requests it and handles the navigation/result.

## 7. Accounting behavior

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

### Purchase Receipt posting

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

The receipt's GRNI journal is generated from accepted inventory valuation, not from PO order value or invoiced value. Account IDs are resolved through accounting posting profiles and must not be hardcoded in this module.

## 8. Database design

### 8.1 Existing tables to reuse

- `purchase_orders`, `purchase_order_lines`, `purchase_shipments`, and `purchase_shipment_lines` from the PO module.
- Existing `parties` table/service for supplier identity (`partyId`); no Vendor table.
- `inventory_items` with the `inTransitQty` migration from the PO spec.
- `inventory_item_batches`, `batches`, `stock_movements`, `stock_movement_lines`.
- `inventory_cost_layers` and `inventory_cost_allocations`.
- `journal_entries`, `journal_entry_lines`, and `accounts`.

### 8.2 New tables owned by this module

At minimum:

```text
purchase_receipts
- id
- org_id
- number                         // server-generated PR-...
- purchase_order_id
- party_id                       // supplier Party; must match PO party
- receipt_date                   // date-only, organization-local
- supplier_delivery_reference    // packing slip / delivery note
- notes
- status                         // DRAFT, POSTED, REVERSED
- stock_movement_id              // set on post, if direct FK is used
- journal_entry_id               // optional direct link; source_type/source_id also identify it
- posted_at / posted_by
- reversed_at / reversed_by / reversal_of_id as applicable
- created_by
- timestamps

purchase_receipt_lines
- id
- org_id
- purchase_receipt_id
- purchase_order_line_id
- line_no
- item_id
- warehouse_id
- location_id
- unit_id
- base_unit_factor_snapshot
- received_qty
- accepted_qty
- rejected_qty
- received_base_qty
- accepted_base_qty
- rejected_base_qty
- batch_id                         // nullable unless item is batch tracked
- unit_cost_snapshot / receipt_value
- rejection_reason
- notes
- timestamps
```

Use existing `pk()`, `quantity()`, `money()`, `currency()`, `timestamps()`, and organization-scoped composite FK conventions. Add checks for positive/valid quantities, `accepted + rejected = received` when inspection is complete, and organization/item/PO ownership consistency. If the project models rejected stock in a separate disposition table, use that canonical design instead of adding redundant free-form states.

### 8.3 Relationships and constraints

- One PO has many Purchase Receipts.
- One receipt has many receipt lines.
- A receipt line references a line belonging to the receipt's PO, not an arbitrary PO line.
- `party_id` must match the supplier Party on the PO and be valid for the organization.
- Unique `(org_id, number)` per receipt.
- Posted receipt and lines are immutable; use reversals.
- Use source uniqueness / idempotency to prevent duplicate Stock Movement and journal posting.
- Preserve `onDelete: restrict` for posted/history-related FKs.

## 9. API and service boundaries

- `PurchaseReceiptService`: create draft, update draft, post, reverse, detail/list.
- `StockMovementService`: create/post the accepted/rejected/quarantine physical movements.
- `InventoryValuationService`: create receipt cost layers and value accepted inventory.
- `AccountingPostingService`: post Inventory / GRNI journal.
- `VendorBillService` (from AP module): create linked draft bill idempotently.
- `PurchaseOrderService`: validate open PO line quantities and update receipt counters/fulfillment summary.
- `BatchService`: resolve/create supplier batch records.

Suggested endpoints:

```text
POST   /purchase-orders/:id/receipts
GET    /purchase-receipts/:id
PATCH  /purchase-receipts/:id          // DRAFT only
POST   /purchase-receipts/:id/post
POST   /purchase-receipts/:id/reverse
POST   /purchase-receipts/:id/create-vendor-bill
```

The `create-vendor-bill` command delegates to the AP module; it must return the existing linked draft on retry if one has already been created.

## 10. UI composition

**Receipt form** should show:

- Receipt number (server-generated preview/read-only).
- Receipt date (organization-local today).
- PO reference and supplier Party (read-only from the PO, with Party view link).
- Supplier delivery note / packing slip reference.
- Lines available to receive, with remaining shipped/direct-receivable quantity.
- Received quantity, accepted quantity, rejected quantity, destination warehouse/location, unit, batch/serial details, PO expected unit cost, and notes.
- Validation summary for quantities and rejected-goods disposition.
- Save as Draft and Post Receipt actions; posting requires a confirmation dialog.
- Default-checked “Create supplier bill after receiving” option shown in the post flow.

Suggested post confirmation:

**Post this Purchase Receipt?**  
“Posting records the accepted goods in inventory and recognizes the received-not-invoiced amount. It does not mean the supplier has been paid.”

If Create Bill is checked, helper text should explain that the next screen lets the user enter the supplier invoice and optionally record an immediate payment.

## 11. Validation and business rules

### Receipt validation

- PO is confirmed and not closed/cancelled.
- Receipt line references a PO line from the same PO and organization.
- Cumulative received quantity cannot exceed shipped quantity, except explicit direct receipts.
- Received quantity is positive.
- Accepted + rejected equals received when inspection is completed.
- Accepted quantity has valid location and batch/serial data as required.
- Inventory `inTransitQty` / `onOrderQty` cannot become negative.
- Cost valuation and accounting mappings are available before posting.
- Receipt posting is idempotent.

Additional rules:

- A receipt can consume posted shipment quantity, or remaining unshipped quantity for explicit direct receipt; never consume both for the same units.
- `receivedBaseQty` cannot exceed outstanding in-transit quantity plus explicitly eligible direct-receipt quantity.
- Accepted plus rejected must reconcile with received once inspection is complete.
- Physical received quantity reduces inbound projections; accepted quantity alone increases sellable stock.
- A batch-tracked accepted line must have a valid batch; serial count must match accepted quantity when serial tracking is enabled.
- Receipt value must reconcile to stock valuation and journal amount.
- Only one posting event may create each stock movement / receipt journal, including retries.

## 12. Reversals, returns, and corrections

- Draft receipts may be edited/deleted according to draft policy.
- Posted receipts, Stock Movements, cost layers, and journal entries are immutable.
- A receipt reversal must reverse quantity projection, Stock Movement, valuation, and GRNI journal together with linked reversal records.
- If accepted goods have already been sold, consumed, transferred, or otherwise issued, a simple receipt reversal may be invalid. Use a Purchase Return / supplier return workflow instead of forcing negative stock or corrupting cost allocations.
- Rejected goods returned to the supplier should be represented as a traceable supplier return/disposition.
- A receipt reversal does not automatically reverse a related Vendor Bill or Vendor Payment. Those are separate documents and must be corrected through the AP module.

## 13. Reporting and reconciliation

Required reports/views:

1. Purchase Receipts by status/date/supplier/warehouse.
2. Receipts awaiting supplier bills.
3. Received, accepted, rejected, and quarantined quantities.
4. Receipt-to-PO matching and over/under receipt exceptions.
5. GRNI by receipt/supplier/age.
6. Receipt cost-layer and Stock Movement traceability.

Reconcile:

- PO line received/accepted/rejected counters against posted receipt lines.
- `inventory_items.inTransitQty` against posted shipments less physically received quantities.
- `inventory_items.onHandQty` against Stock Movement ledger and batch-child balances.
- Inventory Cost Layer received quantity/value against accepted receipt movement lines.
- GRNI balance against posted receipt accruals less matched Vendor Bill allocations and reversals (detailed bill-side reconciliation is in the AP spec).

## 14. Testing and acceptance criteria

1. Draft receipt does not change on-hand, on-order, in-transit, cost layers, or GL.
2. Posting a shipped receipt reduces in-transit by physically received quantity and increases on-hand by accepted quantity only.
3. Direct receipt reduces on-order, not in-transit.
4. Rejected quantity is fully dispositioned and never becomes available stock.
5. Partial receipts and multiple receipts per PO are supported.
6. Batch-tracked items create/resolve batches and update `inventory_item_batches` correctly.
7. Each accepted receipt movement line creates the correct inventory cost layer.
8. Inventory / GRNI journal balances and matches valuation.
9. Repeated post requests do not duplicate Stock Movements, cost layers, or journals.
10. Concurrent receipts cannot over-receive the same PO line.
11. Default bill checkbox is checked; unchecked creates no bill; checked creates one linked draft bill and redirects.
12. Failure to create the draft bill leaves the posted receipt intact and allows idempotent retry.
13. Receipt reversal is blocked or routed to Purchase Return when stock has already been consumed.

## 15. Implementation sequence

1. Confirm in-transit quantity migration from the PO spec.
2. Implement Purchase Receipt contracts, schema, generated numbering, and draft form.
3. Implement receipt eligibility and partial quantity matching against PO/shipment records.
4. Integrate Batch Service and Stock Movement Service.
5. Integrate inventory valuation / cost layers.
6. Integrate Inventory / GRNI journal posting.
7. Implement the default-checked Create Vendor Bill handoff to the AP module.
8. Implement reversals, supplier return constraints, reporting, and reconciliation tests.

## 16. Decisions to preserve

- A posted Purchase Receipt is the authoritative physical receiving event.
- `onHandQty` increases only by accepted quantity.
- Full physical received quantity leaves in-transit/on-order projections; rejected goods need explicit disposition.
- Use existing stock movement, batch, cost layer, and journal infrastructure.
- Receipt posting creates Inventory / GRNI; Vendor Bill posting later clears GRNI and creates AP.
- The default checkbox creates a linked **draft** Vendor Bill only; it does not auto-post or auto-pay.
- Supplier identity comes from the existing Party module, not a new Vendor table.
