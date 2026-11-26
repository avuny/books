import type { MiddlewareHandler } from "hono"
import type { PermissionKey } from "@avuny/contracts"
import type { InventoryTransferService } from "../inventory-transfer.service.js"

export interface RouteDeps {
  service: InventoryTransferService
  requireAuth: MiddlewareHandler
  requirePermission?: (permission: PermissionKey) => MiddlewareHandler
}
