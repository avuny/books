import { createOpenAPIRouter } from "@avuny/hono"
import { requireAuth } from "../../auth/index.js"
import { warehouseLocationService } from "../deps.js"
import type { RouteDeps } from "./module-routes.types.js"
import { createWarehouseLocationRoute } from "./create-location.route.js"
import { bulkCreateWarehouseLocationsRoute } from "./bulk-create-locations.route.js"
import { getWarehouseLocationTreeRoute } from "./get-location-tree.route.js"
import { getNextWarehouseLocationCodeRoute } from "./get-next-location-code.route.js"
import { listWarehouseLocationsRoute } from "./list-locations.route.js"
import { warehouseLocationOptionsRoute } from "./location-options.route.js"
import { lookupWarehouseLocationRoute } from "./lookup-location.route.js"
import { getWarehouseLocationRoute } from "./get-location.route.js"
import { updateWarehouseLocationRoute } from "./update-location.route.js"
import { moveWarehouseLocationRoute } from "./move-location.route.js"
import { blockWarehouseLocationRoute } from "./block-location.route.js"
import { unblockWarehouseLocationRoute } from "./unblock-location.route.js"
import { deactivateWarehouseLocationRoute } from "./deactivate-location.route.js"
import { reactivateWarehouseLocationRoute } from "./reactivate-location.route.js"
import { changeWarehouseLocationBarcodeRoute } from "./change-location-barcode.route.js"
import { deleteWarehouseLocationRoute } from "./delete-location.route.js"

export const createWarehouseLocationRoutes = (deps: RouteDeps) => {
  const router = createOpenAPIRouter()

  // Static paths are registered before parametric ones that could shadow them.
  router.route("/", createWarehouseLocationRoute(deps))
  router.route("/", bulkCreateWarehouseLocationsRoute(deps))
  router.route("/", getWarehouseLocationTreeRoute(deps))
  router.route("/", getNextWarehouseLocationCodeRoute(deps))
  router.route("/", listWarehouseLocationsRoute(deps))
  router.route("/", warehouseLocationOptionsRoute(deps))
  router.route("/", lookupWarehouseLocationRoute(deps))
  router.route("/", getWarehouseLocationRoute(deps))
  router.route("/", updateWarehouseLocationRoute(deps))
  router.route("/", moveWarehouseLocationRoute(deps))
  router.route("/", blockWarehouseLocationRoute(deps))
  router.route("/", unblockWarehouseLocationRoute(deps))
  router.route("/", deactivateWarehouseLocationRoute(deps))
  router.route("/", reactivateWarehouseLocationRoute(deps))
  router.route("/", changeWarehouseLocationBarcodeRoute(deps))
  router.route("/", deleteWarehouseLocationRoute(deps))

  return router
}

export const warehouseLocationRoutes = createWarehouseLocationRoutes({
  service: warehouseLocationService,
  requireAuth,
})

export default warehouseLocationRoutes
