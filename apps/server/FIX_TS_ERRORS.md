# Fix TypeScript Errors Log (`apps/server`)

Analysis, action plan, and status tracking for resolving the 75 TypeScript errors encountered during `pnpm --filter=books-server build` (`tsc -p tsconfig.build.json` and `tsc --noEmit`).

---

## 1. Error Analysis & Root Causes

Total errors: **75 errors across 33 files**.

All errors are isolated to the two new modules: `warehouse` and `warehouse-location`, and their integration with `@avuny/contracts`.

### 1.1 Category Breakdown

| Category | Files Affected | Count | Description |
|---|---|---|---|
| **A. Module Registry & Contracts Integration** | `warehouse.service.ts`, `warehouse-location.service.ts`, `deps.ts` | 5 | `PermissionKey` does not contain warehouse actions because `warehouse` is commented out in `packages/contracts/src/modules/registry.ts`, and `warehouse_location` is missing. Similarly, `ActivityLogAction` does not contain warehouse audit events. |
| **B. Invalid `ErrorMeta` Structure** | `warehouse.errors.ts`, `warehouse-location.errors.ts` | 43 | `ErrorMeta` expects `{ statusCode: ClientErrorStatusCode; responseMessage: string }`. Both files used `{ status: <number> }`, triggering TS2353 across 11 and 32 error constants. |
| **C. ErrorMap Status Widening** | `warehouse.error-map.ts`, `warehouse-location.error-map.ts` | 2 | Casting the module error maps `as Record<..., ErrorMeta>` widens `statusCode` to `ClientErrorStatusCode`. |
| **D. Hono Route Handlers Type Mismatch** | `warehouse/hono-routes/*.route.ts` (9 files)<br/>`warehouse-location/hono-routes/*.route.ts` (15 files) | 24 | Triggered by Category B & C: because `errorMap` statuses are widened to `ClientErrorStatusCode` (which includes 400, 401, etc.), `handleResult` returns a response type incompatible with the route's declared `responses` in `createRoute`, causing TS2345 in `router.openapi(...)`. |

---

## 2. Root Cause Details

### Root Cause 1: Missing Contracts Registration in `packages/contracts/src/modules/registry.ts`
- **Issue**:
  - `warehouse` is currently commented out in `packages/contracts/src/modules/registry.ts`.
  - `warehouse_location` is missing from `packages/contracts/src/modules/registry.ts`.
- **Consequences**:
  - `PermissionKey` (`{ [K in ModuleKey]: "${PermissionActionOf<K>}:${Hyphenate<K>}" }[ModuleKey]`) does not permit `"create:warehouse"`, `"read:warehouse"`, `"create:warehouse-location"`, etc.
  - In `warehouse.service.ts:38` and `warehouse-location.service.ts:80`, `permissions.check({ userId: actorId }, action, ...)` fails with `TS2769: No overload matches this call. Argument of type 'string' is not assignable to parameter of type 'PermissionKey'`.
  - `ActivityLogAction` does not include `"warehouse.created"`, `"warehouse_location.created"`, etc., causing `deps.ts:17` and `deps.ts:18` to fail with `TS2345: Argument of type 'AuditEntry' is not assignable to parameter of type 'ActivityLogEntry'`.

### Root Cause 2: `ErrorMeta` Schema in `warehouse.errors.ts` & `warehouse-location.errors.ts`
- **Issue**:
  - `packages/utils/src/response.ts` defines:
    ```ts
    export type ErrorMeta = {
      statusCode: ClientErrorStatusCode
      responseMessage: string
    }
    ```
  - `warehouse.errors.ts` and `warehouse-location.errors.ts` defined maps using:
    ```ts
    WAREHOUSE_NOT_FOUND: { status: 404 } // Invalid: 'status' does not exist in 'ErrorMeta'
    ```
- **Consequences**:
  - 11 TS2353 errors in `warehouse.errors.ts`.
  - 32 TS2353 errors in `warehouse-location.errors.ts`.

### Root Cause 3: Status Widening & Route Typing (`hono-routes`)
- **Issue**:
  - In `warehouse.error-map.ts` and `warehouse-location.error-map.ts`, typing with `as Record<..., ErrorMeta>` widens numeric literal status codes (`404`, `409`, `422`) to `ClientErrorStatusCode` (`400 | 401 | 402 | ...`).
  - Route handlers calling `handleResult({ c, result, errorMap, ... })` return `JSONRespondReturn<..., ClientErrorStatusCode>`, which Hono's `router.openapi` rejects because the route config only declared specific codes (e.g. `200 | 403 | 404 | 409`).
  - In canonical modules (`item`, `unit`), each endpoint defines its own scoped `const rawErrorMap = { ... } as const` matching the route's declared error responses, avoiding wide unions.

---

## 3. Work Status & Tracking

### In Progress
*(No tasks currently active - all planned phases completed!)*

---

### Todo
*(All tasks completed!)*

---

## Done
- [x] Initial error capture and root cause analysis across all 75 errors in 33 files (2026-11-13 14:40).
- [x] **Phase 1: Contracts Registration (`@avuny/contracts`)** (Completed: 2026-11-13 14:43)
  - [x] Registered `warehouse` module in `packages/contracts/src/modules/registry.ts` with CRUD, `deactivate` (permission: true), `reactivate`, and `set_default` events.
  - [x] Registered `warehouse_location` module in `packages/contracts/src/modules/registry.ts` with CRUD, `move`, `block`, `deactivate`, `change_barcode` (permission: true), and audit events.
  - [x] Regenerated contracts barrel and confirmed `packages/contracts` builds and typechecks cleanly.
- [x] **Phase 2: Warehouse Module Fixes (`apps/server/src/api/modules/warehouse`)** (Completed: 2026-11-13 14:47)
  - [x] Fixed `warehouse.errors.ts` (11 error definitions converted to `{ statusCode, responseMessage }`).
  - [x] Fixed `warehouse.error-map.ts` (retained literal status codes via `as const`).
  - [x] Fixed `warehouse.types.ts` & `deps.ts` (`ActivityLogAction`, `PermissionKey` strictly typed, adapter cleanly typesafe).
  - [x] Fixed `warehouse.service.ts` (`can` parameter typed with `PermissionKey`, audit typed with `ActivityLogAction`).
  - [x] Fixed all 9 route files in `warehouse/hono-routes/` to use scoped `rawErrorMap` per endpoint matching route responses.
  - [x] Verified zero errors in `apps/server/src/api/modules/warehouse/`.
- [x] **Phase 3: Warehouse-Location Module Fixes (`apps/server/src/api/modules/warehouse-location`)** (Completed: 2026-11-13 14:53)
  - [x] Fixed `warehouse-location.errors.ts` (32 error definitions converted to `{ statusCode, responseMessage }`).
  - [x] Fixed `warehouse-location.error-map.ts` (retained literal status codes via `as const`).
  - [x] Fixed `warehouse-location.types.ts` & `deps.ts` (`ActivityLogAction`, `PermissionKey` strictly typed, adapter cleanly typesafe).
  - [x] Fixed `warehouse-location.service.ts` (`can` parameter typed with `PermissionKey`, audit typed with `ActivityLogAction`, accumulated type counts).
  - [x] Fixed all 16 route files in `warehouse-location/hono-routes/` to use scoped `rawErrorMap` per endpoint matching route responses.
  - [x] Fixed `sidebar.permission-map.ts` to map `warehouse: "warehouse"`.
- [x] **Phase 4: Verification & Build Check** (Completed: 2026-11-13 14:56)
  - [x] Ran `pnpm --filter=books-server build` -> Exit code 0 (clean build).
  - [x] Ran `pnpm --filter=books-server typecheck` -> Exit code 0 (clean typecheck).
  - [x] Ran unit and route tests for warehouse & warehouse-location (93 tests passing).
- [ ] **3.1 Fix `warehouse-location.errors.ts`**:
  - Update all 32 error definitions to `{ statusCode: <Status>, responseMessage: "<Message>" }`.
- [ ] **3.2 Fix `warehouse-location.error-map.ts`**:
  - Retain literal status types using `as const satisfies Record<Code, ...>`.
- [ ] **3.3 Fix `warehouse-location.types.ts` & `deps.ts`**:
  - Update `PermissionChecker` and `ActivityLog` port types to align with `ActivityLogEntry` / `PermissionKey`.
  - Fix `deps.ts:18` audit adapter.
- [ ] **3.4 Fix `warehouse-location.service.ts`**:
  - Type `action` parameter as `PermissionKey` in `can(actorId, action, orgId)`.
  - Type audit logging actions as `ActivityLogAction`.
- [ ] **3.5 Fix all 15 route files in `warehouse-location/hono-routes/`**:
  - Ensure route `errorMap` and `createRoute` responses match exact status codes.
  - Verify:
    - [ ] `create-location.route.ts`
    - [ ] `bulk-create-locations.route.ts`
    - [ ] `get-location.route.ts`
    - [ ] `list-locations.route.ts`
    - [ ] `get-location-tree.route.ts`
    - [ ] `get-next-location-code.route.ts`
    - [ ] `lookup-location.route.ts`
    - [ ] `location-options.route.ts`
    - [ ] `update-location.route.ts`
    - [ ] `delete-location.route.ts`
    - [ ] `move-location.route.ts`
    - [ ] `deactivate-location.route.ts`
    - [ ] `reactivate-location.route.ts`
    - [ ] `block-location.route.ts`
    - [ ] `unblock-location.route.ts`
    - [ ] `change-location-barcode.route.ts`

#### Phase 4: Verification & Build Check
- [ ] Run `pnpm --filter=books-server build` and ensure exit status 0.
- [ ] Run `pnpm --filter=books-server typecheck` and ensure zero errors.
- [ ] Run all server unit and route tests (`pnpm --filter=books-server test`).

---

## Done
- [x] Initial error capture and root cause analysis across all 75 errors in 33 files (2026-11-13 14:40).
- [x] **Phase 1: Contracts Registration (`@avuny/contracts`)** (Completed: 2026-11-13 14:43)
  - [x] Registered `warehouse` module in `packages/contracts/src/modules/registry.ts` with CRUD, `deactivate` (permission: true), `reactivate`, and `set_default` events.
  - [x] Registered `warehouse_location` module in `packages/contracts/src/modules/registry.ts` with CRUD, `move`, `block`, `deactivate`, `change_barcode` (permission: true), and audit events.
  - [x] Regenerated contracts barrel and confirmed `packages/contracts` builds and typechecks cleanly.

