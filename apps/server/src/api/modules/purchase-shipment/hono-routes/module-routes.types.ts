import type { MiddlewareHandler } from "hono"
import type { PermissionKey } from "@avuny/contracts"
import type { PurchaseShipmentService } from "../purchase-shipment.service.js"

export interface RouteDeps {
  service: PurchaseShipmentService
  requireAuth: MiddlewareHandler
  requirePermission?: (permission: PermissionKey) => MiddlewareHandler
}
