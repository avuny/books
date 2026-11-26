# Stock Movement Module — Canonical Specification

> Location: `packages/contracts/src/stock-movement/SPEC.md`  
> Status: Canonical Source of Truth for Stock Movement domain, API contracts, and Frontend UI conventions.

---

## 1. Module Overview

### 1.1 Purpose and Responsibilities
The Stock Movement module is the immutable inventory ledger of an organization. It records every quantity-affecting inventory transaction as a posted **stock movement** containing one or more **lines**. Each line records the displacement of physical inventory between two locations, always tracked in the item's base unit of measure.

Key responsibilities:
- **Append-only ledger**: Movements are permanently recorded. Adjustments, receipts, transfers, and corrections produce new ledger entries or explicit reversals.
- **Transactional integrity**: Real-time balance updates (`inventory_items` and `inventory_item_batches`) occur atomically with movement posting.
- **Multi-unit display conversion**: Persisted quantities always reside in the base unit; UI layers convert values dynamically to the selected display unit without persisting converted numbers.
- **Stock card and historical audit**: Provides complete chronological traceability, calculating accurate running balances per item and location regardless of outer filters or pagination.

### 1.2 Supported Movement Types
The module enum `StockMovementType` defines the originating business causes:
- `opening`: Initial inventory setup when onboarding or adopting an item. (Currently supported in UI)
- `adjustment`: Inventory count corrections, damages, write-offs, or stock discoveries. (Currently supported in UI)
- `purchase`: Goods received from suppliers. (Future)
- `purchase_return`: Goods returned to suppliers. (Future)
- `sale`: Goods delivered to customers. (Future)
- `sale_return`: Goods returned by customers. (Future)
- `transfer`: Stock relocated between internal locations or warehouses. (Future — reserves From/To columns)
- `assembly_consume`: Component consumption in bill-of-materials assembly. (Future)
- `assembly_produce`: Finished goods output in bill-of-materials assembly. (Future)

*Note: The current UI filters and displays support `opening` and `adjustment`. Future types must follow the centralized conventions in this document.*

### 1.3 Boundaries and Ownership
- **Stock Movement Module owns**: Ledger headers (`stock_movements`), line items (`stock_movement_lines`), inventory snapshots (`inventory_items`, `inventory_item_batches`), ledger queries, and running balance calculation.
- **Warehouse & Location Modules own**: Warehouse hierarchies, physical vs. virtual classification, location postability intents (`receive`, `issue`, `adjust`, `move_in`, `move_out`).
- **Item & Unit Modules own**: Base unit definitions, unit collections, conversion factors (`conversionFactor = baseQty / enteredQty`), batch tracking, and item metadata.

---

## 2. Frontend Requirements & Conventions

### 2.1 Reusable Stock Movement Component Architecture
The Stock Movement UI must be implemented as a single, reusable feature-level component (`StockMovementList`) located under `apps/web/src/features/stock-movement-module`.

It operates in two distinct contexts:

#### Context A: General Stock Movements Page (`/organization/$orgId/stock-movements`)
1. **Scope**: Displays stock movements across all items in the organization.
2. **Item Column**: Visible, displaying the item name and code/symbol.
3. **Filtering**:
   - Item filter: Allows selecting items to filter by.
   - Warehouse and Location filter: Multi-select reusing `WarehouseLocationFilter` (strictly physical warehouses and locations).
   - Movement Type filter: Select between "All", "Opening Stock", and "Inventory Adjustment".
   - Date range filter: Filter movements by `from` and `to` timestamps.
4. **Unit Selector**: Hidden when multiple items are displayed. When filtered down to a single item, the Display Unit Selector appears and enables unit conversion for that item.
5. **Quantity & Running Balance Presentation**: When multiple items are shown, each row displays its value alongside that item's base unit symbol (e.g. `100 pcs`, `10 kg`).

#### Context B: Item Details Page (`/organization/$orgId/items/$itemId` — Movements Tab)
1. **Scope**: Scoped strictly to the specific item via fixed prop `fixedItemId={itemId}`.
2. **Item Column**: Hidden (redundant because the user is already on that item's details view).
3. **Fixed Scope**: The item filter is completely hidden and cannot be changed by the user.
4. **Filtering**:
   - Warehouse and Location filter: Scoped to physical warehouses and locations.
   - Movement Type filter: Filter by "Opening Stock" or "Inventory Adjustment".
   - Date range filter: Filter movements by `from` and `to` timestamps.
5. **Unit Selector**: Always visible above the table. Defaults to the item's base unit. Options include the base unit and all alternate units configured in the item's unit collection.
6. **Quantity & Running Balance Presentation**: All rows reflect the chosen display unit consistently with the unit symbol appended.

### 2.2 Table Layout & Column Structure
The table must strictly follow the canonical column ordering:

#### General Stock Movements Page Columns:
| # | Column | Key | Alignment | Description |
|---|---|---|---|---|
| 1 | Reference | `sourceRef` / `reference` | Start | Identifier of the originating transaction/document (e.g. `OS-001`, `ADJ-001`). Always first. |
| 2 | Date | `postedAt` | Start | Localized date and time of movement. |
| 3 | Item | `itemName` | Start | Affected item name. Visible only in general view. |
| 4 | Movement Type | `type` | Start | Badge showing "Opening Stock" or "Inventory Adjustment". |
| 5 | Warehouse - Location | `warehouseLocation` | Start | Combined physical warehouse and location label (e.g. `Main WH - A-01`). |
| 6 | Direction | `direction` | Start | Badge: `IN` (emerald) or `OUT` (rose), representing physical stock impact. |
| 7 | Quantity | `quantity` | End | Movement quantity in display unit with unit symbol (e.g. `100 pcs`). |
| 8 | Running Balance | `runningBalance` | End | Remaining balance immediately after applying the movement, in display unit with unit symbol. Always last. |

#### Item Details Page Columns:
| # | Column | Key | Alignment | Description |
|---|---|---|---|---|
| 1 | Reference | `sourceRef` / `reference` | Start | Identifier of the originating transaction or document. |
| 2 | Date | `postedAt` | Start | Localized date and time of movement. |
| 3 | Movement Type | `type` | Start | Badge: "Opening Stock" or "Inventory Adjustment". |
| 4 | Warehouse - Location | `warehouseLocation` | Start | Combined physical warehouse and location label. |
| 5 | Direction | `direction` | Start | Badge: `IN` or `OUT`. |
| 6 | Quantity | `quantity` | End | Movement quantity in display unit with unit symbol. |
| 7 | Running Balance | `runningBalance` | End | Remaining balance immediately after movement. Always last. |

*Restriction: Never render From / To columns in the current implementation. From / To columns are reserved exclusively for future multi-warehouse Inventory Transfers.*

### 2.3 Display Unit Selector Behavior
1. **Trigger Condition**:
   - Rendered above the table whenever the view is scoped to a single item (`fixedItemId` provided, or general table filtered to a single item).
   - Hidden when movements belong to multiple distinct items.
2. **Options Population**:
   - The base unit of the item (marked as base, e.g. `Pieces (pcs)`).
   - All alternate units belonging to the item's unit collection (e.g. `Box (box)`, `Carton (ctn)`).
3. **Reactive Presentation**:
   - Selecting an alternate unit re-renders all rows immediately in the client without page reload or backend mutation.
   - Conversion formula:
     $$\text{Display Quantity} = \frac{\text{Base Quantity}}{\text{Conversion Factor}}$$
     $$\text{Display Running Balance} = \frac{\text{Base Running Balance}}{\text{Conversion Factor}}$$
   - Precision: Trims insignificant trailing fractional zeroes while preserving precision up to 6 decimal places. No intermediate rounding.

### 2.4 Virtual Warehouse Display Rules
Virtual warehouses (e.g. System, Adjustment, Transit, Supplier, Customer) are internal ledger mechanisms:
1. **Zero Exposure**: Virtual warehouse names (e.g. "Virtual Warehouse", "Adjustment") and internal location codes/names must never appear in the UI.
2. **Single Physical Presentation**: For transactions with a virtual counterparty (such as Opening Stock and Inventory Adjustments):
   - The physical warehouse and physical location are extracted and displayed in the **Warehouse - Location** column.
   - The virtual side is completely suppressed.
3. **Direction Invariant**:
   - Movement to physical location $\rightarrow$ `IN`.
   - Movement from physical location $\rightarrow$ `OUT`.
4. **Filter Sanitization**: `WarehouseLocationFilter` must operate with `physicalOnly: true`, excluding all system and virtual warehouses from selection.

---

## 3. Business Rules and Domain Behavior

### 3.1 Ledger Immutability & Reversals
1. Movements are strictly append-only.
2. An existing movement can only be modified through a full reversal (`isReversal = true`), which swaps the source and target locations and posts the opposite stock change.

### 3.2 Running Balance Calculation
1. **Post-Movement Balance**: Running balance represents the on-hand quantity in the location **after** the movement line has applied ($Balance_{after} = Balance_{before} \pm Quantity$).
2. **Location Scoping**: The balance is tracked per `(item_id, physical_location_id)` pair. Unrelated warehouses/locations never combine into a single running total.
3. **Chronological Invariant**: Balances must reflect the real-time chronological timeline (`posted_at ASC, movement_id ASC, line_no ASC`), regardless of UI sorting (e.g. newest first `posted_at DESC`) or pagination.
4. **Filter Invariance**: Filtering by date range (`from`, `to`), movement type, or page size must not alter historical running balances.

### 3.3 Unit Storage Integrity
1. All database entries (`stock_movement_lines.quantity`, `inventory_items.on_hand_qty`) are positive numeric strings in the item's **base unit**.
2. Conversion occurs strictly at presentation time for reads, or prior to ledger posting for writes.

---

## 4. API Contract & Endpoint Documentation

### 4.1 Endpoint: `listStockMovements`
- **Requirement ID**: `STOCK-MOVEMENTS-LIST`
- **Method & Path**: `GET /organizations/{orgId}/stock-movements`
- **Permission**: `read:stock-movement`
- **Query Parameters (`StockMovementLineHistoryQuery`)**:
  - `page`: Integer (min 1, default 1)
  - `pageSize`: Integer (min 1, max 100, default 20)
  - `itemId`: UUID (optional, scopes listing to one item)
  - `batchId`: UUID (optional)
  - `warehouseId`: UUID (optional, physical warehouse filter)
  - `locationId`: UUID (optional, physical location filter)
  - `type`: Enum (`opening`, `adjustment`, etc.)
  - `from`: ISO 8601 Datetime string (optional)
  - `to`: ISO 8601 Datetime string (optional)

- **Response Body (`StockMovementLineHistoryResponse`)**:
```json
{
  "items": [
    {
      "lineId": "uuid",
      "movementId": "uuid",
      "lineNo": 1,
      "type": "opening",
      "postedAt": "2026-11-22T10:00:00.000Z",
      "sourceType": "item_opening_stock",
      "sourceId": "uuid",
      "sourceRef": "OS-001",
      "isReversal": false,
      "itemId": "uuid",
      "itemName": "Item A",
      "baseUnitSymbol": "pcs",
      "batchId": null,
      "fromLocationId": "uuid-virtual",
      "fromLocationName": null,
      "fromWarehouseName": null,
      "fromWarehouseType": "virtual",
      "toLocationId": "uuid-physical",
      "toLocationCode": "A-01",
      "toLocationName": "Shelf A-01",
      "toWarehouseId": "uuid-wh",
      "toWarehouseName": "Main WH",
      "toWarehouseType": "physical",
      "physicalWarehouseId": "uuid-wh",
      "physicalWarehouseName": "Main WH",
      "physicalLocationId": "uuid-physical",
      "physicalLocationCode": "A-01",
      "physicalLocationName": "Shelf A-01",
      "direction": "IN",
      "quantity": "100.000000",
      "runningBalance": "100.000000"
    }
  ],
  "page": 1,
  "pageSize": 20,
  "total": 1
}
```

---

## 5. Frontend Screen-to-API Mapping

| Feature / Screen | Component | Operation ID | Endpoint | Description |
|---|---|---|---|---|
| General Stock Movements | `StockMovementList` | `listStockMovements` | `GET /organizations/{orgId}/stock-movements` | Paginated movements across all items with full filtering |
| Item Stock Movements Tab | `ItemStockMovementsTab` | `listStockMovements` | `GET /organizations/{orgId}/stock-movements?itemId={itemId}` | Reuses `StockMovementList` with fixed item scope |
| Item Unit Details | `DisplayUnitSelector` | `getItem` & `getUnitCollection` | `GET /organizations/{orgId}/items/{itemId}` | Loads item base unit and related collection units |
| Warehouse & Location Filters | `WarehouseLocationFilter` | `listWarehouses` & `listWarehouseLocations` | `GET /organizations/{orgId}/warehouses` | Scoped to physical warehouses and locations |

---

## 6. Centralized Conventions for Future Stock-Affecting Modules

Any future module affecting inventory (e.g., Inventory Transfer, Purchase Receipts, Sales Shipments, Assembly) must adhere to these mandatory conventions:

1. **Transaction Classification**:
   - Define distinct `StockMovementType` in contracts constants.
   - Designate whether transaction moves stock `IN`, `OUT`, or `TRANSFER`.
2. **Counterparty Determination**:
   - Supplier/Customer/Production/Adjustment transactions must route through system virtual locations.
   - Internal Transfers use real physical locations for both source and destination (or intermediate transit warehouse).
3. **Display Rules**:
   - Transactions with a virtual side display only the physical warehouse/location and direction `IN`/`OUT`.
   - Inventory Transfers display both source and destination once transfer support is formally enabled.
4. **Base Unit Storage**:
   - The posting module must convert all transaction quantities to the item's base unit before calling `stockMovementService.postMovement`.
5. **Ledger Integration**:
   - All transactions must appear in the reusable `StockMovementList` component without custom table forks.

---

## 7. Acceptance Criteria

- [x] Canonical `SPEC.md` created in `packages/contracts/src/stock-movement/SPEC.md`.
- [x] Reusable `StockMovementList` component created supporting both General and Item Details contexts.
- [x] Item column rendered only in General context.
- [x] Fixed item scoping prevents changing item filter on Item Details page.
- [x] Movement Type filter restricts to "Opening Stock" and "Inventory Adjustment".
- [x] Warehouse/Location filter shows only physical warehouses and locations.
- [x] Display Unit selector enabled when scoped to one item; converts quantities and running balances reactively.
- [x] Running balance calculated post-movement, partitioned per item and physical location, invariant to filters/pagination.
- [x] Virtual warehouses hidden completely.
- [x] RTL and English/Arabic localization parity.
