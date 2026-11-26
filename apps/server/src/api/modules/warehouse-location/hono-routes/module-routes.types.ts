import type { MiddlewareHandler } from "hono"
import type { WarehouseLocationService } from "../warehouse-location.types.js"

export interface RouteDeps {
  service: WarehouseLocationService
  requireAuth: MiddlewareHandler
}
