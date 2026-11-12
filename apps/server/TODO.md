# Server Modules Refactoring Progress

Progress log for refactoring backend modules in `apps/server/src/api/modules/` to conform to the canonical architecture (`organization-invitation` benchmark and `apps/server/AGENTS.md` guidelines: `deps.ts`, closure routes, `types.ts`, `error-map.ts`, `SPEC.md`, `__tests__/`, and public barrels).

Work proceeds strictly **module by module**.

---

## In Progress

*(No modules currently in progress.)*

---

## Done

### Shared PermissionChecker Standardization & Service Authorization (Completed: 2026-11-12 15:42)
- [x] Module `role`:
  - [x] Extended canonical `PermissionChecker` in `role.types.ts` to accept `keyOrKeys: PermissionKey | readonly [PermissionKey, ...PermissionKey[]]`.
- [x] Module `organization`:
  - [x] Removed `ActivityLogAction | string` from `organization.types.ts`; imported shared `PermissionChecker` from `../role/index.js`.
  - [x] Removed erroneous `create:organization` permission check from `organization.service.ts` (creation is governed by auth and plan limit `maxOwnedPerUser()`, as defined in module registry).
  - [x] Re-exported canonical `DummyPermissionChecker` from `../role/index.js`.
  - [x] Verified unit and route tests pass (31 tests).
- [x] Module `organization-user`:
  - [x] Updated `organization-user.types.ts`: Replaced local `PermissionChecker` with shared `PermissionChecker` from `../role/index.js`.
  - [x] Updated `organization-user.service.ts`: Strictly typed action parameter with `PermissionKey`.
  - [x] Updated `testing.ts`: Re-exported canonical `DummyPermissionChecker` from `../role/index.js`.
  - [x] Verified unit and route tests pass (25 tests).
- [x] Module `organization-invitation`:
  - [x] Updated `organization-invitation.types.ts`: Replaced ad-hoc `permissions: { check(...) }` with shared `PermissionChecker` from `../role/index.js`.
  - [x] Verified unit and route tests pass (34 tests).
- [x] Module `unit`:
  - [x] Updated `unit.types.ts`: Added `permissions?: PermissionChecker` (imported from `../role/index.js`).
  - [x] Updated `unit.service.ts`: Injected `permissions` and enforced checks for `read:unit`, `create:unit`, `update:unit`, `deactivate:unit`, `delete:unit`, returning `UNIT_FORBIDDEN`.
  - [x] Updated `deps.ts`: Wired `permissionChecker` from `../role/index.js`.
  - [x] Updated `testing.ts`: Re-exported `DummyPermissionChecker` from `../role/index.js`.
  - [x] Updated routes and tests to pass `user.id` and assert permission denial (14 tests).
- [x] Module `unit-collection`:
  - [x] Added `UNIT_COLLECTION_FORBIDDEN` error code to contracts, locales (en, ar), errors, and error-map.
  - [x] Updated `unit-collection.types.ts`: Added `permissions?: PermissionChecker` from `../role/index.js`.
  - [x] Updated `unit-collection.service.ts`: Enforced permission checks for `read:unit-collection`, `create:unit-collection`, `update:unit-collection`, `delete:unit-collection`.
  - [x] Updated `deps.ts`: Wired `permissionChecker` from `../role/index.js`.
  - [x] Updated `testing.ts`: Re-exported `DummyPermissionChecker` from `../role/index.js`.
  - [x] Updated routes and tests (23 tests).
- [x] Module `item-category`:
  - [x] Added `ITEM_CATEGORY_FORBIDDEN` error code to contracts, locales (en, ar), errors, and error-map.
  - [x] Updated `item-category.types.ts`: Added `permissions?: PermissionChecker` from `../role/index.js`.
  - [x] Updated `item-category.service.ts`: Enforced permission checks for `read:item-category`, `create:item-category`, `update:item-category`, `delete:item-category`.
  - [x] Updated `deps.ts`: Wired `permissionChecker` from `../role/index.js`.
  - [x] Updated `testing.ts`: Re-exported `DummyPermissionChecker` from `../role/index.js`.
  - [x] Updated routes and tests (25 tests).
- [x] Module `item`:
  - [x] Added `ITEM_FORBIDDEN` error code to contracts, locales (en, ar), errors, and error-map.
  - [x] Updated `item.types.ts`: Added `permissions?: PermissionChecker` from `../role/index.js`.
  - [x] Updated `item.service.ts`: Enforced permission checks for `read:item`, `create:item`, `update:item`, `delete:item`.
  - [x] Updated `deps.ts`: Wired `permissionChecker` from `../role/index.js`.
  - [x] Updated `testing.ts`: Re-exported `DummyPermissionChecker` from `../role/index.js`.
  - [x] Updated routes and tests (32 tests).
- [x] Module `activity-log`:
  - [x] Updated `activity-log.service.ts` and `deps.ts` to use shared `PermissionChecker`.
  - [x] Verified tests pass (8 tests).

---

## Done

### Module 1: `organization` (Completed: 2026-11-05 13:06)
- [x] Create `organization.types.ts` (Service, Repository, port interfaces: PermissionChecker, Cache, ActivityLog, OrganizationLimits, deps bag).
- [x] Extract and verify `organization.mapper.ts`.
- [x] Create `organization.error-map.ts` (comprehensive error map covering all `OrganizationErrorCode`s).
- [x] Refactor `organization.service.ts` to pure closure factory accepting `OrganizationServiceDeps` (no direct `db` import, no inline `createDefaultOrganizationService`).
- [x] Create `deps.ts` (singleton composition, lazy getter `getOrganizationService()`, `organizationService` Proxy export wiring DB, repositories, services, activity log, permissions, cache, limits).
- [x] Refactor `hono-routes/`:
  - [x] Add `_shared.ts` (helper methods `jsonOk`, `jsonError`, `honoPath`).
  - [x] Add `module-routes.types.ts` (`RouteDeps`).
  - [x] Convert `create-organization.route.ts`, `get-organization.route.ts`, `update-organization.route.ts`, `organization-list.route.ts` to closure factories.
  - [x] Update `hono-routes/index.ts` to export `createOrganizationRoutes(deps)` and singleton `organizationRoutes`.
- [x] Add route unit tests under `__tests__/` (testing HTTP responses, error status mappings with mock deps).
- [x] Create `SPEC.md` for `organization`.
- [x] Update public barrel `index.ts` to re-export service, repository, routes, types, error-map, and singletons.
- [x] Verify test suite (32 unit & route tests pass) and typecheck for `organization`.

### Module 3: `role` (Completed: 2026-11-05 14:52)
- [x] Inspect existing `role` module components (`role.service.ts`, `role.repository.ts`, `role.permissions.ts`, `role.middleware.ts`, `role.seed.ts`, `permission-checker/`).
- [x] Create `role.types.ts` (Service, Repository, port interfaces: PlanFeatures, ActivityLog, PermissionChecker, PermissionResolver, Cache, deps bag).
- [x] Create `role.error-map.ts` (exhaustive error map covering all 10 `RoleErrorCode`s).
- [x] Create `testing.ts` with test doubles (`DummyPlanFeatures`, `DummyActivityLog`, `DummyCache`, `DummyPermissionChecker`).
- [x] Refactor `role.service.ts` to pure closure factory accepting `RoleServiceDeps` (no direct `db` import, no inline default creation).
- [x] Create `deps.ts` (singleton composition, lazy getters, `roleService` / `permissionResolver` / `permissionChecker` Proxy exports wiring DB, repositories, resolver, checker).
- [x] Refactor `hono-routes/`:
  - [x] Add `_shared.ts` and `module-routes.types.ts` (`RouteDeps` with `service`, `requireAuth`, `requirePermission`).
  - [x] Convert all 10 route handlers to closure factories accepting `RouteDeps`.
  - [x] Update `hono-routes/index.ts` to export `createRoleRoutes(deps)` and singleton `roleRoutes`.
- [x] Add route unit tests in `__tests__/role.routes.test.ts` (10 tests covering all endpoints).
- [x] Create `SPEC.md` for `role`.
- [x] Update public barrel `index.ts` to re-export service, repository, routes, permissions, middleware, types, error-map, testing, and singletons.
- [x] Verify test suite (58 tests across 5 files pass) and typecheck clean across entire monorepo.

### Module 2: `organization-user` (Completed: 2026-11-05 13:59)
- [x] Create `organization-user.types.ts` (ports, interfaces, deps bag).
- [x] Create `organization-user.error-map.ts`.
- [x] Refactor `organization-user.service.ts` to pure closure factory (deps bag, no direct DB or inline default creation).
- [x] Create `deps.ts` wiring DB, repositories, role permissions, activity logs, limits.
- [x] Refactor `hono-routes/`:
  - [x] Add `_shared.ts` and `module-routes.types.ts`.
  - [x] Convert all 6 route handlers (`my-organization-list`, `organization-user-list`, `set-organization-user-status`, `touch-organization-membership`, `transfer-organization-ownership`, `update-organization-user`) to closure factories accepting `RouteDeps`.
  - [x] Update `hono-routes/index.ts` to export `createOrganizationUserRoutes(deps)` and default singleton.
- [x] Add route unit tests in `__tests__/` (testing all endpoints with mock service & auth).
- [x] Create `SPEC.md` for `organization-user`.
- [x] Update public barrel `index.ts`.
- [x] Verify test suite (25 tests pass) and typecheck for `organization-user`.
