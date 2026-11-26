# inventory-adjustment.todo.md (Server)

## Task Overview
Build the server module for Inventory Adjustment in `apps/server`: repository, service with 6 core methods + confirm/cancel/reasons/snapshot, permissions, error mapping, testing harness, service unit tests, route integration tests, DI wiring, and Hono OpenAPI routes.

## Completed
- [x] Define permission keys in `inventory-adjustment.permissions.ts` — completed: 2026-11-20 14:43
- [x] Define errors & HTTP status map in `inventory-adjustment.errors.ts` — completed: 2026-11-20 14:44
- [x] Define module error map in `inventory-adjustment.error-map.ts` — completed: 2026-11-20 14:44
- [x] Implement DTO mappers in `inventory-adjustment.mapper.ts` — completed: 2026-11-20 14:45
- [x] Define port types in `inventory-adjustment.types.ts` — completed: 2026-11-20 14:45
- [x] Implement repository in `inventory-adjustment.repository.ts` — completed: 2026-11-20 14:46
- [x] Implement service in `inventory-adjustment.service.ts` with atomic confirmation — completed: 2026-11-20 14:48
- [x] Implement in-memory test harness in `testing.ts` — completed: 2026-11-20 14:49
- [x] Write and pass 13 unit tests in `inventory-adjustment.service.spec.ts` — completed: 2026-11-20 14:50
- [x] Implement dependency injection wiring in `deps.ts` — completed: 2026-11-20 14:52
- [x] Generate intl bindings (`i18next.ts`) and OpenAPI specs — completed: 2026-11-20 14:53
- [x] Wire all 10 Hono OpenAPI routes in `hono-routes/` — completed: 2026-11-20 14:55
- [x] Add `inventoryAdjustment: "inventory-adjustment"` to `sidebar.permission-map.ts` — completed: 2026-11-20 14:56
- [x] Fix TypeScript compilation errors in server routes and testing harness — completed: 2026-11-20 15:02
- [x] Write and pass 11 route integration tests in `__tests__/inventory-adjustment.routes.test.ts` — completed: 2026-11-20 15:05
- [x] Regenerate OpenAPI (`pnpm openapi:generate`) & web client (`pnpm api:generate`) — completed: 2026-11-20 15:03
- [x] Monorepo-wide typecheck (`pnpm typecheck`) verified clean across all 19 tasks — completed: 2026-11-20 15:03

## In Progress
None.

## Pending
None.

## Blocked
None.

## Decisions and Notes
- `handleResult` routes require route-specific error maps using `as unknown as Record<Code | RoleErrorCode, ...>` casting to align with Hono typed route responses.
- `StockMovementPort` returns `StockMovementDto` containing `createdBy` and `createdAt`.
- Items schema columns are `isInventoryTracked` and `isBatchTracked` (not `tracksStock`).
- Atomic confirmation orchestrates Stock Movement (`type: "adjustment"`), Inventory Costing layers, and Accounting Journal Entry (`event: "inventory_adjustment"`).

## Modified Files
- `apps/server/src/api/modules/inventory-adjustment/inventory-adjustment.permissions.ts` (created)
- `apps/server/src/api/modules/inventory-adjustment/inventory-adjustment.errors.ts` (created)
- `apps/server/src/api/modules/inventory-adjustment/inventory-adjustment.error-map.ts` (created)
- `apps/server/src/api/modules/inventory-adjustment/inventory-adjustment.mapper.ts` (created)
- `apps/server/src/api/modules/inventory-adjustment/inventory-adjustment.types.ts` (created)
- `apps/server/src/api/modules/inventory-adjustment/inventory-adjustment.repository.ts` (created)
- `apps/server/src/api/modules/inventory-adjustment/inventory-adjustment.service.ts` (created)
- `apps/server/src/api/modules/inventory-adjustment/testing.ts` (created)
- `apps/server/src/api/modules/inventory-adjustment/inventory-adjustment.service.spec.ts` (created)
- `apps/server/src/api/modules/inventory-adjustment/__tests__/inventory-adjustment.routes.test.ts` (created)
- `apps/server/src/api/modules/inventory-adjustment/deps.ts` (created)
- `apps/server/src/api/modules/inventory-adjustment/SPEC.md` (created)
- `apps/server/src/api/modules/inventory-adjustment/hono-routes/*` (all 10 route files and index.ts)
- `apps/server/src/api/modules/inventory-adjustment/inventory-adjustment.todo.md` (created & maintained)
- `apps/server/src/api/modules/sidebar/sidebar.permission-map.ts` (added sidebar resource mapping)

## Verification
- `pnpm vitest run apps/server/src/api/modules/inventory-adjustment/inventory-adjustment.service.spec.ts`: 13/13 passed.
- `pnpm vitest run apps/server/src/api/modules/inventory-adjustment/__tests__/inventory-adjustment.routes.test.ts`: 11/11 passed.
- `pnpm --filter @avuny/books-server typecheck`: 0 errors (clean exit code 0).
- `turbo openapi:generate`: OpenAPI spec successfully generated.
- `turbo api:generate`: Orval client successfully generated in `@avuny/books-web`.
- `turbo typecheck`: 19/19 packages and targets passed with 0 errors.

## Next Steps
- Implement frontend web feature module under `apps/web/src/features/inventory-adjustment-module/` according to `packages/contracts/src/inventory-adjustment/SPEC.md`.
