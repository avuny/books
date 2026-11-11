import type { MiddlewareHandler } from "hono"
import type { UnitService } from "../unit.types.js"

export interface RouteDeps {
  service: UnitService
  requireAuth: MiddlewareHandler
  requirePermission?: (key: string) => MiddlewareHandler
}
