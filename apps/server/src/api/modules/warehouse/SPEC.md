# Warehouse module

Warehouses of an organization: physical sites and virtual containers (e.g. the system TRANSIT warehouse).
Locations inside a warehouse live in the sibling `warehouse-location` module. This module never stores
quantities; it asks other modules (through the usage registry) whether a warehouse holds stock.

## Files
`warehouse.service.ts` (rules), `warehouse.repository.ts` (Drizzle), `warehouse.mapper.ts`, `shared/warehouse-usage.ts`
(registry other modules register with), `warehouse.permissions.ts`, `warehouse.errors.ts` / `warehouse.error-map.ts`
(generated from the error table), `hono-routes/*` (one route per file), `deps.ts` (lazy singleton + audit adapter).

## Routes (all under `/organizations/{orgId}`)
| Method | Path | Service | Permission |
|---|---|---|---|
| POST | /warehouses | create | create:warehouse |
| GET | /warehouses | list (data table) | read:warehouse |
| GET | /warehouse-options | listOptions (combobox, cursor) | read:warehouse |
| GET | /warehouses/{warehouseId} | get | read:warehouse |
| PATCH | /warehouses/{warehouseId} | update | update:warehouse |
| POST | /warehouses/{warehouseId}/deactivate | deactivate | deactivate:warehouse |
| POST | /warehouses/{warehouseId}/reactivate | reactivate | deactivate:warehouse |
| POST | /warehouses/{warehouseId}/set-default | setDefault | update:warehouse |
| DELETE | /warehouses/{warehouseId} | delete | delete:warehouse |

## Rules
- Code unique per organization (case-insensitive, stored uppercase). Reserved: `TRANSIT`.
- Type (`physical` | `virtual`) is immutable. Virtual warehouses have no address.
- The first physical warehouse becomes the default; at most one default; it must be active, physical, non-system.
- `createDefaultLocation` also creates a stockable `MAIN` bin (virtual bin in a virtual warehouse).
- Deactivate: not system, not default, no stock, no open documents. Locations are left alone.
- Delete: not system, not default, no locations at all, nothing references it (usage registry + FK restrict).
- Reactivate is authorized by `deactivate:warehouse`; set-default by `update:warehouse` (logged-only actions).

## Audit events
`warehouse.created|updated|deleted|deactivated|reactivated|default_changed`, written after commit.

## Extension point
Inventory, purchasing, sales and transfers call `warehouseUsageRegistry.register(provider)` at startup.
