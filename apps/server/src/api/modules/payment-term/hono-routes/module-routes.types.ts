import type { MiddlewareHandler } from "hono"
import type { PermissionKey } from "@avuny/contracts"
import type { PaymentTermService } from "../payment-term.service.js"

export interface RouteDeps {
  service: PaymentTermService
  requireAuth: MiddlewareHandler
  requirePermission?: (permission: PermissionKey) => MiddlewareHandler
}
