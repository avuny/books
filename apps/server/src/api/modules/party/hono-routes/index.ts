import { createOpenAPIRouter } from "@avuny/hono"
import { requireAuth } from "../../auth/index.js"
import { partyService } from "../deps.js"
import type { RouteDeps } from "./module-routes.types.js"
import { createPartyRoute } from "./create-party.route.js"
import { listPartiesRoute } from "./list-parties.route.js"
import { partyOptionsRoute } from "./party-options.route.js"
import { getPartyRoute } from "./get-party.route.js"
import { updatePartyRoute } from "./update-party.route.js"
import { addPartyRoleRoute } from "./add-party-role.route.js"
import { deactivatePartyRoleRoute } from "./deactivate-party-role.route.js"

export const createPartyRoutes = (deps: RouteDeps) => {
  const router = createOpenAPIRouter()

  router.route("/", createPartyRoute(deps))
  router.route("/", listPartiesRoute(deps))
  router.route("/", partyOptionsRoute(deps))
  router.route("/", getPartyRoute(deps))
  router.route("/", updatePartyRoute(deps))
  router.route("/", addPartyRoleRoute(deps))
  router.route("/", deactivatePartyRoleRoute(deps))

  return router
}

export const partyRoutes = createPartyRoutes({
  service: partyService,
  requireAuth,
})

export default partyRoutes
