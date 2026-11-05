import type { MiddlewareHandler } from "hono"
import type { OrganizationService } from "../organization.types.js"

export interface RouteDeps {
  service: OrganizationService
  requireAuth: MiddlewareHandler
}

