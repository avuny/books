# inventory-adjustment.todo.md (Contracts)

## Task Overview
Define contract-first schemas, DTOs, constants, error codes, and locale dictionaries (English & Arabic with 1:1 key parity) for the Inventory Adjustment module (`@avuny/contracts`).

## Completed
- [x] Create domain constants (`STATUSES`, `DIRECTIONS`, system reasons, regex, limits) — completed: 2026-11-20 14:15
- [x] Create error codes (`InventoryAdjustmentErrorCode`) — completed: 2026-11-20 14:18
- [x] Create Zod schemas and DTO types (create, update, lines, snapshot, filters, reasons) — completed: 2026-11-20 14:22
- [x] Create locale files `locales/en.json` and `locales/ar.json` with exact parity — completed: 2026-11-20 14:25
- [x] Export module in `src/index.ts` and `package.json` — completed: 2026-11-20 14:28
- [x] Register module in `src/modules/registry.ts` and role action locales — completed: 2026-11-20 14:30
- [x] Write schema validation unit tests in `schemas.test.ts` — completed: 2026-11-20 14:32

## In Progress
None.

## Pending
None.

## Blocked
None.

## Decisions and Notes
- All quantities on lines are stored and handled in base units (`systemQuantityBase`, `countedQuantityBase`, `quantityDeltaBase`), while keeping the entered unit and quantity for display/auditing.
- Direction validation rules: `INCREASE` permits only non-negative deltas; `DECREASE` permits only non-positive deltas; `BOTH` permits any deltas.
- System reasons include `PHYSICAL_COUNT`, `DAMAGE`, `SPOILAGE`, `THEFT_LOSS`, `FOUND_STOCK`, `REVALUATION`, and `OTHER`.

## Modified Files
- `packages/contracts/src/inventory-adjustment/constants.ts` (created)
- `packages/contracts/src/inventory-adjustment/errors.ts` (created)
- `packages/contracts/src/inventory-adjustment/schemas.ts` (created)
- `packages/contracts/src/inventory-adjustment/locales/en.json` (created)
- `packages/contracts/src/inventory-adjustment/locales/ar.json` (created)
- `packages/contracts/src/inventory-adjustment/locales/index.ts` (created)
- `packages/contracts/src/inventory-adjustment/index.ts` (created)
- `packages/contracts/src/inventory-adjustment/schemas.test.ts` (created)
- `packages/contracts/package.json` (added `./inventory-adjustment` export)
- `packages/contracts/src/index.ts` (re-exported `./inventory-adjustment/index.js`)
- `packages/contracts/src/modules/registry.ts` (registered `inventory_adjustment` module)
- `packages/contracts/src/role/locales/en.json` & `ar.json` (added permission labels)

## Verification
- `pnpm --filter @avuny/contracts test`: 15 test files passed, 187 tests passed (including `schemas.test.ts`).
- `pnpm --filter @avuny/contracts build`: Success.

## Next Steps
- Keep synchronized with server and web implementations.
