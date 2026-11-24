import type { MiddlewareHandler } from "hono"
import type { PartyService } from "../party.types.js"

export interface RouteDeps {
  service: PartyService
  requireAuth: MiddlewareHandler
}
