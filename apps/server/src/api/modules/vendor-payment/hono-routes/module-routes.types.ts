import type { MiddlewareHandler } from "hono"
import type { PermissionKey } from "@avuny/contracts"
import type { VendorPaymentService } from "../vendor-payment.service.js"

export interface RouteDeps {
  service: VendorPaymentService
  requireAuth: MiddlewareHandler
  requirePermission?: (permission: PermissionKey) => MiddlewareHandler
}
