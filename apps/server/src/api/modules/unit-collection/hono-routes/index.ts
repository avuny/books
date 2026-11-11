import { createOpenAPIRouter } from "@avuny/hono"
import { requireAuth } from "../../auth/index.js"
import { unitCollectionService } from "../deps.js"
import type { RouteDeps } from "./module-routes.types.js"
import { listUnitCollectionsRoute } from "./list-unit-collections.route.js"
import { unitCollectionOptionsRoute } from "./unit-collection-options.route.js"
import { getUnitCollectionRoute } from "./get-unit-collection.route.js"
import { createUnitCollectionRoute } from "./create-unit-collection.route.js"
import { updateUnitCollectionRoute } from "./update-unit-collection.route.js"
import { deleteUnitCollectionRoute } from "./delete-unit-collection.route.js"

export const createUnitCollectionRoutes = (deps: RouteDeps) => {
  const router = createOpenAPIRouter()

  router.route("/", listUnitCollectionsRoute(deps))
  router.route("/", unitCollectionOptionsRoute(deps))
  router.route("/", getUnitCollectionRoute(deps))
  router.route("/", createUnitCollectionRoute(deps))
  router.route("/", updateUnitCollectionRoute(deps))
  router.route("/", deleteUnitCollectionRoute(deps))

  return router
}

export const unitCollectionRoutes = createUnitCollectionRoutes({
  service: unitCollectionService,
  requireAuth,
})

export default unitCollectionRoutes

