import type { MiddlewareHandler } from "hono"
import type { OrganizationInvitationService } from "../organization-invitation.types.js"

export interface RouteDeps {
  service: OrganizationInvitationService
  requireAuth: MiddlewareHandler
}
