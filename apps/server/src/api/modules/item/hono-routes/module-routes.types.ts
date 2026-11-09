import type { MiddlewareHandler } from "hono"
import type { ItemService } from "../item.types.js"
import type { RequirePermissionOptions } from "../../role/role.middleware.js"

export interface RouteDeps {
  service: ItemService
  requireAuth: MiddlewareHandler
  requirePermission?: (key: string, options?: RequirePermissionOptions) => MiddlewareHandler
}
