# Stock Movement Module — Backend Implementation Specification

> Canonical Contract Specification: `../../../../../packages/contracts/src/stock-movement/SPEC.md`  
> Location: `apps/server/src/api/modules/stock-movement/SPEC.md`  
> Status: Implemented backend stock ledger, balance calculations, and history endpoints.

---

## 1. Implementation Overview
The stock-movement module implements the inventory ledger and stock on-hand balances for organizations. It handles:
1. Transactional ledger posting of movements (`postMovement`).
2. Atomic reversal of posted movements (`reverseMovement`).
3. Maintenance of `inventory_items` and `inventory_item_batches`.
4. History listing with post-movement running balances via SQL window functions (`listLines`).
5. On-hand balance queries (`listBalances`, `getItemStock`, `getOnHand`, `getItemBatchStock`).

Internal files:
- `stock-movement.service.ts`: Domain service with transactional validations and posting.
- `stock-movement.repository.ts`: Drizzle ORM operations, row-level locking, and CTE window queries.
- `stock-movement.mapper.ts`: DTO mappers.
- `hono-routes/`:
  - `list-stock-movements.route.ts` (`listStockMovements`)
  - `list-stock-balances.route.ts` (`listStockBalances`)
  - `get-item-stock.route.ts` (`getItemStock`)

---

## 2. Endpoint Implementation

### 2.1 `listStockMovements`
- **Operation ID**: `listStockMovements`
- **Route**: `GET /organizations/{orgId}/stock-movements`
- **Handler**: `hono-routes/list-stock-movements.route.ts` $\rightarrow$ `service.listLines(orgId, query)` $\rightarrow$ `repo.listLines(orgId, query)`
- **Auth & Permission**: `requireAuth`, `requirePermission("read:stock-movement")`
- **Input Validation**: `StockMovementLineHistoryQuerySchema`
- **Output Schema**: `StockMovementLineHistoryResponseSchema`

#### Running Balance Calculation:
Running balance represents the stock on hand immediately after each movement for each physical location. It is computed in `listLines` using a SQL Common Table Expression (CTE) with a window function:
```sql
SUM(
  CASE
    WHEN to_wh.type = 'physical' THEN sml.quantity::numeric
    ELSE -sml.quantity::numeric
  END
) OVER (
  PARTITION BY sml.item_id, CASE WHEN to_wh.type = 'physical' THEN to_loc.id ELSE from_loc.id END
  ORDER BY sm.posted_at ASC, sm.id ASC, sml.line_no ASC
) AS running_balance
```
Because the CTE computes the running balance over all chronological movements before outer filtering (e.g. date ranges `from`/`to`, pagination `limit`/`offset`), every returned row preserves its exact historical running balance.

#### Virtual Warehouse Protection:
- If `to_wh.type === 'physical'`, direction is `IN`, and physical location/warehouse is `to_loc` / `to_wh`.
- If `from_wh.type === 'physical'`, direction is `OUT`, and physical location/warehouse is `from_loc` / `from_wh`.
- Virtual warehouses (and system counterparty locations) are never exposed to the client in the physical fields.

---

## 3. Database Responsibilities
- `stock_movements`: Header table (org_id, type, posted_at, source_type, source_id, source_ref, note, reversal_of_id).
- `stock_movement_lines`: Lines table (org_id, movement_id, line_no, item_id, batch_id, from_location_id, to_location_id, quantity).
- `inventory_items`: Aggregated location on-hand and reserved quantities.
- `inventory_item_batches`: Batch-specific quantities for batch-tracked items.

---

## 4. Backend Acceptance Criteria
- [x] All stock-affecting operations commit atomically with ledger entries and balance updates.
- [x] `listLines` computes post-movement running balances chronologically per `(item, physical_location)`.
- [x] Pagination and date filters do not alter historical running balances.
- [x] Virtual warehouse names and locations are excluded from client responses.
