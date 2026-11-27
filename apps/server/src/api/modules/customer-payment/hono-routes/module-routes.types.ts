import type { MiddlewareHandler } from "hono"
import type { PermissionKey } from "@avuny/contracts"
import type { CustomerPaymentService } from "../customer-payment.service.js"

export interface RouteDeps {
  service: CustomerPaymentService
  requireAuth: MiddlewareHandler
  requirePermission?: (permission: PermissionKey) => MiddlewareHandler
}
