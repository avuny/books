# Server Modules Refactoring Progress

Progress log for refactoring backend modules in `apps/server/src/api/modules/` to conform to the canonical architecture (`organization-invitation` benchmark and `apps/server/AGENTS.md` guidelines: `deps.ts`, closure routes, `types.ts`, `error-map.ts`, `SPEC.md`, `__tests__/`, and public barrels).

Work proceeds strictly **module by module**.

---

## In Progress

*(No modules currently in progress.)*

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
