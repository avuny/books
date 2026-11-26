# Implementation Plan: Split Unit & Unit Collection Modules

Sequential implementation tracking for splitting `unit` and `unit-collection` into two distinct modules, adding organization-specific units with full CRUD, and building corresponding contracts, server APIs, and web features.

---

## In Progress

---

## Todo

---

## Done

### Step 1: Database Schema & Migration (Completed: 2026-11-10 21:31)
- [x] Update `packages/db/src/schema/item/unit.ts` to add nullable `orgId` to `units` table with partial unique indexes for system vs org units.
- [x] Update `packages/db/src/schema/item/relations.ts` with organization relation for units.
- [x] Generate database migration `0009_majestic_doomsday.sql`.
- [x] Verify `packages/db` typecheck and build.

### Step 2: Contracts Module (Completed: 2026-11-10 21:37)
- [x] Create `packages/contracts/src/unit-collection/`: constants, errors, schemas, locales, index barrel.
- [x] Update `packages/contracts/src/unit/`: constants, errors, schemas, locales, index barrel.
- [x] Update `packages/contracts/src/index.ts` and `package.json` exports.
- [x] Verify `packages/contracts` tests and typecheck pass.

### Step 3: Server Modules (Completed: 2026-11-10 22:08)
- [x] Create `apps/server/src/api/modules/unit-collection/`: repository, service, rules, mapper, errors, error-map, types, routes, tests.
- [x] Rebuild `apps/server/src/api/modules/unit/`: repository, service, rules, mapper, errors, error-map, types, routes, tests.
- [x] Mount `/units` and `/unit-collections` in `apps/server/src/api/routes.ts`.
- [x] Add server intl locales and run `intl:generate`.
- [x] Generate OpenAPI spec and Orval client (`openapi:generate`, `api:generate`).
- [x] Verify server typecheck and all 90 vitest tests pass.

### Step 4: Web Features & Routes (Completed: 2026-11-11 11:12)
- [x] Migrate `apps/web/src/features/unit-module` -> `apps/web/src/features/unit-collection-module`:
  - [x] Rename/move files from unit collection features to `unit-collection-module`.
  - [x] Update hooks to use generated unit-collection client hooks (`useListUnitCollections`, `useGetUnitCollection`, etc.).
  - [x] Wire `"unit-collection"` i18n resources and update translations namespace in web features.
  - [x] Update routes at `apps/web/src/routes/organization/$orgId/unit-collections/` to import from `unit-collection-module`.
- [x] Build `apps/web/src/features/unit-module` for individual units:
  - [x] `types.ts`
  - [x] `unit-api.ts` & `unit-api.test.ts`
  - [x] `forms/` (create, update, dialog, button, schemas & tests)
  - [x] `list/` (unit-list, columns, mobile-card)
  - [x] `details/` (unit-details, unit-details-view)
  - [x] `index.ts`
- [x] Add web routes for units:
  - [x] `apps/web/src/routes/organization/$orgId/units/index.tsx`
  - [x] `apps/web/src/routes/organization/$orgId/units/$unitId.tsx`
- [x] Regenerate TanStack route tree (`routeTree.gen.ts`).
- [x] Verify web typecheck, lint, and tests (all 64 vitest tests pass).
