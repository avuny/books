import type { MiddlewareHandler } from "hono"
import type { PermissionKey } from "@avuny/contracts"
import type { SalesDeliveryService } from "../sales-delivery.service.js"

export interface RouteDeps {
  service: SalesDeliveryService
  requireAuth: MiddlewareHandler
  requirePermission?: (permission: PermissionKey) => MiddlewareHandler
}
