import type { MiddlewareHandler } from "hono"
import type { ItemCategoryService } from "../item-category.types.js"
import type { RequirePermissionOptions } from "../../role/role.middleware.js"
import type { PermissionKey } from "../../role/role.types.js"

export interface RouteDeps {
  service: ItemCategoryService
  requireAuth: MiddlewareHandler
  requirePermission?: (key: PermissionKey, options?: RequirePermissionOptions) => MiddlewareHandler
}
