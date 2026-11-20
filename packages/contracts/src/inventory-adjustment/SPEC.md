# Inventory Adjustment — Functional & Technical Specification

## 1. Purpose

Inventory Adjustment allows an organization to reconcile recorded inventory quantities with actual physical stock.

Supported reasons include count shortages, count surpluses, damage, theft, expiry, found stock, and other authorized corrections.

The adjustment is a business document that explains why stock changed. Stock Movement records the physical quantity change, Inventory Costing determines its financial value, and Accounting records the financial impact.

## 2. Core design decisions

1. The adjustment is the source business document, not an inventory ledger.
2. One physical warehouse is selected at the document-header level.
3. Every line must identify a specific stockable warehouse location.
4. Lines reference `itemId`, `locationId`, `unitId`, and optionally `batchId`.
5. Users can enter quantities using any unit configured for the selected item.
6. The Item module converts entered quantities into the item's base unit.
7. All inventory ledger and balance quantities are stored in base units.
8. One Stock Movement is generated per confirmed adjustment, supporting both inbound and outbound lines.
9. Inventory Costing and Accounting participate in the same posting transaction.
10. Drafts do not affect inventory or accounting.
11. Confirmed adjustments are immutable.
12. Shared contracts belong in the contracts package and are consumed by both frontend and backend.

## 3. Document lifecycle and approval

Approval is excluded from V1.

V1 statuses:

- `DRAFT`
- `CONFIRMED`
- `CANCELLED`

The form provides two primary actions:

**Save as Draft**
- Saves the document and its lines.
- Does not affect stock or accounting.
- Remains editable and can be cancelled.

**Save as Confirmed**
- Validates and posts the adjustment.
- Updates inventory through Stock Movement.
- Posts the resulting accounting entry.
- Makes the document immutable.

`CONFIRMED` means successfully posted, not merely approved.

### Future approval functionality

Approval will be introduced later through Settings and Features.

Suggested setting:

`inventoryAdjustment.requireApproval`

Default value:

`false`

When the setting is introduced, approval must remain optional. Organizations that do not enable it continue using the normal Draft → Confirmed workflow.

When enabled, the future workflow may become:

`DRAFT → PENDING_APPROVAL → APPROVED → CONFIRMED`

Do not implement approval-related fields, statuses, or infrastructure in V1.

---

## 4. Data model

### A. `inventory_adjustments`

One record represents the adjustment document.

| Field | Description |
|---|---|
| `id` | Primary key |
| `orgId` | Organization |
| `number` | System-generated document number |
| `referenceNumber` | Optional external reference |
| `date` | Adjustment date |
| `warehouseId` | Selected physical warehouse |
| `reasonId` | Selected adjustment reason |
| `description` | Optional description |
| `status` | DRAFT / CONFIRMED / CANCELLED |
| `createdBy` | Creator |
| `confirmedBy` | Nullable confirmer |
| `confirmedAt` | Nullable confirmation timestamp |
| `stockMovementId` | Generated movement reference |
| `journalEntryId` | Generated journal entry reference |
| `createdAt` / `updatedAt` | Timestamps |

### B. `inventory_adjustment_lines`

Each line represents one specific inventory stock dimension.

| Field | Description |
|---|---|
| `id` | Primary key |
| `orgId` | Organization |
| `adjustmentId` | Parent adjustment |
| `lineNo` | Line sequence |
| `itemId` | Catalog item reference |
| `locationId` | Required stockable warehouse location |
| `unitId` | Selected item unit of measure |
| `batchId` | Required for batch-tracked items; otherwise null |
| `countedQuantity` | User-entered physical quantity in the selected unit |
| `baseUnitId` | Item's base unit at the time of the transaction |
| `systemQuantityBase` | Recorded system quantity snapshot in base units |
| `countedQuantityBase` | Backend-converted physical quantity in base units |
| `quantityDeltaBase` | Calculated difference in base units |
| `snapshotToken` | Stock snapshot/version information |
| `notes` | Optional line notes |

The backend calculates the base-unit quantities and difference.

Formula:

`quantityDeltaBase = countedQuantityBase - systemQuantityBase`

The original `countedQuantity` and `unitId` are retained for document display and audit purposes. The normalized quantities are used for stock posting.

Where item-unit conversion settings can change, preserve the conversion factor/version used for the confirmed transaction, or ensure used conversion definitions cannot be modified in a way that changes historical meaning.

### C. `inventory_adjustment_reasons`

Reasons are stored in a database lookup table rather than implemented only as a hardcoded enum.

Suggested fields:

- `id`
- `code`
- `name`
- `direction` — INCREASE, DECREASE, BOTH
- `isSystem`
- `isActive`
- `sortOrder`
- timestamps

Initial reason catalog:

| Code | Direction |
|---|---|
| `COUNT_SHORTAGE` | DECREASE |
| `COUNT_SURPLUS` | INCREASE |
| `DAMAGE` | DECREASE |
| `THEFT` | DECREASE |
| `EXPIRED` | DECREASE |
| `FOUND_STOCK` | INCREASE |
| `OTHER` | BOTH |

The contracts package exports stable reason codes, while the database provides the selectable records and display information.

The backend validates that all line differences are compatible with the selected reason. Reasons are selected once per document; different reasons require separate adjustments in V1.

---

## 5. Warehouse, location, and inventory relationships

This follows the existing `warehouses`, `warehouseLocations`, `inventoryItems`, and `inventoryItemBatches` architecture.

### Warehouse

`warehouseId` belongs to the adjustment header.

Only physical warehouses belonging to the current organization are selectable. Virtual warehouses, including `TRANSIT`, are excluded.

### Location

Every adjustment line requires `locationId`.

The backend validates that the location:

- Belongs to the selected warehouse and organization.
- Is stockable (`isStockable = true`).
- Is active and not blocked.
- Satisfies the existing stockable-leaf and movement-intent rules.

### Inventory quantity retrieval

For non-batch-tracked items, retrieve the stock balance using:

`orgId + itemId + locationId`

Source: `inventoryItems.onHandQty`.

For batch-tracked items, retrieve:

`orgId + itemId + locationId + batchId`

Source: `inventoryItemBatches.onHandQty` through the associated `inventoryItems` record.

A missing balance record means zero quantity. An `inventoryItems` record is not required to exist before an adjustment can create stock.

For batch-tracked items, preserve the existing aggregation invariant:

`inventoryItems.onHandQty = SUM(inventoryItemBatches.onHandQty)`

Reserved quantities must follow the corresponding existing invariant.

---

## 6. Unit selection and base-unit conversion

This is a general inventory architecture rule for Avuny, not just an adjustment-specific implementation.

### A. Frontend unit selection

Every adjustment line must have a required unit select input.

When an item is selected, the options must come from that item's existing unit collection and include:

- The item's base unit.
- All alternate units configured for that item.

Do not display unrelated global units that are not associated with the selected item.

The base unit should be selected by default, but the user can choose another valid associated unit.

Example:

An item has:

| Unit | Conversion |
|---|---:|
| Piece (base) | 1 piece |
| Box | 12 pieces |
| Carton | 144 pieces |

The user can enter the physical count using pieces, boxes, or cartons.

The selected unit applies to the counted quantity on that particular line.

### B. Item module conversion service

The Item module must provide a reusable service for converting an item's selected unit quantity into its base unit.

Suggested service capability:

`convertQuantityToBaseUnit`

Input:

- `itemId`
- `unitId`
- `quantity`

Output:

- `baseUnitId`
- `baseQuantity`
- Conversion metadata needed for validation or historical traceability.

The service must:

1. Verify that the unit belongs to the selected item's configured unit collection.
2. Retrieve the item's base unit and applicable conversion factor.
3. Perform the conversion using decimal-safe arithmetic.
4. Validate the resulting quantity against base-unit precision.
5. Return a typed validation error for incompatible units or invalid precision.

The Item module should also provide the reverse conversion capability for displaying existing base-unit stock in another configured unit.

Do not duplicate conversion calculations in the Inventory Adjustment, Stock Movement, Batch, or Accounting modules.

### C. Quantity conversion example

Suppose:

- Base unit: Piece.
- Selected unit: Box.
- Conversion: 1 Box = 12 Pieces.
- System stock: 120 Pieces.
- Physical counted quantity: 8 Boxes.

Conversion:

`8 Boxes × 12 = 96 Pieces`

Normalized difference:

`96 - 120 = -24 Pieces`

The adjustment therefore posts an outbound movement of 24 pieces, even though the user entered 8 boxes.

### D. Quantity storage rules

**All inventory quantities must use the item's base unit internally.**

This applies to:

| Table/module | Stored quantity |
|---|---|
| `stock_movement_lines.quantity` | Base unit |
| `inventory_items.onHandQty` | Base unit |
| `inventory_items.reservedQty` | Base unit |
| `inventory_item_batches.onHandQty` | Base unit |
| `inventory_item_batches.reservedQty` | Base unit |
| `inventory_cost_layers.receivedQty` | Base unit |
| `inventory_cost_layers.remainingQty` | Base unit |
| `inventory_cost_allocations.allocatedQty` | Base unit |
| Inventory Adjustment normalized quantity fields | Base unit |

The adjustment document additionally preserves the user's original entered quantity and selected unit for audit and display.

The `batches` master itself does not own stock quantities; batch quantities remain in `inventoryItemBatches`.

### E. Stock Movement contract

Stock Movement must receive quantities already converted into the item's base unit.

It should not independently implement unit conversion.

This establishes a clear responsibility:

- Item module: unit validation and conversion.
- Business document services: collect the user's chosen unit and quantity, then request conversion.
- Stock Movement: post only normalized base-unit quantities.
- Inventory projections and costing: maintain base-unit quantities.

Other inventory workflows, including opening stock, receipts, issues, transfers, and adjustments, must follow the same rule whenever their input allows alternate units.

---

## 7. Batch and serial tracking

### Batch-controlled items

When the selected item requires batch tracking:

- `batchId` is mandatory.
- Each adjustment line represents one batch at one location.
- System quantity is retrieved for that batch/location dimension.
- Batch metadata is managed through the Batch module.
- Batch stock quantities are stored in base units in `inventoryItemBatches`.

For positive adjustments, select an existing batch or create a genuinely new batch through the Batch Service, following the existing `ensureBatches` pattern.

For negative adjustments, identify the actual batch from which physical stock is missing.

The adjustment service must never update batch quantities directly.

### Serial-controlled items

Serial-controlled items must identify the actual serial numbers being added or removed. Their quantities remain represented in the item's base unit, with each serialized unit following the serial-tracking rules.

---

## 8. Stock Movement integration

One confirmed adjustment generates exactly one Stock Movement containing all non-zero adjustment lines, including positive and negative differences.

The movement references:

- `sourceType`: `INVENTORY_ADJUSTMENT`
- `sourceId`: adjustment ID
- `sourceRef`: adjustment number

The adjustment stores the generated `stockMovementId`.

Use the existing movement system-location and movement-intent rules. Do not use `TRANSIT` to represent stock gains or losses.

### Positive adjustment

For an increase of 24 base units:

```ts
{
    itemId,
    batchId,
    fromLocationId: adjustmentSystemLocationId,
    toLocationId: locationId,
    quantity: "24",
}
```

### Negative adjustment

For a decrease of 24 base units:

```ts
{
    itemId,
    batchId,
    fromLocationId: locationId,
    toLocationId: adjustmentSystemLocationId,
    quantity: "24",
}
```

Movement quantities are always positive. Direction is represented by the source and destination locations.

The adjustment requires a movement type that supports mixed-direction lines. If the existing movement type validation prevents this, extend the movement contract/service with an adjustment-specific movement type rather than creating two movements with the same source document.

Zero-difference lines do not generate movement lines. A document with no non-zero differences cannot be confirmed as a stock adjustment in V1.

The Stock Movement Service alone updates or creates:

- `inventoryItems`
- `inventoryItemBatches`

All resulting quantities remain in base units.

---

## 9. Inventory Costing and Accounting

### A. Inventory Costing

The adjustment orchestrates the existing Inventory Costing Service.

**Positive adjustments:**

1. Stock Movement creates an inbound movement line using base-unit quantity.
2. Inventory balance projections are created or updated.
3. Resolve the resulting `inventoryItemId`.
4. Resolve `inventoryItemBatchId` when applicable.
5. Create an inventory cost layer referencing the inbound movement line.

**Negative adjustments:**

1. Stock Movement creates an outbound movement line using base-unit quantity.
2. Inventory Costing consumes the applicable cost layers.
3. Create the relevant `inventoryCostAllocations`.
4. Reduce inventory value by the actual allocated cost.

All cost-layer and allocation quantities are base-unit quantities.

Use the existing costing policy, including FIFO where configured. Do not duplicate costing logic in Adjustment.

For positive adjustments, obtain a defensible inventory cost through the valuation service or an explicitly supported cost input. If cost cannot be determined, confirmation must fail rather than silently use selling price or an arbitrary zero cost.

### B. Accounting

For V1, use the default Inventory Adjustment account, normally classified under Cost of Goods Sold.

**Stock decrease:**

| Account | Debit | Credit |
|---|---:|---:|
| Inventory Adjustment | 250 | |
| Inventory Asset | | 250 |

**Stock increase:**

| Account | Debit | Credit |
|---|---:|---:|
| Inventory Asset | 500 | |
| Inventory Adjustment | | 500 |

Generate one balanced Journal Entry per adjustment, grouping the relevant positive and negative valuation amounts into the appropriate debit and credit lines.

Accounting inputs must use calculated inventory values, not frontend-calculated amounts.

The Journal Entry must use:

- Source type: `INVENTORY_ADJUSTMENT`
- Source ID: adjustment ID
- Source reference: adjustment number
- Adjustment date.
- Organization currency.
- POSTED status.

Save `journalEntryId` on the adjustment.

The Accounting Service validates account mappings, currency, accounting periods, balancing, and idempotency.

Reason-specific accounts and configurable account mappings are deferred to future Settings functionality.

### C. Out of scope

V1 quantity adjustments do not cover landed costs, purchase-price revaluation, value-only inventory adjustments, opening inventory balances, prior-period corrections, supplier claims, or transactions that should be corrected through their original sales, purchase, or transfer documents.

---

## 10. Confirmation workflow and transaction integrity

### Save as Draft

The backend:

1. Validates the header and lines.
2. Validates organization, warehouse, location, item, selected unit, and batch.
3. Converts entered quantities to base units through the Item module.
4. Retrieves and stores authoritative base-unit stock snapshots.
5. Saves the draft.

No Stock Movement or Journal Entry is generated.

### Save as Confirmed

Execute all operations inside one database transaction:

1. Validate document ownership and status.
2. Lock affected stock dimensions in deterministic order.
3. Revalidate snapshot tokens and current base-unit quantities.
4. Validate warehouse, location, item, unit, batch, serial, reservation, and stock policies.
5. Recalculate normalized quantities through the Item module.
6. Calculate base-unit differences.
7. Generate one mixed-direction Stock Movement.
8. Let Stock Movement update inventory and batch balance projections.
9. Let Inventory Costing create incoming cost layers and outgoing allocations.
10. Generate and post the Accounting Journal Entry.
11. Mark the adjustment `CONFIRMED`.
12. Save confirmation metadata and generated transaction references.

Any failure must roll back all database changes.

Confirmation must be idempotent and must not generate duplicate movements, cost layers, cost allocations, or journal entries.

### Stale-count protection

Each line stores a server-generated stock snapshot/version.

If relevant stock movements affect the same item/location/batch dimension after the snapshot is captured, confirmation must be rejected.

The user must refresh the system quantity, review it, and confirm the physical count again.

Changing the selected item, location, batch, or unit must invalidate dependent snapshots and trigger the appropriate refresh.

### Reservations

An adjustment must not silently invalidate active reservations. Reject confirmation when the physical quantity correction would violate reservation constraints.

---

## 11. Frontend specification

Follow the existing conventions in `apps/web/AGENTS.md`.

### A. Navigation and list

Place Inventory Adjustment under the Inventory sidebar group.

The list page follows the established document-list conventions and displays:

| Column | Description |
|---|---|
| Number | Generated adjustment number |
| Date | Adjustment date |
| Reference | Optional reference |
| Warehouse | Physical warehouse |
| Reason | Adjustment reason |
| Items | Number of lines |
| Status | Draft / Confirmed / Cancelled |
| Created By | Creator |
| Created At | Creation timestamp |

Support filters for document number, reference, date, warehouse, reason, and status.

Provide a **Create New Inventory Adjustment** action.

Drafts can be edited or cancelled. Confirmed and cancelled documents are read-only.

### B. Create/edit form

The form contains a document header and repeatable inventory lines.

**Header fields**

| Field | Behavior |
|---|---|
| Document Number | Backend-generated, read-only |
| Reference Number | Optional input |
| Date | Required; defaults to current business date |
| Reason | Required select loaded from backend |
| Warehouse | Required physical warehouse select |
| Description | Optional multiline input |

**Line fields**

| Field | Behavior |
|---|---|
| Item | AsyncComboBox; existing items only, no Create New |
| Location | Required selector containing stockable locations in selected warehouse |
| Unit | Required select containing the item's base and configured alternate units |
| Batch | Required only for batch-tracked items |
| System Quantity | Read-only, displayed in the selected unit |
| Counted Quantity | Required numeric input in the selected unit |
| Difference | Read-only, displayed in the selected unit |
| Base Quantity | Optional supporting display of normalized quantity/difference |
| Notes | Optional |

The base unit is selected by default.

When an item is selected, load its configured units and tracking requirements.

When the user selects a location and unit, retrieve the system stock snapshot from the backend and display the system quantity converted into the selected unit.

The user enters the counted quantity using that same unit, so the system quantity and counted quantity can be compared consistently.

The frontend can calculate a provisional difference by subtracting the two displayed quantities, but the backend remains authoritative for conversions, base-unit differences, validation, and posting.

After conversion, the backend response should also provide the normalized base-unit difference.

Changing the item, location, batch, or unit must refresh dependent data and invalidate stale snapshots.

Prevent duplicate lines for identical item/location/batch stock dimensions.

### C. Form actions

**Save as Draft**
- Saves without inventory or accounting impact.
- Remains editable.

**Save as Confirmed**
- Performs complete validation and atomic posting.
- Updates inventory through Stock Movement.
- Updates valuation and accounting.
- Makes the document read-only.

Disable repeated submissions and display backend validation errors.

### D. Detail page

Display the document header, lines, selected input units, entered counted quantities, normalized base quantities, and differences.

After confirmation, provide references to the generated Stock Movement and Journal Entry.

---

## 12. Contracts package

Create the shared module under:

`packages/contracts/src/modules/inventory-adjustment/`

Follow existing contracts conventions and the `@avuny/zod` wrapper.

### Shared definitions

Export:

- `INVENTORY_ADJUSTMENT_STATUSES`
- `INVENTORY_ADJUSTMENT_REASON_CODES`
- `INVENTORY_ADJUSTMENT_DIRECTIONS`
- `InventoryAdjustmentStatusSchema`
- `InventoryAdjustmentReasonSchema`
- `InventoryAdjustmentLineSchema`
- `InventoryAdjustmentSchema`
- `CreateInventoryAdjustmentSchema`
- `UpdateInventoryAdjustmentSchema`
- `ConfirmInventoryAdjustmentSchema`
- `InventoryAdjustmentListQuerySchema`
- `InventoryAdjustmentListResponseSchema`
- `InventoryAdjustmentDetailResponseSchema`
- Stock snapshot response schema.
- Corresponding inferred TypeScript types.

### Create/update request

Header:

- `referenceNumber?`
- `date`
- `warehouseId`
- `reasonId`
- `description?`
- `lines`

Each line:

- `itemId`
- `locationId`
- `unitId`
- `batchId?`
- `countedQuantity`
- `notes?`

`countedQuantity` is always expressed in the selected `unitId`.

The client must not submit authoritative base quantities, conversion factors, system quantities, differences, inventory balance IDs, or generated movement/journal references.

The backend retrieves the stock snapshot and uses the Item module conversion service to calculate the normalized quantities.

### Stock snapshot response

When the user selects an item, location, optional batch, and unit, provide:

- Item identity and display information.
- Base unit information.
- All units configured for the item.
- Tracking configuration.
- Relevant location and batch options.
- Current on-hand quantity in base units.
- Equivalent on-hand quantity in the selected unit.
- Snapshot token/version.

### Adjustment response

Return:

- Document identity and header fields.
- Warehouse and reason display information.
- Status and creator/confirmation metadata.
- Line item, location, batch, and selected unit.
- Entered counted quantity.
- Base unit.
- System quantity in base units.
- Normalized counted quantity.
- Normalized difference.
- Conversion information needed for historical display.
- Stock Movement reference.
- Journal Entry reference.

### Ownership rules

- Contracts own shared request/response schemas and enums.
- Backend routes validate through shared schemas.
- Backend services enforce business rules.
- Frontend forms consume shared request schemas and inferred types.
- Frontend pages consume shared response types.
- No duplicated DTOs or enums inside `apps/web` or `apps/server`.

The backend remains authoritative.

---

## 13. Backend module architecture

| Module | Responsibility |
|---|---|
| Inventory Adjustment | Document lifecycle and posting orchestration |
| Item | Item unit collection, base-unit definition, unit validation and quantity conversion |
| Warehouse | Physical warehouse and stockable location validation |
| Batches | Batch identity and metadata |
| Inventory Items | Current item/location balance projections |
| Stock Movement | Movement ledger and base-unit inventory updates |
| Inventory Costing | Base-unit cost layers and allocations |
| Accounting | Journal entry generation and posting |
| Reservations | Reservation validation |
| Activity Log | Document lifecycle and posting events |
| Contracts | Shared frontend/backend schemas and DTOs |

Follow Avuny's existing architecture:

- Repository factory with optional transaction support.
- Service closure factory returning `Result<T, Code>`.
- Typed validation and posting errors.
- Cross-module imports through public `index.ts` files.
- Shared database transaction for confirmation.

The Adjustment service coordinates Item, Stock Movement, Inventory Costing, and Accounting through their public service interfaces.

It must not independently modify inventory balances, batch quantities, movement records, cost layers, cost allocations, or journal entries.

---

## 14. V1 scope and deferred features

### V1

1. Adjustment header, lines, and reason lookup table.
2. Draft, confirmed, and cancelled statuses.
3. Warehouse selection at document level.
4. Required location per line.
5. Existing item selection.
6. Item-specific base and alternate unit selection.
7. Item module quantity conversion service.
8. Base-unit normalization for all stock operations.
9. Batch-aware quantity reconciliation.
10. Backend stock snapshots and stale-count protection.
11. One mixed-direction Stock Movement per adjustment.
12. Inventory and batch balance updates through Stock Movement.
13. Inventory Costing integration.
14. Automatic accounting journal entry.
15. Reservation and negative-stock validation.
16. Atomic confirmation and idempotency.
17. Frontend list, create, edit-draft, and detail pages.
18. Shared contracts package module.
19. Activity Log integration and Inventory sidebar navigation.

### Deferred

- Approval workflows and organization settings.
- Reason-specific accounting mappings.
- Advanced stocktaking and blind-count sessions.
- Multiple counters and movement roll-forward.
- Value-only inventory revaluation.
- Advanced reservation exception handling.
- Advanced reversal workflows.
- Advanced serial-number adjustment UI.

---

## 15. `apps/web/AGENTS.md` additions

Add these as reusable conventions for future business-document modules.

### Contracts-first development
- Define shared schemas and DTOs in the contracts package.
- Consume shared types in frontend and backend.
- Do not duplicate statuses, enums, or request/response interfaces.
- Load database-backed select options from API responses.

### Standard document pages
- Follow established list, filter, pagination, loading, error, and empty-state conventions.
- Use consistent Create New actions.
- Respect document status and permissions.

### Standard document forms
- Separate header fields from repeatable lines.
- Keep document-wide values at header level.
- Use AsyncComboBox to search existing entities.
- Do not offer entity creation inside selectors unless explicitly supported.
- Make generated and calculated fields read-only.
- Reuse shared form controls and validation.

### Document lifecycle
- Expose only backend-supported actions.
- Drafts are editable according to module rules.
- Confirmed documents are read-only.
- Do not expose approval controls unless approval is implemented and enabled.
- Distinguish saving a draft from confirming/posting.

### Inventory quantities and units
- Unit selectors must use the units configured for the selected item, including its base and alternate units.
- Default to the item's base unit.
- All user-entered alternate-unit quantities must be normalized by the Item module conversion service before stock posting.
- Never duplicate unit conversion rules in frontend modules.
- Display quantities with their associated units.
- Retrieve authoritative stock snapshots from the backend.
- Stock Movement and inventory balance operations must use base-unit quantities.
- Respect location, batch, and serial tracking.
- Display resulting Stock Movement and Accounting references when relevant.

Apply these conventions to future stock receipts, issues, transfers, and other inventory-related documents.

---

## 16. Final architecture

The intended flow is:

**Inventory Adjustment**
- Business document.
- User-entered quantity and selected unit.
- Warehouse, location, and batch identification.

↓

**Item Service**
- Validates the selected item unit.
- Converts the entered quantity into the item's base unit.

↓

**Stock Movement**
- Receives only base-unit quantities.
- Creates the inbound/outbound movement lines.

↓

**Inventory Projections**
- `inventoryItems`
- `inventoryItemBatches`

↓

**Inventory Costing**
- Base-unit cost layers and allocations.

↓

**Accounting**
- Balanced Journal Entry.

The critical distinction is:

**The document preserves how the user entered the quantity; the inventory system preserves quantities exclusively in the item's base unit.**

This rule should be consistent across all Avuny inventory modules.