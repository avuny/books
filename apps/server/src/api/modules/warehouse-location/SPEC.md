# Warehouse location module

The storage tree of a warehouse in one self-referencing table: zone, area, dock, aisle, rack, bay, level,
shelf, bin, virtual bin. It manages structure, purpose and status only; stock balances live elsewhere and point
at stockable leaf locations.

## Routes (under `/organizations/{orgId}`)
| Method | Path | Service | Permission |
|---|---|---|---|
| POST | /warehouses/{warehouseId}/locations | create | create:warehouse-location |
| POST | /warehouses/{warehouseId}/locations/bulk | bulkCreate (dryRun) | create:warehouse-location |
| GET | /warehouses/{warehouseId}/location-tree | tree (flat, lazy via parentId/depth) | read:warehouse-location |
| GET | /warehouses/{warehouseId}/locations/next-code | nextCode | read:warehouse-location |
| GET | /locations | list (data table) | read:warehouse-location |
| GET | /location-options | listOptions (combobox, cursor) | read:warehouse-location |
| GET | /locations/lookup | lookup (barcode, or warehouseId + fullCode) | read:warehouse-location |
| GET | /locations/{locationId} | get (path + effective status) | read:warehouse-location |
| PATCH | /locations/{locationId} | update | update:warehouse-location |
| POST | /locations/{locationId}/move | move | move:warehouse-location |
| POST | /locations/{locationId}/block, /unblock | block, unblock | block:warehouse-location |
| POST | /locations/{locationId}/deactivate?cascade, /reactivate | deactivate, reactivate | deactivate:warehouse-location |
| POST | /locations/{locationId}/barcode | changeBarcode | change_barcode:warehouse-location |
| DELETE | /locations/{locationId} | delete | delete:warehouse-location |

## Data model notes
- `path_ids` (root..self) is maintained with `full_code` and `tree_depth`; subtree and ancestor queries use it
  (GIN) instead of recursive CTEs. Effective blocked = any id in `path_ids` is blocked.
- Composite FKs keep a parent in the same organization and warehouse. Sibling codes are unique through two partial
  unique indexes; `full_code` unique per warehouse; barcode unique per organization.

## Rules (shared pure functions live in `@avuny/contracts/warehouse-location` `rules.ts`)
- Placement: child rank > parent rank (zone 1, area/dock 2, aisle 3, rack 4, bay 5, level/shelf 6, bin/virtual_bin 7).
- Only area, dock, level, shelf, bin, virtual_bin may be stockable; stockable means leaf; pickable/receivable need stockable.
- virtual_bin only in virtual warehouses, which hold only virtual_bin and area.
- Purpose defaults the parent's purpose, then storage; purpose sets default pickable/receivable.
- Move: subtree must be empty, same warehouse, no cycle. Deactivate: subtree empty and not in use; `cascade` needed for
  active descendants. Reactivate needs an active parent and warehouse. Delete: no children, never used.
- Blocked: stock stays on hand but is unavailable; receipts in and picks out are refused; moves out and adjustments work.
- System (transit) warehouse locations are read-only for users.

## For other modules
`assertPostable(orgId, locationId, intent, tx?)` with intent receive | issue | move_in | move_out | adjust; pass your
transaction so the row is read under a shared lock. Register a `WarehouseUsageProvider` with the warehouse module.

## Audit events
`warehouse_location.created|bulk_created|updated|deleted|deactivated|reactivated|moved|blocked|unblocked|barcode_changed`.
