import { createOpenAPIRouter } from "@avuny/hono"
import { requireAuth } from "../../auth/index.js"
import { unitService } from "../deps.js"
import type { RouteDeps } from "./module-routes.types.js"
import { listUnitsRoute } from "./list-units.route.js"
import { listUnitCollectionsRoute } from "./list-unit-collections.route.js"
import { unitOptionsRoute } from "./unit-options.route.js"
import { unitCollectionOptionsRoute } from "./unit-collection-options.route.js"
import { getUnitCollectionRoute } from "./get-unit-collection.route.js"
import { createUnitCollectionRoute } from "./create-unit-collection.route.js"
import { updateUnitCollectionRoute } from "./update-unit-collection.route.js"
import { deleteUnitCollectionRoute } from "./delete-unit-collection.route.js"

export const createUnitRoutes = (deps: RouteDeps) => {
  const router = createOpenAPIRouter()

  router.route("/", listUnitsRoute(deps))
  router.route("/", listUnitCollectionsRoute(deps))
  router.route("/", unitOptionsRoute(deps))
  router.route("/", unitCollectionOptionsRoute(deps))
  router.route("/", getUnitCollectionRoute(deps))
  router.route("/", createUnitCollectionRoute(deps))
  router.route("/", updateUnitCollectionRoute(deps))
  router.route("/", deleteUnitCollectionRoute(deps))

  return router
}

export const unitRoutes = createUnitRoutes({
  service: unitService,
  requireAuth,
})

export default unitRoutes
