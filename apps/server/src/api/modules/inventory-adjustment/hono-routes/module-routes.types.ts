import type { MiddlewareHandler } from "hono"
import type { PermissionKey } from "@avuny/contracts"
import type { InventoryAdjustmentService } from "../inventory-adjustment.service.js"

export interface RouteDeps {
  service: InventoryAdjustmentService
  requireAuth: MiddlewareHandler
  requirePermission?: (permission: PermissionKey) => MiddlewareHandler
}
