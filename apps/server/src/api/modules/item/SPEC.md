# Item Module: Specification

> **Update this file** whenever a requirement changes: a new error code, a new route, a policy change, or anything else that alters observable behavior.

## 1. Purpose

Items: what the organization buys, sells, stores and assembles. Each item has one category, one base unit and one unit collection, plus per-organization stock settings.

## 2. Domain model

`items` (identity, category, unit pair, flags, valuation method, `is_active`) and `item_inventory_settings` (one row per item: `allow_negative_stock`, `reorder_point`). The unit pair is one composite FK `(org_id, unit_collection_id, base_unit_id)`, so the collection always belongs to the same organization and the item's base unit always equals the collection's base unit. Opening stock is **not** stored here: the application orchestrator calls the inventory opening-balance service. Per-warehouse settings are out of scope until the `warehouses` table exists.

## 3. Business rules (all in `item.rules.ts`, pure)

- Create takes **exactly one** of `baseUnitId` (a collection holding only that unit is created in the same transaction, named `"<name> (<symbol>)"`) or `unitCollectionId` (reused; its base unit becomes the item's).
- The category must exist in the organization and be active (`ITEM_CATEGORY_INVALID`). The base unit must exist and be active (`ITEM_UNIT_INVALID`). The collection must exist in the organization (`ITEM_UNIT_COLLECTION_INVALID`).
- Names are unique per organization, case-insensitively (`ITEM_NAME_TAKEN`).
- Batch tracking requires inventory tracking (`ITEM_BATCH_REQUIRES_TRACKING`), also when a PATCH turns inventory tracking off while batches are tracked.
- **Locked fields**: the unit (base unit / collection), `isInventoryTracked`, `isBatchTracked` and `inventoryValuationMethod` cannot change once the item has stock movements (`ITEM_LOCKED_FIELD`). Only fields whose value really changes count. History comes from the `ItemStockHistory` port (the Dummy answers "no history" until the inventory module exists).
- Items with history are deactivated, never deleted (`ITEM_HAS_HISTORY`).
- Quantities (`reorderPoint`) are decimal strings fitting numeric(18,6), in the item's base unit.
- Transaction discipline: all checks run before the first write. A failure found after a write (lost name race) uses `abort(...)` so the transaction rolls back and no orphan collection is left.
- Deleting an item leaves its automatic collection in place (collections can be shared and have no owner).

## 4. Routes (permission resource `item`)

| Method | Path | Permission | Notes |
|---|---|---|---|
| GET | `/organizations/{orgId}/items` | `read:item` | filters `search`, `categoryId` (+`includeSubcategories`, default true), `isActive` |
| GET | `/organizations/{orgId}/item-options` | `read:item` | pickers: active items, id + name, cursor paging |
| GET | `/organizations/{orgId}/items/{itemId}` | `read:item` | with category name, base unit, settings |
| POST | `/organizations/{orgId}/items` | `create:item` | |
| PATCH | `/organizations/{orgId}/items/{itemId}` | `update:item` | only provided fields are written |
| DELETE | `/organizations/{orgId}/items/{itemId}` | `delete:item` | only without stock history |

## 5. Error codes

| Code | HTTP | Description |
|---|---|---|
| `ITEM_NOT_FOUND` | 404 | Item missing or in another organization |
| `ITEM_NAME_TAKEN` | 409 | Name already used in the organization |
| `ITEM_CATEGORY_INVALID` | 422 | Category missing, inactive or foreign |
| `ITEM_UNIT_INVALID` | 422 | Base unit missing or inactive |
| `ITEM_UNIT_COLLECTION_INVALID` | 422 | Collection missing or foreign |
| `ITEM_BATCH_REQUIRES_TRACKING` | 422 | Batch tracking without inventory tracking |
| `ITEM_UNIT_PRICE_UNIT_INVALID` | 422 | A per-unit price names the base unit or a unit outside the item's collection |
| `ITEM_OPENING_STOCK_UNIT_INVALID` | 422 | An opening stock line names a unit outside the item's collection |
| `ITEM_LOCKED_FIELD` | 409 | Locked field changed after stock movements |
| `ITEM_HAS_HISTORY` | 409 | Delete refused, deactivate instead |

## 6. Files

```
item/
├── SPEC.md
├── deps.ts                 # wires unit + category repositories into the service
├── index.ts
├── testing.ts              # DummyStockHistory, DummyItemActivityLog
├── item.errors.ts
├── item.error-map.ts
├── item.mapper.ts
├── item.repository.ts
├── item.rules.ts           # PURE rules injected into the service
├── item.service.ts         # orchestration only
├── item.types.ts
├── item.rules.spec.ts
├── item.service.spec.ts
├── hono-routes/
└── __tests__/item.routes.test.ts
```

## 7. Per-unit prices (added 2026-11-27)

Buying or selling a ton can cost less than 1000 x 1 kg, so an item can carry optional prices for
each OTHER unit of its unit collection.

- Table `item_unit_prices` (migration `0029_item_unit_prices`): one row per (item, unit), nullable
  `cost_price` and `selling_price`, at least one set, both >= 0. Prices are per 1 of THAT unit, major
  units. `ON DELETE CASCADE` from the item.
- The base unit's prices stay on `items.cost_price` / `items.selling_price` (unchanged). A row for the
  base unit is refused (`ITEM_UNIT_PRICE_UNIT_INVALID`); so is a unit outside the collection.
- API: `unitPrices: [{ unitId, costPrice?, sellingPrice? }]` on create and update; `ItemDto.unitPrices`
  is `[{ unit, costPrice, sellingPrice }]` (empty when none). On update the array REPLACES the whole
  set (`[]` clears it; omit the field to keep it). Changing the item's unit collection clears the old
  rows unless a new `unitPrices` is sent.
- A new single-unit collection (created from `baseUnitId`) has no other unit, so prices need an
  existing `unitCollectionId`.
- Prices are DEFAULTS that prefill lines of purchase and sales documents; those modules do not read
  them yet (nothing consumes `unitPrices` server-side beyond storing and returning them).

## 8. Opening stock lines: unit and posting date (added 2026-11-27)

`openingStock.lines[]` accepts, besides `locationId`, `quantity`, `cost`, `manufacturedOn`, `batch`:

- `unitId` (optional): the collection unit `quantity` and `cost` are entered in. Default: base unit.
  The server stores BASE-unit quantities: `quantity * factor`; the cost becomes `cost / factor` per base
  unit (BigInt decimal math, 6 decimals, half up: `item-unit.rules.ts`). The cost layer and journal
  value come from the ENTERED quantity x entered cost, so converting does not change the value.
- `postedAt` (optional, date or datetime): this line's posting date. Falls back to
  `openingStock.postedAt`, then to now.
- Lines are grouped by posting date; each group is one `opening` stock movement. The first group uses
  the item as `sourceId` (so opening stock is still "posted once" per item); later groups use a fresh
  UUID as `sourceId`. Each group posts its own opening-balance journal entry for its lines.

