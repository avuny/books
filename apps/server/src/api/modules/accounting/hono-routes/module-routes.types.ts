import type { MiddlewareHandler } from "hono"
import type { PermissionKey } from "@avuny/contracts"
import type { AccountingService } from "../accounting.types.js"
import { RequirePermissionOptions } from "../../role/role.middleware.js"

export interface RouteDeps {
  service: AccountingService
  requireAuth: MiddlewareHandler
  requirePermission?: (key: PermissionKey, options?: RequirePermissionOptions) => MiddlewareHandler
}
