import type { MiddlewareHandler } from "hono"
import type { PermissionKey } from "@avuny/contracts"
import type { StockMovementService } from "../stock-movement.types.js"

export interface RouteDeps {
  service: StockMovementService
  requireAuth: MiddlewareHandler
  requirePermission?: (permission: PermissionKey) => MiddlewareHandler
}

