# Stock Movement Module — Specification
> Update this file whenever a requirement changes: new error code, rule or behavior.
> Internal module: no HTTP routes yet. Other modules call the service.

## 1. Purpose
The stock ledger of an organization. Every change of quantity on hand is a posted **movement**: one or
more **lines**, each moving a quantity of an item from one location to another. Current quantities are
kept in **balances**, updated in the same transaction. Purchasing, sales, transfers, returns,
assembly, adjustments and opening stock all post here; the warehouse and item modules read from here.

## 2. Domain Model
| Table | What it is |
|---|---|
| `stock_movements` | Header: type, posted_at, source document (type, id, ref), note, reversal_of_id, created_by |
| `stock_movement_lines` | One item from `from_location_id` to `to_location_id`, quantity > 0 in the item's base unit |
| `stock_balances` | Quantity on hand per (location, item), with the location's warehouse. Stockable locations only |

Lines and balances carry an optional `batch_id`: set exactly when the item is batch tracked (see the batch module). A balance is one row per (location, item, batch).

Both sides of a line are always set. An end outside the business is a **system location** (role
`supplier`, `customer`, `adjustment`, `production`) in the VIRTUAL system warehouse; `transit` is the
IN-TRANSIT location of the TRANSIT warehouse and does hold stock. System locations are seeded with the
organization (see warehouse.defaults.ts).

| Type | From | To |
|---|---|---|
| opening | adjustment | real (receive) |
| purchase | supplier | real (receive) |
| purchase_return | real (issue) | supplier |
| sale | real (issue) | customer |
| sale_return | customer | real (receive) |
| transfer | real (move_out) | real (move_in); between warehouses via transit |
| adjustment | real (adjust) or adjustment | adjustment or real (adjust); exactly one side given |
| assembly_consume | real (issue) | production |
| assembly_produce | production | real (receive) |

## 3. Business Rules & Policies
1. The caller supplies only real locations; the type fills the counterparty side (`STOCK_MOVEMENT_INVALID_SIDES` if a system side is supplied or a real side is missing, `STOCK_MOVEMENT_SYSTEM_LOCATION_MISSING` if the system location was not seeded).
2. From and to differ (`STOCK_MOVEMENT_SAME_LOCATION`). Quantity is a positive decimal string (`STOCK_MOVEMENT_INVALID_QUANTITY`). 1 to 1000 lines (`STOCK_MOVEMENT_NO_LINES`, `STOCK_MOVEMENT_TOO_MANY_LINES`).
3. Every real location must pass `assertPostable` with the intent of its side; its error codes are returned unchanged.
4. Items must exist, be active and track stock (`..._ITEM_NOT_FOUND`, `..._ITEM_INACTIVE`, `..._ITEM_NOT_STOCKED`). Reversals skip the active and tracking checks.
4b. Batches: a batch-tracked item needs a batch on every line and any other item must have none (`STOCK_MOVEMENT_BATCH_REQUIRED`, `STOCK_MOVEMENT_BATCH_NOT_TRACKED`); the batch must exist and belong to the item (`STOCK_MOVEMENT_BATCH_NOT_FOUND`); for forward postings its status must allow the intent of each real side (`batchAllowsIntent`: issue needs available, receive needs available or quarantined; moves and adjustments always work) (`STOCK_MOVEMENT_BATCH_NOT_AVAILABLE`). Reversals skip these checks.
5. Stock cannot leave a location (and batch) (`STOCK_MOVEMENT_INSUFFICIENT_STOCK`), checked under row locks. Only items that allow negative stock may go negative, and never in transit.
6. A source document (`source_type` + `source_id`) can be posted once (`STOCK_MOVEMENT_SOURCE_ALREADY_POSTED`).
7. A movement can be reversed once (`STOCK_MOVEMENT_ALREADY_REVERSED`); a reversal cannot be reversed (`STOCK_MOVEMENT_CANNOT_REVERSE_REVERSAL`). A reversal swaps from and to on every line, keeps type and source, uses the `adjust` intent, and must still satisfy rule 5.
8. Append only: the repository has no update or delete. Corrections are reversals.
9. Counterparty locations get no balance rows.
10. Posting needs no permission check and writes no activity log row: the calling module authorizes its operation and the ledger is the audit trail. Callers pass their transaction (`tx`) so the document and its stock commit together.
11. All balance rows a posting touches (both sides) are locked up front in key order; this also keeps two opposite transfers from deadlocking.
12. A failure never leaves partial rows: all checks run before the first write (header), and the whole posting is one transaction.

## 4. Error Codes
Own codes are in `StockMovementErrorCode` (contracts, with en/ar messages); location failures use `WarehouseLocationErrorCode`. HTTP mapping (`*.errors.ts`, `*.error-map.ts`) is added together with the routes.

## 5. Queries used by other modules
- Warehouses: `warehouseUsage`, `locationUsage` (stock and history; open documents come from other modules), `listBalances` (stock in a warehouse or location), `listLines` (history).
- Items: `getOnHand` (many items at once, optionally one warehouse), `getItemBatchStock` (per batch), `getItemStock` (per warehouse, on hand and in transit), `itemUsage` (holds stock or was moved), `listLines` (stock card).

## 6. Not here yet
Valuation and costing (cost layers point at `stock_movement_lines.(org_id, id)`), reservations, serial numbers, expiry-based picking, units other than the base unit, HTTP routes, permission keys and audit events (register the module in `modules/registry.ts` when routes arrive).

## 7. File Structure
```
stock-movement/
├── SPEC.md  index.ts  deps.ts  testing.ts
├── stock-movement.types.ts  stock-movement.mapper.ts
├── stock-movement.repository.ts  stock-movement.service.ts
└── stock-movement.service.spec.ts
```
Contracts: `packages/contracts/src/stock-movement/` (constants, errors, rules, schemas, locales). Database: `packages/db/src/schema/inventory/stock-movement.ts`.
