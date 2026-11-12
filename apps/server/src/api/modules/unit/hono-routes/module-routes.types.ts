import type { MiddlewareHandler } from "hono"
import type { UnitService } from "../unit.types.js"
import type { PermissionKey } from "../../role/role.types.js"

export interface RouteDeps {
  service: UnitService
  requireAuth: MiddlewareHandler
  requirePermission?: (key: PermissionKey) => MiddlewareHandler
}
