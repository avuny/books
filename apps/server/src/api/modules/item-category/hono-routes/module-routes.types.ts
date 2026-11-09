import type { MiddlewareHandler } from "hono"
import type { ItemCategoryService } from "../item-category.types.js"
import type { RequirePermissionOptions } from "../../role/role.middleware.js"

export interface RouteDeps {
  service: ItemCategoryService
  requireAuth: MiddlewareHandler
  requirePermission?: (key: string, options?: RequirePermissionOptions) => MiddlewareHandler
}
