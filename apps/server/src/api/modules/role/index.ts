export { RoleErrorCode, roleErrorsHttpMap } from "./role.errors.js"
export { roleErrorMap } from "./role.error-map.js"
export {
  createRoleService,
  DummyPlanFeatures,
  DummyActivityLog,
} from "./role.service.js"
export {
  createRoleRepository,
  type RoleRepository,
} from "./role.repository.js"
export {
  createPermissionResolver,
  createRbacPermissionChecker,
  DummyCache,
} from "./role.permissions.js"
export {
  roleService,
  getRoleService,
  permissionResolver,
  getPermissionResolver,
  permissionChecker,
  getPermissionChecker,
  getRoleRepository,
} from "./deps.js"
export { requirePermission } from "./role.middleware.js"
export { syncSystemRoles } from "./role.seed.js"
export {
  roleRoutes,
  createRoleRoutes,
} from "./hono-routes/index.js"
export { DummyPermissionChecker } from "./testing.js"
export type {
  RoleService,
  RoleServiceDeps,
  PlanFeatures,
  ActivityLog,
  ActivityLogEntry,
  PermissionChecker,
  PermissionResolver,
  PermissionResolverDeps,
  Cache,
} from "./role.types.js"
