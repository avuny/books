# Implementation Checklist: Item Expiry Tracking & Opening Stock Integration

_Last updated: 2026-11-14 16:06_

## Status Legend
- `[x]` Done & verified
- `[ ]` Still pending
- `[~]` Pre-existing issue (not in scope)

---

## Database Schema & Migrations (`packages/db`)
- [x] Centralize shelf life units (`DAY`, `MONTH`, `YEAR`) in contracts (`packages/contracts/src/batch/constants.ts`).
- [x] Add `isExpiryTracked: boolean` (default false) to `items` table in `packages/db/src/schema/item/item.ts`.
- [x] Add check constraint `ck_item_expiry_requires_batch_and_tracking` on `items`.
- [x] Create `item_expiry_settings` table (`orgId`, `itemId` unique FK, `defaultShelfLifeValue`, `defaultShelfLifeUnit`, timestamps, both-null-or-both-set check).
- [x] Add `shelfLifeValue` and `shelfLifeUnit` to `batches` table (`packages/db/src/schema/inventory/batch.ts`) with checks.
- [x] Add `warehouseLocationSystemRoleEnum` and `systemRole` column to `warehouseLocations` table.
- [x] Migration generated: `packages/db/drizzle/0012_illegal_nova.sql` + snapshot.

---

## Contracts (`packages/contracts`)
- [x] `SHELF_LIFE_UNITS` and `ShelfLifeUnit` in `packages/contracts/src/batch/constants.ts`.
- [x] `ITEM_OPENING_STOCK_SOURCE_TYPE` in `packages/contracts/src/item/constants.ts`.
- [x] Error codes in `packages/contracts/src/item/errors.ts`:
  - [x] `ITEM_EXPIRY_REQUIRES_BATCH_AND_TRACKING`
  - [x] `ITEM_OPENING_STOCK_NOT_TRACKED`
  - [x] `ITEM_OPENING_STOCK_BATCH_REQUIRED`
  - [x] `ITEM_OPENING_STOCK_BATCH_NOT_TRACKED`
  - [x] `ITEM_EXPIRY_DATE_REQUIRED`
- [x] `BATCH_SHELF_LIFE_INVALID` in `packages/contracts/src/batch/errors.ts`.
- [x] `STOCK_MOVEMENT_EXPIRY_DATE_REQUIRED` in `packages/contracts/src/stock-movement/errors.ts`.
- [x] `batch` and `stock_movement` modules registered in `packages/contracts/src/modules/registry.ts`.
- [x] Schemas in `packages/contracts/src/item/schemas.ts`:
  - [x] `ItemExpirySettingsInputSchema`, `ItemExpirySettingsDtoSchema`
  - [x] `ItemOpeningStockLineSchema`, `ItemOpeningStockSchema`
  - [x] `CreateItemSchema`, `UpdateItemSchema`, `ItemDtoSchema`, `ItemListItemDtoSchema` updated.
- [x] `BatchInputSchema` and `BatchDtoSchema` updated with `shelfLifeValue`, `shelfLifeUnit`.
- [x] Calendar arithmetic & expiry resolution in `packages/contracts/src/batch/rules.ts` (`addShelfLifeToDate`, `resolveBatchShelfLifeAndExpiry`).
- [x] Locale files updated (`en.json`, `ar.json`) for item, batch, stock-movement — including shelf life unit labels.
- [x] Contracts package built (`dist/` current).

---

## Server Modules (`apps/server`)
- [x] `isForeignKeyViolation` in `apps/server/src/api/modules/shared/pg-errors.ts` updated (optional constraint name).
- [x] `warehouse.defaults.ts` system role typing fixed (`as const`).
- [x] `item.repository.ts`: `itemExpirySettings` join, `upsertExpirySettings`, `findStockPolicies`.
- [x] `item.rules.ts`: `isExpiryTracked` in `TrackingFlags`, `ItemTrackingSnapshot`, `LockedField`, `checkTracking`, `effectiveTracking`, `changedLockedFields`.
- [x] `item.mapper.ts`: maps `isExpiryTracked` and `expirySettings`.
- [x] `item.service.ts`:
  - [x] Optional `outerTx?: Tx` in `create`.
  - [x] `checkOpeningStock` integrated within create transaction.
  - [x] `upsertExpirySettings` on create and update.
  - [x] `isExpiryTracked` in update.
- [x] `deps.ts`: `stockMovements`, `batches`, `stockHistory`, `openingStock` wired.
- [x] `batch.repository.ts`: `shelfLifeValue`, `shelfLifeUnit` in queries; `findItemDefaultShelfLife`; `expiresOn` in `findForPosting`.
- [x] `batch.mapper.ts`: maps `shelfLifeValue`, `shelfLifeUnit`.
- [x] `batch.service.ts`: shelf-life resolution with correct calendar arithmetic and precedence.
- [x] `stock-movement.service.ts`: enforces `STOCK_MOVEMENT_EXPIRY_DATE_REQUIRED` for expiry-tracked items.
- [x] `organization.service.ts`: calls `seedInventoryDefaults(tx, org.id)` on org creation.
- [x] `item/hono-routes/create-item.route.ts`: error map and OpenAPI responses include all new error codes.
- [x] `item/hono-routes/update-item.route.ts`: error map and OpenAPI responses include `ITEM_EXPIRY_REQUIRES_BATCH_AND_TRACKING`.
- [x] New module directories present:
  - [x] `apps/server/src/api/modules/batch/`
  - [x] `apps/server/src/api/modules/stock-movement/`
  - [x] `apps/server/src/api/modules/item/item-opening-stock.ts`
  - [x] `apps/server/src/api/modules/item/item-opening-stock.rules.ts`
  - [x] `apps/server/src/api/modules/warehouse/warehouse.defaults.ts`

---

## Web Application (`apps/web`)
- [x] `types.ts`: exports `ItemExpirySettingsDto`, `ItemExpirySettingsInput`, `ShelfLifeUnit`.
- [x] `item-form-types.ts`: `isExpiryTracked`, `shelfLifeValue`, `shelfLifeUnit` in `ItemFormCopy`; `ShelfLifeUnitOption`.
- [x] `item-form-schema.ts`: `isExpiryTracked`, `defaultShelfLifeValue`, `defaultShelfLifeUnit` in `ItemFormShape`; refinements; defaults and mappers updated.
- [x] `use-item-form-copy.ts`: expiry/shelf-life copy fields; `useShelfLifeUnitOptions()` hook.
- [x] `item-fields.tsx`: `isExpiryTracked` checkbox and conditional shelf-life fields.
- [x] `create-item-form.tsx` / `update-item-form.tsx`: `shelfLifeUnitOptions` prop passed through.
- [x] `create-item.tsx` / `update-item.tsx`: `useShelfLifeUnitOptions()` consumed.
- [x] `item-tracking-badges.tsx`: optional `isExpiryTracked` and `expiryLabel` props.
- [x] `item-details-view.tsx` / `item-details.tsx`: `expiryLabel` and `isExpiryTracked` passed to badge.
- [x] `pnpm api:generate` run — Orval client regenerated with new schemas.

---

## Tests & Verification
- [x] Unit tests for calendar arithmetic (DAY, MONTH, YEAR, leap years, month-end) — 60/60 contract tests passing.
- [x] Tests for batch shelf-life resolution (explicit, item default, missing dates).
- [x] `item.rules.spec.ts` updated for `isExpiryTracked` in `effectiveTracking`.
- [x] `sidebar.service.spec.ts` fixed (removed references to removed `sales` sidebar group).
- [x] `pnpm --filter @avuny/books-server typecheck` → 0 errors ✅
- [x] `pnpm --filter @avuny/books-web typecheck` → 0 errors ✅
- [x] `pnpm typecheck` (full monorepo, 19 tasks) → all successful ✅
- [x] `pnpm --filter @avuny/books-server test` → 462/467 passed (5 pre-existing `forgot-password` failures) ✅
- [x] `pnpm openapi:generate` → success ✅
- [x] `pnpm api:generate` → Orval client regenerated ✅
- [~] `pnpm lint` → server fails on missing `eslint.config.js` **(pre-existing, not in scope)**
- [~] `forgot-password.test.ts` 5 failures **(pre-existing, confirmed by stash test)**

---

## Pending / Open Items
- [ ] Run `pnpm db:migrate` against an actual DB instance to apply migration `0012_illegal_nova.sql`.
- [ ] Git commits — group into logical conventional commits:
  1. `feat(db): add expiry tracking schema and batch shelf life columns`
  2. `feat(contracts): add expiry tracking and batch shelf life support`
  3. `feat(server): integrate expiry tracking into item and batch services`
  4. `feat(web): add expiry tracking fields to item form and details`
- [ ] (Optional) Add HTTP route tests for `createItem` with opening stock and expiry scenarios.
- [ ] (Optional) Fix server `eslint.config.js` missing (pre-existing issue, unrelated to this feature).
