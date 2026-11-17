# Server Refactoring TODO — Inventory Architecture

## Done
- [2026-11-17 16:54] Database Schema & Migration: Exported inventory tables (`inventory_items`, `inventory_item_batches`, `inventory_reservations`, `inventory_reservation_allocations`), generated migration `0015_breezy_the_twelve.sql`, applied migrations to drop `stock_balances` and create new inventory tables, built `@avuny/db`.
- [2026-11-17 18:04] Contracts Refactoring: Updated `@avuny/contracts` for Batch (removed cost & quantity from Batch master input, DTO, rules, specs) and Stock Movement / Inventory (added InventoryItemDto, InventoryItemBatchDto, updated StockBalanceDto). Verified tests and typecheck.
- [2026-11-17 18:22] Batch Module: Updated mapper, service, and specs to remove quantity/cost from batch masters and support multi-location batches. All batch unit tests pass.
- [2026-11-17 18:27] Stock Movement Module: Refactored repository, service, and mapper from `stock_balances` to `inventory_items` and `inventory_item_batches`. Concurrency-safe automatic row initialization, row-level locking in deterministic key order, and transactional delta updates preserving `InventoryItem.onHandQty = SUM(InventoryItemBatch.onHandQty)`. All 22 stock movement unit tests and 5 inventory consistency integration tests pass.
- [2026-11-17 18:28] Item Opening Stock: Updated opening stock orchestration to create batches, post movements, and populate inventory items and batch associations transactionally. All 19 item unit tests pass.
- [2026-11-17 18:32] Verification & Generation: Ran `openapi:generate`, `api:generate` (Orval client), and verified `pnpm typecheck` across all 12 monorepo packages.
