import { createOpenAPIRouter } from "@avuny/hono"
import { requireAuth } from "../../auth/index.js"
import { unitService } from "../deps.js"
import type { RouteDeps } from "./module-routes.types.js"
import { listUnitsRoute } from "./list-units.route.js"
import { unitOptionsRoute } from "./unit-options.route.js"
import { getUnitRoute } from "./get-unit.route.js"
import { createUnitRoute } from "./create-unit.route.js"
import { updateUnitRoute } from "./update-unit.route.js"
import { deleteUnitRoute } from "./delete-unit.route.js"

export const createUnitRoutes = (deps: RouteDeps) => {
  const router = createOpenAPIRouter()

  router.route("/", listUnitsRoute(deps))
  router.route("/", unitOptionsRoute(deps))
  router.route("/", getUnitRoute(deps))
  router.route("/", createUnitRoute(deps))
  router.route("/", updateUnitRoute(deps))
  router.route("/", deleteUnitRoute(deps))

  return router
}

export const unitRoutes = createUnitRoutes({
  service: unitService,
  requireAuth,
})

export default unitRoutes
