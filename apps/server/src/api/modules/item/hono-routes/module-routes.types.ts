import type { MiddlewareHandler } from "hono"
import type { ItemService } from "../item.types.js"
import type { RequirePermissionOptions } from "../../role/role.middleware.js"
import type { PermissionKey } from "../../role/role.types.js"

export interface RouteDeps {
  service: ItemService
  requireAuth: MiddlewareHandler
  requirePermission?: (key: PermissionKey, options?: RequirePermissionOptions) => MiddlewareHandler
}
