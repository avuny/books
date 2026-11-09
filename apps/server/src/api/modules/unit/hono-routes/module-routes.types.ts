import type { MiddlewareHandler } from "hono"
import type { UnitService } from "../unit.types.js"
import type { RequirePermissionOptions } from "../../role/role.middleware.js"

export interface RouteDeps {
  service: UnitService
  requireAuth: MiddlewareHandler
  requirePermission?: (key: string, options?: RequirePermissionOptions) => MiddlewareHandler
}
