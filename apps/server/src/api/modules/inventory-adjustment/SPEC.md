# Inventory Adjustment — Server Specification

Canonical functional and contracts specification:
[contracts/inventory-adjustment/SPEC.md](../../../../../../packages/contracts/src/inventory-adjustment/SPEC.md)

## 1. Implementation Overview

This backend module implements the Inventory Adjustment aggregate root and its owned line items under:
`apps/server/src/api/modules/inventory-adjustment/`

### Primary Responsibilities
- Manage the lifecycle of inventory adjustments (`DRAFT`, `CONFIRMED`, `CANCELLED`).
- Enforce business rules and validations across warehouses, stockable locations, catalog items, unit conversions, and batches.
- Compute base-unit converted quantities and difference deltas (`quantityDeltaBase = countedQuantityBase - systemQuantityBase`).
- Maintain optimistic concurrency and stale-count protection using snapshot tokens.
- Orchestrate atomic confirmation by generating mixed-direction stock movements (`type: "adjustment"`, `sourceType: "inventory_adjustment"`), inventory cost layers/allocations, and accounting journal entries.

### Relevant Internal Files
| File | Responsibility |
|---|---|
| `inventory-adjustment.repository.ts` | Drizzle ORM queries and transactional aggregate operations on `inventory_adjustments` and `inventory_adjustment_lines`. |
| `inventory-adjustment.service.ts` | Application use cases, validation, stale-count protection, transaction orchestration, and audit logging. |
| `inventory-adjustment.types.ts` | Port interfaces (`ItemConversionPort`, `WarehouseLocationPort`, `BatchPort`, `StockMovementPort`, etc.). |
| `inventory-adjustment.permissions.ts` | Typed permission constants (`create`, `read`, `update`, `delete`, `confirm`, `cancel`). |
| `inventory-adjustment.errors.ts` & `inventory-adjustment.error-map.ts` | Domain error HTTP status mapping and OpenAPI response integration. |
| `inventory-adjustment.mapper.ts` | Pure row-to-DTO conversion. |
| `deps.ts` | Singleton wiring connecting real services (`StockMovement`, `InventoryCosting`, `Accounting`, `WarehouseLocation`, `Role`, `ActivityLog`). |
| `hono-routes/` | OpenAPI REST route declarations and parameter validations. |

---

## 2. Endpoint Implementation

| Operation ID | Method & Path | Handler & Service Method | Permissions | Schemas |
|---|---|---|---|---|
| `createInventoryAdjustment` | `POST /organizations/{orgId}/inventory-adjustments` | `createInventoryAdjustmentRoute` → `service.create` | `create:inventory-adjustment` | `CreateInventoryAdjustmentSchema` → `InventoryAdjustmentDtoSchema` |
| `listInventoryAdjustments` | `GET /organizations/{orgId}/inventory-adjustments` | `listInventoryAdjustmentsRoute` → `service.list` | `read:inventory-adjustment` | `InventoryAdjustmentOffsetListQuerySchema` → `InventoryAdjustmentOffsetListResponseSchema` |
| `listInventoryAdjustmentOptions` | `GET /organizations/{orgId}/inventory-adjustments/options` | `inventoryAdjustmentOptionsRoute` → `service.listOptions` | `read:inventory-adjustment` | `OptionListQuerySchema` → `OptionListResponseSchema` |
| `getInventoryAdjustment` | `GET /organizations/{orgId}/inventory-adjustments/{id}` | `getInventoryAdjustmentRoute` → `service.get` | `read:inventory-adjustment` | `InventoryAdjustmentDtoSchema` |
| `updateInventoryAdjustment` | `PATCH /organizations/{orgId}/inventory-adjustments/{id}` | `updateInventoryAdjustmentRoute` → `service.update` | `update:inventory-adjustment` | `UpdateInventoryAdjustmentSchema` → `InventoryAdjustmentDtoSchema` |
| `deleteInventoryAdjustment` | `DELETE /organizations/{orgId}/inventory-adjustments/{id}` | `deleteInventoryAdjustmentRoute` → `service.delete` | `delete:inventory-adjustment` | `{ id: uuid }` |
| `confirmInventoryAdjustment` | `POST /organizations/{orgId}/inventory-adjustments/{id}/confirm` | `confirmInventoryAdjustmentRoute` → `service.confirm` | `confirm:inventory-adjustment` | `InventoryAdjustmentDtoSchema` |
| `cancelInventoryAdjustment` | `POST /organizations/{orgId}/inventory-adjustments/{id}/cancel` | `cancelInventoryAdjustmentRoute` → `service.cancel` | `cancel:inventory-adjustment` | `InventoryAdjustmentDtoSchema` |
| `getInventoryAdjustmentSnapshot` | `GET /organizations/{orgId}/inventory-adjustments/snapshot` | `getStockSnapshotRoute` → `service.getSnapshot` | `read:inventory-adjustment` | `StockSnapshotQuerySchema` → `StockSnapshotDtoSchema` |
| `listInventoryAdjustmentReasons` | `GET /organizations/{orgId}/inventory-adjustments/reasons` | `listInventoryAdjustmentReasonsRoute` → `service.listReasons` | `read:inventory-adjustment` | `InventoryAdjustmentReasonListResponseSchema` |

---

## 3. Service and Business Logic

### Confirmation Transaction Boundary
All posting operations occur inside a single PostgreSQL database transaction:
1. `findAggregate` with `forUpdate: true` to prevent concurrent edits or double-posting.
2. Stale count validation: verifies that current `onHandQty` matches the line's recorded `systemQuantityBase`.
3. Validates that differences match the reason direction:
   - `INCREASE` requires delta `> 0` (or `0`).
   - `DECREASE` requires delta `< 0` (or `0`).
   - `BOTH` permits mixed differences.
4. Generates a mixed-direction `StockMovement` through `StockMovementService.post`:
   - Gained quantities post with `toLocationId: locationId`.
   - Lost quantities post with `fromLocationId: locationId`.
5. Orchestrates `AccountingService.postBusinessEvent` with `event: "inventory_adjustment"` to generate the balanced Journal Entry.
6. Marks the adjustment `CONFIRMED`, linking `stockMovementId` and `journalEntryId`.
7. Emits an audit event upon transaction commit.

---

## 4. Database Responsibilities

Tables owned by the inventory domain in `@avuny/db`:
- `inventory_adjustments`: Document header storing status, document number (`ADJ-000001`), warehouse, reason, confirmation timestamps, and movement/journal references.
- `inventory_adjustment_lines`: Item/location/batch dimensions, original entered counts, base unit counts, snapshot tokens, and differences.
- `inventory_adjustment_reasons`: System and tenant adjustment reasons.

Constraints enforced in SQL:
- Composite foreign keys scoped to `org_id` ensuring cross-tenant isolation.
- Unique index `ux_inventory_adjustment_org_number` on `(org_id, number)`.
- Unique constraint `ux_inventory_adjustment_line_no` on `(adjustment_id, line_no)`.
- Format checks on document numbers (`^ADJ-[0-9]{6,}$`) and text lengths.

---

## 5. Acceptance Criteria

- All 6 mandatory service methods and domain endpoints implemented and typed via `@avuny/contracts`.
- Atomic multi-module confirmation coordinating Stock Movement, Costing, and Accounting inside one transaction.
- 100% passing unit tests in `inventory-adjustment.service.spec.ts`.
- Typecheck, intl generation, and route generation clean.
