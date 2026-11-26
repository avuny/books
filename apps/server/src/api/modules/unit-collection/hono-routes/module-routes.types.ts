import type { MiddlewareHandler } from "hono"
import type { UnitCollectionService } from "../unit-collection.types.js"
import type { PermissionKey } from "../../role/role.types.js"

export interface RouteDeps {
  service: UnitCollectionService
  requireAuth: MiddlewareHandler
  requirePermission?: (key: PermissionKey) => MiddlewareHandler
}

