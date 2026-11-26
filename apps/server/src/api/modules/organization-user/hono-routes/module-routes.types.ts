import type { MiddlewareHandler } from "hono"
import type { OrganizationUserService } from "../organization-user.types.js"

export interface RouteDeps {
  service: OrganizationUserService
  requireAuth: MiddlewareHandler
}

