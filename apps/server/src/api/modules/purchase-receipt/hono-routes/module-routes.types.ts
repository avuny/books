import type { MiddlewareHandler } from "hono"
import type { PermissionKey } from "@avuny/contracts"
import type { PurchaseReceiptService } from "../purchase-receipt.service.js"

export interface RouteDeps {
  service: PurchaseReceiptService
  requireAuth: MiddlewareHandler
  requirePermission?: (permission: PermissionKey) => MiddlewareHandler
}
