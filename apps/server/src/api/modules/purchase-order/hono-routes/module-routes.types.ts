import type { MiddlewareHandler } from "hono"
import type { PermissionKey } from "@avuny/contracts"
import type { PurchaseOrderService } from "../purchase-order.service.js"

export interface RouteDeps {
  service: PurchaseOrderService
  requireAuth: MiddlewareHandler
  requirePermission?: (permission: PermissionKey) => MiddlewareHandler
}
