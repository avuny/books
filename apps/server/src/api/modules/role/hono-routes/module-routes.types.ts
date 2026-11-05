import type { MiddlewareHandler } from "hono"
import type { RoleService } from "../role.types.js"
import type { RequirePermissionOptions } from "../role.middleware.js"

export interface RouteDeps {
  service: RoleService
  requireAuth: MiddlewareHandler
  requirePermission?: (key: string, options?: RequirePermissionOptions) => MiddlewareHandler
}

