import type { MiddlewareHandler } from "hono"
import type { RoleService } from "../role.types.js"
import type { RequirePermissionOptions } from "../role.middleware.js"
import type { PermissionKey } from "../role.types.js"

export interface RouteDeps {
  service: RoleService
  requireAuth: MiddlewareHandler
  requirePermission?: (key: PermissionKey, options?: RequirePermissionOptions) => MiddlewareHandler
}

