import type { MiddlewareHandler } from "hono"
import type { WarehouseService } from "../warehouse.types.js"

export interface RouteDeps {
  service: WarehouseService
  requireAuth: MiddlewareHandler
}
