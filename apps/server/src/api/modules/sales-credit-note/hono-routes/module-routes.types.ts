import type { MiddlewareHandler } from "hono"
import type { PermissionKey } from "@avuny/contracts"
import type { SalesCreditNoteService } from "../sales-credit-note.service.js"

export interface RouteDeps {
  service: SalesCreditNoteService
  requireAuth: MiddlewareHandler
  requirePermission?: (permission: PermissionKey) => MiddlewareHandler
}
