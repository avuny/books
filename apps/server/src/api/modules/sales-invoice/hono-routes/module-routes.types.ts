import type { MiddlewareHandler } from "hono"
import type { PermissionKey } from "@avuny/contracts"
import type { SalesInvoiceService } from "../sales-invoice.service.js"

export interface RouteDeps {
  service: SalesInvoiceService
  requireAuth: MiddlewareHandler
  requirePermission?: (permission: PermissionKey) => MiddlewareHandler
}
