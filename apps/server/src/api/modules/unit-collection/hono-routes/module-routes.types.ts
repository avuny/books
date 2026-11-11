import type { MiddlewareHandler } from "hono"
import type { UnitCollectionService } from "../unit-collection.types.js"

export interface RouteDeps {
  service: UnitCollectionService
  requireAuth: MiddlewareHandler
  requirePermission?: (key: string) => MiddlewareHandler
}

